# Art: drawing and animating fighters

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
faces left. A fighter's drawing fills its hurtbox: Fireboy's rig is 15 units tall and about 8 wide, so the top
of the head sits at y = -15.

Move data in `src/fighters/*/moves*` uses feet-relative offsets with **y up**, so a hitbox at `(6, 6)` is the
rig point `(6, -6)`.

## Data model

- **Symbols** are arrays of `PathShape { d, fill?, stroke? }`. `d` is SVG path data in rig units. Colours are
  palette keys (`'fire'`, `'line'`) or literal `#rrggbb`; fills can be radial or linear gradients whose stops
  are palette keys too. Sub-paths use the even-odd rule, as Flash shapes do: `view.ts` splits them into
  outlines and holes and cuts the holes, because Pixi would fill every sub-path otherwise.
- A symbol can be a **loop** `{ loop: [...names], fps }`, a Flash movie clip that plays on the match clock
  (`globalFrame`, 60 per second) whatever the action, such as a flame flickering through 3 drawings at 30 fps.
- **Bones** `{ name, parent?, x, y, rot?, sx?, sy? }` form the skeleton; parents come first. A bone's scale (its
  rest `sx`/`sy` times the pose's) stretches its own drawings and carries down to its children, except on bones
  marked `localScale` (limb segments), whose children are only pushed out along the stretched bone so a
  stretched forearm never skews the fist.
- **Slots** `{ name, bone, symbol, decor? }` are the layers, back to front. Limbs use two slots per segment
  (outline symbols first, then fills) so the joint has no visible seam, the way Flash artists inked tubes.
  `decor` slots (a glow or shadow) are drawn but left out of bounds and hitbox-coverage checks.
- **Clips** are Flash-style timelines with two layers per key. The pose layer: a key with `pose` is a full
  pose (bones it does not mention return to rest) and tweens to the next posed key with its `ease`. The symbol
  layer: `swaps` (slot -> symbol, or `null` to hide) and `z` (slot -> draw order; slot _i_ draws at _i_, so
  2.5 sits between slots 2 and 3) hold until a later key changes them, and `swaps: {}` returns to the clip's
  own swaps. A key without `pose` only changes symbols, like a keyframe on the symbol layer.
- **Palettes** map keys to colours. `default` is the fighter's main look; alternates (the mannequin's `ash`,
  `walnut` and `cherry`) dress other ports.
- **Costume swaps** (`costumeSwaps`: palette name -> slot -> symbol, or `null`) replace slot defaults for one
  costume, below clip and key swaps, so a costume can wear a hat the others don't (The Duck's `crown`).
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

## Asset policy

Every drawing is made by hand in the rig's own path data. Nothing is traced, extracted or converted from
original game files (no SWF shapes, bitmaps, sprites or audio), and no file derived from one may be committed.
Reference images are for looking at while drawing; they stay in the crew's handoffs, never in the repo.

Until a fighter's own drawing lands, `src/fighters/fireboy/art/parts.ts` dresses Fireboy's rig as a plain
wooden mannequin (an egg head with dot eyes, inked tube limbs, orange fire effects). A fighter's drawing replaces
the symbols under the same names (`headFront`, `headSide`, `headUp`, the `face*` set, the limbs, `fist`,
`mitten`, `fxBall`, `fxJet`, `fxFlame`), so the clips keep working unchanged.

## Authoring helpers

`poses.ts` keeps poses short: `key(frame, pose, opts)`, `mix(a, b)` to layer pose offsets, `feet(pose, back,
front)` and `hands(pose, back, front)` to solve legs or arms with two-bone IK onto rig points, `flame(x, y,
size, rot)` to place a flame on an `fx` bone, and swap sets (`FRONT`, `SIDE`, `ANGRY`, `SHOUT`, `HURT`, `UP`,
`FIST_F`, `MITTENS`, ...) to change the head view, expression and hands. `author.ts` holds the IK and
`pointOf`, which finds where a bone point lands.

Attack fire uses the `fxJet` symbol (a pale-cored teardrop with a dark outline). `streak(pose, limb, to, r)` in `attacks.ts` places one with its round hot head on the hitbox at
`to` and its tail reaching back to the fist or foot in `pose`, so every hit reads as fire thrown by the limb.

## Lab and the hill-climb loop

