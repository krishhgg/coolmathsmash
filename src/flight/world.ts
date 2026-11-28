import * as T from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { buildings, gates, normals, roofDetails } from './course';

function material(color: number, roughness = 0.85) {
  return new T.MeshStandardMaterial({ color, roughness });
}

const cube = new T.BoxGeometry(1, 1, 1);
const roof = material(0x52646a);
const concrete = material(0x5b6661);
const road = material(0x29383c);
const paint = material(0xd5b975);
const harbor = material(0x427c8a, 0.53);

function block(
  scene: T.Object3D,
  surface: T.Material | T.Material[],
  x: number,
  y: number,
  z: number,
  sx: number,
  sy: number,
  sz: number,
) {
  const mesh = new T.Mesh(cube, surface);
  mesh.position.set(x, y, z);
  mesh.scale.set(sx, sy, sz);
  scene.add(mesh);
  return mesh;
}

function flattenDistrict(district: T.Group, scene: T.Scene) {
  // Group the opaque city by material so rows of buildings and road marks draw together.
  const batches = new Map<T.Material, T.BufferGeometry[]>();
  const geometry = cube.toNonIndexed();
  const faces = geometry.groups.map(({ start, count }) => {
    const face = new T.BufferGeometry();
    for (const name of ['position', 'normal', 'uv']) {
      const attribute = geometry.getAttribute(name);
      face.setAttribute(
        name,
        new T.BufferAttribute(
          attribute.array.slice(start * attribute.itemSize, (start + count) * attribute.itemSize),
          attribute.itemSize,
        ),
      );
    }
    return face;
  });
  const add = (shape: T.BufferGeometry, surface: T.Material, transform: T.Matrix4) => {
    const batch = batches.get(surface) ?? [];
    batch.push(shape.clone().applyMatrix4(transform));
    batches.set(surface, batch);
  };
  for (const child of district.children) {
    const mesh = child as T.Mesh<T.BufferGeometry, T.Material | T.Material[]>;
    mesh.updateMatrix();
    if (Array.isArray(mesh.material)) {
      mesh.material.forEach((surface, index) => add(faces[index]!, surface, mesh.matrix));
    } else {
      add(geometry, mesh.material, mesh.matrix);
    }
  }
  for (const [surface, batch] of batches) {
    const merged = mergeGeometries(batch);
    if (merged) scene.add(new T.Mesh(merged, surface));
  }
}

function facade(columns: number, floors: number, variation: number) {
  const canvas = document.createElement('canvas');
  canvas.width = columns * 12;
  canvas.height = floors * 12;
  const ctx = canvas.getContext('2d')!;
  const bases = ['#697779', '#697476', '#969183', '#6b7a81', '#838a87'];
  ctx.fillStyle = bases[variation % bases.length]!;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  for (let i = 0; i < columns; i++) {
    for (let j = 0; j < floors; j++) {
      const shade = (i * 63 + j * 119 + i * j * 7 + variation * 27) % 29;
      if (shade === 3) continue;
      ctx.fillStyle = shade < 3 ? '#b8ad83' : shade > 17 ? '#364d55' : '#526d77';
      ctx.fillRect(i * 12 + 2, j * 12 + 2, 8, 7);
      ctx.fillStyle = 'rgba(202,232,234,.16)';
      ctx.fillRect(i * 12 + 2, j * 12 + 2, 8, 2);
    }
  }
  const texture = new T.CanvasTexture(canvas);
  texture.colorSpace = T.SRGBColorSpace;
  texture.anisotropy = 4;
  return new T.MeshStandardMaterial({ map: texture, roughness: 0.63, metalness: 0.04 });
}

function sky() {
  return new T.Mesh(
    new T.SphereGeometry(1300, 32, 20),
    new T.ShaderMaterial({
      side: T.BackSide,
      depthWrite: false,
      vertexShader: `
        varying vec3 ray;
        void main() {
          ray = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.);
        }
      `,
      fragmentShader: `
        varying vec3 ray;
        float hash(vec2 p) { return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
        float noise(vec2 p) {
          vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
          return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+1.),f.x),f.y);
        }
        float cloud(vec2 p) {
          return noise(p)*.53+noise(p*2.07)*.25+noise(p*4.21)*.13+noise(p*8.1)*.06+noise(p*17.)*.03;
        }
        void main() {
          vec3 d = normalize(ray);
          float h = max(d.y, 0.);
          float sun = max(dot(d, normalize(vec3(-.68,.16,.64))), 0.);
          vec3 col = mix(vec3(.68,.76,.75),vec3(.18,.43,.61), smoothstep(0.,.68,h));
          col = mix(col,vec3(.98,.78,.55),pow(sun,6.)*.46);
          col += vec3(.9,.62,.29)*(pow(sun,64.)*.34+smoothstep(.9996,.9998,sun)*.8);
          vec2 uv = d.xz / (h + .14) * 2.8 + vec2(4.,7.);
          float n = cloud(uv);
          float cover = smoothstep(.48,.65,n) * smoothstep(.015,.12,h);
          vec3 clouds = mix(vec3(.57,.65,.66),vec3(1.,.89,.73), smoothstep(.48,.75,n+sun*.08));
          gl_FragColor = vec4(mix(col,clouds,cover),1.);
          #include <colorspace_fragment>
        }
      `,
    }),
  );
}

