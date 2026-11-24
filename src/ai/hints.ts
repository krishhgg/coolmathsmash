/**
 * Optional per-fighter CPU hints. A fighter can ship `src/fighters/<id>/ai.ts` exporting `ai: CpuHints`; the CPU
 * works without one, reading everything it needs from the fighter's stats and moves.
 */
export interface CpuHints {
  /** Moves the CPU never uses (e.g. a special it cannot predict). */
  avoid?: string[];
  /** Preference multipliers by move name, e.g. { fsmash: 1.4, dair: 0.5 }. */
  prefer?: Record<string, number>;
  /** Specials that help recovery, in the order to try them (default: upB, then sideB). */
  recovery?: string[];
}

const modules = import.meta.glob<{ ai: CpuHints }>('../fighters/*/ai.ts', { eager: true });

const HINTS: Record<string, CpuHints> = Object.fromEntries(
  Object.entries(modules).map(([path, mod]) => [path.split('/').at(-2)!, mod.ai]),
);

export function hintsFor(fighterId: string): CpuHints {
  return HINTS[fighterId] ?? {};
}
