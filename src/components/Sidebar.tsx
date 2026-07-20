"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { Logo } from "@/components/Logo";

const NAV_LINKS = [
  { href: "/", label: "Overview", cat: "stocks" },
  { href: "/news", label: "Market News", cat: "news" },
  { href: "/following", label: "Following", cat: "following" },
  { href: "/interesting", label: "Interesting Buys", cat: "performance" },
  { href: "/leaderboard/roi", label: "Top Performers", cat: "performance" },
  { href: "/leaderboard", label: "Most Active", cat: "politicians" },
  { href: "/politicians", label: "All Politicians", cat: "politicians" },
] as const;

const CAT_ACTIVE_CLASSES: Record<string, string> = {
  stocks: "bg-cat-stocks-soft text-cat-stocks",
  news: "bg-cat-news-soft text-cat-news",
  following: "bg-cat-following-soft text-cat-following",
  performance: "bg-cat-performance-soft text-cat-performance",
  politicians: "bg-cat-politicians-soft text-cat-politicians",
};

const CAT_VAR: Record<string, string> = {
  stocks: "var(--cat-stocks)",
  news: "var(--cat-news)",
  following: "var(--cat-following)",
  performance: "var(--cat-performance)",
  politicians: "var(--cat-politicians)",
};

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav className="flex flex-col gap-1">
      {NAV_LINKS.map((link) => {
        const active = pathname === link.href;
        return (
          <Link
            key={link.href}
            href={link.href}
            onClick={onNavigate}
            className={`flex items-center gap-2.5 rounded-2xl px-3 py-2.5 text-sm font-medium transition-all duration-150 ${
              active
                ? `${CAT_ACTIVE_CLASSES[link.cat]} translate-x-0.5 shadow-sm`
                : "text-stone-600 hover:translate-x-0.5 hover:bg-stone-100 dark:text-stone-400 dark:hover:bg-white/5"
            }`}
          >
            <span
              className="h-1.5 w-1.5 shrink-0 rounded-full transition-transform duration-150"
              style={{
                backgroundColor: CAT_VAR[link.cat],
                transform: active ? "scale(1.4)" : "scale(1)",
              }}
            />
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}

function SearchBox({ onNavigate }: { onNavigate?: () => void }) {
  const router = useRouter();
  const [value, setValue] = useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const q = value.trim();
    router.push(q ? `/politicians?q=${encodeURIComponent(q)}` : "/politicians");
    onNavigate?.();
  }

  return (
    <form onSubmit={submit} className="relative">
      <svg
        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11a6 6 0 11-12 0 6 6 0 0112 0z" />
      </svg>
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        type="text"
        placeholder="Search a politician or ticker..."
        className="w-full rounded-2xl border border-stone-200 bg-white py-2.5 pl-9 pr-3 text-sm text-stone-900 placeholder:text-stone-400 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand-soft dark:border-white/10 dark:bg-white/5 dark:text-stone-100"
      />
    </form>
  );
}

export default function Sidebar() {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Mobile top bar with dropdown toggle */}
      <div className="flex items-center justify-between border-b border-stone-200 px-4 py-3 md:hidden dark:border-white/10">
        <Link href="/" className="group flex items-center gap-2">
          <Logo className="h-7 w-7 transition-transform duration-200 group-hover:scale-110" />
          <span className="font-heading text-sm font-semibold tracking-tight text-stone-900 dark:text-stone-50">
            Congress Trades
          </span>
        </Link>
        <button
          onClick={() => setOpen((v) => !v)}
          aria-label="Toggle menu"
          className="rounded-2xl border border-stone-200 p-2 text-stone-600 dark:border-white/10 dark:text-stone-300"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            {open ? (
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            )}
          </svg>
        </button>
      </div>
      {open && (
        <div className="flex flex-col gap-4 border-b border-stone-200 px-4 py-4 md:hidden dark:border-white/10">
          <SearchBox onNavigate={() => setOpen(false)} />
          <NavLinks onNavigate={() => setOpen(false)} />
        </div>
      )}

      {/* Desktop sidebar */}
      <aside className="hidden w-64 shrink-0 flex-col gap-6 border-r border-stone-200 px-4 py-8 md:flex dark:border-white/10">
        <Link href="/" className="group flex items-center gap-2.5 px-1">
          <Logo className="h-9 w-9 transition-transform duration-200 group-hover:scale-110" />
          <span className="font-heading text-base font-semibold tracking-tight text-stone-900 dark:text-stone-50">
            Congress Trades
          </span>
        </Link>
        <SearchBox />
        <NavLinks />
        <p className="mt-auto rounded-2xl bg-stone-100 px-3 py-2.5 text-[11px] leading-relaxed text-stone-500 dark:bg-white/5 dark:text-stone-400">
          Data sourced from public STOCK Act disclosures. Dollar figures are
          always estimates, never exact.
        </p>
      </aside>
    </>
  );
}
