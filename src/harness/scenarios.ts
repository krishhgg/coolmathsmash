import { ACTIONS } from '../sim/actions';
import type { FighterState } from '../sim/fighter';
import { DEFAULT_MATCH, createMatch, stepMatch, type MatchConfig, type MatchState } from '../sim/match';
import { inputsAt, type ScriptStep } from './script';

/**
 * Named capture scenarios for the hill-climb loop (docs/hill-climb.md): a fixed match, scripted inputs and a
 * rule that picks the frame to capture. `scripts/capture.ts` runs every scenario through `window.__smash`
 * (game) or `window.__lab` (lab scenes) and saves PNGs, motion clips and a manifest.
 */

/** Partial fighter state for `__smash.patch` and scenario setup. Vector fields merge, others replace. */
export type FighterPatch = {
  [K in keyof FighterState]?: FighterState[K] extends { x: number; y: number }
    ? Partial<FighterState[K]>
    : FighterState[K];
};

export type Predicate = (state: MatchState, prev: MatchState) => boolean;

/** Capture at a fixed frame, or at the first frame (from `from`, default 1) where `when` holds. */
export type CaptureRule =
  { frame: number } | { label: string; when: Predicate; from?: number; limit?: number };

export interface GameScenario {
  name: string;
  description: string;
  page: { kind: 'game' };
  match?: Partial<MatchConfig>;
  /** Applied right after the match starts (frame 0). */
  patches?: { port: number; state: FighterPatch }[];
  script?: ScriptStep[];
  capture: CaptureRule;
  /** Frames around the capture frame to record as a clip. */
  motion?: { before: number; after: number };
  /**
   * Features the scenario needs; while one is missing it reports "pending" instead of failing.
   * `action:<name>` needs that action in the state machine, `move:<name>` needs a fighter to perform the move
   * during the scenario, `hud` needs the in-match HUD.
   */
  requires?: string[];
}

export interface LabScenario {
  name: string;
  description: string;
  page: { kind: 'lab'; scene: string; params?: Record<string, string> };
  /** `window.__lab.call(fn, ...args)` in order after the scene mounts. */
  calls?: { fn: string; args?: unknown[] }[];
}

export type Scenario = GameScenario | LabScenario;

/** JSON form of a game scenario for `__smash.scenarios()`: the predicate becomes its label. */
export type GameScenarioInfo = Omit<GameScenario, 'capture'> & {
  capture: { frame: number } | { label: string; from: number; limit: number };
};

export type ScenarioInfo = GameScenarioInfo | LabScenario;

export interface FighterSummary {
  port: number;
  fighter: string;
  action: string;
  actionFrame: number;
  move: string | null;
  pos: { x: number; y: number };
  vel: { x: number; y: number };
  kb: { x: number; y: number };
  facing: 1 | -1;
  grounded: boolean;
  damage: number;
  stocks: number;
  shieldHp: number;
  ledge: number;
  hitstun: number;
}

export type ScenarioStatus = 'captured' | 'pending' | 'missed';

export interface ScenarioPlan {
  status: ScenarioStatus;
  /** The frame to capture (captured only). */
  captureFrame?: number;
  /** Why the scenario is pending ("needs move 'fsmash'") or missed. */
  reason?: string;
}

export interface ScenarioResult extends ScenarioPlan {
  name: string;
  /** The frame the game is showing now. */
  frame: number;
  fighters: FighterSummary[];
  hash: string;
}

const DEFAULT_LIMIT = 600;

const P1 = (s: MatchState) => s.fighters[0]!;
const P2 = (s: MatchState) => s.fighters[1]!;

/** P1 at -12 facing right, P2 at +6 facing left: inside forward smash range. */
const faceOff = (p2: FighterPatch = {}): GameScenario['patches'] => [
  { port: 0, state: { pos: { x: -12, y: 0 }, facing: 1 } },
  { port: 1, state: { pos: { x: 6, y: 0 }, facing: -1, ...p2 } },
];

/** C-stick forward: a forward smash in Ultimate's default controls. */
const FSMASH: ScriptStep[] = [{ port: 0, from: 10, to: 12, cx: 100 }];

