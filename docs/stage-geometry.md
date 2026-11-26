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

A fighter's collision box (a diamond from the feet to three quarters of its height, half its width wide) never
enters a solid, as in Ultimate. Floors catch the feet (a landing). Walls and ceilings push back any point of the
box that crosses them, and a convex corner with a wall or ceiling on one side (a ledge corner, the corner where a
side wall meets the underside) pushes back the side of the box it runs into. A fighter rising into the underside
stops against it or slides along it, and one rising past a corner slides off it. Soft platforms only catch the
feet from above, so fighters pass up through them.

## Moving platforms and solids

Any solid or platform can move and can appear and vanish. Both are pure functions of the stage's clock
(`MatchState.stageFrame`), so they replay exactly and need no state of their own. The clock is the match frame,
except that it stops while a Final Smash holds the others (src/sim/finalSmash.ts): "All stage hazards are paused
during a Final Smash" (SmashWiki, Stage hazard). Pieces, zones, stage hitboxes and conveyor belts all wait then.

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
without tunnelling through anyone. The pushes act on the fighter's whole collision box, so even a mover lower
than half a fighter's height shoves them at the feet.

Grounded movement does not collide with walls (see `groundMove`), so stages should not put walls on top of
floors that fighters walk along.

### Events

`stagePiece` reports a scheduled piece appearing or vanishing, `squeeze` a fighter squeezed out on top of a
solid and `stageHit` a stage hazard hitting a fighter (docs/sim-events.md), for audio and effects.

### Drawing

The placeholder renderer draws static pieces once and moving ones every frame from `MatchState.stage`,
interpolated between frames (`src/render/stagePieces.ts`). Absent pieces show as faint ghosts and pieces
about to vanish blink for 45 frames, so a stage's art should telegraph a vanish at least that early. A stage
view with `pieces` (docs/stages.md) draws its own moving pieces instead. With
hazards on, damage zones are tinted by element and stage hitboxes are grey discs, faint while they are not out.

## Stage hazards

Hazards are the parts of a stage that act on fighters by themselves. They are on by default;
`MatchConfig.hazards: false` turns every one of them off for legal play: damage zones and stage hitboxes stop
hitting, conveyors stop, and pieces flagged `hazard` stay at their authored place, present.

```ts
// Damaging areas, rectangles that can move and follow a schedule like pieces.
zones: [{ x1: -12, x2: 12, y1: -1, y2: 4, element: 'goo' }],
// Stage hitboxes: HitboxDef circles around an anchor that moves with `motion` and is out while `schedule` says.
hitboxes: [{ x: 0, y: 6, motion, schedule, boxes: [{ id: 0, x: 0, y: 0, radius: 6, damage: 8, angle: 45, kbg: 80, bkb: 50 }] }],
// On any solid or platform:
conveyor: 0.35, // a belt: fighters standing on it move 0.35 units per frame along x
hazard: true, // its motion and schedule are a hazard (a trapdoor): with hazards off it stays put and present
```

### Damage zones

A zone hits a fighter whose body (its width, from the feet up to its height) overlaps it. Its `element` is
`goo`, `lava` or `water`, and a fighter lists the elements it is immune to in `FighterDef.immune`: Fireboy
wades through lava and Watergirl through water, and goo hurts everyone, as in their games. Each element has a
default hit (`ELEMENT_HITS` in `src/sim/hazards.ts`); a zone can set its own `hit` (a HitboxDef's damage and
knockback fields) and `rehit`.

| element | damage     | knockback (angle 90, kbg 100, bkb 0) | rehit     |
| ------- | ---------- | ------------------------------------ | --------- |
| goo     | 2%         | set 50: a weak pop, hitstun          | 10 frames |
| lava    | 12% (fire) | set 90: a launch into tumble         | 30 frames |
| water   | 12%        | set 90: a launch into tumble         | 30 frames |

The pattern is Ultimate's damage floors: set (weight-based) knockback straight up, so a hit pops the fighter out
of the pool the same height at any %, and the floor then waits before it hits the same fighter again. Between
pops a fighter can jump or drift clear. Goo follows the roster's Forest Temple pool (2% every 10 frames and a
weak pop, so nobody stands in it), and lava and water its 12% upward launch. Put a pool's top 3 or 4 units
above the floor, so standing in it counts and a hop clears it.

