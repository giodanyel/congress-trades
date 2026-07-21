import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// The app is account-gated: everything except the homepage (which shows a
// limited, older-data preview to logged-out visitors) and the auth flow
// itself requires a signed-in user. Admin/cron routes are deliberately NOT
// gated here -- they authenticate via a header secret (see adminAuth.ts),
// not a browser session, and would otherwise get redirected to /signup
// instead of running.
function isPublicPath(pathname: string) {
  if (pathname === "/") return true;
  if (pathname === "/login" || pathname === "/signup") return true;
  if (pathname.startsWith("/auth/")) return true;
  if (pathname.startsWith("/api/")) return true;
  return false;
}

// Refreshes the Supabase auth session cookie on every request. Without
// this, a signed-in user's session silently expires and Server Components
// start seeing them as logged out mid-visit -- this is what actually keeps
// people logged in, not the login page itself. Also enforces the account
// gate described above.
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Do not remove -- this call is what actually refreshes the token.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  if (!user && !isPublicPath(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/signup";
    url.search = "";
    url.searchParams.set("next", pathname);
    const redirectResponse = NextResponse.redirect(url);
    // Carry over any cookies Supabase just set/refreshed above so we don't
    // lose them on the redirect.
    for (const cookie of supabaseResponse.cookies.getAll()) {
      redirectResponse.cookies.set(cookie.name, cookie.value);
    }
    return redirectResponse;
  }

  return supabaseResponse;
}
