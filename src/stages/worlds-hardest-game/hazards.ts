import type { Motion, StageHitbox } from '../../sim/stage';

const turn = (frame: number, period: number, phase: number) =>
  2 * Math.PI * ((frame % period) / period + phase);

const lane =
  (period: number, phase: number): Motion =>
  (frame) => [48 * Math.cos(turn(frame, period, phase)), 0];

const orbit =
  (phase: number): Motion =>
  (frame) => {
    const angle = turn(frame, 230, phase);
    return [30 * Math.cos(angle), 30 * Math.sin(angle)];
  };

const patrol = (y: number, motion: Motion): StageHitbox => ({
  x: 0,
  y,
  motion,
  boxes: [
    {
      id: 0,
      x: 0,
      y: 0,
      radius: 3.4,
      damage: 7,
      angle: 30,
      kbg: 100,
      bkb: 0,
      wbkb: 65,
      direction: 'away',
    },
  ],
});

export const PATROLS = [
  patrol(10, lane(160, 0.5)),
  patrol(40, lane(200, 0)),
  patrol(35, orbit(0.1)),
  patrol(35, orbit(0.6)),
];
