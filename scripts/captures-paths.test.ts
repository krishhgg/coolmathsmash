import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
const workflow = readFileSync(new URL('../.github/workflows/captures.yml', import.meta.url), 'utf8');

describe('captures.yml path filter', () => {
  it('covers new fighters and stages without naming or excluding folders individually', () => {
    expect(workflow).toContain("- 'src/**'");
    for (const line of workflow.split('\n')) {
      const rule = line.trim();
      expect(rule, `${rule} restricts fighter or stage changes`).not.toMatch(
        /^-\s*['"]?!?src\/(fighters|stages)\//,
      );
    }
  });
});
