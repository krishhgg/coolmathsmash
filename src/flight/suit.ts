import * as T from 'three';
import type { Flight } from './model';

const ceramic = new T.MeshStandardMaterial({ color: 0xeacbb5, metalness: 0.52, roughness: 0.36 });
const copper = new T.MeshStandardMaterial({ color: 0xa94225, metalness: 0.52, roughness: 0.33 });
const graphite = new T.MeshStandardMaterial({ color: 0x182127, metalness: 0.32, roughness: 0.47 });
const trim = new T.MeshStandardMaterial({ color: 0x4f646d, metalness: 0.67, roughness: 0.32 });
const emitter = new T.MeshBasicMaterial({ color: 0x92ffff });
const ellipsoid = new T.SphereGeometry(1, 16, 12);

function shell(
  parent: T.Group,
  material: T.Material,
  x: number,
  y: number,
  z: number,
  w: number,
  h: number,
  d: number,
) {
  const mesh = new T.Mesh(ellipsoid, material);
  mesh.position.set(x, y, z);
  mesh.scale.set(w, h, d);
  parent.add(mesh);
  return mesh;
}

function joint(parent: T.Group, x: number, y: number, z: number) {
  const group = new T.Group();
  group.position.set(x, y, z);
  group.rotation.order = 'YXZ';
  parent.add(group);
  return group;
}

