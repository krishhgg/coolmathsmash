import type { StageGeometry } from '../sim/stage';

const modules = import.meta.glob<{ stage: StageGeometry }>('./*/geometry.ts', { eager: true });

/** Every stage under src/stages/<id>/geometry.ts, discovered automatically. */
export const STAGES: Record<string, StageGeometry> = Object.fromEntries(
  Object.keys(modules)
    .sort()
    .map((path) => {
      const stage = modules[path]!.stage;
      return [stage.id, stage];
    }),
);

export function getStage(id: string): StageGeometry {
  const stage = STAGES[id];
  if (!stage) throw new Error(`unknown stage "${id}" (have: ${Object.keys(STAGES).join(', ')})`);
  return stage;
}
