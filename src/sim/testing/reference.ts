import { defineFighter } from '../../fighters/types';

/**
 * Mario's Smash Ultimate attributes (from the game's fighter params, as tabulated by the SSBU calculator),
 * used as a known-good reference in physics tests. Not a playable fighter.
 */
export const marioReference = defineFighter({
  id: 'reference-mario',
  name: 'Reference (Mario)',
  series: 'Super Smash Bros. Ultimate',
  stats: {
    weight: 98,
    height: 15,
    width: 8,
    walkSpeed: 1.155,
    walkAccelBase: 0.105,
    walkAccelAdd: 0.105,
    groundFriction: 0.102,
    dashInitialSpeed: 1.936,
    dashFrames: 11,
    runSpeed: 1.76,
    runAccelBase: 0.044,
    runAccelAdd: 0.10978,
    airSpeed: 1.208,
    airAccelBase: 0.01,
    airAccelAdd: 0.07,
    airFriction: 0.015,
    gravity: 0.087,
    fallSpeed: 1.5,
    fastFallSpeed: 2.4,
    damageFlyTopGravity: 0.074928,
    jumpSquat: 3,
    fullHopHeight: 36.33,
    shortHopHeight: 17.54,
    doubleJumpHeight: 36.33,
    jumps: 2,
    ledgeJumpHeight: 38.165,
    softLandingLag: 1,
    hardLandingLag: 3,
    shieldSize: 9.7,
    rollDistance: 28,
    airDodgeSpeed: 2.8,
  },
  /** Test moves with round numbers (not Mario's real frame data). `probe` is research vector kb10's hit. */
  moves: {
    probe: {
      kind: 'other',
      faf: 30,
      hits: [
        {
          frames: [1, 3],
          boxes: [{ id: 0, x: 8, y: 8, radius: 8, damage: 12, angle: 45, kbg: 100, bkb: 30 }],
        },
      ],
    },
    flat: {
      kind: 'other',
      faf: 30,
      hits: [
        {
          frames: [1, 3],
          boxes: [{ id: 0, x: 8, y: 8, radius: 8, damage: 12, angle: 0, kbg: 100, bkb: 60 }],
        },
      ],
    },
    jab: {
      kind: 'other',
      faf: 18,
      hits: [
        {
          frames: [2, 3],
          boxes: [{ id: 0, x: 7, y: 9, radius: 4, damage: 2.5, angle: 361, kbg: 30, bkb: 20 }],
        },
      ],
    },
    nair: {
      kind: 'aerial',
      faf: 45,
      landingLag: 6,
      autoCancel: [
        [1, 2],
        [39, 45],
      ],
      hits: [
        {
          frames: [3, 30],
          boxes: [{ id: 0, x: 0, y: 8, radius: 7, damage: 8, angle: 361, kbg: 100, bkb: 10 }],
        },
      ],
    },
  },
});
