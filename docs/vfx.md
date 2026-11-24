# Combat effects (VFX)

Hit sparks, launch smoke, the shield bubble, KO blasts and the small extras (smash-charge sparkle, jump and landing
dust, the respawn halo) live in `src/render/vfx/`. They read the simulation and never write to it: they look like
Smash Ultimate's effects, drawn as flat Flash shapes with dark outlines, no blur.

| File                  | What it holds                                                                                 |
| --------------------- | --------------------------------------------------------------------------------------------- |
| `system.ts`           | `VfxState` (plain spawn records), `stepVfx` (spawn from one frame's events, drop the expired) |
| `hitSpark.ts`         | Hit sparks: layered star (normal, electric, shield clang) or flame burst (fire), streaks      |
| `smoke.ts`            | Launch smoke and dust puffs (merged two-tone clouds), speed lines on very fast launches       |
| `shield.ts`           | Shield bubble, its flash and wobble on `shieldHit`, the shatter on `shieldBreak`              |
| `koBlast.ts`          | KO blast, in screen pixels, from the screen edge nearest the KO point toward the centre       |
| `shake.ts`            | Screen shake records and the summed offset                                                    |
| `extras.ts`           | Smash-charge glow and sparkle, respawn halo                                                   |
| `shapes.ts`           | The `Shape` list every effect returns, and geometry helpers (star, twinkle, blade, arc band)  |
| `paint.ts`, `view.ts` | The only Pixi code: `paint` draws shapes, `VfxView` fills the three layers each render        |

## Determinism

`Game.step` calls `Renderer.stepCamera` after every simulated frame, which also steps the effects
(`Vfx.step` -> `stepVfx`): it drops records past their lifetime, then spawns new ones from `state.events` and from
launched fighters. A record holds its spawn frame, position, parameters and a seed (`seedOf(frame, port, salt)`, a
fixed integer hash), and every effect's shapes are a pure function of the record and the frame being drawn. So frame
N draws the same picture however it was reached, as long as the same frames were simulated. A new match, or a frame
that does not follow the last stepped one, starts from no effects. No `Math.random`, no clocks.

## Layers

`VfxView` draws `behind` the fighters (respawn halo, charge glow, dust and launch smoke, speed lines), in `front` of
them (hit sparks, shield shatters, charge sparkle) and on `screen` above the world (KO blasts). The shield bubble is
drawn by `FighterView` with `shieldBubbleShapes`. Screen shake moves the camera view (`shakeView` in
`src/render/camera.ts`) by `shakeOffset` pixels, so the stage, fighters and effects shake together.

## Tuning

| Effect       | Driven by                                                                                        |
| ------------ | ------------------------------------------------------------------------------------------------ |
| Hit spark    | `hitPower(kb, damage)` in [0, 1]: radius 3.2-11 units, life 10-22 frames, streaks from 0.45      |
| Screen shake | tumbling hits 3-10 px for 10 frames, shield break 7 px for 14, KO 16 px for 34                   |
| Launch smoke | knockback speed from 2.4 units/frame (density, puff size and life grow up to 7); speed lines 5.5 |
| KO blast     | 42 frames: shoots in over 6, holds, pinches out from frame 20                                    |

Capture scenarios for each effect: `hit-spark`, `hit-spark-weak`, `launch-smoke`, `ko-blast`, `shield-hit`,
`shield-break`, `smash-charge`, `respawn-halo` and `land-dust` (`npm run capture -- --only <names>`).
