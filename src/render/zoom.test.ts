import { describe, expect, it } from 'vitest';
import { VIEW_WIDTH } from '../config';
import { hashState } from '../engine/hash';
import {
  findScenario,
  scenarioConfig,
  scenarioInputs,
  startScenario,
  type GameScenario,
} from '../harness/scenarios';
import { inputsAt, type ScriptStep } from '../harness/script';
import type { HitboxDef } from '../fighters/types';
import { hitlagFrames } from '../sim/combat/formulas';
import { applyHit } from '../sim/combat/hits';
import type { SimEvent } from '../sim/events';
import { createMatch, DEFAULT_MATCH, stepMatch, type MatchState } from '../sim/match';
import { getStage } from '../stages/registry';
import { Camera } from './camera';
import { easeOut } from './vfx/shapes';
import {
  SPECIAL_ZOOM_KB,
  stepZoom,
  zoomFrom,
  Zoom,
  ZOOM,
  ZOOM_FLASH,
  zoomFlashShapes,
  zoomFocus,
  zoomWeight,
  type SpecialZoom,
  type ZoomState,
} from './zoom';

type Hit = Extract<SimEvent, { type: 'hit' }>;

interface Frame {
  frame: number;
  zoom: SpecialZoom | null;
  hit?: Hit;
  victim: { x: number; y: number };
  ko: boolean;
}

/** Run `m` for `frames` frames with `inputs`, stepping a Zoom after each like Renderer.stepCamera. */
function play(m: MatchState, inputs: (m: MatchState) => ReturnType<typeof inputsAt>, frames = 120): Frame[] {
  const zoom = new Zoom();
  const out: Frame[] = [];
  for (let i = 0; i < frames; i++) {
    stepMatch(m, inputs(m));
    zoom.step(m);
    const v = m.fighters[1]!;
    out.push({
      frame: m.frame,
      zoom: zoom.at(m),
      hit: m.events.find((e): e is Hit => e.type === 'hit'),
      victim: { ...v.pos },
      ko: m.events.some((e) => e.type === 'ko'),
    });
  }
  return out;
}

/** A capture scenario (scenarios.ts): Fireboy's forward smash from the face-off. */
function scenario(name: string): Frame[] {
  const s = findScenario(name) as GameScenario;
  const m = createMatch(scenarioConfig(s));
  startScenario(m, s);
  return play(m, (state) => scenarioInputs(s, state));
}

/** The same forward smash on P2 at `percent` with `players` Fireboys in the match (the rest stand far left). */
function smash(percent: number, players: number): Frame[] {
  const m = createMatch({
    ...DEFAULT_MATCH,
    ports: Array.from({ length: players }, () => ({ fighter: 'fireboy' })),
  });
  const place = [-12, 6, -60, -70];
  m.fighters.forEach((f, i) => {
    f.pos = { x: place[i]!, y: 0 };
    f.prevPos = { ...f.pos };
    f.facing = i === 1 ? -1 : 1;
  });
  m.fighters[1]!.damage = percent;
  const steps: ScriptStep[] = [{ port: 0, from: 10, to: 12, cx: 100 }];
  return play(m, (state) => inputsAt(steps, state.frame, players));
}

const firstHit = (frames: Frame[]) => frames.find((f) => f.hit)!;

/** A bare hitbox: knockback is `bkb` exactly (no growth), the freeze Ultimate's for `damage` (x1.05 fresh). */
const box = (damage: number, bkb: number, angle = 45): HitboxDef => ({
  id: 9,
  x: 0,
  y: 0,
  radius: 0,
  hitlag: 1,
  damage,
  angle,
  kbg: 0,
  bkb,
});

/**
 * Land `b` from the fighter on `from` on the one on `to` through the sim's own hit path, after a frame's step and
 * before the zoom steps it, as if it had connected during that frame (a projectile arriving mid-freeze).
 */
function hitNow(m: MatchState, from: number, to: number, b: HitboxDef): void {
  const a = m.fighters[from]!;
  a.move ??= 'fsmash';
  applyHit(m, a, m.fighters[to]!, b);
}

