import { randomInt } from '../engine/rng';
import { INFINITE_STOCKS } from '../sim/constants';
import type { MatchConfig } from '../sim/match';
import type { DeviceId } from './devices';
import { fighterCostumes, selectableFighterIds, stageIds } from './roster';

export const RANDOM = 'random';
export const MAX_PLAYERS = 4;
export const CPU_LEVELS = 9;

export type SlotKind = 'human' | 'cpu';

/**
 * One player panel on the character select. Panels are kept in order, humans first (see `humansFirst`); P-numbers
 * and match ports come from their position.
 */
export interface SlotSetup {
  kind: SlotKind;
  /** The controller of a human slot. */
  device: DeviceId | null;
  /** CPU level, 1-9. */
  level: number;
  /** A fighter id, RANDOM, or null while still choosing. */
  fighter: string | null;
  /** Palette key from the fighter's art. */
  costume: string;
}

export interface Rules {
  stocks: number;
  /** Time limit in minutes; 0 = none. */
  minutes: number;
  items: boolean;
}

/** Everything chosen before a match: players, stage and rules. It survives rematches and trips back to the menus. */
export interface MatchSetup {
  slots: SlotSetup[];
  /** A stage id or RANDOM. */
  stage: string;
  rules: Rules;
}

export const STOCK_CHOICES = [1, 2, 3, 4, 5, INFINITE_STOCKS];
export const TIME_CHOICES = [0, 2, 3, 4, 5, 6, 7, 8, 10];

export function humanSlot(device: DeviceId): SlotSetup {
  return { kind: 'human', device, level: 3, fighter: null, costume: 'default' };
}

export function cpuSlot(level = 3): SlotSetup {
  return { kind: 'cpu', device: null, level, fighter: RANDOM, costume: 'default' };
}

export function defaultSetup(): MatchSetup {
  return {
    slots: [humanSlot('kb1'), cpuSlot()],
    stage: stageIds()[0] ?? RANDOM,
    rules: { stocks: 3, minutes: 7, items: false },
  };
}

/**
 * Put the humans in the lowest slots, keeping their order, with the CPUs after them in theirs, so the humans are
 * P1, P2... and their match ports follow. Slots move whole, so a CPU keeps its level, pick and costume. Returns the old
 * index of each slot in its new place.
 */
export function humansFirst(setup: MatchSetup): number[] {
  const order = setup.slots.map((_, i) => i);
  const from = [
    ...order.filter((i) => setup.slots[i]!.kind === 'human'),
    ...order.filter((i) => setup.slots[i]!.kind === 'cpu'),
  ];
  setup.slots = from.map((i) => setup.slots[i]!);
  return from;
}

/**
 * Seat a controller that pressed a button: it becomes the next human port, ahead of every CPU. When all slots are
 * taken, the CPU in the last slot leaves to make room. Returns the old index of each slot in its new place (-1 for the
 * newcomer), or null when the slots are all humans.
 */
export function joinHuman(setup: MatchSetup, device: DeviceId): number[] | null {
  const from = humansFirst(setup);
  if (setup.slots.length >= MAX_PLAYERS) {
    if (setup.slots.at(-1)?.kind !== 'cpu') return null;
    setup.slots.pop();
    from.pop();
  }
  const at = setup.slots.filter((s) => s.kind === 'human').length;
  setup.slots.splice(at, 0, humanSlot(device));
  from.splice(at, 0, -1);
  return from;
}

/** Two or more players and every human has picked (CPUs without a pick play a random fighter). */
export function isReady(setup: MatchSetup): boolean {
  return setup.slots.length >= 2 && setup.slots.every((s) => s.kind === 'cpu' || s.fighter !== null);
}

/** The first costume of `fighter` that no other slot playing the same fighter wears, starting from `wanted`. */
export function freeCostume(setup: MatchSetup, slot: number, fighter: string, wanted = 'default'): string {
  const all = fighterCostumes(fighter);
  const taken = new Set(
    setup.slots.filter((s, i) => i !== slot && s.fighter === fighter).map((s) => s.costume),
  );
  const start = Math.max(0, all.indexOf(wanted));
  for (let k = 0; k < all.length; k++) {
    const c = all[(start + k) % all.length]!;
    if (!taken.has(c)) return c;
  }
  return all[start]!;
}

/** Step a slot's costume forwards or backwards through its fighter's palettes, skipping ones others wear. */
export function cycleCostume(setup: MatchSetup, slot: number, step: 1 | -1): void {
  const s = setup.slots[slot];
  if (!s || !s.fighter || s.fighter === RANDOM) return;
  const all = fighterCostumes(s.fighter);
  const taken = new Set(
    setup.slots.filter((o, i) => i !== slot && o.fighter === s.fighter).map((o) => o.costume),
  );
  let i = Math.max(0, all.indexOf(s.costume));
  for (let k = 0; k < all.length; k++) {
    i = (i + step + all.length) % all.length;
    if (!taken.has(all[i]!)) break;
  }
  s.costume = all[i]!;
}

/** Give a slot a fighter (or RANDOM) and a costume nobody else wears on it. */
export function pickFighter(setup: MatchSetup, slot: number, fighter: string): void {
  const s = setup.slots[slot];
  if (!s) return;
  s.fighter = fighter;
  s.costume =
    fighter === RANDOM
      ? 'default'
      : freeCostume(setup, slot, fighter, s.fighter === fighter ? s.costume : 'default');
}

/** How a match port is driven. */
export type Controller = { kind: 'human'; device: DeviceId | null } | { kind: 'cpu'; level: number };

export interface ResolvedMatch {
  config: MatchConfig;
  controllers: Controller[];
}

/**
 * Turn a setup into a match: random fighters, costumes and stage drawn from `seed` (so the same seed gives the same
 * match), one port per slot in panel order.
 */
export function resolveMatch(setup: MatchSetup, seed: number, tapJump = true): ResolvedMatch {
  const rng = { rng: seed | 0 };
  const fighters = selectableFighterIds();
  const stages = stageIds();
  const draft: MatchSetup = structuredClone(setup);
  draft.slots.forEach((s, i) => {
    const random = !s.fighter || s.fighter === RANDOM;
    const fighter = random ? fighters[randomInt(rng, fighters.length)]! : s.fighter!;
    s.fighter = fighter;
    s.costume = freeCostume(draft, i, fighter, random ? 'default' : s.costume);
  });
  const stage =
    setup.stage === RANDOM || !stages.includes(setup.stage)
      ? stages[randomInt(rng, stages.length)]!
      : setup.stage;
  return {
    config: {
      seed: seed | 0,
      stage,
      stocks: setup.rules.stocks,
      items: setup.rules.items,
      ports: draft.slots.map((s) => ({ fighter: s.fighter!, costume: s.costume, tapJump })),
    },
    controllers: setup.slots.map((s) =>
      s.kind === 'cpu' ? { kind: 'cpu', level: s.level } : { kind: 'human', device: s.device },
    ),
  };
}
