"use client";

import { useState, useTransition } from "react";
import type { WatchlistKind } from "@/lib/supabase";

// A plain star-toggle button. Optimistic: flips immediately on click and
// only reverts if the request actually fails, so it feels instant rather
// than waiting on a round trip for something this low-stakes.
export function FollowButton({
  kind,
  refId,
  initialFollowing,
  size = "md",
}: {
  kind: WatchlistKind;
  refId: string;
  initialFollowing: boolean;
  size?: "sm" | "md";
}) {
  const [following, setFollowing] = useState(initialFollowing);
  const [pending, startTransition] = useTransition();

  function toggle() {
    const next = !following;
    setFollowing(next);
    startTransition(async () => {
      try {
        const res = await fetch("/api/watchlist/toggle", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ kind, ref_id: refId }),
        });
        if (!res.ok) throw new Error("Request failed");
        const data = await res.json();
        setFollowing(Boolean(data.following));
      } catch {
        setFollowing(!next); // revert on failure
      }
    });
  }

  const label = kind === "politician" ? "politician" : "ticker";
  const sizeClasses = size === "sm" ? "px-2.5 py-1 text-xs" : "px-3.5 py-1.5 text-sm";

  return (
    <button
      onClick={toggle}
      disabled={pending}
      aria-pressed={following}
      title={following ? `Following this ${label}` : `Follow this ${label}`}
      className={`inline-flex items-center gap-1.5 rounded-full border font-medium transition-colors disabled:opacity-60 ${sizeClasses} ${
        following
          ? "border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300"
          : "border-stone-200 bg-white text-stone-500 hover:border-stone-300 hover:text-stone-700 dark:border-white/10 dark:bg-white/5 dark:text-stone-400 dark:hover:text-stone-200"
      }`}
    >
      <svg
        viewBox="0 0 20 20"
        className={size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4"}
        fill={following ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth={1.6}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M10 2.5l2.35 4.76 5.25.77-3.8 3.7.9 5.23L10 14.5l-4.7 2.46.9-5.23-3.8-3.7 5.25-.77L10 2.5z"
        />
      </svg>
      {following ? "Following" : "Follow"}
    </button>
  );
}
