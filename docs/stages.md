# Stages

A stage is two independent halves:

- **Geometry** (`src/stages/<slug>/geometry.ts`): the collision shapes the simulation uses (solid hull, drop-through
  platforms, ledges, blast zones, camera bounds). Plain numbers in game units; part of the deterministic sim.
- **View** (`src/stages/<slug>/view.ts` plus `src/stages/<slug>/art/*`): the PixiJS art. It never influences the
  match; it only has to line up with the geometry.

Keep them separate so the sim can run headless (tests, replays) and art can change without touching physics.

## Units and coordinates

- Game units follow Smash Ultimate (Battlefield's main platform is 160 wide). **y points up** in the game.
- Pixi's y points down, so the view draws a game point `(x, y)` at `(x, -y)`. Helpers: `flipY` in
  `src/stages/battlefield/art/util.ts`.
- The camera is `{ x, y, zoom }`: the game point at the centre of the 1280x720 screen and the zoom in pixels per
  game unit (Smash framing is roughly 2.5 to 9). The renderer places the world container at
  `(640 - x * zoom, 360 + y * zoom)` with scale `zoom`.

## The `StageView` contract

```ts
export interface StageView {
  background: Container; // screen space, 1280x720, drawn first; parallaxes from the camera
  world: Container; // game units at (x, -y); the renderer puts it inside its world container, under fighters
  foreground?: Container; // game units, drawn over fighters (keep it sparse: it hides fighters)
  update(frame: number, camera: StageCamera): void; // called every rendered frame
  pieces?(stage: StageState, alpha: number): void; // optional: place the art of moving pieces
}
export function createStageView(): StageView;
```

A stage whose solids or platforms move (docs/stage-geometry.md) draws them itself through `pieces`: the renderer
passes the match's piece state (`MatchState.stage`) and its interpolation `alpha`, and `pieceOffset` in
`src/render/stagePieces.ts` gives a piece's offset for that frame. A view with `pieces` replaces the renderer's
placeholder shapes for solids and platforms. Raft War Lagoon (`src/stages/raft-wars-water/view.ts`) moves its whole
raft by solid 0's offset.

`StageView` and `StageCamera` are exported from `src/stages/battlefield/view.ts`; a new stage exports its own
`createStageView` with the same shape.

## Layers and parallax

Background layers are drawn in screen pixels **as they look from the reference camera** (`REF_CAMERA` in
`src/stages/battlefield/art/parallax.ts`: x 0, y 20, zoom 4.5) and given a `depth`:

- depth 0 never moves (the sky);
- depth 1 moves and zooms exactly like the world (`parallax.test.ts` proves it);
- anything between follows `layerTransform(depth, camera)`: it pans by `depth` times the world's pan and scales
  by `(zoom / 4.5) ** depth` around the screen centre.

Each layer is a `Container` with its pivot at the screen centre; `update` sets its position and scale from
`layerTransform`. Typical depths: sky 0, planets and sun rays 0.02, far clouds 0.04, mountains 0.06, far islands
0.1, horizon cloud sea 0.14, low clouds 0.2, side islands 0.3, near clouds 0.5.

**Coverage.** The background must leave no gap for any camera inside the stage's camera bounds at zoom 2.5 to 9.
Make the sky a full-screen depth-0 rectangle, and give the layer that fills below the horizon a generous extent
(Battlefield's cloud sea spans x -1700 to 2980 and down to y 3400). `parallax.test.ts` checks it against every
corner of the camera bounds at both zoom limits via `extremeCameras()` and `layerRectOnScreen()`; copy that test
for a new stage. Decorative layers (islands, clouds) can drift off-screen freely.

## Lining art up with geometry

Draw the solid parts straight from the geometry (Battlefield's art imports `src/stages/battlefield/geometry.ts`
through `art/outline.ts`, so it can never drift): the walkable top edge of the art is exactly the surface,
side walls and slopes follow the hull, and the outline stroke is drawn on the hull polygon so the silhouette is the
collision shape. Drop-through platforms are thin (about 2 units) with the walkable surface exactly at their y;
small ornaments may hang below them. Decorations that stick out (vines) should be thin and obviously
non-solid. A shallow, muted rear plane (about 1.3 units) above the main deck's front edge is fine as a depth cue;
the crisp front edge stays the walkable surface. Check alignment in the lab: `/lab.html?scene=stage&stage=<id>&collision=1` overlays the hull (magenta), platform
surfaces (cyan), ledge points (yellow dots), camera bounds (yellow) and blast zones (red).

Test it too: `surfaceMismatches(stage, solids)` in `src/render/surface.ts` reads the fills of the Graphics that
draws the solid ground (no drop-through platforms in it) and lists every x along the stage's floors where the top of
the drawing is not the collision floor. `src/render/placeholderStage.test.ts` runs it on every stage's placeholder.

## Readability

Fighters come first. Keep the area behind the playfield calm: lower contrast and saturation than the fighters,
haze distant layers toward the sky colour (`mix(color, HAZE, t)`), and avoid busy detail or bright whites right
behind the platforms. Use the confident dark outline (`INK`) only on the playfield; far layers get no outline or a
soft tinted one. `&dummies=1` in the stage lab scene drops port-coloured stand-ins on the platforms to check this.

Background islands must never read as somewhere to land: keep grassy island tops well away (vertically) from
real surfaces at the cameras the game uses, and make anything near the playfield jagged rather than flat.
Battlefield keeps its island placement as data in `art/scenery.ts`, and `parallax.test.ts` checks it against the
start-of-match camera (`src/render/camera.ts`) and views around the playfield.

## Render quality

The renderer draws `StageView.background` into a half-resolution texture each frame, and only at `full` quality.
`?quality=lite` (the default under `?harness`, so for Playwright and the capture runner) leaves the backdrop flat;
`?quality=full` forces it, and `VITE_RENDER_QUALITY` at build time changes the default for every page that does not
pass `quality`. The game itself draws `full`. Keep anything gameplay needs out of the background, since it may not be
drawn.

## Deterministic animation

Everything that moves is a pure function of `frame` and `camera`: no `Math.random`, no clocks, no state that
accumulates between calls. Loops use `wrap(start + frame * speed, min, span)`; pulses use `Math.sin(frame * k)`;
variety comes from `hash01(n)` (a fixed integer hash). Build Graphics once and only change transforms and alpha in
`update`; redraw a Graphics per frame only for small animated pieces (Battlefield's waterfall streaks).

## Making a new stage

1. Add `src/stages/<slug>/geometry.ts` (collision, owned by the sim side) and `src/stages/<slug>/view.ts`
   exporting `createStageView(): StageView`. The renderer finds every `src/stages/<slug>/view.ts` by glob, so no
   shared file changes; a stage without a view is drawn as flat collision shapes
   (`src/render/placeholderStage.ts`), with grass along every floor edge.
2. Put art in `src/stages/<slug>/art/`: a palette, the playfield (world units) and background layers (screen
   pixels at the reference camera plus a depth). Reuse `parallax.ts` and `util.ts` from Battlefield.
3. Use the stage lab scene to view a registered stage at any camera
   (`?scene=stage&stage=<id>&x=0&y=20&zoom=4.5&frame=0`, api `camera(x, y, zoom)`, `frame(n)`, `collision(on)`) and check
   alignment with `&collision=1`. The lab draws a stage without a view with the game's placeholder, and its zoom
   stops at the game camera's `MAX_ZOOM` (`src/render/camera.ts`), the resolution stage art caches at.
4. Add a coverage test like `parallax.test.ts` and pin the geometry numbers the art uses.
5. Capture the stage at the default camera and zoomed in on a platform for the PR and the judge panel.

Hazards (damage zones, stage hitboxes, conveyors, trapdoors) are geometry and are documented in
`docs/stage-geometry.md`, including how a hazard's hit meets shields, parries, counters and armor: shields block it
and parries parry it as they do any hit, armor takes it as any hit, and counters are an open question.

## Coolmath Battlefield

`src/stages/battlefield/`: Battlefield's exact layout as a floating sandstone temple island under the Coolmath
Games planet. The main platform is a sandstone cap carved with a math frieze over a brick underside holding a planet
medallion and a red and a blue gem; the soft platforms are thin slabs whose hanging gems are red (left),
green (top) and blue (right). The background (sky, sun rays, ringed planet, mountains, floating ruins with a pi arch
and a small temple front, a cloud sea, waterfalls) sits in screen space with the depths above.

## Truck Convoy

`src/stages/wheely-trucks/`: Wheely's stage. The fight is on the roof of a car carrier driving right along a viaduct:
the 160-unit deck runs over the trailer and the cab-over cab, which has Wheely-style eyes on its windscreen. The two
soft platforms are the upper decks of two car haulers in the far lane (`HAULERS` in `geometry.ts`), 26 above the deck
from 23 to 61 out each side. With hazards on they are traffic (`HAULER_MOTION`, a 24 s loop never faster than 0.45 units
a frame): level with the carrier for 4 s, a brake tap of 1.5 units over 45 frames, falling back 36 units together, level
again, then pulling ahead 36. The brake lights are on whenever a hauler drops back, so the tap warns 45 frames before
the real move. Each hauler has a low lamp on its chassis, which the carrier's hull covers while the hauler is beside it,
and a high one under its upper deck, above the carrier's deck, which shows through the tap (`view.test.ts` checks
nothing drawn later covers it). At the far end of each move one deck hangs 17 units past a ledge, as a recovery spot or
an edge-guard perch, and its inner end is always over the carrier. With hazards off the haulers stay level with the
carrier. The view places the haulers through `pieces`.

The road, the viaduct's side and its piers are world art that slides left at `ROAD_SPEED` (2 units a frame), and
the backdrop's clouds, mountains and valley slide by their depth times that speed, so the parallax reads as speed
while the trucks hold still. The stage plays the `wheely-trucks` music track because its id matches.
