import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import type { PackInfo } from './pack.ts';
import { AXES } from './rubric.ts';
import type { JudgeVerdict } from './schema.ts';

export interface StateScores {
  name: string;
  /** Axis id to judge to score (null: not applicable). */
  scores: Record<string, Record<string, number | null>>;
  mean: Record<string, number | null>;
  overall: number | null;
}

export interface MergedGap {
  state: string;
  axis: string;
  gap: string;
  evidence: string;
  fix: string;
  /** Every judge that listed it, with the rank they gave it. */
  judges: { judge: string; rank: number }[];
  /** Sum of 1/rank over judges: agreement and priority together. */
  weight: number;
}

/** `scoreboard.json`, written next to scoreboard.md and read by the next round. */
export interface Scoreboard {
  round: number;
  commit: string;
  createdAt: string;
  judges: string[];
  states: StateScores[];
  axisMeans: Record<string, number | null>;
  /** Judge to axis to mean. */
  judgeAxisMeans: Record<string, Record<string, number | null>>;
  overall: number | null;
  disagreements: { state: string; axis: string; scores: Record<string, number> }[];
  gaps: MergedGap[];
  regressions: { judge: string; text: string }[];
  notes: { state: string; judge: string; text: string }[];
  notJudged: PackInfo['notJudged'];
}

const round2 = (v: number) => Math.round(v * 100) / 100;

export function mean(xs: readonly (number | null | undefined)[]): number | null {
  const v = xs.filter((x): x is number => typeof x === 'number');
  return v.length ? round2(v.reduce((a, b) => a + b, 0) / v.length) : null;
}

const STOP = new Set(
  'the and for with that this from into are not but its has have when than then too very more less does should could would their there which while also only just like look looks'.split(
    ' ',
  ),
);

export function tokens(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9%.\s-]/g, ' ')
      .split(/\s+/)
      .map((w) => w.replace(/^[.-]+|[.-]+$/g, ''))
      .filter((w) => w.length > 2 && !STOP.has(w)),
  );
}

export function similarity(a: string, b: string): number {
  const ta = tokens(a);
  const tb = tokens(b);
  const shared = [...ta].filter((w) => tb.has(w)).length;
  const union = new Set([...ta, ...tb]).size;
  return union === 0 ? 0 : shared / union;
}

/** Gaps on the same axis and state (or "*") whose wording overlaps this much are the same gap. */
export const SAME_GAP = 0.3;

export function mergeGaps(verdicts: readonly JudgeVerdict[]): MergedGap[] {
  const merged: MergedGap[] = [];
  for (const v of verdicts) {
    for (const g of [...v.gaps].sort((a, b) => a.rank - b.rank)) {
      const match = merged.find(
        (m) =>
          m.axis === g.axis &&
          (m.state === g.state || m.state === '*' || g.state === '*') &&
          !m.judges.some((j) => j.judge === v.judge) &&
          similarity(m.gap, g.gap) >= SAME_GAP,
      );
      if (match) {
        match.judges.push({ judge: v.judge, rank: g.rank });
        match.weight = round2(match.weight + 1 / g.rank);
        if (match.state === '*') match.state = g.state;
      } else {
        merged.push({ ...g, judges: [{ judge: v.judge, rank: g.rank }], weight: round2(1 / g.rank) });
      }
    }
  }
  return merged.sort((a, b) => b.weight - a.weight || b.judges.length - a.judges.length);
}

export function aggregate(
  pack: PackInfo,
  verdicts: readonly JudgeVerdict[],
  createdAt = new Date().toISOString(),
): Scoreboard {
  const sorted = [...verdicts].sort((a, b) => a.judge.localeCompare(b.judge));
  const judges = sorted.map((v) => v.judge);
  const states: StateScores[] = pack.states.map((s) => {
    const scores = Object.fromEntries(
      AXES.map((a) => [
        a.id,
        Object.fromEntries(sorted.map((v) => [v.judge, v.states[s.name]?.scores[a.id] ?? null])),
      ]),
    );
    const m = Object.fromEntries(AXES.map((a) => [a.id, mean(Object.values(scores[a.id]!))]));
    return {
      name: s.name,
      scores,
      mean: m,
      overall: mean(AXES.flatMap((a) => Object.values(scores[a.id]!))),
    };
  });
  const all = (judge?: string, axis?: string) =>
    states.flatMap((s) =>
      AXES.filter((a) => !axis || a.id === axis).flatMap((a) =>
        Object.entries(s.scores[a.id]!)
          .filter(([j]) => !judge || j === judge)
          .map(([, v]) => v),
      ),
    );
  const disagreements = states.flatMap((s) =>
    AXES.flatMap((a) => {
      const given = Object.entries(s.scores[a.id]!).filter(
        (e): e is [string, number] => typeof e[1] === 'number',
      );
      const vals = given.map(([, v]) => v);
      return vals.length > 1 && Math.max(...vals) - Math.min(...vals) > 2
        ? [{ state: s.name, axis: a.id, scores: Object.fromEntries(given) }]
        : [];
    }),
  );
  return {
    round: pack.round,
    commit: pack.git.sha,
    createdAt,
    judges,
    states,
    axisMeans: Object.fromEntries(AXES.map((a) => [a.id, mean(all(undefined, a.id))])),
    judgeAxisMeans: Object.fromEntries(
      judges.map((j) => [j, Object.fromEntries(AXES.map((a) => [a.id, mean(all(j, a.id))]))]),
    ),
    overall: mean(all()),
    disagreements,
    gaps: mergeGaps(sorted),
    regressions: sorted.flatMap((v) => v.regressions.map((text) => ({ judge: v.judge, text }))),
    notes: pack.states.flatMap((s) =>
      sorted.flatMap((v) =>
        v.states[s.name] ? [{ state: s.name, judge: v.judge, text: v.states[s.name]!.notes }] : [],
      ),
    ),
    notJudged: pack.notJudged,
  };
}

