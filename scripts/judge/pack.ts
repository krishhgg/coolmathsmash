import type { FighterSummary } from '../../src/harness/scenarios.ts';
import { fighterLine, type CaptureRecord, type Manifest } from '../lib/manifest.ts';
import type { Scoreboard } from './aggregate.ts';
import { AXES } from './rubric.ts';

/** `pack.json`: one judge round's inputs. Paths are relative to the pack directory. */
export interface PackInfo {
  version: 1;
  round: number;
  createdAt: string;
  git: Manifest['git'];
  /** The capture run the pack was built from. */
  captures: string;
  refsRoot: string;
  axes: { id: string; title: string }[];
  states: PackState[];
  notJudged: { name: string; status: string; reason: string }[];
  /** The previous round's pack directory, for regressions and score deltas. */
  previous?: string;
}

export interface PackState {
  name: string;
  description: string;
  page: string;
  rule?: string;
  frame?: number;
  motion: boolean;
  fighters?: FighterSummary[];
  files: { sheet: string; capture: string; strip?: string; motion?: string; mp4?: string };
  /** `file` is the copy in the pack, `source` its path under the reference library. */
  refs: { file: string; source: string; caption?: string }[];
}

const fmt = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(2));

/** Per-frame table of the fighters whose position changes during a motion window. */
export function motionMarkdown(rec: CaptureRecord): string {
  const frames = rec.motion?.frames ?? [];
  const first = frames[0]?.fighters ?? [];
  const moving = first
    .map((f) => f.port)
    .filter((port) =>
      frames.some((fr) => {
        const f = fr.fighters[port]!;
        const f0 = first[port]!;
        return f.pos.x !== f0.pos.x || f.pos.y !== f0.pos.y;
      }),
    );
  const withKb = moving.filter((port) =>
    frames.some((fr) => fr.fighters[port]!.kb.x !== 0 || fr.fighters[port]!.kb.y !== 0),
  );
  const head = ['frame'];
  for (const port of moving) {
    const p = `P${port + 1}`;
    head.push(`${p} action`, `${p} x`, `${p} y`, `${p} vx`, `${p} vy`);
    if (withKb.includes(port)) head.push(`${p} kbx`, `${p} kby`, `${p} %`);
  }
  const rows = frames.map((fr) => {
    const cells = [fr.frame === rec.frame ? `**${fr.frame}**` : String(fr.frame)];
    for (const port of moving) {
      const f = fr.fighters[port]!;
      const move = f.move ? ` ${f.move}` : '';
      cells.push(
        `${f.action} ${f.actionFrame}${move}`,
        fmt(f.pos.x),
        fmt(f.pos.y),
        fmt(f.vel.x),
        fmt(f.vel.y),
      );
      if (withKb.includes(port)) cells.push(fmt(f.kb.x), fmt(f.kb.y), fmt(f.damage));
    }
    return `| ${cells.join(' | ')} |`;
  });
  return [
    `# ${rec.name}: frames ${rec.motion?.from}-${rec.motion?.to} at ${rec.motion?.fps} fps`,
    '',
    `Capture frame ${rec.frame} in bold. Units: game units (the main platform is 160 wide), units per frame, y up.`,
    ...(moving.length === 0 ? ['Nothing moves in this window.'] : []),
    '',
    `| ${head.join(' | ')} |`,
    `| ${head.map(() => '---').join(' | ')} |`,
    ...rows,
    '',
  ].join('\n');
}

