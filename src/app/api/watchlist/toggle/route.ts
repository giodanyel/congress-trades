import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

// No secret gate here on purpose: this app has no login system anywhere
// (every trade page is already fully public), and a "follow" toggle isn't
// sensitive data -- requiring a secret to click a star button would defeat
// the point of making the UI easy to use. Writes still go through the
// service-role client since watchlist_items only grants public SELECT via
// RLS, not INSERT/DELETE.
export async function POST(req: NextRequest) {
  let body: { kind?: string; ref_id?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { kind, ref_id } = body;
  if (kind !== "politician" && kind !== "stock") {
    return NextResponse.json({ error: "kind must be 'politician' or 'stock'" }, { status: 400 });
  }
  if (!ref_id || typeof ref_id !== "string") {
    return NextResponse.json({ error: "ref_id is required" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();

  const { data: existing, error: selectError } = await supabase
    .from("watchlist_items")
    .select("kind")
    .eq("kind", kind)
    .eq("ref_id", ref_id)
    .maybeSingle();

  if (selectError) {
    return NextResponse.json({ error: selectError.message }, { status: 500 });
  }

  if (existing) {
    const { error } = await supabase
      .from("watchlist_items")
      .delete()
      .eq("kind", kind)
      .eq("ref_id", ref_id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ following: false });
  } else {
    const { error } = await supabase.from("watchlist_items").insert({ kind, ref_id });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ following: true });
  }
}
