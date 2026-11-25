import { describe, expect, it } from 'vitest';
import { getFighter } from '../registry';
import { shieldstunFrames } from '../../sim/combat/formulas';
import { LEDGE_MAX_GRABS } from '../../sim/constants';
import { koPercent } from '../../sim/testing/ko';
import { placeInAir, run, runPorts, stage, testMatch, until, type Hold } from '../../sim/testing/sim';
import { moves } from './moves';
import { TONGUE_LASH } from './specials';
import { stats } from './stats';
import { versusMario } from './versus';

/**
 * Ivysaur's Vine Whip in Ultimate 13.0.1, Tongue Lash's analogue: hitboxes from SmashWiki (Ivysaur (SSBU)/Up
 * special), timing from ultimateframedata.com ("Tethers on frame 13. Does not induce special fall.", 15-17, 47
 * frames). Boxes 0-3 run along the vine, box 4 is the tip.
 */
const VINE_WHIP = {
  active: [15, 17],
  faf: 48,
  tether: 13,
  damage: [11, 11, 11, 11, 13],
  angle: 50,
  kbg: 80,
  hitlag: [1, 1, 1, 1, 0.5],
  sideB: { bkb: [50, 50, 50, 50, 70], radius: [4.5, 4.2, 3.8, 3.5, 4.5] },
  sideBAir: { bkb: [40, 40, 40, 40, 70], radius: [5, 4.5, 4, 3.5, 5.5] },
} as const;

const LASH: Hold = { x: 100, buttons: ['special'] };
const SHIELD: Hold = { buttons: ['shield'] };
/** The right ledge of Battlefield and where he hangs from it (feet). */
const LEDGE = stage().geo.ledges.find((l) => l.side === 1)!;
const HANG = { x: LEDGE.x + stats.width / 2 + 0.5, y: LEDGE.y - stats.height * 0.85 };

/** Red Ball falling off the right side of Battlefield at (x, y), facing the stage. */
function offstage(x: number, y: number) {
  const m = testMatch({ fighter: 'redball' });
  const f = placeInAir(m, x, y, -1);
  return { m, f };
}

describe('Red Ball: Tongue Lash (side special) copies Ivysaur’s Vine Whip', () => {
  it.each(['sideB', 'sideBAir'] as const)('%s has Vine Whip’s timing and hitboxes', (name) => {
    const move = moves[name]!;
    expect(move.faf).toBe(VINE_WHIP.faf);
    expect(move.helpless).toBeFalsy();
    expect(move.tether?.frame).toBe(VINE_WHIP.tether);
    expect(move.tether?.latch).toEqual(['ledge']);
    expect(move.hits.map((h) => h.frames)).toEqual([VINE_WHIP.active]);
    const boxes = move.hits[0]!.boxes;
    expect(boxes.map((b) => b.id)).toEqual([0, 1, 2, 3, 4]);
    expect(boxes.map((b) => b.damage)).toEqual(VINE_WHIP.damage);
    expect(boxes.map((b) => b.angle)).toEqual(VINE_WHIP.damage.map(() => VINE_WHIP.angle));
    expect(boxes.map((b) => b.kbg)).toEqual(VINE_WHIP.damage.map(() => VINE_WHIP.kbg));
    expect(boxes.map((b) => b.bkb)).toEqual(VINE_WHIP[name].bkb);
    expect(boxes.map((b) => b.radius)).toEqual(VINE_WHIP[name].radius);
    expect(boxes.map((b) => b.hitlag ?? 1)).toEqual(VINE_WHIP.hitlag);
  });

  it('starts as the air version in the air, the ground version on the ground', () => {
    const { m, a } = versusMario();
    runPorts(m, 1, [LASH, {}]);
    expect(a.move).toBe('sideB');
    const air = offstage(0, 60);
    run(air.m, 1, { x: -100, buttons: ['special'] });
    expect(air.f.move).toBe('sideBAir');
  });

  it('the tongue tip lashes Mario 24 units away for 13%, up and away at 50 degrees', () => {
    const { m, a, v } = versusMario();
    v.pos.x = v.prevPos.x = a.pos.x + 24 * a.facing;
    runPorts(m, 1, [LASH, {}]);
    runPorts(m, VINE_WHIP.active[0] - 2, [{}, {}]);
    expect(v.damage).toBe(0);
    runPorts(m, 1, [{}, {}]);
    expect(v.damage).toBeCloseTo(13 * 1.05 * 1.2, 6);
    expect(v.launch?.angle).toBe(50);
    runPorts(m, v.hitlag + 1, [{}, {}]);
    expect(v.kb.x * a.facing).toBeGreaterThan(0);
    expect(v.kb.y).toBeGreaterThan(0);
  });

  it('reaches as far as the tip box (28.5 units): hits Mario whose body starts 28 units out, not 29', () => {
    const lands = (gap: number) => {
      const { m, a, v } = versusMario();
      const x = a.pos.x + (gap + getFighter(v.fighter).stats.width / 2) * a.facing;
      v.pos.x = v.prevPos.x = x;
      runPorts(m, 1, [LASH, {}]);
      runPorts(m, VINE_WHIP.faf, [{}, {}]);
      return v.damage > 0;
    };
    expect(lands(28)).toBe(true);
    expect(lands(29)).toBe(false);
  });

  it('on a shield, the tip deals shield damage and 12 frames of shieldstun, and Mario keeps shielding', () => {
    const { m, a, v } = versusMario();
    v.pos.x = v.prevPos.x = a.pos.x + 24 * a.facing;
    runPorts(m, 5, [{}, SHIELD]);
    const hp = v.shieldHp;
    runPorts(m, 1, [LASH, SHIELD]);
    for (let i = 0; i < 20 && v.action !== 'shieldStun'; i++) runPorts(m, 1, [{}, SHIELD]);
    expect(v.action).toBe('shieldStun');
    expect(v.damage).toBe(0);
    expect(v.shieldHp).toBeLessThan(hp);
    expect(v.hitstun).toBe(shieldstunFrames(13 * 1.05, 'other'));
    expect(v.hitstun).toBe(12);
    runPorts(m, v.hitlag + v.hitstun + 1, [{}, SHIELD]);
    expect(v.action).toBe('shield');
  });

  it('KOs Mario at the ledge within 5% of Vine Whip’s tip', () => {
    const tongue = koPercent({ hit: { fighter: 'redball', move: 'sideB' } })!;
    const vineWhip = koPercent({ hit: { damage: 13, angle: 50, bkb: 70, kbg: 80 } })!;
    expect(Math.abs(tongue - vineWhip)).toBeLessThanOrEqual(5);
  });
});

