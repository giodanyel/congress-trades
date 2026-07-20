import type { Trade } from "@/lib/supabase";

export type MarketNews = {
  id: string;
  ticker: string;
  headline: string;
  url: string;
  source: string;
  published_at: string;
  created_at: string;
};

export type QuarterActivity = {
  quarter: "Q1" | "Q2" | "Q3" | "Q4";
  buys: number;
  sells: number;
};

// Congress trading activity for one ticker, broken out by quarter of a
// given year. Lets someone reading a headline see whether Congress has
// actually been buying or selling that name recently, not just that it's
// in the news -- the "Q1/Q2/Q3" correlation piece.
export function quarterlyActivity(ticker: string, trades: Trade[], year: number): QuarterActivity[] {
  const quarters: QuarterActivity[] = [
    { quarter: "Q1", buys: 0, sells: 0 },
    { quarter: "Q2", buys: 0, sells: 0 },
    { quarter: "Q3", buys: 0, sells: 0 },
    { quarter: "Q4", buys: 0, sells: 0 },
  ];
  for (const t of trades) {
    if (t.ticker !== ticker) continue;
    const d = new Date(t.transaction_date);
    if (d.getUTCFullYear() !== year) continue;
    const qIdx = Math.floor(d.getUTCMonth() / 3);
    if (t.trade_type === "PURCHASE") quarters[qIdx].buys++;
    else if (t.trade_type === "SALE") quarters[qIdx].sells++;
  }
  return quarters;
}

// Decode the handful of HTML entities that show up in RSS titles. Not a
// full HTML-entity table on purpose -- headlines are plain text, not markup.
export function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .trim();
}

export type ParsedNewsItem = {
  headline: string;
  url: string;
  source: string;
  publishedAt: string;
};

// Minimal, dependency-free RSS 2.0 parser -- pulls exactly the four fields
// this app needs out of each <item>...</item> block via regex rather than
// pulling in a full XML parsing library for something this small.
export function parseRssItems(xml: string): ParsedNewsItem[] {
  const items: ParsedNewsItem[] = [];
  const itemBlocks = xml.match(/<item\b[\s\S]*?<\/item>/g) ?? [];

  for (const block of itemBlocks) {
    const title = block.match(/<title>([\s\S]*?)<\/title>/)?.[1];
    const link = block.match(/<link>([\s\S]*?)<\/link>/)?.[1];
    const pubDate = block.match(/<pubDate>([\s\S]*?)<\/pubDate>/)?.[1];
    const sourceTag = block.match(/<source[^>]*>([\s\S]*?)<\/source>/)?.[1];
    if (!title || !link) continue;

    const cleanTitle = decodeEntities(title);
    const cleanLink = decodeEntities(link);
    let headline = cleanTitle;
    let source = sourceTag ? decodeEntities(sourceTag) : "";

    // Google News titles are formatted "Headline - Source Name" when the
    // feed doesn't supply a separate <source> tag.
    if (!source) {
      const dash = cleanTitle.lastIndexOf(" - ");
      if (dash > 0) {
        headline = cleanTitle.slice(0, dash);
        source = cleanTitle.slice(dash + 3);
      } else {
        source = "Market news";
      }
    }

    const publishedAt = pubDate ? new Date(pubDate).toISOString() : new Date().toISOString();

    items.push({ headline, url: cleanLink, source, publishedAt });
  }

  return items;
}
