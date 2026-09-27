import { n as TSS_SERVER_FUNCTION, t as createServerFn } from "./ssr.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/online.functions-4PfXuJ_K.js
var createServerRpc = (serverFnMeta, splitImportFn) => {
	const url = "/_serverFn/" + serverFnMeta.id;
	return Object.assign(splitImportFn, {
		url,
		serverFnMeta,
		[TSS_SERVER_FUNCTION]: true
	});
};
function rankName(rating) {
	if (rating >= 1800) return "General";
	if (rating >= 1600) return "Colonel";
	if (rating >= 1400) return "Major";
	if (rating >= 1200) return "Captain";
	if (rating >= 1e3) return "Sergeant";
	if (rating >= 800) return "Private";
	return "Recruit";
}
/** Online turns last this long. The turn ends when it runs out. */
var ONLINE_TURN_MS = 3e4;
function publicUser(row) {
	return {
		id: row.id,
		username: row.username,
		rating: row.rating,
		wins: row.wins,
		losses: row.losses,
		rank: rankName(row.rating)
	};
}
async function db() {
	const { getSql } = await import("./db-CHVX3Q9-.mjs");
	return getSql();
}
async function userByToken(token) {
	if (!token) return null;
	return (await (await db()).query(`select u.id, u.username, u.rating, u.wins, u.losses
     from ash_session s join ash_user u on u.id = s.user_id where s.token = $1`, [token]))[0] ?? null;
}
function pack(match) {
	const { history: _h, ...rest } = match;
	return JSON.stringify(rest);
}
async function tickRoom(code) {
	const sql = await db();
	const room = (await sql.query(`select state, status, version from ash_room where code = $1`, [code]))[0];
	if (!room || room.status !== "active") return;
	const match = JSON.parse(room.state);
	const now = Date.now();
	if (match.winner) return;
	if (!match.clock || match.clock > now) {
		if (match.clock) return;
		match.clock = now + ONLINE_TURN_MS;
		await sql.query(`update ash_room set state = $2, version = version + 1, updated_at = now() where code = $1 and version = $3`, [
			code,
			pack(match),
			room.version
		]);
		return;
	}
	match.log[match.active] = [...match.log[match.active] ?? [], "Time ran out."].slice(-40);
	const { apply, settleOnline } = await import("./logic-D6eA1zDF.mjs").then((n) => n.f);
	let root = {
		screen: "battle",
		match,
		help: false,
		hasSave: false
	};
	root = apply(root, { type: "ask-end" });
	root = apply(root, {
		type: "confirm-end",
		now
	});
	root = settleOnline(root, now);
	if (!root.match) return;
	root.match.clock = root.match.winner ? null : now + ONLINE_TURN_MS;
	if ((await sql.query(`update ash_room set state = $2, version = version + 1, status = $3, updated_at = now()
     where code = $1 and version = $4 returning version`, [
		code,
		pack(root.match),
		root.match.winner ? "done" : "active",
		room.version
	])).length && root.match.winner) await finishIfNeeded(code, root.match);
}
async function finishIfNeeded(code, match) {
	if (!match.winner) return;
	const sql = await db();
	const room = (await sql.query(`select r.host_id, r.guest_id, h.rating as host_rating, g.rating as guest_rating, r.rated
     from ash_room r
     join ash_user h on h.id = r.host_id
     left join ash_user g on g.id = r.guest_id
     where r.code = $1`, [code]))[0];
	if (!room || room.rated || !room.guest_id) return;
	const winnerId = match.winner.player === 0 ? room.host_id : room.guest_id;
	const loserId = match.winner.player === 0 ? room.guest_id : room.host_id;
	const winnerRating = match.winner.player === 0 ? room.host_rating : room.guest_rating;
	const expected = 1 / (1 + 10 ** (((match.winner.player === 0 ? room.guest_rating : room.host_rating) - winnerRating) / 400));
	const delta = Math.max(8, Math.round(32 * (1 - expected)));
	await sql.query(`update ash_user set rating = rating + $2, wins = wins + 1 where id = $1`, [winnerId, delta]);
	await sql.query(`update ash_user set rating = greatest(0, rating - $2), losses = losses + 1 where id = $1`, [loserId, delta]);
	await sql.query(`update ash_room set rated = true, status = 'done' where code = $1`, [code]);
}
var accountRegister_createServerFn_handler = createServerRpc({
	id: "ba7d2009455dbcd9bdfd8a5374cab8be47fb2f73e969ad698b04f6c36caaa854",
	name: "accountRegister",
	filename: "src/game/online.functions.ts"
}, (opts) => accountRegister.__executeServer(opts));
var accountRegister = createServerFn({ method: "POST" }).validator((data) => data).handler(accountRegister_createServerFn_handler, async ({ data }) => {
	const username = data.username.trim().replace(/ +/g, " ");
	const password = data.password;
	if (!/^[A-Za-z0-9_]+(?: [A-Za-z0-9_]+)*$/.test(username) || username.length < 3 || username.length > 16) return {
		ok: false,
		error: "Name must be 3–16 letters, numbers, or single spaces."
	};
	if (password.length < 4 || password.length > 72) return {
		ok: false,
		error: "Password must be 4–72 characters."
	};
	const { randomBytes, scryptSync } = await import("node:crypto");
	const sql = await db();
	if ((await sql.query(`select id from ash_user where lower(username) = lower($1)`, [username])).length) return {
		ok: false,
		error: "That name is taken."
	};
	const salt = randomBytes(16).toString("hex");
	const hash = scryptSync(password, salt, 32).toString("hex");
	const id = `u_${randomBytes(8).toString("hex")}`;
	const token = randomBytes(24).toString("hex");
	await sql.query(`insert into ash_user (id, username, password_hash) values ($1, $2, $3)`, [
		id,
		username,
		`${salt}:${hash}`
	]);
	await sql.query(`insert into ash_session (token, user_id) values ($1, $2)`, [token, id]);
	return {
		ok: true,
		token,
		user: publicUser({
			id,
			username,
			rating: 1e3,
			wins: 0,
			losses: 0
		})
	};
});
var accountLogin_createServerFn_handler = createServerRpc({
	id: "9298ab003c7dfdf2008b6eec8d3ad70493a5af57cedcba8785a5ba735df88316",
	name: "accountLogin",
	filename: "src/game/online.functions.ts"
}, (opts) => accountLogin.__executeServer(opts));
var accountLogin = createServerFn({ method: "POST" }).validator((data) => data).handler(accountLogin_createServerFn_handler, async ({ data }) => {
	const { scryptSync, timingSafeEqual, randomBytes } = await import("node:crypto");
	const sql = await db();
	const row = (await sql.query(`select id, username, password_hash, rating, wins, losses from ash_user where lower(username) = lower($1)`, [data.username.trim().replace(/ +/g, " ")]))[0];
	if (!row) return {
		ok: false,
		error: "Unknown name or wrong password."
	};
	const [salt, hash] = row.password_hash.split(":");
	if (!salt || !hash) return {
		ok: false,
		error: "Unknown name or wrong password."
	};
	const next = scryptSync(data.password, salt, 32);
	const prev = Buffer.from(hash, "hex");
	if (prev.length !== next.length || !timingSafeEqual(prev, next)) return {
		ok: false,
		error: "Unknown name or wrong password."
	};
	const token = randomBytes(24).toString("hex");
	await sql.query(`insert into ash_session (token, user_id) values ($1, $2)`, [token, row.id]);
	return {
		ok: true,
		token,
		user: publicUser(row)
	};
});
var accountMe_createServerFn_handler = createServerRpc({
	id: "f8a19067a0d55e6a274dc4f457ca2ec87f5a576343353dbb075e02b0e92d437b",
	name: "accountMe",
	filename: "src/game/online.functions.ts"
}, (opts) => accountMe.__executeServer(opts));
var accountMe = createServerFn({ method: "POST" }).validator((data) => data).handler(accountMe_createServerFn_handler, async ({ data }) => {
	const row = await userByToken(data.token);
	if (!row) return {
		ok: false,
		error: "Sign in again."
	};
	return {
		ok: true,
		user: publicUser(row)
	};
});
var accountLogout_createServerFn_handler = createServerRpc({
	id: "72987a7c3020604ce5e00f82f6efaa784ac9a7cdb3307cb9417dab2fcb4319f4",
	name: "accountLogout",
	filename: "src/game/online.functions.ts"
}, (opts) => accountLogout.__executeServer(opts));
var accountLogout = createServerFn({ method: "POST" }).validator((data) => data).handler(accountLogout_createServerFn_handler, async ({ data }) => {
	await (await db()).query(`delete from ash_session where token = $1`, [data.token]);
	return { ok: true };
});
var friendList_createServerFn_handler = createServerRpc({
	id: "7c495e7ed6706b7b5efa5369e6d88e4a4c2b953c7119232af1c7974a217abd7e",
	name: "friendList",
	filename: "src/game/online.functions.ts"
}, (opts) => friendList.__executeServer(opts));
var friendList = createServerFn({ method: "POST" }).validator((data) => data).handler(friendList_createServerFn_handler, async ({ data }) => {
	const me = await userByToken(data.token);
	if (!me) return {
		ok: false,
		error: "Sign in again."
	};
	const sql = await db();
	const friends = await sql.query(`select u.id, u.username, u.rating, u.wins, u.losses
       from ash_friend f join ash_user u on u.id = f.friend_id
       where f.owner_id = $1 and f.status = 'accepted' order by u.username`, [me.id]);
	const incoming = await sql.query(`select u.id, u.username, u.rating, u.wins, u.losses
       from ash_friend f join ash_user u on u.id = f.owner_id
       where f.friend_id = $1 and f.status = 'pending' order by u.username`, [me.id]);
	const outgoing = await sql.query(`select u.id, u.username, u.rating, u.wins, u.losses
       from ash_friend f join ash_user u on u.id = f.friend_id
       where f.owner_id = $1 and f.status = 'pending' order by u.username`, [me.id]);
	const invites = await sql.query(`select i.code, u.username as from_name
       from ash_invite i join ash_user u on u.id = i.from_id
       where i.to_id = $1 order by i.created_at desc`, [me.id]);
	const everyone = await sql.query(`select id, username, rating, wins, losses from ash_user where id <> $1 order by lower(username)`, [me.id]);
	const taken = new Set([
		...friends,
		...incoming,
		...outgoing
	].map((row) => row.id));
	return {
		ok: true,
		friends: friends.map((row) => publicUser(row)),
		incoming: incoming.map((row) => ({
			...publicUser(row),
			incoming: true
		})),
		outgoing: outgoing.map((row) => ({
			...publicUser(row),
			pending: true
		})),
		players: everyone.filter((row) => !taken.has(row.id)).map((row) => publicUser(row)),
		invites: invites.map((row) => ({
			code: row.code,
			from: row.from_name
		}))
	};
});
var friendAdd_createServerFn_handler = createServerRpc({
	id: "21e564063d2df71e9ab18f40b9eb59a65a3122918ebb44d8731a166d98e9ca7f",
	name: "friendAdd",
	filename: "src/game/online.functions.ts"
}, (opts) => friendAdd.__executeServer(opts));
var friendAdd = createServerFn({ method: "POST" }).validator((data) => data).handler(friendAdd_createServerFn_handler, async ({ data }) => {
	const me = await userByToken(data.token);
	if (!me) return {
		ok: false,
		error: "Sign in again."
	};
	const sql = await db();
	const other = (await sql.query(`select id from ash_user where lower(username) = lower($1)`, [data.username.trim().replace(/ +/g, " ")]))[0];
	if (!other) return {
		ok: false,
		error: "No player by that name."
	};
	if (other.id === me.id) return {
		ok: false,
		error: "That is you."
	};
	await sql.query(`insert into ash_friend (owner_id, friend_id, status) values ($1, $2, 'accepted')
       on conflict (owner_id, friend_id) do update set status = 'accepted'`, [me.id, other.id]);
	await sql.query(`insert into ash_friend (owner_id, friend_id, status) values ($1, $2, 'accepted')
       on conflict (owner_id, friend_id) do update set status = 'accepted'`, [other.id, me.id]);
	return { ok: true };
});
var friendAnswer_createServerFn_handler = createServerRpc({
	id: "c5a8fcec6ad3ee8a0e99b0410c6ce254c24a14e75b95d8f028016dd03b7e30bf",
	name: "friendAnswer",
	filename: "src/game/online.functions.ts"
}, (opts) => friendAnswer.__executeServer(opts));
var friendAnswer = createServerFn({ method: "POST" }).validator((data) => data).handler(friendAnswer_createServerFn_handler, async ({ data }) => {
	const me = await userByToken(data.token);
	if (!me) return {
		ok: false,
		error: "Sign in again."
	};
	const sql = await db();
	const other = (await sql.query(`select id from ash_user where lower(username) = lower($1)`, [data.username.trim().replace(/ +/g, " ")]))[0];
	if (!other) return {
		ok: false,
		error: "No player by that name."
	};
	if (!data.accept) {
		await sql.query(`delete from ash_friend where owner_id = $1 and friend_id = $2 and status = 'pending'`, [other.id, me.id]);
		return { ok: true };
	}
	await sql.query(`update ash_friend set status = 'accepted' where owner_id = $1 and friend_id = $2`, [other.id, me.id]);
	await sql.query(`insert into ash_friend (owner_id, friend_id, status) values ($1, $2, 'accepted')
       on conflict (owner_id, friend_id) do update set status = 'accepted'`, [me.id, other.id]);
	return { ok: true };
});
var rankBoard_createServerFn_handler = createServerRpc({
	id: "b4209c55380731a53508e1c942e50d976c884adc55b9eb79177e7c3a72f80b24",
	name: "rankBoard",
	filename: "src/game/online.functions.ts"
}, (opts) => rankBoard.__executeServer(opts));
var rankBoard = createServerFn({ method: "POST" }).validator((data) => data).handler(rankBoard_createServerFn_handler, async ({ data }) => {
	if (!await userByToken(data.token)) return {
		ok: false,
		error: "Sign in again."
	};
	return {
		ok: true,
		board: (await (await db()).query(`select id, username, rating, wins, losses from ash_user order by rating desc, wins desc limit 20`)).map((row) => publicUser(row))
	};
});
function roomCode() {
	const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
	let code = "";
	for (let i = 0; i < 4; i++) code += alphabet[Math.floor(Math.random() * 32)];
	return code;
}
async function roomView(code, userId) {
	await tickRoom(code);
	const room = (await (await db()).query(`select code, map_id, host_id, host_name, guest_id, guest_name, state, status, version from ash_room where code = $1`, [code]))[0];
	if (!room) return {
		ok: false,
		error: "No room with that code."
	};
	if (room.host_id !== userId && room.guest_id !== userId) return {
		ok: false,
		error: "That room is not yours."
	};
	const seat = room.host_id === userId ? 0 : 1;
	const { viewFor } = await import("./logic-D6eA1zDF.mjs").then((n) => n.f);
	const match = JSON.parse(room.state);
	const state = room.status === "open" ? null : {
		screen: match.winner ? "victory" : "battle",
		match: viewFor(match, seat),
		help: false,
		hasSave: false
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
		deadline: match.clock ?? null
	};
}
async function openRoom(userId, username, mapId) {
	const { newMatch } = await import("./logic-D6eA1zDF.mjs").then((n) => n.f);
	const { MAP_BY } = await import("./maps-CuzifoaX.mjs").then((n) => n.i);
	if (!MAP_BY[mapId]) return {
		ok: false,
		error: "Unknown map."
	};
	const sql = await db();
	let code = roomCode();
	for (let i = 0; i < 5; i++) {
		if (!(await sql.query(`select code from ash_room where code = $1`, [code])).length) break;
		code = roomCode();
	}
	const match = newMatch(mapId, null);
	match.funds[1] = 1e3;
	await sql.query(`insert into ash_room (code, map_id, host_id, host_name, state, status) values ($1, $2, $3, $4, $5, 'open')`, [
		code,
		mapId,
		userId,
		username,
		pack(match)
	]);
	return roomView(code, userId);
}
var roomHost_createServerFn_handler = createServerRpc({
	id: "37dd19355d25292f2a60584e69fa66f4bfbd74d5fdb5101e3a0ce62e580cb21f",
	name: "roomHost",
	filename: "src/game/online.functions.ts"
}, (opts) => roomHost.__executeServer(opts));
var roomHost = createServerFn({ method: "POST" }).validator((data) => data).handler(roomHost_createServerFn_handler, async ({ data }) => {
	const me = await userByToken(data.token);
	if (!me) return {
		ok: false,
		error: "Sign in again."
	};
	return openRoom(me.id, me.username, data.mapId);
});
var roomJoin_createServerFn_handler = createServerRpc({
	id: "059a24e10a0c03680297c5c7d34916e3a39b4956c82a4a5693154a77c646baab",
	name: "roomJoin",
	filename: "src/game/online.functions.ts"
}, (opts) => roomJoin.__executeServer(opts));
var roomJoin = createServerFn({ method: "POST" }).validator((data) => data).handler(roomJoin_createServerFn_handler, async ({ data }) => {
	const me = await userByToken(data.token);
	if (!me) return {
		ok: false,
		error: "Sign in again."
	};
	const code = data.code.trim().toUpperCase();
	const sql = await db();
	const room = (await sql.query(`select host_id, guest_id, status from ash_room where code = $1`, [code]))[0];
	if (!room) return {
		ok: false,
		error: "No room with that code."
	};
	if (room.host_id === me.id) return roomView(code, me.id);
	if (room.guest_id && room.guest_id !== me.id) return {
		ok: false,
		error: "That room is full."
	};
	if (!room.guest_id && room.status === "open") {
		await sql.query(`update ash_room set guest_id = $2, guest_name = $3, status = 'active', updated_at = now() where code = $1 and guest_id is null`, [
			code,
			me.id,
			me.username
		]);
		await sql.query(`delete from ash_invite where code = $1`, [code]);
	}
	return roomView(code, me.id);
});
var roomInvite_createServerFn_handler = createServerRpc({
	id: "72960209652838ad51bef46e3d485860197c96859aadd427dc254e83aa45ff3b",
	name: "roomInvite",
	filename: "src/game/online.functions.ts"
}, (opts) => roomInvite.__executeServer(opts));
var roomInvite = createServerFn({ method: "POST" }).validator((data) => data).handler(roomInvite_createServerFn_handler, async ({ data }) => {
	const me = await userByToken(data.token);
	if (!me) return {
		ok: false,
		error: "Sign in again."
	};
	const hosted = await openRoom(me.id, me.username, data.mapId);
	if (!hosted.ok) return hosted;
	const sql = await db();
	const other = (await sql.query(`select id from ash_user where lower(username) = lower($1)`, [data.username.trim().replace(/ +/g, " ")]))[0];
	if (!other) return {
		ok: false,
		error: "No player by that name."
	};
	const { randomBytes } = await import("node:crypto");
	await sql.query(`insert into ash_invite (id, from_id, to_id, code) values ($1, $2, $3, $4)`, [
		`i_${randomBytes(6).toString("hex")}`,
		me.id,
		other.id,
		hosted.code
	]);
	return hosted;
});
var roomSync_createServerFn_handler = createServerRpc({
	id: "33fc625873373e950570cacae37780302efb16611b9bb7517d41b01068b217e4",
	name: "roomSync",
	filename: "src/game/online.functions.ts"
}, (opts) => roomSync.__executeServer(opts));
var roomSync = createServerFn({ method: "POST" }).validator((data) => data).handler(roomSync_createServerFn_handler, async ({ data }) => {
	const me = await userByToken(data.token);
	if (!me) return {
		ok: false,
		error: "Sign in again."
	};
	return roomView(data.code.trim().toUpperCase(), me.id);
});
var roomPlay_createServerFn_handler = createServerRpc({
	id: "9afb76d222d7177e8bd560c59b71201fb7f1221ffaa20a53815b8f17bb75b1b0",
	name: "roomPlay",
	filename: "src/game/online.functions.ts"
}, (opts) => roomPlay.__executeServer(opts));
var roomPlay = createServerFn({ method: "POST" }).validator((data) => data).handler(roomPlay_createServerFn_handler, async ({ data }) => {
	const me = await userByToken(data.token);
	if (!me) return {
		ok: false,
		error: "Sign in again."
	};
	if (data.cmd.type === "cursor") return {
		ok: false,
		error: "Ignore."
	};
	const code = data.code.trim().toUpperCase();
	await tickRoom(code);
	const sql = await db();
	const room = (await sql.query(`select host_id, guest_id, state, status, version from ash_room where code = $1`, [code]))[0];
	if (!room) return {
		ok: false,
		error: "No room with that code."
	};
	if (room.status !== "active") return {
		ok: false,
		error: "Waiting for the other player."
	};
	if (room.version !== data.version) return roomView(code, me.id);
	const seat = room.host_id === me.id ? 0 : room.guest_id === me.id ? 1 : -1;
	if (seat < 0) return {
		ok: false,
		error: "That room is not yours."
	};
	const match = JSON.parse(room.state);
	if (match.winner) return roomView(code, me.id);
	if (match.active !== seat) return {
		ok: false,
		error: "Time's up."
	};
	const { apply, settleOnline } = await import("./logic-D6eA1zDF.mjs").then((n) => n.f);
	const now = Date.now();
	let next = apply({
		screen: "battle",
		match,
		help: false,
		hasSave: false
	}, {
		...data.cmd,
		now
	});
	next = settleOnline(next, now);
	if (!next.match) return {
		ok: false,
		error: "The move did not land."
	};
	if (!next.match.winner && (next.match.active !== match.active || next.match.turn !== match.turn)) next.match.clock = now + ONLINE_TURN_MS;
	if (!(await sql.query(`update ash_room set state = $2, version = version + 1, status = $3, updated_at = now()
       where code = $1 and version = $4 returning version`, [
		code,
		pack(next.match),
		next.match.winner ? "done" : "active",
		data.version
	])).length) return roomView(code, me.id);
	if (next.match.winner) await finishIfNeeded(code, next.match);
	return roomView(code, me.id);
});
//#endregion
export { accountLogin_createServerFn_handler, accountLogout_createServerFn_handler, accountMe_createServerFn_handler, accountRegister_createServerFn_handler, friendAdd_createServerFn_handler, friendAnswer_createServerFn_handler, friendList_createServerFn_handler, rankBoard_createServerFn_handler, roomHost_createServerFn_handler, roomInvite_createServerFn_handler, roomJoin_createServerFn_handler, roomPlay_createServerFn_handler, roomSync_createServerFn_handler };
