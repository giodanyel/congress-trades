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
