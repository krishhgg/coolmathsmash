import type { ScenarioInfo } from '../../src/harness/scenarios.ts';
import type { MatchConfig } from '../../src/sim/match.ts';

export const matchesScenario = (name: string, pattern: string): boolean =>
  pattern.endsWith('*') ? name.startsWith(pattern.slice(0, -1)) : name === pattern;

export function scopeCaptures(
  scenarios: ScenarioInfo[],
  files: string[],
  defaults: Pick<MatchConfig, 'ports' | 'stage'>,
): ScenarioInfo[] | undefined {
  const fighters = new Set<string>();
  const stages = new Set<string>();
  for (const file of files) {
    if (/^docs\/|^(?:AGENTS|README)\.md$|^src\/.*\.test\.ts$/.test(file)) continue;
    const match = /^src\/(fighters|stages)\/([a-z0-9-]+)\/.+$/.exec(file);
    if (!match) return undefined;
    (match[1] === 'fighters' ? fighters : stages).add(match[2]!);
  }
  if (!fighters.size && !stages.size) return undefined;

  for (const [a, b] of [
    ['fireboy', 'watergirl'],
    ['bloxorz', 'bloxorz-lying'],
  ] as const) {
    if (fighters.has(a) || fighters.has(b)) {
      fighters.add(a);
      fighters.add(b);
    }
  }
  const patterns = [...fighters, ...stages].map((id) => `${id}-*`);
  return scenarios.filter((s) => {
    if (patterns.some((pattern) => matchesScenario(s.name, pattern))) return true;
    if ('capture' in s) {
      return (
        stages.has(s.match?.stage ?? defaults.stage) ||
        (s.match?.ports ?? defaults.ports).some(({ fighter }) => fighters.has(fighter)) ||
        s.patches?.some(({ state }) => state.fighter !== undefined && fighters.has(state.fighter))
      );
    }
    const { scene, params } = s.page;
    if (scene === 'menu') {
      return (
        (params?.screen === 'css' && fighters.size > 0) ||
        (params?.screen === 'stages' && stages.size > 0)
      );
    }
    if (scene === 'fighter') return params?.fighter ? fighters.has(params.fighter) : fighters.size > 0;
    if (scene === 'stage') return params?.stage ? stages.has(params.stage) : stages.size > 0;
    return true;
  });
}
