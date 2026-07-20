import Link from "next/link";
import {
  supabase,
  fetchAllRows,
  estimatedTradeValue,
  type Politician,
  type Trade,
  type TradeReturn,
} from "@/lib/supabase";
import { partyStyle, formatUsd, formatPct, relativeDate } from "@/lib/ui";
import { aggregateByPolitician, roiOf, alphaOf, ACTIVE_WINDOW_DAYS } from "@/lib/analytics";
import { FollowButton } from "@/components/FollowButton";
import type { WatchlistItem } from "@/lib/supabase";

// Data changes as new trades/politicians are added, so always fetch fresh
// instead of baking a snapshot in at build time.
export const dynamic = "force-dynamic";

const RECENT_BUYS_LIMIT = 12;
const TOP_PERFORMERS_LIMIT = 8;

export default async function Home() {
  const [{ data: politicians }, trades, returns, { data: watchlist }] =
    await Promise.all([
      supabase.from("politicians").select("*").returns<Politician[]>(),
      fetchAllRows<Trade>("trades", "*"),
      fetchAllRows<TradeReturn>("trade_returns", "*"),
      supabase.from("watchlist_items").select("*").returns<WatchlistItem[]>(),
    ]);

  const followedPoliticianIds = new Set(
    (watchlist ?? []).filter((w) => w.kind === "politician").map((w) => w.ref_id)
  );

  const politicianById = new Map((politicians ?? []).map((p) => [p.id, p]));
  const returnByTradeId = new Map((returns ?? []).map((r) => [r.trade_id, r]));

  const now = Date.now();
  const cutoff = now - ACTIVE_WINDOW_DAYS * 24 * 60 * 60 * 1000;

  // Aggregate per-politician ROI + last trade date in one pass, shared with
  // the ROI leaderboard and Interesting Buys so the numbers always agree.
  const byPolitician = aggregateByPolitician(trades ?? [], returnByTradeId);

  const topPerformers = [...byPolitician.entries()]
    .map(([politicianId, agg]) => ({ politician: politicianById.get(politicianId), agg }))
    .filter(
      (r) =>
        r.politician &&
        r.agg.pricedTrades > 0 &&
        new Date(r.agg.lastTradeDate).getTime() >= cutoff
    )
    .map((r) => ({
      politician: r.politician!,
      agg: r.agg,
      roi: roiOf(r.agg),
      alpha: alphaOf(r.agg),
    }))
    .sort((a, b) => b.roi - a.roi)
    .slice(0, TOP_PERFORMERS_LIMIT);

  const recentBuys = (trades ?? [])
    .filter((t) => t.trade_type === "PURCHASE")
    .sort((a, b) => b.transaction_date.localeCompare(a.transaction_date))
    .slice(0, RECENT_BUYS_LIMIT);

  const hasAnyPriceData = (returns ?? []).length > 0;

  return (
    <div className="flex flex-1 flex-col bg-background px-6 py-10">
      <div className="mx-auto w-full max-w-4xl">
        <h1 className="text-3xl font-heading font-semibold tracking-tight text-stone-900 dark:text-stone-50">
          Congress Trades
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-stone-500 dark:text-stone-400">
          Current stock activity disclosed by sitting members of Congress under
          the STOCK Act. Dollar figures are always estimates from disclosed
          ranges, never exact amounts.
        </p>

        {/* Quick orientation stats -- a friendly at-a-glance strip rather
            than making a first-time visitor read tables to understand
            scope. */}
        <div className="mt-6 grid grid-cols-3 gap-3">
          <div className="card-pop animate-in px-4 py-3" style={{ backgroundColor: "var(--cat-politicians-soft)" }}>
            <p className="font-heading text-xl font-semibold" style={{ color: "var(--cat-politicians)" }}>{(politicians ?? []).length}</p>
            <p className="text-xs text-stone-600 dark:text-stone-300">Politicians tracked</p>
          </div>
          <div className="card-pop animate-in px-4 py-3" style={{ backgroundColor: "var(--cat-stocks-soft)", animationDelay: "60ms" }}>
            <p className="font-heading text-xl font-semibold" style={{ color: "var(--cat-stocks)" }}>
              {(trades ?? []).length.toLocaleString("en-US")}
            </p>
            <p className="text-xs text-stone-600 dark:text-stone-300">Trades disclosed</p>
          </div>
          <div className="card-pop animate-in px-4 py-3" style={{ backgroundColor: "var(--cat-following-soft)", animationDelay: "120ms" }}>
            <p className="font-heading text-xl font-semibold" style={{ color: "var(--cat-following)" }}>Daily</p>
            <p className="text-xs text-stone-600 dark:text-stone-300">Data refresh</p>
          </div>
        </div>

        {/* Top performers, currently active */}
        <div className="mt-10 flex items-center justify-between">
          <h2 className="font-heading text-sm font-semibold uppercase tracking-wide" style={{ color: "var(--cat-performance)" }}>
            Top Performers, Currently Active
          </h2>
          <Link
            href="/leaderboard/roi"
            className="text-xs font-medium text-stone-500 hover:text-stone-700 dark:text-stone-400 dark:hover:text-stone-200"
          >
            Full ROI leaderboard &rarr;
          </Link>
        </div>
        <p className="mt-1 text-xs text-stone-400 dark:text-stone-600">
          Ranked by estimated ROI, limited to politicians who traded in the
          last {ACTIVE_WINDOW_DAYS} days.
        </p>

        {!hasAnyPriceData && (
          <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300">
            Price data is still syncing, so ROI rankings aren&apos;t available yet.
          </div>
        )}

        {hasAnyPriceData && topPerformers.length === 0 && (
          <div className="mt-4 rounded-2xl border border-stone-200 p-4 text-sm text-stone-500 dark:border-stone-800 dark:text-stone-400">
            No currently-active politicians have priced trades yet.
          </div>
        )}

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {topPerformers.map((row, i) => {
            const style = partyStyle(row.politician.party);
            const positive = row.roi >= 0;
            return (
              <div
                key={row.politician.id}
                className={`card-pop animate-in relative p-4 ${
                  positive
                    ? "bg-emerald-50/50 dark:bg-emerald-950/20"
                    : "bg-red-50/50 dark:bg-red-950/20"
                }`}
                style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}
              >
                <div className="absolute right-3 top-3">
                  <FollowButton
                    kind="politician"
                    refId={row.politician.id}
                    initialFollowing={followedPoliticianIds.has(row.politician.id)}
                    size="sm"
                  />
                </div>
                <Link href={`/politicians/${row.politician.id}`} className="block pr-20">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-stone-400">#{i + 1}</span>
                      <span className={`h-2.5 w-2.5 rounded-full ${style.dot}`} />
                      <p className="text-sm font-medium text-stone-900 dark:text-stone-50">
                        {row.politician.full_name}
                      </p>
                    </div>
                    <span
                      className={`text-sm font-semibold ${
                        positive
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-red-600 dark:text-red-400"
                      }`}
                    >
                      {formatPct(row.roi)}
                    </span>
                  </div>
                  <p className="mt-1.5 text-xs text-stone-400 dark:text-stone-600">
                    {row.politician.state} &middot; {relativeDate(row.agg.lastTradeDate)}
                  </p>
                </Link>
              </div>
            );
          })}
        </div>

        {/* Latest buys */}
        <div className="mt-12 flex items-center justify-between">
          <h2 className="font-heading text-sm font-semibold uppercase tracking-wide" style={{ color: "var(--cat-stocks)" }}>
            Latest Buys
          </h2>
          <Link
            href="/leaderboard"
            className="text-xs font-medium text-stone-500 hover:text-stone-700 dark:text-stone-400 dark:hover:text-stone-200"
          >
            Most active traders &rarr;
          </Link>
        </div>

        {recentBuys.length === 0 && (
          <div className="mt-4 rounded-2xl border border-stone-200 p-4 text-sm text-stone-500 dark:border-stone-800 dark:text-stone-400">
            No purchase trades on record yet.
          </div>
        )}

        <ul className="mt-4 divide-y divide-stone-100 card-pop accent-rail accent-stocks dark:divide-stone-900">
          {recentBuys.map((t) => {
            const p = politicianById.get(t.politician_id);
            const style = p ? partyStyle(p.party) : null;
            return (
              <li key={t.id} className="flex items-center justify-between gap-4 px-4 py-3">
                <div className="flex min-w-0 items-center gap-3">
                  {style && <span className={`h-2 w-2 shrink-0 rounded-full ${style.dot}`} />}
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-stone-900 dark:text-stone-50">
                      {p ? (
                        <Link href={`/politicians/${p.id}`} className="hover:underline">
                          {p.full_name}
                        </Link>
                      ) : (
                        "Unknown"
                      )}{" "}
                      <span className="font-normal text-stone-400">bought</span>{" "}
                      <Link href={`/stocks/${t.ticker}`} className="hover:underline">
                        {t.ticker}
                      </Link>
                    </p>
                    <p className="mt-0.5 truncate text-xs text-stone-400 dark:text-stone-600">
                      {relativeDate(t.transaction_date)}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="text-sm font-medium text-stone-700 dark:text-stone-300">
                    {t.amount_label ?? formatUsd(estimatedTradeValue(t))}
                  </span>
                  {p && (
                    <FollowButton
                      kind="politician"
                      refId={p.id}
                      initialFollowing={followedPoliticianIds.has(p.id)}
                      size="sm"
                    />
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
