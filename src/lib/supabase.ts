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

// A plain .select() without an explicit range silently comes back capped
// (this project's Supabase/PostgREST default is 1000 rows) once a table
// crosses that size -- confirmed on `trades` (3000+ rows, homepage was
// quietly showing a 1000-row subset). Every unfiltered fetch of `trades`
// or `trade_returns` needs to paginate through with .range() to see
// everything, the same fix already applied to the admin/cron routes.
export async function fetchAllRows<T>(
  table: string,
  columns: string,
  // Untyped on purpose: Postgrest's filter-builder generics don't compose
  // cleanly through an arbitrary chain of .eq()/.or()/.order() calls.
  // Runtime behavior and the actual data shape (T) are unaffected.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  modify?: (query: any) => any
): Promise<T[]> {
  const PAGE_SIZE = 1000;
  const all: T[] = [];
  let from = 0;
  for (;;) {
    let query = supabase.from(table).select(columns);
    if (modify) query = modify(query);
    const { data, error } = await query.range(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(error.message);
    const page = (data ?? []) as T[];
    all.push(...page);
    if (page.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  return all;
}

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
  // What the S&P 500 (SPY) did over the same trade-date-to-latest window,
  // and the trade's return minus that benchmark ("alpha"). Gives ROI
  // numbers an actual baseline instead of floating in isolation.
  spy_return_pct: number | null;
  alpha_pct: number | null;
  confidence: ReturnConfidence;
  computed_at: string;
};

export type WatchlistKind = "politician" | "stock";

export type WatchlistItem = {
  kind: WatchlistKind;
  ref_id: string;
  created_at: string;
};
