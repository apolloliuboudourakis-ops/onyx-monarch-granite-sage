import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ButtonHTMLAttributes, type PointerEvent } from "react";
import { BookOpen, Volume2, VolumeX } from "lucide-react";
import { cue, loadMuted, play, setMuted } from "@/game/audio";
import { BASIC_KIT, BUY_ORDER, FACTIONS, STRUCT_BY, UNIT_BY, UNITS, hitBand, isDiscovered, isUnitKind, type StructDef, type UnitDef } from "@/game/catalog";
import { BRASS, MAP_TILE, NEREID, VESPER, drawBattle, drawPreview, layoutOf, paintMark } from "@/game/draw";
import {
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
  persistRoot,
  publicSummary,
  repairReady,
  restockOffer,
  selectionOverlay,
  sellOffer,
  structAt,
  terrainName,
  unitAt,
} from "@/game/logic";
import { MAPS, MAP_BY } from "@/game/maps";
import type { BuyId, Cmd, Match, PlayerId, RootState } from "@/game/types";
import { Manual } from "@/components/ashveil/Manual";
import { FriendsPage, LobbyPage, LoginPage, Nameplate, RankPage, ResearchPage, SearchPage, TurnClock, WaitingPage, AdminPage } from "@/components/ashveil/Online";
import { StaffPanel } from "@/components/ashveil/StaffPanel";
import { accountKeep, accountLogout, accountMe, accountScore, friendAnswer, friendList, roomCancel, roomHost, roomJoin, roomLeave, roomPlay, roomQueue, roomSay, roomSync } from "@/game/online.functions";
import { dropStore, mergeIds, readStore, writeStore, type FriendRow, type PublicUser } from "@/game/online";
import type { RoomOk } from "@/game/online.functions";

declare global {
  interface Window {
    __ashveil?: Record<string, string | number | boolean | null>;
  }
}

