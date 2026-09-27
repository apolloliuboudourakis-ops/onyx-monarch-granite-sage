/**
 * Server-only account storage.
 * Do not re-export these from a *.functions.ts file. TanStack Start copies every
 * extra export in those files into the browser, and this database import then
 * fails the page ("importing a module script failed").
 */
import { rankSteps } from "./online";
import type { Match } from "./types";

export async function db() {
  const { getSql } = await import("@/lib/db");
  const sql = await getSql();
  staffReady ??= (async () => {
    await sql.query(`alter table ash_user add column if not exists operator boolean not null default false`);
    await sql.query(`alter table ash_user add column if not exists dev boolean not null default false`);
    await sql.query(`alter table ash_user add column if not exists rp integer not null default 120`);
    await sql.query(`alter table ash_user add column if not exists unlocked text not null default ''`);
    await sql.query(`alter table ash_user add column if not exists coins integer not null default 40`);
    await sql.query(`alter table ash_user add column if not exists mods text not null default ''`);
    await sql.query(`alter table ash_user add column if not exists streak integer not null default 0`);
    await sql.query(`alter table ash_user add column if not exists streak_on text not null default ''`);
    await sql.query(`alter table ash_user add column if not exists focus text not null default ''`);
    await sql.query(`alter table ash_user add column if not exists focus_rp integer not null default 0`);
    await sql.query(`alter table ash_user add column if not exists last_focus text not null default ''`);
    await sql.query(`update ash_user set last_focus = focus where last_focus = '' and focus <> ''`);
    await sql.query(`alter table ash_user add column if not exists rev integer not null default 0`);
    await sql.query(`alter table ash_user add column if not exists staff_role text not null default ''`);
    await sql.query(`alter table ash_user add column if not exists frozen boolean not null default false`);
    await sql.query(`update ash_user set staff_role = 'owner', operator = true, dev = true where lower(username) = 'apollo'`);
    await sql.query(`alter table ash_room add column if not exists talk text not null default '[]'`);
    await sql.query(`update ash_user set operator = true, dev = true where lower(btrim(username)) = 'apollo'`);
    await sql.query(
      `create table if not exists ash_friend (
        owner_id text not null,
        friend_id text not null,
        status text not null,
        primary key (owner_id, friend_id)
      )`,
    );
    await sql.query(
      `create table if not exists ash_invite (
        id text primary key,
        from_id text not null,
        to_id text not null,
        code text not null,
        created_at timestamptz not null default now()
      )`,
    );
    await sql.query(
      `create table if not exists ash_device (
        device text primary key,
        user_id text not null,
        unlocked boolean not null default false
      )`,
    );
  })().catch((err) => {
    console.log("[ashveil] migrate", err);
  });
  await staffReady;
  return sql;
}

export type Sql = Awaited<ReturnType<typeof db>>;

let staffReady: Promise<void> | null = null;


let presenceReady: Promise<void> | null = null;
const stamped = new Map<string, number>();
export const ONLINE_MS = 10 * 60 * 1000;
export async function ensurePresence(sql: Sql) {
  presenceReady ??= sql
    .query(`alter table ash_session add column if not exists seen_at timestamptz not null default now()`)
    .then(() => sql.query(`alter table ash_session add column if not exists seen_ms bigint not null default 0`))
    .then(() => sql.query(`alter table ash_user add column if not exists seen_ms bigint not null default 0`))
    .then(() =>
      sql.query(
        `update ash_session set seen_ms = (extract(epoch from seen_at) * 1000)::bigint where seen_ms = 0`,
      ),
    )
    .then(() => undefined)
    .catch((err) => {
      presenceReady = null;
      throw err;
    });
  await presenceReady;
}


