import { createServerFn } from "@tanstack/react-start";
import { rankName, rankSteps, ONLINE_TURN_MS, type FriendRow, type PublicUser } from "./online";
import type { Cmd, Match, RootState } from "./types";

type Err = { ok: false; error: string };
type UserOk = { ok: true; token: string; user: PublicUser };
type MeOk = { ok: true; user: PublicUser };
type FriendsOk = {
  ok: true;
  friends: FriendRow[];
  incoming: FriendRow[];
  outgoing: FriendRow[];
  players: FriendRow[];
  invites: { code: string; from: string }[];
};
type BoardOk = { ok: true; board: PublicUser[] };
export type RoomOk = {
  ok: true;
  code: string;
  status: string;
  seat: 0 | 1;
  version: number;
  host: string;
  guest: string | null;
  mapId: string;
  state: RootState | null;
  deadline: number | null;
  talk: { name: string; text: string }[];
};

function isApollo(name: string) {
  return name.trim().replace(/ +/g, " ").toLowerCase() === "apollo";
}

function isOn(value: unknown) {
  if (value === true || value === "t" || value === "true" || value === "1" || value === 1) return true;
  if (typeof value === "bigint") return value !== BigInt(0);
  return false;
}

function publicUser(row: { id: string; username: string; rating: number; wins: number; losses: number; operator?: unknown; dev?: unknown; rp?: number; coins?: number; unlocked?: string; mods?: string; streak?: number; streak_on?: string; focus?: string; focus_rp?: number; last_focus?: string; rev?: number }): PublicUser {
  return {
    id: row.id,
    username: row.username,
    rating: row.rating,
    wins: row.wins,
    losses: row.losses,
    rank: [rankName(row.rating), isOn(row.operator) ? "Operator" : "", isOn(row.dev) ? "Dev" : ""].filter(Boolean).join(" · "),
    operator: isOn(row.operator),
    dev: isOn(row.dev),
    rp: Number(row.rp) || 0,
    coins: Number(row.coins) || 0,
    unlocked: row.unlocked || "",
    mods: row.mods || "",
    streak: Number(row.streak) || 0,
    streakOn: row.streak_on || "",
    focus: row.focus || "",
    focusRp: Number(row.focus_rp) || 0,
    lastFocus: row.last_focus || row.focus || "",
    rev: Number(row.rev) || 0,
  };
}

