/** One player's slot in the bottom HUD. */
export interface HudPlayer {
  /** 0-based port: 0 = P1 (red), 1 = P2 (blue), 2 = P3 (yellow), 3 = P4 (green). */
  port: number;
  name: string;
  /** Damage in percent; shown floored to one decimal. */
  damage: number;
  stocks: number;
  maxStocks: number;
  /** Standalone SVG markup with a viewBox, from the fighter's art. A neutral head is used when absent. */
  icon?: string;
  eliminated: boolean;
  /** Match frame of the last damage taken, -1 if none. Drives the shake and flash. */
  hitFrame: number;
}