function statRows(rows: [string, string][]) {
  return (
    <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-0.5">
      {rows.map(([k, v]) => (
        <div key={k} className="flex items-baseline justify-between gap-3 text-sm">
          <dt className="text-muted">{k}</dt>
          <dd className="tabular-nums">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

function unitSheet(def: UnitDef, hp?: number, left?: number, max?: number, plus?: { atk: number; move: number; hp: number }) {
  const range = def.minRange === def.maxRange ? String(def.maxRange) : `${def.minRange}–${def.maxRange}`;
  const build = def.build ? `${def.build} ${def.build === 1 ? "turn" : "turns"}` : "Now";
  const cap = max ?? def.hp;
  return {
    title: def.name,
    blurb: def.blurb,
    rows: [
      ["HP", hp != null ? `${hp} / ${cap}` : String(cap)],
      ["Cost", String(def.cost)],
      ["Build", build],
      ["Build left", left == null ? build : left > 0 ? `${left} ${left === 1 ? "turn" : "turns"}` : "Ready"],
      ["Move", String(def.move + (plus?.move || 0))],
      ["Range", range],
      ["Vision", String(def.vision)],
      ["Radar", String(def.radar ?? 0)],
      ["Attack", String(def.atk + (plus?.atk || 0))],
      ["Shots", String(def.shots ?? 1)],
      ["Hit", def.atk > 0 && def.maxRange > 0 ? hitBand(def.id, def.minRange, def.maxRange) : "—"],
      ["Armor", def.armor === "light" ? "Infantry" : def.armor === "armor" ? "Armor" : "Air"],
      ["Moves on", def.domain],
      ["Mines", def.mines ? String(def.mines) : "—"],
      ["Vs troops", `${def.vs.light}×`],
      ["Vs armor", `${def.vs.armor}×`],
      ["Vs air", `${def.vs.air}×`],
      ["Vs buildings", `${def.vs.structure}×`],
    ] as [string, string][],
  };
}

function structSheet(def: StructDef, hp?: number, left?: number, max?: number) {
  const range = def.atk > 0 ? (def.minRange === def.maxRange ? String(def.maxRange) : `${def.minRange}–${def.maxRange}`) : "—";
  const build = !def.cost ? "—" : def.build ? `${def.build} ${def.build === 1 ? "turn" : "turns"}` : "Now";
  const cap = max ?? def.hp;
  return {
    title: def.name,
    blurb: def.blurb,
    rows: [
      ["HP", hp != null ? `${hp} / ${cap}` : String(cap)],
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
      ["Vs buildings", `${def.vs.structure}×`],
    ] as [string, string][],
  };
}

function cardFacts(item: BuyId): string[] {
  if (isUnitKind(item)) {
    const d = UNIT_BY[item];
    const range = d.minRange === d.maxRange ? String(d.maxRange) : `${d.minRange}–${d.maxRange}`;
    return [
      `Cost ${d.cost} · HP ${d.hp} · Move ${d.move}`,
      `Range ${range} · Atk ${d.atk}`,
      `Shots ${d.shots ?? 1} · Hit ${d.atk > 0 && d.maxRange > 0 ? hitBand(d.id, d.minRange, d.maxRange) : "—"}`,
      `Radar ${d.radar ?? 0} · ${d.armor === "light" ? "Infantry" : d.armor === "armor" ? "Armor" : "Air"}`,
      d.domain === "sea" ? "Sails on water" : d.domain === "air" ? (d.water === false ? "Cannot cross water" : "Flies over water") : d.water ? "Can cross water" : "Land only",
    ];
  }
  const d = STRUCT_BY[item];
  const range = d.atk > 0 ? (d.minRange === d.maxRange ? String(d.maxRange) : `${d.minRange}–${d.maxRange}`) : "—";
  return [
    `Cost ${d.cost} · HP ${d.hp} · Radar ${d.radar}`,
    `Range ${range} · Atk ${d.atk || "—"}`,
    `Shots ${d.atk ? d.shots ?? 1 : "—"} · Hit ${d.atk > 0 ? hitBand(d.id, d.minRange, d.maxRange) : "—"}`,
    d.income ? `Income +${d.income}` : "No income",
  ];
}

function Btn({
  tone = "ghost",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { tone?: "brass" | "ghost" | "ink" }) {
  const look =
    tone === "brass"
      ? "bg-brass text-brass-ink"
      : tone === "ink"
        ? "bg-pass-ink text-pass"
        : "border border-line bg-surface-2 text-fg";
  return (
    <button
      {...props}
      type={props.type ?? "button"}
      className={`min-h-11 rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-40 ${look} ${className}`}
    />
  );
}

function Mark({ kind, owner }: { kind: string; owner: PlayerId | null }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, 64, 64);
    const fill = owner === 0 ? VESPER : owner === 1 ? NEREID : BRASS;
    paintMark(ctx, kind, 32, 34, 22, fill);
  }, [kind, owner]);
  return <canvas ref={ref} width={64} height={64} className="h-10 w-10 shrink-0" aria-hidden />;
}

function MapThumb({ id }: { id: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
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
  return <canvas ref={ref} className="h-28 w-full rounded-md bg-bg" aria-hidden />;
}

function MapLook({ id }: { id: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    const map = MAP_BY[id];
    if (!canvas || !map) return;
    const cols = map.rows[0]!.length;
    const rows = map.rows.length;
    const tile = 36;
    const w = cols * tile + 16;
    const h = rows * tile + 16;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawPreview(ctx, w, h, map);
  }, [id]);
  return <canvas ref={ref} className="bg-bg" aria-label="Map look over" />;
}

const keptScroll = { left: 0, top: 0, fresh: true, x: -1, y: -1, seat: -1, turn: 0 };
const seatGaze: [{ left: number; top: number; seen: boolean }, { left: number; top: number; seen: boolean }] = [
  { left: 0, top: 0, seen: false },
  { left: 0, top: 0, seen: false },
];

function Field({
  match,
  reveal,
  motion,
  onTile,
  onHover,
  onLook,
}: {
  match: Match;
  reveal: boolean;
  motion: boolean;
  onTile: (x: number, y: number) => void;
  onHover: (t: { x: number; y: number } | null) => void;
  onLook: (x: number, y: number) => void;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const buffer = useRef<HTMLCanvasElement | null>(null);
  const matchRef = useRef(match);
  const hoverRef = useRef<{ x: number; y: number } | null>(null);
  const paintRef = useRef<() => void>(() => {});
  const drag = useRef<{ x: number; y: number; left: number; top: number; moved: boolean } | null>(null);
  const pendingLook = useRef<{ x: number; y: number } | null>(null);
  const [frame, setFrame] = useState({ left: 0, top: 0, w: 0, h: 0 });
  matchRef.current = match;
  const cols = match.terrain[0]!.length;
  const rows = match.terrain.length;
  const mapW = cols * MAP_TILE + 16;
  const mapH = rows * MAP_TILE + 16;
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
      bctx.imageSmoothingEnabled = true;
      bctx.imageSmoothingQuality = "high";
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
  useLayoutEffect(() => {
    paintRef.current();
  }, [match.active, match.turn, match.phase, reveal]);
  useLayoutEffect(() => {
    const shell = scroller.current;
    const canvas = ref.current;
    if (!shell || !canvas) return;
    const seat = match.active === 1 ? 1 : 0;
    const look = pendingLook.current;
    pendingLook.current = null;
    const centerOn = (x: number, y: number) => {
      const L = layoutOf(canvas.clientWidth || mapW, canvas.clientHeight || mapH, cols, rows);
      shell.scrollLeft = Math.max(0, L.ox + x * L.tile + L.tile / 2 - shell.clientWidth / 2);
      shell.scrollTop = Math.max(0, L.oy + y * L.tile + L.tile / 2 - shell.clientHeight / 2);
    };
    const newMatch = keptScroll.fresh || match.turn < keptScroll.turn;
    if (newMatch) {
      seatGaze[0].seen = false;
      seatGaze[1].seen = false;
      const hq = match.structs.find((s) => s.kind === "spire" && s.owner === seat);
      if (hq) centerOn(hq.x, hq.y);
      keptScroll.fresh = false;
    } else if (look) {
      centerOn(look.x, look.y);
    } else if (match.turn !== keptScroll.turn || seat !== keptScroll.seat) {
      if (seatGaze[seat].seen) {
        shell.scrollLeft = seatGaze[seat].left;
        shell.scrollTop = seatGaze[seat].top;
      }
    } else {
      return;
    }
    keptScroll.turn = match.turn;
    keptScroll.seat = seat;
    keptScroll.left = shell.scrollLeft;
    keptScroll.top = shell.scrollTop;
    seatGaze[seat].left = shell.scrollLeft;
    seatGaze[seat].top = shell.scrollTop;
    seatGaze[seat].seen = true;
  }, [match.active, match.turn, match.cursor.x, match.cursor.y, cols, rows, mapW, mapH]);

  useEffect(() => {
    const shell = scroller.current;
    if (!shell) return;
    const read = () => {
      setFrame({
        left: shell.scrollLeft,
        top: shell.scrollTop,
        w: shell.clientWidth,
        h: shell.clientHeight,
      });
      keptScroll.left = shell.scrollLeft;
      keptScroll.top = shell.scrollTop;
      if (keptScroll.seat === 0 || keptScroll.seat === 1) {
        seatGaze[keptScroll.seat].left = shell.scrollLeft;
        seatGaze[keptScroll.seat].top = shell.scrollTop;
        seatGaze[keptScroll.seat].seen = true;
      }
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

  useEffect(() => {
    let raf = 0;
    const loop = () => {
      paintRef.current();
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  const pick = (e: PointerEvent<HTMLDivElement>) => {
    const canvas = ref.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const L = layoutOf(canvas.clientWidth, canvas.clientHeight, cols, rows);
    const x = Math.floor((e.clientX - rect.left - L.ox) / L.tile);
    const y = Math.floor((e.clientY - rect.top - L.oy) / L.tile);
    if (x < 0 || y < 0 || x >= cols || y >= rows) return null;
    return { x, y };
  };

  const L = layoutOf(mapW, mapH, cols, rows);
  const offscreen = match.units
    .filter((u) => u.owner === match.active)
    .map((u) => {
      if (frame.w < 8 || frame.h < 8) return null;
      const cx = L.ox + u.x * L.tile + L.tile / 2;
      const cy = L.oy + u.y * L.tile + L.tile / 2;
      const pad = 20;
      if (
        frame.w > 0 &&
        cx >= frame.left + pad &&
        cx <= frame.left + frame.w - pad &&
        cy >= frame.top + pad &&
        cy <= frame.top + frame.h - pad
      ) {
        return null;
      }
      const left = Math.min(Math.max(cx - frame.left, 18), Math.max(18, frame.w - 18));
      const top = Math.min(Math.max(cy - frame.top, 18), Math.max(18, frame.h - 18));
      return { id: u.id, name: UNIT_BY[u.kind].name, x: u.x, y: u.y, left, top };
    })
    .filter((m) => m !== null);

  return (
    <div className="absolute inset-0">
    <div
      ref={scroller}
      data-testid="map-scroll"
      className="absolute inset-0 touch-none overflow-auto overscroll-contain"
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        drag.current = {
          x: e.clientX,
          y: e.clientY,
          left: scroller.current?.scrollLeft ?? 0,
          top: scroller.current?.scrollTop ?? 0,
          moved: false,
        };
        e.currentTarget.setPointerCapture(e.pointerId);
      }}
      onPointerMove={(e) => {
        const pan = drag.current;
        if (pan) {
          const dx = e.clientX - pan.x;
          const dy = e.clientY - pan.y;
          if (!pan.moved && Math.hypot(dx, dy) > 14) pan.moved = true;
          if (pan.moved && scroller.current) {
            scroller.current.scrollLeft = pan.left - dx;
            scroller.current.scrollTop = pan.top - dy;
            return;
          }
        }
        if (e.pointerType === "touch") return;
        const t = pick(e);
        const prev = hoverRef.current;
        const same = (!t && !prev) || (!!t && !!prev && t.x === prev.x && t.y === prev.y);
        hoverRef.current = t;
        if (same) return;
        onHover(t);
      }}
      onPointerUp={(e) => {
        const pan = drag.current;
        drag.current = null;
        if (pan?.moved) return;
        const t = pick(e);
        if (t) onTile(t.x, t.y);
      }}
      onPointerCancel={() => {
        drag.current = null;
      }}
      onPointerLeave={() => {
        hoverRef.current = null;
        onHover(null);
      }}
    >
      <canvas
        ref={ref}
        data-testid="map-canvas"
        aria-label="Strategic War battle map"
        className="block bg-[#c4b48a]"
        style={{ width: mapW, height: mapH }}
      />
    </div>
    {offscreen.map((piece) => (
      <button
        key={piece.id}
        type="button"
        className="absolute z-10 -translate-x-1/2 -translate-y-1/2 rounded-full border border-brass bg-bg/90 px-2 py-1 text-[11px] font-medium text-fg"
        style={{ left: piece.left, top: piece.top }}
        onClick={() => {
          pendingLook.current = { x: piece.x, y: piece.y };
          onLook(piece.x, piece.y);
        }}
      >
        {piece.name}
      </button>
    ))}
    </div>
  );
}

const LOGIN_EPOCH = "6";
let forceSignOut = false;
try {
  if (typeof window !== "undefined" && readStore("local", "ashveil.loginEpoch") !== LOGIN_EPOCH) {
    writeStore("local", "ashveil.loginEpoch", LOGIN_EPOCH);
    dropStore("local", "ashveil.token");
    dropStore("session", "ashveil.room");
    forceSignOut = true;
  }
} catch {
  forceSignOut = false;
}

function keepAccount(prev: (PublicUser & { token: string }) | null, user: PublicUser, token: string) {
  if (!prev) return { ...user, token };
  return {
    ...user,
    token,
    unlocked: mergeIds(prev.unlocked, user.unlocked),
    mods: mergeIds(prev.mods, user.mods),
    rev: Math.max(user.rev ?? 0, prev.rev ?? 0),
  };
}

export function AshveilApp() {
  const [state, setState] = useState<RootState>(emptyRoot);
  const [mapId, setMapId] = useState(MAPS[0]!.id);
  const [lookMap, setLookMap] = useState<string | null>(null);
  const [botLevel, setBotLevel] = useState<number | null>(null);
  const [hqHp, setHqHp] = useState(22);
  const [onlineHp, setOnlineHp] = useState(40);
  const [mode, setMode] = useState<"strike" | "capture" | "raze">("strike");
  const [account, setAccount] = useState<(PublicUser & { token: string }) | null>(null);
  const [room, setRoom] = useState<RoomOk | null>(null);
  const [page, setPage] = useState<"field" | "login" | "friends" | "rank" | "research" | "settings" | "admin">("field");
  const [joinCode, setJoinCode] = useState("");
  const [note, setNote] = useState("");
  const [staffOpen, setStaffOpen] = useState(false);
  const [favs, setFavs] = useState<string[]>(() => {
    try {
      const raw = JSON.parse(readStore("local", "ashveil.favs") || "[]") as unknown;
      return Array.isArray(raw) ? raw.filter((id) => typeof id === "string") : [];
    } catch {
      return [];
    }
  });
  const [roster, setRoster] = useState<string[]>([]);
  const [ping, setPing] = useState<{ incoming: FriendRow[]; invites: { code: string; from: string }[] }>({
    incoming: [],
    invites: [],
  });
  const netRef = useRef<{ token: string; code: string; seat: 0 | 1; version: number } | null>(null);
  useEffect(() => {
    writeStore("local", "ashveil.favs", JSON.stringify(favs));
  }, [favs]);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const tag = (event.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (event.key === "Escape") setStaffOpen(false);
      if (event.key === "`" && account?.role) setStaffOpen((open) => !open);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [account?.role]);
  const roomEpoch = useRef(0);
  const stateRef = useRef(state);
  stateRef.current = state;
  const [muted, setMute] = useState(false);
  const [hover, setHover] = useState<{ x: number; y: number } | null>(null);
  const [motion, setMotion] = useState(true);

  if (forceSignOut) {
    forceSignOut = false;
    setAccount(null);
    setRoom(null);
    setPage("field");
    setState((prev) => ({ ...prev, screen: "title", help: false, match: null }));
  }

  const forgetAccount = useCallback(() => {
    roomEpoch.current += 1;
    dropStore("local", "ashveil.token");
    dropStore("session", "ashveil.room");
    netRef.current = null;
    setAccount(null);
    setRoom(null);
    setPage("field");
    setPing({ incoming: [], invites: [] });
    setState((prev) => ({ ...prev, screen: "title", help: false, match: null }));
  }, []);

  const dispatch = useCallback((cmd: Cmd) => {
    const net = netRef.current;
    const epoch = roomEpoch.current;
    const local = cmd.type === "cursor" || cmd.type === "title" || cmd.type === "manual" || cmd.type === "help" || cmd.type === "review" || cmd.type === "continue" || cmd.type === "discard-save" || cmd.type === "note-save";
    if (net && !local) {
      void roomPlay({ data: { token: net.token, code: net.code, version: net.version, cmd } }).then((res) => {
        if (epoch !== roomEpoch.current) return;
        if (!res.ok) {
          if (res.error === "Sign in again.") forgetAccount();
          else setNote(res.error);
          return;
        }
        netRef.current = { token: net.token, code: res.code, seat: res.seat, version: res.version };
        setRoom(res);
        if (res.state) {
          try {
            cue(cmd.type, stateRef.current, res.state);
          } catch (err) {
            console.error(err);
          }
          setState(res.state);
        }
      }).catch(() => {
        setNote("Could not reach the match. Refresh the page.");
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
        if (cmd.type !== "cursor" && !netRef.current) {
          try {
            persistRoot(next);
          } catch (err) {
            console.error(err);
          }
        }
      }
      return next;
    });
  }, []);

  const onExpire = useCallback(() => {
    const net = netRef.current;
    if (!net) return;
    void roomSync({ data: { token: net.token, code: net.code } }).then((res) => {
      if (!res.ok) return;
      setRoom(res);
      if (res.state) setState(res.state);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    const saved = loadRoot();
    setState((s) => ({ ...s, hasSave: !!saved?.match }));
    setMute(loadMuted());
    const token = readStore("local", "ashveil.token");
    if (token) {
      void accountMe({ data: { token } })
        .then((res) => {
          if (readStore("local", "ashveil.token") !== token) return;
          if (res.ok) {
            const stored = readStore("local", `ashveil.unlocked.${res.user.id}`) || "";
            setAccount({ ...res.user, token, unlocked: mergeIds(res.user.unlocked, stored) });
            const code = readStore("session", "ashveil.room");
            if (code) {
              void roomSync({ data: { token, code } }).then((roomRes) => {
                if (readStore("local", "ashveil.token") !== token) return;
                if (!roomRes.ok) {
                  dropStore("session", "ashveil.room");
                  return;
                }
                setRoom(roomRes);
                if (roomRes.state) setState(roomRes.state);
              }).catch(() => dropStore("session", "ashveil.room"));
            }
          } else if (res.error === "Sign in again.") {
            dropStore("local", "ashveil.token");
            dropStore("session", "ashveil.room");
          }
        })
        .catch(() => {
          /* keep the saved login if the server was briefly down */
        });
    }
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setMotion(!mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (!account?.token) return;
    const token = account.token;
    let stop = false;
    let busy = false;
    const tick = async () => {
      if (stop || busy) return;
      busy = true;
      try {
        const res = await friendList({ data: { token } });
        if (stop) return;
        if (res.ok) {
          setPing({ incoming: res.incoming, invites: res.invites });
          setRoster(res.names?.length ? res.names : res.players.map((row) => row.username));
        } else if (res.error === "Sign in again.") forgetAccount();
      } catch {
        /* the next tick tries again */
      } finally {
        busy = false;
      }
    };
    void tick();
    const id = window.setInterval(() => void tick(), 2000);
    return () => {
      stop = true;
      window.clearInterval(id);
    };
  }, [account?.token, room, forgetAccount]);

  const keptUnlock = useRef("");
  useEffect(() => {
    if (!account?.token || !account.id) return;
    const key = `ashveil.unlocked.${account.id}`;
    const stored = readStore("local", key) || "";
    const merged = mergeIds(account.unlocked, stored);
    if (merged !== (account.unlocked || "")) {
      writeStore("local", key, merged);
      setAccount((prev) => (prev && prev.id === account.id ? { ...prev, unlocked: merged } : prev));
      return;
    }
    writeStore("local", key, merged);
    const mark = `${account.id}:${merged}`;
    if (!merged || keptUnlock.current === mark) return;
    void accountKeep({ data: { token: account.token, unlocked: merged } }).then((res) => {
      if (!res.ok) return;
      keptUnlock.current = mark;
      setAccount((prev) => (prev && prev.id === account.id ? keepAccount(prev, res.user, prev.token) : prev));
    });
  }, [account?.id, account?.unlocked, account?.token]);

  useEffect(() => {
    if (!account) return;
    const token = account.token;
    let stop = false;
    let timer = 0;
    let lastBeat = 0;
    const beat = () => {
      const now = Date.now();
      if (now - lastBeat < 5000) return;
      lastBeat = now;
      void accountMe({ data: { token } }).then((res) => {
        if (stop) return;
        if (!res.ok) {
          if (res.error === "Sign in again.") forgetAccount();
          return;
        }
        setAccount((prev) => {
          if (!prev || prev.token !== token) return prev;
          const next = res.user;
          const nextRev = next.rev ?? 0;
          const prevRev = prev.rev ?? 0;
          const statsMoved =
            prev.coins !== next.coins ||
            prev.rp !== next.rp ||
            prev.rating !== next.rating ||
            prev.wins !== next.wins ||
            prev.losses !== next.losses ||
            prev.rank !== next.rank;
          if (nextRev < prevRev && !statsMoved) return prev;
          if (
            !statsMoved &&
            prev.unlocked === next.unlocked &&
            prev.mods === next.mods &&
            prev.focus === next.focus &&
            prev.focusRp === next.focusRp &&
            prev.lastFocus === next.lastFocus &&
            prev.streak === next.streak
          ) {
            return prev;
          }
          return keepAccount(prev, next, token);
        });
      }).catch(() => {});
    };
    const arm = () => {
      window.clearTimeout(timer);
      if (stop) return;
      timer = window.setTimeout(arm, document.visibilityState === "visible" ? 4000 : 15000);
      beat();
    };
    const wake = () => {
      if (document.visibilityState === "hidden") return;
      beat();
    };
    document.addEventListener("visibilitychange", wake);
    window.addEventListener("focus", wake);
    window.addEventListener("pageshow", wake);
    window.addEventListener("pointerdown", wake);
    arm();
    return () => {
      stop = true;
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", wake);
      window.removeEventListener("focus", wake);
      window.removeEventListener("pageshow", wake);
      window.removeEventListener("pointerdown", wake);
    };
  }, [account?.token, forgetAccount]);

  useEffect(() => {
    if (room) writeStore("session", "ashveil.room", room.code);
  }, [room]);

  useEffect(() => {
    if (account && room && (room.status === "active" || room.status === "done")) {
      netRef.current = { token: account.token, code: room.code, seat: room.seat, version: room.version };
    } else if (!room || room.status === "open" || room.status === "queue") netRef.current = null;
  }, [account, room]);

  useEffect(() => {
    if (!account || !room) return;
    const watching = room.status === "active" && state.match?.active === room.seat && !state.match?.winner;
    const pull = () => {
      const epoch = roomEpoch.current;
      void roomSync({ data: { token: account.token, code: room.code } }).then((res) => {
        if (epoch !== roomEpoch.current) return;
        if (!res.ok) {
          if (res.error === "Sign in again.") forgetAccount();
          return;
        }
        if (res.version === room.version && res.status === room.status && JSON.stringify(res.talk ?? []) === JSON.stringify(room.talk ?? []) && !res.state?.match?.winner) return;
        const decided = res.status === "done" || !!res.state?.match?.winner;
        if (watching && !decided && res.version === room.version) {
          setRoom((prev) => (prev ? { ...prev, talk: res.talk ?? [] } : prev));
          return;
        }
        if (watching && !decided) return;
        setRoom(res);
        if (res.state) {
          setState((prev) =>
            prev.screen === "review" && res.state?.match?.winner ? { ...res.state, screen: "review" } : res.state!,
          );
        }
      }).catch(() => {});
    };
    pull();
    const id = window.setInterval(pull, watching ? 2000 : 1000);
    return () => window.clearInterval(id);
  }, [account?.token, room?.code, room?.status, room?.version, JSON.stringify(room?.talk ?? []), state.match?.active, state.match?.winner, forgetAccount]);

  useEffect(() => {
    if (!account || room?.status !== "queue") return;
    let stop = false;
    const tick = () => {
      const epoch = roomEpoch.current;
      void roomQueue({ data: { token: account.token, mapId: room.mapId, hqHp: onlineHp, code: room.code } }).then((res) => {
        if (epoch !== roomEpoch.current || stop || !res.ok) {
          if (res && !res.ok) setNote(res.error);
          return;
        }
        if (res.code === room.code && res.status === "queue") return;
        setRoom(res);
        if (res.state) setState(res.state);
      }).catch(() => {
        setNote("Could not reach the match. Refresh the page.");
      });
    };
    void tick();
    const id = window.setInterval(tick, 2000);
    return () => {
      stop = true;
      window.clearInterval(id);
    };
  }, [account, room?.code, room?.status, room?.mapId]);

  useEffect(() => {
    window.__ashveil = publicSummary(state);
  }, [state]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (state.help && e.code === "Escape") {
        e.preventDefault();
        dispatch({ type: "help" });
        return;
      }
      if (state.screen === "handoff" && (e.code === "Space" || e.code === "Enter")) {
        e.preventDefault();
        dispatch({ type: "ready", now: Date.now() });
        return;
      }
      const m = state.match;
      if (netRef.current && m && m.active !== netRef.current.seat) return;
      if (!m || state.screen !== "battle" || state.help || m.confirmEnd || m.salvo || m.winner) return;
      const moveCursor = (dx: number, dy: number) => {
        e.preventDefault();
        dispatch({
          type: "cursor",
          x: Math.max(0, Math.min(m.terrain[0]!.length - 1, m.cursor.x + dx)),
          y: Math.max(0, Math.min(m.terrain.length - 1, m.cursor.y + dy)),
        });
      };
      if (e.code === "ArrowUp" || e.code === "KeyW") return moveCursor(0, -1);
      if (e.code === "ArrowDown" || e.code === "KeyS") return moveCursor(0, 1);
      if (e.code === "ArrowLeft" || e.code === "KeyA") return moveCursor(-1, 0);
      if (e.code === "ArrowRight" || e.code === "KeyD") return moveCursor(1, 0);
      if (e.code === "Enter" || e.code === "Space") {
        e.preventDefault();
        dispatch({ type: "click", x: m.cursor.x, y: m.cursor.y });
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
        const cur = sel?.kind === "unit" ? list.findIndex((u) => u.id === sel.id) : -1;
        const n = list[(cur + 1) % list.length]!;
        dispatch({ type: "select", id: n.id });
        return;
      }
      if (m.phase === "deploy" && e.code.startsWith("Digit")) {
        const n = Number(e.code.slice(5));
        const units = BUY_ORDER.filter((id) => isUnitKind(id));
        const works = BUY_ORDER.filter((id) => !isUnitKind(id));
        const item = e.shiftKey ? (n >= 1 ? works[n - 1] : undefined) : units[n === 0 ? 9 : n - 1];
        if (!item) return;
        e.preventDefault();
        dispatch({ type: "buy", item });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [state, dispatch]);

  const leaveOnline = () => {
    roomEpoch.current += 1;
    if (account && room && room.status === "active" && !stateRef.current.match?.winner) {
      void roomLeave({ data: { token: account.token, code: room.code } });
    } else if (account && room && (room.status === "open" || room.status === "queue")) {
      void roomCancel({ data: { token: account.token, code: room.code } });
    }
    netRef.current = null;
    dropStore("session", "ashveil.room");
    setRoom(null);
    setPage("field");
    setState((prev) => ({ ...prev, screen: "title", help: false, match: null }));
    if (account) {
      void accountMe({ data: { token: account.token } }).then((res) => {
        if (res.ok) setAccount((prev) => keepAccount(prev, res.user, prev?.token || account.token));
      }).catch(() => {});
    }
  };

  const toggleMute = () => {
    const next = !muted;
    setMute(next);
    setMuted(next);
    if (!next) play("ui");
  };

  const scored = useRef("");
  useEffect(() => {
    if (!account || room || state.screen !== "victory" || !state.match?.winner || !state.match.bot) return;
    const key = `${state.match.mapId}:${state.match.turn}:${state.match.winner.player}`;
    if (scored.current === key) return;
    scored.current = key;
    const hq = state.match.structs.find((s) => s.kind === "spire");
    const hqHp = state.match.mode === "strike" ? hq?.max || hq?.hp || 22 : 22;
    void accountScore({ data: { token: account.token, won: state.match.winner.player === 0, bot: state.match.bot, hqHp, turn: state.match.turn } }).then((res) => {
      if (res.ok) setAccount((prev) => keepAccount(prev, res.user, prev?.token || account.token));
    });
  }, [account, room, state.screen, state.match]);

  if (state.help || state.screen === "manual") {
    return <Manual onBack={() => dispatch(state.help ? { type: "help" } : { type: "title" })} />;
  }

  if ((state.screen === "victory" || state.screen === "review") && state.match?.winner) {
    if (state.screen === "review") {
      return (
        <Battle
          state={state}
          muted={muted}
          motion={motion}
          hover={hover}
          reveal
          deadline={null}
          onHome={leaveOnline}
          onExpire={() => {}}
          onHover={setHover}
          onMute={toggleMute}
          dispatch={dispatch}
          discovered={account ? account.unlocked ?? "" : null}
          favs={favs}
          coins={account?.coins ?? null}
          talk={room?.talk ?? []}
          onSay={
            account && room && (room.status === "active" || room.status === "done")
              ? (text) => {
                  void roomSay({ data: { token: account.token, code: room.code, text } }).then((res) => {
                    if (!res.ok) setNote(res.error);
                    else setRoom((prev) => (prev && prev.code === room.code ? { ...prev, talk: res.talk } : prev));
                  });
                }
              : undefined
          }
        />
      );
    }
    const w = state.match.winner;
    return (
      <main className="flex h-dvh flex-col items-center justify-center gap-5 bg-bg px-6 text-center text-fg">
        <p className="text-xs tracking-widest text-brass uppercase">The field is decided</p>
        <h1 className="font-display text-5xl">{FACTIONS[w.player].name} wins</h1>
        <p className="max-w-md text-muted">{w.reason}</p>
        <div className="flex flex-wrap justify-center gap-2">
          <Btn tone="brass" onClick={() => dispatch({ type: "review" })}>
            Review the field
          </Btn>
          <Btn
            onClick={leaveOnline}
          >
            Home
          </Btn>
        </div>
      </main>
    );
  }

  const enterRoom = (res: RoomOk) => {
    setRoom(res);
    setPage("field");
    if (res.state) setState(res.state);
    setPing((prev) => ({ ...prev, invites: prev.invites.filter((row) => row.code !== res.code) }));
  };

  const friendBar =
    account && !room && (ping.incoming.length > 0 || ping.invites.length > 0) ? (
      <div className="fixed inset-x-0 top-0 z-[60] flex flex-col gap-1 border-b border-line bg-bg/95 px-3 py-2">
        {ping.incoming.map((row) => (
          <div key={row.id} className="flex items-center justify-between gap-2">
            <Nameplate name={row.username} rating={row.rating} operator={row.operator} dev={row.dev} detail="Friend request" />
            <span className="flex gap-2">
              <Btn
                tone="brass"
                onClick={() => {
                  setPing((prev) => ({ ...prev, incoming: prev.incoming.filter((item) => item.id !== row.id) }));
                  void friendAnswer({ data: { token: account.token, username: row.username, accept: true } }).then((res) => {
                    if (!res.ok) setNote(res.error);
                  });
                }}
              >
                Accept
              </Btn>
              <Btn
                onClick={() => {
                  setPing((prev) => ({ ...prev, incoming: prev.incoming.filter((item) => item.id !== row.id) }));
                  void friendAnswer({ data: { token: account.token, username: row.username, accept: false } });
                }}
              >
                Decline
              </Btn>
            </span>
          </div>
        ))}
        {ping.invites.map((row) => (
          <div key={row.code} className="flex items-center justify-between gap-2">
            <span className="text-sm">
              {row.from} invited you. Code <span className="font-display text-xl">{row.code}</span>
            </span>
            <Btn
              tone="brass"
              onClick={() =>
                void roomJoin({ data: { token: account.token, code: row.code } }).then((res) => {
                  if (!res.ok) setNote(res.error);
                  else enterRoom(res);
                })
              }
            >
              Join
            </Btn>
          </div>
        ))}
      </div>
    ) : null;

  const staffDock = account?.role ? (
    <StaffPanel open={staffOpen} token={account.token} role={account.role} roomCode={room?.code ?? ""} onClose={() => setStaffOpen(false)} />
  ) : null;

  if (page === "login") {
    return (
      <LoginPage
        onBack={() => setPage("field")}
        onDone={(token, user) => {
          writeStore("local", "ashveil.token", token);
          setAccount({ ...user, token });
          setPage("field");
        }}
      />
    );
  }
  if (page === "friends" && account) {
    return (
      <>
      <FriendsPage
        token={account.token}
        username={account.username}
        mapId={mapId}
        mode={mode}
        hqHp={onlineHp}
        staff={account.operator || account.dev || account.username.toLowerCase() === "apollo"}
        purse={account.coins}
        profile={account}
        onPurse={(coins) => setAccount((prev) => (prev ? { ...prev, coins } : prev))}
        onUser={(user) => setAccount((prev) => keepAccount(prev, user, account.token))}
        onBack={() => setPage("field")}
        onRoom={(next) => enterRoom(next)}
      />
      {staffDock}
      </>
    );
  }
  if (page === "rank" && account) return <RankPage token={account.token} onBack={() => setPage("field")} />;
  if (page === "admin" && account && (account.operator || account.dev || account.username.toLowerCase() === "apollo")) {
    return <AdminPage token={account.token} onBack={() => setPage("field")} />;
  }
  if (page === "research" && account) {
    return (
      <ResearchPage
        user={account}
        token={account.token}
        onBack={() => setPage("field")}
        onUser={(user) => setAccount((prev) => keepAccount(prev, user, account.token))}
      />
    );
  }
  if (page === "settings") {
    return (
      <>
      <main className="h-dvh overflow-y-auto bg-bg text-fg">
        <div className="mx-auto flex max-w-xl flex-col gap-4 px-4 py-8">
          <div className="flex items-center justify-between gap-3">
            <h1 className="font-display text-4xl">Settings</h1>
            <Btn onClick={() => setPage("field")}>Back</Btn>
          </div>
          <p className="text-sm text-muted">Favorite units stay at the top of the buy list in a battle. Buildings stay in their normal place.</p>
          <ul className="flex flex-col gap-2">
            {UNITS.map((unit) => {
              const on = favs.includes(unit.id);
              return (
                <li key={unit.id} className="flex items-center justify-between gap-2 rounded-lg border border-line px-3 py-2">
                  <span>
                    <span className="block">{unit.name}</span>
                    <span className="block text-xs text-muted">{unit.blurb}</span>
                  </span>
                  <Btn
                    tone={on ? "brass" : "ghost"}
                    onClick={() => setFavs((prev) => (prev.includes(unit.id) ? prev.filter((id) => id !== unit.id) : [...prev, unit.id]))}
                  >
                    {on ? "Favorited" : "Favorite"}
                  </Btn>
                </li>
              );
            })}
          </ul>
        </div>
      </main>
      {staffDock}
      </>
    );
  }
  if (room?.status === "open") {
    const mapName = MAPS.find((map) => map.id === room.mapId)?.name ?? room.mapId;
    const modeName = room.mode === "capture" ? "POI capture" : room.mode === "raze" ? "Raze" : "Strike";
    const summary = room.mode === "strike" || !room.mode ? `${mapName} · ${modeName} · ${room.hqHp ?? onlineHp} HP` : `${mapName} · ${modeName}`;
    return <LobbyPage code={room.code} summary={summary} onBack={leaveOnline} />;
  }
  if (room?.status === "queue") {
    return (
      <SearchPage
        rank={account?.rank ?? "Sergeant"}
        rating={account?.rating ?? 1000}
        note={note}
        onBack={leaveOnline}
      />
    );
  }

  if (!state.match || state.screen === "title") {
    return (
      <>
      <main className="h-dvh overflow-y-auto bg-bg text-fg">
        {friendBar}
        <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-8">
          <header className="flex flex-wrap items-end justify-between gap-4">
            <div className="max-w-xl">
              <p className="text-xs tracking-widest text-brass uppercase">Two armies · one field</p>
              <h1 className="font-display text-5xl sm:text-6xl">Strategic War</h1>
              <p className="mt-2 text-muted">
                A same-screen war. Spend the purse, plant radar and guns, and cover the map before you hand the
                machine across the table.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {account ? (
                <div className="rounded-lg border border-brass bg-surface px-3 py-2 text-center">
                  <p className="text-xs tracking-widest text-brass uppercase">Coins</p>
                  <p className="font-display text-3xl leading-none tabular-nums">{account.coins}</p>
                </div>
              ) : null}
              <Btn onClick={toggleMute} aria-label={muted ? "Unmute" : "Mute"}>
                {muted ? <VolumeX className="size-5" /> : <Volume2 className="size-5" />}
              </Btn>
              <Btn onClick={() => setPage("settings")}>Settings</Btn>
              <Btn onClick={() => dispatch({ type: "manual" })}>
                <span className="inline-flex items-center gap-2">
                  <BookOpen className="size-4" /> Field manual
                </span>
              </Btn>
            </div>
          </header>
          <div className="flex flex-wrap gap-2">
            {botLevel ? (
              <Btn tone="brass" onClick={() => { keptScroll.fresh = true; dropStore("session", "ashveil.room"); setRoom(null); dispatch({ type: "new", mapId, bot: botLevel, hqHp: mode === "strike" ? hqHp : undefined, mode, mods: account?.mods }); }}>
                {`Fight level ${botLevel}`}
              </Btn>
            ) : null}
            <Btn
              tone={botLevel ? "ghost" : "brass"}
              data-testid="start-match"
              onClick={() => {
                setBotLevel(null);
                keptScroll.fresh = true;
                dropStore("session", "ashveil.room");
                setRoom(null);
                dispatch({ type: "new", mapId, hqHp: mode === "strike" ? hqHp : undefined, mode, mods: account?.mods });
              }}
            >
              Same-screen duel
            </Btn>
            <span className="self-center text-xs tracking-widest text-muted uppercase">Bot</span>
            {Array.from({ length: 10 }, (_, i) => i + 1).map((level) => (
              <Btn key={level} onClick={() => setBotLevel(level)} tone={botLevel === level ? "brass" : "ghost"}>
                {level}
              </Btn>
            ))}
            <span className="self-center text-xs tracking-widest text-muted uppercase">Mode</span>
            {(
              [
                ["strike", "Strike"],
                ["capture", "POI capture"],
                ["raze", "Raze"],
              ] as const
            ).map(([id, label]) => (
              <Btn key={id} onClick={() => setMode(id)} tone={mode === id ? "brass" : "ghost"}>
                {label}
              </Btn>
            ))}
            {mode === "strike" ? (
              <>
                <label className="flex items-center gap-2 text-sm">
                  Local HP
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={hqHp}
                    aria-label="Base HP"
                    onChange={(e) => {
                      const n = Math.round(Number(e.target.value));
                      if (!Number.isFinite(n)) return;
                      setHqHp(Math.min(100, Math.max(1, n)));
                    }}
                    className="min-h-11 w-20 rounded-lg border border-line bg-surface px-3 text-base"
                  />
                </label>
                <span className="self-center text-xs tracking-widest text-muted uppercase">Online HP</span>
                {[10, 20, 40, 60, 80, 100].map((n) => (
                  <Btn key={n} onClick={() => setOnlineHp(n)} tone={onlineHp === n ? "brass" : "ghost"}>
                    {n}
                  </Btn>
                ))}
              </>
            ) : null}
            {account ? (
              <>
                <Btn onClick={() => setPage("friends")}>Friends</Btn>
                <Btn onClick={() => setPage("rank")}>Rank</Btn>
                {account.role ? <Btn onClick={() => setStaffOpen(true)}>Staff</Btn> : null}
                {account.operator || account.dev || account.username.toLowerCase() === "apollo" ? (
                  <Btn onClick={() => setPage("admin")}>Admin</Btn>
                ) : null}
                <Btn onClick={() => setPage("research")}>Research · {account.rp} · {account.coins} coins</Btn>
                <Btn
                  onClick={() => {
                    setNote("");
                    void roomQueue({ data: { token: account.token, mapId, mode, hqHp: onlineHp, fresh: true } })
                      .then((res) => {
                        if (!res.ok) setNote(res.error);
                        else {
                          setRoom(res);
                          if (res.state) setState(res.state);
                        }
                      })
                      .catch(() => setNote("Could not start a ranked match. Try again."));
                  }}
                >
                  Ranked match
                </Btn>
                <Btn
                  onClick={() => {
                    setNote("");
                    void roomHost({ data: { token: account.token, mapId, mode, hqHp: onlineHp } })
                      .then((res) => {
                        if (!res.ok) setNote(res.error);
                        else setRoom(res);
                      })
                      .catch(() => setNote("Could not open a room. Try again."));
                  }}
                >
                  Host online
                </Btn>
                <form
                  className="flex flex-wrap items-center gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const code = joinCode.toUpperCase().replace(/[^A-Z0-9]/g, "");
                    if (code.length < 4) {
                      setNote("Type the 4-character room code, then Join.");
                      return;
                    }
                    setNote("");
                    void roomJoin({ data: { token: account.token, code } })
                      .then((res) => {
                        if (!res.ok) setNote(res.error);
                        else enterRoom(res);
                      })
                      .catch(() => setNote("Could not join. Check the code and try again."));
                  }}
                >
                  <input
                    value={joinCode}
                    onChange={(e) => setJoinCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4))}
                    placeholder="Code"
                    aria-label="Room code"
                    maxLength={4}
                    className="min-h-11 w-28 rounded-lg border border-line bg-surface px-3 text-base uppercase"
                  />
                  <Btn tone="brass" type="submit">
                    Join
                  </Btn>
                </form>
                <Btn
                  onClick={() => {
                    void accountLogout({ data: { token: account.token } });
                    dropStore("local", "ashveil.token");
                    dropStore("session", "ashveil.room");
                    setAccount(null);
                    setRoom(null);
                  }}
                >
                  Log out
                </Btn>
              </>
            ) : (
              <Btn onClick={() => setPage("login")}>Log in</Btn>
            )}
            {state.hasSave ? (
              <Btn data-testid="continue-match" onClick={() => dispatch({ type: "continue" })}>
                Continue
              </Btn>
            ) : null}
            {state.hasSave ? <Btn onClick={() => dispatch({ type: "discard-save" })}>Discard saved match</Btn> : null}
          </div>
          {note ? <p className="text-sm text-brass">{note}</p> : null}
          <div className="flex flex-col gap-6">
            {(
              [
                ["land", "Land"],
                ["sea", "Sea"],
                ["mixed", "Mixed"],
              ] as const
            ).map(([kind, label]) => (
              <section key={kind} className="flex flex-col gap-3">
                <h2 className="font-display text-2xl">{label}</h2>
                <div className="grid gap-3 sm:grid-cols-2">
                  {MAPS.filter((map) => map.kind === kind).map((map) => {
                    const on = map.id === mapId;
                    return (
                      <div
                        key={map.id}
                        className={`rounded-lg border p-3 text-left ${on ? "border-brass bg-surface" : "border-line bg-surface-2"}`}
                      >
                        <button type="button" className="w-full text-left" onClick={() => setMapId(map.id)}>
                          <MapThumb id={map.id} />
                          <div className="mt-2 flex items-baseline justify-between gap-2">
                            <h3 className="font-display text-2xl">{map.name}</h3>
                            <span className="text-xs text-muted tabular-nums">
                              {map.rows[0]!.length}×{map.rows.length}
                            </span>
                          </div>
                          <p className="text-sm text-muted">{map.blurb}</p>
                        </button>
                        <Btn className="mt-2" onClick={() => setLookMap(map.id)}>
                          Look over
                        </Btn>
                      </div>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
          {lookMap && MAP_BY[lookMap] ? (
            <div className="fixed inset-0 z-50 flex flex-col bg-bg">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3">
                <div>
                  <h2 className="font-display text-3xl">{MAP_BY[lookMap]!.name}</h2>
                  <p className="text-sm text-muted">{MAP_BY[lookMap]!.blurb}</p>
                </div>
                <div className="flex gap-2">
                  <Btn
                    tone="brass"
                    onClick={() => {
                      setMapId(lookMap);
                      setLookMap(null);
                    }}
                  >
                    Use this map
                  </Btn>
                  <Btn onClick={() => setLookMap(null)}>Back</Btn>
                </div>
              </div>
              <div className="min-h-0 flex-1 overflow-auto p-4">
                <MapLook id={lookMap} />
              </div>
            </div>
          ) : null}
          {account ? (
            <div className="flex flex-col gap-2">
              <Nameplate
                name={account.username}
                rating={account.rating}
                operator={account.operator}
                dev={account.dev}
                detail={`${account.wins}–${account.losses}`}
              />
              <p className="text-sm text-muted">
                {roster.length ? `Accounts on this server: ${roster.join(", ")}` : "No accounts saved on this server yet"}
              </p>
            </div>
          ) : null}
          <p className="text-sm text-muted">
            North is Player 1 and moves first. A same-screen duel gives both sides the same purse, the same buy list, and the same upgrades. Against a bot, South starts poorer on low levels and even on high ones. Ranked match pairs you with someone at your rank. Online turns last 1:30. If the clock hits zero, that turn ends. Leaving a started match costs you the full rank loss. The player who stays only gains half the usual points.
          </p>
        </div>
      </main>
      {staffDock}
      </>
    );
  }

  if (
    room &&
    state.match &&
    room.status !== "open" &&
    state.match.active !== room.seat &&
    !state.match.winner &&
    state.screen === "battle"
  ) {
    return (
      <>
        {friendBar}
        <WaitingPage
        name={room.seat === 0 ? room.guest ?? "your opponent" : room.host}
        deadline={room.deadline}
        onHome={leaveOnline}
        talk={room.talk ?? []}
        onSay={
          account
            ? (text) => {
                void roomSay({ data: { token: account.token, code: room.code, text } }).then((res) => {
                  if (!res.ok) setNote(res.error);
                  else setRoom((prev) => (prev && prev.code === room.code ? { ...prev, talk: res.talk } : prev));
                });
              }
            : undefined
        }
      />
      {staffDock}
      </>
    );
  }

  const passing = state.screen === "handoff" && state.match;
  const nextFaction = passing ? FACTIONS[state.match.active === 0 ? 1 : 0] : null;

  return (
    <>
      {friendBar}
      {staffDock}
      <div inert={passing ? true : undefined} className={passing ? "pointer-events-none" : undefined}>
        <Battle
          state={state}
          muted={muted}
          motion={motion}
          hover={hover}
          reveal={false}
          deadline={room?.status === "active" ? room.deadline : null}
          onHome={leaveOnline}
          onExpire={onExpire}
          onHover={setHover}
          onMute={toggleMute}
          dispatch={dispatch}
          discovered={account ? account.unlocked ?? "" : null}
          favs={favs}
          coins={account?.coins ?? null}
          talk={room?.talk ?? []}
          onSay={
            account && room && (room.status === "active" || room.status === "done")
              ? (text) => {
                  void roomSay({ data: { token: account.token, code: room.code, text } }).then((res) => {
                    if (!res.ok) setNote(res.error);
                    else setRoom((prev) => (prev && prev.code === room.code ? { ...prev, talk: res.talk } : prev));
                  });
                }
              : undefined
          }
        />
      </div>
      {passing && nextFaction ? (
        <div
          data-testid="pass-screen"
          role="dialog"
          aria-modal="true"
          aria-labelledby="pass-title"
          className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 px-6 text-center"
          style={{ background: "#f7f4ee", color: "#1a1814" }}
        >
          <p className="text-xs tracking-widest uppercase" style={{ color: "#5c564c" }}>
            The map is covered on purpose
          </p>
          <h1 id="pass-title" className="font-display text-5xl leading-none sm:text-7xl" style={{ color: "#1a1814" }}>
            Pass to {nextFaction.player}
          </h1>
          <p className="max-w-md text-lg" style={{ color: "#3f3a33" }}>
            Hand the machine to {nextFaction.name}. Their units stay hidden until they press the button.
          </p>
          <button
            type="button"
            data-testid="ready-btn"
            autoFocus
            className="min-h-11 rounded-lg px-6 py-3 text-base font-medium"
            style={{ background: state.match.active === 0 ? NEREID : VESPER, color: "#1a1814" }}
            onClick={() => dispatch({ type: "ready", now: Date.now() })}
          >
            {nextFaction.name} is ready
          </button>
          <p className="text-sm" style={{ color: "#5c564c" }}>
            or press Space
          </p>
        </div>
      ) : null}
    </>
  );
}

function openRecord(m: Match, x: number, y: number): { title: string; lines: string[] } {
  const lines = [terrainName(m.terrain[y]![x]!)];
  const unit = unitAt(m, x, y);
  const st = structAt(m, x, y);
  if (unit) lines.push(`${FACTIONS[unit.owner].name} · ${UNIT_BY[unit.kind].name} · ${unit.hp}`);
  if (st) {
    const who = st.owner === null ? "Neutral" : FACTIONS[st.owner].name;
    lines.push(`${who} · ${STRUCT_BY[st.kind].name} · ${st.hp}`);
  }
  return { title: "Record", lines };
}

function Battle({
  state,
  muted,
  motion,
  hover,
  reveal,
  deadline,
  onHome,
  onExpire,
  onHover,
  onMute,
  dispatch,
  discovered,
  favs,
  coins,
  talk,
  onSay,
}: {
  state: RootState;
  muted: boolean;
  motion: boolean;
  hover: { x: number; y: number } | null;
  reveal: boolean;
  deadline: number | null;
  onHome: () => void;
  onExpire: () => void;
  onHover: (t: { x: number; y: number } | null) => void;
  onMute: () => void;
  dispatch: (cmd: Cmd) => void;
  discovered: string | null;
  favs: string[];
  coins?: number | null;
  talk?: { name: string; text: string }[];
  onSay?: (text: string) => void;
}) {
  const [wide, setWide] = useState(true);
  const [homeStep, setHomeStep] = useState(0);
  const [draft, setDraft] = useState("");
  const [localTalk, setLocalTalk] = useState<{ name: string; text: string }[]>([]);
  const chatRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!homeStep) return;
    const id = window.setTimeout(() => setHomeStep(0), 5000);
    return () => window.clearTimeout(id);
  }, [homeStep]);
  const m = state.match!;
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
  const lines = onSay ? (talk ?? []) : localTalk;
  useEffect(() => {
    const box = chatRef.current;
    if (box) box.scrollTop = box.scrollHeight;
  }, [lines]);
  const sendChat = (text: string) => {
    const clean = text.replace(/\s+/g, " ").trim().slice(0, 80);
    if (!clean) return;
    setDraft("");
    if (onSay) onSay(clean);
    else setLocalTalk((prev) => [...prev, { name: faction.name, text: clean }].slice(-40));
  };
  const sel = m.selection;
  const selUnit = sel?.kind === "unit" ? m.units.find((u) => u.id === sel.id) : undefined;
  const selStruct = sel?.kind === "struct" ? m.structs.find((s) => s.id === sel.id) : undefined;
  const buy = sel?.kind === "buy" ? sel.item : null;
  const [card, setCard] = useState<BuyId | null>(null);
  const [peek, setPeek] = useState<BuyId | null>(null);
  const cov = reveal ? null : coverage(m, p);
  const identified = (x: number, y: number) => reveal || !!cov?.identified[y]?.[x];
  const lookedUnit = unitAt(m, look.x, look.y);
  const lookedStruct = structAt(m, look.x, look.y);
  const unitKnown = lookedUnit && (reveal || lookedUnit.owner === p || identified(lookedUnit.x, lookedUnit.y));
  const structKnown =
    lookedStruct &&
    lookedStruct.hp > 0 &&
    (reveal || lookedStruct.owner === p || (identified(lookedStruct.x, lookedStruct.y) && lookedStruct.kind !== "mine"));
  const mapSheet =
    unitKnown && lookedUnit
      ? unitSheet(UNIT_BY[lookedUnit.kind], lookedUnit.hp, lookedUnit.eta ?? 0, UNIT_BY[lookedUnit.kind].hp + (lookedUnit.plus?.hp || 0), lookedUnit.plus)
      : structKnown && lookedStruct
        ? structSheet(STRUCT_BY[lookedStruct.kind], lookedStruct.hp, lookedStruct.eta ?? 0, lookedStruct.max && lookedStruct.max > 0 ? lookedStruct.max : Math.max(STRUCT_BY[lookedStruct.kind].hp, lookedStruct.hp))
        : null;
  const picked = selUnit
    ? unitSheet(UNIT_BY[selUnit.kind], selUnit.hp, selUnit.eta ?? 0, UNIT_BY[selUnit.kind].hp + (selUnit.plus?.hp || 0), selUnit.plus)
    : selStruct
      ? structSheet(STRUCT_BY[selStruct.kind], selStruct.hp, selStruct.eta ?? 0, selStruct.max && selStruct.max > 0 ? selStruct.max : Math.max(STRUCT_BY[selStruct.kind].hp, selStruct.hp))
      : buy
        ? isUnitKind(buy)
          ? unitSheet(UNIT_BY[buy])
          : structSheet(STRUCT_BY[buy])
        : null;
  const shopSheet = (item: BuyId) => (isUnitKind(item) ? unitSheet(UNIT_BY[item]) : structSheet(STRUCT_BY[item]));
  const sheet = peek ? shopSheet(peek) : buy ? shopSheet(buy) : mapSheet ?? picked ?? (card ? shopSheet(card) : null);

  return (
    <div className={`flex h-dvh flex-col overflow-hidden bg-bg text-fg ${reveal ? "" : frame}`}>
      <header className={`${tone} flex flex-wrap items-center justify-between gap-2 px-3 py-2 sm:gap-3 sm:px-4 sm:py-3`}>
        <div className="flex min-w-0 items-center gap-3">
          {!reveal ? (
            <Btn data-testid="end-turn" tone="brass" onClick={() => dispatch({ type: "ask-end" })}>
              End turn
            </Btn>
          ) : null}
          <div className="min-w-0">
          <p className="text-xs tracking-widest uppercase">
            {faction.player} · Round {Math.ceil(m.turn / 2)}{m.bot ? ` · ${m.bot} bot` : ""}
            {m.mode === "capture" ? " · POI capture" : m.mode === "raze" ? " · Raze" : " · Strike"}
          </p>
          <h1 className="font-display text-2xl leading-none sm:text-4xl">{faction.name} · your turn</h1>
          <p className="mt-1 text-sm">
            {(() => {
              const foe = m.structs.find((s) => s.kind === "spire" && s.owner !== null && s.owner !== p && s.hp > 0);
              if (foe && (reveal || identified(foe.x, foe.y))) return `Their Headquarters has ${foe.hp} left`;
              if (idle.units > 0) return `${idle.units} still ready · kill something and the purse pays`;
              if (funds >= 140) return "You can still buy. A kill pays part of the cost back.";
              return "Nothing left to spend. End the turn.";
            })()}
          </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {deadline && !reveal ? (
            <div className="text-right">
              <TurnClock deadline={deadline} onZero={onExpire} />
              <p className="text-xs">left this turn</p>
            </div>
          ) : null}
          <button
            type="button"
            className="min-h-11 rounded-lg bg-black/20 px-3 text-sm font-medium"
            onClick={() => {
              if (reveal) {
                onHome();
                return;
              }
              const next = homeStep + 1;
              if (next >= 3) onHome();
              else setHomeStep(next);
            }}
          >
            {reveal || homeStep === 0 ? "Home" : `Leave? ${homeStep}/3`}
          </button>
          <div className="text-right">
            <p className="font-display text-3xl leading-none tabular-nums">{funds}</p>
            <p className="text-xs tabular-nums">
              Next +{nextPay} · {incomeBits(m, p)}
            </p>
          </div>
          {coins != null ? (
            <div className="text-center">
              <p className="font-display text-3xl leading-none tabular-nums">{coins}</p>
              <p className="text-xs">coins</p>
            </div>
          ) : null}
        </div>
      </header>
      <div className="relative flex min-h-0 flex-1 flex-col lg:flex-row">
        <div className="map-shell relative min-h-0 min-w-0 flex-1">
          <Field
            match={m}
            reveal={reveal}
            motion={motion}
            onHover={onHover}
            onLook={(x, y) => dispatch({ type: "cursor", x, y })}
            onTile={(x, y) => (reveal ? dispatch({ type: "cursor", x, y }) : dispatch({ type: "click", x, y }))}
          />
          <p className="pointer-events-none absolute bottom-3 left-3 z-10 rounded-md bg-bg/85 px-2 py-1 text-xs text-fg">
            Drag to look around. Tap a square.
          </p>
          <form
            className="absolute bottom-12 left-3 z-10 w-[min(22rem,calc(100%-1.5rem))]"
            onSubmit={(e) => {
              e.preventDefault();
              sendChat(draft);
            }}
          >
            <div className="flex flex-col gap-2 rounded-lg border border-line bg-bg/95 p-2 shadow-lg">
              <p className="text-xs tracking-widest text-brass uppercase">Chat</p>
              <div ref={chatRef} className="flex max-h-24 flex-col gap-1 overflow-y-auto text-sm">
                {lines.length === 0 ? <p className="text-muted">Both sides can read this.</p> : null}
                {lines.map((line, i) => (
                  <p key={`${i}-${line.name}-${line.text}`}>
                    <span className="text-brass">{line.name}: </span>
                    {line.text}
                  </p>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  value={draft}
                  maxLength={80}
                  aria-label="Chat message"
                  placeholder="Message"
                  onChange={(e) => setDraft(e.target.value)}
                  className="min-h-11 min-w-0 flex-1 rounded-lg border border-line bg-surface px-3 text-base"
                />
                <Btn type="submit">Send</Btn>
              </div>
            </div>
          </form>
          <button
            type="button"
            className="absolute top-3 right-3 z-10 min-h-11 rounded-lg bg-bg/90 px-3 py-2 text-sm font-medium text-fg"
            onClick={() => setWide((v) => !v)}
          >
            {wide ? "Show list" : "Expand map"}
          </button>
          {layReady(m) ? (
            <button
              type="button"
              className="absolute bottom-14 left-1/2 z-10 min-h-11 -translate-x-1/2 rounded-lg bg-bg/90 px-3 py-2 text-sm font-medium text-fg"
              onClick={() => dispatch({ type: "arm-lay" })}
            >
              {m.laying ? "Pick a square" : "Lay mine"}
            </button>
          ) : null}
          {restockOffer(m) ? (
            <button
              type="button"
              className="absolute bottom-14 right-3 z-10 min-h-11 rounded-lg bg-bg/90 px-3 py-2 text-sm font-medium text-fg"
              onClick={() => dispatch({ type: "restock" })}
            >
              Restock {restockOffer(m)?.pay}
            </button>
          ) : null}
          {captureReady(m) ? (
            <button
              type="button"
              className="absolute bottom-3 left-1/2 z-10 min-h-11 -translate-x-1/2 rounded-lg bg-bg/90 px-3 py-2 text-sm font-medium text-fg"
              onClick={() => dispatch({ type: "capture" })}
            >
              Capture
            </button>
          ) : null}
          {repairReady(m) ? (
            <button
              type="button"
              className="absolute right-3 bottom-3 z-10 min-h-11 rounded-lg bg-bg/90 px-3 py-2 text-sm font-medium text-fg"
              onClick={() => dispatch({ type: "repair" })}
            >
              Heal
            </button>
          ) : null}
          {reveal ? (
            <div className="absolute top-3 left-3 z-10 flex items-center gap-2 rounded-lg bg-bg/90 px-3 py-2 text-sm">
              <span>Field revealed · {m.winner?.reason}</span>
              <button type="button" className="min-h-11 rounded-lg bg-brass px-3 font-medium text-brass-ink" onClick={() => dispatch({ type: "review" })}>
                Back
              </button>
            </div>
          ) : null}
          {m.confirmEnd ? (
            <div className="absolute inset-0 z-20 flex items-center justify-center bg-bg/80 p-4">
              <div className="w-full max-w-md rounded-lg border border-line bg-surface p-4">
                <h2 className="font-display text-2xl">End {faction.name}'s turn?</h2>
                <p className="mt-2 text-sm text-muted">
                  {idle.units} {idle.units === 1 ? "unit" : "units"} can still act. {idle.guns} unfired{" "}
                  {idle.guns === 1 ? "defense" : "defenses"} will take a parting shot at contacts they can sense. Then
                  the map is covered.
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Btn onClick={() => dispatch({ type: "cancel-end" })}>Keep playing</Btn>
                  <Btn tone="brass" data-testid="confirm-end" onClick={() => dispatch({ type: "confirm-end", now: Date.now() })}>
                    End turn
                  </Btn>
                </div>
              </div>
            </div>
          ) : null}
          {m.salvo ? (
            <div className="absolute inset-0 z-20 flex items-center justify-center bg-bg/80 p-4">
              <div className="w-full max-w-md rounded-lg border border-line bg-surface p-4">
                <h2 className="font-display text-2xl">Parting shots</h2>
                <ul className="mt-2 flex flex-col gap-1 text-sm text-muted">
                  {m.salvo.map((line, i) => (
                    <li key={i}>{line}</li>
                  ))}
                </ul>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Btn tone="brass" data-testid="cover-field" onClick={() => dispatch({ type: "pass-cover" })}>
                    Cover the field
                  </Btn>
                </div>
              </div>
            </div>
          ) : null}
        </div>
        {wide ? null : (
        <aside className="absolute inset-x-0 bottom-0 z-30 flex max-h-[72dvh] min-h-0 flex-col gap-3 overflow-y-auto border-t border-line bg-surface p-3 shadow-2xl lg:static lg:z-auto lg:max-h-none lg:w-96 lg:shrink lg:border-t-0 lg:border-l lg:shadow-none">
          <div className="flex flex-wrap gap-2">
            <Btn className="lg:hidden" onClick={() => setWide(true)}>
              Map
            </Btn>
            {reveal ? (
              <Btn tone="brass" onClick={() => dispatch({ type: "title" })}>
                Back to table
              </Btn>
            ) : null}
            {!reveal && sellOffer(m) ? (
              <Btn data-testid="sell" onClick={() => dispatch({ type: "sell" })}>
                Sell +{sellOffer(m)?.pay}
              </Btn>
            ) : null}
            <Btn onClick={() => dispatch({ type: "help" })}>Manual</Btn>
            <Btn onClick={onMute} aria-label={muted ? "Unmute" : "Mute"}>
              {muted ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
            </Btn>
            {!reveal ? (
              <Btn onClick={() => dispatch({ type: "title" })}>Maps</Btn>
            ) : null}
          </div>

          <div className="max-h-36 shrink-0 overflow-y-auto rounded-lg border border-line bg-surface-2 p-3 lg:h-52 lg:max-h-none">
            {sheet ? (
              <>
                <p className="text-xs tracking-widest text-brass uppercase">{sheet.title}</p>
                {statRows(sheet.rows)}
                <p className="mt-2 text-sm text-muted">{sheet.blurb}</p>
              </>
            ) : (
              <p className="text-sm text-muted">Click a shop card to see its stats.</p>
            )}
          </div>

          <div className="rounded-lg border border-line bg-surface-2 p-3">
            <p className="text-xs tracking-widest text-brass uppercase">{info.title}</p>
            {info.lines.map((line) => (
              <p key={line} className="text-sm">
                {line}
              </p>
            ))}
            {selUnit ? (
              <p className="mt-2 text-sm text-muted">
                {(selUnit.eta ?? 0) > 0
                  ? `Still being built — ${selUnit.eta} ${selUnit.eta === 1 ? "turn" : "turns"} left. It cannot move, shoot, or heal until that hits zero.`
                  : (UNIT_BY[selUnit.kind].mines ?? 0) > 0
                  ? `${selUnit.charges ?? UNIT_BY[selUnit.kind].mines} mines left. ${restockOffer(m) ? `Restock for ${restockOffer(m)?.pay} next to your Headquarters or a Supply Base.` : "Press Lay mine, then click a marked square next to it. Restock beside your Headquarters or a Supply Base you hold."}`
                  : marchLeft(selUnit) > 0
                  ? `${marchLeft(selUnit)} tiles left. Gold squares move. Red squares shoot — click one, or press Shoot. You can still move after firing.${(UNIT_BY[selUnit.kind].shots ?? 1) > 1 ? ` ${Math.max(0, (UNIT_BY[selUnit.kind].shots ?? 1) - (selUnit.rounds ?? 0))} shots left.` : ""}`
                  : `No movement left on this unit. Red squares are shots, if it can still fire.${(UNIT_BY[selUnit.kind].shots ?? 1) > 1 ? ` ${Math.max(0, (UNIT_BY[selUnit.kind].shots ?? 1) - (selUnit.rounds ?? 0))} shots left.` : ""}`}
              </p>
            ) : selStruct && (selStruct.eta ?? 0) > 0 ? (
              <p className="mt-2 text-sm text-muted">
                Under construction. Ready in {selStruct.eta} {selStruct.eta === 1 ? "turn" : "turns"}.
              </p>
            ) : buy ? (
              <p className="mt-2 text-sm text-muted">
                {(() => {
                  const name = isUnitKind(buy) ? UNIT_BY[buy].name : STRUCT_BY[buy].name;
                  const n = selectionOverlay(m).places.length;
                  if (!n) {
                    return `No open square for ${name}. Clear a square next to your Headquarters, or pick something else.`;
                  }
                  const where = !isUnitKind(buy)
                    ? "empty ground you control"
                    : UNIT_BY[buy].domain === "sea"
                      ? "water next to your Headquarters"
                      : "ground touching your Headquarters or a Supply Base you own";
                  return `Placing ${name}. ${n} gold ${n === 1 ? "square is" : "squares are"} marked with a +. They are ${where}. Click one. It will not be ready until its build time is up.`;
                })()}
              </p>
            ) : (
              <>
                <p className="mt-2 text-sm text-muted">
                  {mobileLeft} of your pieces still have a bright outline. Those can move or shoot. Dim pieces are finished for this turn.
                </p>
                <p className="mt-2 text-sm text-muted">
                  Click a catalog card, then a gold + square. If those squares are full, the next ring out opens. Yellow marks anything any of your units could hit. Red means you can shoot it from where that unit is standing. Shooting does not spend movement.
                </p>
              </>
            )}
            {!reveal ? (
              <div className="mt-2 flex flex-wrap gap-2">
                {holdReady(m) ? <Btn onClick={() => dispatch({ type: "hold" })}>Done</Btn> : null}
                {captureReady(m) ? (
                  <Btn tone="brass" onClick={() => dispatch({ type: "capture" })}>
                    Capture
                  </Btn>
                ) : null}
                {repairReady(m) ? <Btn onClick={() => dispatch({ type: "repair" })}>Heal</Btn> : null}
                {layReady(m) ? (
                  <Btn onClick={() => dispatch({ type: "arm-lay" })}>{m.laying ? "Pick a square" : "Lay mine"}</Btn>
                ) : null}
                {restockOffer(m) ? (
                  <Btn tone="brass" onClick={() => dispatch({ type: "restock" })}>
                    Restock {restockOffer(m)?.pay}
                  </Btn>
                ) : null}
                {selectionOverlay(m).attacks.length > 0 ? (
                  <Btn tone="brass" onClick={() => dispatch({ type: "strike" })}>
                    Shoot
                  </Btn>
                ) : null}
                {buy ? <Btn onClick={() => dispatch({ type: "cancel" })}>Cancel buy</Btn> : null}
              </div>
            ) : null}
          </div>

          {!reveal && m.phase === "deploy" ? (
            <div>
              <p className="mb-2 text-xs tracking-widest text-muted uppercase">Catalog — the price is the cost to field it</p>
              <div className="grid grid-cols-2 gap-2" onMouseLeave={() => setPeek(null)}>
                {(
                  [
                    ["Basic kit", [...BASIC_KIT]],
                    ["Discovered", BUY_ORDER.filter((id) => !(BASIC_KIT as string[]).includes(id))],
                  ] as [string, BuyId[]][]
                ).map(([label, ids]) => {
                  const shown = ids.filter((id) => discovered === null || isDiscovered(discovered, id));
                  if (!shown.length) return null;
                  return (
                  <div key={label} className="col-span-2 flex flex-col gap-2">
                    <p className="text-xs tracking-widest text-brass uppercase">{label}</p>
                    <div className="grid grid-cols-2 gap-2">
                {[...shown].sort((a, b) => Number(isUnitKind(b) && favs.includes(b)) - Number(isUnitKind(a) && favs.includes(a))).map((item) => {
                  const unit = isUnitKind(item);
                  const def = unit ? UNIT_BY[item] : STRUCT_BY[item];
                  const on = buy === item || card === item;
                  const poor = funds < def.cost;
                  const facts = cardFacts(item);
                  return (
                    <button
                      key={item}
                      type="button"
                      onMouseEnter={() => setPeek(item)}
                      onFocus={() => setPeek(item)}
                      onClick={() => {
                        setCard(item);
                        if (poor) return;
                        dispatch({ type: "buy", item: item as BuyId });
                      }}
                      className={`flex min-h-11 items-start gap-2 rounded-lg border px-2 py-1 text-left ${poor ? "border-line bg-surface-2 opacity-40" : on || peek === item ? "border-brass bg-bg" : "border-line bg-surface-2"}`}
                    >
                      <Mark kind={item} owner={p} />
                      <span className="min-w-0">
                        <span className="block truncate text-sm">{isUnitKind(item) && favs.includes(item) ? "★ " : ""}{def.name}</span>
                        <span className={`block font-display text-lg leading-none tabular-nums ${poor ? "text-muted" : "text-brass"}`}>
                          {poor ? `Cost ${def.cost} · too expensive` : `Cost ${def.cost}`}
                        </span>
                        <span className="block text-xs text-muted">
                          {def.build ? `${def.build} ${def.build === 1 ? "turn" : "turns"}` : "Ready now"}
                          {unit ? ` · ${UNIT_BY[item].domain}` : ""}
                        </span>
                        {on || peek === item
                          ? facts.map((line) => (
                              <span key={line} className="block text-xs text-muted">
                                {line}
                              </span>
                            ))
                          : null}
                      </span>
                    </button>
                  );
                })}
                    </div>
                  </div>
                  );
                })}
              </div>
            </div>
          ) : null}

          <div>
            <p className="mb-1 text-xs tracking-widest text-muted uppercase">Your log</p>
            <ul className="flex flex-col gap-1 text-sm text-muted">
              {log.length ? log.map((line, i) => <li key={`${i}-${line}`}>{line}</li>) : <li>No notes yet.</li>}
            </ul>
          </div>
          <p className="text-xs text-muted">
            {MAP_BY[m.mapId]?.name} · Tap a square, or use arrows and Enter. Drag the map on a phone.
          </p>
        </aside>
        )}
      </div>
      <div className="safe-bottom flex gap-2 overflow-x-auto border-t border-line bg-surface px-2 pt-2 lg:hidden">
        <Btn tone={wide ? "ghost" : "brass"} onClick={() => setWide((v) => !v)}>
          {wide ? "Buy" : "Map"}
        </Btn>
        {!reveal && selectionOverlay(m).attacks.length > 0 ? (
          <Btn tone="brass" onClick={() => dispatch({ type: "strike" })}>
            Shoot
          </Btn>
        ) : null}
        {!reveal && holdReady(m) ? <Btn onClick={() => dispatch({ type: "hold" })}>Done</Btn> : null}
        {!reveal && captureReady(m) ? (
          <Btn tone="brass" onClick={() => dispatch({ type: "capture" })}>
            Capture
          </Btn>
        ) : null}
        {!reveal && repairReady(m) ? <Btn onClick={() => dispatch({ type: "repair" })}>Heal</Btn> : null}
        {!reveal && layReady(m) ? (
          <Btn onClick={() => dispatch({ type: "arm-lay" })}>{m.laying ? "Pick square" : "Lay mine"}</Btn>
        ) : null}
        {!reveal && restockOffer(m) ? (
          <Btn tone="brass" onClick={() => dispatch({ type: "restock" })}>
            Restock {restockOffer(m)?.pay}
          </Btn>
        ) : null}
        {!reveal && sellOffer(m) ? (
          <Btn onClick={() => dispatch({ type: "sell" })}>Sell +{sellOffer(m)?.pay}</Btn>
        ) : null}
      </div>
    </div>
  );
}
