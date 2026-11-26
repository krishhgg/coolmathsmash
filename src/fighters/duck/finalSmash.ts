import { destroyEntity, spawnFromMove } from '../../sim/entities/entities';
import type { EntityDef } from '../../sim/entities/types';
import { PARALYZED } from '../bob-the-robber/entities';
import type { HitboxDef, MoveDef } from '../types';

/**
 * The Duck's Final Smash, Evolved Stomp: he grows into his fully trained form, three times his size, and stomps the
 * stage twice. The first stomp's burst pins everyone in front, and the second sends a shockwave along the floor to
 * its edge. It is Ganondorf's Ganon, The Demon King in Ultimate 13.0.1 (SmashWiki, "Ganondorf (SSBU)/Final Smash" and
 * "Ganon, The Demon King"; the game scripts of the Ganon article, rubendal/ssbu 2e8f0d2,
 * public/data/patch/13.0.1/character/Ganondorf/data.json, `ganon_ganond` Start and Attack). Ganondorf turns into a
 * giant beast that slams his swords down in front of him, meteor smashing and paralysing those there "into the
 * resulting charge", then charges to the edge of the stage. In Brawl and Smash 4 that opening was a stomp.
 *
 * - Timing. Ganon is an article spawned on Ganondorf's frame 5, so its frame 1 is the Duck's frame 5. The slam is
 *   out on its frames 50 to 54 (the Duck's 54 to 58). Its Start motion then runs frames 96 to 104 at half speed
 *   (FT_MOTION_RATE 2) and throws out a 0% push on frame 105, its 114th, for 10 frames; the charge follows (the Attack
 *   motion), so it starts on the article's 124th frame, the Duck's 128. The scripts give the charge's hitboxes but not
 *   its speed or length.
 * - The slam (the first stomp): 10%, angle 270, KS 100, set knockback 250, BK 0, radius 25, stretched from 18 to 50
 *   units in front at 25 up, hitlag x2, paralyse. The paralysis is Ultimate's (Bob's Stun Gun status): floor(1 +
 *   knockback x2) frames, at most 90, so it holds every fighter for 90 frames.
 * - The charge (the shockwave): 45% in front (radius 10, 25 forward and 12 up) and 35% behind it (radius 15 from 5
 *   forward to 20 back, 12 up; radius 18 from 13 forward to 18 back, 30 up), all at angle 42, KS 25, BK 122, hitlag x0,
 *   launching forward.
 * - Left out: the 0% push at the charge's start (angle 20, set knockback 220), which throws anyone beside Ganon into
 *   the charge. The shockwave's rear boxes already reach 38 units behind him there.
 * - Speed, an estimate. A fighter the slam catches on its first frame is held until frame 144. At WAVE.speed the
 *   front box reaches the slam's far edge (75 units in front) on that frame, so the shockwave meets everyone the slam
 *   pinned before they can drop out, and only someone further away slips through, as SmashWiki says of Ganon's.
 * - Length, an estimate. The Duck can act again on frame 226: the shockwave's run from Battlefield's middle to its
 *   edge (80 units, 32 frames after the second stomp) and then Ganondorf's FinalEnd motion through its last scripted
 *   frame (75, at its motion rates: 66 frames).
 * - SmashWiki's table marks Ganon's hitboxes blockable. Here every Final Smash hit goes through shields
 *   (src/sim/finalSmash.ts), as its Final Smash article says.
 *
 * Both stomps are entities, as Ganon is an article: the Duck never freezes in hitlag, so his timeline stays Ganon's.
 */
export const STOMP = {
  /** Move frame of the first stomp: the slam, on the Ganon article's frame 50. */
  frame: 54,
  /** Frames the slam's hitbox is out (its frames 50 to 54). */
  active: 5,
  /** Frames the burst stays drawn after it lands. */
  lifetime: 24,
  /** The slam's stretch: from 18 to 50 units in front, 25 up, radius 25. */
  from: 18,
  to: 50,
  y: 25,
  radius: 25,
};

export const WAVE = {
  /** Move frame of the second stomp, when the shockwave leaves his feet: the charge's start, on Ganon's frame 124. */
  frame: 128,
  /** Units a frame forward: an estimate (see above). */
  speed: 2.5,
  /** Frames it runs at most: Battlefield's width (160 units) at WAVE.speed. */
  lifetime: 64,
  /** Its body circle, resting on the floor; the hitboxes are placed from the floor under it. */
  radius: 2,
};

/** The Duck can act again on this frame (an estimate, see above). */
export const FAF = 226;

