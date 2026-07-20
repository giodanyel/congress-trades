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

  const { data: stocks, error: stocksError } = await supabase
    .from("stocks")
    .select("ticker");

  if (stocksError) {
    return NextResponse.json({ error: stocksError.message }, { status: 500 });
  }

  const results: Record<string, { rows: number; error?: string }> = {};

  for (const stock of stocks ?? []) {
    const ticker = stock.ticker as string;
    try {
      const rows = await fetchTickerPrices(ticker);
      if (rows.length === 0) {
        results[ticker] = { rows: 0, error: "No price rows returned" };
        continue;
      }
      // Upsert in chunks to stay well under request size limits.
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

  const succeeded = Object.values(results).filter((r) => !r.error).length;
  const failed = Object.values(results).filter((r) => r.error).length;

  return NextResponse.json({
    tickersProcessed: stocks?.length ?? 0,
    succeeded,
    failed,
    results,
  });
}
