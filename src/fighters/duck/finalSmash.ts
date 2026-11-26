import { destroyEntity, spawnFromMove } from '../../sim/entities/entities';
import type { EntityDef } from '../../sim/entities/types';
import { PARALYZED } from '../bob-the-robber/entities';
import type { HitboxDef, MoveDef } from '../types';
import { FAF, REACH, STOMP, WAVE, WAVE_BOXES } from './finalSmashData';

export { FAF, REACH, STOMP, WAVE } from './finalSmashData';

/**
 * Evolved Stomp, the Duck's Final Smash, on Ganon, The Demon King: its moves and the two stomps' entities. The
 * numbers, their sources and the estimates are in finalSmashData.ts.
 */

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
 * The charge's boxes (WAVE_BOXES, from the floor) on the shockwave: its body circle sits WAVE.radius above the floor,
 * so the boxes are lowered by that much.
 */
const waveBoxes: HitboxDef[] = WAVE_BOXES.map((b, id) => ({ id, ...b, y: b.y - WAVE.radius, ...charge }));

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
