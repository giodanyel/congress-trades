import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { isAdminAuthorized } from "@/lib/adminAuth";

export const dynamic = "force-dynamic";

// One-off diagnostic to confirm migration 012_user_accounts.sql actually
// applied cleanly (the Supabase SQL editor showed a warning when GM ran
// it, unclear if it was benign). Read-only -- just checks that the new
// columns exist and reports row counts, doesn't touch any data.
export async function GET(req: NextRequest) {
  if (!isAdminAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();

  const [watchlistCheck, alertsCheck] = await Promise.all([
    supabase.from("watchlist_items").select("user_id, kind, ref_id", { count: "exact", head: false }).limit(1),
    supabase.from("trade_alerts_sent").select("user_id, trade_id", { count: "exact", head: false }).limit(1),
  ]);

  return NextResponse.json({
    watchlist_items: {
      hasUserIdColumn: !watchlistCheck.error,
      error: watchlistCheck.error?.message ?? null,
      rowCount: watchlistCheck.count,
    },
    trade_alerts_sent: {
      hasUserIdColumn: !alertsCheck.error,
      error: alertsCheck.error?.message ?? null,
      rowCount: alertsCheck.count,
    },
  });
}
