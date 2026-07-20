import Link from "next/link";
import {
  supabase,
  fetchAllRows,
  type Politician,
  type Trade,
  type Stock,
  type TradeReturn,
  type WatchlistItem,
} from "@/lib/supabase";
import { partyStyle, relativeDate, titleCase, formatPct } from "@/lib/ui";
import { TradeTypeBadge } from "@/components/TradeTypeBadge";
import { FollowButton } from "@/components/FollowButton";
import { committeeConflicts } from "@/lib/committees";
import { sectorForTicker } from "@/lib/sectors";

export const dynamic = "force-dynamic";

const TRADE_LIMIT_PER_ITEM = 8;

export default async function FollowingPage() {
  const { data: watchlist } = await supabase
    .from("watchlist_items")
    .select("*")
    .order("created_at", { ascending: false })
    .returns<WatchlistItem[]>();

  const followedPoliticianIds = (watchlist ?? [])
    .filter((w) => w.kind === "politician")
    .map((w) => w.ref_id);
  const followedTickers = (watchlist ?? [])
    .filter((w) => w.kind === "stock")
    .map((w) => w.ref_id);

  const isEmpty = followedPoliticianIds.length === 0 && followedTickers.length === 0;

  if (isEmpty) {
    return (
      <div className="flex flex-1 flex-col bg-background px-6 py-10">
        <div className="mx-auto w-full max-w-3xl">
          <h1 className="text-2xl font-semibold tracking-tight text-stone-900 dark:text-stone-50">
            Following
          </h1>
          <div className="mt-6 rounded-2xl border border-dashed border-stone-300 p-8 text-center dark:border-stone-700">
            <p className="text-sm text-stone-600 dark:text-stone-300">
              You&apos;re not following anyone yet.
            </p>
            <p className="mt-2 text-sm text-stone-500 dark:text-stone-400">
              Visit any politician or stock page and tap{" "}
              <span className="inline-flex items-center gap-1 rounded-full border border-stone-200 px-2 py-0.5 text-xs font-medium text-stone-500 dark:border-white/10 dark:text-stone-400">
                ☆ Follow
              </span>{" "}
              to add them here. New trades from people and tickers you follow
              will also be called out in your email digest.
            </p>
            <Link
              href="/politicians"
              className="mt-4 inline-block rounded-full bg-brand px-4 py-2 text-sm font-medium text-white hover:opacity-90"
            >
              Browse politicians
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const followedFilter = [
    followedPoliticianIds.length ? `politician_id.in.(${followedPoliticianIds.join(",")})` : null,
    followedTickers.length ? `ticker.in.(${followedTickers.join(",")})` : null,
  ]
    .filter(Boolean)
    .join(",");

  const [{ data: politicians }, { data: stocksData }, trades, returns] =
    await Promise.all([
      supabase
        .from("politicians")
        .select("*")
        .in("id", followedPoliticianIds.length ? followedPoliticianIds : ["__none__"])
        .returns<Politician[]>(),
      supabase
        .from("stocks")
        .select("*")
        .in("ticker", followedTickers.length ? followedTickers : ["__none__"])
        .returns<Stock[]>(),
      fetchAllRows<Trade>("trades", "*", (q) => q.or(followedFilter)),
      fetchAllRows<TradeReturn>("trade_returns", "*"),
    ]);

  trades.sort((a, b) => b.transaction_date.localeCompare(a.transaction_date));

  const politicianById = new Map((politicians ?? []).map((p) => [p.id, p]));
  const stockByTicker = new Map((stocksData ?? []).map((s) => [s.ticker, s]));
  const returnByTradeId = new Map(returns.map((r) => [r.trade_id, r]));

  return (
    <div className="flex flex-1 flex-col bg-background px-6 py-10">
      <div className="mx-auto w-full max-w-3xl">
        <h1 className="text-2xl font-semibold tracking-tight text-stone-900 dark:text-stone-50">
          Following
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-stone-500 dark:text-stone-400">
          Everything recent from the politicians and tickers you&apos;ve
          chosen to follow. These also get called out first in your daily
          email digest.
        </p>

        {followedPoliticianIds.length > 0 && (
          <>
            <h2 className="mt-8 mb-3 text-sm font-medium uppercase tracking-wide text-stone-500 dark:text-stone-400">
              Politicians you follow
            </h2>
            <div className="flex flex-wrap gap-2">
              {followedPoliticianIds.map((id) => {
                const p = politicianById.get(id);
                if (!p) return null;
                const style = partyStyle(p.party);
                return (
                  <div
                    key={id}
                    className="flex items-center gap-2 rounded-full border border-stone-200 py-1 pl-1 pr-3 dark:border-white/10"
                  >
                    <span className={`h-2 w-2 shrink-0 rounded-full ${style.dot}`} />
                    <Link href={`/politicians/${p.id}`} className="text-sm font-medium text-stone-800 hover:underline dark:text-stone-100">
                      {p.full_name}
                    </Link>
                    <FollowButton kind="politician" refId={p.id} initialFollowing size="sm" />
                  </div>
                );
              })}
            </div>
          </>
        )}

        {followedTickers.length > 0 && (
          <>
            <h2 className="mt-6 mb-3 text-sm font-medium uppercase tracking-wide text-stone-500 dark:text-stone-400">
              Tickers you follow
            </h2>
            <div className="flex flex-wrap gap-2">
              {followedTickers.map((ticker) => {
                const s = stockByTicker.get(ticker);
                return (
                  <div
                    key={ticker}
                    className="flex items-center gap-2 rounded-full border border-stone-200 py-1 pl-3 pr-3 dark:border-white/10"
                  >
                    <Link href={`/stocks/${ticker}`} className="text-sm font-medium text-stone-800 hover:underline dark:text-stone-100">
                      {ticker}
                    </Link>
                    <span className="text-xs text-stone-400">{s?.company_name}</span>
                    <FollowButton kind="stock" refId={ticker} initialFollowing size="sm" />
                  </div>
                );
              })}
            </div>
          </>
        )}

        <h2 className="mt-8 mb-4 text-sm font-medium uppercase tracking-wide text-stone-500 dark:text-stone-400">
          Recent activity
        </h2>

        {trades.length === 0 && (
          <div className="rounded-2xl border border-stone-200 p-4 text-sm text-stone-500 dark:border-stone-800 dark:text-stone-400">
            No trades on record yet for anyone or anything you follow.
          </div>
        )}

        <ul className="flex flex-col gap-3">
          {trades.slice(0, TRADE_LIMIT_PER_ITEM * Math.max(1, followedPoliticianIds.length + followedTickers.length)).map((t) => {
            const p = politicianById.get(t.politician_id);
            const stock = stockByTicker.get(t.ticker);
            const r = returnByTradeId.get(t.id);
            const conflicts = p ? committeeConflicts(p.id, sectorForTicker(t.ticker)) : [];
            const value = t.amount_label;
            const pnl =
              r && r.return_pct !== null && t.amount_min !== null && t.amount_max !== null
                ? r.return_pct * ((t.amount_min + t.amount_max) / 2)
                : null;
            return (
              <li key={t.id} className="rounded-2xl border border-stone-200 p-4 dark:border-stone-800">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-stone-900 dark:text-stone-50">
                      {p ? (
                        <>
                          <span className={`h-2 w-2 shrink-0 rounded-full ${partyStyle(p.party).dot}`} />
                          <Link href={`/politicians/${p.id}`} className="hover:underline">
                            {p.full_name}
                          </Link>
                        </>
                      ) : (
                        "Unknown"
                      )}
                      <TradeTypeBadge type={t.trade_type} />
                      <Link href={`/stocks/${t.ticker}`} className="hover:underline">
                        {t.ticker}
                      </Link>
                      {conflicts.length > 0 && (
                        <span
                          title={conflicts.map((c) => `${c.committee} oversees ${c.sector}`).join("; ")}
                          className="rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-950 dark:text-amber-300"
                        >
                          committee overlap
                        </span>
                      )}
                    </p>
                    <p className="mt-0.5 text-xs text-stone-500 dark:text-stone-400">
                      {stock?.company_name ?? t.ticker} &middot; {relativeDate(t.transaction_date)}
                      {p ? ` · ${titleCase(p.party)} · ${p.state}` : ""}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-medium text-stone-700 dark:text-stone-300">{value}</p>
                    {pnl !== null && (
                      <p className={`text-xs font-medium ${pnl >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                        {pnl >= 0 ? "+" : "-"}${Math.abs(pnl).toLocaleString("en-US", { maximumFractionDigits: 0 })}
                        {r && ` (${formatPct(r.return_pct ?? 0)})`}
                      </p>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
