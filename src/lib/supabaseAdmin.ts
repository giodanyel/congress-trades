import { createClient } from "@supabase/supabase-js";

// SERVER-ONLY. Uses the Supabase secret key, which bypasses row-level
// security entirely. Never import this file from a Client Component, and
// never expose SUPABASE_SECRET_KEY with a NEXT_PUBLIC_ prefix.
// This file must only be imported from route handlers (src/app/api/**).

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secretKey = process.env.SUPABASE_SECRET_KEY;

export function getSupabaseAdmin() {
  if (!supabaseUrl || !secretKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY environment variables."
    );
  }
  return createClient(supabaseUrl, secretKey, {
    auth: { persistSession: false },
  });
}