### Stage hitboxes

A stage hitbox is a moving blade, a falling weight or a patrolling ball: `HitboxDef` circles placed relative to
an anchor (`x`, `y`) that moves with `motion` and is out while `schedule` has it on. Its angles count from
+x; `direction: 'back'` mirrors them and `'away'` sends fighters away from the anchor. `rehit` (default 30)
is the wait before stage hazards hit the same fighter again.

### How hazards hit

After the fighters' own hits each frame, `stageHits` (`src/sim/hazards.ts`) gives each fighter that a zone
or stage hitbox touches that hazard's hit through `strike` (`src/sim/combat/hits.ts`), the victim's side of
a fighter's hit: Ultimate's knockback formula, hitlag, a launch with DI when hitlag ends, hitstun or tumble,
and the 1v1 damage multiplier. There is no attacker, so there is no staleness or rage and only the victim
freezes. A fighter takes at most one stage hit per frame (zones first, then stage hitboxes, lowest index first),
and then `stageHitLock`, the hazard's `rehit`, keeps all stage hazards off them. Hazards skip intangible
fighters and fighters already in hitlag (not a fighter paralyzed past its hitlag), and go through shields but not
armor (MoveDef.armor). Stage hits land before the frame's grabs are
resolved, so they count like any other hit on a grab: a held fighter armours through them until they add up
to `GRAB.breakDamage` (a lava hit breaks free at once, goo takes a few), and a struck holder lets go.

### Conveyors

A solid or platform with `conveyor` moves every fighter standing on it that many units per frame along x, on
top of their own movement, whatever they are doing. A belt carries a fighter off the end it runs toward, even
in actions that otherwise stop at the edge (standing still), and they fall; a grab they hold ends, as when the
stage takes the ground away. Leaving the belt keeps none of its speed.

### Trapdoors

A trapdoor is a solid set into the floor, flush with it, with a schedule: fighters on it fall when it vanishes,
and it shuts again when the schedule brings it back (a solid that reappears around a fighter lets them fall
out). Fighters walk across the seams as across one floor, because a floor of another solid that meets a floor's
end at the same height continues it. Flag it `hazard: true` so it stays shut with hazards off. A falling or
tilting floor works the same way with a `motion`.

### What CPUs see

CPUs read the stage through `stageInfo(state)` (`src/ai/stage.ts`), built each frame from `posedStage`: moved
pieces are where they are, an absent piece catches nothing and an absent solid's ledges can't be grabbed. Ground
that vanishes within the next 45 frames (`STEADY_FRAMES`) does not count as somewhere to stand or land. With
hazards on, a CPU walks up to a gap, an open trapdoor or a damage zone that hurts it and stops 4 units short,
steers its drifts toward safe landings, and walks off ground it should not stay on: a damage zone, ground about
to vanish, or a belt that would carry it into either within 45 frames. Look-ahead copies of the match
(`soloMatch` in `src/ai/look.ts`) keep the stage's frame and the hazards setting, so predictions see the same
trapdoors and belts.

## The testbed

`src/stages/testbed.ts` is not a real stage: it shows each stage system on a Battlefield-sized slab for
tests, the harness and PR captures. The harness and the unit tests register it at runtime, so it stays out of
the stage list. Under `?harness`, `__smash.newMatch({ stage: 'testbed' })` loads it:

- a Smashville-style glider (platform 0) crossing above the right half of the slab;
- a platform that is there for 200 frames of every 300 (platform 1, top centre);
- a platform circling off the left edge, its motion a function of the frame (platform 2);
- an elevator with grabbable corners off the right edge (solid 1), rising 70 and sinking back;
- a crusher over the left of the slab that stops 5 above the floor (solid 2), squeezing anyone under it.

`src/stages/hazardTestbed.ts` does the same for stage hazards: `__smash.newMatch({ stage: 'hazard-testbed' })`
loads it, and `hazards: false` turns them off.

- goo, lava and water pools on the floor (zones 0, 1 and 2, left to right);
- conveyor belts (platforms 0 and 1) carrying fighters toward the middle and off;
- a trapdoor in the middle of the floor (solid 1), open on frames 180-299 of every 360;
- a blade (stage hitbox 0) that waits until frame 120, sweeps the floor left to right until frame 300 and
  retracts to go back.
