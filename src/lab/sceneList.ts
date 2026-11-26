import type { LabScene } from './types';

/** Every lab scene by name: src/lab/scenes/<name>.ts exporting `scene`, loaded on demand. Test files are not scenes. */
export const SCENES: Record<string, () => Promise<{ scene: LabScene }>> = Object.fromEntries(
  Object.entries(import.meta.glob<{ scene: LabScene }>(['./scenes/*.ts', '!./scenes/*.test.ts'])).map(
    ([path, load]) => [path.replace('./scenes/', '').replace(/\.ts$/, ''), load],
  ),
);
