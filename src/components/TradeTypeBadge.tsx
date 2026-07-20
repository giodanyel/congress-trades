import type { TradeType } from "@/lib/supabase";

// A small icon+label pill instead of plain colored text -- reads at a
// glance even for someone who doesn't habitually scan finance tables.
export function TradeTypeBadge({ type }: { type: TradeType }) {
  if (type === "PURCHASE") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
        <svg viewBox="0 0 12 12" className="h-2.5 w-2.5" fill="currentColor">
          <path d="M6 1l4.5 7H1.5L6 1z" />
        </svg>
        Bought
      </span>
    );
  }
  if (type === "SALE") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-xs font-medium text-rose-700 dark:bg-rose-950 dark:text-rose-300">
        <svg viewBox="0 0 12 12" className="h-2.5 w-2.5" fill="currentColor">
          <path d="M6 11L1.5 4h9L6 11z" />
        </svg>
        Sold
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-stone-100 px-2 py-0.5 text-xs font-medium text-stone-600 dark:bg-white/5 dark:text-stone-400">
      <svg viewBox="0 0 12 12" className="h-2.5 w-2.5" fill="none" stroke="currentColor" strokeWidth={1.4}>
        <path d="M2 4h8M2 8h8" strokeLinecap="round" />
      </svg>
      Exchanged
    </span>
  );
}
