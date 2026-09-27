import type { Terrain } from "./types";

export interface MapDef {
  id: string;
  name: string;
  blurb: string;
  kind: "land" | "sea" | "mixed";
  rows: string[];
}

const CROSS = 46;

function isBase(c: string): boolean {
  return c === "1" || c === "2" || c === "o";
}

function findGlyph(rows: string[], g: string): { x: number; y: number } {
  for (let y = 0; y < rows.length; y++) {
    const x = rows[y]!.indexOf(g);
    if (x >= 0) return { x, y };
  }
  throw new Error(`missing ${g}`);
}

function terrainAt(rows: string[], x: number, y: number): string {
  const c = rows[y]![x]!;
  if (!isBase(c)) return c;
  for (const [dx, dy] of [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
    [1, 1],
    [-1, 1],
    [1, -1],
    [-1, -1],
  ] as const) {
    const nx = x + dx;
    const ny = y + dy;
    if (ny < 0 || nx < 0 || ny >= rows.length || nx >= rows[0]!.length) continue;
    const n = rows[ny]![nx]!;
    if (!isBase(n)) return n;
  }
  return ".";
}

function insertCol(rows: string[], at: number): string[] {
  const sample = Math.max(0, at - 1);
  return rows.map((row, y) => row.slice(0, at) + terrainAt(rows, sample, y) + row.slice(at));
}

function insertRow(rows: string[], at: number): string[] {
  const sample = Math.max(0, at - 1);
  const proto = rows[sample]!.split("").map((_, x) => terrainAt(rows, x, sample)).join("");
  const next = rows.slice();
  next.splice(at, 0, proto);
  return next;
}

function faceSides(rows: string[]): string[] {
  const a = findGlyph(rows, "1");
  const b = findGlyph(rows, "2");
  if (Math.abs(a.x - b.x) >= Math.abs(a.y - b.y)) return rows;
  const h = rows.length;
  const w = rows[0]!.length;
  const next: string[] = [];
  for (let x = 0; x < w; x++) {
    let line = "";
    for (let y = 0; y < h; y++) line += rows[y]![x]!;
    next.push(line);
  }
  return next;
}

function grow(rows: string[]): string[] {
  let map = seatBases(faceSides(rows));
  for (let guard = 0; guard < 80; guard++) {
    const a = findGlyph(map, "1");
    const b = findGlyph(map, "2");
    const dx = Math.abs(a.x - b.x);
    const dy = Math.abs(a.y - b.y);
    if (dx + dy >= CROSS) break;
    map = insertCol(map, Math.floor((a.x + b.x) / 2) + 1);
  }
  for (let guard = 0; guard < 120; guard++) {
    const a = findGlyph(map, "1");
    const b = findGlyph(map, "2");
    const w = map[0]!.length;
    const h = map.length;
    const shiftX = w - 1 - (a.x + b.x);
    const shiftY = h - 1 - (a.y + b.y);
    const rearX = Math.min(a.x, b.x, w - 1 - a.x, w - 1 - b.x);
    const rearY = Math.min(a.y, b.y, h - 1 - a.y, h - 1 - b.y);
    if (shiftX === 0 && shiftY === 0 && w >= 48 && h >= 36 && rearX >= 4 && rearY >= 4) break;
    if (shiftX > 0) map = insertCol(map, 0);
    else if (shiftX < 0) map = map.map((row, y) => row + terrainAt(map, row.length - 1, y));
    else if (w < 48 || rearX < 4) {
      map = insertCol(map, 0);
      map = map.map((row, y) => row + terrainAt(map, row.length - 1, y));
    }
    const a2 = findGlyph(map, "1");
    const b2 = findGlyph(map, "2");
    const h2 = map.length;
    const shiftY2 = h2 - 1 - (a2.y + b2.y);
    if (shiftY2 > 0) map = insertRow(map, 0);
    else if (shiftY2 < 0) {
      const y = map.length - 1;
      const proto = map[y]!.split("").map((_, x) => terrainAt(map, x, y)).join("");
      map = [...map, proto];
    } else if (map.length < 36 || Math.min(a2.y, b2.y, map.length - 1 - a2.y, map.length - 1 - b2.y) < 4) {
      map = insertRow(map, 0);
      const y = map.length - 1;
      const proto = map[y]!.split("").map((_, x) => terrainAt(map, x, y)).join("");
      map = [...map, proto];
    }
  }
  return mirrorSides(map);
}

