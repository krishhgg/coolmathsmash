/**
 * Runs the swing checks (src/render/rig/swingChecks.ts) over every fighter's every clip and prints, per fighter,
 * each failing clip with its worst frame per check: the deepest under the floor, the biggest turn in a frame, the
 * first prop jumping across a part, the first prop over the face.
 *
 *   node scripts/swing-survey.ts            a markdown table
 *   node scripts/swing-survey.ts --json     the rows as JSON
 *
 * The game modules are bundled in one pass (lib/bundle.ts) rather than loaded one by one through Vite's dev server,
 * which on a loaded machine took minutes.
 */
import { parseArgs } from 'node:util';
import type * as SurveyModule from '../src/fighters/swingChecks.ts';
import type { SurveyRow } from '../src/fighters/swingChecks.ts';
import { bundleSource } from './lib/bundle.ts';

const { values } = parseArgs({ options: { json: { type: 'boolean', default: false } } });

const { mod, close } = await bundleSource<typeof SurveyModule>('/src/fighters/swingChecks.ts');
const rows = mod.surveySwings();
await close();

const cell = (row: SurveyRow, check: 'floor' | 'turn' | 'order' | 'face') => {
  const w = row.worst[check];
  if (!w) return '';
  const where = `${w.frames} frame${w.frames === 1 ? '' : 's'}, worst @${w.frame}`;
  if (check === 'floor') return `${w.value.toFixed(2)} under (${w.part}), ${where}`;
  if (check === 'turn') return `${w.value.toFixed(0)} deg (${w.part}), ${where}`;
  return `${w.part}, ${where}`;
};

if (values.json) {
  console.log(JSON.stringify(rows, null, 2));
} else {
  console.log('| Fighter | Clip | Air | Floor | Turn | Draw order | Face |');
  console.log('| --- | --- | --- | --- | --- | --- | --- |');
  for (const row of rows)
    console.log(
      `| ${row.fighter} | ${row.clip} | ${row.air ? 'yes' : ''} | ${cell(row, 'floor')} | ${cell(row, 'turn')} | ${cell(row, 'order')} | ${cell(row, 'face')} |`,
    );
  const byFighter = new Map<string, number>();
  for (const row of rows) byFighter.set(row.fighter, (byFighter.get(row.fighter) ?? 0) + 1);
  console.log(`\n${rows.length} failing clips: ${[...byFighter].map(([id, n]) => `${id} ${n}`).join(', ')}`);
}
