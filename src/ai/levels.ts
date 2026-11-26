/**
 * CPU difficulty, Smash style: level 1 wanders and rarely fights back, level 9 reacts fast, spaces, punishes,
 * DIs, edgeguards and mixes up its getups. Every behaviour reads its odds and timings from this table, so tuning
 * a level touches one row.
 */
export interface CpuLevel {
  level: number;
  /** Frames between something happening to an opponent and the CPU seeing it. */
  reaction: number;
  /** Frames between fresh decisions in neutral. */
  thinkEvery: number;
  /** Chance per decision to go in for an attack rather than wait at a distance. */
  aggression: number;
  /** Chance to pick the best attack that connects; otherwise a random one that connects. */
  precision: number;
  /** Spacing misjudgement in units: the opponent's position is read this far off, either way. */
  spacingError: number;
  /** Chance to shield, dodge or jump away from an attack it sees coming. */
  defense: number;
  /** Chance to punish a blocked or whiffed move. */
  punish: number;
  /** Chance to choose the best DI when launched; otherwise a random stick or none. */
  di: number;
  /** Chance that a recovery is planned badly (a random plan, which may fall short). */
  recoveryError: number;
  /** Chance to go for an edgeguard when the opponent is off stage. */
  edgeguard: number;
  /** Chance to chase a launched opponent for a follow-up. */
  followUp: number;
  /** Chance to tech when knocked into the ground. */
  tech: number;
  /** Chance to mix up a ledge or floor getup instead of a plain climb or stand. */
  ledgeMix: number;
  /** Frames it hangs on the ledge or lies on the floor before getting up: [min, max]. */
  ledgeWait: [number, number];
  /** Chance per decision to do something aimless instead (wander, hop, stand still), like low-level CPUs. */
  aimless: number;
  /** Chance per decision to throw out an attack that will not connect. */
  whiff: number;
  /** Chance to fast fall when coming down. */
  fastFall: number;
  /** Mash inputs per second while held in a grab or dizzy (a new stick direction each, a button every other one). */
  mash: number;
  /** Pummels before a throw, at most. */
  pummels: number;
}

export const MIN_LEVEL = 1;
export const MAX_LEVEL = 9;
export const CPU_LEVELS = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const;

type Row = Omit<CpuLevel, 'level'>;

const TABLE: Row[] = [
  // 1
  {
    reaction: 40,
    thinkEvery: 20,
    aggression: 0.12,
    precision: 0.1,
    spacingError: 14,
    defense: 0.02,
    punish: 0,
    di: 0,
    recoveryError: 0.3,
    edgeguard: 0,
    followUp: 0.05,
    tech: 0,
    ledgeMix: 0,
    ledgeWait: [40, 100],
    aimless: 0.6,
    whiff: 0.35,
    fastFall: 0,
    mash: 0,
    pummels: 0,
  },
  // 2
  {
    reaction: 34,
    thinkEvery: 17,
    aggression: 0.2,
    precision: 0.2,
    spacingError: 12,
    defense: 0.05,
    punish: 0.03,
    di: 0.05,
    recoveryError: 0.2,
    edgeguard: 0,
    followUp: 0.12,
    tech: 0.02,
    ledgeMix: 0.05,
    ledgeWait: [35, 90],
    aimless: 0.45,
    whiff: 0.3,
    fastFall: 0.05,
    mash: 1,
    pummels: 0,
  },
  // 3
  {
    reaction: 28,
    thinkEvery: 14,
    aggression: 0.3,
    precision: 0.3,
    spacingError: 10,
    defense: 0.1,
    punish: 0.08,
    di: 0.15,
    recoveryError: 0.12,
    edgeguard: 0.03,
    followUp: 0.2,
    tech: 0.08,
    ledgeMix: 0.15,
    ledgeWait: [30, 80],
    aimless: 0.32,
    whiff: 0.25,
    fastFall: 0.1,
    mash: 2,
    pummels: 0,
  },
  // 4
  {
    reaction: 23,
    thinkEvery: 11,
    aggression: 0.4,
    precision: 0.42,
    spacingError: 8,
    defense: 0.2,
    punish: 0.18,
    di: 0.3,
    recoveryError: 0.07,
    edgeguard: 0.08,
    followUp: 0.32,
    tech: 0.18,
    ledgeMix: 0.3,
    ledgeWait: [20, 70],
    aimless: 0.22,
    whiff: 0.18,
    fastFall: 0.2,
    mash: 4,
    pummels: 1,
  },
  // 5
  {
    reaction: 19,
    thinkEvery: 8,
    aggression: 0.5,
    precision: 0.55,
    spacingError: 6,
    defense: 0.32,
    punish: 0.32,
    di: 0.45,
    recoveryError: 0.04,
    edgeguard: 0.16,
    followUp: 0.45,
    tech: 0.3,
    ledgeMix: 0.45,
    ledgeWait: [12, 60],
    aimless: 0.14,
    whiff: 0.12,
    fastFall: 0.35,
    mash: 6,
    pummels: 1,
  },
  // 6
  {
    reaction: 15,
    thinkEvery: 6,
    aggression: 0.6,
    precision: 0.67,
    spacingError: 4.5,
    defense: 0.45,
    punish: 0.48,
    di: 0.6,
    recoveryError: 0.02,
    edgeguard: 0.27,
    followUp: 0.58,
    tech: 0.45,
    ledgeMix: 0.6,
    ledgeWait: [8, 50],
    aimless: 0.08,
    whiff: 0.08,
    fastFall: 0.5,
    mash: 8,
    pummels: 2,
  },
  // 7
  {
    reaction: 12,
    thinkEvery: 4,
    aggression: 0.7,
    precision: 0.78,
    spacingError: 3,
    defense: 0.58,
    punish: 0.65,
    di: 0.75,
    recoveryError: 0,
    edgeguard: 0.38,
    followUp: 0.72,
    tech: 0.6,
    ledgeMix: 0.75,
    ledgeWait: [4, 42],
    aimless: 0.04,
    whiff: 0.05,
    fastFall: 0.65,
    mash: 10,
    pummels: 2,
  },
  // 8
  {
    reaction: 10,
    thinkEvery: 3,
    aggression: 0.8,
    precision: 0.88,
    spacingError: 2,
    defense: 0.7,
    punish: 0.8,
    di: 0.87,
    recoveryError: 0,
    edgeguard: 0.5,
    followUp: 0.85,
    tech: 0.75,
    ledgeMix: 0.88,
    ledgeWait: [2, 36],
    aimless: 0.02,
    whiff: 0.03,
    fastFall: 0.8,
    mash: 11,
    pummels: 3,
  },
  // 9
  {
    reaction: 8,
    thinkEvery: 2,
    aggression: 0.88,
    precision: 0.96,
    spacingError: 1,
    defense: 0.82,
    punish: 0.93,
    di: 0.96,
    recoveryError: 0,
    edgeguard: 0.62,
    followUp: 0.95,
    tech: 0.9,
    ledgeMix: 1,
    ledgeWait: [1, 30],
    aimless: 0,
    whiff: 0.01,
    fastFall: 0.92,
    mash: 12,
    pummels: 3,
  },
];

/** The parameters of a CPU level (clamped to 1-9 and rounded). */
export function cpuLevel(level: number): CpuLevel {
  const n = Math.min(MAX_LEVEL, Math.max(MIN_LEVEL, Math.round(level)));
  return { level: n, ...TABLE[n - 1]! };
}
