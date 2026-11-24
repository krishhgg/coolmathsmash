# Adding a fighter

A fighter is one directory, `src/fighters/<id>/`, whose `index.ts` exports `fighter: FighterDef`. The registry
(`src/fighters/registry.ts`) finds it with `import.meta.glob`, so adding a fighter edits no shared file. Fireboy
(`src/fighters/fireboy/`) is the worked example; copy it.

```
src/fighters/<id>/
  index.ts      defineFighter({ id, name, series, stats, moves, art })
  stats.ts      FighterStats: movement, jumps, weight, shield
  moves.ts      Record<string, MoveDef>: frame data for every move
  entities.ts   Record<string, EntityDef>: projectiles, minions and objects the moves spawn (optional)
  art/          the rig art (docs/art.md); plain data, no renderer imports
  <id>.test.ts  inputs and frame data you care about
```

Everything uses Smash Ultimate's units, so numbers from frame-data sites and the research reference
(`docs/physics-reference.md`, `src/sim/reference/physics-constants.json`) go in unchanged:

- distances in game units (Battlefield's main stage is 160 wide, Mario is about 15 tall)
- speeds in units per frame, accelerations in units per frame squared
- times in frames at 60 Hz; frame 1 is the first frame of an action, and `faf` (first actionable frame) is total
  frames + 1, as on ultimateframedata.com

## Stats

`FighterStats` (`src/fighters/types.ts`) holds the attributes Ultimate gives each fighter. `src/fighters/fighters.test.ts`
checks every fighter's stats against the range of Ultimate's 89-fighter cast, so a typo like a gravity of 0.9 fails
`npm test`. Start from the nearest archetype in `docs/physics-reference.md` section 17 (Pichu, Pikachu, Mario,
Donkey Kong, Bowser, Fox, Jigglypuff) and adjust.

| Field                                                    | Meaning                                                                     | Fireboy          | Mario               | Cast range       |
| -------------------------------------------------------- | --------------------------------------------------------------------------- | ---------------- | ------------------- | ---------------- |
| `weight`                                                 | knockback resistance                                                        | 84               | 98                  | 62–135           |
| `height`, `width`                                        | body size: the hurtbox capsule and the environment box (feet at the origin) | 15, 8            | 15, 8               | (estimate)       |
| `walkSpeed`, `walkAccelBase`, `walkAccelAdd`             | max walk speed; acceleration = base + add × stick                           | 1.1              | 1.155               | 0.62–1.575       |
| `groundFriction`                                         | traction: speed lost per frame when not accelerating                        | 0.1              | 0.102               | 0.076–0.138      |
| `dashInitialSpeed`, `dashFrames`                         | initial dash speed and length (dash-dance window)                           | 1.95, 11         | 1.936, 11           | 1.45–2.45        |
| `runSpeed`, `runAccelBase`, `runAccelAdd`                | run speed and acceleration                                                  | 1.85             | 1.76                | 1.18–3.85        |
| `airSpeed`, `airAccelBase`, `airAccelAdd`, `airFriction` | air drift                                                                   | 1.15             | 1.208               | 0.735–1.344      |
| `gravity`, `fallSpeed`, `fastFallSpeed`                  | per-frame gravity and terminal speeds                                       | 0.09, 1.55, 2.48 | 0.087, 1.5, 2.4     | 0.053–0.23       |
| `jumpSquat`                                              | frames on the ground before leaving it                                      | 3                | 3                   | 3–6              |
| `fullHopHeight`, `shortHopHeight`, `doubleJumpHeight`    | apex heights above take-off                                                 | 34, 16, 33       | 36.33, 17.54, 36.33 | 16.5–50.5        |
| `jumps`                                                  | total jumps including the grounded one                                      | 2                | 2                   | 2–6              |
| `ledgeJumpHeight`                                        | apex of a ledge jump                                                        | 36               | 38.165              |                  |
| `softLandingLag`, `hardLandingLag`                       | landing lag after short / long airtime                                      | 1, 3             | 1, 3                |                  |
| `shieldSize`                                             | shield bubble radius at full health                                         | 9                | 9.7                 | 8–18.5           |
| `rollDistance`, `airDodgeSpeed`                          | roll distance, directional air dodge speed                                  | 28, 2.8          | 28, 2.8             | 26.5–39.7 (roll) |

Jump velocities are derived from the heights (`src/sim/physics.ts`), so you give heights, not speeds.

## Moves

`moves` maps a move name to its `MoveDef`. The name is also the animation clip the renderer plays, and
`FighterState.move` holds it while the move runs. Inputs pick moves by these names
(`src/sim/actions/attack.ts`):

| Input                                       | Grounded                                                                | Airborne                                            |
| ------------------------------------------- | ----------------------------------------------------------------------- | --------------------------------------------------- |
| Attack                                      | `jab`                                                                   | `nair`                                              |
| Attack + held direction (or walk modifier)  | `ftilt`, `utilt`, `dtilt`                                               | `fair`, `bair`, `uair`, `dair` (relative to facing) |
| Attack + tapped direction, or C-stick       | `fsmash`, `usmash`, `dsmash` (back turns around)                        | the matching aerial                                 |
| Attack while dashing or running             | `dashAttack`                                                            |                                                     |
| Special + direction                         | `neutralB`, `sideB`, `upB`, `downB`                                     | same                                                |
| Grab, or Shield + Attack (also in shield)   | `grab`, `dashGrab` (dash or run), `pivotGrab` (dash or run, stick back) |                                                     |
| Holding someone: stick or C-stick direction | `fthrow`, `bthrow`, `uthrow`, `dthrow`                                  |                                                     |
| Holding someone: Attack or Grab             | `pummel`                                                                |                                                     |

Up smash and up special also come out of jumpsquat, so up + Attack with tap jump still up-smashes. A fighter
without a move simply does nothing for that input.

### MoveDef

```ts
fsmash: {
  kind: 'smash',          // 'smash' | 'aerial' | 'projectile' | 'other': sets shieldstun (and smash charge)
  faf: 50,                // first actionable frame
  charge: 12,             // smash attacks: holding the input pauses here, up to 60 frames, up to 1.4x damage
  hits: [
    {
      frames: [15, 17],   // inclusive
      boxes: [
        { id: 0, x: 12, y: 8.5, radius: 5.5, damage: 17.8, angle: 361, kbg: 102, bkb: 30, effect: 'fire' },
        { id: 1, x: 6, y: 8.5, radius: 3.5, damage: 14.7, angle: 361, kbg: 102, bkb: 25, effect: 'fire' },
      ],
    },
  ],
},
```

- **Jab combos.** `next: { window: [from, to], move }` on a grounded move: Attack with no stick direction during
  `window` cancels into `move`, so `jab` -> `jab2` -> `jab3` each name the next hit (The Duck's
  `src/fighters/duck/moves.ts`). Each hit is its own move and animation clip.
- **Windows.** `hits` lists frame windows; each puts its `boxes` out on those frames. A move hits each fighter
  once. A window with `rehit: true` forgets earlier victims when it opens, for multi-hit moves (Fireboy's `dair`).
- **Hitboxes.** These are circles at `x` (forward, in the facing direction) and `y` (up) from the feet. When
  several touch a fighter on the same frame, the lowest `id` wins, so give the sweetspot id 0.
- **Knockback.** `damage`, `angle` (degrees from the attacker's facing; 361 is the Sakurai angle), `kbg`
  and `bkb` follow Ultimate's frame data exactly. Optional fields: `wbkb` (set knockback), `hitlag` (a
  multiplier), `shieldDamage` (extra) and `effect` (`'electric'` gives 1.5x hitlag).
- **Direction.** A hit launches along the attacker's facing unless its box sets `direction`: `'back'` for boxes
  behind him (back aerials, the rear hit of a down smash) and `'away'` for boxes around his body (spins, up
  attacks), which send the target away from his centre.
- **Landing lag.** Aerials give `landingLag` and `autoCancel` windows; a `helpless` move's `landingLag` also
  applies when it lands out of the helpless fall.
- **Auto-cancel.** Landing in an aerial's `autoCancel` window costs only normal landing lag.
- **Intangibility.** `intangible: [from, to]` makes the fighter intangible on those frames of the move.
- **Armor.** `armor: { frames: [from, to], threshold?, damageThreshold? }` armours the fighter on those frames of the
  move, as in Ultimate: hits still add damage and hitlag, but they don't launch, cause hitstun or interrupt the move.
  A hit breaks through when its knockback reaches `threshold` (threshold armor) or its damage reaches
  `damageThreshold` (Kirby's Stone); with neither it is heavy armor. Grabs and throws ignore armor.
- **Getup attack.** A move named `getupAttack` plays when a fighter lying down after a missed tech presses
  Attack. Give it `intangible: [1, 26]` (Ultimate's) and hits on both sides; without one, Attack just stands up.
- **Specials.** `script(x)` runs every frame of the move before physics and sets velocity or facing. It must be
  deterministic: no `Math.random`, no clocks; use `x.m.rng` if you need randomness.
  - `leavesGround` makes a grounded start take off.
  - `helpless` ends the move in helpless fall.
  - `ledgeFrom` lets the move grab a ledge from that frame.
  - Fireboy's `upB` uses all three.
  - `continuesOnLanding` lets an airborne special carry on from the same frame when it lands, instead of
    ending in landing lag.
  - `air` names the move to play instead when the input comes in the air (Ultimate's SpecialN and SpecialAirN):
    `neutralB: { ..., air: 'neutralBAir' }`. The variant is its own move, so it has its own frame data and clip,
    and the `move` event carries its name.
- **Transform.** `transform: { frame, into }` turns the fighter into fighter `into` on that frame of the move
  (Zelda/Sheik style). FighterState carries over (%, stocks, position, momentum), and stats, moves and art switch;
  `into` needs a move of the same name, which plays the rest of the move. Fireboy and Watergirl's down special
  (`src/fighters/fireboy/swap.ts`) is the example. A form that is only reached by transforming sets
  `selectable: false` on its FighterDef, so menus list only the fighter that starts the match.

### Action overrides

`actions` on a FighterDef replaces shared actions (`src/sim/actions/`) for that fighter only, by action name, or adds
actions only that fighter enters. The engine looks every action up through `actionDef(f)`
(`src/sim/actions/registry.ts`), so an override's `physics`, `friction`, `edge`, `drift`, `ledge`,
`intangible` and `land` all apply. Bloxorz block's `walk`, `dash`, `run` and `crouch` tip the block end over end
instead of sliding:

```ts
actions: {
  walk: {
    physics: 'ground',
    edge: 'fall',
    friction: false,
    update(x) {
      if (groundActionable(x)) return; // jump, attacks, shield, crouch: the shared options
      // set x.f.vel.x yourself, setAction(x, 'idle') when the stick lets go
    },
  },
},
```

Reuse the shared helpers (`groundActionable`, `startMovement`, `setAction`) so inputs keep Smash's priorities, keep
the names canonical (audio, art and CPUs key off action names), and keep overrides deterministic, like move scripts.

### Hurtbox shape

The hurtbox is a capsule from `width` and `height`: upright (half the width thick, from the feet to the head) for
most fighters, and lying (half the height thick, along the width) for a fighter wider than it is tall. Crouching
lowers an upright body only. A form that
changes shape mid-match (Bloxorz block standing up or lying down) is a separate FighterDef with its own size,
reached by `transform`. `?hitboxes` draws either shape.

`src/sim/combat/`; a fighter only supplies numbers.

Every move start, hit and landing is reported as a sim event (`docs/sim-events.md`). Audio and effects key off
move names, so keep them to the canonical names above.

### Grabs and throws

A grab is a grounded move whose boxes are grab boxes; pummels and throws are moves with no boxes that act on the
fighter being held (Fireboy's, in `src/fighters/fireboy/moves.ts`):

```ts
grab: {
  kind: 'other',
  faf: 35,
  hits: [
    {
      frames: [6, 7],
      boxes: [{ id: 0, x: 7.5, y: 7, radius: 4.5, damage: 0, angle: 0, kbg: 0, bkb: 0, grab: true }],
    },
  ],
},
pummel: { kind: 'other', faf: 6, hits: [], pummel: { frame: 1, damage: 1.3, hitlag: 2.1 } },
bthrow: {
  kind: 'other',
  faf: 60,
  hits: [],
  throw: { frame: 44, hit: { damage: 11, angle: 45, kbg: 75, bkb: 50, direction: 'back' } },
},
```

- **Grab boxes.** A box with `grab: true` catches instead of hitting (leave its damage and knockback at 0). It
  catches the nearest fighter in front of the grabber, straight through shields, and shrinks to half its radius
  against airborne fighters. The grabber goes into `grabHold` and the victim into `grabbed`, held just in front of
  him; a grab that catches nobody plays the whole move. Grab range is the box's far edge, `x + radius` (Mario's
  is 12).
- **`pummel: { frame, damage, hitlag? }`.** On `frame` the held fighter takes `damage` and hitlag (times
  `hitlag`) but no knockback, and stays held.
- **`throw: { frame, hit }`.** On `frame` the held fighter is let go and takes `hit`, a hitbox without a position,
  through the same knockback path as any hit (staleness, rage and DI included). As in Ultimate a throw has no
  hitlag unless `hit.hitlag` sets a multiplier; `direction: 'back'` throws behind. The thrower is intangible until
  the release, and a started throw can't be escaped.
- **Hold time** is floor(90 + 1.7 × %) frames at the moment of the grab. Each new stick direction the victim
  mashes cuts 8 frames and each button press 14.4, but a hold lasts at least 19 frames. Then both slide apart into
  `grabRelease` (29 frames of lag each, so neither has the advantage), and the freed fighter can't be grabbed for
  60 frames. A fighter pushed off a floor edge keeps the rest of its grab release in the air and through the
  landing.
- **More players.** Hitting the holder frees the held fighter. A held fighter takes hits from others without being
  launched until they add up to 10%; then it breaks free and is launched by the strongest of that frame's hits.
  Hits on both partners in one frame are judged from the grab as it stood before them, so ports never change the
  outcome: one hit on both launches the holder and frees the held fighter unless it also reaches 10%.
- **Same frame.** Grabs resolve after the frame's hits (`src/sim/actions/grab.ts`). An attack beats a grab: a
  fighter struck this frame neither grabs nor is grabbed. Two fighters grabbing each other clank, as in
  Ultimate: both go into grab release and take 1% (1.2% in 1v1). Otherwise grabs resolve in port order, so when
  two grabs catch the same fighter the lower port wins.
- **Shield grabs** use `grab` and come out from 4 frames after shieldstun ends.

### Tuning tools

- `?hitboxes` on the game URL (or **F4**) draws hurtboxes in yellow, active hitboxes in red (entities' too),
  grab boxes in purple, reflector bubbles in cyan and absorber bubbles in green; `?actions` (F3) labels each
  fighter's action and frame.
- `/lab.html?scene=knockback` charts a hit's knockback and hitstun against target % for four weights.
- `/lab.html?scene=launch` simulates the real launch trajectories of a hit at 0–200% on your fighter:
  `__lab.call('hit', { damage, kbg, bkb, angle, fighter: '<id>' })`.
- The harness (`/?harness`, `window.__smash`) steps scripted inputs frame by frame for captures and tests; see
  `docs/architecture.md`.

## Stages

Stages can move (docs/stage-geometry.md): a fighter standing on a moving platform or solid rides it, one hanging from a
moving ledge moves with it, and a solid that runs into a fighter pushes them out or squeezes them out on top of
it. Nothing in a fighter needs to change for that. A move's `script` that reads the stage (`x.stage`) sees it
as it stands on the current frame, moved pieces and all, and should skip absent pieces
(`x.stage.present`).

## Entities and projectiles

Anything a move puts into the match that is not a fighter is an **entity**: projectiles, minions (Fisherman's fish),
setplay objects (Snail Bob's crate, Bloxorz's split cube) and items. Entities are plain data in
`MatchState.entities` (`EntityState`, `src/sim/entities/types.ts`), hashed and replayed with everything else. Each
has a monotonic `id`, a `kind`, an `owner` port (-1 for nobody), position, velocity, `facing`, `age` (1 on the
frame it appears) and `lifetime`. Their behaviour comes from an `EntityDef`, listed under the fighter's
`entities` and named `"<fighter id>/<name>"` in state. Fireboy's Fireball (`src/fighters/fireboy/entities.ts`) is
the worked example; `src/sim/testing/gadgets.ts` shows the rest (a piercing beam, a reflector, an absorber, a
crate, a minion).

```ts
// entities.ts
fireball: {
  radius: 2.4,            // body circle: stage collision, reflectors, absorbers, attacks
  lifetime: 70,           // frames; omit to live until destroyed
  gravity: 0.1, maxFall: 1.6,
  floor: 'bounce', bounce: 1.1, // every bounce reaches the same height, like Mario's fireball
  wall: 'bounce',
  hits: [{ frames: [1, 70], boxes: [{ id: 0, x: 0, y: 0, radius: 2.4, damage: 5.5, angle: 361, kbg: 35, bkb: 20 }] }],
},
// moves.ts
neutralB: { kind: 'other', faf: 50, hits: [], spawn: [{ frame: 17, entity: 'fireball', x: 6, y: 8, vx: 1.4, vy: -0.6 }] },
```

- **Spawning.** A move's `spawn` puts an entity out on an action frame, offset from the feet (x forward) with an
  initial velocity (x forward). The entity shows and hits at that point on that frame (its hits start at age 1), so
  the spawn frame is the move's first active frame; it starts moving the next frame. `max` caps how many of that
  kind the fighter may own at once (Pepper Bombs: 2); further spawns are skipped. Scripts can call
  `spawnEntity(m, { kind, owner, pos, vel, facing, move })` (`src/sim/entities/entities.ts`) directly.
- **Hits.** `hits` are windows over the entity's age (`rehit` works as for moves), x mirrored by its `facing`. They
  go through the same hit path as fighters' hits as `kind` (default `'projectile'`: shieldstun x0.29), staled by
  the owner's spawning move, scaled by the owner's rage, with DI, shields and the victim's hitlag. The entity itself
  never freezes when it hits, and neither does its owner. It hits each fighter once and is used up by its first
  victim or shield unless `pierce` is set. It never hits its owner. On a grab it counts like any hit: hitting the
  holder frees the held fighter, and a held fighter armours through it up to the grab's break damage.
- **Stage.** `floor` is `'bounce'` (up at `bounce` speed), `'land'` (rest on it; `grounded` is set),
  `'destroy'` (default) or `'pass'`; `wall` (walls and ceilings) is `'bounce'`, `'stop'`, `'destroy'` (default) or
  `'pass'`. Entities land on soft platforms too, and vanish past the blast zones or when `lifetime` runs out. Moving
  pieces (docs/stage-geometry.md) collide by their motion relative to the entity, absent ones are skipped: a floor
  rising under a resting entity lifts it, a solid running into one pushes it, and one on a floor that a ceiling comes
  down on is crushed (destroyed, reason `stage`). Entities don't ride a piece's sideways motion yet.
- **Scripts.** `script(x)` runs every frame before movement with `x.e` (the entity), `x.owner` and `x.c` (the
  owner's controller, for owner-controlled minions), `x.m` and `x.stage`. It may steer, spawn or
  `destroyEntity`, and keeps its own state in `x.e.data`. Deterministic only: use `x.m.rng`.
- **Hittable entities.** Give `hp` and fighters' attacks and other owners' projectiles damage it (once per move);
  attacker and entity share the hitlag, it breaks at 0 HP, and with a `weight` it is launched by Ultimate's
  knockback formula using the % it has taken. A fighter cannot hit its own entities.
- **Reflectors.** A move's `reflectors` are bubbles (`frames`, `x`, `y`, `radius`) that turn a touching projectile
  away from the fighter, make it his, and multiply its damage, speed and remaining lifetime. Defaults are Fox's
  Reflector in Ultimate: damage x1.4, speed x1.4, lifespan x1, up to 50% (SmashWiki, Reflection); Mario's Cape is
  x1.5 / x1 / x0.75, as on Fireboy's Temple Mirror. A projectile over the limit goes through and hits; one reflected
  7 times is destroyed by the next reflector (Ultimate).
- **Absorbers.** A move's `absorbers` bubbles eat absorbable projectiles and heal the fighter by their damage x
  `heal`. Defaults are Ness's PSI Magnet in Ultimate: x1.6, up to 30% (SmashWiki, Absorption). Projectiles are
  `reflectable` and `absorbable` unless they opt out; hittable entities are neither.
- **Clanks.** Ultimate's 9% rule (SmashWiki, Priority), simplified: a fighter's attack destroys a projectile unless
  the projectile deals more than 9% more, in which case it passes through the attack (and usually hits). The
  attacker is never interrupted (there is no rebound yet). Two projectiles of different owners clank and each is
  destroyed unless it deals more than 9% more than the other. `transcendent` projectiles never clank, and grab boxes
  never hit or clank with entities.
- **Order of a frame.** Fighters act (spawning), the stage moves, entities move, then reflectors, absorbers and clanks, then every hit
  from fighters and entities lands at once, then grabs (an attack or projectile beats a grab on the same frame).
- **Events.** Entities report `entitySpawn`, `entityDestroy` (with the reason), `reflect`, `absorb` and `entityHit`,
  and their hits are `hit` and `shieldHit` events carrying the `entity` id (`docs/sim-events.md`).

## Art

`art` is plain data drawn by the vector rig (`src/render/rig/`): parts, poses per clip name and palettes. Clips
are keyed by action names (`idle`, `run`, `jump`, …) and move names (`fsmash`, `nair`, …). See
`docs/art.md`.

## Checklist

1. Copy `src/fighters/fireboy/` to `src/fighters/<id>/` and change `id`, `name` and `series`.
2. Set `stats.ts` from the closest archetype; `npm test` checks the cast ranges.
3. Write `moves.ts`. `fighters.test.ts` checks every window lies before `faf`, ids are unique and charge frames
   come before the first hitbox.
4. Add `<id>.test.ts` for the moves you care about. Fireboy's tests show how to drive inputs (`run`,
   `runPorts`) and read hitboxes (`activeHitboxes`).
5. Play it: `npm run dev`, open `/?hitboxes`, and pick the fighter for a port in `DEFAULT_MATCH` (`src/sim/match.ts`)
   or with `__smash.newMatch({ ports: [{ fighter: '<id>' }, { fighter: 'fireboy' }] })` under `?harness`.
6. `npm run check` and `npm run build && npx playwright test` before opening the PR.
