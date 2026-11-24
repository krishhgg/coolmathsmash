import { existsSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { bankFiles } from '../../src/audio/bank';
import { Rng } from './dsp.ts';
import { RECIPES, recipeFiles } from './sfx.ts';

const root = resolve(import.meta.dirname, '..', '..');

describe('sound effect files', () => {
  it('exist for every file the bank plays', () => {
    const missing = bankFiles().filter((f) => !existsSync(join(root, 'public', 'audio', f)));
    expect(missing).toEqual([]);
  });

  it('are exactly what the recipes render, so nothing stale ships', () => {
    const rendered = Object.keys(RECIPES).flatMap(recipeFiles).sort();
    const shipped = readdirSync(join(root, 'public', 'audio', 'sfx'))
      .map((f) => `sfx/${f}`)
      .sort();
    expect(shipped).toEqual(rendered);
    expect(
      bankFiles()
        .filter((f) => f.startsWith('sfx/'))
        .sort(),
    ).toEqual(rendered);
  });

  it('render reproducibly from their seed', () => {
    const a = RECIPES['hit-light']!.render(new Rng(1), 0);
    const b = RECIPES['hit-light']!.render(new Rng(1), 0);
    expect(a).toEqual(b);
    expect(Math.max(...a.map(Math.abs))).toBeLessThanOrEqual(1);
  });
});
