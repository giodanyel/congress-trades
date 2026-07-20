import type { Party } from "@/lib/supabase";

export function titleCase(s: string) {
  return s.charAt(0) + s.slice(1).toLowerCase();
}

export function formatUsd(value: number | null, compact = false) {
  if (value === null) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
    notation: compact ? "compact" : "standard",
  }).format(value);
}

export function formatPct(value: number) {
  return `${value >= 0 ? "+" : ""}${(value * 100).toFixed(1)}%`;
}

export function daysAgo(dateStr: string) {
  const then = new Date(dateStr).getTime();
  const now = Date.now();
  return Math.floor((now - then) / (1000 * 60 * 60 * 24));
}

export function relativeDate(dateStr: string) {
  const d = daysAgo(dateStr);
  if (d <= 0) return "today";
  if (d === 1) return "yesterday";
  if (d < 30) return `${d}d ago`;
  if (d < 365) return `${Math.floor(d / 30)}mo ago`;
  return `${Math.floor(d / 365)}y ago`;
}

// Party colors: used consistently across badges, dots, and accents so a
// user can scan by color instead of reading text everywhere.
const PARTY_STYLES: Record<Party, { dot: string; badge: string; text: string; label: string }> = {
  DEMOCRAT: {
    dot: "bg-blue-500",
    badge: "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
    text: "text-blue-600 dark:text-blue-400",
    label: "Democrat",
  },
  REPUBLICAN: {
    dot: "bg-red-500",
    badge: "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300",
    text: "text-red-600 dark:text-red-400",
    label: "Republican",
  },
  INDEPENDENT: {
    dot: "bg-violet-500",
    badge: "bg-violet-50 text-violet-700 dark:bg-violet-950 dark:text-violet-300",
    text: "text-violet-600 dark:text-violet-400",
    label: "Independent",
  },
};

export function partyStyle(party: Party) {
  return PARTY_STYLES[party] ?? PARTY_STYLES.INDEPENDENT;
}

export const confidenceStyle: Record<string, string> = {
  HIGH: "text-emerald-600 dark:text-emerald-400",
  MEDIUM: "text-amber-600 dark:text-amber-400",
  LOW: "text-orange-600 dark:text-orange-400",
  UNAVAILABLE: "text-zinc-400 dark:text-zinc-600",
};
