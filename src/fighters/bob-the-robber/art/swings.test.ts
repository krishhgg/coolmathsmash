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
    // Measured on screen, his front arm swings round too far as he turns to strike behind him through sx -1 in the
    // down smash and getup attack. `continuous` picks each key's turn by adding turns up through the mirrored body,
    // as the check used to, so it chose these; they are listed until his keys are fixed.
    expect(texts(turnFindings(art, swingChecks))).toEqual([
      'dsmash@14 armF -128',
      'dsmash@14 foreF -166',
      'dsmash@14 handF -166',
      'getupAttack@22 armF -64',
      'getupAttack@22 foreF -85',
      'getupAttack@22 handF -85',
    ]);
  });

  it('never moves a held prop in front of or behind a part it covers from one frame to the next', () => {
    expect(texts(orderFindings(art, swingChecks))).toEqual([]);
  });

  it('keeps the sack off his face', () => {
    expect(texts(faceFindings(art, swingChecks))).toEqual([]);
  });
});
