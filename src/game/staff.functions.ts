import { createServerFn } from "@tanstack/react-start";
import { STRUCT_BY } from "./catalog";
import { MAPS } from "./maps";
import { db, finishIfNeeded, userByToken } from "./server-store";
import {
  APPROVED_GIFTS,
  APPROVED_SETTINGS,
  APPROVED_SPAWN,
  COIN_CAP,
  OWNER_NAME,
  isStaffRole,
  roleAllows,
} from "./staff";
import type { Match, Struct } from "./types";

type Err = { ok: false; error: string };

type StaffPlayer = {
  id: string;
  username: string;
  role: string;
  frozen: boolean;
  online: boolean;
  rating: number;
};

type StaffLog = { at: string; name: string; action: string; detail: string };

const lastCommand = new Map<string, number>();
const COMMAND_GAP_MS = 2000;

function text(value: unknown, max: number): string {
  return String(value ?? "").trim().slice(0, max);
}

function whole(value: unknown, min: number, max: number): number | null {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n) || n < min || n > max) return null;
  return n;
}

function roleOf(me: { username: string; staff_role?: string; operator?: unknown; dev?: unknown }): string {
  const named = String(me.username || "").trim().toLowerCase();
  if (named === OWNER_NAME) return "owner";
  const stored = String(me.staff_role || "");
  if (isStaffRole(stored)) return stored;
  const on = (value: unknown) => value === true || value === "t" || value === "true" || value === 1;
  if (on(me.operator) || on(me.dev)) return "admin";
  return "";
}

/** Reads the role from the database. The request body is never asked who the caller is. */
async function actor(token: string) {
  const me = await userByToken(token);
  if (!me) return null;
  return { me, role: roleOf(me) };
}

function allow(role: string, tool: "moderate" | "give" | "build" | "settings" | "roles"): Err | null {
  if (!roleAllows(role, tool)) return { ok: false, error: "You do not have permission for that." };
  return null;
}

function cooled(userId: string): Err | null {
  const now = Date.now();
  const prev = lastCommand.get(userId) ?? 0;
  if (now - prev < COMMAND_GAP_MS) return { ok: false, error: "Wait a moment before the next command." };
  lastCommand.set(userId, now);
  return null;
}

