/**
 * Fixed integer hashing for effects. An effect's look comes from its seed, and its seed only from integers in its
 * spawn record (frame, port, an index), so the same simulated frames always draw the same picture. No Math.random,
 * no clocks.
 */

/** lowbias32 (Chris Wellons): a well-mixed 32-bit integer hash. */
export function hash32(x: number): number {
  x = (x ^ (x >>> 16)) >>> 0;
  x = Math.imul(x, 0x7feb352d) >>> 0;
  x = (x ^ (x >>> 15)) >>> 0;
  x = Math.imul(x, 0x846ca68b) >>> 0;
  return (x ^ (x >>> 16)) >>> 0;
}

/** Seed of an effect spawned on `frame` for `port`; `salt` tells apart effects spawned together. */
export function seedOf(frame: number, port: number, salt = 0): number {
  return hash32((hash32((hash32(frame | 0) ^ (port | 0)) >>> 0) + (salt | 0)) >>> 0);
}

/** The `i`-th pseudo-random value of `seed`, in [0, 1). */
export function rand(seed: number, i: number): number {
  return hash32((seed ^ Math.imul((i | 0) + 1, 0x9e3779b9)) >>> 0) / 4294967296;
}

/** The `i`-th value of `seed` in [-1, 1). */
export const signed = (seed: number, i: number): number => rand(seed, i) * 2 - 1;
