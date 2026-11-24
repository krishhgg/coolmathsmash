# Hill-climb loop: captures, judge panel, scoreboard

Every build you are happy with, capture the named game states, put each one beside its reference frames, have a
panel of two LLM judges score them and list concrete gaps, fix the top gaps, and repeat. Controls and physics come
first, looks second. The intent and the rubric's origin are in the Captain drive:
`handoffs/research/methodology.md` and the Methodology section of `NOTES.md`.

| Piece          | Where                                                    | What it does                                                                                                                                     |
| -------------- | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Scenarios      | `src/harness/scenarios.ts`                               | Named states: match setup, fighter patches, scripted inputs, the rule that picks the capture frame, an optional motion window, required features |
| Harness API    | `window.__smash` (`src/harness/api.ts`)                  | `scenarios()`, `runScenario(name)`, `stepScenario(n)`, `patch(port, state)` on `/?harness`                                                       |
| Capture runner | `npm run capture` (`scripts/capture.ts`)                 | Headless Chromium at 1280x720: PNG per state, filmstrip + GIF + MP4 for motion, `manifest.json`                                                  |
| Judge pack     | `npm run judge:pack` (`scripts/judge-pack.ts`)           | Contact sheets (ours left, references right), `rubric.md`, `schema.json`, `prompt.md`                                                            |
| Aggregator     | `npm run judge:aggregate` (`scripts/judge-aggregate.ts`) | Validates the judges' JSON, writes `scoreboard.md`/`.json`, appends a history row                                                                |
| CI             | `.github/workflows/captures.yml`                         | Captures every PR and uploads `captures/ci` as the `captures-<sha>` artifact                                                                     |

## Run one round

Use `~/.capy/work/round-<n>/` for the round's files: judges on the same machine can read it, and it survives the
machine sleeping. `<n>` is the round number; `<code>` below is your thread code (`tools.thread.get("this")`).

### 1. Capture

```sh
npm run capture -- --out ~/.capy/work/round-1/captures
```

It rebuilds `dist/` when any source is newer (`--build` forces it), serves it on a free port, runs every scenario
in a fresh page and prints one line per scenario. Options: `--only idle,run` runs a subset, `--url <base>` uses a
running server instead (`npm run dev`, or the GitHub Pages build), `--keep-frames` keeps every frame of the motion
windows under `frames/<name>/`.

Outputs, per scenario:

- `<name>.png`: the capture frame, 1280x720.
- `<name>.strip.png`: motion scenarios only; every few frames of the window, labelled with the frame and each
  fighter's action and position. Judges look at this, because they cannot play a GIF.
- `<name>.mp4` (H.264, 60 fps, for PR uploads) and `<name>.gif` (30 fps, 640 wide, for Drive): motion scenarios
  only, when `ffmpeg` is installed.
- `manifest.json`: git sha and dirty flag, base URL, Chromium version, and per scenario its status, capture rule and
  frame, a state summary for each fighter, the PNG's sha256, file paths, and every motion frame's fighter summaries.

A scenario is `captured`, `pending` (the game lacks a feature it needs, for example
`needs move 'fsmash' (no fighter performed it)` or `needs lab scene 'stage'`), `missed` (everything it needs
exists but the capture rule never held: a regression or a broken script) or `error`. The runner exits 1 on any
`missed` or `error`, so CI catches a named state that stopped being reachable.

Same commit, same scenario, same machine: byte-identical PNG (`e2e/capture.spec.ts` checks it). Chromium renders
WebGL through SwiftShader, so no GPU is involved, but fonts can differ between machines: compare PNGs from one
machine, not CI against local.

### 2. Build the judge pack

```sh
npm run judge:pack -- ~/.capy/work/round-1/captures --out ~/.capy/work/round-1/pack
```

Options: `--previous <last round's pack>` puts last round's scores and top gaps into the prompt so judges can call
out regressions (and sets the round number to the next one), `--round <n>` sets it explicitly, `--notes <file>`
appends orchestrator context (the numeric test summary, what changed this round), `--refs <dir>` and `--map <file>`
override the reference library and mapping.

