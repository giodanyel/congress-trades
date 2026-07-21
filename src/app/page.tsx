import Link from "next/link";
import {
  getCachedTrades,
  getCachedTradeReturns,
  getCachedPoliticians,
  estimatedTradeValue,
} from "@/lib/supabase";
import { createClient } from "@/lib/supabase/server";
import { partyStyle, formatUsd, formatPct, relativeDate } from "@/lib/ui";
import { aggregateByPolitician, roiOf, alphaOf, ACTIVE_WINDOW_DAYS } from "@/lib/analytics";
import { FollowButton } from "@/components/FollowButton";
import type { WatchlistItem } from "@/lib/supabase";

// The page itself still renders per-request (follow-button state, etc),
// but the expensive full-table reads it depends on are wrapped in
// unstable_cache below (see @/lib/supabase) so they're not re-run against
// Supabase on every single visit -- only every 30 min.
export const dynamic = "force-dynamic";

const RECENT_BUYS_LIMIT = 8;
const TOP_PERFORMERS_LIMIT = 6;

// Logged-out visitors get a small, deliberately-stale preview -- enough to
// see what the product does, not enough to replace having an account.
// Everything else in the app requires signing in (see middleware.ts).
const PREVIEW_LIMIT = 3;
const PREVIEW_STALE_DAYS = 30;

