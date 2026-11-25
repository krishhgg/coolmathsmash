import { describe, expect, it } from 'vitest';
import type { GameScenarioInfo, LabScenario, ScenarioInfo } from '../../src/harness/scenarios.ts';
import { scopeCaptures } from './capture-scope.ts';

const game = (name: string, match?: GameScenarioInfo['match']): GameScenarioInfo => ({
  name,
  description: name,
  page: { kind: 'game' },
  capture: { frame: 1 },
  match,
});
const lab = (name: string, scene: string, params?: Record<string, string>): LabScenario => ({
  name,
  description: name,
  page: { kind: 'lab', scene, params },
});
const scenarios: ScenarioInfo[] = [
  game('idle'),
  game('redball-idle', { ports: [{ fighter: 'redball' }, { fighter: 'fireboy' }] }),
  game('fluffy-idle', { ports: [{ fighter: 'fluffy' }, { fighter: 'fireboy' }] }),
  game('duel', { stage: 'temple', ports: [{ fighter: 'redball' }, { fighter: 'fluffy' }] }),
  lab('redball-sheet', 'fighter', { fighter: 'redball' }),
  lab('fluffy-sheet', 'fighter', { fighter: 'fluffy' }),
  lab('css-2p', 'menu', { screen: 'css' }),
  lab('stage-preset', 'stage', { stage: 'battlefield' }),
  lab('stage-select', 'menu', { screen: 'stages' }),
  lab('title', 'menu', { screen: 'title' }),
];
const select = (...files: string[]) =>
  scopeCaptures(scenarios, files, { stage: 'battlefield', ports: [{ fighter: 'fireboy' }] })?.map(
    (s) => s.name,
  );

describe('capture scope', () => {
  it('reuses fighter prefixes and includes other matches featuring the affected fighter', () => {
    expect(
      select('src/fighters/redball/moves.ts', 'src/fighters/fluffy/fluffy.test.ts', 'docs/art.md'),
    ).toEqual(['redball-idle', 'duel', 'redball-sheet', 'css-2p']);
  });

  it('includes each touched stage and fighter without running unrelated captures', () => {
    expect(select('src/stages/temple/geometry.ts')).toEqual(['duel', 'stage-select']);
    expect(select('src/stages/temple/view.ts', 'src/fighters/fluffy/stats.ts')).toEqual([
      'fluffy-idle',
      'duel',
      'fluffy-sheet',
      'css-2p',
      'stage-select',
    ]);
    expect(select('src/stages/battlefield/view.ts')).toEqual([
      'idle',
      'redball-idle',
      'fluffy-idle',
      'stage-preset',
      'stage-select',
    ]);
  });

  it('validates a shared form with its partner and keeps the roster view for new fighters', () => {
    expect(select('src/fighters/watergirl/moves.ts')).toEqual([
      'idle',
      'redball-idle',
      'fluffy-idle',
      'css-2p',
    ]);
    expect(select('src/fighters/wheely/index.ts')).toEqual(['css-2p']);
  });

  it.each([[], ['src/render/renderer.ts'], ['src/fighters/redball/art/index.ts', 'src/sim/step.ts']])(
    'uses the full suite when the change is empty or shared: %j',
    (...files) => expect(select(...files)).toBeUndefined(),
  );
});
