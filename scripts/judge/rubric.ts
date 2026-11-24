/**
 * The judge rubric: five axes scored 1-10 with anchors, so scores stay comparable between rounds and judges.
 * judge-pack renders it into rubric.md and prompt.md; judge-aggregate uses the ids and titles.
 */
export interface Axis {
  id: string;
  title: string;
  question: string;
  /** When a score is required: on every state, only on motion states (null on stills), or wherever it applies. */
  scored: 'always' | 'motion' | 'when-applicable';
  /** When the judge must answer null instead of a score. */
  notApplicable: string;
  anchors: Record<1 | 4 | 7 | 10, string>;
}

export const AXES: Axis[] = [
  {
    id: 'physics_feel',
    title: 'Controls & physics feel',
    question: 'Does it move, jump, land, attack and launch like Super Smash Bros. Ultimate?',
    scored: 'motion',
    notApplicable:
      'Scored only for states with motion (a filmstrip, clip and per-frame table); null for still frames.',
    anchors: {
      1: 'Fighters slide or float; motion has no weight; timing bears no relation to Smash.',
      4: 'Running, jumping and landing exist, but timing is visibly off: floaty arcs, missing jump squat or landing lag, instant turnarounds, launches that do not decay.',
      7: 'Dash, run, jump arcs, fast fall, landing lag, hitlag and knockback growth read as Ultimate; a Smash player would notice only small timing differences.',
      10: 'Indistinguishable from Ultimate for the shared mechanics; trajectories match the reference frame data.',
    },
  },
  {
    id: 'silhouette',
    title: 'Silhouette & proportions',
    question: 'Do the fighters read as their characters from outline and proportions alone, in this pose?',
    scored: 'when-applicable',
    notApplicable: 'null when no fighter is visible (a stage-only or HUD-only frame).',
    anchors: {
      1: 'Generic shapes (capsules, boxes); no character reads from the outline.',
      4: 'Roughly the right proportions (head to body, size against the stage), but the outline is stiff or the pose does not read.',
      7: 'Each fighter is recognisable from its filled silhouette; proportions match the source art; the pose reads at gameplay zoom.',
      10: "As strong and distinct as Ultimate's roster: every pose (idle, run, jump, attack, tumble, ledge) reads instantly in solid black.",
    },
  },
  {
    id: 'art_fidelity',
    title: 'Flash-era art fidelity',
    question:
      'Does the art look like the original pre-2015 Coolmath Flash game (Fireboy and Watergirl for Fireboy; the source game for each stage)?',
    scored: 'when-applicable',
    notApplicable: 'null when the frame shows no fighter or stage art (for example a HUD crop).',
    anchors: {
      1: 'Unrelated to the source art: placeholder shapes or a different style.',
      4: 'Right colours and general design, but the line work, fills and details do not look like the Flash game.',
      7: "Hand-drawn in the source game's style: line weight, flat and gradient fills, glow, and key details (Fireboy's flame head) match the references.",
      10: 'A Coolmath player would take it for official art from the original game, animated.',
    },
  },
  {
    id: 'readability',
    title: 'Readability',
    question:
      'At gameplay size, can you tell instantly who is where, which player is which, and what each one is doing?',
    scored: 'always',
    notApplicable: 'Always scored.',
    anchors: {
      1: 'Hard to tell what is happening: who is where, which state, what was hit.',
      4: 'Fighters and stage are distinguishable, but actions, ports or hits are ambiguous.',
      7: 'At a glance you can tell each fighter, its port, its action (running, shielding, hanging, launched) and its damage; effects support the read.',
      10: 'As readable as Ultimate at gameplay zoom, even in busy frames.',
    },
  },
  {
    id: 'smash_presentation',
    title: 'Smash Ultimate presentation',
    question:
      'Camera, HUD, effects and stage framing: would a Smash player recognise the presentation? Judge the presentation, not the rendering technology: 2D Flash-style art in a Smash presentation can score 10.',
    scored: 'always',
    notApplicable: 'Always scored.',
    anchors: {
      1: 'Nothing reads as Smash.',
      4: 'Smash-like layout (side view, platforms, fighters), but missing the dynamic camera, HUD, hit sparks, launch smoke, shield bubble styling or ledge feedback.',
      7: 'Dynamic camera framing the fighters, Smash-style HUD, hit sparks, launch smoke trail, shield bubble and ledge feedback all present and recognisable.',
      10: 'A Smash player would recognise every effect, camera move and UI element next to the reference frame.',
    },
  },
];

export function rubricMarkdown(axes: readonly Axis[] = AXES): string {
  const parts = axes.map((a) =>
    [
      `### ${a.title} (\`${a.id}\`)`,
      '',
      a.question,
      '',
      ...([1, 4, 7, 10] as const).map((n) => `- **${n}**: ${a.anchors[n]}`),
      '',
      `Not applicable: ${a.notApplicable}`,
    ].join('\n'),
  );
  return `Score every axis from 1 to 10 against these anchors (use the numbers between them freely).\n\n${parts.join('\n\n')}\n`;
}
