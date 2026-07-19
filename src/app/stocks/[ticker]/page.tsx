import Link from "next/link";
import { notFound } from "next/navigation";
import { supabase, type Stock, type Trade, type Politician } from "@/lib/supabase";

export const dynamic = "force-dynamic";

function titleCase(s: string) {
  return s.charAt(0) + s.slice(1).toLowerCase();
}

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
          {stock.ticker}
        </h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          {stock.company_name}
        </p>

        <h2 className="mt-10 mb-4 text-sm font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          Congressional trades ({trades?.length ?? 0})
        </h2>

        <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-50 text-xs uppercase text-zinc-500 dark:bg-zinc-950 dark:text-zinc-400">
              <tr>
                <th className="px-4 py-2 font-medium">Date</th>
                <th className="px-4 py-2 font-medium">Politician</th>
                <th className="px-4 py-2 font-medium">Type</th>
                <th className="px-4 py-2 font-medium">Amount range</th>
              </tr>
            </thead>
            <tbody>
              {(trades ?? []).map((t) => {
                const p = politicianById.get(t.politician_id);
                return (
                  <tr key={t.id} className="border-t border-zinc-100 dark:border-zinc-900">
                    <td className="px-4 py-2 text-zinc-600 dark:text-zinc-300">
                      {t.transaction_date}
                    </td>
                    <td className="px-4 py-2 font-medium text-zinc-900 dark:text-zinc-50">
                      {p ? (
                        <Link href={`/politicians/${p.id}`} className="hover:underline">
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
                              : "text-zinc-500"
                        }
                      >
                        {titleCase(t.trade_type)}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-zinc-600 dark:text-zinc-300">
                      {t.amount_label}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