async function logAct(actorId: string, actorName: string, action: string, detail: string) {
  const sql = await db();
  await sql.query(
    `create table if not exists ash_staff_log (
      id text primary key,
      at timestamptz not null default now(),
      actor_id text not null,
      actor_name text not null,
      action text not null,
      detail text not null default ''
    )`,
  );
  const id = `l_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  await sql.query(
    `insert into ash_staff_log (id, actor_id, actor_name, action, detail) values ($1, $2, $3, $4, $5)`,
    [id, actorId, actorName, action, detail.slice(0, 180)],
  );
}

async function players(): Promise<StaffPlayer[]> {
  const sql = await db();
  const rows = await sql.query<{ id: string; username: string; rating: number; staff_role: string; frozen: unknown; operator: unknown; dev: unknown; seen_ms: unknown }>(
    `select id, username, rating, staff_role, frozen, operator, dev, seen_ms from ash_user order by lower(username)`,
  );
  const cutoff = Date.now() - 45_000;
  return rows.map((row) => {
    const named = String(row.username || "").trim().toLowerCase();
    const stored = String(row.staff_role || "");
    const role = named === OWNER_NAME ? "owner" : isStaffRole(stored) ? stored : row.operator === true || row.operator === "t" || row.dev === true || row.dev === "t" ? "admin" : "";
    return {
      id: String(row.id),
      username: String(row.username),
      role,
      frozen: row.frozen === true || row.frozen === "t" || row.frozen === "true",
      online: Number(row.seen_ms) > cutoff,
      rating: Number(row.rating) || 0,
    };
  });
}

async function readLog(): Promise<StaffLog[]> {
  const sql = await db();
  await sql.query(
    `create table if not exists ash_staff_log (
      id text primary key,
      at timestamptz not null default now(),
      actor_id text not null,
      actor_name text not null,
      action text not null,
      detail text not null default ''
    )`,
  );
  const rows = await sql.query<{ at: string; actor_name: string; action: string; detail: string }>(
    `select at::text as at, actor_name, action, detail from ash_staff_log order by at desc limit 40`,
  );
  return rows.map((row) => ({
    at: String(row.at).slice(0, 19).replace("T", " "),
    name: row.actor_name,
    action: row.action,
    detail: row.detail,
  }));
}

function pack(match: Match): string {
  const { history: _h, ...rest } = match;
  return JSON.stringify(rest);
}

async function loadRoom(code: string) {
  const sql = await db();
  const rows = await sql.query<{ host_id: string; guest_id: string | null; state: string; status: string; version: number }>(
    `select host_id, guest_id, state, status, version from ash_room where code = $1`,
    [code],
  );
  return rows[0];
}

export const staffAct = createServerFn({ method: "POST" })
  .validator((data: { token: string; action: string; payload?: Record<string, unknown> }) => data)
  .handler(async ({ data }): Promise<{ ok: true; note: string; players?: StaffPlayer[]; log?: StaffLog[]; settings?: { key: string; value: string }[]; gaze?: { x: number; y: number; code: string } } | Err> => {
    try {
      const who = await actor(data.token);
      if (!who) return { ok: false, error: "Sign in again." };
      if (!who.role) return { ok: false, error: "You are not on the staff list." };
      const action = text(data.action, 32);
      const payload = data.payload ?? {};
      const reads = action === "list" || action === "log" || action === "settings-get";
      if (!reads) {
        const wait = cooled(who.me.id);
        if (wait) return wait;
      }
      const sql = await db();

      if (action === "list") {
        return { ok: true, note: "Players", players: await players() };
      }
      if (action === "log") {
        if (!roleAllows(who.role, "moderate") && who.role !== "owner") {
          return { ok: false, error: "You do not have permission for that." };
        }
        return { ok: true, note: "Log", log: await readLog() };
      }
      if (action === "settings-get") {
        if (!roleAllows(who.role, "settings") && who.role !== "builder") return { ok: false, error: "You do not have permission for that." };
        await sql.query(`create table if not exists ash_setting (key text primary key, value text not null default '')`);
        const rows = await sql.query<{ key: string; value: string }>(`select key, value from ash_setting where key = any($1)`, [APPROVED_SETTINGS as unknown as string[]]);
        return { ok: true, note: "Settings", settings: rows.map((row) => ({ key: row.key, value: row.value })) };
      }

      if (action === "set-role") {
        const denied = allow(who.role, "roles");
        if (denied && who.role !== "owner") return denied;
        const username = text(payload.username, 16);
        const next = text(payload.role, 16);
        if (next && !isStaffRole(next)) return { ok: false, error: "That role does not exist." };
        if (username.toLowerCase() === OWNER_NAME) return { ok: false, error: "The owner account cannot be changed here." };
        const found = await sql.query<{ id: string; staff_role: string }>(`select id, staff_role from ash_user where lower(username) = lower($1)`, [username]);
        if (!found[0]) return { ok: false, error: "No player by that name." };
        const current = String(found[0].staff_role || "");
        if (who.role !== "owner" && (next === "owner" || next === "admin" || current === "owner" || current === "admin")) {
          return { ok: false, error: "Only the owner can change admins." };
        }
        const operator = next === "owner" || next === "admin";
        await sql.query(`update ash_user set staff_role = $2, operator = $3, dev = $3, rev = rev + 1 where id = $1`, [found[0].id, next, operator]);
        await logAct(who.me.id, who.me.username, "set-role", `${username} -> ${next || "player"}`);
        return { ok: true, note: next ? `${username} is now ${next}.` : `${username} is no longer staff.`, players: await players() };
      }

      if (action === "kick" || action === "freeze") {
        const denied = allow(who.role, "moderate");
        if (denied) return denied;
        const username = text(payload.username, 16);
        if (username.toLowerCase() === OWNER_NAME) return { ok: false, error: "The owner cannot be kicked or frozen." };
        const found = await sql.query<{ id: string; username: string }>(`select id, username from ash_user where lower(username) = lower($1)`, [username]);
        const other = found[0];
        if (!other) return { ok: false, error: "No player by that name." };
        if (action === "freeze") {
          const frozen = payload.frozen === true || payload.frozen === "true";
          await sql.query(`update ash_user set frozen = $2, rev = rev + 1 where id = $1`, [other.id, frozen]);
          await logAct(who.me.id, who.me.username, frozen ? "freeze" : "unfreeze", other.username);
          return { ok: true, note: frozen ? `${other.username} is frozen.` : `${other.username} can move again.`, players: await players() };
        }
        await sql.query(`delete from ash_session where user_id = $1`, [other.id]);
        const rooms = await sql.query<{ code: string; host_id: string; guest_id: string | null; state: string; status: string; version: number }>(
          `select code, host_id, guest_id, state, status, version from ash_room where status = 'active' and (host_id = $1 or guest_id = $1)`,
          [other.id],
        );
        for (const room of rooms) {
          const match = JSON.parse(room.state) as Match;
          if (match.winner) continue;
          const seat = room.host_id === other.id ? 0 : 1;
          match.winner = { player: seat === 0 ? 1 : 0, reason: "The opponent left. You win." };
          match.clock = null;
          const saved = await sql.query(
            `update ash_room set state = $2, version = version + 1, status = 'done', updated_at = now() where code = $1 and version = $3 returning version`,
            [room.code, pack(match), room.version],
          );
          if (saved.length) await finishIfNeeded(room.code, match);
        }
        await logAct(who.me.id, who.me.username, "kick", other.username);
        return { ok: true, note: `${other.username} was kicked.`, players: await players() };
      }

      if (action === "teleport") {
        const denied = allow(who.role, "moderate");
        if (denied) return denied;
        const username = text(payload.username, 16);
        const found = await sql.query<{ id: string }>(`select id from ash_user where lower(username) = lower($1)`, [username]);
        if (!found[0]) return { ok: false, error: "No player by that name." };
        const rooms = await sql.query<{ code: string; host_id: string; state: string }>(
          `select code, host_id, state from ash_room where status = 'active' and (host_id = $1 or guest_id = $1) limit 1`,
          [found[0].id],
        );
        const room = rooms[0];
        if (!room) return { ok: false, error: "That player is not in a match." };
        const match = JSON.parse(room.state) as Match;
        const seat = room.host_id === found[0].id ? 0 : 1;
        const hq = match.structs.find((item) => item.kind === "spire" && item.owner === seat);
        if (!hq) return { ok: false, error: "Their headquarters is not on the map." };
        await logAct(who.me.id, who.me.username, "teleport", `${username} ${room.code} ${hq.x},${hq.y}`);
        return { ok: true, note: `${username} is at ${hq.x}, ${hq.y} in room ${room.code}.`, gaze: { x: hq.x, y: hq.y, code: room.code } };
      }

      if (action === "bring") {
        const denied = allow(who.role, "give");
        if (denied && who.role !== "owner") return denied ?? { ok: false, error: "You do not have permission for that." };
        const username = text(payload.username, 16);
        const code = text(payload.code, 8).toUpperCase().replace(/[^A-Z0-9]/g, "");
        const room = await loadRoom(code);
        if (!room || room.status !== "active") return { ok: false, error: "No active match with that code." };
        if (room.host_id !== who.me.id && room.guest_id !== who.me.id && who.role !== "owner") {
          return { ok: false, error: "You have to be in that match." };
        }
        const found = await sql.query<{ id: string }>(`select id from ash_user where lower(username) = lower($1)`, [username]);
        if (!found[0]) return { ok: false, error: "No player by that name." };
        if (room.host_id !== found[0].id && room.guest_id !== found[0].id) return { ok: false, error: "That player is not in this match." };
        const match = JSON.parse(room.state) as Match;
        const targetSeat = room.host_id === found[0].id ? 0 : 1;
        const mine = room.host_id === who.me.id ? 0 : 1;
        const hq = match.structs.find((item) => item.kind === "spire" && item.owner === mine);
        const unit = match.units.find((item) => item.owner === targetSeat);
        if (!hq || !unit) return { ok: false, error: "There is no piece to bring." };
        const spot = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => ({ x: hq.x + dx!, y: hq.y + dy! })).find((tile) => {
          const map = MAPS.find((item) => item.id === match.mapId);
          const row = map?.rows[tile.y];
          if (!row || tile.x < 0 || tile.x >= row.length) return false;
          if (row[tile.x] === "w") return false;
          if (match.units.some((item) => item.x === tile.x && item.y === tile.y)) return false;
          if (match.structs.some((item) => item.x === tile.x && item.y === tile.y)) return false;
          return true;
        });
        if (!spot) return { ok: false, error: "No empty tile next to your headquarters." };
        unit.x = spot.x;
        unit.y = spot.y;
        const saved = await sql.query(
          `update ash_room set state = $2, version = version + 1, updated_at = now() where code = $1 and version = $3 returning version`,
          [code, pack(match), room.version],
        );
        if (!saved.length) return { ok: false, error: "The match changed. Try again." };
        await logAct(who.me.id, who.me.username, "bring", `${username} to ${spot.x},${spot.y}`);
        return { ok: true, note: `Brought a piece of ${username} to ${spot.x}, ${spot.y}.` };
      }

      if (action === "give") {
        const denied = allow(who.role, "give");
        if (denied) return denied;
        const username = text(payload.username, 16);
        const item = text(payload.item, 24);
        const found = await sql.query<{ id: string; username: string }>(`select id, username from ash_user where lower(username) = lower($1)`, [username]);
        if (!found[0]) return { ok: false, error: "No player by that name." };
        if (item === "coins") {
          const cap = who.role === "owner" ? COIN_CAP.owner : COIN_CAP.admin;
          const amount = whole(payload.amount, 1, cap);
          if (amount == null) return { ok: false, error: `Coins must be from 1 to ${cap}.` };
          await sql.query(`update ash_user set coins = coins + $2, rev = rev + 1 where id = $1`, [found[0].id, amount]);
          await logAct(who.me.id, who.me.username, "give-coins", `${found[0].username} +${amount}`);
          return { ok: true, note: `Gave ${amount} coins to ${found[0].username}.` };
        }
        if (!(APPROVED_GIFTS as readonly string[]).includes(item)) return { ok: false, error: "That item is not on the approved list." };
        await sql.query(
          `update ash_user set unlocked = case
             when coalesce(unlocked, '') = '' then $2
             when position(',' || $2 || ',' in ',' || unlocked || ',') > 0 then unlocked
             else unlocked || ',' || $2
           end, rev = rev + 1 where id = $1`,
          [found[0].id, item],
        );
        await logAct(who.me.id, who.me.username, "give-item", `${found[0].username} ${item}`);
        return { ok: true, note: `Gave ${item} to ${found[0].username}.` };
      }

      if (action === "setting") {
        const denied = allow(who.role, "settings");
        if (denied) return denied;
        const key = text(payload.key, 32);
        const value = text(payload.value, 140);
        if (!(APPROVED_SETTINGS as readonly string[]).includes(key)) return { ok: false, error: "That setting is not on the approved list." };
        await sql.query(`create table if not exists ash_setting (key text primary key, value text not null default '')`);
        await sql.query(
          `insert into ash_setting (key, value) values ($1, $2) on conflict (key) do update set value = $2`,
          [key, value],
        );
        await logAct(who.me.id, who.me.username, "setting", `${key}=${value}`);
        return { ok: true, note: `Saved ${key}.` };
      }

      if (action === "spawn" || action === "delete-object" || action === "move") {
        const denied = allow(who.role, "build");
        if (denied) return denied;
        const code = text(payload.code, 8).toUpperCase().replace(/[^A-Z0-9]/g, "");
        const room = await loadRoom(code);
        if (!room || room.status !== "active") return { ok: false, error: "No active match with that code." };
        const seated = room.host_id === who.me.id || room.guest_id === who.me.id;
        if (!seated && who.role === "builder") return { ok: false, error: "Builders can only edit a match they are in." };
        const match = JSON.parse(room.state) as Match;
        if (action === "spawn") {
          const kind = text(payload.kind, 24);
          if (!(APPROVED_SPAWN as readonly string[]).includes(kind)) return { ok: false, error: "That object is not on the approved list." };
          const x = whole(payload.x, 0, 80);
          const y = whole(payload.y, 0, 80);
          if (x == null || y == null) return { ok: false, error: "Pick a tile on the map." };
          const map = MAPS.find((item) => item.id === match.mapId);
          const row = map?.rows[y];
          if (!row || x >= row.length || row[x] === "w") return { ok: false, error: "That tile is off the map or water." };
          if (match.units.some((item) => item.x === x && item.y === y) || match.structs.some((item) => item.x === x && item.y === y)) {
            return { ok: false, error: "That tile is already taken." };
          }
          const def = STRUCT_BY[kind as keyof typeof STRUCT_BY];
          const piece: Struct = {
            id: `s_staff_${Math.random().toString(36).slice(2, 10)}`,
            kind: def.id,
            owner: room.host_id === who.me.id ? 0 : room.guest_id === who.me.id ? 1 : 0,
            x,
            y,
            hp: def.hp,
            cap: 0,
            fired: false,
            eta: 0,
          };
          match.structs.push(piece);
          const saved = await sql.query(
            `update ash_room set state = $2, version = version + 1, updated_at = now() where code = $1 and version = $3 returning version`,
            [code, pack(match), room.version],
          );
          if (!saved.length) return { ok: false, error: "The match changed. Try again." };
          await logAct(who.me.id, who.me.username, "spawn", `${kind} ${x},${y} ${piece.id}`);
          return { ok: true, note: `Placed ${def.name} at ${x}, ${y}. Id ${piece.id}.` };
        }
        const id = text(payload.id, 40);
        if (!id.startsWith("s_staff_")) return { ok: false, error: "Only objects placed by staff can be moved or deleted." };
        const index = match.structs.findIndex((item) => item.id === id);
        if (index < 0) return { ok: false, error: "That object is not in this match." };
        if (action === "delete-object") {
          match.structs.splice(index, 1);
          await logAct(who.me.id, who.me.username, "delete-object", id);
        } else {
          const x = whole(payload.x, 0, 80);
          const y = whole(payload.y, 0, 80);
          if (x == null || y == null) return { ok: false, error: "Pick a tile on the map." };
          const map = MAPS.find((item) => item.id === match.mapId);
          const row = map?.rows[y];
          if (!row || x >= row.length) return { ok: false, error: "That tile is off the map." };
          match.structs[index]!.x = x;
          match.structs[index]!.y = y;
          await logAct(who.me.id, who.me.username, "move", `${id} ${x},${y}`);
        }
        const saved = await sql.query(
          `update ash_room set state = $2, version = version + 1, updated_at = now() where code = $1 and version = $3 returning version`,
          [code, pack(match), room.version],
        );
        if (!saved.length) return { ok: false, error: "The match changed. Try again." };
        return { ok: true, note: action === "delete-object" ? "Deleted that object." : "Moved that object." };
      }

      if (action === "rotate" || action === "resize") {
        return { ok: false, error: "Pieces sit on grid tiles, so they cannot rotate or resize. Move them to another tile." };
      }

      return { ok: false, error: "Unknown command." };
    } catch (err) {
      console.log("[ashveil] staff", err);
      return { ok: false, error: "That command did not run." };
    }
  });
