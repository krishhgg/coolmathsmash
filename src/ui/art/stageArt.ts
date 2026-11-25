import { compileStage, type StageGeometry } from '../../sim/stage';

/**
 * Stand-in stage thumbnails until stage art exists: a stage's collision drawn as a Flash-era picture (sky, sun,
 * clouds, hills, an earth body with a grass top and cream platforms, all outlined), framed on its solids and
 * platforms inside its camera box. Everything comes from the geometry and the stage id, so a new stage gets a picture
 * of its own and a stage always looks the same. The backdrop runs well past the frame, so the picture fills a box of
 * any shape without cropping the stage.
 */

interface Sky {
  top: string;
  bottom: string;
  sun: string;
  far: string;
  near: string;
}

/** Sky palettes, picked by a hash of the stage id; Battlefield lands on the plain day sky. */
const SKIES: Sky[] = [
  { top: '#ff7b47', bottom: '#ffe28c', sun: '#fff4c4', far: '#e39a6e', near: '#b86448' },
  { top: '#3a2c8f', bottom: '#e483ae', sun: '#ffeef6', far: '#7d58b0', near: '#55398a' },
  { top: '#2f9ff0', bottom: '#c8f0ff', sun: '#fff7b8', far: '#93d9b0', near: '#5cbd6c' },
  { top: '#17ad9f', bottom: '#dcfff1', sun: '#fffbe0', far: '#84d6bd', near: '#3d9f86' },
];

const INK = '#1c1526';

export function stageHash(id: string): number {
  let h = 0;
  for (const c of id) h = (Math.imul(h, 31) + c.charCodeAt(0)) >>> 0;
  return h;
}

/**
 * The part of the stage a thumbnail shows, in game units (y up): its solids and platforms with sky above and room
 * below for a caption, at least 0.62 as tall as wide, never past the camera box.
 */
export function stageFrame(stage: StageGeometry): StageGeometry['camera'] {
  const cam = stage.camera;
  const xs = [
    ...stage.solids.flatMap((s) => s.points.map(([x]) => x)),
    ...stage.platforms.flatMap((p) => [p.x1, p.x2]),
  ];
  const ys = [...stage.solids.flatMap((s) => s.points.map(([, y]) => y)), ...stage.platforms.map((p) => p.y)];
  if (xs.length === 0) return { ...cam };
  const [minX, maxX, minY, maxY] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const left = minX - (maxX - minX) * 0.2;
  const right = maxX + (maxX - minX) * 0.2;
  let top = maxY + (maxY - minY) * 0.5;
  let bottom = minY - (maxY - minY) * 0.45;
  const short = (right - left) * 0.62 - (top - bottom);
  if (short > 0) {
    top += short * 0.7;
    bottom -= short * 0.3;
  }
  return {
    left: Math.max(cam.left, left),
    right: Math.min(cam.right, right),
    top: Math.min(cam.top, top),
    bottom: Math.max(cam.bottom, bottom),
  };
}

let uid = 0;

const n = (v: number) => String(Math.round(v * 100) / 100);
const pts = (points: [number, number][]) => points.map(([x, y]) => `${n(x)},${n(-y)}`).join(' ');

/** A puffy cloud of circles centred at (x, y) in SVG space: the outline pass under the fill pass merges them. */
function cloud(x: number, y: number, s: number): string {
  const puffs = [
    [-1.25, 0.25, 0.62],
    [-0.45, -0.25, 0.9],
    [0.5, -0.12, 0.78],
    [1.25, 0.28, 0.56],
    [0, 0.35, 0.7],
  ] as const;
  const circles = (extra: string) =>
    puffs
      .map(([dx, dy, r]) => `<circle cx="${n(x + dx * s)}" cy="${n(y + dy * s)}" r="${n(r * s)}"${extra}/>`)
      .join('');
  return (
    `<g fill="#ffffff">${circles(` stroke="#8fb4d8" stroke-width="${n(s * 0.22)}"`)}</g>` +
    `<g fill="#ffffff">${circles('')}</g>` +
    `<path d="M${n(x - 1.6 * s)} ${n(y + 0.62 * s)} H${n(x + 1.6 * s)}" stroke="#d6e8f7" stroke-width="${n(s * 0.3)}" stroke-linecap="round"/>`
  );
}

