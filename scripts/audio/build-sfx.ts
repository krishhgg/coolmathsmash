/**
 * Render every sound effect recipe (scripts/audio/sfx.ts) to public/audio/sfx/<name>-<n>.mp3.
 *
 *   node scripts/audio/build-sfx.ts [--only hit-light,jump] [--wav <dir>]
 *
 * `--wav` also keeps the 16-bit WAVs there for listening or spectrograms. Renders are seeded, so rerunning it
 * without changing a recipe rewrites identical files.
 */
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { Rng, duration, encodeMp3, peak, rms } from './dsp.ts';
import { RECIPES } from './sfx.ts';

const { values: args } = parseArgs({ options: { only: { type: 'string' }, wav: { type: 'string' } } });
const root = resolve(import.meta.dirname, '..', '..');
const only = args.only?.split(',');

/** A stable seed per file name. */
const seed = (s: string) => [...s].reduce((h, ch) => Math.imul(h ^ ch.charCodeAt(0), 16777619), 2166136261);

for (const [name, recipe] of Object.entries(RECIPES)) {
  if (only && !only.includes(name)) continue;
  for (let v = 0; v < recipe.variants; v++) {
    const file = `${name}-${v + 1}`;
    const x = recipe.render(new Rng(seed(file)), v);
    encodeMp3(
      join(root, 'public', 'audio', 'sfx', `${file}.mp3`),
      [x],
      5,
      args.wav ? join(resolve(args.wav), `${file}.wav`) : undefined,
    );
    const db = (g: number) => (20 * Math.log10(Math.max(g, 1e-9))).toFixed(1);
    console.log(
      `${file.padEnd(16)} ${duration(x).toFixed(2)}s  peak ${db(peak(x))} dB  rms ${db(rms(x))} dB`,
    );
  }
}
