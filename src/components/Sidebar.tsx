"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";

const NAV_LINKS = [
  { href: "/", label: "Overview" },
  { href: "/leaderboard/roi", label: "Top Performers" },
  { href: "/leaderboard", label: "Most Active" },
  { href: "/politicians", label: "All Politicians" },
];

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
            className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              active
                ? "bg-zinc-900 text-white dark:bg-zinc-50 dark:text-zinc-900"
                : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-900"
            }`}
          >
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
        className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400"
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
        placeholder="Search politician or ticker..."
        className="w-full rounded-lg border border-zinc-200 bg-white py-2 pl-8 pr-3 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-none dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100"
      />
    </form>
  );
}

export default function Sidebar() {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Mobile top bar with dropdown toggle */}
      <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 md:hidden dark:border-zinc-800">
        <Link href="/" className="text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Congress Trades
        </Link>
        <button
          onClick={() => setOpen((v) => !v)}
          aria-label="Toggle menu"
          className="rounded-lg border border-zinc-200 p-2 text-zinc-600 dark:border-zinc-800 dark:text-zinc-300"
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
        <div className="flex flex-col gap-4 border-b border-zinc-200 px-4 py-4 md:hidden dark:border-zinc-800">
          <SearchBox onNavigate={() => setOpen(false)} />
          <NavLinks onNavigate={() => setOpen(false)} />
        </div>
      )}

      {/* Desktop sidebar */}
      <aside className="hidden w-60 shrink-0 flex-col gap-6 border-r border-zinc-200 px-4 py-8 md:flex dark:border-zinc-800">
        <Link href="/" className="px-1 text-base font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Congress Trades
        </Link>
        <SearchBox />
        <NavLinks />
        <p className="mt-auto px-1 text-[11px] leading-relaxed text-zinc-400 dark:text-zinc-600">
          Data sourced from public STOCK Act disclosures. Dollar figures are
          always estimates, never exact.
        </p>
      </aside>
    </>
  );
}