export const SCENARIOS: Scenario[] = [
  {
    name: 'idle',
    description: 'Two fighters standing at their Battlefield spawns, 0%, one second in.',
    page: { kind: 'game' },
    capture: { frame: 60 },
  },
  {
    name: 'run',
    description: 'P1 holds right from idle: dash, then mid-run (12 frames into the run).',
    page: { kind: 'game' },
    script: [{ port: 0, from: 10, to: 90, x: 100 }],
    capture: {
      label: "P1 action 'run', frame 12",
      when: (s) => P1(s).action === 'run' && P1(s).actionFrame === 12,
    },
    motion: { before: 30, after: 20 },
  },
  {
    name: 'jump-apex',
    description:
      'P1 full hop (jump held through jump squat); capture the frame vertical speed turns downward.',
    page: { kind: 'game' },
    script: [{ port: 0, from: 10, to: 22, buttons: ['jump'] }],
    capture: {
      label: 'P1 airborne, vel.y turns <= 0 after rising',
      when: (s, prev) => P1(s).ground === null && P1(prev).vel.y > 0 && P1(s).vel.y <= 0,
    },
    motion: { before: 32, after: 36 },
  },
  {
    name: 'attack-active',
    description:
      'P1 forward smash (C-stick) into P2 at 0%; capture the first active frame (Fireboy fsmash 15-17).',
    page: { kind: 'game' },
    patches: faceOff(),
    script: FSMASH,
    capture: {
      label: "P1 move 'fsmash', action frame >= 15",
      when: (s) => P1(s).move === 'fsmash' && P1(s).actionFrame >= 15,
    },
    motion: { before: 20, after: 25 },
    requires: ['move:fsmash'],
  },
  {
    name: 'launch-high-percent',
    description:
      'P2 at 150% takes P1 forward smash; capture the first frame of the tumble launch, while P2 is still on ' +
      "camera (Ultimate's balloon speed-up carries P2 past the blast zone by frame 8).",
    page: { kind: 'game' },
    patches: faceOff({ damage: 150 }),
    script: FSMASH,
    capture: {
      label: "P2 action 'tumble', frame >= 1",
      when: (s) => P2(s).action === 'tumble' && P2(s).actionFrame >= 1,
    },
    motion: { before: 40, after: 30 },
    requires: ['move:fsmash', 'action:tumble'],
  },
  {
    name: 'shield',
    description: 'P1 holds shield for 30 frames (bubble shrinking with shield health).',
    page: { kind: 'game' },
    script: [{ port: 0, from: 10, to: 90, buttons: ['shield'] }],
    capture: { frame: 40 },
  },
  {
    name: 'ledge-hang',
    description: 'P1 drops in beside the left ledge, grabs it and hangs; capture 10 frames into the hang.',
    page: { kind: 'game' },
    patches: [
      {
        port: 0,
        state: {
          pos: { x: -86, y: 6 },
          vel: { x: 0, y: 0 },
          ground: null,
          action: 'fall',
          facing: 1,
          jumpsUsed: 1,
        },
      },
    ],
    capture: {
      label: "P1 action 'ledgeHang', frame >= 10",
      when: (s) => P1(s).action === 'ledgeHang' && P1(s).actionFrame >= 10,
    },
    motion: { before: 30, after: 20 },
  },
  {
    name: 'hud',
    description: 'In-match HUD with P1 at 37% and P2 at 120% on 2 stocks (damage colour shift).',
    page: { kind: 'game' },
    patches: [
      { port: 0, state: { damage: 37 } },
      { port: 1, state: { damage: 120, stocks: 2 } },
    ],
    capture: { frame: 60 },
    requires: ['hud'],
  },
  {
    name: 'hud-hit',
    description:
      "P2 at 48% takes P1's forward smash; capture the frame P2's damage goes up, when the HUD number pops and flashes.",
    page: { kind: 'game' },
    patches: faceOff({ damage: 48 }),
    script: FSMASH,
    capture: {
      label: "P2's damage rises",
      when: (s, prev) => P2(s).damage > P2(prev).damage,
    },
    motion: { before: 10, after: 30 },
    requires: ['hud', 'move:fsmash'],
  },
  {
    name: 'title',
    description: 'Title screen: the Coolmath Smash logo on the Coolmath planet, "Press Start".',
    page: { kind: 'lab', scene: 'menu', params: { screen: 'title' } },
  },
  {
    name: 'main-menu',
    description:
      'Main menu: the big Smash tile focused, Controls and Options beside it, description bar below.',
    page: { kind: 'lab', scene: 'menu', params: { screen: 'main' } },
  },
  {
    name: 'css-2p',
    description:
      'Character select, 1v1: P1 (keyboard) has picked Fireboy, a level 9 CPU on Random; Ready to fight shows.',
    page: { kind: 'lab', scene: 'menu', params: { screen: 'css', preset: '2p' } },
  },
  {
    name: 'css-4p',
    description:
      'Character select, four panels: P1 picked, P2 on a gamepad still choosing, two CPUs (Lv 5, Lv 9).',
    page: { kind: 'lab', scene: 'menu', params: { screen: 'css', preset: '4p' } },
  },
  {
    name: 'controls',
    description:
      'Controls, Keyboard 1 tab: every action with its keys, Up selected and lit on the keyboard picture beside the list.',
    page: { kind: 'lab', scene: 'menu', params: { screen: 'controls', preset: 'keyboard1' } },
  },
  {
    name: 'controls-gamepad',
    description:
      'Controls, Gamepad tab: the shared pad mapping, with each button tagged on the controller picture.',
    page: { kind: 'lab', scene: 'menu', params: { screen: 'controls', preset: 'gamepad' } },
  },
  {
    name: 'options',
    description: 'Options: volume sliders, mute, tap jump, fullscreen and reset; Master volume selected.',
    page: { kind: 'lab', scene: 'menu', params: { screen: 'options' } },
  },
  {
    name: 'stage',
    description: 'Coolmath Battlefield on its own at the reference camera (centre 0,20, zoom 4.5).',
    page: { kind: 'lab', scene: 'stage' },
    calls: [{ fn: 'camera', args: [0, 20, 4.5] }],
  },
  {
    name: 'fighter-sheet',
    description: "Fireboy's rig: every clip's key poses on one sheet.",
    page: { kind: 'lab', scene: 'fighter', params: { fighter: 'fireboy' } },
    calls: [{ fn: 'sheet' }],
  },
];

