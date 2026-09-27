import { useEffect, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from "react";
import { accountDelete, accountDevice, accountGiveCoins, accountGiveKit, accountLogin, accountMe, accountRegister, accountResearch, accountFocus, accountResetRank, accountUpgrade, accountChest, accountMakeAdmin, accountCommand, accountSetCommand, friendAdd, friendAnswer, friendList, friendRemove, rankBoard, roomInvite, roomJoin } from "@/game/online.functions";
import { BASIC_KIT, BUY_ORDER, MOD_OFFERS, RESEARCH, STRUCT_BY, UNIT_BY, hitBand, isDiscovered, isUnitKind, lineRoots, ownsMod, type ResearchNode } from "@/game/catalog";
import { plateTitle, rankSteps, type FriendRow, type PublicUser } from "@/game/online";
import type { RoomOk } from "@/game/online.functions";

function Btn({
  tone = "ghost",
  className = "",
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { tone?: "brass" | "ghost" }) {
  const look = tone === "brass" ? "bg-brass text-brass-ink" : "border border-line bg-surface-2 text-fg";
  return (
    <button
      {...props}
      type={type}
      className={`min-h-11 rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-40 ${look} ${className}`}
    />
  );
}

const PLATE_INK = ["#8d8274", "#b7a48a", "#c6a15a", "#d4b56a", "#e2c27a", "#f0d48a", "#ffe7a8"];

function researchStats(id: string): [string, string][] {
  if (isUnitKind(id)) {
    const d = UNIT_BY[id];
    const range = d.minRange === d.maxRange ? String(d.maxRange) : `${d.minRange}–${d.maxRange}`;
    return [
      ["HP", String(d.hp)],
      ["Cost", String(d.cost)],
      ["Build", d.build ? `${d.build} ${d.build === 1 ? "turn" : "turns"}` : "Now"],
      ["Move", String(d.move)],
      ["Range", range],
      ["Attack", String(d.atk)],
      ["Shots", String(d.shots ?? 1)],
      ["Hit", d.atk > 0 && d.maxRange > 0 ? hitBand(d.id, d.minRange, d.maxRange) : "—"],
      ["Radar", String(d.radar ?? 0)],
      ["Armor", d.armor === "light" ? "Infantry" : d.armor === "armor" ? "Armor" : "Air"],
      ["Moves on", d.domain],
      ["Water", d.domain === "sea" ? "Sails" : d.domain === "air" ? "Flies over" : d.water ? "Can cross" : "No"],
      ["Vs troops", `${d.vs.light}×`],
      ["Vs armor", `${d.vs.armor}×`],
      ["Vs air", `${d.vs.air}×`],
      ["Vs buildings", `${d.vs.structure}×`],
      ...(d.mines ? [["Mines", String(d.mines)] as [string, string]] : []),
    ];
  }
  const d = STRUCT_BY[id as "radar"];
  if (!d) return [];
  const range = d.atk > 0 ? (d.minRange === d.maxRange ? String(d.maxRange) : `${d.minRange}–${d.maxRange}`) : "—";
  return [
    ["HP", String(d.hp)],
    ["Cost", d.cost ? String(d.cost) : "—"],
    ["Build", !d.cost ? "—" : d.build ? `${d.build} ${d.build === 1 ? "turn" : "turns"}` : "Now"],
    ["Range", range],
    ["Attack", d.atk ? String(d.atk) : "—"],
    ["Shots", d.atk ? String(d.shots ?? 1) : "—"],
    ["Hit", d.atk > 0 ? hitBand(d.id, d.minRange, d.maxRange) : "—"],
    ["Radar", String(d.radar)],
    ["Vision", String(d.vision)],
    ["Income", d.income ? `+${d.income}` : "—"],
  ];
}

function PlateCorner({ className, color, step }: { className: string; color: string; step: number }) {
  return (
    <svg className={`pointer-events-none absolute h-6 w-6 ${className}`} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M2 16 V2 H16" fill="none" stroke={color} strokeWidth={step >= 4 ? 2.4 : 1.6} />
      {step >= 2 ? <path d="M6 16 V6 H16" fill="none" stroke={color} strokeWidth="0.9" /> : null}
      {step >= 4 ? <path d="M2 9 H7 V2" fill="none" stroke={color} strokeWidth="1.2" /> : null}
      {step >= 6 ? <circle cx="5" cy="5" r="1.6" fill={color} /> : null}
    </svg>
  );
}

export function Nameplate({
  name,
  rating,
  detail,
  operator,
  dev,
}: {
  name: string;
  rating: number;
  detail?: string;
  operator?: boolean;
  dev?: boolean;
}) {
  const step = rankSteps(rating);
  const color = PLATE_INK[step] ?? PLATE_INK[0]!;
  return (
    <div className="relative inline-flex min-w-0 flex-col px-4 py-2">
      <PlateCorner className="left-0 top-0" color={color} step={step} />
      <PlateCorner className="right-0 top-0 rotate-90" color={color} step={step} />
      <PlateCorner className="right-0 bottom-0 rotate-180" color={color} step={step} />
      <PlateCorner className="left-0 bottom-0 -rotate-90" color={color} step={step} />
      {step >= 3 ? <span className="absolute top-0 left-1/2 -translate-x-1/2 text-[9px]" style={{ color }}>◆</span> : null}
      {step >= 5 ? <span className="absolute bottom-0 left-1/2 -translate-x-1/2 text-[9px]" style={{ color }}>◆</span> : null}
      <span className="text-[10px] tracking-[0.18em] uppercase" style={{ color }}>{plateTitle(rating, operator, dev)}</span>
      <span className="truncate font-display text-2xl leading-none">{name}</span>
      {detail ? <span className="text-xs text-muted">{detail}</span> : null}
    </div>
  );
}

function Shell({
  title,
  onBack,
  backLabel = "Back",
  children,
}: {
  title: string;
  onBack: () => void;
  backLabel?: string;
  children: ReactNode;
}) {
  return (
    <main className="h-dvh overflow-y-auto bg-bg text-fg">
      <div className="mx-auto flex max-w-xl flex-col gap-4 px-4 py-8">
        <div className="flex items-center justify-between gap-3">
          <h1 className="font-display text-4xl">{title}</h1>
          <Btn onClick={onBack}>{backLabel}</Btn>
        </div>
        {children}
      </div>
    </main>
  );
}

export function TurnClock({ deadline, onZero }: { deadline: number; onZero?: () => void }) {
  const [left, setLeft] = useState(() => Math.max(0, deadline - Date.now()));
  const fired = useRef(false);
  useEffect(() => {
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
  const seconds = Math.ceil(left / 1000);
  const text = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
  return (
    <p className={`font-display text-3xl leading-none tabular-nums ${seconds <= 10 ? "text-brass" : ""}`} aria-live="polite">
      {text}
    </p>
  );
}

function thisDevice(): string {
  try {
    const fromCookie = decodeURIComponent(document.cookie.match(/(?:^|; )ashveil\.device=([^;]*)/)?.[1] ?? "");
    const stored = localStorage.getItem("ashveil.device") || "";
    let device = /^[A-Za-z0-9_-]{12,80}$/.test(stored) ? stored : fromCookie;
    if (!/^[A-Za-z0-9_-]{12,80}$/.test(device)) device = `d_${crypto.randomUUID().replace(/-/g, "")}`;
    localStorage.setItem("ashveil.device", device);
    document.cookie = `ashveil.device=${encodeURIComponent(device)}; Max-Age=31536000; Path=/; SameSite=Lax`;
    return device;
  } catch {
    const fallback = (globalThis as { __ashDevice?: string }).__ashDevice || `d_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
    (globalThis as { __ashDevice?: string }).__ashDevice = fallback.slice(0, 80);
    return (globalThis as { __ashDevice?: string }).__ashDevice || "d_fallbackdevice";
  }
}

export function LoginPage({
  onDone,
  onBack,
}: {
  onDone: (token: string, user: PublicUser) => void;
  onBack: () => void;
}) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (next: "login" | "register") => {
    const who = username.trim().replace(/ +/g, " ");
    if (!who || !password) {
      setError("Type the name and the password.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const device = (() => {
        try {
          return thisDevice();
        } catch {
          return "";
        }
      })();
      const res =
        next === "login"
          ? await accountLogin({ data: { username: who, password, device } })
          : await accountRegister({ data: { username: who, password, device } });
      if (!res?.ok) {
        setError(res && "error" in res ? res.error : "Could not sign in. Try again.");
        return;
      }
      onDone(res.token, res.user);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      setError(msg && msg.length < 120 ? msg : "Could not reach the account list. Try again.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <Shell title={mode === "login" ? "Log in" : "Create account"} onBack={onBack}>
      <p className="text-sm text-muted">
        {mode === "login"
          ? "Type your name and a password. This computer will not block the login."
          : "Pick a name and a password. Nothing on this computer will stop the new account."}
      </p>
      <form
        className="flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (!busy) void submit(mode);
        }}
      >
        <label className="flex flex-col gap-1 text-sm">
          Name
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="min-h-11 rounded-lg border border-line bg-surface px-3 text-base"
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="next"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Password
          <input
            value={password}
            type="password"
            onChange={(e) => setPassword(e.target.value)}
            className="min-h-11 rounded-lg border border-line bg-surface px-3 text-base"
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            enterKeyHint="go"
          />
        </label>
        {error ? <p className="text-sm text-brass">{error}</p> : null}
        <Btn tone="brass" type="submit" disabled={busy}>
          {busy ? "Working…" : mode === "login" ? "Log in" : "Create account"}
        </Btn>
        <button
          type="button"
          className="self-start text-sm text-muted underline"
          onClick={() => {
            setMode(mode === "login" ? "register" : "login");
            setError("");
          }}
        >
          {mode === "login" ? "New here? Create an account" : "Already have an account? Log in"}
        </button>
      </form>
    </Shell>
  );
}

export function FriendsPage({
  token,
  username,
  mapId,
  hqHp,
  staff,
  purse,
  profile,
  onPurse,
  onUser,
  onBack,
  onRoom,
}: {
  token: string;
  username: string;
  mapId: string;
  hqHp: number;
  staff: boolean;
  purse: number;
  profile: PublicUser;
  onPurse: (coins: number) => void;
  onUser: (user: PublicUser) => void;
  onBack: () => void;
  onRoom: (room: RoomOk) => void;
}) {
  const [name, setName] = useState("");
  const [wipeName, setWipeName] = useState("");
  const [error, setError] = useState("");
  const [loadError, setLoadError] = useState("");
  const [friends, setFriends] = useState<FriendRow[]>([]);
  const [incoming, setIncoming] = useState<FriendRow[]>([]);
  const [outgoing, setOutgoing] = useState<FriendRow[]>([]);
  const [players, setPlayers] = useState<FriendRow[]>([]);
  const [invites, setInvites] = useState<{ code: string; from: string }[]>([]);
  const [note, setNote] = useState("");
  const [tab, setTab] = useState<"friends" | "online" | "accounts">("friends");
  const [gift, setGift] = useState<Record<string, string>>({});
  const [openHere, setOpenHere] = useState(false);
  const [sure, setSure] = useState<null | { act: "delete" | "reset" | "coins" | "unfriend"; username: string }>(null);
  const confirm = (act: "delete" | "reset" | "coins" | "unfriend", who: string, run: () => void) => {
    if (sure?.act === act && sure.username === who) {
      setSure(null);
      run();
      return;
    }
    setSure({ act, username: who });
    setNote(
      act === "delete"
        ? `Are you sure you want to delete ${who}?`
        : act === "reset"
          ? `Are you sure you want to reset ${who}?`
          : act === "coins"
            ? `Are you sure you want to give coins to ${who}?`
            : `Are you sure you want to remove ${who}?`,
    );
  };
  const unique = (rows: FriendRow[]) => {
    const seen = new Set<string>();
    return rows.filter((row) => {
      const key = `${row.id}|${row.username.toLowerCase()}`;
      if (seen.has(row.id) || seen.has(key) || seen.has(row.username.toLowerCase())) return false;
      seen.add(row.id);
      seen.add(key);
      seen.add(row.username.toLowerCase());
      return true;
    });
  };
  const onlineNow = unique(players.filter((row) => row.online));
  const clearLists = () => {
    setFriends([]);
    setIncoming([]);
    setOutgoing([]);
    setPlayers([]);
    setInvites([]);
  };
  const resetHere = () => {
    clearLists();
    setLoadError("");
    setError("");
    setNote("Resetting this device and loading every account again.");
    try {
      sessionStorage.removeItem("ashveil.room");
      if ("caches" in window) void caches.keys().then((keys) => Promise.all(keys.map((key) => caches.delete(key))));
    } catch {
      /* this browser can still reload */
    }
    const url = new URL(window.location.href);
    url.searchParams.set("fresh", String(Date.now()));
    window.location.replace(url.toString());
  };
  const load = async () => {
    try {
      const res = await friendList({ data: { token } });
      if (!res.ok) {
        setLoadError(res.error.length < 120 ? res.error : "Could not load friends.");
        if (res.error === "Sign in again.") clearLists();
        return;
      }
      setLoadError("");
      const nextFriends = unique(res.friends);
      const taken = new Set(nextFriends.map((row) => row.username.toLowerCase()));
      setFriends(nextFriends);
      setIncoming(unique(res.incoming).filter((row) => !taken.has(row.username.toLowerCase())));
      setOutgoing(unique(res.outgoing).filter((row) => !taken.has(row.username.toLowerCase())));
      setPlayers(unique(res.players));
      setInvites(res.invites);
      try {
        sessionStorage.removeItem("ashveil.friendReload");
      } catch {
        /* ignore */
      }
      try {
        const mine = await accountMe({ data: { token } });
        if (mine.ok) onUser(mine.user);
      } catch {
        /* the friend list already loaded */
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      if (msg.includes("content-type")) {
        try {
          if (!sessionStorage.getItem("ashveil.friendReload")) {
            sessionStorage.setItem("ashveil.friendReload", "1");
            window.location.reload();
            return;
          }
        } catch {
          /* show the error below */
        }
      }
      setLoadError(msg && msg.length < 120 ? msg : "Could not load friends.");
    }
  };
  const add = (username: string) => {
    const who = username.trim();
    if (!who) {
      setError("Type their account name, or press Add next to a player.");
      return;
    }
    void friendAdd({ data: { token, username: who } })
      .then((res) => {
        if (!res.ok) setError(res.error);
        else {
          setName("");
          setError("");
          setNote(
            res.pending
              ? `Request sent to ${who}. They have to accept before you can invite them.`
              : `${who} accepted. You can invite them.`,
          );
          void load();
        }
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Could not send that request."));
  };
  const loadRef = useRef(load);
  loadRef.current = load;
  useEffect(() => {
    let stop = false;
    let busy = false;
    const tick = async () => {
      if (stop || busy) return;
      busy = true;
      try {
        await loadRef.current();
      } finally {
        busy = false;
      }
    };
    void tick();
    const id = window.setInterval(() => void tick(), 1500);
    const refresh = () => {
      if (document.visibilityState === "hidden") return;
      void tick();
    };
    window.addEventListener("pageshow", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      stop = true;
      window.clearInterval(id);
      window.removeEventListener("pageshow", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [token]);
  useEffect(() => {
    if (!staff) return;
    let device = "";
    try {
      device = thisDevice();
    } catch {
      return;
    }
    void accountDevice({ data: { token, device } }).then((res) => {
      if (res.ok) setOpenHere(res.open);
    });
  }, [staff, token]);
  return (
    <Shell title="Friends" onBack={onBack}>
      <p className="text-sm text-muted">Signed in as {username}. {profile.rank} · {profile.rating} · {profile.wins}–{profile.losses} · {profile.rp} research · {purse} coins. This page refreshes on its own.</p>
      <div className="flex flex-wrap items-center gap-2">
        <Btn onClick={resetHere}>Reset this device</Btn>
        <p className="text-sm text-muted">Use this if the account list here is wrong. Other devices are already showing the full list. This reloads this one from the server and does not delete any accounts.</p>
      </div>
      <form
        className="flex flex-wrap gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          add(name);
        }}
      >
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Their name"
          className="min-h-11 flex-1 rounded-lg border border-line bg-surface px-3 text-base"
        />
        <Btn tone="brass" type="submit">
          Add
        </Btn>
      </form>
      {note ? <p className="text-sm text-brass">{note}</p> : null}
      {error ? <p className="text-sm text-brass">{error}</p> : null}
      {loadError ? <p className="text-sm text-brass">{loadError}</p> : null}
      {staff ? (
        <form
          className="flex flex-wrap gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const who = wipeName.trim();
            if (!who) {
              setError("Type the account name to delete.");
              return;
            }
            confirm("delete", who, () => {
              void accountDelete({ data: { token, username: who } }).then((res) => {
                if (!res.ok) setError(res.error);
                else {
                  setWipeName("");
                  setError("");
                  setNote(`${who} was deleted.`);
                  void load();
                }
              });
            });
          }}
        >
          <input
            value={wipeName}
            onChange={(e) => setWipeName(e.target.value)}
            placeholder="Account to delete"
            className="min-h-11 flex-1 rounded-lg border border-line bg-surface px-3 text-base"
          />
          <Btn type="submit">{sure?.act === "delete" && sure.username === wipeName.trim() ? "Are you sure?" : "Delete account"}</Btn>
        </form>
      ) : null}
      <div className="flex gap-2">
        {(
          [
            ["friends", "Friends"],
            ["online", "Online"],
            ["accounts", "Accounts"],
          ] as const
        ).map(([id, label]) => (
          <Btn key={id} tone={tab === id ? "brass" : "ghost"} onClick={() => setTab(id)}>
            {label}
            {id === "online" ? ` ${onlineNow.length}` : ""}
          </Btn>
        ))}
      </div>
      {tab === "accounts" ? (
        <section className="flex flex-col gap-2">
          <h2 className="font-display text-2xl">Accounts</h2>
          <p className="text-sm text-muted">{`You have ${purse} coins. Give coins adds that many to them and does not take any from you. Press the button again to confirm.`}</p>
          {staff ? (
            <>
              <p className="text-sm text-muted">Operator tools. Delete removes that account from every device. Reset rank sets them back to Sergeant at 1000. Give coins does not come out of your purse.</p>
              <Btn
                tone={openHere ? "brass" : "ghost"}
                onClick={() => {
                  let device = "";
                  try {
                    device = thisDevice();
                  } catch {
                    setError("This computer could not be recognized.");
                    return;
                  }
                  void accountDevice({ data: { token, device, open: !openHere } }).then((res) => {
                    if (!res.ok) setError(res.error);
                    else {
                      setOpenHere(res.open);
                      setNote(res.open ? "This computer can hold more than one account." : "This computer is locked to one account.");
                    }
                  });
                }}
              >
                {openHere ? "Extra accounts on" : "Allow more accounts here"}
              </Btn>
            </>
          ) : null}
          {players.length === 0 ? (
            <p className="text-sm text-muted">No accounts are saved on this server yet.</p>
          ) : (
            <p className="text-sm text-muted">{players.length} account{players.length === 1 ? "" : "s"} on this server. Your friend sees this same list when they open this same game.</p>
          )}
          {players.map((row) => {
            const mine = row.username.toLowerCase() === username.toLowerCase();
            const friend = friends.some((item) => item.id === row.id);
            const request = incoming.some((item) => item.id === row.id);
            const sent = outgoing.some((item) => item.id === row.id);
            return (
            <div key={row.id} className="flex flex-col gap-2 rounded-lg border border-line p-3">
              <Nameplate name={row.username} rating={row.rating} operator={row.operator} dev={row.dev} detail={`${row.rating}${mine ? " · You" : ""}${friend ? " · Friend" : ""}${staff ? ` · ${row.coins} coins` : ""}`} />
              <span className="flex flex-wrap justify-end gap-2">
                {mine ? (
                  <span className="self-center text-sm text-muted">This account</span>
                ) : friend ? (
                  <span className="self-center text-sm text-muted">Friends</span>
                ) : request ? (
                  <Btn
                    tone="brass"
                    onClick={() =>
                      void friendAnswer({ data: { token, username: row.username, accept: true } }).then((res) => {
                        if (!res.ok) setError(res.error);
                        else void load();
                      })
                    }
                  >
                    Accept
                  </Btn>
                ) : sent ? (
                  <span className="self-center text-sm text-muted">Request sent</span>
                ) : (
                  <Btn tone="brass" onClick={() => add(row.username)}>
                    Request
                  </Btn>
                )}
                <input
                  type="number"
                  min={1}
                  max={100000}
                  value={gift[row.id] ?? ""}
                  aria-label={`Coins for ${row.username}`}
                  placeholder="Coins"
                  onChange={(e) => setGift((prev) => ({ ...prev, [row.id]: e.target.value }))}
                  className="min-h-11 w-24 rounded-lg border border-line bg-surface px-2 text-base"
                />
                <Btn
                  onClick={() => {
                    const amount = Math.round(Number(gift[row.id]));
                    if (!Number.isFinite(amount) || amount < 1) {
                      setError("Type how many coins to give.");
                      return;
                    }
                    confirm("coins", row.username, () => {
                      void accountGiveCoins({ data: { token, username: row.username, amount } }).then((res) => {
                        if (!res.ok) setError(res.error);
                        else {
                          onPurse(res.mine);
                          setNote(mine ? `Added ${amount} coins to your account. You now have ${res.coins}.` : `Gave ${amount} coins to ${row.username}. Your coins stayed ${res.mine}.`);
                          void load();
                        }
                      });
                    });
                  }}
                >
                  {sure?.act === "coins" && sure.username === row.username ? "Are you sure?" : mine ? "Give me coins" : "Give coins"}
                </Btn>
                {staff ? (
                  <>
                    <Btn
                      onClick={() => {
                        confirm("reset", row.username, () => {
                          void accountResetRank({ data: { token, username: row.username } }).then((res) => {
                            if (!res.ok) setError(res.error);
                            else {
                              setNote(`${row.username} is back to Sergeant, 1000.`);
                              void load();
                            }
                          });
                        });
                      }}
                    >
                      {sure?.act === "reset" && sure.username === row.username ? "Are you sure?" : "Reset rank"}
                    </Btn>
                    <Btn
                      onClick={() => {
                        confirm("delete", row.username, () => {
                          void accountDelete({ data: { token, username: row.username } }).then((res) => {
                            if (!res.ok) setError(res.error);
                            else {
                              setNote(`${row.username} was deleted.`);
                              void load();
                            }
                          });
                        });
                      }}
                    >
                      {sure?.act === "delete" && sure.username === row.username ? "Are you sure?" : "Delete"}
                    </Btn>
                  </>
                ) : null}
              </span>
            </div>
            );
          })}
        </section>
      ) : null}
      {incoming.length ? (
        <section className="flex flex-col gap-2">
          <h2 className="font-display text-2xl">Requests</h2>
          {incoming.map((row) => (
            <div key={row.id} className="flex items-center justify-between gap-2">
              <Nameplate name={row.username} rating={row.rating} operator={row.operator} dev={row.dev} detail="Wants to be friends" />
              <span className="flex gap-2">
                <Btn
                  tone="brass"
                  onClick={() =>
                  void friendAnswer({ data: { token, username: row.username, accept: true } }).then((res) => {
                    if (!res.ok) setError(res.error);
                    else void load();
                  })
                  }
                >
                  Accept
                </Btn>
                <Btn
                  onClick={() =>
                    void friendAnswer({ data: { token, username: row.username, accept: false } }).then((res) => {
                      if (!res.ok) setError(res.error);
                      else void load();
                    })
                  }
                >
                  Decline
                </Btn>
              </span>
            </div>
          ))}
        </section>
      ) : null}
      {invites.length ? (
        <section className="flex flex-col gap-2">
          <h2 className="font-display text-2xl">Game invites</h2>
          {invites.map((row) => (
            <div key={row.code} className="flex items-center justify-between gap-2 rounded-lg border border-line px-3 py-2">
              <p className="text-sm">
                {row.from} invited you. Code <span className="font-display text-xl">{row.code}</span>
              </p>
              <Btn
                tone="brass"
                onClick={() =>
                  void roomJoin({ data: { token, code: row.code } }).then((res) => {
                    if (!res.ok) setError(res.error);
                    else onRoom(res);
                  }).catch(() => setError("Could not join that game."))
                }
              >
                Join
              </Btn>
            </div>
          ))}
        </section>
      ) : null}
      {tab === "online" ? (
        <section className="flex flex-col gap-2">
          <h2 className="font-display text-2xl">Online now</h2>
          <p className="text-sm text-muted">Anyone with the game open on this same link. A friend can still be invited from the Friends tab if the dot is late.</p>
          {onlineNow.length === 0 ? (
            <p className="text-sm text-muted">Nobody else is signed in right now.</p>
          ) : null}
          {onlineNow.map((row) => (
              <div key={row.id} className="flex flex-col gap-2 rounded-lg border border-line p-3">
                <Nameplate name={row.username} rating={row.rating} operator={row.operator} dev={row.dev} detail={`${row.rating} · Online`} />
                {friends.some((friend) => friend.id === row.id) ? (
                  <Btn
                    tone="brass"
                    onClick={() =>
                      void roomInvite({ data: { token, username: row.username, mapId, hqHp } }).then((res) => {
                        if (!res.ok) setError(res.error);
                        else onRoom(res);
                      }).catch(() => setError("Could not send that invite."))
                    }
                  >
                    Invite
                  </Btn>
                ) : row.pending ? (
                  <span className="text-sm text-muted">Request sent</span>
                ) : row.incoming ? (
                  <Btn
                    tone="brass"
                    onClick={() =>
                      void friendAnswer({ data: { token, username: row.username, accept: true } }).then((res) => {
                        if (!res.ok) setError(res.error);
                        else void load();
                      })
                    }
                  >
                    Accept
                  </Btn>
                ) : (
                  <Btn tone="brass" onClick={() => add(row.username)}>
                    Request
                  </Btn>
                )}
              </div>
            ))}
        </section>
      ) : null}
      {tab === "friends" ? (
        <section className="flex flex-col gap-2">
          <h2 className="font-display text-2xl">Your friends</h2>
          {friends.length === 0 ? <p className="text-sm text-muted">None yet. Friend someone from Accounts.</p> : null}
          {friends.map((row) => (
            <div key={row.id} className="flex flex-col gap-2 rounded-lg border border-line p-3">
              <Nameplate name={row.username} rating={row.rating} operator={row.operator} dev={row.dev} detail={`${row.rating} · ${row.coins} coins · ${row.online ? "Online" : "Offline"}`} />
              <Btn
                tone="brass"
                onClick={() =>
                  void roomInvite({ data: { token, username: row.username, mapId, hqHp } }).then((res) => {
                    if (!res.ok) setError(res.error);
                    else onRoom(res);
                  }).catch(() => setError("Could not send that invite."))
                }
              >
                Invite
              </Btn>
              <Btn
                onClick={() => {
                  confirm("unfriend", row.username, () => {
                    void friendRemove({ data: { token, username: row.username } }).then((res) => {
                      if (!res.ok) setError(res.error);
                      else {
                        setNote(`${row.username} was removed.`);
                        void load();
                      }
                    });
                  });
                }}
              >
                {sure?.act === "unfriend" && sure.username === row.username ? "Are you sure?" : "Remove"}
              </Btn>
              {staff ? (
                <Btn
                  onClick={() => {
                    confirm("delete", row.username, () => {
                      void accountDelete({ data: { token, username: row.username } }).then((res) => {
                        if (!res.ok) setError(res.error);
                        else {
                          setNote(`${row.username} was deleted.`);
                          void load();
                        }
                      });
                    });
                  }}
                >
                  {sure?.act === "delete" && sure.username === row.username ? "Are you sure?" : "Delete"}
                </Btn>
              ) : null}
            </div>
          ))}
        </section>
      ) : null}
      {outgoing.length ? (
        <section className="flex flex-col gap-2">
          <h2 className="font-display text-2xl">Waiting on them</h2>
          {outgoing.filter((row) => !friends.some((friend) => friend.id === row.id)).map((row) => (
            <div key={row.id} className="flex items-center justify-between gap-2">
              <Nameplate name={row.username} rating={row.rating} operator={row.operator} dev={row.dev} detail="Has not accepted yet" />
              <Btn
                onClick={() => {
                  confirm("unfriend", row.username, () => {
                    void friendRemove({ data: { token, username: row.username } }).then((res) => {
                      if (!res.ok) setError(res.error);
                      else {
                        setNote(`Request to ${row.username} was canceled.`);
                        void load();
                      }
                    });
                  });
                }}
              >
                {sure?.act === "unfriend" && sure.username === row.username ? "Are you sure?" : "Cancel"}
              </Btn>
            </div>
          ))}
        </section>
      ) : null}
    </Shell>
  );
}

export function ResearchPage({
  user,
  token,
  onBack,
  onUser,
}: {
  user: PublicUser;
  token: string;
  onBack: () => void;
  onUser: (user: PublicUser) => void;
}) {
  const [error, setError] = useState("");
  const [pay, setPay] = useState<Record<string, number>>({});
  const [tip, setTip] = useState("");
  const [chest, setChest] = useState<null | "daily" | "field" | "supply" | "arsenal">(null);
  const [loot, setLoot] = useState<{ rp: number; coins: number; lines?: string[] } | null>(null);
  const [opening, setOpening] = useState(false);
  const [lane, setLane] = useState<ResearchNode["line"] | "Chests" | "Kit">("Rifles");
  const [jump, setJump] = useState(0);
  const board = useRef<HTMLDivElement>(null);
  const shownFocus = user.focus || user.lastFocus || "";
  const nameOf = (id: string) => (isUnitKind(id) ? UNIT_BY[id].name : STRUCT_BY[id as "radar"].name);
  useEffect(() => {
    if (!jump || !shownFocus) return;
    const frame = window.requestAnimationFrame(() => {
      const shell = board.current;
      const card = document.getElementById(`research-${shownFocus}`);
      if (!shell || !card) return;
      const shellBox = shell.getBoundingClientRect();
      const cardBox = card.getBoundingClientRect();
      shell.scrollLeft += cardBox.left - shellBox.left - shellBox.width / 2 + cardBox.width / 2;
      shell.scrollTop += cardBox.top - shellBox.top - shellBox.height / 2 + cardBox.height / 2;
    });
    return () => window.cancelAnimationFrame(frame);
  }, [jump, lane, shownFocus]);
  const upgrades = (id: string) => (
    <span className="flex flex-wrap gap-1">
      {MOD_OFFERS.filter((offer) => {
        if (!isUnitKind(id)) return false;
        const def = UNIT_BY[id];
        if (offer.slot === "gun" && def.atk <= 0) return false;
        if (offer.slot === "engine" && def.move <= 0) return false;
        return true;
      }).map((offer) =>
        ownsMod(user.mods, id, offer.slot) ? (
          <span key={offer.slot} className="text-xs text-muted" onMouseEnter={() => showTip(offer)} onFocus={() => showTip(offer)}>
            {offer.name} fitted
          </span>
        ) : (
          <Btn
            key={offer.slot}
            disabled={user.coins < offer.coins}
            onMouseEnter={() => showTip(offer)}
            onFocus={() => showTip(offer)}
            onClick={() => {
              setError("");
              void accountUpgrade({ data: { token, id, slot: offer.slot } }).then((res) => {
                if (!res.ok) setError(res.error);
                else onUser(res.user);
              });
            }}
          >
            {offer.name} {offer.coins}
          </Btn>
        ),
      )}
    </span>
  );
  const showTip = (offer: (typeof MOD_OFFERS)[number]) => setTip(`${offer.name}: ${offer.blurb}. Costs ${offer.coins} coins. It applies the next time you build that unit.`);
  const kidsOf = (id: string) => RESEARCH.filter((node) => node.after === id);
  const nodeCard = (node: ResearchNode) => {
    const have = isDiscovered(user.unlocked, node.id);
    const prev = node.after ? nameOf(node.after) : null;
    const prevReady = !node.after || isDiscovered(user.unlocked, node.after);
    const banked = user.focus === node.id ? user.focusRp || 0 : 0;
    const left = Math.max(0, node.rp - banked);
    const typed = Math.max(0, Math.round(Number(pay[node.id]) || 0));
    const coinPart = Math.min(left, user.coins, typed);
    const researchPart = Math.max(0, left - coinPart);
    const allCoins = Math.min(left, user.coins);
    const canDiscover = prevReady && user.rp >= researchPart && (coinPart > 0 || researchPart > 0 || left === 0);
    const forks = kidsOf(node.id).length;
    const focused = user.focus === node.id;
    return (
      <div className={`flex w-56 shrink-0 snap-start flex-col gap-2 rounded-lg border p-3 ${focused ? "border-brass bg-surface ring-2 ring-brass" : have ? "border-2 border-brass bg-brass/15" : prevReady ? "border-line bg-surface-2" : "border-line bg-surface-2 opacity-60"}`} id={`research-${node.id}`}>
        <span className="font-display text-xl">{nameOf(node.id)}</span>
        {have ? (
          <span className="rounded bg-brass px-2 py-1 text-center text-xs font-bold tracking-widest text-brass-ink uppercase">Discovered</span>
        ) : (
          <span className="text-xs text-muted">
            {prev && !prevReady ? `Locked until ${prev}` : focused ? `${banked}/${node.rp} from battles` : `${node.rp} research`}
          </span>
        )}
        {focused && !have ? (
          <span className="h-2 overflow-hidden rounded-full bg-black/40">
            <span className="block h-full bg-brass" style={{ width: `${Math.min(100, Math.round((banked / node.rp) * 100))}%` }} />
          </span>
        ) : null}
        {node.after ? <span className="text-xs text-muted">After {nameOf(node.after)}</span> : null}
        <dl className="grid grid-cols-2 gap-x-2 gap-y-0.5">
          {researchStats(node.id).map(([label, value]) => (
            <div key={label} className="flex items-baseline justify-between gap-1 text-xs">
              <dt className="text-muted">{label}</dt>
              <dd className="tabular-nums">{value}</dd>
            </div>
          ))}
        </dl>
        <span className="text-xs text-muted">{isUnitKind(node.id) ? UNIT_BY[node.id].blurb : STRUCT_BY[node.id as "radar"]?.blurb}</span>
        {forks > 1 ? <span className="text-xs text-brass">Separates into {forks} lanes</span> : null}
        {have && isUnitKind(node.id) ? upgrades(node.id) : null}
        {have && !isUnitKind(node.id) ? <span className="text-xs text-muted">Ready to buy</span> : null}
        {!have && prevReady ? (
          <Btn
            tone={focused ? "brass" : "ghost"}
            onClick={() => {
              setError("");
              void accountFocus({ data: { token, id: node.id } }).then((res) => {
                if (!res.ok) setError(res.error);
                else onUser(res.user);
              });
            }}
          >
            {focused ? "Focused" : "Focus"}
          </Btn>
        ) : null}
        {!have ? (
          <span className="flex flex-col gap-1">
            <span className="text-xs text-muted">
              {`${node.rp} total`}
              {banked > 0 ? ` · ${banked} filled` : ""}
              {` · ${left} left`}
            </span>
            <span className="text-xs text-muted">
              {typed > 0
                ? `Discover spends ${coinPart} coins and ${researchPart} research.`
                : `Discover spends ${left} research. All coins spends ${allCoins} coins and no research.`}
            </span>
            <input
              type="number"
              min={0}
              max={Math.min(left, user.coins)}
              value={pay[node.id] ?? 0}
              aria-label={`Coins for ${nameOf(node.id)}`}
              disabled={!prevReady}
              onChange={(e) => {
                const n = Math.max(0, Math.round(Number(e.target.value) || 0));
                setPay((prevPay) => ({ ...prevPay, [node.id]: Math.min(left, user.coins, n) }));
              }}
              className="min-h-11 w-full rounded-lg border border-line bg-surface px-2 text-base"
            />
            <Btn
              tone="brass"
              disabled={!prevReady || user.coins <= 0 || left <= 0}
              onClick={() => {
                const spend = typed > 0 ? coinPart : allCoins;
                if (spend <= 0) return;
                setError("");
                void accountResearch({ data: { token, id: node.id, coins: spend } }).then((res) => {
                  if (!res.ok) setError(res.error);
                  else {
                    onUser(res.user);
                    setPay((prevPay) => ({ ...prevPay, [node.id]: 0 }));
                    setError(spend >= left ? `Discovered with ${spend} coins. Research was not spent. ${res.user.coins} coins left.` : `${spend} coins filled this unit. ${res.user.coins} coins left. Research was not spent.`);
                  }
                });
              }}
            >
              {typed > 0 ? "Add coins" : "All coins"}
            </Btn>
            <Btn
              disabled={!canDiscover}
              onClick={() => {
                setError("");
                void accountResearch({ data: { token, id: node.id, coins: coinPart, finish: true } }).then((res) => {
                  if (!res.ok) setError(res.error);
                  else {
                    onUser(res.user);
                    setPay((prevPay) => ({ ...prevPay, [node.id]: 0 }));
                  }
                });
              }}
            >
              Discover
            </Btn>
          </span>
        ) : null}
      </div>
    );
  };
  const drawTree = (node: ResearchNode): ReactNode => {
    const kids = kidsOf(node.id);
    return (
      <div key={node.id} className="flex shrink-0 items-center gap-2">
        {nodeCard(node)}
        {kids.length ? <span className="text-brass" aria-hidden="true">→</span> : null}
        {kids.length === 1 ? drawTree(kids[0]!) : null}
        {kids.length > 1 ? (
          <div className="flex flex-col gap-5 border-l-4 border-brass pl-3">
            {kids.map((kid) => (
              <div key={kid.id} className="flex items-center">
                {drawTree(kid)}
              </div>
            ))}
          </div>
        ) : null}
      </div>
    );
  };
  return (
    <main className="fixed inset-0 z-50 flex h-dvh w-screen flex-col overflow-hidden bg-bg text-fg">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3">
        <h1 className="font-display text-4xl">Research</h1>
        <div className="text-center">
          <p className="font-display text-3xl leading-none tabular-nums text-brass">{user.coins}</p>
          <p className="text-xs text-muted">{user.rp} research{user.focus ? ` · Focus ${nameOf(user.focus)} ${user.focusRp || 0}` : shownFocus ? ` · Last focus ${nameOf(shownFocus)}` : ""}</p>
        </div>
        <div className="flex gap-2">
          <Btn
            tone="brass"
            disabled={!shownFocus}
            onClick={() => {
              const node = RESEARCH.find((item) => item.id === shownFocus);
              if (!node) return;
              setLane(node.line);
              setJump((n) => n + 1);
            }}
          >
            {shownFocus ? `Show ${nameOf(shownFocus)}` : "Show focus"}
          </Btn>
          <Btn onClick={onBack}>Back</Btn>
        </div>
      </div>
      <div className="flex gap-2 overflow-x-auto border-b border-line px-4 py-2">
        {(
          [
            ["Rifles", "Rifles"],
            ["Snipers", "Snipers"],
            ["Minelayers", "Mines"],
            ["Armor", "Armor"],
            ["Air", "Air"],
            ["Fleet", "Sea"],
            ["Works", "Base"],
            ["Chests", "Chests"],
            ["Kit", "Basic kit"],
          ] as const
        ).map(([id, label]) => (
          <Btn key={id} tone={lane === id ? "brass" : "ghost"} onClick={() => setLane(id)}>
            {label}
          </Btn>
        ))}
      </div>
      <p className="px-4 pt-3 text-sm text-muted">
        Press Focus on the next unit you want. Research you earn, and research already in your pool, fills that unit until it is discovered. A win fills more than a loss. Coins you add count toward that bar even if they do not finish it. Scroll the board in any direction.
      </p>
      <p className="min-h-5 px-4 text-sm text-brass">{tip || error || "Hover an upgrade to see what it does."}</p>
      {lane === "Chests" ? (
        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-auto px-4 py-4">
        <h2 className="font-display text-2xl">Chests</h2>
        <p className="text-sm text-muted">Daily streak {user.streak || 0}/7. You have {user.coins} coins. Buy a chest, or open the daily one.</p>
        <div className="flex flex-wrap gap-2">
          <Btn tone="brass" onClick={() => { setLoot(null); setChest("daily"); }}>
            Daily chest
          </Btn>
          {(
            [
              ["field", "Field chest · 40"],
              ["supply", "Supply chest · 90"],
              ["arsenal", "Arsenal chest · 160"],
            ] as const
          ).map(([kind, label]) => (
            <Btn key={kind} onClick={() => { setLoot(null); setChest(kind); }}>
              {label}
            </Btn>
          ))}
        </div>
        {chest ? (
          <div className="flex flex-col items-center gap-3 overflow-hidden rounded-lg border border-line bg-[#14110e] px-4 py-6">
            <svg viewBox="0 0 280 220" className="h-64 w-full max-w-md" aria-hidden="true">
              <defs>
                <linearGradient id="lid" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stopColor={chest === "arsenal" ? "#8d1e24" : chest === "supply" ? "#1f6f78" : chest === "field" ? "#5d6a3a" : "#e6c56a"} />
                  <stop offset="0.45" stopColor={chest === "arsenal" ? "#4a1014" : chest === "supply" ? "#0e3e46" : chest === "field" ? "#32381f" : "#a67c32"} />
                  <stop offset="1" stopColor="#1a120c" />
                </linearGradient>
                <linearGradient id="body" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stopColor="#6a4a2c" />
                  <stop offset="0.4" stopColor="#3a2616" />
                  <stop offset="1" stopColor="#1c120c" />
                </linearGradient>
                <linearGradient id="iron" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0" stopColor="#f4efe4" />
                  <stop offset="0.4" stopColor="#8d8680" />
                  <stop offset="1" stopColor="#2a2622" />
                </linearGradient>
                <radialGradient id="glow" cx="50%" cy="40%" r="50%">
                  <stop offset="0" stopColor={chest === "arsenal" ? "#ff5a3c" : chest === "supply" ? "#7ee7e1" : chest === "field" ? "#d6e38a" : "#ffe7a3"} stopOpacity="0.55" />
                  <stop offset="1" stopColor="#14110e" stopOpacity="0" />
                </radialGradient>
              </defs>
              <ellipse cx="140" cy="118" rx="120" ry="70" fill="url(#glow)" />
              <ellipse cx="140" cy="196" rx="92" ry="12" fill="#000" opacity="0.45" />
              <g style={{ transform: loot ? "translateY(-36px)" : undefined, transition: "transform 0.45s ease" }}>
                <path d="M46 118c8-62 180-62 188 0" fill="url(#lid)" stroke="#0c0907" strokeWidth="4" />
                <path d="M62 96c10-28 146-28 156 0" fill="none" stroke="#fff4d2" strokeWidth="3" opacity="0.35" />
              </g>
              <rect x="38" y="112" width="204" height="74" rx="8" fill="url(#body)" stroke="#0c0907" strokeWidth="4" />
              <rect x="38" y="128" width="204" height="16" fill="url(#iron)" opacity="0.85" />
              <rect x="38" y="168" width="204" height="10" fill="url(#iron)" opacity="0.7" />
              <rect x="128" y="96" width="24" height="86" fill="url(#iron)" />
              {[58, 222].map((x) => (
                <g key={x}>
                  <circle cx={x} cy="136" r="4" fill="#1a140e" />
                  <circle cx={x} cy="173" r="4" fill="#1a140e" />
                </g>
              ))}
              <rect x="112" y="132" width="56" height="42" rx="6" fill="#1a140e" stroke="url(#iron)" strokeWidth="3" />
              <path d="M122 132v-10a18 18 0 0 1 36 0v10" fill="none" stroke="url(#iron)" strokeWidth="6" opacity={loot ? 0 : 1} />
              <circle cx="140" cy="150" r="6" fill={chest === "arsenal" ? "#ff5a3c" : "#f4e7bc"} />
              <rect x="137" y="154" width="6" height="12" rx="1" fill="#c8b48a" />
            </svg>
            <p className="font-display text-3xl">
              {chest === "daily" ? "Daily chest" : chest === "field" ? "Field chest" : chest === "supply" ? "Supply chest" : "Arsenal chest"}
            </p>
            <p className="text-sm tracking-widest text-brass uppercase">
              {loot ? "Opened" : chest === "daily" ? "Free once a day" : chest === "field" ? "40 coins" : chest === "supply" ? "90 coins" : "160 coins"}
            </p>
            {loot?.lines?.length ? (
              <ul className="flex flex-col gap-1 text-center">
                {loot.lines.map((line, i) => (
                  <li key={`${i}-${line}`} className="font-display text-xl">{line}</li>
                ))}
              </ul>
            ) : (
              <p className="max-w-sm text-center text-sm text-muted">
                Can hold research, coins, the next unit on a line you already started, a gun engine or plate, or progress on your focus.
              </p>
            )}
            <div className="flex gap-2">
              <Btn
                tone="brass"
                disabled={opening || (chest !== "daily" && user.coins < (chest === "field" ? 40 : chest === "supply" ? 90 : 160))}
                onClick={() => {
                  if (!chest) return;
                  setOpening(true);
                  setError("");
                  void accountChest({ data: { token, kind: chest } }).then((res) => {
                    setOpening(false);
                    if (!res.ok) setError(res.error);
                    else {
                      onUser(res.user);
                      setLoot(res.loot);
                    }
                  });
                }}
              >
                {opening ? "Opening…" : chest === "daily" ? "Open" : "Buy and open"}
              </Btn>
              <Btn onClick={() => { setChest(null); setLoot(null); }}>Back</Btn>
            </div>
          </div>
        ) : null}
        </div>
      ) : lane === "Kit" ? (
      <section className="flex min-h-0 flex-1 flex-col gap-2 overflow-auto px-4 py-4">
        <h2 className="font-display text-2xl">Basic kit</h2>
        <p className="text-sm text-muted">You start with these even if you have discovered nothing. The number is what they cost to field.</p>
        <div className="flex flex-wrap gap-2 pb-2">
          {BASIC_KIT.map((id) => (
            <div key={id} className="flex w-36 shrink-0 flex-col gap-1 rounded-lg border-2 border-brass bg-brass/15 p-3">
              <span className="rounded bg-brass px-2 py-1 text-center text-xs font-bold tracking-widest text-brass-ink uppercase">Discovered</span>
              <span className="font-display text-lg">{nameOf(id)}</span>
              <span className="font-display text-lg text-brass">Cost {isUnitKind(id) ? UNIT_BY[id].cost : STRUCT_BY[id].cost}</span>
            </div>
          ))}
        </div>
        <h2 className="font-display text-2xl">Upgrades</h2>
        <p className="text-sm text-muted">Gun, Engine, and Plate can all be bought on the same unit. Each one stays after you buy it. They apply the next time that unit is built.</p>
        {BUY_ORDER.filter((id) => isUnitKind(id) && isDiscovered(user.unlocked, id)).map((id) => (
          <div key={id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line bg-surface p-3">
            <span className="font-display text-xl">{nameOf(id)}</span>
            {upgrades(id)}
          </div>
        ))}
      </section>
      ) : (
      <div ref={board} className="min-h-0 flex-1 overflow-auto">
        <div className="inline-flex min-h-full min-w-full items-center p-6">
          {(() => {
            const groups = new Map<string, ResearchNode[]>();
            for (const node of lineRoots(lane)) {
              const key = node.after ?? "";
              groups.set(key, [...(groups.get(key) ?? []), node]);
            }
            return [...groups.entries()].map(([parent, nodes]) => (
              <div key={parent || lane} className="flex items-stretch gap-2">
                {parent ? (
                  <div className={`flex w-36 shrink-0 flex-col items-center justify-center gap-2 rounded-lg border p-3 text-center ${isDiscovered(user.unlocked, parent) ? "border-2 border-brass bg-brass/15" : "border-line bg-surface"}`}>
                    <span className="font-display text-lg">{nameOf(parent)}</span>
                    {isDiscovered(user.unlocked, parent) ? (
                      <span className="rounded bg-brass px-2 py-1 text-xs font-bold tracking-widest text-brass-ink uppercase">Discovered</span>
                    ) : (
                      <span className="text-xs text-muted">Not discovered</span>
                    )}
                  </div>
                ) : null}
                <span className="self-center text-brass" aria-hidden="true">{nodes.length > 1 ? "⇉" : "→"}</span>
                <div className={nodes.length > 1 ? "flex flex-col gap-5 border-l-4 border-brass pl-3" : "flex"}>
                  {nodes.map((node) => (
                    <div key={node.id}>{drawTree(node)}</div>
                  ))}
                </div>
              </div>
            ));
          })()}
        </div>
      </div>
      )}
    </main>
  );
}

export function AdminPage({ token, onBack }: { token: string; onBack: () => void }) {
  const [players, setPlayers] = useState<FriendRow[]>([]);
  const [gift, setGift] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [sure, setSure] = useState<null | { act: "grant" | "take" | "kit" | "delete" | "reset" | "admin"; username: string }>(null);
  const [word, setWord] = useState("");
  const [payWord, setPayWord] = useState("");
  const [payAmount, setPayAmount] = useState("500");
  const [liveWord, setLiveWord] = useState("");
  const [livePay, setLivePay] = useState(0);
  const load = async () => {
    const res = await friendList({ data: { token } });
    if (!res.ok) setError(res.error);
    else {
      setError("");
      setPlayers(res.players);
    }
  };
  useEffect(() => {
    void load();
    void accountCommand({ data: { token, word: "" } }).then((res) => {
      if (!res.ok) return;
      setLiveWord(res.word);
      setLivePay(res.payout);
      if (res.word) setPayWord(res.word);
      if (res.payout) setPayAmount(String(res.payout));
    });
  }, [token]);
  const confirm = (act: "grant" | "take" | "kit" | "delete" | "reset" | "admin", who: string, run: () => void) => {
    if (sure?.act === act && sure.username === who) {
      setSure(null);
      run();
      return;
    }
    setSure({ act, username: who });
    setNote(
      act === "grant"
        ? `Grant coins to ${who}? This does not spend yours.`
        : act === "take"
          ? `Remove coins from ${who}? This does not pay you.`
          : act === "kit"
            ? `Give ${who} the basic kit? Their other discoveries stay.`
            : act === "delete"
              ? `Delete ${who}?`
              : act === "admin"
                ? `Make ${who} an admin? They will be able to grant coins, delete accounts, and use commands.`
                : `Reset ${who} to Sergeant?`,
    );
  };
  return (
    <Shell title="Admin" onBack={onBack}>
      <form
        className="flex flex-wrap items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const amount = Math.round(Number(payAmount));
          void accountSetCommand({ data: { token, word: payWord, payout: amount } }).then((res) => {
            if (!res.ok) setError(res.error);
            else {
              setError("");
              setLiveWord(res.word);
              setLivePay(res.payout);
              setNote(`The word ${res.word} now pays ${res.payout} coins.`);
            }
          });
        }}
      >
        <input
          value={payWord}
          aria-label="Command word"
          placeholder="Word"
          onChange={(e) => setPayWord(e.target.value)}
          className="min-h-11 w-40 rounded-lg border border-line bg-surface px-3 text-base"
        />
        <input
          type="number"
          min={1}
          max={100000}
          value={payAmount}
          aria-label="Coin payout"
          placeholder="Coins"
          onChange={(e) => setPayAmount(e.target.value)}
          className="min-h-11 w-28 rounded-lg border border-line bg-surface px-3 text-base"
        />
        <Btn type="submit" tone="brass">Set word</Btn>
      </form>
      <p className="text-sm text-muted">
        {liveWord ? `The word ${liveWord} pays ${livePay} coins.` : "No command word yet. Set the word and how many coins it pays."} The phrase cheatcode always pays{livePay ? ` ${livePay}` : " 500"} coins.
      </p>
      <Btn
        tone="brass"
        onClick={() => {
          void accountCommand({ data: { token, word: "cheatcode" } }).then((res) => {
            if (!res.ok) setError(res.error);
            else {
              setError("");
              setNote(`cheatcode paid ${res.payout}. You now have ${res.coins} coins.`);
              void load();
            }
          });
        }}
      >
        cheatcode
      </Btn>
      <form
        className="flex flex-wrap items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const typed = word.trim();
          if (!typed) return;
          void accountCommand({ data: { token, word: typed } }).then((res) => {
            if (!res.ok) setError(res.error);
            else {
              setError("");
              setWord("");
              setLiveWord(res.word);
              setLivePay(res.payout);
              setNote(`${res.word} paid ${res.payout}. You now have ${res.coins} coins.`);
              void load();
            }
          });
        }}
      >
        <input
          value={word}
          aria-label="Run command"
          placeholder="Type the word"
          onChange={(e) => setWord(e.target.value)}
          className="min-h-11 min-w-0 flex-1 rounded-lg border border-line bg-surface px-3 text-base"
        />
        <Btn type="submit" tone="brass">Run</Btn>
      </form>
      {note ? <p className="text-sm text-brass">{note}</p> : null}
      {error ? <p className="text-sm text-brass">{error}</p> : null}
      {players.length === 0 ? <p className="text-sm text-muted">No other accounts yet.</p> : null}
      {players.map((row) => (
        <div key={row.id} className="flex flex-wrap items-center justify-between gap-2">
          <Nameplate name={row.username} rating={row.rating} operator={row.operator} dev={row.dev} detail={`${row.coins} coins`} />
          <span className="flex flex-wrap justify-end gap-2">
            <input
              type="number"
              min={1}
              max={100000}
              value={gift[row.id] ?? ""}
              aria-label={`Coins for ${row.username}`}
              placeholder="Coins"
              onChange={(e) => setGift((prev) => ({ ...prev, [row.id]: e.target.value }))}
              className="min-h-11 w-24 rounded-lg border border-line bg-surface px-2 text-base"
            />
            <Btn
              tone="brass"
              onClick={() => {
                const amount = Math.round(Number(gift[row.id]));
                if (!Number.isFinite(amount) || amount < 1) {
                  setError("Type how many coins to grant.");
                  return;
                }
                setError("");
                confirm("grant", row.username, () => {
                  void accountGiveCoins({ data: { token, username: row.username, amount, mint: true } }).then((res) => {
                    if (!res.ok) setError(res.error);
                    else {
                      setNote(`${row.username} now has ${res.coins} coins. Your purse was not charged.`);
                      void load();
                    }
                  });
                });
              }}
            >
              {sure?.act === "grant" && sure.username === row.username ? "Are you sure?" : "Grant"}
            </Btn>
            <Btn
              onClick={() => {
                const amount = Math.round(Number(gift[row.id]));
                if (!Number.isFinite(amount) || amount < 1) {
                  setError("Type how many coins to remove.");
                  return;
                }
                setError("");
                confirm("take", row.username, () => {
                  void accountGiveCoins({ data: { token, username: row.username, amount, take: true } }).then((res) => {
                    if (!res.ok) setError(res.error);
                    else {
                      setNote(`${row.username} now has ${res.coins} coins. None were added to you.`);
                      void load();
                    }
                  });
                });
              }}
            >
              {sure?.act === "take" && sure.username === row.username ? "Are you sure?" : "Remove"}
            </Btn>
            <Btn
              onClick={() => {
                setError("");
                confirm("kit", row.username, () => {
                  void accountGiveKit({ data: { token, username: row.username } }).then((res) => {
                    if (!res.ok) setError(res.error);
                    else setNote(`${row.username} has the basic kit. Their other discoveries were kept.`);
                  });
                });
              }}
            >
              {sure?.act === "kit" && sure.username === row.username ? "Are you sure?" : "Basic kit"}
            </Btn>
            <Btn
              onClick={() => {
                confirm("reset", row.username, () => {
                  void accountResetRank({ data: { token, username: row.username } }).then((res) => {
                    if (!res.ok) setError(res.error);
                    else {
                      setNote(`${row.username} is back to Sergeant, 1000.`);
                      void load();
                    }
                  });
                });
              }}
            >
              {sure?.act === "reset" && sure.username === row.username ? "Are you sure?" : "Reset rank"}
            </Btn>
            <Btn
              onClick={() => {
                if (row.operator) return;
                setError("");
                confirm("admin", row.username, () => {
                  void accountMakeAdmin({ data: { token, username: row.username } }).then((res) => {
                    if (!res.ok) setError(res.error);
                    else {
                      setNote(`${row.username} is now an admin.`);
                      void load();
                    }
                  });
                });
              }}
            >
              {row.operator ? "Admin" : sure?.act === "admin" && sure.username === row.username ? "Are you sure?" : "Make admin"}
            </Btn>
            <Btn
              onClick={() => {
                confirm("delete", row.username, () => {
                  void accountDelete({ data: { token, username: row.username } }).then((res) => {
                    if (!res.ok) setError(res.error);
                    else {
                      setNote(`${row.username} was deleted.`);
                      void load();
                    }
                  });
                });
              }}
            >
              {sure?.act === "delete" && sure.username === row.username ? "Are you sure?" : "Delete"}
            </Btn>
          </span>
        </div>
      ))}
    </Shell>
  );
}

export function RankPage({ token, onBack }: { token: string; onBack: () => void }) {
  const [board, setBoard] = useState<PublicUser[]>([]);
  const [error, setError] = useState("");
  useEffect(() => {
    let stop = false;
    const pull = () => {
      void rankBoard({ data: { token } }).then((res) => {
        if (stop) return;
        if (!res.ok) setError(res.error);
        else setBoard(res.board);
      });
    };
    pull();
    const id = window.setInterval(pull, 3000);
    return () => {
      stop = true;
      window.clearInterval(id);
    };
  }, [token]);
  return (
    <Shell title="Rank" onBack={onBack}>
      <p className="text-sm text-muted">Online wins raise your rating. You start as a Sergeant at 1000. Beating a higher rank pays 15 extra per rank. If you leave, you lose the full amount and they only gain half.</p>
      {error ? <p className="text-sm text-brass">{error}</p> : null}
      <ol className="flex flex-col gap-2">
        {board.map((row, i) => (
          <li key={row.id} className="flex items-center justify-between gap-3">
            <Nameplate name={row.username} rating={row.rating} operator={row.operator} dev={row.dev} detail={`${i + 1} · ${row.wins}–${row.losses}`} />
            <span className="text-sm tabular-nums">{row.rating}</span>
          </li>
        ))}
      </ol>
    </Shell>
  );
}

export function LobbyPage({ code, onBack }: { code: string; onBack: () => void }) {
  return (
    <Shell title="Waiting" onBack={onBack} backLabel="Home">
      <p className="text-sm text-muted">Give this code to the other player. It also appears at the top of their screen if you invited them. The match starts when they press Join. Each turn lasts 1:30.</p>
      <p className="font-display text-6xl tracking-widest">{code}</p>
    </Shell>
  );
}

export function SearchPage({ rank, rating, note, onBack }: { rank: string; rating: number; note?: string; onBack: () => void }) {
  return (
    <Shell title="Ranked match" onBack={onBack} backLabel="Cancel">
      <p className="text-sm text-muted">
        Ranked pairs you with anyone else who also pressed Ranked match. The closest rank is chosen first. The map is random. If nobody is searching, a bot takes the other seat after a few seconds. A bot does not change your rating. You are {rank} ({rating}). Each turn lasts 1:30.
      </p>
      <p className="font-display text-4xl">Waiting for another player…</p>
      {note ? <p className="text-sm text-brass">{note}</p> : null}
    </Shell>
  );
}

export function WaitingPage({
  name,
  deadline,
  onHome,
  talk,
  onSay,
}: {
  name: string;
  deadline: number | null;
  onHome: () => void;
  talk?: { name: string; text: string }[];
  onSay?: (text: string) => void;
}) {
  const [draft, setDraft] = useState("");
  const [homeStep, setHomeStep] = useState(0);
  const lines = talk ?? [];
  useEffect(() => {
    if (!homeStep) return;
    const id = window.setTimeout(() => setHomeStep(0), 5000);
    return () => window.clearTimeout(id);
  }, [homeStep]);
  return (
    <main className="flex h-dvh flex-col items-center justify-center gap-3 bg-bg px-4 text-fg">
      <p className="text-xs tracking-widest text-brass uppercase">Their turn</p>
      <h1 className="font-display text-5xl">Waiting for {name}</h1>
      {deadline ? <TurnClock deadline={deadline} /> : null}
      <p className="text-sm text-muted">The map stays hidden until it is your turn. The clock ends their turn at zero.</p>
      <form
        className="flex w-full max-w-md flex-col gap-2 rounded-lg border border-line bg-surface p-3"
        onSubmit={(e) => {
          e.preventDefault();
          const clean = draft.replace(/\s+/g, " ").trim().slice(0, 80);
          if (!clean || !onSay) return;
          setDraft("");
          onSay(clean);
        }}
      >
        <p className="text-xs tracking-widest text-brass uppercase">Chat</p>
        <div className="flex max-h-40 flex-col gap-1 overflow-y-auto text-sm">
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
            className="min-h-11 min-w-0 flex-1 rounded-lg border border-line bg-surface-2 px-3 text-base"
          />
          <Btn type="submit">Send</Btn>
        </div>
      </form>
      <Btn
        onClick={() => {
          const next = homeStep + 1;
          if (next >= 3) onHome();
          else setHomeStep(next);
        }}
      >
        {homeStep === 0 ? "Home" : `Leave? ${homeStep}/3`}
      </Btn>
    </main>
  );
}
