import type { AnimClip } from '../../../render/rig/types';
import { BOX_DROP } from '../timing';
import { AIR, READY, TUCK } from './clips';
import { HURT, key, mix } from './poses';
import { rig } from './rig';

const { impact, airEnd, cancelFrom, release, groundedFaf, aerialFaf } = BOX_DROP;
const transform = { ...Object.fromEntries(rig.slots.map(({ name }) => [name, null])), fx1: 'crate' };
const cancelReady = { ...transform, fx1: 'crateReady' };

export const boxDropClips: Record<string, AnimClip> = {
  downB: {
    length: groundedFaf - 1,
    active: [[impact, impact]],
    keys: [
      key(0, READY),
      key(
        impact - 2,
        mix(TUCK, { body: { sx: 1.12, sy: 0.75, y: 1.2 }, fx3: { y: -4, sx: 1.65, sy: 1.25 } }),
        {
          swaps: { fxBack: 'contact' },
        },
      ),
      key(
        impact,
        { fx1: { sx: 1.17, sy: 0.8 }, fx3: { x: 0.1, sx: 6, sy: 1.8 } },
        { swaps: { ...transform, fxBack: 'dust' }, ease: 'out' },
      ),
      key(impact + 5, { fx1: { sx: 0.98, sy: 1.03 }, fx3: { sx: 7, sy: 0.3 } }, { swaps: transform }),
      key(impact + 10, {}),
      key(cancelFrom - 1, {}),
      key(cancelFrom, { fx1: { sx: 1.035, sy: 0.97 } }, { swaps: cancelReady }),
      key(cancelFrom + 5, {}),
      key(release - 1, {}),
      key(
        release,
        { fx1: { y: -0.5, rot: 4, sy: 1.05 }, fx3: { y: -3.2, sx: 1.4, sy: 1.55 } },
        {
          swaps: { ...cancelReady, fxBack: 'contact' },
          ease: 'out',
        },
      ),
      key(release + 3, mix(TUCK, { body: { y: 0.9, rot: -15 } }), { swaps: HURT, ease: 'out' }),
      key(release + 10, mix(READY, { body: { y: 0.7, rot: 8 } }), { swaps: {} }),
      key(groundedFaf - 1, READY),
    ],
  },
  downBAir: {
    length: aerialFaf - 1,
    active: [[impact, airEnd]],
    keys: [
      key(0, AIR),
      key(impact - 5, mix(TUCK, { body: { rot: -75 } }), { ease: 'out' }),
      key(
        impact - 1,
        { fx1: { sy: 0.88 }, fx3: { y: -6.8, sx: 1.35, sy: 1.4 } },
        {
          swaps: { ...transform, fxBack: 'contact' },
        },
      ),
      key(
        impact,
        { fx1: { sy: 1.06 }, fx3: { y: -9.4, sx: 8, sy: 4.5, rot: 90 } },
        { swaps: { ...transform, fxBack: 'streak' } },
      ),
      key(airEnd + 2, { fx1: { sy: 1.02 }, fx3: { y: -9.4, sx: 12, sy: 3.9, rot: 90 } }),
      key(airEnd + 7, {}, { swaps: transform }),
      key(aerialFaf - 1, {}),
    ],
  },
};
