import Link from "next/link";
import { notFound } from "next/navigation";
import {
  supabase,
  estimatedTradeValue,
  type Stock,
  type Trade,
  type Politician,
  type TradeReturn,
} from "@/lib/supabase";
import { partyStyle, titleCase } from "@/lib/ui";

export const dynamic = "force-dynamic";

export default async function StockPage({
  params,
}: {
  params: Promise<{ ticker: string }>;
}) {
  const { ticker: rawTicker } = await params;
  const ticker = rawTicker.toUpperCase();

  const { data: stock } = await supabase
    .from("stocks")
    .select("*")
    .eq("ticker", ticker)
    .single<Stock>();

  if (!stock) notFound();

  const { data: trades } = await supabase
    .from("trades")
    .select("*")
    .eq("ticker", ticker)
    .order("transaction_date", { ascending: false })
    .returns<Trade[]>();

  const politicianIds = [...new Set((trades ?? []).map((t) => t.politician_id))];
  const { data: politicians } = await supabase
    .from("politicians")
    .select("*")
    .in("id", politicianIds.length ? politicianIds : ["__none__"])
    .returns<Politician[]>();

  const politicianById = new Map((politicians ?? []).map((p) => [p.id, p]));

  const tradeIds = (trades ?? []).map((t) => t.id);
  const { data: returns } = await supabase
    .from("trade_returns")
    .select("*")
    .in("trade_id", tradeIds.length ? tradeIds : ["__none__"])
    .returns<TradeReturn[]>();
  const returnByTradeId = new Map((returns ?? []).map((r) => [r.trade_id, r]));

  return (
    <div className="flex flex-1 flex-col bg-background px-6 py-10">
      <div className="mx-auto w-full max-w-3xl">
        <h1 className="text-3xl font-semibold tracking-tight text-stone-900 dark:text-stone-50">
          {stock.ticker}
        </h1>
        <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">
          {stock.company_name}
        </p>

        <h2 className="mt-10 mb-4 text-sm font-medium uppercase tracking-wide text-stone-500 dark:text-stone-400">
          Congressional trades ({trades?.length ?? 0})
        </h2>

        <div className="overflow-x-auto rounded-2xl border border-stone-200 dark:border-stone-800">
          <table className="w-full text-left text-sm">
            <thead className="bg-stone-50 text-xs uppercase text-stone-500 dark:bg-stone-950 dark:text-stone-400">
              <tr>
                <th className="px-4 py-2 font-medium">Date</th>
                <th className="px-4 py-2 font-medium">Politician</th>
                <th className="px-4 py-2 font-medium">Type</th>
                <th className="px-4 py-2 font-medium">Amount range</th>
                <th className="px-4 py-2 font-medium">Est. P&amp;L*</th>
              </tr>
            </thead>
            <tbody>
              {(trades ?? []).map((t) => {
                const p = politicianById.get(t.politician_id);
                const r = returnByTradeId.get(t.id);
                const value = estimatedTradeValue(t);
                const pnl =
                  r && r.return_pct !== null && value !== null ? r.return_pct * value : null;
                return (
                  <tr key={t.id} className="border-t border-stone-100 dark:border-stone-900">
                    <td className="px-4 py-2 text-stone-600 dark:text-stone-300">
                      {t.transaction_date}
                    </td>
                    <td className="px-4 py-2 font-medium text-stone-900 dark:text-stone-50">
                      {p ? (
                        <Link
                          href={`/politicians/${p.id}`}
                          className="flex items-center gap-2 hover:underline"
                        >
                          <span className={`h-2 w-2 shrink-0 rounded-full ${partyStyle(p.party).dot}`} />
                          {p.full_name}
                        </Link>
                      ) : (
                        "Unknown"
                      )}
                    </td>
                    <td className="px-4 py-2">
                      <span
                        className={
                          t.trade_type === "PURCHASE"
                            ? "text-emerald-600 dark:text-emerald-400"
                            : t.trade_type === "SALE"
                              ? "text-red-600 dark:text-red-400"
                              : "text-stone-500"
                        }
                      >
                        {titleCase(t.trade_type)}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-stone-600 dark:text-stone-300">
                      {t.amount_label}
                    </td>
                    <td className="px-4 py-2">
                      {pnl === null ? (
                        <span className="text-stone-400 dark:text-stone-600">
                          {!r || r.confidence === "UNAVAILABLE" ? "no price data" : "—"}
                        </span>
                      ) : (
                        <span
                          className={
                            pnl >= 0
                              ? "text-emerald-600 dark:text-emerald-400"
                              : "text-red-600 dark:text-red-400"
                          }
                        >
                          {pnl >= 0 ? "+" : "-"}${Math.abs(pnl).toLocaleString("en-US", { maximumFractionDigits: 0 })}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <p className="mt-4 text-xs text-stone-400 dark:text-stone-500">
          * Estimated using the disclosed amount range&apos;s midpoint and
          available price history &mdash; not exact.
        </p>
      </div>
    </div>
  );
}
