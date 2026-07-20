import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { isAdminAuthorized } from "@/lib/adminAuth";
import type { Politician, TradeType, OwnerType } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// kadoa-org/congress-trading-monitor publishes a "Daily refresh" of this
// file (confirmed via its commit history), so once a day is genuinely as
// fresh as this data source ever gets -- there's no benefit to polling
// more often, even on a paid Vercel plan with finer cron granularity.
const TRADES_URL =
  "https://raw.githubusercontent.com/kadoa-org/congress-trading-monitor/main/public/data/trades.json";

type KadoaTrade = {
  id: string;
  source_id: string | null;
  transaction_date: string;
  filing_date: string | null;
  owner: string | null;
  ticker: string | null;
  asset_name: string | null;
  asset_type: string | null;
  transaction_type: string | null;
  amount_range_low: number | null;
  amount_range_high: number | null;
  amount_range_label: string | null;
  filer_name: string | null;
  branch: string | null;
  chamber: string | null;
  state: string | null;
  doc_url: string | null;
};

type ExistingTradeRow = {
  id: string;
  politician_id: string;
  ticker: string;
  transaction_date: string;
  trade_type: string;
  owner: string;
  amount_label: string | null;
  external_id: string | null;
};

function normalizeName(s: string) {
  return s
    .toLowerCase()
    .replace(/[.,]/g, "")
    .replace(/\s+(jr|sr|ii|iii|iv)\.?$/i, "")
    .trim();
}

function mapTradeType(raw: string | null): TradeType | null {
  if (!raw) return null;
  if (raw === "Purchase") return "PURCHASE";
  if (raw.startsWith("Sale")) return "SALE";
  if (raw === "Exchange") return "EXCHANGE";
  return null;
}

function mapOwner(raw: string | null): OwnerType {
  if (!raw) return "SELF";
  const v = raw.toLowerCase();
  if (v === "self") return "SELF";
  if (v === "sp" || v === "spouse") return "SPOUSE";
  if (v === "jt" || v === "joint") return "JOINT";
  if (v === "dc" || v === "child") return "CHILD";
  return "SELF";
}

function matchPolitician(
  trade: KadoaTrade,
  byStateChamber: Map<string, Politician[]>
): Politician | null {
  if (!trade.state || !trade.chamber || !trade.filer_name) return null;
  const pool = byStateChamber.get(`${trade.state}|${trade.chamber.toUpperCase()}`);
  if (!pool || pool.length === 0) return null;

  const normFiler = normalizeName(trade.filer_name);
  // Try the full (possibly compound) last name first.
  for (const p of pool) {
    if (normFiler.includes(normalizeName(p.last_name))) return p;
  }
  // Fall back to just the final token, in case the filer name dropped part
  // of a compound surname.
  for (const p of pool) {
    const lastToken = p.last_name.trim().split(/\s+/).slice(-1)[0];
    if (normFiler.includes(normalizeName(lastToken))) return p;
  }
  return null;
}

// Trades from the original bundled seed have no external_id, so a trade
// already in the DB has to be recognized by its real-world identity
// (who, what, when, what kind, how much) -- not just the source's row id.
function naturalKey(
  politicianId: string,
  ticker: string,
  transactionDate: string,
  tradeType: string,
  owner: string,
  amountLabel: string | null
) {
  return `${politicianId}|${ticker}|${transactionDate}|${tradeType}|${owner}|${amountLabel ?? ""}`;
}

