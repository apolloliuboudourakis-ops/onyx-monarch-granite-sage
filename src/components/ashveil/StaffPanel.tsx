import { useEffect, useState } from "react";
import { staffAct } from "@/game/staff.functions";
import { APPROVED_GIFTS, APPROVED_SETTINGS, APPROVED_SPAWN, roleAllows } from "@/game/staff";
import { Btn } from "@/components/ashveil/Online";

type Player = { id: string; username: string; role: string; frozen: boolean; online: boolean; rating: number };
type LogRow = { at: string; name: string; action: string; detail: string };

/**
 * Staff tools. The buttons only show what this role is allowed to try.
 * The server checks the role again and ignores anything this screen claims.
 */
export function StaffPanel({
  open,
  token,
  role,
  roomCode,
  onClose,
}: {
  open: boolean;
  token: string;
  role: string;
  roomCode: string;
  onClose: () => void;
}) {
  const [players, setPlayers] = useState<Player[]>([]);
  const [log, setLog] = useState<LogRow[]>([]);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [who, setWho] = useState("");
  const [sure, setSure] = useState("");
  const [gift, setGift] = useState<string>(APPROVED_GIFTS[0]);
  const [coins, setCoins] = useState("50");
  const [kind, setKind] = useState<string>(APPROVED_SPAWN[0]);
  const [x, setX] = useState("4");
  const [y, setY] = useState("4");
  const [objectId, setObjectId] = useState("");
  const [settingKey, setSettingKey] = useState<string>(APPROVED_SETTINGS[0]);
  const [settingValue, setSettingValue] = useState("");
  const [nextRole, setNextRole] = useState("moderator");

  const run = async (action: string, payload?: Record<string, unknown>, danger?: string) => {
    if (danger) {
      if (sure !== danger) {
        setSure(danger);
        setNote(`Press again to confirm: ${danger}`);
        return;
      }
      setSure("");
    }
    setError("");
    const res = await staffAct({ data: { token, action, payload } });
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setNote(res.note);
    if (res.players) setPlayers(res.players);
    if (res.log) setLog(res.log);
  };

  useEffect(() => {
    if (!open) return;
    void run("list");
    if (roleAllows(role, "moderate") || role === "owner") void run("log");
  }, [open, token]);

  if (!open) return null;
  const mod = roleAllows(role, "moderate");
  const give = roleAllows(role, "give");
  const build = roleAllows(role, "build");
  const settings = roleAllows(role, "settings");
  const roles = roleAllows(role, "roles") || role === "owner";

  return (
    <div className="fixed inset-0 z-[80] flex justify-end bg-black/50" onClick={onClose}>
      <aside
        className="flex h-full w-full max-w-md flex-col gap-4 overflow-auto bg-bg p-4 text-fg shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-3xl">Staff</h2>
            <p className="text-sm text-muted">You are {role}. Press ` or Esc to close.</p>
          </div>
          <Btn onClick={onClose}>Close</Btn>
        </div>
        {note ? <p className="text-sm text-brass">{note}</p> : null}
        {error ? <p className="text-sm text-brass">{error}</p> : null}

        <section className="flex flex-col gap-2">
          <h3 className="font-display text-xl">Players</h3>
          {players.length === 0 ? <p className="text-sm text-muted">No accounts loaded.</p> : null}
          {players.map((row) => (
            <button
              key={row.id}
              type="button"
              className="rounded-lg border border-line px-3 py-2 text-left"
              onClick={() => setWho(row.username)}
            >
              <span className="font-display text-lg">{row.username}</span>
              <span className="ml-2 text-sm text-muted">
                {row.role || "player"} · {row.online ? "online" : "offline"}
                {row.frozen ? " · frozen" : ""} · {row.rating}
              </span>
            </button>
          ))}
        </section>

        {mod ? (
          <section className="flex flex-col gap-2">
            <h3 className="font-display text-xl">Moderation</h3>
            <input value={who} onChange={(e) => setWho(e.target.value)} placeholder="Player name" className="min-h-11 rounded-lg border border-line bg-surface px-3" />
            <div className="flex flex-wrap gap-2">
              <Btn onClick={() => void run("kick", { username: who }, `kick ${who}`)}>Kick</Btn>
              <Btn onClick={() => void run("freeze", { username: who, frozen: true }, `freeze ${who}`)}>Freeze</Btn>
              <Btn onClick={() => void run("freeze", { username: who, frozen: false }, `unfreeze ${who}`)}>Unfreeze</Btn>
              <Btn onClick={() => void run("teleport", { username: who })}>Teleport to</Btn>
              {give || role === "owner" ? <Btn onClick={() => void run("bring", { username: who, code: roomCode }, `bring ${who}`)}>Bring</Btn> : null}
            </div>
          </section>
        ) : null}

        {give ? (
          <section className="flex flex-col gap-2">
            <h3 className="font-display text-xl">Give approved item</h3>
            <select value={gift} onChange={(e) => setGift(e.target.value)} className="min-h-11 rounded-lg border border-line bg-surface px-3">
              {APPROVED_GIFTS.map((id) => (
                <option key={id} value={id}>{id}</option>
              ))}
            </select>
            <Btn onClick={() => void run("give", { username: who, item: gift }, `give ${gift} to ${who}`)}>Give item</Btn>
            <input value={coins} onChange={(e) => setCoins(e.target.value)} type="number" min={1} className="min-h-11 rounded-lg border border-line bg-surface px-3" />
            <Btn onClick={() => void run("give", { username: who, item: "coins", amount: Number(coins) }, `give ${coins} coins to ${who}`)}>Give coins</Btn>
          </section>
        ) : null}

        {build ? (
          <section className="flex flex-col gap-2">
            <h3 className="font-display text-xl">Build</h3>
            <p className="text-sm text-muted">Room {roomCode || "none"}. Only approved objects. Rotate and resize are not used on a grid. Move changes the tile. Saves when the server accepts it.</p>
            <select value={kind} onChange={(e) => setKind(e.target.value)} className="min-h-11 rounded-lg border border-line bg-surface px-3">
              {APPROVED_SPAWN.map((id) => (
                <option key={id} value={id}>{id}</option>
              ))}
            </select>
            <div className="flex gap-2">
              <input value={x} onChange={(e) => setX(e.target.value)} aria-label="Tile x" className="min-h-11 w-20 rounded-lg border border-line bg-surface px-3" />
              <input value={y} onChange={(e) => setY(e.target.value)} aria-label="Tile y" className="min-h-11 w-20 rounded-lg border border-line bg-surface px-3" />
            </div>
            <Btn onClick={() => void run("spawn", { code: roomCode, kind, x: Number(x), y: Number(y) }, `place ${kind}`)}>Place</Btn>
            <input value={objectId} onChange={(e) => setObjectId(e.target.value)} placeholder="Staff object id" className="min-h-11 rounded-lg border border-line bg-surface px-3" />
            <div className="flex flex-wrap gap-2">
              <Btn onClick={() => void run("move", { code: roomCode, id: objectId, x: Number(x), y: Number(y) })}>Move</Btn>
              <Btn onClick={() => void run("delete-object", { code: roomCode, id: objectId }, `delete ${objectId}`)}>Delete</Btn>
            </div>
          </section>
        ) : null}

        {settings ? (
          <section className="flex flex-col gap-2">
            <h3 className="font-display text-xl">Settings</h3>
            <select value={settingKey} onChange={(e) => setSettingKey(e.target.value)} className="min-h-11 rounded-lg border border-line bg-surface px-3">
              {APPROVED_SETTINGS.map((id) => (
                <option key={id} value={id}>{id}</option>
              ))}
            </select>
            <input value={settingValue} onChange={(e) => setSettingValue(e.target.value)} placeholder="New value" className="min-h-11 rounded-lg border border-line bg-surface px-3" />
            <Btn onClick={() => void run("setting", { key: settingKey, value: settingValue }, `save ${settingKey}`)}>Save setting</Btn>
          </section>
        ) : null}

        {roles ? (
          <section className="flex flex-col gap-2">
            <h3 className="font-display text-xl">Staff list</h3>
            <p className="text-sm text-muted">Owner can set every role. An admin can set moderator or builder only.</p>
            <select value={nextRole} onChange={(e) => setNextRole(e.target.value)} className="min-h-11 rounded-lg border border-line bg-surface px-3">
              <option value="builder">Builder</option>
              <option value="moderator">Moderator</option>
              <option value="admin">Admin</option>
              <option value="">Remove</option>
            </select>
            <Btn onClick={() => void run("set-role", { username: who, role: nextRole }, `set ${who} to ${nextRole || "player"}`)}>Save role</Btn>
          </section>
        ) : null}

        {mod ? (
          <section className="flex flex-col gap-2">
            <h3 className="font-display text-xl">Activity</h3>
            {log.length === 0 ? <p className="text-sm text-muted">No staff commands yet.</p> : null}
            {log.map((row, i) => (
              <p key={`${row.at}-${i}`} className="text-sm text-muted">
                {row.at} · {row.name} · {row.action} · {row.detail}
              </p>
            ))}
          </section>
        ) : null}
      </aside>
    </div>
  );
}
