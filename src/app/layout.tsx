import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Congress Trades",
  description: "Track stock trades disclosed by members of Congress under the STOCK Act.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col font-sans">{children}</body>
    </html>
  );
}
