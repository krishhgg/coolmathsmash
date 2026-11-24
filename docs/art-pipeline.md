# Art pipeline

Fighters are drawn the way the original Coolmath Flash games drew them: vector symbols (filled SVG paths with
a hand-inked outline) placed on a skeleton and tweened between keyframes. The data is plain TypeScript, so the
simulation, tests and tools can read it without Pixi; only `src/render/rig/view.ts` turns it into PixiJS 8
`Graphics`.

| Path                                      | What it holds                                                     |
| ----------------------------------------- | ----------------------------------------------------------------- |
| `src/render/rig/types.ts`                 | The data model (`FighterArt`, `Rig`, `AnimClip`, `Key`, ...)      |
| `src/render/rig/sample.ts`                | Pure sampling: clip + frame -> bone matrices, symbols, draw order |
| `src/render/rig/view.ts`                  | `createRigView`, `createPropView` (the only Pixi code)            |
| `src/render/rig/svg.ts`                   | Symbols -> standalone SVG (HUD icons)                             |
| `src/render/rig/geometry.ts`, `author.ts` | Path flattening, hit tests and bounds; two-bone IK for authoring  |
| `src/fighters/<name>/art/`                | One fighter's art: `index.ts` exports `art: FighterArt`           |
| `src/lab/scenes/fighter.ts`               | Lab scene for clips, contact sheets and hitboxes                  |

## Coordinates

Rig space is in game units, y down, origin at the point between the feet, facing right. The renderer places
the container at the fighter's position (y down already matches Pixi) and sets `scale.x = -1` when the fighter
faces left. Fireboy is 15 units tall including his flames and about 8 wide, so the tip of his flames sits at
y = -15.

Move data in `src/fighters/*/moves*` uses feet-relative offsets with **y up**, so a hitbox at `(6, 6)` is the
rig point `(6, -6)`.

## Data model

- **Symbols** are arrays of `PathShape { d, fill?, stroke? }`. `d` is SVG path data in rig units. Colours are
  palette keys (`'fire'`, `'line'`) or literal `#rrggbb`; fills can be radial or linear gradients whose stops
  are palette keys too. Sub-paths use the even-odd rule, as Flash shapes do: `view.ts` splits them into
  outlines and holes and cuts the holes, because Pixi would fill every sub-path otherwise.
- A symbol can be a **loop** `{ loop: [...names], fps }`, a Flash movie clip that plays on the match clock
  (`globalFrame`, 60 per second) whatever the action. Fireboy's head flickers through the original's 5 head
  drawings at the SWF's 25 fps.
- **Bones** `{ name, parent?, x, y, rot? }` form the skeleton; parents come first. A bone's scale stretches its
  own drawings and carries down to its children, except on bones marked `localScale` (limb segments), whose
  children are only pushed out along the stretched bone so a stretched forearm never skews the fist.
- **Slots** `{ name, bone, symbol }` are the layers, back to front. Limbs use two slots per segment (outline
  symbols first, then fills) so the joint has no visible seam, the way the original inked its tubes.
- **Clips** are Flash-style timelines with two layers per key. The pose layer: a key with `pose` is a full
  pose (bones it does not mention return to rest) and tweens to the next posed key with its `ease`. The symbol
  layer: `swaps` (slot -> symbol, or `null` to hide) and `z` (slot -> draw order; slot _i_ draws at _i_, so
  2.5 sits between slots 2 and 3) hold until a later key changes them, and `swaps: {}` returns to the clip's
  own swaps. A key without `pose` only changes symbols, like a keyframe on the symbol layer.
- **Palettes** map keys to colours. `default` is the original; alternates (`blaze`, `ember` and `violet` for
  Fireboy) dress other ports.
- `icon` is a standalone SVG string for stock icons and portraits, `projectiles` holds props such as the
  fireball (`PropArt { symbols, symbol, scale }`), and `ledgeGrip` is the rig point the ledge's top corner
  should touch while hanging.

Sampling is a pure function of `(clip, frame, globalFrame)`: no clocks and no randomness, so replays and the
frame-capture harness always draw the same picture.

## Clips and timing

`frame` is the number of frames since the action began, which the engine already tracks. Clips that cycle set
`loop: true`; the rest hold their last key. Move clips use Smash numbering (frame 1 is the first frame of the
move) and `length = FAF - 1`, so a clip ends exactly when the fighter can act again. Each strike is keyed so
its limb or flame covers every hitbox centre during that hitbox's active frames; the art test in
`src/fighters/fireboy/art/index.test.ts` checks this against `moves.ts`.

Canonical clip names (unknown names fall back to `idle`):

