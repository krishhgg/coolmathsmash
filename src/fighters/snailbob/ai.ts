import type { CpuHints } from '../../ai/hints';

/**
 * Crate Drop (neutral special) went from 12% to Steve's anvil's 10% in #257. Up close his down air then outscores it
 * (13.0 to 11.5 against a standing Red Ball), and a level 9 CPU stopped dropping it at all. 1.2 is the damage ratio
 * the change took away; 1.14 is the least that brings the crate back at 60 units (src/ai/shots.test.ts).
 */
export const ai: CpuHints = { prefer: { neutralB: 1.2 } };
