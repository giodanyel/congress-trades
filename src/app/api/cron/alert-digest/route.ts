import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { sendEmail } from "@/lib/email";
import { isAdminAuthorized } from "@/lib/adminAuth";
import { aggregateByPolitician, roiOf, type PoliticianAgg } from "@/lib/analytics";
import {
  getCachedTrades,
  getCachedTradeReturns,
  getCachedPoliticians,
  estimatedTradeValue,
  type Trade,
  type Politician,
  type WatchlistItem,
} from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Top performers by estimated ROI on priced trades. Intentionally NOT
// limited to recently-active politicians here (unlike the homepage) --
// well-known names like Pelosi may not trade often, but a new trade from
// them is still exactly the kind of thing worth flagging.
const TOP_PERFORMER_LIMIT = 15;
// A brand-new account has no alert history at all, so its first run would
// otherwise try to cram every top-performer trade ever recorded into one
// email. Cap what's shown (everything found still gets marked sent, so the
// backlog doesn't linger into future runs).
const MAX_ROWS_PER_SECTION = 25;

function titleCase(s: string) {
  return s.charAt(0) + s.slice(1).toLowerCase();
}

function daysBetween(a: string, b: string) {
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / (1000 * 60 * 60 * 24));
}

type Row = {
  trade: Trade;
  politician: Politician;
  pnl: number | null;
  roi: number | null;
  agg: PoliticianAgg | null;
  preDisclosureMovePct: number | null;
};

function renderTradeItem({ trade, politician, pnl, roi, agg, preDisclosureMovePct }: Row) {
  const action =
    trade.trade_type === "PURCHASE" ? "bought" : trade.trade_type === "SALE" ? "sold" : "exchanged";
  const pnlText =
    pnl === null
      ? ""
      : ` &mdash; est. ${pnl >= 0 ? "+" : "-"}$${Math.abs(pnl).toLocaleString("en-US", {
          maximumFractionDigits: 0,
        })} on this trade so far`;

  let lagText: string;
  if (trade.filing_date && preDisclosureMovePct !== null) {
    const lag = daysBetween(trade.transaction_date, trade.filing_date);
    const movedWithTrade =
      (trade.trade_type === "PURCHASE" && preDisclosureMovePct > 0) ||
      (trade.trade_type === "SALE" && preDisclosureMovePct < 0);
    const color = movedWithTrade ? "#dc2626" : "#059669";
    const verb = preDisclosureMovePct >= 0 ? "risen" : "fallen";
    lagText = `<div style="margin-top:4px;font-size:12px;color:${color};">By the ${trade.filing_date} disclosure (${lag} days later), the price had already ${verb} ${Math.abs(preDisclosureMovePct * 100).toFixed(1)}% from the trade price</div>`;
  } else if (trade.filing_date) {
    const lag = daysBetween(trade.transaction_date, trade.filing_date);
    lagText = `<div style="margin-top:4px;font-size:12px;color:#a1a1aa;">Disclosed ${trade.filing_date} &mdash; ${lag} day${lag === 1 ? "" : "s"} after the trade (price move not available)</div>`;
  } else {
    lagText = `<div style="margin-top:4px;font-size:12px;color:#a1a1aa;">Filing date unknown &mdash; STOCK Act allows up to 45 days between trade and disclosure</div>`;
  }

  const trackRecordText =
    agg && agg.totalTrades > 0
      ? `<div style="margin-top:4px;font-size:12px;color:#71717a;">Track record: est. ${(roi ?? 0) >= 0 ? "+" : ""}${((roi ?? 0) * 100).toFixed(0)}% avg. return across ${agg.pricedTrades} of their ${agg.totalTrades} trades with price data (${Math.round((agg.pricedTrades / agg.totalTrades) * 100)}% coverage)</div>`
      : "";

  return `<li style="margin-bottom:18px;line-height:1.5;padding-bottom:14px;border-bottom:1px solid #f4f4f5;">
    <div><strong>${politician.full_name}</strong>
    <span style="color:#71717a;">(${titleCase(politician.party)} &middot; ${politician.state})</span></div>
    <div style="margin-top:2px;">${action} <strong>${trade.ticker}</strong> &middot; ${trade.amount_label ?? "amount undisclosed"}${pnlText}</div>
    <div style="margin-top:2px;font-size:12px;color:#a1a1aa;">Traded ${trade.transaction_date}</div>
    ${lagText}
    ${trackRecordText}
  </li>`;
}

