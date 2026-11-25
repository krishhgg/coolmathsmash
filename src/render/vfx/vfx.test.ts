import { describe, expect, it } from 'vitest';
import { getFighter } from '../../fighters/registry';
import {
  findScenario,
  scenarioConfig,
  scenarioInputs,
  startScenario,
  type GameScenario,
} from '../../harness/scenarios';
import type { SimEvent } from '../../sim/events';
import { DEFAULT_MATCH, createMatch, stepMatch, type MatchState } from '../../sim/match';
import { ATTACKER_JITTER, hitlagOffset, SHIELD_JITTER, VICTIM_JITTER } from './hitlag';
import { hitPower, hitSparkShapes, spawnHitSpark, type HitSpark } from './hitSpark';
import { KO_LIFE, koAnchor, koBlastShapes } from './koBlast';
import { rand, seedOf } from './random';
import { SHIELD_HIT_LIFE, shieldBubbleShapes } from './shield';
import { puffShapes, TRAIL_CUT, trailPuffs } from './smoke';
import { emptyVfx, fighterFx, freezeOf, shieldPulse, stepVfx, Vfx, type VfxState } from './system';

const scenario = (name: string) => findScenario(name) as GameScenario;

/** Simulate `name` for `frames` frames, stepping the effects after every frame like Game.step does. */
function play(
  name: string,
  frames: number,
  vfx: Vfx = new Vfx(),
): { m: MatchState; vfx: Vfx; log: VfxState[] } {
  const s = scenario(name);
  const m = createMatch(scenarioConfig(s));
  startScenario(m, s);
  const log: VfxState[] = [];
  for (let i = 0; i < frames; i++) {
    stepMatch(m, scenarioInputs(s, m));
    vfx.step(m);
    log.push(structuredClone(vfx.state));
  }
  return { m, vfx, log };
}

const hit = { x: 0, y: 8, effect: 'normal' as const };
const spark = (e: Parameters<typeof spawnHitSpark>[0], frame: number, lean: number): HitSpark =>
  spawnHitSpark(e, frame, lean, seedOf(frame, 1, 1));

/** Step fresh effects over one frame of the default match carrying exactly `events`. */
function stepEvents(events: SimEvent[]): { m: MatchState; v: VfxState } {
  const m = createMatch(DEFAULT_MATCH);
  m.frame = 100;
  m.events = events;
  const v = emptyVfx();
  stepVfx(v, m);
  return { m, v };
}

describe('effect seeds', () => {
  it('are fixed integer hashes of the spawn record', () => {
    expect(seedOf(25, 1, 2)).toBe(seedOf(25, 1, 2));
    expect(seedOf(25, 1, 2)).not.toBe(seedOf(26, 1, 2));
    expect(seedOf(25, 1, 2)).not.toBe(seedOf(25, 0, 2));
    const values = Array.from({ length: 1000 }, (_, i) => rand(seedOf(7, 0), i));
    expect(Math.min(...values)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...values)).toBeLessThan(1);
    expect(values.reduce((a, b) => a + b) / values.length).toBeCloseTo(0.5, 1);
  });
});

describe('hit sparks', () => {
  it('grow (to under 0.9x fighter height across), last longer and add layers, streaks and debris with knockback', () => {
    const weak = spark({ ...hit, kb: 35, damage: 3.8 }, 10, 1);
    const strong = spark({ ...hit, kb: 311, damage: 22 }, 10, 1);
    expect(hitPower(35, 3.8)).toBeLessThan(0.15);
    expect(strong.power).toBe(1);
    expect(strong.size).toBeGreaterThan(weak.size * 1.8);
    expect(strong.size * 2).toBeLessThan(getFighter('fireboy').stats.height * 0.9);
    expect(strong.life).toBeGreaterThan(weak.life + 10);
    const at = (s: typeof weak, age: number) => hitSparkShapes(s, s.frame + age);
    expect(at(strong, 3).length).toBeGreaterThan(at(weak, 3).length * 2);
  });

  it('use the flame variant for fire hits', () => {
    const fire = spark({ ...hit, kb: 171, damage: 22, effect: 'fire' }, 10, 1);
    expect(fire.style).toBe('fire');
    const colors = new Set(hitSparkShapes(fire, 13).map((s) => s.fill?.color));
    expect(colors).toContain(0xe5321b);
  });

  it('draw nothing before they spawn or once their life is over', () => {
    const s = spark({ ...hit, kb: 120, damage: 12 }, 10, -1);
    expect(hitSparkShapes(s, 9)).toEqual([]);
    expect(hitSparkShapes(s, 10).length).toBeGreaterThan(0);
    expect(hitSparkShapes(s, 10 + s.life - 1).length).toBeGreaterThan(0);
    expect(hitSparkShapes(s, 10 + s.life)).toEqual([]);
  });
});

