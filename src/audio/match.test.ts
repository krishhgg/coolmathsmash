import { describe, expect, it } from 'vitest';
import type { SoundId } from './bank';
import type { PlayOptions, Voice } from './engine';
import { MatchAudio, hitSound, launchKills } from './match';
import { getFighter } from '../fighters/registry';
import type { MatchState } from '../sim/match';
import { stepMatch } from '../sim/match';
import { attack, input, placeInAir, run, testMatch, type Hold } from '../sim/testing/sim';

interface Played {
  id: SoundId;
  opts: PlayOptions;
  stopped: boolean;
}

function fakeEngine() {
  const played: Played[] = [];
  const ducks: number[] = [];
  return {
    played,
    ducks,
    ids: () => played.map((p) => p.id),
    play(id: SoundId, opts: PlayOptions = {}): Voice {
      const p: Played = { id, opts, stopped: false };
      played.push(p);
      return { stop: () => void (p.stopped = true) } as unknown as Voice;
    },
    duck(depth?: number) {
      ducks.push(depth ?? 0);
    },
  };
}

/** A match whose every frame goes through MatchAudio, like Game.onEvents does. */
function listened(m: MatchState) {
  const engine = fakeEngine();
  const audio = new MatchAudio(engine);
  const step = (frames: number, holds: Hold[] = []) => {
    for (let i = 0; i < frames; i++) {
      stepMatch(
        m,
        m.players.map((_, port) => input(holds[port] ?? {})),
      );
      audio.observe(m.events, m);
    }
  };
  return { engine, audio, step };
}

function duel(): MatchState {
  const m = testMatch({ players: 2 });
  for (const [f, x, facing] of [
    [m.fighters[0]!, -10, 1],
    [m.fighters[1]!, -2, -1],
  ] as const) {
    Object.assign(f, { pos: { x, y: 0 }, prevPos: { x, y: 0 }, facing, action: 'idle' });
  }
  return m;
}

describe('match audio', () => {
  it('hit tiers rise with damage and knockback', () => {
    expect(hitSound(2, 20, false)).toBe('hit-light');
    expect(hitSound(7, 20, false)).toBe('hit-medium');
    expect(hitSound(3, 70, false)).toBe('hit-medium');
    expect(hitSound(14, 50, false)).toBe('hit-heavy');
    expect(hitSound(4, 120, true)).toBe('hit-ko');
  });

  it('a jump, an air jump and the landing each sound once', () => {
    const m = testMatch();
    const { engine, step } = listened(m);
    step(1, [{ buttons: ['jump'] }]);
    step(12);
    step(1, [{ buttons: ['jump'] }]);
    for (let i = 0; i < 200 && !engine.ids().includes('land') && !engine.ids().includes('land-heavy'); i++)
      step(1);
    expect(engine.ids().filter((id) => id !== 'step')).toEqual([
      'jump',
      'double-jump',
      expect.stringMatching(/^land/),
    ]);
  });

  it('a hit plays its tier panned towards where it landed', () => {
    const m = duel();
    const { engine, step } = listened(m);
    attack(m, 0, 'probe');
    step(1);
    expect(engine.ids()).toEqual([expect.stringMatching(/^hit-(light|medium|heavy)$/)]);
    expect(engine.played[0]!.opts.pan).toBeGreaterThan(0);
  });

  it("a move's swing whoosh comes just before its first hitbox", () => {
    const m = testMatch({ fighter: 'fireboy' });
    const { engine, step } = listened(m);
    const jab = getFighter('fireboy').moves!.jab!;
    step(1, [{ buttons: ['attack'] }]);
    let frames = 1;
    while (!engine.ids().includes('swing-light') && frames < 30) {
      step(1);
      frames++;
    }
    expect(m.fighters[0]!.move).toBe('jab');
    expect(m.fighters[0]!.actionFrame).toBe(Math.max(1, jab.hits[0]!.frames[0] - 3));
  });

  it('a hit that will KO gets the KO sound on the hit itself, then the blast and a duck', () => {
    const m = duel();
    m.fighters[1]!.damage = 400;
    expect(m.fighters[1]!.stocks).toBe(3);
    const { engine, step } = listened(m);
    attack(m, 0, 'probe');
    step(1);
    expect(engine.ids()).toContain('hit-ko');
    expect(engine.ducks.length).toBe(1);
    for (let i = 0; i < 200 && !engine.ids().includes('ko-blast'); i++) step(1);
    expect(engine.ids()).toContain('ko-blast');
    const launch = engine.ids().find((id) => id.startsWith('launch'));
    expect(launch).toBe('launch-strong');
  });

  it('a light hit at low % is no KO', () => {
    const m = duel();
    attack(m, 0, 'probe');
    run(m, 1);
    const hit = m.events.find((e) => e.type === 'hit');
    expect(hit).toBeDefined();
    expect(launchKills(m, 1)).toBe(false);
  });

  it('the KO lookahead leaves the real match untouched', () => {
    const m = duel();
    m.fighters[1]!.damage = 400;
    attack(m, 0, 'probe');
    run(m, 1);
    const before = structuredClone(m);
    expect(launchKills(m, 1)).toBe(true);
    expect(m).toEqual(before);
  });

  it('raising a shield and blocking a hit sound, and the shield sound waits for a fresh raise', () => {
    const m = duel();
    const { engine, step } = listened(m);
    const shield: Hold[] = [{}, { buttons: ['shield'] }];
    step(5, shield);
    expect(engine.ids()).toEqual(['shield-on']);
    attack(m, 0, 'probe');
    step(30, shield);
    expect(engine.ids().filter((id) => id === 'shield-on')).toHaveLength(1);
    expect(engine.ids()).toContain('shield-hit');
  });

  it('running plays footsteps and dashing plays the dash', () => {
    const m = testMatch();
    const { engine, step } = listened(m);
    step(60, [{ x: 100 }]);
    expect(engine.ids()).toContain('dash');
    expect(engine.ids().filter((id) => id === 'step').length).toBeGreaterThanOrEqual(2);
  });

  it('a KO off the side plays the blast and the respawn follows', () => {
    const m = testMatch();
    const { engine, step } = listened(m);
    const f = placeInAir(m, 238, 50);
    f.vel.x = 5;
    for (let i = 0; i < 400 && !engine.ids().includes('respawn'); i++) step(1);
    expect(engine.ids()).toEqual(expect.arrayContaining(['ko-blast', 'respawn']));
    expect(engine.played.find((p) => p.id === 'ko-blast')!.opts.pan).toBeGreaterThan(0.5);
  });

  it('a smash charge loops until the attack comes out', () => {
    const m = testMatch({ fighter: 'fireboy' });
    const { engine, step } = listened(m);
    step(20, [{ cx: 100 }]);
    const charge = engine.played.find((p) => p.id === 'smash-charge')!;
    expect(charge.stopped).toBe(false);
    step(30);
    expect(charge.stopped).toBe(true);
  });

  it('a frame that does not follow the last stops loops and starts over', () => {
    const m = testMatch();
    const { engine, audio, step } = listened(m);
    step(3);
    const loop = { stopped: false };
    engine.played.length = 0;
    (audio as unknown as { loops: Map<string, Voice> }).loops.set('dizzy:0', {
      stop: () => void (loop.stopped = true),
    } as unknown as Voice);
    m.frame += 10;
    audio.observe([], m);
    expect(loop.stopped).toBe(true);
  });
});
