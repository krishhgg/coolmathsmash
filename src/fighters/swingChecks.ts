import { fighterArt } from '../render/fighterView';
import {
  allFindings,
  worstByClip,
  type Check,
  type Finding,
  type SwingChecks,
} from '../render/rig/swingChecks';
import { swingChecks as bob } from './bob-the-robber/art/swings';
import { allFighters } from './registry';
import type { FighterDef } from './types';

/**
 * Which of each fighter's clips the swing checks (`src/render/rig/swingChecks.ts`) treat as on the ground and which
 * as in the air, with each fighter's allowances. The shared test and `scripts/swing-survey.ts` both read it.
 */

/**
 * Clips with no floor under them: jumps, falls and tumbling, the air dodge, the up special (a recovery), hanging
 * from a ledge and the climb, roll and attack that start from the hang, the respawn platform, being held, the
 * shield-break launch and Final Smash cut scenes. Aerials (move kind `aerial`) and clips with "Air" in their name
 * are in the air too.
 */
const AIR = new Set([
  'jump',
  'doubleJump',
  'fall',
  'helpless',
  'tumble',
  'hitstun',
  'airDodge',
  'ledgeJump',
  'upB',
  'glide',
  'tetherPull',
  'ledgeCatch',
  'ledgeHang',
  'ledgeClimb',
  'ledgeRoll',
  'ledgeAttack',
  'respawn',
  'grabbed',
  'shieldBreak',
  'finalSmashCinematic',
]);

const inAir = (def: FighterDef, clip: string) =>
  AIR.has(clip) || def.moves?.[clip]?.kind === 'aerial' || /Air/.test(clip);

/** Fighters' own lists and allowances, which win over the defaults above for the clips they name. */
const OWN: Record<string, SwingChecks> = { 'bob-the-robber': bob };

/** The swing checks for one fighter: every clip it has, on the ground or in the air. */
export function swingChecksFor(id: string, def: FighterDef): SwingChecks {
  const art = fighterArt(def);
  const own = OWN[id];
  const named = new Set([...(own?.ground ?? []), ...(own?.air ?? [])]);
  const rest = Object.keys(art?.clips ?? {}).filter((clip) => !named.has(clip));
  return {
    ...own,
    ground: [...(own?.ground ?? []), ...rest.filter((clip) => !inAir(def, clip))],
    air: [...(own?.air ?? []), ...rest.filter((clip) => inAir(def, clip))],
  };
}

/** Fighters with art, by id. */
export function drawnFighters(): [string, FighterDef][] {
  return Object.entries(allFighters()).filter(([, def]) => fighterArt(def));
}

/** One failing clip's worst finding per check, for the survey. */
export interface SurveyRow {
  fighter: string;
  clip: string;
  air: boolean;
  worst: Partial<Record<Check, Finding & { frames: number }>>;
}

/** Every fighter's failing clips, in clip order. */
export function surveySwings(): SurveyRow[] {
  return drawnFighters().flatMap(([id, def]) => {
    const checks = swingChecksFor(id, def);
    const worst = worstByClip(allFindings(fighterArt(def)!, checks));
    return [...checks.ground, ...checks.air]
      .filter((clip) => worst.has(clip))
      .map((clip) => ({
        fighter: id,
        clip,
        air: checks.air.includes(clip),
        worst: Object.fromEntries(worst.get(clip)!),
      }));
  });
}
