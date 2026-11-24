# Adding a fighter

A fighter is one directory, `src/fighters/<id>/`, whose `index.ts` exports `fighter: FighterDef`. The registry
(`src/fighters/registry.ts`) finds it with `import.meta.glob`, so adding a fighter edits no shared file. Fireboy
(`src/fighters/fireboy/`) is the worked example; copy it.

```
src/fighters/<id>/
  index.ts      defineFighter({ id, name, series, stats, moves, art })
  stats.ts      FighterStats: movement, jumps, weight, shield
  moves.ts      Record<string, MoveDef>: frame data for every move
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

| Input                                      | Grounded                                         | Airborne                                            |
| ------------------------------------------ | ------------------------------------------------ | --------------------------------------------------- |
| Attack                                     | `jab`                                            | `nair`                                              |
| Attack + held direction (or walk modifier) | `ftilt`, `utilt`, `dtilt`                        | `fair`, `bair`, `uair`, `dair` (relative to facing) |
| Attack + tapped direction, or C-stick      | `fsmash`, `usmash`, `dsmash` (back turns around) | the matching aerial                                 |
| Attack while dashing or running            | `dashAttack`                                     |                                                     |
| Special + direction                        | `neutralB`, `sideB`, `upB`, `downB`              | same                                                |

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
- **Specials.** `script(x)` runs every frame of the move before physics and sets velocity or facing. It must be
  deterministic: no `Math.random`, no clocks; use `x.m.rng` if you need randomness.
  - `leavesGround` makes a grounded start take off.
  - `helpless` ends the move in helpless fall.
  - `ledgeFrom` lets the move grab a ledge from that frame.
  - Fireboy's `upB` uses all three.

The combat math (knockback, hitlag, hitstun, DI, shieldstun, staleness) is shared and lives in
`src/sim/combat/`; a fighter only supplies numbers.

### Tuning tools

- `?hitboxes` on the game URL (or **F4**) draws hurtboxes in yellow and active hitboxes in red; `?actions` (F3)
  labels each fighter's action and frame.
- `/lab.html?scene=knockback` charts a hit's knockback and hitstun against target % for four weights.
- `/lab.html?scene=launch` simulates the real launch trajectories of a hit at 0–200% on your fighter:
  `__lab.call('hit', { damage, kbg, bkb, angle, fighter: '<id>' })`.
- The harness (`/?harness`, `window.__smash`) steps scripted inputs frame by frame for captures and tests; see
  `docs/architecture.md`.

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
