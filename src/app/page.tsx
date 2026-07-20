import Link from "next/link";
import {
  supabase,
  estimatedTradeValue,
  type Politician,
  type Trade,
  type Stock,
  type TradeReturn,
} from "@/lib/supabase";
import { partyStyle, formatUsd, formatPct, relativeDate, titleCase } from "@/lib/ui";

// Data changes as new trades/politicians are added, so always fetch fresh
// instead of baking a snapshot in at build time.
export const dynamic = "force-dynamic";

// "Active" window for the homepage: a politician only counts as a current
// top performer if they've actually traded recently. A great historical ROI
// from a member who hasn't traded in years isn't useful "current" signal.
const ACTIVE_WINDOW_DAYS = 120;
const RECENT_BUYS_LIMIT = 12;
const TOP_PERFORMERS_LIMIT = 8;

export default async function Home() {
  const [{ data: politicians }, { data: trades }, { data: returns }, { data: stocks }] =
    await Promise.all([
      supabase.from("politicians").select("*").returns<Politician[]>(),
      supabase.from("trades").select("*").returns<Trade[]>(),
      supabase.from("trade_returns").select("*").returns<TradeReturn[]>(),
      supabase.from("stocks").select("*").returns<Stock[]>(),
    ]);

  const politicianById = new Map((politicians ?? []).map((p) => [p.id, p]));
  const stockByTicker = new Map((stocks ?? []).map((s) => [s.ticker, s]));
  const returnByTradeId = new Map((returns ?? []).map((r) => [r.trade_id, r]));

  const now = Date.now();
  const cutoff = now - ACTIVE_WINDOW_DAYS * 24 * 60 * 60 * 1000;

  // Aggregate per-politician ROI + last trade date in one pass.
  type Agg = {
    weightedReturnSum: number;
    weightedValue: number;
    pricedTrades: number;
    totalTrades: number;
    estimatedGainLoss: number;
    lastTradeDate: string;
  };
  const byPolitician = new Map<string, Agg>();

  for (const t of trades ?? []) {
    const agg = byPolitician.get(t.politician_id) ?? {
      weightedReturnSum: 0,
      weightedValue: 0,
      pricedTrades: 0,
      totalTrades: 0,
      estimatedGainLoss: 0,
      lastTradeDate: t.transaction_date,
    };
    agg.totalTrades += 1;
    if (t.transaction_date > agg.lastTradeDate) agg.lastTradeDate = t.transaction_date;

    const r = returnByTradeId.get(t.id);
    const value = estimatedTradeValue(t) ?? 0;
    if (r && r.return_pct !== null && r.confidence !== "UNAVAILABLE") {
      agg.weightedReturnSum += r.return_pct * value;
      agg.weightedValue += value;
      agg.pricedTrades += 1;
      agg.estimatedGainLoss += r.return_pct * value;
    }

    byPolitician.set(t.politician_id, agg);
  }

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
      roi: r.agg.weightedValue > 0 ? r.agg.weightedReturnSum / r.agg.weightedValue : 0,
    }))
    .sort((a, b) => b.roi - a.roi)
    .slice(0, TOP_PERFORMERS_LIMIT);

  const recentBuys = (trades ?? [])
    .filter((t) => t.trade_type === "PURCHASE")
    .sort((a, b) => b.transaction_date.localeCompare(a.transaction_date))
    .slice(0, RECENT_BUYS_LIMIT);

  const hasAnyPriceData = (returns ?? []).length > 0;

  return (
    <div className="flex flex-1 flex-col bg-white px-6 py-10 dark:bg-black">
      <div className="mx-auto w-full max-w-4xl">
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Congress Trades
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">
          Current stock activity disclosed by sitting members of Congress under
          the STOCK Act. Dollar figures are always estimates from disclosed
          ranges, never exact amounts.
        </p>

        {/* Top performers, currently active */}
        <div className="mt-10 flex items-center justify-between">
          <h2 className="text-sm font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Top Performers, Currently Active
          </h2>
          <Link
            href="/leaderboard/roi"
            className="text-xs font-medium text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
          >
            Full ROI leaderboard &rarr;
          </Link>
        </div>
        <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-600">
          Ranked by estimated ROI, limited to politicians who traded in the
          last {ACTIVE_WINDOW_DAYS} days.
        </p>

        {!hasAnyPriceData && (
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300">
            Price data is still syncing, so ROI rankings aren&apos;t available yet.
          </div>
        )}

        {hasAnyPriceData && topPerformers.length === 0 && (
          <div className="mt-4 rounded-xl border border-zinc-200 p-4 text-sm text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
            No currently-active politicians have priced trades yet.
          </div>
        )}

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {topPerformers.map((row, i) => {
            const style = partyStyle(row.politician.party);
            const positive = row.roi >= 0;
            return (
              <Link
                key={row.politician.id}
                href={`/politicians/${row.politician.id}`}
                className={`rounded-xl border p-4 transition-colors ${
                  positive
                    ? "border-emerald-200 bg-emerald-50/50 hover:border-emerald-300 dark:border-emerald-900 dark:bg-emerald-950/20"
                    : "border-red-200 bg-red-50/50 hover:border-red-300 dark:border-red-900 dark:bg-red-950/20"
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-zinc-400">#{i + 1}</span>
                    <span className={`h-2.5 w-2.5 rounded-full ${style.dot}`} />
                    <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
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
                <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                  {style.label} &middot; {row.politician.state} &middot; last trade{" "}
                  {relativeDate(row.agg.lastTradeDate)}
                </p>
              </Link>
            );
          })}
        </div>

        {/* Latest buys */}
        <div className="mt-12 flex items-center justify-between">
          <h2 className="text-sm font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Latest Buys
          </h2>
          <Link
            href="/leaderboard"
            className="text-xs font-medium text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
          >
            Most active traders &rarr;
          </Link>
        </div>

        {recentBuys.length === 0 && (
          <div className="mt-4 rounded-xl border border-zinc-200 p-4 text-sm text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
            No purchase trades on record yet.
          </div>
        )}

        <ul className="mt-4 divide-y divide-zinc-100 rounded-xl border border-zinc-200 dark:divide-zinc-900 dark:border-zinc-800">
          {recentBuys.map((t) => {
            const p = politicianById.get(t.politician_id);
            const stock = stockByTicker.get(t.ticker);
            const style = p ? partyStyle(p.party) : null;
            return (
              <li key={t.id} className="flex items-center justify-between gap-4 px-4 py-3">
                <div className="flex min-w-0 items-center gap-3">
                  {style && <span className={`h-2 w-2 shrink-0 rounded-full ${style.dot}`} />}
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-50">
                      {p ? (
                        <Link href={`/politicians/${p.id}`} className="hover:underline">
                          {p.full_name}
                        </Link>
                      ) : (
                        "Unknown"
                      )}{" "}
                      <span className="font-normal text-zinc-400">bought</span>{" "}
                      <Link href={`/stocks/${t.ticker}`} className="hover:underline">
                        {t.ticker}
                      </Link>
                    </p>
                    <p className="mt-0.5 truncate text-xs text-zinc-500 dark:text-zinc-400">
                      {stock?.company_name ?? t.ticker} &middot; {relativeDate(t.transaction_date)}
                      {p ? ` · ${titleCase(p.party)}` : ""}
                    </p>
                  </div>
                </div>
                <span className="shrink-0 text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  {t.amount_label ?? formatUsd(estimatedTradeValue(t))}
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
