import Link from "next/link";
import {
  supabase,
  getCachedTrades,
  getCachedTradeReturns,
  getCachedPoliticians,
  type Politician,
  type Trade,
  type WatchlistItem,
} from "@/lib/supabase";
import { createClient } from "@/lib/supabase/server";
import { partyStyle, formatPct } from "@/lib/ui";
import { aggregateByPolitician, roiOf, isActive, sizeTier } from "@/lib/analytics";
import { committeeConflicts } from "@/lib/committees";
import { sectorForTicker } from "@/lib/sectors";
import { getPriceSignals } from "@/lib/priceSignals";
import { FollowButton } from "@/components/FollowButton";
import { TradeTypeBadge } from "@/components/TradeTypeBadge";

// Page renders per-request; the heavy trades/returns reads underneath are
// cached via unstable_cache (see @/lib/supabase), not this.
export const dynamic = "force-dynamic";

// A buy counts as "interesting" if it's recent and has at least one flag:
// unusually large, bought by multiple members around the same time, or
// bought by a politician who's currently outperforming on priced trades.
const RECENT_DAYS = 45;
const CLUSTER_WINDOW_DAYS = 60;
const CLUSTER_MIN_MEMBERS = 2;
const ROW_LIMIT = 20;

export default async function InterestingBuysPage() {
  const supabaseAuth = await createClient();
  const [
    politicians,
    trades,
    returns,
    {
      data: { user },
    },
  ] = await Promise.all([
    getCachedPoliticians(),
    getCachedTrades(),
    getCachedTradeReturns(),
    supabaseAuth.auth.getUser(),
  ]);

  const watchlist = user
    ? (
        await supabaseAuth
          .from("watchlist_items")
          .select("*")
          .eq("user_id", user.id)
          .returns<WatchlistItem[]>()
      ).data
    : [];

  const followedPoliticianIds = new Set(
    (watchlist ?? []).filter((w) => w.kind === "politician").map((w) => w.ref_id)
  );

  const politicianById = new Map((politicians ?? []).map((p) => [p.id, p]));
  const returnByTradeId = new Map(returns.map((r) => [r.trade_id, r]));
  const allTrades = trades ?? [];
  const roiByPolitician = aggregateByPolitician(allTrades, returnByTradeId);

  const now = Date.now();
  const recentCutoff = now - RECENT_DAYS * 24 * 60 * 60 * 1000;
  const clusterCutoff = now - CLUSTER_WINDOW_DAYS * 24 * 60 * 60 * 1000;

  // Cluster signal: how many distinct politicians bought this ticker within
  // the cluster window (looked at across ALL trades, not just recent buys,
  // so a buy today still "sees" other members who bought last month too).
  const buyersByTicker = new Map<string, Set<string>>();
  for (const t of allTrades) {
    if (t.trade_type !== "PURCHASE") continue;
    if (new Date(t.transaction_date).getTime() < clusterCutoff) continue;
    const set = buyersByTicker.get(t.ticker) ?? new Set<string>();
    set.add(t.politician_id);
    buyersByTicker.set(t.ticker, set);
  }

  type Flag = { label: string; weight: number };
  type Row = { trade: Trade; politician: Politician; flags: Flag[]; score: number };

  const rows: Row[] = [];

  for (const t of allTrades) {
    if (t.trade_type !== "PURCHASE") continue;
    if (new Date(t.transaction_date).getTime() < recentCutoff) continue;
    const p = politicianById.get(t.politician_id);
    if (!p) continue;

    const flags: Flag[] = [];

    const tier = sizeTier(t.amount_max);
    if (tier) flags.push(tier);

    const clusterCount = buyersByTicker.get(t.ticker)?.size ?? 0;
    if (clusterCount >= CLUSTER_MIN_MEMBERS) {
      flags.push({
        label: `${clusterCount} members bought ${t.ticker} recently`,
        weight: clusterCount,
      });
    }

    const agg = roiByPolitician.get(p.id);
    if (agg && agg.pricedTrades > 0 && isActive(agg, now)) {
      const roi = roiOf(agg);
      if (roi > 0) {
        flags.push({ label: `${p.full_name.split(" ").slice(-1)[0]} is currently up ${(roi * 100).toFixed(0)}%`, weight: Math.min(roi * 10, 4) });
      }
    }

    // Committee conflict-of-interest signal: does this politician sit on a
    // committee with direct jurisdiction over the sector this stock is in?
    const conflicts = committeeConflicts(p.id, sectorForTicker(t.ticker));
    if (conflicts.length > 0) {
      flags.push({
        label: `Sits on ${conflicts[0].committee}, which oversees ${conflicts[0].sector}`,
        weight: 3,
      });
    }

    if (flags.length === 0) continue;
    flags.sort((a, b) => b.weight - a.weight);

    const score = flags.reduce((s, f) => s + f.weight, 0);
    rows.push({ trade: t, politician: p, flags, score });
  }

  rows.sort((a, b) => b.score - a.score || b.trade.transaction_date.localeCompare(a.trade.transaction_date));
  const shown = rows.slice(0, ROW_LIMIT);

  // Ticker-level summary: same flagged buys, grouped by stock instead of by
  // trade, so a ticker several members piled into shows up once with a
  // combined signal rather than as several near-duplicate rows.
  type HotTicker = { ticker: string; score: number; tradeCount: number; topFlag: string; lastTradeDate: string };
  const hotByTicker = new Map<string, HotTicker>();
  for (const row of rows) {
    const t = row.trade.ticker;
    const existing = hotByTicker.get(t);
    if (existing) {
      existing.score += row.score;
      existing.tradeCount += 1;
      if (row.trade.transaction_date > existing.lastTradeDate) existing.lastTradeDate = row.trade.transaction_date;
    } else {
      hotByTicker.set(t, {
        ticker: t,
        score: row.score,
        tradeCount: 1,
        topFlag: row.flags[0]?.label ?? "",
        lastTradeDate: row.trade.transaction_date,
      });
    }
  }
  const HOT_TICKER_LIMIT = 6;
  const hotTickers = [...hotByTicker.values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, HOT_TICKER_LIMIT);

  const hotTickerSymbols = hotTickers.map((h) => h.ticker);
  const [{ data: hotStocks }, priceSignals] = await Promise.all([
    supabase
      .from("stocks")
      .select("ticker, company_name")
      .in("ticker", hotTickerSymbols.length ? hotTickerSymbols : ["__none__"]),
    getPriceSignals(hotTickerSymbols),
  ]);
  const companyByTicker = new Map((hotStocks ?? []).map((s) => [s.ticker as string, s.company_name as string]));

  return (
    <div className="flex flex-1 flex-col bg-background px-6 py-10">
      <div className="mx-auto w-full max-w-3xl">
        <h1 className="text-2xl font-heading font-semibold tracking-tight text-stone-900 dark:text-stone-50">
          Interesting Buys
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-stone-500 dark:text-stone-400">
          The last {RECENT_DAYS} days&apos; purchases worth a second look &mdash;
          unusually large, clustered across several members, from a
          currently-outperforming politician, or in a sector their committee
          oversees. A screen to help you look further, not investment advice.
        </p>

        {rows.length === 0 && (
          <div className="mt-6 rounded-2xl border border-stone-200 p-4 text-sm text-stone-500 dark:border-stone-800 dark:text-stone-400">
            Nothing stands out from the last {RECENT_DAYS} days yet.
          </div>
        )}

        {hotTickers.length > 0 && (
          <div className="mt-8">
            <h2 className="text-sm font-medium uppercase tracking-wide text-stone-500 dark:text-stone-400">
              Hot stocks right now
            </h2>
            <p className="mt-1 text-xs text-stone-400 dark:text-stone-600">
              The tickers with the strongest combined signal above, with
              live price, day/week/month/3-month moves, and where it&apos;s
              trading in its 90-day range &mdash; context to help you dig in,
              not a suggested entry price.
            </p>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {hotTickers.map((h) => {
                const sig = priceSignals.get(h.ticker);
                return (
                  <Link
                    key={h.ticker}
                    href={`/stocks/${h.ticker}`}
                    className="card-pop accent-rail accent-stocks block p-4 transition hover:-translate-y-0.5"
                  >
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="font-heading text-base font-semibold text-stone-900 dark:text-stone-50">
                        {h.ticker}
                      </span>
                      <span className="truncate text-xs text-stone-400 dark:text-stone-600">
                        {companyByTicker.get(h.ticker) ?? ""}
                      </span>
                    </div>

                    {sig ? (
                      <>
                        <div className="mt-2 flex items-baseline gap-2">
                          <span className="text-2xl font-heading font-semibold text-stone-900 dark:text-stone-50">
                            ${sig.price.toFixed(2)}
                          </span>
                          {sig.dayChangePct !== null && (
                            <span
                              className={`text-xs font-semibold ${
                                sig.dayChangePct >= 0
                                  ? "text-emerald-600 dark:text-emerald-400"
                                  : "text-red-600 dark:text-red-400"
                              }`}
                            >
                              {formatPct(sig.dayChangePct)}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1 text-[11px] text-stone-400 dark:text-stone-600">
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${
                              sig.isLive ? "bg-emerald-500 animate-pulse-soft" : "bg-stone-300 dark:bg-stone-700"
                            }`}
                          />
                          {sig.isLive ? "Live" : `As of ${sig.asOf.slice(0, 10)}`}
                        </div>

                        <div className="mt-2 h-1.5 w-full rounded-full bg-stone-100 dark:bg-stone-800">
                          <div
                            className="h-1.5 rounded-full bg-cat-stocks"
                            style={{ width: `${Math.round(sig.rangePosition * 100)}%` }}
                          />
                        </div>
                        <div className="mt-1 flex justify-between text-[11px] text-stone-400 dark:text-stone-600">
                          <span>90d low ${sig.low90.toFixed(2)}</span>
                          <span>90d high ${sig.high90.toFixed(2)}</span>
                        </div>

                        <div className="mt-2.5 flex gap-3 text-[11px]">
                          {[
                            ["1W", sig.weekChangePct],
                            ["1M", sig.monthChangePct],
                            ["3M", sig.threeMonthChangePct],
                          ].map(([label, pct]) => (
                            <span key={label as string} className="flex items-baseline gap-1">
                              <span className="text-stone-400 dark:text-stone-600">{label}</span>
                              <span
                                className={
                                  pct === null
                                    ? "text-stone-400 dark:text-stone-600"
                                    : (pct as number) >= 0
                                      ? "font-medium text-emerald-600 dark:text-emerald-400"
                                      : "font-medium text-red-600 dark:text-red-400"
                                }
                              >
                                {pct === null ? "—" : formatPct(pct as number)}
                              </span>
                            </span>
                          ))}
                        </div>
                      </>
                    ) : (
                      <div className="mt-2 text-xs text-stone-400 dark:text-stone-600">
                        Price data syncing&hellip;
                      </div>
                    )}

                    <p className="mt-3 truncate text-xs text-stone-500 dark:text-stone-400" title={h.topFlag}>
                      {h.topFlag}
                      {h.tradeCount > 1 && (
                        <span className="text-stone-400 dark:text-stone-600"> &middot; {h.tradeCount} flagged buys</span>
                      )}
                    </p>
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        <h2 className="mt-8 mb-3 text-sm font-medium uppercase tracking-wide text-stone-500 dark:text-stone-400">
          Flagged trades
        </h2>
        <ul className="divide-y divide-stone-100 card-pop accent-rail accent-performance dark:divide-stone-900">
          {shown.map(({ trade: t, politician: p, flags }) => {
            const style = partyStyle(p.party);
            const r = returnByTradeId.get(t.id);
            const preMove = r?.pre_disclosure_move_pct ?? null;
            const restFlags = flags.slice(1).map((f) => f.label).join("; ");
            return (
              <li key={t.id} className="px-4 py-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-stone-900 dark:text-stone-50">
                      <span className={`h-2 w-2 shrink-0 rounded-full ${style.dot}`} />
                      <Link href={`/politicians/${p.id}`} className="hover:underline">
                        {p.full_name}
                      </Link>
                      <TradeTypeBadge type={t.trade_type} />
                      <Link href={`/stocks/${t.ticker}`} className="hover:underline">
                        {t.ticker}
                      </Link>
                    </p>
                    <p className="mt-0.5 truncate text-xs text-stone-400 dark:text-stone-600">
                      {flags[0]?.label}
                      {flags.length > 1 && (
                        <span title={restFlags} className="ml-1 text-stone-300 dark:text-stone-700">
                          +{flags.length - 1} more
                        </span>
                      )}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-0.5">
                    <span className="text-sm font-medium text-stone-700 dark:text-stone-300">
                      {t.amount_label}
                    </span>
                    {preMove !== null && t.filing_date && (
                      <span
                        title={`By the ${t.filing_date} disclosure, the price had already ${preMove >= 0 ? "risen" : "fallen"} ${Math.abs(preMove * 100).toFixed(1)}% from the trade price.`}
                        className={`text-[11px] font-medium ${preMove >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}
                      >
                        {preMove >= 0 ? "+" : ""}
                        {(preMove * 100).toFixed(1)}% pre-disclosure
                      </span>
                    )}
                  </div>
                  <FollowButton
                    kind="politician"
                    refId={p.id}
                    initialFollowing={followedPoliticianIds.has(p.id)}
                    size="sm"
                  />
                </div>
              </li>
            );
          })}
        </ul>
        {rows.length > ROW_LIMIT && (
          <p className="mt-3 text-xs text-stone-400 dark:text-stone-600">
            Showing the top {ROW_LIMIT} of {rows.length} flagged buys, ranked by how many signals each one hit.
          </p>
        )}
      </div>
    </div>
  );
}
