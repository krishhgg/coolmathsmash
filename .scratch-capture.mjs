import { chromium } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';

const base = process.argv[2] ?? 'http://localhost:4173/';
const out = process.argv[3];
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto(base + '?harness');
await page.waitForFunction(() => !!window.__smash);

async function setup(p1, p2, overlays = true) {
  await page.evaluate(([p1, p2, overlays]) => {
    const s = window.__smash;
    s.newMatch({ ports: [{ fighter: 'bloxorz' }, { fighter: 'fireboy' }] });
    s.setOverlay('hitboxes', overlays);
    s.step(5);
    s.patch(0, p1);
    s.patch(1, p2);
  }, [p1, p2, overlays]);
}
const step = (n, inputs) => page.evaluate(([n, inputs]) => window.__smash.step(n, inputs), [n, inputs]);
const render = () => page.evaluate(() => window.__smash.render());
const shot = async (name, clip) => {
  await render();
  await page.screenshot({ path: `${out}/${name}.png`, clip });
};
const CROP = { x: 340, y: 150, width: 600, height: 400 };

const MOVES = [
  ['jab', 5, false], ['ftilt', 12, false], ['utilt', 10, false], ['dtilt', 8, false], ['dashAttack', 10, false],
  ['fsmash', 20, false], ['usmash', 14, false], ['dsmash', 13, false], ['nair', 9, true], ['fair', 11, true],
  ['bair', 10, true], ['uair', 9, true], ['dair', 16, true], ['grab', 9, false], ['dsmash', 17, false],
];
await setup({ pos: { x: -14, y: 0 }, facing: 1, action: 'idle' }, { pos: { x: 14, y: 0 }, facing: -1, action: 'idle' });
await step(90);
await shot('idle-hurtbox', CROP);
let i = 0;
for (const [move, frame, air] of MOVES) {
  const fy = air ? 12 : 0;
  const facing = move === 'bair' ? -1 : 1;
  await setup({ pos: { x: -12, y: 0 }, facing, action: 'idle' }, { pos: { x: 24, y: 0 }, facing: -1, action: 'idle' });
  await step(90);
  const p1 = air
    ? { pos: { x: -12, y: fy }, ground: null, vel: { x: 0, y: 0 }, action: 'aerial', actionFrame: 0, move, facing }
    : { action: 'attack', actionFrame: 0, move, facing };
  await page.evaluate((p1) => window.__smash.patch(0, p1), p1);
  if (air) {
    // hold the block's height steady so every aerial is shown at the same spot
    for (let k = 0; k < frame; k++) {
      await page.evaluate((y) => { window.__smash.patch(0, { pos: { y }, vel: { y: 0 } }); window.__smash.step(1); }, fy);
    }
  } else await step(frame);
  await shot(`move-${String(i++).padStart(2, '0')}-${move}`, air ? { ...CROP, y: 20 } : CROP);
}
// Motion: dash attack carrying Fireboy, fsmash KO at 80% from the ledge.
async function clip(name, frames, inputs) {
  const dir = `${out}/frames-${name}`;
  mkdirSync(dir, { recursive: true });
  for (let k = 0; k < frames; k++) {
    await step(1, inputs?.(k));
    await render();
    await page.screenshot({ path: `${dir}/${String(k).padStart(4, '0')}.png` });
  }
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', '60', '-i', `${dir}/%04d.png`, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', `${out}/${name}.mp4`]);
}
await setup({ pos: { x: -60, y: 0 }, facing: 1, action: 'idle' }, { pos: { x: -40, y: 0 }, facing: -1, action: 'idle' });
const run = (k) => [{ x: k < 14 ? 100 : 0, y: 0, cx: 0, cy: 0, buttons: k === 13 ? 1 : 0 }, { x: 0, y: 0, cx: 0, cy: 0, buttons: 0 }];
await clip('dash-attack', 110, run);
await setup({ pos: { x: 52, y: 0 }, facing: 1, action: 'idle' }, { pos: { x: 76, y: 0 }, facing: -1, action: 'idle', damage: 80 });
await clip('fsmash-ko-80', 130, (k) => [{ x: 0, y: 0, cx: k < 2 ? 100 : 0, cy: 0, buttons: 0 }, { x: 0, y: 0, cx: 0, cy: 0, buttons: 0 }]);
await browser.close();