describe('which hits zoom', () => {
  it('a forward smash that will KO starts a Finish Zoom on the contact point, and the victim is KOd', () => {
    const frames = scenario('finish-zoom');
    const { hit, zoom, frame } = firstHit(frames);
    expect(zoom).toMatchObject({ kind: 'finish', frame, x: hit!.x, y: hit!.y, victim: 1 });
    expect(zoom!.ko).toMatchObject({ side: 'right' });
    expect(frames.some((f) => f.ko)).toBe(true);
  });

  it('a strong hit that does not KO starts a Special Zoom, and the victim survives', () => {
    const frames = scenario('special-zoom');
    const { hit, zoom } = firstHit(frames);
    expect(hit!.kb).toBeGreaterThanOrEqual(SPECIAL_ZOOM_KB);
    expect(zoom).toMatchObject({ kind: 'special', ko: null });
    expect(frames.some((f) => f.ko)).toBe(false);
  });

  it('a weak hit, or a forward smash below SPECIAL_ZOOM_KB, starts none', () => {
    const jab = scenario('hit-spark-weak');
    expect(firstHit(jab).hit).toBeDefined();
    expect(jab.every((f) => f.zoom === null)).toBe(true);
    const light = smash(20, 2);
    expect(firstHit(light).hit!.kb).toBeLessThan(SPECIAL_ZOOM_KB);
    expect(light.every((f) => f.zoom === null)).toBe(true);
  });

  it('only in 1v1: the same KO forward smash zooms with 2 players, never with 3 or 4', () => {
    expect(firstHit(smash(150, 2)).zoom?.kind).toBe('finish');
    for (const players of [3, 4]) {
      const frames = smash(150, players);
      expect(firstHit(frames).hit!.victim).toBe(1);
      expect(frames.some((f) => f.ko)).toBe(true);
      expect(frames.every((f) => f.zoom === null)).toBe(true);
    }
  });

  it('a Finish Zoom on the other fighter takes over a running Special Zoom, but not the other way round', () => {
    const s = findScenario('special-zoom') as GameScenario;
    const m = createMatch(scenarioConfig(s));
    startScenario(m, s);
    const state: ZoomState = { frame: -1, zoom: null };
    while (!m.events.some((e) => e.type === 'hit')) {
      stepMatch(m, scenarioInputs(s, m));
      stepZoom(state, m);
    }
    expect(state.zoom).toMatchObject({ kind: 'special', victim: 1 });
    stepMatch(m, scenarioInputs(s, m));
    hitNow(m, 1, 0, box(1, 300));
    stepZoom(state, m);
    expect(state.zoom).toMatchObject({ kind: 'finish', victim: 0, frame: m.frame });
    const { frame } = state.zoom!;
    stepMatch(m, scenarioInputs(s, m));
    hitNow(m, 0, 1, box(1, 155, 80));
    expect(zoomFrom(m)).toMatchObject({ kind: 'special', victim: 1 });
    stepZoom(state, m);
    expect(state.zoom).toMatchObject({ kind: 'finish', victim: 0, frame });
  });
});

/**
 * The finish-zoom scenario with `tweak` applied `after` frames into P2's freeze (see hitNow). Returns the hit frame,
 * the frame P2 actually launches (first moves), and the zoom drawn on each frame.
 */
function followUp(after: number, tweak: (m: MatchState) => void) {
  const s = findScenario('finish-zoom') as GameScenario;
  const m = createMatch(scenarioConfig(s));
  startScenario(m, s);
  const zoom = new Zoom();
  const zooms = new Map<number, SpecialZoom | null>();
  let hit = -1;
  let launch = -1;
  let frozen = { x: 0, y: 0 };
  for (let i = 0; i < 150 && launch < 0; i++) {
    stepMatch(m, scenarioInputs(s, m));
    const v = m.fighters[1]!;
    if (hit < 0 && m.events.some((e) => e.type === 'hit')) {
      hit = m.frame;
      frozen = { ...v.pos };
    }
    if (hit >= 0 && m.frame === hit + after) tweak(m);
    zoom.step(m);
    zooms.set(m.frame, zoom.at(m));
    if (hit >= 0 && (v.pos.x !== frozen.x || v.pos.y !== frozen.y)) launch = m.frame;
  }
  const first = zooms.get(hit)!;
  /** The zoom runs on every frame from the hit until the victim moves, and not on that frame. */
  const holdsToLaunch = () => {
    for (let f = hit; f < launch; f++) expect(zooms.get(f), `frame ${f}`).not.toBeNull();
    expect(zooms.get(launch)).toBeNull();
  };
  return { hit, launch, zooms, first, holdsToLaunch };
}

