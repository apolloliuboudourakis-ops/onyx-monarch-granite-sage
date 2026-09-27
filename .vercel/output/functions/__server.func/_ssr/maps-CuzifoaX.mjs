//#region node_modules/.nitro/vite/services/ssr/assets/maps-CuzifoaX.js
var __defProp = Object.defineProperty;
var __exportAll = (all, no_symbols) => {
	let target = {};
	for (var name in all) __defProp(target, name, {
		get: all[name],
		enumerable: true
	});
	if (!no_symbols) __defProp(target, Symbol.toStringTag, { value: "Module" });
	return target;
};
var maps_exports = /* @__PURE__ */ __exportAll({
	MAPS: () => MAPS,
	MAP_BY: () => MAP_BY,
	charTerrain: () => charTerrain
});
var CROSS = 46;
function isBase(c) {
	return c === "1" || c === "2" || c === "o";
}
function findGlyph(rows, g) {
	for (let y = 0; y < rows.length; y++) {
		const x = rows[y].indexOf(g);
		if (x >= 0) return {
			x,
			y
		};
	}
	throw new Error(`missing ${g}`);
}
function terrainAt(rows, x, y) {
	const c = rows[y][x];
	if (!isBase(c)) return c;
	for (const [dx, dy] of [
		[1, 0],
		[-1, 0],
		[0, 1],
		[0, -1],
		[1, 1],
		[-1, 1],
		[1, -1],
		[-1, -1]
	]) {
		const nx = x + dx;
		const ny = y + dy;
		if (ny < 0 || nx < 0 || ny >= rows.length || nx >= rows[0].length) continue;
		const n = rows[ny][nx];
		if (!isBase(n)) return n;
	}
	return ".";
}
function insertCol(rows, at) {
	const sample = Math.max(0, at - 1);
	return rows.map((row, y) => row.slice(0, at) + terrainAt(rows, sample, y) + row.slice(at));
}
function insertRow(rows, at) {
	const sample = Math.max(0, at - 1);
	const proto = rows[sample].split("").map((_, x) => terrainAt(rows, x, sample)).join("");
	const next = rows.slice();
	next.splice(at, 0, proto);
	return next;
}
function grow(rows) {
	let map = rows.map((row) => row);
	for (let guard = 0; guard < 80; guard++) {
		const a = findGlyph(map, "1");
		const b = findGlyph(map, "2");
		const dx = Math.abs(a.x - b.x);
		const dy = Math.abs(a.y - b.y);
		if (dx + dy >= CROSS) break;
		if (dy === 0 || dx > 0 && dx <= dy) map = insertCol(map, Math.max(a.x, b.x));
		else map = insertRow(map, Math.max(a.y, b.y));
	}
	while ((map[0]?.length ?? 0) < 48) {
		const x = map[0].length - 1;
		map = map.map((row, y) => row + terrainAt(map, x, y));
	}
	while (map.length < 36) {
		const y = map.length - 1;
		const proto = map[y].split("").map((_, x) => terrainAt(map, x, y)).join("");
		map = [...map, proto];
	}
	return map;
}
var MAPS = [
	{
		id: "kiln",
		name: "West Canal",
		kind: "mixed",
		blurb: "A long road and a canal on the west flank. Ships run the water. Two neutral supply bases sit off the march.",
		rows: grow([
			"wwwwwwwwwwwwwwwwwwwwwwwwwwwwww",
			"wwwwwwwwwwwwwwwwwwwwwwwwwwwwww",
			"www........................www",
			"www..............fffff.....www",
			"www..............fffff.....www",
			"wwwwwwwwwwwww.1..fffff.....www",
			"www...........=............www",
			"www...........=...o........www",
			"www...rrr.....=...rrr......www",
			"www...rr=============......www",
			"www.......,...=.,..........www",
			"www...........=............www",
			"www...........=...o........www",
			"www...........=............www",
			"wwwwwwwwwwwww.2..fffff.....www",
			"www..............fffff.....www",
			"www..............fffff.....www",
			"www........................www",
			"wwwwwwwwwwwwwwwwwwwwwwwwwwwwww",
			"wwwwwwwwwwwwwwwwwwwwwwwwwwwwww"
		])
	},
	{
		id: "spine",
		name: "The Ridge",
		kind: "mixed",
		blurb: "A wide east-west ridge with a road through the middle. The north coast is open water — dock, sail, and shell.",
		rows: grow([
			"wwwwwwwwwwwwwwwwwwwwwwwwwwwwww",
			"wwwwwwwwwwwwwwwwwwwwwwwwwwwwww",
			"wwwwwwwwwwwwwwwwwwwwwwwwwwwwww",
			"ww....w................w....ww",
			"ww....w................w....ww",
			"ww....w................w....ww",
			"ww....w.rrrrrr..rrrrrr.w....ww",
			"ww....w.rrrrrr..rrrrrr.w....ww",
			"ww..........................ww",
			"ww....1================2....ww",
			"ww..........................ww",
			"ww........ffff..ffff........ww",
			"ww........ffof..foff........ww",
			"ww........ffff,,ffff........ww",
			"ww..........................ww",
			"ww..........................ww",
			"ww..........................ww",
			"ww..........................ww",
			"wwwwwwwwwwwwwwwwwwwwwwwwwwwwww",
			"wwwwwwwwwwwwwwwwwwwwwwwwwwwwww"
		])
	},
	{
		id: "cause",
		name: "The Bridge",
		kind: "mixed",
		blurb: "A broad moat and one bridge. Ships own the water. Aircraft ignore the bridge. The headquarters sit in opposite corners.",
		rows: grow([
			"wwwwwwwwwwwwwwwwwwwwwwwwwwwwww",
			"wwwwwwwwwwwwwwwwwwwwwwwwwwwwww",
			"wwwwwwwwwwwwwwwwwwwwwwwwwwwwww",
			"www........................www",
			"www..1=========............www",
			"www.....ffff..=....rrr.....www",
			"www.....fff,..=....rrr.....www",
			"www......o....=............www",
			"www...........==...........www",
			"wwwwwwwwwwwwww==wwwwwwwwwwwwww",
			"wwwwwwwwwwwwww==wwwwwwwwwwwwww",
			"www...........==...........www",
			"www.....rrr...=...ffof.....www",
			"www.....rrr...=...ffff.....www",
			"www...........=...,........www",
			"www...........==========2..www",
			"www........................www",
			"wwwwwwwwwwwwwwwwwwwwwwwwwwwwww",
			"wwwwwwwwwwwwwwwwwwwwwwwwwwwwww",
			"wwwwwwwwwwwwwwwwwwwwwwwwwwwwww"
		])
	},
	{
		id: "harbor",
		name: "Harbor",
		kind: "mixed",
		blurb: "A large bay with a dock off each headquarters. Ships sail the water around the island. The center road pays if you hold the supply bases.",
		rows: grow([
			"wwwwwwwwwwwwwwwwwwwwwwwwwwwwww",
			"wwwwwwwwwwwwwwwwwwwwwwwwwwwwww",
			"wwwwwwwwwwwwwwwwwwwwwwwwwwwwww",
			"wwww......................wwww",
			"wwww......ffff............wwww",
			"wwww......ffff............wwww",
			"wwwwwww.1.....==..........wwww",
			"wwww..........==..........wwww",
			"wwww........,.==..........wwww",
			"wwww..rrr.....==....rrr...wwww",
			"wwww..rrr.o...==...orrr...wwww",
			"wwww..........==..........wwww",
			"wwww..........==.,........wwww",
			"wwww..........==.....2.wwwwwww",
			"wwww............ffff......wwww",
			"wwww............ffff......wwww",
			"wwww......................wwww",
			"wwwwwwwwwwwwwwwwwwwwwwwwwwwwww",
			"wwwwwwwwwwwwwwwwwwwwwwwwwwwwww",
			"wwwwwwwwwwwwwwwwwwwwwwwwwwwwww"
		])
	},
	{
		id: "plain",
		name: "The Plain",
		kind: "land",
		blurb: "Open country. No water and no ships. A road runs from headquarters to headquarters, with woods and ridges on the flanks.",
		rows: grow([
			"..............................",
			"..fffff................fffff..",
			"..fffff................fffff..",
			"..........rrrr....rrrr........",
			"..........rrrr....rrrr........",
			"1============================2",
			"..........rrrr....rrrr........",
			"..........rrrr....rrrr........",
			"..fffff.......o........fffff..",
			"..fffff................fffff..",
			"..............o...............",
			"......fffff..........fffff....",
			"......fffff..........fffff....",
			"..............................",
			"..............................",
			"..............................",
			"..............................",
			"..............................",
			"..............................",
			".............................."
		])
	},
	{
		id: "heights",
		name: "High Ground",
		kind: "land",
		blurb: "Ridges cut the field into lanes. No coast. Hold the gaps and the two supply bases in the low ground.",
		rows: grow([
			"..............................",
			".rrrrrrrrrrr..rrrrrrrrrrrrrrr.",
			".r..........................r.",
			".r..fffff............fffff..r.",
			".r.......................o..r.",
			".r..........====..====......r.",
			"1============================2",
			".r..........====..====......r.",
			".r..o.......................r.",
			".r..fffff............fffff..r.",
			".r..........................r.",
			".rrrrrrrrrrr..rrrrrrrrrrrrrrr.",
			"..............................",
			".........rrrr....rrrr.........",
			".........rrrr....rrrr.........",
			"..............................",
			"......fffff..........fffff....",
			"......fffff..........fffff....",
			"..............................",
			".............................."
		])
	},
	{
		id: "ocean",
		name: "Open Ocean",
		kind: "sea",
		blurb: "Two islands and a lot of water. Ships own the crossing. Aircraft hop the gap. Ground troops stay on their island.",
		rows: grow([
			"wwwwwwwwwwwwwwwwwwwwwwwwwwwwww",
			"wwwwwwwwwwwwwwwwwwwwwwwwwwwwww",
			"wwwwwwwwwwwwwwwwwwwwwwwwwwwwww",
			"www......wwwwwwwwwwwwwwwwwwwww",
			"www.1....wwwwwwwwwwwwwwwwwwwww",
			"www......wwwwwwwwwwwwwwwwwwwww",
			"wwwwwwwwwwwwwwwwwwwwwwwwwwwwww",
			"wwwwwwwwwwwwwwwwwwwwwwwwwwwwww",
			"wwwwwwwwwww....wwwwwwwwwwwwwww",
			"wwwwwwwwwww.o..wwwwwwwwwwwwwww",
			"wwwwwwwwwww....wwwwwwwwwwwwwww",
			"wwwwwwwwwwwwwwwwwwwwwwwwwwwwww",
			"wwwwwwwwwwwwwwwwwwwwwwwwwwwwww",
			"wwwwwwwwwwwwwwwwwwwww......www",
			"wwwwwwwwwwwwwwwwwwwww...2..www",
			"wwwwwwwwwwwwwwwwwwwww......www",
			"wwwwwwwwwwwwwwwwwwwwwwwwwwwwww",
			"wwwwwwwwwwwwwwwwwwwwwwwwwwwwww",
			"wwwwwwwwwwwwwwwwwwwwwwwwwwwwww",
			"wwwwwwwwwwwwwwwwwwwwwwwwwwwwww"
		])
	},
	{
		id: "strait",
		name: "The Strait",
		kind: "sea",
		blurb: "Land on both shores, open water between. Dock a fleet or fly over. The supply bases sit on the beaches.",
		rows: grow([
			"..fffff.......................",
			"..fffff........o..............",
			"..........rrrr................",
			"1=========....................",
			"wwwwwwwwwwwwwwwwwwwwwwwwwwwwww",
			"wwwwwwwwwwwwwwwwwwwwwwwwwwwwww",
			"wwwwwwwwwwwwwwwwwwwwwwwwwwwwww",
			"wwwwwwwww....wwwwwwwwwwwwwwwww",
			"wwwwwwwww.o..wwwwwwwwwwwwwwwww",
			"wwwwwwwww....wwwwwwwwwwwwwwwww",
			"wwwwwwwwwwwwwwwwwwwwwwwwwwwwww",
			"wwwwwwwwwwwwwwwwwwwwwwwwwwwwww",
			"wwwwwwwwwwwwwwwwwwwwwwwwwwwwww",
			"wwwwwwwwwwwwwwwwwwwwwwwwwwwwww",
			"wwwwwwwwwwwwwwwwwwwwwwwwwwwwww",
			"....................=========2",
			"................rrrr..........",
			"..............o...............",
			".......................fffff..",
			".............................."
		])
	}
];
var MAP_BY = Object.fromEntries(MAPS.map((m) => [m.id, m]));
function charTerrain(c) {
	switch (c) {
		case ".": return "plain";
		case "f": return "forest";
		case "r": return "ridge";
		case "w": return "water";
		case "=": return "road";
		case ",": return "rubble";
		case "1": return "p0";
		case "2": return "p1";
		case "o": return "outpost";
		default: throw new Error(`Bad map glyph ${c}`);
	}
}
function walkableChar(c) {
	return c === "." || c === "f" || c === "=" || c === "," || c === "o" || c === "1" || c === "2";
}
function assertMaps() {
	for (const map of MAPS) {
		const w = map.rows[0]?.length ?? 0;
		if (w < 8 || map.rows.length < 8) throw new Error(`${map.id} too small`);
		if (map.rows.some((r) => r.length !== w)) throw new Error(`${map.id} ragged`);
		let s0 = 0;
		let s1 = 0;
		const sp = [];
		for (let y = 0; y < map.rows.length; y++) for (let x = 0; x < w; x++) {
			const c = map.rows[y][x];
			charTerrain(c);
			if (c === "1" || c === "2") {
				sp.push({
					x,
					y,
					c
				});
				if (c === "1") s0++;
				else s1++;
			}
		}
		if (s0 !== 1 || s1 !== 1) throw new Error(`${map.id} spires ${s0}/${s1}`);
		const start = sp.find((p) => p.c === "1");
		const goal = sp.find((p) => p.c === "2");
		const q = [start];
		const seen = /* @__PURE__ */ new Set([`${start.x},${start.y}`]);
		let hit = false;
		while (q.length) {
			const cur = q.shift();
			if (cur.x === goal.x && cur.y === goal.y) {
				hit = true;
				break;
			}
			for (const [dx, dy] of [
				[1, 0],
				[-1, 0],
				[0, 1],
				[0, -1]
			]) {
				const nx = cur.x + dx;
				const ny = cur.y + dy;
				const k = `${nx},${ny}`;
				if (ny < 0 || nx < 0 || ny >= map.rows.length || nx >= w || seen.has(k)) continue;
				if (!walkableChar(map.rows[ny][nx]) && !(map.kind === "sea" && map.rows[ny][nx] === "w")) continue;
				seen.add(k);
				q.push({
					x: nx,
					y: ny,
					c: ""
				});
			}
		}
		if (!hit) throw new Error(`${map.id} spires disconnected`);
	}
}
assertMaps();
//#endregion
export { __exportAll as a, maps_exports as i, MAP_BY as n, charTerrain as r, MAPS as t };
