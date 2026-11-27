import {
  createServer,
  createServerModuleRunnerTransport,
  isRunnableDevEnvironment,
  type NormalizedServerHotChannel,
  type ViteDevServer,
} from 'vite';
import { ESModulesEvaluator, ModuleRunner, createNodeImportMeta } from 'vite/module-runner';
import { resolve } from 'node:path';

/**
 * How long the module runner waits for the dev server to hand it one transformed module (ms). Vite's default is 60 s.
 * On a loaded machine a first load of the game's modules can leave one of those requests waiting longer, and
 * `server.ssrLoadModule` then throws "transport invoke timed out after 60000ms" (seen on the G14 at load 80 and up,
 * where it ended a CPU bench). A wait of 10 minutes still ends a load that has really hung.
 */
export const SSR_INVOKE_TIMEOUT = 10 * 60 * 1000;

/**
 * Load game modules (which use Vite features like import.meta.glob) into Node through Vite's SSR transform, for
 * headless scripts such as the CPU benchmark. The runner is the one `server.ssrLoadModule` makes, with
 * SSR_INVOKE_TIMEOUT in place of Vite's 60 s.
 */
export async function loadSource<T>(
  path: string,
  timeout = SSR_INVOKE_TIMEOUT,
): Promise<{ mod: T; close: () => Promise<void> }> {
  const server: ViteDevServer = await createServer({
    root: resolve(import.meta.dirname, '../..'),
    server: { middlewareMode: true, hmr: false, ws: false, watch: null },
    appType: 'custom',
    logLevel: 'error',
    optimizeDeps: { noDiscovery: true, include: [] },
  });
  const env = server.environments.ssr;
  if (!isRunnableDevEnvironment(env)) throw new Error("Vite's ssr environment can't run modules");
  // The ssr environment's channel is the server one; its type leaves the API open (`any`).
  const transport = createServerModuleRunnerTransport({ channel: env.hot as NormalizedServerHotChannel });
  transport.timeout = timeout;
  const runner = new ModuleRunner(
    { transport, createImportMeta: createNodeImportMeta, sourcemapInterceptor: false, hmr: false },
    new ESModulesEvaluator(),
  );
  const close = async () => {
    await runner.close();
    await server.close();
  };
  try {
    return { mod: (await runner.import(path)) as T, close };
  } catch (e) {
    await close();
    throw e;
  }
}
