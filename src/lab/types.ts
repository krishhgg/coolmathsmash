import type { Application } from 'pixi.js';

/**
 * A lab scene renders one piece of the game in isolation (a fighter's poses, a stage, the HUD) for
 * development and for the capture harness. Add a file to src/lab/scenes/ exporting `scene`; no registry edit.
 */
export interface LabScene {
  /** Shown in the scene list. */
  title: string;
  mount(app: Application, params: URLSearchParams): void | Promise<void>;
  /** Optional JSON-callable controls, exposed as window.__lab.call(name, ...args). */
  api?: Record<string, (...args: never[]) => unknown>;
}
