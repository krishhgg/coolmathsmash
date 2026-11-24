/**
 * CPU benchmark: headless CPU-vs-CPU matches at fixed seeds. Reports win rates by level, self-destruct rates and
 * match length as Markdown (stdout, or --md) and JSON (--out). Ports alternate by seed so neither side is favoured.
 *
 *   npm run bench:ai -- [--levels 1,3,5,7,9] [--seeds 10] [--stocks 3] [--fighters fireboy,fireboy]
 *                       [--stage battlefield] [--workers 4] [--md bench.md] [--out bench.json] [--check]
 *
 * --check exits 1 unless level 9 wins at least 90% against level 3 and levels 7+ self-destruct on at most 2% of
 * their lost stocks.
 */
import { writeFileSync } from 'node:fs';
import { availableParallelism } from 'node:os';
import { parseArgs } from 'node:util';
import { Worker, isMainThread, parentPort } from 'node:worker_threads';
import type * as BenchModule from '../src/ai/bench.ts';
import type { CpuMatchOptions, CpuMatchResult } from '../src/ai/bench.ts';
import { loadSource } from './lib/ssr.ts';

type Bench = typeof BenchModule;
interface Job {
  id: number;
  opts: CpuMatchOptions;
}

if (!isMainThread) {
  const { mod, close } = await loadSource<Bench>('/src/ai/bench.ts');
  parentPort!.on('message', (job: Job | null) => {
    if (!job) {
      void close().then(() => process.exit(0));
      return;
    }
    parentPort!.postMessage({ id: job.id, result: mod.runCpuMatch(job.opts) });
  });
  parentPort!.postMessage({ ready: true });
} else {
  await main();
}

async function main(): Promise<void> {
  const { values: args } = parseArgs({
    options: {
      levels: { type: 'string', default: '1,3,5,7,9' },
      seeds: { type: 'string', default: '10' },
      stocks: { type: 'string', default: '3' },
      fighters: { type: 'string', default: 'fireboy,fireboy' },
      stage: { type: 'string', default: 'battlefield' },
      workers: { type: 'string', default: String(Math.max(1, availableParallelism() - 1)) },
      md: { type: 'string' },
      out: { type: 'string' },
      check: { type: 'boolean', default: false },
    },
  });
  const levels = args.levels.split(',').map(Number);
  const seeds = Number(args.seeds);
  const fighters = args.fighters.split(',');
  const stocks = Number(args.stocks);
  const pairs: [number, number][] = [];
  for (let i = 0; i < levels.length; i++)
    for (let j = i; j < levels.length; j++) pairs.push([levels[i]!, levels[j]!]);
  const jobs: (Job & { pair: [number, number]; swapped: boolean })[] = [];
  for (const pair of pairs) {
    for (let seed = 1; seed <= seeds; seed++) {
      const swapped = seed % 2 === 0;
      const lv = swapped ? [pair[1], pair[0]] : [pair[0], pair[1]];
      jobs.push({
        id: jobs.length,
        pair,
        swapped,
        opts: { seed, levels: lv, fighters, stage: args.stage, stocks },
      });
    }
  }
  const started = performance.now();
  const results = await runAll(jobs, Number(args.workers));
  const seconds = (performance.now() - started) / 1000;
  const report = summarize(jobs, results, { levels, seeds, stocks, fighters, stage: args.stage, seconds });
  if (args.md) writeFileSync(args.md, report.markdown);
  if (args.out) writeFileSync(args.out, JSON.stringify(report.json, null, 2));
  console.log(report.markdown);
  if (args.check && !report.pass) process.exit(1);
}

async function runAll(jobs: Job[], workers: number): Promise<CpuMatchResult[]> {
  const results = new Array<CpuMatchResult>(jobs.length);
  let next = 0;
  let done = 0;
  await Promise.all(
    Array.from({ length: Math.min(workers, jobs.length) }, async () => {
      const w = new Worker(new URL(import.meta.url));
      await new Promise<void>((resolveAll, reject) => {
        w.on('error', reject);
        w.on('message', (m: { ready?: boolean; id?: number; result?: CpuMatchResult }) => {
          if (m.result && m.id !== undefined) {
            results[m.id] = m.result;
            done++;
            if (done % 10 === 0) process.stderr.write(`\r${done}/${jobs.length} matches`);
          }
          const job = jobs[next++];
          if (job) w.postMessage(job);
          else {
            w.postMessage(null);
            resolveAll();
          }
        });
      });
    }),
  );
  process.stderr.write('\n');
  return results;
}

interface Meta {
  levels: number[];
  seeds: number;
  stocks: number;
  fighters: string[];
  stage: string;
  seconds: number;
}