function swapSeat(c: string): string {
  if (c === "1") return "2";
  if (c === "2") return "1";
  return c;
}

function mirrorSides(rows: string[]): string[] {
  const h = rows.length;
  const w = rows[0]!.length;
  const a = findGlyph(rows, "1");
  const b = findGlyph(rows, "2");
  const next = rows.map((row) => row.split(""));
  const seen = new Set<string>();
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const key = `${x},${y}`;
    if (seen.has(key)) continue;
    const mx = a.x + b.x - x;
    const my = a.y + b.y - y;
    seen.add(key);
    seen.add(`${mx},${my}`);
    if (mx === x && my === y) continue;
    if (my < 0 || mx < 0 || my >= h || mx >= w) continue;
    const c = rows[y]![x]!;
    const d = rows[my]![mx]!;
    next[y]![x] = swapSeat(d);
    next[my]![mx] = swapSeat(c);
  }
  return next.map((row) => row.join(""));
}

function seatBases(rows: string[]): string[] {
  const h = rows.length;
  const w = rows[0]!.length;
  const next = rows.map((row) => row.split(""));
  const mid = Math.floor(h / 2);
  const moveGlyph = (glyph: "1" | "2") => {
    let from: { x: number; y: number } | null = null;
    for (let y = 0; y < h && !from; y++) {
      const x = next[y]!.indexOf(glyph);
      if (x >= 0) from = { x, y };
    }
    if (!from) return;
    const x = glyph === "1" ? Math.min(6, w - 8) : Math.max(w - 7, 8);
    for (let dy = -1; dy <= 1; dy++) for (let dx = 0; dx < 3; dx++) {
      const yy = mid + dy;
      const xx = glyph === "1" ? x + dx : x - dx;
      if (next[yy]?.[xx] !== undefined && !isBase(next[yy]![xx]!)) next[yy]![xx] = ".";
    }
    const dest = next[mid]![x]!;
    next[mid]![x] = glyph;
    if (from.x !== x || from.y !== mid) next[from.y]![from.x] = dest === glyph ? "." : dest;
  };
  moveGlyph("1");
  moveGlyph("2");
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (next[y]![x] !== "o") continue;
    if (y > h * 0.3 && y < h * 0.7) continue;
    const left = x < w / 2;
    const hx = left ? Math.min(6, w - 8) : Math.max(w - 7, 8);
    let spot: { x: number; y: number } | null = null;
    for (let dy = 0; dy <= 4 && !spot; dy++) for (const yy of [mid - dy, mid + dy]) {
      for (let dx = 4; dx <= 12 && !spot; dx++) {
        const xx = left ? hx + dx : hx - dx;
        if (next[yy]?.[xx] !== ".") continue;
        let crowded = false;
        for (let oy = -1; oy <= 1 && !crowded; oy++) for (let ox = -1; ox <= 1; ox++) {
          const n = next[yy + oy]?.[xx + ox];
          if (n === "1" || n === "2" || n === "o") crowded = true;
        }
        if (!crowded) spot = { x: xx, y: yy };
      }
    }
    if (!spot) continue;
    next[spot.y]![spot.x] = "o";
    next[y]![x] = ".";
  }
  return next.map((row) => row.join(""));
}

