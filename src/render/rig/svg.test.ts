import { describe, expect, it } from 'vitest';
import { recolorIcon, symbolsToSvg } from './svg';

describe('costume icons', () => {
  it('keeps two paint roles separate even if their default colors match', () => {
    const base = { skin: '#111111', eye: '#111111' };
    const costume = { skin: '#ffcc22', eye: '#222222' };
    const svg = symbolsToSvg(
      {
        face: [
          { d: 'M0 0 H10 V10 Z', fill: 'skin', stroke: { color: 'eye', width: 1 } },
          { d: 'M2 2 H3 V3 Z', fill: '#111111' },
        ],
      },
      ['face'],
      base,
      [0, 0, 10, 10],
    );
    const icon = recolorIcon(svg, base, costume);
    expect(icon).toContain('fill="#ffcc22" data-palette-fill="skin"');
    expect(icon).toContain('stroke="#222222" data-palette-stroke="eye"');
    expect(icon).toContain('d="M2 2 H3 V3 Z" fill="#111111"');
  });

  it('recolors legacy SVG only where the original color identifies a single replacement', () => {
    const icon = '<path fill="#111111" stroke="#222222"/>';
    const base = { shell: '#111111', eye: '#222222', outline: '#222222' };
    const costume = { shell: '#abcdef', eye: '#333333', outline: '#222222' };
    expect(recolorIcon(icon, base, costume)).toBe('<path fill="#abcdef" stroke="#222222"/>');
  });
});
