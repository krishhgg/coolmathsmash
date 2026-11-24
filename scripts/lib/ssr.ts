import { createServer, type ViteDevServer } from 'vite';
import { resolve } from 'node:path';

/**
 * Load game modules (which use Vite features like import.meta.glob) into Node through Vite's SSR loader, for
 * headless scripts such as the CPU benchmark.
 */
export async function loadSource<T>(path: string): Promise<{ mod: T; close: () => Promise<void> }> {
  const server: ViteDevServer = await createServer({
    root: resolve(import.meta.dirname, '../..'),
    server: { middlewareMode: true, hmr: false, ws: false, watch: null },
    appType: 'custom',
    logLevel: 'error',
    optimizeDeps: { noDiscovery: true, include: [] },
  });
  const mod = (await server.ssrLoadModule(path)) as T;
  return { mod, close: () => server.close() };
}
