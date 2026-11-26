import { destroyEntity, spawnEntity, standingOn } from '../../sim/entities/entities';
import type { EntityCtx, EntityDef } from '../../sim/entities/types';
import type { Ctx } from '../../sim/fighter';
import { spendMeter } from '../../sim/meters';
import type { MeterDef } from '../../sim/meters';
import type { MoveDef } from '../types';
import { DUCK_RAFT } from './duckRaftData';

/** Duck Raft (down special) on Steve's Create Block: the numbers and their sources are in duckRaftData.ts. */
export { DUCK_RAFT };

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
