import { MathUtils, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { makeChase, updateChase } from './camera';
import { gates, normals, throughGate } from './course';
import { createFlight, neutralInput, obstruction, stepFlight, stepTime } from './model';

describe('Harbor flight', () => {
  it('registers a fast gate crossing only from the approach side and within the opening', () => {
    const { position, radius } = gates[0]!;
    const normal = normals[0]!;
    const before = position.clone().addScaledVector(normal, -18);
    const after = position.clone().addScaledVector(normal, 20);
    expect(throughGate(before, after, 0)).toBe(true);
    expect(throughGate(after, before, 0)).toBe(false);
    before.x += radius + 0.01;
    after.x += radius + 0.01;
    expect(throughGate(before, after, 0)).toBe(false);
  });

  it('sweeps an obstacle and keeps the chase camera clear beside a tower', () => {
    expect(obstruction(new Vector3(0, 40, 100), new Vector3(60, 40, 100), 0.82)).toBeLessThan(0.25);
    const flight = createFlight();
    flight.position.set(28, 44, 78.7);
    flight.yaw = Math.PI;
    const camera = makeChase();
    camera.yaw = flight.yaw;
    updateChase(camera, flight, 0, 1);
    expect(camera.position.z).toBeLessThan(79.65);
    expect(camera.position.z).toBeGreaterThan(flight.position.z);
  });

  it('can finish all seven gates with digital controls without hitting a building', () => {
    const flight = createFlight();
    const previous = new Vector3();
    let gate = 0;
    let ticks = 0;
    let input = neutralInput;
    let peakJointSpeed = 0;
    while (gate < gates.length && ticks < 120 * 24) {
      const target = gates[gate]!.position.clone().addScaledVector(normals[gate]!, 12);
      if (ticks % 4 === 0) {
        const dx = target.x - flight.position.x - flight.velocity.x * 0.26;
        const dz = target.z - flight.position.z - flight.velocity.z * 0.26;
        const dy = target.y - flight.position.y - flight.velocity.y * 0.27;
        const yawError =
          MathUtils.euclideanModulo(Math.atan2(dx, dz) - flight.yaw + Math.PI, Math.PI * 2) - Math.PI;
        const turn = yawError - flight.yawRate * 0.13;
        input = {
          ...neutralInput,
          thrust: Math.abs(yawError) < 0.58 ? 1 : 0,
          brake: Math.abs(yawError) > 0.75,
          turn: Math.abs(turn) > 0.043 ? Math.sign(turn) : 0,
          lift: Math.abs(dy) > 1 ? Math.sign(dy) : 0,
        };
      }
      previous.copy(flight.position);
      const hit = stepFlight(flight, input, stepTime);
      if (hit)
        throw new Error(
          `Collision on approach to gate ${gate + 1} at ${flight.position.toArray().join(', ')}`,
        );
      if (throughGate(previous, flight.position, gate)) gate++;
      for (const arm of flight.arms) {
        if (arm.elbow.angle < 0 || arm.elbow.angle > Math.PI / 2) throw new Error('Elbow exceeded its range');
        peakJointSpeed = Math.max(peakJointSpeed, Math.abs(arm.elbow.speed));
      }
      ticks++;
    }
    expect(gate).toBe(gates.length);
    expect(ticks * stepTime).toBeLessThan(24);
    expect(peakJointSpeed).toBeLessThan(3.3);
  });
});
