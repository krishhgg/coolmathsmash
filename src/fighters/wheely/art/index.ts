import { shapesBounds } from '../../../render/rig/geometry';
import { symbolsToSvg } from '../../../render/rig/svg';
import type { FighterArt, PathShape } from '../../../render/rig/types';
import { LEDGE_GRIP, clips } from './clips';
import { palettes } from './palettes';
import { BODY, EXHAUST, EYES, WHEEL_X, WHEEL_Y, shift } from './parts';
import { rig } from './rig';

/** The parked car as one drawing (pipe, body, wheels, eyes) in a square viewBox, for the HUD icon. */
function icon(): string {
  const s = rig.symbols as Record<string, PathShape[]>;
  const car = [
    ...shift(s.pipe!, EXHAUST[0], EXHAUST[1]),
    ...shift(s.body!, BODY[0], BODY[1]),
    ...[-WHEEL_X, WHEEL_X].flatMap((x) => [
      ...shift(s.wheel!, x, WHEEL_Y),
      ...shift(s.wheelShine!, x, WHEEL_Y),
    ]),
    ...shift(s.eyes!, EYES[0], EYES[1]),
  ];
  const [x0, y0, x1, y1] = shapesBounds(car);
  const size = Math.max(x1 - x0, y1 - y0) + 0.6;
  return symbolsToSvg({ car }, ['car'], palettes.default, [
    (x0 + x1 - size) / 2,
    (y0 + y1 - size) / 2,
    size,
    size,
  ]);
}

/** Wheely (Wheely, Pegas Games, 2012), drawn by hand in the game's Flash style. Plain data: no Pixi imports. */
export const art: FighterArt = {
  height: 11,
  rig,
  clips,
  palettes,
  icon: icon(),
  ledgeGrip: LEDGE_GRIP,
};
