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
  filing_date: string | null;
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

// A plain select() without an explicit range can silently come back short
// on large tables depending on the client/project's default page size.
// Paginating explicitly guarantees we see every existing trade -- without
// this, rows past the cutoff look "new" to this route, which either
// re-inserts them (duplicate-key failure, since external_id is uniquely
// indexed) or, worse, aborts the whole run before the filing_date backfill
// step ever executes.
async function fetchAllRows<T>(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  table: string,
  columns: string
): Promise<T[]> {
  const PAGE_SIZE = 1000;
  const all: T[] = [];
  let from = 0;
  for (;;) {
    const { data, error } = await supabase
      .from(table)
      .select(columns)
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(error.message);
    const page = (data ?? []) as T[];
    all.push(...page);
    if (page.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  return all;
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

  let politicians: Politician[];
  let existingTrades: ExistingTradeRow[];
  let existingStockRows: { ticker: string }[];
  let sourceRes: Response;
  try {
    [politicians, existingTrades, existingStockRows, sourceRes] = await Promise.all([
      fetchAllRows<Politician>(supabase, "politicians", "*"),
      fetchAllRows<ExistingTradeRow>(
        supabase,
        "trades",
        "id, politician_id, ticker, transaction_date, trade_type, owner, amount_label, external_id, filing_date"
      ),
      fetchAllRows<{ ticker: string }>(supabase, "stocks", "ticker"),
      fetch(TRADES_URL, { headers: { "User-Agent": "Mozilla/5.0 (compatible; CongressTradesBot/1.0)" } }),
    ]);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
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
  // Rows already matched to a source record but still missing filing_date
  // (from before that column existed, or from the natural-key backfill
  // pass which only set external_id). Lets a re-run fill in the gap.
  const externalIdToRowMissingFilingDate = new Map<string, string>();
  // For rows that don't have an external_id yet (the original seed), map
  // their natural key to their row id so a matching source record can
  // backfill the external_id instead of being inserted as a duplicate.
  const naturalKeyToId = new Map<string, string>();
  for (const t of existingTrades ?? []) {
    if (t.external_id) {
      knownExternalIds.add(t.external_id);
      if (!t.filing_date) {
        externalIdToRowMissingFilingDate.set(t.external_id, t.id);
      }
    } else {
      naturalKeyToId.set(
        naturalKey(t.politician_id, t.ticker, t.transaction_date, t.trade_type, t.owner, t.amount_label),
        t.id
      );
    }
  }

  const knownTickers = new Set((existingStockRows ?? []).map((r) => r.ticker as string));
  const congressTrades = sourceTrades.filter((t) => t.branch === "congress");

  // Fast, read-only diagnostic: report load counts and how many source
  // records would be treated as already-known vs. new/backfillable, without
  // running the (much slower) insert/backfill steps.
  if (req.nextUrl.searchParams.get("diag") === "1") {
    let wouldBackfill = 0;
    let wouldInsert = 0;
    let alreadyKnown = 0;
    for (const t of congressTrades) {
      if (knownExternalIds.has(t.id)) {
        alreadyKnown++;
        continue;
      }
      if (!t.ticker || !mapTradeType(t.transaction_type)) continue;
      const politician = matchPolitician(t, byStateChamber);
      if (!politician) continue;
      const key = naturalKey(
        politician.id,
        t.ticker,
        t.transaction_date,
        mapTradeType(t.transaction_type)!,
        mapOwner(t.owner),
        t.amount_range_label
      );
      if (naturalKeyToId.has(key)) wouldBackfill++;
      else wouldInsert++;
    }
    return NextResponse.json({
      politiciansLoaded: (politicians ?? []).length,
      existingTradesLoaded: (existingTrades ?? []).length,
      existingWithExternalId: (existingTrades ?? []).filter((t) => t.external_id).length,
      existingMissingFilingDate: externalIdToRowMissingFilingDate.size,
      congressRecordsInSource: congressTrades.length,
      alreadyKnown,
      wouldBackfill,
      wouldInsert,
    });
  }

  let skippedAlreadyKnown = 0;
  let skippedUnmatchedPolitician = 0;
  let skippedNoTicker = 0;
  let skippedUnmappedType = 0;
  let backfilled = 0;

  const newStocks = new Map<string, string>();
  const newTradeRows: Record<string, unknown>[] = [];
  const backfillIds: { id: string; external_id: string; filing_date: string | null }[] = [];
  let filingDateBackfilled = 0;

  for (const t of congressTrades) {
    if (knownExternalIds.has(t.id)) {
      skippedAlreadyKnown++;
      // Already matched, but might still be missing filing_date if it was
      // matched before that column existed or via the natural-key pass.
      const rowId = externalIdToRowMissingFilingDate.get(t.id);
      if (rowId && t.filing_date) {
        backfillIds.push({ id: rowId, external_id: t.id, filing_date: t.filing_date });
        filingDateBackfilled++;
      }
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
      backfillIds.push({ id: existingId, external_id: t.id, filing_date: t.filing_date });
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
      filing_date: t.filing_date,
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
      return NextResponse.json(
        {
          error: `Inserting new trades: ${error.message}`,
          diagnostics: { existingTradesLoaded: existingTrades?.length ?? 0 },
        },
        { status: 500 }
      );
    }
  }

  // Backfill in small concurrent batches -- these are simple single-row
  // updates keyed by primary key, cheap enough to parallelize a bit.
  // ?skipBackfill=1 skips this step entirely, for quickly checking the
  // dedup counts without waiting on hundreds of individual row updates.
  const BACKFILL_CONCURRENCY = 40;
  const backfillErrors: string[] = [];
  const skipBackfill = req.nextUrl.searchParams.get("skipBackfill") === "1";
  if (!skipBackfill) {
    for (let i = 0; i < backfillIds.length; i += BACKFILL_CONCURRENCY) {
      const slice = backfillIds.slice(i, i + BACKFILL_CONCURRENCY);
      const results = await Promise.all(
        slice.map(({ id, external_id, filing_date }) =>
          supabase
            .from("trades")
            .update(filing_date ? { external_id, filing_date } : { external_id })
            .eq("id", id)
        )
      );
      for (const r of results) {
        if (r.error) backfillErrors.push(r.error.message);
      }
    }
  }

  return NextResponse.json({
    debugVersion: "v4",
    sourceRecords: sourceTrades.length,
    congressRecords: congressTrades.length,
    newTrades: newTradeRows.length,
    newStocks: newStocks.size,
    backfilled: skipBackfill ? 0 : backfilled,
    filingDateBackfilled: skipBackfill ? 0 : filingDateBackfilled,
    backfillPending: backfillIds.length,
    backfillSkipped: skipBackfill,
    backfillErrors: backfillErrors.length > 0 ? backfillErrors.slice(0, 5) : undefined,
    skippedAlreadyKnown,
    skippedUnmatchedPolitician,
    skippedNoTicker,
    skippedUnmappedType,
    diagnostics: {
      existingTradesLoaded: existingTrades?.length ?? 0,
      existingWithExternalId: (existingTrades ?? []).filter((t) => t.external_id).length,
    },
  });
}
