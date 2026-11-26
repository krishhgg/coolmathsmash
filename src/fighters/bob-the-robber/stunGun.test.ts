import { describe, expect, it } from 'vitest';
import { createCpu } from '../../ai';
import { knowledge } from '../../ai/knowledge';
import { hashState } from '../../engine/hash';
import { registerFighter } from '../registry';
import { HITLAG, hitstunFrames, knockback, shieldstunFrames } from '../../sim/combat/formulas';
import type { SimEvent } from '../../sim/events';
import type { FighterState } from '../../sim/fighter';
import { createMatch, stepMatch, type MatchState } from '../../sim/match';
import { hasStatus, statusOf } from '../../sim/statuses';
import { counterTesterMarth } from '../../sim/testing/counter';
import { koPercent } from '../../sim/testing/ko';
import { marioReference } from '../../sim/testing/reference';
import { attack, input, placeInAir, run, runPorts, testMatch, type Hold } from '../../sim/testing/sim';
import { moves } from './moves';
import { entities, MUZZLE, PARALYZED, SHOTS, STUN_GUN } from './entities';
import { statuses } from './statuses';

registerFighter(counterTesterMarth);

/**
 * Zero Suit Samus's Paralyzer in Ultimate, the move Stun Gun copies: SmashWiki's Zero Suit Samus (SSBU)/Neutral
 * special (hitbox table, charge frame, shot frames), ultimateframedata.com (startup 21-43, total 48-70, 28 frames from
 * the release, shieldstun 2-3) and SmashWiki's Paralyze (floor(knockback x hitlag x crouch) + 1, at most 90).
 */
const PARALYZER = {
  charge: 20,
  chargeFrames: 22,
  uncharged: { shot: 21, faf: 49, lifetime: 24 },
  full: { shot: 43, faf: 71, lifetime: 48 },
  hit: {
    uncharged: { damage: 4, angle: 361, kbg: 100, bkb: 0, wbkb: 21, radius: 1.3 },
    full: { damage: 6, kbg: 100, bkb: 0, wbkb: 70, radius: 2.0, hitlag: 0.7 },
  },
  shieldstun: { uncharged: 2, full: 3 },
  maxParalysis: 90,
} as const;

const SPECIAL: Hold = { buttons: ['special'] };
const shots = (m: MatchState) => m.entities.filter((e) => e.kind.startsWith('bob-the-robber/stunShot'));

/** Ultimate's paralysis for a hit of knockback `kb` with hitlag multiplier `hitlag`. */
const paralysis = (kb: number, hitlag: number, crouch = false) =>
  Math.min(90, Math.floor(kb * hitlag * (crouch ? HITLAG.crouch : 1)) + 1);
/** The shots' set knockback on a target of `weight`. */
const setKb = (wbkb: number, weight = 98, crouch = false) =>
  knockback({ percent: 0, damage: 4, kbg: 100, bkb: 0, wbkb, weight, crouch });

/**
 * Bob fires holding Special for `hold` frames (1 = a tap), standing (or high in the air); returns the frame the shot
 * appears on, which shot it is and the frame the move ends (its FAF).
 */
function fire(hold: number, air = false): { shot: number; kind: string; faf: number } {
  const m = testMatch({ fighter: 'bob-the-robber' });
  const f = air ? placeInAir(m, 0, 150) : m.fighters[0]!;
  const name = air ? 'neutralBAir' : 'neutralB';
  let shot = 0;
  let kind = '';
  let frame = 0;
  do {
    frame++;
    run(m, 1, frame <= hold ? SPECIAL : {});
    if (frame === 1) expect(f.move).toBe(name);
    if (!shot && shots(m).length) {
      shot = frame;
      kind = shots(m)[0]!.kind;
    }
  } while (f.move === name && frame < 300);
  return { shot, kind, faf: frame };
}

/**
 * Bob at x = -20 facing the Mario reference (weight 98) `gap` units in front of him on Battlefield, with optional
 * extra fighters parked out of the way.
 */
function duel(gap = 30, opts: { percent?: number; extra?: string[] } = {}) {
  const m = createMatch({
    seed: 1,
    stage: 'battlefield',
    stocks: 3,
    ports: [
      { fighter: 'bob-the-robber' },
      { fighter: marioReference.id },
      ...(opts.extra ?? []).map((fighter) => ({ fighter })),
    ],
  });
  const [a, v] = m.fighters as [FighterState, FighterState];
  const place = (f: FighterState, x: number, facing: 1 | -1) =>
    Object.assign(f, { pos: { x, y: 1 }, prevPos: { x, y: 1 }, facing, intangible: 0 });
  place(a, -20, 1);
  place(v, -20 + gap, -1);
  m.fighters.slice(2).forEach((f, i) => place(f, 60 + 10 * i, -1));
  runPorts(m, 20, []);
  expect(a.action).toBe('idle');
  v.damage = opts.percent ?? 0;
  return { m, a, v };
}

