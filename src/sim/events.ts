import type { HitboxDef, TetherLatch } from '../fighters/types';
import type { DestroyReason } from './entities/types';
import type { MatchState } from './match';
import type { StatusEndReason } from './statuses';
import type { TerrainElement } from './stage';

type Side = 'left' | 'right' | 'top' | 'bottom';

/**
 * What happened during the last simulated frame, for presentation layers (audio, HUD, effects) that should not
 * read the simulation's internals. `MatchState.events` is refilled every frame: the events below in the order
 * they happened, then one `action` event for each fighter whose action changed that frame.
 */
export type SimEvent =
  /**
   * A hit landed. `damage` is what it added to the victim's %; `x`, `y` is the hitbox centre. An entity's hit
   * carries its `entity` id and credits its owner as `attacker` (-1 for nobody).
   */
  | {
      type: 'hit';
      attacker: number;
      entity?: number;
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
      entity?: number;
      victim: number;
      move: string | null;
      damage: number;
      shieldHp: number;
      x: number;
      y: number;
    }
  /**
   * A hit landed in the first 5 frames of `victim`'s shield drop and was parried (Ultimate's perfect shield): no
   * damage, no shield damage, no shieldstun, and no `shieldHit`. `x`, `y` is the hitbox centre.
   */
  | {
      type: 'parry';
      attacker: number;
      entity?: number;
      victim: number;
      move: string | null;
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
  /** A command grab caught someone; `move` is the grab. Its throw starts at once, without a `move` event. */
  | { type: 'commandGrab'; attacker: number; victim: number; move: string }
  /** A pummel or a throw's hold hit landed on the held fighter; `damage` is what it added to their %. */
  | { type: 'pummel'; attacker: number; victim: number; damage: number }
  /** A throw let go of the held fighter; the `hit` event that launches them follows. */
  | { type: 'throw'; attacker: number; victim: number; move: string }
  /** A grab ended without a throw and both slid apart; `holder` is -1 when the holder was already gone. */
  | { type: 'grabRelease'; holder: number; held: number }
  /** Two fighters grabbed each other on the same frame and both bounced off (Ultimate's grab clank). */
  | { type: 'grabClank'; ports: [number, number] }
  /** A float started or ended (also when it ends during an aerial started from it, or by landing). */
  | { type: 'float'; port: number; phase: 'start' | 'end' }
  /** A fuel hover burned its last fuel while thrusting. */
  | { type: 'fuelEmpty'; port: number }
  /** A status went on a fighter (not when one already on it is applied again); `source` is the port credited, -1 none. */
  | { type: 'statusStart'; port: number; status: string; frames: number; source: number }
  /** A status came off: it ran out (`expired`, mashing included), the fighter was KO'd, or a script cleared it. */
  | { type: 'statusEnd'; port: number; status: string; reason: StatusEndReason }
  /**
   * A status's tick damaged its fighter, with no hitlag or knockback. `damage` is what it added to their %;
   * `source` is the port credited, -1 none.
   */
  | { type: 'statusDamage'; port: number; status: string; damage: number; source: number }
  /** A scheduled stage piece appeared (`on`) or vanished (docs/stage-geometry.md). */
  | { type: 'stagePiece'; piece: 'solid' | 'platform'; index: number; on: boolean }
  /** A moving solid squeezed a fighter against other geometry and the fighter popped out on top of it. */
  | { type: 'squeeze'; port: number; solid: number; x: number; y: number }
  /**
   * A fighter's move or action asks for a screen shake (a heavy landing, Bloxorz block's every tip): `amplitude`
   * in screen pixels at 1280x720, fading out over `frames` frames. Emitted by fighter scripts; the camera reacts.
   */
  | { type: 'shake'; port: number; amplitude: number; frames: number }
  /** An entity (projectile, minion, object, item) appeared. */
  | { type: 'entitySpawn'; id: number; kind: string; owner: number; x: number; y: number }
  /** An entity left the match, and why (`hit`: used up by its hit; `clank`: cancelled by an attack or projectile). */
  | { type: 'entityDestroy'; id: number; kind: string; reason: DestroyReason; x: number; y: number }
  /** A fighter's reflector sent a projectile back; `port` now owns it. */
  | { type: 'reflect'; id: number; kind: string; port: number; x: number; y: number }
  /** A fighter's absorber ate a projectile and healed `heal` %. */
  | { type: 'absorb'; id: number; kind: string; port: number; heal: number; x: number; y: number }
  /** A hittable entity took a hit (`attacker` is the port credited, -1 for nobody); `hp` is what it has left. */
  | {
      type: 'entityHit';
      id: number;
      kind: string;
      attacker: number;
      damage: number;
      hp: number;
      x: number;
      y: number;
    }
  /** An idle fighter picked up an item (EntityDef.pickup); its `entityDestroy` (reason `pickup`) follows. */
  | { type: 'itemPickup'; port: number; id: number; kind: string }
  /**
   * A fighter broke the Coolmath Planet and now holds a Final Smash charge (`FighterState.finalReady`); neutral
   * special spends it on the fighter's Final Smash.
   */
  | { type: 'finalReady'; port: number; x: number; y: number }
  /**
   * A fighter spent its charge on its Final Smash `move` (src/sim/finalSmash.ts), after the `move` event. Everyone
   * else holds still for the next `freeze` frames; `x`, `y` is the middle of the user's body.
   */
  | { type: 'finalSmash'; port: number; move: string; freeze: number; x: number; y: number }
  /** A tether line left the hand towards (`x`, `y`), its full-range end. */
  | { type: 'tetherFire'; port: number; x: number; y: number }
  /** A fighter-targeting line touched a hurtbox at (`x`, `y`), before the move chooses how to respond. */
  | { type: 'tetherFighterHit'; port: number; target: number; x: number; y: number }
  /** A tether line anchored at (`x`, `y`) on a ledge, a surface or empty air (`sky`); the reel starts. */
  | { type: 'tetherLatch'; port: number; kind: TetherLatch; x: number; y: number }
  /** A tether line let go: it whiffed, the fighter let go or grabbed the ledge, or something knocked him off it. */
  | { type: 'tetherRelease'; port: number }
  /** A stage hazard hit a fighter: a damage zone (with its element) or a stage hitbox, by index. */
  | {
      type: 'stageHit';
      victim: number;
      source: 'zone' | 'hitbox';
      index: number;
      element: TerrainElement | null;
      damage: number;
      kb: number;
      x: number;
      y: number;
    };

export type SimEventType = SimEvent['type'];

export function emit(m: MatchState, event: SimEvent): void {
  m.events.push(event);
}
