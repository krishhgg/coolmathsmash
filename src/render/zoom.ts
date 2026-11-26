import { VIEW_HEIGHT, VIEW_WIDTH } from '../config';
import type { MatchState } from '../sim/match';
import { SHAKE, type CameraView, type Focus } from './camera';
import { predictKo, type KoPrediction } from './koPredict';
import { rand, seedOf, signed } from './vfx/random';
import { blade, easeOut, lerp, TAU, type Shape } from './vfx/shapes';

/**
 * Ultimate's Special Zoom and Finish Zoom, from SmashWiki's Special Zoom article (oldid 2063643; Finish Zoom is a
 * section of it):
 *
 * - Special Zoom: "the background flashes blue with dramatic 'spark' effects pointing towards the impact, time will
 *   substantially slow down, and the camera zooms in on the impact". Ultimate lists the moves that trigger it; this
 *   roster has no such list, so a hit of at least SPECIAL_ZOOM_KB knockback (the camera's severe shake) stands in.
 *   It "occurs even if the attack's knockback is negated by armor", so it reads the hit's knockback, not the launch.
 * - Finish Zoom: "used when the game calculates an attack will likely result in a game-winning KO", "uses a red
 *   background instead of a blue one", and "only factors in knockback and launch angle, and does not account for
 *   obstructions or DI" (koPredict.ts). It replaces the Special Zoom on the same hit. Here it marks any KO, not only
 *   the last stock's, so every kill gets it.
 * - 1v1 only: "In games with more than two players, the slowdown and camera zoom effects will be nearly
 *   non-existent." Two players, the same test as the 1v1 damage multiplier (hits.ts addDamage).
 * - It never triggers on an invincible fighter, during a Final Smash or in a timed match's last five seconds. Hits
 *   miss invincible fighters already, and this game has neither of the others yet.
 *
 * SmashWiki gives no length for either zoom, and Ultimate's slowdown would stretch sim frames, which the renderer
 * cannot do. So the zoom plays over the victim's hitlag (SmashWiki's Hitlag article: floor(damage * 0.65 + 6) frames,
 * up to 30), the frames the sim already holds both fighters still: the drawn frame is frozen on the hit for exactly as
 * long as the sim is, and the picture cuts back to the normal camera on the launch frame with nothing skipped. A zoom
 * is a pure function of the hit's event, the state on its frame and the frame drawn, so captures and replays draw it
 * the same every time.
 */
export const SPECIAL_ZOOM_KB = SHAKE.severe.kb;

export const ZOOM = {
  /** Frames from the hit to full zoom (the hit frame counts as the first). */
  in: 4,
  /** World units across the screen at full zoom: twice as close as the camera's closest. */
  width: 120,
};

/** Flash colours: the tint over the stage, and the light and dark streaks that point at the impact. */
export const ZOOM_FLASH = {
  special: { base: 0x1650d8, light: 0x8fd8ff, dark: 0x081f66 },
  finish: { base: 0xc8101e, light: 0xff7a4d, dark: 0x5c0010 },
};
const FLASH_ALPHA = 0.78;

export type ZoomKind = keyof typeof ZOOM_FLASH;

/** One zoom, spawned by a hit and kept in step with its victim's freeze (stepZoom). */
export interface SpecialZoom {
  kind: ZoomKind;
  /** The hit's frame. */
  frame: number;
  /**
   * The victim's last frozen frame as of the last frame stepped: that frame plus the victim's hitlag. It launches on
   * the frame after, unless something lengthens or replaces its freeze first.
   */
  until: number;
  victim: number;
  /** The contact point (world units, y up). */
  x: number;
  y: number;
  kb: number;
  /** The predicted KO for a Finish Zoom. */
  ko: KoPrediction | null;
  seed: number;
}

const RANK: Record<ZoomKind, number> = { special: 1, finish: 2 };

/**
 * The zoom `m`'s last frame starts, if any: of that frame's hits (on `victim` only, when given) on a fighter that
 * froze, a predicted KO first, then the strongest knockback. Only in 1v1.
 */
export function zoomFrom(m: MatchState, victim?: number): SpecialZoom | null {
  if (m.players.length !== 2) return null;
  let best: SpecialZoom | null = null;
  for (const e of m.events) {
    if (e.type !== 'hit' || (victim !== undefined && e.victim !== victim)) continue;
    const v = m.fighters[e.victim];
    if (!v || v.hitlag <= 0) continue;
    const ko = predictKo(m, e.victim);
    const kind = ko ? 'finish' : e.kb >= SPECIAL_ZOOM_KB ? 'special' : null;
    if (!kind) continue;
    const z: SpecialZoom = {
      kind,
      frame: m.frame,
      until: m.frame + v.hitlag,
      victim: e.victim,
      x: e.x,
      y: e.y,
      kb: e.kb,
      ko,
      seed: seedOf(m.frame, e.victim, 13),
    };
    if (!best || RANK[z.kind] > RANK[best.kind] || (z.kind === best.kind && z.kb > best.kb)) best = z;
  }
  return best;
}

