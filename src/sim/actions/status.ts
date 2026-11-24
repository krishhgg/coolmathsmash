import { RESPAWN_INVINCIBILITY, RESPAWN_PLATFORM_MAX } from '../constants';
import { stickX, stickY } from '../control';
import type { Ctx } from '../fighter';
import { setAction, type ActionDef } from './registry';

export function respawnPoint(x: Ctx): [number, number] {
  const r = x.stage.geo.respawns;
  return r[x.f.port % r.length]!;
}

export const STATUS: Record<string, ActionDef> = {
  /** Off screen after a KO, waiting for respawnTimer; 'out' when no stocks are left. */
  ko: {
    physics: 'none',
    update(x) {
      const { f } = x;
      if (f.stocks <= 0) return setAction(x, 'out');
      if (--f.respawnTimer <= 0) setAction(x, 'respawn');
    },
  },

  out: { physics: 'none', update() {} },

  /** On the respawn platform until any input or 5 seconds, then 2 seconds of invincibility. */
  respawn: {
    physics: 'none',
    intangible: () => true,
    update(x) {
      const { f, c } = x;
      if (f.actionFrame === 1) {
        const [px, py] = respawnPoint(x);
        f.pos = { x: px, y: py };
        f.prevPos = { x: px, y: py };
        f.vel = { x: 0, y: 0 };
        f.kb = { x: 0, y: 0 };
        f.damage = 0;
        f.ground = null;
        f.ledge = -1;
        f.facing = px > 0 ? -1 : 1;
        f.jumpsUsed = 1;
        f.airDodgeUsed = false;
        f.fastFalling = false;
        f.hitstun = 0;
        return;
      }
      const touched = c.cur.buttons !== 0 || stickX(c) !== 0 || stickY(c) !== 0;
      if (f.actionFrame > RESPAWN_PLATFORM_MAX || (f.actionFrame > 20 && touched)) {
        f.intangible = RESPAWN_INVINCIBILITY;
        f.airFrames = 0;
        setAction(x, 'fall');
      }
    },
  },
};
