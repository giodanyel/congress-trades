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
import { createClient } from "@/lib/supabase/server";
import { partyStyle, relativeDate, formatPct } from "@/lib/ui";
import { TradeTypeBadge } from "@/components/TradeTypeBadge";
import { FollowButton } from "@/components/FollowButton";
import { committeeConflicts } from "@/lib/committees";
import { sectorForTicker } from "@/lib/sectors";

export const dynamic = "force-dynamic";

const TRADE_LIMIT_PER_ITEM = 8;

export default async function FollowingPage() {
  const supabaseAuth = await createClient();
  const {
    data: { user },
  } = await supabaseAuth.auth.getUser();

  if (!user) {
    return (
      <div className="flex flex-1 flex-col bg-background px-6 py-10">
        <div className="mx-auto w-full max-w-3xl">
          <h1 className="text-2xl font-heading font-semibold tracking-tight text-stone-900 dark:text-stone-50">
            Following
          </h1>
          <div className="mt-6 rounded-2xl border border-dashed border-stone-300 p-8 text-center dark:border-stone-700">
            <p className="text-sm text-stone-600 dark:text-stone-300">
              Sign in to follow politicians and tickers, and get your own
              daily email digest.
            </p>
            <div className="mt-4 flex items-center justify-center gap-2">
              <Link
                href="/login"
                className="rounded-full border border-stone-200 px-4 py-2 text-sm font-medium text-stone-600 hover:border-stone-300 dark:border-white/10 dark:text-stone-300"
              >
                Log in
              </Link>
              <Link
                href="/signup"
                className="rounded-full bg-brand px-4 py-2 text-sm font-medium text-white hover:opacity-90"
              >
                Sign up
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // RLS already scopes this to the signed-in user's own rows -- the
  // explicit eq() below is just belt-and-suspenders clarity, not what's
  // actually enforcing the isolation.
  const { data: watchlist } = await supabaseAuth
    .from("watchlist_items")
    .select("*")
    .eq("user_id", user.id)
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
          <h1 className="text-2xl font-heading font-semibold tracking-tight text-stone-900 dark:text-stone-50">
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
        <h1 className="text-2xl font-heading font-semibold tracking-tight text-stone-900 dark:text-stone-50">
          Following
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-stone-500 dark:text-stone-400">
          Everything recent from the politicians and tickers you&apos;ve
          chosen to follow. These also get called out first in your daily
          email digest.
        </p>

        {followedPoliticianIds.length > 0 && (
          <>
            <h2 className="mt-8 mb-3 font-heading text-sm font-semibold uppercase tracking-wide text-stone-500 dark:text-stone-400">
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
                    className="card-pop flex items-center gap-2 rounded-full py-1 pl-1 pr-3"
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
            <h2 className="mt-6 mb-3 font-heading text-sm font-semibold uppercase tracking-wide text-stone-500 dark:text-stone-400">
              Tickers you follow
            </h2>
            <div className="flex flex-wrap gap-2">
              {followedTickers.map((ticker) => {
                const s = stockByTicker.get(ticker);
                return (
                  <div
                    key={ticker}
                    className="card-pop flex items-center gap-2 rounded-full py-1 pl-3 pr-3"
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

        <h2 className="mt-8 mb-4 font-heading text-sm font-semibold uppercase tracking-wide text-stone-500 dark:text-stone-400">
          Recent activity
        </h2>

        {trades.length === 0 && (
          <div className="rounded-2xl border border-stone-200 p-4 text-sm text-stone-500 dark:border-stone-800 dark:text-stone-400">
            No trades on record yet for anyone or anything you follow.
          </div>
        )}

        <ul className="divide-y divide-stone-100 card-pop accent-rail accent-following dark:divide-stone-900">
          {trades.slice(0, TRADE_LIMIT_PER_ITEM * Math.max(1, followedPoliticianIds.length + followedTickers.length)).map((t) => {
            const p = politicianById.get(t.politician_id);
            const r = returnByTradeId.get(t.id);
            const conflicts = p ? committeeConflicts(p.id, sectorForTicker(t.ticker)) : [];
            const value = t.amount_label;
            const pnl =
              r && r.return_pct !== null && t.amount_min !== null && t.amount_max !== null
                ? r.return_pct * ((t.amount_min + t.amount_max) / 2)
                : null;
            return (
              <li key={t.id} className="flex items-center justify-between gap-4 px-4 py-3">
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
                    <Link
                      href={`/stocks/${t.ticker}`}
                      className="hover:underline"
                      title={conflicts.length > 0 ? `Committee overlap: ${conflicts.map((c) => `${c.committee} oversees ${c.sector}`).join("; ")}` : undefined}
                    >
                      {t.ticker}
                      {conflicts.length > 0 && <span style={{ color: "var(--cat-news)" }}>*</span>}
                    </Link>
                  </p>
                  <p className="mt-0.5 text-xs text-stone-400 dark:text-stone-600">
                    {relativeDate(t.transaction_date)}
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
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
