import type { Metadata } from "next";
import { Plus_Jakarta_Sans, Sora, IBM_Plex_Mono } from "next/font/google";
import Sidebar from "@/components/Sidebar";
import { createClient } from "@/lib/supabase/server";
import "./globals.css";

// A soft, rounded, highly-readable geometric sans used by a lot of modern
// fintech products -- friendlier and easier to scan than a plain system
// font, without looking playful or unserious.
const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-jakarta",
  display: "swap",
});

// A bolder, slightly condensed display face used only for headings, so
// titles have real visual weight and read as distinct from body copy
// instead of everything blurring into one typographic voice.
const sora = Sora({
  subsets: ["latin"],
  variable: "--font-sora",
  display: "swap",
});

// Used only for tickers, prices, and percentages -- the classic trading
// terminal touch, and it also makes columns of numbers actually line up.
const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-plexmono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Congress Trades",
  description: "Track stock trades disclosed by members of Congress under the STOCK Act.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <html
      lang="en"
      className={`dark h-full antialiased ${jakarta.variable} ${sora.variable} ${plexMono.variable}`}
    >
      <body className="min-h-full font-sans">
        <div className="flex min-h-full flex-col md:flex-row">
          <Sidebar userEmail={user?.email ?? null} />
          <main className="flex flex-1 flex-col">{children}</main>
        </div>
      </body>
    </html>
  );
}
