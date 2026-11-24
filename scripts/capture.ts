/**
 * Capture every named scenario (src/harness/scenarios.ts) in headless Chromium at 1280x720:
 * `<name>.png` at the capture frame, and for scenarios with a motion window a filmstrip (`<name>.strip.png`,
 * for judges), a GIF (Drive) and an H.264 MP4 (PR uploads), plus `manifest.json`. See docs/hill-climb.md.
 *
 *   npm run capture -- [--only idle,run] [--out captures/<run>] [--url <base>] [--build] [--keep-frames]
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import type { Browser, Page } from '@playwright/test';
import { build, preview } from 'vite';
import type {
  FighterSummary,
  GameScenarioInfo,
  LabScenario,
  ScenarioInfo,
} from '../src/harness/scenarios.ts';
import { VIEWPORT, dataUrl, escapeHtml, htmlToPng, launchBrowser } from './lib/browser.ts';
import { fighterLine, type CaptureRecord, type Manifest } from './lib/manifest.ts';

const FPS = 60;
const isLab = (s: ScenarioInfo): s is LabScenario => s.page.kind === 'lab';
const STRIP_TILES = 24;
const STRIP_COLUMNS = 6;

const { values: args } = parseArgs({
  options: {
    only: { type: 'string' },
    out: { type: 'string' },
    url: { type: 'string' },
    build: { type: 'boolean', default: false },
    'keep-frames': { type: 'boolean', default: false },
  },
});

const root = resolve(import.meta.dirname, '..');
const git = gitInfo();
const out = resolve(args.out ?? join(root, 'captures', git.sha.slice(0, 7)));
const hasFfmpeg = spawnSync('ffmpeg', ['-version'], { stdio: 'ignore' }).status === 0;

function gitInfo(): Manifest['git'] {
  const run = (...a: string[]) => execFileSync('git', a, { cwd: root, encoding: 'utf8' }).trim();
  try {
    return {
      sha: run('rev-parse', 'HEAD'),
      branch: run('rev-parse', '--abbrev-ref', 'HEAD'),
      dirty: run('status', '--porcelain') !== '',
    };
  } catch {
    return { sha: 'unknown', branch: 'unknown', dirty: true };
  }
}

function newestMtime(path: string): number {
  const st = statSync(path);
  if (!st.isDirectory()) return st.mtimeMs;
  return Math.max(st.mtimeMs, ...readdirSync(path).map((name) => newestMtime(join(path, name))));
}

/** Build dist/ when it is missing or older than any source, then serve it on a free port. */
async function serveDist(): Promise<{ url: string; close(): Promise<void> }> {
  const built = join(root, 'dist', 'index.html');
  const sources = ['src', 'index.html', 'lab.html', 'vite.config.ts', 'package-lock.json', 'public']
    .map((p) => join(root, p))
    .filter(existsSync);
  if (args.build || !existsSync(built) || Math.max(...sources.map(newestMtime)) > statSync(built).mtimeMs) {
    console.log('building dist/ ...');
    await build({ root, logLevel: 'warn' });
  }
  const server = await preview({ root, preview: { port: 0, open: false }, logLevel: 'warn' });
  const url = server.resolvedUrls?.local[0];
  if (!url) throw new Error('vite preview did not report a URL');
  return { url, close: () => server.close() };
}

async function open(page: Page, url: string): Promise<void> {
  await page.goto(url);
  await page.locator('body[data-ready="true"]').waitFor();
}

const shoot = (page: Page) => page.locator('#app canvas').screenshot({ animations: 'disabled' });

function ffmpeg(...a: string[]): void {
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', ...a], { stdio: 'inherit' });
}

function save(name: string, bytes: Buffer): string {
  writeFileSync(join(out, name), bytes);
  return name;
}