describe('stepping effects from the simulation', () => {
  it('spawns a spark and freezes both fighters on a hit, then drops them after their lifetimes', () => {
    const { log } = play('hit-spark', 80);
    const hitFrame = log.findIndex((v) => v.sparks.length > 0) + 1;
    expect(hitFrame).toBe(25);
    const v = log[hitFrame - 1]!;
    expect(v.sparks).toHaveLength(1);
    expect(v.sparks[0]).toMatchObject({ frame: 25, x: 0, y: 8.5, style: 'fire' });
    expect(v.freezes).toEqual([
      expect.objectContaining({ port: 1, lag: 18, amplitude: VICTIM_JITTER }),
      expect.objectContaining({ port: 0, lag: 18, amplitude: ATTACKER_JITTER }),
    ]);
    const life = v.sparks[0]!.life;
    expect(log[hitFrame - 1 + life - 1]!.sparks).toHaveLength(1);
    expect(log[hitFrame - 1 + life]!.sparks).toHaveLength(0);
    expect(log[hitFrame - 1 + 18]!.freezes).toHaveLength(0);
  });

  it('leaves launch smoke along the whole path, denser and longer-lived the faster the launch', () => {
    const fast = play('ko-blast', 50);
    const slow = play('launch-smoke', 60);
    const first = (log: VfxState[]) => log.find((v) => v.puffs.some((p) => p.tone === 'smoke'))!;
    const fastPuffs = first(fast.log).puffs.filter((p) => p.tone === 'smoke');
    const slowPuffs = first(slow.log).puffs.filter((p) => p.tone === 'smoke');
    expect(fastPuffs.length).toBeGreaterThan(slowPuffs.length);
    expect(Math.max(...fastPuffs.map((p) => p.life))).toBeGreaterThan(
      Math.max(...slowPuffs.map((p) => p.life)),
    );
    const xs = fastPuffs.map((p) => p.x);
    expect(Math.min(...xs)).toBeLessThan(10);
    expect(Math.max(...xs)).toBeGreaterThan(45);
    const f = slow.m.fighters[1]!;
    expect(trailPuffs({ ...f, action: 'idle' }, 7.5, slow.m.frame)).toEqual([]);
  });

  it('blasts on a KO and ends within its lifetime', () => {
    const { log } = play('ko-blast', 51 + KO_LIFE + 1);
    const v = log[50]!;
    expect(v.kos).toEqual([expect.objectContaining({ frame: 51, port: 1 })]);
    expect(log[51 + KO_LIFE - 1]!.kos).toEqual([]);
  });

  it("shrinks the KO'd fighter's launch smoke away once the KO lands", () => {
    const { log } = play('ko-blast', 51 + TRAIL_CUT);
    const smoke = (v: VfxState) => v.puffs.filter((p) => p.port === 1 && p.tone === 'smoke');
    expect(smoke(log[49]!).length).toBeGreaterThan(0);
    expect(smoke(log[50]!).every((p) => p.cut === 51)).toBe(true);
    expect(smoke(log[50 + TRAIL_CUT]!)).toEqual([]);
  });

  it('shakes the shielding fighter and the attacker sideways on a shield hit', () => {
    const v = play('shield-hit', 26).log[24]!;
    expect(freezeOf(v, 0)).toMatchObject({ frame: 25, amplitude: SHIELD_JITTER, ay: 0 });
    expect(freezeOf(v, 1)).toMatchObject({ frame: 25, amplitude: SHIELD_JITTER / 2, ay: 0 });
    expect(freezeOf(v, 0)!.ax).toBe(-1);
    expect(freezeOf(v, 1)!.ax).toBe(-1);
  });

  it('flashes and shakes a fighter while it charges a smash attack', () => {
    const s = scenario('smash-charge');
    const m = createMatch(scenarioConfig(s));
    startScenario(m, s);
    const vfx = new Vfx();
    const fx: ReturnType<typeof fighterFx>[] = [];
    while (m.frame < 60) {
      stepMatch(m, scenarioInputs(s, m));
      vfx.step(m);
      if (m.frame > 45) fx.push(fighterFx(vfx.state, m.fighters[0]!, m.frame));
    }
    expect(fx.every((f) => f.flash?.color === 0xfff4b0)).toBe(true);
    expect(fx.some((f) => f.flash!.amount > 0) && fx.some((f) => f.flash!.amount === 0)).toBe(true);
    expect(fx[0]!.jitter!.x).toBeCloseTo(-fx[1]!.jitter!.x);
    expect(fighterFx(vfx.state, m.fighters[1]!, m.frame).flash).toBeUndefined();
  });

  it('flashes the shield on a shield hit and shatters it on a break', () => {
    const hitLog = play('shield-hit', 40).log;
    expect(shieldPulse(hitLog[26]!, 0)).toEqual({ age: 2, power: expect.any(Number) as number });
    expect(shieldPulse(hitLog[25 + SHIELD_HIT_LIFE]!, 0)).toBeUndefined();
    const breakLog = play('shield-break', 50).log;
    expect(breakLog[44]!.shields).toContainEqual(
      expect.objectContaining({ kind: 'break', frame: 44, port: 0 }),
    );
  });

  it('kicks up dust on jumps and landings', () => {
    const { log } = play('land-dust', 56);
    expect(log[13]!.puffs.filter((p) => p.tone === 'dust' && p.born === 14).length).toBeGreaterThan(0);
    expect(log[50]!.puffs.filter((p) => p.tone === 'dust' && p.born === 51).length).toBeGreaterThan(0);
  });
});

