/**
 * Build a judge pack from a capture run: per state a contact sheet (our capture left, references right), the
 * filmstrip and per-frame motion table for motion states, plus rubric.md, schema.json and prompt.md, the exact
 * prompt each judge subagent receives. See docs/hill-climb.md.
 *
 *   npm run judge:pack -- captures/<run> [--out <dir>] [--refs <dir>] [--map scripts/judge/refs.json]
 *                         [--round <n>] [--previous <previous pack dir>] [--notes <file>]
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { extname, join, relative, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import type { Browser } from '@playwright/test';
import { dataUrl, escapeHtml, htmlToPng, launchBrowser } from './lib/browser.ts';
import { fighterLine, type CaptureRecord, type Manifest } from './lib/manifest.ts';
import type { Scoreboard } from './judge/aggregate.ts';
import { buildPrompt, motionMarkdown, type PackInfo, type PackState } from './judge/pack.ts';
import { expandHome, listImages, matchRefs, refCaption, type RefMap } from './judge/refs.ts';
import { AXES, rubricMarkdown } from './judge/rubric.ts';
import { judgeSchema } from './judge/schema.ts';

const { values: args, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    out: { type: 'string' },
    refs: { type: 'string' },
    map: { type: 'string', default: join(import.meta.dirname, 'judge', 'refs.json') },
    round: { type: 'string' },
    previous: { type: 'string' },
    notes: { type: 'string' },
  },
});

const MIME: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
};
const readJson = <T>(path: string) => JSON.parse(readFileSync(path, 'utf8')) as T;

async function contactSheet(
  browser: Browser,
  rec: CaptureRecord,
  capture: Buffer,
  refs: PackState['refs'],
  packDir: string,
  sha: string,
): Promise<Buffer> {
  const meta = [
    rec.page,
    rec.frame !== undefined ? `frame ${rec.frame}` : '',
    rec.rule ?? '',
    `commit ${sha}`,
  ]
    .filter(Boolean)
    .join(' · ');
  const fighters = (rec.fighters ?? []).map(fighterLine).map(escapeHtml).join('<br>');
  const refCells = refs.map((r) => {
    const src = dataUrl(
      readFileSync(join(packDir, r.file)),
      MIME[extname(r.file).toLowerCase()] ?? 'image/png',
    );
    const caption =
      escapeHtml(r.source) +
      (r.caption ? `<br><span style="color:#bbb">${escapeHtml(r.caption)}</span>` : '');
    return `<figure style="margin:0"><div style="height:250px;background:#0c0d10;display:flex;align-items:center;justify-content:center"><img src="${src}" style="max-width:100%;max-height:250px"></div><figcaption style="padding:4px 2px;font-size:12px">${caption}</figcaption></figure>`;
  });
  const empty =
    '<div style="padding:24px;border:1px dashed #555;color:#bbb">No reference images matched yet (scripts/judge/refs.json). Judge against the rubric anchors.</div>';
  const html = `<body style="margin:0;background:#16181d;color:#e8e8e8;font:14px/1.35 system-ui,sans-serif">
<header style="padding:12px 16px;border-bottom:1px solid #333"><b style="font-size:24px">${escapeHtml(rec.name)}</b>&nbsp;&nbsp;${escapeHtml(rec.description)}<div style="color:#aaa;font-size:13px;margin-top:2px">${escapeHtml(meta)}</div></header>
<main style="display:flex;gap:16px;padding:16px">
<section style="width:960px;flex:none"><div style="font:bold 15px sans-serif;color:#ffcc00;margin-bottom:6px">OURS</div><img src="${dataUrl(capture)}" width="960" height="540" style="display:block"><div style="font:12px/1.4 monospace;color:#ccc;margin-top:6px">${fighters}</div></section>
<section style="flex:1"><div style="font:bold 15px sans-serif;color:#7fd1ff;margin-bottom:6px">REFERENCE</div><div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">${refCells.join('') || empty}</div></section>
</main></body>`;
  return htmlToPng(browser, html, 1920);
}

async function main(): Promise<void> {
  const capturesDir = resolve(positionals[0] ?? 'captures');
  const manifest = readJson<Manifest>(join(capturesDir, 'manifest.json'));
  const map = readJson<RefMap>(args.map);
  const refsRoot = resolve(expandHome(args.refs ?? map.root));
  const packDir = resolve(args.out ?? join(capturesDir, 'pack'));
  const previousDir = args.previous ? resolve(args.previous) : undefined;
  const previousBoard =
    previousDir && existsSync(join(previousDir, 'scoreboard.json'))
      ? readJson<Scoreboard>(join(previousDir, 'scoreboard.json'))
      : undefined;
  const round = Number(args.round ?? (previousBoard ? previousBoard.round + 1 : 1));
  const library = listImages(refsRoot);
  if (library.length === 0) console.warn(`no reference images under ${refsRoot}`);
  rmSync(packDir, { recursive: true, force: true });
  mkdirSync(join(packDir, 'judges'), { recursive: true });

  const sha = manifest.git.sha.slice(0, 7) + (manifest.git.dirty ? '+dirty' : '');
  const browser = await launchBrowser();
  const states: PackState[] = [];
  try {
    for (const rec of manifest.scenarios.filter((r) => r.status === 'captured' && r.files.png)) {
      const dir = join('states', rec.name);
      mkdirSync(join(packDir, dir, 'refs'), { recursive: true });
      const patterns = rec.refs ?? map.states[rec.name] ?? [];
      const sources = matchRefs(library, patterns, map.maxPerState);
      const refs = sources.map((source) => {
        const file = join(dir, 'refs', source.replace(/\//g, '__'));
        copyFileSync(join(refsRoot, source), join(packDir, file));
        return { file, source, caption: refCaption(refsRoot, source) };
      });
      const capture = readFileSync(join(capturesDir, rec.files.png!));
      const files: PackState['files'] = { sheet: join(dir, 'sheet.png'), capture: join(dir, 'capture.png') };
      writeFileSync(join(packDir, files.capture), capture);
      writeFileSync(
        join(packDir, files.sheet),
        await contactSheet(browser, rec, capture, refs, packDir, sha),
      );
      if (rec.files.strip) {
        files.strip = join(dir, 'strip.png');
        copyFileSync(join(capturesDir, rec.files.strip), join(packDir, files.strip));
      }
      if (rec.motion) {
        files.motion = join(dir, 'motion.md');
        writeFileSync(join(packDir, files.motion), motionMarkdown(rec));
      }
      if (rec.files.mp4) {
        files.mp4 = join(dir, 'clip.mp4');
        copyFileSync(join(capturesDir, rec.files.mp4), join(packDir, files.mp4));
      }
      states.push({
        name: rec.name,
        description: rec.description,
        page: rec.page,
        rule: rec.rule,
        frame: rec.frame,
        motion: !!rec.motion,
        fighters: rec.fighters,
        files,
        refs,
      });
      console.log(
        `${rec.name.padEnd(22)} ${refs.length} reference(s)${refs.length ? '' : `: none matched ${JSON.stringify(patterns)}`}`,
      );
    }
  } finally {
    await browser.close();
  }

  const pack: PackInfo = {
    version: 1,
    round,
    createdAt: new Date().toISOString(),
    git: manifest.git,
    captures: capturesDir,
    refsRoot,
    axes: AXES.map(({ id, title }) => ({ id, title })),
    states,
    notJudged: manifest.scenarios
      .filter((r) => r.status !== 'captured')
      .map((r) => ({ name: r.name, status: r.status, reason: r.reason ?? '' })),
    previous: previousDir,
  };
  const rubric = rubricMarkdown();
  const schema = judgeSchema(round, states);
  const notes = args.notes ? readFileSync(args.notes, 'utf8') : undefined;
  writeFileSync(join(packDir, 'pack.json'), `${JSON.stringify(pack, null, 2)}\n`);
  writeFileSync(join(packDir, 'rubric.md'), `# Judge rubric\n\n${rubric}`);
  writeFileSync(join(packDir, 'schema.json'), `${JSON.stringify(schema, null, 2)}\n`);
  writeFileSync(join(packDir, 'prompt.md'), buildPrompt(pack, rubric, schema, previousBoard, notes));
  console.log(
    `wrote ${relative(process.cwd(), join(packDir, 'prompt.md'))} (round ${round}, ${states.length} states, ${pack.notJudged.length} not judged)`,
  );
}

await main();
