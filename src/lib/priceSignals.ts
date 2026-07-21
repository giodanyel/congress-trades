import { supabase } from "@/lib/supabase";

// Descriptive market context for a ticker -- deliberately NOT a suggested
// buy price. Every field here is just "what the data says right now"
// (current price, where that sits in the recent trading range, how it's
// moved over a few common windows). Never combine these into a single
// "score" or "signal" that reads as a recommendation.
export type PriceSignal = {
  ticker: string;
  price: number;
  asOf: string; // ISO date or datetime string, whichever we actually have
  isLive: boolean; // true if `price` came from a live intraday quote, not just the last stored close
  high90: number;
  low90: number;
  // 0 = sitting at the 90-day low, 1 = sitting at the 90-day high.
  rangePosition: number;
  pctFromHigh90: number; // <= 0
  pctFromLow90: number; // >= 0
  sma30: number | null;
  vsSma30Pct: number | null;
  dayChangePct: number | null;
  weekChangePct: number | null;
  monthChangePct: number | null;
  threeMonthChangePct: number | null;
};

const WINDOW_DAYS = 130; // 90-day range + a few weeks of padding for the 3-month change lookup

type PriceRow = { price_date: string; close_price: number };

// Best available close on or before a target date -- rows are sorted
// ascending, so this walks backward from the end.
function closeOnOrBefore(rows: PriceRow[], targetDate: string): number | null {
  for (let i = rows.length - 1; i >= 0; i--) {
    if (rows[i].price_date <= targetDate) return rows[i].close_price;
  }
  return null;
}

function daysAgo(n: number) {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function pctChange(current: number, past: number | null): number | null {
  if (past === null || past === 0) return null;
  return (current - past) / past;
}

type YahooChartMeta = {
  regularMarketPrice?: number;
  regularMarketTime?: number;
  marketState?: string;
};

type YahooChartResponse = {
  chart: {
    result: Array<{ meta: YahooChartMeta }> | null;
    error: { code: string; description: string } | null;
  };
};

// A best-effort live quote straight from Yahoo's chart endpoint (the same
// one the price-sync cron uses for daily closes). This runs at page-request
// time for a small, bounded set of tickers, so it stays cheap. If Yahoo is
// unreachable or rate-limits us, callers fall back to the last stored daily
// close -- the page should never break because a live quote failed.
async function fetchLiveQuote(ticker: string): Promise<{ price: number; asOf: string; isLive: boolean } | null> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?range=1d&interval=5m`;
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; CongressTradesBot/1.0)" },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = (await res.json()) as YahooChartResponse;
    const meta = data.chart.result?.[0]?.meta;
    if (!meta || typeof meta.regularMarketPrice !== "number") return null;
    return {
      price: meta.regularMarketPrice,
      asOf: meta.regularMarketTime
        ? new Date(meta.regularMarketTime * 1000).toISOString()
        : new Date().toISOString(),
      isLive: meta.marketState === "REGULAR",
    };
  } catch {
    return null;
  }
}

export async function getPriceSignals(tickers: string[]): Promise<Map<string, PriceSignal>> {
  const result = new Map<string, PriceSignal>();
  const unique = [...new Set(tickers)];
  if (unique.length === 0) return result;

  const cutoff = daysAgo(WINDOW_DAYS);

  const [{ data, error }, liveQuotes] = await Promise.all([
    supabase
      .from("stock_prices")
      .select("ticker, price_date, close_price")
      .in("ticker", unique)
      .gte("price_date", cutoff)
      .order("price_date", { ascending: true }),
    Promise.all(unique.map(async (t) => [t, await fetchLiveQuote(t)] as const)),
  ]);

  const liveByTicker = new Map(liveQuotes);

  if (error || !data) return result;

  const byTicker = new Map<string, PriceRow[]>();
  for (const row of data as { ticker: string; price_date: string; close_price: number }[]) {
    const arr = byTicker.get(row.ticker) ?? [];
    arr.push({ price_date: row.price_date, close_price: row.close_price });
    byTicker.set(row.ticker, arr);
  }

  const day1 = daysAgo(1);
  const day7 = daysAgo(7);
  const day30 = daysAgo(30);
  const day90 = daysAgo(90);

  for (const [ticker, rows] of byTicker) {
    if (rows.length === 0) continue;
    const latestRow = rows[rows.length - 1];
    const live = liveByTicker.get(ticker) ?? null;
    const price = live?.price ?? latestRow.close_price;
    const asOf = live?.asOf ?? latestRow.price_date;
    const isLive = live?.isLive ?? false;

    const range90Rows = rows.filter((r) => r.price_date >= daysAgo(90));
    const rangeRows = range90Rows.length > 0 ? range90Rows : rows;
    const closes = rangeRows.map((r) => r.close_price);
    const high90 = Math.max(price, ...closes);
    const low90 = Math.min(price, ...closes);
    const range = high90 - low90;
    const rangePosition = range > 0 ? (price - low90) / range : 0.5;

    const last30 = rows.slice(-30);
    const sma30 =
      last30.length >= 10
        ? last30.reduce((s, r) => s + r.close_price, 0) / last30.length
        : null;

    // "Yesterday's" close for the day change: the most recent row strictly
    // before today, so a same-day re-sync doesn't compare a price to itself.
    const priorRows = rows.slice(0, -1);
    const prevClose = priorRows.length > 0 ? priorRows[priorRows.length - 1].close_price : null;

    result.set(ticker, {
      ticker,
      price,
      asOf,
      isLive,
      high90,
      low90,
      rangePosition,
      pctFromHigh90: high90 > 0 ? (price - high90) / high90 : 0,
      pctFromLow90: low90 > 0 ? (price - low90) / low90 : 0,
      sma30,
      vsSma30Pct: sma30 ? (price - sma30) / sma30 : null,
      dayChangePct: pctChange(price, prevClose ?? closeOnOrBefore(rows, day1)),
      weekChangePct: pctChange(price, closeOnOrBefore(rows, day7)),
      monthChangePct: pctChange(price, closeOnOrBefore(rows, day30)),
      threeMonthChangePct: pctChange(price, closeOnOrBefore(rows, day90)),
    });
  }

  return result;
}
