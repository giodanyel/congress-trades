import Link from "next/link";
import { supabase, type Politician } from "@/lib/supabase";

// Data changes as new trades/politicians are added, so always fetch fresh
// instead of baking a snapshot in at build time.
export const dynamic = "force-dynamic";

async function getPoliticians(): Promise<{ data: Politician[]; error: string | null }> {
  const { data, error } = await supabase
    .from("politicians")
    .select("*")
    .order("last_name", { ascending: true });

  if (error) {
    return { data: [], error: error.message };
  }
  return { data: data ?? [], error: null };
}

function formatNetWorth(value: number | null) {
  if (value === null) return "Not disclosed";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
    notation: "compact",
  }).format(value);
}

export default async function Home() {
  const { data: politicians, error } = await getPoliticians();

  return (
    <div className="flex flex-1 flex-col bg-white px-6 py-16 dark:bg-black">
      <div className="mx-auto w-full max-w-3xl">
        <div className="flex items-center justify-between">
          <span className="inline-block rounded-full border border-zinc-200 px-3 py-1 text-xs font-medium tracking-wide text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
            PHASE 3 &middot; REAL TRADE DATA
          </span>
          <Link
            href="/leaderboard"
            className="text-xs font-medium text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
          >
            Most Active Traders &rarr;
          </Link>
        </div>
        <h1 className="mt-4 text-4xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Congress Trades
        </h1>
        <p className="mt-3 text-lg leading-relaxed text-zinc-500 dark:text-zinc-400">
          Tracking stock trades disclosed by members of the U.S. Senate and House
          under the STOCK Act.
        </p>

        <div className="mt-10">
          <h2 className="mb-4 text-sm font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Politicians ({politicians.length})
          </h2>

          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-400">
              Couldn&apos;t load data from Supabase: {error}
            </div>
          )}

          {!error && politicians.length === 0 && (
            <div className="rounded-xl border border-zinc-200 p-4 text-sm text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
              No politicians yet. Run the SQL migration in Supabase to add sample data.
            </div>
          )}

          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {politicians.map((p) => (
              <li
                key={p.id}
                className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800"
              >
                <Link href={`/politicians/${p.id}`} className="hover:underline">
                  <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
                    {p.full_name}
                  </p>
                </Link>
                <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                  {p.party.charAt(0) + p.party.slice(1).toLowerCase()} &middot;{" "}
                  {p.state} &middot;{" "}
                  {p.chamber.charAt(0) + p.chamber.slice(1).toLowerCase()}
                </p>
                <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                  Net worth: {formatNetWorth(p.net_worth_usd)}
                </p>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
