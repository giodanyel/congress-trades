"use client";

import { createBrowserClient } from "@supabase/ssr";

// Browser-side Supabase client for Client Components (login/signup forms,
// the logout button). Shares the same cookie-based session as the server
// client in @/lib/supabase/server.
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