describe('Red Ball: Tongue Lash reels him in to a ledge', () => {
  it('latches the ledge it passes from below and reels into a ledge grab', () => {
    const { m, f } = offstage(LEDGE.x + 24, LEDGE.y - 6);
    run(m, 1, { x: -100, buttons: ['special'] });
    expect(f.move).toBe('sideBAir');
    until(m, (g) => g.action === 'tetherPull', {}, VINE_WHIP.tether + 2);
    expect(f.tether?.kind).toBe('ledge');
    expect(f.move).toBe('sideBAir');
    const frames = until(m, (g) => g.action === 'ledgeCatch', {}, 20);
    expect(frames).toBeLessThanOrEqual(Math.ceil(TONGUE_LASH.range / TONGUE_LASH.pullSpeed));
    expect(f.pos.x).toBeCloseTo(HANG.x, 6);
    expect(f.pos.y).toBeCloseTo(HANG.y, 6);
    expect(f.ledgeGrabs).toBe(1);
    expect(f.tether).toBeNull();
  });

  it('a jump lets go of the reel into a fall, keeping its speed', () => {
    const { m, f } = offstage(LEDGE.x + 24, LEDGE.y - 6);
    run(m, 1, { x: -100, buttons: ['special'] });
    until(m, (g) => g.action === 'tetherPull', {}, VINE_WHIP.tether + 2);
    run(m, 1);
    run(m, 1, { buttons: ['jump'] });
    expect(f.action).toBe('fall');
    expect(f.vel.x).toBeLessThan(-1);
    expect(f.tether).toBeNull();
  });

  it('misses a ledge beyond the tongue and ends in a normal fall, not helpless', () => {
    const { m, f } = offstage(LEDGE.x + TONGUE_LASH.range + 12, LEDGE.y - 6);
    run(m, 1, { x: -100, buttons: ['special'] });
    run(m, VINE_WHIP.faf - 1);
    expect(f.ledgeGrabs).toBe(0);
    expect(f.action).toBe('fall');
  });

  it('cannot latch a ledge once his ledge grabs are spent', () => {
    const { m, f } = offstage(LEDGE.x + 24, LEDGE.y - 6);
    f.ledgeGrabs = LEDGE_MAX_GRABS;
    run(m, 1, { x: -100, buttons: ['special'] });
    run(m, VINE_WHIP.faf - 1);
    expect(f.action).toBe('fall');
    expect(f.ledge).toBe(-1);
  });

  it('on the stage the tongue never pulls him to a ledge', () => {
    const m = testMatch({ fighter: 'redball', x: LEDGE.x - 20 });
    const f = m.fighters[0]!;
    f.facing = 1;
    run(m, 1, { x: 100, buttons: ['special'] });
    expect(f.move).toBe('sideB');
    run(m, VINE_WHIP.faf - 1);
    expect(f.action).toBe('idle');
    expect(f.pos.x).toBeLessThan(LEDGE.x);
  });
});
