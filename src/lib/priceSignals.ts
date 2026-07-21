import { supabase } from "@/lib/supabase";

// Descriptive market context for a ticker -- deliberately NOT a suggested
// buy price. Every field here is just "what the data says right now"
// (latest close, where that sits in the recent trading range, how it
// compares to its own recent average). Never combine these into a single
// "score" or "signal" that reads as a recommendation.
export type PriceSignal = {
  ticker: string;
  latestClose: number;
  latestDate: string;
  high90: number;
  low90: number;
  // 0 = sitting at the 90-day low, 1 = sitting at the 90-day high.
  rangePosition: number;
  pctFromHigh90: number; // <= 0
  pctFromLow90: number; // >= 0
  sma30: number | null;
  vsSma30Pct: number | null;
};

const WINDOW_DAYS = 100; // a little over 90 calendar days of padding for weekends/holidays

export async function getPriceSignals(tickers: string[]): Promise<Map<string, PriceSignal>> {
  const result = new Map<string, PriceSignal>();
  const unique = [...new Set(tickers)];
  if (unique.length === 0) return result;

  const cutoff = new Date(Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

  const { data, error } = await supabase
    .from("stock_prices")
    .select("ticker, price_date, close_price")
    .in("ticker", unique)
    .gte("price_date", cutoff)
    .order("price_date", { ascending: true });

  if (error || !data) return result;

  const byTicker = new Map<string, { price_date: string; close_price: number }[]>();
  for (const row of data as { ticker: string; price_date: string; close_price: number }[]) {
    const arr = byTicker.get(row.ticker) ?? [];
    arr.push({ price_date: row.price_date, close_price: row.close_price });
    byTicker.set(row.ticker, arr);
  }

  for (const [ticker, rows] of byTicker) {
    if (rows.length === 0) continue;
    const closes = rows.map((r) => r.close_price);
    const latest = rows[rows.length - 1];
    const high90 = Math.max(...closes);
    const low90 = Math.min(...closes);
    const range = high90 - low90;
    const rangePosition = range > 0 ? (latest.close_price - low90) / range : 0.5;
    const last30 = rows.slice(-30);
    const sma30 =
      last30.length >= 10
        ? last30.reduce((s, r) => s + r.close_price, 0) / last30.length
        : null;

    result.set(ticker, {
      ticker,
      latestClose: latest.close_price,
      latestDate: latest.price_date,
      high90,
      low90,
      rangePosition,
      pctFromHigh90: high90 > 0 ? (latest.close_price - high90) / high90 : 0,
      pctFromLow90: low90 > 0 ? (latest.close_price - low90) / low90 : 0,
      sma30,
      vsSma30Pct: sma30 ? (latest.close_price - sma30) / sma30 : null,
    });
  }

  return result;
}
