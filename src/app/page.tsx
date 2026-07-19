export default function Home() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center bg-white px-6 dark:bg-black">
      <div className="flex max-w-xl flex-col items-center text-center">
        <span className="mb-6 rounded-full border border-zinc-200 px-3 py-1 text-xs font-medium tracking-wide text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
          PHASE 1 &middot; PROJECT SCAFFOLD
        </span>
        <h1 className="text-4xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-5xl">
          Congress Trades
        </h1>
        <p className="mt-4 text-lg leading-relaxed text-zinc-500 dark:text-zinc-400">
          Tracking stock trades disclosed by members of the U.S. Senate and House
          under the STOCK Act.
        </p>
        <div className="mt-10 grid w-full grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-zinc-200 p-4 text-left dark:border-zinc-800">
            <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">Next.js + TypeScript</p>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">App live and deployed</p>
          </div>
          <div className="rounded-xl border border-zinc-200 p-4 text-left dark:border-zinc-800">
            <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">Supabase</p>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">Database connected next</p>
          </div>
          <div className="rounded-xl border border-zinc-200 p-4 text-left dark:border-zinc-800">
            <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">Vercel</p>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">Auto-deploys on push</p>
          </div>
        </div>
      </div>
    </div>
  );
}
