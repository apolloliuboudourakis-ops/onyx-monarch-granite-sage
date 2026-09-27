/**
 * Staff roles for Strategic War.
 *
 * The server is the only place that decides who can do what.
 * The browser may hide buttons, but a player can still call the server,
 * so every action is checked again in src/game/staff.functions.ts.
 *
 * To change who starts as Owner, edit OWNER_NAME.
 * To change what Builders may place, edit APPROVED_SPAWN.
 * To change what Admins may hand out, edit APPROVED_GIFTS and COIN_CAP.
 */

export const OWNER_NAME = "apollo";

export const STAFF_ROLES = ["builder", "moderator", "admin", "owner"] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];

const RANK: Record<StaffRole, number> = {
  builder: 1,
  moderator: 2,
  admin: 3,
  owner: 4,
};

/** Buildings a Builder is allowed to place. Anything else is rejected. */
export const APPROVED_SPAWN = ["barrier", "radar", "tower", "mine"] as const;

/** Research ids an Admin may grant. Coins are separate and capped. */
export const APPROVED_GIFTS = ["squad", "marksman", "tank", "radar", "barrier"] as const;

/** How many coins one give action may add. Owner is higher, still capped. */
export const COIN_CAP: Record<"admin" | "owner", number> = {
  admin: 500,
  owner: 10000,
};

/** Settings an Admin may change. The key must be in this list. */
export const APPROVED_SETTINGS = ["motd", "builderNote"] as const;

export function isStaffRole(value: string): value is StaffRole {
  return (STAFF_ROLES as readonly string[]).includes(value);
}

export function roleRank(role: string): number {
  return isStaffRole(role) ? RANK[role] : 0;
}

export function roleAtLeast(role: string, need: StaffRole): boolean {
  return roleRank(role) >= RANK[need];
}

/**
 * Owner can run every tool.
 * Admin can moderate, give approved items, and change approved settings.
 * Moderator can only moderate.
 * Builder can only place, move, and delete approved objects.
 */
export function roleAllows(role: string, tool: "moderate" | "give" | "build" | "settings" | "roles"): boolean {
  if (role === "owner") return true;
  if (tool === "moderate") return role === "admin" || role === "moderator";
  if (tool === "give" || tool === "settings") return role === "admin";
  if (tool === "build") return role === "builder" || role === "admin";
  if (tool === "roles") return role === "admin";
  return false;
}
