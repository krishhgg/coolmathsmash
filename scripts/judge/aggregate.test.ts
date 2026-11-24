import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { HISTORY_HEADER, aggregate, appendHistory, mergeGaps, scoreboardMarkdown } from './aggregate';
import type { PackInfo } from './pack';
import { judgeSchema, validate, type JudgeVerdict } from './schema';

const pack: PackInfo = {
  version: 1,
  round: 2,
  createdAt: '2026-11-24T00:00:00.000Z',
  git: { sha: 'abcdef1234567', branch: 'main', dirty: false },
  captures: '/tmp/captures',
  refsRoot: '/tmp/refs',
  axes: [],
  states: [
    {
      name: 'idle',
      description: '',
      page: 'game',
      motion: false,
      files: { sheet: '', capture: '' },
      refs: [],
    },
    { name: 'run', description: '', page: 'game', motion: true, files: { sheet: '', capture: '' }, refs: [] },
  ],
  notJudged: [{ name: 'hud', status: 'pending', reason: 'needs the in-match HUD' }],
};

const scores = (physics: number | null, rest: number) => ({
  physics_feel: physics,
  silhouette: rest,
  art_fidelity: rest,
  readability: rest,
  smash_presentation: rest,
});

const gap = (rank: number, state: string, axis: string, text: string) => ({
  rank,
  state,
  axis,
  gap: text,
  evidence: 'sheet.png',
  fix: `fix ${rank}`,
});

const opus: JudgeVerdict = {
  judge: 'claude-opus-5-5',
  round: 2,
  states: {
    idle: { scores: scores(null, 2), notes: 'capsules' },
    run: { scores: scores(3, 2), notes: 'no dust' },
  },
  gaps: [
    gap(1, 'run', 'physics_feel', 'Run has no dash dust and the dash start is instant'),
    gap(2, '*', 'silhouette', 'Fighters are orange capsules, not Fireboy'),
    gap(3, 'idle', 'smash_presentation', 'No HUD at the bottom of the screen'),
  ],
  regressions: [],
};

const sol: JudgeVerdict = {
  judge: 'gpt-6.2-sol',
  round: 2,
  states: { idle: { scores: scores(null, 6), notes: 'ok' }, run: { scores: scores(4, 3), notes: 'ok' } },
  gaps: [
    gap(1, 'idle', 'silhouette', 'Fighters are plain orange capsules instead of Fireboy art'),
    gap(2, 'run', 'physics_feel', 'Dash start is instant with no dash dust cloud'),
    gap(3, 'run', 'readability', 'Port tags overlap the platform'),
  ],
  regressions: ['run lost its dust'],
};

describe('judge schema', () => {
  const schema = judgeSchema(2, pack.states);

  it('accepts a well-formed verdict', () => {
    expect(validate(schema, opus)).toEqual([]);
  });

  it('reports every problem with its path', () => {
    const bad = structuredClone(opus) as unknown as Record<string, unknown> & typeof opus;
    bad.round = 3;
    bad.states.idle!.scores.physics_feel = 5;
    bad.states.run!.scores.silhouette = 11;
    delete (bad.states as Record<string, unknown>).run;
    bad.gaps[0]!.axis = 'vibes';
    (bad as Record<string, unknown>).extra = true;
    expect(validate(schema, bad)).toEqual([
      '$.round: must be 2',
      '$.states.run: missing',
      '$.states.idle.scores.physics_feel: expected null, got integer',
      expect.stringMatching(/^\$\.gaps\[0\]\.axis: must be one of/),
      '$.extra: not allowed',
    ]);
  });
});

describe('mandatory scores', () => {
  it('requires scores that always apply and physics on motion states, and allows null only where the rubric does', () => {
    const schema = judgeSchema(2, pack.states);
    const v = structuredClone(opus);
    v.states.idle!.scores.readability = null;
    v.states.run!.scores.physics_feel = null;
    v.states.run!.scores.smash_presentation = null;
    v.states.idle!.scores.art_fidelity = null;
    expect(validate(schema, v)).toEqual([
      '$.states.idle.scores.readability: expected integer, got null',
      '$.states.run.scores.physics_feel: expected integer, got null',
      '$.states.run.scores.smash_presentation: expected integer, got null',
    ]);
  });
});

