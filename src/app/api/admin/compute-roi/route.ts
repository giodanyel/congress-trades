import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { isAdminAuthorized } from "@/lib/adminAuth";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Confidence reflects how close the matched price is to the actual trade
// date, and how fresh the "latest" reference price is. This is always
// shown alongside any ROI number in the UI -- never presented as exact.
function classifyConfidence(daysOffTrade: number, daysOffLatest: number) {
  if (daysOffTrade <= 3 && daysOffLatest <= 14) return "HIGH";
  if (daysOffTrade <= 10 && daysOffLatest <= 30) return "MEDIUM";
  return "LOW";
}

// A plain select() without an explicit range can silently come back
// short on large tables depending on the client/project's default page
// size. Paginating explicitly guarantees we see every row.
async function fetchAllRows<T>(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  table: string,
  columns: string
): Promise<T[]> {
  const PAGE_SIZE = 1000;
  const all: T[] = [];
  let from = 0;
  for (;;) {
    const { data, error } = await supabase
      .from(table)
      .select(columns)
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(error.message);
    const page = (data ?? []) as T[];
    all.push(...page);
    if (page.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  return all;
}

async function nearestPriceOnOrBefore(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  ticker: string,
  date: string
) {
  const { data, error } = await supabase
    .from("stock_prices")
    .select("price_date, close_price")
    .eq("ticker", ticker)
    .lte("price_date", date)
    .order("price_date", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

async function latestPrice(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  ticker: string
) {
  const { data, error } = await supabase
    .from("stock_prices")
    .select("price_date, close_price")
    .eq("ticker", ticker)
    .order("price_date", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

function daysBetween(a: string, b: string) {
  return Math.abs(
    (new Date(a).getTime() - new Date(b).getTime()) / (1000 * 60 * 60 * 24)
  );
}

type TradeRow = {
  id: string;
  ticker: string;
  trade_type: string;
  transaction_date: string;
  filing_date: string | null;
};

type ExistingReturnRow = {
  trade_id: string;
  confidence: string;
  pre_disclosure_move_pct: number | null;
};

export async function GET(req: NextRequest) {
  if (!isAdminAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();

  let trades: TradeRow[];
  let existingReturns: ExistingReturnRow[];
  try {
    [trades, existingReturns] = await Promise.all([
      fetchAllRows<TradeRow>(supabase, "trades", "id, ticker, trade_type, transaction_date, filing_date"),
      fetchAllRows<ExistingReturnRow>(supabase, "trade_returns", "trade_id, confidence, pre_disclosure_move_pct"),
    ]);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }

  const existingByTradeId = new Map(existingReturns.map((r) => [r.trade_id, r]));

  // Skip trades that already have a solid result and nothing new to add.
  // Retry ones marked UNAVAILABLE (price data may have shown up since) and
  // ones missing pre_disclosure_move_pct despite having a filing_date
  // (added after the first computation pass, worth backfilling once).
  const needsCompute = trades
    .filter((t) => {
      const existing = existingByTradeId.get(t.id);
      if (!existing) return true;
      if (existing.confidence === "UNAVAILABLE") return true;
      if (t.filing_date && existing.pre_disclosure_move_pct === null) return true;
      return false;
    })
    // Most recent trades first -- these are the ones feeding "Interesting
    // Buys" and the alert digest, so with a batch-limited run they should
    // never be stuck behind a backlog of old, already-stale trades.
    .sort((a, b) => b.transaction_date.localeCompare(a.transaction_date));

  const BATCH_LIMIT = 500;
  const CONCURRENCY = 15;
  const batch = needsCompute.slice(0, BATCH_LIMIT);

  const latestCache = new Map<string, { price_date: string; close_price: number } | null>();
  const today = new Date().toISOString().slice(0, 10);

  const results: Record<string, string> = {};
  let computed = 0;
  let unavailable = 0;

  async function processOne(trade: TradeRow) {
    try {
      if (trade.trade_type === "EXCHANGE") {
        await supabase.from("trade_returns").upsert({
          trade_id: trade.id,
          confidence: "UNAVAILABLE",
        });
        results[trade.id] = "skipped (exchange)";
        unavailable++;
        return;
      }

      const tradePrice = await nearestPriceOnOrBefore(supabase, trade.ticker, trade.transaction_date);

      if (!latestCache.has(trade.ticker)) {
        latestCache.set(trade.ticker, await latestPrice(supabase, trade.ticker));
      }
      const latest = latestCache.get(trade.ticker);

      if (!tradePrice || !latest) {
        await supabase.from("trade_returns").upsert({
          trade_id: trade.id,
          confidence: "UNAVAILABLE",
        });
        results[trade.id] = "no price data";
        unavailable++;
        return;
      }

      const daysOffTrade = daysBetween(tradePrice.price_date, trade.transaction_date);
      const daysOffLatest = daysBetween(latest.price_date, today);
      const confidence = classifyConfidence(daysOffTrade, daysOffLatest);

      const returnPct =
        trade.trade_type === "PURCHASE"
          ? (latest.close_price - tradePrice.close_price) / tradePrice.close_price
          : (tradePrice.close_price - latest.close_price) / tradePrice.close_price;

      // How much the price had already moved between the trade and the
      // day it was actually disclosed -- a concrete, factual measure of
      // how stale the "signal" was the moment anyone outside the trader
      // could see it. Only computable when we have a filing date and a
      // price on or before it.
      let priceAtFiling: { price_date: string; close_price: number } | null = null;
      let preDisclosureMovePct: number | null = null;
      if (trade.filing_date) {
        priceAtFiling = await nearestPriceOnOrBefore(supabase, trade.ticker, trade.filing_date);
        if (priceAtFiling) {
          preDisclosureMovePct = (priceAtFiling.close_price - tradePrice.close_price) / tradePrice.close_price;
        }
      }

      await supabase.from("trade_returns").upsert({
        trade_id: trade.id,
        price_at_trade: tradePrice.close_price,
        price_at_trade_date: tradePrice.price_date,
        price_latest: latest.close_price,
        price_latest_date: latest.price_date,
        price_at_filing: priceAtFiling?.close_price ?? null,
        price_at_filing_date: priceAtFiling?.price_date ?? null,
        pre_disclosure_move_pct: preDisclosureMovePct,
        return_pct: returnPct,
        confidence,
      });
      results[trade.id] = `ok (${confidence})`;
      computed++;
    } catch (err) {
      results[trade.id] = err instanceof Error ? err.message : String(err);
      unavailable++;
    }
  }

  for (let i = 0; i < batch.length; i += CONCURRENCY) {
    const slice = batch.slice(i, i + CONCURRENCY);
    await Promise.all(slice.map(processOne));
  }

  return NextResponse.json({
    totalTrades: trades.length,
    needingCompute: needsCompute.length,
    processedThisRun: batch.length,
    stillRemaining: needsCompute.length - batch.length,
    computed,
    unavailable,
    resultsSample: Object.fromEntries(Object.entries(results).slice(0, 30)),
  });
}
