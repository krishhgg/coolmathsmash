import type { AnimClip } from '../../../render/rig/types';
import {
  AIR_DODGE_NEUTRAL,
  DOUBLE_JUMP_FRAMES,
  GETUP_ROLL,
  GETUP_STAND,
  GRAB,
  LEDGE_ATTACK,
  LEDGE_CATCH_FRAMES,
  LEDGE_CLIMB,
  LEDGE_JUMP,
  LEDGE_ROLL,
  ROLL_BACK,
  ROLL_FORWARD,
  RUN_BRAKE_FRAMES,
  RUN_TURN_FRAMES,
  SHIELD_DROP_FRAMES,
  SPOT_DODGE,
  TECH_IN_PLACE,
  TECH_ROLL,
} from '../../../sim/constants';
import { DASH, RUN, WALK } from '../tipping';
import {
  LIE,
  STAND,
  about,
  bake,
  centre,
  edge,
  ground,
  landing,
  other,
  puff,
  rest,
  rock,
  settle,
  shift,
  spin,
  squash,
  tipFrame,
  tl,
  type Form,
  type Frame,
  type Place,
} from './bake';
import { HALF_W } from './symbols';

/** Smooth step, as the engine eases ledge getups. */
const smooth = (t: number) => t * t * (3 - 2 * t);

/** Share of a dodge's distance covered by the end of each frame of its movement window (the engine's rollWeights). */
function travelled([from, to]: readonly [number, number], frame: number): number {
  const n = to - from + 1;
  const w = Array.from({ length: n }, (_, i) => Math.sin((Math.PI * (i + 0.5)) / n));
  const sum = w.reduce((a, b) => a + b, 0);
  let x = 0;
  for (let i = 0; i <= Math.min(frame - from, n - 1); i++) x += w[i]!;
  return x / sum;
}

/** Up and down the screen for `form` at rest: the vertical squash factor goes to whichever axis is upright. */
const air = (form: Form, deg: number, h = 1, v = 1, lift = 0, x = 0): Place =>
  spin(form, x, -form.hh * v - lift, deg, squash(form, h, v));

/**
 * A turn in place about the block's middle with its lowest corner kept on the floor; `h` and `v` squash it across
 * and up the screen whichever way it is turned.
 */
export function turnIn(form: Form, deg: number, h = 1, v = 1, x = 0, lift = 0): Place {
  const r = ((form.base + deg) * Math.PI) / 180;
  const flat = Math.abs(Math.sin(r)) > Math.abs(Math.cos(r));
  return ground(form, deg, { sx: flat ? v : h, sy: flat ? h : v, x, lift });
}

/** Speed lines trailing a spinning block, turned with it. */
const arcs = (p: Place) => {
  const [x, y] = centre(p);
  return { sym: 'arcs', x, y, rot: p.rot + p.base };
};

/**
 * One period of a tip gait (walk, run): `t` frames into the period the block is tipping (form flipped at the
 * balance point by the simulation) or settling after the landing, with dust puffing out of both ends.
 */
function gait(form: Form, t: number, { tip, period }: { tip: number; period: number }): Frame {
  const running = tip === RUN.tip;
  if (t < tip - 1) {
    return {
      block: tipFrame(form, t, tip),
      fx:
        running && t >= 2
          ? { back: { sym: 'streak', x: -form.hw, y: -form.hh, sx: 0.65, sy: 0.55 } }
          : undefined,
    };
  }
  const k = t - tip + 1;
  const life = period - tip + 1;
  return {
    block: k ? settleRebound(form, k - 1) : tipFrame(form, t, tip),
    fx: life > 1 ? landing(0, form.hw, k, running ? 1.05 : 0.65, life) : {},
  };
}

/** The settle after a landing, swinging 2.5 degrees onto the face that just landed before it comes to rest. */
function settleRebound(form: Form, k: number): Place {
  const p = settle(form, k, {}, 0.8);
  return rock(
    form,
    2.5 *
      tl(k, [
        [0, 1, 'out'],
        [4, -0.35, 'inOut'],
        [8, 0],
      ]),
    { sx: p.sx, sy: p.sy },
  );
}

