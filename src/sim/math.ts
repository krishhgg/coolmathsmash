/**
 * Math for the simulation that gives the same bits in every JavaScript engine.
 *
 * ECMAScript leaves `Math.sin`, `Math.cos`, `Math.atan2`, `Math.hypot` and the other transcendental functions
 * "implementation-approximated", and engines do differ: Node 24 (V8 13.6) and Chromium 159 disagree in the last bit
 * of `Math.cos` on about 3% of inputs, so the same match drifts apart between Node and the browser. Only `+ - * /`
 * and `Math.sqrt` are exactly rounded by the spec. Everything here is built from those, plus exact operations
 * (`Math.abs`, `Math.floor`, reading and writing a double's bits).
 *
 * `sin`, `cos`, `atan`, `atan2` and `asin` are ports of fdlibm 5.3 (the library V8 13 uses), so they return the
 * bits Node returned before, for every argument the game passes (sin and cos: |x| up to 2^19 * pi/2; beyond that
 * they stay deterministic but lose accuracy). Their constants are fdlibm's, each written as the shortest decimal that
 * reads back as the same double. `hypot` is V8's own two-argument algorithm. Code that feeds the simulation's state
 * (src/sim, src/fighters, src/stages and src/ai, outside art and views) must use these; eslint.config.js bans the
 * `Math` versions there.
 */

const bits = new DataView(new ArrayBuffer(8));

/** The high 32 bits of `x` (sign, exponent and the top of the mantissa), as a signed integer. */
function high(x: number): number {
  bits.setFloat64(0, x);
  return bits.getInt32(0);
}

/** The low 32 bits of `x`'s mantissa, unsigned. */
function low(x: number): number {
  bits.setFloat64(0, x);
  return bits.getUint32(4);
}

/** The double whose high and low words are `hi` and `lo`. */
function fromWords(hi: number, lo: number): number {
  bits.setInt32(0, hi);
  bits.setUint32(4, lo);
  return bits.getFloat64(0);
}

// sin and cos on [-pi/4, pi/4]: fdlibm's k_sin.c and k_cos.c. `y` is the tail of the reduced argument x + y.

const S1 = -0.16666666666666632;
const S2 = 0.00833333333332249;
const S3 = -0.0001984126982985795;
const S4 = 0.0000027557313707070068;
const S5 = -2.5050760253406863e-8;
const S6 = 1.58969099521155e-10;

function kernelSin(x: number, y: number, iy: number): number {
  const ix = high(x) & 0x7fffffff;
  if (ix < 0x3e400000 && Math.trunc(x) === 0) return x; // |x| < 2^-27
  const z = x * x;
  const v = z * x;
  const r = S2 + z * (S3 + z * (S4 + z * (S5 + z * S6)));
  if (iy === 0) return x + v * (S1 + z * r);
  return x - (z * (0.5 * y - v * r) - y - v * S1);
}

const C1 = 0.0416666666666666;
const C2 = -0.001388888888887411;
const C3 = 0.00002480158728947673;
const C4 = -2.7557314351390663e-7;
const C5 = 2.087572321298175e-9;
const C6 = -1.1359647557788195e-11;

function kernelCos(x: number, y: number): number {
  const ix = high(x) & 0x7fffffff;
  if (ix < 0x3e400000 && Math.trunc(x) === 0) return 1; // |x| < 2^-27
  const z = x * x;
  const r = z * (C1 + z * (C2 + z * (C3 + z * (C4 + z * (C5 + z * C6)))));
  if (ix < 0x3fd33333) return 1 - (0.5 * z - (z * r - x * y)); // |x| < 0.3
  const qx = ix > 0x3fe90000 ? 0.28125 : fromWords(ix - 0x00200000, 0); // x/4, or 0.28125 past 0.78125
  const hz = 0.5 * z - qx;
  const a = 1 - qx;
  return a - (hz - (z * r - x * y));
}

// Argument reduction: fdlibm's e_rem_pio2.c for |x| up to 2^19 * pi/2. pi/2 is split into 33-bit pieces so that
// n * piece is exact; the tails catch what each piece leaves out.

