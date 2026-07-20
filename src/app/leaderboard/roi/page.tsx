import Link from "next/link";
import {
  supabase,
  type Politician,
  type Trade,
  type TradeReturn,
} from "@/lib/supabase";
import { formatPct, partyStyle, confidenceStyle } from "@/lib/ui";
import { aggregateByPolitician, roiOf, alphaOf } from "@/lib/analytics";

export const dynamic = "force-dynamic";

export default async function RoiLeaderboardPage() {
  const [{ data: politicians }, { data: trades }, { data: returns }] =
    await Promise.all([
      supabase.from("politicians").select("*").returns<Politician[]>(),
      supabase.from("trades").select("*").returns<Trade[]>(),
      supabase.from("trade_returns").select("*").returns<TradeReturn[]>(),
    ]);

  const returnByTradeId = new Map((returns ?? []).map((r) => [r.trade_id, r]));
  const byPolitician = aggregateByPolitician(trades ?? [], returnByTradeId);

  const rows = (politicians ?? [])
    .map((p) => ({ politician: p, agg: byPolitician.get(p.id) }))
    .filter((r) => r.agg && r.agg.pricedTrades > 0)
    .map((r) => ({
      ...r,
      roi: roiOf(r.agg!),
      alpha: alphaOf(r.agg!),
      coverage: r.agg!.pricedTrades / r.agg!.totalTrades,
    }))
    .sort((a, b) => b.roi - a.roi);

  const noPriceDataYet = (returns ?? []).length === 0;

  return (
    <div className="flex flex-1 flex-col bg-white px-6 py-10 dark:bg-black">
      <div className="mx-auto w-full max-w-3xl">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            Top Performers
          </h1>
          <Link
            href="/leaderboard"
            className="text-xs font-medium text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
          >
            Most Active &rarr;
          </Link>
        </div>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">
          Every politician with at least one priced trade, ranked by estimated
          ROI &mdash; including members who haven&apos;t traded recently.{" "}
          <Link href="/" className="underline">
            See the homepage
          </Link>{" "}
          for top performers who are currently active.{" "}
          <strong className="text-zinc-700 dark:text-zinc-300">
            These are estimates, not exact figures.
          </strong>
        </p>

        {noPriceDataYet && (
          <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300">
            No price data has been synced yet, so ROI can&apos;t be estimated.
          </div>
        )}

        {!noPriceDataYet && rows.length === 0 && (
          <div className="mt-6 rounded-xl border border-zinc-200 p-4 text-sm text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
            No politicians have enough priced trades yet.
          </div>
        )}

        <div className="mt-6 overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-50 text-xs uppercase text-zinc-500 dark:bg-zinc-950 dark:text-zinc-400">
              <tr>
                <th className="px-4 py-2 font-medium">#</th>
                <th className="px-4 py-2 font-medium">Politician</th>
                <th className="px-4 py-2 font-medium">Est. ROI</th>
                <th className="px-4 py-2 font-medium">vs S&amp;P 500</th>
                <th className="px-4 py-2 font-medium">Est. gain/loss</th>
                <th className="px-4 py-2 font-medium">Data coverage</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => {
                const style = partyStyle(row.politician.party);
                const positive = row.roi >= 0;
                return (
                  <tr
                    key={row.politician.id}
                    className="border-t border-zinc-100 dark:border-zinc-900"
                  >
                    <td className="px-4 py-2 text-zinc-400">{i + 1}</td>
                    <td className="px-4 py-2 font-medium text-zinc-900 dark:text-zinc-50">
                      <Link
                        href={`/politicians/${row.politician.id}`}
                        className="flex items-center gap-2 hover:underline"
                      >
                        <span className={`h-2 w-2 shrink-0 rounded-full ${style.dot}`} />
                        {row.politician.full_name}
                        <span className="text-xs font-normal text-zinc-500 dark:text-zinc-400">
                          {row.politician.state}
                        </span>
                      </Link>
                    </td>
                    <td
                      className={`px-4 py-2 font-semibold ${
                        positive
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-red-600 dark:text-red-400"
                      }`}
                    >
                      {formatPct(row.roi)}
                    </td>
                    <td className="px-4 py-2">
                      {row.alpha === null ? (
                        <span className="text-zinc-400 dark:text-zinc-600">—</span>
                      ) : (
                        <span
                          className={
                            row.alpha >= 0
                              ? "text-emerald-600 dark:text-emerald-400"
                              : "text-red-600 dark:text-red-400"
                          }
                        >
                          {row.alpha >= 0 ? "+" : ""}
                          {(row.alpha * 100).toFixed(1)} pts
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-zinc-600 dark:text-zinc-300">
                      {row.agg!.estimatedGainLoss >= 0 ? "+" : "-"}$
                      {Math.abs(row.agg!.estimatedGainLoss).toLocaleString("en-US", {
                        maximumFractionDigits: 0,
                      })}
                    </td>
                    <td className="px-4 py-2 text-zinc-500 dark:text-zinc-400">
                      {row.agg!.pricedTrades}/{row.agg!.totalTrades} priced (
                      {(row.coverage * 100).toFixed(0)}%)
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <p className="mt-4 text-xs text-zinc-400 dark:text-zinc-500">
          Confidence key:{" "}
          <span className={confidenceStyle.HIGH}>High</span> = price matched
          within 3 days of the trade and current price is fresh.{" "}
          <span className={confidenceStyle.MEDIUM}>Medium</span> = matched
          within 10 days.{" "}
          <span className={confidenceStyle.LOW}>Low</span> = wider gap, treat
          with caution. Trades on delisted or unmatched tickers are excluded
          from these totals rather than guessed at. &ldquo;vs S&amp;P 500&rdquo; is
          the estimated ROI minus what a plain S&amp;P 500 (SPY) position would
          have returned over the same trade-to-latest window &mdash; positive
          means they outperformed just holding the index, not that the trade
          itself was large or certain.
        </p>
      </div>
    </div>
  );
}