function buildDigestHtml(sections: { title: string; description: string; rows: Row[] }[]) {
  const nonEmpty = sections.filter((s) => s.rows.length > 0);
  const sectionsHtml = nonEmpty
    .map(
      (s) => `
    <h2 style="margin-bottom:4px;">${s.title}</h2>
    <p style="color:#71717a;font-size:13px;">${s.description}</p>
    <ul style="padding-left:18px;margin-top:16px;margin-bottom:28px;list-style:none;">${s.rows.map(renderTradeItem).join("")}</ul>`
    )
    .join("");

  return `<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:560px;margin:0 auto;color:#18181b;">
    ${sectionsHtml}
    <div style="margin-top:8px;padding:14px;background:#fafafa;border-radius:8px;font-size:12px;color:#52525b;line-height:1.6;">
      <strong>This is not financial advice.</strong> These are estimates built from disclosed dollar ranges and available price history, not exact figures. Disclosures can lag the real trade by weeks, so the price you'd see today may already differ from when the trade happened. A handful of past trades isn't a reliable predictor of future ones, and none of this accounts for your own finances, risk tolerance, or goals. If you're considering acting on any of this, talk to a licensed financial advisor first.
    </div>
  </div>`;
}

// auth.admin.listUsers() is paginated; loop until a page comes back short.
async function listAllUsers(supabase: ReturnType<typeof getSupabaseAdmin>) {
  const perPage = 200;
  let page = 1;
  const all: { id: string; email: string | null; email_confirmed_at: string | null }[] = [];
  for (;;) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) throw new Error(error.message);
    all.push(...data.users.map((u) => ({ id: u.id, email: u.email ?? null, email_confirmed_at: u.email_confirmed_at ?? null })));
    if (data.users.length < perPage) break;
    page += 1;
  }
  return all;
}

