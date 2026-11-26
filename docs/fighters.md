# Adding a fighter

A fighter is one directory, `src/fighters/<id>/`, whose `index.ts` exports `fighter: FighterDef`. The registry
(`src/fighters/registry.ts`) finds it with `import.meta.glob`, so adding a fighter edits no shared file. Fireboy
(`src/fighters/fireboy/`) is the worked example; copy it.

A fighter's files may import sim code, and the sim imports the registry, so the registry reads the fighter
modules on the first `getFighter` or `allFighters` call. Look fighters up inside functions, never at module
load: a lookup while a fighter module is still loading throws.

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
| `dashInitialSpeed`, `dashFrames`                         | initial dash speed and length; a flick back after frame 5 turns at its end  | 1.95, 11         | 1.936, 10           | 1.45–2.45        |
| `runSpeed`, `runAccelBase`, `runAccelAdd`                | run speed and acceleration                                                  | 1.85             | 1.76                | 1.18–3.85        |
| `airSpeed`, `airAccelBase`, `airAccelAdd`, `airFriction` | air drift                                                                   | 1.15             | 1.208               | 0.735–1.344      |
| `gravity`, `fallSpeed`, `fastFallSpeed`                  | per-frame gravity and terminal speeds                                       | 0.09, 1.55, 2.48 | 0.087, 1.5, 2.4     | 0.053–0.23       |
| `damageFlyTopGravity` (optional)                         | gravity in hitstun after a 70–110° tumble launch (fall speed 1.8 then)      | (default)        | 0.074928            | 0.0628–0.0874    |
| `jumpSquat`                                              | frames on the ground before leaving it                                      | 3                | 3                   | 3–6              |
| `fullHopHeight`, `shortHopHeight`, `doubleJumpHeight`    | apex heights above take-off                                                 | 34, 16, 33       | 36.33, 17.54, 36.33 | 16.5–50.5        |
| `jumps`                                                  | total jumps including the grounded one                                      | 2                | 2                   | 2–6              |
| `airJumpHeights`                                         | optional: each midair jump's apex in order (see Air mobility)               |                  |                     |                  |
| `ledgeJumpHeight`                                        | apex of a ledge jump                                                        | 36               | 38.165              |                  |
| `softLandingLag`, `hardLandingLag`                       | landing lag after short / long airtime                                      | 1, 3             | 1, 3                |                  |
| `shieldSize`                                             | shield bubble radius at full health                                         | 9                | 9.7                 | 8–18.5           |
| `rollDistance`, `airDodgeSpeed`                          | roll distance, directional air dodge speed                                  | 28, 2.8          | 32.17, 2.8          | 26.5–39.7 (roll) |
| `backRollDistance` (optional)                            | back roll distance out of shield; defaults to `rollDistance`                | (default)        | 30.63               | 26.4–36.6        |

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
  kind: 'smash',          // 'smash' | 'aerial' | 'projectile' | 'other': sets shieldstun (and which button charges)
  faf: 50,                // first actionable frame
  charge: 12,             // holding the input pauses here, up to 60 frames, up to 1.4x damage (see Charging)
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
- **Autolink.** Use these angles on linking hits of a multihit; the last hit usually uses a regular angle.
  Damage and hitstun still come from the hit's own knockback.
  - `365` launches at half the attacker's velocity.
  - `366` keeps the hit's launch speed, steering toward the hitbox for five frames before following the
    attacker's original movement direction.
  - `367` launches airborne targets at the attacker's velocity plus 20% of the gap toward the hitbox.
    Downward launch is limited to 1 unit/frame, and total launch speed is capped at 3 after five frames.
    Grounded targets launch normally at 80°.
  - `368` uses `vector: { x, y, frames }` on the box to aim at a point relative to the attacker's feet at
    contact (forward and up). It pulls the target's middle toward that point over `frames` (rounded up)
    and then drops its launch speed. Stage collision still applies. A vector works with any angle; without
    one, `368` falls back to `367`.
- **Windboxes.** `pushOnly: true` applies knockback without damage, hitlag, hitstun or interruption. It pushes
  grounded targets horizontally without lifting them, and shields ignore it. Use `damage: 0`; windbox
  projectiles can be reflected or absorbed as usual, but heal nothing on absorption. Watergirl's Water Stream
  (`src/fighters/watergirl/waterStream.ts`) is the example: F.L.U.D.D.'s windbox pumps, stronger with charge.
- **Direction.** A hit launches along the attacker's facing unless its box sets `direction`: `'back'` for boxes
  behind him (back aerials, the rear hit of a down smash) and `'away'` for boxes around his body (spins, up
  attacks), which send the target away from his centre.
- **Ground and air targets.** A box with `targets: 'ground'` hits only fighters standing on the ground, and one
  with `targets: 'air'` hits only airborne fighters. A fighter hanging on a ledge counts as airborne. Unset, or
  `'both'`, hits either, as most Ultimate hitboxes do (SmashWiki "Hitbox", groundedness/airness). Kirby's Stone
  shockwave is ground-only. For a move that acts differently on grounded and aerial targets, put a ground box and
  an air box in the same place, as Samus' up tilt does. The ground box takes the lower id, and a fighter takes
  the lowest-id box that can hit it where it is. A box that skips a fighter doesn't use up the move's hit on it,
  so it can still connect on a later active frame once the fighter lands or leaves the ground. Windboxes
  (`pushOnly`), grab boxes, entity hits, stage hitboxes and damage zones (`hit`) take `targets` too. Throws don't.
  A counter catches only boxes that can hit the counterer, so a ground-only box passes an airborne one untouched.
- **Landing lag.** Aerials give `landingLag` and `autoCancel` windows; a `helpless` move's `landingLag` also
  applies when it lands out of the helpless fall.
