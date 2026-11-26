import { describe, expect, it } from 'vitest';
import type { SimEvent } from '../../sim/events';
import { DEFAULT_MATCH, createMatch } from '../../sim/match';
import { EventLog } from './eventLog';

const jump = (port: number): SimEvent => ({ type: 'jump', port, kind: 'full' });

describe('EventLog', () => {
  it('shows the latest events, newest at the bottom', () => {
    const m = createMatch(DEFAULT_MATCH);
    const log = new EventLog();
    log.record([jump(0)], { config: m.config, frame: 10 });
    log.record([jump(1)], { config: m.config, frame: 12 });
    log.update(m);
    expect(log.shown).toBe('   10 P1 jump full\n   12 P2 jump full');
  });

  it("names a stage hazard's blocked or parried hit, which credits no port", () => {
    const m = createMatch(DEFAULT_MATCH);
    const log = new EventLog();
    const hazard = { attacker: -1, victim: 0, move: null, x: -44, y: 0 };
    log.record([{ type: 'shieldHit', ...hazard, damage: 12, shieldHp: 34.8 }], {
      config: m.config,
      frame: 16,
    });
    log.record([{ type: 'parry', ...hazard }], { config: m.config, frame: 40 });
    log.update(m);
    expect(log.shown).toBe("   16 stage hazard hit P1's shield  (34.8 left)\n   40 P1 parried stage hazard ");
  });

  it('starts empty when a new match starts, even with the same settings', () => {
    const log = new EventLog();
    const first = createMatch(DEFAULT_MATCH);
    log.record([jump(0)], { config: first.config, frame: 30 });
    log.update(first);
    expect(log.shown).toContain('P1 jump');

    const second = createMatch(DEFAULT_MATCH);
    log.update(second);
    expect(log.shown).toBe('');

    log.record([jump(1)], { config: second.config, frame: 5 });
    log.update(second);
    expect(log.shown).toBe('    5 P2 jump full');
  });

  it('keeps the new match events recorded before it was first drawn', () => {
    const log = new EventLog();
    const first = createMatch(DEFAULT_MATCH);
    log.record([jump(0)], { config: first.config, frame: 30 });
    log.update(first);

    const second = createMatch(DEFAULT_MATCH);
    log.record([], { config: second.config, frame: 1 });
    log.record([jump(1)], { config: second.config, frame: 60 });
    log.update(second);
    expect(log.shown).toBe('   60 P2 jump full');
  });
});
