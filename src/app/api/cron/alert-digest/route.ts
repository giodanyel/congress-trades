import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { sendEmail } from "@/lib/email";
import { aggregateByPolitician, roiOf, isActive } from "@/lib/analytics";
import {
  estimatedTradeValue,
  type Trade,
  type Politician,
  type TradeReturn,
} from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const ALERT_RECIPIENT = "giovandererve@gmail.com";
// How many of the currently-active, currently-outperforming politicians
// count as "top performers" for alerting purposes. Matches the homepage's
// "Top Performers, Currently Active" list.
const TOP_PERFORMER_LIMIT = 10;

function isAuthorized(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get("secret");
  if (secret && process.env.ADMIN_SYNC_SECRET && secret === process.env.ADMIN_SYNC_SECRET) {
    return true;
  }
  // Vercel Cron automatically sends this header when a CRON_SECRET env var
  // is configured, so scheduled runs don't need the secret in vercel.json.
  const auth = req.headers.get("authorization");
  if (auth && process.env.CRON_SECRET && auth === `Bearer ${process.env.CRON_SECRET}`) {
    return true;
  }
  return false;
}

function titleCase(s: string) {
  return s.charAt(0) + s.slice(1).toLowerCase();
}

function buildDigestHtml(
  rows: { trade: Trade; politician: Politician; pnl: number | null; roi: number }[]
) {
  const items = rows
    .map(({ trade, politician, pnl, roi }) => {
      const action =
        trade.trade_type === "PURCHASE" ? "bought" : trade.trade_type === "SALE" ? "sold" : "exchanged";
      const pnlText =
        pnl === null
          ? ""
          : ` &mdash; est. ${pnl >= 0 ? "+" : "-"}$${Math.abs(pnl).toLocaleString("en-US", {
              maximumFractionDigits: 0,
            })} on this trade`;
      return `<li style="margin-bottom:14px;line-height:1.5;">
        <strong>${politician.full_name}</strong>
        <span style="color:#71717a;">(${titleCase(politician.party)} &middot; ${politician.state}, currently +${(roi * 100).toFixed(0)}%)</span>
        ${action} <strong>${trade.ticker}</strong> &middot; ${trade.amount_label ?? "amount undisclosed"}${pnlText}
        <br/><span style="color:#a1a1aa;font-size:12px;">${trade.transaction_date}</span>
      </li>`;
    })
    .join("");

  return `<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:560px;margin:0 auto;color:#18181b;">
    <h2 style="margin-bottom:4px;">New trades from top-performing members of Congress</h2>
    <p style="color:#71717a;font-size:13px;">These politicians are currently active (traded in the last 120 days) and outperforming on their priced trades.</p>
    <ul style="padding-left:18px;margin-top:20px;">${items}</ul>
    <p style="color:#a1a1aa;font-size:11px;margin-top:24px;">Estimates only, based on STOCK Act disclosed dollar ranges and available price history. Not investment advice.</p>
  </div>`;
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();

  const [{ data: politicians }, { data: trades }, { data: returns }, { data: alreadyAlerted }] =
    await Promise.all([
      supabase.from("politicians").select("*").returns<Politician[]>(),
      supabase.from("trades").select("*").returns<Trade[]>(),
      supabase.from("trade_returns").select("*").returns<TradeReturn[]>(),
      supabase.from("trade_alerts_sent").select("trade_id"),
    ]);

  const politicianById = new Map((politicians ?? []).map((p) => [p.id, p]));
  const returnByTradeId = new Map((returns ?? []).map((r) => [r.trade_id, r]));
  const alertedIds = new Set((alreadyAlerted ?? []).map((r) => r.trade_id as string));
  const allTrades = trades ?? [];

  const agg = aggregateByPolitician(allTrades, returnByTradeId);

  const topPerformers = [...agg.entries()]
    .filter(([, a]) => a.pricedTrades > 0 && isActive(a) && roiOf(a) > 0)
    .sort((a, b) => roiOf(b[1]) - roiOf(a[1]))
    .slice(0, TOP_PERFORMER_LIMIT);

  const roiByPoliticianId = new Map(topPerformers.map(([id, a]) => [id, roiOf(a)]));

  const newAlerts = allTrades.filter(
    (t) => roiByPoliticianId.has(t.politician_id) && !alertedIds.has(t.id)
  );

  if (newAlerts.length === 0) {
    return NextResponse.json({
      sent: false,
      newAlerts: 0,
      topPerformers: topPerformers.length,
      note: "No unsent trades from current top performers.",
    });
  }

  newAlerts.sort((a, b) => b.transaction_date.localeCompare(a.transaction_date));

  const rows = newAlerts.map((t) => {
    const p = politicianById.get(t.politician_id)!;
    const r = returnByTradeId.get(t.id);
    const value = estimatedTradeValue(t);
    const pnl = r && r.return_pct !== null && value !== null ? r.return_pct * value : null;
    return { trade: t, politician: p, pnl, roi: roiByPoliticianId.get(t.politician_id)! };
  });

  const html = buildDigestHtml(rows);

  try {
    await sendEmail({
      to: ALERT_RECIPIENT,
      subject: `${newAlerts.length} new trade${newAlerts.length === 1 ? "" : "s"} from top-performing members of Congress`,
      html,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }

  const { error: insertError } = await supabase
    .from("trade_alerts_sent")
    .insert(newAlerts.map((t) => ({ trade_id: t.id })));

  if (insertError) {
    // Email already went out; surface this loudly since a failed insert
    // here means the same trades would get re-emailed next run.
    return NextResponse.json(
      { sent: true, newAlerts: newAlerts.length, markSentError: insertError.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ sent: true, newAlerts: newAlerts.length });
}
