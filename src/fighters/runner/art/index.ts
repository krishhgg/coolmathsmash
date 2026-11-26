import { symbolsToSvg } from '../../../render/rig/svg';
import type { FighterArt } from '../../../render/rig/types';
import { attacks } from './attacks';
import { boxDropClips } from './box-drop';
import { LEDGE_GRIP, clips } from './clips';
import { finalSmashClips, tunnelFlipView } from './finalSmash';
import { costumeSwaps, palettes } from './palettes';
import { iconAntennae } from './parts';
import { rig } from './rig';
import { strafeDashClips } from './strafe-dash';

/** The Runner (Run, Run 2 and Run 3, Joseph Cloutier, 2008-2014), drawn from scratch. Plain data: no Pixi. */
export const art: FighterArt = {
  height: 13,
  rig,
  clips: { ...clips, ...attacks, ...boxDropClips, ...strafeDashClips, ...finalSmashClips },
  palettes,
  costumeSwaps,
  ledgeGrip: LEDGE_GRIP,
  viewFlips: { finalSmash: tunnelFlipView },
  icon: symbolsToSvg(
    { ...rig.symbols, iconAntennae },
    ['iconAntennae', 'body', 'faceFront'],
    palettes.default,
    [-5.8, -7.11, 11.6, 11.6],
  ),
};
