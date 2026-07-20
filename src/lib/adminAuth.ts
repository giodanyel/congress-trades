import type { NextRequest } from "next/server";

// Two ways in: a manual ?secret= query param (what I use to trigger routes
// by hand for testing), or the Authorization header Vercel Cron sends
// automatically when a CRON_SECRET env var is configured. Both check
// against server-only env vars, never exposed to the browser.
export function isAdminAuthorized(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get("secret");
  if (secret && process.env.ADMIN_SYNC_SECRET && secret === process.env.ADMIN_SYNC_SECRET) {
    return true;
  }
  const auth = req.headers.get("authorization");
  if (auth && process.env.CRON_SECRET && auth === `Bearer ${process.env.CRON_SECRET}`) {
    return true;
  }
  return false;
}
