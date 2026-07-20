import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Cookie-aware Supabase client for Server Components and Route Handlers --
// respects Row Level Security as the currently signed-in user (unlike the
// plain `supabase` client in @/lib/supabase, which has no session, and
// unlike getSupabaseAdmin(), which bypasses RLS entirely). Use this for
// anything that needs to know "who is asking" -- the Following page, the
// watchlist toggle route, etc.
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from a Server Component render, where cookies can't be
            // set -- harmless as long as middleware.ts is refreshing the
            // session on every request, which it is.
          }
        },
      },
    }
  );
}
