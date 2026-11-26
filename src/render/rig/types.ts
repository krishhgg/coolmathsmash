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
  /** Rest scale (default 1); pose scales multiply it and children inherit it like a posed scale. */
  sx?: number;
  sy?: number;
  /**
   * Keep this bone's scale to itself: children are pushed out along the stretched bone but not skewed when
   * they rotate. Use it on limb segments (rubber-hose stretching); leave it off where scale should carry down
   * the hierarchy (a body flip or squash).
   */
  localScale?: boolean;
}

/** A draw layer: shows one symbol at a time, transformed by its bone. Slot order is back-to-front. */
export interface Slot {
  name: string;
  bone: string;
  /** Symbol shown when no clip swaps it; null hides the slot (effects). */
  symbol: string | null;
  /** Decoration such as a glow: drawn and counted in bounds, but left out of hit tests. */
  decor?: boolean;
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
  /**
   * Move clips: the frames (inclusive, in clip frames) on which the strike is keyed, one window per hit window of
   * the move. The renderer stretches the clip so these land on the move's real hit windows and the clip ends at
   * its FAF (`src/render/rig/timing.ts`), so frame data can change without re-keying the art.
   */
  active?: [number, number][];
  /**
   * Tether move clips: the clip frame the reel holds on. While the fighter reels in (tetherPull), the move's clip
   * plays on from the frame the line anchored up to this frame and holds it until he arrives. Put it after the
   * latest frame the line can anchor. Without it the clip plays on to its end.
   */
  reel?: number;
}

/** Palette key -> '#rrggbb'. */
export type Palette = Record<string, string>;

/** A projectile or prop drawn with the fighter's palette, facing right (the renderer mirrors it). */
export interface PropArt {
  symbols: Record<string, ArtSymbol>;
  symbol: string;
  /** Uniform scale applied to the symbol. */
  scale: number;
  /**
   * Turn the drawing to its direction of travel in a match, for a streak or a comet whose tail trails behind it.
   * Without it the drawing only mirrors with the entity's facing.
   */
  align?: boolean;
  /**
   * A symbol drawn over the fighters standing on this entity and under every other fighter, on top of `symbol`,
   * which then draws behind all of them. Duck Raft's rim (`src/fighters/raftwars/art/raft.ts`) covers the feet of
   * whoever stands in the raft and nobody else. Without it the whole prop draws over fighters, as a projectile should.
   */
  front?: string;
  /**
   * Draw the whole prop behind the fighters (EntityView.back), so they read through it: Red Ball's Ball Rain balls,
   * drawn as big as their radius-16 hitboxes, would otherwise cover whoever they fall on.
   */
  behind?: boolean;
  /**
   * Drawings by rank for props of this kind and owner on one spot: the k-th still there, in spawn order, draws
   * `stack[k]` (the last one for any past the end) instead of `symbol` (propSymbol, src/render/entities.ts), so the
   * stack shows how many there are and counts down as they go. The Raft Wars kids' Full Arsenal marks: a ring and a
   * diamond each for the first three on one foe, a diamond for the rest.
   */
  stack?: string[];
  /**
   * Draw the prop above every other prop (EntityView.over), so bursts and projectiles never hide it: Full Arsenal's
   * marks stay readable while the bursts on their foe burn.
   */
  above?: boolean;
  /**
   * Where the lab's fighter scene draws it over the clips that fire it (in a match the engine spawns and moves it),
   * keyed by clip name.
   */
  preview?: Record<string, PropPreview>;
}

/** A projectile in the lab: from clip frame `frame` on, at (x, y) from the feet (x forward, y up), then moving. */
export interface PropPreview {
  frame: number;
  x: number;
  y: number;
  /** Units it moves each frame after `frame`. */
  vx?: number;
  vy?: number;
  /** The last clip frame it is drawn on. Default: on to the clip's end. */
  to?: number;
}

/**
 * A tether's line, drawn by the renderer from game state (src/render/tetherLine.ts) rather than keyed in a clip: from
 * the hand (tetherOrigin) to the line's end (FighterState.tether.anchor), the tip while the line flies and the anchor
 * once it holds, for as long as the tether lasts. Drawn in the fighter's costume, mirrored with its facing.
 */
export interface TetherLineArt {
  symbols: Record<string, ArtSymbol>;
  /** The line: a drawing one unit long along +x (from x 0 to 1), stretched to the line's length. */
  line: string;
  /** Drawn at the line's end, turned along the line. */
  tip?: string;
  /** The moves whose line this draws. Their clips leave the line out. */
  moves: string[];
  /** Where lab sheets draw the line over a move's clip, by clip name; in a match it comes from game state. */
  preview?: Record<string, TetherLinePreview>;
}

/** A tether line in the lab: rig units from the feet, x forward and y up. */
export interface TetherLinePreview {
  /** The first and last clip frames it shows on. */
  frame: number;
  to: number;
  /** The hand, where the line starts. */
  from: [number, number];
  /** Where it ends at full length. */
  end: [number, number];
  /** Frames it takes to reach `end`, growing evenly from the hand. Default 1: there at once. */
  travel?: number;
}

export interface FighterArt {
  /** Standing height in units, flames included. */
  height: number;
  rig: Rig;
  /** Canonical clip names (see docs/art.md). Unknown names fall back to `idle`. */
  clips: Record<string, AnimClip>;
  /** Costumes. `default` is required; the rest are alternates for other ports. */
  palettes: { default: Palette } & Record<string, Palette>;
  /**
   * Per-costume slot defaults: palette name -> slot -> symbol (or null to hide it). They replace the slot's own
   * default for that costume only and sit below clip and key swaps, so one costume can wear a hat the others
   * don't.
   */
  costumeSwaps?: Record<string, Record<string, string | null>>;
  /** Standalone SVG markup (with viewBox) of the head, for HUD stocks and portraits. */
  icon: string;
  projectiles?: Record<string, PropArt>;
  /**
   * The reticle of an aimed tether move (TetherDef.aimed), drawn by the renderer at the fighter's aim
   * (FighterState.aim) while the move aims and the line flies at it (src/render/reticle.ts), in the fighter's costume.
   * Its `preview` places it in lab sheets of the move's clip.
   */
  reticle?: PropArt;
  /** A tether's line drawn from game state on the moves it lists, whose clips leave the line out (TetherLineArt). */
  tetherLine?: TetherLineArt;
  /** Where the hands hold the ledge in ledge clips (rig space): the ledge's top corner belongs here. */
  ledgeGrip?: [number, number];
}
