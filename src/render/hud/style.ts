/**
 * Pure HUD maths (no Pixi) so it can be unit tested: Smash Ultimate's damage colour ramp, number formatting,
 * the hit shake/flash curve and the card slots along the bottom.
 */

/** Port colours: P1 red, P2 blue, P3 yellow, P4 green. */
export const PORT_COLORS = [0xf2333a, 0x2f84ff, 0xffc21a, 0x2fbf45] as const;

export function portColor(port: number): number {
  return PORT_COLORS[((port % 4) + 4) % 4]!;
}

/** CPU players are grey wherever a human would show their port colour. */
export const CPU_COLOR = 0x8e949c;

export function slotColor(port: number, cpu = false): number {
  return cpu ? CPU_COLOR : portColor(port);
}

/** Damage (percent) to colour stops, after Ultimate: white, yellow, orange, red, then a deepening dark red. */
export const DAMAGE_RAMP: readonly (readonly [number, number])[] = [
  [0, 0xffffff],
  [30, 0xfff38e],
  [60, 0xffd04a],
  [90, 0xff9a2e],
  [120, 0xff5a24],
  [150, 0xec2a1c],
  [200, 0xb5110f],
  [300, 0x700a0a],
];

function lerpColor(a: number, b: number, t: number): number {
  let out = 0;
  for (const shift of [16, 8, 0]) {
    const ca = (a >> shift) & 255;
    const cb = (b >> shift) & 255;
    out |= Math.round(ca + (cb - ca) * t) << shift;
  }
  return out;
}

export function damageColor(damage: number): number {
  const first = DAMAGE_RAMP[0]!;
  if (damage <= first[0]) return first[1];
  for (let i = 1; i < DAMAGE_RAMP.length; i++) {
    const [d1, c1] = DAMAGE_RAMP[i]!;
    const [d0, c0] = DAMAGE_RAMP[i - 1]!;
    if (damage <= d1) return lerpColor(c0, c1, (damage - d0) / (d1 - d0));
  }
  return DAMAGE_RAMP[DAMAGE_RAMP.length - 1]![1];
}

/** Brightens a colour towards white by `t` (0..1), for the hit flash. */
export function brighten(color: number, t: number): number {
  return lerpColor(color, 0xffffff, Math.min(1, Math.max(0, t)));
}

/** "34" and ".2%" for 34.27: floored to a tenth like Ultimate, capped at 999.9. */
export function formatDamage(damage: number): { whole: string; tenth: string } {
  const tenths = Math.min(9999, Math.max(0, Math.floor(damage * 10 + 1e-6)));
  return { whole: String(Math.floor(tenths / 10)), tenth: `.${tenths % 10}%` };
}

export const HIT_FRAMES = 30;

export interface HitEffect {
  dx: number;
  dy: number;
  /** Scale of the number (pops up, settles back to 1). */
  scale: number;
  /** 0..1 brightening of the number. */
  flash: number;
  /** Progress 0..1 of the burst behind the number, or -1 when hidden. */
  burst: number;
}

const REST: HitEffect = { dx: 0, dy: 0, scale: 1, flash: 0, burst: -1 };

/** Shake, pop and flash after a hit: a pure function of the frames since `hitFrame`. */
export function hitEffect(frame: number, hitFrame: number, port: number): HitEffect {
  const t = frame - hitFrame;
  if (hitFrame < 0 || t < 0 || t >= HIT_FRAMES) return REST;
  const amp = 8 * (1 - t / HIT_FRAMES) ** 2;
  return {
    dx: amp * Math.sin(t * 2.3 + port * 1.7),
    dy: amp * 0.7 * Math.cos(t * 3.1 + port * 0.9),
    scale: 1 + 0.3 * Math.max(0, 1 - t / 9),
    flash: Math.max(0, 1 - t / 12),
    burst: t < 14 ? t / 14 : -1,
  };
}

export const SCREEN_W = 1280;
export const SCREEN_H = 720;
/** Card layout box before scaling; cards are drawn at CARD_SCALE so they take ~16% of the screen height. */
export const CARD_W = 262;
export const CARD_H = 152;
export const CARD_SCALE = 0.86;
export const CARD_TOP = Math.round(SCREEN_H - 6 - CARD_H * CARD_SCALE);

/** Horizontal centres of the cards for `count` players, spread like Ultimate's bottom row. */
export function cardSlots(count: number): number[] {
  // Card centres; a card spans CARD_W * CARD_SCALE around its centre.
  const spacing = count <= 1 ? 0 : count === 2 ? 470 : count === 3 ? 390 : 300;
  return Array.from({ length: count }, (_, i) => SCREEN_W / 2 + (i - (count - 1) / 2) * spacing);
}