const cell = (s: string) => s.replace(/\|/g, '\\|').replace(/\s*\n\s*/g, ' ');
const num = (v: number | null | undefined) => (v == null ? '-' : String(v));
const delta = (cur: number | null | undefined, prev: number | null | undefined) =>
  cur == null || prev == null ? '' : `${cur - prev >= 0 ? '+' : ''}${round2(cur - prev)}`;

export function scoreboardMarkdown(sb: Scoreboard, previous?: Scoreboard): string {
  const flagged = new Set(sb.disagreements.map((d) => `${d.state}/${d.axis}`));
  const out = [
    `# Judge scoreboard, round ${sb.round}`,
    '',
    `Commit ${sb.commit.slice(0, 7)} · ${sb.createdAt.slice(0, 10)} · judges: ${sb.judges.join(', ')} · **overall ${num(sb.overall)} / 10**${previous ? ` (round ${previous.round}: ${num(previous.overall)})` : ''}`,
    '',
    '## Axis means',
    '',
    `| axis | ${sb.judges.join(' | ')} | mean |${previous ? ' previous | change |' : ''}`,
    `| --- |${sb.judges.map(() => ' --- |').join('')} --- |${previous ? ' --- | --- |' : ''}`,
    ...AXES.map((a) => {
      const prev = previous
        ? ` ${num(previous.axisMeans[a.id])} | ${delta(sb.axisMeans[a.id], previous.axisMeans[a.id])} |`
        : '';
      return `| ${a.title} | ${sb.judges.map((j) => num(sb.judgeAxisMeans[j]![a.id])).join(' | ')} | **${num(sb.axisMeans[a.id])}** |${prev}`;
    }),
    '',
    '## Scores per state',
    '',
    `Each cell: ${sb.judges.join(' · ')} (mean). \`-\` = not applicable, ⚠ = judges more than 2 points apart.`,
    '',
    `| state | ${AXES.map((a) => a.title).join(' | ')} | state mean |`,
    `| --- |${AXES.map(() => ' --- |').join('')} --- |`,
    ...sb.states.map((s) => {
      const cells = AXES.map((a) => {
        const per = sb.judges.map((j) => num(s.scores[a.id]![j])).join(' · ');
        const warn = flagged.has(`${s.name}/${a.id}`) ? ' ⚠' : '';
        return s.mean[a.id] == null ? '-' : `${per} (${s.mean[a.id]})${warn}`;
      });
      const prev = previous?.states.find((p) => p.name === s.name)?.overall;
      const change = previous ? ` ${delta(s.overall, prev)}` : '';
      return `| ${s.name} | ${cells.join(' | ')} | **${num(s.overall)}**${change} |`;
    }),
    '',
    '## Top gaps (deduplicated across judges)',
    '',
    '| # | state | axis | gap | suggested fix | judges (rank) |',
    '| --- | --- | --- | --- | --- | --- |',
    ...sb.gaps.map(
      (g, i) =>
        `| ${i + 1} | ${g.state} | ${g.axis} | ${cell(g.gap)} | ${cell(g.fix)} | ${g.judges.map((j) => `${j.judge} (#${j.rank})`).join(', ')} |`,
    ),
    '',
  ];
  if (sb.regressions.length)
    out.push('## Regressions', '', ...sb.regressions.map((r) => `- ${r.judge}: ${r.text}`), '');
  if (sb.notJudged.length)
    out.push('## Not judged', '', ...sb.notJudged.map((n) => `- ${n.name}: ${n.status}, ${n.reason}`), '');
  out.push('## Judge notes', '');
  for (const s of sb.states) {
    out.push(`**${s.name}**`, '');
    for (const n of sb.notes.filter((x) => x.state === s.name)) out.push(`- ${n.judge}: ${cell(n.text)}`);
    out.push('');
  }
  return out.join('\n');
}

export const HISTORY_HEADER = [
  '# Hill-climb history',
  '',
  `| round | date | commit | judges | ${AXES.map((a) => a.id).join(' | ')} | overall | states | top gap |`,
  `| --- | --- | --- | --- |${AXES.map(() => ' --- |').join('')} --- | --- | --- |`,
].join('\n');

export function historyRow(sb: Scoreboard): string {
  const top = sb.gaps[0] ? cell(`[${sb.gaps[0].state}/${sb.gaps[0].axis}] ${sb.gaps[0].gap}`) : '';
  const axes = AXES.map((a) => num(sb.axisMeans[a.id])).join(' | ');
  return `| ${sb.round} | ${sb.createdAt.slice(0, 10)} | ${sb.commit.slice(0, 7)} | ${sb.judges.join(', ')} | ${axes} | **${num(sb.overall)}** | ${sb.states.length} | ${top} |`;
}

/** Append this round to a markdown history table, creating the file with its header if needed. */
export function appendHistory(path: string, sb: Scoreboard): void {
  const existing = existsSync(path) ? readFileSync(path, 'utf8').trimEnd() : '';
  writeFileSync(path, `${existing || HISTORY_HEADER}\n${historyRow(sb)}\n`);
}