function summarize(
  jobs: (Job & { pair: [number, number]; swapped: boolean })[],
  results: CpuMatchResult[],
  meta: Meta,
): { markdown: string; json: unknown; pass: boolean } {
  const key = (a: number, b: number) => `${a}-${b}`;
  const wins = new Map<string, number>();
  const games = new Map<string, number>();
  const frames = new Map<string, number[]>();
  const lost = new Map<number, number>();
  const sds = new Map<number, number>();
  let timeouts = 0;
  jobs.forEach((job, i) => {
    const r = results[i]!;
    const lv = job.opts.levels;
    if (r.timeout) timeouts++;
    for (let p = 0; p < 2; p++) {
      const me = lv[p]!;
      const them = lv[1 - p]!;
      games.set(key(me, them), (games.get(key(me, them)) ?? 0) + (me === them ? 0.5 : 1));
      if (r.winner === p) wins.set(key(me, them), (wins.get(key(me, them)) ?? 0) + (me === them ? 0.5 : 1));
    }
    const fk = key(job.pair[0], job.pair[1]);
    frames.set(fk, [...(frames.get(fk) ?? []), r.frames]);
    for (const ko of r.kos) {
      const level = lv[ko.port]!;
      lost.set(level, (lost.get(level) ?? 0) + 1);
      if (ko.selfDestruct) sds.set(level, (sds.get(level) ?? 0) + 1);
    }
  });
  const rate = (a: number, b: number) => (wins.get(key(a, b)) ?? 0) / (games.get(key(a, b)) || 1);
  const pct = (v: number) => `${Math.round(v * 100)}%`;
  const lines: string[] = [];
  lines.push(`## CPU benchmark`);
  lines.push('');
  lines.push(
    `${meta.fighters.join(' vs ')} on ${meta.stage}, ${meta.stocks} stocks, ${meta.seeds} seeds per pairing ` +
      `(ports alternate), ${results.length} matches in ${meta.seconds.toFixed(0)} s.`,
  );
  lines.push('');
  lines.push('**Win rate** (row level against column level):');
  lines.push('');
  lines.push(`| | ${meta.levels.map((l) => `L${l}`).join(' | ')} |`);
  lines.push(`|---|${meta.levels.map(() => '---').join('|')}|`);
  for (const a of meta.levels) {
    lines.push(`| **L${a}** | ${meta.levels.map((b) => (a === b ? '–' : pct(rate(a, b)))).join(' | ')} |`);
  }
  lines.push('');
  lines.push('**Self-destructs** (KOs where the fighter had landed since it was last hit):');
  lines.push('');
  lines.push('| Level | Stocks lost | Self-destructs | SD rate |');
  lines.push('|---|---|---|---|');
  for (const l of meta.levels) {
    const n = lost.get(l) ?? 0;
    const s = sds.get(l) ?? 0;
    lines.push(`| L${l} | ${n} | ${s} | ${pct(n ? s / n : 0)} |`);
  }
  lines.push('');
  lines.push('**Match length** (mean, seconds):');
  lines.push('');
  lines.push(`| | ${meta.levels.map((l) => `L${l}`).join(' | ')} |`);
  lines.push(`|---|${meta.levels.map(() => '---').join('|')}|`);
  const mean = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / (xs.length || 1);
  for (const a of meta.levels) {
    const cells = meta.levels.map((b) => {
      const f = frames.get(key(Math.min(a, b), Math.max(a, b)));
      return f ? (mean(f) / 60).toFixed(0) : '';
    });
    lines.push(`| **L${a}** | ${cells.join(' | ')} |`);
  }
  const all = results.map((r) => r.frames);
  lines.push('');
  lines.push(
    `Overall mean match length ${(mean(all) / 60).toFixed(0)} s; ${timeouts} of ${results.length} hit the time limit.`,
  );
  const checks: [string, boolean][] = [];
  if (meta.levels.includes(9) && meta.levels.includes(3)) {
    checks.push([`L9 beats L3 in at least 90% (${pct(rate(9, 3))})`, rate(9, 3) >= 0.9]);
  }
  for (const l of meta.levels.filter((x) => x >= 7)) {
    const n = lost.get(l) ?? 0;
    const s = sds.get(l) ?? 0;
    checks.push([
      `L${l} self-destructs on at most 2% of lost stocks (${pct(n ? s / n : 0)})`,
      n === 0 || s / n <= 0.02,
    ]);
  }
  if (checks.length) {
    lines.push('');
    lines.push('**Checks**');
    lines.push('');
    for (const [label, ok] of checks) lines.push(`- ${ok ? '✅' : '❌'} ${label}`);
  }
  const json = {
    meta,
    winRate: Object.fromEntries(
      meta.levels.map((a) => [a, Object.fromEntries(meta.levels.map((b) => [b, rate(a, b)]))]),
    ),
    stocksLost: Object.fromEntries(lost),
    selfDestructs: Object.fromEntries(sds),
    meanSeconds: mean(all) / 60,
    timeouts,
    matches: jobs.map((j, i) => ({
      levels: j.opts.levels,
      seed: j.opts.seed,
      ...results[i],
      replay: undefined,
    })),
    checks: checks.map(([label, ok]) => ({ label, ok })),
  };
  return { markdown: lines.join('\n') + '\n', json, pass: checks.every(([, ok]) => ok) };
}
