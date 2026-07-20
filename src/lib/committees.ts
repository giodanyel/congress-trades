import committeeMembershipRaw from "@/data/committee-membership.json";

// bioguide id -> list of full committee names, sourced from
// unitedstates/congress-legislators (committee-membership-current.yaml),
// filtered to standing committees only (no subcommittees). Politician ids
// in this app are bioguide ids, so this maps directly onto politicians.id.
const committeeMembership = committeeMembershipRaw as Record<string, string[]>;

export function committeesFor(politicianId: string): string[] {
  return committeeMembership[politicianId] ?? [];
}

export type Sector =
  | "Financial Services"
  | "Technology"
  | "Healthcare & Pharma"
  | "Energy"
  | "Defense & Aerospace"
  | "Telecommunications"
  | "Agriculture & Food"
  | "Transportation"
  | "Real Estate"
  | "Utilities"
  | "Mining & Materials"
  | "Industrials";

// Which sectors each committee has direct oversight/jurisdiction over, in
// the sense that matters for a conflict-of-interest read: this committee
// writes the rules, runs the oversight hearings, or controls the budget
// that materially affects companies in this sector. Deliberately excludes
// committees whose reach is too broad to be a meaningful signal
// (Appropriations, Judiciary, Budget, Rules, Oversight, Ethics, Small
// Business, and the joint/select bodies) -- flagging those against nearly
// every trade would be noise, not signal.
const COMMITTEE_SECTORS: Record<string, Sector[]> = {
  "House Committee on Financial Services": ["Financial Services", "Real Estate"],
  "Senate Committee on Banking, Housing, and Urban Affairs": ["Financial Services", "Real Estate"],
  "House Committee on Energy and Commerce": [
    "Energy",
    "Technology",
    "Telecommunications",
    "Healthcare & Pharma",
  ],
  "Senate Committee on Commerce, Science, and Transportation": [
    "Technology",
    "Telecommunications",
    "Transportation",
  ],
  "House Committee on Armed Services": ["Defense & Aerospace"],
  "Senate Committee on Armed Services": ["Defense & Aerospace"],
  "House Committee on Agriculture": ["Agriculture & Food"],
  "Senate Committee on Agriculture, Nutrition, and Forestry": ["Agriculture & Food"],
  "House Committee on Homeland Security": ["Defense & Aerospace", "Technology"],
  "Senate Committee on Homeland Security and Governmental Affairs": [
    "Defense & Aerospace",
    "Technology",
  ],
  "House Permanent Select Committee on Intelligence": ["Defense & Aerospace", "Technology"],
  "Senate Select Committee on Intelligence": ["Defense & Aerospace", "Technology"],
  "House Committee on Foreign Affairs": ["Defense & Aerospace", "Energy"],
  "Senate Committee on Foreign Relations": ["Defense & Aerospace", "Energy"],
  "House Committee on Ways and Means": ["Financial Services", "Healthcare & Pharma"],
  "Senate Committee on Finance": ["Financial Services", "Healthcare & Pharma"],
  "Senate Committee on Health, Education, Labor, and Pensions": ["Healthcare & Pharma"],
  "House Committee on Transportation and Infrastructure": [
    "Transportation",
    "Real Estate",
    "Industrials",
  ],
  "House Committee on Natural Resources": ["Energy", "Mining & Materials", "Utilities"],
  "Senate Committee on Energy and Natural Resources": ["Energy", "Mining & Materials", "Utilities"],
  "House Committee on Science, Space, and Technology": ["Technology", "Defense & Aerospace"],
  "House Committee on Veterans' Affairs": ["Healthcare & Pharma"],
  "Senate Committee on Veterans' Affairs": ["Healthcare & Pharma"],
  "Senate Committee on Environment and Public Works": ["Utilities", "Industrials", "Transportation"],
};

export type ConflictFlag = { committee: string; sector: Sector };

// Committees this politician sits on that have direct jurisdiction over the
// given sector -- the concrete "why this might be worth a second look"
// signal for a trade. Returns every matching committee, not just the first,
// since sitting on multiple relevant committees is itself informative.
export function committeeConflicts(politicianId: string, sector: Sector | null): ConflictFlag[] {
  if (!sector) return [];
  const committees = committeesFor(politicianId);
  const flags: ConflictFlag[] = [];
  for (const committee of committees) {
    const sectors = COMMITTEE_SECTORS[committee];
    if (sectors?.includes(sector)) {
      flags.push({ committee, sector });
    }
  }
  return flags;
}