export const MAPS: MapDef[] = [
  {
    id: "kiln",
    name: "West Canal",
    kind: "mixed",
    blurb: "A long road and a canal on the west flank. Ships run the water. Neutral supply bases sit on the road.",
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
      "wwwwwwwwwwwwwwwwwwwwwwwwwwwwww",
    ]),
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
      "wwwwwwwwwwwwwwwwwwwwwwwwwwwwww",
    ]),
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
      "wwwwwwwwwwwwwwwwwwwwwwwwwwwwww",
    ]),
  },
  {
    id: "harbor",
    name: "Harbor",
    kind: "mixed",
    blurb: "A large bay with a dock off each headquarters. Ships sail the water around the island. Build a supply base if you want more income.",
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
      "wwwwwwwwwwwwwwwwwwwwwwwwwwwwww",
    ]),
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
      "..............................",
    ]),
  },
  {
    id: "heights",
    name: "High Ground",
    kind: "land",
    blurb: "Ridges cut the field into lanes. No coast. The marked supply bases are the fight in the middle. Hold a gap, then shell the headquarters.",
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
      "..............................",
    ]),
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
      "wwwwwwwwwwwwwwwwwwwwwwwwwwwwww",
    ]),
  },
  {
    id: "strait",
    name: "The Strait",
    kind: "sea",
    blurb: "Land on both shores, open water between. Dock a fleet or fly over. Nothing but the two headquarters is already built.",
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
      "..............................",
    ]),
  },
];

export const MAP_BY: Record<string, MapDef> = Object.fromEntries(MAPS.map((m) => [m.id, m]));

export function charTerrain(c: string): Terrain | "p0" | "p1" | "outpost" {
  switch (c) {
    case ".":
      return "plain";
    case "f":
      return "forest";
    case "r":
      return "ridge";
    case "w":
      return "water";
    case "=":
      return "road";
    case ",":
      return "rubble";
    case "1":
      return "p0";
    case "2":
      return "p1";
    case "o":
      return "outpost";
    default:
      throw new Error(`Bad map glyph ${c}`);
  }
}

function walkableChar(c: string): boolean {
  return c === "." || c === "f" || c === "=" || c === "," || c === "o" || c === "1" || c === "2";
}

function assertMaps(): void {
  for (const map of MAPS) {
    const w = map.rows[0]?.length ?? 0;
    if (w < 8 || map.rows.length < 8) throw new Error(`${map.id} too small`);
    if (map.rows.some((r) => r.length !== w)) throw new Error(`${map.id} ragged`);
    let s0 = 0;
    let s1 = 0;
    const sp: { x: number; y: number; c: string }[] = [];
    for (let y = 0; y < map.rows.length; y++) {
      for (let x = 0; x < w; x++) {
        const c = map.rows[y]![x]!;
        charTerrain(c);
        if (c === "1" || c === "2") {
          sp.push({ x, y, c });
          if (c === "1") s0++;
          else s1++;
        }
      }
    }
    if (s0 !== 1 || s1 !== 1) throw new Error(`${map.id} spires ${s0}/${s1}`);
    const start = sp.find((p) => p.c === "1")!;
    const goal = sp.find((p) => p.c === "2")!;
    const q = [start];
    const seen = new Set([`${start.x},${start.y}`]);
    let hit = false;
    while (q.length) {
      const cur = q.shift()!;
      if (cur.x === goal.x && cur.y === goal.y) {
        hit = true;
        break;
      }
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ] as const) {
        const nx = cur.x + dx;
        const ny = cur.y + dy;
        const k = `${nx},${ny}`;
        if (ny < 0 || nx < 0 || ny >= map.rows.length || nx >= w || seen.has(k)) continue;
        if (!walkableChar(map.rows[ny]![nx]!) && !(map.kind === "sea" && map.rows[ny]![nx] === "w")) continue;
        seen.add(k);
        q.push({ x: nx, y: ny, c: "" });
      }
    }
    if (!hit) throw new Error(`${map.id} spires disconnected`);
  }
}

assertMaps();
