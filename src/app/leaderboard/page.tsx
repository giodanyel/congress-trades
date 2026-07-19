import Link from "next/link";
import {
  supabase,
  estimatedTradeValue,
  type Politician,
  type Trade,
} from "@/lib/supabase";

export const dynamic = "force-dynamic";

function formatUsd(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
    notation: "compact",
  }).format(value);
}

function titleCase(s: string) {
  return s.charAt(0) + s.slice(1).toLowerCase();
}

export default async function LeaderboardPage() {
  const { data: politicians } = await supabase
    .from("politicians")
    .select("*")
    .returns<Politician[]>();

  const { data: trades } = await supabase
    .from("trades")
    .select("*")
    .returns<Trade[]>();

  const byPolitician = new Map<
    string,
    { tradeCount: number; purchases: number; sales: number; volume: number }
  >();

  for (const t of trades ?? []) {
    const entry = byPolitician.get(t.politician_id) ?? {
      tradeCount: 0,
      purchases: 0,
      sales: 0,
      volume: 0,
    };
    entry.tradeCount += 1;
    if (t.trade_type === "PURCHASE") entry.purchases += 1;
    if (t.trade_type === "SALE") entry.sales += 1;
    entry.volume += estimatedTradeValue(t) ?? 0;
    byPolitician.set(t.politician_id, entry);
  }

  const rows = (politicians ?? [])
    .map((p) => ({ politician: p, stats: byPolitician.get(p.id) }))
    .filter((r) => r.stats && r.stats.tradeCount > 0)
    .sort((a, b) => (b.stats!.volume ?? 0) - (a.stats!.volume ?? 0));

  return (
    <div className="flex flex-1 flex-col bg-white px-6 py-16 dark:bg-black">
      <div className="mx-auto w-full max-w-3xl">
        <Link
          href="/"
          className="text-xs font-medium text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
        >
          &larr; Back to all politicians
        </Link>

        <h1 className="mt-4 text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Most Active Traders
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">
          Ranked by estimated total disclosed trade volume (sum of each trade&apos;s
          amount-range midpoint). This reflects trading activity, not
          investment performance.{" "}
          <strong className="text-zinc-700 dark:text-zinc-300">
            This is not a return-on-investment (ROI) ranking.
          </strong>{" "}
          A true ROI leaderboard requires historical stock price data at each
          trade date, which is planned for a future update and will be clearly
          labeled with a confidence score once added.
        </p>

        <div className="mt-8 overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-50 text-xs uppercase text-zinc-500 dark:bg-zinc-950 dark:text-zinc-400">
              <tr>
                <th className="px-4 py-2 font-medium">#</th>
                <th className="px-4 py-2 font-medium">Politician</th>
                <th className="px-4 py-2 font-medium">Trades</th>
                <th className="px-4 py-2 font-medium">Buys / Sells</th>
                <th className="px-4 py-2 font-medium">Est. volume*</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr
                  key={row.politician.id}
                  className="border-t border-zinc-100 dark:border-zinc-900"
                >
                  <td className="px-4 py-2 text-zinc-400">{i + 1}</td>
                  <td className="px-4 py-2 font-medium text-zinc-900 dark:text-zinc-50">
                    <Link
                      href={`/politicians/${row.politician.id}`}
                      className="hover:underline"
                    >
                      {row.politician.full_name}
                    </Link>
                    <span className="ml-2 text-xs font-normal text-zinc-500 dark:text-zinc-400">
                      {titleCase(row.politician.party)} &middot; {row.politician.state}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-zinc-600 dark:text-zinc-300">
                    {row.stats!.tradeCount}
                  </td>
                  <td className="px-4 py-2 text-zinc-600 dark:text-zinc-300">
                    {row.stats!.purchases} / {row.stats!.sales}
                  </td>
                  <td className="px-4 py-2 font-medium text-zinc-900 dark:text-zinc-50">
                    {formatUsd(row.stats!.volume)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="mt-4 text-xs text-zinc-400 dark:text-zinc-500">
          * STOCK Act disclosures report a dollar range, not an exact amount.
          Volume is estimated using the midpoint of each disclosed range.
        </p>
      </div>
    </div>
  );
}