export default async function Home() {
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

  // Only fetch this signed-in user's own follow state -- logged-out
  // visitors just see every Follow button unfilled, which is correct.
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
  const returnByTradeId = new Map((returns ?? []).map((r) => [r.trade_id, r]));

  const now = Date.now();
  const cutoff = now - ACTIVE_WINDOW_DAYS * 24 * 60 * 60 * 1000;

  // Aggregate per-politician ROI + last trade date in one pass, shared with
  // the ROI leaderboard and Interesting Buys so the numbers always agree.
  const byPolitician = aggregateByPolitician(trades ?? [], returnByTradeId);

  // Logged-out visitors see the same shape of data, just older and capped
  // shorter -- a real preview of the product, not today's actual activity.
  const previewCutoff = now - PREVIEW_STALE_DAYS * 24 * 60 * 60 * 1000;
  const tradesForView = user
    ? trades ?? []
    : (trades ?? []).filter((t) => new Date(t.transaction_date).getTime() < previewCutoff);
  const performerLimit = user ? TOP_PERFORMERS_LIMIT : PREVIEW_LIMIT;
  const buysLimit = user ? RECENT_BUYS_LIMIT : PREVIEW_LIMIT;
  const performerCutoff = user ? cutoff : previewCutoff - ACTIVE_WINDOW_DAYS * 24 * 60 * 60 * 1000;

  const topPerformers = [...byPolitician.entries()]
    .map(([politicianId, agg]) => ({ politician: politicianById.get(politicianId), agg }))
    .filter(
      (r) =>
        r.politician &&
        r.agg.pricedTrades > 0 &&
        new Date(r.agg.lastTradeDate).getTime() >= performerCutoff &&
        (user || new Date(r.agg.lastTradeDate).getTime() < previewCutoff)
    )
    .map((r) => ({
      politician: r.politician!,
      agg: r.agg,
      roi: roiOf(r.agg),
      alpha: alphaOf(r.agg),
    }))
    .sort((a, b) => b.roi - a.roi)
    .slice(0, performerLimit);

  const recentBuys = tradesForView
    .filter((t) => t.trade_type === "PURCHASE")
    .sort((a, b) => b.transaction_date.localeCompare(a.transaction_date))
    .slice(0, buysLimit);

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

        {!user && (
          <div className="card-pop accent-rail accent-following mt-6 flex flex-wrap items-center justify-between gap-3 p-4">
            <div>
              <p className="text-sm font-medium text-stone-900 dark:text-stone-50">
                You&apos;re viewing a free preview with data older than {PREVIEW_STALE_DAYS} days.
              </p>
              <p className="mt-0.5 text-xs text-stone-500 dark:text-stone-400">
                Create a free account to see today&apos;s trades, live Hot Stocks pricing, Interesting Buys, and your own alerts.
              </p>
            </div>
            <div className="flex shrink-0 gap-2">
              <Link
                href="/signup"
                className="rounded-full bg-brand px-4 py-2 text-xs font-medium text-white transition-transform hover:scale-[1.02] active:scale-[0.98]"
              >
                Sign up free
              </Link>
              <Link
                href="/login"
                className="rounded-full border border-stone-200 px-4 py-2 text-xs font-medium text-stone-600 hover:border-stone-300 dark:border-white/10 dark:text-stone-300"
              >
                Log in
              </Link>
            </div>
          </div>
        )}

        {/* Quick orientation stats -- a friendly at-a-glance strip rather
            than making a first-time visitor read tables to understand
            scope. */}
        <div className="mt-6 grid grid-cols-3 gap-3">
          <div className="card-pop px-4 py-3">
            <p className="font-heading text-xl font-semibold text-brand">{(politicians ?? []).length}</p>
            <p className="text-xs text-stone-500 dark:text-stone-400">Politicians tracked</p>
          </div>
          <div className="card-pop px-4 py-3">
            <p className="font-heading text-xl font-semibold text-brand">
              {(trades ?? []).length.toLocaleString("en-US")}
            </p>
            <p className="text-xs text-stone-500 dark:text-stone-400">Trades disclosed</p>
          </div>
          <div className="card-pop px-4 py-3">
            <p className="font-heading text-xl font-semibold text-brand">Daily</p>
            <p className="text-xs text-stone-500 dark:text-stone-400">Data refresh</p>
          </div>
        </div>

        {/* Top performers, currently active */}
        <div className="mt-10 flex items-center justify-between">
          <h2 className="font-heading text-sm font-semibold uppercase tracking-wide text-stone-500 dark:text-stone-400">
            {user ? "Top Performers, Currently Active" : "Top Performers (preview)"}
          </h2>
          {user && (
            <Link
              href="/leaderboard/roi"
              className="text-xs font-medium text-stone-500 hover:text-stone-700 dark:text-stone-400 dark:hover:text-stone-200"
            >
              Full ROI leaderboard &rarr;
            </Link>
          )}
        </div>
        <p className="mt-1 text-xs text-stone-400 dark:text-stone-600">
          {user
            ? `Ranked by estimated ROI, limited to politicians who traded in the last ${ACTIVE_WINDOW_DAYS} days.`
            : `Ranked by estimated ROI. Sign up to see politicians active in the last ${ACTIVE_WINDOW_DAYS} days instead of this ${PREVIEW_STALE_DAYS}+ day snapshot.`}
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

        <ul className="mt-4 divide-y divide-stone-100 card-pop accent-rail accent-performance dark:divide-stone-900">
          {topPerformers.map((row, i) => {
            const style = partyStyle(row.politician.party);
            const positive = row.roi >= 0;
            return (
              <li key={row.politician.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <Link href={`/politicians/${row.politician.id}`} className="flex min-w-0 flex-1 items-center gap-3">
                  <span className="w-4 shrink-0 text-xs font-semibold text-stone-400">{i + 1}</span>
                  <span className={`h-2 w-2 shrink-0 rounded-full ${style.dot}`} />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-stone-900 hover:underline dark:text-stone-50">
                      {row.politician.full_name}
                    </p>
                    <p className="text-xs text-stone-400 dark:text-stone-600">
                      {row.politician.state} &middot; {relativeDate(row.agg.lastTradeDate)}
                    </p>
                  </div>
                </Link>
                <div className="flex shrink-0 items-center gap-2">
                  <span
                    className={`text-sm font-semibold ${
                      positive ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
                    }`}
                  >
                    {formatPct(row.roi)}
                  </span>
                  {user && (
                    <FollowButton
                      kind="politician"
                      refId={row.politician.id}
                      initialFollowing={followedPoliticianIds.has(row.politician.id)}
                      size="sm"
                    />
                  )}
                </div>
              </li>
            );
          })}
        </ul>

        {/* Latest buys */}
        <div className="mt-12 flex items-center justify-between">
          <h2 className="font-heading text-sm font-semibold uppercase tracking-wide text-stone-500 dark:text-stone-400">
            {user ? "Latest Buys" : "Latest Buys (preview)"}
          </h2>
          {user && (
            <Link
              href="/leaderboard"
              className="text-xs font-medium text-stone-500 hover:text-stone-700 dark:text-stone-400 dark:hover:text-stone-200"
            >
              Most active traders &rarr;
            </Link>
          )}
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
                  {user && p && (
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