- **Auto-cancel.** Landing in an aerial's `autoCancel` window costs only normal landing lag.
- **Intangibility.** `intangible: [from, to]` makes the fighter intangible on those frames of the move.
- **Armor.** `armor: { frames: [from, to], threshold?, damageThreshold?, breakDamageMul? }` armours the fighter on
  those frames of the move, as in Ultimate: hits still add damage and hitlag, but they don't launch, cause hitstun or
  interrupt the move. A hit breaks through when its knockback reaches `threshold` (threshold armor) or its damage
  reaches `damageThreshold` (Kirby's Stone); with neither it is heavy armor. Grabs and throws ignore armor.
  - `breakDamageMul` scales the % the breaking hit adds. Its knockback, its hitlag and the threshold check still use
    the full damage. Set it only where the Ultimate analogue does it. SmashWiki ("Stone") documents it only for
    Kirby's Stone, whose breaking hit deals half damage at full knockback (`breakDamageMul: 0.5`). Its "Armor" page
    says most armor takes full damage, so leave it unset by default.
- **Counter.** `counter: { window, move }` blocks hits on those frames and plays the counterattack `move` (see
  Counters below).
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
  - `glide` glides at the end of the move if Jump is held (see Air mobility).
  - `action` plays the move in another action with its own physics instead of `attack`/`aerial`: `'hover'`.
  - `drift: false` turns off air drift (and air friction) while an airborne move plays, so a scripted path such
    as Bob the Robber's Grappling Hook zip (his `upB`) is not bent by the stick.
  - `gravity: false` turns off gravity while an airborne move plays, so its script alone sets the vertical speed.
  - `fallThrough: false` lands on soft platforms even with the stick held down. Ultimate's aerial attacks and most
    specials can't fall through them (SmashWiki, "Platform"), but the engine lets any airborne fighter holding down
    drop through unless the move opts out. Snail Bob's Shell Pound (`src/fighters/snailbob/shellPound.ts`, Bowser
    Bomb) uses both, with `drift: false`, for a stall and a 9-unit-a-frame drop that land on platforms.
  - `fastFall: false` stops a down flick from fast-falling while an airborne move plays, as in Ultimate's specials
    (the Duck's Running Ram).
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

For a distinct pose, `FighterDef.hurtbox` can return a world-space capsule from the simulation state. Return
`undefined` to keep the default capsule. This changes hit and grab contact, not how the fighter collides with the
stage. The debug overlay uses the same capsule.

`src/sim/combat/`; a fighter only supplies numbers.

Every move start, hit and landing is reported as a sim event (`docs/sim-events.md`). Audio and effects key off
move names, so keep them to the canonical names above.

### Charging

`charge` is the frame a move pauses on while it charges (`src/sim/actions/charge.ts`). Smash attacks charge while
Attack or the C-stick is held. Any other move with `charge` (a special) charges while Special is held. Letting go,
or reaching full charge, carries on with the move.

- **`chargeFrames`** is the hold for a full charge (default 60, Ultimate's smash attacks).
- **`chargeDamage`** is the damage multiplier at full charge (default 1.4, Ultimate's smash attacks). Less charge
  scales linearly from 1, and knockback grows through the damage. The test charger's side special sets
  `chargeDamage: 2.2`, so its 10% hitbox reaches 22%. The Duck's Running Ram (`src/fighters/duck/ram.ts`, Pikachu's
  Skull Bash) charges for 80 frames from 6.2% to 21.4% and speeds up its dash with `chargeLerp`.
- **Speeds and distances.** A move script reads `chargeLerp(f, uncharged, full)` for a value at the current charge
  level (a dash speed), or `chargeLevel(f)` (0 to 1).
- **Projectiles.** An entity whose EntityDef sets `chargeDamage` hits for up to that many times its damage at the
  spawning move's full charge, linearly from 1 (`chargeScale(level, full)`), so its knockback grows too. A move's
  `spawn` passes the move's charge level; a script passes `charge: chargeLevel(f)` to `spawnEntity`. The multiplier
  goes into the entity's `damageMul`, so reflections stack on it. The Raft Wars kids' Aimed Shot is the example.
- **Scripts while charging.** The script runs once a frame while the move is held, with `actionFrame` on the frame
  before the charge frame. That frame's spawns, `rehit` windows and `transform` happen once, on the way in.
- **Stored charge.** `storeCharge: {}` lets shield, an air dodge or a jump cancel the charge and keep it in
  `storedCharge`. The move's next use starts from it (a full one fires at once) and spends it when it fires.
  Releasing Special fires. With `tap: true` the move charges by itself and fires on the next Special or Attack
  press. `storeAtFull: true` stores the charge and ends the move once it is full; otherwise the move waits at full
  charge. Samus's Charge Shot and Donkey Kong's Giant Punch are `{ tap: true, storeAtFull: true }`, and so is
  Wheely's Rev Up (`src/fighters/wheely/moves.ts`), on Giant Punch. CPUs press Special again on a tap move's charge
  frame, at once for an uncharged blast or after up to 40 frames of charge (`chargeInput` in `src/ai/knowledge.ts`).
- **Variants and forms.** A move and its `air` variant share one stored charge (Ultimate: Samus's grounded and
  aerial Charge Shot). A stored charge belongs to the form that stored it. After a `transform`, the new form's move
  of the same name starts uncharged, and the charge is back after transforming again. Only a KO as the storing form
  loses it (Ultimate: Squirtle keeps Water Gun's charge through Pokemon Change).
- A charging move, and a fighter holding a stored charge for its current form, glow behind the fighter
  (`src/render/chargeGlow.ts`, placeholder art). A move whose art draws its own charge with a `<move>Charge` clip
  (docs/art.md) gets no placeholder while it charges.
- `src/sim/testing/charge.ts` (`test-charger`, registered for tests and `?harness`) has one move of each kind.
- Charging emits `charge` events (`full`, `store`, `fire`) with the charge level (`docs/sim-events.md`).

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

### Command grabs

A command grab (Ganondorf's Flame Choke, Incineroar's Alolan Whip) is a special whose grab boxes go straight into a
throw when they catch. `commandGrab` names that throw move, and the throw can land `holdHits` (chews, slams)
before its `throw` lets go. Beast Lunge from the roster, in `src/sim/testing/beast.ts` until Balloon Boy & the
Beast exist:

```ts
sideB: {
  kind: 'other',
  faf: 50,
  commandGrab: 'beastChew',
  hits: [
    {
      frames: [14, 16],
      boxes: [{ id: 0, x: 10, y: 7, radius: 5, damage: 0, angle: 0, kbg: 0, bkb: 0, grab: true }],
    },
  ],
},
beastChew: {
  kind: 'other',
  faf: 55,
  hits: [],
  holdHits: [
    { frame: 10, damage: 3 },
    { frame: 24, damage: 3 },
  ],
  throw: { frame: 40, hit: { damage: 6, angle: 55, kbg: 70, bkb: 70 } },
},
```

- **Catching.** A command grab's boxes follow the grab rules above (through shields, only in front, attacks beat
  them, two grabs on each other clank), except that they keep their full size against airborne fighters.
- **The throw.** On the catch the grabber goes into `grabThrow` playing the named move from frame 1, and the
  victim into `grabbed`. As with any started throw the victim can't mash out, and the grabber is intangible until
  the release. A command grab caught in the air plays on in the air and through the landing, then ends in a fall
  if the grabber is still airborne. In the air the stick drifts it, unless the throw move sets `drift: false`.
- **`holdHits: [{ frame, damage, hitlag? }]`** land in order like pummels: damage and hitlag, no knockback. Their
  damage counts towards the release's knockback.
- **Third parties.** Hits from others break the victim free after 10%, as in any grab.

### Counters

A move with `counter` blocks hits and answers them with a counterattack. Marth's Counter in Ultimate, from the test
fixtures in `src/sim/testing/counter.ts`:

```ts
downB: {
  kind: 'other',
  faf: 65,
  hits: [],
  intangible: [5, 6],
  counter: { window: [6, 27], move: 'downBHit' },
},
downBHit: {
  kind: 'other',
  faf: 42,
  intangible: [1, 8],
  hits: [
    {
      frames: [5, 7],
      boxes: [{ id: 0, x: 9, y: 8, radius: 8, damage: 8, angle: 361, kbg: 60, bkb: 90 }],
    },
  ],
},
```

- **The catch.** A hit whose box touches the fighter on a `window` frame (inclusive) is blocked: no damage, knockback,
  hitstun or `status`. Every hit on it that frame is blocked, and the first in the frame's order (attackers by port,
  then projectiles) sets the counter off. Grabs, command grabs and stage hazards go through, even on the frame the
  counter catches a hit: then the grab or the hazard wins, the counterattack doesn't start and nobody freezes. A
  windbox (`pushOnly`) pushes the counterer without setting it off. An intangible fighter is never touched, so it
  can't counter: Marth is intangible on frames 5 and 6, and his first catch is on frame 7.
- **The freeze.** The counterer goes straight into the counterattack `move` and freezes with the attacker for
  `freeze` frames (default 21, Marth's). The counterattack's frame 1 is the last frozen frame, so its frame numbers
  are Ultimate's and Marth's swing lands 25 frames after the catch. The counterer is intangible through the freeze,
  and the counterattack's own `intangible` takes over from frame 1. A counter whose Ultimate analogue doesn't freeze
  the counterer counts its counterattack frames from the catch; take `freeze - 1` off them so the hit lands on the
  same frame after the catch. Bob the Robber's Shadow Step (`src/fighters/bob-the-robber/specials.ts`) does this
  with Double Team's frames and a 12-frame freeze.
- **Facing.** The counterer turns to face the hit. With `behind` it reappears that many units behind the attacker
  instead, facing their back, as Lucario's Double Team does: on the attacker's floor (held to its ends), or in the
  air beside an airborne attacker.
- **Damage.** The counterattack's boxes deal the caught hit's damage (after staleness, as a shield takes it) times
  `multiplier` (default 1.2), capped at `max` (default 50%), or their own damage when that is more. Marth's 8% box is
  his counter's minimum, as in Ultimate's data. `multiplier: 0` always deals the boxes' own damage (Double Team's
  fixed 12.5%). The boxes deal the same on hittable entities and in clanks with projectiles (`hitboxDamage`,
  `src/sim/combat/hits.ts`). Otherwise the counterattack is a normal move: it can miss, it stales, and rage and DI
  apply.
- **Projectiles.** A caught projectile is used up as if it hit. The counterer answers in place, even with `behind`,
  and nobody else freezes.
- **Events.** A catch reports `counter` with what the caught hit would have dealt, then `move` for the counterattack
  (`docs/sim-events.md`).

The defaults (`COUNTER`, `src/sim/constants.ts`) and the fixture are SmashWiki's Marth (SSBU)/Down special: counter
6-27, x1.2, 8% to 50%, "Counter hitlag on activation: 21 frames", the counterattack's frames and its knockback. The
rules are SmashWiki's Counterattack page: blockable hits during the counter are blocked, grabs are immune, and
counters don't trigger while the fighter is invincible. Not modelled: a freeze scaled from the caught hit and the
slowdown (Double Team, Greninja's Substitute), and choosing the counterattack's direction with the stick.

`?harness` registers both fixtures, so you can try them:
`__smash.newMatch({ ports: [{ fighter: 'fireboy' }, { fighter: 'test-counter' }] })` (or `test-counter-behind`), then
down special.

### Final Smash

A move named `finalSmash` is the fighter's Final Smash. Neutral special plays it while the fighter holds a charge
from breaking the Coolmath Planet (`FighterState.finalReady`, docs/items.md), on the ground or in the air, from any
state a special can start from, and the charge is spent. Side, up and down special stay specials, and a fighter
without a `finalSmash` move keeps the charge. Every move of a Final Smash carries `final` (its `air` variant, a
trap's cinematic). The engine is `src/sim/finalSmash.ts`; the test fighters in `src/sim/testing/finalSmash.ts`
(`test-final-direct`, `test-final-trap`, `test-final-none`, also under `?harness`) show both shapes, and
`src/sim/finalSmash.test.ts` drives them.

The rules follow SmashWiki's Final Smash and Smash Ball articles:

| Ultimate (SmashWiki)                                                                           | Here                                                                                       |
| ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| "unleashed at any time by pressing the input for a neutral special move" (Smash Ball)          | neutral special with `finalReady`, grounded or airborne                                    |
| Final Smashes "are unblockable, make the user fully intangible"                                | a `final` move is intangible on every frame; its hits and its projectiles' ignore shields  |
| "unblockable attacks cannot be countered" (Counterattack)                                      | its hits and its projectiles' go through parries and counters too                          |
| "Most Final Smashes cause the camera to temporarily zoom in on the user when activated"        | everyone else holds still for `FINAL_SMASH.freeze` (40) frames; the renderer zooms in gold |
| a cinematic's hitbox traps an opponent and "the game effectively pauses" while the scene plays | a trap holds its catch through the cinematic; everyone and everything else holds still     |
| direct Final Smashes play out in normal time                                                   | past the freeze, others move and act as usual                                              |
| a KO in standby loses the Final Smash                                                          | `stepItems` clears `finalReady` on a KO                                                    |

SmashWiki gives no length for the activation freeze, so 40 frames is an estimate; `final.freeze` overrides it per
move. The others are held on the move's frames 2 to `freeze` + 1, so nothing in the activation move may come out
before frame `freeze` + 2 (`fighters.test.ts` checks it). The freeze holds every other fighter and entity in hitlag
for each frame it lasts (`holdStill`, at the end of `stepMatch`, listing them in `MatchState.finalHold`), so actions,
launches, statuses (freezing ones such as paralysis included) and lifetimes wait, and nothing held is pushed, hits,
grabs or is touched by hazards. It reads only the end of the frame, so port order doesn't change it. The stage stops
too: "All stage hazards are paused during a Final Smash" (SmashWiki, Stage hazard). Its clock
(`MatchState.stageFrame`) waits, so no piece moves, vanishes or carries anyone, and no zone, stage hitbox or conveyor
belt acts until the hold ends. SmashWiki also says platforms only slow down during some Final Smashes; here they stop
for the hold and run at full speed after it.

A **direct** Final Smash is an ordinary move: hitboxes, rehit windows, spawned beams. Fireboy's Fire Blast
(`src/fighters/fireboy/finalSmash.ts`) is the roster example: Mario Finale's frame data, damage and knockback on a
`fireboy/blast` entity that crosses the stage and keeps burning after Fireboy can act, as Mario's fireballs do. The
test fighter's is a plain hitbox:

```ts
finalSmash: {
  kind: 'other',
  faf: 90,
  final: { still: true },  // in the air: stop, no gravity or drift (Mario in Mario Finale); a cinematic takes it too
  hits: [{ frames: [42, 51], boxes: [{ id: 0, x: 32, y: 8, radius: 18, damage: 30, angle: 40, kbg: 70, bkb: 80 }] }],
},
```

A **trapping** Final Smash is a command grab (above) whose cinematic is `final` too. The first fighter its boxes catch
is held through the cinematic's `holdHits` and launched by its `throw`; nobody else moves until the release:

```ts
finalSmash: {
  kind: 'other',
  faf: 80,
  final: {},
  commandGrab: 'finalSmashCinematic',
  hits: [{ frames: [42, 51], boxes: [{ id: 0, x: 12, y: 7, radius: 10, damage: 0, angle: 0, kbg: 0, bkb: 0, grab: true }] }],
},
finalSmashCinematic: {
  kind: 'other',
  faf: 130,
  final: {},
  hits: [],
  holdHits: [{ frame: 20, damage: 8 }, { frame: 40, damage: 8 }, { frame: 60, damage: 8 }],
  throw: { frame: 100, hit: { damage: 16, angle: 45, kbg: 70, bkb: 90 } },
},
```

- **Catching.** The trap catches like any command grab: the nearest grabbable fighter in front, through shields. Ultimate
  traps every fighter its hitbox touches; this one holds the first.
- **Landing.** A `final` move that lands carries on from the same frame, as with `continuesOnLanding`: the charge is
  already spent, so a fall, or a moving platform rising under a `still` user, can't cut it short.
- **Losing the floor.** The same goes the other way (`finalSmashLeavesGround`): when a platform vanishes or moves out
  from under the user after the freeze, or a conveyor belt carries it off an end, a grounded `final` move plays on in
  the air from the same frame. A `still` one stops where it left the floor (`stopInPlace`), as one started in the air
  does. A trap's cinematic never loses its floor, since the stage stands still while it holds the others.
- **Projectiles.** An entity a `final` move puts out is marked at spawn (`EntityState.final`), so it stays unblockable
  however long it lasts, after its owner acts again or turns into another fighter (Fireboy's Swap).
- **CPUs.** A CPU holding the charge presses neutral special once an opponent is inside the Final Smash's reach in front
  (`finalReach`: its boxes, or `final.range` for one that spawns its blast), and otherwise leaves neutral special out of
  its attacks.
- **Events.** Activation emits `finalSmash` after the `move` event, with the freeze length; a trap's catch is a
  `commandGrab` event (docs/sim-events.md).
- **Not built.** Ultimate's Final Smash Meter, the height boost after an aerial Final Smash, the solid-colour background
  for the whole move, and the close-up of the user's eyes.

### Tethers

A move with `tether` fires a line from the hand (`TETHER.handHeight` up the body) that travels out, anchors, and
reels the fighter in: Fluffy's grapples, the Fisherman's line. Bob the Robber's Grappling Hook is not a tether:
his `upB` in `src/fighters/bob-the-robber/specials.ts` is a scripted zip with `drift: false` and no line. Fluffy's
Quick Grapple, from the test fixtures in `src/sim/testing/tethers.ts` (Point Grapple and the Line Tether are there
too):

```ts
upB: {
  kind: 'other',
  faf: 45,
  hits: [],
  tether: {
    frame: 8,
    range: 120,
    travel: 10,
    angle: 90,
    stickAdjust: 30,
    latch: ['ledge', 'surface', 'sky'],
    pullSpeed: 4,
    hang: 'jump',
  },
},
```

- **Firing.** On `frame` the line leaves towards `angle` (degrees from forward towards up) at `range` units, bent
  by up to `stickAdjust` degrees towards the stick's forward or back. Its tip reaches full range evenly over
  `travel` frames, and each frame the line from the hand to the tip is cast through the stage (`castSegment`).
- **Aiming.** With `aimed: { speed }` a reticle starts on the fighter and walks with the stick at `speed` units a
  frame while special is held, clamped to `range`; the move waits on the frame before `frame`, running its script
  once a frame there as a charging move does, the fighter keeps drifting (aimed tethers don't fast-fall), and
  releasing special fires at the reticle. With `aimed.quick: { frames }`, releasing special within `frames` of
  pressing it while the stick points somewhere fires at full range in that 8-way direction instead. A reticle still
  on the fighter fires nothing.
- **Anchoring.** The first thing the line touches anchors it if `latch` lists it: `ledge` (any ledge the line
  passes within `TETHER.ledgeSnap`, 10 units, of from off the stage, if nobody holds it and the fighter still has
  ledge grabs), `surface` (any solid edge or platform, from either side) or `sky` (empty air at full range).
  Anything else stops the line and the move plays out. `onAnchor(x, hit)` can veto an anchor by returning false
  (Fluffy's limited sky anchors).
- **Reeling.** An anchored fighter goes into `tetherPull`: no gravity or drift, straight at `pullSpeed` towards
  the anchor. A ledge anchor ends in a ledge grab once he is within `TETHER.ledgeArrive` (6 units) of the hang
  position, which is tether recovery. Another anchor ends with his hand on it: holding `hang` keeps him there
  (`tetherHang`) until he lets go of it, else he falls. A jump press lets go at any point, keeping the reel's
  velocity as momentum. A reel blocked by a wall gives up after range / pullSpeed + `TETHER.pullSlack` frames.
  Letting go ends in a fall, or helpless for a `helpless` move. The reel keeps the move, and `tether.moveFrame`
  keeps the move frame it anchored or arrived on, so the move's clip plays on through it (docs/art.md).
- **Losing the line.** Getting hit or grabbed, landing, or anything else that ends the move or the reel drops the
  line. `FighterState.tether` holds the line (`out` with its tip while it travels, then its anchor) and
  `FighterState.aim` the reticle or target; the hitbox overlay draws both in teal.

`castSegment(m, from, to, { platforms, fighters, ignore?, ledges? })` (`src/sim/cast.ts`) is the line test on its
own, for projectiles too: it returns the nearest ledge, surface or fighter hurtbox the segment touches, with `t`
(0 to 1 along it) and the point, or null.

A tether that also hits gives its move ordinary `hits` beside the `tether`: Red Ball's Tongue Lash
(`src/fighters/redball/specials.ts`) lashes with Ivysaur's Vine Whip boxes along the tongue and tethers to ledges
only. The line passes through fighters, so the hit and the ledge pull stay independent.

A tether ignores fighters unless it sets `targetsFighters: true`. If the line reaches a fighter before stage
geometry, `onFighter(ctx, target, event)` can handle the contact in script or return `'pullSelf'` on
`event.phase === 'hit'` to reel the user in. The same hook receives `'arrive'` on contact, where the move can
apply its own hit. Grab and yank behavior is left to the move script.

### Kill percentages

Test kill power with `koPercent` from `src/sim/testing/ko.ts` instead of writing your own launch loop:

```ts
import { koPercent, kos } from '../../sim/testing/ko';

const fsmash = koPercent({ hit: { fighter: 'fireboy', move: 'fsmash' } }); // 58 today
koPercent({ hit: { fighter: 'fireboy', move: 'uair' }, air: true, from: 'centre' });
koPercent({ hit: { damage: 17.8, angle: 361, kbg: 99, bkb: 25 }, di: { x: -98, y: 17 } });
kos({ hit: { fighter: 'fireboy', move: 'bthrow' } }, 150); // does it KO from 150%?
```

Kill-% tests take each move's angle, BKB and KBG from its Ultimate analogue and assert `koPercent` within about 5
points of that analogue's own kill % from the same setup (CREW.md, "Knockback values and kill percents").

It returns the lowest % (to 0.1) from which the hit KOs the target: the target crosses a blast zone, or the meteor
blast line below, **before its hitstun ends**, with no input other than the optional DI stick, which is the definition
the community KO calculator uses. Defaults: the Mario reference (weight 98) standing at Battlefield's ledge
(`from: 'ledge'`, launched toward the near blast zone), fresh (×1.05), no rage, no DI. `from` also takes `'centre'` or
a point, `target` another fighter id, `attackerPercent` adds rage, `charge` charges a `{ fighter, move }` hit for that
many frames.

A `{ fighter, move }` hit lands the way the real hit connects:

- **Only the launching hit counts.** That's a throw's release, or a multi-hit move's final hit (its windows from the
  last `rehit` one on). Earlier hits and pre-throw hitboxes are ignored, and the % is the target's % when the
  launching hit lands, as in the calculator. Within that hit, the strongest box wins; pass `box` to pick one.
- **Facing.** The attacker faces whichever way sends the box toward the target's edge: forward, `back`, or `away`
  from his centre (a box behind him launches backward).
- **Position.** The attacker stands so the box meets the target's middle. An aerial's attacker goes as low as the
  floor, so a box that can't reach a standing target (up smashes, up airs) lifts the target into the air to meet it.
- **Raw hits and throws** land from 10 units inward, as before.

An explicit point for `from` keeps the target exactly there.

It reproduces SSBU-Calculator's KO calculator (rubendal/SSBU-Calculator 233590e, run headless) on Mario's own 13.0.1
moves within about 2%:

| Mario on Mario, Battlefield, no DI | Calculator ledge / centre | Engine ledge / centre |
| ---------------------------------- | ------------------------- | --------------------- |
| fsmash sweetspot (17.8%, 99/25)    | 64.8 / 90.4               | 64.3 / 89.7           |
| fsmash, best survival DI           | 70.2                      | 69.7                  |
| bthrow (11%, 45°, 66/70)           | 130.5 / 192.5             | 128.8 / 190.3         |
| usmash (14%, 83°, 94/32)           | 124.5                     | 126.0                 |
| uair (7%, 75°, 135/10), airborne   | 186.2                     | 187.9                 |
| uthrow (7%, 90°, 72/70)            | 240.6                     | 243.8                 |

Captain Falcon's own moves (a test fighter with his 13.0.1 hitboxes), through the `{ fighter, move }` path:

| Falcon on Mario at the ledge, no DI                    | Calculator, same contact point | Engine |
| ------------------------------------------------------ | ------------------------------ | ------ |
| usmash hit 2 (14%, 83°, 80/70), Mario lifted to y 21.5 | 100.1                          | 102.1  |
| fair knee (22%, 32°, 81/30), Mario standing            | 56.0                           | 55.2   |
| uair (10%, 66°, 96/20), Mario lifted to y 14.5         | 180.8                          | 184.9  |

The up air's gap isn't placement or engine physics. The calculator's KO check reads its vertical launch speed by
simulation step but its positions by displayed frame, so under balloon speed-up its top-zone 2.4 rule sees a speed from
up to 30 steps earlier. With that one read fixed it gives 185.0 for the up air and 126.0, 187.9 and 243.8 for Mario's
up smash, up air and up throw, all within 0.4 of the engine (`ko.test.ts`). The same stale read makes its meteor KOs
6 to 8 points early.

So with Ultimate-standard knockback an 18% smash KOs Mario at the ledge in the 60s, not near 100%. SmashWiki agrees:
Mario's fsmash sweetspot "is capable of KOing most characters reliably at 70% near the ledge". Three engine rules
matter for vertical kills (`src/sim/blastZones.ts`):

- A 70–110° tumble launch falls with `damageFlyTopGravity` capped at 1.8 during hitstun.
- The top blast zone only KOs at a vertical launch speed of at least 2.4 or 30 units past it.
- Ultimate's meteor blast line: a fighter launched downward is KO'd 25 units under the camera's lower limit if it falls
  at 3 or more there, launch speed and its own together, before it reaches the bottom blast zone (SmashWiki, "Meteor
  smash"). On Battlefield that is y −105.

### Tuning tools

- `?hitboxes` on the game URL (or **F4**) draws hurtboxes in yellow, active hitboxes in red (entities' too),
  grab boxes in purple, reflector bubbles in cyan and absorber bubbles in green; `?actions` (F3) labels each
  fighter's action and frame.
- `/lab.html?scene=knockback` charts a hit's knockback and hitstun against target % for four weights.
- `/lab.html?scene=launch` simulates the real launch trajectories of a hit at 0–200% on your fighter:
  `__lab.call('hit', { damage, kbg, bkb, angle, fighter: '<id>' })`.
- The harness (`/?harness`, `window.__smash`) steps scripted inputs frame by frame for captures and tests; see
  `docs/architecture.md`.

## Air mobility

Multi-jumps, glides, floats and fuel hovers are opt-in data on the fighter; the engine code is
`src/sim/mobility.ts` (types, state) and `src/sim/actions/mobility.ts` (the `glide`, `float` and `hover` actions).
Worked examples with the roster's numbers are the test fighters in `src/sim/testing/mobility.ts`; their tests
(`src/sim/mobility.test.ts`) show how to drive each one, and `?harness` registers them so you can watch them:
`__smash.newMatch({ ports: [{ fighter: 'test-glider' }, { fighter: 'fireboy' }] })` (also `test-floater`,
`test-hover`). With `?hitboxes` the overlay shows jumps left as pips over multi-jumpers, float time (blue) and
hover fuel (orange) as bars, and a glide's pitch as a green line.

**Multi-jump.** `stats.jumps` counts every jump including the grounded one, so Red Ball's 4 is 3 midair jumps.
Every midair jump rises `doubleJumpHeight` unless `stats.airJumpHeights` lists them in order for jumps that shrink
(Kirby, Jigglypuff): `[21, 18, 15]` with `jumps: 6` gives 21, 18, 15, 15, 15. Its first entry must equal
`doubleJumpHeight`. A script can give a jump back with `regainAirJump(x)` (Red Ball's dair bounce, the Duck's
seed).

**Glide** (Brawl's glide): `glide: { speed: 1.2, fallSpeed: 0.6 }` is Papa Louie.

- Holding Jump once the last midair jump has peaked starts it; so does a move with `glide: true` ending while
  Jump is held (an up special that rises into a glide). One glide per airtime; landing gives it back.
- The glider flies along its pitch. Diving gains speed and climbing trades it for height until it stalls into a
  fall. Horizontal speed never passes `speed` and the sink never passes `fallSpeed`; at the neutral pitch it
  settles at exactly `speed` across.
- Up and down tilt the pitch. Holding back brakes, then turns the glide around. Attack or the C-stick plays
  `glide.attack` (default `nair`) and Special a special. Releasing Jump falls normally, or helpless when the glide
  came out of a helpless move (it then lands with that move's `landingLag`).
- Tuning: `angles` (pitch in degrees at neutral, full down and full up; default `[-20, -60, 40]`), `turnRate`
  (degrees per frame, 3), `accel` (speed gained per frame in a straight dive, 0.06).

**Float** (Peach in Ultimate): `float: { frames: 120 }` is Balloon Boy. Holding Jump while falling, from the apex of a
jump on, stops vertical motion for up to `frames` frames while the fighter drifts at air speed. Aerials out of it
keep floating and return to the float. Releasing Jump, a fast fall, a jump, a dodge or getting hit ends it. One
float per airtime. A new Jump press is still a midair jump, so multi-jumpers float by holding Jump past an apex.

**Fuel hover** (R.O.B.'s Robo Burner): `hover: { fuel: 120, rise: 1, accel: 0.1 }` plus a move with
`action: 'hover'` (Snail Bob's up special). While Special stays held and fuel lasts, the fighter accelerates up to
`rise` and burns one frame of fuel per frame. The move's hitboxes and script play as usual. Once its `faf` has
passed, letting go falls normally (not helpless) and any air option cancels it, and the move can be used again on
the fuel left. Fuel refills only on the ground, from empty to full in `refillFrames` (default 90, R.O.B.'s 1.5 s).

**State the HUD can read**: `FighterState.mobility` holds `hoverFuel` (frames of thrust left), `floatFrames` (frames
floated this airtime; equal to the float's `frames` once spent), `floating`, `glideUsed`, `glideAngle` and
`glideSpeed`. Midair jumps left are `stats.jumps - jumpsUsed`.

## Statuses and meters

A **status** is a condition that sits on a fighter for a number of frames, like Ultimate's flower. A **meter** is a
named number a fighter's moves fill and spend: charge, ammo, coins, a once-per-airtime count. Both are plain data on
the FighterDef; the engine code is `src/sim/statuses.ts` and `src/sim/meters.ts`. The test fighter in
`src/sim/testing/statuses.ts` uses every field, and its tests are `src/sim/statuses.test.ts`. Red Ball's Squared
(`src/fighters/redball/statuses.ts`) is the roster example:

```ts
// statuses.ts: Ultimate's flower (SmashWiki, "Flower (effect)")
squared: {
  frames: 20, perDamage: 40, max: 3000,  // floor(20 + 40 x the % the hit added) frames, at most 3000
  stack: 'add',                          // squaring a squared fighter adds the new length
  tick: { every: 21, damage: 1 },        // 1% on every 21st frame
  mash: { stick: 16, button: 28.8 },     // frames cut per new stick direction and per button press
  color: '#3b3b46',                      // badge beside the head
},
// moves.ts: the down throw applies it
dthrow: { ..., throw: { frame: 20, hit: { damage: 7, angle: 75, kbg: 45, bkb: 55, status: 'redball/squared' } } },
```

- **Kinds.** `FighterDef.statuses` names a fighter's statuses; in state and on hitboxes the kind is
  `"<fighter id>/<name>"`, like entities, so any fighter can inflict any status.
- **Applying.** A hitbox, throw or projectile with `status` applies it when it hits, after the `hit` event. A shield
  stops it. Its length is floor(`frames` + `perDamage` x the % the hit added), so the 1v1 multiplier counts, as it
  does for Ultimate's flower; `max` caps it. A script calls `applyStatus(x.m, fighter, kind, opts)` instead, where
  `opts` may give `damage`, `frames` and `source`. Applying a status that is already on adds the new length
  (`stack: 'add'`) or keeps the longer of the two (`refresh`, the default).
- **Ticking.** Every status ticks once on each frame the fighter acts, from the frame after it went on. Hitlag pauses
  it. Each tick, in order: `mash` cuts frames for a new stick direction or a button press (pressing doesn't use up the
  input), `script(x, status)` runs (after the action, before physics), and `tick` adds `damage` % on every `every`th
  frame with no hitlag or knockback, reported as `statusDamage` so the results count it for the victim and the
  source. Then it counts down one frame and ends at 0. Ending emits `statusEnd`.
- **Length from knockback.** `perKnockback` adds frames for each unit of the applying hit's knockback, scaled the way
  the hit's hitlag is (the box's `hitlag` multiplier, x0.67 on a crouch cancel), before the length is floored.
- **Freezing.** A `freeze` status holds the fighter as hitlag does: no action, physics or timers, and the launch waits
  for it. It ticks on every frame from the one after it went on, hitlag included, so a hit that applies one freezes the
  victim for the longer of its hitlag and the status, except that it waits while a Final Smash holds the fighter.
  Other statuses pause while it lasts, and other fighters can't push it, on the frame it runs out too. Its own
  hitboxes, grab boxes, reflectors and absorbers do nothing while it is frozen, as in hitlag, so a move it was frozen
  in (armor took the hit) goes on when the freeze ends. It can still be hit by fighters, projectiles and stage hazards.
  On the frame a freeze goes on the fighter still acts, so it can be pushed and land hits then. The renderer shakes the
  fighter and flickers it in the status's `color`.
- **Ending early.** `clearStatus(m, fighter, kind)` takes one off. A KO clears every status. With `endOnHit`, a later
  hit that lands (not on a shield), a pummel or a throw's hold hit included, takes it off, reported as `statusEnd` with
  reason `hit`. That hit's hitlag and launch take over, and no hit landing on the same frame can put the same status
  back on. A status that went on this frame stays, so hits landing together give the same result in any port order.

Bob the Robber's paralysis (`src/fighters/bob-the-robber/statuses.ts`) uses all three. It is Ultimate's paralysis
(SmashWiki, "Paralyze"): floor(1 + knockback x hitlag multiplier x crouch) frames, at most 90, in place of the hit's
hitlag:

```ts
paralyzed: { frames: 1, perKnockback: 1, max: 90, freeze: true, endOnHit: true, color: '#f2c62a' },
```

Papa Louie's Cheesed (`src/fighters/papa-louie/statuses.ts`) is Inkling's ink (SmashWiki, "Ink (status)"), on two
more fields:

```ts
cheesed: {
  frames: 120,                                   // the coat holds 120 frames after the last coating hit
  coat: { add: 12, max: 300, decay: 0.25 },      // +12 a hit up to 300, then -0.25 a frame; lasts 120 + level / 0.25
  damageTaken: (s) => 1 + (Math.min(s.level ?? 0, 180) * 0.5) / 180, // up to x1.5 damage taken
  color: '#f2cf5b',
},
```

- **Coats.** With `coat`, each application adds `add` to the status's `level` (or the `level` given to `applyStatus`),
  up to `max`, and sets its length to `frames` + level / `decay`. The level holds for `frames` frames, then drops
  `decay` a frame, and the status ends as it reaches 0. A new application starts the hold again. `perDamage`,
  `perKnockback` and `stack` don't apply.
- **Damage taken.** `damageTaken(status)` multiplies the % the fighter takes from any source (hits, throws, pummels,
  status ticks) while it lasts, inside `addDamage`. Like the 1v1 multiplier, it changes the % added, not the hit's
  knockback or the shield damage.

- **State.** `FighterState.statuses` lists `{ kind, frames, age, since, source }`, oldest first. `frames` is what is
  left, `age` counts ticks from 1 and `source` is the port credited (-1 for none). A coat also has its `level`. Use
  `hasStatus` and `statusOf` to read it.

Meters are declared in `FighterDef.meters`:

```ts
meters: {
  ammo: { max: 3, start: 3 },                         // spent by a move: spendMeter(x.f, 'ammo', 1)
  hop: { max: 1, start: 1, regen: 1, grounded: true }, // one per airtime, refilled on the ground
  coins: { max: 99, onKo: 'keep' },                   // kept into the next stock
},
```

- `FighterState.meters` holds the values by name, starting at `start` (default 0). `meter`, `setMeter`, `addMeter`
  and `spendMeter` read and change them, clamped to 0..`max`. `spendMeter` takes `cost` only when the meter holds
  that much, and returns whether it did. An unknown meter name throws.
- `regen` changes the value every frame the fighter acts (not while KO'd), negative to drain. With `grounded` it only regenerates on
  the ground.
- A KO puts a meter back to `start` unless it has `onKo: 'keep'`.
- Meters have no events. The HUD reads the values from state.

## Stages

Stages can move (docs/stage-geometry.md): a fighter standing on a moving platform or solid rides it, one hanging from a
moving ledge moves with it, and a solid that runs into a fighter pushes them out or squeezes them out on top of
it. Nothing in a fighter needs to change for that. A move's `script` that reads the stage (`x.stage`) sees it
as it stands on the current frame, moved pieces and all, and should skip absent pieces
(`x.stage.present`).

Stage hazards (damage zones, stage hitboxes) hit fighters through the same strike as moves. A fighter unharmed
by some damaging terrain lists its elements in `immune` on its FighterDef: Fireboy's is `['lava']` and
Watergirl's `['water']`; goo hurts everyone.

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
  hits: [{ frames: [1, 70], boxes: [{ id: 0, x: 0, y: 0, radius: 2.4, damage: 5.5, angle: 361, kbg: 20, bkb: 35 }] }],
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
  pieces (docs/stage-geometry.md) collide by their motion relative to the entity, absent ones are skipped: a resting
  entity rides the floor or platform under it up, down and sideways (in hitlag too), a solid running into one pushes it, and one on a
  floor that a ceiling comes down on is crushed (destroyed, reason `stage`).
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
- **Items.** Items are entities registered as `item/<name>`. `onBreak(m, e, by)` runs when a hittable entity breaks,
  with the port that landed the last hit. `pickup(m, f, e)` makes an entity something an idle fighter picks up with
  Attack. The Items rule, spawning and the Coolmath Planet are in docs/items.md.
- **Events.** Entities report `entitySpawn`, `entityDestroy` (with the reason), `reflect`, `absorb` and `entityHit`,
  and their hits are `hit` and `shieldHit` events carrying the `entity` id (`docs/sim-events.md`).
- **CPUs.** CPUs need nothing extra to use a projectile. The move probe (`src/ai/knowledge.ts`) records each entity
  a move puts out: kind, frame, offset, velocity, lifetime and the strongest hitbox of the entity or what it turns
  into (a bomb's burst). `src/ai/shots.ts` puts those entities out on a copy of the match and plays their flight
  against the opponent's predicted path, so a CPU fires when the shot would meet the opponent. Its own controller is
  neutral in that copy, so a minion steered by the stick is predicted badly; list such a move in the fighter's
  `ai.ts` `avoid`. A special with a `charge` frame is probed twice, tapped and charged for up to 40 frames (Special
  held, or a tap-charged move pressed again), and the CPU picks either (Bob the Robber's Stun Gun at full charge, Raft Wars' Aimed Shot at 40 of
  its 112 frames). The flight copy keeps a charged entity's damage multiplier. A shot is worth less the longer it leaves the CPU busy after
  the opponent could run in, unless it lands first or would meet the runner before the runner's quickest hit; then
  it holds the opponent up for its hitstun plus any freezing status (paralysis).

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
