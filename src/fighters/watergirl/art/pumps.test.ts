import { describe, expect, it } from 'vitest';
import { entityArt, propPlacement } from '../../../render/entities';
import { clipFor } from '../../../render/fighterView';
import { flattenPath, shapesBounds, shapesContain } from '../../../render/rig/geometry';
import { resolveSymbol, samplePose } from '../../../render/rig/sample';
import type { PathShape } from '../../../render/rig/types';
import type { EntityState } from '../../../sim/entities/types';
import type { FighterState } from '../../../sim/fighter';
import type { MatchState } from '../../../sim/match';
import { run, testMatch } from '../../../sim/testing/sim';
import { getFighter } from '../../registry';
import { PUMP, entities } from '../entities';
import { STREAM } from '../waterStream';
import { art } from '.';

type Box = [number, number, number, number];

/**
 * Watergirl on the ground, facing `facing`, charges Water Stream for `tier`'s pumps and lets go; `visit` sees every
 * frame of the move as the renderer would draw it.
 */
function shootStream(tier: number, facing: 1 | -1, visit: (m: MatchState, f: FighterState) => void): void {
  const m = testMatch({ fighter: 'watergirl' });
  const f = m.fighters[0]!;
  f.facing = facing;
  run(m, 1, { buttons: ['special'] });
  while (f.charge < tier * 10 && f.move) run(m, 1, { buttons: ['special'] });
  expect(f.charge).toBe(tier * 10);
  while (f.move) {
    run(m, 1);
    visit(m, f);
  }
}

/** World box (y down) of her head and face slots in the pose the renderer draws for `f`. */
function headBox(m: MatchState, f: FighterState): Box {
  const [clip, frame] = clipFor(getFighter('watergirl'), art, f);
  const pose = samplePose(art, clip, frame, m.frame);
  const xs: number[] = [];
  const ys: number[] = [];
  for (const slot of art.rig.slots) {
    if (slot.name !== 'head' && slot.name !== 'face') continue;
    const m = pose.world[slot.bone]!;
    for (const shape of art.rig.symbols[pose.symbols[slot.name]!] as PathShape[])
      for (const p of flattenPath(shape.d))
        for (let i = 0; i < p.length; i += 2) {
          xs.push(f.pos.x + f.facing * (m.a * p[i]! + m.c * p[i + 1]! + m.tx));
          ys.push(-f.pos.y + m.b * p[i]! + m.d * p[i + 1]! + m.ty);
        }
  }
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
}

/** World box (y down) of the drawing the renderer puts on pump `e` at `alpha`, outline included. */
function pumpBox(e: EntityState, alpha: number): Box {
  const { prop } = entityArt(e.kind)!;
  const at = propPlacement(e, prop, alpha);
  const shapes = prop.symbols[resolveSymbol(prop.symbols, prop.symbol, at.frame)!] as PathShape[];
  const [c, s, k] = [Math.cos(at.rotation), Math.sin(at.rotation), prop.scale];
  const xs: number[] = [];
  const ys: number[] = [];
  for (const shape of shapes)
    for (const p of flattenPath(shape.d))
      for (let i = 0; i < p.length; i += 2) {
        const [x, y] = [p[i]! * k * at.scaleX, p[i + 1]! * k];
        xs.push(at.x + c * x - s * y);
        ys.push(at.y + s * x + c * y);
      }
  const pad = (Math.max(...shapes.map((shape) => shape.stroke?.width ?? 0)) / 2) * k;
  return [Math.min(...xs) - pad, Math.min(...ys) - pad, Math.max(...xs) + pad, Math.max(...ys) + pad];
}

