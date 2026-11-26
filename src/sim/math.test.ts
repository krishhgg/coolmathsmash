import { describe, expect, it } from 'vitest';
import * as SimMath from './math';

type Fn = 'sin' | 'cos' | 'atan' | 'atan2' | 'asin' | 'hypot';
const call = (fn: Fn, args: number[]): number => (SimMath[fn] as (...a: number[]) => number)(...args);
const engine = (fn: Fn, args: number[]): number => (Math[fn] as (...a: number[]) => number)(...args);

const bits = new DataView(new ArrayBuffer(8));
/** Where `x` falls in the ordered list of doubles. */
function ordinal(x: number): bigint {
  bits.setFloat64(0, x);
  const n = bits.getBigInt64(0);
  return n < 0n ? -(n & 0x7fffffffffffffffn) : n;
}
/** How many doubles apart `a` and `b` are. */
const ulps = (a: number, b: number): number => Number(ordinal(a) - ordinal(b));

/** A fixed list of pseudo-random numbers in [0, 1). */
function uniform(count: number, seed: number): number[] {
  let s = seed;
  return Array.from({ length: count }, () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return (s >>> 0) / 2 ** 32;
  });
}

describe('src/sim/math.ts', () => {
  // These exact doubles, in every runtime. The first sin and cos arguments are ones Node 24 and Chromium 159 round
  // differently (Chromium's Math.cos(0.7738543424412329) is 0.7152222000413689); SimMath gives Node's answer, which
  // is fdlibm's.
  it.each([
    ['sin', [0.3365992128846207], 0.33027906195516704],
    ['sin', [0.7853981633974483], 0.7071067811865475],
    ['sin', [6.300638599699529], 0.01745240643728307],
    ['sin', [-2.5], -0.5984721441039564],
    ['sin', [1000], 0.8268795405320025],
    ['cos', [0.7738543424412329], 0.715222200041369],
    ['cos', [0.5928500290645033], 0.8293516614367362],
    ['cos', [2.6179938779914944], -0.8660254037844387],
    ['cos', [-7], 0.7539022543433046],
    ['atan2', [1, 2], 0.4636476090008061],
    ['atan2', [1, -2], 2.677945044588987],
    ['atan2', [-1, -2], -2.677945044588987],
    ['atan2', [-1, 2], -0.4636476090008061],
    ['asin', [0.3], 0.3046926540153975],
    ['asin', [-0.8], -0.9272952180016123],
    ['asin', [0.99], 1.4292568534704693],
    ['hypot', [3, 4], 5],
    ['hypot', [1, 1], 1.4142135623730951],
    ['hypot', [-2.359350620053856, 0.7], 2.461002915144254],
  ] as [Fn, number[], number][])('%s(%j) is exactly %s', (fn, args, expected) => {
    expect(call(fn, args)).toBe(expected);
  });

  it.each([
    ['sin', 1, (u: number) => (u - 0.5) * 4 * Math.PI],
    ['cos', 1, (u: number) => (u - 0.5) * 4 * Math.PI],
    ['sin', 1, (u: number) => (u - 0.5) * 2e5],
    ['cos', 1, (u: number) => (u - 0.5) * 2e5],
    ['atan', 1, (u: number) => Math.tan((u - 0.5) * Math.PI)],
    ['atan2', 2, (u: number) => (u - 0.5) * 40],
    ['asin', 1, (u: number) => u * 2 - 1],
    ['hypot', 2, (u: number) => (u - 0.5) * 1e3],
  ] as [Fn, number, (u: number) => number][])(
    '%s stays within 1 ULP of the engine over 20,000 arguments',
    (fn, arity, arg) => {
      const us = uniform(20_000 * arity, 0x9e3779b9).map(arg);
      let worst = 0;
      for (let i = 0; i < us.length; i += arity) {
        const args = us.slice(i, i + arity);
        worst = Math.max(worst, Math.abs(ulps(call(fn, args), engine(fn, args))));
      }
      expect(worst).toBeLessThanOrEqual(1);
    },
  );

  it('handles zeros, infinities and NaN as Math does', () => {
    const specials = [
      0,
      -0,
      1,
      -1,
      0.5,
      -0.5,
      Infinity,
      -Infinity,
      NaN,
      Number.MIN_VALUE,
      2 ** 70,
      -(2 ** 70),
    ];
    for (const x of specials) {
      // sin and cos match fdlibm up to 2^19 * pi/2; past that they stay deterministic but drift from it.
      const fns =
        Math.abs(x) < 1e6 || !Number.isFinite(x)
          ? (['sin', 'cos', 'atan', 'asin'] as const)
          : (['atan', 'asin'] as const);
      for (const fn of fns) expect(call(fn, [x]), `${fn}(${x})`).toBe(engine(fn, [x]));
      for (const y of specials) {
        for (const fn of ['atan2', 'hypot'] as const)
          expect(call(fn, [y, x]), `${fn}(${y}, ${x})`).toBe(engine(fn, [y, x]));
      }
    }
  });
});