const INV_PIO2 = 0.6366197723675814;
const PIO2_1 = 1.5707963267341256;
const PIO2_1T = 6.077100506506192e-11;
const PIO2_2 = 6.077100506303966e-11;
const PIO2_2T = 2.0222662487959506e-21;
const PIO2_3 = 2.0222662487111665e-21;
const PIO2_3T = 8.4784276603689e-32;

/** High words of n * pi/2 for n = 1..32: an x whose high word differs cannot lose many bits to cancellation. */
const NPIO2_HW = [
  0x3ff921fb, 0x400921fb, 0x4012d97c, 0x401921fb, 0x401f6a7a, 0x4022d97c, 0x4025fdbb, 0x402921fb, 0x402c463a,
  0x402f6a7a, 0x4031475c, 0x4032d97c, 0x40346b9c, 0x4035fdbb, 0x40378fdb, 0x403921fb, 0x403ab41b, 0x403c463a,
  0x403dd85a, 0x403f6a7a, 0x40407e4c, 0x4041475c, 0x4042106c, 0x4042d97c, 0x4043a28c, 0x40446b9c, 0x404534ac,
  0x4045fdbb, 0x4046c6cb, 0x40478fdb, 0x404858eb, 0x404921fb,
];

/** The reduced argument of the last remPio2 call, as head and tail. */
let r0 = 0;
let r1 = 0;

/** Write x - n * pi/2 into r0 + r1 and return n (only its last two bits matter to the callers). */
function remPio2(x: number): number {
  const hx = high(x);
  const ix = hx & 0x7fffffff;
  if (ix < 0x4002d97c) {
    // |x| < 3pi/4: n is +-1
    if (hx > 0) {
      let z = x - PIO2_1;
      if (ix !== 0x3ff921fb) {
        r0 = z - PIO2_1T;
        r1 = z - r0 - PIO2_1T;
      } else {
        z -= PIO2_2;
        r0 = z - PIO2_2T;
        r1 = z - r0 - PIO2_2T;
      }
      return 1;
    }
    let z = x + PIO2_1;
    if (ix !== 0x3ff921fb) {
      r0 = z + PIO2_1T;
      r1 = z - r0 + PIO2_1T;
    } else {
      z += PIO2_2;
      r0 = z + PIO2_2T;
      r1 = z - r0 + PIO2_2T;
    }
    return -1;
  }
  // fdlibm switches to Payne-Hanek reduction past 2^19 * pi/2; the game never gets there, so larger arguments take
  // this same path, still deterministic but less accurate.
  const t = Math.abs(x);
  const n = Math.floor(t * INV_PIO2 + 0.5);
  let r = t - n * PIO2_1;
  let w = n * PIO2_1T;
  if (n < 32 && ix !== NPIO2_HW[n - 1]) {
    r0 = r - w;
  } else {
    const j = ix >> 20;
    r0 = r - w;
    let i = j - ((high(r0) >> 20) & 0x7ff);
    if (i > 16) {
      // a second round, good to 118 bits
      let u = r;
      w = n * PIO2_2;
      r = u - w;
      w = n * PIO2_2T - (u - r - w);
      r0 = r - w;
      i = j - ((high(r0) >> 20) & 0x7ff);
      if (i > 49) {
        // a third, good to 151 bits
        u = r;
        w = n * PIO2_3;
        r = u - w;
        w = n * PIO2_3T - (u - r - w);
        r0 = r - w;
      }
    }
  }
  r1 = r - r0 - w;
  if (hx < 0) {
    r0 = -r0;
    r1 = -r1;
    return -n;
  }
  return n;
}

/** Math.sin, the same in every engine. */
export function sin(x: number): number {
  const ix = high(x) & 0x7fffffff;
  if (ix <= 0x3fe921fb) return kernelSin(x, 0, 0); // |x| <= pi/4
  if (ix >= 0x7ff00000) return NaN; // Infinity or NaN
  switch (remPio2(x) & 3) {
    case 0:
      return kernelSin(r0, r1, 1);
    case 1:
      return kernelCos(r0, r1);
    case 2:
      return -kernelSin(r0, r1, 1);
    default:
      return -kernelCos(r0, r1);
  }
}