/** Where the ledge's corner is in rig space while hanging: the engine's hang position, and the art's ledge grip. */
export const grip = (form: Form): [number, number] => [form.hw + 0.5, -0.85 * 2 * form.hh];

/** Hanging by the top front corner, swung `deg` away from the wall. */
function hang(form: Form, deg: number, v = 1): Place {
  const [gx, gy] = grip(form);
  const p = shift(rest(form, squash(form, 1, v)), gx - form.hw, gy + 2 * form.hh * v);
  return about(p, gx, gy, deg);
}

/**
 * A ledge getup: `place` is drawn in the hanging rig space (ledge corner at the grip), and the engine meanwhile
 * lifts the origin from the hang position to `to` (same space), x along a smooth step and y `rise` times faster.
 */
function getup(place: Place, frame: number, moveEnd: number, to: [number, number], rise: number): Place {
  const s = smooth(Math.min(1, frame / moveEnd));
  return shift(place, -to[0] * s, -to[1] * Math.min(1, rise * s));
}

/** Flipping up over the ledge corner: `deg` from 0 (hanging) to 180 (on the stage, the corner under its back edge). */
const flipUp = (form: Form, deg: number) => {
  const [gx, gy] = grip(form);
  return about(hang(form, 0), gx, gy, deg);
};

/** On the stage in the hanging rig space, centred `dx` past the corner, at rest in `form` (squashable). */
const onStage = (form: Form, dx: number, h = 1, v = 1) => {
  const [gx, gy] = grip(form);
  return shift(rest(form, squash(form, h, v)), gx + dx, gy);
};

/** Two small stars circling above the block (dizzy, knocked down). */
function stars(f: number, top: number, period = 40, r = 5): Frame['fx'] {
  const a = (2 * Math.PI * f) / period;
  return {
    starA: { sym: 'star', x: Math.cos(a) * r, y: top + Math.sin(a) * r * 0.3, rot: f * 6 },
    starB: {
      sym: 'star',
      x: -Math.cos(a) * r,
      y: top - Math.sin(a) * r * 0.3,
      rot: -f * 6,
      sx: 0.8,
      sy: 0.8,
    },
  };
}

