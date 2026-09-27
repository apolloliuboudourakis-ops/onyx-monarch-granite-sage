export type PublicUser = {
  id: string;
  username: string;
  rating: number;
  wins: number;
  losses: number;
  rank: string;
  operator: boolean;
  dev: boolean;
  rp: number;
  coins: number;
  unlocked: string;
  mods: string;
  streak: number;
  streakOn: string;
  focus: string;
  focusRp: number;
  lastFocus?: string;
  rev: number;
};

export type FriendRow = PublicUser & { pending?: boolean; incoming?: boolean; online?: boolean };

export function rankName(rating: number): string {
  if (rating >= 1800) return "General";
  if (rating >= 1600) return "Colonel";
  if (rating >= 1400) return "Major";
  if (rating >= 1200) return "Captain";
  if (rating >= 1000) return "Sergeant";
  if (rating >= 800) return "Private";
  return "Recruit";
}

const RANK_ORDER = ["Recruit", "Private", "Sergeant", "Captain", "Major", "Colonel", "General"];

export function mergeIds(a?: string, b?: string): string {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const part of `${a ?? ""},${b ?? ""}`.split(",")) {
    const id = part.trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out.join(",");
}

export function rankSteps(rating: number): number {
  return Math.max(0, RANK_ORDER.indexOf(rankName(rating)));
}

const PLATE_TITLES = [
  "Green Recruit",
  "Sworn Rifle",
  "Watch Sergeant",
  "Captain of the Gate",
  "Major of the Guns",
  "Colonel of Strategic War",
  "General of the Front",
];

export function plateTitle(rating: number, operator?: boolean, dev?: boolean): string {
  const base = PLATE_TITLES[rankSteps(rating)] ?? "Green Recruit";
  const marks = [operator ? "Operator" : "", dev ? "Dev" : ""].filter(Boolean);
  return marks.length ? `${base} · ${marks.join(" · ")}` : base;
}

/** Online turns last this long. The turn ends when it runs out. */
export const ONLINE_TURN_MS = 90 * 1000;