`lab.html?scene=fighter` shows one fighter large. Query parameters: `fighter`, `clip`, `frame`, `zoom`,
`palette`, `sheet=1` (contact sheet of the key states, or `states=clip@frame,...`), `hit=x,y,r;...` (hitbox
circles, feet-relative, y up) and `play=1`. Scripts drive it through `__lab.call('show', clip, frame)`,
`__lab.call('sheet', states)`, `__lab.call('palette', name)` and `__lab.call('clips')`.

The key states the judges score are `idle@0`, `run@6`, `jump@40`, `fall@8`, `ftilt@7`,
`fsmash@16`, `tumble@8`, `shield@10`, `ledgeHang@0` and `neutralSpecial@16`. Each round: capture the sheets,
put them beside the reference sprites, have the judge panel score them and list concrete gaps, fix the top
gaps, and repeat.

## Drawing a fighter from scratch

A fighter's look is a set of symbols written by hand as SVG path data in `art/parts.ts`. Nothing is imported
from an image or a game file (see "Asset policy"), so the work is closer to inking a model sheet than to
converting one. This order keeps each step checkable in the lab.

1. **Sketch the model sheet first.** On paper or in your head, block the fighter out of simple construction
   shapes (circles, capsules, teardrops) at the rig's scale: 15 units tall, about 8 wide, feet at the origin.
   Decide what reads at 40 pixels tall in a 4-player match. That's usually the head silhouette, one or two
   signature shapes and the main colours. Everything else is detail that disappears in play.
2. **Build parts from primitives.** Write each part as a few closed paths made from helpers like `tube` and
   `ellipse` in `src/fighters/fireboy/art/parts.ts`, or your own Bézier curves. Keep every coordinate a plain
   number in rig units, rounded to 0.001, so the data diffs cleanly. Draw limbs hanging from their bone's origin
   down +y, and heads around the head bone's centre.
3. **Ink like Flash.** Each part is an outline shape drawn under its fill, not a stroke. Let the outline swell on
   the lower and back edges and taper towards the tips, which gives the hand-inked weight of the era. Use one
   flat base colour per part, one darker shade shape on the side away from the light (top left), and at most one
   highlight. Gradients are for effects, not bodies.
4. **Split limbs into line and fill symbols.** Give each segment a `Line` symbol and a fill symbol, and list
   the slots so both segments' lines draw before either fill (`limbSlots` in `rig.ts`). Joints then show no
   seam at any angle.
5. **Draw the head in views.** Draw a front, a side and an up-facing head, plus faces as separate symbols
   (neutral, blink, angry, shout, hurt) so clips can swap expressions without redrawing the head. The swap sets
   in `poses.ts` (`FRONT`, `SIDE`, `ANGRY`, ...) name the combinations.
6. **Add life with loops, not randomness.** Anything that should flicker or sway (fire, water, cloth, hair) is
   a symbol loop of two to five drawings at 8–30 fps on the match clock. Vary each drawing by fixed offsets
   written in the data. Sampling stays a pure function of the frame, so replays and captures match.
7. **Palette everything.** Fill colours are palette keys, never literal colours, so a costume is just another
   palette. A twin or alternate form that a port can switch into mid-match keeps the same costume names.
8. **Keep the names.** Draw under the symbol names the clips already use (`headFront`, `faceFront*`, the
   limbs, `fist`, `mitten`, the `fx*` effects). The clips, hitbox coverage test and HUD icon then work unchanged,
   and you can replace a placeholder one part at a time.
9. **Check it in the lab, then judge it.** Open `lab.html?scene=fighter&sheet=1` (add `&palette=<name>` for each
   costume and `&flicker=1` for the loops) after every part. When a full set reads well, run a judge round
   (docs/hill-climb.md) and fix the top gaps. Judges catch silhouette and proportion problems faster than
   close-ups do.

`npm test` keeps the drawing honest. Fireboy's `art/index.test.ts` checks that the fighter stands 15 units
tall, that every clip only names bones, slots and symbols that exist, that each costume defines the same colour
keys, and that a drawn part reaches into every hitbox on its active frames.

## Adding a fighter

1. Create `src/fighters/<name>/art/index.ts` exporting `art: FighterArt` (plain data, no Pixi).
2. Draw every part by hand in the same line style (see "Asset policy").
3. Author every canonical clip, keeping move clips on the move's frame data.
4. Copy Fireboy's `index.test.ts` checks (canonical clips, valid references, hitbox coverage, size, palettes).
5. Open the lab scene, capture the key states and run judge rounds.
