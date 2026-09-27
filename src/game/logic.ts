// @ts-nocheck
import { FACTIONS, OPENING_PURSE, STRUCT_BY, UNIT_BY, damageOf, hitChance, isUnitKind } from "./catalog";
import { MAPS, MAP_BY, charTerrain } from "./maps";

var SAVE_KEY = "ashveil-match-v1";
var DIRS = [
	[1, 0],
	[-1, 0],
	[0, 1],
	[0, -1]
];
function manh(x, y, x2, y2) {
	return Math.abs(x - x2) + Math.abs(y - y2);
}
function keyOf(x, y) {
	return `${x},${y}`;
}
function parseKey(k) {
	const [x, y] = k.split(",").map(Number);
	return {
		x: x ?? 0,
		y: y ?? 0
	};
}
function other(p) {
	return p === 0 ? 1 : 0;
}
function blankGrid(h, w, v = false) {
	return Array.from({ length: h }, () => Array.from({ length: w }, () => v));
}
function cloneMatch(m) {
	const { history: _h, ...rest } = m;
	return structuredClone({
		...rest,
		history: null
	});
}
function emptyRoot() {
	return {
		screen: "title",
		match: null,
		help: false,
		hasSave: false
	};
}
function loadRoot() {
	if (typeof localStorage === "undefined") return null;
	try {
		const raw = localStorage.getItem(SAVE_KEY);
		if (!raw) return null;
		const parsed = JSON.parse(raw);
		if (parsed.v !== 1 || !parsed.state) return null;
		parsed.state.hasSave = true;
		if (parsed.state.match) {
			parsed.state.match.history = null;
			if (!parsed.state.match.contacts) parsed.state.match.contacts = [[], []];
		}
		return parsed.state;
	} catch {
		return null;
	}
}
function persistRoot(s) {
	if (typeof localStorage === "undefined") return;
	if (s.screen === "title" || s.screen === "manual" || !s.match) return;
	const copy = structuredClone(s);
	if (copy.match) {
		copy.match.history = null;
		copy.match.fx = [];
	}
	localStorage.setItem(SAVE_KEY, JSON.stringify({
		v: 1,
		state: copy
	}));
}
function logTo(m, p, msg) {
	m.log[p] = [...m.log[p], msg].slice(-40);
}
function uid(m, prefix) {
	m.seq += 1;
	return `${prefix}${m.seq}`;
}
function unitAt(m, x, y) {
	return m.units.find((u) => u.x === x && u.y === y);
}
function structAt(m, x, y) {
	return m.structs.find((s) => s.x === x && s.y === y && s.hp > 0);
}
function inBounds(m, x, y) {
	return y >= 0 && x >= 0 && y < m.terrain.length && x < m.terrain[0].length;
}
function groundTerrain(t) {
	return t === "plain" || t === "road" || t === "forest" || t === "rubble";
}
function terrainName(t) {
	switch (t) {
		case "plain": return "Plains";
		case "forest": return "Forest";
		case "ridge": return "Ridge";
		case "water": return "Water";
		case "road": return "Road";
		case "rubble": return "Rubble";
	}
}
function lineTiles(x0, y0, x1, y1) {
	const pts = [];
	let x = x0;
	let y = y0;
	const dx = Math.abs(x1 - x0);
	const dy = Math.abs(y1 - y0);
	const sx = x0 < x1 ? 1 : -1;
	const sy = y0 < y1 ? 1 : -1;
	let err = dx - dy;
	for (let guard = 0; guard < 64; guard++) {
		pts.push({
			x,
			y
		});
		if (x === x1 && y === y1) break;
		const e2 = 2 * err;
		if (e2 > -dy) {
			err -= dy;
			x += sx;
		}
		if (e2 < dx) {
			err += dx;
			y += sy;
		}
	}
	return pts;
}
function blockedBetween(m, x0, y0, x1, y1, block) {
	const pts = lineTiles(x0, y0, x1, y1);
	for (let i = 1; i < pts.length - 1; i++) {
		const p = pts[i];
		if (block(m.terrain[p.y][p.x])) return true;
	}
	return false;
}
function coverage(m, p) {
	const h = m.terrain.length;
	const w = m.terrain[0].length;
	const identified = blankGrid(h, w);
	const radar = blankGrid(h, w);
	const mark = (grid, x, y, radius, forestsBlock) => {
		if (radius <= 0) {
			if (inBounds(m, x, y)) grid[y][x] = true;
			return;
		}
		for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) {
			if (Math.max(Math.abs(x - xx), Math.abs(y - yy)) > radius) continue;
			if (blockedBetween(m, x, y, xx, yy, (t) => t === "ridge" || forestsBlock && t === "forest")) continue;
			grid[yy][xx] = true;
		}
	};
	for (const u of m.units) {
		if (u.owner !== p) continue;
		const def = UNIT_BY[u.kind];
		if (inBounds(m, u.x, u.y)) identified[u.y][u.x] = true;
		if ((u.eta || 0) > 0) continue;
		mark(identified, u.x, u.y, Math.max(def.vision, 3), true);
		if ((def.radar ?? 0) > 1) mark(identified, u.x, u.y, Math.min(def.radar, 4), false);
		if ((def.radar ?? 0) > 0) mark(radar, u.x, u.y, def.radar ?? 0, false);
	}
	for (const s of m.structs) {
		if (s.owner !== p || s.hp <= 0) continue;
		const def = STRUCT_BY[s.kind];
		if (inBounds(m, s.x, s.y)) identified[s.y][s.x] = true;
		if ((s.eta || 0) > 0) continue;
		mark(identified, s.x, s.y, s.kind === "mine" ? def.vision : Math.max(def.vision, 2), true);
		if (def.radar > 1) mark(identified, s.x, s.y, Math.min(def.radar, 4), false);
		if (def.radar > 0) mark(radar, s.x, s.y, def.radar, false);
	}
	return {
		identified,
		radar
	};
}
function revealAround(m, p, x, y, radius) {
	const h = m.terrain.length;
	const w = m.terrain[0].length;
	for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) {
		if (manh(x, y, xx, yy) > radius) continue;
		if (xx !== x || yy !== y) {
			if (blockedBetween(m, x, y, xx, yy, (t) => t === "ridge" || t === "forest")) continue;
		}
		m.seen[p][yy][xx] = true;
	}
}
function refreshIntel(m, p) {
	const cov = coverage(m, p);
	for (let y = 0; y < m.terrain.length; y++) for (let x = 0; x < m.terrain[0].length; x++) if (cov.identified[y][x] || cov.radar[y][x]) m.seen[p][y][x] = true;
	for (const u of m.units) if (u.owner === p && inBounds(m, u.x, u.y)) m.seen[p][u.y][u.x] = true;
	for (const s of m.structs) if (s.owner === p && s.hp > 0 && inBounds(m, s.x, s.y)) m.seen[p][s.y][s.x] = true;
	const mem = new Set(m.mineMemory[p]);
	for (const k of [...mem]) {
		const { x, y } = parseKey(k);
		const sensed = cov.identified[y]?.[x] || cov.radar[y]?.[x];
		const mine = structAt(m, x, y);
		if (sensed && !(mine && mine.kind === "mine" && mine.owner !== p)) mem.delete(k);
	}
	m.mineMemory[p] = [...mem];
	if (!m.contacts) m.contacts = [[], []];
	const tracked = new Map(m.contacts[p].map((c) => [c.id, c]));
	const sense = (x, y) => !!(cov.identified[y]?.[x] || cov.radar[y]?.[x]);
	for (const u of m.units) {
		if (u.owner === p || !sense(u.x, u.y)) continue;
		const prev = tracked.get(u.id);
		tracked.set(u.id, {
			id: u.id,
			domain: UNIT_BY[u.kind].domain,
			kind: prev?.kind,
			x: u.x,
			y: u.y
		});
	}
	for (const s of m.structs) {
		if (s.owner === null || s.owner === p || s.hp <= 0 || s.kind === "mine") continue;
		if (!sense(s.x, s.y)) continue;
		const prev = tracked.get(s.id);
		tracked.set(s.id, {
			id: s.id,
			domain: "ground",
			kind: prev?.kind,
			x: s.x,
			y: s.y
		});
	}
	for (const c of [...tracked.values()]) {
		const unit = m.units.find((u) => u.id === c.id);
		const st = m.structs.find((s) => s.id === c.id && s.hp > 0);
		const piece = unit ?? st;
		const onSpot = !!piece && piece.x === c.x && piece.y === c.y;
		if (cov.identified[c.y]?.[c.x] && !onSpot) tracked.delete(c.id);
	}
	m.contacts[p] = [...tracked.values()];
}
function incomeOf(m, p) {
	let n = 0;
	for (const s of m.structs) {
		if (s.owner !== p || s.hp <= 0 || (s.eta || 0) > 0) continue;
		n += STRUCT_BY[s.kind].income;
	}
	return n;
}
function incomeBits(m, p) {
	let spire = 0;
	let relays = 0;
	for (const s of m.structs) {
		if (s.owner !== p || s.hp <= 0 || (s.eta || 0) > 0) continue;
		if (s.kind === "spire") spire += STRUCT_BY[s.kind].income;
		if (s.kind === "outpost") relays += STRUCT_BY[s.kind].income;
	}
	return `HQ ${spire} · Bases ${relays}`;
}
function productions(m, p) {
	return m.structs.filter((s) => s.owner === p && s.hp > 0 && !(s.eta > 0) && (s.kind === "spire" || s.kind === "outpost"));
}
function realOwner(m, x, y) {
	let best = null;
	let bestD = 99;
	let tie = false;
	for (const s of m.structs) {
		if (s.hp <= 0 || s.owner === null || (s.eta || 0) > 0) continue;
		if (s.kind !== "spire" && s.kind !== "outpost") continue;
		const d = manh(x, y, s.x, s.y);
		if (d < bestD) {
			bestD = d;
			best = s.owner;
			tie = false;
		} else if (d === bestD && s.owner !== best) tie = true;
	}
	if (tie || best === null || bestD > 2) return null;
	return best;
}
function pushFx(m, x, y, text, now) {
	m.fx = [...m.fx, {
		id: uid(m, "fx"),
		x,
		y,
		text,
		until: now + 1100
	}].slice(-14);
	m.shakeUntil = now + 220;
}
function sellOffer(m) {
	if (!m || m.winner) return null;
	const sel = m.selection;
	if (!sel || sel.kind === "buy") return null;
	if (sel.kind === "unit") {
		const u = m.units.find((unit) => unit.id === sel.id);
		if (!u || u.owner !== m.active || u.hp <= 0) return null;
		const def = UNIT_BY[u.kind];
		return {
			name: def.name,
			pay: (u.eta ?? 0) > 0 ? def.cost : Math.floor(def.cost / 2)
		};
	}
	const s = m.structs.find((st) => st.id === sel.id);
	if (!s || s.owner !== m.active || s.hp <= 0 || s.kind === "spire") return null;
	const def = STRUCT_BY[s.kind];
	return {
		name: def.name,
		pay: (s.eta ?? 0) > 0 ? def.cost : Math.floor(def.cost / 2)
	};
}
function doSell(m) {
	const offer = sellOffer(m);
	if (!offer) {
		logTo(m, m.active, "Select one of your pieces to sell. The Headquarters stays.");
		return false;
	}
	const sel = m.selection;
	if (sel?.kind === "unit") m.units = m.units.filter((u) => u.id !== sel.id);
	else if (sel?.kind === "struct") m.structs = m.structs.filter((s) => s.id !== sel.id);
	m.funds[m.active] += offer.pay;
	m.selection = null;
	resetAbandonedCaps(m);
	refreshIntel(m, m.active);
	logTo(m, m.active, `Sold ${offer.name} for ${offer.pay}.`);
	return true;
}
function checkWinner(m) {
	if (m.winner) return;
	for (const s of m.structs) if (s.kind === "spire" && s.hp <= 0 && s.owner !== null) {
		const player = other(s.owner);
		m.winner = {
			player,
			reason: `${FACTIONS[player].name} destroyed the enemy Headquarters.`
		};
	}
}
function removeIfDead(m, now) {
	m.units = m.units.filter((u) => u.hp > 0);
	const kept = [];
	for (const s of m.structs) if (s.hp > 0 || s.kind === "spire") kept.push(s);
	else pushFx(m, s.x, s.y, "Down", now);
	m.structs = kept;
	checkWinner(m);
	const sel = m.selection;
	if (sel?.kind === "unit" && !m.units.some((u) => u.id === sel.id)) m.selection = null;
	if (sel?.kind === "struct" && !m.structs.some((s) => s.id === sel.id && s.hp > 0)) m.selection = null;
}
function drAt(m, x, y, airTarget) {
	const s = structAt(m, x, y);
	let dr = s ? STRUCT_BY[s.kind].dr : 0;
	if (!airTarget) {
		const t = m.terrain[y][x];
		if (t === "forest") dr += .18;
		else if (t === "rubble") dr += .08;
		if (s?.kind === "outpost" || s?.kind === "spire") dr += .06;
	}
	return dr;
}
function attackerFromUnit(u) {
	const d = UNIT_BY[u.kind];
	return {
		name: d.name,
		owner: u.owner,
		x: u.x,
		y: u.y,
		hp: u.hp,
		max: d.hp,
		atk: d.atk,
		vs: d.vs,
		minRange: d.minRange,
		maxRange: d.maxRange,
		indirect: d.indirect,
		air: d.domain === "air",
		flak: u.kind === "aagun",
		kind: u.kind,
		id: u.id,
		isStruct: false
	};
}
function attackerFromStruct(s) {
	const d = STRUCT_BY[s.kind];
	if (d.atk <= 0 || d.maxRange <= 0) return null;
	return {
		name: d.name,
		owner: s.owner ?? 0,
		x: s.x,
		y: s.y,
		hp: s.hp,
		max: d.hp,
		atk: d.atk,
		vs: d.vs,
		minRange: d.minRange,
		maxRange: d.maxRange,
		indirect: false,
		air: false,
		flak: s.kind === "aa",
		kind: s.kind,
		id: s.id,
		isStruct: true
	};
}
function shotBlocked(m, a, tx, ty) {
	if (a.indirect || a.air) return false;
	const quarry = unitAt(m, tx, ty);
	if (a.flak && quarry && UNIT_BY[quarry.kind].domain === "air") return false;
	return blockedBetween(m, a.x, a.y, tx, ty, (t) => t === "ridge");
}
function attackTiles(m, a, ignoreFlags = false) {
	if (!a.isStruct) {
		const u = m.units.find((x) => x.id === a.id);
		if (u && (u.eta || 0) > 0) return [];
		if (!ignoreFlags && (!u || u.acted)) return [];
	} else {
		const s = m.structs.find((x) => x.id === a.id);
		if (s && (s.eta || 0) > 0) return [];
		if (!ignoreFlags && (!s || s.fired || s.owner !== m.active)) return [];
	}
	const out = [];
	for (let y = 0; y < m.terrain.length; y++) for (let x = 0; x < m.terrain[0].length; x++) {
		const d = manh(a.x, a.y, x, y);
		if (d < a.minRange || d > a.maxRange) continue;
		if (shotBlocked(m, a, x, y)) continue;
		const foes = m.units.filter((u) => u.hp > 0 && u.x === x && u.y === y && u.owner !== a.owner);
		const unit = foes[0];
		const st = structAt(m, x, y);
		if (unit) {
			if (foes.some((u) => a.vs[UNIT_BY[u.kind].armor] > 0)) out.push({
				x,
				y
			});
			continue;
		}
		if (st && st.owner !== null && st.owner !== a.owner && a.vs.structure > 0) {
			if (st.kind === "mine") continue;
			out.push({
				x,
				y
			});
		}
	}
	return out;
}
function threatOverlay(m) {
	const rangeKeys = /* @__PURE__ */ new Set();
	const shotKeys = /* @__PURE__ */ new Set();
	const range = [];
	const shots = [];
	const guns = [];
	for (const u of m.units) {
		if (u.owner !== m.active || (u.eta || 0) > 0) continue;
		if (UNIT_BY[u.kind].atk <= 0 || UNIT_BY[u.kind].maxRange <= 0) continue;
		guns.push(attackerFromUnit(u));
	}
	for (const s of m.structs) {
		if (s.owner !== m.active || s.hp <= 0 || (s.eta || 0) > 0) continue;
		const a = attackerFromStruct(s);
		if (a) guns.push(a);
	}
	for (const a of guns) for (const t of attackTiles(m, a)) {
		const k = keyOf(t.x, t.y);
		if (shotKeys.has(k)) continue;
		shotKeys.add(k);
		shots.push(t);
	}
	for (const a of guns) for (const t of attackTiles(m, a, true)) {
		const k = keyOf(t.x, t.y);
		if (shotKeys.has(k) || rangeKeys.has(k)) continue;
		rangeKeys.add(k);
		range.push(t);
	}
	return {
		range,
		shots
	};
}
function passable(m, unit, x, y, ending, eyes) {
	if (!inBounds(m, x, y)) return false;
	const occ = m.units.some((u) => u.hp > 0 && u.id !== unit.id && u.x === x && u.y === y);
	let st = structAt(m, x, y);
	if (eyes && !eyes(x, y)) {
		if (st && st.owner !== unit.owner) st = null;
	}
	if (occ && ending) return false;
	const def = UNIT_BY[unit.kind];
	if (def.domain === "air") {
		if (ending && st) return false;
		return true;
	}
	if (def.domain === "sea") {
		if (st && STRUCT_BY[st.kind].blocks) return false;
		if (st && st.kind !== "mine") return false;
		return m.terrain[y][x] === "water";
	}
	const t = m.terrain[y][x];
	if (t === "water") {
		if (!def.water) return false;
		if (st && STRUCT_BY[st.kind].blocks) return false;
		if (st && st.kind !== "mine") return false;
		return true;
	}
	if (st) {
		if (STRUCT_BY[st.kind].blocks) return false;
		if (st.kind === "mine") return true;
		if (st.kind === "spire" || st.kind === "outpost") {
			if (!ending) return true;
			if (st.kind === "spire" && st.owner !== null && st.owner !== unit.owner) return false;
			if (st.owner === unit.owner || st.owner === null) return true;
			return def.capture;
		}
		return false;
	}
	return groundTerrain(t);
}
function moveNodes(m, unit, eyes) {
	const best = moveMap(m, unit, eyes);
	const ends = [];
	for (const node of best.values()) {
		if (node.x === unit.x && node.y === unit.y) continue;
		if (!passable(m, unit, node.x, node.y, true, eyes)) continue;
		ends.push(node);
	}
	return ends;
}
function pathOf(nodes, x, y, sx, sy) {
	const path = [];
	let k = keyOf(x, y);
	const guard = /* @__PURE__ */ new Set();
	while (k && !guard.has(k)) {
		guard.add(k);
		const n = nodes.get(k);
		if (!n) break;
		path.push({
			x: n.x,
			y: n.y
		});
		if (n.x === sx && n.y === sy) break;
		k = n.parentKey;
	}
	path.reverse();
	return path;
}
function marchLeft(unit) {
	return Math.max(0, UNIT_BY[unit.kind].move - (unit.spent || 0));
}
function moveMap(m, unit, eyes) {
	const def = UNIT_BY[unit.kind];
	const start = {
		x: unit.x,
		y: unit.y,
		cost: 0,
		parentKey: null
	};
	const best = /* @__PURE__ */ new Map([[keyOf(unit.x, unit.y), start]]);
	if ((unit.eta || 0) > 0) return best;
	const budget = marchLeft(unit);
	if (unit.owner !== m.active || budget <= 0) return best;
	const q = [start];
	while (q.length) {
		q.sort((a, b) => a.cost - b.cost);
		const cur = q.shift();
		for (const [dx, dy] of DIRS) {
			const nx = cur.x + dx;
			const ny = cur.y + dy;
			if (!passable(m, unit, nx, ny, false, eyes)) continue;
			const step = def.domain === "ground" && m.terrain[ny][nx] === "forest" ? 2 : 1;
			const cost = cur.cost + step;
			if (cost > budget) continue;
			const k = keyOf(nx, ny);
			const prev = best.get(k);
			if (prev && prev.cost <= cost) continue;
			const node = {
				x: nx,
				y: ny,
				cost,
				parentKey: keyOf(cur.x, cur.y)
			};
			best.set(k, node);
			q.push(node);
		}
	}
	return best;
}
function resetAbandonedCaps(m) {
	for (const s of m.structs) {
		if (s.kind !== "outpost" && s.kind !== "spire") continue;
		const occ = unitAt(m, s.x, s.y);
		if (!(occ && occ.owner !== s.owner && UNIT_BY[occ.kind].capture)) s.cap = s.kind === "spire" ? 10 : 20;
	}
}
function selectedUnit(m) {
	const sel = m.selection;
	if (sel?.kind !== "unit") return void 0;
	return m.units.find((u) => u.id === sel.id);
}
function selectedStruct(m) {
	const sel = m.selection;
	if (sel?.kind !== "struct") return void 0;
	return m.structs.find((s) => s.id === sel.id);
}
function placeTargets(m, item) {
	if (m.phase !== "deploy" || m.winner) return [];
	const p = m.active;
	const out = [];
	const cost = isUnitKind(item) ? UNIT_BY[item].cost : STRUCT_BY[item].cost;
	if (m.funds[p] < cost) return [];
	const limit = isUnitKind(item) ? spawnLimit(m, p, item) : 0;
	for (let y = 0; y < m.terrain.length; y++) for (let x = 0; x < m.terrain[0].length; x++) {
		if (!m.seen[p][y][x]) continue;
		if (isUnitKind(item)) {
			if (!legalSpawn(m, p, item, x, y, limit)) continue;
		} else if (!legalBuild(m, p, item, x, y)) continue;
		out.push({
			x,
			y
		});
	}
	return out;
}
function canStand(m, p, kind, x, y) {
	if (!inBounds(m, x, y) || unitAt(m, x, y)) return false;
	if (UNIT_BY[kind].domain === "sea") {
		if (m.terrain[y][x] !== "water") return false;
		return !structAt(m, x, y);
	}
	const st = structAt(m, x, y);
	if (st) return (st.kind === "spire" || st.kind === "outpost") && st.owner === p;
	return groundTerrain(m.terrain[y][x]);
}
function spawnLimit(m, p, kind) {
	const base = UNIT_BY[kind].domain === "sea" ? 2 : 1;
	const pads = productions(m, p);
	if (!pads.length) return base;
	const cap = base + 6;
	for (let radius = base; radius <= cap; radius++) for (let y = 0; y < m.terrain.length; y++) for (let x = 0; x < m.terrain[0].length; x++) {
		if (!pads.some((s) => manh(s.x, s.y, x, y) <= radius)) continue;
		if (canStand(m, p, kind, x, y)) return radius;
	}
	return cap;
}
function legalSpawn(m, p, kind, x, y, limit) {
	if (!canStand(m, p, kind, x, y)) return false;
	const reach = limit ?? spawnLimit(m, p, kind);
	return productions(m, p).some((s) => manh(s.x, s.y, x, y) <= reach);
}
function legalBuild(m, p, kind, x, y) {
	if (!inBounds(m, x, y) || unitAt(m, x, y) || structAt(m, x, y)) return false;
	if (!groundTerrain(m.terrain[y][x])) return false;
	if (realOwner(m, x, y) !== p) return false;
	if (kind === "outpost") {
		for (const s of m.structs) if (s.kind === "spire" && s.owner !== null && s.owner !== p && manh(x, y, s.x, s.y) < 5) return false;
	}
	return true;
}
function doPlace(m, x, y, now) {
	if (m.selection?.kind !== "buy") return false;
	const item = m.selection.item;
	const p = m.active;
	if (!placeTargets(m, item).some((t) => t.x === x && t.y === y)) {
		logTo(m, p, "Only a gold + square will take it. When the squares beside a base are full, the next ring opens.");
		return true;
	}
	if (isUnitKind(item)) {
		const def = UNIT_BY[item];
		m.funds[p] -= def.cost;
		m.units.push({
			id: uid(m, "u"),
			kind: item,
			owner: p,
			x,
			y,
			hp: def.hp,
			moved: false,
			acted: false,
			fresh: true,
			spent: 0,
			eta: def.build ?? 0,
			charges: def.mines ?? 0
		});
		const wait = def.build ?? 0;
		logTo(m, p, wait ? `${def.name} will be ready in ${wait} ${wait === 1 ? "turn" : "turns"}.` : `${def.name} deployed.`);
		pushFx(m, x, y, wait ? String(wait) : def.name, now);
	} else {
		const def = STRUCT_BY[item];
		m.funds[p] -= def.cost;
		m.structs.push({
			id: uid(m, "s"),
			kind: item,
			owner: p,
			x,
			y,
			hp: def.hp,
			cap: item === "outpost" ? 20 : 0,
			fired: false,
			eta: def.build ?? 0
		});
		const wait = def.build ?? 0;
		logTo(m, p, wait ? `${def.name} will be ready in ${wait} ${wait === 1 ? "turn" : "turns"}.` : `${def.name} founded.`);
		pushFx(m, x, y, wait ? String(wait) : def.name, now);
	}
	refreshIntel(m, p);
	return true;
}
function doMove(m, unit, x, y, now) {
	const nodes = moveMap(m, unit);
	const dest = nodes.get(keyOf(x, y));
	if (!dest || dest.x === unit.x && dest.y === unit.y) return false;
	if (!passable(m, unit, x, y, true)) return false;
	const path = pathOf(nodes, x, y, unit.x, unit.y);
	const def = UNIT_BY[unit.kind];
	let stopped = false;
	const reacted = /* @__PURE__ */ new Set();
	const shown = /* @__PURE__ */ new Set();
	for (const step of path) {
		if (step.x === unit.x && step.y === unit.y) continue;
		unit.x = step.x;
		unit.y = step.y;
		revealAround(m, unit.owner, unit.x, unit.y, Math.max(2, def.vision));
		resetAbandonedCaps(m);
		if (def.domain === "ground") {
			const mine = structAt(m, step.x, step.y);
			if (mine && mine.kind === "mine" && mine.owner !== unit.owner) {
				unit.hp -= 8;
				logTo(m, unit.owner, `Mine — ${def.name} takes 8.`);
				if (mine.owner !== null) logTo(m, mine.owner, `Your charge detonated on a ${def.name} for 8.`);
				mine.hp = 0;
				pushFx(m, step.x, step.y, `−8`, now);
				stopped = true;
				break;
			}
		}
		if (def.domain === "air") {
			reactHere(m, unit, reacted, now);
			if (unit.hp <= 0) {
				stopped = true;
				break;
			}
		}
		revealUnshootable(m, unit, shown);
	}
	unit.spent = stopped ? def.move : (unit.spent || 0) + dest.cost;
	unit.moved = true;
	unstickAll(m);
	if (unit.hp > 0 && def.domain !== "air") reactHere(m, unit, reacted, now);
	if (unit.hp <= 0) {
		logTo(m, unit.owner, `${def.name} is gone.`);
		removeIfDead(m, now);
	} else {
		const here = structAt(m, unit.x, unit.y);
		const prize = here && (here.kind === "spire" || here.kind === "outpost") && here.owner !== unit.owner && def.capture;
		if (prize && !unit.acted) doCapture(m, unit, now);
		else if (prize) logTo(m, unit.owner, `On the ${STRUCT_BY[here.kind].name}. Capture it next turn.`);
		removeIfDead(m, now);
		m.selection = m.units.some((u) => u.id === unit.id) ? {
			kind: "unit",
			id: unit.id
		} : null;
	}
	refreshIntel(m, m.active);
	return true;
}
function revealUnshootable(m, unit, shown) {
	const def = UNIT_BY[unit.kind];
	const a = attackerFromUnit(unit);
	const shots = def.atk > 0 && def.maxRange > 0 && !unit.acted ? attackTiles(m, a, true) : [];
	const can = (x, y) => shots.some((t) => t.x === x && t.y === y);
	const beside = (x, y) => Math.max(Math.abs(unit.x - x), Math.abs(unit.y - y)) === 1;
	const spot = (piece, name) => {
		if (!beside(piece.x, piece.y) || can(piece.x, piece.y) || shown.has(piece.id)) return;
		shown.add(piece.id);
		m.seen[unit.owner][piece.y][piece.x] = true;
		if (!m.contacts) m.contacts = [[], []];
		const list = m.contacts[unit.owner];
		const domain = UNIT_BY[piece.kind] ? UNIT_BY[piece.kind].domain : "ground";
		const rec = { id: piece.id, domain, kind: piece.kind, x: piece.x, y: piece.y };
		const prev = list.find((c) => c.id === piece.id);
		if (prev) Object.assign(prev, rec);
		else list.push(rec);
		logTo(m, unit.owner, `${def.name} passes a ${name} it cannot shoot. The contact is revealed.`);
	};
	for (const foe of m.units) {
		if (foe.hp <= 0 || foe.owner === unit.owner) continue;
		spot(foe, UNIT_BY[foe.kind].name);
	}
	for (const st of m.structs) {
		if (st.hp <= 0 || st.owner === null || st.owner === unit.owner || st.kind === "mine") continue;
		spot(st, STRUCT_BY[st.kind].name);
	}
}
function ammoLeft(piece, max) {
	return piece.hp > 0 && !(piece.eta > 0) && !piece.fired && !piece.acted && (piece.rounds || 0) < max;
}
function hostileGuns(m) {
	const guns = [];
	for (const s of m.structs) {
		if (s.owner === null || s.owner === m.active || s.hp <= 0) continue;
		if (s.kind !== "aa" && s.kind !== "turret" && s.kind !== "bunker") continue;
		if (!ammoLeft(s, STRUCT_BY[s.kind].shots ?? 1)) continue;
		const a = attackerFromStruct(s);
		if (a) guns.push(a);
	}
	for (const u of m.units) {
		if (u.owner === m.active || u.hp <= 0 || u.kind !== "aagun") continue;
		if (!ammoLeft(u, UNIT_BY[u.kind].shots ?? 1)) continue;
		guns.push(attackerFromUnit(u));
	}
	return guns;
}
function reactHere(m, unit, used, now) {
	if (unit.hp <= 0) return;
	for (const a of hostileGuns(m)) {
		if (used.has(a.id)) continue;
		if (!attackTiles(m, a, true).some((t) => t.x === unit.x && t.y === unit.y)) continue;
		used.add(a.id);
		openFire(m, a, unit.x, unit.y, now, true);
		if (unit.hp <= 0) return;
	}
}
function reactVolley(m, now) {
	const used = /* @__PURE__ */ new Set();
	for (const unit of m.units) {
		if (unit.owner !== m.active || unit.hp <= 0) continue;
		reactHere(m, unit, used, now);
	}
}
function openFire(m, a, x, y, now, force = false) {
	return strikeTile(m, a, x, y, now, force);
}
function spendShot(m, a) {
	if (!a.isStruct) {
		const u = m.units.find((z) => z.id === a.id);
		if (!u) return;
		const max = UNIT_BY[u.kind].shots ?? 1;
		u.rounds = (u.rounds || 0) + 1;
		if (u.rounds >= max) u.acted = true;
		else logTo(m, u.owner, `${UNIT_BY[u.kind].name} can fire ${max - u.rounds} more. It can still move.`);
	} else {
		const s = m.structs.find((z) => z.id === a.id);
		if (!s) return;
		const max = STRUCT_BY[s.kind].shots ?? 1;
		s.rounds = (s.rounds || 0) + 1;
		if (s.rounds >= max) s.fired = true;
		else logTo(m, s.owner ?? a.owner, `${STRUCT_BY[s.kind].name} can fire ${max - s.rounds} more.`);
	}
}
function strikeTile(m, a, x, y, now, force = false) {
	if (!attackTiles(m, a, force).some((t) => t.x === x && t.y === y)) return false;
	const foes = m.units.filter((u) => u.hp > 0 && u.x === x && u.y === y && u.owner !== a.owner);
	const st = foes.length ? undefined : structAt(m, x, y);
	if (!foes.length && !st) return false;
	const primary = foes[0];
	const air = primary ? UNIT_BY[primary.kind].domain === "air" : false;
	const victimName = primary ? (foes.length > 1 ? `${foes.length} enemies` : UNIT_BY[primary.kind].name) : STRUCT_BY[st.kind].name;
	const chance = hitChance({
		kind: a.kind,
		dist: manh(a.x, a.y, x, y),
		minRange: a.minRange,
		maxRange: a.maxRange,
		targetAir: air
	});
	const hurt = (scale) => {
		let any = false;
		if (foes.length) {
			for (const unit of foes) {
				const def = UNIT_BY[unit.kind];
				const dmg = Math.max(1, Math.round(damageOf(a.atk, a.vs[def.armor], a.hp, a.max, a.flak && def.domain === "air" ? 0 : drAt(m, x, y, def.domain === "air")) * scale));
				unit.hp -= dmg;
				any = true;
				logTo(m, a.owner, `${a.name} hits ${def.name} for ${dmg}.`);
				if (unit.owner !== a.owner) logTo(m, unit.owner, `Your ${def.name} takes ${dmg} from a ${a.name}.`);
				if (unit.hp <= 0) {
					logTo(m, a.owner, `${def.name} destroyed.`);
					logTo(m, unit.owner, `Your ${def.name} is destroyed.`);
				}
			}
		} else if (st) {
			const dmg = Math.max(1, Math.round(damageOf(a.atk, a.vs.structure, a.hp, a.max, drAt(m, x, y, false)) * scale));
			st.hp -= dmg;
			any = true;
			logTo(m, a.owner, `${a.name} hits ${STRUCT_BY[st.kind].name} for ${dmg}.`);
			if (st.owner !== null && st.owner !== a.owner) logTo(m, st.owner, `Your ${STRUCT_BY[st.kind].name} takes ${dmg} from a ${a.name}.`);
			if (st.hp <= 0 && st.kind !== "spire") {
				logTo(m, a.owner, `${STRUCT_BY[st.kind].name} destroyed.`);
				if (st.owner !== null) logTo(m, st.owner, `Your ${STRUCT_BY[st.kind].name} is destroyed.`);
			}
			if (st.kind === "spire") logTo(m, a.owner, st.hp <= 0 ? "Headquarters destroyed." : `Headquarters has ${st.hp} left.`);
		}
		return any;
	};
	if (Math.random() > chance) {
		spendShot(m, a);
		logTo(m, a.owner, `${a.name} misses ${victimName}.`);
		const victimOwner = primary ? primary.owner : st.owner;
		if (victimOwner !== null && victimOwner !== a.owner) logTo(m, victimOwner, `A ${a.name} misses your ${victimName}.`);
		pushFx(m, x, y, "Miss", now);
		refreshIntel(m, m.active);
		return true;
	}
	if (!hurt(1)) return false;
	const remain = primary ? primary.hp : st.hp;
	pushFx(m, x, y, remain <= 0 ? "Destroyed" : "Hit", now);
	spendShot(m, a);
	removeIfDead(m, now);
	refreshIntel(m, m.active);
	return true;
}
function canCaptureNow(m, unit) {
	if (unit.owner !== m.active || unit.acted || unit.eta || m.winner) return null;
	if (!UNIT_BY[unit.kind].capture) return null;
	const s = structAt(m, unit.x, unit.y);
	if (!s || s.kind !== "outpost" && s.kind !== "spire") return null;
	if (s.owner === unit.owner) return null;
	return s;
}
function doCapture(m, unit, now) {
	const s = canCaptureNow(m, unit);
	if (!s) return false;
	const power = Math.max(5, Math.round(10 * (unit.hp / UNIT_BY[unit.kind].hp)));
	s.cap -= power;
	unit.moved = true;
	unit.acted = true;
	const label = STRUCT_BY[s.kind].name;
	if (s.kind === "spire") {
		s.owner = unit.owner;
		s.cap = 0;
		m.winner = {
			player: unit.owner,
			reason: `${FACTIONS[unit.owner].name} seized the enemy Headquarters.`
		};
		logTo(m, unit.owner, `The Headquarters is yours.`);
		pushFx(m, s.x, s.y, "Seized", now);
		refreshIntel(m, m.active);
		return true;
	}
	if (s.cap <= 0) {
		const prev = s.owner;
		s.owner = unit.owner;
		s.cap = 20;
		s.hp = Math.min(STRUCT_BY.outpost.hp, s.hp + 4);
		logTo(m, unit.owner, `${label} captured.`);
		if (prev !== null) logTo(m, prev, `Your ${label} was captured.`);
		pushFx(m, s.x, s.y, "Captured", now);
	} else {
		logTo(m, unit.owner, `${label} capture ${20 - s.cap} / 20.`);
		pushFx(m, s.x, s.y, "Holding", now);
	}
	refreshIntel(m, m.active);
	return true;
}
function doLay(m, unit, x, y, now) {
	const def = UNIT_BY[unit.kind];
	if (!def.mines || unit.owner !== m.active || unit.acted || (unit.eta || 0) > 0) return false;
	const left = unit.charges ?? def.mines;
	if (left <= 0) {
		logTo(m, unit.owner, `${def.name} is out of mines.`);
		return true;
	}
	if (Math.max(Math.abs(x - unit.x), Math.abs(y - unit.y)) !== 1) {
		logTo(m, unit.owner, "Lay the mine on an adjacent square.");
		return true;
	}
	if (!inBounds(m, x, y) || unitAt(m, x, y) || structAt(m, x, y) || !groundTerrain(m.terrain[y][x])) {
		logTo(m, unit.owner, "That square cannot take a mine.");
		return true;
	}
	m.structs.push({
		id: uid(m, "s"),
		kind: "mine",
		owner: unit.owner,
		x,
		y,
		hp: STRUCT_BY.mine.hp,
		cap: 0,
		fired: false
	});
	unit.charges = left - 1;
	unit.acted = true;
	logTo(m, unit.owner, `${def.name} lays a mine. ${unit.charges} left.`);
	pushFx(m, x, y, "Mine", now);
	refreshIntel(m, m.active);
	return true;
}
function doRepair(m, unit, now, onlyId) {
	const def = UNIT_BY[unit.kind];
	if (def.repair <= 0 || unit.owner !== m.active) return false;
	if ((unit.eta || 0) > 0) {
		logTo(m, unit.owner, `${def.name} is still being built. It cannot heal yet.`);
		return true;
	}
	if (unit.acted) {
		logTo(m, unit.owner, `${def.name} already acted this turn.`);
		return true;
	}
	let n = 0;
	for (const ally of m.units) {
		if (ally.id === unit.id || ally.owner !== unit.owner) continue;
		if (onlyId && ally.id !== onlyId) continue;
		if (Math.max(Math.abs(ally.x - unit.x), Math.abs(ally.y - unit.y)) > 2) continue;
		const max = UNIT_BY[ally.kind].hp;
		if (ally.hp >= max) continue;
		ally.hp = Math.min(max, ally.hp + def.repair);
		n += 1;
		pushFx(m, ally.x, ally.y, `+${def.repair}`, now);
	}
	if (!n) {
		logTo(m, unit.owner, onlyId ? "Nothing to heal there." : "No damaged unit next to the Medevac.");
		return true;
	}
	unit.acted = true;
	logTo(m, unit.owner, `${def.name} heals ${n} for ${def.repair}.`);
	return true;
}
function autofire(m, now) {
	const lines = [];
	const guns = m.structs.filter((s) => s.owner === m.active && s.hp > 0 && !s.fired && !(s.eta > 0) && STRUCT_BY[s.kind].atk > 0);
	for (const gun of guns) {
		let guard = 0;
		while (!gun.fired && guard++ < 4) {
			const a = attackerFromStruct(gun);
			if (!a) break;
			const tiles = attackTiles(m, a, true).filter(() => true);
			let best = null;
			for (const t of tiles) {
				const unit = unitAt(m, t.x, t.y);
				const st = structAt(m, t.x, t.y);
				const armor = unit ? UNIT_BY[unit.kind].armor : "structure";
				const hp = unit ? unit.hp : st?.hp ?? 1;
				unit ? UNIT_BY[unit.kind].hp : st && STRUCT_BY[st.kind].hp;
				const air = unit ? UNIT_BY[unit.kind].domain === "air" : false;
				const dmg = damageOf(a.atk, a.vs[armor], a.hp, a.max, drAt(m, t.x, t.y, air));
				let score = dmg;
				if (hp <= dmg) score += 25;
				if (st?.kind === "spire") score += 10;
				if (unit) score += 3;
				if (!best || score > best.score) best = {
					x: t.x,
					y: t.y,
					score
				};
			}
			if (!best) break;
			const before = m.winner;
			openFire(m, a, best.x, best.y, now, true);
			const last = m.log[m.active][m.log[m.active].length - 1];
			if (last) lines.push(last);
			if (!before && m.winner) break;
		}
		if (m.winner) break;
	}
	return lines;
}
function placeStarter(m, p, sx, sy, tx, ty) {
	const dx = Math.sign(sx - tx);
	const dy = Math.sign(sy - ty);
	const prefs = (Math.abs(tx - sx) >= Math.abs(ty - sy) ? [
		[dx, 0],
		[0, dy],
		[0, -dy || 1],
		[-dx || 1, 0]
	] : [
		[0, dy],
		[dx, 0],
		[-dx || 1, 0],
		[0, -dy || 1]
	]).filter(([ox, oy]) => ox !== 0 || oy !== 0);
	for (const [ox, oy] of prefs) {
		const x = sx + ox;
		const y = sy + oy;
		if (!inBounds(m, x, y) || unitAt(m, x, y) || structAt(m, x, y)) continue;
		if (!groundTerrain(m.terrain[y][x])) continue;
		const def = UNIT_BY.squad;
		m.units.push({
			id: uid(m, "u"),
			kind: "squad",
			owner: p,
			x,
			y,
			hp: def.hp,
			moved: false,
			acted: false,
			fresh: false,
			spent: 0
		});
		return;
	}
}
function newMatch(mapId, bot, hqHp, mode, mods) {
	const map = MAP_BY[mapId] ?? MAPS[0];
	const level = botRank(bot);
	const h = map.rows.length;
	const w = map.rows[0].length;
	const terrain = blankGrid(h, w).map((row, y) => row.map((_, x) => {
		const g = charTerrain(map.rows[y][x]);
		if (g === "p0" || g === "p1" || g === "outpost") return "plain";
		return g;
	}));
	const m = {
		mapId: map.id,
		turn: 1,
		active: 0,
		phase: "deploy",
		funds: level ? [1e3, botPurse(level)] : [...OPENING_PURSE],
		terrain,
		units: [],
		structs: [],
		seen: [blankGrid(h, w), blankGrid(h, w)],
		mineMemory: [[], []],
		contacts: [[], []],
		seq: 0,
		log: [[], []],
		selection: null,
		cursor: {
			x: 0,
			y: 0
		},
		winner: null,
		confirmEnd: false,
		salvo: null,
		fx: [],
		shakeUntil: 0,
		history: null,
		bot: level || null,
		mode: mode === "capture" || mode === "raze" ? mode : "strike",
		crew: [typeof mods === "string" ? mods : "", !level && typeof mods === "string" ? mods : ""]
	};
	const hq = m.mode === "strike" && Number.isFinite(Number(hqHp)) && Number(hqHp) >= 1 && Number(hqHp) <= 100 ? Math.round(Number(hqHp)) : STRUCT_BY.spire.hp;
	const spires = [];
	for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
		const g = charTerrain(map.rows[y][x]);
		if (g === "p0" || g === "p1") {
			const p = g === "p0" ? 0 : 1;
			m.structs.push({
				id: uid(m, "s"),
				kind: "spire",
				owner: p,
				x,
				y,
				hp: hq,
				max: hq,
				cap: 10,
				fired: false
			});
			spires.push({
				p,
				x,
				y
			});
		} else if (g === "outpost") m.structs.push({
			id: uid(m, "s"),
			kind: "outpost",
			owner: null,
			x,
			y,
			hp: STRUCT_BY.outpost.hp,
			cap: 20,
			fired: false
		});
	}
	const a = spires.find((s) => s.p === 0);
	const b = spires.find((s) => s.p === 1);
	placeStarter(m, 0, a.x, a.y, b.x, b.y);
	placeStarter(m, 1, b.x, b.y, a.x, a.y);
	const inc = incomeOf(m, 0);
	m.funds[0] += inc;
	logTo(m, 0, `Opening income +${inc}. ${incomeBits(m, 0)}.`);
	logTo(m, 0, "Pick a catalog card. Gold + squares are the only places it can go.");
	logTo(m, 1, "You are seated second. Your purse includes a 300 stipend. Income arrives on your turn.");
	refreshIntel(m, 0);
	refreshIntel(m, 1);
	m.cursor = {
		x: a.x,
		y: a.y
	};
	return m;
}
function snapshotPush(prev, next) {
	next.history = cloneMatch(prev);
	return next;
}
function unstickAll(m) {
	const seen = new Set();
	for (const u of m.units) {
		if (u.hp <= 0) continue;
		const here = `${u.x},${u.y}`;
		if (!seen.has(here)) {
			seen.add(here);
			continue;
		}
		for (const [dx, dy] of DIRS) {
			const nx = u.x + dx;
			const ny = u.y + dy;
			if (!inBounds(m, nx, ny)) continue;
			if (m.units.some((o) => o.hp > 0 && o.x === nx && o.y === ny)) continue;
			const t = m.terrain[ny][nx];
			const domain = UNIT_BY[u.kind].domain;
			if (domain === "ground" && t === "water" && !UNIT_BY[u.kind].water) continue;
			if (domain === "ground" && t !== "water" && !groundTerrain(t)) continue;
			if (domain === "sea" && t !== "water") continue;
			u.x = nx;
			u.y = ny;
			seen.add(`${nx},${ny}`);
			break;
		}
	}
}
function beginTurn(m, p, now) {
	unstickAll(m);
	m.active = p;
	m.turn += 1;
	m.phase = "deploy";
	m.confirmEnd = false;
	m.salvo = null;
	m.selection = null;
	m.history = null;
	m.fx = [];
	m.winner = m.winner;
	for (const u of m.units) {
		if (u.owner !== p) continue;
		if ((u.eta || 0) > 0) {
			u.eta -= 1;
			if (u.eta === 0) logTo(m, p, `${UNIT_BY[u.kind].name} is ready.`);
		}
		u.moved = false;
		u.acted = false;
		u.fresh = false;
		u.spent = 0;
		u.rounds = 0;
	}
	for (const s of m.structs) if (s.owner === p) {
		if ((s.eta || 0) > 0) {
			s.eta -= 1;
			if (s.eta === 0) logTo(m, p, `${STRUCT_BY[s.kind].name} is finished.`);
		}
		s.fired = false;
		s.rounds = 0;
	}
	m.laying = false;
	const inc = incomeOf(m, p);
	m.funds[p] += inc;
	logTo(m, p, `Income +${inc}. ${incomeBits(m, p)}.`);
	refreshIntel(m, p);
	reactVolley(m, now);
	const spire = m.structs.find((s) => s.kind === "spire" && s.owner === p);
	if (spire) m.cursor = {
		x: spire.x,
		y: spire.y
	};
}
function botGoal(m, p) {
	return m.structs.find((s) => s.kind === "spire" && s.owner !== null && s.owner !== p) ?? {
		x: 0,
		y: 0
	};
}
function botRank(bot) {
	if (bot === "easy") return 2;
	if (bot === "hard") return 8;
	if (bot === "normal" || bot === true) return 5;
	const n = typeof bot === "number" ? Math.round(bot) : 0;
	return n >= 1 && n <= 10 ? n : 0;
}
function botPurse(rank) {
	return Math.min(1e3, 400 + rank * 60);
}
function botLevel(m) {
	return botRank(m.bot);
}
function botScoreTile(m, rank, from, tile) {
	const unit = unitAt(m, tile.x, tile.y);
	const st = structAt(m, tile.x, tile.y);
	if (rank <= 2) return -manh(from.x, from.y, tile.x, tile.y);
	let s = 2;
	if (unit) {
		s += 6;
		if (UNIT_BY[unit.kind].domain === "air") s += rank >= 4 ? 6 : 2;
		if (rank >= 5) s += Math.max(0, 12 - unit.hp);
	}
	if (st?.kind === "spire") s += rank >= 7 ? 28 : rank >= 4 ? 10 : 2;
	if (st?.kind === "outpost") s += rank >= 6 ? 8 : 3;
	if (st && st.kind !== "spire" && st.kind !== "outpost" && st.kind !== "mine") s += rank >= 6 ? 5 : 1;
	const hp = unit?.hp ?? st?.hp ?? 8;
	if (rank >= 5) s += Math.max(0, 8 - hp);
	return s;
}
function botShoot(m, now) {
	const p = m.active;
	const rank = botLevel(m);
	for (const u of m.units) {
		if (u.owner !== p || u.hp <= 0 || (u.eta || 0) > 0 || u.acted) continue;
		if (UNIT_BY[u.kind].repair > 0 && rank >= 6) {
			let patient = null;
			for (const ally of m.units) {
				if (ally.owner !== p || ally.id === u.id || ally.hp >= UNIT_BY[ally.kind].hp) continue;
				if (Math.max(Math.abs(ally.x - u.x), Math.abs(ally.y - u.y)) > 2) continue;
				if (!patient || ally.hp < patient.hp) patient = ally;
			}
			if (patient) {
				doRepair(m, u, now, patient.id);
				continue;
			}
		}
		if (UNIT_BY[u.kind].atk <= 0) continue;
		if ((u.x * 3 + u.y * 5 + m.turn) % 10 >= rank) continue;
		const a = attackerFromUnit(u);
		let tiles = attackTiles(m, a);
		if (rank <= 3) tiles = tiles.filter((t) => Math.max(Math.abs(t.x - u.x), Math.abs(t.y - u.y)) <= 2 + rank);
		if (!tiles.length) continue;
		let best = tiles[0];
		let score = -999;
		for (const t of tiles) {
			const s = botScoreTile(m, rank, u, t);
			if (s > score) {
				score = s;
				best = t;
			}
		}
		openFire(m, a, best.x, best.y, now);
		if (m.winner) return;
	}
	if (rank < 4) return;
	for (const st of m.structs) {
		if (st.owner !== p || st.hp <= 0 || (st.eta || 0) > 0 || st.fired) continue;
		const a = attackerFromStruct(st);
		if (!a) continue;
		const tiles = attackTiles(m, a);
		if (!tiles.length) continue;
		let best = tiles[0];
		let score = -999;
		for (const t of tiles) {
			const s = botScoreTile(m, rank, st, t);
			if (s > score) {
				score = s;
				best = t;
			}
		}
		openFire(m, a, best.x, best.y, now);
		if (m.winner) return;
	}
}
function botWants(m, rank) {
	const p = m.active;
	const owned = m.units.filter((u) => u.owner === p && u.hp > 0);
	const count = (kind) => owned.filter((u) => u.kind === kind).length;
	const has = (kind) => m.structs.some((s) => s.owner === p && s.hp > 0 && s.kind === kind);
	const water = m.terrain.some((row) => row.some((t) => t === "water"));
	const enemyAir = m.units.some((u) => u.owner !== p && u.hp > 0 && UNIT_BY[u.kind].domain === "air");
	const want = [];
	if (count("squad") < Math.min(4, 1 + Math.floor(rank / 3))) want.push("squad");
	if (rank >= 3 && count("pike") < 1) want.push("pike");
	if (rank >= 4 && count("tank") < 1) want.push("tank");
	if (rank >= 3 && (enemyAir || rank >= 8) && count("aagun") < 1 && !has("aa")) want.push(rank >= 7 ? "aa" : "aagun");
	if (rank >= 5 && count("marksman") < 1) want.push("marksman");
	if (rank >= 6 && count("fighter") < 1) want.push("fighter");
	if (rank >= 7 && count("bomber") < (rank >= 10 ? 2 : 1)) want.push("bomber");
	if (rank >= 8 && count("dish") < 1) want.push("dish");
	else if (rank >= 7 && !has("radar")) want.push("radar");
	if (rank >= 8 && water && count("ship") < 1) want.push("ship");
	if (rank >= 8 && !water && count("lobber") < 1) want.push("lobber");
	if (rank >= 9 && count("tender") < 1) want.push("tender");
	if (rank >= 9 && !has("turret")) want.push("turret");
	if (rank >= 10 && count("layer") < 1) want.push("layer");
	if (rank >= 10 && water && count("destroyer") < 1) want.push("destroyer");
	return want;
}
function botBuy(m, now) {
	const p = m.active;
	const rank = botLevel(m);
	const want = botWants(m, rank);
	const goal = botGoal(m, p);
	const home = m.structs.find((s) => s.kind === "spire" && s.owner === p) ?? goal;
	const anchor = rank <= 3 ? home : goal;
	const cap = rank <= 2 ? 1 : rank <= 6 ? 2 : 3;
	let bought = 0;
	for (const item of want) {
		if (bought >= cap || m.winner) break;
		const cost = isUnitKind(item) ? UNIT_BY[item].cost : STRUCT_BY[item].cost;
		if (m.funds[p] < cost) continue;
		const spots = placeTargets(m, item);
		if (!spots.length) continue;
		const spot = spots.slice().sort((a, b) => manh(a.x, a.y, anchor.x, anchor.y) - manh(b.x, b.y, anchor.x, anchor.y))[0];
		m.selection = {
			kind: "buy",
			item
		};
		doPlace(m, spot.x, spot.y, now);
		m.selection = null;
		logTo(m, 0, `South deployed a ${isUnitKind(item) ? UNIT_BY[item].name : STRUCT_BY[item].name}.`);
		bought += 1;
	}
}
function botHold(m, now) {
	const p = m.active;
	for (const u of m.units) {
		if (m.winner) return;
		if (u.owner !== p || u.hp <= 0 || u.acted || (u.eta || 0) > 0) continue;
		if (canCaptureNow(m, u)) doCapture(m, u, now);
	}
}
function botMarch(m, now) {
	const p = m.active;
	const rank = botLevel(m);
	const goal = botGoal(m, p);
	const cap = rank <= 1 ? 1 : rank <= 3 ? 2 : rank <= 5 ? 5 : 99;
	const frac = rank <= 2 ? .4 : rank <= 4 ? .65 : rank <= 6 ? .85 : 1;
	let moved = 0;
	for (const u of m.units) {
		if (m.winner) return;
		if (u.owner !== p || u.hp <= 0 || (u.eta || 0) > 0 || u.acted) continue;
		if (moved >= cap) continue;
		const budget = Math.max(1, Math.round(marchLeft(u) * frac));
		const nodes = moveNodes(m, u).filter((n) => n.cost <= budget);
		if (!nodes.length) continue;
		const here = manh(u.x, u.y, goal.x, goal.y);
		let best = null;
		let bestD = here - (rank >= 4 ? 0 : 1);
		for (const n of nodes) {
			let d = manh(n.x, n.y, goal.x, goal.y);
			const st = structAt(m, n.x, n.y);
			if (st && st.owner !== p && (st.kind === "spire" || st.kind === "outpost") && UNIT_BY[u.kind].capture) d -= st.kind === "spire" ? rank * 6 : rank * 2;
			if (rank >= 8) {
				const foe = m.units.find((e) => e.owner !== p && e.hp > 0);
				if (foe) d -= Math.max(0, 4 - manh(n.x, n.y, foe.x, foe.y));
			}
			if (d < bestD) {
				bestD = d;
				best = n;
			}
		}
		if (best) {
			doMove(m, u, best.x, best.y, now);
			moved += 1;
		}
	}
}
function playBot(m, now) {
	if (!m.bot || m.active !== 1 || m.winner) return;
	botBuy(m, now);
	botHold(m, now);
	botShoot(m, now);
	botMarch(m, now);
	botHold(m, now);
	botShoot(m, now);
	if (m.winner) return;
	autofire(m, now);
	if (m.winner) return;
	m.salvo = null;
	m.confirmEnd = false;
	m.selection = null;
	beginTurn(m, 0, now);
	logTo(m, 0, `South (level ${botLevel(m)}) finished its turn.`);
}
function apply(state, cmd) {
	switch (cmd.type) {
		case "note-save": return {
			...state,
			hasSave: cmd.has
		};
		case "manual": return {
			...state,
			screen: "manual",
			help: false
		};
		case "title": return {
			...state,
			screen: "title",
			help: false,
			match: null
		};
		case "discard-save":
			if (typeof localStorage !== "undefined") localStorage.removeItem(SAVE_KEY);
			return {
				...emptyRoot(),
				hasSave: false
			};
		case "continue": {
			const loaded = loadRoot();
			if (!loaded?.match) return state;
			return {
				...loaded,
				hasSave: true,
				help: false
			};
		}
		case "new": return {
			screen: "battle",
			match: newMatch(cmd.mapId, cmd.bot, cmd.hqHp, cmd.mode, cmd.mods),
			help: false,
			hasSave: true
		};
		case "help": return {
			...state,
			help: !state.help
		};
		case "review":
			if (!state.match?.winner) return state;
			return {
				...state,
				screen: "review",
				help: false
			};
	}
	const match = state.match;
	if (!match) return state;
	if (cmd.type === "ready") {
		if (state.screen !== "handoff" || match.winner) return state;
		const next = cloneMatch(match);
		beginTurn(next, other(match.active), cmd.now);
		if (next.bot && next.active === 1) playBot(next, cmd.now);
		if (next.winner) return {
			screen: "victory",
			match: next,
			help: false,
			hasSave: true
		};
		return {
			screen: "battle",
			match: next,
			help: false,
			hasSave: true
		};
	}
	if (state.screen === "handoff" || state.screen === "victory" || state.screen === "review") return state;
	if (match.winner && cmd.type !== "undo") return {
		...state,
		screen: "victory",
		help: false
	};
	if (cmd.type === "undo") {
		if (!match.history) return state;
		return {
			...state,
			screen: "battle",
			match: match.history,
			help: false
		};
	}
	if (cmd.type === "pass-cover") {
		if (!match.salvo) return state;
		const next = cloneMatch(match);
		next.salvo = null;
		next.selection = null;
		next.history = null;
		next.confirmEnd = false;
		if (next.bot && next.active === 0 && !next.winner) {
			beginTurn(next, 1, Date.now());
			playBot(next, Date.now());
			if (next.winner) return {
				screen: "victory",
				match: next,
				help: false,
				hasSave: true
			};
			return {
				screen: "battle",
				match: next,
				help: false,
				hasSave: true
			};
		}
		return {
			screen: "handoff",
			match: next,
			help: false,
			hasSave: true
		};
	}
	if (cmd.type === "arm-lay") {
		if (match.salvo || match.confirmEnd || match.winner) return state;
		const next = cloneMatch(match);
		next.laying = !next.laying;
		next.history = match.history;
		return {
			...state,
			match: next,
			hasSave: true
		};
	}
	if (cmd.type === "cursor") {
		if (match.salvo || match.confirmEnd) return state;
		if (!inBounds(match, cmd.x, cmd.y)) return state;
		if (match.cursor.x === cmd.x && match.cursor.y === cmd.y) return state;
		const next = cloneMatch(match);
		next.cursor = {
			x: cmd.x,
			y: cmd.y
		};
		next.history = match.history;
		return {
			...state,
			match: next
		};
	}
	if (match.confirmEnd && cmd.type !== "confirm-end" && cmd.type !== "cancel-end") return state;
	if (match.salvo) return state;
	const mutate = () => {
		const m = cloneMatch(match);
		const now = "now" in cmd ? cmd.now : Date.now();
		if (cmd.type === "cancel") {
			m.selection = null;
			m.confirmEnd = false;
			return m;
		}
		if (cmd.type === "cancel-end") {
			m.confirmEnd = false;
			return m;
		}
		if (cmd.type === "ask-end") {
			if (m.winner) return m;
			m.confirmEnd = true;
			m.selection = null;
			return m;
		}
		if (cmd.type === "confirm-end") {
			m.confirmEnd = false;
			const lines = autofire(m, cmd.now);
			if (m.winner) return m;
			if (lines.length) {
				m.salvo = lines;
				return m;
			}
			m.selection = null;
			return m;
		}
		if (cmd.type === "maneuver") {
			if (m.phase !== "deploy") return m;
			m.phase = "maneuver";
			if (m.selection?.kind === "buy") m.selection = null;
			logTo(m, m.active, "Maneuver. Click a unit, then a gold square to move it.");
			return m;
		}
		if (cmd.type === "deploy") {
			if (m.phase !== "maneuver") return m;
			m.phase = "deploy";
			m.selection = null;
			logTo(m, m.active, "Back to buying. Gold + squares mark where a card can go.");
			return m;
		}
		if (cmd.type === "buy") {
			if (m.phase !== "deploy") return m;
			m.selection = {
				kind: "buy",
				item: cmd.item
			};
			return m;
		}
		if (cmd.type === "select") {
			const u = m.units.find((unit) => unit.id === cmd.id && unit.owner === m.active);
			if (!u) return m;
			m.selection = {
				kind: "unit",
				id: u.id
			};
			m.cursor = {
				x: u.x,
				y: u.y
			};
			return m;
		}
		if (cmd.type === "hold") {
			const u = selectedUnit(m);
			if (!u || u.owner !== m.active || u.fresh || u.acted || u.eta) return m;
			u.acted = true;
			u.moved = true;
			logTo(m, m.active, `${UNIT_BY[u.kind].name} holds.`);
			return m;
		}
		if (cmd.type === "repair") {
			const u = selectedUnit(m);
			if (!u) return m;
			doRepair(m, u, now);
			return m;
		}
		if (cmd.type === "capture") {
			const u = selectedUnit(m);
			if (!u) return m;
			doCapture(m, u, now);
			return m;
		}
		if (cmd.type === "sell") {
			doSell(m);
			return m;
		}
		if (cmd.type === "restock") {
			doRestock(m, now);
			return m;
		}
		if (cmd.type === "strike") {
			const u = selectedUnit(m);
			const s = selectedStruct(m);
			const a = u ? attackerFromUnit(u) : s ? attackerFromStruct(s) : null;
			if (!a) return m;
			const tiles = attackTiles(m, a);
			let tx = m.cursor.x;
			let ty = m.cursor.y;
			if (!tiles.some((t) => t.x === tx && t.y === ty)) {
				const best = [...tiles].sort((p, q) => manh(a.x, a.y, p.x, p.y) - manh(a.x, a.y, q.x, q.y))[0];
				if (!best) {
					logTo(m, m.active, "No target in range.");
					return m;
				}
				tx = best.x;
				ty = best.y;
				m.cursor = {
					x: tx,
					y: ty
				};
			}
			openFire(m, a, tx, ty, now);
			return m;
		}
		if (cmd.type === "click") {
			const { x, y } = cmd;
			m.cursor = {
				x,
				y
			};
			if (!inBounds(m, x, y)) return m;
			if (m.selection?.kind === "buy") {
				const own = unitAt(m, x, y);
				if (own && own.owner === m.active) {
					m.selection = {
						kind: "unit",
						id: own.id
					};
					return m;
				}
				doPlace(m, x, y, now);
				return m;
			}
			const selU = selectedUnit(m);
			if (selU && selU.owner === m.active) {
				if (UNIT_BY[selU.kind].repair > 0 && !selU.acted && !(selU.eta > 0)) {
					const patient = unitAt(m, x, y);
					if (patient && patient.id !== selU.id && patient.owner === m.active) {
						const dist = Math.max(Math.abs(patient.x - selU.x), Math.abs(patient.y - selU.y));
						if (patient.hp >= UNIT_BY[patient.kind].hp) {
							logTo(m, m.active, `${UNIT_BY[patient.kind].name} is already at full health.`);
							return m;
						}
						if (dist > 2) {
							logTo(m, m.active, "Too far to heal. Move within 2 squares.");
							return m;
						}
						doRepair(m, selU, now, patient.id);
						return m;
					}
				}
				if (m.laying && (UNIT_BY[selU.kind].mines ?? 0) > 0) {
					doLay(m, selU, x, y, now);
					m.laying = false;
					return m;
				}
				const dest = moveMap(m, selU).get(keyOf(x, y));
				const isAtk = attackTiles(m, attackerFromUnit(selU)).some((t) => t.x === x && t.y === y);
				const isMove = !!dest && passable(m, selU, x, y, true) && !(x === selU.x && y === selU.y);
				if (isMove && isAtk) {
					const st = structAt(m, x, y);
					if (st && (st.kind === "outpost" || st.kind === "spire") && UNIT_BY[selU.kind].capture) doMove(m, selU, x, y, now);
					else openFire(m, attackerFromUnit(selU), x, y, now);
					return m;
				}
				if (isMove) {
					doMove(m, selU, x, y, now);
					return m;
				}
				if (isAtk) {
					openFire(m, attackerFromUnit(selU), x, y, now);
					return m;
				}
				const foe = unitAt(m, x, y);
				const foeS = structAt(m, x, y);
				const cov = coverage(m, m.active);
				if (!!(cov.identified[y]?.[x] || cov.radar[y]?.[x]) && (foe && foe.owner !== m.active || foeS && foeS.owner !== null && foeS.owner !== m.active && foeS.hp > 0)) {
					logTo(m, m.active, selU.acted ? "That unit already fired." : "Out of range. Move onto a square that can see them, then shoot. Firing ends movement.");
					return m;
				}
				if (x === selU.x && y === selU.y && canCaptureNow(m, selU)) {
					doCapture(m, selU, now);
					return m;
				}
				if (x === selU.x && y === selU.y && UNIT_BY[selU.kind].repair > 0 && !selU.acted) {
					doRepair(m, selU, now);
					return m;
				}
			}
			const selS = selectedStruct(m);
			if (selS && selS.owner === m.active) {
				const a = attackerFromStruct(selS);
				if (a && attackTiles(m, a).some((t) => t.x === x && t.y === y)) {
					openFire(m, a, x, y, now);
					return m;
				}
			}
			const ownU = unitAt(m, x, y);
			if (ownU && ownU.owner === m.active) {
				m.selection = {
					kind: "unit",
					id: ownU.id
				};
				return m;
			}
			const ownS = structAt(m, x, y);
			if (ownS && ownS.owner === m.active) {
				m.selection = {
					kind: "struct",
					id: ownS.id
				};
				return m;
			}
			m.selection = null;
			return m;
		}
		return m;
	};
	const next = mutate();
	if (!next) return state;
	if (cmd.type === "confirm-end") {
		if (next.winner) {
			next.history = null;
			return {
				screen: "victory",
				match: next,
				help: false,
				hasSave: true
			};
		}
		if (next.salvo && next.salvo.length) return {
			screen: "battle",
			match: snapshotPush(match, next),
			help: false,
			hasSave: true
		};
		if (next.bot && next.active === 0 && !next.winner) {
			beginTurn(next, 1, cmd.now);
			playBot(next, cmd.now);
			next.history = null;
			if (next.winner) return {
				screen: "victory",
				match: next,
				help: false,
				hasSave: true
			};
			return {
				screen: "battle",
				match: next,
				help: false,
				hasSave: true
			};
		}
		next.history = null;
		next.selection = null;
		return {
			screen: "handoff",
			match: next,
			help: false,
			hasSave: true
		};
	}
	if (next.winner) {
		next.history = null;
		return {
			screen: "victory",
			match: next,
			help: false,
			hasSave: true
		};
	}
	const stored = cmd.type === "click" || cmd.type === "hold" || cmd.type === "capture" || cmd.type === "repair" || cmd.type === "sell" || cmd.type === "restock" || cmd.type === "strike" || cmd.type === "buy" || cmd.type === "maneuver" || cmd.type === "deploy" ? snapshotPush(match, next) : {
		...next,
		history: match.history
	};
	return {
		...state,
		match: stored,
		hasSave: true
	};
}
function inspectTile(m, x, y, viewer) {
	if (!inBounds(m, x, y)) return {
		title: "Unseen",
		lines: ["No chart of this ground yet."]
	};
	const cov = coverage(m, viewer);
	const idd = cov.identified[y][x];
	const rad = cov.radar[y][x];
	const seenTile = m.seen[viewer][y][x];
	const lines = [terrainName(m.terrain[y][x])];
	const unit = unitAt(m, x, y);
	const st = structAt(m, x, y);
	if (!(!!unit && unit.owner === viewer || !!st && st.owner === viewer && st.hp > 0) && !seenTile && !idd && !rad) {
		lines.push("Outside your radar.");
		return {
			title: "No contact",
			lines
		};
	}
	if (unit && (unit.owner === viewer || idd)) {
		const d = UNIT_BY[unit.kind];
		const who = unit.owner === viewer ? "Yours" : FACTIONS[unit.owner].name;
		lines.push(`${who} · ${d.name} · ${unit.hp}/${d.hp}`);
		if ((unit.eta || 0) > 0) lines.push(`Under construction · ${unit.eta} ${unit.eta === 1 ? "turn" : "turns"}`);
	} else if (unit && unit.owner !== viewer && rad) {
		const domain = UNIT_BY[unit.kind].domain;
		lines.push(domain === "air" ? "Radar blip · air" : domain === "sea" ? "Radar blip · sea" : "Radar blip · ground");
	}
	if (st && st.kind === "mine" && st.owner !== viewer) {} else if (st && (st.owner === viewer || idd || rad)) {
		const d = STRUCT_BY[st.kind];
		const who = st.owner === null ? "Neutral" : st.owner === viewer ? "Yours" : FACTIONS[st.owner].name;
		if (idd || st.owner === viewer) {
			lines.push(`${who} · ${d.name} · ${st.hp}/${d.hp}`);
			if ((st.eta || 0) > 0) lines.push(`Under construction · ${st.eta} ${st.eta === 1 ? "turn" : "turns"}`);
			if ((st.kind === "outpost" || st.kind === "spire") && st.owner !== viewer) {
				const max = st.kind === "spire" ? 10 : 20;
				if (st.cap < max) lines.push(`Capture ${max - st.cap}/${max}`);
			}
		} else lines.push("Radar blip · building");
	}
	const contact = (m.contacts?.[viewer] ?? []).find((c) => c.x === x && c.y === y);
	const contactHere = contact && (unit && unit.id === contact.id && unit.x === x && unit.y === y && (idd || rad) || st && st.id === contact.id && st.x === x && st.y === y && (idd || rad));
	if (contact && !contactHere) lines.push(contact.domain === "air" ? "Last known radar · air" : contact.domain === "sea" ? "Last known radar · sea" : "Last known radar · ground");
	if (!idd && !rad && lines.length === 1) lines.push("Last seen empty.");
	return {
		title: idd ? "In sight" : rad ? "On radar" : "Remembered",
		lines
	};
}
function selectionOverlay(m) {
	const moves = [];
	const attacks = [];
	const places = [];
	const heals = [];
	const lays = [];
	if (m.selection?.kind === "buy") places.push(...placeTargets(m, m.selection.item));
	const u = selectedUnit(m);
	if (u) {
		const cov = coverage(m, u.owner);
		const eyes = (x, y) => !!(cov.identified[y]?.[x] || cov.radar[y]?.[x]);
		for (const n of moveNodes(m, u, eyes)) moves.push({
			x: n.x,
			y: n.y
		});
		attacks.push(...attackTiles(m, attackerFromUnit(u)));
		if (UNIT_BY[u.kind].repair > 0 && !u.acted && !(u.eta > 0)) for (const ally of m.units) {
			if (ally.id === u.id || ally.owner !== u.owner) continue;
			if (ally.hp >= UNIT_BY[ally.kind].hp) continue;
			if (Math.max(Math.abs(ally.x - u.x), Math.abs(ally.y - u.y)) > 2) continue;
			heals.push({
				x: ally.x,
				y: ally.y
			});
		}
		if (m.laying && (UNIT_BY[u.kind].mines ?? 0) > 0 && !u.acted && !(u.eta > 0) && (u.charges ?? UNIT_BY[u.kind].mines) > 0) for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
			if (!dx && !dy) continue;
			const x = u.x + dx;
			const y = u.y + dy;
			if (!inBounds(m, x, y) || unitAt(m, x, y) || structAt(m, x, y)) continue;
			if (!groundTerrain(m.terrain[y][x])) continue;
			lays.push({
				x,
				y
			});
		}
	}
	const s = selectedStruct(m);
	if (s) {
		const a = attackerFromStruct(s);
		if (a) attacks.push(...attackTiles(m, a));
	}
	return {
		moves,
		attacks,
		places,
		heals,
		lays
	};
}
function captureReady(m) {
	const u = selectedUnit(m);
	return !!u && !!canCaptureNow(m, u);
}
function holdReady(m) {
	const u = selectedUnit(m);
	return !!u && u.owner === m.active && !u.fresh && !u.acted;
}
function repairReady(m) {
	const u = selectedUnit(m);
	return !!u && u.owner === m.active && UNIT_BY[u.kind].repair > 0 && !u.acted && !(u.eta > 0);
}
function layReady(m) {
	const u = selectedUnit(m);
	if (!u || u.owner !== m.active || u.acted || (u.eta || 0) > 0) return false;
	const def = UNIT_BY[u.kind];
	if (!def.mines) return false;
	return (u.charges ?? def.mines) > 0;
}
function restockOffer(m) {
	const u = selectedUnit(m);
	if (!u || u.owner !== m.active || u.acted || (u.eta || 0) > 0) return null;
	const def = UNIT_BY[u.kind];
	const max = def.mines ?? 0;
	if (!max) return null;
	const left = u.charges ?? max;
	if (left >= max) return null;
	const near = m.structs.some((s) => s.hp > 0 && (s.kind === "spire" || s.kind === "outpost") && s.owner === u.owner && Math.max(Math.abs(s.x - u.x), Math.abs(s.y - u.y)) <= 1);
	if (!near) return null;
	const pay = Math.max(40, Math.round(def.cost * 0.35));
	if (m.funds[u.owner] < pay) return null;
	return { pay, left, max };
}
function doRestock(m, now) {
	const offer = restockOffer(m);
	const u = selectedUnit(m);
	if (!offer || !u) return false;
	m.funds[u.owner] -= offer.pay;
	u.charges = UNIT_BY[u.kind].mines;
	u.acted = true;
	logTo(m, u.owner, `${UNIT_BY[u.kind].name} restocked for ${offer.pay}.`);
	pushFx(m, u.x, u.y, "Mines", now);
	return true;
}
function idleCount(m) {
	return {
		units: m.units.filter((u) => u.owner === m.active && !u.fresh && !u.acted).length,
		guns: m.structs.filter((s) => s.owner === m.active && s.hp > 0 && !s.fired && STRUCT_BY[s.kind].atk > 0).length
	};
}
function viewFor(m, viewer) {
	const cov = coverage(m, viewer);
	const seenMine = new Set(m.mineMemory?.[viewer] ?? []);
	const units = m.units.filter((u) => {
		if (u.hp <= 0) return false;
		if (u.owner === viewer) return true;
		return !!(cov.identified[u.y]?.[u.x] || cov.radar[u.y]?.[u.x]);
	});
	const structs = m.structs.filter((s) => {
		if (s.owner === viewer || s.owner === null) return true;
		if (s.kind === "mine") return seenMine.has(`${s.x},${s.y}`) || !!cov.identified[s.y]?.[s.x];
		return !!(cov.identified[s.y]?.[s.x] || cov.radar[s.y]?.[s.x] || m.seen[viewer]?.[s.y]?.[s.x]);
	});
	const blankSeen = m.seen[0].map((row) => row.map(() => false));
	const log = [[], []];
	log[viewer] = (m.log[viewer] ?? []).slice(-12);
	return {
		...m,
		units,
		structs,
		log,
		seen: viewer === 0 ? [m.seen[0], blankSeen] : [blankSeen, m.seen[1]],
		mineMemory: viewer === 0 ? [m.mineMemory[0] ?? [], []] : [[], m.mineMemory[1] ?? []],
		contacts: viewer === 0 ? [m.contacts[0] ?? [], []] : [[], m.contacts[1] ?? []],
		history: null,
		selection: m.active === viewer ? m.selection : null,
		confirmEnd: m.active === viewer ? m.confirmEnd : false,
		salvo: m.active === viewer ? m.salvo : null,
		laying: m.active === viewer ? m.laying : false,
		fx: m.active === viewer ? m.fx : []
	};
}
function settleOnline(root, now) {
	let next = root;
	if (next.screen === "battle" && next.match?.salvo?.length) next = apply(next, { type: "pass-cover" });
	if (next.screen === "handoff" && next.match) next = apply(next, {
		type: "ready",
		now
	});
	return next;
}
function publicSummary(s) {
	const m = s.match;
	return {
		screen: s.screen,
		help: s.help,
		map: m?.mapId ?? null,
		turn: m?.turn ?? 0,
		active: m?.active ?? -1,
		phase: m?.phase ?? "",
		funds: m ? m.funds[m.active] : 0,
		winner: m?.winner?.player ?? null,
		confirm: !!m?.confirmEnd,
		salvo: !!m?.salvo,
		units: m?.units.filter((u) => u.owner === m.active).length ?? 0
	};
}

export {
  apply,
  captureReady,
  coverage,
  emptyRoot,
  holdReady,
  idleCount,
  incomeBits,
  incomeOf,
  inspectTile,
  layReady,
  loadRoot,
  marchLeft,
  newMatch,
  persistRoot,
  publicSummary,
  repairReady,
  restockOffer,
  selectionOverlay,
  sellOffer,
  settleOnline,
  structAt,
  terrainName,
  threatOverlay,
  unitAt,
  viewFor,
};