export function findScenario(name: string, list: readonly Scenario[] = SCENARIOS): Scenario {
  const s = list.find((x) => x.name === name);
  if (!s) throw new Error(`unknown scenario "${name}" (have: ${list.map((x) => x.name).join(', ')})`);
  return s;
}

export const isLabScenario = (s: Scenario | ScenarioInfo): s is LabScenario => s.page.kind === 'lab';

export function scenarioInfo(s: Scenario): ScenarioInfo {
  if (isLabScenario(s)) return s;
  const { capture, ...rest } = s;
  return {
    ...rest,
    capture:
      'frame' in capture
        ? { frame: capture.frame }
        : { label: capture.label, from: capture.from ?? 1, limit: capture.limit ?? DEFAULT_LIMIT },
  };
}

export function scenarioConfig(s: GameScenario): MatchConfig {
  return { ...DEFAULT_MATCH, ...s.match };
}

const isVec = (v: unknown): v is Record<string, number> => typeof v === 'object' && v !== null;

/** Merge `patch` into `f`. Moving a fighter also moves `prevPos`, so nothing interpolates across the jump. */
export function applyPatch(f: FighterState, patch: FighterPatch): void {
  const target = f as unknown as Record<string, unknown>;
  for (const [key, value] of Object.entries(patch)) {
    const cur = target[key];
    target[key] = isVec(cur) && isVec(value) ? { ...cur, ...value } : structuredClone(value);
  }
  if (patch.pos && !patch.prevPos) f.prevPos = { ...f.pos };
}

/** Apply the scenario's setup to a freshly created match. */
export function startScenario(state: MatchState, s: GameScenario): void {
  for (const p of s.patches ?? []) {
    const f = state.fighters[p.port];
    if (!f) throw new Error(`scenario ${s.name}: no fighter on port ${p.port}`);
    applyPatch(f, p.state);
  }
}

export function scenarioInputs(s: GameScenario, state: MatchState) {
  return inputsAt(s.script ?? [], state.frame, state.players.length);
}

/**
 * Dry-run a scenario on a bare simulation (no renderer) to find its capture frame, or why it cannot be
 * captured yet. `host(req)` answers requirements the simulation cannot, such as `hud`.
 */
export function planScenario(s: GameScenario, host: (req: string) => boolean = () => false): ScenarioPlan {
  const m = createMatch(scenarioConfig(s));
  startScenario(m, s);
  const rule = s.capture;
  const from = 'frame' in rule ? rule.frame : (rule.from ?? 1);
  const limit = 'frame' in rule ? rule.frame : (rule.limit ?? DEFAULT_LIMIT);
  const moves = new Set<string>();
  let captureFrame: number | undefined;
  while (m.frame < limit && captureFrame === undefined) {
    const prev = structuredClone(m);
    stepMatch(m, scenarioInputs(s, m));
    for (const f of m.fighters) if (f.move) moves.add(f.move);
    if (m.frame < from) continue;
    if ('frame' in rule ? m.frame === rule.frame : rule.when(m, prev)) captureFrame = m.frame;
  }
  const missing = (s.requires ?? []).filter((req) => {
    const [kind, name = ''] = req.split(':');
    if (kind === 'action') return !(name in ACTIONS);
    if (kind === 'move') return !moves.has(name);
    return !host(req);
  });
  if (missing.length > 0)
    return { status: 'pending', reason: `needs ${missing.map(describeRequirement).join(', ')}` };
  if (captureFrame === undefined) {
    const label = 'frame' in rule ? `frame ${rule.frame}` : rule.label;
    const actions = m.fighters.map((f) => `P${f.port + 1} ${f.action}`).join(', ');
    return { status: 'missed', reason: `"${label}" not reached by frame ${limit} (ended with ${actions})` };
  }
  return { status: 'captured', captureFrame };
}

function describeRequirement(req: string): string {
  const [kind, name] = req.split(':');
  if (kind === 'move') return `move '${name}' (no fighter performed it)`;
  if (kind === 'action') return `action '${name}'`;
  return req === 'hud' ? 'the in-match HUD' : req;
}

const round = (v: number) => Math.round(v * 100) / 100;

export function summarize(state: MatchState): FighterSummary[] {
  return state.fighters.map((f) => ({
    port: f.port,
    fighter: f.fighter,
    action: f.action,
    actionFrame: f.actionFrame,
    move: f.move,
    pos: { x: round(f.pos.x), y: round(f.pos.y) },
    vel: { x: round(f.vel.x), y: round(f.vel.y) },
    kb: { x: round(f.kb.x), y: round(f.kb.y) },
    facing: f.facing,
    grounded: f.ground !== null,
    damage: round(f.damage),
    stocks: f.stocks,
    shieldHp: round(f.shieldHp),
    ledge: f.ledge,
    hitstun: f.hitstun,
  }));
}
