/**
 * Merge the judges' JSON answers for a pack into scoreboard.md and scoreboard.json (per state, axis and judge,
 * means, deduplicated top gaps) and append the round to a history table. See docs/hill-climb.md.
 *
 *   npm run judge:aggregate -- <pack dir> [--history captures/history.md]
 *   npm run judge:aggregate -- <pack dir> --check judges/<judge>.json   (validate one answer, write nothing)
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { aggregate, appendHistory, scoreboardMarkdown, type Scoreboard } from './judge/aggregate.ts';
import type { PackInfo } from './judge/pack.ts';
import { validate, type JudgeVerdict, type Schema } from './judge/schema.ts';

const { values: args, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    history: { type: 'string', default: 'captures/history.md' },
    check: { type: 'string', multiple: true },
  },
});

const readJson = <T>(path: string) => JSON.parse(readFileSync(path, 'utf8')) as T;

const packDir = resolve(positionals[0] ?? 'captures/pack');
const pack = readJson<PackInfo>(join(packDir, 'pack.json'));
const schema = readJson<Schema>(join(packDir, 'schema.json'));
const files =
  args.check?.map((f) => resolve(packDir, f)) ??
  readdirSync(join(packDir, 'judges'))
    .filter((f) => f.endsWith('.json'))
    .sort()
    .map((f) => join(packDir, 'judges', f));
if (files.length === 0) throw new Error(`no judge answers in ${join(packDir, 'judges')}`);

const problems: string[] = [];
const verdicts = files.flatMap((f) => {
  let value: unknown;
  try {
    value = readJson<unknown>(f);
  } catch (e) {
    problems.push(`${basename(f)}: not JSON (${String(e)})`);
    return [];
  }
  const errors = validate(schema, value);
  problems.push(...errors.map((e) => `${basename(f)}: ${e}`));
  return errors.length ? [] : [value as JudgeVerdict];
});
if (problems.length) {
  console.error(`judge answers do not match schema.json:\n${problems.join('\n')}`);
  process.exit(1);
}
if (args.check) {
  console.log(`${files.length} answer(s) match schema.json`);
  process.exit(0);
}

let previous: Scoreboard | undefined;
try {
  previous = pack.previous ? readJson<Scoreboard>(join(pack.previous, 'scoreboard.json')) : undefined;
} catch {
  previous = undefined;
}
const board = aggregate(pack, verdicts);
const markdown = scoreboardMarkdown(board, previous);
writeFileSync(join(packDir, 'scoreboard.json'), `${JSON.stringify(board, null, 2)}\n`);
writeFileSync(join(packDir, 'scoreboard.md'), markdown);
appendHistory(resolve(args.history), board);
console.log(markdown);
