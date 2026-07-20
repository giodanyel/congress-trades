import Link from "next/link";
import { supabase, type Trade } from "@/lib/supabase";
import { quarterlyActivity, type MarketNews } from "@/lib/news";
import { relativeDate } from "@/lib/ui";

export const dynamic = "force-dynamic";

const NEWS_LIMIT = 60;
const CURRENT_YEAR = new Date().getUTCFullYear();

export default async function MarketNewsPage() {
  const { data: news, error } = await supabase
    .from("market_news")
    .select("*")
    .order("published_at", { ascending: false })
    .limit(NEWS_LIMIT)
    .returns<MarketNews[]>();

  const items = news ?? [];
  const tickers = [...new Set(items.map((n) => n.ticker))];

  const { data: trades } = await supabase
    .from("trades")
    .select("ticker, transaction_date, trade_type")
    .in("ticker", tickers.length ? tickers : ["__none__"])
    .returns<Pick<Trade, "ticker" | "transaction_date" | "trade_type">[]>();

  const allTrades = (trades ?? []) as Trade[];

  return (
    <div className="flex flex-1 flex-col bg-background px-6 py-10">
      <div className="mx-auto w-full max-w-3xl">
        <h1 className="text-2xl font-heading font-semibold tracking-tight text-stone-900 dark:text-stone-50">
          Market News
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-stone-500 dark:text-stone-400">
          Recent headlines for tickers members of Congress have actually been
          trading, each paired with how much buying and selling Congress did
          in that stock this year by quarter &mdash; so a headline comes with
          context, not just noise. This is a screen to help you look
          further, not investment advice.
        </p>

        {error && (
          <div className="mt-6 card-pop border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-400">
            Couldn&apos;t load news: {error.message}
          </div>
        )}

        {!error && items.length === 0 && (
          <div className="mt-6 card-pop p-4 text-sm text-stone-500 dark:text-stone-400">
            No headlines synced yet &mdash; check back soon.
          </div>
        )}

        <ul className="mt-6 flex flex-col gap-3">
          {items.map((n, i) => {
            const quarters = quarterlyActivity(n.ticker, allTrades, CURRENT_YEAR).slice(0, 3);
            const totalBuys = quarters.reduce((s, q) => s + q.buys, 0);
            const totalSells = quarters.reduce((s, q) => s + q.sells, 0);
            const anyActivity = totalBuys > 0 || totalSells > 0;
            return (
              <li
                key={n.id}
                className="card-pop animate-in accent-rail accent-news p-4"
                style={{ animationDelay: `${Math.min(i, 8) * 25}ms` }}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={`/stocks/${n.ticker}`}
                        className="rounded-full px-2 py-0.5 text-xs font-semibold"
                        style={{ backgroundColor: "var(--cat-stocks-soft)", color: "var(--cat-stocks)" }}
                      >
                        {n.ticker}
                      </Link>
                      <span className="text-xs text-stone-400 dark:text-stone-600">
                        {n.source} &middot; {relativeDate(n.published_at)}
                      </span>
                    </div>
                    <a
                      href={n.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1.5 block text-sm font-medium leading-snug text-stone-900 hover:underline dark:text-stone-50"
                    >
                      {n.headline}
                    </a>
                  </div>
                </div>

                <div className="mt-3 flex items-center gap-2 border-t border-stone-100 pt-3 dark:border-stone-900">
                  {anyActivity ? (
                    <span
                      title={quarters.map((q) => `${q.quarter} ${CURRENT_YEAR}: ${q.buys} buys, ${q.sells} sells`).join(" · ")}
                      className="inline-flex items-center gap-1 rounded-full bg-stone-100 px-2 py-0.5 text-[11px] font-medium text-stone-600 dark:bg-white/5 dark:text-stone-400"
                    >
                      {CURRENT_YEAR} so far:
                      {totalBuys > 0 && (
                        <span className="text-emerald-600 dark:text-emerald-400">+{totalBuys}</span>
                      )}
                      {totalSells > 0 && (
                        <span className="text-rose-600 dark:text-rose-400">-{totalSells}</span>
                      )}
                    </span>
                  ) : (
                    <span className="text-[11px] text-stone-400 dark:text-stone-600">
                      No congressional trades in {n.ticker} so far this year.
                    </span>
                  )}
                  <Link
                    href={`/stocks/${n.ticker}`}
                    className="ml-auto text-[11px] font-medium text-stone-400 hover:text-stone-600 dark:text-stone-600 dark:hover:text-stone-300"
                  >
                    Full activity &rarr;
                  </Link>
                </div>
              </li>
            );
          })}
        </ul>

        <p className="mt-4 text-xs text-stone-400 dark:text-stone-500">
          Headlines are synced twice daily for the tickers most actively
          traded by Congress in the last 6 months. &ldquo;+&rdquo; is buys,
          &ldquo;-&rdquo; is sells, disclosed by members of Congress under
          the STOCK Act &mdash; not a signal or recommendation either way.
        </p>
      </div>
    </div>
  );
}
