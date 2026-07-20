import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY environment variables."
  );
}

// Server-side client using the public anon key. Reads are allowed by the
// "Public read access" row-level security policy; writes are blocked until
// we introduce a service-role key for admin/ingestion use in a later phase.
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type Party = "DEMOCRAT" | "REPUBLICAN" | "INDEPENDENT";
export type Chamber = "SENATE" | "HOUSE";

export type Politician = {
  id: string;
  first_name: string;
  last_name: string;
  full_name: string;
  party: Party;
  state: string;
  chamber: Chamber;
  photo_url: string | null;
  bio: string | null;
  net_worth_usd: number | null;
  committees: string[];
  created_at: string;
  updated_at: string;
};

export type TradeType = "PURCHASE" | "SALE" | "EXCHANGE";
export type OwnerType = "SELF" | "SPOUSE" | "JOINT" | "CHILD";

export type Stock = {
  ticker: string;
  company_name: string;
  created_at: string;
};

export type Trade = {
  id: string;
  politician_id: string;
  ticker: string;
  trade_type: TradeType;
  owner: OwnerType;
  transaction_date: string;
  filing_date: string | null;
  amount_min: number | null;
  amount_max: number | null;
  amount_label: string | null;
  source_url: string | null;
  created_at: string;
};

// Every dollar figure derived from trades is an ESTIMATE: the STOCK Act only
// requires disclosure of a value RANGE (e.g. "$1,001 - $15,000"), never an
// exact amount. We use the midpoint of that range as our best estimate.
// This must always be labeled as an estimate in the UI, never shown as fact.
export function estimatedTradeValue(t: Pick<Trade, "amount_min" | "amount_max">) {
  if (t.amount_min === null || t.amount_max === null) return null;
  return (t.amount_min + t.amount_max) / 2;
}

export type ReturnConfidence = "HIGH" | "MEDIUM" | "LOW" | "UNAVAILABLE";

export type TradeReturn = {
  trade_id: string;
  price_at_trade: number | null;
  price_at_trade_date: string | null;
  price_latest: number | null;
  price_latest_date: string | null;
  price_at_filing: number | null;
  price_at_filing_date: string | null;
  // How much the price had already moved between the trade and the day it
  // became public -- a concrete measure of how stale the disclosure was,
  // not a recommendation either way.
  pre_disclosure_move_pct: number | null;
  return_pct: number | null;
  confidence: ReturnConfidence;
  computed_at: string;
};
