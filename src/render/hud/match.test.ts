import { describe, expect, it } from 'vitest';
import { getFighter } from '../../fighters/registry';
import { neutralInput } from '../../input/types';
import { DEFAULT_MATCH, createMatch, stepMatch } from '../../sim/match';
import { fighterArt, pickCostumes } from '../fighterView';
import { MatchHud } from './match';

const idle = () => [neutralInput(), neutralInput()];

describe('MatchHud', () => {
  it('reads names, damage and stocks from the match', () => {
    const m = createMatch({ ...DEFAULT_MATCH, stocks: 2 });
    const hud = new MatchHud();
    stepMatch(m, idle());
    hud.step(m);
    const [p1, p2] = hud.players(m);
    expect(p1).toMatchObject({
      port: 0,
      name: 'Fireboy',
      damage: 0,
      stocks: 2,
      maxStocks: 2,
      eliminated: false,
    });
    expect(p2!.port).toBe(1);
  });

  it('remembers the frame damage last went up, and treats the first frame as the baseline', () => {
    const m = createMatch(DEFAULT_MATCH);
    m.fighters[1]!.damage = 120;
    const hud = new MatchHud();
    stepMatch(m, idle());
    hud.step(m);
    expect(hud.players(m)[1]!.hitFrame).toBe(-1);
    stepMatch(m, idle());
    m.fighters[1]!.damage += 12;
    hud.step(m);
    expect(hud.players(m)[1]!.hitFrame).toBe(m.frame);
    const hitAt = m.frame;
    stepMatch(m, idle());
    m.fighters[1]!.damage = 0;
    hud.step(m);
    expect(hud.players(m)[1]!.hitFrame).toBe(hitAt);
    expect(hud.players(m)[0]!.hitFrame).toBe(-1);
  });

  it('starts over on a new match', () => {
    const hud = new MatchHud();
    const a = createMatch(DEFAULT_MATCH);
    stepMatch(a, idle());
    hud.step(a);
    a.fighters[0]!.damage = 30;
    stepMatch(a, idle());
    hud.step(a);
    expect(hud.players(a)[0]!.hitFrame).toBe(a.frame);
    const b = createMatch(DEFAULT_MATCH);
    expect(hud.players(b)[0]!.hitFrame).toBe(-1);
    stepMatch(b, idle());
    hud.step(b);
    expect(hud.players(b)[0]!.hitFrame).toBe(-1);
  });

  it('uses the palette the renderer assigned each mirror-match port', () => {
    const m = createMatch({
      ...DEFAULT_MATCH,
      ports: [
        { fighter: 'fireboy', costume: 'light' },
        { fighter: 'fireboy', costume: 'light' },
      ],
    });
    const art = fighterArt(getFighter('fireboy'))!;
    const hud = new MatchHud();
    const costumes = pickCostumes(m.config, () => art);
    const [light, original] = hud.players(m, costumes);
    expect(costumes).toEqual(['light', 'default']);
    expect(light!.icon).toContain(`fill="${art.palettes.light!.skin}" data-palette-fill="skin"`);
    expect(original!.icon).toBe(art.icon);
    expect(light!.icon).not.toBe(original!.icon);
  });
});
