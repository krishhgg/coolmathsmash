import { defineConfig, devices } from '@playwright/test';

/** `PW_PORT` lets several checkouts run the suite at once, each against its own preview server. */
const PORT = Number(process.env.PW_PORT ?? 4173);

export default defineConfig({
  testDir: 'e2e',
  outputDir: 'test-results',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    viewport: { width: 1280, height: 720 },
    deviceScaleFactor: 1,
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 720 },
        deviceScaleFactor: 1,
        launchOptions: {
          // WebGL and compositing go through SwiftShader. Page content is rasterized on the CPU: with
          // `--ignore-gpu-blocklist` alone Chrome also rasterizes the menus through SwiftShader, headless Chrome queues
          // that work faster than SwiftShader runs it, and the first WebGL draw of a match waits for the whole queue
          // (10 to 50 s on a loaded 2-core machine). Browsers that fall back to SwiftShader never GPU-rasterize pages.
          args: [
            '--use-angle=swiftshader',
            '--enable-unsafe-swiftshader',
            '--ignore-gpu-blocklist',
            '--disable-gpu-rasterization',
          ],
        },
      },
    },
  ],
  webServer: {
    command: `npm run preview -- --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