The pack holds, per captured state, `states/<name>/sheet.png` (the contact sheet), `capture.png`, `refs/` (copies),
and for motion states `strip.png`, `motion.md` (per-frame position and velocity table) and `clip.mp4`. At the top:
`prompt.md`, the exact prompt each judge receives, with the rubric and schema inlined; `rubric.md`; `schema.json`;
`pack.json`; and an empty `judges/` for the answers. Pending and missed states are listed in the prompt as not
judged.

The rubric scores five axes from 1 to 10 with anchors at 1, 4, 7 and 10 (`scripts/judge/rubric.ts`): controls &
physics feel (motion states only, null for stills), silhouette & proportions, Flash-era art fidelity, readability, and
Smash Ultimate presentation. Each judge also returns 5 to 12 ranked, actionable gaps and a list of regressions.

### 3. Run the judge panel

Two judges per round, as independent subagents that never see each other's answer: `openai/gpt-6.2-sol` and
`anthropic/claude-opus-5-5`, both at reasoning `xhigh`. Start them on your machine (`machine: "shared"`) so they
read the pack in place:

```js
const pack = '/home/user/.capy/work/round-1/pack';
const judges = [
  ['gpt-6.2-sol', 'openai/gpt-6.2-sol'],
  ['claude-opus-5-5', 'anthropic/claude-opus-5-5'],
];
for (const [id, model_id] of judges) {
  await tools.subagent.create({
    tasks: [
      {
        title: `Judge round 1 (${id})`,
        prompt:
          `You are the judge "${id}". Read ${pack}/prompt.md and follow it exactly: open the images it lists, ` +
          `write your verdict as JSON to ${pack}/judges/${id}.json, check it against ${pack}/schema.json, ` +
          `and report the same JSON as your final message. Do not open other files in ${pack}/judges/ ` +
          `and do not edit the repository.`,
      },
    ],
    start: { machine: 'shared', model: { model_id, reasoning_mode: 'xhigh' } },
  });
}
```

Wait for both with `wait({ subagents: [...], return_when: 'all' })`. If a judge cannot share your machine, copy the
pack to it with `tools.transfer.files` and copy its answer back into `judges/`. A judge whose file fails validation
in the next step gets the error list back and writes a corrected file.

### 4. Aggregate

```sh
npm run judge:aggregate -- ~/.capy/work/round-1/pack \
  --history ~/.capy/drive/captain-coolmath-games-smash/renders/history.md
```

It validates every `judges/*.json` against `schema.json` (exit 1 with every problem listed; `--check <file>` validates
one answer and writes nothing), then writes `scoreboard.md` and `scoreboard.json` into the pack and appends one row
to the history table (default `captures/history.md`; the Drive path above keeps rounds from every thread in one
table). The scoreboard shows the axis means per judge, a state × axis table with each judge's score and
the mean (⚠ where the judges differ by more than 2), the change from the previous round when the pack was built with
`--previous`, the top gaps merged across judges (the same axis and state with overlapping wording count as one gap;
gaps both judges list and gaps ranked high come first), regressions, and every judge's notes.

### 5. Fix, then repeat

Fix the top three gaps, weighting controls and physics first, then capture again and build the next pack with
`--previous ~/.capy/work/round-1/pack`. The methodology's guardrails apply: a round that improves looks while physics
tests fail does not count; keep the reference set fixed unless the Captain changes it; if the same gap tops the list
three rounds running without the score moving, write it up for the Captain and move on; at the end of each round note
what slowed it down (a flaky capture, a missing reference) and fix that too.

### 6. Keep the renders

Copy each round to the Captain drive under `renders/<code>/round-<n>/`: the PNGs, strips and GIFs from the capture
run, `manifest.json`, every `states/*/sheet.png` (as `compare-<state>.png`), `judges/*.json`, `scoreboard.md`.
Leave the MP4s and the reference copies out; the drive already has the references.

## Put captures in a pull request

