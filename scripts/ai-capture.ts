/**
 * Record a CPU-vs-CPU match as a clip for PRs and judges. The match runs headless (the same code as the
 * benchmark), then its replay is played back frame by frame in the built game (`/?harness`) and screenshotted, with a
 * small caption naming each port's CPU level and damage. Writes <name>.mp4 (H.264, for PR uploads), <name>.gif
 * (640 wide, for Drive), <name>.png (the last frame) and <name>.json (the replay).
 *
 *   npm run capture:ai -- [--levels 9,3] [--seed 1] [--fighters fireboy,fireboy] [--stage battlefield] [--stocks 3]
 *                         [--from <frame>] [--frames 480] [--every 2] [--out captures/ai] [--name cpu-9-vs-3] [--build]
 *                         [--replay <file.json>] [--labels 'P1 · you,P2 · CPU Lv 9']
 *
 * Without --from the clip ends a second after the first KO. --replay records a saved replay (any match, a person's
 * included) instead of playing one, from frame 0 unless --from says otherwise; --labels replaces the caption names.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { build, preview } from 'vite';
import type * as BenchModule from '../src/ai/bench.ts';
import type * as ReplayModule from '../src/sim/replay.ts';
import { VIEWPORT, launchBrowser } from './lib/browser.ts';
import { loadSource } from './lib/ssr.ts';

type Bench = typeof BenchModule;
type Replays = typeof ReplayModule;

const { values: args } = parseArgs({
  options: {
    levels: { type: 'string', default: '9,3' },
    seed: { type: 'string', default: '1' },
    fighters: { type: 'string', default: 'fireboy,fireboy' },
    stage: { type: 'string', default: 'battlefield' },
    stocks: { type: 'string', default: '3' },
    from: { type: 'string' },
    frames: { type: 'string', default: '480' },
    every: { type: 'string', default: '2' },
    out: { type: 'string', default: 'captures/ai' },
    name: { type: 'string' },
    build: { type: 'boolean', default: false },
    replay: { type: 'string' },
    labels: { type: 'string' },
  },
});

const root = resolve(import.meta.dirname, '..');
const levels = args.levels.split(',').map(Number);
const seed = Number(args.seed);
const name = args.name ?? `cpu-${levels.join('-vs-')}-seed${seed}`;
const out = resolve(root, args.out);
mkdirSync(out, { recursive: true });

const { mod: bench, close } = await loadSource<Bench>('/src/ai/bench.ts');
const { mod: replays, close: closeReplays } = await loadSource<Replays>('/src/sim/replay.ts');
const result = args.replay
  ? null
  : bench.runCpuMatch({
      seed,
      levels,
      fighters: args.fighters.split(','),
      stage: args.stage,
      stocks: Number(args.stocks),
      record: true,
    });
const replay = result ? result.replay! : replays.decodeReplay(readFileSync(resolve(args.replay!), 'utf8'));
await Promise.all([close(), closeReplays()]);
const length = Number(args.frames);
const firstKo = result?.kos[0]?.frame ?? replay.frames.length;
const from = args.from !== undefined ? Number(args.from) : result ? Math.max(0, firstKo + 60 - length) : 0;
const to = Math.min(replay.frames.length, from + length);
const labels = args.labels?.split(',') ?? levels.map((l, i) => `P${i + 1} · CPU Lv ${l}`);
writeFileSync(join(out, `${name}.json`), replays.encodeReplay(replay));
if (result) {
  console.log(
    `${name}: winner P${(result.winner ?? -1) + 1}, ${(result.frames / 60).toFixed(0)} s, KOs at ` +
      `${result.kos.map((k) => `P${k.port + 1}@${k.frame}${k.selfDestruct ? ' (SD)' : ''}`).join(', ')}; clip ${from}-${to}`,
  );
}

if (args.build || !existsSync(join(root, 'dist', 'index.html'))) await build({ root, logLevel: 'warn' });
const server = await preview({ root, preview: { port: 0, open: false }, logLevel: 'warn' });
const url = server.resolvedUrls?.local[0];
if (!url) throw new Error('vite preview did not report a URL');
const browser = await launchBrowser();
const frameDir = join(out, `${name}-frames`);
rmSync(frameDir, { recursive: true, force: true });
mkdirSync(frameDir, { recursive: true });
try {
  const page = await browser.newPage({ viewport: VIEWPORT, deviceScaleFactor: 1 });
  await page.goto(`${url}?harness`);
  await page.locator('body[data-ready="true"]').waitFor();
  await page.evaluate(
    ({ config, labels }) => {
      window.__smash!.newMatch(config);
      const cap = document.createElement('div');
      cap.id = 'cpu-caption';
      cap.style.cssText =
        'position:fixed;left:0;right:0;top:0;display:flex;justify-content:space-around;padding:14px 0 10px;' +
        'font:bold 26px system-ui,sans-serif;color:#fff;text-shadow:0 2px 4px #000,0 0 2px #000;pointer-events:none;';
      cap.dataset.labels = JSON.stringify(labels);
      document.body.appendChild(cap);
    },
    { config: replay.config, labels },
  );
  const chunk = 600;
  for (let f = 0; f < from; f += chunk) {
    await page.evaluate(
      (frames) => {
        for (const i of frames) window.__smash!.step(1, i);
      },
      replay.frames.slice(f, Math.min(from, f + chunk)),
    );
  }
  const every = Number(args.every);
  let n = 0;
  for (let f = from; f < to; f++) {
    await page.evaluate((i) => window.__smash!.step(1, i), replay.frames[f]!);
    if ((f - from) % every !== 0) continue;
    await page.evaluate(() => {
      const s = window.__smash!.getState();
      const cap = document.getElementById('cpu-caption')!;
      const labels = JSON.parse(cap.dataset.labels!) as string[];
      cap.innerHTML = s.fighters
        .map(
          (f, i) =>
            `<span>${labels[i]} &nbsp; ${Math.floor(f.damage)}% &nbsp; ${'●'.repeat(Math.max(0, f.stocks))}</span>`,
        )
        .join('');
    });
    await page.evaluate(() => window.__smash!.render());
    await page.screenshot({ path: join(frameDir, `${String(n++).padStart(4, '0')}.png`) });
  }
  const fps = String(60 / every);
  const input = ['-framerate', fps, '-i', join(frameDir, '%04d.png')];
  const ffmpeg = (...a: string[]) =>
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', ...a], { stdio: 'inherit' });
  ffmpeg(
    ...input,
    '-c:v',
    'libx264',
    '-pix_fmt',
    'yuv420p',
    '-crf',
    '20',
    '-movflags',
    '+faststart',
    join(out, `${name}.mp4`),
  );
  ffmpeg(
    ...input,
    '-vf',
    'scale=640:-1:flags=lanczos,split[a][b];[a]palettegen=stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=4',
    join(out, `${name}.gif`),
  );
  execFileSync('cp', [join(frameDir, `${String(n - 1).padStart(4, '0')}.png`), join(out, `${name}.png`)]);
  rmSync(frameDir, { recursive: true, force: true });
  console.log(`wrote ${join(out, name)}.{mp4,gif,png,json}`);
} finally {
  await browser.close();
  await server.close();
}
