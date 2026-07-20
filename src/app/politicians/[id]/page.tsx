import Link from "next/link";
import { notFound } from "next/navigation";
import {
  supabase,
  estimatedTradeValue,
  type Politician,
  type Trade,
  type Stock,
  type TradeReturn,
} from "@/lib/supabase";
import { formatUsd, partyStyle, titleCase } from "@/lib/ui";
import { PerformanceChart, type ChartPoint } from "@/components/PerformanceChart";
import { committeesFor, committeeConflicts } from "@/lib/committees";
import { sectorForTicker } from "@/lib/sectors";

export const dynamic = "force-dynamic";

export default async function PoliticianPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const { data: politician } = await supabase
    .from("politicians")
    .select("*")
    .eq("id", id)
    .single<Politician>();

  if (!politician) notFound();

  const { data: trades } = await supabase
    .from("trades")
    .select("*")
    .eq("politician_id", id)
    .order("transaction_date", { ascending: false })
    .returns<Trade[]>();

  const tickers = [...new Set((trades ?? []).map((t) => t.ticker))];
  const { data: stocks } = await supabase
    .from("stocks")
    .select("*")
    .in("ticker", tickers.length ? tickers : ["__none__"])
    .returns<Stock[]>();

  const stockByTicker = new Map((stocks ?? []).map((s) => [s.ticker, s]));

  const tradeIds = (trades ?? []).map((t) => t.id);
  const { data: returns } = await supabase
    .from("trade_returns")
    .select("*")
    .in("trade_id", tradeIds.length ? tradeIds : ["__none__"])
    .returns<TradeReturn[]>();
  const returnByTradeId = new Map((returns ?? []).map((r) => [r.trade_id, r]));

  const purchaseCount = (trades ?? []).filter((t) => t.trade_type === "PURCHASE").length;
  const saleCount = (trades ?? []).filter((t) => t.trade_type === "SALE").length;
  const totalEstimatedVolume = (trades ?? []).reduce(
    (sum, t) => sum + (estimatedTradeValue(t) ?? 0),
    0
  );

  const style = partyStyle(politician.party);
  const committees = committeesFor(politician.id);

  // Cumulative P&L over time, chronological, for the performance chart --
  // both the actual estimated $ return on each priced trade and what an
  // equal-sized S&P 500 position would have returned instead.
  const chronological = [...(trades ?? [])].sort((a, b) =>
    a.transaction_date.localeCompare(b.transaction_date)
  );
  let runningPnl = 0;
  let runningSpyPnl = 0;
  let sawSpy = false;
  const chartPoints: ChartPoint[] = [];
  for (const t of chronological) {
    const r = returnByTradeId.get(t.id);
    if (!r || r.return_pct === null || r.confidence === "UNAVAILABLE") continue;
    const value = estimatedTradeValue(t) ?? 0;
    runningPnl += r.return_pct * value;
    if (r.spy_return_pct !== null) {
      runningSpyPnl += r.spy_return_pct * value;
      sawSpy = true;
    }
    chartPoints.push({
      date: t.transaction_date,
      cumPnl: runningPnl,
      cumSpyPnl: sawSpy ? runningSpyPnl : null,
    });
  }

  return (
    <div className="flex flex-1 flex-col bg-white px-6 py-10 dark:bg-black">
      <div className="mx-auto w-full max-w-3xl">
        <div className="flex items-center gap-3">
          <span className={`h-3 w-3 shrink-0 rounded-full ${style.dot}`} />
          <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            {politician.full_name}
          </h1>
        </div>
        <p className="mt-1 flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${style.badge}`}>
            {style.label}
          </span>
          {politician.state} &middot; {titleCase(politician.chamber)}
        </p>
        {politician.bio && (
          <p className="mt-4 text-sm leading-relaxed text-zinc-600 dark:text-zinc-300">
            {politician.bio}
          </p>
        )}

        {committees.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {committees.map((c) => (
              <span
                key={c}
                className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400"
              >
                {c}
              </span>
            ))}
          </div>
        )}

        <div className="mt-8 grid grid-cols-3 gap-3">
          <div className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
            <p className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
              {trades?.length ?? 0}
            </p>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">Total trades</p>
          </div>
          <div className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
            <p className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
              {purchaseCount} / {saleCount}
            </p>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">Buys / Sells</p>
          </div>
          <div className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
            <p className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
              {formatUsd(totalEstimatedVolume)}
            </p>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              Est. total volume*
            </p>
          </div>
        </div>

        <h2 className="mt-10 mb-4 text-sm font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          Cumulative estimated P&amp;L vs S&amp;P 500
        </h2>
        <PerformanceChart points={chartPoints} />

        <h2 className="mt-10 mb-4 text-sm font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          Trade history
        </h2>

        <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-50 text-xs uppercase text-zinc-500 dark:bg-zinc-950 dark:text-zinc-400">
              <tr>
                <th className="px-4 py-2 font-medium">Date</th>
                <th className="px-4 py-2 font-medium">Ticker</th>
                <th className="px-4 py-2 font-medium">Type</th>
                <th className="px-4 py-2 font-medium">Owner</th>
                <th className="px-4 py-2 font-medium">Amount range</th>
                <th className="px-4 py-2 font-medium">Est. P&amp;L*</th>
                <th className="px-4 py-2 font-medium">vs S&amp;P 500</th>
              </tr>
            </thead>
            <tbody>
              {(trades ?? []).map((t) => {
                const r = returnByTradeId.get(t.id);
                const value = estimatedTradeValue(t);
                const pnl =
                  r && r.return_pct !== null && value !== null ? r.return_pct * value : null;
                const conflicts = committeeConflicts(politician.id, sectorForTicker(t.ticker));
                return (
                  <tr
                    key={t.id}
                    className="border-t border-zinc-100 dark:border-zinc-900"
                  >
                    <td className="px-4 py-2 text-zinc-600 dark:text-zinc-300">
                      {t.transaction_date}
                    </td>
                    <td className="px-4 py-2 font-medium text-zinc-900 dark:text-zinc-50">
                      <Link href={`/stocks/${t.ticker}`} className="hover:underline">
                        {t.ticker}
                      </Link>
                      <span className="ml-1 text-xs font-normal text-zinc-500 dark:text-zinc-400">
                        {stockByTicker.get(t.ticker)?.company_name}
                      </span>
                      {conflicts.length > 0 && (
                        <span
                          title={conflicts.map((c) => `${c.committee} oversees ${c.sector}`).join("; ")}
                          className="ml-1.5 rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-950 dark:text-amber-300"
                        >
                          committee overlap
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2">
                      <span
                        className={
                          t.trade_type === "PURCHASE"
                            ? "text-emerald-600 dark:text-emerald-400"
                            : t.trade_type === "SALE"
                              ? "text-red-600 dark:text-red-400"
                              : "text-zinc-500"
                        }
                      >
                        {titleCase(t.trade_type)}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-zinc-600 dark:text-zinc-300">
                      {titleCase(t.owner)}
                    </td>
                    <td className="px-4 py-2 text-zinc-600 dark:text-zinc-300">
                      {t.amount_label}
                    </td>
                    <td className="px-4 py-2">
                      {pnl === null ? (
                        <span className="text-zinc-400 dark:text-zinc-600">
                          {r?.confidence === "UNAVAILABLE" || !r ? "no price data" : "—"}
                        </span>
                      ) : (
                        <span
                          className={
                            pnl >= 0
                              ? "text-emerald-600 dark:text-emerald-400"
                              : "text-red-600 dark:text-red-400"
                          }
                        >
                          {pnl >= 0 ? "+" : "-"}${Math.abs(pnl).toLocaleString("en-US", { maximumFractionDigits: 0 })}
                          <span className="ml-1 text-xs text-zinc-400">
                            ({r!.confidence.toLowerCase()})
                          </span>
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2">
                      {r?.alpha_pct == null ? (
                        <span className="text-zinc-400 dark:text-zinc-600">—</span>
                      ) : (
                        <span
                          className={
                            r.alpha_pct >= 0
                              ? "text-emerald-600 dark:text-emerald-400"
                              : "text-red-600 dark:text-red-400"
                          }
                        >
                          {r.alpha_pct >= 0 ? "+" : ""}
                          {(r.alpha_pct * 100).toFixed(1)} pts
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <p className="mt-4 text-xs text-zinc-400 dark:text-zinc-500">
          * STOCK Act disclosures report a dollar range, not an exact amount, so
          both the volume totals and P&amp;L figures are estimates using the
          disclosed range&apos;s midpoint and available price history &mdash; never
          treat them as exact. P&amp;L compares the price on the trade date to
          the most recent available price; confidence reflects how close that
          match is.
        </p>
      </div>
    </div>
  );
}