describe('hits that no fighter swung', () => {
  it("sparks a fireball's hit at the contact point and shakes only P2: the sim freezes neither the fireball nor P1", () => {
    const { log } = play('projectile-spark', 70);
    const at = log.findIndex((v) => v.sparks.length > 0);
    expect(at).toBeGreaterThan(0);
    const v = log[at]!;
    expect(v.sparks).toHaveLength(1);
    expect(v.sparks[0]!.style).toBe('fire');
    expect(v.freezes).toEqual([expect.objectContaining({ port: 1, amplitude: VICTIM_JITTER })]);
    expect(freezeOf(v, 0)).toBeUndefined();
  });

  it('shakes the shield sideways away from a projectile, owned or not, without freezing its owner', () => {
    const shieldHit = (attacker: number, x: number): SimEvent => ({
      type: 'shieldHit',
      attacker,
      entity: 4,
      victim: 1,
      move: null,
      damage: 6,
      shieldHp: 40,
      x,
      y: 8,
    });
    const { m, v } = stepEvents([shieldHit(-1, 20)]);
    const victim = m.fighters[1]!;
    expect(v.freezes).toEqual([expect.objectContaining({ port: 1, amplitude: SHIELD_JITTER })]);
    expect(v.freezes[0]!.ax).toBe(victim.pos.x >= 20 ? 1 : -1);
    expect(v.sparks).toEqual([expect.objectContaining({ style: 'shield' })]);
    expect(shieldPulse(v, 1)).toEqual({ age: 0, power: expect.any(Number) as number });
    const owned = stepEvents([shieldHit(0, victim.pos.x - 3)]).v;
    expect(owned.freezes.map((z) => z.port)).toEqual([1]);
    expect(owned.freezes[0]!.ax).toBe(1);
  });

  it('sparks a stage hazard hit (flames for lava) and shakes the fighter it hit', () => {
    const stageHit = (element: 'lava' | 'water' | null): SimEvent => ({
      type: 'stageHit',
      victim: 0,
      source: element ? 'zone' : 'hitbox',
      index: 2,
      element,
      damage: 12,
      kb: 90,
      x: 5,
      y: 1,
    });
    const lava = stepEvents([stageHit('lava')]).v;
    expect(lava.sparks).toEqual([expect.objectContaining({ x: 5, y: 1, style: 'fire' })]);
    expect(lava.freezes).toEqual([expect.objectContaining({ port: 0, amplitude: VICTIM_JITTER })]);
    expect(stepEvents([stageHit('water')]).v.sparks[0]!.style).toBe('normal');
    expect(stepEvents([stageHit(null)]).v.sparks[0]!.style).toBe('normal');
  });

  it('sparks a hit on a hittable entity without freezing anyone', () => {
    const { v } = stepEvents([
      { type: 'entityHit', id: 7, kind: 'x/box', attacker: 0, damage: 9, hp: 11, x: 30, y: 6 },
    ]);
    expect(v.sparks).toEqual([expect.objectContaining({ x: 30, y: 6, style: 'normal' })]);
    expect(v.freezes).toEqual([]);
  });

  it('gives sparks landing on the same frame different seeds', () => {
    const { v } = stepEvents([
      {
        ...hit,
        type: 'hit',
        attacker: 0,
        victim: 1,
        move: 'jab',
        damage: 3,
        kb: 30,
        tumble: false,
        hitlag: 6,
      },
      {
        ...hit,
        type: 'hit',
        attacker: 0,
        entity: 3,
        victim: 1,
        move: null,
        damage: 5,
        kb: 40,
        tumble: false,
        hitlag: 8,
      },
      { type: 'entityHit', id: 3, kind: 'x/box', attacker: 0, damage: 9, hp: 11, x: 30, y: 6 },
    ]);
    expect(new Set(v.sparks.map((s) => s.seed)).size).toBe(3);
  });
});