describe('a follow-up during the freeze: the zoom ends on the frame the victim actually launches', () => {
  const lag = (damage: number) => hitlagFrames(damage * 1.05);

  it('with none, after the forward smash hitlag of 18', () => {
    const r = followUp(5, () => {});
    expect(r.launch).toBe(r.hit + 18 + 1);
    r.holdsToLaunch();
  });

  it('a hit with a shorter freeze ends it early, keeping its start and contact point', () => {
    const r = followUp(5, (m) => hitNow(m, 0, 1, box(1, 300)));
    expect(lag(1)).toBeLessThan(18 - 5);
    expect(r.launch).toBe(r.hit + 5 + lag(1) + 1);
    r.holdsToLaunch();
    expect(r.zooms.get(r.launch - 1)).toMatchObject({
      kind: 'finish',
      frame: r.hit,
      until: r.launch - 1,
      x: r.first.x,
      y: r.first.y,
    });
  });

  it('a hit with a longer freeze holds it to the later launch', () => {
    const r = followUp(5, (m) => hitNow(m, 0, 1, box(30, 300)));
    expect(lag(30)).toBeGreaterThan(18 - 5);
    expect(r.launch).toBe(r.hit + 5 + lag(30) + 1);
    r.holdsToLaunch();
  });

  it('a freeze lengthened without a hit (an entity contact owing hitlag) holds it too', () => {
    const r = followUp(5, (m) => void (m.fighters[1]!.hitlag += 7));
    expect(r.launch).toBe(r.hit + 18 + 7 + 1);
    r.holdsToLaunch();
  });

  it('a weak hit that replaces the KO launch ends it on that frame', () => {
    const r = followUp(5, (m) => hitNow(m, 0, 1, box(1, 10)));
    expect(r.zooms.get(r.hit + 4)).toMatchObject({ kind: 'finish' });
    for (let f = r.hit + 5; f <= r.launch; f++) expect(r.zooms.get(f)).toBeNull();
  });
});

describe('zoom timing', () => {
  const frames = scenario('finish-zoom');
  const hit = firstHit(frames);
  const z = hit.zoom!;
  const at = (frame: number) => frames.find((f) => f.frame === frame)!;

  it("lasts the victim's hitlag: Ultimate's floor(damage * 0.65 + 6), 18 frames for an 18.9% forward smash", () => {
    expect(hit.hit!.hitlag).toBe(hitlagFrames(18 * 1.05));
    expect(z.until - z.frame).toBe(18);
  });

  it('holds exactly while the sim holds the victim still, and cuts back on the launch frame', () => {
    for (let f = z.frame; f <= z.until; f++) {
      expect(at(f).victim).toEqual(hit.victim);
      expect(at(f).zoom).toBe(z);
    }
    expect(at(z.until + 1).victim.x).toBeGreaterThan(hit.victim.x);
    expect(at(z.until + 1).zoom).toBeNull();
    expect(zoomFocus(z, z.until + 1)).toBeNull();
    expect(at(z.frame - 1).zoom).toBeNull();
  });

  it(`pushes in over ${ZOOM.in} frames from the hit and holds to the launch`, () => {
    expect(zoomWeight(z, z.frame - 1)).toBe(0);
    for (let i = 0; i < ZOOM.in; i++) expect(zoomWeight(z, z.frame + i)).toBe(easeOut((i + 1) / ZOOM.in));
    for (let f = z.frame + ZOOM.in - 1; f <= z.until; f++) expect(zoomWeight(z, f)).toBe(1);
    expect(zoomWeight(z, z.until + 1)).toBe(0);
  });

  it('centres the drawn view on the contact point at twice the closest camera zoom', () => {
    const m = createMatch(DEFAULT_MATCH);
    const stage = getStage(m.config.stage);
    const camera = new Camera();
    camera.step(m, stage);
    const plain = camera.viewFor(m, stage);
    expect(camera.viewFor(m, stage, { ...zoomFocus(z, z.frame + 1)!, weight: 0 })).toEqual(plain);
    const full = camera.viewFor(m, stage, zoomFocus(z, z.frame + ZOOM.in));
    expect(full.x).toBeCloseTo(z.x, 9);
    expect(full.y).toBeCloseTo(z.y, 9);
    expect(full.zoom).toBeCloseTo(VIEW_WIDTH / ZOOM.width, 9);
    expect(ZOOM.width).toBe(120);
  });
});