Every PR body carries visuals. Upload each still PNG and each motion MP4 with `tools.pr.uploadAsset` (it rejects
animated GIFs) and put the Markdown it returns in the body, an MP4 URL on its own line:

```js
const still = await tools.pr.uploadAsset({ path: '/home/user/.capy/work/round-1/captures/jump-apex.png' });
const clip = await tools.pr.uploadAsset({ path: '/home/user/.capy/work/round-1/captures/jump-apex.mp4' });
```

Contact sheets make good before/after images too. CI also attaches the whole `captures/ci` folder to every PR run as
a workflow artifact.

## The harness API

`/?harness` boots the game in manual mode and exposes `window.__smash`:

```js
const s = window.__smash;
s.scenarios(); // [{ name, description, page, script, capture, motion, requires, ... }]
await s.runScenario('jump-apex'); // { status: 'captured', captureFrame: 40, frame: 40, fighters: [...], hash }
await s.runScenario('jump-apex', { frame: 20 }); // stop at frame 20 instead
await s.stepScenario(5); // continue that scenario's script 5 frames, then render
await s.runScenario('attack-active'); // { status: 'pending', reason: "needs move 'fsmash' (no fighter performed it)" }
s.patch(1, { damage: 150, pos: { x: 70, y: 0 } }); // vectors merge; moving also moves prevPos
```

`runScenario` dry-runs the scenario on a bare simulation first to find the capture frame (or why it cannot be
reached), then replays it in the game and renders. Rendering never affects the simulation or the camera, so a frame
looks the same however it was reached.

## Add a scenario

Append to `SCENARIOS` in `src/harness/scenarios.ts`:

```ts
{
  name: 'dash-dance',
  description: 'P1 dashes right then left inside the dash window.',
  page: { kind: 'game' },
  match: { ports: [{ fighter: 'fireboy' }, { fighter: 'fireboy' }] }, // optional, merged over DEFAULT_MATCH
  patches: [{ port: 1, state: { damage: 80 } }], // applied at frame 0
  script: [
    { port: 0, from: 10, to: 16, x: 100 },
    { port: 0, from: 16, to: 22, x: -100 },
  ],
  capture: { label: 'P1 turns into the second dash', when: (s, prev) => s.fighters[0]!.facing !== prev.fighters[0]!.facing },
  motion: { before: 15, after: 20 }, // optional clip around the capture frame
  requires: ['action:dash'], // 'action:<name>', 'move:<name>', or 'hud'
}
```

`capture` is `{ frame: n }` or a predicate over the current and previous `MatchState` (first frame it holds, from
`from`, default 1, up to `limit`, default 600). A lab scenario names a scene, URL parameters and `__lab.call`
steps: `{ page: { kind: 'lab', scene: 'fighter', params: { fighter: 'watergirl' } }, calls: [{ fn: 'sheet' }] }`; a
missing scene or API function makes it pending. Then add its references to `scripts/judge/refs.json`, run
`npm test` (names must be unique and JSON-safe) and `npm run capture -- --only <name>`, and look at the PNG.

**A new fighter** gets its own copies of the per-fighter states, named `<fighter>-<state>` (for example
`watergirl-idle`, `watergirl-run`, `watergirl-jump-apex`) with `match: { ports: [{ fighter: 'watergirl' },
{ fighter: 'fireboy' }] }`, a `<fighter>-sheet` lab scenario on the `fighter` scene with `params: { fighter }`, and
`refs.json` entries pointing at `characters/<slug>/` in the reference library.

## Add or change references

`scripts/judge/refs.json` maps each state to glob patterns under the reference library (`root`, the Captain drive's
`handoffs/research/refs/` by default; `*` stays within a folder, `**` crosses folders). Patterns take turns: the
first match of every pattern, then the second of every pattern, until `maxPerState` (4). So list the Smash
Ultimate frame first and the character's own art after it, and both get a slot. Captions come from the "what it
shows" column of the `index.md` table in each reference folder. `npm run judge:pack` prints how many references
each state got and the patterns of any state that matched none. Keep the set fixed during a climb unless the
Captain changes it.
