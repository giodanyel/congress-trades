import Link from "next/link";
import { notFound } from "next/navigation";
import {
  supabase,
  estimatedTradeValue,
  type Politician,
  type Trade,
  type Stock,
} from "@/lib/supabase";

export const dynamic = "force-dynamic";

function formatUsd(value: number | null) {
  if (value === null) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function titleCase(s: string) {
  return s.charAt(0) + s.slice(1).toLowerCase();
}

export default async function PoliticianPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const { data: politician } = await supabase
    .from("politicians")
    .select("*")
    .eq("id", id)
    .single<Politician>();

  if (!politician) notFound();

  const { data: trades } = await supabase
    .from("trades")
    .select("*")
    .eq("politician_id", id)
    .order("transaction_date", { ascending: false })
    .returns<Trade[]>();

  const tickers = [...new Set((trades ?? []).map((t) => t.ticker))];
  const { data: stocks } = await supabase
    .from("stocks")
    .select("*")
    .in("ticker", tickers.length ? tickers : ["__none__"])
    .returns<Stock[]>();

  const stockByTicker = new Map((stocks ?? []).map((s) => [s.ticker, s]));

  const purchaseCount = (trades ?? []).filter((t) => t.trade_type === "PURCHASE").length;
  const saleCount = (trades ?? []).filter((t) => t.trade_type === "SALE").length;
  const totalEstimatedVolume = (trades ?? []).reduce(
    (sum, t) => sum + (estimatedTradeValue(t) ?? 0),
    0
  );

  return (
    <div className="flex flex-1 flex-col bg-white px-6 py-16 dark:bg-black">
      <div className="mx-auto w-full max-w-3xl">
        <Link
          href="/"
          className="text-xs font-medium text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
        >
          &larr; Back to all politicians
        </Link>

        <h1 className="mt-4 text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          {politician.full_name}
        </h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          {titleCase(politician.party)} &middot; {politician.state} &middot;{" "}
          {titleCase(politician.chamber)}
        </p>
        {politician.bio && (
          <p className="mt-4 text-sm leading-relaxed text-zinc-600 dark:text-zinc-300">
            {politician.bio}
          </p>
        )}

        <div className="mt-8 grid grid-cols-3 gap-3">
          <div className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
            <p className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
              {trades?.length ?? 0}
            </p>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">Total trades</p>
          </div>
          <div className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
            <p className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
              {purchaseCount} / {saleCount}
            </p>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">Buys / Sells</p>
          </div>
          <div className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
            <p className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
              {formatUsd(totalEstimatedVolume)}
            </p>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              Est. total volume*
            </p>
          </div>
        </div>

        <h2 className="mt-10 mb-4 text-sm font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          Trade history
        </h2>

        <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-50 text-xs uppercase text-zinc-500 dark:bg-zinc-950 dark:text-zinc-400">
              <tr>
                <th className="px-4 py-2 font-medium">Date</th>
                <th className="px-4 py-2 font-medium">Ticker</th>
                <th className="px-4 py-2 font-medium">Type</th>
                <th className="px-4 py-2 font-medium">Owner</th>
                <th className="px-4 py-2 font-medium">Amount range</th>
              </tr>
            </thead>
            <tbody>
              {(trades ?? []).map((t) => (
                <tr
                  key={t.id}
                  className="border-t border-zinc-100 dark:border-zinc-900"
                >
                  <td className="px-4 py-2 text-zinc-600 dark:text-zinc-300">
                    {t.transaction_date}
                  </td>
                  <td className="px-4 py-2 font-medium text-zinc-900 dark:text-zinc-50">
                    <Link href={`/stocks/${t.ticker}`} className="hover:underline">
                      {t.ticker}
                    </Link>
                    <span className="ml-1 text-xs font-normal text-zinc-500 dark:text-zinc-400">
                      {stockByTicker.get(t.ticker)?.company_name}
                    </span>
                  </td>
                  <td className="px-4 py-2">
                    <span
                      className={
                        t.trade_type === "PURCHASE"
                          ? "text-emerald-600 dark:text-emerald-400"
                          : t.trade_type === "SALE"
                            ? "text-red-600 dark:text-red-400"
                            : "text-zinc-500"
                      }
                    >
                      {titleCase(t.trade_type)}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-zinc-600 dark:text-zinc-300">
                    {titleCase(t.owner)}
                  </td>
                  <td className="px-4 py-2 text-zinc-600 dark:text-zinc-300">
                    {t.amount_label}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="mt-4 text-xs text-zinc-400 dark:text-zinc-500">
          * STOCK Act disclosures report a dollar range, not an exact amount. This
          total is an estimate using the midpoint of each disclosed range and
          should not be treated as exact.
        </p>
      </div>
    </div>
  );
}
