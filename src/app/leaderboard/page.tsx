import Link from "next/link";
import { getCachedPoliticians, getCachedTrades, estimatedTradeValue } from "@/lib/supabase";
import { formatUsd, partyStyle } from "@/lib/ui";

// Page renders per-request; the heavy trades read underneath is cached
// via unstable_cache (see @/lib/supabase), not this.
export const dynamic = "force-dynamic";

export default async function LeaderboardPage() {
  const [politicians, trades] = await Promise.all([getCachedPoliticians(), getCachedTrades()]);

  const byPolitician = new Map<
    string,
    { tradeCount: number; purchases: number; sales: number; volume: number }
  >();

  for (const t of trades) {
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
    <div className="flex flex-1 flex-col bg-background px-6 py-10">
      <div className="mx-auto w-full max-w-3xl">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-heading font-semibold tracking-tight text-stone-900 dark:text-stone-50">
            Most Active Traders
          </h1>
          <Link
            href="/leaderboard/roi"
            className="text-xs font-medium text-stone-500 hover:text-stone-700 dark:text-stone-400 dark:hover:text-stone-200"
          >
            Top Performers &rarr;
          </Link>
        </div>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-stone-500 dark:text-stone-400">
          Ranked by estimated total disclosed trade volume.{" "}
          <strong className="text-stone-700 dark:text-stone-300">
            This reflects activity, not performance.
          </strong>{" "}
          For gains and losses, see{" "}
          <Link href="/leaderboard/roi" className="underline">
            Top Performers
          </Link>
          .
        </p>

        <div className="mt-6 overflow-x-auto card-pop accent-rail accent-politicians">
          <table className="w-full text-left text-sm">
            <thead className="bg-stone-50 text-xs uppercase text-stone-500 dark:bg-stone-950 dark:text-stone-400">
              <tr>
                <th className="px-4 py-2 font-medium">#</th>
                <th className="px-4 py-2 font-medium">Politician</th>
                <th className="px-4 py-2 font-medium">Trades</th>
                <th className="px-4 py-2 font-medium">Buys / Sells</th>
                <th className="px-4 py-2 font-medium">Est. volume*</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => {
                const style = partyStyle(row.politician.party);
                return (
                  <tr
                    key={row.politician.id}
                    className="border-t border-stone-100 dark:border-stone-900"
                  >
                    <td className="px-4 py-2 text-stone-400">{i + 1}</td>
                    <td className="px-4 py-2 font-medium text-stone-900 dark:text-stone-50">
                      <Link
                        href={`/politicians/${row.politician.id}`}
                        className="flex items-center gap-2 hover:underline"
                      >
                        <span className={`h-2 w-2 shrink-0 rounded-full ${style.dot}`} />
                        {row.politician.full_name}
                        <span className="text-xs font-normal text-stone-500 dark:text-stone-400">
                          {row.politician.state}
                        </span>
                      </Link>
                    </td>
                    <td className="px-4 py-2 text-stone-600 dark:text-stone-300">
                      {row.stats!.tradeCount}
                    </td>
                    <td className="px-4 py-2 text-stone-600 dark:text-stone-300">
                      {row.stats!.purchases} / {row.stats!.sales}
                    </td>
                    <td className="px-4 py-2 font-medium text-stone-900 dark:text-stone-50">
                      {formatUsd(row.stats!.volume, true)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <p className="mt-4 text-xs text-stone-400 dark:text-stone-500">
          * STOCK Act disclosures report a dollar range, not an exact amount.
          Volume is estimated using the midpoint of each disclosed range.
        </p>
      </div>
    </div>
  );
}
