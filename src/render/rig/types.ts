/**
 * Fighter art data: vector parts on a skeletal rig, animated Flash-style (keyframed bone transforms with easing,
 * plus symbol swaps). Everything here is plain data with no Pixi imports, so art modules load in node tests.
 *
 * Space: rig units are game units. Rig-local space is y-down (SVG/Pixi), origin at the fighter's feet centre,
 * facing right (+x). Rotations are degrees, positive = clockwise on screen.
 */

/** A palette key such as `'line'` (resolved through the active palette), or a literal `'#rrggbb'`. */
export type ColorRef = string;

export interface GradientStop {
  /** 0 to 1 along the gradient. */
  offset: number;
  color: ColorRef;
  /** Stop opacity, default 1. */
  alpha?: number;
}

/** Radial gradient centred at (cx, cy) with radius r, in the symbol's own units. */
export interface RadialGradient {
  type: 'radial';
  cx: number;
  cy: number;
  r: number;
  stops: GradientStop[];
}

/** Linear gradient from (x0, y0) to (x1, y1), in the symbol's own units. */
export interface LinearGradient {
  type: 'linear';
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  stops: GradientStop[];
}

export type Paint = ColorRef | RadialGradient | LinearGradient;

/** One SVG path. Subpaths nested inside another subpath are holes (even-odd), as in Flash shapes. */
export interface PathShape {
  d: string;
  fill?: Paint;
  stroke?: { color: ColorRef; width: number };
}

/** A Flash movie clip: other symbols shown in turn on the match clock (`globalFrame`), looping forever. */
export interface SymbolLoop {
  loop: string[];
  /** Playback rate in frames per second of the 60 Hz match clock (Flash games often ran at 24-30). */
  fps: number;
}

/** A Flash graphic symbol (paths drawn in order, in the slot's bone space) or a looping movie clip. */
export type ArtSymbol = PathShape[] | SymbolLoop;

/** A bone's rest transform relative to its parent. Parents must be listed before their children. */
export interface Bone {
  name: string;
  parent?: string;
  x: number;
  y: number;
  rot?: number;
}

/** A draw layer: shows one symbol at a time, transformed by its bone. Slot order is back-to-front. */
export interface Slot {
  name: string;
  bone: string;
  /** Symbol shown when no clip swaps it; null hides the slot (effects). */
  symbol: string | null;
}

export interface Rig {
  bones: Bone[];
  slots: Slot[];
  symbols: Record<string, ArtSymbol>;
}

/** Offsets from a bone's rest transform: x, y and rot add; sx and sy multiply (default 1). */
export interface BonePose {
  x?: number;
  y?: number;
  rot?: number;
  sx?: number;
  sy?: number;
}

/** Easing from a key to the next one. `step` holds the key's pose until the next key. */
export type Ease = 'linear' | 'step' | 'in' | 'out' | 'inOut' | 'outBack';

/**
 * A keyframe, like a Flash keyframe on two layers. The pose layer: bones a posed key does not mention sit at
 * rest (every pose is a full pose) and the pose tweens to the next posed key; a key without `pose` leaves the
 * tween alone. The symbol layer: `swaps` and `z` hold from this key until a later key sets them again;
 * slots they do not mention use the clip's swaps, then the slot default.
 */
export interface Key {
  frame: number;
  pose?: Record<string, BonePose>;
  /** Easing of the tween from this posed key to the next. Default `inOut`. */
  ease?: Ease;
  /** Slot -> symbol name, or null to hide the slot. `{}` returns every slot to the clip's swaps. */
  swaps?: Record<string, string | null>;
  /** Slot -> draw order. Slot i draws at z = i, so 2.5 sits between slots 2 and 3. */
  z?: Record<string, number>;
}

/**
 * A timeline. `frame` is what the engine passes to `pose()`: frames since the action began. Move clips use
 * Smash numbering (frame 1 is the first frame of the move) and `length` = FAF - 1.
 */
export interface AnimClip {
  length: number;
  /** true: cycles every `length` frames (the last key tweens back to the first). false: holds the last key. */
  loop?: boolean;
  keys: Key[];
  /** Swaps that apply to the whole clip (keys can override them). */
  swaps?: Record<string, string | null>;
}

/** Palette key -> '#rrggbb'. */
export type Palette = Record<string, string>;

/** A projectile or prop drawn with the fighter's palette, facing right (the renderer mirrors it). */
export interface PropArt {
  symbols: Record<string, ArtSymbol>;
  symbol: string;
  /** Uniform scale applied to the symbol. */
  scale: number;
}

export interface FighterArt {
  /** Standing height in units, flames included. */
  height: number;
  rig: Rig;
  /** Canonical clip names (see docs/art-pipeline.md). Unknown names fall back to `idle`. */
  clips: Record<string, AnimClip>;
  /** Costumes. `default` is required; the rest are alternates for other ports. */
  palettes: { default: Palette } & Record<string, Palette>;
  /** Standalone SVG markup (with viewBox) of the head, for HUD stocks and portraits. */
  icon: string;
  projectiles?: Record<string, PropArt>;
  /** Where the hands hold the ledge in ledge clips (rig space): the ledge's top corner belongs here. */
  ledgeGrip?: [number, number];
}
