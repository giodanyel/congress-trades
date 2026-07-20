import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Where Supabase redirects after someone clicks the confirmation link in
// their signup email (or a password-reset link, later). Exchanges the
// one-time code for a real session, then sends them on to their Following
// page since that's the whole point of having an account here.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/following";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=confirmation_failed`);
}