export async function userByToken(token: string) {
  if (!token) return null;
  const sql = await db();
  let rows: {
    id: string;
    username: string;
    rating: number;
    wins: number;
    losses: number;
    operator?: unknown;
    dev?: unknown;
    rp?: number;
    coins?: number;
    unlocked?: string;
    mods?: string;
    streak?: number;
    streak_on?: string;
    focus?: string;
    focus_rp?: number;
    last_focus?: string;
    staff_role?: string;
    rev?: number;
  }[] = [];
  try {
    rows = await sql.query(
      `select u.id, u.username, u.rating, u.wins, u.losses, u.operator, u.dev, u.rp, u.coins, u.unlocked, u.mods, u.streak, u.streak_on, u.focus, u.focus_rp, u.last_focus, u.rev, u.staff_role
       from ash_session s join ash_user u on u.id = s.user_id where s.token = $1`,
      [token],
    );
  } catch {
    rows = await sql.query(
      `select u.id, u.username, u.rating, u.wins, u.losses, u.operator, u.dev, u.rp, u.coins, u.unlocked, u.mods, u.streak, u.streak_on, u.focus, u.focus_rp, u.last_focus
       from ash_session s join ash_user u on u.id = s.user_id where s.token = $1`,
      [token],
    );
  }
  const row = rows[0];
  if (!row) return null;
  try {
    const last = stamped.get(token) ?? 0;
    if (Date.now() - last < 4_000) return row;
    await ensurePresence(sql);
    const now = Date.now();
    await sql.query(`update ash_session set seen_at = now(), seen_ms = $2 where token = $1`, [token, now]);
    await sql.query(`update ash_user set seen_ms = $2 where id = $1`, [row.id, now]);
    stamped.set(token, now);
  } catch {
    /* presence is optional; a failed stamp must not sign the player out */
  }
  return row;
}


export async function grantUnlock(userId: string, ids: string[]) {
  const sql = await db();
  for (const raw of ids) {
    const id = raw.trim();
    if (!id) continue;
    const saved = await sql.query<{ unlocked: string }>(
      `update ash_user set unlocked = case
         when coalesce(unlocked, '') = '' then $2
         when position(',' || $2 || ',' in ',' || unlocked || ',') > 0 then unlocked
         else unlocked || ',' || $2
       end,
       rev = rev + 1
       where id = $1
       returning unlocked`,
      [userId, id],
    );
    const have = String(saved[0]?.unlocked ?? "");
    if (!have.split(",").includes(id)) throw new Error(`discovery ${id} did not save`);
  }
}


export async function pourFocus(userId: string, amount: number): Promise<number> {
  const gain = Math.max(0, Math.round(amount));
  if (!gain) return 0;
  const sql = await db();
  const rows = await sql.query<{ focus: string; focus_rp: number; unlocked: string }>(
    `select focus, focus_rp, unlocked from ash_user where id = $1`,
    [userId],
  );
  const row = rows[0];
  if (!row?.focus) return gain;
  const { RESEARCH, isDiscovered, researchReady } = await import("./catalog");
  let focus = row.focus;
  let bank = Number(row.focus_rp) || 0;
  let unlocked = row.unlocked || "";
  let node = RESEARCH.find((item) => item.id === focus);
  if (!node || isDiscovered(unlocked, focus) || !researchReady(unlocked, focus)) {
    await sql.query(
      `update ash_user set last_focus = case when focus <> '' then focus else last_focus end, focus = '', focus_rp = 0 where id = $1`,
      [userId],
    );
    return gain;
  }
  bank += gain;
  const gained: string[] = [];
  let leftover = 0;
  while (node && bank >= node.rp) {
    bank -= node.rp;
    gained.push(node.id);
    unlocked = [...new Set([...unlocked.split(",").filter(Boolean), node.id])].join(",");
    const kids = RESEARCH.filter((item) => item.after === node!.id);
    if (kids.length === 1 && researchReady(unlocked, kids[0]!.id)) {
      node = kids[0];
      focus = node.id;
      continue;
    }
    leftover = bank;
    focus = "";
    bank = 0;
    break;
  }
  if (gained.length) await grantUnlock(userId, gained);
  const remembered = focus || gained[gained.length - 1] || row.focus;
  await sql.query(`update ash_user set focus = $2, focus_rp = $3, last_focus = $4, rev = rev + 1 where id = $1`, [
    userId,
    focus,
    focus ? bank : 0,
    remembered,
  ]);
  return leftover;
}


export async function grantResearch(userId: string, amount: number) {
  const gain = Math.max(0, Math.round(amount));
  if (!gain) return;
  const leftover = await pourFocus(userId, gain);
  if (leftover <= 0) return;
  const sql = await db();
  await sql.query(`update ash_user set rp = rp + $2, rev = rev + 1 where id = $1`, [userId, leftover]);
}


export function rewardScale(hp: number | undefined, mode?: string): number {
  if (mode && mode !== "strike") return 1;
  const n = Number(hp);
  const base = Number.isFinite(n) && n >= 1 ? Math.min(100, Math.round(n)) : 22;
  return base / 22;
}

