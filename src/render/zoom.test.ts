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
import { hitlagFrames } from '../sim/combat/formulas';
import type { SimEvent } from '../sim/events';
import { createMatch, DEFAULT_MATCH, stepMatch, type MatchState } from '../sim/match';
import { getStage } from '../stages/registry';
import { Camera } from './camera';
import { easeOut } from './vfx/shapes';
import {
  flashLevel,
  SPECIAL_ZOOM_KB,
  stepZoom,
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

  it('a Finish Zoom takes over a running Special Zoom, but not the other way round', () => {
    const at = (name: string) => {
      const s = findScenario(name) as GameScenario;
      const m = createMatch(scenarioConfig(s));
      startScenario(m, s);
      while (!m.events.some((e) => e.type === 'hit')) stepMatch(m, scenarioInputs(s, m));
      return m;
    };
    const special = at('special-zoom');
    const finish = at('finish-zoom');
    const s: ZoomState = { frame: -1, zoom: null };
    stepZoom(s, special);
    stepZoom(s, { ...finish, frame: special.frame + 1 });
    expect(s.zoom).toMatchObject({ kind: 'finish', frame: special.frame + 1 });
    stepZoom(s, { ...special, frame: special.frame + 2 });
    expect(s.zoom).toMatchObject({ kind: 'finish', frame: special.frame + 1 });
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

  it('holds while the sim holds the victim still and lets go on the launch frame', () => {
    for (let f = z.frame; f <= z.until; f++) {
      expect(at(f).victim).toEqual(hit.victim);
      expect(at(f).zoom).toBe(z);
      expect(flashLevel(z, f)).toBe(1);
    }
    expect(at(z.until + 1).victim.x).toBeGreaterThan(hit.victim.x);
  });

  it(`pushes in over ${ZOOM.in} frames from the hit and pulls out over ${ZOOM.out} from the launch`, () => {
    expect(zoomWeight(z, z.frame - 1)).toBe(0);
    for (let i = 0; i < ZOOM.in; i++) expect(zoomWeight(z, z.frame + i)).toBe(easeOut((i + 1) / ZOOM.in));
    expect(zoomWeight(z, z.until)).toBe(1);
    for (let i = 1; i <= ZOOM.out; i++) {
      expect(zoomWeight(z, z.until + i)).toBe(1 - easeOut(i / ZOOM.out));
      expect(at(z.until + i).zoom).toBe(i < ZOOM.out ? z : null);
    }
    expect(zoomFocus(z, z.until + ZOOM.out)).toBeNull();
    expect(at(z.frame - 1).zoom).toBeNull();
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

  it('fades out with the zoom and draws nothing after', () => {
    const fading = zoomFlashShapes(finish, finish.until + 2, view)[0]!.fill!.alpha!;
    expect(fading).toBeGreaterThan(0);
    expect(fading).toBeLessThan(0.78);
    expect(zoomFlashShapes(finish, finish.until + ZOOM.out, view)).toEqual([]);
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
    expect(zoomedFrames).toBe(18 + ZOOM.out);
  });
});
