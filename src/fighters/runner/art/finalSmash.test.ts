import { describe, expect, it } from 'vitest';
import { VIEW_HEIGHT, VIEW_WIDTH } from '../../../config';
import { Camera } from '../../../render/camera';
import { clipFor, fighterArt } from '../../../render/fighterView';
import { samplePose } from '../../../render/rig/sample';
import type { FighterState } from '../../../sim/fighter';
import { createMatch, stepMatch } from '../../../sim/match';
import { applyStatus } from '../../../sim/statuses';
import { input } from '../../../sim/testing/sim';
import { getStage } from '../../../stages/registry';
import { allFighters, getFighter } from '../../registry';
import { STUCK } from '../finalSmash';
import { TUNNEL_FLIP } from '../timing';
import { art } from '.';
import { TUNNEL_SIZE } from './finalSmash';
import { TUNNEL_EDGE } from './parts';

const TUNNELS = new Set(['tunnel', 'tunnelFaint']);

/** The tunnel's four outer corners in world units (y up) on move frame `frame`, or null when it isn't drawn. */
function tunnelCorners(f: FighterState, frame: number): [number, number][] | null {
  const pose = samplePose(art, 'finalSmash', frame, frame);
  if (!TUNNELS.has(pose.symbols.fxBack ?? '')) return null;
  const m = pose.world.fx3!;
  const e = TUNNEL_EDGE;
  return [
    [-e, -e],
    [e, -e],
    [e, e],
    [-e, e],
  ].map(([x, y]) => {
    const rx = m.a * x! + m.c * y! + m.tx;
    const ry = m.b * x! + m.d * y! + m.ty;
    return [f.pos.x + f.facing * rx, f.pos.y - ry];
  });
}

describe("Tunnel Flip's art in a match", () => {
  it('never grows the tunnel past TUNNEL_SIZE, so it reads as a tunnel and not one wall', () => {
    let drawn = 0;
    for (let f = 1; f < TUNNEL_FLIP.faf; f++) {
      const pose = samplePose(art, 'finalSmash', f, f);
      if (!TUNNELS.has(pose.symbols.fxBack ?? '')) continue;
      drawn++;
      const m = pose.world.fx3!;
      expect(Math.hypot(m.a, m.b), `${f}`).toBeLessThanOrEqual(TUNNEL_SIZE + 1e-9);
    }
    // On from the hit (40) until it fades (65), and over the turn back (231-246).
    expect(drawn).toBe(26 + 16);
  });

  // Runner and two foes, as in the runner-final-smash capture, and spread to the stage's ends and back.
  it.each([
    ['capture', -30, [-15, 35]],
    ['far foe', -60, [-45, 70]],
    ['left end', -75, [-60, 75]],
    ['right end', 70, [55, -78]],
  ] as const)('keeps all four walls of the tunnel on screen on every frame it is drawn (%s)', (_, at, xs) => {
    const stage = getStage('battlefield');
    const m = createMatch({
      seed: 1,
      stage: 'battlefield',
      stocks: 3,
      ports: [{ fighter: 'runner' }, ...xs.map(() => ({ fighter: 'fireboy' }))],
    });
    [at, ...xs].forEach((x, i) => {
      const f = m.fighters[i]!;
      Object.assign(f, { pos: { x, y: 1 }, prevPos: { x, y: 1 }, vel: { x: 0, y: 0 }, ground: null });
      Object.assign(f, {
        action: 'fall',
        actionFrame: 1,
        facing: i === 0 ? (at < 0 ? 1 : -1) : at < x ? -1 : 1,
      });
    });
    const camera = new Camera();
    const tick = (press = false) => {
      stepMatch(
        m,
        m.players.map((p) => input(press && p.port === 0 ? { buttons: ['special'] } : {})),
      );
      camera.step(m, stage);
    };
    for (let i = 0; i < 30; i++) tick();
    const r = m.fighters[0]!;
    r.finalReady = true;
    tick(true);
    let checked = 0;
    while (r.move === 'finalSmash') {
      const corners = tunnelCorners(r, r.actionFrame);
      if (corners) {
        checked++;
        const view = camera.viewFor(m, stage);
        const [hw, hh] = [VIEW_WIDTH / 2 / view.zoom, VIEW_HEIGHT / 2 / view.zoom];
        for (const [x, y] of corners) {
          expect(Math.abs(x - view.x), `x on ${r.actionFrame}`).toBeLessThan(hw);
          expect(Math.abs(y - view.y), `y on ${r.actionFrame}`).toBeLessThan(hh);
        }
      }
      tick();
    }
    expect(checked).toBe(42);
  });

  it('draws stuck fighters dazed in their dizzy clip on the ground and tumbling in the air, on every drawn fighter', () => {
    const drawn = Object.values(allFighters()).filter(
      (d) => fighterArt(d)?.clips && !d.id.startsWith('test-'),
    );
    expect(drawn.length).toBeGreaterThanOrEqual(13);
    for (const def of drawn) {
      const a = fighterArt(def)!;
      expect([def.id, !!a.clips.dizzy?.loop, !!a.clips.tumble?.loop]).toEqual([def.id, true, true]);
      const m = createMatch({
        seed: 1,
        stage: 'battlefield',
        stocks: 3,
        ports: [{ fighter: 'runner' }, { fighter: def.id }],
      });
      const v = m.fighters[1]!;
      for (let i = 0; i < 40; i++) stepMatch(m, [input(), input()]);
      expect(v.ground, def.id).not.toBe(null);
      Object.assign(v, { action: 'hitstun', actionFrame: 0, move: null });
      expect(clipFor(getFighter(def.id), a, v)[0], def.id).toBe('hitstun' in a.clips ? 'hitstun' : 'idle');
      applyStatus(m, v, STUCK.near);
      v.statuses[0]!.age = 17;
      expect(clipFor(getFighter(def.id), a, v), def.id).toEqual(['dizzy', 17]);
      v.ground = null;
      expect(clipFor(getFighter(def.id), a, v), def.id).toEqual(['tumble', 17]);
    }
  });
});
