import type { HitboxDef } from '../fighters/types';
import type { MatchState } from './match';

type Side = 'left' | 'right' | 'top' | 'bottom';

/**
 * What happened during the last simulated frame, for presentation layers (audio, HUD, effects) that should not
 * read the simulation's internals. `MatchState.events` is refilled every frame: the events below in the order
 * they happened, then one `action` event for each fighter whose action changed that frame.
 */
export type SimEvent =
  /** A hit landed. `damage` is what it added to the victim's %; `x`, `y` is the hitbox centre. */
  | {
      type: 'hit';
      attacker: number;
      victim: number;
      move: string | null;
      damage: number;
      kb: number;
      tumble: boolean;
      hitlag: number;
      effect: NonNullable<HitboxDef['effect']>;
      x: number;
      y: number;
    }
  /** A hit landed on a shield. `damage` is after staleness; `shieldHp` is what the shield has left. */
  | {
      type: 'shieldHit';
      attacker: number;
      victim: number;
      move: string | null;
      damage: number;
      shieldHp: number;
      x: number;
      y: number;
    }
  | { type: 'shieldBreak'; port: number }
  /** A fighter crossed a blast zone; `stocks` is what it has left. */
  | { type: 'ko'; port: number; stocks: number; side: Side; x: number; y: number }
  | { type: 'respawn'; port: number }
  | { type: 'jump'; port: number; kind: 'full' | 'short' | 'air' }
  /** Touched down; `lag` is the landing lag (0 when the landing went straight into another action). */
  | { type: 'land'; port: number; lag: number }
  /** A move started. */
  | { type: 'move'; port: number; move: string }
  /** A fighter transformed into another fighter (Fireboy and Watergirl's swap). */
  | { type: 'transform'; port: number; from: string; to: string }
  /**
   * A move's charge reached full, was stored for later (stored charge) or was let go; `level` is how charged it is
   * (0-1). An uncharged move fires without an event.
   */
  | { type: 'charge'; port: number; move: string; phase: 'full' | 'store' | 'fire'; level: number }
  | { type: 'action'; port: number; from: string; to: string }
  /** A grab caught someone; `move` is the grab (grab, dashGrab or pivotGrab). */
  | { type: 'grab'; attacker: number; victim: number; move: string }
  /** A pummel landed on the held fighter; `damage` is what it added to their %. */
  | { type: 'pummel'; attacker: number; victim: number; damage: number }
  /** A throw let go of the held fighter; the `hit` event that launches them follows. */
  | { type: 'throw'; attacker: number; victim: number; move: string }
  /** A grab ended without a throw and both slid apart; `holder` is -1 when the holder was already gone. */
  | { type: 'grabRelease'; holder: number; held: number }
  /** Two fighters grabbed each other on the same frame and both bounced off (Ultimate's grab clank). */
  | { type: 'grabClank'; ports: [number, number] };

export type SimEventType = SimEvent['type'];

export function emit(m: MatchState, event: SimEvent): void {
  m.events.push(event);
}
