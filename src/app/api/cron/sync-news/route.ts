import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { isAdminAuthorized } from "@/lib/adminAuth";
import { fetchAllRows, type Trade } from "@/lib/supabase";
import { parseRssItems } from "@/lib/news";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// How many of the most-actively-traded-by-Congress tickers to pull
// headlines for each run. Keeping this scoped (rather than every ticker
// ever traded) is what keeps the news feed relevant instead of noisy, and
// keeps the run comfortably inside the function time limit.
const TARGET_TICKER_COUNT = 25;
const RECENT_TRADE_WINDOW_DAYS = 180;
const ITEMS_PER_TICKER = 5;
const FETCH_CONCURRENCY = 6;
const RETENTION_DAYS = 60;

function newsUrl(ticker: string) {
  const q = encodeURIComponent(`${ticker} stock`);
  return `https://news.google.com/rss/search?q=${q}&hl=en-US&gl=US&ceid=US:en`;
}

async function fetchTickerNews(ticker: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(newsUrl(ticker), {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; CongressTradesBot/1.0)" },
      signal: controller.signal,
    });
    if (!res.ok) return { ticker, items: [], error: `HTTP ${res.status}` };
    const xml = await res.text();
    const items = parseRssItems(xml).slice(0, ITEMS_PER_TICKER);
    return { ticker, items, error: null as string | null };
  } catch (err) {
    return { ticker, items: [], error: err instanceof Error ? err.message : String(err) };
  } finally {
    clearTimeout(timeout);
  }
}

export async function GET(req: NextRequest) {
  if (!isAdminAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();

  let trades: Trade[];
  try {
    trades = await fetchAllRows<Trade>("trades", "ticker, transaction_date");
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }

  const cutoff = Date.now() - RECENT_TRADE_WINDOW_DAYS * 24 * 60 * 60 * 1000;
  const countByTicker = new Map<string, number>();
  for (const t of trades) {
    if (new Date(t.transaction_date).getTime() < cutoff) continue;
    countByTicker.set(t.ticker, (countByTicker.get(t.ticker) ?? 0) + 1);
  }

  const targetTickers = [...countByTicker.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, TARGET_TICKER_COUNT)
    .map(([ticker]) => ticker);

  if (req.nextUrl.searchParams.get("diag") === "1") {
    return NextResponse.json({ targetTickers, tradesLoaded: trades.length });
  }

  const results: { ticker: string; found: number; error: string | null }[] = [];
  const allRows: { ticker: string; headline: string; url: string; source: string; published_at: string }[] = [];

  for (let i = 0; i < targetTickers.length; i += FETCH_CONCURRENCY) {
    const slice = targetTickers.slice(i, i + FETCH_CONCURRENCY);
    const batch = await Promise.all(slice.map(fetchTickerNews));
    for (const { ticker, items, error } of batch) {
      results.push({ ticker, found: items.length, error });
      for (const item of items) {
        allRows.push({
          ticker,
          headline: item.headline,
          url: item.url,
          source: item.source,
          published_at: item.publishedAt,
        });
      }
    }
  }

  let inserted = 0;
  if (allRows.length > 0) {
    const { error, count } = await supabase
      .from("market_news")
      .upsert(allRows, { onConflict: "url", ignoreDuplicates: true, count: "exact" });
    if (error) {
      return NextResponse.json({ error: `Upsert failed: ${error.message}`, results }, { status: 500 });
    }
    inserted = count ?? 0;
  }

  const retentionCutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const { error: cleanupError } = await supabase
    .from("market_news")
    .delete()
    .lt("published_at", retentionCutoff);

  return NextResponse.json({
    targetTickers: targetTickers.length,
    itemsFetched: allRows.length,
    inserted,
    cleanupError: cleanupError?.message ?? null,
    results,
  });
}
