import { destroyEntity, spawnEntity, standingOn } from '../../sim/entities/entities';
import type { EntityCtx, EntityDef } from '../../sim/entities/types';
import type { Ctx } from '../../sim/fighter';
import { spendMeter } from '../../sim/meters';
import type { MeterDef } from '../../sim/meters';
import type { MoveDef } from '../types';

/**
 * Duck Raft (down special): the kids throw down their yellow inflatable duck raft, which pops open into a soft
 * platform anyone can stand on. In the air it appears under their feet; on the ground, where the floor is already
 * under them, it lands just in front of them with its hull on the floor.
 *
 * Analogue: Steve's Create Block in Ultimate. Create Block is Steve's neutral special in the air (his down special is
 * TNT, and on the ground his neutral special is Mine), and it places a block at his feet (SmashWiki, "Create Block").
 * Ultimate Frame Data's "Place Block" row gives startup 4 and 15 total frames, so the raft appears on frame 4 and the
 * kids can act on frame 16. Create Block lists no landing lag, so the move carries on through a landing.
 *
 * Durability is a wood block's (SmashWiki, "Create Block", data table): 12 HP, losing 0.02 HP a frame (1.2 a second),
 * 8 times as fast while a fighter stands on it. Left alone it lasts 600 frames (Ultimate Frame Data's wood block "on
 * stage: 600 frames"); stood on throughout, 75. Hits take their damage off the same HP, and only other players can
 * hit it, as with any of a fighter's entities.
 *
 * Limits: one raft per player at a time, and a new one replaces the old, as Create Block's oldest block goes away once
 * Steve has the most he can have out (8, SmashWiki, "Steve (SSBU)"). A raft is two blocks wide, so the kids get one.
 * Create Block spends mined materials; the kids have none, so instead they may throw one raft per trip to the stage:
 * the `raft` meter is spent on the raft and refills only while they stand on the stage itself, not on a raft. Without
 * that, a raft under their feet would give back their jumps for ever.
 */
export const DUCK_RAFT = {
  place: 4,
  faf: 16,
  hp: 12,
  drain: 0.02,
  standDrain: 8,
  /** Body circle for hits: the middle of the hull. */
  radius: 5.5,
  /** The standing surface: 14 wide (inside the rim), 1 above the entity's centre. */
  width: 14,
  deck: 1,
  /** The hull's bottom, below the entity's centre. */
  bottom: 2.5,
  /**
   * The entity's centre on the placing frame, from the feet (x forward, y up). On the ground: 13 ahead, just clear of
   * the kids, its hull resting on the floor. In the air: centred under them, its deck at their feet.
   */
  ground: { x: 13, y: 2.5 },
  air: { x: 0, y: -1 },
} as const;

/** One raft per trip to the stage (see DUCK_RAFT). */
export const raftMeters: Record<string, MeterDef> = {
  raft: { max: 1, start: 1, regen: 1, grounded: 'stage' },
};

const KIND = 'raftwars/duckRaft';

/** Throws the raft on frame 4, if the kids have one: the old one goes, and the new one appears where DUCK_RAFT says. */
function throwRaft(x: Ctx): void {
  const { m, f } = x;
  if (f.actionFrame !== DUCK_RAFT.place || !spendMeter(f, 'raft', 1)) return;
  for (const e of m.entities) if (e.owner === f.port && e.kind === KIND) destroyEntity(m, e, 'script');
  const at = f.ground ? DUCK_RAFT.ground : DUCK_RAFT.air;
  spawnEntity(m, {
    kind: KIND,
    owner: f.port,
    pos: { x: f.pos.x + at.x * f.facing, y: f.pos.y + at.y },
    facing: f.facing,
    move: f.move,
  });
}

export const duckRaft: MoveDef = {
  kind: 'other',
  faf: DUCK_RAFT.faf,
  continuesOnLanding: true,
  hits: [],
  script: throwRaft,
};

/**
 * The raft wears out like a block: every frame it counts one frame of wear, or 8 with someone on it, and its HP is
 * what is left after that wear and the damage it has taken. It goes when that reaches 0.
 */
function wearOut({ m, e }: EntityCtx): void {
  const wear = Number(e.data.wear ?? 0) + (standingOn(m, e).length > 0 ? DUCK_RAFT.standDrain : 1);
  e.data.wear = wear;
  e.hp = DUCK_RAFT.hp - e.damage - wear * DUCK_RAFT.drain;
  if (e.hp <= 0) destroyEntity(m, e, 'expired');
}

export const duckRaftEntities: Record<string, EntityDef> = {
  /** The raft: a hittable soft platform that stays where it was thrown (Create Block's blocks float). */
  duckRaft: {
    radius: DUCK_RAFT.radius,
    hp: DUCK_RAFT.hp,
    floor: 'pass',
    wall: 'pass',
    platform: { width: DUCK_RAFT.width, y: DUCK_RAFT.deck },
    script: wearOut,
  },
};
