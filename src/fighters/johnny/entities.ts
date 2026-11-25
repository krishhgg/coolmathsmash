import type { EntityDef } from '../../sim/entities/types';

/**
 * Laser Gun's shot: Falco's Blaster laser in Ultimate (SmashWiki, Falco (SSBU)/Neutral special): 4.6 units a frame
 * for 27 frames, so it reaches 26 x 4.6 = 119.6 units past the muzzle.
 */
export const LASER = { speed: 4.6, lifetime: 27, radius: 1.44 } as const;

/**
 * Johnny's projectiles. The laser's hit is Falco's: 3%, Sakurai angle, 0 base and 100 growth on 20 set knockback,
 * so it flinches without launching at any percent; x0.1 hitlag, electric. It never clanks (Falco's laser is
 * transcendent), is used up by its first hit and vanishes against the stage.
 */
export const entities: Record<string, EntityDef> = {
  laser: {
    radius: LASER.radius,
    lifetime: LASER.lifetime,
    transcendent: true,
    hits: [
      {
        frames: [1, LASER.lifetime],
        boxes: [
          {
            id: 0,
            x: 0,
            y: 0,
            radius: LASER.radius,
            damage: 3,
            angle: 361,
            kbg: 100,
            bkb: 0,
            wbkb: 20,
            hitlag: 0.1,
            effect: 'electric',
          },
        ],
      },
    ],
  },
};
