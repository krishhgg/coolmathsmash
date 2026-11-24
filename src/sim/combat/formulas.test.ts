import { describe, expect, it } from 'vitest';
import ref from '../reference/physics-constants.json';
import {
  directionalInfluence,
  grabHoldFrames,
  hitlagFrames,
  hitstunFrames,
  isTumble,
  knockback,
  launch,
  launchSpeedInfluence,
  ledgeIntangibility,
  rageMultiplier,
  sakuraiAngle,
  shieldBreakStun,
  shieldPushback,
  shieldstunFrames,
  speedUp,
  staleMultiplier,
  type ShieldHitKind,
} from './formulas';

/** Floats in the reference are printed to 6 decimals. */
const close = (actual: number, expected: number) => expect(actual).toBeCloseTo(expected, 5);

describe('knockback (research test vectors kb01-kb15)', () => {
  it.each(ref.knockback.test_vectors.map((v) => [v.id, v] as const))('%s', (_, vec) => {
    const stale = vec.staleness ? staleMultiplier(vec.stale_queue ?? []) : 1;
    close(stale, vec.stale_multiplier);
    const kb = knockback({
      percent: vec.pre_percent,
      damage: vec.damage,
      kbg: vec.kbg,
      bkb: vec.bkb,
      wbkb: vec.wbkb,
      weight: vec.weight,
      stale,
      rage: vec.attacker_percent === undefined ? 1 : rageMultiplier(vec.attacker_percent),
      crouch: vec.crouch,
    });
    close(kb, vec.expected_kb);
    expect(hitstunFrames(kb)).toBe(vec.expected_hitstun_frames);
    expect(isTumble(kb)).toBe(vec.expected_tumble);
    close(kb * ref.launch.launch_speed_per_kb, vec.expected_launch_speed);

    const setKnockback = vec.wbkb !== undefined;
    const l = launch({ kb, angle: vec.angle, aerial: vec.aerial, gravity: vec.gravity, setKnockback });
    expect(l.angle).toBeCloseTo(vec.expected_angle_deg, 6);
    expect(l.effectiveAngle).toBeCloseTo(vec.expected_effective_angle_deg, 3);
    close(Math.abs(l.vx), vec.expected_vx);
    close(Math.abs(l.vy), vec.expected_vy);

    const faf = hitstunFrames(kb) + 1;
    expect(faf).toBe(vec.expected_first_actionable_frame_unsped);
    const actionable = l.tumble && !setKnockback ? speedUp(faf).actionable : faf;
    expect(actionable).toBe(vec.expected_first_actionable_frame_with_speedup);
  });

  it('caps at 2500 and ignores rage and staleness for set knockback', () => {
    expect(knockback({ percent: 999, damage: 999, kbg: 200, bkb: 100, weight: 60 })).toBe(2500);
    const set = { percent: 0, damage: 5, kbg: 100, bkb: 0, wbkb: 80, weight: 98 };
    expect(knockback({ ...set, rage: 1.1, stale: 0.5 })).toBe(knockback(set));
  });
});

describe('stale moves and rage', () => {
  it('reduces by slot and gives the freshness bonus when not in the queue', () => {
    close(staleMultiplier([1, 2, 6]), ref.stale_moves.example_slots_1_2_6);
    expect(staleMultiplier([])).toBe(ref.stale_moves.freshness_bonus);
    close(1 - staleMultiplier([1, 2, 3, 4, 5, 6, 7, 8, 9]), ref.stale_moves.max_total_reduction);
  });

  it.each(ref.rage.test_vectors.map((v) => [v.attacker_percent, v.expected_multiplier]))(
    'rage at %s%% is x%s',
    (percent, mult) => close(rageMultiplier(percent), mult),
  );
});