describe('the flash', () => {
  const view = { x: 0, y: 30, zoom: VIEW_WIDTH / ZOOM.width };
  const finish = firstHit(scenario('finish-zoom')).zoom!;
  const special = firstHit(scenario('special-zoom')).zoom!;

  it('tints the stage red for a Finish Zoom and blue for a Special Zoom, streaks pointing at the impact', () => {
    const red = zoomFlashShapes(finish, finish.frame, view);
    expect(red[0]!.fill).toEqual({ color: ZOOM_FLASH.finish.base, alpha: 0.78 });
    expect(zoomFlashShapes(special, special.frame, view)[0]!.fill?.color).toBe(ZOOM_FLASH.special.base);
    expect(red.length).toBe(29);
    expect(zoomFlashShapes(finish, finish.frame, view, true).length).toBe(15);
  });

  it('lasts from the hit through the freeze and draws nothing on either side', () => {
    expect(zoomFlashShapes(finish, finish.until, view)[0]!.fill!.alpha).toBe(0.78);
    expect(zoomFlashShapes(finish, finish.until + 1, view)).toEqual([]);
    expect(zoomFlashShapes(finish, finish.frame - 1, view)).toEqual([]);
  });

  it('draws the same streaks for a frame every time, and re-deals them every 2 frames', () => {
    const a = zoomFlashShapes(finish, finish.frame + 2, view);
    expect(zoomFlashShapes(finish, finish.frame + 2, view)).toEqual(a);
    expect(zoomFlashShapes(finish, finish.frame + 3, view)).toEqual(a);
    expect(zoomFlashShapes(finish, finish.frame + 4, view)).not.toEqual(a);
  });
});

describe('determinism', () => {
  it('a frame gets the same zoom however it was reached, and a skipped frame starts over', () => {
    const s = findScenario('finish-zoom') as GameScenario;
    const m = createMatch(scenarioConfig(s));
    startScenario(m, s);
    const a = new Zoom();
    const z = firstHit(scenario('finish-zoom')).zoom!;
    while (m.frame < z.frame + 5) {
      stepMatch(m, scenarioInputs(s, m));
      a.step(m);
    }
    expect(a.at(m)).toEqual(z);
    const b = new Zoom();
    b.step(m);
    expect(b.at(m)).toBeNull();
    expect(a.at({ ...m, frame: m.frame + 1 })).toBeNull();
  });

  it('never touches the sim: the same inputs hash the same with and without the zoom stepping', () => {
    const s = findScenario('finish-zoom') as GameScenario;
    const plain = createMatch(scenarioConfig(s));
    const zoomed = createMatch(scenarioConfig(s));
    startScenario(plain, s);
    startScenario(zoomed, s);
    const zoom = new Zoom();
    let zoomedFrames = 0;
    for (let i = 0; i < 90; i++) {
      stepMatch(plain, scenarioInputs(s, plain));
      stepMatch(zoomed, scenarioInputs(s, zoomed));
      zoom.step(zoomed);
      if (zoom.at(zoomed)) zoomedFrames++;
      expect(hashState(zoomed)).toBe(hashState(plain));
    }
    expect(zoomedFrames).toBe(18 + 1);
  });
});
