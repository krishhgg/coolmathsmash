import { symbolsToSvg } from '../../../render/rig/svg';
import type { FighterArt } from '../../../render/rig/types';
import { attacks } from './attacks';
import { boxDropClips } from './box-drop';
import { LEDGE_GRIP, clips } from './clips';
import { finalSmashClips, tunnelFlipView } from './finalSmash';
import { costumeSwaps, palettes } from './palettes';
import { iconAntennae } from './parts';
import { floorContact, shortTurns } from './poses';
import { rig } from './rig';
import { strafeDashClips } from './strafe-dash';

/**
 * Ground clips whose tweens between planted poses dip a foot or a knee into the floor: keyed on every frame and
 * lifted there (poses.ts `floorContact`).
 */
const FLOORED = new Set([
  'run',
  'runBrake',
  'spotDodge',
  'grabRelease',
  'jabRapid',
  'ftilt',
  'dtilt',
  'fsmash',
  'dsmash',
  'pivotGrab',
  'pummel',
  'fthrow',
  'sideB',
  'neutralB',
  'dashAttack',
  'bthrow',
  'finalSmash',
]);

/** Every clip turns each part the short way; the floored ones are lifted out of the floor. */
const drawn = Object.fromEntries(
  Object.entries({ ...clips, ...attacks, ...boxDropClips, ...strafeDashClips, ...finalSmashClips }).map(
    ([name, clip]) => {
      const short = { ...clip, keys: shortTurns(clip.keys) };
      return [name, FLOORED.has(name) ? floorContact(short) : short];
    },
  ),
);

/** The Runner (Run, Run 2 and Run 3, Joseph Cloutier, 2008-2014), drawn from scratch. Plain data: no Pixi. */
export const art: FighterArt = {
  height: 13,
  rig,
  clips: drawn,
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
