# Sim events

The simulation reports what happened each frame as a list of plain-data events, so audio, the HUD and visual
effects can react without reading the simulation's internals. The types live in `src/sim/events.ts`.

## Listening

```ts
const off = game.onEvents((events, state) => {
  for (const e of events) if (e.type === 'hit') playHitSound(e.damage, e.effect);
});
```

`Game.onEvents` calls the listener once after every simulated frame (60 per second, including frames stepped by
the capture harness) with that frame's events, and returns the unsubscribe function. The same list is
`state.events` on the match, so code that steps a `MatchState` directly (tests, replays) can read it there.
The list is replaced every frame: copy events you want to keep.

Events are deterministic. A replay produces exactly the same stream, so don't use them to start anything that
feeds back into the simulation.

`?events` on the game URL (or **F5**) shows the latest events in a debug log at the top right.

## Events

| `type`          | fields                                                                                            | when                                                                                                                                               |
| --------------- | ------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `hit`           | `attacker`, `victim`, `move`, `damage`, `kb`, `tumble`, `hitlag`, `effect`, `x`, `y` (+ `entity`) | a hit lands; `damage` is what it added to the victim's %. An entity's hit adds its `entity` id and credits its owner as `attacker` (-1 for nobody) |
| `shieldHit`     | `attacker`, `victim`, `move`, `damage`, `shieldHp`, `x`, `y` (+ `entity`)                         | a hit lands on a shield                                                                                                                            |
| `shieldBreak`   | `port`                                                                                            | a shield breaks                                                                                                                                    |
| `ko`            | `port`, `stocks` (left), `side` (`left`, `right`, `top`, `bottom`), `x`, `y`                      | a fighter crosses a blast zone                                                                                                                     |
| `respawn`       | `port`                                                                                            | a KO'd fighter appears on the respawn platform                                                                                                     |
| `jump`          | `port`, `kind` (`full`, `short`, `air`)                                                           | a jump leaves the ground, or an air jump starts                                                                                                    |
| `land`          | `port`, `lag`                                                                                     | a fighter touches down; `lag` is its landing lag                                                                                                   |
| `move`          | `port`, `move`                                                                                    | a move starts (the fighter's move name)                                                                                                            |
| `transform`     | `port`, `from`, `to`                                                                              | a fighter transforms into another (fighter ids)                                                                                                    |
| `action`        | `port`, `from`, `to`                                                                              | a fighter's action changed this frame                                                                                                              |
| `grab`          | `attacker`, `victim`, `move`                                                                      | a grab catches someone (`move`: `grab`, `dashGrab` or `pivotGrab`)                                                                                 |
| `pummel`        | `attacker`, `victim`, `damage`                                                                    | a pummel lands; `damage` is what it added to the held fighter's %                                                                                  |
| `throw`         | `attacker`, `victim`, `move`                                                                      | a throw lets go; the `hit` that launches the victim follows                                                                                        |
| `grabRelease`   | `holder`, `held`                                                                                  | a grab ends without a throw (held too long, or a hit broke it); `holder` is -1 if already gone                                                     |
| `grabClank`     | `ports`                                                                                           | two fighters grab each other on the same frame and both bounce off                                                                                 |
| `stagePiece`    | `piece` (`solid`, `platform`), `index`, `on`                                                      | a scheduled stage piece appeared or vanished                                                                                                       |
| `squeeze`       | `port`, `solid`, `x`, `y`                                                                         | a moving solid squeezed a fighter, who popped out on top                                                                                           |
| `shake`         | `port`, `amplitude`, `frames`                                                                     | a move or action asks for a screen shake of `amplitude` pixels for `frames` frames                                                                 |
| `entitySpawn`   | `id`, `kind`, `owner`, `x`, `y`                                                                   | an entity (projectile, minion, object, item) appears                                                                                               |
| `entityDestroy` | `id`, `kind`, `reason`, `x`, `y`                                                                  | an entity leaves: `expired`, `blastZone`, `stage`, `hit` (used up by its hit), `clank`, `absorbed`, `broken` (out of HP) or `script`               |
| `reflect`       | `id`, `kind`, `port`, `x`, `y`                                                                    | a reflector sends a projectile back; `port` now owns it                                                                                            |
| `absorb`        | `id`, `kind`, `port`, `heal`, `x`, `y`                                                            | an absorber eats a projectile and heals `heal` %                                                                                                   |
| `entityHit`     | `id`, `kind`, `attacker`, `damage`, `hp`, `x`, `y`                                                | a hittable entity takes a hit; `hp` is what it has left                                                                                            |
| `tetherFire`    | `port`, `x`, `y`                                                                                  | a tether line leaves the hand towards (`x`, `y`), the end of its full range                                                                        |
| `tetherLatch`   | `port`, `kind` (`ledge`, `surface`, `sky`), `x`, `y`                                              | a tether line anchors at (`x`, `y`) and the reel starts                                                                                            |
| `tetherRelease` | `port`                                                                                            | a tether line lets go: it whiffed, the fighter let go or grabbed the ledge, or a hit knocked him off                                               |
| `stageHit`      | `victim`, `source` (`zone`, `hitbox`), `index`, `element` (or null), `damage`, `kb`, `x`, `y`     | a stage hazard hits a fighter; `damage` is what it added                                                                                           |

`x` and `y` are world units with y up. `action` events come last in a frame, one per fighter whose action
differs from the frame before, which also covers states without their own event: `shield`, `spotDodge`,
`rollForward`, `airDodge`, `ledgeHang`, `techInPlace`, `techRoll`, `downBound`, `tumble` and so on.

`tetherFighterHit` carries the casting `port`, the `target` port and the contact point `x`, `y`. It reports
line contact, not arrival or damage.

## Adding an event

Add a member to `SimEvent` with a one-line comment, call `emit(x.m, {...})` where it happens in `src/sim`,
add a row above and a test in `src/sim/events.test.ts`. Keep events small and JSON-only; they are part of the
match state.