/** Math.cos, the same in every engine. */
export function cos(x: number): number {
  const ix = high(x) & 0x7fffffff;
  if (ix <= 0x3fe921fb) return kernelCos(x, 0); // |x| <= pi/4
  if (ix >= 0x7ff00000) return NaN;
  switch (remPio2(x) & 3) {
    case 0:
      return kernelCos(r0, r1);
    case 1:
      return -kernelSin(r0, r1, 1);
    case 2:
      return -kernelCos(r0, r1);
    default:
      return kernelSin(r0, r1, 1);
  }
}

// atan: fdlibm's s_atan.c. atan(x) = atan(c) + atan((x - c) / (1 + x * c)) for c in {0.5, 1, 1.5, Infinity}.

const ATAN_HI = [0.4636476090008061, 0.7853981633974483, 0.982793723247329, 1.5707963267948966];
const ATAN_LO = [
  2.2698777452961687e-17, 3.061616997868383e-17, 1.3903311031230998e-17, 6.123233995736766e-17,
];
const AT = [
  0.3333333333333293, -0.19999999999876483, 0.14285714272503466, -0.11111110405462356, 0.09090887133436507,
  -0.0769187620504483, 0.06661073137387531, -0.058335701337905735, 0.049768779946159324,
  -0.036531572744216916, 0.016285820115365782,
] as const;

/** Math.atan, the same in every engine. */
export function atan(x: number): number {
  const hx = high(x);
  const ix = hx & 0x7fffffff;
  let id: number;
  if (ix >= 0x44100000) {
    // |x| >= 2^66, Infinity or NaN
    if (x !== x) return x + x;
    return hx > 0 ? ATAN_HI[3]! + ATAN_LO[3]! : -ATAN_HI[3]! - ATAN_LO[3]!;
  }
  if (ix < 0x3fdc0000) {
    // |x| < 0.4375
    if (ix < 0x3e200000) return x; // |x| < 2^-29
    id = -1;
  } else {
    x = Math.abs(x);
    if (ix < 0x3ff30000) {
      if (ix < 0x3fe60000) {
        id = 0; // 7/16 <= |x| < 11/16
        x = (2 * x - 1) / (2 + x);
      } else {
        id = 1; // 11/16 <= |x| < 19/16
        x = (x - 1) / (x + 1);
      }
    } else if (ix < 0x40038000) {
      id = 2; // 19/16 <= |x| < 2.4375
      x = (x - 1.5) / (1 + 1.5 * x);
    } else {
      id = 3; // 2.4375 <= |x| < 2^66
      x = -1 / x;
    }
  }
  const z = x * x;
  const w = z * z;
  const s1 = z * (AT[0] + w * (AT[2] + w * (AT[4] + w * (AT[6] + w * (AT[8] + w * AT[10])))));
  const s2 = w * (AT[1] + w * (AT[3] + w * (AT[5] + w * (AT[7] + w * AT[9]))));
  if (id < 0) return x - x * (s1 + s2);
  const r = ATAN_HI[id]! - (x * (s1 + s2) - ATAN_LO[id]! - x);
  return hx < 0 ? -r : r;
}

const PI = 3.141592653589793;
const PI_O_2 = 1.5707963267948966;
const PI_O_4 = 0.7853981633974483;
const PI_LO = 1.2246467991473532e-16;