describe("watergirl's Water Stream pumps", () => {
  it('draws every Water Stream pump in matches, on its hitbox as it leaves her hands and filling it after', () => {
    for (let tier = 0; tier <= PUMP.tiers; tier++) {
      const name = `pump${tier}`;
      const prop = art.projectiles?.[name];
      expect(prop, name).toBeDefined();
      expect(entityArt(`watergirl/${name}`)?.prop, name).toBe(prop);
      expect(prop!.align, name).toBe(true);
      const R = entities[name]!.hits![0]!.boxes[0]!.radius;
      expect(entities[name]!.radius, name).toBe(R);
      const drawn = (age: number) => resolveSymbol(prop!.symbols, prop!.symbol, age)!;
      const spout = drawn(1);
      const drawings = new Set(Array.from({ length: PUMP.lifetime }, (_, i) => drawn(i + 1)));
      expect(drawings.size, name).toBeGreaterThanOrEqual(3);
      for (const drawing of drawings) {
        const shapes = prop!.symbols[drawing] as PathShape[];
        const solid = shapes.filter((shape) => typeof shape.fill === 'string');
        if (drawing === spout) {
          // Smaller than the hitbox and inside it, over its centre.
          expect(shapesContain(solid, 0, 0), `${name} ${drawing} centre`).toBe(true);
          for (const shape of shapes)
            for (const p of flattenPath(shape.d))
              for (let i = 0; i < p.length; i += 2)
                expect(Math.hypot(p[i]!, p[i + 1]!) * prop!.scale, `${name} ${drawing}`).toBeLessThanOrEqual(
                  1.05 * R,
                );
          continue;
        }
        // Water out to the hitbox's edge all round its centre.
        for (let deg = 0; deg < 360; deg += 15) {
          const [x, y] = [Math.cos((deg * Math.PI) / 180), Math.sin((deg * Math.PI) / 180)];
          expect(
            shapesContain(solid, (0.95 * R * x) / prop!.scale, (0.95 * R * y) / prop!.scale),
            `${name} ${drawing} ${deg}`,
          ).toBe(true);
        }
        // Not much past it ahead, above or below; the tail and the drops it sheds trail up to 3.5 radii behind.
        const [x0, y0, x1, y1] = shapesBounds(shapes).map((v) => v * prop!.scale);
        expect(x1!, `${name} ${drawing} front`).toBeLessThanOrEqual(1.1 * R);
        expect(Math.max(-y0!, y1!), `${name} ${drawing} height`).toBeLessThanOrEqual(1.3 * R);
        expect(-x0!, `${name} ${drawing} tail`).toBeLessThanOrEqual(3.5 * R);
      }
    }
  });

  it('draws each pump from age 1 to its last age, as the spout on its first three', () => {
    const ages = new Map<number, number[]>();
    shootStream(PUMP.tiers, 1, (m) => {
      for (const e of m.entities) ages.set(e.id, [...(ages.get(e.id) ?? []), e.age]);
    });
    expect(ages.size).toBe(STREAM.pumps);
    const life = Array.from({ length: PUMP.lifetime }, (_, i) => i + 1);
    for (const seen of ages.values()) expect(seen).toEqual(life);
    const prop = art.projectiles!.pump0!;
    const drawn = life.map((age) => resolveSymbol(prop.symbols, prop.symbol, age));
    expect(drawn.slice(0, 3)).toEqual(['pumpSpout', 'pumpSpout', 'pumpSpout']);
    expect(drawn.slice(3)).not.toContain('pumpSpout');
  });

  it('keeps every pump off her head on every frame it is drawn, at every charge and facing either way', () => {
    const overlaps: string[] = [];
    for (let tier = 0; tier <= PUMP.tiers; tier++)
      for (const facing of [1, -1] as const)
        shootStream(tier, facing, (m, f) => {
          const [hx0, hy0, hx1, hy1] = headBox(m, f);
          for (const e of m.entities)
            for (const alpha of [0, 1]) {
              const [x0, y0, x1, y1] = pumpBox(e, alpha);
              if (x0 < hx1 && x1 > hx0 && y0 < hy1 && y1 > hy0)
                overlaps.push(`pump${tier} facing ${facing} age ${e.age} alpha ${alpha}`);
            }
        });
    expect(overlaps).toEqual([]);
  });

  it("previews the first pump of each Water Stream shoot in the lab, from the nozzle at the shoot's speed", () => {
    const first = STREAM.chargeFrame + STREAM.firstPump;
    const theta = (STREAM.angle * Math.PI) / 180;
    for (const [clip, name, speed] of [
      ['neutralB', 'pump0', STREAM.speed],
      ['neutralBHeavy', `pump${PUMP.tiers}`, STREAM.speed + STREAM.extraSpeed],
    ] as const) {
      const at = art.projectiles?.[name]?.preview?.[clip];
      expect(at, clip).toBeDefined();
      expect([at!.frame, at!.x, at!.y, at!.to]).toEqual([
        first,
        STREAM.nozzle.x,
        STREAM.nozzle.y,
        first + PUMP.lifetime,
      ]);
      expect(at!.vx).toBeCloseTo(speed * Math.cos(theta), 6);
      expect(at!.vy).toBeCloseTo(speed * Math.sin(theta), 6);
    }
  });
});
