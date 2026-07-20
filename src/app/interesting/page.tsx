import Link from "next/link";
import {
  supabase,
  type Politician,
  type Trade,
  type Stock,
  type TradeReturn,
} from "@/lib/supabase";
import { partyStyle, relativeDate, titleCase } from "@/lib/ui";
import { aggregateByPolitician, roiOf, isActive, sizeTier } from "@/lib/analytics";
import { committeeConflicts } from "@/lib/committees";
import { sectorForTicker } from "@/lib/sectors";

export const dynamic = "force-dynamic";

// A buy counts as "interesting" if it's recent and has at least one flag:
// unusually large, bought by multiple members around the same time, or
// bought by a politician who's currently outperforming on priced trades.
const RECENT_DAYS = 45;
const CLUSTER_WINDOW_DAYS = 60;
const CLUSTER_MIN_MEMBERS = 2;

export default async function InterestingBuysPage() {
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

    const score = flags.reduce((s, f) => s + f.weight, 0);
    rows.push({ trade: t, politician: p, flags, score });
  }

  rows.sort((a, b) => b.score - a.score || b.trade.transaction_date.localeCompare(a.trade.transaction_date));

  return (
    <div className="flex flex-1 flex-col bg-background px-6 py-10">
      <div className="mx-auto w-full max-w-3xl">
        <h1 className="text-2xl font-semibold tracking-tight text-stone-900 dark:text-stone-50">
          Interesting Buys
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-stone-500 dark:text-stone-400">
          Purchases from the last {RECENT_DAYS} days worth a second look: unusually
          large disclosed amounts, tickers multiple members bought around the
          same time, buys from politicians currently outperforming on their
          priced trades, or buys in a sector overseen by a committee the
          politician sits on. This is a screen to help you look further, not
          investment advice. The committee overlap flag uses a curated,{" "}
          <span className="italic">non-exhaustive</span> reference of
          committees and sectors &mdash; its absence doesn&apos;t mean there&apos;s no
          overlap, only that this screen didn&apos;t catch one.
        </p>

        {rows.length === 0 && (
          <div className="mt-6 rounded-2xl border border-stone-200 p-4 text-sm text-stone-500 dark:border-stone-800 dark:text-stone-400">
            Nothing stands out from the last {RECENT_DAYS} days yet.
          </div>
        )}

        <ul className="mt-6 flex flex-col gap-3">
          {rows.map(({ trade: t, politician: p, flags }) => {
            const style = partyStyle(p.party);
            const stock = stockByTicker.get(t.ticker);
            const r = returnByTradeId.get(t.id);
            const preMove = r?.pre_disclosure_move_pct ?? null;
            return (
              <li
                key={t.id}
                className="rounded-2xl border border-stone-200 p-4 dark:border-stone-800"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 text-sm font-medium text-stone-900 dark:text-stone-50">
                      <span className={`h-2 w-2 shrink-0 rounded-full ${style.dot}`} />
                      <Link href={`/politicians/${p.id}`} className="hover:underline">
                        {p.full_name}
                      </Link>
                      <span className="font-normal text-stone-400">bought</span>
                      <Link href={`/stocks/${t.ticker}`} className="hover:underline">
                        {t.ticker}
                      </Link>
                    </p>
                    <p className="mt-0.5 text-xs text-stone-500 dark:text-stone-400">
                      {stock?.company_name ?? t.ticker} &middot; {relativeDate(t.transaction_date)}
                      {" "}&middot; {titleCase(p.party)} &middot; {p.state}
                    </p>
                  </div>
                  <span className="shrink-0 text-sm font-medium text-stone-700 dark:text-stone-300">
                    {t.amount_label}
                  </span>
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {flags.map((f) => (
                    <span
                      key={f.label}
                      className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700 dark:bg-amber-950 dark:text-amber-300"
                    >
                      {f.label}
                    </span>
                  ))}
                </div>
                {preMove !== null && t.filing_date ? (
                  <p className="mt-2 text-xs text-stone-500 dark:text-stone-400">
                    By the {t.filing_date} disclosure, the price had already{" "}
                    {preMove >= 0 ? "risen" : "fallen"} {Math.abs(preMove * 100).toFixed(1)}% from
                    the trade price.
                  </p>
                ) : (
                  <p className="mt-2 text-xs text-stone-400 dark:text-stone-600">
                    Disclosure lag / price-move data not available yet for this trade.
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