/** Bob fires with Special held `hold` frames; steps until the shot lands on port 1 and returns that frame's events. */
function shoot(
  m: MatchState,
  hold: number,
  victim: (i: number) => Hold = () => ({}),
): { events: SimEvent[] } {
  for (let i = 0; i < 200; i++) {
    runPorts(m, 1, [i < hold ? SPECIAL : {}, victim(i)]);
    if (m.events.some((e) => e.type === 'hit' || e.type === 'shieldHit')) return { events: m.events };
  }
  throw new Error('the shot never landed');
}

/** Frames the victim stays frozen after the hit: the paralysis, counted from the sim. */
function frozenFor(m: MatchState, v: FighterState, victim: (i: number) => Hold = () => ({})): number {
  const at = { ...v.pos };
  let frames = 0;
  while (v.launch && frames < 200) {
    runPorts(m, 1, [{}, victim(frames)]);
    if (v.launch) {
      frames++;
      expect(v.pos).toEqual(at);
    }
  }
  return frames;
}

describe("Bob the Robber: Stun Gun (Zero Suit Samus's Paralyzer)", () => {
  it("carries the Paralyzer's frame data, hitboxes and paralysis", () => {
    for (const name of ['neutralB', 'neutralBAir'])
      expect(moves[name], name).toMatchObject({
        kind: 'other',
        faf: PARALYZER.uncharged.faf,
        charge: PARALYZER.charge,
        chargeFrames: PARALYZER.chargeFrames,
        hits: [],
      });
    expect(moves.neutralB!.air).toBe('neutralBAir');
    expect(moves.neutralB!.storeCharge).toBeUndefined();
    expect(STUN_GUN).toEqual({ charge: 20, chargeFrames: 22, shot: 21, faf: 49 });
    const status = { status: PARALYZED, id: 0, x: 0, y: 0 };
    expect(entities.stunShot).toMatchObject({ radius: 1.3, lifetime: PARALYZER.uncharged.lifetime });
    expect(entities.stunShot!.hits).toEqual([
      { frames: [1, 1], boxes: [{ ...status, ...PARALYZER.hit.uncharged, hitlag: 1 }] },
      { frames: [2, 24], boxes: [{ ...status, ...PARALYZER.hit.uncharged, hitlag: 0.7 }] },
    ]);
    expect(entities.stunShotFull).toMatchObject({ radius: 2.0, lifetime: PARALYZER.full.lifetime });
    // SmashWiki's IDs 2 (airborne targets only, 60 degrees) and 3 (grounded targets only, 315).
    expect(entities.stunShotFull!.hits).toEqual([
      {
        frames: [1, 48],
        boxes: [
          { ...status, ...PARALYZER.hit.full, angle: 60, targets: 'air' },
          { ...status, ...PARALYZER.hit.full, id: 1, angle: 315, targets: 'ground' },
        ],
      },
    ]);
    expect(statuses.paralyzed).toMatchObject({
      frames: 1,
      perKnockback: 1,
      max: PARALYZER.maxParalysis,
      freeze: true,
      endOnHit: true,
    });
    expect(statuses.paralyzed!.mash).toBeUndefined();
  });

  it('a tap fires on frame 21 and acts on 49; a full charge fires on 43 and acts on 71 (28 frames after the release)', () => {
    expect(fire(1)).toEqual({ shot: 21, kind: 'bob-the-robber/stunShot', faf: 49 });
    expect(fire(300)).toEqual({ shot: 43, kind: 'bob-the-robber/stunShotFull', faf: 71 });
    // Released part way, the charge delays the shot but it is still the uncharged one (SmashWiki's hitbox sets).
    expect(fire(30)).toEqual({ shot: 32, kind: 'bob-the-robber/stunShot', faf: 60 });
    for (const hold of [1, 30, 300]) {
      const { shot, faf } = fire(hold);
      expect(faf - shot, `hold ${hold}`).toBe(28);
    }
  });

  it('fires the same shots in the air', () => {
    expect(fire(1, true)).toEqual({ shot: 21, kind: 'bob-the-robber/stunShot', faf: 49 });
    expect(fire(300, true)).toEqual({ shot: 43, kind: 'bob-the-robber/stunShotFull', faf: 71 });
  });

  for (const [name, hold] of [
    ['stunShot', 1],
    ['stunShotFull', 300],
  ] as const) {
    const { speed, lifetime } = SHOTS[name];
    it(`${name} leaves the muzzle and flies ${speed} units a frame for ${lifetime} frames`, () => {
      const m = testMatch({ fighter: 'bob-the-robber', x: -60 });
      const f = m.fighters[0]!;
      f.facing = 1;
      for (let i = 0; i < 100 && shots(m).length === 0; i++) run(m, 1, i < hold ? SPECIAL : {});
      const shot = shots(m)[0]!;
      expect(shot).toMatchObject({ kind: `bob-the-robber/${name}`, age: 1, owner: 0, move: 'neutralB' });
      expect(shot.pos).toEqual({ x: f.pos.x + MUZZLE.x, y: f.pos.y + MUZZLE.y });
      const start = shot.pos.x;
      let frames = 1;
      while (shots(m).includes(shot)) {
        run(m, 1);
        if (shots(m).includes(shot)) frames++;
      }
      expect(frames).toBe(lifetime);
      expect(shot.pos.x - start).toBeCloseTo((lifetime - 1) * speed, 9);
    });
  }

  it('paralyzes for floor(knockback x hitlag) + 1 frames: 35 point blank, 24 later, 49 at full charge, at any %', () => {
    const uncharged = setKb(21);
    const full = setKb(70);
    expect(paralysis(uncharged, 1)).toBe(35);
    expect(paralysis(uncharged, 0.7)).toBe(24);
    expect(paralysis(full, 0.7)).toBe(49);
    for (const percent of [0, 60, 150]) {
      // Point blank: the shot appears on Mario and hits on its first frame, at x1.0 hitlag.
      let d = duel(10, { percent });
      shoot(d.m, 1);
      expect(statusOf(d.v, PARALYZED)!.frames, `${percent}% point blank`).toBe(35);
      expect(frozenFor(d.m, d.v), `${percent}% point blank`).toBe(35);
      d = duel(30, { percent });
      shoot(d.m, 1);
      expect(statusOf(d.v, PARALYZED)!.frames, `${percent}%`).toBe(24);
      expect(frozenFor(d.m, d.v), `${percent}%`).toBe(24);
      d = duel(30, { percent });
      shoot(d.m, 300);
      expect(statusOf(d.v, PARALYZED)!.frames, `${percent}% full`).toBe(49);
      expect(frozenFor(d.m, d.v), `${percent}% full`).toBe(49);
    }
  });

  it('a crouch cancel shortens it (knockback x0.85, then x0.67): 14 frames, 28 at full charge', () => {
    for (const [hold, frames, wbkb] of [
      [1, 14, 21],
      [300, 28, 70],
    ] as const) {
      const { m, v } = duel(30);
      shoot(m, hold, () => ({ y: -100 }));
      expect(statusOf(v, PARALYZED)!.frames).toBe(paralysis(setKb(wbkb, 98, true), 0.7, true));
      expect(statusOf(v, PARALYZED)!.frames).toBe(frames);
    }
  });

  it('then flinches for its set knockback: 12 frames of hitstun, 26 at full charge, never tumbling', () => {
    for (const [hold, stun] of [
      [1, 12],
      [300, 26],
    ] as const) {
      const { m, v } = duel(30);
      shoot(m, hold);
      frozenFor(m, v);
      // The launch frame: hitstun went on and counted its first frame.
      expect(v.action).toBe('hitstun');
      expect(v.hitstun).toBe(hitstunFrames(setKb(hold === 1 ? 21 : 70)));
      expect(v.hitstun).toBe(stun);
    }
  });

  it('holds an airborne fighter where it was hit, then lets it fall', () => {
    const { m, v } = duel(30);
    Object.assign(v, { pos: { x: 10, y: 7 }, prevPos: { x: 10, y: 7 }, ground: null, action: 'fall' });
    v.vel = { x: 0, y: -1.2 };
    for (let i = 0; i < 60 && !hasStatus(v, PARALYZED); i++) {
      v.pos = { x: 10, y: 7 };
      v.vel = { x: 0, y: 0 };
      runPorts(m, 1, [i === 0 ? SPECIAL : {}, {}]);
    }
    expect(hasStatus(v, PARALYZED)).toBe(true);
    expect(v.ground).toBeNull();
    const at = { ...v.pos };
    expect(frozenFor(m, v)).toBe(24);
    runPorts(m, 10, []);
    expect(v.pos).not.toEqual(at);
  });

  it('a full charge slides a grounded target along the floor at 315 degrees and sends an airborne one up at 60', () => {
    const grounded = duel(30);
    shoot(grounded.m, 300);
    expect(grounded.v.launch!.angle).toBe(315);
    frozenFor(grounded.m, grounded.v);
    expect(grounded.v.ground).not.toBeNull();
    expect(grounded.v.kb.y).toBe(0);
    expect(grounded.v.kb.x).toBeGreaterThan(0);
    const from = grounded.v.pos.x;
    for (let i = 0; i < 26; i++) {
      runPorts(grounded.m, 1, []);
      expect(grounded.v.ground, `frame ${i}`).not.toBeNull();
    }
    expect(grounded.v.pos.x).toBeGreaterThan(from + 5);

    const aloft = duel(30);
    const v = aloft.v;
    Object.assign(v, { ground: null, action: 'fall' });
    for (let i = 0; i < 120 && !hasStatus(v, PARALYZED); i++) {
      v.pos = { x: 10, y: 7 };
      v.prevPos = { x: 10, y: 7 };
      v.vel = { x: 0, y: 0 };
      runPorts(aloft.m, 1, [i < 60 ? SPECIAL : {}, {}]);
    }
    expect(shots(aloft.m)).toHaveLength(0);
    expect(v.ground).toBeNull();
    expect(v.launch!.angle).toBe(60);
    expect(frozenFor(aloft.m, v)).toBe(49);
    expect((Math.atan2(v.kb.y, v.kb.x) * 180) / Math.PI).toBeCloseTo(60, 9);
  });

  it("can't be mashed out of: stick and buttons every frame leave it as long (SmashWiki gives no mash rule)", () => {
    const mash = (i: number): Hold => ({ x: i % 2 ? 100 : -100, buttons: i % 2 ? ['attack'] : ['jump'] });
    const { m, v } = duel(30);
    shoot(m, 300);
    expect(frozenFor(m, v, mash)).toBe(49);
  });

  it("ends when Bob's follow-up lands, whose hitlag and launch take over", () => {
    const { m, a, v } = duel(11);
    shoot(m, 300);
    expect(statusOf(v, PARALYZED)!.frames).toBe(49);
    const paralyzedAt = m.frame;
    while (a.move === 'neutralB') runPorts(m, 1, []);
    expect(hasStatus(v, PARALYZED)).toBe(true);
    runPorts(m, 1, [{ buttons: ['attack'] }, {}]);
    expect(a.move).toBe('jab');
    let events: SimEvent[] = [];
    for (let i = 0; i < 10 && !events.some((e) => e.type === 'hit'); i++) {
      runPorts(m, 1, []);
      events = m.events;
    }
    expect(m.frame - paralyzedAt).toBeLessThan(49);
    expect(events).toContainEqual({ type: 'statusEnd', port: 1, status: PARALYZED, reason: 'hit' });
    expect(hasStatus(v, PARALYZED)).toBe(false);
    const jab = events.find((e) => e.type === 'hit')!;
    expect(v.hitlag).toBe((jab as { hitlag: number }).hitlag);
    runPorts(m, v.hitlag + 1, []);
    expect(v.launch).toBeNull();
  });

  it("ends when a pummel lands on the paralyzed fighter Bob grabbed, as Ultimate's hits do", () => {
    const { m, a, v } = duel(11);
    shoot(m, 300);
    expect(statusOf(v, PARALYZED)!.frames).toBe(49);
    while (a.move === 'neutralB') runPorts(m, 1, []);
    runPorts(m, 1, [{ buttons: ['grab'] }, {}]);
    for (let i = 0; i < 15 && a.action !== 'grabHold'; i++) runPorts(m, 1, []);
    expect(a.action).toBe('grabHold');
    expect(v.action).toBe('grabbed');
    expect(hasStatus(v, PARALYZED)).toBe(true);
    let events: SimEvent[] = [];
    for (let i = 0; i < 15 && !events.some((e) => e.type === 'pummel'); i++) {
      runPorts(m, 1, [i === 0 ? { buttons: ['attack'] } : {}, {}]);
      events = m.events;
    }
    expect(events.some((e) => e.type === 'pummel')).toBe(true);
    expect(events).toContainEqual({ type: 'statusEnd', port: 1, status: PARALYZED, reason: 'hit' });
    expect(hasStatus(v, PARALYZED)).toBe(false);
  });

  it('is blocked by shields: 2 frames of shieldstun, 3 at full charge, no damage and no paralysis', () => {
    for (const [hold, stun, damage] of [
      [1, PARALYZER.shieldstun.uncharged, 4],
      [300, PARALYZER.shieldstun.full, 6],
    ] as const) {
      const { m, v } = duel(30);
      const shield: Hold = { buttons: ['shield'] };
      runPorts(m, 5, [{}, shield]);
      const { events } = shoot(m, hold, () => shield);
      expect(events.some((e) => e.type === 'shieldHit')).toBe(true);
      expect(v.action).toBe('shieldStun');
      expect(v.damage).toBe(0);
      expect(v.statuses).toEqual([]);
      expect(v.hitstun).toBe(shieldstunFrames(damage * 1.05, 'projectile'));
      expect(v.hitstun).toBe(stun);
      expect(shots(m)).toHaveLength(0);
    }
  });

  it('is caught by a counter like any hit: the shot is used up, the counter answers, and nobody is paralyzed', () => {
    // The counter fixture is Fireboy with Marth's Counter on down special (catches on its frames 6-27).
    const m = createMatch({
      seed: 1,
      stage: 'battlefield',
      stocks: 3,
      ports: [{ fighter: 'bob-the-robber' }, { fighter: counterTesterMarth.id }],
    });
    const [a, v] = m.fighters as [FighterState, FighterState];
    const place = (f: FighterState, x: number, facing: 1 | -1) =>
      Object.assign(f, { pos: { x, y: 1 }, prevPos: { x, y: 1 }, facing, intangible: 0 });
    place(a, -20, 1);
    place(v, 10, -1);
    runPorts(m, 20, []);
    for (let i = 0; i < 100 && shots(m).length === 0; i++) runPorts(m, 1, [SPECIAL, {}]);
    const shot = shots(m)[0]!;
    expect(shot.kind).toBe('bob-the-robber/stunShotFull');
    attack(m, 1, 'downB');
    const events: SimEvent[] = [];
    for (let i = 0; i < 20 && !events.some((e) => e.type === 'counter'); i++) {
      runPorts(m, 1, []);
      events.push(...m.events);
    }
    expect(events.find((e) => e.type === 'counter')).toMatchObject({ port: 1, attacker: 0, entity: shot.id });
    expect(events).toContainEqual(
      expect.objectContaining({ type: 'entityDestroy', id: shot.id, reason: 'hit' }),
    );
    expect(events.some((e) => e.type === 'hit' || e.type === 'statusStart')).toBe(false);
    for (let i = 0; i < 60; i++) {
      runPorts(m, 1, []);
      events.push(...m.events);
    }
    expect(events.some((e) => e.type === 'statusStart')).toBe(false);
    expect(v.statuses).toEqual([]);
    expect(v.damage).toBe(0);
    expect(events).toContainEqual({ type: 'move', port: 1, move: 'downBHit' });
  });

  it('never KOs: its set knockback launches the same at 999% as at 0%', () => {
    for (const box of [entities.stunShot!.hits![1]!.boxes[0]!, ...entities.stunShotFull!.hits![0]!.boxes]) {
      expect(koPercent({ hit: box })).toBeNull();
      expect(koPercent({ hit: box, from: 'centre', air: true })).toBeNull();
    }
  });

  it("a CPU's move probe plays it through, and a CPU fights on through paralysis, the same way every time", () => {
    // CPUs choose moves by their own hitboxes, and this one's are on the shot, so the probe sees none.
    const probe = knowledge('bob-the-robber', 'battlefield').ground.neutralB!;
    expect(probe).toMatchObject({ busy: STUN_GUN.faf - 1, first: -1 });
    const play = () => {
      const m = createMatch({
        seed: 1,
        stage: 'battlefield',
        stocks: 3,
        ports: [{ fighter: 'bob-the-robber' }, { fighter: 'fireboy' }],
      });
      const [a, v] = m.fighters as [FighterState, FighterState];
      runPorts(m, 20, []);
      const cpu = createCpu({ port: 1, level: 9, seed: 2 });
      let paralyzed = 0;
      let frozen = 0;
      for (let i = 0; i < 1800; i++) {
        // Bob turns to face the CPU and fires a full charge every 100 frames.
        const t = i % 100;
        const toward = v.pos.x >= a.pos.x ? 1 : -1;
        const hold: Hold = t === 0 ? { x: 100 * toward } : t > 3 && t < 40 ? SPECIAL : {};
        stepMatch(m, [input(hold), cpu.input(m)]);
        paralyzed += m.events.filter((e) => e.type === 'statusStart' && e.status === PARALYZED).length;
        if (hasStatus(v, PARALYZED)) frozen++;
      }
      return { paralyzed, frozen, hash: hashState(m) };
    };
    const first = play();
    expect(first.paralyzed).toBeGreaterThan(0);
    expect(first.frozen).toBeGreaterThan(0);
    expect(play()).toEqual(first);
  });
});