describe('lite quality', () => {
  it("drops the KO beam's wide outer cone and half its streaks and sparkles", () => {
    const ko = { frame: 0, port: 1, x: 259, y: 160, seed: 1 };
    const view = { x: 10, y: 30, zoom: 4 };
    const full = koBlastShapes(ko, 0x3d8bff, 5, view);
    const lite = koBlastShapes(ko, 0x3d8bff, 5, view, true);
    const cone = (s: (typeof full)[number]) => s.fill?.color === 0x3d8bff;
    expect(full.filter(cone)).toHaveLength(1);
    expect(lite.filter(cone)).toHaveLength(0);
    expect(lite.length).toBeLessThan(full.length * 0.7);
    expect(koBlastShapes(ko, 0x3d8bff, KO_LIFE, view, true)).toEqual([]);
  });

  it('draws launch smoke as rims and bodies only, one shape fewer per puff, in the same places', () => {
    const { log } = play('launch-smoke', 60);
    const puffs = log[59]!.puffs;
    const full = puffShapes(puffs, 60);
    const lite = puffShapes(puffs, 60, true);
    expect(full.length).toBeGreaterThan(30);
    const bodies = full.filter((s) => s.fill?.color === 0xc0c6d3 || s.fill?.color === 0xe6e0d4);
    expect(lite).toEqual(full.slice(0, lite.length));
    expect(full.length - lite.length).toBe(bodies.length);
  });
});

describe('determinism', () => {
  it('gives the same effects from the same frames, however they were stepped', () => {
    const a = play('ko-blast', 70);
    const b = play('ko-blast', 70);
    expect(b.log).toEqual(a.log);
    const reused = play('ko-blast', 70, play('shield-break', 30).vfx);
    expect(reused.log).toEqual(a.log);
    for (const frame of [26, 45, 52, 60])
      expect(puffShapes(b.log[frame - 1]!.puffs, frame)).toEqual(puffShapes(a.log[frame - 1]!.puffs, frame));
  });

  it('is a pure function of the event stream: stepVfx on cloned states matches the live system', () => {
    const s = scenario('hit-spark');
    const m = createMatch(scenarioConfig(s));
    startScenario(m, s);
    const live = new Vfx();
    const replayed = emptyVfx();
    for (let i = 0; i < 60; i++) {
      stepMatch(m, scenarioInputs(s, m));
      live.step(m);
      stepVfx(replayed, structuredClone(m));
    }
    expect(replayed).toEqual(live.state);
  });

  it('draws nothing for a frame it has not been stepped to', () => {
    const { m, vfx } = play('hit-spark', 30);
    expect(vfx.at(m)).toBe(vfx.state);
    expect(vfx.at({ ...m, frame: 31 })).toBeNull();
    expect(vfx.at(createMatch(m.config))).toBeNull();
  });
});

