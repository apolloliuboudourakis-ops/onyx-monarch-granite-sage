import { BASIC_KIT, MOD_OFFERS, STRUCT_BY, STRUCTS, UNIT_BY, UNITS, hitBand, isUnitKind, researchPaths, type UnitDef } from "@/game/catalog";
import { MAPS } from "@/game/maps";

function unitFacts(u: UnitDef): string[] {
  const range = u.maxRange <= 0 ? "—" : u.minRange === u.maxRange ? String(u.maxRange) : `${u.minRange}–${u.maxRange}`;
  const armor = u.armor === "light" ? "Infantry" : u.armor === "armor" ? "Armor" : "Air";
  const domain = u.domain === "ground" ? "Ground" : u.domain === "air" ? "Air" : "Sea";
  const lines = [
    `HP ${u.hp} · Move ${u.move} · Vision ${u.vision} · Build ${u.build ?? 0} ${u.build === 1 ? "turn" : "turns"}`,
    `Range ${range} · Atk ${u.atk || "—"} · Shots ${u.atk ? u.shots ?? 1 : "—"}`,
    `Hit ${u.atk > 0 && u.maxRange > 0 ? hitBand(u.id, u.minRange, u.maxRange) : "—"} · ${armor} · ${domain}`,
    `Vs troops ${u.vs.light}× · armor ${u.vs.armor}× · air ${u.vs.air}× · buildings ${u.vs.structure}×`,
  ];
  const extra = [
    u.radar ? `Radar ${u.radar}` : "",
    u.capture ? "Captures supply bases" : "",
    u.repair ? `Heals ${u.repair}` : "",
    u.mines ? `Carries ${u.mines} mines` : "",
  ].filter(Boolean);
  if (extra.length) lines.push(extra.join(" · "));
  return lines;
}

