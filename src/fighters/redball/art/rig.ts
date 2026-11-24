import type { Rig } from '../../../render/rig/types';
import {
  MOUTH,
  R,
  TONGUE,
  ballFill,
  ballLine,
  ballShade,
  ballShine,
  brows,
  effects,
  eyes,
  mouths,
  tongue,
  tongueTip,
} from './parts';

/**
 * Red Ball's skeleton. He is all body, so the bones are about squash, stretch and spin:
 *
 * - `base` sits on the floor under him: scaling it squashes and stretches him against the ground with his bottom
 *   planted (jump squat, landings), and moving it hops or slides the whole ball.
 * - `core` is the ball's centre: scaling it squashes him about his middle in the air; the ink, fill, rim shade and
 *   gloss hang here, so the light stays put while he rolls.
 * - `spin` turns the face: rolling, spinning and leaning are all rotations of it.
 * - `face` slides and foreshortens the face (turning round, looking back); `tongue` stretches out of the mouth
 *   with `tongueTip` riding on its end.
 * - `fx1`-`fx4` are free effect bones placed in rig space (dust, speed lines, rings, stars, the ledge bite).
 */
export const rig: Rig = {
  bones: [
    { name: 'root', x: 0, y: 0 },
    { name: 'base', parent: 'root', x: 0, y: 0 },
    { name: 'core', parent: 'base', x: 0, y: -R },
    { name: 'spin', parent: 'core', x: 0, y: 0 },
    { name: 'face', parent: 'spin', x: 0, y: 0 },
    { name: 'tongue', parent: 'face', x: MOUTH[0], y: MOUTH[1], localScale: true },
    { name: 'tongueTip', parent: 'tongue', x: TONGUE, y: 0 },
    { name: 'fx1', parent: 'root', x: 0, y: 0 },
    { name: 'fx2', parent: 'root', x: 0, y: 0 },
    { name: 'fx3', parent: 'root', x: 0, y: 0 },
    { name: 'fx4', parent: 'root', x: 0, y: 0 },
  ],
  slots: [
    { name: 'fxBack', bone: 'fx3', symbol: null },
    { name: 'ballLine', bone: 'core', symbol: 'ballLine' },
    { name: 'ballFill', bone: 'core', symbol: 'ballFill' },
    { name: 'ballShade', bone: 'core', symbol: 'ballShade' },
    { name: 'eyes', bone: 'face', symbol: 'eyesDetermined' },
    { name: 'brow', bone: 'face', symbol: 'browAngry' },
    { name: 'mouth', bone: 'face', symbol: 'mouthSmirk' },
    { name: 'shine', bone: 'core', symbol: 'ballShine' },
    { name: 'tongue', bone: 'tongue', symbol: null },
    { name: 'tongueTip', bone: 'tongueTip', symbol: null },
    { name: 'fx1', bone: 'fx1', symbol: null },
    { name: 'fx2', bone: 'fx2', symbol: null },
    { name: 'fx4', bone: 'fx4', symbol: null },
  ],
  symbols: {
    ballLine,
    ballFill,
    ballShade,
    ballShine,
    ...eyes,
    ...brows,
    ...mouths,
    tongue,
    tongueTip,
    ...effects,
  },
};