export function makeWorld(scene: T.Scene) {
  scene.fog = new T.FogExp2(0xc2cfcc, 0.0027);
  const backdrop = sky();
  backdrop.renderOrder = 100;
  scene.add(backdrop);
  scene.add(new T.HemisphereLight(0xe0f4ff, 0x738d87, 2.05));
  const sun = new T.DirectionalLight(0xffe0b2, 2.7);
  sun.position.set(-220, 160, 90);
  scene.add(sun);
  const fill = new T.DirectionalLight(0x8eb9d4, 0.94);
  fill.position.set(110, 70, -200);
  scene.add(fill);

  const district = new T.Group();
  block(district, harbor, -400, -2.3, 300, 1600, 1, 1350);
  block(district, concrete, 277, -0.85, 275, 714, 1.68, 745);
  block(district, concrete, -91, -0.8, 218, 56, 1.3, 138);
  block(district, concrete, -86, -0.8, 377, 46, 1.3, 104);
  for (const x of [-68, -3, 72, 133, 185, 235, 286, 337, 387, 437]) {
    block(district, road, x, 0.045, 268, 12, 0.065, 718);
    for (let z = -84; z < 620; z += 22) block(district, paint, x, 0.092, z, 0.13, 0.03, 5.5);
  }
  for (let z = 5; z < 626; z += 65) {
    block(district, road, 278, 0.075, z, 711, 0.08, 8);
  }

  const facades = new Map<string, T.Material>();
  const wall = (length: number, height: number, variant: number) => {
    const columns = Math.ceil(length / 4);
    const floors = Math.ceil(height / 4);
    const key = [columns, floors, variant].join('/');
    let surface = facades.get(key);
    if (!surface) {
      surface = facade(columns, floors, variant);
      facades.set(key, surface);
    }
    return surface;
  };

  buildings.forEach(([x, z, w, d, h], index) => {
    const a = wall(d, h, index % 5);
    const b = wall(w, h, index % 5);
    block(district, [a, a, roof, roof, b, b], x, h / 2, z, w, h, d);
  });
  for (const detail of roofDetails) {
    block(
      district,
      detail.type === 'utility' ? concrete : roof,
      detail.x,
      detail.base + detail.height / 2,
      detail.z,
      detail.w,
      detail.height,
      detail.d,
    );
  }

  const deck = material(0x38464a);
  const launchMark = material(0xe4d6b8);
  block(district, deck, 0, 34.89, -1.6, 19, 0.08, 8.5);
  for (const side of [-1, 1]) {
    block(district, launchMark, side * 5.3, 34.96, -1.6, 0.25, 0.06, 7.8);
    block(district, launchMark, side * 1.5, 34.96, 0.1, 0.14, 0.06, 2.5);
  }
  block(district, launchMark, 0, 34.96, 0.1, 3.1, 0.06, 0.15);

  const crane = material(0xc0874b);
  for (const [x, z] of [
    [-114, 250],
    [-100, 419],
    [1, 461],
  ] as const) {
    block(district, crane, x, 11, z, 2, 22, 2);
    block(district, crane, x - 8, 22, z, 32, 1.35, 1.4);
    const support = block(district, crane, x - 5, 16, z, 0.65, 14, 0.65);
    support.rotation.z = -0.73;
  }

  flattenDistrict(district, scene);

  const wakes = new T.BufferGeometry();
  const strokes: number[] = [];
  for (let i = 0; i < 480; i++) {
    const x = -610 + ((i * 239 + i * i) % 529);
    const z = -185 + ((i * 187 + i * i * 3) % 943);
    strokes.push(x, -1.76, z, x + 1 + ((i * 37) % 15), -1.76, z + 0.6);
  }
  wakes.setAttribute('position', new T.Float32BufferAttribute(strokes, 3));
  scene.add(
    new T.LineSegments(wakes, new T.LineBasicMaterial({ color: 0x9fc0b8, transparent: true, opacity: 0.34 })),
  );

  const rings = gates.map(({ position, radius }, index) => {
    const group = new T.Group();
    group.position.copy(position);
    group.quaternion.setFromUnitVectors(new T.Vector3(0, 0, 1), normals[index]!);
    const core = new T.Mesh(
      new T.TorusGeometry(radius, 0.135, 8, 80),
      new T.MeshBasicMaterial({ color: 0xa0ffef, transparent: true, opacity: 0.92 }),
    );
    const crown = new T.Mesh(
      new T.TorusGeometry(radius + 0.56, 0.083, 5, 80, Math.PI * 1.56),
      new T.MeshBasicMaterial({ color: 0x68ead3, transparent: true, opacity: 0.63 }),
    );
    for (let i = 0; i < 4; i++) {
      const angle = (i * Math.PI) / 2;
      const tick = block(
        group,
        crown.material,
        Math.sin(angle) * radius,
        Math.cos(angle) * radius,
        0,
        0.26,
        1.35,
        0.22,
      );
      tick.rotation.z = -angle;
    }
    group.add(core, crown);
    scene.add(group);
    return { group, core, crown };
  });

  return {
    backdrop,
    updateGates(active: number, time: number) {
      rings.forEach(({ group, core, crown }, index) => {
        group.visible = index >= active && index < active + 2;
        core.material.opacity = index === active ? 0.98 : 0.24;
        crown.material.opacity = index === active ? 0.75 : 0.17;
        crown.rotation.z = time * 0.24;
      });
    },
  };
}
