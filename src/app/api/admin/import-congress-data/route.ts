import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import seed from "@/data/congress-trades-seed.json";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Replaces all politicians/stocks/trades with the bundled seed dataset.
// Source: kadoa-org/congress-trading-monitor (MIT licensed), which
// aggregates official STOCK Act disclosures from the House Clerk, Senate
// eFD, and OGE. We only bundle members with at least one trade disclosed
// since 2025-01-01, so only currently active traders are included.
//
// Deleting politicians cascades to trades (and trades cascades to
// trade_returns). Deleting stocks cascades to stock_prices. Price history
// and ROI need to be re-synced after this runs (call sync-prices then
// compute-roi).
export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get("secret");
  if (!process.env.ADMIN_SYNC_SECRET || secret !== process.env.ADMIN_SYNC_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();

  const { error: delPoliticiansError } = await supabase
    .from("politicians")
    .delete()
    .not("id", "is", null);
  if (delPoliticiansError) {
    return NextResponse.json({ error: delPoliticiansError.message }, { status: 500 });
  }

  const { error: delStocksError } = await supabase
    .from("stocks")
    .delete()
    .not("ticker", "is", null);
  if (delStocksError) {
    return NextResponse.json({ error: delStocksError.message }, { status: 500 });
  }

  async function insertChunks(
    table: string,
    rows: Record<string, unknown>[],
    chunkSize = 500
  ) {
    for (let i = 0; i < rows.length; i += chunkSize) {
      const chunk = rows.slice(i, i + chunkSize);
      const { error } = await supabase.from(table).insert(chunk);
      if (error) throw new Error(`${table}: ${error.message}`);
    }
  }

  try {
    await insertChunks(
      "politicians",
      seed.politicians.map((p) => ({
        id: p.id,
        first_name: p.first_name,
        last_name: p.last_name,
        full_name: p.full_name,
        party: p.party,
        state: p.state,
        chamber: p.chamber,
        photo_url: p.photo_url,
        bio: p.office ? `Current office: ${p.office}` : null,
        committees: [],
      }))
    );

    await insertChunks(
      "stocks",
      seed.stocks.map((s) => ({ ticker: s.ticker, company_name: s.company_name }))
    );

    await insertChunks(
      "trades",
      seed.trades.map((t) => ({
        politician_id: t.filer_id,
        ticker: t.ticker,
        trade_type: t.trade_type,
        owner: t.owner,
        transaction_date: t.transaction_date,
        amount_min: t.amount_min,
        amount_max: t.amount_max,
        amount_label: t.amount_label,
        source_url: t.source_url,
      }))
    );
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }

  return NextResponse.json({
    politicians: seed.politicians.length,
    stocks: seed.stocks.length,
    trades: seed.trades.length,
    source: seed.source,
    note: "Price history was cleared too (cascaded from stocks) -- re-run /api/admin/sync-prices then /api/admin/compute-roi.",
  });
}
