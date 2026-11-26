import { startMove } from '../../sim/actions/attack';
import { enterAction } from '../../sim/actions/registry';
import type { Ctx } from '../../sim/fighter';
import { leaveGround } from '../../sim/movement';
import type { HitboxDef, MoveDef } from '../types';

/**
 * Ground Pound, Red Ball's down special: Yoshi's Yoshi Bomb in Ultimate (SmashWiki, "Yoshi (SSBU)/Down special";
 * ultimateframedata.com/yoshi). On the ground he squashes, hops high and slams straight down; in the air he pops up
 * a little and slams down from there. The drop lasts until he lands or catches a ledge, and the landing sends a
 * shockwave out both sides that leaves whoever it hits Squared, like the Black Square's factory squares a ball.
 *
 * Yoshi Bomb's numbers: the grounded rise hit on frame 7 and the drop from 27; the aerial's clean hit on 19 and late
 * hit from 20; the 4.8-unit fall speed; the 1.4 grounded height multiplier, on his full hop; ledge grabs from the
 * start of the drop; platforms passed for the drop's first 7 frames (holding down passes them all, as any fall
 * does); landing hits on 3-12 and first actionable on 40. The pop before the aerial drop is his own (the data gives
 * no height).
 */
export const POUND = {
  /** Grounded: leaves the floor with the rise hit on this frame and peaks on the frame before `fall`. */
  takeoff: 7,
  fall: 27,
  /** Aerial: the drop starts with the clean hit on this frame. */
  airFall: 19,
  /** Grounded height multiplier: the hop rises 1.4 times his full hop (Yoshi's 36.09 rises 50.5). */
  rise: 1.4,
  /** The aerial's pop before the drop, in units. */
  airPop: 6,
  /** Fall speed in units a frame. */
  speed: 4.8,
  /** Frames at the start of the drop that pass through platforms. */
  passFrames: 7,
  /** Landing: the shockwave's frames and the first actionable frame. */
  wave: [3, 12] as [number, number],
  landFaf: 40,
};

/** While he is still falling, the move holds on the first frame after the platform pass, so the drop never ends. */
const HOLD = POUND.fall + POUND.passFrames;
const AIR_HOLD = POUND.airFall + POUND.passFrames;

const box = (
  id: number,
  x: number,
  y: number,
  radius: number,
  hit: Omit<HitboxDef, 'id' | 'x' | 'y' | 'radius'>,
) => ({ id, x, y, radius, ...hit });

/** Yoshi Bomb's hits (SmashWiki hitbox tables). Radii are Yoshi's; positions sit on Red Ball's 11-unit body. */
const RISE = { damage: 4, angle: 80, kbg: 100, bkb: 0, wbkb: 80, hitlag: 0.5 };
const SLAM = { damage: 15, angle: 80, kbg: 72, bkb: 60, hitlag: 0.7 };
const AIR_SLAM = { damage: 12, angle: 80, kbg: 68, bkb: 70, hitlag: 0.7 };
/** The landing stars, as a shockwave: 4%, 50 degrees, no hitlag, at the stars' spawn points 8 units out and 1 up. */
const WAVE = { damage: 4, angle: 50, kbg: 40, bkb: 50, hitlag: 0, status: 'redball/squared' };

/** Speed up on rise frame `frame`: falls off evenly to 0 at the peak, so the hop rises exactly `height`. */
function riseSpeed(height: number, frame: number, from: number, peak: number): number {
  const frames = peak - from + 1;
  return (height * (peak + 1 - frame)) / ((frames * (frames + 1)) / 2);
}

/** Lets the drop fall through a platform it would land on this frame. */
function passPlatforms(x: Ctx): void {
  const { f, stage } = x;
  for (let i = 0; i < stage.geo.platforms.length; i++) {
    const p = stage.geo.platforms[i]!;
    if (!stage.present.platforms[i] || f.pos.x < p.x1 || f.pos.x > p.x2) continue;
    if (f.pos.y >= p.y && f.pos.y - POUND.speed <= p.y) f.dropPlatform = i;
  }
}

/**
 * The drop: straight down at 4.8 a frame, held on frame `hold` until he lands, which starts the landing shockwave
 * (`downBLand`). Platforms pass under him until `hold`.
 */
function drop(x: Ctx, hold: number): void {
  const { f } = x;
  if (f.ground) {
    startMove(x, 'downBLand');
    return;
  }
  if (f.actionFrame > hold) f.actionFrame = hold;
  if (f.actionFrame < hold) passPlatforms(x);
  f.vel.x = 0;
  f.vel.y = -POUND.speed;
  // Marked fast-falling so a down flick can't swap the drop for his slower fast fall.
  f.fastFalling = true;
}

export const groundPoundMoves: Record<string, MoveDef> = {
  downB: {
    kind: 'other',
    faf: HOLD + 1,
    air: 'downBAir',
    continuesOnLanding: true,
    drift: false,
    ledgeFrom: POUND.fall,
    hits: [
      { frames: [POUND.takeoff, POUND.takeoff], boxes: [box(0, 4, 6, 7, RISE)] },
      { frames: [POUND.fall, HOLD], rehit: true, boxes: [box(0, 0, 5.5, 6.8, SLAM)] },
    ],
    script(x) {
      const { f, s } = x;
      const frame = f.actionFrame;
      if (frame >= POUND.fall) return drop(x, HOLD);
      if (frame < POUND.takeoff) {
        if (f.ground) f.vel.x = 0;
        return;
      }
      if (f.ground) {
        const { move } = f;
        leaveGround(x);
        enterAction(x, 'aerial', frame);
        f.move = move;
      }
      f.vel.x = 0;
      f.vel.y = riseSpeed(POUND.rise * s.fullHopHeight, frame, POUND.takeoff, POUND.fall - 1);
    },
  },
  downBAir: {
    kind: 'other',
    faf: AIR_HOLD + 1,
    continuesOnLanding: true,
    drift: false,
    ledgeFrom: POUND.airFall,
    hits: [
      { frames: [POUND.airFall, POUND.airFall], boxes: [box(0, 0, 0, 6.4, AIR_SLAM)] },
      { frames: [POUND.airFall + 1, AIR_HOLD], boxes: [box(0, 0, 5.5, 6.4, AIR_SLAM)] },
    ],
    script(x) {
      const { f } = x;
      if (f.actionFrame >= POUND.airFall) return drop(x, AIR_HOLD);
      if (f.actionFrame === 1) f.fastFalling = false;
      if (f.ground) {
        // Landed before the drop (started just above the floor): slam from here.
        startMove(x, 'downBLand');
        return;
      }
      f.vel.x *= 0.8;
      f.vel.y = riseSpeed(POUND.airPop, f.actionFrame, 1, POUND.airFall - 1);
    },
  },
  /** The landing: flattens with a shockwave out both sides that squares whoever it catches. */
  downBLand: {
    kind: 'other',
    faf: POUND.landFaf,
    hits: [
      {
        frames: POUND.wave,
        boxes: [box(0, 8, 1, 4, WAVE), box(1, -8, 1, 4, { ...WAVE, direction: 'back' })],
      },
    ],
    script({ f }) {
      f.vel.x = 0;
    },
  },
};
