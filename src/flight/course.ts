import { Vector3 } from 'three';

export const launch = new Vector3(0, 35.84, 0);
export const gates = [
  { position: new Vector3(0, 43, 84), radius: 9, name: 'Harbor approach' },
  { position: new Vector3(-24, 48, 161), radius: 10, name: 'Glass alley' },
  { position: new Vector3(-81, 42, 221), radius: 9, name: 'Pier descent' },
  { position: new Vector3(-104, 29, 302), radius: 9, name: 'Sea wall' },
  { position: new Vector3(-54, 35, 403), radius: 10, name: 'Switchback' },
  { position: new Vector3(9, 58, 451), radius: 11, name: 'Crane rise' },
  { position: new Vector3(18, 68, 529), radius: 12, name: 'North beacon' },
];

export const normals = gates.map(({ position }, index) =>
  position
    .clone()
    .sub(gates[index - 1]?.position ?? launch)
    .normalize(),
);

export function throughGate(previous: Vector3, current: Vector3, index: number): boolean {
  const gate = gates[index];
  const normal = normals[index];
  if (!gate || !normal) return false;
  const from = previous.clone().sub(gate.position);
  const start = from.dot(normal);
  const end = current.clone().sub(gate.position).dot(normal);
  if (start >= 0 || end < 0) return false;
  return from.lerp(current.clone().sub(gate.position), -start / (end - start)).lengthSq() <= gate.radius ** 2;
}

// Each building footprint also defines the solid volume the pilot and camera see.
export type Building = readonly [x: number, z: number, width: number, depth: number, height: number];
export const buildings: Building[] = [
  [0, -12, 29, 31, 34.85],
  [48, 34, 36, 45, 32],
  [-55, 47, 31, 35, 29],
  [29, 103, 29, 46, 96],
  [-35, 106, 27, 42, 79],
  [55, 163, 36, 49, 115],
  [2, 169, 27, 42, 82],
  [-58, 154, 33, 49, 105],
  [-105, 168, 32, 41, 51],
  [-45, 235, 28, 45, 65],
  [-7, 243, 38, 37, 93],
  [44, 235, 29, 47, 119],
  [-72, 299, 21, 47, 52],
  [-34, 307, 28, 47, 73],
  [13, 306, 39, 40, 106],
  [61, 307, 34, 42, 90],
  [-105, 380, 30, 46, 48],
  [-20, 374, 28, 39, 71],
  [35, 382, 39, 49, 125],
  [-49, 448, 32, 36, 63],
  [51, 444, 38, 43, 118],
  [-23, 505, 35, 45, 109],
  [56, 512, 40, 44, 142],
  [-55, 571, 42, 48, 94],
  [31, 598, 43, 60, 105],
];

for (let row = -1; row < 11; row++) {
  for (let column = 0; column < 8; column++) {
    const variation = ((row + 1) * 39 + column * 59 + column * row * 23) % 71;
    buildings.push([
      106 + column * 51,
      12 + row * 63 + (column % 2) * 11,
      27 + (variation % 15),
      36 + (variation % 14),
      26 + variation + ((row + column) % 5 === 0 ? 49 : 0),
    ]);
  }
}

export const roofDetails = buildings.flatMap(([x, z, w, d, h], index) => {
  if (index === 0) return [];
  const details = [
    { x, z, w: w + 0.45, d: d + 0.45, base: h, height: 0.76, type: 'ledge' },
    {
      x: x + w * 0.14,
      z: z - d * 0.19,
      w: w * 0.31,
      d: d * 0.24,
      base: h + 0.34,
      height: 4,
      type: 'utility',
    },
  ];
  if (index % 7 === 0) details.push({ x, z, w: 0.4, d: 0.4, base: h, height: 12, type: 'antenna' });
  return details;
});

export const boxes = [
  ...buildings.map(([x, z, w, d, height]) => ({ x, z, w, d, base: -1, height: height + 1 })),
  ...roofDetails,
].map(({ x, z, w, d, base, height }) => ({
  min: new Vector3(x - w / 2, base, z - d / 2),
  max: new Vector3(x + w / 2, base + height, z + d / 2),
}));
