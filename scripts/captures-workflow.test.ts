import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const workflow = readFileSync(new URL('../.github/workflows/captures.yml', import.meta.url), 'utf8');

describe('Captures workflow', () => {
  it('runs nightly on the default branch and by manual dispatch, not on PRs or pushes', () => {
    const triggers = /^on:\n((?: +[^\n]*\n)+)/m.exec(workflow)?.[1];
    expect(triggers?.match(/^ {2}[\w_]+:/gm)?.map((line) => line.trim())).toEqual([
      'schedule:',
      'workflow_dispatch:',
    ]);
    expect(triggers).toMatch(/^ {4}- cron: '/m);
  });
});
