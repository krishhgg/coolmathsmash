import { chromium, type Browser } from '@playwright/test';

/**
 * WebGL through SwiftShader, so headless capture needs no GPU. playwright.config.ts adds `--disable-gpu-rasterization`
 * for the menus; captures keep GPU raster so their PNGs stay comparable with earlier runs.
 */
export const CHROMIUM_ARGS = [
  '--use-angle=swiftshader',
  '--enable-unsafe-swiftshader',
  '--ignore-gpu-blocklist',
];
export const VIEWPORT = { width: 1280, height: 720 };

export const launchBrowser = () => chromium.launch({ args: CHROMIUM_ARGS });

/** Lay out an HTML document `width` pixels wide and return it as a full-page PNG. */
export async function htmlToPng(browser: Browser, html: string, width: number): Promise<Buffer> {
  const page = await browser.newPage({ viewport: { width, height: 200 }, deviceScaleFactor: 1 });
  try {
    await page.setContent(html, { waitUntil: 'load' });
    return await page.screenshot({ fullPage: true });
  } finally {
    await page.close();
  }
}

export const dataUrl = (bytes: Buffer, mime = 'image/png') =>
  `data:${mime};base64,${bytes.toString('base64')}`;

export const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