/** The canonical action clips for one form (src/fighters/bloxorz/art/index.ts puts both forms together). */
export function actionClips(form: Form): Record<string, AnimClip> {
  const F = form;
  const O = other(F);
  const top = -2 * F.hh;

  const breathe = (f: number, period: number) => {
    const b = 0.5 - 0.5 * Math.cos((2 * Math.PI * f) / period);
    return squash(F, 1 + 0.006 * b, 1 - 0.014 * b);
  };

  const down = (f: number): Frame => ({
    block: turnIn(F, F === STAND ? 90 : 0, 1 + 0.01 * Math.sin((2 * Math.PI * f) / 40), 1),
    fx: stars(f, -2 * HALF_W - 4, 40, 6),
  });

  const clips: Record<string, AnimClip> = {
    idle: bake(120, true, (f) => ({
      block: rock(
        F,
        tl(f, [
          [0, 0],
          [84, 0, 'out'],
          [90, 2.4],
          [97, -1],
          [103, 0.35],
          [110, 0],
        ]),
        breathe(f, 60),
      ),
    })),
    walk: bake(WALK.period, true, (c) => gait(F, (c + WALK.period - 1) % WALK.period, WALK)),
    run: bake(RUN.period, true, (c) => gait(F, (c + RUN.period - 1) % RUN.period, RUN)),
    dash: bake(DASH.period, false, (a) => gait(F, a - 1, DASH)),
    runBrake: bake(RUN_BRAKE_FRAMES, false, (f) => ({
      block: rock(
        F,
        tl(f, [
          [0, 0, 'out'],
          [4, -7, 'inOut'],
          [9, 2],
          [14, 0],
        ]),
      ),
      fx: { dustB: puff(-F.hw, 0, f - 2, -1, 0.7) },
    })),
    turn: bake(RUN_TURN_FRAMES, false, (f) => {
      const v = tl(f, [
        [0, 1],
        [3, 1.05, 'in'],
        [9, 0.9, 'out'],
        [RUN_TURN_FRAMES, 1],
      ]);
      return {
        block: rest(F, {
          ...squash(F, 1 + (1 - v) * 0.5, v),
          lift: tl(f, [
            [0, 0, 'out'],
            [4, 1.6, 'in'],
            [9, 0],
          ]),
        }),
      };
    }),
    crouch:
      F === STAND
        ? bake(10, false, (f) => ({
            block:
              f <= 5
                ? turnIn(
                    F,
                    tl(f, [
                      [0, 0, 'in'],
                      [5, 90],
                    ]),
                  )
                : turnIn(
                    F,
                    90,
                    1,
                    1 -
                      0.12 *
                        tl(f, [
                          [5, 1, 'out'],
                          [8, 0],
                        ]),
                  ),
            fx: landing(0, LIE.hw, f - 5, 0.8),
          }))
        : bake(10, false, (f) => {
            const v = tl(f, [
              [0, 0.84, 'out'],
              [3, 0.98],
              [6, 0.95],
            ]);
            return { block: rest(F, squash(F, 1 + (1 - v) * 0.45, v)), fx: landing(0, F.hw, f, 0.8) };
          }),
    jumpSquat: bake(3, false, (f) => {
      const v = tl(f, [
        [0, 1, 'out'],
        [3, 0.82],
      ]);
      return { block: rest(F, squash(F, 1 + (1 - v) * 0.5, v)) };
    }),
    jump: bake(40, false, (f) => {
      const v = tl(f, [
        [0, 1.16, 'out'],
        [9, 0.99],
        [14, 1],
      ]);
      const pitch = tl(f, [
        [0, 0],
        [6, -13, 'inOut'],
        [12, -8, 'inOut'],
        [21, 22, 'out'],
        [27, 26, 'inOut'],
        [33, 12],
        [37, 4],
        [40, 2],
      ]);
      return {
        block: spin(F, 0, -F.hh * v - 1.5, pitch, squash(F, 1 - (v - 1) * 0.5, v)),
        fx: { back: f < 8 ? { sym: 'lines', x: 0, y: 0, sx: 1, sy: 1 - f / 8 } : undefined },
      };
    }),
    doubleJump: bake(DOUBLE_JUMP_FRAMES, false, (f) => {
      const deg = tl(f, [
        [0, 0, 'out'],
        [20, 360],
        [30, 360],
      ]);
      const y =
        F === STAND
          ? -12
          : tl(f, [
              [0, -6, 'out'],
              [4, -12],
              [20, -12, 'inOut'],
              [30, -6],
            ]);
      const v = tl(f, [
        [0, 1.1, 'out'],
        [8, 1],
      ]);
      const p = spin(F, 0, y, deg, squash(F, 1 - (v - 1) * 0.5, v));
      return { block: p, fx: { back: f >= 1 && f <= 15 ? arcs(p) : undefined } };
    }),
    fall: bake(40, true, (f) => ({
      block: ground(F, 28 + 8 * Math.sin((Math.PI * f) / 20) ** 2),
    })),
    helpless: bake(48, true, (f) => ({
      block: air(F, 9 * Math.sin((2 * Math.PI * f) / 48), 1, 1),
      fx: stars(f, top - 3, 48, 4),
    })),
    land: bake(7, false, (f) => {
      if (f < 3) {
        return {
          block: edge(
            F,
            1,
            tl(f, [
              [0, 24, 'in'],
              [3, 0],
            ]),
          ),
          fx: { dustA: puff(F.hw, 0, f, 1, 0.72, 5) },
        };
      }
      return { block: settle(F, f - 3, {}, 1.3), fx: landing(0, F.hw, f - 3, 1.05) };
    }),
    shield: bake(8, false, (f) => {
      const v = tl(f, [
        [0, 1, 'out'],
        [5, 0.82],
      ]);
      return { block: rest(F, squash(F, 1 + (1 - v) * 0.4, v)) };
    }),
    shieldDrop: bake(SHIELD_DROP_FRAMES, false, (f) => {
      const v = tl(f, [
        [0, 0.9, 'out'],
        [5, 1.03],
        [SHIELD_DROP_FRAMES, 1],
      ]);
      return { block: rest(F, squash(F, 1 + (1 - v) * 0.4, v)) };
    }),
    shieldBreak: bake(40, false, (f) => {
      const p = air(
        F,
        tl(f, [
          [0, 0, 'out'],
          [40, -180],
        ]),
        1,
        tl(f, [
          [0, 1.08],
          [10, 1],
        ]),
      );
      return { block: p, fx: { back: f < 14 ? arcs(p) : undefined, ...stars(f, top - 4, 40, 5) } };
    }),
    dizzy: bake(60, true, (f) => ({
      block: rock(F, 7 * Math.sin((2 * Math.PI * f) / 60)),
      fx: stars(f, top - 3.5, 40, 5),
    })),
    /** Flops onto its side as the intangibility starts, holds there through it, and stands back up. */
    spotDodge: bake(SPOT_DODGE.faf - 1, false, (f) => {
      const [, safe] = SPOT_DODGE.intangible;
      const up = safe + 5;
      const deg = tl(f, [
        [0, 0],
        [2, 0, 'in'],
        [7, 90, 'out'],
        [safe, 90, 'in'],
        [up, 180, 'out'],
        [SPOT_DODGE.faf - 1, 180],
      ]);
      const v =
        1 -
        0.1 *
          tl(f, [
            [6, 0],
            [7, 1, 'out'],
            [10, 0],
            [up - 1, 0],
            [up, 1, 'out'],
            [SPOT_DODGE.faf - 1, 0],
          ]);
      return {
        block: turnIn(F, deg, 1 + (1 - v) * 0.5, v),
        fx: f < safe + 3 ? landing(0, O.hw, f - 7, 0.7) : landing(0, F.hw, f - up, 0.7),
      };
    }),
    rollForward: bake(ROLL_FORWARD.faf - 1, false, (f) => roll(f, 1, ROLL_FORWARD.move)),
    rollBack: bake(ROLL_BACK.faf - 1, false, (f) => roll(f, -1, ROLL_BACK.move)),
    airDodge: bake(AIR_DODGE_NEUTRAL.faf - 1, false, (f) => {
      const p = air(
        F,
        tl(f, [
          [0, 0],
          [3, 0, 'out'],
          [24, 180],
          [AIR_DODGE_NEUTRAL.faf - 1, 180],
        ]),
        1,
        tl(f, [
          [0, 1],
          [3, 0.94, 'out'],
          [10, 1],
        ]),
      );
      return { block: p, fx: { back: f >= 4 && f <= 18 ? arcs(p) : undefined } };
    }),

    ledgeCatch: bake(LEDGE_CATCH_FRAMES, false, (f) => ({
      block: hang(
        F,
        tl(f, [
          [0, 52, 'in'],
          [4, 30, 'out'],
          [6, 37],
          [LEDGE_CATCH_FRAMES, 34],
        ]),
        tl(f, [
          [3, 1],
          [4, 1.03],
          [LEDGE_CATCH_FRAMES, 1],
        ]),
      ),
    })),
    ledgeHang: bake(60, true, (f) => ({
      block: hang(F, 34 + 1.6 * Math.sin((2 * Math.PI * f) / 60), 1.015),
    })),
    ledgeClimb: bake(LEDGE_CLIMB.faf - 1, false, (f) => {
      const { moveEnd } = LEDGE_CLIMB;
      const target: [number, number] = [grip(F)[0] + F.hw + 2, grip(F)[1]];
      const deg = tl(f, [
        [0, 0],
        [3, -3, 'inOut'],
        [12, 90, 'inOut'],
        [20, 180, 'in'],
      ]);
      const land = f - 20;
      const place =
        land < 0
          ? flipUp(F, deg)
          : onStage(
              F,
              tl(f, [
                [20, F.hw],
                [30, F.hw + 2, 'inOut'],
              ]),
              ...hv(land),
            );
      return {
        block: getup(place, f, moveEnd, target, 1.6),
        fx: land >= 0 ? landingAt(place, f, moveEnd, target, land) : undefined,
      };
    }),
    ledgeRoll: bake(LEDGE_ROLL.faf - 1, false, (f) => {
      const { moveEnd, distance } = LEDGE_ROLL;
      const [gx, gy] = grip(F);
      const target: [number, number] = [gx + distance, gy];
      let place: Place;
      if (f < 18)
        place = flipUp(
          F,
          tl(f, [
            [0, 0],
            [3, -3, 'inOut'],
            [11, 90, 'inOut'],
            [18, 180, 'in'],
          ]),
        );
      else if (f < 30) {
        const t = tl(f, [
          [19, 0, 'in'],
          [29, 90],
        ]);
        place = shift(edge(F, 1, t), gx + F.hw, gy);
      } else if (f < 42) {
        const end = gx + distance;
        const from = gx + 2 * F.hw + O.hw;
        place = shift(
          turnIn(
            F,
            tl(f, [
              [30, 90, 'inOut'],
              [41, 0],
            ]),
            1,
            1,
            tl(f, [
              [30, from],
              [41, end],
            ]),
          ),
          0,
          gy,
        );
      } else place = shift(settle(F, f - 42), target[0], gy);
      return { block: getup(place, f, moveEnd, target, 1.6) };
    }),
    ledgeJump: bake(20, false, (f) => {
      const [gx, gy] = grip(F);
      const target: [number, number] = [gx + F.hw, gy - 1];
      const u = tl(f, [
        [0, 0, 'out'],
        [LEDGE_JUMP.rise, 1],
      ]);
      const v = tl(f, [
        [0, 1],
        [4, 1.14, 'out'],
        [12, 1.04],
        [20, 1],
      ]);
      const from = hang(F, 0);
      const to = shift(air(F, 0, 1 - (v - 1) * 0.5, v), target[0], target[1]);
      const place = {
        ...to,
        px: from.px + (to.px - from.px) * u,
        py: from.py + (to.py - from.py) * Math.min(1, u * 1.3),
      };
      return {
        block: getup(place, f, LEDGE_JUMP.rise, target, 1),
        fx: { back: f > 3 && f < 12 ? { sym: 'lines', x: 0, y: 0 } : undefined },
      };
    }),
    ledgeAttack: bake(LEDGE_ATTACK.faf - 1, false, (f) => {
      const { moveEnd } = LEDGE_ATTACK;
      const [gx, gy] = grip(F);
      const target: [number, number] = [gx + F.hw + 2, gy];
      let place: Place;
      if (f < 14)
        place = flipUp(
          F,
          tl(f, [
            [0, 0],
            [2, -3, 'inOut'],
            [8, 90, 'inOut'],
            [14, 180, 'in'],
          ]),
        );
      else {
        const x =
          gx +
          tl(f, [
            [14, F.hw],
            [20, F.hw + 2],
          ]);
        const deg =
          F === STAND
            ? tl(f, [
                [14, 0],
                [19, -8, 'inOut'],
                [23, 34, 'out'],
                [27, 36, 'inOut'],
                [36, -3],
                [42, 0],
              ])
            : tl(f, [
                [14, 0],
                [19, -24, 'out'],
                [23, 0, 'in'],
                [42, 0],
              ]);
        place = shift(rock(F, deg), x, gy);
      }
      return { block: getup(place, f, moveEnd, target, 1.6) };
    }),

    hitstun: bake(20, false, (f) => {
      const deg = tl(f, [
        [0, -14, 'out'],
        [6, -18, 'inOut'],
        [20, -6],
      ]);
      return {
        block: turnIn(
          F,
          deg,
          tl(f, [
            [0, 0.92],
            [6, 0.98],
            [20, 1],
          ]),
          tl(f, [
            [0, 1.07],
            [6, 1.02],
            [20, 1],
          ]),
        ),
      };
    }),
    tumble: bake(30, true, (f) => {
      const p = air(F, -12 * f, 1, 1.03);
      return { block: p, fx: { back: { sym: 'trail', x: 0, y: 0, rot: -f * 12 } } };
    }),
    down: bake(40, true, down),
    getupStand: bake(GETUP_STAND.faf - 1, false, (f) => {
      if (F === STAND) {
        const deg = tl(f, [
          [0, 90],
          [5, 90, 'in'],
          [16, 180, 'out'],
          [GETUP_STAND.faf - 1, 180],
        ]);
        const v =
          1 -
          0.1 *
            tl(f, [
              [0, 0],
              [5, 1, 'out'],
              [9, 0],
              [16, 0],
              [17, 0.8, 'out'],
              [22, 0],
            ]);
        return { block: turnIn(F, deg, 1 + (1 - v) * 0.4, v), fx: landing(0, F.hw, f - 16, 0.7) };
      }
      const lift = tl(f, [
        [0, 0],
        [6, 0, 'out'],
        [11, 4, 'in'],
        [16, 0],
      ]);
      const v =
        1 -
        0.12 *
          tl(f, [
            [0, 0],
            [5, 1, 'out'],
            [8, 0],
            [15, 0],
            [16, 1, 'out'],
            [22, 0],
          ]);
      return {
        block: rest(F, { ...squash(F, 1 + (1 - v) * 0.4, v), lift }),
        fx: landing(0, F.hw, f - 16, 0.7),
      };
    }),
    techInPlace: bake(TECH_IN_PLACE.faf - 1, false, (f) => {
      const deg =
        F === STAND
          ? tl(f, [
              [0, 90, 'out'],
              [10, 180],
            ])
          : tl(f, [
              [0, -20, 'out'],
              [10, 0],
            ]);
      const lift = tl(f, [
        [0, 0, 'out'],
        [5, 3, 'in'],
        [10, 0],
      ]);
      const v =
        1 -
        0.1 *
          tl(f, [
            [9, 0],
            [10, 1, 'out'],
            [16, 0],
          ]);
      return { block: turnIn(F, deg, 1 + (1 - v) * 0.4, v, 0, lift), fx: landing(0, F.hw, f - 10, 0.7) };
    }),
    techRoll: bake(TECH_ROLL.faf - 1, false, (f) => rollOut(f, TECH_ROLL.move)),
    getupRoll: bake(GETUP_ROLL.faf - 1, false, (f) => rollOut(f, GETUP_ROLL.move)),
    /** Tech and getup rolls away from the facing (the renderer's back roll for those actions). */
    techRollBack: bake(TECH_ROLL.faf - 1, false, (f) => rollOut(f, TECH_ROLL.move, -1)),
    getupRollBack: bake(GETUP_ROLL.faf - 1, false, (f) => rollOut(f, GETUP_ROLL.move, -1)),
    respawn: bake(60, true, (f) => ({ block: rest(F, breathe(f, 60)) })),
    grabHold: bake(30, true, (f) => ({
      block: rock(F, (F === STAND ? 22 : -10) + 1.2 * Math.sin((2 * Math.PI * f) / 30)),
    })),
    grabbed: bake(20, true, (f) => ({
      block: turnIn(F, -10 + 1.5 * Math.sin((2 * Math.PI * f) / 10), 1, 1, 0, 1),
    })),
    /** Rocks back off the grip and settles while the release pushes the two apart. */
    grabRelease: bake(GRAB.releaseLag, false, (f) => {
      const deg = tl(f, [
        [0, -14, 'out'],
        [5, -16, 'inOut'],
        [13, 3],
        [18, -1],
        [22, 0],
      ]);
      const v = tl(f, [
        [0, 1],
        [12, 1],
        [13, 0.92, 'out'],
        [17, 1.01],
        [21, 1],
      ]);
      return {
        block: rock(F, deg, squash(F, 1 + (1 - v) * 0.45, v)),
        fx: { dustB: puff(-F.hw, 0, f - 1, -1, 0.75), ...(f >= 13 ? landing(0, F.hw, f - 13, 0.6, 10) : {}) },
      };
    }),
    taunt: bake(60, false, (f) => taunt(f)),
  };

  /** A roll is half a turn of tumbling in place while the engine slides the block 27 units over `move`. */
  function roll(f: number, dir: 1 | -1, move: readonly [number, number]): Frame {
    const u = travelled(move, f);
    const v =
      1 -
      0.1 *
        tl(f, [
          [0, 0],
          [3, 1, 'out'],
          [5, 0],
          [20, 0],
          [21, 1, 'out'],
          [26, 0],
        ]);
    return {
      block: turnIn(F, dir * 180 * u, 1 + (1 - v) * 0.4, v),
      fx: {
        ...landing(0, F.hw, f - 21, 0.8),
        ...(f < 6 ? { dustB: puff(-dir * F.hw, 0, f, -dir as 1 | -1, 0.7) } : {}),
      },
    };
  }

  /**
   * Rolling out of a tech or a knockdown: the block turns over in place while the engine slides it over `move`,
   * and squashes as it lands on the frame the slide ends. `dir` 1 rolls along the facing, -1 away from it. Both
   * start from the knocked-down pose (a Standing block on its side), so a backward roll turns the other way from
   * there rather than replaying the dodge back roll, which starts upright.
   */
  function rollOut(f: number, move: readonly [number, number], dir: 1 | -1 = 1): Frame {
    const u = travelled(move, f);
    const turn = F === STAND ? 90 + dir * 270 * u : dir * 180 * u;
    const end = move[1];
    const v =
      1 -
      0.1 *
        tl(f, [
          [end, 0],
          [end + 1, 1, 'out'],
          [end + 7, 0],
        ]);
    return { block: turnIn(F, turn, 1 + (1 - v) * 0.4, v), fx: landing(0, F.hw, f - end, 0.7) };
  }

  /** Squash in the frames after landing on the stage. */
  function hv(k: number): [number, number] {
    const v =
      1 -
      0.1 *
        tl(k, [
          [0, 1, 'out'],
          [3, -0.25],
          [6, 0],
        ]);
    return [1 + (1 - v) * 0.45, v];
  }

  function landingAt(
    place: Place,
    f: number,
    moveEnd: number,
    target: [number, number],
    k: number,
  ): Frame['fx'] {
    const [x] = centre(getup(place, f, moveEnd, target, 1.6));
    return landing(x, F.hw, k, 0.75);
  }

  /** Taunt: the block splits into its two cubes (the teleport switch), one hops off and back, and they rejoin. */
  function taunt(f: number): Frame {
    if (f < 9 || f >= 50) {
      const shake = f < 9 ? 1.6 * Math.sin(f * 2.4) * (f / 9) : 0;
      const p = f < 9 ? rock(F, shake) : settle(F, f - 50, {}, 1.2);
      return {
        block: p,
        fx:
          f >= 50 && f < 56
            ? {
                starA: { sym: 'burst', x: 0, y: top / 2, sx: 0.4 + (f - 50) * 0.2, sy: 0.4 + (f - 50) * 0.2 },
              }
            : {},
      };
    }
    const standing = F === STAND;
    const home: [number, number] = standing ? [0, -18] : [6, -6];
    const base: [number, number] = standing ? [0, -6] : [-6, -6];
    const spot: [number, number] = standing ? [-15.5, -9] : [20, -9];
    const turn0 = standing ? 0 : 90;
    const out = (u: number): [number, number] => [
      home[0] + (spot[0] - home[0]) * u,
      home[1] + (spot[1] - home[1]) * u - 9 * Math.sin(Math.PI * u),
    ];
    let a: [number, number];
    let rot: number;
    if (f < 24) {
      const u = tl(f, [
        [9, 0, 'linear'],
        [24, 1],
      ]);
      a = out(u);
      rot = turn0 + (standing ? -90 : 90) * u;
    } else if (f < 34) {
      a = [spot[0], spot[1] - 1.5];
      rot = turn0 + (standing ? -90 : 90);
    } else {
      const u = tl(f, [
        [34, 1, 'linear'],
        [48, 0],
      ]);
      a = out(u);
      rot = turn0 + (standing ? -90 : 90) * u;
    }
    const bounce = (k: number) =>
      1 -
      0.14 *
        tl(k, [
          [0, 1, 'out'],
          [3, -0.3],
          [6, 0],
        ]);
    const va = f >= 24 && f < 34 ? bounce(f - 24) : f >= 48 ? bounce(f - 48) : 1;
    const vb = f >= 9 && f < 15 ? bounce(f - 9) : f >= 48 ? bounce(f - 48) : 1;
    const cube = (x: number, y: number, turn: number, v: number) => {
      const side = Math.abs(Math.sin((turn * Math.PI) / 180)) > 0.7;
      const h = 1 + (1 - v) * 0.5;
      return { x, y: y + HALF_W * (1 - v), rot: turn, sx: side ? v : h, sy: side ? h : v };
    };
    return {
      block: rest(F),
      cubes: [cube(a[0], a[1], rot, va), cube(base[0], base[1], turn0 + 180, vb)],
      fx: f >= 24 && f < 36 ? landing(spot[0], HALF_W, f - 24, 0.6) : {},
    };
  }

  return clips;
}