async function captureGame(page: Page, base: string, s: GameScenarioInfo): Promise<CaptureRecord> {
  const url = `${base}?harness`;
  const rec: CaptureRecord = {
    name: s.name,
    description: s.description,
    page: 'game',
    url,
    status: 'pending',
    files: {},
  };
  rec.rule = 'frame' in s.capture ? `frame ${s.capture.frame}` : s.capture.label;
  await open(page, url);
  let cur = await page.evaluate((n) => window.__smash!.runScenario(n, { frame: 1 }), s.name);
  if (cur.status !== 'captured' || cur.captureFrame === undefined)
    return { ...rec, status: cur.status, reason: cur.reason };
  const at = cur.captureFrame;
  const from = s.motion ? Math.max(1, at - s.motion.before) : at;
  const to = s.motion ? at + s.motion.after : at;
  if (from > cur.frame)
    cur = { ...cur, ...(await page.evaluate((n) => window.__smash!.stepScenario(n), from - cur.frame)) };
  const frameDir = join(out, 'frames', s.name);
  if (s.motion) mkdirSync(frameDir, { recursive: true });
  const frames: { frame: number; fighters: FighterSummary[]; png: Buffer }[] = [];
  for (;;) {
    const png = await shoot(page);
    if (cur.frame === at) {
      rec.files.png = save(`${s.name}.png`, png);
      Object.assign(rec, { status: 'captured', frame: at, fighters: cur.fighters, hash: cur.hash });
      rec.sha256 = createHash('sha256').update(png).digest('hex');
    }
    if (s.motion) {
      frames.push({ frame: cur.frame, fighters: cur.fighters, png });
      writeFileSync(join(frameDir, `${String(frames.length).padStart(4, '0')}.png`), png);
    }
    if (cur.frame >= to) break;
    cur = { ...cur, ...(await page.evaluate(() => window.__smash!.stepScenario(1))) };
  }
  if (!s.motion) return rec;
  rec.motion = { from, to, fps: FPS, frames: frames.map(({ frame, fighters }) => ({ frame, fighters })) };
  rec.files.strip = save(
    `${s.name}.strip.png`,
    await filmstrip(page.context().browser()!, s.name, frames, at),
  );
  if (hasFfmpeg) {
    const input = ['-framerate', String(FPS), '-i', join(frameDir, '%04d.png')];
    rec.files.mp4 = `${s.name}.mp4`;
    ffmpeg(
      ...input,
      '-c:v',
      'libx264',
      '-pix_fmt',
      'yuv420p',
      '-crf',
      '18',
      '-movflags',
      '+faststart',
      join(out, rec.files.mp4),
    );
    rec.files.gif = `${s.name}.gif`;
    const palette =
      'fps=30,scale=640:-1:flags=lanczos,split[a][b];[a]palettegen=stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=4';
    ffmpeg(...input, '-vf', palette, join(out, rec.files.gif));
  }
  if (!args['keep-frames']) rmSync(join(out, 'frames'), { recursive: true, force: true });
  return rec;
}

/** Every k-th frame of the clip (always including the capture frame) on one labelled sheet. */
async function filmstrip(
  browser: Browser,
  name: string,
  frames: { frame: number; fighters: FighterSummary[]; png: Buffer }[],
  at: number,
): Promise<Buffer> {
  const step = Math.max(1, Math.ceil(frames.length / STRIP_TILES));
  const picked = frames.filter((f) => (f.frame - at) % step === 0);
  const tiles = picked.map((f) => {
    const mark = f.frame === at ? ' ◆ capture' : '';
    const lines = [`f${f.frame}${mark}`, ...f.fighters.map(fighterLine)].map(escapeHtml).join('<br>');
    const border = f.frame === at ? '#ffcc00' : '#333';
    return `<figure style="margin:0;border:2px solid ${border}"><img src="${dataUrl(f.png)}" width="316" height="178" style="display:block"><figcaption style="padding:3px 4px">${lines}</figcaption></figure>`;
  });
  const first = frames[0]!.frame;
  const last = frames[frames.length - 1]!.frame;
  const title = `${name}: frames ${first}-${last} at ${FPS} fps, every ${step === 1 ? 'frame' : `${step} frames`}; ◆ = capture frame ${at}`;
  const width = STRIP_COLUMNS * 320 + (STRIP_COLUMNS - 1) * 6 + 20;
  return htmlToPng(
    browser,
    `<body style="margin:0;background:#111;color:#ddd;font:11px/1.35 monospace"><div style="padding:8px 10px;font:bold 15px sans-serif;color:#fff">${escapeHtml(title)}</div><div style="display:grid;grid-template-columns:repeat(${STRIP_COLUMNS},320px);gap:6px;padding:0 10px 10px">${tiles.join('')}</div></body>`,
    width,
  );
}