describe('hitstun and launch', () => {
  it('tumbles from kb 80', () => {
    expect(isTumble(79.99)).toBe(false);
    expect(isTumble(ref.hitstun.tumble_threshold_kb)).toBe(true);
    expect(hitstunFrames(0)).toBe(ref.hitstun.min_flinch_hitstun);
  });

  it.each(ref.launch.sakurai_angle.test_vectors.map((v) => [v.kb, v.aerial, v.expected_angle_deg] as const))(
    'Sakurai angle at kb %s (aerial %s) is %s',
    (kb, aerial, angle) => expect(sakuraiAngle(kb, aerial)).toBeCloseTo(angle, 6),
  );

  it.each(
    ref.hitstun.speedup_balloon_knockback.test_vectors.map(
      (v) => [v.faf, v.expected_actionable_frame] as const,
    ),
  )('balloon speed-up: un-sped FAF %s acts on frame %s', (faf, actionable) => {
    const s = speedUp(faf);
    expect(s.actionable).toBe(actionable);
    expect(s.steps.every((step) => step >= 1)).toBe(true);
  });

  it('launches meteors downward with the gravity bonus and 180-degree hits back toward the attacker', () => {
    const spike = launch({ kb: 150, angle: 290, aerial: true, gravity: 0.087 });
    close(spike.vx, 1.539091);
    close(spike.vy, -4.168617);
    close(spike.effectiveAngle, 290.264597);
    const back = launch({ kb: 130, angle: 180, aerial: false, gravity: 0.087 });
    expect(back.angle).toBe(148);
    expect(back.vx).toBeLessThan(0);
  });

  it('flags 70-110 degree tumble launches as vertical, with no gravity bonus', () => {
    const up = launch({ kb: 150, angle: 80, aerial: true, gravity: 0.23 });
    expect(up.vertical).toBe(true);
    close(up.vy, 150 * 0.03 * Math.sin((80 * Math.PI) / 180));
  });
});

describe('DI and LSI (SSBU-Calculator DI()/LSI(), launch speed 3.6)', () => {
  const cases: [angle: number, sx: number, sy: number, result: number, lsi: number][] = [
    [45, 0, 1, 51.88742, 1.095],
    [45, 1, 0, 38.11258, 1],
    [45, -1, 0, 51.88742, 1],
    [45, 0, -1, 38.11258, 0.92],
    [80, 1, 0, 70.40769, 1],
    [30, -0.75, 0.75, 39.979105, 1.07125],
    [135, 1, 0, 128.11258, 1],
    [20, 0, 1, 29.152872, 1.095],
  ];
  it.each(cases)('launch %s degrees, stick (%s, %s) -> %s degrees, LSI x%s', (angle, sx, sy, result, lsi) => {
    const r = (angle * Math.PI) / 180;
    const di = (directionalInfluence(3.6 * Math.cos(r), 3.6 * Math.sin(r), sx, sy) * 180) / Math.PI;
    close(di, result);
    close(launchSpeedInfluence(sy, di), lsi);
  });

  it('DI only applies to tumble launches', () => {
    const plain = launch({ kb: 60, angle: 45, aerial: true, gravity: 0.087 });
    const held = launch({ kb: 60, angle: 45, aerial: true, gravity: 0.087, stick: { x: 1, y: 0 } });
    expect(held).toEqual(plain);
    const tumble = launch({ kb: 120, angle: 45, aerial: true, gravity: 0.087, stick: { x: 1, y: 0 } });
    expect(tumble.effectiveAngle).toBeLessThan(45);
  });
});

describe('hitlag (research test vectors hl01-hl12)', () => {
  it.each(ref.hitlag.test_vectors.map((v) => [v.id, v] as const))('%s', (_, vec) => {
    expect(hitlagFrames(vec.damage, { electric: vec.electric, crouch: vec.crouch, mult: vec.mult })).toBe(
      vec.expected_hitlag_frames,
    );
  });
});

describe('shields', () => {
  it.each(ref.shield.shieldstun.test_vectors.map((v) => [v.id, v] as const))('shieldstun %s', (_, v) => {
    expect(shieldstunFrames(v.damage, v.kind as ShieldHitKind)).toBe(v.expected_shieldstun_frames);
  });

  it('pushes the defender (stun + 1) * 0.09, capped at 1.3, and the attacker damage * 0.04 + 0.025', () => {
    close(shieldPushback(10, 10).defender, 0.99);
    expect(shieldPushback(30, 40).defender).toBe(ref.shield.pushback.defender_max);
    close(shieldPushback(10, 10).attacker, 0.425);
  });

  it.each(ref.shield_break.stun_test_vectors.map((v) => [v.percent, v.expected_frames]))(
    'shield break at %s%% stuns for %s frames',
    (percent, frames) => expect(shieldBreakStun(percent)).toBe(frames),
  );
});

describe('ledge and grab', () => {
  it.each(
    ref.ledge.intangibility_test_vectors.map(
      (v) => [v.airtime_frames, v.percent, v.expected_frames_incl_19f_catch] as const,
    ),
  )('ledge grab after %s airtime frames at %s%%: %s intangible frames', (airtime, percent, frames) => {
    expect(ledgeIntangibility(airtime, percent)).toBe(frames);
  });

  it.each(ref.grab.test_vectors.map((v) => [v.percent, v.expected_frames]))(
    'a grab at %s%% holds %s frames',
    (percent, frames) => expect(grabHoldFrames(percent)).toBe(frames),
  );
});
