import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { sendEmail } from "@/lib/email";
import { isAdminAuthorized } from "@/lib/adminAuth";
import { aggregateByPolitician, roiOf, type PoliticianAgg } from "@/lib/analytics";
import {
  estimatedTradeValue,
  type Trade,
  type Politician,
  type TradeReturn,
} from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const ALERT_RECIPIENT = "giovandererve@gmail.com";
// Top performers by estimated ROI on priced trades. Intentionally NOT
// limited to recently-active politicians here (unlike the homepage) --
// well-known names like Pelosi may not trade often, but a new trade from
// them is still exactly the kind of thing worth flagging.
const TOP_PERFORMER_LIMIT = 15;

function titleCase(s: string) {
  return s.charAt(0) + s.slice(1).toLowerCase();
}

function daysBetween(a: string, b: string) {
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / (1000 * 60 * 60 * 24));
}

function buildDigestHtml(
  rows: {
    trade: Trade;
    politician: Politician;
    pnl: number | null;
    roi: number;
    agg: PoliticianAgg;
  }[]
) {
  const items = rows
    .map(({ trade, politician, pnl, roi, agg }) => {
      const action =
        trade.trade_type === "PURCHASE" ? "bought" : trade.trade_type === "SALE" ? "sold" : "exchanged";
      const pnlText =
        pnl === null
          ? ""
          : ` &mdash; est. ${pnl >= 0 ? "+" : "-"}$${Math.abs(pnl).toLocaleString("en-US", {
              maximumFractionDigits: 0,
            })} on this trade so far`;

      const lagText = trade.filing_date
        ? (() => {
            const lag = daysBetween(trade.transaction_date, trade.filing_date!);
            const urgency =
              lag <= 10
                ? "#059669"
                : lag <= 25
                  ? "#d97706"
                  : "#dc2626";
            return `<div style="margin-top:4px;font-size:12px;color:${urgency};">Disclosed ${trade.filing_date} &mdash; ${lag} day${lag === 1 ? "" : "s"} after the actual trade</div>`;
          })()
        : `<div style="margin-top:4px;font-size:12px;color:#a1a1aa;">Filing date unknown &mdash; STOCK Act allows up to 45 days between trade and disclosure</div>`;

      return `<li style="margin-bottom:18px;line-height:1.5;padding-bottom:14px;border-bottom:1px solid #f4f4f5;">
        <div><strong>${politician.full_name}</strong>
        <span style="color:#71717a;">(${titleCase(politician.party)} &middot; ${politician.state})</span></div>
        <div style="margin-top:2px;">${action} <strong>${trade.ticker}</strong> &middot; ${trade.amount_label ?? "amount undisclosed"}${pnlText}</div>
        <div style="margin-top:2px;font-size:12px;color:#a1a1aa;">Traded ${trade.transaction_date}</div>
        ${lagText}
        <div style="margin-top:4px;font-size:12px;color:#71717a;">Track record: est. ${roi >= 0 ? "+" : ""}${(roi * 100).toFixed(0)}% avg. return across ${agg.pricedTrades} of their ${agg.totalTrades} trades with price data (${Math.round((agg.pricedTrades / agg.totalTrades) * 100)}% coverage)</div>
      </li>`;
    })
    .join("");

  return `<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:560px;margin:0 auto;color:#18181b;">
    <h2 style="margin-bottom:4px;">New trades from top-performing members of Congress</h2>
    <p style="color:#71717a;font-size:13px;">Ranked by estimated ROI on their priced trades to date.</p>
    <ul style="padding-left:18px;margin-top:20px;list-style:none;">${items}</ul>
    <div style="margin-top:24px;padding:14px;background:#fafafa;border-radius:8px;font-size:12px;color:#52525b;line-height:1.6;">
      <strong>This is not financial advice.</strong> These are estimates built from disclosed dollar ranges and available price history, not exact figures. Disclosures can lag the real trade by weeks, so the price you'd see today may already differ from when the trade happened. A handful of past trades isn't a reliable predictor of future ones, and none of this accounts for your own finances, risk tolerance, or goals. If you're considering acting on any of this, talk to a licensed financial advisor first.
    </div>
  </div>`;
}

export async function GET(req: NextRequest) {
  if (!isAdminAuthorized(req)) {
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
    .filter(([, a]) => a.pricedTrades > 0 && roiOf(a) > 0)
    .sort((a, b) => roiOf(b[1]) - roiOf(a[1]))
    .slice(0, TOP_PERFORMER_LIMIT);

  const aggByPoliticianId = new Map(topPerformers.map(([id, a]) => [id, a]));

  const newAlerts = allTrades.filter(
    (t) => aggByPoliticianId.has(t.politician_id) && !alertedIds.has(t.id)
  );

  if (newAlerts.length === 0) {
    return NextResponse.json({
      sent: false,
      newAlerts: 0,
      topPerformers: topPerformers.length,
      topPerformerNames: topPerformers.map(([id]) => politicianById.get(id)?.full_name),
      note: "No unsent trades from current top performers.",
    });
  }

  newAlerts.sort((a, b) => b.transaction_date.localeCompare(a.transaction_date));

  const rows = newAlerts.map((t) => {
    const p = politicianById.get(t.politician_id)!;
    const r = returnByTradeId.get(t.id);
    const value = estimatedTradeValue(t);
    const pnl = r && r.return_pct !== null && value !== null ? r.return_pct * value : null;
    const politicianAgg = aggByPoliticianId.get(t.politician_id)!;
    return { trade: t, politician: p, pnl, roi: roiOf(politicianAgg), agg: politicianAgg };
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
