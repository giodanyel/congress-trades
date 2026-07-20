import Link from "next/link";
import { supabase, type Politician } from "@/lib/supabase";
import { partyStyle, titleCase } from "@/lib/ui";

export const dynamic = "force-dynamic";

export default async function PoliticiansDirectoryPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const query = (q ?? "").trim();

  let politicians: Politician[] = [];
  let error: string | null = null;

  if (query) {
    const [{ data: byName }, { data: tickerMatches }] = await Promise.all([
      supabase
        .from("politicians")
        .select("*")
        .or(`full_name.ilike.%${query}%,state.ilike.%${query}%`)
        .returns<Politician[]>(),
      supabase
        .from("trades")
        .select("politician_id")
        .ilike("ticker", `%${query}%`),
    ]);

    const tickerPoliticianIds = [
      ...new Set((tickerMatches ?? []).map((t) => t.politician_id as string)),
    ];

    const { data: byTicker } =
      tickerPoliticianIds.length > 0
        ? await supabase
            .from("politicians")
            .select("*")
            .in("id", tickerPoliticianIds)
            .returns<Politician[]>()
        : { data: [] as Politician[] };

    const merged = new Map<string, Politician>();
    for (const p of [...(byName ?? []), ...(byTicker ?? [])]) merged.set(p.id, p);
    politicians = [...merged.values()].sort((a, b) => a.last_name.localeCompare(b.last_name));
  } else {
    const { data, error: err } = await supabase
      .from("politicians")
      .select("*")
      .order("last_name", { ascending: true })
      .returns<Politician[]>();
    politicians = data ?? [];
    error = err?.message ?? null;
  }

  return (
    <div className="flex flex-1 flex-col bg-background px-6 py-12">
      <div className="mx-auto w-full max-w-4xl">
        <h1 className="text-2xl font-semibold tracking-tight text-stone-900 dark:text-stone-50">
          All Politicians
        </h1>
        <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">
          {query ? (
            <>
              {politicians.length} result{politicians.length === 1 ? "" : "s"} for
              &nbsp;<span className="font-medium text-stone-700 dark:text-stone-300">&quot;{query}&quot;</span>
            </>
          ) : (
            `${politicians.length} current members of Congress`
          )}
        </p>

        {error && (
          <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-400">
            Couldn&apos;t load data from Supabase: {error}
          </div>
        )}

        {!error && politicians.length === 0 && (
          <div className="mt-6 rounded-2xl border border-stone-200 p-4 text-sm text-stone-500 dark:border-stone-800 dark:text-stone-400">
            No politicians match that search.
          </div>
        )}

        <ul className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {politicians.map((p) => {
            const style = partyStyle(p.party);
            return (
              <li
                key={p.id}
                className="rounded-2xl border border-stone-200 p-4 transition-colors hover:border-stone-300 dark:border-stone-800 dark:hover:border-stone-700"
              >
                <Link href={`/politicians/${p.id}`} className="flex items-center gap-3">
                  <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${style.dot}`} />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-stone-900 dark:text-stone-50">
                      {p.full_name}
                    </p>
                    <p className="mt-0.5 text-xs text-stone-500 dark:text-stone-400">
                      {style.label} &middot; {p.state} &middot; {titleCase(p.chamber)}
                    </p>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