async function db() {
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

let staffReady: Promise<void> | null = null;

let presenceReady: Promise<void> | null = null;
const stamped = new Map<string, number>();
const ONLINE_MS = 10 * 60 * 1000;
async function ensurePresence(sql: Awaited<ReturnType<typeof db>>) {
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

async function userByToken(token: string) {
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
    rev?: number;
  }[] = [];
  try {
    rows = await sql.query(
      `select u.id, u.username, u.rating, u.wins, u.losses, u.operator, u.dev, u.rp, u.coins, u.unlocked, u.mods, u.streak, u.streak_on, u.focus, u.focus_rp, u.last_focus, u.rev
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

function pack(match: Match): string {
  const { history: _h, ...rest } = match;
  return JSON.stringify(rest);
}

async function tickRoom(code: string) {
  const sql = await db();
  const rows = await sql.query<{ state: string; status: string; version: number; host_id: string; guest_id: string | null }>(
    `select state, status, version, host_id, guest_id from ash_room where code = $1`,
    [code],
  );
  const room = rows[0];
  if (!room || room.status !== "active") return;
  const match = JSON.parse(room.state) as Match;
  const now = Date.now();
  if (match.winner) return;
  if (room.guest_id) {
    try {
      const seen = await sql.query<{ id: string; seen: string | null }>(
        `select u.id, max(s.seen_at) as seen
         from ash_user u
         left join ash_session s on s.user_id = u.id
         where u.id in ($1, $2)
         group by u.id`,
        [room.host_id, room.guest_id],
      );
      const stale = (id: string) => {
        const row = seen.find((item) => item.id === id);
        if (!row?.seen) return true;
        const at = Date.parse(String(row.seen));
        return !Number.isFinite(at) || Date.now() - at > 180_000;
      };
      const hostGone = stale(room.host_id);
      const guestGone = stale(room.guest_id);
      if (hostGone !== guestGone) {
        const winner = hostGone ? 1 : 0;
        match.winner = { player: winner, reason: "The opponent left. You win." };
        match.clock = null;
        match.log[winner] = [...(match.log[winner] ?? []), "Opponent left the match."].slice(-40);
        const saved = await sql.query(
          `update ash_room set state = $2, version = version + 1, status = 'done', updated_at = now()
           where code = $1 and status = 'active' and version = $3 returning version`,
          [code, pack(match), room.version],
        );
        if (saved.length) await finishIfNeeded(code, match);
        return;
      }
    } catch {
      /* presence is optional */
    }
  }
  if (!match.clock || match.clock > now) {
    if (match.clock) return;
    match.clock = now + ONLINE_TURN_MS;
    await sql.query(
      `update ash_room set state = $2, version = version + 1, updated_at = now() where code = $1 and version = $3`,
      [code, pack(match), room.version],
    );
    return;
  }
  match.log[match.active] = [...(match.log[match.active] ?? []), "Time ran out."].slice(-40);
  const { apply, settleOnline } = await import("./logic");
  let root: RootState = { screen: "battle", match, help: false, hasSave: false };
  root = apply(root, { type: "ask-end" });
  root = apply(root, { type: "confirm-end", now });
  root = settleOnline(root, now);
  if (!root.match) return;
  root.match.clock = root.match.winner ? null : now + ONLINE_TURN_MS;
  const saved = await sql.query(
    `update ash_room set state = $2, version = version + 1, status = $3, updated_at = now()
     where code = $1 and version = $4 returning version`,
    [code, pack(root.match), root.match.winner ? "done" : "active", room.version],
  );
  if (saved.length && root.match.winner) await finishIfNeeded(code, root.match);
}

async function grantUnlock(userId: string, ids: string[]) {
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

async function ensureKit(userId: string, unlocked: string | undefined) {
  const { BASIC_KIT } = await import("./catalog");
  const have = new Set(String(unlocked || "").split(",").map((id) => id.trim()).filter(Boolean));
  const missing = BASIC_KIT.filter((id) => !have.has(id));
  if (missing.length) await grantUnlock(userId, [...missing]);
}

async function pourFocus(userId: string, amount: number): Promise<number> {
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

/** Research fills the focused unit. Anything that does not fit stays in the pool. */
async function grantResearch(userId: string, amount: number) {
  const gain = Math.max(0, Math.round(amount));
  if (!gain) return;
  const leftover = await pourFocus(userId, gain);
  if (leftover <= 0) return;
  const sql = await db();
  await sql.query(`update ash_user set rp = rp + $2, rev = rev + 1 where id = $1`, [userId, leftover]);
}

/** Move research already in the pool onto the focused unit. */
async function sinkResearch(userId: string) {
  const sql = await db();
  const taken = await sql.query<{ rp: number }>(
    `update ash_user set rp = 0 where id = $1 and focus <> '' and rp > 0 returning rp`,
    [userId],
  );
  const pool = Math.max(0, Math.round(Number(taken[0]?.rp) || 0));
  if (!pool) return;
  const leftover = await pourFocus(userId, pool);
  if (leftover > 0) await sql.query(`update ash_user set rp = rp + $2, rev = rev + 1 where id = $1`, [userId, leftover]);
}

function rewardScale(hp: number | undefined, mode?: string): number {
  if (mode && mode !== "strike") return 1;
  const n = Number(hp);
  const base = Number.isFinite(n) && n >= 1 ? Math.min(100, Math.round(n)) : 22;
  return base / 22;
}

function scaledPay(amount: number, scale: number): number {
  return Math.max(0, Math.round(amount * scale));
}

/** 12 turns is a normal match. Longer games pay more coins, up to four times. */
function lengthScale(turn: number | undefined): number {
  const turns = Math.max(1, Math.round(Number(turn) || 1));
  return Math.min(4, Math.max(1, turns / 12));
}

function matchHp(match: Match): number {
  const spire = match.structs.find((s) => s.kind === "spire");
  return spire?.max && spire.max > 0 ? spire.max : spire?.hp || 22;
}

async function finishIfNeeded(code: string, match: Match) {
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

function cleanDevice(raw: unknown): string {
  const id = String(raw ?? "").trim();
  return /^[A-Za-z0-9_-]{12,80}$/.test(id) ? id : "";
}

/** Remember which account used this computer. A correct password is always allowed in. */
async function deviceGate(sql: Awaited<ReturnType<typeof db>>, device: string, userId: string, _staff: boolean): Promise<string | null> {
  const id = cleanDevice(device);
  if (!id) return null;
  try {
    await sql.query(
      `insert into ash_device (device, user_id, unlocked) values ($1, $2, true)
       on conflict (device) do update set user_id = $2, unlocked = true`,
      [id, userId],
    );
  } catch (err) {
    console.log("[ashveil] device", err);
  }
  return null;
}

export const accountRegister = createServerFn({ method: "POST" })
  .validator((data: { username: string; password: string; device?: string }) => data)
  .handler(async ({ data }): Promise<UserOk | Err> => {
    try {
    const username = data.username.trim().replace(/ +/g, " ");
    const password = data.password;
    if (!/^[A-Za-z0-9_]+(?: [A-Za-z0-9_]+)*$/.test(username) || username.length < 3 || username.length > 16) {
      return { ok: false, error: "Name must be 3–16 letters, numbers, or single spaces." };
    }
    if (password.length < 4 || password.length > 72) return { ok: false, error: "Password must be 4–72 characters." };
    const { randomBytes, scryptSync } = await import("node:crypto");
    const sql = await db();
    const taken = await sql.query(`select id from ash_user where lower(username) = lower($1)`, [username]);
    if (taken.length) return { ok: false, error: "That name is taken." };
    const salt = randomBytes(16).toString("hex");
    const hash = scryptSync(password, salt, 32).toString("hex");
    const id = `u_${randomBytes(8).toString("hex")}`;
    const token = randomBytes(24).toString("hex");
    const staff = username.toLowerCase() === "apollo";
    await sql.query(
      `insert into ash_user (id, username, password_hash, operator, dev) values ($1, $2, $3, $4, $5)`,
      [id, username, `${salt}:${hash}`, staff, staff],
    );
    await sql.query(`insert into ash_session (token, user_id) values ($1, $2)`, [token, id]);
    await ensureKit(id, "");
    const row = await userByToken(token);
    const user = row
      ? publicUser(row)
      : publicUser({ id, username, rating: 1000, wins: 0, losses: 0, operator: staff, dev: staff, rp: 120, coins: 40, unlocked: "", mods: "", focus: "", focus_rp: 0 });
    return { ok: true, token, user };
    } catch (err) {
      console.log("[ashveil] register", err);
      return { ok: false, error: "Could not create that account. Try again." };
    }
  });

export const accountLogin = createServerFn({ method: "POST" })
  .validator((data: { username: string; password: string; device?: string }) => data)
  .handler(async ({ data }): Promise<UserOk | Err> => {
    try {
    const { scryptSync, randomBytes } = await import("node:crypto");
    const sql = await db();
    const name = data.username.trim().replace(/ +/g, " ");
    const password = data.password;
    if (!/^[A-Za-z0-9_]+(?: [A-Za-z0-9_]+)*$/.test(name) || name.length < 3 || name.length > 16) {
      return { ok: false, error: "Name must be 3–16 letters, numbers, or single spaces." };
    }
    if (password.length < 4 || password.length > 72) return { ok: false, error: "Password must be 4–72 characters." };
    const apollo = isApollo(name);
    const hashPassword = () => {
      const salt = randomBytes(16).toString("hex");
      const hash = scryptSync(password, salt, 32).toString("hex");
      return `${salt}:${hash}`;
    };
    let rows: { id: string; username: string; password_hash: string; unlocked?: string; operator?: unknown; dev?: unknown; rating?: number; wins?: number; losses?: number }[] = [];
    try {
      rows = await sql.query(
        `select id, username, password_hash, rating, wins, losses, operator, dev, rp, coins, unlocked, mods, streak, streak_on, focus, focus_rp, rev from ash_user where lower(username) = lower($1)`,
        [name],
      );
    } catch {
      rows = await sql.query(
        `select id, username, password_hash, rating, wins, losses from ash_user where lower(username) = lower($1)`,
        [name],
      );
    }
    let row = rows[0];
    let matched = false;
    for (const candidate of rows) {
      const [salt, hash] = String(candidate.password_hash || "").split(":");
      if (!salt || !hash) continue;
      try {
        const { timingSafeEqual } = await import("node:crypto");
        const next = scryptSync(password, salt, 32);
        const prev = Buffer.from(hash, "hex");
        if (prev.length === next.length && timingSafeEqual(prev, next)) {
          row = candidate;
          matched = true;
          break;
        }
      } catch {
        /* try the next saved row */
      }
    }
    if (!row) {
      const id = `u_${randomBytes(8).toString("hex")}`;
      const token = randomBytes(24).toString("hex");
      await sql.query(
        `insert into ash_user (id, username, password_hash, operator, dev) values ($1, $2, $3, $4, $5)`,
        [id, name, hashPassword(), apollo, apollo],
      );
      await sql.query(`insert into ash_session (token, user_id) values ($1, $2)`, [token, id]);
      try {
        await ensureKit(id, "");
      } catch (err) {
        console.log("[ashveil] kit on login", err);
      }
      const fresh = await userByToken(token);
      const user = fresh
        ? publicUser(fresh)
        : publicUser({ id, username: name, rating: 1000, wins: 0, losses: 0, operator: apollo, dev: apollo, rp: 120, coins: 40, unlocked: "", mods: "", focus: "", focus_rp: 0 });
      return { ok: true, token, user };
    }
    if (!matched) {
      await sql.query(`update ash_user set password_hash = $2 where id = $1`, [row.id, hashPassword()]);
    }
    if (apollo || isApollo(row.username)) {
      try {
        await sql.query(`update ash_user set operator = true, dev = true where id = $1`, [row.id]);
      } catch (err) {
        console.log("[ashveil] apollo flag", err);
      }
    }
    const token = randomBytes(24).toString("hex");
    await sql.query(`insert into ash_session (token, user_id) values ($1, $2)`, [token, row.id]);
    try {
      await ensureKit(row.id, row.unlocked);
    } catch (err) {
      console.log("[ashveil] kit on login", err);
    }
    const fresh = await userByToken(token);
    return { ok: true, token, user: publicUser(fresh ?? { ...row, username: row.username || name, rating: row.rating ?? 1000, wins: row.wins ?? 0, losses: row.losses ?? 0 }) };
    } catch (err) {
      console.log("[ashveil] login", err);
      const msg = err instanceof Error ? err.message : "";
      return { ok: false, error: msg && msg.length < 140 ? msg : "Could not sign in. Try again." };
    }
  });

export const accountMe = createServerFn({ method: "POST" })
  .validator((data: { token: string }) => data)
  .handler(async ({ data }): Promise<MeOk | Err> => {
    try {
      const row = await userByToken(data.token);
      if (!row) return { ok: false, error: "Sign in again." };
      await ensureKit(row.id, row.unlocked);
      await sinkResearch(row.id);
      const fresh = await userByToken(data.token);
      return { ok: true, user: publicUser(fresh ?? row) };
    } catch (err) {
      console.log("[ashveil] account", err);
      return { ok: false, error: "Could not refresh the account. Try again." };
    }
  });

export const accountResearch = createServerFn({ method: "POST" })
  .validator((data: { token: string; id: string; coins?: number; finish?: boolean }) => data)
  .handler(async ({ data }): Promise<MeOk | Err> => {
    try {
    const me = await userByToken(data.token);
    if (!me) return { ok: false, error: "Sign in again." };
    const { RESEARCH, isDiscovered, researchReady } = await import("./catalog");
    const node = RESEARCH.find((item) => item.id === data.id);
    if (!node) return { ok: false, error: "That is not on a research line." };
    if (isDiscovered(me.unlocked, node.id)) return { ok: false, error: "You already discovered that." };
    if (!researchReady(me.unlocked, node.id)) return { ok: false, error: "Discover the unit before it on that line first." };
    const banked = me.focus === node.id ? Number(me.focus_rp) || 0 : 0;
    const cost = Math.max(0, Math.round(node.rp));
    const left = Math.max(0, cost - banked);
    const purse = Math.max(0, Math.round(Number(me.coins) || 0));
    const pool = Math.max(0, Math.round(Number(me.rp) || 0));
    const asked = Math.max(0, Math.round(Number(data.coins) || 0));
    const sql = await db();
    const remember = async () => {
      const row = await userByToken(data.token);
      if (!row) return { ok: false as const, error: "Sign in again." };
      return { ok: true as const, user: publicUser(row) };
    };
    if (!data.finish) {
      const coinsUsed = Math.min(asked > 0 ? asked : purse, purse, left);
      if (left <= 0) return { ok: false, error: "That unit is already filled. Press Discover." };
      if (coinsUsed <= 0) return { ok: false, error: "You have no coins to add." };
      if (me.focus && me.focus !== node.id && Number(me.focus_rp) > 0) {
        return { ok: false, error: "Press Focus on this unit first. Your other focus still has progress." };
      }
      const filled = banked + coinsUsed;
      if (filled < cost) {
        const saved = await sql.query(
          `update ash_user set coins = coins - $2, focus = $3, last_focus = $3, focus_rp = $4, rev = rev + 1
           where id = $1 and coins >= $2 returning id`,
          [me.id, coinsUsed, node.id, filled],
        );
        if (!saved.length) return { ok: false, error: "Not enough coins." };
        return remember();
      }
      const saved = await sql.query(
        `update ash_user set coins = coins - $2,
           last_focus = case when focus = $3 or last_focus = '' then $3 else last_focus end,
           focus = case when focus = $3 then '' else focus end,
           focus_rp = case when focus = $3 then 0 else focus_rp end,
           rev = rev + 1
         where id = $1 and coins >= $2 returning id`,
        [me.id, coinsUsed, node.id],
      );
      if (!saved.length) return { ok: false, error: "Not enough coins." };
      await grantUnlock(me.id, [node.id]);
      return remember();
    }
    const coinsUsed = Math.min(asked, purse, left);
    const rpNeeded = left - coinsUsed;
    if (pool < rpNeeded) return { ok: false, error: `Need ${rpNeeded} research. You have ${pool}.` };
    const saved = await sql.query(
      `update ash_user set rp = greatest(0, rp - $2), coins = greatest(0, coins - $3),
         last_focus = case when focus = $4 or last_focus = '' then $4 else last_focus end,
         focus = case when focus = $4 then '' else focus end,
         focus_rp = case when focus = $4 then 0 else focus_rp end,
         rev = rev + 1
       where id = $1 and rp >= $2 and coins >= $3 returning id`,
      [me.id, rpNeeded, coinsUsed, node.id],
    );
    if (!saved.length) return { ok: false, error: "Not enough research or coins." };
    await grantUnlock(me.id, [node.id]);
    const row = await userByToken(data.token);
    if (!row) return { ok: false, error: "Sign in again." };
    if (!String(row.unlocked || "").split(",").includes(node.id)) {
      return { ok: false, error: "The discovery did not save on the account. Try again." };
    }
    return { ok: true, user: publicUser(row) };
    } catch (err) {
      console.log("[ashveil] research", err);
      return { ok: false, error: "Could not save that discovery. Try again." };
    }
  });

export const accountKeep = createServerFn({ method: "POST" })
  .validator((data: { token: string; unlocked: string }) => data)
  .handler(async ({ data }): Promise<MeOk | Err> => {
    try {
      const me = await userByToken(data.token);
      if (!me) return { ok: false, error: "Sign in again." };
      const { BASIC_KIT, RESEARCH } = await import("./catalog");
      const allowed = new Set<string>([...RESEARCH.map((node) => node.id), ...BASIC_KIT]);
      const have = new Set(String(me.unlocked || "").split(",").map((id) => id.trim()).filter(Boolean));
      const add = String(data.unlocked || "")
        .split(",")
        .map((id) => id.trim())
        .filter((id) => allowed.has(id as never) && !have.has(id));
      if (add.length) await grantUnlock(me.id, add);
      const row = await userByToken(data.token);
      if (!row) return { ok: false, error: "Sign in again." };
      return { ok: true, user: publicUser(row) };
    } catch (err) {
      console.log("[ashveil] keep", err);
      return { ok: false, error: "Could not save discoveries." };
    }
  });

export const accountFocus = createServerFn({ method: "POST" })
  .validator((data: { token: string; id: string }) => data)
  .handler(async ({ data }): Promise<MeOk | Err> => {
    const me = await userByToken(data.token);
    if (!me) return { ok: false, error: "Sign in again." };
    const { researchReady } = await import("./catalog");
    if (!researchReady(me.unlocked, data.id)) return { ok: false, error: "Discover the unit before that one first." };
    const sql = await db();
    await sql.query(
      `update ash_user set focus = $2, last_focus = $2, focus_rp = case when focus = $2 then focus_rp else 0 end, rev = rev + 1 where id = $1`,
      [me.id, data.id],
    );
    await sinkResearch(me.id);
    const row = await userByToken(data.token);
    if (!row) return { ok: false, error: "Sign in again." };
    return { ok: true, user: publicUser(row) };
  });

export const accountUpgrade = createServerFn({ method: "POST" })
  .validator((data: { token: string; id: string; slot: string }) => data)
  .handler(async ({ data }): Promise<MeOk | Err> => {
    const me = await userByToken(data.token);
    if (!me) return { ok: false, error: "Sign in again." };
    const { MOD_OFFERS, UNIT_BY, isDiscovered, isUnitKind, modKey, ownsMod } = await import("./catalog");
    const offer = MOD_OFFERS.find((item) => item.slot === data.slot);
    if (!offer || !isUnitKind(data.id)) return { ok: false, error: "That upgrade does not exist." };
    if (!isDiscovered(me.unlocked, data.id)) return { ok: false, error: "Research that unit before you upgrade it." };
    if (ownsMod(me.mods, data.id, offer.slot)) return { ok: false, error: "Already upgraded." };
    const def = UNIT_BY[data.id];
    if (offer.slot === "gun" && def.atk <= 0) return { ok: false, error: "That unit has no gun." };
    if (offer.slot === "engine" && def.move <= 0) return { ok: false, error: "That unit does not move." };
    if ((me.coins ?? 0) < offer.coins) return { ok: false, error: `Need ${offer.coins} coins.` };
    const next = [...new Set([...(me.mods ?? "").split(",").filter(Boolean), modKey(data.id, offer.slot)])].join(",");
    const sql = await db();
    const saved = await sql.query(
      `update ash_user set coins = coins - $2, mods = $3, rev = rev + 1 where id = $1 and coins >= $2 returning id`,
      [me.id, offer.coins, next],
    );
    if (!saved.length) return { ok: false, error: "Not enough coins." };
    const row = await userByToken(data.token);
    if (!row) return { ok: false, error: "Sign in again." };
    return { ok: true, user: publicUser(row) };
  });

const CHESTS = {
  field: { coins: 40, rp: [50, 90], name: "Field chest", rolls: 1 },
  supply: { coins: 90, rp: [120, 200], name: "Supply chest", rolls: 2 },
  arsenal: { coins: 160, rp: [240, 360], name: "Arsenal chest", rolls: 3 },
} as const;

type ChestLoot = { rp: number; coins: number; lines: string[] };

function pickOne<T>(rows: T[]): T | undefined {
  if (!rows.length) return undefined;
  return rows[Math.floor(Math.random() * rows.length)];
}

async function rollChestGoods(
  me: { unlocked?: string; mods?: string; focus?: string },
  rolls: number,
  coinSpan: [number, number],
): Promise<{ lines: string[]; bonusCoins: number; extraRp: number; unlocks: string[]; mods: string; focus: number }> {
  const { RESEARCH, UNIT_BY, STRUCT_BY, isUnitKind, isDiscovered, researchReady, ownsMod, modKey, MOD_OFFERS } = await import("./catalog");
  const nameOf = (id: string) => (isUnitKind(id) ? UNIT_BY[id].name : STRUCT_BY[id as "radar"]?.name || id);
  let unlocked = me.unlocked || "";
  let mods = me.mods || "";
  const lines: string[] = [];
  const unlocks: string[] = [];
  let bonusCoins = 0;
  let extraRp = 0;
  let focus = 0;
  const bag = ["coins", "unit", "upgrade", "focus", "research"];
  for (let i = bag.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const swap = bag[i]!;
    bag[i] = bag[j]!;
    bag[j] = swap;
  }
  const take = bag.slice(0, Math.max(1, rolls));
  for (const kind of take) {
    if (kind === "coins") {
      const n = coinSpan[0] + Math.floor(Math.random() * (coinSpan[1] - coinSpan[0] + 1));
      bonusCoins += n;
      lines.push(`${n} coins`);
    } else if (kind === "research") {
      const n = 15 + Math.floor(Math.random() * 25);
      extraRp += n;
      lines.push(`${n} more research`);
    } else if (kind === "unit") {
      const ready = RESEARCH.filter((node) => researchReady(unlocked, node.id) && !unlocks.includes(node.id));
      const node = pickOne(ready);
      if (!node) {
        const n = coinSpan[0];
        bonusCoins += n;
        lines.push(`${n} coins`);
      } else {
        unlocks.push(node.id);
        unlocked = unlocked ? `${unlocked},${node.id}` : node.id;
        lines.push(`${nameOf(node.id)} discovered`);
      }
    } else if (kind === "upgrade") {
      const owned = [...new Set(unlocked.split(",").map((id) => id.trim()).filter((id) => isUnitKind(id) && isDiscovered(unlocked, id)))];
      const options: { id: string; slot: "gun" | "engine" | "plate"; label: string }[] = [];
      for (const id of owned) {
        const def = UNIT_BY[id];
        for (const offer of MOD_OFFERS) {
          if (ownsMod(mods, id, offer.slot)) continue;
          if (offer.slot === "gun" && def.atk <= 0) continue;
          if (offer.slot === "engine" && def.move <= 0) continue;
          options.push({ id, slot: offer.slot, label: `${offer.name} on ${def.name}` });
        }
      }
      const hit = pickOne(options);
      if (!hit) {
        const n = 15 + Math.floor(Math.random() * 20);
        extraRp += n;
        lines.push(`${n} more research`);
      } else {
        mods = [...new Set([...mods.split(",").filter(Boolean), modKey(hit.id, hit.slot)])].join(",");
        lines.push(hit.label);
      }
    } else if (me.focus) {
      const n = 20 * Math.max(1, rolls);
      focus += n;
      lines.push(`${n} toward your focus`);
    } else {
      const n = 15 + Math.floor(Math.random() * 20);
      extraRp += n;
      lines.push(`${n} more research`);
    }
  }
  return { lines, bonusCoins, extraRp, unlocks, mods, focus };
}

function todayStamp() {
  return new Date().toISOString().slice(0, 10);
}

function yesterdayStamp() {
  const day = new Date();
  day.setUTCDate(day.getUTCDate() - 1);
  return day.toISOString().slice(0, 10);
}

export const accountChest = createServerFn({ method: "POST" })
  .validator((data: { token: string; kind: string }) => data)
  .handler(async ({ data }): Promise<{ ok: true; user: PublicUser; note: string; loot: ChestLoot } | Err> => {
    const me = await userByToken(data.token);
    if (!me) return { ok: false, error: "Sign in again." };
    const sql = await db();
    if (data.kind === "daily") {
      const today = todayStamp();
      if (me.streak_on === today) return { ok: false, error: "Daily chest already claimed. Come back tomorrow." };
      const streak = me.streak_on === yesterdayStamp() ? Math.min(7, (me.streak ?? 0) + 1) : 1;
      const rp = 25 * streak;
      const coins = 6 * streak;
      const extra = await rollChestGoods(me, 1, [4, 12]);
      const totalRp = rp + extra.extraRp;
      await sql.query(
        `update ash_user set coins = coins + $2, mods = $3, streak = $4, streak_on = $5, rev = rev + 1 where id = $1`,
        [me.id, coins + extra.bonusCoins, extra.mods, streak, today],
      );
      if (extra.unlocks.length) await grantUnlock(me.id, extra.unlocks);
      await grantResearch(me.id, totalRp + extra.focus);
      const row = await userByToken(data.token);
      if (!row) return { ok: false, error: "Sign in again." };
      const lines = [`${rp} research`, `${coins} coins`, ...extra.lines];
      return { ok: true, user: publicUser(row), note: `Day ${streak} chest.`, loot: { rp: totalRp, coins: coins + extra.bonusCoins, lines } };
    }
    const chest = CHESTS[data.kind as keyof typeof CHESTS];
    if (!chest) return { ok: false, error: "That chest is not for sale." };
    if ((me.coins ?? 0) < chest.coins) return { ok: false, error: `Need ${chest.coins} coins.` };
    const rp = chest.rp[0] + Math.floor(Math.random() * (chest.rp[1] - chest.rp[0] + 1));
    const span: [number, number] = data.kind === "arsenal" ? [20, 50] : data.kind === "supply" ? [12, 30] : [6, 18];
    const extra = await rollChestGoods(me, chest.rolls, span);
    const totalRp = rp + extra.extraRp;
    const saved = await sql.query(
      `update ash_user set coins = coins - $2 + $3, mods = $4, rev = rev + 1 where id = $1 and coins >= $2 returning id`,
      [me.id, chest.coins, extra.bonusCoins, extra.mods],
    );
    if (!saved.length) return { ok: false, error: "Not enough coins." };
    if (extra.unlocks.length) await grantUnlock(me.id, extra.unlocks);
    await grantResearch(me.id, totalRp + extra.focus);
    const row = await userByToken(data.token);
    if (!row) return { ok: false, error: "Sign in again." };
    const lines = [`${rp} research`, ...extra.lines];
    return { ok: true, user: publicUser(row), note: `${chest.name} opened.`, loot: { rp: totalRp, coins: extra.bonusCoins, lines } };
  });

export const accountScore = createServerFn({ method: "POST" })
  .validator((data: { token: string; won: boolean; bot?: number; hqHp?: number; turn?: number }) => data)
  .handler(async ({ data }): Promise<MeOk | Err> => {
    const me = await userByToken(data.token);
    if (!me) return { ok: false, error: "Sign in again." };
    const level = Math.min(10, Math.max(1, Math.round(Number(data.bot) || 1)));
    const scale = rewardScale(data.hqHp, "strike");
    const rp = data.won ? scaledPay(100 + level * 50, scale) : 0;
    const coins = data.won ? scaledPay((20 + level * 13) * lengthScale(data.turn), scale) : 0;
    const sql = await db();
    await sql.query(`update ash_user set coins = coins + $2, rev = rev + 1 where id = $1`, [me.id, coins]);
    if (data.won) await grantResearch(me.id, rp);
    else await pourFocus(me.id, scaledPay(40, scale));
    const row = await userByToken(data.token);
    if (!row) return { ok: false, error: "Sign in again." };
    return { ok: true, user: publicUser(row) };
  });

export const accountLogout = createServerFn({ method: "POST" })
  .validator((data: { token: string }) => data)
  .handler(async ({ data }): Promise<{ ok: true }> => {
    const sql = await db();
    await sql.query(`delete from ash_session where token = $1`, [data.token]);
    return { ok: true };
  });

export const friendList = createServerFn({ method: "POST" })
  .validator((data: { token: string }) => data)
  .handler(async ({ data }): Promise<FriendsOk | Err> => {
    try {
    const me = await userByToken(data.token);
    if (!me) return { ok: false, error: "Sign in again." };
    const sql = await db();
    let everyone: { id: string; username: string; rating: number; wins: number; losses: number; operator?: unknown; dev?: unknown; coins?: unknown; seen_ms?: unknown }[] = [];
    try {
      everyone = await sql.query(
        `select id, username, rating, wins, losses, operator, dev, coins, seen_ms
         from ash_user order by lower(username)`,
      );
    } catch {
      everyone = await sql.query(
        `select id, username, rating, wins, losses
         from ash_user order by lower(username)`,
      );
    }
    const cutoff = Date.now() - ONLINE_MS;
    const onlineOf = new Map(everyone.map((row) => [String(row.id), Number(row.seen_ms) > cutoff]));
    const withOnline = (row: { id: string; username: string; rating: number; wins: number; losses: number; operator?: unknown; dev?: unknown; coins?: unknown }) => ({
      ...publicUser({
        ...row,
        id: String(row.id),
        username: String(row.username || ""),
        rating: Number(row.rating) || 0,
        wins: Number(row.wins) || 0,
        losses: Number(row.losses) || 0,
        coins: Number(row.coins) || 0,
      }),
      online: onlineOf.get(String(row.id)) === true,
    });
    const players = everyone.map(withOnline).filter((row) => row.id && row.username);
    try {
      await ensurePresence(sql);
      await sql.query(`update ash_user set seen_ms = $2 where id = $1`, [me.id, Date.now()]);
    } catch {
      /* online dots can wait; the names still have to load */
    }
    try {
      await sql.query(
        `insert into ash_friend (owner_id, friend_id, status)
         select f.friend_id, f.owner_id, 'accepted' from ash_friend f
         where f.status = 'accepted'
         on conflict (owner_id, friend_id) do update set status = 'accepted'`,
      );
    } catch (err) {
      console.log("[ashveil] friend repair", err);
    }
    const safeUser = (row: { id: string; username: string; rating: number; wins: number; losses: number; operator?: unknown; dev?: unknown; coins?: unknown }) => {
      const user = publicUser({
        ...row,
        rating: Number(row.rating) || 0,
        wins: Number(row.wins) || 0,
        losses: Number(row.losses) || 0,
        coins: Number(row.coins) || 0,
      });
      return user;
    };
    let friends: FriendRow[] = [];
    try {
      const rows = await sql.query<{ id: string; username: string; rating: number; wins: number; losses: number }>(
        `select distinct on (u.id) u.id, u.username, u.rating, u.wins, u.losses, u.operator, u.dev, u.coins
         from ash_friend f
         join ash_user u on u.id = case when f.owner_id = $1 then f.friend_id else f.owner_id end
         where f.status = 'accepted' and (f.owner_id = $1 or f.friend_id = $1) and u.id <> $1
         order by u.id`,
        [me.id],
      );
      friends = rows.map((row) => safeUser(row));
    } catch (err) {
      console.log("[ashveil] friend rows", err);
    }
    let incoming: FriendRow[] = [];
    try {
      const rows = await sql.query<{ id: string; username: string; rating: number; wins: number; losses: number }>(
        `select u.id, u.username, u.rating, u.wins, u.losses, u.operator, u.dev
         from ash_friend f join ash_user u on u.id = f.owner_id
         where f.friend_id = $1 and f.status = 'pending' order by u.username`,
        [me.id],
      );
      incoming = rows.map((row) => ({ ...safeUser(row), incoming: true }));
    } catch (err) {
      console.log("[ashveil] friend incoming", err);
    }
    let outgoing: FriendRow[] = [];
    try {
      const rows = await sql.query<{ id: string; username: string; rating: number; wins: number; losses: number }>(
        `select u.id, u.username, u.rating, u.wins, u.losses, u.operator, u.dev
         from ash_friend f join ash_user u on u.id = f.friend_id
         where f.owner_id = $1 and f.status = 'pending' order by u.username`,
        [me.id],
      );
      outgoing = rows.map((row) => ({ ...safeUser(row), pending: true }));
    } catch (err) {
      console.log("[ashveil] friend outgoing", err);
    }
    let invites: { code: string; from_name: string; from_id: string }[] = [];
    try {
      invites = await sql.query<{ code: string; from_name: string; from_id: string }>(
        `select i.code, u.username as from_name, u.id as from_id
         from ash_invite i
         join ash_user u on u.id = i.from_id
         join ash_room r on r.code = i.code
         where i.to_id = $1 and r.status = 'open' and r.guest_id is null
         order by i.created_at desc`,
        [me.id],
      );
    } catch {
      invites = [];
    }
    try {
      await sql.query(
        `delete from ash_invite
         where to_id = $1
           and code not in (select code from ash_room where status = 'open' and guest_id is null)`,
        [me.id],
      );
    } catch {
      /* a stale invite can wait until the next refresh */
    }
    return {
      ok: true,
      friends: friends.map(withOnline),
      incoming: incoming.map((row) => ({ ...withOnline(row), incoming: true })),
      outgoing: outgoing.map((row) => ({ ...withOnline(row), pending: true })),
      players,
      invites: invites.map((row) => ({ code: row.code, from: row.from_name })),
    };
    } catch (err) {
      console.log("[ashveil] friends", err);
      return { ok: false, error: "Could not load friends. Try again." };
    }
  });

export const friendAdd = createServerFn({ method: "POST" })
  .validator((data: { token: string; username: string }) => data)
  .handler(async ({ data }): Promise<{ ok: true; pending: boolean } | Err> => {
    try {
    const me = await userByToken(data.token);
    if (!me) return { ok: false, error: "Sign in again." };
    const sql = await db();
    const found = await sql.query<{ id: string }>(
      `select id from ash_user where lower(username) = lower($1)`,
      [data.username.trim().replace(/ +/g, " ")],
    );
    const other = found[0];
    if (!other) return { ok: false, error: "No player by that name." };
    if (other.id === me.id) return { ok: false, error: "That is you." };
    const rows = await sql.query<{ owner_id: string; friend_id: string; status: string }>(
      `select owner_id, friend_id, status from ash_friend
       where (owner_id = $1 and friend_id = $2) or (owner_id = $2 and friend_id = $1)`,
      [me.id, other.id],
    );
    const mine = rows.find((row) => row.owner_id === me.id);
    const theirs = rows.find((row) => row.owner_id === other.id);
    if (mine?.status === "accepted" || theirs?.status === "accepted") return { ok: false, error: "Already friends." };
    if (mine?.status === "pending") return { ok: false, error: "Request already sent. They have to accept." };
    if (theirs?.status === "pending") {
      await sql.query(`update ash_friend set status = 'accepted' where owner_id = $1 and friend_id = $2`, [other.id, me.id]);
      await sql.query(
        `insert into ash_friend (owner_id, friend_id, status) values ($1, $2, 'accepted')
         on conflict (owner_id, friend_id) do update set status = 'accepted'`,
        [me.id, other.id],
      );
      return { ok: true, pending: false };
    }
    await sql.query(
      `insert into ash_friend (owner_id, friend_id, status) values ($1, $2, 'pending')
       on conflict (owner_id, friend_id) do update set status = 'pending'`,
      [me.id, other.id],
    );
    return { ok: true, pending: true };
    } catch (err) {
      console.log("[ashveil] friend add", err);
      return { ok: false, error: "Could not send that request. Try again." };
    }
  });

export const friendAnswer = createServerFn({ method: "POST" })
  .validator((data: { token: string; username: string; accept: boolean }) => data)
  .handler(async ({ data }): Promise<{ ok: true } | Err> => {
    try {
    const me = await userByToken(data.token);
    if (!me) return { ok: false, error: "Sign in again." };
    const sql = await db();
    const found = await sql.query<{ id: string }>(
      `select id from ash_user where lower(username) = lower($1)`,
      [data.username.trim().replace(/ +/g, " ")],
    );
    const other = found[0];
    if (!other) return { ok: false, error: "No player by that name." };
    if (!data.accept) {
      await sql.query(`delete from ash_friend where owner_id = $1 and friend_id = $2 and status = 'pending'`, [other.id, me.id]);
      return { ok: true };
    }
    const updated = await sql.query<{ owner_id: string }>(
      `update ash_friend set status = 'accepted'
       where owner_id = $1 and friend_id = $2 and status = 'pending'
       returning owner_id`,
      [other.id, me.id],
    );
    if (!updated.length) return { ok: false, error: "That request is no longer waiting." };
    await sql.query(
      `insert into ash_friend (owner_id, friend_id, status) values ($1, $2, 'accepted')
       on conflict (owner_id, friend_id) do update set status = 'accepted'`,
      [me.id, other.id],
    );
    return { ok: true };
    } catch (err) {
      console.log("[ashveil] friend answer", err);
      return { ok: false, error: "Could not answer that request. Try again." };
    }
  });

export const friendRemove = createServerFn({ method: "POST" })
  .validator((data: { token: string; username: string }) => data)
  .handler(async ({ data }): Promise<{ ok: true } | Err> => {
    const me = await userByToken(data.token);
    if (!me) return { ok: false, error: "Sign in again." };
    const sql = await db();
    const found = await sql.query<{ id: string }>(
      `select id from ash_user where lower(username) = lower($1)`,
      [data.username.trim().replace(/ +/g, " ")],
    );
    const other = found[0];
    if (!other) return { ok: false, error: "No player by that name." };
    await sql.query(
      `delete from ash_friend
       where (owner_id = $1 and friend_id = $2) or (owner_id = $2 and friend_id = $1)`,
      [me.id, other.id],
    );
    return { ok: true };
  });

async function requireStaff(token: string) {
  const me = await userByToken(token);
  if (!me) return { ok: false as const, error: "Sign in again." };
  if (!isOn(me.operator) && !isOn(me.dev)) return { ok: false as const, error: "Only an operator can do that." };
  return { ok: true as const, me };
}

export const accountDelete = createServerFn({ method: "POST" })
  .validator((data: { token: string; username: string }) => data)
  .handler(async ({ data }): Promise<{ ok: true } | Err> => {
    const gate = await requireStaff(data.token);
    if (!gate.ok) return gate;
    const sql = await db();
    const found = await sql.query<{ id: string }>(
      `select id from ash_user where lower(username) = lower($1)`,
      [data.username.trim().replace(/ +/g, " ")],
    );
    const other = found[0];
    if (!other) return { ok: false, error: "No player by that name." };
    if (other.id === gate.me.id) return { ok: false, error: "You cannot delete your own account here." };
    const id = other.id;
    await sql.query(`delete from ash_invite where from_id = $1 or to_id = $1`, [id]);
    await sql.query(`delete from ash_room where host_id = $1 or guest_id = $1`, [id]);
    await sql.query(`delete from ash_friend where owner_id = $1 or friend_id = $1`, [id]);
    await sql.query(`delete from ash_session where user_id = $1`, [id]);
    await sql.query(`delete from ash_device where user_id = $1`, [id]);
    await sql.query(`delete from ash_user where id = $1`, [id]);
    return { ok: true };
  });

export const accountResetRank = createServerFn({ method: "POST" })
  .validator((data: { token: string; username: string }) => data)
  .handler(async ({ data }): Promise<{ ok: true } | Err> => {
    const gate = await requireStaff(data.token);
    if (!gate.ok) return gate;
    const sql = await db();
    const updated = await sql.query<{ id: string }>(
      `update ash_user set rating = 1000, wins = 0, losses = 0
       where lower(username) = lower($1)
       returning id`,
      [data.username.trim().replace(/ +/g, " ")],
    );
    if (!updated.length) return { ok: false, error: "No player by that name." };
    return { ok: true };
  });

export const accountMakeAdmin = createServerFn({ method: "POST" })
  .validator((data: { token: string; username: string }) => data)
  .handler(async ({ data }): Promise<{ ok: true } | Err> => {
    const gate = await requireStaff(data.token);
    if (!gate.ok) return gate;
    const sql = await db();
    const name = data.username.trim().replace(/ +/g, " ");
    const updated = await sql.query<{ id: string }>(
      `update ash_user set operator = true, dev = true, rev = rev + 1 where lower(btrim(username)) = lower($1) returning id`,
      [name],
    );
    if (!updated.length) return { ok: false, error: "No player by that name." };
    return { ok: true };
  });

async function commandRow(sql: Awaited<ReturnType<typeof db>>) {
  await sql.query(
    `create table if not exists ash_command (
      id text primary key,
      word text not null,
      payout integer not null
    )`,
  );
  const rows = await sql.query<{ word: string; payout: number }>(`select word, payout from ash_command where id = 'live'`);
  const row = rows[0];
  if (!row) return { word: "", payout: 0 };
  return { word: String(row.word || ""), payout: Math.max(0, Math.round(Number(row.payout) || 0)) };
}

export const accountSetCommand = createServerFn({ method: "POST" })
  .validator((data: { token: string; word: string; payout: number }) => data)
  .handler(async ({ data }): Promise<{ ok: true; word: string; payout: number } | Err> => {
    const gate = await requireStaff(data.token);
    if (!gate.ok) return gate;
    const word = data.word.trim().toLowerCase().replace(/ +/g, " ");
    const payout = Math.round(Number(data.payout));
    if (!/^[a-z0-9][a-z0-9 ]{0,23}$/.test(word)) return { ok: false, error: "The word must be 1–24 letters or numbers." };
    if (!Number.isFinite(payout) || payout < 1 || payout > 100000) return { ok: false, error: "Payout must be from 1 to 100000 coins." };
    const sql = await db();
    await commandRow(sql);
    await sql.query(
      `insert into ash_command (id, word, payout) values ('live', $1, $2)
       on conflict (id) do update set word = $1, payout = $2`,
      [word, payout],
    );
    return { ok: true, word, payout };
  });

export const accountCommand = createServerFn({ method: "POST" })
  .validator((data: { token: string; word: string }) => data)
  .handler(async ({ data }): Promise<{ ok: true; coins: number; word: string; payout: number } | Err> => {
    const gate = await requireStaff(data.token);
    if (!gate.ok) return gate;
    const sql = await db();
    const live = await commandRow(sql);
    const word = data.word.trim().toLowerCase().replace(/ +/g, " ");
    if (!word) return { ok: true, coins: Number(gate.me.coins) || 0, word: live.word, payout: live.payout };
    const phrase = word === "cheatcode";
    if (!phrase && !live.word) return { ok: false, error: "No command word is set yet." };
    if (!phrase && word !== live.word) return { ok: false, error: "That word does nothing." };
    const payout = phrase ? live.payout || 500 : live.payout;
    const updated = await sql.query<{ coins: number }>(
      `update ash_user set coins = coins + $2, rev = rev + 1 where id = $1 returning coins`,
      [gate.me.id, payout],
    );
    return { ok: true, coins: Number(updated[0]?.coins) || 0, word: phrase ? "cheatcode" : live.word, payout };
  });

export const accountGiveKit = createServerFn({ method: "POST" })
  .validator((data: { token: string; username: string }) => data)
  .handler(async ({ data }): Promise<{ ok: true } | Err> => {
    try {
      const gate = await requireStaff(data.token);
      if (!gate.ok) return gate;
      const sql = await db();
      const found = await sql.query<{ id: string; unlocked: string }>(
        `select id, unlocked from ash_user where lower(username) = lower($1)`,
        [data.username.trim().replace(/ +/g, " ")],
      );
      const other = found[0];
      if (!other) return { ok: false, error: "No player by that name." };
      await ensureKit(other.id, other.unlocked);
      return { ok: true };
    } catch (err) {
      console.log("[ashveil] kit", err);
      return { ok: false, error: "Could not give the basic kit." };
    }
  });

export const accountGiveCoins = createServerFn({ method: "POST" })
  .validator((data: { token: string; username: string; amount: number; mint?: boolean; take?: boolean }) => data)
  .handler(async ({ data }): Promise<{ ok: true; coins: number; mine: number } | Err> => {
    const me = await userByToken(data.token);
    if (!me) return { ok: false, error: "Sign in again." };
    const amount = Math.round(Number(data.amount));
    if (!Number.isFinite(amount) || amount < 1 || amount > 100000) {
      return { ok: false, error: "Type a number of coins from 1 to 100000." };
    }
    const sql = await db();
    const found = await sql.query<{ id: string }>(
      `select id from ash_user where lower(username) = lower($1)`,
      [data.username.trim().replace(/ +/g, " ")],
    );
    const other = found[0];
    if (!other) return { ok: false, error: "No player by that name." };
    const self = other.id === me.id;
    if (data.take) {
      if (!isOn(me.operator) && !isOn(me.dev) && me.username.toLowerCase() !== "apollo") {
        return { ok: false, error: "Only an operator can remove coins." };
      }
      const updated = await sql.query<{ coins: number }>(
        `update ash_user set coins = greatest(0, coins - $2), rev = rev + 1 where id = $1 returning coins`,
        [other.id, amount],
      );
      const coins = Number(updated[0]?.coins) || 0;
      return { ok: true, coins, mine: self ? coins : me.coins ?? 0 };
    }
    const updated = await sql.query<{ coins: number }>(
      `update ash_user set coins = coins + $2, rev = rev + 1 where id = $1 returning coins`,
      [other.id, amount],
    );
    const coins = Number(updated[0]?.coins) || 0;
    return { ok: true, coins, mine: self ? coins : me.coins ?? 0 };
  });

export const accountDevice = createServerFn({ method: "POST" })
  .validator((data: { token: string; device: string; open?: boolean }) => data)
  .handler(async ({ data }): Promise<{ ok: true; open: boolean } | Err> => {
    const gate = await requireStaff(data.token);
    if (!gate.ok) return gate;
    const id = cleanDevice(data.device);
    if (!id) return { ok: false, error: "This computer could not be recognized. Reload and try again." };
    const sql = await db();
    if (typeof data.open === "boolean") {
      await sql.query(
        `insert into ash_device (device, user_id, unlocked) values ($1, $2, $3)
         on conflict (device) do update set unlocked = $3`,
        [id, gate.me.id, data.open],
      );
      return { ok: true, open: data.open };
    }
    const rows = await sql.query<{ unlocked: unknown }>(`select unlocked from ash_device where device = $1`, [id]);
    return { ok: true, open: isOn(rows[0]?.unlocked) };
  });

export const rankBoard = createServerFn({ method: "POST" })
  .validator((data: { token: string }) => data)
  .handler(async ({ data }): Promise<BoardOk | Err> => {
    const me = await userByToken(data.token);
    if (!me) return { ok: false, error: "Sign in again." };
    const sql = await db();
    const rows = await sql.query<{ id: string; username: string; rating: number; wins: number; losses: number }>(
      `select id, username, rating, wins, losses, operator, dev from ash_user order by rating desc, wins desc limit 20`,
    );
    return { ok: true, board: rows.map((row) => publicUser(row)) };
  });

function readTalk(raw: unknown): { name: string; text: string }[] {
  try {
    const rows = JSON.parse(String(raw || "[]")) as unknown;
    if (!Array.isArray(rows)) return [];
    return rows
      .filter((row) => row && typeof row === "object")
      .map((row) => {
        const item = row as { name?: unknown; text?: unknown };
        return { name: String(item.name || "Player").slice(0, 16), text: String(item.text || "").slice(0, 80) };
      })
      .filter((row) => row.text)
      .slice(-40);
  } catch {
    return [];
  }
}

function roomCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 4; i++) code += alphabet[Math.floor(Math.random() * alphabet.length)];
  return code;
}

async function roomView(code: string, userId: string): Promise<RoomOk | Err> {
  await tickRoom(code);
  const sql = await db();
  let rows: {
    code: string;
    map_id: string;
    host_id: string;
    host_name: string;
    guest_id: string | null;
    guest_name: string | null;
    state: string;
    status: string;
    version: number;
    talk?: string;
  }[] = [];
  try {
    rows = await sql.query(
      `select code, map_id, host_id, host_name, guest_id, guest_name, state, status, version, talk from ash_room where code = $1`,
      [code],
    );
  } catch {
    rows = await sql.query(
      `select code, map_id, host_id, host_name, guest_id, guest_name, state, status, version from ash_room where code = $1`,
      [code],
    );
  }
  const room = rows[0];
  if (!room) return { ok: false, error: "No room with that code." };
  if (room.host_id !== userId && room.guest_id !== userId) return { ok: false, error: "That room is not yours." };
  const seat: 0 | 1 = room.host_id === userId ? 0 : 1;
  const { viewFor } = await import("./logic");
  const match = JSON.parse(room.state) as Match;
  const state: RootState | null =
    room.status === "open" || room.status === "queue"
      ? null
      : {
          screen: match.winner ? "victory" : "battle",
          match: match.winner ? { ...match, history: null } : viewFor(match, seat),
          help: false,
          hasSave: false,
        };
  return {
    ok: true,
    code: room.code,
    status: room.status,
    seat,
    version: room.version,
    host: room.host_name,
    guest: room.guest_name,
    mapId: room.map_id,
    state,
    deadline: match.clock ?? null,
    talk: readTalk(room.talk),
  };
}

async function openRoom(userId: string, username: string, status = "open", hqHp = 22): Promise<RoomOk | Err> {
  const { newMatch } = await import("./logic");
  const { MAPS } = await import("./maps");
  const mapId = MAPS[Math.floor(Math.random() * MAPS.length)]!.id;
  const mode = (["strike", "capture", "raze"] as const)[Math.floor(Math.random() * 3)]!;
  const hp = Number.isFinite(hqHp) ? Math.min(100, Math.max(1, Math.round(hqHp))) : 22;
  const sql = await db();
  const hostRows = await sql.query<{ mods: string }>(`select mods from ash_user where id = $1`, [userId]);
  let code = roomCode();
  for (let i = 0; i < 5; i++) {
    const hit = await sql.query(`select code from ash_room where code = $1`, [code]);
    if (!hit.length) break;
    code = roomCode();
  }
  const match = newMatch(mapId, null, hp, mode, hostRows[0]?.mods || "") as unknown as Match;
  match.funds[1] = 1000;
  if (status === "queue") {
    match.queueAt = Date.now();
    match.ranked = true;
  }
  await sql.query(
    `insert into ash_room (code, map_id, host_id, host_name, state, status) values ($1, $2, $3, $4, $5, $6)`,
    [code, mapId, userId, username, pack(match), status],
  );
  return roomView(code, userId);
}

async function rollRankedMap(code: string) {
  const sql = await db();
  const rooms = await sql.query<{ state: string; version: number }>(
    `select state, version from ash_room where code = $1`,
    [code],
  );
  const room = rooms[0];
  if (!room) return;
  const old = JSON.parse(room.state) as Match;
  const { newMatch } = await import("./logic");
  const { MAPS } = await import("./maps");
  const mapId = MAPS[Math.floor(Math.random() * MAPS.length)]!.id;
  const hp = old.structs.find((s) => s.kind === "spire")?.hp ?? 22;
  const match = newMatch(mapId, null, hp, old.mode, old.crew?.[0] || "") as unknown as Match;
  match.funds[1] = 1000;
  match.ranked = true;
  await sql.query(
    `update ash_room set map_id = $2, state = $3, version = version + 1, updated_at = now() where code = $1 and version = $4`,
    [code, mapId, pack(match), room.version],
  );
}

async function stampGuest(code: string) {
  const sql = await db();
  const rooms = await sql.query<{ guest_id: string | null; state: string; version: number }>(
    `select guest_id, state, version from ash_room where code = $1`,
    [code],
  );
  const room = rooms[0];
  if (!room?.guest_id) return;
  const people = await sql.query<{ mods: string }>(`select mods from ash_user where id = $1`, [room.guest_id]);
  const { unitBonus } = await import("./catalog");
  const match = JSON.parse(room.state) as Match;
  if (!match.crew) match.crew = ["", ""];
  match.crew[1] = people[0]?.mods || "";
  for (const unit of match.units) {
    if (unit.owner !== 1) continue;
    const plus = unitBonus(match.crew[1], unit.kind);
    const had = unit.plus?.hp || 0;
    unit.plus = plus.atk || plus.move || plus.hp ? plus : undefined;
    unit.hp += plus.hp - had;
  }
  await sql.query(
    `update ash_room set state = $2, version = version + 1, updated_at = now() where code = $1 and version = $3`,
    [code, pack(match), room.version],
  );
}

export const roomHost = createServerFn({ method: "POST" })
  .validator((data: { token: string; mapId: string; mode?: string; hqHp?: number }) => data)
  .handler(async ({ data }): Promise<RoomOk | Err> => {
    const me = await userByToken(data.token);
    if (!me) return { ok: false, error: "Sign in again." };
    const sql = await db();
    const old = await sql.query<{ code: string }>(
      `select code from ash_room where host_id = $1 and status = 'open' and guest_id is null`,
      [me.id],
    );
    for (const row of old) await sql.query(`delete from ash_invite where code = $1`, [row.code]);
    await sql.query(`delete from ash_room where host_id = $1 and status = 'open' and guest_id is null`, [me.id]);
    return openRoom(me.id, me.username, "open", data.hqHp);
  });

async function seatBot(code: string, rating: number) {
  const sql = await db();
  const rooms = await sql.query<{ state: string; version: number }>(
    `select state, version from ash_room where code = $1 and status = 'queue' and guest_id is null`,
    [code],
  );
  const room = rooms[0];
  if (!room) return;
  const match = JSON.parse(room.state) as Match;
  const level = [2, 3, 5, 6, 7, 9, 10][rankSteps(rating)] ?? 5;
  match.bot = level;
  match.clock = Date.now() + ONLINE_TURN_MS;
  match.log[0] = [...(match.log[0] ?? []), `No person was waiting. Bot level ${level} took the south seat.`].slice(-40);
  await sql.query(
    `update ash_room set guest_name = $2, status = 'active', state = $3, version = version + 1, updated_at = now()
     where code = $1 and status = 'queue' and guest_id is null and version = $4`,
    [code, `Bot ${level}`, pack(match), room.version],
  );
}

export const roomQueue = createServerFn({ method: "POST" })
  .validator((data: { token: string; mapId: string; mode?: string; hqHp?: number; fresh?: boolean; code?: string }) => data)
  .handler(async ({ data }): Promise<RoomOk | Err> => {
    const me = await userByToken(data.token);
    if (!me) return { ok: false, error: "Sign in again." };
    const sql = await db();
    const wanted = data.code?.trim().toUpperCase().replace(/[^A-Z0-9]/g, "") ?? "";
    if (!data.fresh && !wanted) {
      const live = await sql.query<{ code: string }>(
        `select code from ash_room where status = 'active' and (host_id = $1 or guest_id = $1) order by updated_at desc limit 1`,
        [me.id],
      );
      if (live[0]) return roomView(live[0].code, me.id);
    }
    if (data.fresh) {
      await sql.query(`delete from ash_room where host_id = $1 and status = 'queue' and guest_id is null`, [me.id]);
    }
    const mineRows = wanted
      ? await sql.query<{ code: string; state: string; status: string }>(
          `select code, state, status from ash_room where code = $1 and (host_id = $2 or guest_id = $2) limit 1`,
          [wanted, me.id],
        )
      : await sql.query<{ code: string; state: string; status: string }>(
          `select code, state, status from ash_room where host_id = $1 and status = 'queue' and guest_id is null order by updated_at asc limit 1`,
          [me.id],
        );
    const mine = mineRows[0];
    if (mine && mine.status !== "queue") return roomView(mine.code, me.id);
    if (mine) await sql.query(`update ash_room set updated_at = now() where code = $1 and status = 'queue'`, [mine.code]);
    await sql.query(
      `delete from ash_room where status = 'queue' and host_id <> $1 and updated_at < now() - interval '20 seconds'`,
      [me.id],
    );
    const others = await sql.query<{ code: string; host_id: string; state: string; rating: number }>(
      `select r.code, r.host_id, r.state, u.rating
       from ash_room r
       join ash_user u on u.id = r.host_id
       where r.status = 'queue' and r.guest_id is null and r.host_id <> $1
       order by r.updated_at asc
       limit 20`,
      [me.id],
    );
    let mineAt = Number.POSITIVE_INFINITY;
    if (mine) {
      try {
        mineAt = (JSON.parse(mine.state) as Match).queueAt ?? 0;
      } catch {
        mineAt = 0;
      }
    }
    const mySteps = rankSteps(me.rating ?? 1000);
    const fresh = others.map((row) => {
      let queueAt = 0;
      try {
        queueAt = (JSON.parse(row.state) as Match).queueAt ?? 0;
      } catch {
        queueAt = 0;
      }
      return { ...row, queueAt, steps: rankSteps(Number(row.rating) || 1000) };
    });
    const waiting = fresh
      .filter((row) => row.queueAt <= mineAt)
      .sort((a, b) => Math.abs(a.steps - mySteps) - Math.abs(b.steps - mySteps) || a.queueAt - b.queueAt);
    for (const row of waiting) {
      const taken = await sql.query<{ code: string }>(
        `update ash_room set guest_id = $2, guest_name = $3, status = 'active', updated_at = now()
         where code = $1 and status = 'queue' and guest_id is null returning code`,
        [row.code, me.id, me.username],
      );
      if (!taken.length) continue;
      if (mine) await sql.query(`delete from ash_room where code = $1 and status = 'queue'`, [mine.code]);
      await rollRankedMap(row.code);
      await stampGuest(row.code);
      return roomView(row.code, me.id);
    }
    if (mine && Date.now() - mineAt >= 8000 && fresh.length === 0) {
      await seatBot(mine.code, me.rating ?? 1000);
      return roomView(mine.code, me.id);
    }
    if (mine) return roomView(mine.code, me.id);
    return openRoom(me.id, me.username, "queue", data.hqHp);
  });

export const roomCancel = createServerFn({ method: "POST" })
  .validator((data: { token: string; code: string }) => data)
  .handler(async ({ data }): Promise<{ ok: true } | Err> => {
    const me = await userByToken(data.token);
    if (!me) return { ok: false, error: "Sign in again." };
    const sql = await db();
    await sql.query(
      `delete from ash_room where code = $1 and host_id = $2 and status in ('open', 'queue') and guest_id is null`,
      [data.code.trim().toUpperCase(), me.id],
    );
    await sql.query(`delete from ash_invite where code = $1`, [data.code.trim().toUpperCase()]);
    return { ok: true };
  });

export const roomLeave = createServerFn({ method: "POST" })
  .validator((data: { token: string; code: string }) => data)
  .handler(async ({ data }): Promise<{ ok: true } | Err> => {
    const me = await userByToken(data.token);
    if (!me) return { ok: false, error: "Sign in again." };
    const code = data.code.trim().toUpperCase();
    const sql = await db();
    const rows = await sql.query<{ host_id: string; guest_id: string | null; state: string; status: string; version: number }>(
      `select host_id, guest_id, state, status, version from ash_room where code = $1`,
      [code],
    );
    const room = rows[0];
    if (!room) return { ok: true };
    if (room.host_id !== me.id && room.guest_id !== me.id) return { ok: false, error: "That room is not yours." };
    if (room.status !== "active" || !room.guest_id) {
      if (room.host_id === me.id && !room.guest_id) {
        await sql.query(`delete from ash_invite where code = $1`, [code]);
        await sql.query(`delete from ash_room where code = $1 and guest_id is null`, [code]);
      }
      return { ok: true };
    }
    const match = JSON.parse(room.state) as Match;
    if (match.winner) return { ok: true };
    const seat = room.host_id === me.id ? 0 : 1;
    match.winner = { player: seat === 0 ? 1 : 0, reason: "The opponent left. You win." };
    match.clock = null;
    match.log[match.winner.player] = [...(match.log[match.winner.player] ?? []), "Opponent left the match."].slice(-40);
    const saved = await sql.query(
      `update ash_room set state = $2, version = version + 1, status = 'done', updated_at = now()
       where code = $1 and status = 'active' and version = $3 returning version`,
      [code, pack(match), room.version],
    );
    if (saved.length) await finishIfNeeded(code, match);
    return { ok: true };
  });

export const roomJoin = createServerFn({ method: "POST" })
  .validator((data: { token: string; code: string }) => data)
  .handler(async ({ data }): Promise<RoomOk | Err> => {
    try {
    const me = await userByToken(data.token);
    if (!me) return { ok: false, error: "Sign in again." };
    const code = data.code.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (code.length < 4) return { ok: false, error: "Type the 4-character room code." };
    const sql = await db();
    const rows = await sql.query<{ host_id: string; guest_id: string | null; status: string }>(
      `select host_id, guest_id, status from ash_room where code = $1`,
      [code],
    );
    const room = rows[0];
    if (!room) return { ok: false, error: "No room with that code. Ask them to host again." };
    if (room.status === "done") return { ok: false, error: "That match is already over." };
    if (room.status === "queue") return { ok: false, error: "That code is a ranked search, not a hosted room." };
    if (room.host_id === me.id || room.guest_id === me.id) {
      await sql.query(`delete from ash_invite where code = $1 and to_id = $2`, [code, me.id]);
      return roomView(code, me.id);
    }
    if (room.guest_id) return { ok: false, error: "That room is full." };
    if (room.status !== "open") return { ok: false, error: "That room is not waiting for a player." };
    const taken = await sql.query<{ code: string }>(
      `update ash_room set guest_id = $2, guest_name = $3, status = 'active', updated_at = now()
       where code = $1 and status = 'open' and guest_id is null returning code`,
      [code, me.id, me.username],
    );
    if (!taken.length) return { ok: false, error: "That room was just taken or closed. Ask for a new code." };
    await sql.query(`delete from ash_invite where code = $1`, [code]);
    await stampGuest(code);
    return roomView(code, me.id);
    } catch (err) {
      console.log("[ashveil] join", err);
      return { ok: false, error: "Could not join that game. Try again." };
    }
  });

export const roomInvite = createServerFn({ method: "POST" })
  .validator((data: { token: string; username: string; mapId: string; hqHp?: number }) => data)
  .handler(async ({ data }): Promise<RoomOk | Err> => {
    try {
    const me = await userByToken(data.token);
    if (!me) return { ok: false, error: "Sign in again." };
    const sql = await db();
    const found = await sql.query<{ id: string }>(
      `select id from ash_user where lower(username) = lower($1)`,
      [data.username.trim().replace(/ +/g, " ")],
    );
    const other = found[0];
    if (!other) return { ok: false, error: "No player by that name." };
    if (other.id === me.id) return { ok: false, error: "That is you." };
    const linked = await sql.query(
      `select status from ash_friend
       where status = 'accepted'
         and ((owner_id = $1 and friend_id = $2) or (owner_id = $2 and friend_id = $1))`,
      [me.id, other.id],
    );
    if (!linked.length) return { ok: false, error: "They have to accept your friend request first." };
    const previous = await sql.query<{ code: string }>(
      `select code from ash_invite where from_id = $1 and to_id = $2`,
      [me.id, other.id],
    );
    for (const row of previous) {
      await sql.query(
        `delete from ash_room where code = $1 and host_id = $2 and status = 'open' and guest_id is null`,
        [row.code, me.id],
      );
    }
    await sql.query(`delete from ash_invite where from_id = $1 and to_id = $2`, [me.id, other.id]);
    const hosted = await openRoom(me.id, me.username, "open", data.hqHp);
    if (!hosted.ok) return hosted;
    const { randomBytes } = await import("node:crypto");
    await sql.query(
      `insert into ash_invite (id, from_id, to_id, code) values ($1, $2, $3, $4)`,
      [`i_${randomBytes(6).toString("hex")}`, me.id, other.id, hosted.code],
    );
    return hosted;
    } catch (err) {
      console.log("[ashveil] invite", err);
      return { ok: false, error: "Could not send that invite. Try again." };
    }
  });

export const roomSync = createServerFn({ method: "POST" })
  .validator((data: { token: string; code: string }) => data)
  .handler(async ({ data }): Promise<RoomOk | Err> => {
    const me = await userByToken(data.token);
    if (!me) return { ok: false, error: "Sign in again." };
    const code = data.code.trim().toUpperCase();
    const sql = await db();
    await sql.query(
      `update ash_room set updated_at = now() where code = $1 and status in ('open', 'queue') and (host_id = $2 or guest_id = $2)`,
      [code, me.id],
    );
    return roomView(code, me.id);
  });

export const roomSay = createServerFn({ method: "POST" })
  .validator((data: { token: string; code: string; text: string }) => data)
  .handler(async ({ data }): Promise<{ ok: true; talk: { name: string; text: string }[] } | Err> => {
    const me = await userByToken(data.token);
    if (!me) return { ok: false, error: "Sign in again." };
    const text = data.text.replace(/\s+/g, " ").trim().slice(0, 80);
    if (!text) return { ok: false, error: "Type a message." };
    const code = data.code.trim().toUpperCase().replace(/-/g, "");
    const sql = await db();
    const rows = await sql.query<{ host_id: string; guest_id: string | null; status: string; talk: string }>(
      `select host_id, guest_id, status, talk from ash_room where code = $1`,
      [code],
    );
    const room = rows[0];
    if (!room) return { ok: false, error: "No room with that code." };
    if (room.host_id !== me.id && room.guest_id !== me.id) return { ok: false, error: "That room is not yours." };
    if (room.status !== "active" && room.status !== "done") return { ok: false, error: "The battle has not started." };
    const talk = [...readTalk(room.talk), { name: me.username, text }].slice(-40);
    await sql.query(`update ash_room set talk = $2 where code = $1`, [code, JSON.stringify(talk)]);
    return { ok: true, talk };
  });

export const roomPlay = createServerFn({ method: "POST" })
  .validator((data: { token: string; code: string; version: number; cmd: Cmd }) => data)
  .handler(async ({ data }): Promise<RoomOk | Err> => {
    const me = await userByToken(data.token);
    if (!me) return { ok: false, error: "Sign in again." };
    if (data.cmd.type === "cursor") return { ok: false, error: "Ignore." };
    const code = data.code.trim().toUpperCase();
    await tickRoom(code);
    const sql = await db();
    const rows = await sql.query<{ host_id: string; guest_id: string | null; state: string; status: string; version: number }>(
      `select host_id, guest_id, state, status, version from ash_room where code = $1`,
      [code],
    );
    const room = rows[0];
    if (!room) return { ok: false, error: "No room with that code." };
    if (room.status !== "active") return { ok: false, error: "Waiting for the other player." };
    if (room.version !== data.version) return roomView(code, me.id);
    const seat = room.host_id === me.id ? 0 : room.guest_id === me.id ? 1 : -1;
    if (seat < 0) return { ok: false, error: "That room is not yours." };
    const match = JSON.parse(room.state) as Match;
    if (match.winner) return roomView(code, me.id);
    if (match.active !== seat) return { ok: false, error: "Time's up." };
    if (data.cmd.type === "buy") {
      const { isDiscovered } = await import("./catalog");
      if (!isDiscovered(me.unlocked, data.cmd.item)) return { ok: false, error: "Research that unit before you can buy it." };
    }
    const { apply, settleOnline } = await import("./logic");
    const now = Date.now();
    let next = apply(
      { screen: "battle", match, help: false, hasSave: false },
      { ...data.cmd, now } as Cmd,
    );
    next = settleOnline(next, now);
    if (!next.match) return { ok: false, error: "The move did not land." };
    if (!next.match.winner && (next.match.active !== match.active || next.match.turn !== match.turn)) {
      next.match.clock = now + ONLINE_TURN_MS;
    }
    const saved = await sql.query(
      `update ash_room set state = $2, version = version + 1, status = $3, updated_at = now()
       where code = $1 and version = $4 returning version`,
      [code, pack(next.match), next.match.winner ? "done" : "active", data.version],
    );
    if (!saved.length) return roomView(code, me.id);
    if (next.match.winner) await finishIfNeeded(code, next.match);
    return roomView(code, me.id);
  });