/** Is `frame` one of the zoom's frames: the hit's frame through the victim's last frozen one? */
export const zoomed = (z: SpecialZoom, frame: number): boolean => frame >= z.frame && frame <= z.until;

/** How far the view has pushed in on the contact point at `frame`, 0 to 1. */
export function zoomWeight(z: SpecialZoom, frame: number): number {
  return zoomed(z, frame) ? easeOut((frame - z.frame + 1) / ZOOM.in) : 0;
}

/** Where the camera leans at `frame` (see Camera.viewFor), or null outside the zoom. */
export function zoomFocus(z: SpecialZoom, frame: number): Focus | null {
  const weight = zoomWeight(z, frame);
  return weight > 0 ? { x: z.x, y: z.y, zoom: VIEW_WIDTH / ZOOM.width, weight } : null;
}

export interface ZoomState {
  /** The last frame stepped (-1 before the first). */
  frame: number;
  zoom: SpecialZoom | null;
}

/**
 * Advance `s` to the frame `m` just simulated. A zoom whose victim launched is over. One still frozen follows the
 * victim's live freeze, so it ends on the frame the victim actually launches: entity contacts can lengthen the
 * freeze, and a hit landing during it (a returning projectile) replaces both the freeze and the pending launch
 * (hits.ts strike). That hit decides the zoom again from the new launch: it keeps its start and contact point, so the
 * camera does not jump, and ends when the new launch neither KOs nor is strong. Then a new zoom from this frame's
 * hits takes over if it outranks the running one (a Finish Zoom over a Special Zoom).
 */
export function stepZoom(s: ZoomState, m: MatchState): void {
  s.frame = m.frame;
  let z = s.zoom && m.frame <= s.zoom.until ? s.zoom : null;
  if (z) {
    const { frame, x, y, seed, victim } = z;
    if (m.events.some((e) => e.type === 'hit' && e.victim === victim)) {
      const again = zoomFrom(m, victim);
      z = again && { ...again, frame, x, y, seed };
    } else {
      const until = m.frame + (m.fighters[victim]?.hitlag ?? 0);
      if (until !== z.until) z = { ...z, until };
    }
  }
  const next = zoomFrom(m);
  s.zoom = next && (!z || RANK[next.kind] > RANK[z.kind]) ? next : z;
}

/**
 * The zoom of one match, stepped once after every simulated frame (Renderer.stepCamera), like the effects: a new
 * match, or a frame that does not follow the last one, starts with no zoom.
 */
export class Zoom {
  state: ZoomState = { frame: -1, zoom: null };
  private match: unknown = null;

  step(m: MatchState): void {
    if (m.config !== this.match || m.frame !== this.state.frame + 1) {
      this.state = { frame: -1, zoom: null };
      this.match = m.config;
    }
    stepZoom(this.state, m);
  }

  /** The zoom to draw `m` with, once stepped to m's frame. */
  at(m: MatchState): SpecialZoom | null {
    return this.match === m.config && this.state.frame === m.frame ? this.state.zoom : null;
  }
}

/** Off-screen start of the streaks: past every screen corner from any point on screen. */
const STREAK_REACH = Math.hypot(VIEW_WIDTH, VIEW_HEIGHT) + 80;

/**
 * The flash in screen pixels: the stage tinted blue (Special) or red (Finish), and streaks from beyond the screen
 * edges tapering to points around the impact, re-dealt every 2 frames. The renderer draws it behind the fighters, so
 * they and the hit spark stand out on it. `lite` draws half the streaks.
 */
export function zoomFlashShapes(z: SpecialZoom, frame: number, view: CameraView, lite = false): Shape[] {
  if (!zoomed(z, frame)) return [];
  const c = ZOOM_FLASH[z.kind];
  const cx = VIEW_WIDTH / 2 + (z.x - view.x) * view.zoom;
  const cy = VIEW_HEIGHT / 2 - (z.y - view.y) * view.zoom;
  const out: Shape[] = [
    {
      type: 'poly',
      points: [0, 0, VIEW_WIDTH, 0, VIEW_WIDTH, VIEW_HEIGHT, 0, VIEW_HEIGHT],
      fill: { color: c.base, alpha: FLASH_ALPHA },
    },
  ];
  const count = lite ? 14 : 28;
  const deal = Math.floor((frame - z.frame) / 2);
  const turn = rand(z.seed, deal) * TAU;
  for (let i = 0; i < count; i++) {
    const a = turn + ((i + 0.4 * signed(z.seed, 100 + deal * count + i)) / count) * TAU;
    const gap = lerp(70, 170, rand(z.seed, 200 + deal * count + i));
    const width = lerp(40, 130, rand(z.seed, 300 + deal * count + i));
    out.push({
      type: 'poly',
      points: blade(
        cx + Math.cos(a) * STREAK_REACH,
        cy + Math.sin(a) * STREAK_REACH,
        a + Math.PI,
        STREAK_REACH - gap,
        width,
      ),
      fill: { color: i % 3 === 0 ? c.dark : c.light, alpha: i % 3 === 0 ? 0.5 : 0.7 },
    });
  }
  return out;
}
