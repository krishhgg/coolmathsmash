import { chargeLerp } from '../../sim/actions/charge';
import { enterAction } from '../../sim/actions/registry';
import { smashDir } from '../../sim/control';
import type { Ctx } from '../../sim/fighter';
import { leaveGround } from '../../sim/movement';
import { approach } from '../../sim/vec';
import type { HitboxDef, MoveDef } from '../types';

/**
 * Running Ram's numbers: Pikachu's Skull Bash in Ultimate, from SmashWiki ("Pikachu (SSBU)/Side special": its
 * timing, hitbox and parameter tables) and ultimateframedata.com/pikachu (side special: startup 18, total 96 on
 * the ground and 74 in the air, 10.0-21.4%, active 18-52).
 */
export const RAM = {
  /** It charges on frame 13 ("Charges between 13-14"); the dash and its hitbox start on 18. */
  charge: 13,
  launch: 18,
  /** Clean hit on 18-25 (radius 4), late hit on 26-52 (radius 3). */
  clean: [18, 25] as [number, number],
  late: [26, 52] as [number, number],
  /** Interruptible on 97 when it ends on the ground, 75 when it ends in the air. */
  faf: 97,
  airFaf: 75,
  /** 80 frames for a full charge; a smash input starts with 20. Base damage is 6.2 + 15.2 x charge / 80. */
  chargeFrames: 80,
  smashStart: 20,
  damage: [6.2, 21.4] as [number, number],
  /** On release: horizontal speed 1.6 to 3.2 and vertical speed 0.185 to 0.23 by charge, gravity 0.01, fall 1.1. */
  speed: [1.6, 3.2] as [number, number],
  rise: [0.185, 0.23] as [number, number],
  gravity: 0.01,
  fall: 1.1,
  /** In the air during startup and charge: horizontal speed x0.8 on frame 1, then friction 0.02 and gravity 0.04. */
  startSpeed: 0.8,
  startFriction: 0.02,
  startGravity: 0.04,
  /** The ending: horizontal speed x0.7, then friction 0.032 to 0.063 by charge. */
  endSpeed: 0.7,
  endFriction: [0.032, 0.063] as [number, number],
  /**
   * On hit or shield the move ends in a bounce back: speed -0.3 across and 1.3 up, gravity 0.1, interruptible on
   * the bounce's 23rd frame.
   */
  bounce: { x: -0.3, y: 1.3, gravity: 0.1, frames: 22 },
  /** Ledge grabs from the front from frame 27. */
  ledgeFrom: 27,
};

/** The move frame a bounce off a hit or shield starts on, so it ends at the FAF `bounce.frames` frames later. */
export const RAM_BOUNCE = RAM.faf - RAM.bounce.frames;

/** Skull Bash's box is 4 units across clean and 3 late, centred on the Duck's head as he flies flat out. */
const ram = (radius: number): HitboxDef => ({
  id: 0,
  x: 5.5,
  y: 5,
  radius,
  damage: RAM.damage[0],
  angle: 361,
  kbg: 78,
  bkb: 40,
});

/** A grounded part of the move takes off, and the move plays on in the air from the same frame. */
function takeOff(x: Ctx): void {
  const { f } = x;
  const move = f.move;
  leaveGround(x);
  enterAction(x, 'aerial', f.actionFrame);
  f.move = move;
}

/**
 * The frames (each fighter's frame context) the startup's air physics already ran on. While Special holds the charge,
 * the shared code steps the move back onto its charge frame, which runs the script a second time that frame, and the
 * physics below add to the speed rather than set it. Nothing here outlives the frame.
 */
const startupRan = new WeakSet<Ctx>();

function script(x: Ctx): void {
  const { f, s, c } = x;
  const af = f.actionFrame;
  if (af === 1) {
    if (f.charge === 0 && smashDir(c, f.facing) !== 'neutral') f.charge = RAM.smashStart;
    // A fast fall carried into the move ends with it (`fastFall: false` stops new ones).
    if (f.fastFalling) {
      f.fastFalling = false;
      f.vel.y = Math.max(f.vel.y, -s.fallSpeed);
    }
  }
  if (af < RAM.launch) {
    if (f.ground || startupRan.has(x)) return;
    startupRan.add(x);
    if (af === 1) f.vel.x *= RAM.startSpeed;
    f.vel.x = approach(f.vel.x, 0, RAM.startFriction);
    // The air physics takes off the Duck's own gravity after this.
    f.vel.y += s.gravity - RAM.startGravity;
    return;
  }
  const struck = f.hitVictims.length > 0;
  if (struck && af < RAM_BOUNCE) {
    f.actionFrame = RAM_BOUNCE;
    return;
  }
  if (struck) {
    if (af === RAM_BOUNCE) {
      if (f.ground) takeOff(x);
      f.vel.x = f.facing * RAM.bounce.x;
      f.vel.y = RAM.bounce.y;
    } else if (!f.ground) f.vel.y = Math.max(f.vel.y + s.gravity - RAM.bounce.gravity, -s.fallSpeed);
    return;
  }
  const speed = chargeLerp(f, ...RAM.speed);
  if (af <= RAM.late[1]) {
    // Headfirst through the air, rising a little: a grounded start hops so the ram flies off ledges, and one that
    // lands mid-dash hops again.
    if (f.ground) takeOff(x);
    const t = Math.min(af - RAM.launch, f.airFrames);
    f.vel.x = f.facing * speed;
    f.vel.y = Math.max(chargeLerp(f, ...RAM.rise) - RAM.gravity * t, -RAM.fall);
    return;
  }
  if (!f.ground && af >= RAM.airFaf) {
    f.actionFrame = RAM.faf;
    return;
  }
  const slide = Math.max(
    0,
    RAM.endSpeed * speed - chargeLerp(f, ...RAM.endFriction) * (af - RAM.late[1] - 1),
  );
  // On the floor the Duck's own traction comes off after this, so add it back to slide at Skull Bash's friction.
  f.vel.x = f.facing * (f.ground && slide > 0 ? slide + s.groundFriction : slide);
}

/**
 * Running Ram (side special): Duck Life's running training as a charge. Hold Special to crouch and charge (feathers
 * ruffling), release or reach full charge to fly headfirst along the floor, harder and farther the longer the charge.
 * Ultimate analogue: Pikachu's Skull Bash, numbers in RAM. Its 6.2% hitbox grows to 21.4% at full charge
 * (`chargeDamage` 21.4 / 6.2 makes 6.2 + 15.2 x charge / 80 exactly). It is not helpless, can grab a ledge from
 * frame 27 and continues on landing, as Skull Bash does: it flies off ledges, carries on along the floor when it
 * touches down, ends on the floor at 97 and in the air at 75, and bounces back off a hit or a shield. Ultimate
 * also delays the launch by floor(12 x charge / 80) frames after a held release; the Duck launches on release,
 * since the move keeps no frame count of its own to time that delay.
 */
export const runningRam: MoveDef = {
  kind: 'other',
  faf: RAM.faf,
  charge: RAM.charge,
  chargeFrames: RAM.chargeFrames,
  chargeDamage: RAM.damage[1] / RAM.damage[0],
  continuesOnLanding: true,
  ledgeFrom: RAM.ledgeFrom,
  drift: false,
  fastFall: false,
  hits: [
    { frames: RAM.clean, boxes: [ram(4)] },
    { frames: RAM.late, boxes: [ram(3)] },
  ],
  script,
};
