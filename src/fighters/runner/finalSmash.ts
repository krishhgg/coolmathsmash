import type { StatusDef } from '../../sim/statuses';
import type { HitboxDef, MoveDef } from '../types';
import { TUNNEL_FLIP } from './timing';

/**
 * Runner's Final Smash, Tunnel Flip: she turns the whole tunnel over, as the tunnel rolls when she steps onto a wall in
 * Run. Everyone near her takes damage as it turns and is left stuck, upside down and dazed, while she can act again.
 * It is Peach Blossom in Ultimate 13.0.1 (SmashWiki, "Peach (SSBU)/Final Smash"), the stage-wide Final Smash that puts
 * every opponent near the user to sleep for the user to punish:
 *
 * - Timing table: damaging hit 40-61, clean sleep 62-140, late sleep 141-230, interruptible 248.
 * - Damage boxes, all on bone "throw" at offset (0, 5, 0), Sakurai angle, BK 0, KS 0, hitlag x0.0, unblockable: 30%
 *   with radius 25 (ID 0), 20% with radius 50 (ID 1), 10% with radius 100 (ID 2). Closer means more damage. With no
 *   knockback it never KOs by itself, as Brawl's Peach Blossom never could (SmashWiki, "Peach Blossom").
 * - Sleep boxes, 0%, same place: clean ID 4 radius 25 (ground and air), ID 5 radius 50 (ground and air), ID 6 radius
 *   100 (ground only); late ID 4 radius 25 (both), IDs 5 and 6 ground only. Their sleep values are 230, 130 and 100
 *   (late 200, 130, 100), cut from 260, 200 and 160 in 3.0.0 ("slightly reduced sleep time period").
 * - Sleep "ends prematurely if they take any kind of knockback", and "button mashing reduces sleep time by 8 frames
 *   per input (14.4 for buttons in Smash 4 and Ultimate)" (SmashWiki, "Asleep").
 *
 * SmashWiki gives the sleep only as those values. Its sleep formula (70 + p + 25k, k the sleep box's knockback) reads
 * 1276 frames for the near box at 30%, longer than any Final Smash keeps anyone, so the stuck lengths here are the
 * values themselves in frames. Then whoever stood within 25 units is still stuck on frame 248, when Runner can act
 * (62 + 230 = 292), and everyone further out is free by then, which is what makes Peach Blossom's near ring hard to
 * escape. Not built: the three peaches that heal Peach, and the fall into sleep (an airborne fighter caught by a sleep
 * box is held where it is, since `freeze` holds like hitlag). The view turning over is the renderer's alone (the art's
 * `viewFlips`, src/render/viewFlip.ts): nobody's gravity changes.
 */

/** Peach Blossom's three rings: radius, damage, and the stuck length of each ring's clean and late sleep box. */
export const RINGS = [
  { radius: 25, damage: 30, clean: 230, late: 200 },
  { radius: 50, damage: 20, clean: 130, late: 130 },
  { radius: 100, damage: 10, clean: 100, late: 100 },
] as const;

/** The boxes' centre, from her feet: Peach Blossom's offset (0, 5) on her "throw" bone. */
const AT = { x: 0, y: 5 };

/** Which fighters each sleep box takes, by ring: SmashWiki's grounded and aerial flags. */
const CLEAN_TARGETS: HitboxDef['targets'][] = ['both', 'both', 'ground'];
const LATE_TARGETS: HitboxDef['targets'][] = ['both', 'ground', 'ground'];

/**
 * Stuck: held where they stand, as Ultimate's sleep holds its victims, until it runs out, a hit lands or they mash out.
 * Four kinds, since a box's status takes its length from the status: one per stuck length in the sleep boxes. They are
 * drawn dazed in their shield-break `dizzy` clip (Ultimate's sleepers doze standing), or tumbling in the air, where
 * Ultimate's airborne sleepers are "put in an inactionable tumble state" (SmashWiki, "Asleep").
 */
const stuck = (frames: number): StatusDef => ({
  frames,
  freeze: true,
  endOnHit: true,
  mash: { stick: 8, button: 14.4 },
  color: '#9fcde8',
  clip: { ground: 'dizzy', air: 'tumble' },
});

export const STUCK = {
  near: 'runner/stuckNear',
  nearLate: 'runner/stuckNearLate',
  mid: 'runner/stuckMid',
  far: 'runner/stuckFar',
} as const;

export const statuses: Record<string, StatusDef> = {
  stuckNear: stuck(RINGS[0].clean),
  stuckNearLate: stuck(RINGS[0].late),
  stuckMid: stuck(RINGS[1].clean),
  stuckFar: stuck(RINGS[2].clean),
};

const CLEAN_STATUS = [STUCK.near, STUCK.mid, STUCK.far];
const LATE_STATUS = [STUCK.nearLate, STUCK.mid, STUCK.far];

const damageBoxes: HitboxDef[] = RINGS.map((ring, i) => ({
  id: i,
  ...AT,
  radius: ring.radius,
  damage: ring.damage,
  angle: 361,
  kbg: 0,
  bkb: 0,
  hitlag: 0,
  transcendent: true,
}));

const sleepBoxes = (targets: HitboxDef['targets'][], status: string[]): HitboxDef[] =>
  RINGS.map((ring, i) => ({
    id: 4 + i,
    ...AT,
    radius: ring.radius,
    damage: 0,
    angle: 0,
    kbg: 0,
    bkb: 0,
    hitlag: 0,
    transcendent: true,
    status: status[i]!,
    ...(targets[i] !== 'both' && { targets: targets[i] }),
  }));

/**
 * Tunnel Flip, grounded or in the air (one move, as Peach Blossom has one table): she holds still in the air. The
 * clean sleep window forgets the damage window's victims so it can catch them; the late one doesn't, so it only takes
 * fighters that weren't caught yet. CPUs use it once someone is within the near ring, the only one still stuck when she
 * can act.
 */
export const finalSmash: MoveDef = {
  kind: 'other',
  faf: TUNNEL_FLIP.faf,
  final: { freeze: TUNNEL_FLIP.freeze, still: true, range: RINGS[0].radius },
  hits: [
    { frames: TUNNEL_FLIP.hit, boxes: damageBoxes },
    { frames: TUNNEL_FLIP.clean, rehit: true, boxes: sleepBoxes(CLEAN_TARGETS, CLEAN_STATUS) },
    { frames: TUNNEL_FLIP.late, boxes: sleepBoxes(LATE_TARGETS, LATE_STATUS) },
  ],
};