export function scaledPay(amount: number, scale: number): number {
  return Math.max(0, Math.round(amount * scale));
}

/** 12 turns is a normal match. Longer games pay more coins, up to four times. */
export function lengthScale(turn: number | undefined): number {
  const turns = Math.max(1, Math.round(Number(turn) || 1));
  return Math.min(4, Math.max(1, turns / 12));
}

function matchHp(match: Match): number {
  const spire = match.structs.find((s) => s.kind === "spire");
  return spire?.max && spire.max > 0 ? spire.max : spire?.hp || 22;
}


export async function finishIfNeeded(code: string, match: Match) {
  if (!match.winner) return;
  const sql = await db();
  const rooms = await sql.query<{ host_id: string; guest_id: string | null; host_rating: number; guest_rating: number; rated: boolean }>(
    `select r.host_id, r.guest_id, h.rating as host_rating, g.rating as guest_rating, r.rated
     from ash_room r
     join ash_user h on h.id = r.host_id
     left join ash_user g on g.id = r.guest_id
     where r.code = $1`,
    [code],
  );
  const room = rooms[0];
  if (!room || room.rated) return;
  if (!room.guest_id) {
    if (!match.bot) return;
    const level = Math.min(10, Math.max(1, Math.round(Number(match.bot) || 1)));
    const scale = rewardScale(matchHp(match), match.mode);
    const length = lengthScale(match.turn);
    const rp = match.winner.player === 0 ? scaledPay(100 + level * 50, scale) : 0;
    const coins = match.winner.player === 0 ? scaledPay((20 + level * 13) * length, scale) : 0;
    if (match.winner.player === 0) {
      await sql.query(`update ash_user set wins = wins + 1, coins = coins + $2, rev = rev + 1 where id = $1`, [room.host_id, coins]);
      await grantResearch(room.host_id, rp);
    } else {
      await sql.query(`update ash_user set losses = losses + 1, rev = rev + 1 where id = $1`, [room.host_id]);
      await pourFocus(room.host_id, scaledPay(40, scale));
    }
    await sql.query(`update ash_room set rated = true, status = 'done' where code = $1`, [code]);
    return;
  }
  const winnerId = match.winner.player === 0 ? room.host_id : room.guest_id;
  const loserId = match.winner.player === 0 ? room.guest_id : room.host_id;
  const winnerRating = match.winner.player === 0 ? room.host_rating : room.guest_rating;
  const loserRating = match.winner.player === 0 ? room.guest_rating : room.host_rating;
  const scale = rewardScale(matchHp(match), match.mode);
  const expected = 1 / (1 + 10 ** ((loserRating - winnerRating) / 400));
  const rawDelta = Math.max(8, Math.round(32 * (1 - expected)));
  const up = Math.max(0, rankSteps(loserRating) - rankSteps(winnerRating));
  const regular = rawDelta + up * 15;
  const left = match.winner.reason.startsWith("The opponent left");
  const gain = left ? Math.max(1, scaledPay(regular / 2, scale)) : scaledPay(regular, scale);
  const ranked = match.ranked === true || typeof match.queueAt === "number";
  const length = lengthScale(match.turn);
  const fullRp = ranked ? 3000 : 1200;
  const fullCoins = (ranked ? 750 : 300) * length;
  const winnerRp = scaledPay(left ? Math.round(fullRp / 2) : fullRp, scale);
  const winnerCoins = scaledPay(left ? Math.round(fullCoins / 2) : fullCoins, scale);
  const loserRp = 0;
  await sql.query(
    `update ash_user set rating = rating + $2, wins = wins + 1, coins = coins + $3, rev = rev + 1 where id = $1`,
    [winnerId, gain, winnerCoins],
  );
  await sql.query(
    `update ash_user set rating = greatest(0, rating - $2), losses = losses + 1, rp = rp + $3, coins = coins + $4, rev = rev + 1 where id = $1`,
    [loserId, scaledPay(rawDelta, scale), loserRp, 0],
  );
  await sql.query(`update ash_room set rated = true, status = 'done' where code = $1`, [code]);
  await grantResearch(winnerId, winnerRp);
  if (!left && loserId) await pourFocus(loserId, scaledPay(50, scale));
}
