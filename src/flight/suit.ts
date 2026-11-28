import * as T from 'three';
import type { Flight } from './model';

const alloy = new T.MeshStandardMaterial({ color: 0xd7a64f, metalness: 0.52, roughness: 0.36 });
const enamel = new T.MeshStandardMaterial({ color: 0xb91d2e, metalness: 0.52, roughness: 0.28 });
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

type ArmorSection = readonly [y: number, width: number, depth: number, centerZ?: number];

function plate(parent: T.Group, material: T.Material, sections: ArmorSection[]) {
  const sides = 12;
  const vertices: number[] = [];
  const indices: number[] = [];
  sections.forEach(([y, width, depth, centerZ = 0], row) => {
    for (let side = 0; side < sides; side++) {
      const angle = (side / sides) * Math.PI * 2;
      vertices.push(Math.sin(angle) * width, y, centerZ + Math.cos(angle) * depth);
      if (row === 0) continue;
      const a = (row - 1) * sides + side;
      const b = (row - 1) * sides + ((side + 1) % sides);
      indices.push(a, b, a + sides, b, b + sides, a + sides);
    }
  });
  const geometry = new T.BufferGeometry();
  geometry.setAttribute('position', new T.Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const mesh = new T.Mesh(geometry, material);
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
  plate(root, graphite, [
    [-0.09, 0.08, 0.08],
    [0.02, 0.19, 0.11],
    [0.21, 0.17, 0.12],
    [0.44, 0.211, 0.139],
    [0.58, 0.167, 0.117],
    [0.66, 0.078, 0.078],
  ]);
  plate(root, enamel, [
    [0.24, 0.105, 0.1],
    [0.29, 0.173, 0.15],
    [0.44, 0.233, 0.169],
    [0.55, 0.249, 0.157],
    [0.63, 0.143, 0.115],
    [0.655, 0.075, 0.075],
  ]);
  plate(root, enamel, [
    [-0.087, 0.067, 0.081],
    [-0.03, 0.17, 0.117],
    [0.055, 0.19, 0.12],
    [0.104, 0.159, 0.113],
  ]);
  for (let rib = 0; rib < 3; rib++) {
    shell(root, rib === 1 ? graphite : alloy, 0, 0.12 + rib * 0.039, 0.034, 0.153, 0.026, 0.104);
  }

  // The chest power cell uses a vertical diamond and an inset light.
  const cell = new T.Mesh(new T.BoxGeometry(0.092, 0.092, 0.025), graphite);
  cell.position.set(0, 0.456, 0.166);
  cell.rotation.z = Math.PI / 4;
  root.add(cell);
  const lens = new T.Mesh(new T.BoxGeometry(0.062, 0.062, 0.012), emitter);
  lens.position.z = 0.017;
  cell.add(lens);
  for (const side of [-1, 1]) {
    const vent = shell(root, trim, 0.135 * side, 0.475, -0.127, 0.057, 0.126, 0.046);
    vent.rotation.z = side * 0.22;
    const strip = shell(root, emitter, 0.135 * side, 0.486, -0.172, 0.012, 0.068, 0.009);
    strip.rotation.z = side * 0.22;
  }

  const head = joint(root, 0, 0.665, 0.02);
  shell(head, graphite, 0, -0.021, 0, 0.066, 0.063, 0.066);
  plate(head, enamel, [
    [0.006, 0.055, 0.055],
    [0.036, 0.091, 0.091],
    [0.103, 0.106, 0.108],
    [0.17, 0.103, 0.097],
    [0.215, 0.072, 0.071],
    [0.232, 0.002, 0.002],
  ]);
  plate(head, alloy, [
    [0.027, 0.051, 0.018, 0.071],
    [0.065, 0.077, 0.034, 0.079],
    [0.116, 0.081, 0.042, 0.08],
    [0.158, 0.078, 0.033, 0.082],
    [0.193, 0.051, 0.019, 0.064],
  ]);
  shell(head, graphite, 0, 0.134, 0.101, 0.084, 0.023, 0.03);
  for (const side of [-1, 1]) {
    const eye = new T.Mesh(new T.BoxGeometry(0.053, 0.01, 0.008), emitter);
    eye.position.set(side * 0.037, 0.136, 0.13);
    eye.rotation.set(0, side * 0.33, side * 0.19);
    head.add(eye);
    shell(head, trim, side * 0.102, 0.118, -0.018, 0.012, 0.042, 0.048);
  }

  const nozzles: T.Object3D[] = [];
  const limbs = [-1, 1].map((side) => {
    const shoulder = joint(root, side * 0.242, 0.532, 0);
    plate(shoulder, enamel, [
      [-0.148, 0.045, 0.05],
      [-0.117, 0.087, 0.084],
      [-0.038, 0.099, 0.09],
      [0.033, 0.075, 0.077],
      [0.056, 0.014, 0.023],
    ]);
    shell(shoulder, alloy, side * 0.013, -0.167, 0.003, 0.075, 0.13, 0.075);
    const elbow = joint(shoulder, side * 0.018, -0.3, 0);
    shell(elbow, graphite, 0, 0, 0, 0.063, 0.058, 0.06);
    plate(elbow, enamel, [
      [-0.212, 0.043, 0.046],
      [-0.174, 0.053, 0.061],
      [-0.087, 0.073, 0.073],
      [-0.041, 0.065, 0.059],
    ]);
    shell(elbow, alloy, side * 0.021, -0.1, -0.045, 0.042, 0.085, 0.031);
    const wrist = joint(elbow, 0, -0.215, 0);
    shell(wrist, enamel, 0, -0.044, 0, 0.045, 0.053, 0.033);
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
    shell(hip, graphite, 0, -0.144, 0, 0.065, 0.174, 0.064);
    plate(hip, alloy, [
      [-0.303, 0.064, 0.069],
      [-0.232, 0.073, 0.082],
      [-0.126, 0.093, 0.099, 0.012],
      [-0.044, 0.088, 0.097],
      [-0.016, 0.05, 0.054],
    ]);
    const knee = joint(hip, 0, -0.344, 0);
    shell(knee, enamel, 0, -0.005, 0.042, 0.077, 0.081, 0.069);
    shell(knee, graphite, 0, -0.19, -0.007, 0.072, 0.181, 0.066);
    plate(knee, enamel, [
      [-0.346, 0.05, 0.053],
      [-0.287, 0.055, 0.056],
      [-0.17, 0.079, 0.085],
      [-0.068, 0.076, 0.078, 0.015],
      [-0.034, 0.049, 0.056, 0.025],
    ]);
    const boot = joint(knee, 0, -0.357, 0);
    shell(boot, enamel, 0, -0.062, 0.056, 0.071, 0.06, 0.125);
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
    update(state: Flight, now: number, dt: number, power: number, reveal: number) {
      root.position.copy(state.position);
      root.rotation.set(state.lean.angle, state.yaw - 2.25 * reveal, state.bank.angle);
      head.rotation.x = -0.52 * state.lean.angle;
      head.rotation.y = state.yawRate * 0.17 - reveal * 0.24;
      const flightPose = Math.min(1, state.velocity.length() / 40);
      limbs.forEach(({ side, shoulder, elbow, wrist, hip, knee, boot }, index) => {
        const arm = state.arms[index]!;
        shoulder.rotation.x = -arm.shoulder.angle;
        shoulder.rotation.z = side * arm.spread.angle;
        elbow.rotation.x = -arm.elbow.angle;
        wrist.rotation.x = arm.wrist.angle;
        hip.rotation.x = (-0.08 + side * 0.13) * flightPose + side * 0.22 * state.bank.angle;
        hip.rotation.z = side * (0.1 - flightPose * 0.06);
        knee.rotation.x = -0.11 - flightPose * (side === 1 ? 0.31 : 0.06);
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
