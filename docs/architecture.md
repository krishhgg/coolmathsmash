# Architecture

The game is a deterministic simulation with a renderer on top. Everything that decides the outcome of a match
lives in `src/sim` and is a pure function of the match config and the per-frame inputs.

```mermaid
flowchart LR
  Devices[Keyboard / Gamepads] -->|InputFrame per port| Game
  Harness[window.__smash / scripts / replays] -->|InputFrame per port| Game
  Game -->|stepMatch, 60 Hz fixed| Sim[(MatchState)]
  Sim -->|read only, interpolated| Renderer[PixiJS renderer]
```

## Simulation (`src/sim`)

- `MatchState` is plain data (numbers, strings, arrays, objects). It can be hashed (`hashState`), cloned and
  replayed. No classes, no references to renderer objects.
- `stepMatch(state, inputs)` advances exactly one 1/60 s frame. Nothing else mutates the state.
- Randomness comes from the seeded generator in `src/engine/rng.ts` whose state lives in `MatchState.rng`.
  ESLint bans `Math.random` so it cannot sneak in.
- Trigonometry and other transcendental math come from `src/sim/math.ts` (`SimMath.sin`, `cos`, `atan`, `atan2`,
  `asin`, `hypot`), built from `+ - * /` and `Math.sqrt`, which every engine rounds the same way. Engines round
  `Math.sin` and the like differently in the last bit, so Node and Chromium would play the same match differently.
  ESLint bans the `Math` versions, and `**` with exponents other than 2, in `src/sim`, `src/ai`, and fighter and
  stage code outside `art/` and stage views. `e2e/determinism.spec.ts` plays CPU matches in Node and Chromium and
  compares their state hashes on every frame.
- Units follow Smash Ultimate: distances in game units (Battlefield's main platform is 160 wide), speeds in
  units per frame, time in frames. Reference numbers can then be used unchanged in code and tests.
- Inputs are `InputFrame`s: integer sticks in [-100, 100] (y up) and a button bitmask. The sim turns them into
  press edges, a 9-frame input buffer with Ultimate's hold buffer, and flick timing (dash, smash attacks, tap
  jump, fast fall, platform drop) in `src/sim/control.ts`.
- Stages can move: `MatchState.stage` holds where each solid and platform is on the current frame, a pure
  function of the frame, and every fighter's `Ctx.stage` is the stage as it stands then (`docs/stage-geometry.md`).
- `src/sim/actions/index.ts` registers every shared action when `step.ts` loads it. Modules that action files
  import must not import `step.ts`: through that cycle, an action file loaded first would reach the registry
  before its own actions exist, and they would never be registered. `compiledStage`, `posedStage` and `makeCtx`
  live in `src/sim/context.ts` for that reason.
- Sim code looks fighters up in `src/fighters/lookup.ts`, which imports no fighter. `src/fighters/registry.ts`
  finds every fighter and hands them to it; `step.ts` and code outside `src/sim` import the registry. Sim code must
  not import the registry: a fighter's moves, entities and art import sim code, so whichever of them loaded first
  would reach the registry, which would build that fighter before the module finished, without it.
  `src/fighters/importOrder.test.ts` imports each of them first to check.

## Loop (`src/engine/loop.ts`)

`FixedLoop` accumulates real time and runs whole simulation frames; the renderer receives `alpha`, the
fraction of a frame left over, and interpolates positions between the previous and current frame. A slow
display never slows or speeds the game, and a stall drops time instead of fast-forwarding.

## Replays (`src/sim/replay.ts`)

A replay is the match config plus every port's input on every frame, run-length encoded. `playReplay`
reproduces the match bit for bit; tests assert equal state hashes.

## Harness (`src/harness`)

Loading the game with `?harness` stops real-time stepping and exposes `window.__smash` (see
`src/harness/api.ts`): start a match, feed scripted inputs (`ScriptStep[]`), step frames, read or hash state,
toggle overlays and render on demand. Playwright tests and the capture harness drive the game only through it.

## Lab (`lab.html`, `src/lab`)

`/lab.html?scene=<name>` mounts one piece of the game in isolation (a fighter's poses, the stage, the HUD) on
the same 1280×720 canvas. Scenes are discovered from `src/lab/scenes/*.ts` (export `scene: LabScene`), so
adding one touches no shared file. A scene's `api` functions are callable from tests and the capture harness
through `window.__lab.call(name, ...args)`.
