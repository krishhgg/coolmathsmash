/**
 * Duck Raft's numbers, in a module of plain data so the art can read them in any load order (the move file loads sim
 * code, which loads the fighter registry, which loads this fighter's art). The move is in duckRaft.ts.
 *
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
   * The entity's centre on the placing frame, from the feet (x forward, y up). On the ground: 16.5 ahead, the drawn
   * hull and tail just clear of the kids, its hull resting on the floor. In the air: centred under them, its deck at
   * their feet.
   */
  ground: { x: 16.5, y: 2.5 },
  air: { x: 0, y: -1 },
} as const;
