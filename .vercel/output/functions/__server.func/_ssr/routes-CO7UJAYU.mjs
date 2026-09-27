import { o as __toESM } from "../_runtime.mjs";
import { n as MAP_BY, r as charTerrain, t as MAPS } from "./maps-CuzifoaX.mjs";
import { A as isUnitKind, C as BUY_ORDER, D as UNITS, E as STRUCT_BY, O as UNIT_BY, S as unitAt, T as STRUCTS, _ as selectionOverlay, a as holdReady, b as terrainName, c as incomeOf, d as loadRoot, g as repairReady, h as publicSummary, i as emptyRoot, k as hitBand, l as inspectTile, m as persistRoot, n as captureReady, o as idleCount, p as marchLeft, r as coverage, s as incomeBits, t as apply, u as layReady, v as sellOffer, w as FACTIONS, x as threatOverlay, y as structAt } from "./logic-D6eA1zDF.mjs";
import { R as require_react, v as require_jsx_runtime } from "../_libs/@tanstack/react-router+[...].mjs";
import { n as TSS_SERVER_FUNCTION, r as getServerFnById, t as createServerFn } from "./ssr.mjs";
import { i as BookOpen, n as Volume2, t as VolumeX } from "../_libs/lucide-react.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/routes-CO7UJAYU.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var ctx = null;
var muted = false;
function setMuted(v) {
	muted = v;
	try {
		localStorage.setItem("ashveil-mute", v ? "1" : "0");
	} catch {}
}
function loadMuted() {
	try {
		muted = localStorage.getItem("ashveil-mute") === "1";
	} catch {
		muted = false;
	}
	return muted;
}
function ac() {
	if (muted || typeof window === "undefined") return null;
	const W = window;
	const Ctor = window.AudioContext || W.webkitAudioContext;
	if (!Ctor) return null;
	if (!ctx) ctx = new Ctor();
	if (ctx.state === "suspended") ctx.resume();
	return ctx;
}
function tone(freq, dur, type, gain = .035, slide = 0) {
	const c = ac();
	if (!c) return;
	const o = c.createOscillator();
	const g = c.createGain();
	o.type = type;
	o.frequency.setValueAtTime(freq, c.currentTime);
	if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(48, freq + slide), c.currentTime + dur);
	g.gain.setValueAtTime(gain, c.currentTime);
	g.gain.exponentialRampToValueAtTime(1e-4, c.currentTime + dur);
	o.connect(g);
	g.connect(c.destination);
	o.start();
	o.stop(c.currentTime + dur + .02);
}
function play(kind) {
	if (kind === "ui") tone(520, .045, "sine", .028);
	else if (kind === "shot") tone(168, .1, "triangle", .05, -90);
	else if (kind === "cover") tone(210, .14, "sine", .03, -70);
	else if (kind === "gold") {
		tone(520, .08, "sine", .035);
		window.setTimeout(() => tone(780, .11, "sine", .035), 80);
	} else [
		523,
		659,
		784
	].forEach((f, i) => window.setTimeout(() => tone(f, .16, "sine", .04), i * 120));
}
function cue(cmd, prev, next) {
	if (next === prev || cmd === "cursor" || cmd === "note-save") return;
	if (next.screen === "victory" && prev.screen !== "victory") return play("win");
	if (next.screen === "handoff" && prev.screen !== "handoff") return play("cover");
	if (next.screen === "battle" && prev.screen === "handoff") return play("gold");
	if ((next.match?.fx.length ?? 0) > (prev.match?.fx.length ?? 0)) return play("shot");
	play("ui");
}
function canActUnit(m, u) {
	if (u.owner !== m.active || u.hp <= 0 || (u.eta || 0) > 0) return false;
	const def = UNIT_BY[u.kind];
	if (marchLeft(u) > 0) return true;
	if ((u.eta || 0) > 0 || u.acted) return false;
	if (def.atk > 0 || def.repair > 0) return true;
	if ((def.mines ?? 0) > 0 && (u.charges ?? def.mines) > 0) return true;
	return false;
}
function canActStruct(m, s) {
	if (s.owner !== m.active || s.hp <= 0 || (s.eta || 0) > 0 || s.fired) return false;
	return STRUCT_BY[s.kind].atk > 0;
}
function actRing(ctx, px, py, tile, now) {
	const pulse = .45 + .55 * (.5 + .5 * Math.sin(now / 160));
	ctx.save();
	ctx.strokeStyle = "#f4f0e6";
	ctx.globalAlpha = pulse;
	ctx.lineWidth = Math.max(3, tile * .09);
	ctx.strokeRect(px + 1.5, py + 1.5, tile - 3, tile - 3);
	ctx.globalAlpha = 1;
	ctx.fillStyle = "#f4f0e6";
	ctx.beginPath();
	ctx.moveTo(px + tile / 2, py + 3);
	ctx.lineTo(px + tile / 2 + 6, py + 12);
	ctx.lineTo(px + tile / 2 - 6, py + 12);
	ctx.closePath();
	ctx.fill();
	ctx.restore();
}
function buildLeft(ctx, px, py, tile, eta) {
	if (eta <= 0) return;
	const label = eta === 1 ? "1 left" : `${eta} left`;
	ctx.save();
	ctx.font = `700 ${Math.max(11, Math.floor(tile * .26))}px Outfit, sans-serif`;
	const w = Math.min(tile - 4, ctx.measureText(label).width + 8);
	const h = Math.max(14, Math.floor(tile * .32));
	ctx.fillStyle = "#1a1814";
	ctx.fillRect(px + 2, py + 2, w, h);
	ctx.fillStyle = "#e7c56a";
	ctx.textAlign = "left";
	ctx.textBaseline = "middle";
	ctx.fillText(label, px + 6, py + 2 + h / 2);
	ctx.restore();
}
var INK = "#14120e";
var PAPER = "#f3eadb";
var BRASS = "#d3924a";
var VESPER = "#e07a3d";
var NEREID = "#2fafa6";
function layoutOf(cssW, cssH, cols, rows) {
	const tile = Math.max(1, Math.floor(Math.min((cssW - 16) / cols, (cssH - 16) / rows)));
	return {
		tile,
		ox: Math.floor((cssW - tile * cols) / 2),
		oy: Math.floor((cssH - tile * rows) / 2),
		cols,
		rows
	};
}
function hash(x, y, n) {
	let h = x * 374761393 + y * 668265263 + n * 1440662683 | 0;
	h = Math.imul(h ^ h >>> 13, 1274126177);
	return ((h ^ h >>> 16) >>> 0) / 4294967296;
}
function fac(owner) {
	if (owner === 0) return VESPER;
	if (owner === 1) return NEREID;
	return BRASS;
}
function round(ctx, x, y, w, h, r) {
	ctx.beginPath();
	ctx.roundRect(x, y, w, h, r);
}
function paintMark(ctx, kind, cx, cy, r, fill) {
	ctx.save();
	ctx.translate(cx, cy);
	ctx.fillStyle = fill;
	ctx.strokeStyle = INK;
	ctx.lineWidth = Math.max(1.25, r * .08);
	ctx.lineJoin = "round";
	const u = r * .92;
	const box = () => {
		round(ctx, -u * .72, -u * .5, u * 1.44, u, u * .2);
		ctx.fill();
		ctx.stroke();
	};
	switch (kind) {
		case "squad":
			ctx.beginPath();
			ctx.moveTo(0, -u * .85);
			ctx.lineTo(u * .7, u * .15);
			ctx.lineTo(0, -u * .05);
			ctx.lineTo(-u * .7, u * .15);
			ctx.closePath();
			ctx.fill();
			ctx.stroke();
			ctx.beginPath();
			ctx.moveTo(0, -u * .15);
			ctx.lineTo(u * .55, u * .75);
			ctx.lineTo(0, u * .45);
			ctx.lineTo(-u * .55, u * .75);
			ctx.closePath();
			ctx.fill();
			ctx.stroke();
			break;
		case "marksman":
			ctx.beginPath();
			ctx.moveTo(0, -u);
			ctx.lineTo(u * .55, 0);
			ctx.lineTo(0, u);
			ctx.lineTo(-u * .55, 0);
			ctx.closePath();
			ctx.fill();
			ctx.stroke();
			ctx.beginPath();
			ctx.moveTo(0, -u * .2);
			ctx.lineTo(u * .95, -u * .55);
			ctx.stroke();
			break;
		case "bullhead":
			box();
			ctx.beginPath();
			ctx.arc(0, -u * .05, u * .28, 0, Math.PI * 2);
			ctx.fill();
			ctx.stroke();
			ctx.beginPath();
			ctx.moveTo(u * .2, -u * .05);
			ctx.lineTo(u * .85, -u * .05);
			ctx.stroke();
			break;
		case "tank":
			round(ctx, -u * .88, -u * .58, u * 1.76, u * .3, u * .08);
			ctx.fill();
			ctx.stroke();
			round(ctx, -u * .88, u * .28, u * 1.76, u * .3, u * .08);
			ctx.fill();
			ctx.stroke();
			round(ctx, -u * .58, -u * .36, u * 1.16, u * .72, u * .1);
			ctx.fill();
			ctx.stroke();
			ctx.beginPath();
			ctx.arc(-u * .08, 0, u * .26, 0, Math.PI * 2);
			ctx.fill();
			ctx.stroke();
			ctx.beginPath();
			ctx.moveTo(u * .12, 0);
			ctx.lineTo(u * 1.05, 0);
			ctx.stroke();
			break;
		case "aagun":
			round(ctx, -u * .72, u * .12, u * 1.44, u * .48, u * .12);
			ctx.fill();
			ctx.stroke();
			ctx.beginPath();
			ctx.moveTo(-u * .22, u * .1);
			ctx.lineTo(-u * .55, -u * .9);
			ctx.moveTo(u * .22, u * .1);
			ctx.lineTo(u * .55, -u * .9);
			ctx.stroke();
			break;
		case "pike":
			round(ctx, -u * .85, -u * .28, u * 1.7, u * .56, u * .12);
			ctx.fill();
			ctx.stroke();
			ctx.beginPath();
			ctx.moveTo(u * .7, 0);
			ctx.lineTo(u * 1.15, 0);
			ctx.stroke();
			break;
		case "lobber":
			ctx.beginPath();
			ctx.arc(-u * .1, u * .1, u * .42, 0, Math.PI * 2);
			ctx.fill();
			ctx.stroke();
			ctx.beginPath();
			ctx.moveTo(-u * .1, u * .1);
			ctx.lineTo(u * .55, -u * .7);
			ctx.stroke();
			break;
		case "rotor":
			ctx.beginPath();
			ctx.arc(0, 0, u * .22, 0, Math.PI * 2);
			ctx.fill();
			ctx.stroke();
			for (let i = 0; i < 4; i++) {
				ctx.rotate(Math.PI / 2);
				round(ctx, u * .18, -u * .12, u * .78, u * .24, u * .1);
				ctx.fill();
				ctx.stroke();
			}
			break;
		case "fighter":
			ctx.beginPath();
			ctx.moveTo(0, -u * .95);
			ctx.lineTo(u * .78, u * .42);
			ctx.lineTo(0, u * .12);
			ctx.lineTo(-u * .78, u * .42);
			ctx.closePath();
			ctx.fill();
			ctx.stroke();
			ctx.beginPath();
			ctx.moveTo(-u * .26, u * .62);
			ctx.lineTo(0, u * .12);
			ctx.lineTo(u * .26, u * .62);
			ctx.stroke();
			break;
		case "bomber":
			ctx.beginPath();
			ctx.moveTo(0, -u * .45);
			ctx.lineTo(u * .98, u * .08);
			ctx.lineTo(u * .38, u * .58);
			ctx.lineTo(0, u * .18);
			ctx.lineTo(-u * .38, u * .58);
			ctx.lineTo(-u * .98, u * .08);
			ctx.closePath();
			ctx.fill();
			ctx.stroke();
			ctx.beginPath();
			ctx.arc(0, -u * .05, u * .16, 0, Math.PI * 2);
			ctx.fill();
			ctx.stroke();
			break;
		case "tender":
			ctx.beginPath();
			for (let i = 0; i < 6; i++) {
				const a = Math.PI / 3 * i - Math.PI / 6;
				const px = Math.cos(a) * u * .8;
				const py = Math.sin(a) * u * .8;
				if (i === 0) ctx.moveTo(px, py);
				else ctx.lineTo(px, py);
			}
			ctx.closePath();
			ctx.fill();
			ctx.stroke();
			ctx.beginPath();
			ctx.moveTo(-u * .35, 0);
			ctx.lineTo(u * .35, 0);
			ctx.moveTo(0, -u * .35);
			ctx.lineTo(0, u * .35);
			ctx.stroke();
			break;
		case "ship":
			ctx.beginPath();
			ctx.moveTo(0, -u * .92);
			ctx.lineTo(u * .58, u * .48);
			ctx.lineTo(u * .28, u * .78);
			ctx.lineTo(-u * .28, u * .78);
			ctx.lineTo(-u * .58, u * .48);
			ctx.closePath();
			ctx.fill();
			ctx.stroke();
			round(ctx, -u * .18, -u * .2, u * .36, u * .5, u * .06);
			ctx.fill();
			ctx.stroke();
			break;
		case "destroyer":
			ctx.beginPath();
			ctx.moveTo(0, -u);
			ctx.lineTo(u * .34, u * .72);
			ctx.lineTo(-u * .34, u * .72);
			ctx.closePath();
			ctx.fill();
			ctx.stroke();
			ctx.beginPath();
			ctx.moveTo(u * .05, -u * .2);
			ctx.lineTo(u * .78, -u * .48);
			ctx.stroke();
			break;
		case "ram":
			round(ctx, -u * .8, -u * .55, u * 1.35, u * 1.1, u * .12);
			ctx.fill();
			ctx.stroke();
			round(ctx, u * .35, -u * .18, u * .7, u * .36, u * .08);
			ctx.fill();
			ctx.stroke();
			break;
		case "layer":
			round(ctx, -u * .72, -u * .28, u * 1.44, u * .7, u * .12);
			ctx.fill();
			ctx.stroke();
			ctx.beginPath();
			ctx.arc(0, -u * .55, u * .28, 0, Math.PI * 2);
			ctx.stroke();
			ctx.beginPath();
			ctx.moveTo(-u * .16, -u * .7);
			ctx.lineTo(u * .16, -u * .4);
			ctx.moveTo(u * .16, -u * .7);
			ctx.lineTo(-u * .16, -u * .4);
			ctx.stroke();
			break;
		case "dish":
			round(ctx, -u * .78, -u * .05, u * 1.56, u * .62, u * .1);
			ctx.fill();
			ctx.stroke();
			ctx.beginPath();
			ctx.moveTo(0, -u * .05);
			ctx.lineTo(0, -u * .42);
			ctx.stroke();
			ctx.beginPath();
			ctx.arc(0, -u * .55, u * .42, Math.PI, 0);
			ctx.fill();
			ctx.stroke();
			break;
		case "spire":
			ctx.beginPath();
			ctx.moveTo(0, -u);
			ctx.lineTo(u * .62, u * .75);
			ctx.lineTo(-u * .62, u * .75);
			ctx.closePath();
			ctx.fill();
			ctx.stroke();
			break;
		case "outpost":
			ctx.beginPath();
			ctx.moveTo(0, -u * .85);
			ctx.lineTo(u * .75, -u * .15);
			ctx.lineTo(u * .75, u * .7);
			ctx.lineTo(-u * .75, u * .7);
			ctx.lineTo(-u * .75, -u * .15);
			ctx.closePath();
			ctx.fill();
			ctx.stroke();
			break;
		case "radar":
			ctx.beginPath();
			ctx.moveTo(0, u * .75);
			ctx.lineTo(0, -u * .15);
			ctx.stroke();
			ctx.beginPath();
			ctx.arc(0, -u * .35, u * .48, Math.PI, 0);
			ctx.fill();
			ctx.stroke();
			break;
		case "turret":
			ctx.beginPath();
			ctx.arc(0, u * .1, u * .48, Math.PI, 0);
			ctx.lineTo(u * .48, u * .55);
			ctx.lineTo(-u * .48, u * .55);
			ctx.closePath();
			ctx.fill();
			ctx.stroke();
			ctx.beginPath();
			ctx.moveTo(u * .15, -u * .05);
			ctx.lineTo(u * .9, -u * .28);
			ctx.stroke();
			break;
		case "bunker":
			ctx.beginPath();
			ctx.moveTo(-u * .85, u * .55);
			ctx.lineTo(-u * .55, -u * .35);
			ctx.lineTo(u * .55, -u * .35);
			ctx.lineTo(u * .85, u * .55);
			ctx.closePath();
			ctx.fill();
			ctx.stroke();
			break;
		case "barrier":
			for (let i = -1; i <= 1; i++) {
				round(ctx, -u * .7, i * u * .28 - u * .1, u * 1.4, u * .16, 2);
				ctx.fill();
				ctx.stroke();
			}
			break;
		case "mine":
			ctx.beginPath();
			ctx.arc(0, 0, u * .55, 0, Math.PI * 2);
			ctx.fill();
			ctx.stroke();
			ctx.beginPath();
			ctx.moveTo(-u * .28, -u * .28);
			ctx.lineTo(u * .28, u * .28);
			ctx.moveTo(u * .28, -u * .28);
			ctx.lineTo(-u * .28, u * .28);
			ctx.stroke();
			break;
		case "aa":
			ctx.beginPath();
			ctx.moveTo(-u * .15, u * .6);
			ctx.lineTo(-u * .45, -u * .75);
			ctx.lineTo(-u * .05, -u * .75);
			ctx.lineTo(u * .05, u * .6);
			ctx.closePath();
			ctx.fill();
			ctx.stroke();
			ctx.beginPath();
			ctx.moveTo(u * .15, u * .6);
			ctx.lineTo(u * .45, -u * .75);
			ctx.lineTo(u * .05, -u * .75);
			ctx.lineTo(-u * .05, u * .6);
			ctx.closePath();
			ctx.fill();
			ctx.stroke();
			break;
		default:
			ctx.beginPath();
			ctx.arc(0, 0, u * .4, 0, Math.PI * 2);
			ctx.fill();
			ctx.stroke();
	}
	ctx.restore();
}
function terrainColor(t, x, y) {
	const n = hash(x, y, 1);
	if (t === "plain") return n > .66 ? "#e6d4ad" : n > .33 ? "#dcc7a0" : "#d2bb94";
	if (t === "road") return "#f4ead0";
	if (t === "rubble") return n > .5 ? "#cbb89a" : "#b8a484";
	if (t === "forest") return "#3d7d56";
	if (t === "water") return n > .5 ? "#5eb8c4" : "#4aa7b4";
	return "#7a7368";
}
function drawTerrain(ctx, t, x, y, s, now, motion) {
	ctx.fillStyle = terrainColor(t, x, y);
	ctx.fillRect(x, y, s, s);
	if (t === "forest") {
		ctx.fillStyle = "#1d4a30";
		const trees = 2 + Math.floor(hash(x, y, 2) * 2);
		for (let i = 0; i < trees; i++) {
			const tx = x + s * (.22 + hash(x, y, 3 + i) * .56);
			const ty = y + s * (.28 + hash(x, y, 6 + i) * .48);
			ctx.beginPath();
			ctx.moveTo(tx, ty - s * .22);
			ctx.lineTo(tx + s * .12, ty + s * .08);
			ctx.lineTo(tx - s * .12, ty + s * .08);
			ctx.closePath();
			ctx.fill();
		}
	} else if (t === "water") {
		ctx.strokeStyle = "rgba(230, 248, 248, 0.55)";
		ctx.lineWidth = 1;
		const drift = 0;
		for (let i = 1; i <= 3; i++) {
			ctx.beginPath();
			ctx.moveTo(x + 3, y + s * i / 4 + drift);
			ctx.lineTo(x + s - 3, y + s * i / 4 + drift);
			ctx.stroke();
		}
	} else if (t === "ridge") {
		ctx.strokeStyle = "rgba(20,18,14,0.35)";
		ctx.beginPath();
		ctx.moveTo(x + s * .2, y + s * .75);
		ctx.lineTo(x + s * .45, y + s * .3);
		ctx.lineTo(x + s * .7, y + s * .62);
		ctx.stroke();
	} else if (t === "road") {
		ctx.strokeStyle = "rgba(90,70,40,0.25)";
		ctx.strokeRect(x + s * .18, y + s * .18, s * .64, s * .64);
	} else if (t === "rubble") {
		ctx.fillStyle = "rgba(60,48,32,0.35)";
		ctx.fillRect(x + s * .2, y + s * .55, s * .22, s * .12);
		ctx.fillRect(x + s * .52, y + s * .28, s * .18, s * .1);
	}
	ctx.strokeStyle = "rgba(20,16,12,0.18)";
	ctx.strokeRect(x + .5, y + .5, s - 1, s - 1);
}
function drawFog(ctx, x, y, s, heavy) {
	ctx.fillStyle = heavy ? "rgba(20,16,12,0.22)" : "rgba(20,16,12,0.1)";
	ctx.fillRect(x, y, s, s);
}
function hpBar(ctx, x, y, s, hp, max, color) {
	const w = s * .7;
	const h = Math.max(3, s * .08);
	const px = x + (s - w) / 2;
	const py = y + s * .08;
	ctx.fillStyle = "rgba(20,16,12,0.75)";
	ctx.fillRect(px, py, w, h);
	ctx.fillStyle = color;
	ctx.fillRect(px, py, w * Math.max(0, Math.min(1, hp / max)), h);
}
function brackets(ctx, x, y, s, color, weight) {
	const m = s * .12;
	const l = s * .28;
	ctx.strokeStyle = color;
	ctx.lineWidth = weight;
	ctx.beginPath();
	ctx.moveTo(x + m, y + m + l);
	ctx.lineTo(x + m, y + m);
	ctx.lineTo(x + m + l, y + m);
	ctx.moveTo(x + s - m - l, y + m);
	ctx.lineTo(x + s - m, y + m);
	ctx.lineTo(x + s - m, y + m + l);
	ctx.moveTo(x + m, y + s - m - l);
	ctx.lineTo(x + m, y + s - m);
	ctx.lineTo(x + m + l, y + s - m);
	ctx.moveTo(x + s - m - l, y + s - m);
	ctx.lineTo(x + s - m, y + s - m);
	ctx.lineTo(x + s - m, y + s - m - l);
	ctx.stroke();
}
function blip(ctx, x, y, s, domain, now, motion) {
	const cx = x + s / 2;
	const cy = y + s / 2;
	const p = motion ? .5 + .5 * Math.sin(now / 280) : 1;
	ctx.save();
	ctx.globalAlpha = .45 + p * .55;
	ctx.fillStyle = "#e2b15a";
	ctx.strokeStyle = INK;
	ctx.lineWidth = 1.5;
	ctx.beginPath();
	if (domain === "air") {
		ctx.moveTo(cx, cy - s * .24);
		ctx.lineTo(cx + s * .2, cy);
		ctx.lineTo(cx, cy + s * .24);
		ctx.lineTo(cx - s * .2, cy);
	} else if (domain === "sea") {
		ctx.moveTo(cx, cy - s * .2);
		ctx.lineTo(cx + s * .24, cy + s * .08);
		ctx.lineTo(cx + s * .12, cy + s * .2);
		ctx.lineTo(cx - s * .12, cy + s * .2);
		ctx.lineTo(cx - s * .24, cy + s * .08);
	} else {
		ctx.moveTo(cx, cy - s * .16);
		ctx.lineTo(cx + s * .16, cy);
		ctx.lineTo(cx, cy + s * .16);
		ctx.lineTo(cx - s * .16, cy);
	}
	ctx.closePath();
	ctx.fill();
	ctx.stroke();
	ctx.restore();
}
function radarRing(ctx, cx, cy, tiles, tile, color, strong) {
	const rad = Math.max(tile * .58, tiles * tile * .72);
	ctx.save();
	ctx.beginPath();
	ctx.arc(cx, cy, rad, 0, Math.PI * 2);
	ctx.strokeStyle = color;
	ctx.globalAlpha = strong ? .95 : .45;
	ctx.lineWidth = strong ? 2 : 1.25;
	ctx.setLineDash(strong ? [] : [2, 3]);
	ctx.stroke();
	ctx.restore();
}
function drawPreview(ctx, cssW, cssH, map) {
	const rows = map.rows.length;
	const cols = map.rows[0].length;
	const L = layoutOf(cssW, cssH, cols, rows);
	ctx.clearRect(0, 0, cssW, cssH);
	ctx.fillStyle = INK;
	ctx.fillRect(0, 0, cssW, cssH);
	for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
		const g = charTerrain(map.rows[y][x]);
		const px = L.ox + x * L.tile;
		const py = L.oy + y * L.tile;
		drawTerrain(ctx, g === "p0" || g === "p1" || g === "outpost" ? "plain" : g, px, py, L.tile, 0, false);
		if (g === "p0" || g === "p1" || g === "outpost") paintMark(ctx, g === "outpost" ? "outpost" : "spire", px + L.tile / 2, py + L.tile / 2, L.tile * .34, fac(g === "p0" ? 0 : g === "p1" ? 1 : null));
	}
}
function drawBattle(ctx, cssW, cssH, m, hover, now, reveal, motion) {
	const viewer = m.active;
	const rows = m.terrain.length;
	const cols = m.terrain[0].length;
	const L = layoutOf(cssW, cssH, cols, rows);
	ctx.globalAlpha = 1;
	ctx.setLineDash([]);
	const cov = coverage(m, viewer);
	const over = selectionOverlay(m);
	const threat = threatOverlay(m);
	const clock = Date.now();
	const mag = motion && clock < m.shakeUntil ? Math.min(4, (m.shakeUntil - clock) / 220 * 3.5) : 0;
	ctx.clearRect(0, 0, cssW, cssH);
	ctx.fillStyle = "#1c1915";
	ctx.fillRect(0, 0, cssW, cssH);
	ctx.save();
	if (mag) ctx.translate(Math.sin(now * .08) * mag, Math.cos(now * .11) * mag);
	const tileSeen = (x, y) => reveal || m.seen[viewer][y][x];
	const idd = (x, y) => reveal || cov.identified[y][x];
	const rad = (x, y) => reveal || cov.radar[y][x];
	for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
		const px = L.ox + x * L.tile;
		const py = L.oy + y * L.tile;
		drawTerrain(ctx, m.terrain[y][x], px, py, L.tile, now, motion);
		const yours = m.units.some((u) => u.owner === viewer && u.x === x && u.y === y) || m.structs.some((s) => s.owner === viewer && s.hp > 0 && s.x === x && s.y === y);
		if (!reveal && !yours) {
			if (!tileSeen(x, y)) drawFog(ctx, px, py, L.tile, true);
			else if (!cov.identified[y][x] && !cov.radar[y][x]) drawFog(ctx, px, py, L.tile, false);
		}
	}
	if (!reveal) {
		const ring = (x, y, tiles, id, kind) => {
			if (tiles <= 0) return;
			const strong = m.selection?.kind === kind && m.selection.id === id;
			radarRing(ctx, L.ox + x * L.tile + L.tile / 2, L.oy + y * L.tile + L.tile / 2, tiles, L.tile, BRASS, strong);
		};
		for (const u of m.units) {
			if (u.owner !== viewer) continue;
			ring(u.x, u.y, UNIT_BY[u.kind].radar ?? 0, u.id, "unit");
		}
		for (const s of m.structs) {
			if (s.owner !== viewer || s.hp <= 0) continue;
			ring(s.x, s.y, STRUCT_BY[s.kind].radar, s.id, "struct");
		}
	}
	const markSet = (tiles, color) => {
		ctx.fillStyle = color;
		for (const t of tiles) ctx.fillRect(L.ox + t.x * L.tile, L.oy + t.y * L.tile, L.tile, L.tile);
	};
	if (!reveal) {
		const shown = (tiles) => tiles.filter((t) => cov.identified[t.y]?.[t.x] || cov.radar[t.y]?.[t.x]);
		markSet(shown(threat.range), "rgba(230,196,48,0.38)");
		markSet(over.moves, m.active === 0 ? "rgba(224,122,61,0.28)" : "rgba(47,175,166,0.28)");
		markSet(shown(threat.shots), "rgba(196,72,60,0.62)");
		markSet(over.heals, "rgba(72,168,96,0.45)");
		markSet(over.lays, "rgba(90,70,40,0.55)");
		for (const t of over.places) {
			const x = L.ox + t.x * L.tile;
			const y = L.oy + t.y * L.tile;
			ctx.fillStyle = "rgba(211,146,74,0.5)";
			ctx.fillRect(x, y, L.tile, L.tile);
			ctx.strokeStyle = "#d3924a";
			ctx.lineWidth = Math.max(2, L.tile * .08);
			ctx.strokeRect(x + 1.5, y + 1.5, L.tile - 3, L.tile - 3);
			ctx.fillStyle = "#1a1814";
			ctx.font = `700 ${Math.max(12, Math.floor(L.tile * .42))}px Outfit, sans-serif`;
			ctx.textAlign = "center";
			ctx.textBaseline = "middle";
			ctx.fillText("+", x + L.tile / 2, y + L.tile / 2);
		}
	}
	for (const st of m.structs) {
		const px = L.ox + st.x * L.tile;
		const py = L.oy + st.y * L.tile;
		const hq = st.kind === "spire";
		const full = st.owner === viewer || idd(st.x, st.y) || reveal || hq;
		const onRadar = rad(st.x, st.y);
		if (st.kind === "mine" && st.owner !== viewer && !reveal) continue;
		if (!full && !(onRadar && st.kind !== "mine")) continue;
		if (!full && onRadar) {
			blip(ctx, px, py, L.tile, "ground", now, motion);
			continue;
		}
		const color = st.hp <= 0 ? "#6b6458" : fac(st.owner);
		const live = canActStruct(m, st);
		ctx.save();
		if (!reveal && st.owner === m.active && STRUCT_BY[st.kind].atk > 0 && !live) ctx.globalAlpha = .4;
		paintMark(ctx, st.kind, px + L.tile / 2, py + L.tile / 2 + 2, L.tile * .36, color);
		if (st.hp > 0) hpBar(ctx, px, py, L.tile, st.hp, STRUCT_BY[st.kind].hp, color);
		ctx.restore();
		buildLeft(ctx, px, py, L.tile, st.eta ?? 0);
		if (!reveal && live) actRing(ctx, px, py, L.tile, now);
		if (m.selection?.kind === "struct" && m.selection.id === st.id) brackets(ctx, px, py, L.tile, PAPER, 2);
	}
	for (const u of m.units) {
		const px = L.ox + u.x * L.tile;
		const py = L.oy + u.y * L.tile;
		if (!(u.owner === viewer || idd(u.x, u.y) || reveal)) {
			if (rad(u.x, u.y) && u.owner !== viewer) blip(ctx, px, py, L.tile, UNIT_BY[u.kind].domain, now, motion);
			continue;
		}
		const color = fac(u.owner);
		const live = canActUnit(m, u);
		ctx.save();
		if (!reveal && u.owner === m.active && !live) ctx.globalAlpha = .4;
		paintMark(ctx, u.kind, px + L.tile / 2, py + L.tile / 2 + 3, L.tile * .34, color);
		hpBar(ctx, px, py, L.tile, u.hp, UNIT_BY[u.kind].hp, color);
		ctx.restore();
		buildLeft(ctx, px, py, L.tile, u.eta ?? 0);
		if (!reveal && live) actRing(ctx, px, py, L.tile, now);
		if ((u.eta ?? 0) <= 0 && u.fresh) {
			ctx.fillStyle = PAPER;
			ctx.beginPath();
			ctx.arc(px + L.tile * .82, py + L.tile * .78, Math.max(2, L.tile * .06), 0, Math.PI * 2);
			ctx.fill();
		}
		if (m.selection?.kind === "unit" && m.selection.id === u.id) brackets(ctx, px, py, L.tile, PAPER, 2);
	}
	for (const c of m.contacts?.[viewer] ?? []) {
		const unit = m.units.find((u) => u.id === c.id);
		const st = m.structs.find((s) => s.id === c.id && s.hp > 0);
		const piece = unit ?? st;
		if (!!piece && piece.x === c.x && piece.y === c.y && (idd(c.x, c.y) || rad(c.x, c.y))) continue;
		const px = L.ox + c.x * L.tile;
		const py = L.oy + c.y * L.tile;
		ctx.save();
		ctx.globalAlpha = .45;
		blip(ctx, px, py, L.tile, c.domain, now, false);
		ctx.globalAlpha = .9;
		ctx.fillStyle = "#e2b15a";
		ctx.font = `700 ${Math.max(9, Math.floor(L.tile * .22))}px Outfit, sans-serif`;
		ctx.textAlign = "center";
		ctx.textBaseline = "bottom";
		ctx.fillText("LAST", px + L.tile / 2, py + L.tile - 2);
		ctx.restore();
	}
	for (const fx of m.fx) {
		if (fx.until < clock) continue;
		if (!reveal && !tileSeen(fx.x, fx.y) && !idd(fx.x, fx.y)) continue;
		const age = Math.min(1, Math.max(0, 1 - (fx.until - clock) / 1100));
		ctx.globalAlpha = 1 - age;
		ctx.fillStyle = PAPER;
		ctx.font = `600 ${Math.max(11, L.tile * .28)}px Outfit, sans-serif`;
		ctx.textAlign = "center";
		ctx.fillText(fx.text, L.ox + fx.x * L.tile + L.tile / 2, L.oy + fx.y * L.tile - 4 - age * 10);
		ctx.globalAlpha = 1;
	}
	const drawCursor = (c, color, w) => {
		if (c.x < 0 || c.y < 0 || c.x >= cols || c.y >= rows) return;
		brackets(ctx, L.ox + c.x * L.tile, L.oy + c.y * L.tile, L.tile, color, w);
	};
	if (!reveal) {
		drawCursor(m.cursor, BRASS, 2);
		if (hover && (hover.x !== m.cursor.x || hover.y !== m.cursor.y)) drawCursor(hover, "rgba(243,234,219,0.7)", 1.25);
	}
	ctx.restore();
	if (!reveal && m.phase === "maneuver") {
		ctx.font = "600 14px Outfit, sans-serif";
		ctx.textAlign = "left";
		ctx.textBaseline = "top";
		ctx.fillStyle = "#f3eadb";
		ctx.fillText("Click a unit, then a gold square to move it", 12, 10);
	}
}
function Manual({ onBack }) {
	const works = STRUCTS.filter((s) => s.id !== "spire");
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("main", {
		className: "h-dvh overflow-y-auto bg-bg text-fg",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "mx-auto flex max-w-3xl flex-col gap-8 px-4 py-8 pb-16",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
					className: "flex flex-wrap items-end justify-between gap-4",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-xs tracking-widest text-brass uppercase",
						children: "Field manual"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
						className: "font-display text-4xl text-fg",
						children: "Ashveil"
					})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						onClick: onBack,
						className: "min-h-11 rounded-lg bg-brass px-4 py-2 text-sm font-medium text-brass-ink",
						children: "Back"
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
					className: "flex flex-col gap-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
						className: "font-display text-2xl",
						children: "How a turn goes"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("ol", {
						className: "flex list-decimal flex-col gap-2 pl-5 text-muted",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: "Income lands in your purse from your Headquarters and any Supply Bases you hold." }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: "Buy. Click a catalog card. Gold squares with a + appear on the map. Ground and air units must touch your Headquarters or a Supply Base you own. Ships go on the marked water by the dock. Click one of those squares. The piece sits there until its build time is up. Infantry and a wall take 1 turn. Tanks, guns, and radar take 2. Bombers, cruisers, howitzers, and a new supply base take 3. The number on the piece is how many of your turns are left." }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: "Move every unit you want. Each one can keep moving until its movement is used up. Units can move through other units, headquarters, and supply bases. Walls still block. Every gun can move and still fire. Some weapons fire more than once. Yellow marks anything any of your units could hit. Red means you can shoot it right now. Click the red square, or press Shoot. Shots can miss, and they get worse with range." }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: "Enemy AA guns, mobile AA, machine guns, and bunkers fire during your turn. They shoot at the start of your turn if you are already in range, and again when you move into range. A miss still uses one of their shots." }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: "The Minelayer carries 4 hidden mines. Select it, press Lay mine, then click a marked square next to it. The enemy cannot see the mine. Your own troops can drive over it." }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: "On the title screen, choose Hotseat or a bot from level 1 to 10. Level 1 is poor, slow, and often misses. Level 10 starts with the same purse as you, moves the whole army, buys a mixed force, heals, and goes for the Headquarters. Higher levels are smarter, not richer than you. Against a bot there is no pass screen." }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: "Log in for online play. Host a room and give the code to a friend, or join theirs. Friends can send a request and an invite. Rank starts at Sergeant, 1000, and moves when an online match ends. The map stays hidden on their turn." }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: "End the turn. Idle machine guns, bunkers, and AA guns take one parting shot at a contact they can sense." }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: "The map is covered by a white handoff. Pass the machine. The next player presses their ready button. Their board is already there when the cover lifts." })
						]
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
					className: "flex flex-col gap-2",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
							className: "font-display text-2xl",
							children: "How you win"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-muted",
							children: "Destroy the enemy Headquarters, or walk Infantry or a Sniper onto it. A healthy squad seizes the Headquarters the moment it steps on the square. A Supply Base takes 20 capture points and then pays you 200 a turn. You can also shell the Headquarters until it falls."
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-muted",
							children: "North (Player 1) moves first with a 1,000 purse plus opening income. South (Player 2) waits with a 1,300 purse — a 300 stipend — and collects income when their turn starts."
						})
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
					className: "flex flex-col gap-2",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
							className: "font-display text-2xl",
							children: "Fog, radar, ground"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-muted",
							children: "The whole map stays visible. Ground outside your eyes is only slightly dimmed — it is not a black void. Both Headquarters stay marked, so you can always see where the enemy base is. Enemy troops show as themselves within 3 tiles of your units, including diagonally. Farther out they are a blip only if a radar reaches them, and a faded LAST mark stays on the square where you last saw them. Weapon radar is still 1 tile. A Radar tower and a Portable Radar both reach 5 tiles. Inside 4 of them you see what the contact is. The outer tile is only a blip. Ridges block eyes. Forest blocks eyes only. Helicopters, Fighters, Bombers, and Medevacs fly over water, ridges, and walls. Cruisers and Destroyers sail water only and deploy within two tiles of your headquarters or a supply base you hold. Enemy mines stay hidden. A ground unit that enters one stops and takes 8."
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-muted",
							children: "Counters: Anti-Tank breaks Tanks, IFVs, and Howitzers. Mobile AA and AA Guns kill Fighters, Bombers, and Helicopters. Fighters own the sky and cannot crack buildings. Bombers level troops and headquarters but cannot shoot aircraft. Cruisers shell the shore from range 2–7. A Destroyer that steps inside that minimum is safe from the cruiser and can sink it. Machine Guns ignore aircraft. Mortars and Howitzers crack buildings. Infantry is cheap and captures."
						})
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
					className: "flex flex-col gap-3",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
						className: "font-display text-2xl",
						children: "Buy list — units"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
						className: "grid gap-2 sm:grid-cols-2",
						children: UNITS.map((u) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
							className: "rounded-lg border border-line bg-surface p-3",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex items-baseline justify-between gap-3",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
										className: "font-display text-xl",
										children: u.name
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "text-brass tabular-nums",
										children: u.cost
									})]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "text-sm text-muted",
									children: u.blurb
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
									className: "mt-1 text-xs text-muted tabular-nums",
									children: [
										"HP ",
										u.hp,
										" · Move ",
										u.move,
										" · Range ",
										u.minRange,
										"–",
										u.maxRange,
										" · Vision ",
										u.vision,
										u.radar ? ` · Radar ${u.radar}` : ""
									]
								})
							]
						}, u.id))
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
					className: "flex flex-col gap-3",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
							className: "font-display text-2xl",
							children: "Buy list — buildings"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
							className: "grid gap-2 sm:grid-cols-2",
							children: works.map((s) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
								className: "rounded-lg border border-line bg-surface p-3",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex items-baseline justify-between gap-3",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
											className: "font-display text-xl",
											children: s.name
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "text-brass tabular-nums",
											children: s.cost
										})]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
										className: "text-sm text-muted",
										children: s.blurb
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
										className: "mt-1 text-xs text-muted tabular-nums",
										children: [
											"HP ",
											s.hp,
											s.atk > 0 ? ` · Atk ${s.atk} · Range ${s.minRange}–${s.maxRange}` : "",
											s.radar > 0 ? ` · Radar ${s.radar}` : "",
											s.income > 0 ? ` · +${s.income}` : ""
										]
									})
								]
							}, s.id))
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-sm text-muted",
							children: "Headquarters is not for sale. HP 32, vision 2, +500. Ground and air units deploy on or beside your headquarters or supply bases. Cruisers and Destroyers deploy on water within two tiles of those holdings. Buildings go on plains, road, rubble, or forest you control, within two tiles of those holdings and closer to you than to the enemy. A new Supply Base cannot be founded within five tiles of an enemy headquarters."
						})
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
					className: "flex flex-col gap-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
						className: "font-display text-2xl",
						children: "Controls"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("ul", {
						className: "grid gap-2 text-sm text-muted sm:grid-cols-2",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", {
								className: "rounded-lg border border-line bg-surface p-3",
								children: "Click a tile, unit, work, or catalog card."
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", {
								className: "rounded-lg border border-line bg-surface p-3",
								children: "Arrows or WASD move the cursor. A is left, D is right. Enter or Space confirms."
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", {
								className: "rounded-lg border border-line bg-surface p-3",
								children: "E ends the turn. Esc cancels."
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", {
								className: "rounded-lg border border-line bg-surface p-3",
								children: "C capture · H hold · R repair · Tab next idle unit."
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", {
								className: "rounded-lg border border-line bg-surface p-3",
								children: "Keys 1–9 and 0 arm the first ten units. Shift+1–7 arms a work. Deploy phase only."
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", {
								className: "rounded-lg border border-line bg-surface p-3",
								children: "On the white pass screen, Space or I’m ready. Not before."
							})
						]
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
					className: "flex flex-col gap-3",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
						className: "font-display text-2xl",
						children: "Maps"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
						className: "flex flex-col gap-2",
						children: MAPS.map((map) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
							className: "rounded-lg border border-line bg-surface p-3",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
									className: "font-display text-xl",
									children: map.name
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "text-xs tracking-widest text-muted uppercase",
									children: map.kind === "land" ? "Land" : map.kind === "sea" ? "Sea" : "Mixed"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "text-sm text-muted",
									children: map.blurb
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
									className: "text-xs text-muted tabular-nums",
									children: [
										map.rows[0].length,
										"×",
										map.rows.length
									]
								})
							]
						}, map.id))
					})]
				})
			]
		})
	});
}
var createSsrRpc = (functionId) => {
	const url = "/_serverFn/" + functionId;
	const serverFnMeta = { id: functionId };
	const fn = async (...args) => {
		return (await getServerFnById(functionId, { origin: "server" }))(...args);
	};
	return Object.assign(fn, {
		url,
		serverFnMeta,
		[TSS_SERVER_FUNCTION]: true
	});
};
var accountRegister = createServerFn({ method: "POST" }).validator((data) => data).handler(createSsrRpc("ba7d2009455dbcd9bdfd8a5374cab8be47fb2f73e969ad698b04f6c36caaa854"));
var accountLogin = createServerFn({ method: "POST" }).validator((data) => data).handler(createSsrRpc("9298ab003c7dfdf2008b6eec8d3ad70493a5af57cedcba8785a5ba735df88316"));
var accountMe = createServerFn({ method: "POST" }).validator((data) => data).handler(createSsrRpc("f8a19067a0d55e6a274dc4f457ca2ec87f5a576343353dbb075e02b0e92d437b"));
var accountLogout = createServerFn({ method: "POST" }).validator((data) => data).handler(createSsrRpc("72987a7c3020604ce5e00f82f6efaa784ac9a7cdb3307cb9417dab2fcb4319f4"));
var friendList = createServerFn({ method: "POST" }).validator((data) => data).handler(createSsrRpc("7c495e7ed6706b7b5efa5369e6d88e4a4c2b953c7119232af1c7974a217abd7e"));
var friendAdd = createServerFn({ method: "POST" }).validator((data) => data).handler(createSsrRpc("21e564063d2df71e9ab18f40b9eb59a65a3122918ebb44d8731a166d98e9ca7f"));
var friendAnswer = createServerFn({ method: "POST" }).validator((data) => data).handler(createSsrRpc("c5a8fcec6ad3ee8a0e99b0410c6ce254c24a14e75b95d8f028016dd03b7e30bf"));
var rankBoard = createServerFn({ method: "POST" }).validator((data) => data).handler(createSsrRpc("b4209c55380731a53508e1c942e50d976c884adc55b9eb79177e7c3a72f80b24"));
var roomHost = createServerFn({ method: "POST" }).validator((data) => data).handler(createSsrRpc("37dd19355d25292f2a60584e69fa66f4bfbd74d5fdb5101e3a0ce62e580cb21f"));
var roomJoin = createServerFn({ method: "POST" }).validator((data) => data).handler(createSsrRpc("059a24e10a0c03680297c5c7d34916e3a39b4956c82a4a5693154a77c646baab"));
var roomInvite = createServerFn({ method: "POST" }).validator((data) => data).handler(createSsrRpc("72960209652838ad51bef46e3d485860197c96859aadd427dc254e83aa45ff3b"));
var roomSync = createServerFn({ method: "POST" }).validator((data) => data).handler(createSsrRpc("33fc625873373e950570cacae37780302efb16611b9bb7517d41b01068b217e4"));
var roomPlay = createServerFn({ method: "POST" }).validator((data) => data).handler(createSsrRpc("9afb76d222d7177e8bd560c59b71201fb7f1221ffaa20a53815b8f17bb75b1b0"));
function Btn$1({ tone = "ghost", className = "", type = "button", ...props }) {
	const look = tone === "brass" ? "bg-brass text-brass-ink" : "border border-line bg-surface-2 text-fg";
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
		...props,
		type,
		className: `min-h-11 rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-40 ${look} ${className}`
	});
}
function Shell({ title, onBack, backLabel = "Back", children }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("main", {
		className: "h-dvh overflow-y-auto bg-bg text-fg",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "mx-auto flex max-w-xl flex-col gap-4 px-4 py-8",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex items-center justify-between gap-3",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
					className: "font-display text-4xl",
					children: title
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Btn$1, {
					onClick: onBack,
					children: backLabel
				})]
			}), children]
		})
	});
}
function TurnClock({ deadline, onZero }) {
	const [left, setLeft] = (0, import_react.useState)(() => Math.max(0, deadline - Date.now()));
	const fired = (0, import_react.useRef)(false);
	(0, import_react.useEffect)(() => {
		fired.current = false;
		const tick = () => {
			const ms = Math.max(0, deadline - Date.now());
			setLeft(ms);
			if (ms === 0 && !fired.current) {
				fired.current = true;
				onZero?.();
			}
		};
		tick();
		const id = window.setInterval(tick, 250);
		return () => window.clearInterval(id);
	}, [deadline, onZero]);
	const seconds = Math.ceil(left / 1e3);
	const text = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
		className: `font-display text-3xl leading-none tabular-nums ${seconds <= 10 ? "text-brass" : ""}`,
		"aria-live": "polite",
		children: text
	});
}
function LoginPage({ onDone, onBack }) {
	const [username, setUsername] = (0, import_react.useState)("");
	const [password, setPassword] = (0, import_react.useState)("");
	const [error, setError] = (0, import_react.useState)("");
	const [busy, setBusy] = (0, import_react.useState)(false);
	const submit = async (mode) => {
		const who = username.trim().replace(/ +/g, " ");
		if (!who || !password) {
			setError("Type the name and the password.");
			return;
		}
		setBusy(true);
		setError("");
		try {
			const res = mode === "login" ? await accountLogin({ data: {
				username: who,
				password
			} }) : await accountRegister({ data: {
				username: who,
				password
			} });
			if (!res.ok) {
				setError(res.error);
				return;
			}
			onDone(res.token, res.user);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Could not reach the account list. Try again.");
		} finally {
			setBusy(false);
		}
	};
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Shell, {
		title: "Log in",
		onBack,
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "text-sm text-muted",
			children: "A name and a password. Spaces are allowed. Rank and friends stay on this account."
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
			className: "flex flex-col gap-3",
			onSubmit: (e) => {
				e.preventDefault();
				submit("login");
			},
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
					className: "flex flex-col gap-1 text-sm",
					children: ["Name", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
						value: username,
						onChange: (e) => setUsername(e.target.value),
						className: "min-h-11 rounded-lg border border-line bg-surface px-3",
						autoComplete: "username"
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
					className: "flex flex-col gap-1 text-sm",
					children: ["Password", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
						value: password,
						type: "password",
						onChange: (e) => setPassword(e.target.value),
						className: "min-h-11 rounded-lg border border-line bg-surface px-3",
						autoComplete: "current-password"
					})]
				}),
				error ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-sm text-brass",
					children: error
				}) : null,
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex flex-wrap gap-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Btn$1, {
						tone: "brass",
						type: "submit",
						disabled: busy,
						children: "Log in"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Btn$1, {
						type: "button",
						disabled: busy,
						onClick: () => void submit("register"),
						children: "Create account"
					})]
				})
			]
		})]
	});
}
function FriendsPage({ token, username, mapId, onBack, onRoom }) {
	const [name, setName] = (0, import_react.useState)("");
	const [error, setError] = (0, import_react.useState)("");
	const [friends, setFriends] = (0, import_react.useState)([]);
	const [incoming, setIncoming] = (0, import_react.useState)([]);
	const [outgoing, setOutgoing] = (0, import_react.useState)([]);
	const [players, setPlayers] = (0, import_react.useState)([]);
	const [invites, setInvites] = (0, import_react.useState)([]);
	const [note, setNote] = (0, import_react.useState)("");
	const load = async () => {
		try {
			const res = await friendList({ data: { token } });
			if (!res.ok) {
				setError(res.error);
				return;
			}
			setError("");
			setFriends(res.friends);
			setIncoming(res.incoming);
			setOutgoing(res.outgoing);
			setPlayers(res.players);
			setInvites(res.invites);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Could not load friends.");
		}
	};
	const add = (username) => {
		const who = username.trim();
		if (!who) {
			setError("Type their account name, or press Add next to a player.");
			return;
		}
		friendAdd({ data: {
			token,
			username: who
		} }).then((res) => {
			if (!res.ok) setError(res.error);
			else {
				setName("");
				setError("");
				setNote(`${who} is now your friend. Press Invite when you want a game.`);
				load();
			}
		}).catch((err) => setError(err instanceof Error ? err.message : "Could not send that request."));
	};
	(0, import_react.useEffect)(() => {
		load();
	}, [token]);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Shell, {
		title: "Friends",
		onBack,
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
				className: "text-sm text-muted",
				children: [
					"Signed in as ",
					username,
					". Your own name is not listed. Every other account on this game is below. Press Friend. It sticks from this computer, even if they are offline."
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
				className: "flex flex-wrap gap-2",
				onSubmit: (e) => {
					e.preventDefault();
					add(name);
				},
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
					value: name,
					onChange: (e) => setName(e.target.value),
					placeholder: "Their name",
					className: "min-h-11 flex-1 rounded-lg border border-line bg-surface px-3"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Btn$1, {
					tone: "brass",
					type: "submit",
					children: "Add"
				})]
			}),
			note ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-sm text-brass",
				children: note
			}) : null,
			error ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-sm text-brass",
				children: error
			}) : null,
			incoming.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
				className: "flex flex-col gap-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
					className: "font-display text-2xl",
					children: "Requests"
				}), incoming.map((row) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center justify-between gap-2 rounded-lg border border-line px-3 py-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
						row.username,
						" · ",
						row.rank
					] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
						className: "flex gap-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Btn$1, {
							tone: "brass",
							onClick: () => void friendAnswer({ data: {
								token,
								username: row.username,
								accept: true
							} }).then(() => void load()),
							children: "Accept"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Btn$1, {
							onClick: () => void friendAnswer({ data: {
								token,
								username: row.username,
								accept: false
							} }).then(() => void load()),
							children: "Decline"
						})]
					})]
				}, row.id))]
			}) : null,
			invites.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
				className: "flex flex-col gap-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
					className: "font-display text-2xl",
					children: "Game invites"
				}), invites.map((row) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center justify-between gap-2 rounded-lg border border-line px-3 py-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "text-sm",
						children: [
							row.from,
							" invited you. Code ",
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "font-display text-xl",
								children: row.code
							})
						]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Btn$1, {
						tone: "brass",
						onClick: () => void roomJoin({ data: {
							token,
							code: row.code
						} }).then((res) => {
							if (!res.ok) setError(res.error);
							else onRoom(res);
						}).catch(() => setError("Could not join that game.")),
						children: "Join"
					})]
				}, row.code))]
			}) : null,
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
				className: "flex flex-col gap-2",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
						className: "font-display text-2xl",
						children: "Your friends"
					}),
					friends.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-sm text-muted",
						children: "None yet. Friend someone from Accounts."
					}) : null,
					friends.map((row) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-center justify-between gap-2 rounded-lg border border-line px-3 py-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
							row.username,
							" · ",
							row.rank,
							" ",
							row.rating
						] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Btn$1, {
							tone: "brass",
							onClick: () => void roomInvite({ data: {
								token,
								username: row.username,
								mapId
							} }).then((res) => {
								if (!res.ok) setError(res.error);
								else onRoom(res);
							}),
							children: "Invite"
						})]
					}, row.id))
				]
			}),
			outgoing.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
				className: "flex flex-col gap-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
					className: "font-display text-2xl",
					children: "Waiting on them"
				}), outgoing.map((row) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
					className: "text-sm text-muted",
					children: [row.username, " has not accepted yet."]
				}, row.id))]
			}) : null,
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
				className: "flex flex-col gap-2",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
						className: "font-display text-2xl",
						children: "Accounts"
					}),
					players.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-sm text-muted",
						children: "No other accounts are saved on this game yet. Log out and press Create account for the other name. A space is allowed, like AAAgunner 23."
					}) : null,
					players.map((row) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-center justify-between gap-2 rounded-lg border border-line px-3 py-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
							row.username,
							" · ",
							row.rank,
							" ",
							row.rating
						] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Btn$1, {
							tone: "brass",
							onClick: () => add(row.username),
							children: "Friend"
						})]
					}, row.id))
				]
			})
		]
	});
}
function RankPage({ token, onBack }) {
	const [board, setBoard] = (0, import_react.useState)([]);
	const [error, setError] = (0, import_react.useState)("");
	(0, import_react.useEffect)(() => {
		rankBoard({ data: { token } }).then((res) => {
			if (!res.ok) setError(res.error);
			else setBoard(res.board);
		});
	}, [token]);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Shell, {
		title: "Rank",
		onBack,
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-sm text-muted",
				children: "Online wins raise your rating. You start as a Sergeant at 1000."
			}),
			error ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-sm text-brass",
				children: error
			}) : null,
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("ol", {
				className: "flex flex-col gap-2",
				children: board.map((row, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
					className: "flex items-baseline justify-between gap-3 rounded-lg border border-line px-3 py-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
						i + 1,
						". ",
						row.username
					] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
						className: "text-sm tabular-nums",
						children: [
							row.rank,
							" · ",
							row.rating,
							" · ",
							row.wins,
							"–",
							row.losses
						]
					})]
				}, row.id))
			})
		]
	});
}
function LobbyPage({ code, onBack }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Shell, {
		title: "Waiting",
		onBack,
		backLabel: "Home",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "text-sm text-muted",
			children: "Give this code to the other player. The match starts when they join. Each turn lasts 30 seconds."
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "font-display text-6xl tracking-widest",
			children: code
		})]
	});
}
function WaitingPage({ name, deadline, onHome }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("main", {
		className: "flex h-dvh flex-col items-center justify-center gap-3 bg-bg text-fg",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-xs tracking-widest text-brass uppercase",
				children: "Their turn"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h1", {
				className: "font-display text-5xl",
				children: ["Waiting for ", name]
			}),
			deadline ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TurnClock, { deadline }) : null,
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-sm text-muted",
				children: "The map stays hidden until it is your turn. The clock ends their turn at zero."
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Btn$1, {
				onClick: onHome,
				children: "Home"
			})
		]
	});
}
function statRows(rows) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("dl", {
		className: "mt-2 grid grid-cols-2 gap-x-3 gap-y-0.5",
		children: rows.map(([k, v]) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "flex items-baseline justify-between gap-3 text-sm",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("dt", {
				className: "text-muted",
				children: k
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("dd", {
				className: "tabular-nums",
				children: v
			})]
		}, k))
	});
}
function unitSheet(def, hp, left) {
	const range = def.minRange === def.maxRange ? String(def.maxRange) : `${def.minRange}–${def.maxRange}`;
	const build = def.build ? `${def.build} ${def.build === 1 ? "turn" : "turns"}` : "Now";
	return {
		title: def.name,
		blurb: def.blurb,
		rows: [
			["HP", hp != null ? `${hp} / ${def.hp}` : String(def.hp)],
			["Cost", String(def.cost)],
			["Build", build],
			["Build left", left == null ? build : left > 0 ? `${left} ${left === 1 ? "turn" : "turns"}` : "Ready"],
			["Move", String(def.move)],
			["Range", range],
			["Vision", String(def.vision)],
			["Radar", String(def.radar ?? 0)],
			["Attack", String(def.atk)],
			["Shots", String(def.shots ?? 1)],
			["Hit", def.atk > 0 && def.maxRange > 0 ? hitBand(def.id, def.minRange, def.maxRange) : "—"],
			["Armor", def.armor === "light" ? "Infantry" : def.armor === "armor" ? "Armor" : "Air"],
			["Moves on", def.domain],
			["Mines", def.mines ? String(def.mines) : "—"],
			["Vs troops", `${def.vs.light}×`],
			["Vs armor", `${def.vs.armor}×`],
			["Vs air", `${def.vs.air}×`],
			["Vs buildings", `${def.vs.structure}×`]
		]
	};
}
function structSheet(def, hp, left) {
	const range = def.atk > 0 ? def.minRange === def.maxRange ? String(def.maxRange) : `${def.minRange}–${def.maxRange}` : "—";
	const build = !def.cost ? "—" : def.build ? `${def.build} ${def.build === 1 ? "turn" : "turns"}` : "Now";
	return {
		title: def.name,
		blurb: def.blurb,
		rows: [
			["HP", hp != null ? `${hp} / ${def.hp}` : String(def.hp)],
			["Cost", def.cost ? String(def.cost) : "—"],
			["Build", build],
			["Build left", left == null ? build : left > 0 ? `${left} ${left === 1 ? "turn" : "turns"}` : "Ready"],
			["Range", range],
			["Vision", String(def.vision)],
			["Radar", String(def.radar)],
			["Attack", def.atk ? String(def.atk) : "—"],
			["Shots", def.atk ? String(def.shots ?? 1) : "—"],
			["Hit", def.atk > 0 ? hitBand(def.id, def.minRange, def.maxRange) : "—"],
			["Armor", `${Math.round(def.dr * 100)}%`],
			["Income", def.income ? `+${def.income}` : "—"],
			["Vs troops", `${def.vs.light}×`],
			["Vs armor", `${def.vs.armor}×`],
			["Vs air", `${def.vs.air}×`],
			["Vs buildings", `${def.vs.structure}×`]
		]
	};
}
function Btn({ tone = "ghost", className = "", ...props }) {
	const look = tone === "brass" ? "bg-brass text-brass-ink" : tone === "ink" ? "bg-pass-ink text-pass" : "border border-line bg-surface-2 text-fg";
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
		...props,
		type: props.type ?? "button",
		className: `min-h-11 rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-40 ${look} ${className}`
	});
}
function Mark({ kind, owner }) {
	const ref = (0, import_react.useRef)(null);
	(0, import_react.useEffect)(() => {
		const canvas = ref.current;
		if (!canvas) return;
		const ctx = canvas.getContext("2d");
		if (!ctx) return;
		ctx.clearRect(0, 0, 64, 64);
		paintMark(ctx, kind, 32, 34, 22, owner === 0 ? VESPER : owner === 1 ? NEREID : BRASS);
	}, [kind, owner]);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("canvas", {
		ref,
		width: 64,
		height: 64,
		className: "h-10 w-10 shrink-0",
		"aria-hidden": true
	});
}
function MapThumb({ id }) {
	const ref = (0, import_react.useRef)(null);
	(0, import_react.useEffect)(() => {
		const canvas = ref.current;
		const map = MAP_BY[id];
		if (!canvas || !map) return;
		const paint = () => {
			const ctx = canvas.getContext("2d");
			if (!ctx) return;
			const w = canvas.clientWidth || 320;
			const h = canvas.clientHeight || 120;
			const dpr = Math.min(2, window.devicePixelRatio || 1);
			canvas.width = Math.floor(w * dpr);
			canvas.height = Math.floor(h * dpr);
			ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
			drawPreview(ctx, w, h, map);
		};
		paint();
		const obs = new ResizeObserver(paint);
		obs.observe(canvas);
		return () => obs.disconnect();
	}, [id]);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("canvas", {
		ref,
		className: "h-28 w-full rounded-md bg-bg",
		"aria-hidden": true
	});
}
function Field({ match, reveal, motion, onTile, onHover, onLook }) {
	const ref = (0, import_react.useRef)(null);
	const scroller = (0, import_react.useRef)(null);
	const buffer = (0, import_react.useRef)(null);
	const matchRef = (0, import_react.useRef)(match);
	const hoverRef = (0, import_react.useRef)(null);
	const paintRef = (0, import_react.useRef)(() => {});
	const drag = (0, import_react.useRef)(null);
	const [frame, setFrame] = (0, import_react.useState)({
		left: 0,
		top: 0,
		w: 0,
		h: 0
	});
	matchRef.current = match;
	const cols = match.terrain[0].length;
	const rows = match.terrain.length;
	const mapW = cols * 48 + 16;
	const mapH = rows * 48 + 16;
	paintRef.current = () => {
		const canvas = ref.current;
		if (!canvas) return;
		const w = canvas.clientWidth;
		const h = canvas.clientHeight;
		if (w < 8 || h < 8) return;
		const dpr = Math.min(2, window.devicePixelRatio || 1);
		const bw = Math.floor(w * dpr);
		const bh = Math.floor(h * dpr);
		if (!buffer.current) buffer.current = document.createElement("canvas");
		const buf = buffer.current;
		if (buf.width !== bw || buf.height !== bh) {
			buf.width = bw;
			buf.height = bh;
		}
		const bctx = buf.getContext("2d");
		if (!bctx) return;
		try {
			bctx.setTransform(dpr, 0, 0, dpr, 0, 0);
			bctx.globalAlpha = 1;
			drawBattle(bctx, w, h, matchRef.current, hoverRef.current, performance.now(), reveal, motion);
		} catch (err) {
			console.error(err);
			return;
		}
		const ctx = canvas.getContext("2d");
		if (!ctx) return;
		if (canvas.width !== bw || canvas.height !== bh) {
			canvas.width = bw;
			canvas.height = bh;
		}
		ctx.setTransform(1, 0, 0, 1, 0, 0);
		ctx.drawImage(buf, 0, 0);
	};
	(0, import_react.useLayoutEffect)(() => {
		paintRef.current();
	}, [
		match.active,
		match.turn,
		match.phase,
		reveal
	]);
	(0, import_react.useEffect)(() => {
		const shell = scroller.current;
		const canvas = ref.current;
		if (!shell || !canvas) return;
		const L = layoutOf(canvas.clientWidth, canvas.clientHeight, cols, rows);
		const left = L.ox + match.cursor.x * L.tile;
		const top = L.oy + match.cursor.y * L.tile;
		const pad = L.tile;
		if (left < shell.scrollLeft + pad) shell.scrollLeft = Math.max(0, left - pad);
		else if (left + L.tile > shell.scrollLeft + shell.clientWidth - pad) shell.scrollLeft = left + L.tile - shell.clientWidth + pad;
		if (top < shell.scrollTop + pad) shell.scrollTop = Math.max(0, top - pad);
		else if (top + L.tile > shell.scrollTop + shell.clientHeight - pad) shell.scrollTop = top + L.tile - shell.clientHeight + pad;
	}, [
		match.cursor.x,
		match.cursor.y,
		cols,
		rows
	]);
	(0, import_react.useEffect)(() => {
		const shell = scroller.current;
		if (!shell) return;
		const read = () => {
			setFrame({
				left: shell.scrollLeft,
				top: shell.scrollTop,
				w: shell.clientWidth,
				h: shell.clientHeight
			});
		};
		read();
		shell.addEventListener("scroll", read, { passive: true });
		const obs = new ResizeObserver(read);
		obs.observe(shell);
		return () => {
			shell.removeEventListener("scroll", read);
			obs.disconnect();
		};
	}, []);
	(0, import_react.useEffect)(() => {
		let raf = 0;
		const loop = () => {
			paintRef.current();
			raf = requestAnimationFrame(loop);
		};
		raf = requestAnimationFrame(loop);
		return () => cancelAnimationFrame(raf);
	}, []);
	const pick = (e) => {
		const canvas = ref.current;
		if (!canvas) return null;
		const rect = canvas.getBoundingClientRect();
		const L = layoutOf(canvas.clientWidth, canvas.clientHeight, cols, rows);
		const x = Math.floor((e.clientX - rect.left - L.ox) / L.tile);
		const y = Math.floor((e.clientY - rect.top - L.oy) / L.tile);
		if (x < 0 || y < 0 || x >= cols || y >= rows) return null;
		return {
			x,
			y
		};
	};
	const L = layoutOf(mapW, mapH, cols, rows);
	const offscreen = match.units.filter((u) => u.owner === match.active).map((u) => {
		if (frame.w < 8 || frame.h < 8) return null;
		const cx = L.ox + u.x * L.tile + L.tile / 2;
		const cy = L.oy + u.y * L.tile + L.tile / 2;
		const pad = 20;
		if (frame.w > 0 && cx >= frame.left + pad && cx <= frame.left + frame.w - pad && cy >= frame.top + pad && cy <= frame.top + frame.h - pad) return null;
		const left = Math.min(Math.max(cx - frame.left, 18), Math.max(18, frame.w - 18));
		const top = Math.min(Math.max(cy - frame.top, 18), Math.max(18, frame.h - 18));
		return {
			id: u.id,
			name: UNIT_BY[u.kind].name,
			x: u.x,
			y: u.y,
			left,
			top
		};
	}).filter((m) => m !== null);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "absolute inset-0",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			ref: scroller,
			"data-testid": "map-scroll",
			className: "absolute inset-0 overflow-auto",
			onPointerDown: (e) => {
				if (e.button !== 0) return;
				drag.current = {
					x: e.clientX,
					y: e.clientY,
					left: scroller.current?.scrollLeft ?? 0,
					top: scroller.current?.scrollTop ?? 0,
					moved: false
				};
				e.currentTarget.setPointerCapture(e.pointerId);
			},
			onPointerMove: (e) => {
				const pan = drag.current;
				if (pan && (e.buttons & 1) === 1) {
					const dx = e.clientX - pan.x;
					const dy = e.clientY - pan.y;
					if (!pan.moved && Math.hypot(dx, dy) > 20) pan.moved = true;
					if (pan.moved && scroller.current) {
						scroller.current.scrollLeft = pan.left - dx;
						scroller.current.scrollTop = pan.top - dy;
						return;
					}
				}
				const t = pick(e);
				const prev = hoverRef.current;
				const same = !t && !prev || !!t && !!prev && t.x === prev.x && t.y === prev.y;
				hoverRef.current = t;
				if (same) return;
				onHover(t);
			},
			onPointerUp: (e) => {
				const pan = drag.current;
				drag.current = null;
				if (pan?.moved) return;
				const t = pick(e);
				if (t) onTile(t.x, t.y);
			},
			onPointerLeave: () => {
				hoverRef.current = null;
				onHover(null);
			},
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("canvas", {
				ref,
				"data-testid": "map-canvas",
				"aria-label": "Ashveil battle map",
				className: "block bg-[#c4b48a]",
				style: {
					width: mapW,
					height: mapH
				}
			})
		}), offscreen.map((piece) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
			type: "button",
			className: "absolute z-10 -translate-x-1/2 -translate-y-1/2 rounded-full border border-brass bg-bg/90 px-2 py-1 text-[11px] font-medium text-fg",
			style: {
				left: piece.left,
				top: piece.top
			},
			onClick: () => onLook(piece.x, piece.y),
			children: piece.name
		}, piece.id))]
	});
}
function AshveilApp() {
	const [state, setState] = (0, import_react.useState)(emptyRoot);
	const [mapId, setMapId] = (0, import_react.useState)(MAPS[0].id);
	const [botLevel, setBotLevel] = (0, import_react.useState)(null);
	const [account, setAccount] = (0, import_react.useState)(null);
	const [room, setRoom] = (0, import_react.useState)(null);
	const [page, setPage] = (0, import_react.useState)("field");
	const [joinCode, setJoinCode] = (0, import_react.useState)("");
	const [note, setNote] = (0, import_react.useState)("");
	const netRef = (0, import_react.useRef)(null);
	const stateRef = (0, import_react.useRef)(state);
	stateRef.current = state;
	const [muted, setMute] = (0, import_react.useState)(false);
	const [hover, setHover] = (0, import_react.useState)(null);
	const [motion, setMotion] = (0, import_react.useState)(true);
	const dispatch = (0, import_react.useCallback)((cmd) => {
		const net = netRef.current;
		const local = cmd.type === "cursor" || cmd.type === "title" || cmd.type === "manual" || cmd.type === "help" || cmd.type === "review" || cmd.type === "continue" || cmd.type === "discard-save" || cmd.type === "note-save";
		if (net && !local) {
			roomPlay({ data: {
				token: net.token,
				code: net.code,
				version: net.version,
				cmd
			} }).then((res) => {
				if (!res.ok) {
					setNote(res.error);
					return;
				}
				netRef.current = {
					token: net.token,
					code: res.code,
					seat: res.seat,
					version: res.version
				};
				setRoom(res);
				if (res.state) {
					try {
						cue(cmd.type, stateRef.current, res.state);
					} catch (err) {
						console.error(err);
					}
					setState(res.state);
				}
			});
			return;
		}
		setState((prev) => {
			const next = apply(prev, cmd);
			if (next !== prev) {
				try {
					cue(cmd.type, prev, next);
				} catch (err) {
					console.error(err);
				}
				if (cmd.type !== "cursor" && !netRef.current) try {
					persistRoot(next);
				} catch (err) {
					console.error(err);
				}
			}
			return next;
		});
	}, []);
	const onExpire = (0, import_react.useCallback)(() => {
		const net = netRef.current;
		if (!net) return;
		roomSync({ data: {
			token: net.token,
			code: net.code
		} }).then((res) => {
			if (!res.ok) return;
			setRoom(res);
			if (res.state) setState(res.state);
		});
	}, []);
	(0, import_react.useEffect)(() => {
		const saved = loadRoot();
		setState((s) => ({
			...s,
			hasSave: !!saved?.match
		}));
		setMute(loadMuted());
		const token = localStorage.getItem("ashveil.token");
		if (token) accountMe({ data: { token } }).then((res) => {
			if (res.ok) setAccount({
				...res.user,
				token
			});
			else localStorage.removeItem("ashveil.token");
		}).catch(() => localStorage.removeItem("ashveil.token"));
		const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
		const sync = () => setMotion(!mq.matches);
		sync();
		mq.addEventListener("change", sync);
		return () => mq.removeEventListener("change", sync);
	}, []);
	(0, import_react.useEffect)(() => {
		if (account && room && room.status !== "open") netRef.current = {
			token: account.token,
			code: room.code,
			seat: room.seat,
			version: room.version
		};
		else if (!room) netRef.current = null;
	}, [account, room]);
	(0, import_react.useEffect)(() => {
		if (!account || !room) return;
		if (state.match?.active === room.seat && !state.match?.winner && room.status === "active") return;
		const pull = () => {
			roomSync({ data: {
				token: account.token,
				code: room.code
			} }).then((res) => {
				if (!res.ok) return;
				setRoom(res);
				if (res.state) setState(res.state);
			});
		};
		pull();
		const id = window.setInterval(pull, 2e3);
		return () => window.clearInterval(id);
	}, [
		account,
		room?.code,
		room?.status,
		room?.version,
		state.match?.active,
		state.match?.winner
	]);
	(0, import_react.useEffect)(() => {
		window.__ashveil = publicSummary(state);
	}, [state]);
	(0, import_react.useEffect)(() => {
		const onKey = (e) => {
			const tag = e.target?.tagName;
			if (tag === "INPUT" || tag === "TEXTAREA") return;
			if (state.help && e.code === "Escape") {
				e.preventDefault();
				dispatch({ type: "help" });
				return;
			}
			if (state.screen === "handoff" && (e.code === "Space" || e.code === "Enter")) {
				e.preventDefault();
				dispatch({
					type: "ready",
					now: Date.now()
				});
				return;
			}
			const m = state.match;
			if (netRef.current && m && m.active !== netRef.current.seat) return;
			if (!m || state.screen !== "battle" || state.help || m.confirmEnd || m.salvo || m.winner) return;
			const moveCursor = (dx, dy) => {
				e.preventDefault();
				dispatch({
					type: "cursor",
					x: Math.max(0, Math.min(m.terrain[0].length - 1, m.cursor.x + dx)),
					y: Math.max(0, Math.min(m.terrain.length - 1, m.cursor.y + dy))
				});
			};
			if (e.code === "ArrowUp" || e.code === "KeyW") return moveCursor(0, -1);
			if (e.code === "ArrowDown" || e.code === "KeyS") return moveCursor(0, 1);
			if (e.code === "ArrowLeft" || e.code === "KeyA") return moveCursor(-1, 0);
			if (e.code === "ArrowRight" || e.code === "KeyD") return moveCursor(1, 0);
			if (e.code === "Enter" || e.code === "Space") {
				e.preventDefault();
				dispatch({
					type: "click",
					x: m.cursor.x,
					y: m.cursor.y
				});
				return;
			}
			if (e.code === "Escape") {
				e.preventDefault();
				dispatch({ type: "cancel" });
				return;
			}
			if (e.code === "KeyE") {
				e.preventDefault();
				dispatch({ type: "ask-end" });
				return;
			}
			if (e.code === "KeyC") {
				e.preventDefault();
				dispatch({ type: "capture" });
				return;
			}
			if (e.code === "KeyH") {
				e.preventDefault();
				dispatch({ type: "hold" });
				return;
			}
			if (e.code === "KeyR") {
				e.preventDefault();
				dispatch({ type: "repair" });
				return;
			}
			if (e.code === "Tab") {
				e.preventDefault();
				const list = m.units.filter((u) => u.owner === m.active && !u.fresh && !u.acted);
				if (!list.length) return;
				const sel = m.selection;
				const n = list[((sel?.kind === "unit" ? list.findIndex((u) => u.id === sel.id) : -1) + 1) % list.length];
				dispatch({
					type: "select",
					id: n.id
				});
				return;
			}
			if (m.phase === "deploy" && e.code.startsWith("Digit")) {
				const n = Number(e.code.slice(5));
				const units = BUY_ORDER.filter((id) => isUnitKind(id));
				const works = BUY_ORDER.filter((id) => !isUnitKind(id));
				const item = e.shiftKey ? n >= 1 ? works[n - 1] : void 0 : units[n === 0 ? 9 : n - 1];
				if (!item) return;
				e.preventDefault();
				dispatch({
					type: "buy",
					item
				});
			}
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [state, dispatch]);
	const toggleMute = () => {
		const next = !muted;
		setMute(next);
		setMuted(next);
		if (!next) play("ui");
	};
	if (state.help || state.screen === "manual") return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Manual, { onBack: () => dispatch(state.help ? { type: "help" } : { type: "title" }) });
	if ((state.screen === "victory" || state.screen === "review") && state.match?.winner) {
		if (state.screen === "review") return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Battle, {
			state,
			muted,
			motion,
			hover,
			reveal: true,
			deadline: null,
			onHome: () => {
				setRoom(null);
				dispatch({ type: "title" });
			},
			onExpire: () => {},
			onHover: setHover,
			onMute: toggleMute,
			dispatch
		});
		const w = state.match.winner;
		return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("main", {
			className: "flex h-dvh flex-col items-center justify-center gap-5 bg-bg px-6 text-center text-fg",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-xs tracking-widest text-brass uppercase",
					children: "The field is decided"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h1", {
					className: "font-display text-5xl",
					children: [FACTIONS[w.player].name, " holds Ashveil"]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "max-w-md text-muted",
					children: w.reason
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex flex-wrap justify-center gap-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Btn, {
						tone: "brass",
						onClick: () => dispatch({ type: "review" }),
						children: "Review the field"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Btn, {
						onClick: () => {
							setRoom(null);
							dispatch({ type: "title" });
						},
						children: "Home"
					})]
				})
			]
		});
	}
	if (page === "login") return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoginPage, {
		onBack: () => setPage("field"),
		onDone: (token, user) => {
			localStorage.setItem("ashveil.token", token);
			setAccount({
				...user,
				token
			});
			setPage("field");
		}
	});
	if (page === "friends" && account) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(FriendsPage, {
		token: account.token,
		username: account.username,
		mapId,
		onBack: () => setPage("field"),
		onRoom: (next) => {
			setRoom(next);
			setPage("field");
			if (next.state) setState(next.state);
		}
	});
	if (page === "rank" && account) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(RankPage, {
		token: account.token,
		onBack: () => setPage("field")
	});
	if (room?.status === "open" && (!state.match || state.screen === "title")) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LobbyPage, {
		code: room.code,
		onBack: () => {
			setRoom(null);
			setPage("field");
		}
	});
	if (!state.match || state.screen === "title") return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("main", {
		className: "h-dvh overflow-y-auto bg-bg text-fg",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "mx-auto flex max-w-5xl flex-col gap-6 px-4 py-8",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
					className: "flex flex-wrap items-end justify-between gap-4",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "max-w-xl",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "text-xs tracking-widest text-brass uppercase",
								children: "Two armies · one field"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
								className: "font-display text-5xl sm:text-6xl",
								children: "Ashveil"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "mt-2 text-muted",
								children: "A same-screen war. Spend the purse, plant radar and guns, and cover the map before you hand the machine across the table."
							})
						]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex gap-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Btn, {
							onClick: toggleMute,
							"aria-label": muted ? "Unmute" : "Mute",
							children: muted ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(VolumeX, { className: "size-5" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Volume2, { className: "size-5" })
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Btn, {
							onClick: () => dispatch({ type: "manual" }),
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
								className: "inline-flex items-center gap-2",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(BookOpen, { className: "size-4" }), " Field manual"]
							})
						})]
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex flex-wrap gap-2",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Btn, {
							tone: "brass",
							"data-testid": "start-match",
							onClick: () => {
								setRoom(null);
								dispatch({
									type: "new",
									mapId,
									bot: botLevel ?? void 0
								});
							},
							children: botLevel ? `Fight level ${botLevel}` : "Take the field"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Btn, {
							"data-testid": "versus-bot",
							onClick: () => setBotLevel(null),
							children: "Hotseat"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "self-center text-xs tracking-widest text-muted uppercase",
							children: "Bot"
						}),
						Array.from({ length: 10 }, (_, i) => i + 1).map((level) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Btn, {
							onClick: () => setBotLevel(level),
							tone: botLevel === level ? "brass" : "ghost",
							children: level
						}, level)),
						account ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Btn, {
								onClick: () => setPage("friends"),
								children: "Friends"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Btn, {
								onClick: () => setPage("rank"),
								children: "Rank"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Btn, {
								onClick: () => {
									roomHost({ data: {
										token: account.token,
										mapId
									} }).then((res) => {
										if (!res.ok) setNote(res.error);
										else setRoom(res);
									});
								},
								children: "Host online"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
								className: "flex flex-wrap items-center gap-2",
								onSubmit: (e) => {
									e.preventDefault();
									const code = joinCode.trim();
									if (!code) {
										setNote("Type the room code, then Join.");
										return;
									}
									roomJoin({ data: {
										token: account.token,
										code
									} }).then((res) => {
										if (!res.ok) setNote(res.error);
										else {
											setNote("");
											setRoom(res);
											if (res.state) setState(res.state);
										}
									}).catch(() => setNote("Could not join. Check the code and try again."));
								},
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
									value: joinCode,
									onChange: (e) => setJoinCode(e.target.value.toUpperCase()),
									placeholder: "Code",
									"aria-label": "Room code",
									className: "min-h-11 w-24 rounded-lg border border-line bg-surface px-3 uppercase"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Btn, {
									tone: "brass",
									type: "submit",
									children: "Join"
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Btn, {
								onClick: () => {
									accountLogout({ data: { token: account.token } });
									localStorage.removeItem("ashveil.token");
									setAccount(null);
									setRoom(null);
								},
								children: "Log out"
							})
						] }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Btn, {
							onClick: () => setPage("login"),
							children: "Log in"
						}),
						state.hasSave ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Btn, {
							"data-testid": "continue-match",
							onClick: () => dispatch({ type: "continue" }),
							children: "Continue"
						}) : null,
						state.hasSave ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Btn, {
							onClick: () => dispatch({ type: "discard-save" }),
							children: "Discard saved match"
						}) : null
					]
				}),
				note ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-sm text-brass",
					children: note
				}) : null,
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "flex flex-col gap-6",
					children: [
						["land", "Land"],
						["sea", "Sea"],
						["mixed", "Mixed"]
					].map(([kind, label]) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
						className: "flex flex-col gap-3",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
							className: "font-display text-2xl",
							children: label
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "grid gap-3 sm:grid-cols-2",
							children: MAPS.filter((map) => map.kind === kind).map((map) => {
								const on = map.id === mapId;
								return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
									type: "button",
									onClick: () => setMapId(map.id),
									className: `rounded-lg border p-3 text-left ${on ? "border-brass bg-surface" : "border-line bg-surface-2"}`,
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)(MapThumb, { id: map.id }),
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "mt-2 flex items-baseline justify-between gap-2",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
												className: "font-display text-2xl",
												children: map.name
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
												className: "text-xs text-muted tabular-nums",
												children: [
													map.rows[0].length,
													"×",
													map.rows.length
												]
											})]
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
											className: "text-sm text-muted",
											children: map.blurb
										})
									]
								}, map.id);
							})
						})]
					}, kind))
				}),
				account ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
					className: "text-sm text-muted",
					children: [
						"Signed in as ",
						account.username,
						" · ",
						account.rank,
						" ",
						account.rating,
						" · ",
						account.wins,
						"–",
						account.losses
					]
				}) : null,
				note ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-sm text-brass",
					children: note
				}) : null,
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-sm text-muted",
					children: "North is Player 1 and moves first. Hotseat gives South a 300 stipend. Against a bot, South starts with the same purse on Normal and Hard, and less on Easy. Win by destroying or capturing the enemy Headquarters. Online turns last 30 seconds. If the clock hits zero, that turn ends."
				})
			]
		})
	});
	if (room && state.match && room.status !== "open" && state.match.active !== room.seat && !state.match.winner && state.screen === "battle") return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(WaitingPage, {
		name: room.seat === 0 ? room.guest ?? "your opponent" : room.host,
		deadline: room.deadline,
		onHome: () => {
			setRoom(null);
			setPage("field");
			setState((prev) => ({
				...prev,
				screen: "title",
				help: false,
				match: null
			}));
		}
	});
	const passing = state.screen === "handoff" && state.match;
	const nextFaction = passing ? FACTIONS[state.match.active === 0 ? 1 : 0] : null;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		inert: passing ? true : void 0,
		className: passing ? "pointer-events-none" : void 0,
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Battle, {
			state,
			muted,
			motion,
			hover,
			reveal: false,
			deadline: room?.status === "active" ? room.deadline : null,
			onHome: () => {
				setRoom(null);
				setPage("field");
				setState((prev) => ({
					...prev,
					screen: "title",
					help: false,
					match: null
				}));
			},
			onExpire,
			onHover: setHover,
			onMute: toggleMute,
			dispatch
		})
	}), passing && nextFaction ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		"data-testid": "pass-screen",
		role: "dialog",
		"aria-modal": "true",
		"aria-labelledby": "pass-title",
		className: "fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 px-6 text-center",
		style: {
			background: "#f7f4ee",
			color: "#1a1814"
		},
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-xs tracking-widest uppercase",
				style: { color: "#5c564c" },
				children: "The map is covered on purpose"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h1", {
				id: "pass-title",
				className: "font-display text-5xl leading-none sm:text-7xl",
				style: { color: "#1a1814" },
				children: ["Pass to ", nextFaction.player]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
				className: "max-w-md text-lg",
				style: { color: "#3f3a33" },
				children: [
					"Hand the machine to ",
					nextFaction.name,
					". Their units stay hidden until they press the button."
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
				type: "button",
				"data-testid": "ready-btn",
				autoFocus: true,
				className: "min-h-11 rounded-lg px-6 py-3 text-base font-medium",
				style: {
					background: state.match.active === 0 ? NEREID : VESPER,
					color: "#1a1814"
				},
				onClick: () => dispatch({
					type: "ready",
					now: Date.now()
				}),
				children: [nextFaction.name, " is ready"]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-sm",
				style: { color: "#5c564c" },
				children: "or press Space"
			})
		]
	}) : null] });
}
function openRecord(m, x, y) {
	const lines = [terrainName(m.terrain[y][x])];
	const unit = unitAt(m, x, y);
	const st = structAt(m, x, y);
	if (unit) lines.push(`${FACTIONS[unit.owner].name} · ${UNIT_BY[unit.kind].name} · ${unit.hp}`);
	if (st) {
		const who = st.owner === null ? "Neutral" : FACTIONS[st.owner].name;
		lines.push(`${who} · ${STRUCT_BY[st.kind].name} · ${st.hp}`);
	}
	return {
		title: "Record",
		lines
	};
}
function Battle({ state, muted, motion, hover, reveal, deadline, onHome, onExpire, onHover, onMute, dispatch }) {
	const [wide, setWide] = (0, import_react.useState)(true);
	const m = state.match;
	const p = m.active;
	const faction = FACTIONS[p];
	const tone = p === 0 ? "bg-vesper text-vesper-ink" : "bg-nereid text-nereid-ink";
	const frame = p === 0 ? "frame-vesper" : "frame-nereid";
	const look = hover ?? m.cursor;
	const info = reveal ? openRecord(m, look.x, look.y) : inspectTile(m, look.x, look.y, p);
	const funds = m.funds[p];
	const nextPay = incomeOf(m, p);
	const idle = idleCount(m);
	const mobileLeft = m.units.filter((u) => u.owner === p && !u.acted && marchLeft(u) > 0).length;
	const log = m.log[p].slice(-5);
	const sel = m.selection;
	const selUnit = sel?.kind === "unit" ? m.units.find((u) => u.id === sel.id) : void 0;
	const selStruct = sel?.kind === "struct" ? m.structs.find((s) => s.id === sel.id) : void 0;
	const buy = sel?.kind === "buy" ? sel.item : null;
	const [card, setCard] = (0, import_react.useState)(null);
	const cov = reveal ? null : coverage(m, p);
	const identified = (x, y) => reveal || !!cov?.identified[y]?.[x];
	const lookedUnit = unitAt(m, look.x, look.y);
	const lookedStruct = structAt(m, look.x, look.y);
	const unitKnown = lookedUnit && (reveal || lookedUnit.owner === p || identified(lookedUnit.x, lookedUnit.y));
	const structKnown = lookedStruct && lookedStruct.hp > 0 && (reveal || lookedStruct.owner === p || identified(lookedStruct.x, lookedStruct.y) && lookedStruct.kind !== "mine");
	const mapSheet = unitKnown && lookedUnit ? unitSheet(UNIT_BY[lookedUnit.kind], lookedUnit.hp, lookedUnit.eta ?? 0) : structKnown && lookedStruct ? structSheet(STRUCT_BY[lookedStruct.kind], lookedStruct.hp, lookedStruct.eta ?? 0) : null;
	const picked = selUnit ? unitSheet(UNIT_BY[selUnit.kind], selUnit.hp, selUnit.eta ?? 0) : selStruct ? structSheet(STRUCT_BY[selStruct.kind], selStruct.hp, selStruct.eta ?? 0) : buy ? isUnitKind(buy) ? unitSheet(UNIT_BY[buy]) : structSheet(STRUCT_BY[buy]) : null;
	const sheet = card ? isUnitKind(card) ? unitSheet(UNIT_BY[card]) : structSheet(STRUCT_BY[card]) : mapSheet ?? (hover ? null : picked);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: `flex h-dvh flex-col overflow-hidden bg-bg text-fg ${reveal ? "" : frame}`,
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
			className: `${tone} flex flex-wrap items-center justify-between gap-3 px-4 py-3`,
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
				className: "text-xs tracking-widest uppercase",
				children: [
					faction.player,
					" · Round ",
					Math.ceil(m.turn / 2),
					m.bot ? ` · ${m.bot} bot` : ""
				]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h1", {
				className: "font-display text-3xl leading-none sm:text-4xl",
				children: [faction.name, " · your turn"]
			})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex items-center gap-3",
				children: [
					deadline && !reveal ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "text-right",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TurnClock, {
							deadline,
							onZero: onExpire
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-xs",
							children: "left this turn"
						})]
					}) : null,
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						className: "min-h-11 rounded-lg bg-black/20 px-3 text-sm font-medium",
						onClick: onHome,
						children: "Home"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "text-right",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "font-display text-3xl leading-none tabular-nums",
							children: funds
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
							className: "text-xs tabular-nums",
							children: [
								"Next +",
								nextPay,
								" · ",
								incomeBits(m, p)
							]
						})]
					})
				]
			})]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "flex min-h-0 flex-1 flex-col lg:flex-row",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "map-shell relative min-h-0 min-w-0 flex-1",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
						match: m,
						reveal,
						motion,
						onHover,
						onLook: (x, y) => dispatch({
							type: "cursor",
							x,
							y
						}),
						onTile: (x, y) => dispatch({
							type: "click",
							x,
							y
						})
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "pointer-events-none absolute bottom-3 left-3 z-10 rounded-md bg-bg/85 px-2 py-1 text-xs text-fg",
						children: "Drag or scroll to the other side"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						className: "absolute top-3 right-3 z-10 min-h-11 rounded-lg bg-bg/90 px-3 py-2 text-sm font-medium text-fg",
						onClick: () => setWide((v) => !v),
						children: wide ? "Show list" : "Expand map"
					}),
					layReady(m) ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						className: "absolute bottom-14 left-1/2 z-10 min-h-11 -translate-x-1/2 rounded-lg bg-bg/90 px-3 py-2 text-sm font-medium text-fg",
						onClick: () => dispatch({ type: "arm-lay" }),
						children: m.laying ? "Pick a square" : "Lay mine"
					}) : null,
					captureReady(m) ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						className: "absolute bottom-3 left-1/2 z-10 min-h-11 -translate-x-1/2 rounded-lg bg-bg/90 px-3 py-2 text-sm font-medium text-fg",
						onClick: () => dispatch({ type: "capture" }),
						children: "Capture"
					}) : null,
					repairReady(m) ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						className: "absolute right-3 bottom-3 z-10 min-h-11 rounded-lg bg-bg/90 px-3 py-2 text-sm font-medium text-fg",
						onClick: () => dispatch({ type: "repair" }),
						children: "Heal"
					}) : null,
					reveal ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "pointer-events-none absolute top-3 left-3 rounded-lg bg-bg/90 px-3 py-2 text-sm",
						children: ["Field revealed · ", m.winner?.reason]
					}) : null,
					m.confirmEnd ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "absolute inset-0 z-20 flex items-center justify-center bg-bg/80 p-4",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "w-full max-w-md rounded-lg border border-line bg-surface p-4",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h2", {
									className: "font-display text-2xl",
									children: [
										"End ",
										faction.name,
										"'s turn?"
									]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
									className: "mt-2 text-sm text-muted",
									children: [
										idle.units,
										" ",
										idle.units === 1 ? "unit" : "units",
										" can still act. ",
										idle.guns,
										" unfired",
										" ",
										idle.guns === 1 ? "defense" : "defenses",
										" will take a parting shot at contacts they can sense. Then the map is covered."
									]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "mt-4 flex flex-wrap gap-2",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Btn, {
										onClick: () => dispatch({ type: "cancel-end" }),
										children: "Keep playing"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Btn, {
										tone: "brass",
										"data-testid": "confirm-end",
										onClick: () => dispatch({
											type: "confirm-end",
											now: Date.now()
										}),
										children: "End turn"
									})]
								})
							]
						})
					}) : null,
					m.salvo ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "absolute inset-0 z-20 flex items-center justify-center bg-bg/80 p-4",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "w-full max-w-md rounded-lg border border-line bg-surface p-4",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
									className: "font-display text-2xl",
									children: "Parting shots"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
									className: "mt-2 flex flex-col gap-1 text-sm text-muted",
									children: m.salvo.map((line, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: line }, i))
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "mt-4 flex flex-wrap gap-2",
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Btn, {
										tone: "brass",
										"data-testid": "cover-field",
										onClick: () => dispatch({ type: "pass-cover" }),
										children: "Cover the field"
									})
								})
							]
						})
					}) : null
				]
			}), wide ? null : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("aside", {
				className: "flex h-64 min-h-0 shrink-0 flex-col gap-3 overflow-y-auto border-t border-line bg-surface p-3 lg:h-auto lg:w-96 lg:shrink lg:border-t-0 lg:border-l",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex flex-wrap gap-2",
						children: [
							!reveal ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Btn, {
								"data-testid": "end-turn",
								onClick: () => dispatch({ type: "ask-end" }),
								children: "End turn"
							}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Btn, {
								tone: "brass",
								onClick: () => dispatch({ type: "title" }),
								children: "Back to table"
							}),
							!reveal && sellOffer(m) ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Btn, {
								"data-testid": "sell",
								onClick: () => dispatch({ type: "sell" }),
								children: ["Sell +", sellOffer(m)?.pay]
							}) : null,
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Btn, {
								onClick: () => dispatch({ type: "help" }),
								children: "Manual"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Btn, {
								onClick: onMute,
								"aria-label": muted ? "Unmute" : "Mute",
								children: muted ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(VolumeX, { className: "size-4" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Volume2, { className: "size-4" })
							}),
							!reveal ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Btn, {
								onClick: () => dispatch({ type: "title" }),
								children: "Maps"
							}) : null
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "h-52 shrink-0 overflow-y-auto rounded-lg border border-line bg-surface-2 p-3",
						children: sheet ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "text-xs tracking-widest text-brass uppercase",
								children: sheet.title
							}),
							statRows(sheet.rows),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "mt-2 text-sm text-muted",
								children: sheet.blurb
							})
						] }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-sm text-muted",
							children: "Hover a shop card to see its stats."
						})
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "rounded-lg border border-line bg-surface-2 p-3",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "text-xs tracking-widest text-brass uppercase",
								children: info.title
							}),
							info.lines.map((line) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "text-sm",
								children: line
							}, line)),
							selUnit ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "mt-2 text-sm text-muted",
								children: (selUnit.eta ?? 0) > 0 ? `Still being built — ${selUnit.eta} ${selUnit.eta === 1 ? "turn" : "turns"} left. It cannot move, shoot, or heal until that hits zero.` : (UNIT_BY[selUnit.kind].mines ?? 0) > 0 ? `${selUnit.charges ?? UNIT_BY[selUnit.kind].mines} mines left. Press Lay mine, then click a marked square next to it.` : marchLeft(selUnit) > 0 ? `${marchLeft(selUnit)} tiles left. Gold squares move. Red squares shoot — click one, or press Shoot.${(UNIT_BY[selUnit.kind].shots ?? 1) > 1 ? ` ${Math.max(0, (UNIT_BY[selUnit.kind].shots ?? 1) - (selUnit.rounds ?? 0))} shots left.` : ""}` : `No movement left on this unit. Red squares are shots, if it can still fire.${(UNIT_BY[selUnit.kind].shots ?? 1) > 1 ? ` ${Math.max(0, (UNIT_BY[selUnit.kind].shots ?? 1) - (selUnit.rounds ?? 0))} shots left.` : ""}`
							}) : selStruct && (selStruct.eta ?? 0) > 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
								className: "mt-2 text-sm text-muted",
								children: [
									"Under construction. Ready in ",
									selStruct.eta,
									" ",
									selStruct.eta === 1 ? "turn" : "turns",
									"."
								]
							}) : buy ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "mt-2 text-sm text-muted",
								children: (() => {
									const name = isUnitKind(buy) ? UNIT_BY[buy].name : STRUCT_BY[buy].name;
									const n = selectionOverlay(m).places.length;
									if (!n) return `No open square for ${name}. Clear a square next to your Headquarters, or pick something else.`;
									const where = !isUnitKind(buy) ? "empty ground you control" : UNIT_BY[buy].domain === "sea" ? "water next to your Headquarters" : "ground touching your Headquarters or a Supply Base you own";
									return `Placing ${name}. ${n} gold ${n === 1 ? "square is" : "squares are"} marked with a +. They are ${where}. Click one. It will not be ready until its build time is up.`;
								})()
							}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
								className: "mt-2 text-sm text-muted",
								children: [mobileLeft, " of your pieces still have a bright outline. Those can move or shoot. Dim pieces are finished for this turn."]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "mt-2 text-sm text-muted",
								children: "Click a catalog card, then a gold + square. If those squares are full, the next ring out opens. Yellow marks anything any of your units could hit. Red means you can shoot it from where that unit is standing. Firing ends its movement."
							})] }),
							!reveal ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "mt-2 flex flex-wrap gap-2",
								children: [
									holdReady(m) ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Btn, {
										onClick: () => dispatch({ type: "hold" }),
										children: "Hold"
									}) : null,
									captureReady(m) ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Btn, {
										tone: "brass",
										onClick: () => dispatch({ type: "capture" }),
										children: "Capture"
									}) : null,
									repairReady(m) ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Btn, {
										onClick: () => dispatch({ type: "repair" }),
										children: "Heal"
									}) : null,
									layReady(m) ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Btn, {
										onClick: () => dispatch({ type: "arm-lay" }),
										children: m.laying ? "Pick a square" : "Lay mine"
									}) : null,
									selectionOverlay(m).attacks.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Btn, {
										tone: "brass",
										onClick: () => dispatch({ type: "strike" }),
										children: "Shoot"
									}) : null,
									buy ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Btn, {
										onClick: () => dispatch({ type: "cancel" }),
										children: "Cancel buy"
									}) : null
								]
							}) : null
						]
					}),
					!reveal && m.phase === "deploy" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mb-2 text-xs tracking-widest text-muted uppercase",
						children: "Catalog — then click a gold + square"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "grid grid-cols-2 gap-2",
						onMouseLeave: () => setCard(null),
						children: BUY_ORDER.map((item) => {
							const unit = isUnitKind(item);
							const def = unit ? UNIT_BY[item] : STRUCT_BY[item];
							const on = buy === item;
							const poor = funds < def.cost;
							return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
								type: "button",
								disabled: poor,
								onMouseEnter: () => setCard(item),
								onFocus: () => setCard(item),
								onBlur: () => setCard((cur) => cur === item ? null : cur),
								onClick: () => dispatch({
									type: "buy",
									item
								}),
								className: `flex min-h-11 items-center gap-2 rounded-lg border px-2 py-1 text-left ${on ? "border-brass bg-bg" : "border-line bg-surface-2"} disabled:opacity-40`,
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Mark, {
									kind: item,
									owner: p
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
									className: "min-w-0",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "block truncate text-sm",
										children: def.name
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
										className: "block text-xs text-brass tabular-nums",
										children: [
											def.cost,
											def.build ? ` · ${def.build} ${def.build === 1 ? "turn" : "turns"}` : " · now",
											unit ? ` · ${UNIT_BY[item].domain}` : ""
										]
									})]
								})]
							}, item);
						})
					})] }) : null,
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mb-1 text-xs tracking-widest text-muted uppercase",
						children: "Your log"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
						className: "flex flex-col gap-1 text-sm text-muted",
						children: log.length ? log.map((line, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: line }, `${i}-${line}`)) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: "No notes yet." })
					})] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "text-xs text-muted",
						children: [MAP_BY[m.mapId]?.name, " · WASD or arrows, Enter to confirm, E ends the turn."]
					})
				]
			})]
		})]
	});
}
function Home() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AshveilApp, {});
}
//#endregion
export { Home as component };
