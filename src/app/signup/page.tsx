"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

function SignupForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "pending" | "sent" | "error">("idle");
  const [error, setError] = useState("");
  const searchParams = useSearchParams();
  const next = searchParams.get("next");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("pending");
    setError("");

    const supabase = createClient();
    const callbackUrl = new URL(`${window.location.origin}/auth/callback`);
    if (next) callbackUrl.searchParams.set("next", next);

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: callbackUrl.toString(),
      },
    });

    if (error) {
      setStatus("error");
      setError(error.message);
      return;
    }
    setStatus("sent");
  }

  return (
    <div className="w-full max-w-sm">
      <h1 className="font-heading text-2xl font-semibold tracking-tight text-stone-900 dark:text-stone-50">
        Create your account
      </h1>
      <p className="mt-2 text-sm text-stone-500 dark:text-stone-400">
        {next
          ? "Sign up free to see that page, plus live prices, hot stocks, and your own daily digest."
          : "Follow specific politicians and tickers, and get your own daily email digest — separate from everyone else’s."}
      </p>

      {status === "sent" ? (
        <div className="card-pop accent-rail accent-following mt-6 p-4 text-sm text-stone-700 dark:text-stone-300">
          Check <strong>{email}</strong> for a confirmation link. Once you
          click it, you&apos;ll be signed in automatically.
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-stone-500 dark:text-stone-400">
              Email
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-2xl border border-stone-200 bg-white px-3 py-2.5 text-sm text-stone-900 placeholder:text-stone-400 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand-soft dark:border-white/10 dark:bg-white/5 dark:text-stone-100"
              placeholder="you@example.com"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-stone-500 dark:text-stone-400">
              Password
            </label>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-2xl border border-stone-200 bg-white px-3 py-2.5 text-sm text-stone-900 placeholder:text-stone-400 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand-soft dark:border-white/10 dark:bg-white/5 dark:text-stone-100"
              placeholder="At least 6 characters"
            />
          </div>

          {status === "error" && (
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          )}

          <button
            type="submit"
            disabled={status === "pending"}
            className="mt-1 rounded-full bg-brand px-4 py-2.5 text-sm font-medium text-white transition-transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-60"
          >
            {status === "pending" ? "Creating account..." : "Sign up"}
          </button>
        </form>
      )}

      <p className="mt-6 text-sm text-stone-500 dark:text-stone-400">
        Already have an account?{" "}
        <Link href={next ? `/login?next=${encodeURIComponent(next)}` : "/login"} className="font-medium text-brand hover:underline">
          Log in
        </Link>
      </p>
    </div>
  );
}

export default function SignupPage() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center bg-background px-6 py-16">
      <Suspense fallback={null}>
        <SignupForm />
      </Suspense>
    </div>
  );
}