/** The exact prompt one judge receives. */
export function buildPrompt(
  pack: PackInfo,
  rubric: string,
  schema: object,
  previous?: Scoreboard,
  notes?: string,
): string {
  const sha = pack.git.sha.slice(0, 7) + (pack.git.dirty ? ' (uncommitted changes)' : '');
  const out: string[] = [
    `# Coolmath Smash judge panel, round ${pack.round}`,
    '',
    'You are one of two independent judges scoring a browser platform fighter against its references. Another judge scores the same pack without seeing your answer; do not read other files in `judges/`.',
    '',
    '## The game and what it should look like',
    '',
    "Coolmath Smash is a Super Smash Bros. Ultimate-style platform fighter starring OG (pre-2015) Coolmath Games characters, built in TypeScript and PixiJS for a game design class. The target is Smash Ultimate's controls, physics and presentation (camera, HUD, effects, stage framing) with 2D hand-drawn art that matches each character's original Flash game. Fireboy comes from Fireboy and Watergirl in the Forest Temple (2009).",
    '',
    `This build is commit ${sha}. Parts of it may still be placeholders (capsule fighters, flat stage, no HUD). Score what you see against the anchors: low scores are expected early and are the baseline the next rounds climb from. Be specific and honest; flattering scores make the loop useless.`,
    '',
    '## How to look',
    '',
    'Paths are relative to the pack directory (the one holding this prompt). For each state below:',
    '',
    '- `states/<state>/sheet.png`: our capture on the left, the reference images on the right, labelled. Look at this first.',
    "- `states/<state>/strip.png` (motion states): every few frames of a 60 fps clip around the capture frame, each labelled with the frame number and every fighter's action, action frame and position. Use it to judge timing and arcs.",
    '- `states/<state>/motion.md` (motion states): the same clip frame by frame as numbers (position, velocity, knockback). Use it to check the physics against Smash Ultimate frame data you know.',
    '- `states/<state>/capture.png` and `states/<state>/refs/`: full-resolution originals if you need detail.',
    '',
    '## Rubric',
    '',
    rubric.replace(/^### /gm, '#### '),
    `## States to judge (${pack.states.length})`,
    '',
  ];
  for (const s of pack.states) {
    out.push(`### ${s.name}`, '', s.description, '');
    out.push(
      `- Page: ${s.page}${s.frame !== undefined ? `, capture frame ${s.frame}` : ''}${s.rule && s.rule !== `frame ${s.frame}` ? ` (${s.rule})` : ''}`,
    );
    if (s.fighters?.length) out.push(`- At the capture frame: ${s.fighters.map(fighterLine).join('; ')}`);
    const files = Object.values(s.files).filter((f) => !f.endsWith('.mp4'));
    out.push(`- Files: ${files.map((f) => `\`${f}\``).join(', ')}`);
    out.push(
      s.motion ? '- Motion shown: score `physics_feel`.' : '- Still frame only: `physics_feel` must be null.',
    );
    if (s.refs.length === 0)
      out.push(
        '- References: none matched yet; judge against the rubric anchors and your knowledge of the targets.',
      );
    else {
      out.push('- References:');
      for (const r of s.refs) out.push(`  - \`${r.file}\` (${r.source})${r.caption ? `: ${r.caption}` : ''}`);
    }
    out.push('');
  }
  if (pack.notJudged.length) {
    out.push(
      '## Not judged this round',
      '',
      'These states could not be captured yet; do not score them, but you may list a gap for a missing feature.',
      '',
    );
    for (const n of pack.notJudged) out.push(`- ${n.name}: ${n.status}, ${n.reason}`);
    out.push('');
  }
  if (previous) {
    out.push(`## Previous round (${previous.round}, commit ${previous.commit.slice(0, 7)})`, '');
    out.push('Mean scores per state (both judges). Call out anything that got worse in `regressions`.', '');
    out.push(
      `| state | ${AXES.map((a) => a.id).join(' | ')} |`,
      `| --- | ${AXES.map(() => '---').join(' | ')} |`,
    );
    for (const st of previous.states) {
      out.push(
        `| ${st.name} | ${AXES.map((a) => (st.mean[a.id] == null ? '-' : fmt(st.mean[a.id]!))).join(' | ')} |`,
      );
    }
    out.push('', 'Top gaps last round:', '');
    previous.gaps.slice(0, 5).forEach((g, i) => out.push(`${i + 1}. [${g.state} / ${g.axis}] ${g.gap}`));
    out.push('');
  }
  if (notes) out.push('## Notes from the orchestrator', '', notes.trim(), '');
  out.push(
    '## How to answer',
    '',
    'Write exactly one JSON object to `judges/<your model id>.json` (for example `judges/gpt-6.2-sol.json` or `judges/claude-opus-5-5.json`) and also give it as your final answer. It must validate against `schema.json`, repeated here:',
    '',
    '```json',
    JSON.stringify(schema, null, 2),
    '```',
    '',
    '- `judge`: your model id. `round`: ' + String(pack.round) + '.',
    '- `states`: one entry per state above. Scores are integers 1-10 from the anchors; null only where the rubric says the axis does not apply. `notes`: two to four sentences on what drove the scores.',
    '- `gaps`: 5 to 12 concrete, actionable gaps across all states, ranked (`rank` 1 = fix first). Rank controls and physics gaps above looks, and bigger visible wins above polish. Each names one state (or `*` for all), the axis it would raise, what is wrong, the evidence (which file and what you saw, or which frames and numbers), and a fix specific enough to implement (values, frames, shapes, colours).',
    '- `regressions`: things that got worse since the previous round; [] in round 1.',
    '',
    'Where the Coolmath Smash repository is checked out, `npm run judge:aggregate -- <pack dir> --check judges/<your model id>.json` validates your file against the schema without writing anything.',
    '',
  );
  return out.join('\n');
}
