/**
 * Where the background islands sit, in reference-camera screen pixels (see parallax.ts). Kept as data so
 * parallax.test.ts can check that none of them crowds the playfield at the cameras the game actually uses.
 */
export interface IslandSpec {
  x: number;
  /** Screen y of the island's top surface. */
  top: number;
  w: number;
  /** Height of the rock body below the top. */
  depth: number;
  seed: number;
  /** 0..1 fade toward the sky colour. */
  haze: number;
  deco: 'pi' | 'doors' | 'ruin';
  fall?: boolean;
}

/** Height above an island's top taken by what stands on it (arch, doors, ruins). */
export const DECO_HEIGHT = 64;

/**
 * Far floating islands, high in the sky at the outer edges: the pi arch (left) and the Fireboy & Watergirl exit doors
 * (right), kept clear of the planet and of the platform heights at the cameras the game uses.
 */
export const FAR_ISLANDS = {
  depth: 0.18,
  islands: [
    { x: 110, top: 154, w: 120, depth: 78, seed: 1, haze: 0.56, deco: 'pi', fall: true },
    { x: 1150, top: 150, w: 128, depth: 80, seed: 2, haze: 0.48, deco: 'doors' },
  ] satisfies IslandSpec[],
};

/** Broken temple rocks drifting low at the sides, jagged on top so they never read as somewhere to land. */
export const MID_ROCKS = {
  depth: 0.2,
  islands: [
    { x: 30, top: 650, w: 170, depth: 100, seed: 7, haze: 0.58, deco: 'ruin' },
    { x: 1250, top: 628, w: 150, depth: 92, seed: 8, haze: 0.58, deco: 'ruin' },
  ] satisfies IslandSpec[],
};