/** Rounded hills from `left` to `right`: bumps `width` apart rising up to about `amp` above `base` (SVG y). */
function hills(
  left: number,
  right: number,
  base: number,
  amp: number,
  width: number,
  bottom: number,
  rand: () => number,
): string {
  let d = `M${n(left)} ${n(bottom)} L${n(left)} ${n(base)}`;
  for (let x = left; x < right; x += width)
    d += ` Q${n(x + width / 2)} ${n(base - amp * (0.55 + rand()))} ${n(x + width)} ${n(base)}`;
  return `${d} L${n(right + width)} ${n(bottom)} Z`;
}

/** SVG markup of a stage's layout; the viewBox is its `stageFrame` (y flipped to point down). */
export function stageSvg(stage: StageGeometry): string {
  const id = `st${++uid}`;
  const hash = stageHash(stage.id);
  const sky = SKIES[hash % SKIES.length]!;
  let seed = hash || 1;
  const rand = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 2 ** 32;
  };
  const view = stageFrame(stage);
  const w = view.right - view.left;
  const h = view.top - view.bottom;
  const k = w / 220;
  const [left, right, top, bottom] = [view.left - w, view.right + w, -view.top - h, -view.bottom + h];

  const clouds = [0, 1, 2]
    .map((i) => {
      const x = view.left + w * (0.1 + i * 0.34 + rand() * 0.12);
      const y = -view.top + h * (0.07 + rand() * 0.09);
      return cloud(x, y, w * (0.03 + rand() * 0.012));
    })
    .join('');
  const sunX = view.right - w * 0.15;
  const sunY = -view.top + h * 0.14;

  const solids = stage.solids
    .map((solid, i) => {
      const ys = solid.points.map(([, y]) => -y);
      const xs = solid.points.map(([x]) => x);
      const [sLeft, sRight, sTop, sBottom] = [
        Math.min(...xs),
        Math.max(...xs),
        Math.min(...ys),
        Math.max(...ys),
      ];
      const depth = sBottom - sTop;
      const strata = [0.36, 0.62, 0.84]
        .map(
          (f, j) =>
            `<path d="M${n(sLeft - 4)} ${n(sTop + depth * f)} Q${n((sLeft + sRight) / 2)} ${n(sTop + depth * f + (j % 2 ? -3 : 3) * k)} ${n(sRight + 4)} ${n(sTop + depth * f)}" stroke="#3b220f" stroke-opacity="0.22" stroke-width="${n(depth * 0.06)}" fill="none"/>`,
        )
        .join('');
      const rocks = Array.from({ length: 7 }, () => {
        const rx = sLeft + (sRight - sLeft) * (0.12 + rand() * 0.76);
        const ry = sTop + depth * (0.3 + rand() * 0.5);
        const r = (1.5 + rand() * 1.6) * k;
        return (
          `<ellipse cx="${n(rx)}" cy="${n(ry)}" rx="${n(r * 1.3)}" ry="${n(r)}" fill="#5a3618" fill-opacity="0.55"/>` +
          `<ellipse cx="${n(rx - r * 0.3)}" cy="${n(ry - r * 0.3)}" rx="${n(r * 0.5)}" ry="${n(r * 0.35)}" fill="#e0b07a" fill-opacity="0.5"/>`
        );
      }).join('');
      return (
        `<linearGradient id="${id}b${i}" gradientUnits="userSpaceOnUse" x1="0" y1="${n(sTop)}" x2="0" y2="${n(sBottom)}"><stop offset="0" stop-color="#b77d45"/><stop offset="1" stop-color="#6a4122"/></linearGradient>` +
        `<clipPath id="${id}c${i}"><polygon points="${pts(solid.points)}"/></clipPath>` +
        `<polygon points="${pts(solid.points)}" fill="url(#${id}b${i})"/>` +
        `<g clip-path="url(#${id}c${i})"><rect x="${n(sLeft)}" y="${n(sTop)}" width="${n(sRight - sLeft)}" height="${n(depth * 0.18)}" fill="#d29455" fill-opacity="0.5"/>${strata}${rocks}</g>` +
        `<polygon points="${pts(solid.points)}" fill="none" stroke="${INK}" stroke-width="${n(2.2 * k)}" stroke-linejoin="round"/>`
      );
    })
    .join('');

  const grass = compileStage(stage)
    .edges.filter((e) => e.kind === 'floor')
    .map((e) => {
      const line = (dy: number, color: string, width: number, extra = '') =>
        `<path d="M${n(e.a.x)} ${n(-e.a.y + dy * k)} L${n(e.b.x)} ${n(-e.b.y + dy * k)}" stroke="${color}" stroke-width="${n(width * k)}" stroke-linecap="round" fill="none"${extra}/>`;
      const tufts = ` stroke-dasharray="0.01 ${n(4.6 * k)}"`;
      return (
        line(2.8, INK, 4.8, tufts) +
        line(2.8, '#4cbf33', 3, tufts) +
        line(0, INK, 6.4) +
        line(0, '#5fd13d', 4.2) +
        line(-0.9, '#b9f57c', 1.2)
      );
    })
    .join('');

  const platforms = stage.platforms
    .map(
      (p) =>
        `<rect x="${n(p.x1)}" y="${n(-p.y + 2.4 * k)}" width="${n(p.x2 - p.x1)}" height="${n(3.4 * k)}" rx="${n(1.6 * k)}" fill="#000" fill-opacity="0.2"/>` +
        `<rect x="${n(p.x1)}" y="${n(-p.y)}" width="${n(p.x2 - p.x1)}" height="${n(3.8 * k)}" rx="${n(1.6 * k)}" fill="url(#${id}p)" stroke="${INK}" stroke-width="${n(1.5 * k)}"/>` +
        `<path d="M${n(p.x1 + 2 * k)} ${n(-p.y + 1.1 * k)} H${n(p.x2 - 2 * k)}" stroke="#ffffff" stroke-opacity="0.85" stroke-width="${n(0.8 * k)}" stroke-linecap="round"/>`,
    )
    .join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${n(view.left)} ${n(-view.top)} ${n(w)} ${n(h)}" preserveAspectRatio="xMidYMid meet">
