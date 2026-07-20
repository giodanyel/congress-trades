import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { isAdminAuthorized } from "@/lib/adminAuth";
import { committeesFor } from "@/lib/committees";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// One-time (re-runnable) backfill: politicians.committees was always
// inserted as an empty array at import time -- this route fills it in from
// the bundled unitedstates/congress-legislators committee-membership
// dataset, keyed by bioguide id (which is what politicians.id already is).
export async function GET(req: NextRequest) {
  if (!isAdminAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();

  const { data: politicians, error } = await supabase
    .from("politicians")
    .select("id, committees");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let updated = 0;
  let noData = 0;
  const errors: string[] = [];

  for (const p of politicians ?? []) {
    const committees = committeesFor(p.id as string);
    if (committees.length === 0) {
      noData++;
      continue;
    }
    const { error: updateError } = await supabase
      .from("politicians")
      .update({ committees })
      .eq("id", p.id);
    if (updateError) {
      errors.push(`${p.id}: ${updateError.message}`);
    } else {
      updated++;
    }
  }

  return NextResponse.json({
    totalPoliticians: politicians?.length ?? 0,
    updated,
    noCommitteeData: noData,
    errors: errors.length > 0 ? errors.slice(0, 5) : undefined,
  });
}
