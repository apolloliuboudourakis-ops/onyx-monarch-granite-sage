// @ts-nocheck
import { STRUCT_BY, UNIT_BY } from "./catalog";
import { charTerrain } from "./maps";
import { coverage, marchLeft, selectionOverlay, threatOverlay } from "./logic";

export const MAP_TILE = 48;

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
	const pulse = 0.45 + 0.55 * (0.5 + 0.5 * Math.sin(now / 160));
	ctx.save();
	ctx.strokeStyle = "#f4f0e6";
	ctx.globalAlpha = pulse;
	ctx.lineWidth = Math.max(3, tile * 0.09);
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
	ctx.font = `700 ${Math.max(11, Math.floor(tile * 0.26))}px Outfit, sans-serif`;
	const w = Math.min(tile - 4, ctx.measureText(label).width + 8);
	const h = Math.max(14, Math.floor(tile * 0.32));
	ctx.fillStyle = "#1a1814";
	ctx.fillRect(px + 2, py + 2, w, h);
	ctx.fillStyle = "#e7c56a";
	ctx.textAlign = "left";
	ctx.textBaseline = "middle";
	ctx.fillText(label, px + 6, py + 2 + h / 2);
	ctx.restore();
}

export const INK = "#14120e";
export const PAPER = "#f3eadb";
export const BRASS = "#d3924a";
export const VESPER = "#e07a3d";
export const NEREID = "#2fafa6";
export function layoutOf(cssW, cssH, cols, rows) {
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
export function paintMark(ctx, kind, cx, cy, r, fill, spin = 0) {
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
			ctx.rotate(spin);
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
		case "salvo":
			for (let i = -1; i <= 1; i++) {
				round(ctx, i * u * .28 - u * .08, -u * .7, u * .16, u * 1.3, u * .06);
				ctx.fill();
				ctx.stroke();
			}
			break;
		case "heavy":
			round(ctx, -u * .9, -u * .62, u * 1.8, u * .34, u * .08);
			ctx.fill();
			ctx.stroke();
			round(ctx, -u * .9, u * .28, u * 1.8, u * .34, u * .08);
			ctx.fill();
			ctx.stroke();
			round(ctx, -u * .7, -u * .4, u * 1.3, u * .8, u * .1);
			ctx.fill();
			ctx.stroke();
			ctx.beginPath();
			ctx.moveTo(u * .2, 0);
			ctx.lineTo(u * 1.15, 0);
			ctx.stroke();
			break;
		case "sam":
			round(ctx, -u * .7, u * .15, u * 1.4, u * .45, u * .1);
			ctx.fill();
			ctx.stroke();
			ctx.beginPath();
			ctx.moveTo(0, u * .15);
			ctx.lineTo(u * .15, -u * .95);
			ctx.stroke();
			break;
		case "drone":
			ctx.beginPath();
			ctx.moveTo(0, -u * .35);
			ctx.lineTo(u * .95, 0);
			ctx.lineTo(0, u * .35);
			ctx.lineTo(-u * .95, 0);
			ctx.closePath();
			ctx.fill();
			ctx.stroke();
			ctx.beginPath();
			ctx.arc(0, 0, u * .16, 0, Math.PI * 2);
			ctx.fill();
			ctx.stroke();
			break;
		case "sub":
			ctx.beginPath();
			ctx.ellipse(0, u * .1, u * .85, u * .32, 0, 0, Math.PI * 2);
			ctx.fill();
			ctx.stroke();
			ctx.beginPath();
			ctx.moveTo(0, u * .1);
			ctx.lineTo(0, -u * .7);
			ctx.stroke();
			break;
		case "mg":
			round(ctx, -u * .7, u * .2, u * 1.4, u * .4, u * .1);
			ctx.fill();
			ctx.stroke();
			ctx.beginPath();
			ctx.moveTo(-u * .35, u * .2);
			ctx.lineTo(-u * .55, -u * .75);
			ctx.moveTo(0, u * .2);
			ctx.lineTo(0, -u * .9);
			ctx.moveTo(u * .35, u * .2);
			ctx.lineTo(u * .55, -u * .75);
			ctx.stroke();
			break;
		case "ranger":
			ctx.beginPath();
			ctx.moveTo(0, -u * .95);
			ctx.lineTo(u * .42, u * .75);
			ctx.lineTo(-u * .42, u * .75);
			ctx.closePath();
			ctx.fill();
			ctx.stroke();
			ctx.beginPath();
			ctx.moveTo(0, -u * .15);
			ctx.lineTo(u * .85, -u * .45);
			ctx.stroke();
			break;
		case "breaker":
			round(ctx, -u * .75, -u * .45, u * 1.2, u * .9, u * .1);
			ctx.fill();
			ctx.stroke();
			round(ctx, u * .2, -u * .16, u * .85, u * .32, u * .06);
			ctx.fill();
			ctx.stroke();
			break;
		case "guard":
			round(ctx, -u * .95, -u * .7, u * 1.9, u * .4, u * .08);
			ctx.fill();
			ctx.stroke();
			round(ctx, -u * .95, u * .3, u * 1.9, u * .4, u * .08);
			ctx.fill();
			ctx.stroke();
			round(ctx, -u * .55, -u * .48, u * 1.1, u * .96, u * .1);
			ctx.fill();
			ctx.stroke();
			ctx.beginPath();
			ctx.moveTo(u * .15, 0);
			ctx.lineTo(u * 1.1, 0);
			ctx.stroke();
			break;
		case "battery":
			ctx.beginPath();
			ctx.moveTo(0, -u * .7);
			ctx.lineTo(u * .75, u * .35);
			ctx.lineTo(u * .45, u * .8);
			ctx.lineTo(-u * .45, u * .8);
			ctx.lineTo(-u * .75, u * .35);
			ctx.closePath();
			ctx.fill();
			ctx.stroke();
			round(ctx, -u * .22, -u * .35, u * .18, u * .55, u * .04);
			ctx.fill();
			ctx.stroke();
			round(ctx, u * .04, -u * .35, u * .18, u * .55, u * .04);
			ctx.fill();
			ctx.stroke();
			break;
		case "frigate":
			ctx.beginPath();
			ctx.moveTo(0, -u);
			ctx.lineTo(u * .42, u * .7);
			ctx.lineTo(-u * .42, u * .7);
			ctx.closePath();
			ctx.fill();
			ctx.stroke();
			ctx.beginPath();
			ctx.moveTo(-u * .08, -u * .1);
			ctx.lineTo(-u * .7, -u * .55);
			ctx.moveTo(u * .08, -u * .1);
			ctx.lineTo(u * .7, -u * .55);
			ctx.stroke();
			break;
		case "strike":
			ctx.beginPath();
			ctx.moveTo(0, -u);
			ctx.lineTo(u * .9, u * .15);
			ctx.lineTo(u * .3, u * .55);
			ctx.lineTo(0, u * .1);
			ctx.lineTo(-u * .3, u * .55);
			ctx.lineTo(-u * .9, u * .15);
			ctx.closePath();
			ctx.fill();
			ctx.stroke();
			break;
		case "lance":
			ctx.beginPath();
			ctx.moveTo(0, -u);
			ctx.lineTo(u * .55, u * .15);
			ctx.lineTo(u * .2, u * .7);
			ctx.lineTo(0, u * .25);
			ctx.lineTo(-u * .2, u * .7);
			ctx.lineTo(-u * .55, u * .15);
			ctx.closePath();
			ctx.fill();
			ctx.stroke();
			break;
		case "pit":
			round(ctx, -u * .7, -u * .15, u * 1.15, u * .7, u * .1);
			ctx.fill();
			ctx.stroke();
			round(ctx, u * .25, -u * .28, u * .7, u * .28, u * .06);
			ctx.fill();
			ctx.stroke();
			break;
		case "flak":
			ctx.beginPath();
			ctx.moveTo(0, u * .7);
			ctx.lineTo(-u * .18, -u * .15);
			ctx.lineTo(u * .18, -u * .15);
			ctx.closePath();
			ctx.fill();
			ctx.stroke();
			ctx.beginPath();
			ctx.moveTo(-u * .35, -u * .2);
			ctx.lineTo(-u * .7, -u * .85);
			ctx.moveTo(u * .35, -u * .2);
			ctx.lineTo(u * .7, -u * .85);
			ctx.stroke();
			break;
		default: {
			const glyph = ({
				spotter: "S", grenade: "G", scorch: "F", field: "N", siege: "M", sapper: "P",
				scout: "C", hunter: "H", wrecker: "W", monarch: "K", raider: "R", lancer: "L",
				lurker: "U", dread: "D", thunder: "T", eye: "E", vault: "V", ace: "A",
				tower: "Y", nest: "B", net: "X",
				breacher: "B", demo: "D", pioneer: "P", engineer: "E", atgm: "M", ambush: "A",
				dozer: "Z", spg: "G", command: "C", spear: "S", monitor: "O", battle: "B",
				asw: "S", escort: "E", cruise: "C", wolf: "W", armed: "A", radarplane: "R",
				night: "N", dogfight: "D", strategic: "S", pathfinder: "P", heavygun: "H", mlrs: "R",
				dmr: "D", sharp: "S", longshot: "L", phantom: "P", counter: "C", overwatch: "O",
				stalker: "K", materiel: "M", fifty: "F", sabot: "B",
				seeder: "S", planter: "P", carpet: "C", prowler: "R", nightlay: "N", slip: "L",
				hull: "H", breachlay: "B", siegelay: "G",
				pillbox: "P", casemate: "C", samsite: "S", point: "D",
				apex: "A", shade: "H", penetrator: "N", superheavy: "G", barrage: "B", skylance: "L",
				marshal: "M", glaive: "V", flagship: "F", citadel: "C", boomer: "O", killer: "K",
				spectre: "S", raptor: "R", arsenal: "A", seamark: "M", blanket: "B", ghost: "G", fortress: "F",
				redoubt: "R", coastgun: "G", umbrella: "U", ciws: "W",
				carrier: "V", aegis: "G", rampart: "P", marlin: "N",
				bastion: "B", harbor: "H", skyfort: "K", phalanx: "Z", mast: "I",
			})[kind] ?? "";
			ctx.beginPath();
			ctx.moveTo(0, -u * .82);
			ctx.lineTo(u * .72, 0);
			ctx.lineTo(0, u * .82);
			ctx.lineTo(-u * .72, 0);
			ctx.closePath();
			ctx.fill();
			ctx.stroke();
			if (glyph) {
				ctx.fillStyle = INK;
				ctx.font = `700 ${Math.max(10, Math.round(u * .72))}px sans-serif`;
				ctx.textAlign = "center";
				ctx.textBaseline = "middle";
				ctx.fillText(glyph, 0, u * .06);
			}
		}
	}
	ctx.restore();
}
function terrainColor(t, x, y) {
	const n = hash(x, y, 1);
	if (t === "plain") return n > .66 ? "#ead8b4" : n > .33 ? "#e0cba6" : "#d4bc96";
	if (t === "road") return "#f6edd6";
	if (t === "rubble") return n > .5 ? "#c9b394" : "#b6a182";
	if (t === "forest") return n > .5 ? "#2f6b48" : "#275c3e";
	if (t === "water") return "#2f8c9e";
	return n > .5 ? "#8a8174" : "#6f685e";
}
function drawTerrain(ctx, t, x, y, s, now, motion) {
	ctx.fillStyle = terrainColor(t, x, y);
	ctx.fillRect(x, y, s, s);
	if (t === "water") {
		ctx.fillStyle = "#2f8c9e";
		ctx.fillRect(x - 1, y - 1, s + 2, s + 2);
		const g = ctx.createLinearGradient(x, y - s, x, y + s * 2);
		g.addColorStop(0, "rgba(214,244,246,0.22)");
		g.addColorStop(1, "rgba(8,40,48,0.16)");
		ctx.fillStyle = g;
		ctx.fillRect(x - 1, y - 1, s + 2, s + 2);
		ctx.save();
		ctx.beginPath();
		ctx.rect(x - 1, y - 1, s + 2, s + 2);
		ctx.clip();
		ctx.strokeStyle = "rgba(230, 248, 248, 0.45)";
		ctx.lineWidth = 1.25;
		const drift = motion ? (now / 28) % 80 : 0;
		const spacing = Math.max(12, s * 0.34);
		const first = Math.floor((y - spacing) / spacing) * spacing;
		for (let row = first; row < y + s + spacing; row += spacing) {
			ctx.beginPath();
			ctx.moveTo(x - 4, row);
			for (let px = x - 4; px <= x + s + 4; px += 4) {
				const wave = Math.sin((px + drift) / 14) * (s * 0.045);
				ctx.lineTo(px, row + wave);
			}
			ctx.stroke();
		}
		ctx.restore();
		return;
	} else if (t === "forest") {
		ctx.fillStyle = "#163c28";
		const trees = 3;
		for (let i = 0; i < trees; i++) {
			const tx = x + s * (.2 + hash(x, y, 3 + i) * .58);
			const ty = y + s * (.34 + hash(x, y, 6 + i) * .4);
			ctx.beginPath();
			ctx.moveTo(tx, ty - s * .28);
			ctx.lineTo(tx + s * .14, ty + s * .1);
			ctx.lineTo(tx - s * .14, ty + s * .1);
			ctx.closePath();
			ctx.fill();
			ctx.fillStyle = "#3f8a58";
			ctx.beginPath();
			ctx.moveTo(tx, ty - s * .2);
			ctx.lineTo(tx + s * .08, ty - s * .02);
			ctx.lineTo(tx - s * .08, ty - s * .02);
			ctx.closePath();
			ctx.fill();
			ctx.fillStyle = "#163c28";
		}
	} else if (t === "ridge") {
		ctx.fillStyle = "rgba(255,244,220,0.16)";
		ctx.beginPath();
		ctx.moveTo(x, y);
		ctx.lineTo(x + s, y);
		ctx.lineTo(x + s * .15, y + s);
		ctx.closePath();
		ctx.fill();
		ctx.strokeStyle = "rgba(20,18,14,0.4)";
		ctx.lineWidth = Math.max(1.5, s * 0.06);
		ctx.beginPath();
		ctx.moveTo(x + s * .18, y + s * .78);
		ctx.lineTo(x + s * .42, y + s * .28);
		ctx.lineTo(x + s * .72, y + s * .6);
		ctx.stroke();
	} else if (t === "road") {
		ctx.strokeStyle = "rgba(120,90,48,0.35)";
		ctx.lineWidth = Math.max(2, s * 0.08);
		ctx.beginPath();
		ctx.moveTo(x + s / 2, y);
		ctx.lineTo(x + s / 2, y + s);
		ctx.moveTo(x, y + s / 2);
		ctx.lineTo(x + s, y + s / 2);
		ctx.stroke();
	} else if (t === "rubble") {
		ctx.fillStyle = "rgba(60,48,32,0.4)";
		ctx.fillRect(x + s * .18, y + s * .52, s * .24, s * .14);
		ctx.fillRect(x + s * .5, y + s * .26, s * .2, s * .12);
	} else {
		ctx.fillStyle = "rgba(255,248,230,0.08)";
		ctx.fillRect(x, y, s, Math.max(2, s * 0.08));
	}
	ctx.strokeStyle = "rgba(20,16,12,0.12)";
	ctx.lineWidth = 1;
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
	if (strong) {
		ctx.setLineDash([]);
		ctx.globalAlpha = .85;
		ctx.lineWidth = 2.5;
		ctx.beginPath();
		const a = (Date.now() / 420) % (Math.PI * 2);
		ctx.arc(cx, cy, rad, a, a + 0.7);
		ctx.stroke();
	}
	ctx.restore();
}
export function drawPreview(ctx, cssW, cssH, map) {
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
const slides = new Map();
function slideOf(id, x, y, now, motion) {
	let s = slides.get(id);
	if (!s) {
		s = { x, y, sx: x, sy: y, t: now };
		slides.set(id, s);
		return { x, y };
	}
	if (s.x !== x || s.y !== y) {
		s.sx = s.vx ?? s.x;
		s.sy = s.vy ?? s.y;
		s.x = x;
		s.y = y;
		s.t = now;
	}
	if (!motion) {
		s.vx = x;
		s.vy = y;
		return { x, y };
	}
	const k = Math.min(1, (now - s.t) / 180);
	const e = 1 - (1 - k) * (1 - k);
	const vx = s.sx + (x - s.sx) * e;
	const vy = s.sy + (y - s.sy) * e;
	s.vx = vx;
	s.vy = vy;
	return { x: vx, y: vy };
}
export function drawBattle(ctx, cssW, cssH, m, hover, now, reveal, motion) {
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
		const landmark = st.kind === "spire" || st.kind === "outpost";
		const full = st.owner === viewer || idd(st.x, st.y) || reveal || landmark;
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
		if (!reveal && st.owner === m.active && STRUCT_BY[st.kind].atk > 0 && !live) ctx.globalAlpha = 0.4;
		paintMark(ctx, st.kind, px + L.tile / 2, py + L.tile / 2 + 2, L.tile * .36, color);
		if (st.hp > 0) hpBar(ctx, px, py, L.tile, st.hp, st.max && st.max > 0 ? st.max : Math.max(STRUCT_BY[st.kind].hp, st.hp), color);
		ctx.restore();
		buildLeft(ctx, px, py, L.tile, st.eta ?? 0);
		if (!reveal && live) actRing(ctx, px, py, L.tile, now);
		if (m.selection?.kind === "struct" && m.selection.id === st.id) brackets(ctx, px, py, L.tile, PAPER, 2);
	}
	const alive = new Set();
	for (const u of m.units) {
		alive.add(u.id);
		const pos = slideOf(u.id, u.x, u.y, now, motion);
		const px = L.ox + pos.x * L.tile;
		const py = L.oy + pos.y * L.tile;
		if (!(u.owner === viewer || idd(u.x, u.y) || reveal)) {
			if (rad(u.x, u.y) && u.owner !== viewer) blip(ctx, px, py, L.tile, UNIT_BY[u.kind].domain, now, motion);
			continue;
		}
		const color = fac(u.owner);
		const live = canActUnit(m, u);
		const air = UNIT_BY[u.kind].domain === "air";
		const bob = motion && air ? Math.sin(now / 240 + u.x) * 2 : 0;
		const spin = motion && (u.kind === "rotor" || u.kind === "tender") ? now / 160 : 0;
		ctx.save();
		if (!reveal && u.owner === m.active && !live) ctx.globalAlpha = 0.4;
		paintMark(ctx, u.kind, px + L.tile / 2, py + L.tile / 2 + 3 - bob, L.tile * .34, color, spin);
		hpBar(ctx, px, py, L.tile, u.hp, UNIT_BY[u.kind].hp + (u.plus?.hp || 0), color);
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
	for (const id of slides.keys()) if (!alive.has(id)) slides.delete(id);
	for (const c of m.contacts?.[viewer] ?? []) {
		const unit = m.units.find((u) => u.id === c.id);
		const st = m.structs.find((s) => s.id === c.id && s.hp > 0);
		const piece = unit ?? st;
		if (!!piece && piece.x === c.x && piece.y === c.y && (idd(c.x, c.y) || rad(c.x, c.y))) continue;
		const px = L.ox + c.x * L.tile;
		const py = L.oy + c.y * L.tile;
		ctx.save();
		ctx.globalAlpha = .72;
		if (c.kind) paintMark(ctx, c.kind, px + L.tile / 2, py + L.tile / 2 + 2, L.tile * .32, "#e2b15a");
		else blip(ctx, px, py, L.tile, c.domain, now, false);
		ctx.globalAlpha = .95;
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
