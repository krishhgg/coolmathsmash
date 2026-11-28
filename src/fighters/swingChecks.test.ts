import { describe, expect, it } from 'vitest';
import { fighterArt } from '../render/fighterView';
import { allFindings } from '../render/rig/swingChecks';
import { drawnFighters, swingChecksFor } from './swingChecks';

/**
 * Each fighter's clips that fail a swing check today (`src/render/rig/swingChecks.ts`) are listed in its own
 * `src/fighters/<id>/swings.known.ts`: something drawn sinks into the floor on the ground, a part turns too far in a
 * frame, a held prop jumps across a part, or a prop covers the face. `node scripts/swing-survey.ts` prints each one's
 * worst frames. The lists are exact: fixing a clip means taking it out of its list, and a listed clip that passes fails
 * this test until it is taken out. Keeping each list beside its fighter lets fighters' fixes merge without touching
 * each other's lines.
 */
const KNOWN = import.meta.glob<{ knownFailures: readonly string[] }>('./*/swings.known.ts', { eager: true });
const knownFor = (id: string) => KNOWN[`./${id}/swings.known.ts`]?.knownFailures ?? [];

describe.each(drawnFighters())('%s', (id, def) => {
  it('fails the swing checks on exactly its known clips', () => {
    const failing = new Set(allFindings(fighterArt(def)!, swingChecksFor(id, def)).map((f) => f.clip));
    const known = new Set(knownFor(id));
    expect({
      'failing but not listed': [...failing].filter((clip) => !known.has(clip)).sort(),
      'listed but passing': [...known].filter((clip) => !failing.has(clip)).sort(),
    }).toEqual({ 'failing but not listed': [], 'listed but passing': [] });
  }, 600_000);
});
