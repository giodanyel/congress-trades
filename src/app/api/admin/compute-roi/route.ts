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

export async function GET(req: NextRequest) {
  if (!isAdminAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();

  const { data: trades, error: tradesError } = await supabase
    .from("trades")
    .select("id, ticker, trade_type, transaction_date, filing_date");

  if (tradesError) {
    return NextResponse.json({ error: tradesError.message }, { status: 500 });
  }

  const latestCache = new Map<string, { price_date: string; close_price: number } | null>();
  const today = new Date().toISOString().slice(0, 10);

  const results: Record<string, string> = {};
  let computed = 0;
  let unavailable = 0;

  await Promise.all(
    (trades ?? []).map(async (trade) => {
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

        const tradePrice = await nearestPriceOnOrBefore(
          supabase,
          trade.ticker,
          trade.transaction_date
        );

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
            preDisclosureMovePct =
              (priceAtFiling.close_price - tradePrice.close_price) / tradePrice.close_price;
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
    })
  );

  return NextResponse.json({
    totalTrades: trades?.length ?? 0,
    computed,
    unavailable,
    results,
  });
}
