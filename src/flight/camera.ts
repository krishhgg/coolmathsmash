import { Vector3 } from 'three';
import { damp, obstruction } from './model';
import type { Flight } from './model';

export const makeChase = () => ({
  yaw: 0,
  roll: 0,
  position: new Vector3(),
  look: new Vector3(),
  fov: 54,
});

export function updateChase(camera: ReturnType<typeof makeChase>, flight: Flight, dt: number, blend: number) {
  const speed = Math.hypot(flight.velocity.x, flight.velocity.z);
  camera.yaw = damp(camera.yaw, flight.yaw, 5.2, dt);
  camera.roll = damp(camera.roll, -flight.bank.angle * 0.22 * blend, 5.5, dt);
  camera.fov = damp(camera.fov, 54 + Math.min(12, speed * 0.19) * blend, 3.9, dt);

  const forward = new Vector3(Math.sin(camera.yaw), 0, Math.cos(camera.yaw));
  const side = new Vector3(forward.z, 0, -forward.x);
  const anchor = flight.position.clone().add(new Vector3(0, 0.77, 0));
  const ease = blend * blend * (3 - 2 * blend);
  const distance = 4.05 + (3.1 + speed * 0.035) * ease;
  const position = anchor
    .clone()
    .addScaledVector(forward, -distance)
    .addScaledVector(side, -2.85 + 2.1 * ease);
  position.y += 0.76 + ease * 1.3;
  const target = anchor
    .clone()
    .addScaledVector(forward, 0.23 + ease * 12)
    .addScaledVector(side, 1.22 - ease * 1.15);
  target.y += 0.49 - 0.65 * ease + flight.velocity.y * 0.11 * ease;
  const strength = dt === 0 ? 1 : 1 - Math.exp(-8.8 * dt);
  camera.position.lerp(position, strength);
  camera.look.lerp(target, strength);
  const clear = obstruction(anchor, camera.position, 0.35);
  if (clear < 1) camera.position.lerpVectors(anchor, camera.position, Math.max(0.015, clear - 0.025));
}