async function captureLab(page: Page, base: string, s: LabScenario): Promise<CaptureRecord> {
  const { scene, params = {} } = s.page;
  const url = `${base}lab.html?${new URLSearchParams({ scene, ...params }).toString()}`;
  const rec: CaptureRecord = {
    name: s.name,
    description: s.description,
    page: `lab:${scene}`,
    url,
    status: 'pending',
    files: {},
  };
  await open(page, url);
  const scenes = await page.evaluate(() => window.__lab!.scenes);
  if (!scenes.includes(scene)) return { ...rec, reason: `needs lab scene '${scene}'` };
  for (const { fn, args: callArgs = [] } of s.calls ?? []) {
    try {
      await page.evaluate(([f, a]) => window.__lab!.call(f, ...a), [fn, callArgs] as const);
    } catch (e) {
      if (!/has no api function/.test(String(e))) throw e;
      return { ...rec, reason: `needs lab api ${scene}.${fn}()` };
    }
  }
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  const png = await shoot(page);
  rec.files.png = save(`${s.name}.png`, png);
  return { ...rec, status: 'captured', sha256: createHash('sha256').update(png).digest('hex') };
}

async function main(): Promise<number> {
  const server = args.url ? null : await serveDist();
  const base = (args.url ?? server!.url).replace(/\/?$/, '/');
  const browser = await launchBrowser();
  try {
    const page = await browser.newPage({ viewport: VIEWPORT, deviceScaleFactor: 1 });
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await open(page, `${base}?harness`);
    const all = await page.evaluate(() => window.__smash!.scenarios());
    const only = args.only
      ?.split(',')
      .map((n) => n.trim())
      .filter(Boolean);
    const unknown = only?.filter((n) => !all.some((s) => s.name === n)) ?? [];
    if (unknown.length)
      throw new Error(
        `unknown scenario(s) ${unknown.join(', ')} (have: ${all.map((s) => s.name).join(', ')})`,
      );
    rmSync(out, { recursive: true, force: true });
    mkdirSync(out, { recursive: true });
    const records: CaptureRecord[] = [];
    for (const s of all.filter((x) => !only || only.includes(x.name))) {
      errors.length = 0;
      let rec: CaptureRecord;
      try {
        rec = isLab(s) ? await captureLab(page, base, s) : await captureGame(page, base, s);
      } catch (e) {
        rec = {
          name: s.name,
          description: s.description,
          page: s.page.kind,
          url: base,
          status: 'error',
          reason: String(e),
          files: {},
        };
      }
      if (errors.length) Object.assign(rec, { status: 'error', reason: `page error: ${errors.join('; ')}` });
      records.push(rec);
      const detail =
        rec.status === 'captured'
          ? `frame ${rec.frame ?? '-'}  ${Object.values(rec.files).join(' ')}`
          : (rec.reason ?? '');
      console.log(`${rec.status.padEnd(8)} ${s.name.padEnd(22)} ${detail}`);
    }
    const manifest: Manifest = {
      version: 1,
      createdAt: new Date().toISOString(),
      git,
      baseUrl: base,
      viewport: VIEWPORT,
      browser: `chromium ${browser.version()}`,
      video: hasFfmpeg,
      scenarios: records,
    };
    writeFileSync(join(out, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
    if (!hasFfmpeg) console.warn('ffmpeg not found: skipped GIF and MP4 clips');
    console.log(`wrote ${relative(process.cwd(), join(out, 'manifest.json'))}`);
    return records.some((r) => r.status === 'missed' || r.status === 'error') ? 1 : 0;
  } finally {
    await browser.close();
    await server?.close();
  }
}

process.exitCode = await main();
