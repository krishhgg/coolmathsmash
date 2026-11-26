import { describe, expect, it } from 'vitest';
// Keep this import before Bob's own modules: the harness loads his scenarios.ts before the fighter registry, as it
// does in Node scripts, so a scenarios.ts that imports his moves leaves him registered without them.
import { planScenario, type GameScenario } from '../../harness/scenarios';
import { scenarios } from './scenarios';

describe("Bob the Robber's game scenarios", () => {
  const games = (scenarios.extra ?? []).filter((s): s is GameScenario => s.page.kind === 'game');

  it.each(games.map((s) => [s.name, s] as const))('%s plays its move and reaches its capture', (_, s) => {
    const plan = planScenario(s);
    expect(plan.status, plan.reason).toBe('captured');
  });
});
