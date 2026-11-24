/**
 * Render every song under scripts/audio/music/songs/ to public/audio/music/<id>.mp3 and write the loop
 * points to src/audio/music.json.
 *
 *   node scripts/audio/music/build-music.ts [--only menu,forest-temple] [--wav <dir>]
 *
 * `--wav` keeps a WAV of each file, plus <id>.seam.wav: the last 3 s of the loop straight into its first 3 s,
 * for checking the seam by ear.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { SR, wav } from '../dsp.ts';
import { normalizeLoudness, renderSong, type Song } from './render.ts';

const { values: args } = parseArgs({ options: { only: { type: 'string' }, wav: { type: 'string' } } });
const root = resolve(import.meta.dirname, '..', '..', '..');
const only = args.only?.split(',');
const manifestPath = join(root, 'src', 'audio', 'music.json');
const outDir = join(root, 'public', 'audio', 'music');
mkdirSync(outDir, { recursive: true });

export interface TrackInfo {
  file: string;
  title: string;
  evokes: string;
  loopStart: number;
  loopEnd: number;
}

const manifest = (existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, 'utf8')) : {}) as Record<
  string,
  TrackInfo
>;
const songsDir = join(import.meta.dirname, 'songs');
for (const name of readdirSync(songsDir)
  .filter((f) => f.endsWith('.ts'))
  .sort()) {
  const { song } = (await import(pathToFileURL(join(songsDir, name)).href)) as { song: Song };
  if (only && !only.includes(song.id)) continue;
  const t0 = Date.now();
  const r = renderSong(song);
  const tmp = join(outDir, `.${song.id}.tmp.wav`);
  const { lufs } = normalizeLoudness(r, song.lufs ?? -16, tmp);
  writeFileSync(tmp, wav([r.left, r.right]));
  const file = `music/${song.id}.mp3`;
  execFileSync('ffmpeg', [
    '-y',
    '-loglevel',
    'error',
    '-i',
    tmp,
    '-codec:a',
    'libmp3lame',
    '-q:a',
    '6',
    '-map_metadata',
    '-1',
    '-fflags',
    '+bitexact',
    '-flags:a',
    '+bitexact',
    join(root, 'public', 'audio', file),
  ]);
  if (args.wav) {
    const dir = resolve(args.wav);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, `${song.id}.wav`), readFileSync(tmp));
    const a = Math.round(r.loopStart * SR);
    const b = Math.round(r.loopEnd * SR);
    const n = Math.min(3 * SR, b - a);
    const seam = (ch: Float32Array) => {
      const y = new Float32Array(2 * n);
      y.set(ch.subarray(b - n, b));
      y.set(ch.subarray(a, a + n), n);
      return y;
    };
    writeFileSync(join(dir, `${song.id}.seam.wav`), wav([seam(r.left), seam(r.right)]));
  }
  rmSync(tmp);
  manifest[song.id] = {
    file,
    title: song.title,
    evokes: song.evokes,
    loopStart: Number(r.loopStart.toFixed(6)),
    loopEnd: Number(r.loopEnd.toFixed(6)),
  };
  const kb = Math.round(readFileSync(join(root, 'public', 'audio', file)).length / 1024);
  console.log(
    `${song.id.padEnd(22)} loop ${(r.loopEnd - r.loopStart).toFixed(1)}s intro ${r.loopStart.toFixed(1)}s  ${lufs.toFixed(1)} LUFS  ${kb} KB  (${((Date.now() - t0) / 1000).toFixed(1)}s)`,
  );
}
const sorted = Object.fromEntries(Object.entries(manifest).sort(([a], [b]) => a.localeCompare(b)));
writeFileSync(manifestPath, JSON.stringify(sorted, null, 2) + '\n');