export async function GET(req: NextRequest) {
  if (!isAdminAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();

  // One-time cleanup switch: the first version of this route matched
  // purely on external_id and didn't know about the un-tagged seed trades,
  // so it inserted duplicates of everything already in the 2025-2026
  // window. ?reset=1 removes that bad batch (identifiable because they're
  // the only rows with external_id set) before re-running with correct
  // natural-key dedup.
  if (req.nextUrl.searchParams.get("reset") === "1") {
    const { error } = await supabase.from("trades").delete().not("external_id", "is", null);
    if (error) {
      return NextResponse.json({ error: `Reset failed: ${error.message}` }, { status: 500 });
    }
  }

  const [{ data: politicians }, { data: existingTrades }, { data: existingStockRows }, sourceRes] =
    await Promise.all([
      supabase.from("politicians").select("*").returns<Politician[]>(),
      supabase
        .from("trades")
        .select("id, politician_id, ticker, transaction_date, trade_type, owner, amount_label, external_id")
        .returns<ExistingTradeRow[]>(),
      supabase.from("stocks").select("ticker"),
      fetch(TRADES_URL, { headers: { "User-Agent": "Mozilla/5.0 (compatible; CongressTradesBot/1.0)" } }),
    ]);

  if (!sourceRes.ok) {
    return NextResponse.json(
      { error: `Failed to fetch source data: HTTP ${sourceRes.status}` },
      { status: 502 }
    );
  }

  const sourceTrades = (await sourceRes.json()) as KadoaTrade[];

  const byStateChamber = new Map<string, Politician[]>();
  for (const p of politicians ?? []) {
    const key = `${p.state}|${p.chamber}`;
    const arr = byStateChamber.get(key) ?? [];
    arr.push(p);
    byStateChamber.set(key, arr);
  }

  const knownExternalIds = new Set<string>();
  // For rows that don't have an external_id yet (the original seed), map
  // their natural key to their row id so a matching source record can
  // backfill the external_id instead of being inserted as a duplicate.
  const naturalKeyToId = new Map<string, string>();
  for (const t of existingTrades ?? []) {
    if (t.external_id) {
      knownExternalIds.add(t.external_id);
    } else {
      naturalKeyToId.set(
        naturalKey(t.politician_id, t.ticker, t.transaction_date, t.trade_type, t.owner, t.amount_label),
        t.id
      );
    }
  }

  const knownTickers = new Set((existingStockRows ?? []).map((r) => r.ticker as string));
  const congressTrades = sourceTrades.filter((t) => t.branch === "congress");

  let skippedAlreadyKnown = 0;
  let skippedUnmatchedPolitician = 0;
  let skippedNoTicker = 0;
  let skippedUnmappedType = 0;
  let backfilled = 0;

  const newStocks = new Map<string, string>();
  const newTradeRows: Record<string, unknown>[] = [];
  const backfillIds: { id: string; external_id: string }[] = [];

  for (const t of congressTrades) {
    if (knownExternalIds.has(t.id)) {
      skippedAlreadyKnown++;
      continue;
    }
    if (!t.ticker) {
      skippedNoTicker++;
      continue;
    }
    const tradeType = mapTradeType(t.transaction_type);
    if (!tradeType) {
      skippedUnmappedType++;
      continue;
    }
    const politician = matchPolitician(t, byStateChamber);
    if (!politician) {
      skippedUnmatchedPolitician++;
      continue;
    }

    const key = naturalKey(
      politician.id,
      t.ticker,
      t.transaction_date,
      tradeType,
      mapOwner(t.owner),
      t.amount_range_label
    );
    const existingId = naturalKeyToId.get(key);
    if (existingId) {
      backfillIds.push({ id: existingId, external_id: t.id });
      backfilled++;
      continue;
    }

    if (!knownTickers.has(t.ticker) && !newStocks.has(t.ticker)) {
      newStocks.set(t.ticker, t.asset_name ?? t.ticker);
    }

    newTradeRows.push({
      politician_id: politician.id,
      ticker: t.ticker,
      trade_type: tradeType,
      owner: mapOwner(t.owner),
      transaction_date: t.transaction_date,
      amount_min: t.amount_range_low,
      amount_max: t.amount_range_high,
      amount_label: t.amount_range_label,
      source_url: t.doc_url,
      external_id: t.id,
    });
  }

  if (newStocks.size > 0) {
    const rows = [...newStocks.entries()].map(([ticker, company_name]) => ({ ticker, company_name }));
    const { error } = await supabase.from("stocks").upsert(rows, { onConflict: "ticker", ignoreDuplicates: true });
    if (error) {
      return NextResponse.json({ error: `Inserting new stocks: ${error.message}` }, { status: 500 });
    }
  }

  if (newTradeRows.length > 0) {
    const { error } = await supabase.from("trades").insert(newTradeRows);
    if (error) {
      return NextResponse.json({ error: `Inserting new trades: ${error.message}` }, { status: 500 });
    }
  }

  // Backfill in small concurrent batches -- these are simple single-row
  // updates keyed by primary key, cheap enough to parallelize a bit.
  const BACKFILL_CONCURRENCY = 10;
  for (let i = 0; i < backfillIds.length; i += BACKFILL_CONCURRENCY) {
    const slice = backfillIds.slice(i, i + BACKFILL_CONCURRENCY);
    await Promise.all(
      slice.map(({ id, external_id }) => supabase.from("trades").update({ external_id }).eq("id", id))
    );
  }

  return NextResponse.json({
    sourceRecords: sourceTrades.length,
    congressRecords: congressTrades.length,
    newTrades: newTradeRows.length,
    newStocks: newStocks.size,
    backfilled,
    skippedAlreadyKnown,
    skippedUnmatchedPolitician,
    skippedNoTicker,
    skippedUnmappedType,
  });
}