describe('hitlag jitter', () => {
  it('shakes victim and attacker along the knockback axis, flipping every frame and fading to 0 at launch', () => {
    const s = scenario('hit-spark');
    const m = createMatch(scenarioConfig(s));
    startScenario(m, s);
    const vfx = new Vfx();
    const rows: {
      frame: number;
      lag: number;
      victim: { x: number; y: number };
      attacker: { x: number; y: number };
    }[] = [];
    while (m.frame < 45) {
      stepMatch(m, scenarioInputs(s, m));
      vfx.step(m);
      const [a, v] = m.fighters;
      rows.push({
        frame: m.frame,
        lag: v!.hitlag,
        victim: hitlagOffset(v!, m.frame, freezeOf(vfx.state, 1)),
        attacker: hitlagOffset(a!, m.frame, freezeOf(vfx.state, 0)),
      });
    }
    const at = (frame: number) => rows.find((r) => r.frame === frame)!;
    const len = (o: { x: number; y: number }) => Math.hypot(o.x, o.y);
    expect(len(at(24).victim)).toBe(0);
    expect(len(at(25).victim)).toBeCloseTo(VICTIM_JITTER);
    expect(len(at(25).attacker)).toBeCloseTo(ATTACKER_JITTER);
    const axis = at(25).victim;
    expect(Math.atan2(Math.abs(axis.y), Math.abs(axis.x)) * (180 / Math.PI)).toBeCloseTo(38);
    expect(Math.sign(axis.x)).toBe(Math.sign(axis.y));
    for (let f = 25; f < 43; f++) {
      const r = at(f);
      expect(len(r.victim)).toBeCloseTo((VICTIM_JITTER * r.lag) / 18);
      expect(len(r.attacker)).toBeCloseTo(len(r.victim) / 2);
      expect(Math.sign(at(f + 1).victim.x || -Math.sign(r.victim.x))).toBe(-Math.sign(r.victim.x));
    }
    expect(at(43).lag).toBe(0);
    expect(len(at(43).victim)).toBe(0);
    expect(len(at(44).attacker)).toBe(0);
    expect(m.fighters[1]!.pos.x).not.toBe(6);
  });
});

describe('KO blast', () => {
  it('enters at the screen edge nearest the KO point and shoots toward the centre', () => {
    const ko = { frame: 0, port: 1, x: 259, y: 160, seed: 1 };
    const view = { x: 10, y: 30, zoom: 4 };
    const a = koAnchor(ko, view);
    expect(a.x).toBe(1280);
    expect(a.y).toBe(0);
    expect(a.ux).toBeLessThan(0);
    expect(a.uy).toBeGreaterThan(0);
    expect(koBlastShapes(ko, 0x3d8bff, 5, view).length).toBeGreaterThan(10);
    expect(koBlastShapes(ko, 0x3d8bff, KO_LIFE, view)).toEqual([]);
  });
});

describe('shield bubble', () => {
  it('keeps the bubble at the given radius and flashes white right after a hit', () => {
    const calm = shieldBubbleShapes(0, -7.5, 9, 0xff4b4b, 100);
    expect(calm[0]).toMatchObject({ type: 'ellipse', x: 0, y: -7.5 });
    expect((calm[0] as { rx: number }).rx).toBeCloseTo(9, 0);
    const flashed = shieldBubbleShapes(0, -7.5, 9, 0xff4b4b, 100, { age: 1, power: 1 });
    expect(flashed.length).toBeGreaterThan(calm.length);
    expect(flashed.some((s) => s.fill?.color === 0xffffff && (s.fill.alpha ?? 1) > 0.4)).toBe(true);
    const cracked = shieldBubbleShapes(0, -7.5, 4, 0xff4b4b, 100, undefined, true);
    expect(cracked.filter((s) => s.type === 'poly' && s.open).length).toBe(2);
  });
});
