/** Wait for the menu faces (declared in theme.css) so the first screen never shows a fallback font. */
export async function loadUiFonts(): Promise<void> {
  if (typeof document === 'undefined' || !document.fonts) return;
  await Promise.all([
    document.fonts.load("48px 'Lilita One'"),
    document.fonts.load('800 20px Nunito'),
    document.fonts.load('900 20px Nunito'),
  ]);
}
