# Combat effects (VFX)

Hit sparks, launch smoke, the shield bubble, KO blasts, hitlag jitter and the small extras (smash-charge flash and
sparkle, jump and landing dust, the respawn platform) live in `src/render/vfx/`. They read the simulation and never
write to it: they look like Smash Ultimate's effects, drawn as flat Flash shapes with dark outlines, no blur. No
effect draws a character.

| File                  | What it holds                                                                                   |
| --------------------- | ----------------------------------------------------------------------------------------------- |
| `system.ts`           | `VfxState` (plain spawn records), `stepVfx` (spawn from one frame's events, drop the expired)   |
| `hitSpark.ts`         | Hit sparks: a contact flash, then a layered star (normal, electric, shield clang) or flames     |
| `hitlag.ts`           | Hitlag jitter: `Freeze` records and `hitlagOffset`, the render-only shake along the launch axis |
| `smoke.ts`            | Launch smoke and dust puffs (merged two-tone clouds), speed lines on very fast launches         |
| `shield.ts`           | Shield bubble, its flash and ripple on `shieldHit`, the cracked bubble, the shatter on a break  |
| `koBlast.ts`          | KO blast, in screen pixels, from the screen edge nearest the KO point across the screen         |
| `extras.ts`           | Smash-charge sparkle and release flash, respawn platform                                        |
| `shapes.ts`           | The `Shape` list every effect returns, and geometry helpers (star, twinkle, blade, arc band)    |
| `paint.ts`, `view.ts` | The only Pixi code: `paint` draws shapes, `VfxView` fills the three layers each render          |

## Determinism

`Game.step` calls `Renderer.stepCamera` after every simulated frame, which also steps the effects
(`Vfx.step` -> `stepVfx`): it drops records past their lifetime, then spawns new ones from `state.events` and from
launched fighters. A record holds its spawn frame, position, parameters and a seed (`seedOf(frame, port, salt)`, a
fixed integer hash), and every effect's shapes are a pure function of the record and the frame being drawn. So frame
N draws the same picture however it was reached, as long as the same frames were simulated. A new match, or a frame
that does not follow the last stepped one, starts from no effects. No `Math.random`, no clocks.

## Layers

`VfxView` draws `behind` the fighters (respawn platform, dust and launch smoke, speed lines), in `front` of them (hit
sparks, shield shatters, charge sparkle and release flash) and `screen` (KO blasts, in screen pixels). The renderer
puts `screen` in the world just above the stage, with the camera transform undone, so the beam crosses the screen
behind the fighters and their tags. `FighterView` draws what sits on a fighter, from `fighterFx`: the shield bubble
(`shieldBubbleShapes`), the jitter offset of body and bubble, and a colour flash (smash charge, respawn
invincibility) through a `ColorMatrixFilter`. Screen shake is the camera's (`SHAKE` and `shakesFrom` in
`src/render/camera.ts`); the effects add none of their own.

## Tuning

| Effect        | Driven by                                                                                        |
| ------------- | ------------------------------------------------------------------------------------------------ |
| Hit spark     | `hitPower(kb, damage)` in [0, 1]: radius 3-6.2 units, life 10-22 frames, streaks from 0.45       |
| Hitlag jitter | victim ±1.5 units along the knockback axis, attacker ±0.75, fading to 0 at launch; shield ±0.5   |
| Launch smoke  | knockback speed from 2.4 units/frame (density, puff size and life grow up to 7); speed lines 5.5 |
| KO blast      | 34 frames: shoots across in 4, holds until 12, fades by 34; the KO'd trail shrinks over 6        |
| Smash charge  | flash toward #FFF4B0 for 2 of every 8 frames, down to 1 of 4 at full charge; ±0.15 units shake   |

Capture scenarios for each effect: `hit-spark`, `hit-spark-weak`, `launch-smoke`, `ko-blast`, `shield-hit`,
`shield-break`, `smash-charge`, `respawn-halo` and `land-dust` (`npm run capture -- --only <names>`).
