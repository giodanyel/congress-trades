import { estimatedTradeValue, type Trade, type TradeReturn } from "@/lib/supabase";

export type PoliticianAgg = {
  weightedReturnSum: number;
  weightedValue: number;
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

    byPolitician.set(t.politician_id, agg);
  }

  return byPolitician;
}

export function roiOf(agg: PoliticianAgg): number {
  return agg.weightedValue > 0 ? agg.weightedReturnSum / agg.weightedValue : 0;
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
