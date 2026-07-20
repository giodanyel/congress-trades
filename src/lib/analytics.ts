import { estimatedTradeValue, type Trade, type TradeReturn } from "@/lib/supabase";

export type PoliticianAgg = {
  weightedReturnSum: number;
  weightedValue: number;
  // Same value-weighting as weightedReturnSum, but for (return - S&P 500
  // return over the same window) on each trade -- lets alphaOf() report
  // "average outperformance vs. just holding the market" consistently.
  weightedAlphaSum: number;
  weightedAlphaValue: number;
  pricedTrades: number;
  totalTrades: number;
  estimatedGainLoss: number;
  lastTradeDate: string;
};

// Shared by the homepage, ROI leaderboard, and Interesting Buys so "ROI" and
// "last trade date" always mean the same thing everywhere in the app.
export function aggregateByPolitician(
  trades: Trade[],
  returnByTradeId: Map<string, TradeReturn>
): Map<string, PoliticianAgg> {
  const byPolitician = new Map<string, PoliticianAgg>();

  for (const t of trades) {
    const agg = byPolitician.get(t.politician_id) ?? {
      weightedReturnSum: 0,
      weightedValue: 0,
      weightedAlphaSum: 0,
      weightedAlphaValue: 0,
      pricedTrades: 0,
      totalTrades: 0,
      estimatedGainLoss: 0,
      lastTradeDate: t.transaction_date,
    };
    agg.totalTrades += 1;
    if (t.transaction_date > agg.lastTradeDate) agg.lastTradeDate = t.transaction_date;

    const r = returnByTradeId.get(t.id);
    const value = estimatedTradeValue(t) ?? 0;
    if (r && r.return_pct !== null && r.confidence !== "UNAVAILABLE") {
      agg.weightedReturnSum += r.return_pct * value;
      agg.weightedValue += value;
      agg.pricedTrades += 1;
      agg.estimatedGainLoss += r.return_pct * value;
    }
    if (r && r.alpha_pct !== null && r.confidence !== "UNAVAILABLE") {
      agg.weightedAlphaSum += r.alpha_pct * value;
      agg.weightedAlphaValue += value;
    }

    byPolitician.set(t.politician_id, agg);
  }

  return byPolitician;
}

export function roiOf(agg: PoliticianAgg): number {
  return agg.weightedValue > 0 ? agg.weightedReturnSum / agg.weightedValue : 0;
}

// Average outperformance vs. simply holding the S&P 500 over the same
// windows, value-weighted the same way as roiOf(). Null when no trade has
// alpha data yet (still backfilling, or all trades are on the benchmark
// itself).
export function alphaOf(agg: PoliticianAgg): number | null {
  return agg.weightedAlphaValue > 0 ? agg.weightedAlphaSum / agg.weightedAlphaValue : null;
}

export const ACTIVE_WINDOW_DAYS = 120;

export function isActive(agg: PoliticianAgg, now = Date.now()) {
  const cutoff = now - ACTIVE_WINDOW_DAYS * 24 * 60 * 60 * 1000;
  return new Date(agg.lastTradeDate).getTime() >= cutoff;
}

// Rough size tiers matching STOCK Act disclosure bands, used to flag
// "large" trades in the Interesting Buys view.
export function sizeTier(amountMax: number | null): { label: string; weight: number } | null {
  if (amountMax === null) return null;
  if (amountMax >= 1_000_000) return { label: "$1M+ trade", weight: 4 };
  if (amountMax >= 250_000) return { label: "$250K+ trade", weight: 3 };
  if (amountMax >= 100_000) return { label: "$100K+ trade", weight: 2 };
  if (amountMax >= 50_000) return { label: "$50K+ trade", weight: 1 };
  return null;
}
