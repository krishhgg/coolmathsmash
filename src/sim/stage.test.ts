import { describe, expect, it } from 'vitest';
import { getStage } from '../stages/registry';
import { compileStage, floorY } from './stage';

describe('stage compilation', () => {
  const { edges } = compileStage(getStage('battlefield'));

  it("classifies Battlefield's top as the only floor, with outward normals", () => {
    const floors = edges.filter((e) => e.kind === 'floor');
    expect(floors).toHaveLength(1);
    expect(floors[0]!.n.y).toBeCloseTo(1);
    expect(floorY(floors[0]!, 12)).toBeCloseTo(0);
  });

  it('has vertical side walls facing outward and a ceiling underneath', () => {
    const walls = edges.filter((e) => e.kind === 'wall');
    const left = walls.find((e) => e.a.x === -80 && e.b.x === -80)!;
    const right = walls.find((e) => e.a.x === 80 && e.b.x === 80)!;
    expect(left.n.x).toBeCloseTo(-1);
    expect(right.n.x).toBeCloseTo(1);
    expect(edges.some((e) => e.kind === 'ceiling' && e.n.y < -0.99)).toBe(true);
  });
});
