import { destroyEntity } from '../../sim/entities/entities';
import type { EntityDef } from '../../sim/entities/types';

/** Half the crate's side: its body circle on the stage and its hurt circle. */
export const CRATE_RADIUS = 5;
/** Crate Drop: the crate stays on the stage this long after it lands (roster: 4 s). */
export const CRATE_FRAMES = 240;
const CRATE_HP = 12;
const crateBody = { radius: CRATE_RADIUS, gravity: 0.2, maxFall: 3.5, floor: 'land', wall: 'stop' } as const;

/**
 * Crate Drop's construction crate. `crateFall` replaces Bob's previous crate on spawn, hits whoever it lands
 * on, and becomes a resting `crate` in place so it keeps riding the surface it landed on.
 */
export const entities: Record<string, EntityDef> = {
  /**
   * The falling crate: Steve's lone falling anvil, 10% with its knockback and its grounded angle (70°; the anvil sends
   * airborne targets at 58°). The roster's 12% KOd 27.7 points before the anvil (snailbob.test.ts). Too heavy to
   * swat, reflect or absorb, and it keeps falling through whoever it hits.
   */
  crateFall: {
    ...crateBody,
    pierce: true,
    transcendent: true,
    reflectable: false,
    absorbable: false,
    hits: [
      {
        frames: [1, 600],
        boxes: [{ id: 0, x: 0, y: 0, radius: CRATE_RADIUS, damage: 10, angle: 70, kbg: 78, bkb: 62 }],
      },
    ],
    script({ m, e }) {
      if (e.age === 1) {
        const old = m.entities.find(
          (other) => other.kind === 'snailbob/crate' && other.owner === e.owner && !other.dead,
        );
        if (old) destroyEntity(m, old, 'script');
      }
      if (!e.grounded) return;
      e.kind = 'snailbob/crate';
      e.hp = CRATE_HP;
      e.lifetime = e.age + CRATE_FRAMES - 1;
    },
  },
  /** The crate at rest: Steve's wood Create Block, 12 HP; hits wear it down without moving it, and it breaks at 0. */
  crate: {
    ...crateBody,
    lifetime: CRATE_FRAMES,
    hp: CRATE_HP,
  },
};
