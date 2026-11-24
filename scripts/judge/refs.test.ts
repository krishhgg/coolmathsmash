import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { globToRegExp, listImages, matchRefs, refCaption } from './refs';

describe('reference matching', () => {
  it('matches globs within and across folders', () => {
    expect(globToRegExp('smash/run-*').test('smash/run-01.jpg')).toBe(true);
    expect(globToRegExp('smash/run-*').test('smash/deep/run-01.jpg')).toBe(false);
    expect(globToRegExp('**/run-??.jpg').test('smash/deep/run-01.jpg')).toBe(true);
    expect(globToRegExp('**/run-??.jpg').test('run-01.jpg')).toBe(true);
    expect(globToRegExp('a.b+c').test('aXb+c')).toBe(false);
  });

  it('lets every pattern take a turn before any takes a second slot', () => {
    const files = [
      'smash/run-01.jpg',
      'smash/run-02.jpg',
      'smash/run-03.jpg',
      'chars/fb-run-01.png',
      'chars/fb-run-02.png',
    ];
    expect(matchRefs(files, ['smash/run-*', 'chars/fb-run-*', 'missing/*'], 3)).toEqual([
      'smash/run-01.jpg',
      'chars/fb-run-01.png',
      'smash/run-02.jpg',
    ]);
    expect(matchRefs(files, ['smash/*', 'smash/run-01*'], 2)).toEqual([
      'smash/run-01.jpg',
      'smash/run-02.jpg',
    ]);
  });

  it('lists images and reads captions from either research table layout', () => {
    const root = mkdtempSync(join(tmpdir(), 'refs-'));
    mkdirSync(join(root, 'smash'));
    mkdirSync(join(root, 'chars'));
    for (const f of ['smash/run-01.jpg', 'chars/idle-01.png', 'chars/notes.txt'])
      writeFileSync(join(root, f), '');
    writeFileSync(
      join(root, 'smash/index.md'),
      '| File | State | What it shows | Source |\n|---|---|---|---|\n| `run-01.jpg` (1280x720) | run | Pikachu dashing, 1\\|1 overlay | x |\n',
    );
    writeFileSync(
      join(root, 'chars/index.md'),
      '| file | what it shows |\n|---|---|\n| idle-01.png | Fireboy idle |\n',
    );
    expect(listImages(root)).toEqual(['chars/idle-01.png', 'smash/run-01.jpg']);
    expect(refCaption(root, 'smash/run-01.jpg')).toBe('Pikachu dashing, 1|1 overlay');
    expect(refCaption(root, 'chars/idle-01.png')).toBe('Fireboy idle');
    expect(refCaption(root, 'chars/other.png')).toBeUndefined();
  });
});