export function Manual({ onBack }: { onBack: () => void }) {
  const works = STRUCTS.filter((s) => s.id !== "spire");
  const lines = ["Rifles", "Snipers", "Minelayers", "Armor", "Fleet", "Air", "Works"] as const;
  const nameOf = (id: string) => (isUnitKind(id) ? UNIT_BY[id].name : STRUCT_BY[id as "radar"].name);
  return (
    <main className="h-dvh overflow-y-auto bg-bg text-fg">
      <div className="mx-auto flex max-w-3xl flex-col gap-8 px-4 py-8 pb-16">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs tracking-widest text-brass uppercase">Field manual</p>
            <h1 className="font-display text-4xl text-fg">Strategic War</h1>
          </div>
          <button
            type="button"
            onClick={onBack}
            className="min-h-11 rounded-lg bg-brass px-4 py-2 text-sm font-medium text-brass-ink"
          >
            Back
          </button>
        </header>

        <section className="flex flex-col gap-2">
          <h2 className="font-display text-2xl">How a turn goes</h2>
          <ol className="flex list-decimal flex-col gap-2 pl-5 text-muted">
            <li>Income lands from your Headquarters and every Supply Base you hold.</li>
            <li>Buy from the catalog, then click a gold + square. Ground and air units must touch your Headquarters or a Supply Base you own. Ships go on the marked water by the dock. The number on a new piece is how many of your turns until it can act. You cannot move or shoot it while that number is showing.</li>
            <li>Move every unit you want, before or after it shoots. Firing does not use up movement. If a move would carry a unit into an enemy's shooting range, it stops on that square so you can shoot. Move it again to keep going. Units pass through other units, headquarters, and supply bases. Walls still block. Yellow is anything your army could hit. Red is what the selected unit can shoot now. Click the red square or press Shoot. Shots can miss, and the chance falls as the range grows. A near miss still chips the target.</li>
            <li>If you walk past a last-known contact that is still in range, that unit may take one shot at the remembered square.</li>
            <li>Enemy AA guns, mobile AA, machine guns, and bunkers can fire during your turn. They shoot at the start of your turn if you are already in range, and again when you move into range. A miss still uses one of their shots.</li>
            <li>The Minelayer carries 4 hidden mines. Select it, press Lay mine, then click a marked square next to it. The enemy cannot see the mine. Your own troops can drive over it. When it is empty, move it onto or next to your Headquarters or a Supply Base you hold and press Restock. Each missing mine costs 70. That uses its action for the turn.</li>
            <li>End the turn. Idle guns take one parting shot. In a same-screen duel the map is covered by a white handoff. Pass the machine. The next player presses I’m ready. Their last view comes back. It does not jump to the enemy base.</li>
          </ol>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="font-display text-2xl">How you win</h2>
          <ul className="flex list-disc flex-col gap-2 pl-5 text-muted">
            <li>Strike. Shoot the enemy Headquarters down.</li>
            <li>POI capture. Own every supply base. Standing on one is not enough, and shelling it does not count. A capturer has to finish the capture. Destroying the Headquarters does not end it. A supply base cannot be destroyed in this mode.</li>
            <li>Raze. Destroy every enemy building except the Headquarters. Mines do not count, and shooting the Headquarters down does not end it.</li>
          </ul>
          <p className="text-muted">
            Pick the mode on the home screen for a local game. Online rolls the mode for you. Local Base HP is the number you type, from 1 to 100. Online Base HP is 10, 20, 40, 60, 80, or 100.
          </p>
          <p className="text-muted">
            North moves first with a 1,000 purse plus opening income. A same-screen duel gives South the same purse, the same buy list, and the same upgrades. Each side also starts with its own supply base, orange for North and blue for South. Neutral bases in the middle can still be captured. A captured base pays +200 and lets you build closer. Taking one back from the enemy takes longer. Infantry or a Sniper captures in one action if they are healthy.
          </p>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="font-display text-2xl">Who you fight</h2>
          <ul className="flex list-disc flex-col gap-2 pl-5 text-muted">
            <li>Same-screen duel. Two players, one computer, white pass screen between turns.</li>
            <li>Bot levels 1 to 10. Level 1 is poor and misses. Level 10 plays the whole army. Higher levels are smarter, not richer than you. No pass screen. A win pays more research and coins on a higher level. A longer match pays more coins. 12 turns is the normal purse. Twice as long pays twice the coins, up to four times. A loss pays nothing.</li>
            <li>Ranked match. Only pairs someone who also pressed Ranked match, and only if they share your rank. The map is random. A win pays 3000 research and 750 coins before headquarters health and match length, five times a level 10 bot. A friend game pays 1200 research and 300 coins, twice a level 10 bot. 12 turns pays that amount. A longer match pays more coins, up to four times, and does not add extra research. Each turn lasts 1:30. The clock ending the turn is not a loss. Leaving the match is. You drop the full rating. They gain half of a normal win. In Strike, research, coins, and rating scale with headquarters health. 22 health is a normal payout. 100 health pays a little over four times that. 10 health pays less than half. Capture and Raze always pay the normal amount. A chest buys less research than winning the coins yourself.</li>
            <li>Beating a higher rank in a friend game pays 15 extra rating for each rank they are above you. You start as a Sergeant at 1000.</li>
          </ul>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="font-display text-2xl">Research, coins, upgrades</h2>
          <p className="text-muted">
            Infantry, a sniper, an IFV, a tank, an anti-tank, a mortar, mobile anti-air, a helicopter, a destroyer, and a radar are the basic kit. Walls, mines, and supply bases are in it too. You can buy them before you discover anything. The number on the card is the cost to field that unit. Everything else sits on a lane. A lane sometimes separates into two or three. You only need the unit it comes after, then you pick a branch. Press Focus on the next unit. Fighting a battle fills that unit. A win fills more than a loss. When the bar is full, the unit is yours. All coins fills only that unit. One coin fills one point, and it does not spend your research. Extra coins stay in your purse. Discover spends research for whatever is still left. If you type a coin amount first, Discover spends those coins and then research for the rest. Coins cannot skip a unit you have not reached. A loss pays no research pool and no coins.
          </p>
          <p className="text-sm text-muted">
            <span className="text-fg">Basic kit. </span>
            {BASIC_KIT.map((id) => `${nameOf(id)} costs ${isUnitKind(id) ? UNIT_BY[id].cost : STRUCT_BY[id].cost}`).join(" · ")}
          </p>
          {lines.map((line) => (
            <div key={line} className="text-sm text-muted">
              <p className="text-fg">{line}</p>
              {researchPaths(line).map((path) => (
                <p key={path.join("-")}>{path.map((id) => nameOf(id)).join(" → ")}</p>
              ))}
            </div>
          ))}
          <p className="text-muted">
            After a unit is yours, buy Gun, Engine, and Plate on it. You can own all three at once. Each costs 40 coins. Gun is +2 attack. Engine is +2 move. Plate is +4 health. A unit with no gun cannot take Gun. The bonus applies the next time you build that unit. Bot games and online matches use your upgrades. A same-screen duel copies them onto both sides.
          </p>
          <ul className="grid gap-2 text-sm text-muted sm:grid-cols-3">
            {MOD_OFFERS.map((offer) => (
              <li key={offer.slot} className="rounded-lg border border-line bg-surface p-3">
                <h3 className="font-display text-xl text-fg">{offer.name}</h3>
                <p>{offer.blurb}. {offer.coins} coins.</p>
              </li>
            ))}
          </ul>
          <p className="text-muted">
            Chests sit on the Research page. A field chest is 40 coins, a supply chest is 90, and an arsenal chest is 160. Bigger chests hold more. A chest can hold research, coins, the next unit on a line you already started, a gun, engine, or plate, or progress on the unit you are focused on. The daily chest is free, counts up to 7, and resets if you miss a day.
          </p>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="font-display text-2xl">Fog, radar, ground</h2>
          <p className="text-muted">
            The whole map stays visible. Ground outside your eyes is only slightly dimmed — it is not a black void. Both
            Headquarters stay marked, so you can always see where the enemy base is. Maps do not hide extra supply
            bases. You only see a base you built, or one the enemy built, once it is in sight. Enemy troops show as themselves
            within 3 tiles of your units, including diagonally. Farther out they are a blip only if a radar reaches
            them. A faded copy of that unit's own symbol, marked LAST, stays on the square where you last saw them. Weapon radar is still 1 tile. A
            Radar tower and a Portable Radar both reach 5 tiles. Inside 4 of them you see what the contact is. The outer tile is only a blip. Ridges block eyes. Forest blocks eyes only. Planes fly over water. Helicopters do not. The IFV and the Scout Car can ford water. Other ground units cannot. Ships sail water only and deploy within two tiles of your headquarters or a supply
            base you hold. Enemy mines stay hidden. A ground unit that enters one stops and takes 8.
          </p>
          <p className="text-muted">
            Counters: Anti-Tank breaks Tanks, IFVs, and Howitzers. Mobile AA and AA Guns kill Fighters, Bombers, and
            Helicopters. Fighters own the sky and cannot crack buildings. Bombers level troops and headquarters but
            cannot shoot aircraft. Cruisers shell the shore from range 2–7. A Destroyer that steps inside that minimum is safe from the cruiser and can sink it. Machine Guns ignore aircraft. Mortars and Howitzers crack buildings. Infantry is
            cheap and captures.
          </p>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="font-display text-2xl">Buy list — units</h2>
          <ul className="grid gap-2 sm:grid-cols-2">
            {UNITS.map((u) => (
              <li key={u.id} className="rounded-lg border border-line bg-surface p-3">
                <div className="flex items-baseline justify-between gap-3">
                  <h3 className="font-display text-xl">{u.name}</h3>
                  <span className="text-brass tabular-nums">{u.cost}</span>
                </div>
                <p className="text-sm text-muted">{u.blurb}</p>
                {unitFacts(u).map((line) => (
                  <p key={line} className="mt-1 text-xs text-muted tabular-nums">
                    {line}
                  </p>
                ))}
              </li>
            ))}
          </ul>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="font-display text-2xl">Buy list — buildings</h2>
          <ul className="grid gap-2 sm:grid-cols-2">
            {works.map((s) => (
              <li key={s.id} className="rounded-lg border border-line bg-surface p-3">
                <div className="flex items-baseline justify-between gap-3">
                  <h3 className="font-display text-xl">{s.name}</h3>
                  <span className="text-brass tabular-nums">{s.cost}</span>
                </div>
                <p className="text-sm text-muted">{s.blurb}</p>
                <p className="mt-1 text-xs text-muted tabular-nums">
                  HP {s.hp}
                  {s.atk > 0 ? ` · Atk ${s.atk} · Range ${s.minRange}–${s.maxRange}` : ""}
                  {s.radar > 0 ? ` · Radar ${s.radar}` : ""}
                  {s.income > 0 ? ` · +${s.income}` : ""}
                </p>
              </li>
            ))}
          </ul>
          <p className="text-sm text-muted">
            Headquarters uses the Base HP of the match. It pays 500 and is where you build. It is not for sale. Ground and air units deploy on or beside your headquarters or supply bases. Cruisers and Destroyers deploy on water within two tiles of those holdings. Buildings go on plains, road, rubble, or forest you control, within two tiles of those holdings and closer to you than to the enemy. A new Supply Base cannot be founded within five tiles of an enemy headquarters. Sell a selected piece you own for part of its cost. You cannot sell the Headquarters.
          </p>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="font-display text-2xl">Controls</h2>
          <ul className="grid gap-2 text-sm text-muted sm:grid-cols-2">
            <li className="rounded-lg border border-line bg-surface p-3">Click a tile, unit, work, or catalog card.</li>
            <li className="rounded-lg border border-line bg-surface p-3">
              Arrows or WASD move the cursor. A is left, D is right. Enter or Space confirms.
            </li>
            <li className="rounded-lg border border-line bg-surface p-3">E ends the turn. Esc cancels.</li>
            <li className="rounded-lg border border-line bg-surface p-3">C capture · H done · R repair · Tab next idle unit. Sell is a button on the selected piece. Done does not capture a base.</li>
            <li className="rounded-lg border border-line bg-surface p-3">
              Keys 1–9 and 0 arm the first ten units. Shift+1–7 arms a work. Deploy phase only.
            </li>
            <li className="rounded-lg border border-line bg-surface p-3">
              On a phone, drag the map to look around and tap a square to select, move, or shoot. Buy opens the catalog. End turn is at the upper left.
            </li>
            <li className="rounded-lg border border-line bg-surface p-3">
              On the white pass screen, Space or I’m ready. Not before.
            </li>
          </ul>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="font-display text-2xl">Maps</h2>
          <ul className="flex flex-col gap-2">
            {MAPS.map((map) => (
              <li key={map.id} className="rounded-lg border border-line bg-surface p-3">
                <h3 className="font-display text-xl">{map.name}</h3>
                <p className="text-xs tracking-widest text-muted uppercase">
                  {map.kind === "land" ? "Land" : map.kind === "sea" ? "Sea" : "Mixed"}
                </p>
                <p className="text-sm text-muted">{map.blurb}</p>
                <p className="text-xs text-muted tabular-nums">
                  {map.rows[0]!.length}×{map.rows.length}
                </p>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </main>
  );
}