/** How far in front the slam reaches: CPUs use it once someone is inside (finalReach). */
export const REACH = STOMP.to + STOMP.radius;

/** The slam's capsule as three circles along it (18, 34 and 50 in front), each with its numbers. */
const slamBoxes: HitboxDef[] = [STOMP.to, (STOMP.from + STOMP.to) / 2, STOMP.from].map((x, id) => ({
  id,
  x,
  y: STOMP.y,
  radius: STOMP.radius,
  damage: 10,
  angle: 270,
  kbg: 100,
  bkb: 0,
  wbkb: 250,
  hitlag: 2,
  status: PARALYZED,
}));

/** The charge's numbers, the same on every box but the damage. */
const charge = { angle: 42, kbg: 25, bkb: 122, hitlag: 0 } as const;

/**
 * The charge's boxes from the floor (y up): the 45% front box, then each 35% capsule as three circles along it. The
 * body circle sits WAVE.radius above the floor, so the boxes are lowered by that much.
 */
const waveBoxes: HitboxDef[] = [
  { x: 25, y: 12, radius: 10, damage: 45 },
  ...[5, -7.5, -20].map((x) => ({ x, y: 12, radius: 15, damage: 35 })),
  ...[13, -2.5, -18].map((x) => ({ x, y: 30, radius: 18, damage: 35 })),
].map((b, id) => ({ id, ...b, y: b.y - WAVE.radius, ...charge }));

const finalEntity = {
  floor: 'pass',
  wall: 'pass',
  pierce: true,
  transcendent: true,
  reflectable: false,
  absorbable: false,
  kind: 'other',
} satisfies Partial<EntityDef>;

/** The first stomp's burst: the slam's hitboxes on its first frames, drawn a little longer. */
const stomp: EntityDef = {
  ...finalEntity,
  radius: 1,
  lifetime: STOMP.lifetime,
  hits: [{ frames: [1, STOMP.active], boxes: slamBoxes }],
};

const waveHits = [{ frames: [1, WAVE.lifetime] as [number, number], boxes: waveBoxes }];

/**
 * The shockwave on the floor: it runs along the floor it lands on and breaks up where that floor ends, as Ganon's
 * charge stops at the edge of the stage.
 */
const wave: EntityDef = {
  ...finalEntity,
  radius: WAVE.radius,
  lifetime: WAVE.lifetime,
  floor: 'land',
  wall: 'destroy',
  gravity: 0.5,
  maxFall: 3,
  hits: waveHits,
  script({ m, e }) {
    if (e.grounded) e.data.ran = true;
    else if (e.data.ran) destroyEntity(m, e, 'script');
  },
};

/** Stomped in the air, the shockwave flies straight on at his height, as Ganon charges on in his aerial version. */
const waveAir: EntityDef = { ...finalEntity, radius: WAVE.radius, lifetime: WAVE.lifetime, hits: waveHits };

export const finalEntities: Record<string, EntityDef> = { stomp, wave, waveAir };

/**
 * Both versions: the burst on the first stomp, and the shockwave the second sends along the floor or the air. The two
 * are one use of the move, which stales once (src/sim/combat/hits.ts): the shockwave hits at the multiplier the burst
 * connected with, kept in `moveStale` meanwhile, and only stales the move itself when the burst missed.
 */
const stomps: Pick<MoveDef, 'spawn' | 'script'> = {
  spawn: [{ frame: STOMP.frame, entity: 'stomp', x: 0, y: 0 }],
  script(x) {
    const { m, f } = x;
    const burst = m.entities.find((e) => e.owner === f.port && e.kind === 'duck/stomp' && e.move === f.move);
    if (burst?.stale) f.moveStale = burst.stale;
    if (f.actionFrame !== WAVE.frame) return;
    const entity = f.ground ? 'wave' : 'waveAir';
    spawnFromMove(x, { frame: WAVE.frame, entity, x: 0, y: WAVE.radius, vx: WAVE.speed });
    if (f.moveStale) m.entities.at(-1)!.stale = f.moveStale;
  },
};

/** Evolved Stomp, grounded. */
export const finalSmash: MoveDef = {
  kind: 'other',
  faf: FAF,
  final: { range: REACH },
  air: 'finalSmashAir',
  hits: [],
  ...stomps,
};

/** Evolved Stomp in the air: he holds still where he is, as Ganon's aerial version has the same frames. */
export const finalSmashAir: MoveDef = {
  kind: 'other',
  faf: FAF,
  final: { still: true, range: REACH },
  hits: [],
  ...stomps,
};
