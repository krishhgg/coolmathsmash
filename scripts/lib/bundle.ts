import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'vite';

const root = resolve(import.meta.dirname, '../..');

/**
 * Bundles a game module and everything it imports into one file with Vite's SSR build, then imports it into Node.
 * It runs the same transforms as `loadSource` (ssr.ts), import.meta.glob included, in one pass instead of one dev
 * server request per module, which on a loaded machine is the difference between a second and minutes for a module
 * that pulls in every fighter. The bundle goes under node_modules/.cache, so its external imports (pixi.js) resolve
 * as they do from the source. `close` deletes it.
 */
export async function bundleSource<T>(path: string): Promise<{ mod: T; close: () => Promise<void> }> {
  const cache = join(root, 'node_modules', '.cache');
  await mkdir(cache, { recursive: true });
  const outDir = await mkdtemp(join(cache, 'bundle-'));
  const close = () => rm(outDir, { recursive: true, force: true });
  try {
    await build({
      root,
      configFile: false,
      logLevel: 'error',
      build: {
        ssr: join(root, path),
        outDir,
        emptyOutDir: false,
        minify: false,
        sourcemap: false,
        target: 'es2022',
        rolldownOptions: { output: { entryFileNames: 'entry.mjs' } },
      },
    });
    const mod = (await import(pathToFileURL(join(outDir, 'entry.mjs')).href)) as T;
    return { mod, close };
  } catch (error) {
    await close();
    throw error;
  }
}