/** Math.atan2, the same in every engine (fdlibm's e_atan2.c). */
export function atan2(y: number, x: number): number {
  if (x !== x || y !== y) return NaN;
  const hx = high(x);
  const ix = hx & 0x7fffffff;
  const lx = low(x);
  const hy = high(y);
  const iy = hy & 0x7fffffff;
  const ly = low(y);
  if (hx === 0x3ff00000 && lx === 0) return atan(y); // x = 1
  let m = ((hy >> 31) & 1) | ((hx >> 30) & 2); // 2 * sign(x) + sign(y)
  if ((iy | ly) === 0) {
    // y = +-0
    if (m < 2) return y;
    return m === 2 ? PI : -PI;
  }
  if ((ix | lx) === 0) return hy < 0 ? -PI_O_2 : PI_O_2; // x = +-0
  if (ix === 0x7ff00000) {
    // x = +-Infinity
    if (iy === 0x7ff00000) return [PI_O_4, -PI_O_4, 3 * PI_O_4, -3 * PI_O_4][m]!;
    return [0, -0, PI, -PI][m]!;
  }
  if (iy === 0x7ff00000) return hy < 0 ? -PI_O_2 : PI_O_2; // y = +-Infinity
  const k = (iy - ix) >> 20;
  let z: number;
  if (k > 60) {
    // |y / x| > 2^60
    z = PI_O_2 + 0.5 * PI_LO;
    m &= 1;
  } else if (hx < 0 && k < -60) {
    z = 0; // 0 > |y| / x > -2^-60
  } else {
    z = atan(Math.abs(y / x));
  }
  switch (m) {
    case 0:
      return z;
    case 1:
      return -z;
    case 2:
      return PI - (z - PI_LO);
    default:
      return z - PI_LO - PI;
  }
}

// asin: fdlibm's e_asin.c, a rational approximation R(x^2) = (asin(x) - x) / x^3 on [0, 0.5] and
// asin(x) = pi/2 - 2 * asin(sqrt((1 - x) / 2)) above it.

const PIO2_HI = 1.5707963267948966;
const PIO2_LO = 6.123233995736766e-17;
const PIO4_HI = 0.7853981633974483;
const PS0 = 0.16666666666666666;
const PS1 = -0.3255658186224009;
const PS2 = 0.20121253213486293;
const PS3 = -0.04005553450067941;
const PS4 = 0.0007915349942898145;
const PS5 = 0.00003479331075960212;
const QS1 = -2.403394911734414;
const QS2 = 2.0209457602335057;
const QS3 = -0.6882839716054533;
const QS4 = 0.07703815055590194;

/** Math.asin, the same in every engine. */
export function asin(x: number): number {
  const hx = high(x);
  const ix = hx & 0x7fffffff;
  if (ix >= 0x3ff00000) {
    // |x| >= 1
    if (ix === 0x3ff00000 && low(x) === 0) return x * PIO2_HI + x * PIO2_LO;
    return NaN;
  }
  if (ix < 0x3fe00000) {
    // |x| < 0.5
    if (ix < 0x3e400000) return x; // |x| < 2^-27
    const t = x * x;
    const p = t * (PS0 + t * (PS1 + t * (PS2 + t * (PS3 + t * (PS4 + t * PS5)))));
    const q = 1 + t * (QS1 + t * (QS2 + t * (QS3 + t * QS4)));
    return x + x * (p / q);
  }
  const w = 1 - Math.abs(x);
  const t = w * 0.5;
  const p = t * (PS0 + t * (PS1 + t * (PS2 + t * (PS3 + t * (PS4 + t * PS5)))));
  const q = 1 + t * (QS1 + t * (QS2 + t * (QS3 + t * QS4)));
  const s = Math.sqrt(t);
  let r: number;
  if (ix >= 0x3fef3333) {
    // |x| > 0.975
    r = PIO2_HI - (2 * (s + s * (p / q)) - PIO2_LO);
  } else {
    const sh = fromWords(high(s), 0); // s with its low word cleared
    const c = (t - sh * sh) / (s + sh);
    const pp = 2 * s * (p / q) - (PIO2_LO - 2 * c);
    const qq = PIO4_HI - 2 * sh;
    r = PIO4_HI - (pp - qq);
  }
  return hx > 0 ? r : -r;
}

/**
 * Math.hypot of two numbers, the same in every engine: V8's algorithm (src/builtins/math.tq), which scales by the
 * larger magnitude so the squares cannot overflow.
 */
export function hypot(x: number, y: number): number {
  const ax = Math.abs(x);
  const ay = Math.abs(y);
  if (ax === Infinity || ay === Infinity) return Infinity;
  if (ax !== ax || ay !== ay) return NaN;
  const max = ax > ay ? ax : ay;
  if (max === 0) return 0;
  const nx = ax / max;
  const ny = ay / max;
  return Math.sqrt(nx * nx + ny * ny) * max;
}
