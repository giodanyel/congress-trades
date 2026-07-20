import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

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

async function fetchTickerPrices(ticker: string) {
  // Yahoo's ticker symbols don't always match what's in disclosures
  // (e.g. exchange suffixes). We try the raw ticker as-is; failures are
  // logged and skipped rather than crashing the whole sync.
  const period1 = Math.floor(new Date("2012-01-01").getTime() / 1000);
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
  const secret = req.nextUrl.searchParams.get("secret");
  if (!process.env.ADMIN_SYNC_SECRET || secret !== process.env.ADMIN_SYNC_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();
  const force = req.nextUrl.searchParams.get("force") === "1";

  const { data: stocks, error: stocksError } = await supabase
    .from("stocks")
    .select("ticker");

  if (stocksError) {
    return NextResponse.json({ error: stocksError.message }, { status: 500 });
  }

  let tickersToSync = (stocks ?? []).map((s) => s.ticker as string);

  if (!force) {
    // Skip tickers we already have at least one price row for, so repeated
    // calls make forward progress instead of redoing completed work. This
    // matters because we can only fetch a limited number of tickers per
    // invocation before the serverless function's time limit.
    const { data: already } = await supabase.from("stock_prices").select("ticker");
    const doneSet = new Set((already ?? []).map((r) => r.ticker as string));
    tickersToSync = tickersToSync.filter((t) => !doneSet.has(t));
  }

  // Cap per-invocation work and run with limited concurrency so we make
  // steady progress within the function's time budget across repeated calls.
  const BATCH_LIMIT = 60;
  const CONCURRENCY = 8;
  const batch = tickersToSync.slice(0, BATCH_LIMIT);

  const results: Record<string, { rows: number; error?: string }> = {};

  async function syncOne(ticker: string) {
    try {
      const rows = await fetchTickerPrices(ticker);
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

  for (let i = 0; i < batch.length; i += CONCURRENCY) {
    const slice = batch.slice(i, i + CONCURRENCY);
    await Promise.all(slice.map(syncOne));
  }

  const succeeded = Object.values(results).filter((r) => !r.error).length;
  const failed = Object.values(results).filter((r) => r.error).length;

  return NextResponse.json({
    totalTickers: stocks?.length ?? 0,
    remainingBeforeThisRun: tickersToSync.length,
    processedThisRun: batch.length,
    stillRemaining: tickersToSync.length - batch.length,
    succeeded,
    failed,
    results,
  });
}
