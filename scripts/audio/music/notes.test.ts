import { describe, expect, it } from 'vitest';
import { midi, rootIn } from './notes.ts';

describe('rootIn', () => {
  it("folds a chord's root, not its lowest voiced tone, into the octave from low", () => {
    expect(rootIn('C', midi('E2'))).toBe(midi('C3'));
    expect(rootIn('D', midi('E2'))).toBe(midi('D3'));
    expect(rootIn('Em', midi('E2'))).toBe(midi('E2'));
    expect(rootIn('F#m7', midi('E2'))).toBe(midi('F#2'));
    expect(rootIn('Asus4', midi('A2'))).toBe(midi('A2'));
  });

  it('uses the bass note of a slash chord', () => {
    expect(rootIn('C/E', midi('E2'))).toBe(midi('E2'));
  });
});
