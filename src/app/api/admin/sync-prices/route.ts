import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { isAdminAuthorized } from "@/lib/adminAuth";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type YahooChartResponse = {
  chart: {
    result: Array<{
      timestamp: number[];
      indicators: { quote: Array<{ close: (number | null)[] }> };
    }> | null;
    error: { code: string; description: string } | null;
  };
};

// `sinceDays` controls how far back we ask Yahoo for. Full backfills (new
// tickers) go all the way to 2012; daily refreshes of tickers we already
// have only need a small trailing window -- cheap enough to run for every
// ticker on every invocation, which is what actually keeps "latest price"
// current instead of frozen at whatever day the ticker was first synced.
async function fetchTickerPrices(ticker: string, sinceDays: number) {
  // Yahoo's ticker symbols don't always match what's in disclosures
  // (e.g. exchange suffixes). We try the raw ticker as-is; failures are
  // logged and skipped rather than crashing the whole sync.
  const period1 = Math.floor((Date.now() - sinceDays * 24 * 60 * 60 * 1000) / 1000);
  const period2 = Math.floor(Date.now() / 1000);
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
    ticker
  )}?period1=${period1}&period2=${period2}&interval=1d`;

  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; CongressTradesBot/1.0)" },
  });

  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }

  const data = (await res.json()) as YahooChartResponse;
  const result = data.chart.result?.[0];
  if (!result) {
    throw new Error(data.chart.error?.description ?? "No data returned");
  }

  const timestamps = result.timestamp ?? [];
  const closes = result.indicators.quote[0]?.close ?? [];

  const rows: { ticker: string; price_date: string; close_price: number }[] = [];
  for (let i = 0; i < timestamps.length; i++) {
    const close = closes[i];
    if (close === null || close === undefined) continue;
    const date = new Date(timestamps[i] * 1000).toISOString().slice(0, 10);
    rows.push({ ticker, price_date: date, close_price: close });
  }
  return rows;
}

export async function GET(req: NextRequest) {
  if (!isAdminAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();
  const force = req.nextUrl.searchParams.get("force") === "1";
  // Optional comma-separated override to sync specific tickers right away
  // (e.g. ?tickers=SPY) instead of waiting for them to come up in normal
  // batch order -- useful for a newly-added ticker like the S&P 500
  // benchmark that everything else depends on.
  const tickersParam = req.nextUrl.searchParams.get("tickers");

  const { data: stocks, error: stocksError } = await supabase
    .from("stocks")
    .select("ticker");

  if (stocksError) {
    return NextResponse.json({ error: stocksError.message }, { status: 500 });
  }

  const allTickers = (stocks ?? []).map((s) => s.ticker as string);

  const CONCURRENCY = 8;
  const results: Record<string, { rows: number; error?: string }> = {};

  async function syncOne(ticker: string, sinceDays: number) {
    try {
      const rows = await fetchTickerPrices(ticker, sinceDays);
      if (rows.length === 0) {
        results[ticker] = { rows: 0, error: "No price rows returned" };
        return;
      }
      const chunkSize = 500;
      for (let i = 0; i < rows.length; i += chunkSize) {
        const chunk = rows.slice(i, i + chunkSize);
        const { error: upsertError } = await supabase
          .from("stock_prices")
          .upsert(chunk, { onConflict: "ticker,price_date" });
        if (upsertError) throw new Error(upsertError.message);
      }
      results[ticker] = { rows: rows.length };
    } catch (err) {
      results[ticker] = {
        rows: 0,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  async function runBatch(tickers: string[], sinceDays: number) {
    for (let i = 0; i < tickers.length; i += CONCURRENCY) {
      const slice = tickers.slice(i, i + CONCURRENCY);
      await Promise.all(slice.map((t) => syncOne(t, sinceDays)));
    }
  }

  const FULL_HISTORY_DAYS = Math.ceil(
    (Date.now() - new Date("2012-01-01").getTime()) / (24 * 60 * 60 * 1000)
  );
  // A trailing window, not "since last sync", so a run that gets interrupted
  // or a ticker that missed a day still gets caught up on the next run.
  const REFRESH_WINDOW_DAYS = 10;

  if (tickersParam) {
    // Manual targeted resync (e.g. a newly-added benchmark ticker) -- always
    // full history so the ticker is immediately useful everywhere (ROI,
    // range calculations, etc.), regardless of the `force` flag.
    const requested = new Set(tickersParam.split(",").map((t) => t.trim()).filter(Boolean));
    const batch = allTickers.filter((t) => requested.has(t));
    await runBatch(batch, FULL_HISTORY_DAYS);

    const succeeded = Object.values(results).filter((r) => !r.error).length;
    const failed = Object.values(results).filter((r) => r.error).length;
    return NextResponse.json({ mode: "targeted", processed: batch.length, succeeded, failed, results });
  }

  const { data: already } = await supabase.from("stock_prices").select("ticker");
  const doneSet = new Set((already ?? []).map((r) => r.ticker as string));
  const newTickers = allTickers.filter((t) => !doneSet.has(t));
  const existingTickers = force ? allTickers : allTickers.filter((t) => doneSet.has(t));

  // New tickers need the full (heavier) history fetch, so cap how many we
  // take on per invocation to stay within the function's time budget.
  // Already-synced tickers only need a small trailing window each, which is
  // cheap enough to refresh ALL of them every run -- this is what actually
  // keeps "latest price" from going stale after the first backfill.
  const NEW_TICKER_BATCH_LIMIT = 40;
  const newBatch = newTickers.slice(0, NEW_TICKER_BATCH_LIMIT);

  await runBatch(newBatch, FULL_HISTORY_DAYS);
  await runBatch(existingTickers, force ? FULL_HISTORY_DAYS : REFRESH_WINDOW_DAYS);

  const succeeded = Object.values(results).filter((r) => !r.error).length;
  const failed = Object.values(results).filter((r) => r.error).length;

  return NextResponse.json({
    mode: force ? "force-full-resync" : "daily",
    totalTickers: allTickers.length,
    newTickersRemainingBeforeThisRun: newTickers.length,
    newTickersProcessedThisRun: newBatch.length,
    newTickersStillRemaining: newTickers.length - newBatch.length,
    existingTickersRefreshed: existingTickers.length,
    succeeded,
    failed,
    results,
  });
}