| Group    | Clips                                                                                       |
| -------- | ------------------------------------------------------------------------------------------- |
| Ground   | `idle` `walk` `dash` `run` `runBrake` `turn` `crouch` `jumpSquat` `land` `taunt`            |
| Air      | `jump` `doubleJump` `fall` `helpless`                                                       |
| Defence  | `shield` `shieldDrop` `shieldBreak` `dizzy` `spotDodge` `rollForward` `rollBack` `airDodge` |
| Ledge    | `ledgeCatch` `ledgeHang` `ledgeClimb` `ledgeRoll` `ledgeJump` `ledgeAttack`                 |
| Hurt     | `hitstun` `tumble` `knockdown` `getUp` `getupAttack` `tech` `techRoll` `respawn`            |
| Grabs    | `grab` `dashGrab` `grabHold` `pummel` `fthrow` `bthrow` `uthrow` `dthrow` `grabbed`         |
| Attacks  | `jab1` `jab2` `jab3` `ftilt` `utilt` `dtilt` `dashAttack` `fsmash` `usmash` `dsmash`        |
| Aerials  | `nair` `fair` `bair` `uair` `dair`                                                          |
| Specials | `neutralSpecial` `sideSpecial` `upSpecial` `downSpecial`                                    |

Ledge getups are drawn in rig space while the engine lifts the fighter's origin from the hang position to the
floor; `clips.ts` mirrors that lift (`belowFloor`) so the hands stay on the corner until the fighter is up.

## Rendering

```ts
import { createPropView, createRigView } from './render/rig/view';
import { art } from './fighters/fireboy/art';

const view = createRigView(art, 'default'); // { container, pose, setPalette }
view.pose('run', actionFrame, matchFrame); // once per rendered frame
view.container.position.set(x, y); // rig units are game units
view.container.scale.x = facing; // -1 mirrors for facing left

const fireball = createPropView(art, 'fireball', 'default'); // { container, update(globalFrame) }
```

Every symbol becomes one shared `GraphicsContext` per (symbol set, symbol, palette), so any number of fighters
and frames reuse the same tessellated geometry; posing only swaps contexts and sets matrices. The engine draws
the shield bubble, hit flash, shake, intangibility blink and port tags itself.

## Importing original Flash art

The original SWF is both the best reference and the best source. Fireboy's heads, faces and eyes in
`src/fighters/fireboy/art/flash.ts` are converted from the Forest Temple SWF's shapes, not traced:

1. Export shapes and sprites with JPEXS (`java -jar ffdec-cli.jar -export shape,sprite <out> game.swf`). The
   sprites give the frame-by-frame reference poses (idle, run, jump) to compare against.
2. Convert each shape SVG to rig paths: apply the shape's transform, scale to rig units (0.036 for Fireboy),
   simplify curves within a small tolerance, and replace colours with palette keys so costumes recolour them.
3. Write the result as plain data (`flash.ts`). Generated files are committed; the SWF and the import scripts
   are not (they live with the crew's handoffs).

Parts the original never drew separately (Fireboy's arms and legs are one body drawing) are built in
`parts.ts` as inked tubes with the same line weight and colours.

## Authoring helpers

`poses.ts` keeps poses short: `key(frame, pose, opts)`, `mix(a, b)` to layer pose offsets, `feet(pose, back,
front)` and `hands(pose, back, front)` to solve legs or arms with two-bone IK onto rig points, `flame(x, y,
size, rot)` to place a strike flame on an `fx` bone, and swap sets (`FRONT`, `SIDE`, `ANGRY`, `SHOUT`, `HURT`,
`UP`, `FIST_F`, ...) to change the head view and expression. `author.ts` holds the IK and `pointOf`, which
finds where a bone point lands.

## Lab and the hill-climb loop

`lab.html?scene=fighter` shows one fighter large. Query parameters: `fighter`, `clip`, `frame`, `zoom`,
`palette`, `sheet=1` (contact sheet of the key states, or `states=clip@frame,...`), `hit=x,y,r;...` (hitbox
circles, feet-relative, y up) and `play=1`. Scripts drive it through `__lab.call('show', clip, frame)`,
`__lab.call('sheet', states)`, `__lab.call('palette', name)` and `__lab.call('clips')`.

The key states judges compare with the original are `idle@0`, `run@6`, `jump@40`, `fall@8`, `ftilt@7`,
`fsmash@16`, `tumble@8`, `shield@10`, `ledgeHang@0` and `neutralSpecial@16`. Each round: capture the sheets,
put them beside the reference sprites, have the judge panel score them and list concrete gaps, fix the top
gaps, and repeat.

## Adding a fighter

1. Create `src/fighters/<name>/art/index.ts` exporting `art: FighterArt` (plain data, no Pixi).
2. Import the original shapes where the game has them; build missing parts in the same line style.
3. Author every canonical clip, keeping move clips on the move's frame data.
4. Copy Fireboy's `index.test.ts` checks (canonical clips, valid references, hitbox coverage, size, palettes).
5. Open the lab scene, capture the key states and run judge rounds.
