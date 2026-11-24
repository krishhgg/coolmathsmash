# Stage geometry

A stage is collision geometry plus (later) art. Its geometry is one `StageGeometry` (`src/sim/stage.ts`) in
`src/stages/<id>/geometry.ts`; the registry finds it there, so adding a stage edits no shared file. Units are
Ultimate's: Battlefield's main platform is 160 wide at y = 0, its blast zones are x ±240, top 192, bottom −140.

```ts
export const stage: StageGeometry = {
  id: 'papas-pizza',
  name: "Papa's Pizza",
  solids: [
    {
      points: [
        [-75, 0],
        [-75, -30],
        [75, -30],
        [75, 0],
      ],
    },
  ], // closed polygons, either winding
  platforms: [{ x1: -63, x2: -27, y: 26 }], // one-way, drop-through
  ledges: [
    { x: -75, y: 0, side: -1 },
    { x: 75, y: 0, side: 1 },
  ],
  blastZones: { left: -240, right: 240, top: 192, bottom: -140 },
  camera: { left: -170, right: 170, top: 130, bottom: -80 },
  spawns: [
    [-40, 0, 1],
    [40, 0, -1],
  ],
  respawns: [
    [0, 70],
    [36, 70],
  ],
};
```

Solid edges are floors, walls or ceilings by their outward normal (floors face up within about 45°). A ledge
belongs to the solid with a corner at its point; set `solid` (an index into `solids`) to say otherwise.

## Moving platforms and solids

Any solid or platform can move and can appear and vanish. Both are pure functions of the match frame, so they
replay exactly and need no state of their own.

```ts
// Keyframes: [frame within the period, dx, dy] from the authored position, looping. `ease` eases in and out
// of every key; without it the piece moves at constant speed between keys.
motion: { period: 480, ease: true, keys: [[0, -5, 0], [60, -5, 0], [240, 50, 0], [300, 50, 0]] },

// Or any function of the match frame returning [dx, dy] (no Math.random, no clocks, no state).
motion: (frame) => [18 * Math.cos((2 * Math.PI * frame) / 360), 18 * Math.sin((2 * Math.PI * frame) / 360)],

// Absent on frames 200-299 (inclusive) of every 300; or a function of the frame, true while present.
schedule: { period: 300, off: [[200, 299]] },
```

Pieces translate; they do not rotate. A ledge moves and vanishes with its solid. The camera bounds and blast
zones never move.

### What the simulation does

`MatchState.stage` holds every piece's offset, its movement this frame (`dx`, `dy`) and whether it is there
(`on`). Each frame the fighters act and move against the stage as it stands, then `advanceStage`
(`src/sim/movingStage.ts`) moves the stage to the next frame and settles every fighter against it:

1. **Riding.** A fighter standing on a piece moves with it, and so does one hanging from (or climbing up) a
   ledge of a moving solid. As in Ultimate, a jump does not inherit the platform's speed.
2. **Rising surfaces catch.** A floor or soft platform that rises through a fighter's feet catches them:
   airborne fighters land on it, grounded ones step onto it. A fighter rising faster than the surface, or
   holding down through a soft platform, passes.
3. **Pushes.** A solid that moves into a fighter pushes them out through the edge it hit and takes away their
   speed into it. A grounded fighter slides along its floor and loses the ground if pushed past the floor's
   end; one pressed down onto a soft platform drops through it.
4. **Squeezes.** When the push would leave a fighter inside other geometry (between a moving wall and
   another solid) or presses a grounded fighter into its solid floor (a crusher coming down), the fighter
   pops out on top of the moving solid, at the nearest point of its floor: standing if it was grounded,
   landing if it was airborne. Collision
   never KOs, as in Ultimate, where crush KOs are stage hitboxes. A solid without a floor passes through
   the fighter instead.
5. **Vanishing.** Collision ignores absent pieces. A fighter standing on a piece that vanishes falls, and one
   hanging from its ledge lets go. A solid that reappears around a fighter does not trap them: they fall out
   of it.

Collision uses each fighter's movement relative to each solid, so a piece can move any distance per frame
without tunnelling through anyone. The pushes act on the fighter's collision box (a diamond from the feet to
three quarters of its height, half its width wide), so a moving solid lower than half a fighter's height
slides under their sides; make movers taller, or make them platforms.

Grounded movement does not collide with walls (see `groundMove`), so stages should not put walls on top of
floors that fighters walk along.

### Events

`stagePiece` reports a scheduled piece appearing or vanishing and `squeeze` a fighter squeezed out on top of
a solid (docs/sim-events.md), for audio and effects.

### Drawing

The placeholder renderer draws static pieces once and moving ones every frame from `MatchState.stage`,
interpolated between frames (`src/render/stagePieces.ts`). Absent pieces show as faint ghosts and pieces
about to vanish blink for 45 frames, so a stage's art should telegraph a vanish at least that early.

## The testbed

`src/stages/testbed.ts` is not a real stage: it shows each stage system on a Battlefield-sized slab for
tests, the harness and PR captures. The harness and the unit tests register it at runtime, so it stays out of
the stage list. Under `?harness`, `__smash.newMatch({ stage: 'testbed' })` loads it:

- a Smashville-style glider (platform 0) crossing above the right half of the slab;
- a platform that is there for 200 frames of every 300 (platform 1, top centre);
- a platform circling off the left edge, its motion a function of the frame (platform 2);
- an elevator with grabbable corners off the right edge (solid 1), rising 70 and sinking back;
- a crusher over the left of the slab that stops 5 above the floor (solid 2), squeezing anyone under it.
