export type PlayerId = 0 | 1;

export type Terrain = "plain" | "forest" | "ridge" | "water" | "road" | "rubble";

export type UnitKind =
  | "squad"
  | "marksman"
  | "bullhead"
  | "tank"
  | "pike"
  | "aagun"
  | "lobber"
  | "rotor"
  | "fighter"
  | "bomber"
  | "tender"
  | "ship"
  | "destroyer"
  | "ram"
  | "layer"
  | "dish"
  | "salvo"
  | "heavy"
  | "sam"
  | "drone"
  | "sub"
  | "mg"
  | "ranger"
  | "breaker"
  | "guard"
  | "battery"
  | "frigate"
  | "strike"
  | "lance"
  | "spotter"
  | "grenade"
  | "scorch"
  | "field"
  | "siege"
  | "sapper"
  | "scout"
  | "hunter"
  | "wrecker"
  | "monarch"
  | "raider"
  | "lancer"
  | "lurker"
  | "dread"
  | "thunder"
  | "eye"
  | "vault"
  | "ace"
  | "breacher"
  | "demo"
  | "pioneer"
  | "engineer"
  | "atgm"
  | "ambush"
  | "dozer"
  | "spg"
  | "command"
  | "spear"
  | "monitor"
  | "battle"
  | "asw"
  | "escort"
  | "cruise"
  | "wolf"
  | "armed"
  | "radarplane"
  | "night"
  | "dogfight"
  | "strategic"
  | "pathfinder"
  | "heavygun"
  | "mlrs"
  | "dmr"
  | "sharp"
  | "longshot"
  | "phantom"
  | "materiel"
  | "fifty"
  | "sabot"
  | "counter"
  | "overwatch"
  | "stalker"
  | "seeder"
  | "planter"
  | "carpet"
  | "prowler"
  | "nightlay"
  | "slip"
  | "hull"
  | "breachlay"
  | "siegelay"
  | "apex"
  | "shade"
  | "penetrator"
  | "superheavy"
  | "barrage"
  | "skylance"
  | "marshal"
  | "glaive"
  | "flagship"
  | "citadel"
  | "boomer"
  | "killer"
  | "spectre"
  | "raptor"
  | "arsenal"
  | "seamark"
  | "blanket"
  | "ghost"
  | "fortress"
  | "carrier"
  | "aegis"
  | "rampart"
  | "marlin";

export type StructKind =
  | "spire"
  | "outpost"
  | "radar"
  | "turret"
  | "bunker"
  | "barrier"
  | "mine"
  | "aa"
  | "pit"
  | "flak"
  | "tower"
  | "nest"
  | "net"
  | "pillbox"
  | "casemate"
  | "samsite"
  | "point"
  | "redoubt"
  | "coastgun"
  | "umbrella"
  | "ciws"
  | "bastion"
  | "harbor"
  | "skyfort"
  | "phalanx"
  | "mast";

export type Armor = "light" | "armor" | "air" | "structure";

export type Phase = "deploy" | "maneuver";

export type Screen = "title" | "manual" | "battle" | "handoff" | "victory" | "review";

export interface Unit {
  id: string;
  kind: UnitKind;
  owner: PlayerId;
  x: number;
  y: number;
  hp: number;
  moved: boolean;
  acted: boolean;
  fresh: boolean;
  /** Movement already spent this turn. */
  spent: number;
  /** Shots already fired this turn. */
  rounds?: number;
  /** Turns left before this piece can act. */
  eta?: number;
  /** Mines this minelayer still carries. */
  charges?: number;
  /** Account upgrades baked in when the piece was built. */
  plus?: { atk: number; move: number; hp: number };
}

export interface Struct {
  id: string;
  kind: StructKind;
  owner: PlayerId | null;
  x: number;
  y: number;
  hp: number;
  /** Starting health, when a match sets Headquarters above the catalog value. */
  max?: number;
  cap: number;
  fired: boolean;
  /** Shots already fired this turn. */
  rounds?: number;
  /** Turns left before this piece can act. */
  eta?: number;
}

export interface Fx {
  id: string;
  x: number;
  y: number;
  text: string;
  until: number;
}

export interface Contact {
  id: string;
  domain: "ground" | "air" | "sea";
  /** What you identified, so a remembered blip can draw that symbol. */
  kind?: string;
  place?: "unit" | "struct";
  x: number;
  y: number;
}

export interface Match {
  mapId: string;
  turn: number;
  active: PlayerId;
  phase: Phase;
  funds: [number, number];
  terrain: Terrain[][];
  units: Unit[];
  structs: Struct[];
  seen: [boolean[][], boolean[][]];
  mineMemory: [string[], string[]];
  contacts: [Contact[], Contact[]];
  seq: number;
  log: [string[], string[]];
  selection: Selection;
  cursor: { x: number; y: number };
  /** Minelayer is waiting for a square. */
  laying?: boolean;
  winner: { player: PlayerId; reason: string } | null;
  confirmEnd: boolean;
  salvo: string[] | null;
  fx: Fx[];
  shakeUntil: number;
  history: Match | null;
  /** Player 2 is the computer. 1 is weakest, 10 is strongest. */
  bot?: number;
  /** Online only. Epoch ms when this turn must end. */
  clock?: number | null;
  /** When this player started ranked search. */
  queueAt?: number;
  /** This match was started from Ranked match, so it pays more than a bot. */
  ranked?: boolean;
  /** strike destroys the Headquarters. capture takes every supply base. raze destroys every enemy building except the Headquarters. */
  mode?: "strike" | "capture" | "raze";
  kills?: [number, number];
  /** Comma lists of kind:slot upgrades for each seat. */
  crew?: [string, string];
  /** Raze only. Buildings, other than mines, destroyed for each seat. */
  razed?: [number, number];
}

export type Selection =
  | { kind: "unit"; id: string }
  | { kind: "struct"; id: string }
  | { kind: "buy"; item: BuyId }
  | null;

export type BuyId = UnitKind | Exclude<StructKind, "spire">;

export interface RootState {
  screen: Screen;
  match: Match | null;
  help: boolean;
  hasSave: boolean;
}

export type Cmd =
  | { type: "manual" }
  | { type: "title" }
  | { type: "new"; mapId: string; bot?: boolean | number | "easy" | "normal" | "hard"; hqHp?: number; mode?: "strike" | "capture" | "raze"; mods?: string }
  | { type: "continue" }
  | { type: "discard-save" }
  | { type: "help" }
  | { type: "cursor"; x: number; y: number }
  | { type: "click"; x: number; y: number }
  | { type: "select"; id: string }
  | { type: "buy"; item: BuyId }
  | { type: "cancel" }
  | { type: "hold" }
  | { type: "capture" }
  | { type: "repair" }
  | { type: "sell" }
  | { type: "arm-lay" }
  | { type: "restock" }
  | { type: "strike" }
  | { type: "maneuver" }
  | { type: "deploy" }
  | { type: "ask-end" }
  | { type: "cancel-end" }
  | { type: "confirm-end"; now: number }
  | { type: "pass-cover" }
  | { type: "ready"; now: number }
  | { type: "undo" }
  | { type: "review" }
  | { type: "note-save"; has: boolean };
