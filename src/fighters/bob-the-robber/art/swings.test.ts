import { describe, expect, it } from 'vitest';
import {
  STRIKE,
  TURN,
  faceFindings,
  floorFindings,
  orderFindings,
  turnFindings,
  type Finding,
} from '../../../render/rig/swingChecks';
import { art } from '.';
import { swingChecks } from './swings';

const texts = (found: Finding[]) => found.map((f) => f.text);

describe("bob's baton swings", () => {
  it('keeps every drawn part, the baton tip included, above the floor on every frame', () => {
    expect(texts(floorFindings(art, swingChecks))).toEqual([]);
  });

  it(`turns no drawn part more than ${TURN} degrees between frames, or ${STRIKE} as it strikes`, () => {
    expect(texts(turnFindings(art, swingChecks))).toEqual([]);
  });

  it('never moves a held prop in front of or behind a part it covers from one frame to the next', () => {
    expect(texts(orderFindings(art, swingChecks))).toEqual([]);
  });

  it('keeps the sack off his face', () => {
    expect(texts(faceFindings(art, swingChecks))).toEqual([]);
  });
});