export function makeSuit(scene: T.Scene) {
  const root = new T.Group();
  root.rotation.order = 'YXZ';
  scene.add(root);
  shell(root, graphite, 0, 0.24, 0, 0.221, 0.365, 0.124);
  shell(root, ceramic, 0, 0.47, 0.015, 0.255, 0.227, 0.139);
  shell(root, copper, 0, 0.398, -0.067, 0.223, 0.246, 0.104);
  shell(root, ceramic, 0, 0.017, 0, 0.191, 0.142, 0.116);
  shell(root, trim, 0, 0.366, -0.162, 0.079, 0.18, 0.039);
  shell(root, emitter, 0, 0.373, -0.201, 0.022, 0.127, 0.007);
  for (const side of [-1, 1]) {
    shell(root, trim, 0.116 * side, 0.448, -0.141, 0.054, 0.157, 0.046);
    shell(root, emitter, 0.116 * side, 0.49, -0.182, 0.017, 0.052, 0.009);
    shell(root, copper, 0.136 * side, 0.223, 0.074, 0.058, 0.082, 0.041);
  }

  const head = joint(root, 0, 0.691, 0.02);
  shell(head, graphite, 0, -0.038, 0, 0.073, 0.076, 0.072);
  shell(head, ceramic, 0, 0.101, 0, 0.123, 0.151, 0.115);
  shell(head, copper, 0, 0.13, -0.022, 0.129, 0.125, 0.105);
  shell(head, graphite, 0, 0.093, 0.081, 0.112, 0.054, 0.055);
  shell(head, emitter, 0, 0.101, 0.128, 0.089, 0.013, 0.009);
  shell(head, trim, 0, 0.062, -0.111, 0.081, 0.044, 0.024);

  const nozzles: T.Object3D[] = [];
  const limbs = [-1, 1].map((side) => {
    const shoulder = joint(root, side * 0.255, 0.548, 0);
    shell(shoulder, copper, side * 0.027, -0.044, -0.003, 0.104, 0.128, 0.095);
    shell(shoulder, ceramic, side * 0.013, -0.167, 0.003, 0.075, 0.13, 0.075);
    const elbow = joint(shoulder, side * 0.018, -0.3, 0);
    shell(elbow, graphite, 0, 0, 0, 0.063, 0.058, 0.06);
    shell(elbow, copper, 0, -0.107, -0.003, 0.068, 0.115, 0.071);
    shell(elbow, ceramic, side * 0.021, -0.1, -0.045, 0.042, 0.085, 0.031);
    const wrist = joint(elbow, 0, -0.215, 0);
    shell(wrist, trim, 0, -0.044, 0, 0.045, 0.053, 0.033);
    for (let finger = 0; finger < 4; finger++) {
      shell(
        wrist,
        graphite,
        (finger - 1.5) * 0.021,
        -0.089 + Math.abs(finger - 1.2) * 0.008,
        0.012,
        0.013,
        0.033,
        0.018,
      );
    }
    shell(wrist, graphite, -side * 0.046, -0.043, 0.017, 0.016, 0.039, 0.019);
    shell(wrist, emitter, 0, -0.046, -0.032, 0.024, 0.025, 0.009);
    nozzles.push(joint(wrist, 0, -0.046, -0.038));

    const hip = joint(root, side * 0.107, -0.035, 0);
    shell(hip, graphite, 0, -0.144, 0, 0.097, 0.183, 0.093);
    shell(hip, ceramic, side * 0.012, -0.142, 0.031, 0.091, 0.159, 0.076);
    const knee = joint(hip, 0, -0.344, 0);
    shell(knee, copper, 0, -0.005, 0.042, 0.077, 0.081, 0.069);
    shell(knee, graphite, 0, -0.19, -0.007, 0.072, 0.181, 0.066);
    shell(knee, ceramic, 0, -0.182, 0.029, 0.07, 0.153, 0.057);
    const boot = joint(knee, 0, -0.357, 0);
    shell(boot, copper, 0, -0.062, 0.056, 0.071, 0.06, 0.125);
    shell(boot, trim, 0, -0.105, 0.035, 0.061, 0.026, 0.1);
    shell(boot, emitter, 0, -0.127, 0.026, 0.042, 0.009, 0.062);
    nozzles.push(joint(boot, 0, -0.134, 0.026));
    return { side, shoulder, elbow, wrist, hip, knee, boot };
  });

  const streaks = nozzles.map((nozzle, index) => {
    const boot = index % 2 === 1;
    const geometry = new T.BufferGeometry();
    const positions = new Float32Array(21 * 3);
    const colors = new Float32Array(positions.length);
    for (let i = 0; i <= 20; i++) {
      const intensity = (1 - i / 20) ** 1.8;
      colors.set([0.35 * intensity, 0.82 * intensity, intensity], 3 * i);
    }
    geometry.setAttribute('position', new T.BufferAttribute(positions, 3).setUsage(T.DynamicDrawUsage));
    geometry.setAttribute('color', new T.BufferAttribute(colors, 3));
    const line = new T.Line(
      geometry,
      new T.LineBasicMaterial({
        vertexColors: true,
        transparent: true,
        blending: T.AdditiveBlending,
        depthWrite: false,
      }),
    );
    line.frustumCulled = false;
    scene.add(line);
    const glow = shell(
      nozzle as T.Group,
      emitter,
      0,
      boot ? -0.18 : 0,
      boot ? 0 : -0.18,
      0.035,
      boot ? 0.22 : 0.036,
      boot ? 0.036 : 0.22,
    );
    return { nozzle, line, positions, glow, samples: Array.from({ length: 21 }, () => new T.Vector3()) };
  });

  const point = new T.Vector3();
  let sampleTime = 0;
  return {
    root,
    update(state: Flight, now: number, dt: number, power: number) {
      root.position.copy(state.position);
      root.rotation.set(state.lean.angle, state.yaw, state.bank.angle);
      head.rotation.x = -0.52 * state.lean.angle;
      head.rotation.y = state.yawRate * 0.17;
      const flightPose = Math.min(1, state.velocity.length() / 40);
      limbs.forEach(({ side, shoulder, elbow, wrist, hip, knee, boot }, index) => {
        const arm = state.arms[index]!;
        shoulder.rotation.x = -arm.shoulder.angle;
        shoulder.rotation.z = side * arm.spread.angle;
        elbow.rotation.x = -arm.elbow.angle;
        wrist.rotation.x = arm.wrist.angle;
        hip.rotation.x = -0.18 * flightPose + side * 0.09 * state.bank.angle;
        hip.rotation.z = side * (0.1 - flightPose * 0.06);
        knee.rotation.x = -0.15 * (1 - flightPose);
        boot.rotation.x = 0.26 * flightPose;
      });
      root.updateMatrixWorld(true);
      sampleTime += dt;
      const record = sampleTime >= 1 / 55 || dt === 0;
      if (record) sampleTime %= 1 / 55;
      streaks.forEach(({ nozzle, line, positions, glow, samples }) => {
        nozzle.getWorldPosition(point);
        if (dt === 0) samples.forEach((sample) => sample.copy(point));
        if (record) {
          for (let i = samples.length - 1; i > 0; i--) samples[i]!.copy(samples[i - 1]!);
          samples[0]!.copy(point);
        }
        positions.set(point.toArray(), 0);
        for (let i = 1; i < samples.length; i++) samples[i]!.toArray(positions, i * 3);
        line.geometry.attributes.position!.needsUpdate = true;
        line.material.opacity = power * 0.8;
        glow.visible = power > 0.03;
        glow.scale.x = 0.026 + power * 0.03 + Math.sin(now * 83) * 0.006;
      });
    },
  };
}
