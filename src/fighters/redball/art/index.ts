import { symbolsToSvg } from '../../../render/rig/svg';
import type { FighterArt } from '../../../render/rig/types';
import { RAIN, RAIN_FRAMES, ballVelocity } from '../finalSmash';
import { attacks } from './attacks';
import { LEDGE_GRIP, clips } from './clips';
import { finalSmashClip } from './finalSmash';
import { R } from './parts';
import { palettes } from './palettes';
import { rig } from './rig';

/**
 * Red Ball's art: a hand-drawn ball rig (no limbs: squash, stretch, roll and a tongue) with every canonical clip
 * and one clip per move. Plain data: no Pixi imports.
 */
export const art: FighterArt = {
  height: 11,
  rig,
  /** Tongue Lash in the air (sideBAir) has the ground one's timing and tongue; only its knockback differs. */
  clips: { ...clips, ...attacks, sideBAir: attacks.sideB, finalSmash: finalSmashClip },
  palettes,
  /** The Evil Box wears the box body and its mottled shade, in any clip that does not swap the body itself. */
  costumeSwaps: {
    evil: { ballLine: 'cubeLine', ballFill: 'cubeFill', ballShade: 'evilShade', costumeMouth: 'evilGrin' },
  },
  icon: symbolsToSvg(
    rig.symbols,
    ['ballLine', 'ballFill', 'ballShade', 'eyesDetermined', 'browAngry', 'mouthSmirk', 'ballShine'],
    palettes.default,
    [-R - 0.3, -R - 0.3, 2 * R + 0.6, 2 * R + 0.6],
  ),
  ledgeGrip: LEDGE_GRIP,
  projectiles: {
    /**
     * Ball Rain's balls: drawn at Red Ball's size and scaled up to their radius-16 hitbox. The lab shows the first
     * one dropping in front of him on its frame, as it falls on Battlefield.
     */
    ball: {
      symbols: rig.symbols,
      symbol: 'fxRainBall',
      scale: RAIN.radius / R,
      preview: { finalSmash: { frame: RAIN_FRAMES[0]!, x: 40, y: 90, ...preview() } },
    },
  },
};

/** The lab preview's motion: the second ball's (the first to fly forward), from Battlefield's drop point. */
function preview() {
  const v = ballVelocity(1, 192 - RAIN.drop);
  return { vx: v.x, vy: v.y };
}
