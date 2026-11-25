import fontUrl from './fonts/LilitaOne-Regular.ttf?url';

/** Lilita One (SIL OFL 1.1, see fonts/LilitaOne-OFL.txt): a chunky rounded face in the spirit of Flash-era UI. */
export const HUD_FONT = 'Lilita One';
const FALLBACK = ['Arial Black', 'Arial', 'sans-serif'];

let loading: Promise<void> | undefined;
let loaded = false;

/** Loads the HUD font once. Await it before the first HUD render so captures never show the fallback face. */
export function loadHudFont(): Promise<void> {
  loading ??= (async () => {
    if (typeof document === 'undefined' || typeof FontFace === 'undefined') return;
    const face = new FontFace(HUD_FONT, `url(${fontUrl})`);
    await face.load();
    document.fonts.add(face);
    loaded = true;
  })();
  return loading;
}

/** The family list to use right now; it changes once the font arrives so Pixi re-renders cached text. */
export function hudFontFamily(): string[] {
  return loaded ? [HUD_FONT, ...FALLBACK] : FALLBACK;
}