<defs>
<linearGradient id="${id}s" gradientUnits="userSpaceOnUse" x1="0" y1="${n(-view.top)}" x2="0" y2="${n(-view.bottom)}"><stop offset="0" stop-color="${sky.top}"/><stop offset="1" stop-color="${sky.bottom}"/></linearGradient>
<radialGradient id="${id}h"><stop offset="0.45" stop-color="${sky.sun}" stop-opacity="0.7"/><stop offset="1" stop-color="${sky.sun}" stop-opacity="0"/></radialGradient>
<linearGradient id="${id}p" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff8e4"/><stop offset="1" stop-color="#c7b58c"/></linearGradient>
</defs>
<rect x="${n(left)}" y="${n(top)}" width="${n(right - left)}" height="${n(bottom - top)}" fill="url(#${id}s)"/>
<circle cx="${n(sunX)}" cy="${n(sunY)}" r="${n(w * 0.1)}" fill="url(#${id}h)"/>
<circle cx="${n(sunX)}" cy="${n(sunY)}" r="${n(w * 0.045)}" fill="${sky.sun}"/>
${clouds}
<path d="${hills(left, right, -view.bottom - h * 0.36, h * 0.11, w * 0.16, bottom, rand)}" fill="${sky.far}"/>
<path d="${hills(left, right, -view.bottom - h * 0.18, h * 0.09, w * 0.12, bottom, rand)}" fill="${sky.near}" stroke="${INK}" stroke-opacity="0.3" stroke-width="${n(1.2 * k)}"/>
${solids}${grass}${platforms}
</svg>`;
}
