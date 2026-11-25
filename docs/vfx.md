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

## What spawns them

| Sim event                 | Effect                                                                                               |
| ------------------------- | ---------------------------------------------------------------------------------------------------- |
| `hit`                     | Spark at the contact point; the victim shakes, and the attacker too when it was a fighter's own move |
| `hit` with `entity`       | Spark; only the victim shakes, since the sim freezes neither the projectile nor its owner            |
| `shieldHit`               | Blue-white clang spark, bubble flash and ripple; the shield shakes away from the attacker            |
| `stageHit`                | Spark (flames for lava) at the hazard's contact point; the fighter it hit shakes                     |
| `entityHit`               | Spark where a hittable entity was struck; nobody shakes                                              |
| `shieldBreak`             | Shatter from the cracked bubble                                                                      |
| `ko`                      | KO blast; the KO'd fighter's launch smoke shrinks away                                               |
| `hit` in 1v1, strong      | Special Zoom (blue), or Finish Zoom (red) when it will KO (below)                                    |
| `jump`, `land`            | Dust at the feet (more for a full hop or a laggy landing)                                            |
| `action` from `respawn`   | The respawn platform shrinks away                                                                    |
| a fighter in tumble, fast | Launch smoke along the frame's path, and speed lines past 5.5 units per frame                        |

## Special Zoom and Finish Zoom

Ultimate's zoom on a decisive 1v1 hit lives in `src/render/zoom.ts`, with the KO prediction in
`src/render/koPredict.ts`. The rules come from SmashWiki's Special Zoom article, quoted in `zoom.ts`:

- Only with exactly two players (Ultimate: "nearly non-existent" with more).
- Finish Zoom, red: `predictKo` says the pending launch crosses a blast zone before hitstun ends. It runs Ultimate's
  launch from `formulas.ts` and the sim's tumble physics with the stick neutral and no stage collision, because
  Ultimate's check "does not account for obstructions or DI". With a clear path it matches the sim frame for frame.
- Special Zoom, blue: a hit of at least 150 knockback (`SPECIAL_ZOOM_KB`, the camera's severe shake) that will not
  KO. Ultimate lists the moves instead; this roster has no such list.
- A Finish Zoom takes over a running Special Zoom; otherwise a new zoom waits for the running one's launch.

SmashWiki gives no length, and Ultimate's slowdown would stretch sim frames. So the zoom plays over the victim's
hitlag, the frames the sim already holds both fighters still: the camera pushes in on the contact point over 4
frames (to 120 units across, twice the camera's closest), holds, and cuts back to the normal camera on the launch frame.
The flash tints everything behind the fighters and draws streaks pointing at the impact, in screen pixels like the
KO blast. `Camera.viewFor` takes the zoom as a `Focus`, so screen shake still applies on top.

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

## Quality

`lite` (the harness default, and CI's software WebGL) keeps every effect but cuts its cost: fighters never get a
filter, so the smash-charge and respawn flash fall back to the plain intangibility blink; the KO blast blends two
beam layers instead of three (the cone deepens to make up for the missing middle tint) and draws half its streaks
and sparkles; launch smoke and dust skip the light lobe on each puff and fill their bodies with the light tone.
`full` draws everything.

## Tuning

| Effect        | Driven by                                                                                        |
| ------------- | ------------------------------------------------------------------------------------------------ |
| Hit spark     | `hitPower(kb, damage)` in [0, 1]: radius 3-6.2 units, life 10-22 frames, streaks from 0.45       |
| Hitlag jitter | victim ±1.5 units along the knockback axis, attacker ±0.75, fading to 0 at launch; shield ±0.5   |
| Launch smoke  | knockback speed from 2.4 units/frame (density, puff size and life grow up to 7); speed lines 5.5 |
| KO blast      | 34 frames: shoots across in 4, holds until 12, fades by 34; the KO'd trail shrinks over 6        |
| Smash charge  | flash toward #FFF4B0 for 2 of every 8 frames, down to 1 of 4 at full charge; ±0.15 units shake   |

Capture scenarios for each effect: `hit-spark`, `hit-spark-weak`, `projectile-spark`, `launch-smoke`, `ko-blast`,
`shield-hit`, `shield-break`, `smash-charge`, `respawn-halo`, `land-dust`, `finish-zoom` and `special-zoom` (`npm run capture -- --only <names>`,
with `--quality full` for the full look).