export async function GET(req: NextRequest) {
  if (!isAdminAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();

  const [politicians, trades, returns, users, { data: watchlist }, { data: alreadyAlerted }] =
    await Promise.all([
      getCachedPoliticians(),
      getCachedTrades(),
      getCachedTradeReturns(),
      listAllUsers(supabase),
      supabase.from("watchlist_items").select("*").returns<WatchlistItem[]>(),
      supabase.from("trade_alerts_sent").select("user_id, trade_id"),
    ]);

  const politicianById = new Map(politicians.map((p) => [p.id, p]));
  const returnByTradeId = new Map(returns.map((r) => [r.trade_id, r]));
  const allTrades = trades;

  // Everyone's alert history and follow list, grouped by user_id up front
  // so the per-user loop below is just map lookups, not N more queries.
  const alertedByUser = new Map<string, Set<string>>();
  for (const row of alreadyAlerted ?? []) {
    const set = alertedByUser.get(row.user_id as string) ?? new Set<string>();
    set.add(row.trade_id as string);
    alertedByUser.set(row.user_id as string, set);
  }
  const followedPoliticiansByUser = new Map<string, Set<string>>();
  const followedTickersByUser = new Map<string, Set<string>>();
  for (const w of watchlist ?? []) {
    const map = w.kind === "politician" ? followedPoliticiansByUser : followedTickersByUser;
    const set = map.get(w.user_id) ?? new Set<string>();
    set.add(w.ref_id);
    map.set(w.user_id, set);
  }

  // Top performers are the same list for everyone -- only the per-user
  // "already seen" history differs.
  const agg = aggregateByPolitician(allTrades, returnByTradeId);
  const topPerformers = [...agg.entries()]
    .filter(([, a]) => a.pricedTrades > 0 && roiOf(a) > 0)
    .sort((a, b) => roiOf(b[1]) - roiOf(a[1]))
    .slice(0, TOP_PERFORMER_LIMIT);
  const aggByPoliticianId = new Map(topPerformers.map(([id, a]) => [id, a]));

  // Defensive: a trade whose politician_id doesn't resolve (shouldn't
  // happen given the FK, but data issues do occur) used to crash this
  // whole route with a non-null assertion -- taking down every user's
  // digest for one bad row instead of just skipping it.
  function toRow(t: Trade): Row | null {
    const p = politicianById.get(t.politician_id);
    if (!p) return null;
    const r = returnByTradeId.get(t.id);
    const value = estimatedTradeValue(t);
    const pnl = r && r.return_pct !== null && value !== null ? r.return_pct * value : null;
    const politicianAgg = agg.get(t.politician_id) ?? null;
    return {
      trade: t,
      politician: p,
      pnl,
      roi: politicianAgg ? roiOf(politicianAgg) : null,
      agg: politicianAgg,
      preDisclosureMovePct: r?.pre_disclosure_move_pct ?? null,
    };
  }

  function toRows(trades: Trade[]): Row[] {
    return trades.map(toRow).filter((r): r is Row => r !== null);
  }

  const confirmedUsers = users.filter((u) => u.email && u.email_confirmed_at);

  const results: { userId: string; email: string; sent: boolean; newAlerts: number; error?: string }[] = [];
  const alertRowsToInsert: { user_id: string; trade_id: string }[] = [];

  for (const u of confirmedUsers) {
    const alertedIds = alertedByUser.get(u.id) ?? new Set<string>();
    const followedPoliticianIds = followedPoliticiansByUser.get(u.id) ?? new Set<string>();
    const followedTickers = followedTickersByUser.get(u.id) ?? new Set<string>();
    const isFollowed = (t: Trade) =>
      followedPoliticianIds.has(t.politician_id) || followedTickers.has(t.ticker);

    const followedNewTrades = allTrades.filter((t) => !alertedIds.has(t.id) && isFollowed(t));
    const topPerformerNewTrades = allTrades.filter(
      (t) => !alertedIds.has(t.id) && !isFollowed(t) && aggByPoliticianId.has(t.politician_id)
    );
    const newAlerts = [...followedNewTrades, ...topPerformerNewTrades];

    if (newAlerts.length === 0) {
      results.push({ userId: u.id, email: u.email!, sent: false, newAlerts: 0 });
      continue;
    }

    // Mark everything found as sent regardless of the display cap below,
    // so an oversized backlog doesn't linger and resurface next run.
    for (const t of newAlerts) alertRowsToInsert.push({ user_id: u.id, trade_id: t.id });

    followedNewTrades.sort((a, b) => b.transaction_date.localeCompare(a.transaction_date));
    topPerformerNewTrades.sort((a, b) => b.transaction_date.localeCompare(a.transaction_date));

    const html = buildDigestHtml([
      {
        title: "New trades from people & tickers you follow",
        description: "Straight from your Following list, newest first.",
        rows: toRows(followedNewTrades.slice(0, MAX_ROWS_PER_SECTION)),
      },
      {
        title: "New trades from top-performing members of Congress",
        description: "Ranked by estimated ROI on their priced trades to date.",
        rows: toRows(topPerformerNewTrades.slice(0, MAX_ROWS_PER_SECTION)),
      },
    ]);

    const subjectParts = [];
    if (followedNewTrades.length > 0) subjectParts.push(`${followedNewTrades.length} from your Following list`);
    if (topPerformerNewTrades.length > 0) subjectParts.push(`${topPerformerNewTrades.length} from top performers`);

    try {
      await sendEmail({
        to: u.email!,
        subject: `Congress Trades: ${subjectParts.join(" + ")}`,
        html,
      });
      results.push({ userId: u.id, email: u.email!, sent: true, newAlerts: newAlerts.length });
    } catch (err) {
      // Don't mark this user's trades as sent if the email actually
      // failed -- pull their rows back out so they're retried next run.
      const failedIds = new Set(newAlerts.map((t) => t.id));
      for (let i = alertRowsToInsert.length - 1; i >= 0; i--) {
        if (alertRowsToInsert[i].user_id === u.id && failedIds.has(alertRowsToInsert[i].trade_id)) {
          alertRowsToInsert.splice(i, 1);
        }
      }
      results.push({
        userId: u.id,
        email: u.email!,
        sent: false,
        newAlerts: newAlerts.length,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  if (alertRowsToInsert.length > 0) {
    const { error: insertError } = await supabase.from("trade_alerts_sent").insert(alertRowsToInsert);
    if (insertError) {
      return NextResponse.json(
        { results, markSentError: insertError.message },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({
    confirmedUsers: confirmedUsers.length,
    emailsSent: results.filter((r) => r.sent).length,
    emailsFailed: results.filter((r) => !r.sent && r.error).length,
    results,
  });
}
