import type { Sector } from "@/lib/committees";

// A curated reference mapping well-known tickers to a primary sector, used
// only to power the committee conflict-of-interest flag. This is NOT
// exhaustive -- it covers large, frequently-traded names across the
// sectors that map to committee jurisdictions. A ticker missing here just
// means no flag is shown for it, never a false "no conflict" claim.
const TICKER_SECTORS: Record<string, Sector> = {
  // Financial services
  JPM: "Financial Services", BAC: "Financial Services", WFC: "Financial Services",
  C: "Financial Services", GS: "Financial Services", MS: "Financial Services",
  USB: "Financial Services", PNC: "Financial Services", TFC: "Financial Services",
  COF: "Financial Services", AXP: "Financial Services", BLK: "Financial Services",
  SCHW: "Financial Services", SPGI: "Financial Services", MCO: "Financial Services",
  ICE: "Financial Services", CME: "Financial Services", NDAQ: "Financial Services",
  V: "Financial Services", MA: "Financial Services", PYPL: "Financial Services",
  ALL: "Financial Services", MET: "Financial Services", PRU: "Financial Services",
  AIG: "Financial Services", TRV: "Financial Services", CB: "Financial Services",
  PGR: "Financial Services", AFL: "Financial Services", BX: "Financial Services",
  KKR: "Financial Services", "BRK.B": "Financial Services",

  // Real estate
  AMT: "Real Estate", PLD: "Real Estate", CCI: "Real Estate", SPG: "Real Estate",
  O: "Real Estate", PSA: "Real Estate", DLR: "Real Estate", WELL: "Real Estate",
  AVB: "Real Estate", EQR: "Real Estate",

  // Technology
  AAPL: "Technology", MSFT: "Technology", GOOGL: "Technology", GOOG: "Technology",
  META: "Technology", NVDA: "Technology", AMD: "Technology", INTC: "Technology",
  CSCO: "Technology", ORCL: "Technology", CRM: "Technology", ADBE: "Technology",
  IBM: "Technology", QCOM: "Technology", TXN: "Technology", AVGO: "Technology",
  NOW: "Technology", PANW: "Technology", FTNT: "Technology", PLTR: "Technology",
  SNOW: "Technology", UBER: "Technology", LYFT: "Technology", ABNB: "Technology",
  MU: "Technology", ADI: "Technology", APH: "Technology", ANET: "Technology",
  DELL: "Technology", HPQ: "Technology", EQIX: "Technology",

  // Telecommunications
  T: "Telecommunications", VZ: "Telecommunications", TMUS: "Telecommunications",
  CMCSA: "Telecommunications", CHTR: "Telecommunications",

  // Healthcare & pharma
  JNJ: "Healthcare & Pharma", PFE: "Healthcare & Pharma", MRK: "Healthcare & Pharma",
  ABBV: "Healthcare & Pharma", LLY: "Healthcare & Pharma", BMY: "Healthcare & Pharma",
  AMGN: "Healthcare & Pharma", GILD: "Healthcare & Pharma", VRTX: "Healthcare & Pharma",
  REGN: "Healthcare & Pharma", MRNA: "Healthcare & Pharma", ABT: "Healthcare & Pharma",
  MDT: "Healthcare & Pharma", TMO: "Healthcare & Pharma", DHR: "Healthcare & Pharma",
  UNH: "Healthcare & Pharma", CVS: "Healthcare & Pharma", CI: "Healthcare & Pharma",
  HUM: "Healthcare & Pharma", ELV: "Healthcare & Pharma", ISRG: "Healthcare & Pharma",
  MCK: "Healthcare & Pharma", ZTS: "Healthcare & Pharma",

  // Energy
  XOM: "Energy", CVX: "Energy", COP: "Energy", SLB: "Energy", OXY: "Energy",
  EOG: "Energy", PSX: "Energy", MPC: "Energy", VLO: "Energy", KMI: "Energy",
  WMB: "Energy", HAL: "Energy", DVN: "Energy",

  // Utilities
  NEE: "Utilities", DUK: "Utilities", SO: "Utilities", D: "Utilities",
  AEP: "Utilities", EXC: "Utilities", XEL: "Utilities", ED: "Utilities",

  // Defense & aerospace
  LMT: "Defense & Aerospace", RTX: "Defense & Aerospace", NOC: "Defense & Aerospace",
  GD: "Defense & Aerospace", BA: "Defense & Aerospace", LHX: "Defense & Aerospace",
  TXT: "Defense & Aerospace", HII: "Defense & Aerospace", AXON: "Defense & Aerospace",

  // Agriculture & food
  ADM: "Agriculture & Food", BG: "Agriculture & Food", DE: "Agriculture & Food",
  MOS: "Agriculture & Food", CF: "Agriculture & Food", KO: "Agriculture & Food",
  PEP: "Agriculture & Food", MDLZ: "Agriculture & Food", GIS: "Agriculture & Food",
  TSN: "Agriculture & Food", HRL: "Agriculture & Food",

  // Transportation
  UPS: "Transportation", FDX: "Transportation", UNP: "Transportation",
  CSX: "Transportation", NSC: "Transportation", DAL: "Transportation",
  UAL: "Transportation", LUV: "Transportation", AAL: "Transportation",

  // Mining & materials
  FCX: "Mining & Materials", NEM: "Mining & Materials", NUE: "Mining & Materials",
  X: "Mining & Materials",

  // Industrials
  HON: "Industrials", GE: "Industrials", MMM: "Industrials", CAT: "Industrials",
  EMR: "Industrials",
};

export function sectorForTicker(ticker: string): Sector | null {
  return TICKER_SECTORS[ticker] ?? null;
}
