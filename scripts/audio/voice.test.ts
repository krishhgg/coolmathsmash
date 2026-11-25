import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { bankFiles } from '../../src/audio/bank';

const root = resolve(import.meta.dirname, '..', '..');
const dir = join(root, 'public', 'audio', 'voice');
const voiceFiles = () =>
  bankFiles()
    .filter((f) => f.startsWith('voice/'))
    .sort();

describe('announcer voice files', () => {
  it('exist for every line the bank plays', () => {
    expect(voiceFiles().length).toBeGreaterThan(0);
    expect(voiceFiles().filter((f) => !existsSync(join(root, 'public', 'audio', f)))).toEqual([]);
  });

  it('are exactly the lines the generator renders and the bank plays, so nothing stale ships', () => {
    const spec = JSON.parse(readFileSync(join(import.meta.dirname, 'voice', 'lines.json'), 'utf8')) as {
      lines: Record<string, unknown>;
    };
    const rendered = Object.keys(spec.lines)
      .map((name) => `voice/${name}.mp3`)
      .sort();
    const shipped = readdirSync(dir)
      .map((f) => `voice/${f}`)
      .sort();
    expect(shipped).toEqual(rendered);
    expect(voiceFiles()).toEqual(rendered);
  });

  it('stay small', () => {
    const big = readdirSync(dir).filter((f) => statSync(join(dir, f)).size > 48 * 1024);
    expect(big).toEqual([]);
  });
});