describe('aggregation', () => {
  const board = aggregate(pack, [sol, opus], '2026-11-24T12:00:00.000Z');

  it('averages per state, axis and judge, skipping not-applicable scores', () => {
    expect(board.judges).toEqual(['claude-opus-5-5', 'gpt-6.2-sol']);
    const idle = board.states[0]!;
    expect(idle.scores.silhouette).toEqual({ 'claude-opus-5-5': 2, 'gpt-6.2-sol': 6 });
    expect(idle.mean.physics_feel).toBeNull();
    expect(idle.mean.silhouette).toBe(4);
    expect(board.axisMeans.physics_feel).toBe(3.5);
    expect(board.judgeAxisMeans['gpt-6.2-sol']!.silhouette).toBe(4.5);
    expect(board.overall).toBe(3.28);
  });

  it('flags axes where judges are more than 2 points apart', () => {
    expect(board.disagreements.map((d) => `${d.state}/${d.axis}`)).toEqual([
      'idle/silhouette',
      'idle/art_fidelity',
      'idle/readability',
      'idle/smash_presentation',
    ]);
  });

  it('merges the same gap from both judges and ranks agreement first', () => {
    const gaps = mergeGaps([opus, sol]);
    expect(gaps).toHaveLength(4);
    expect(gaps[0]!.judges).toEqual([
      { judge: 'claude-opus-5-5', rank: 1 },
      { judge: 'gpt-6.2-sol', rank: 2 },
    ]);
    expect(gaps[1]).toMatchObject({ state: '*', axis: 'silhouette', weight: 1.5 });
    expect(gaps.map((g) => g.axis)).toEqual([
      'physics_feel',
      'silhouette',
      'smash_presentation',
      'readability',
    ]);
  });

  it('merges paraphrased gaps from real round-1 answers and keeps different issues apart', () => {
    const push = {
      gap: 'Fighters have no push collision: the runner passes into the standing opponent at full speed, and the opponent never moves.',
      fix: "Add a ground pushbox (half-width 4 units, the fighter width / 2). Each frame, for each overlapping pair of grounded fighters processed in port order for determinism, push both apart by min(overlap/2, 0.5 u/f), and cap an approaching runner's speed toward the other fighter at walk speed (1.1) while the pushboxes overlap. Add a unit test: a run into an idle fighter ends with the pair separated within about 10 frames.",
    };
    const spacing = {
      gap: 'A grounded run into an idle opponent shows deep body overlap with no visible spacing response.',
      fix: 'Measure the same grounded run-into-idle contact in Ultimate and tune a separate grounded body-push region to match it. Add a head-on fixture for spacing and crossing, and keep hurtboxes and any intentional pass-through states independent of the push region.',
    };
    const dash = {
      gap: "The measured dash-to-run handoff is a frame earlier than Fireboy's stated dash duration.",
      fix: 'Count 11 applied dash-speed steps from the first movement tick before entering run on step 12, and lock the first run frame and accumulated distance in a held-input test.',
    };
    const verdict = (judge: string, gaps: { gap: string; fix: string }[]): JudgeVerdict => ({
      ...opus,
      judge,
      gaps: gaps.map((g, i) => ({
        ...g,
        rank: i + 1,
        state: 'run',
        axis: 'physics_feel',
        evidence: 'strip.png',
      })),
    });
    const gaps = mergeGaps([verdict('a', [push]), verdict('b', [dash, spacing])]);
    expect(gaps.map((g) => g.judges.map((j) => j.judge).join('+'))).toEqual(['a+b', 'b']);
    expect(gaps[0]!.gap).toBe(push.gap);
  });

  it('renders a scoreboard and appends history rows', () => {
    const md = scoreboardMarkdown(board, {
      ...board,
      round: 1,
      overall: 2,
      axisMeans: { ...board.axisMeans, silhouette: 3 },
    });
    expect(md).toContain('# Judge scoreboard, round 2');
    expect(md).toContain('| idle | - | 2 · 6 (4) ⚠ |');
    expect(md).toContain('| Silhouette & proportions | 2 | 4.5 | **3.25** | 3 | +0.25 |');
    expect(md).toContain('- gpt-6.2-sol: run lost its dust');
    expect(md).toContain('- hud: pending, needs the in-match HUD');
    const history = join(mkdtempSync(join(tmpdir(), 'history-')), 'renders', 'COOL-9', 'history.md');
    appendHistory(history, board);
    appendHistory(history, { ...board, round: 3 });
    const lines = readFileSync(history, 'utf8').trimEnd().split('\n');
    expect(lines.slice(0, 4).join('\n')).toBe(HISTORY_HEADER);
    expect(lines).toHaveLength(6);
    expect(lines[4]).toMatch(/^\| 2 \| 2026-11-24 \| abcdef1 \| claude-opus-5-5, gpt-6.2-sol \| 3.5 \|/);
    expect(lines[5]).toMatch(/^\| 3 \|/);
  });
});

describe('judge-aggregate CLI', () => {
  it('checks one answer without writing, then aggregates a pack and appends history', () => {
    const dir = mkdtempSync(join(tmpdir(), 'pack-'));
    mkdirSync(join(dir, 'judges'));
    writeFileSync(join(dir, 'pack.json'), JSON.stringify(pack));
    writeFileSync(join(dir, 'schema.json'), JSON.stringify(judgeSchema(2, pack.states)));
    writeFileSync(join(dir, 'judges', 'claude-opus-5-5.json'), JSON.stringify(opus));
    writeFileSync(join(dir, 'judges', 'gpt-6.2-sol.json'), JSON.stringify(sol));
    const cli = (...args: string[]) =>
      execFileSync('node', ['scripts/judge-aggregate.ts', dir, ...args], { encoding: 'utf8' });
    expect(cli('--check', 'judges/gpt-6.2-sol.json')).toContain('1 answer(s) match schema.json');
    const history = join(dir, 'history.md');
    expect(cli('--history', history)).toContain('# Judge scoreboard, round 2');
    expect(readFileSync(join(dir, 'scoreboard.md'), 'utf8')).toContain('| run | 3 · 4 (3.5) |');
    expect(JSON.parse(readFileSync(join(dir, 'scoreboard.json'), 'utf8'))).toMatchObject({
      round: 2,
      overall: 3.28,
    });
    expect(readFileSync(history, 'utf8')).toContain('| 2 | 2026-');
  });
});
