import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// Follow lists are now per-account, so this needs to know who's asking.
// Uses the cookie-aware server client (not getSupabaseAdmin) so Row Level
// Security enforces the user_id match itself -- this route can't
// accidentally touch another user's row even if the code here had a bug.
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

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Sign in to follow politicians and tickers." }, { status: 401 });
  }

  const { data: existing, error: selectError } = await supabase
    .from("watchlist_items")
    .select("kind")
    .eq("user_id", user.id)
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
      .eq("user_id", user.id)
      .eq("kind", kind)
      .eq("ref_id", ref_id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ following: false });
  } else {
    const { error } = await supabase
      .from("watchlist_items")
      .insert({ user_id: user.id, kind, ref_id });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ following: true });
  }
}
