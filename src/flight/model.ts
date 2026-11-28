import { MathUtils, Vector3 } from 'three';
import { boxes, launch } from './course.ts';

export const stepTime = 1 / 120;
export const neutralInput = { turn: 0, lift: 0, thrust: 0, boost: false, brake: false };
export type Input = typeof neutralInput;
export const baseline = {
  motor: 1.9,
  stop: 3.0,
  steering: 5.0,
  joint: 10.0,
  bank: 0.36,
};
export type Tune = typeof baseline;
export const tune: Tune = { motor: 2.4628, stop: 4.095, steering: 6.6425, joint: 12.409, bank: 0.4408 };

export interface Spring {
  angle: number;
  speed: number;
}

const spring = (): Spring => ({ angle: 0, speed: 0 });

export function createFlight() {
  return {
    position: launch.clone(),
    velocity: new Vector3(),
    yaw: 0,
    yawRate: 0,
    lean: spring(),
    bank: spring(),
    arms: [createArm(), createArm()],
  };
}

function createArm() {
  return { shoulder: spring(), spread: spring(), elbow: spring(), wrist: spring() };
}

export type Flight = ReturnType<typeof createFlight>;

export const damp = (value: number, target: number, response: number, dt: number) =>
  target + (value - target) * Math.exp(-response * dt);

// Exact critically damped spring integration for a held target.
function follow(joint: Spring, target: number, frequency: number, dt: number) {
  const offset = joint.angle - target;
  const decay = Math.exp(-frequency * dt);
  const tangent = joint.speed + frequency * offset;
  joint.angle = target + (offset + tangent * dt) * decay;
  joint.speed = (joint.speed - frequency * tangent * dt) * decay;
}

// Slab test. Returning a fraction allows both fast ships and the chase camera to sweep.
export function obstruction(from: Vector3, to: Vector3, margin: number): number {
  let nearest = 1;
  for (const { min, max } of boxes) {
    let entry = 0;
    let exit = nearest;
    for (const axis of ['x', 'y', 'z'] as const) {
      const delta = to[axis] - from[axis];
      const low = min[axis] - margin;
      const high = max[axis] + margin;
      if (Math.abs(delta) < 1e-8) {
        if (from[axis] < low || from[axis] > high) exit = -1;
        continue;
      }
      const a = (low - from[axis]) / delta;
      const b = (high - from[axis]) / delta;
      entry = Math.max(entry, Math.min(a, b));
      exit = Math.min(exit, Math.max(a, b));
    }
    if (entry <= exit) nearest = entry;
  }
  return nearest;
}

export function stepFlight(state: Flight, input: Input, dt: number, setup = tune): boolean {
  const { position, velocity } = state;
  const previousSpeed = Math.hypot(velocity.x, velocity.z);
  const pace = Math.min(1, previousSpeed / 50);
  const braking = input.brake || input.thrust < 0;
  const yawLimit = MathUtils.lerp(1.85, 1.14, pace);
  state.yawRate = damp(state.yawRate, input.turn * yawLimit, setup.steering, dt);
  state.yaw += state.yawRate * dt;

  const forwardSpeed = braking ? 0 : input.thrust > 0 ? (input.boost ? 66 : 38) : previousSpeed * 0.86;
  const motor = braking ? setup.stop : input.thrust > 0 ? setup.motor : 1.45;
  velocity.x = damp(velocity.x, Math.sin(state.yaw) * forwardSpeed, motor, dt);
  velocity.z = damp(velocity.z, Math.cos(state.yaw) * forwardSpeed, motor, dt);
  velocity.y = damp(velocity.y, input.lift * 17.5, 3.6, dt);
  const next = position.clone().addScaledVector(velocity, dt);
  next.y = MathUtils.clamp(next.y, 2.2, 168);
  const hit = obstruction(position, next, 0.82);
  position.lerp(next, hit < 1 ? Math.max(0, hit - 0.01) : 1);
  if (hit < 1) velocity.set(0, 0, 0);
  if (position.y === 2.2 || position.y === 168) velocity.y = 0;

  const tilt = pace * 1.04 + velocity.y * 0.009 - (braking ? 0.19 : 0);
  follow(state.lean, tilt, setup.joint * 0.83, dt);
  const bank = MathUtils.clamp(-state.yawRate * setup.bank * (0.24 + 0.76 * pace), -0.58, 0.58);
  follow(state.bank, bank, setup.joint * 0.77, dt);
  const load = MathUtils.clamp((Math.hypot(velocity.x, velocity.z) - previousSpeed) / (dt * 73), -1, 1);

  state.arms.forEach((arm, index) => {
    const side = index === 0 ? -1 : 1;
    const turnLoad = side * bank;
    // Angles are relative to each parent. Positive elbow flex brings the palm forward.
    follow(
      arm.shoulder,
      -0.16 - 0.4 * pace - 0.16 * load - 0.2 * turnLoad + (braking ? 0.41 : 0),
      setup.joint,
      dt,
    );
    follow(
      arm.spread,
      0.16 + 0.1 * pace + 0.31 * Math.max(0, turnLoad) + (braking ? 0.15 : 0),
      setup.joint,
      dt,
    );
    follow(arm.elbow, 0.22 + 0.39 * (1 - pace) + 0.23 * turnLoad + (braking ? 0.32 : 0), setup.joint, dt);
    follow(arm.wrist, -0.16 - 0.11 * pace + 0.08 * load, setup.joint, dt);
  });
  return hit < 1;
}
