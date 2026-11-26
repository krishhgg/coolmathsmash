import { describe, expect, it } from 'vitest';
import { allFighters } from '../fighters/registry';
import { getStage } from '../stages/registry';
import type { FighterState } from './fighter';
import { createMatch, type MatchState } from './match';
import { marioReference } from './testing/reference';
import { runPorts, type Hold } from './testing/sim';

const LEDGES = getStage('battlefield').ledges;
const LEFT = LEDGES.findIndex((l) => l.side === -1);
const LEDGE = LEDGES[LEFT]!;

/** `fighter` (port 0) hangs from Battlefield's left ledge, 30 frames into the hang; Mario (port 1) stands far off. */
function hanging(fighter: string): { m: MatchState; f: FighterState; o: FighterState } {
  const m = createMatch({
    seed: 1,
    stage: 'battlefield',
    stocks: 3,
    ports: [{ fighter }, { fighter: marioReference.id }],
  });
  runPorts(m, 10, []);
  const [f, o] = m.fighters as [FighterState, FighterState];
  const at = { x: LEDGE.x - 3, y: LEDGE.y - 6 };
  Object.assign(f, { pos: at, prevPos: { ...at }, vel: { x: 0, y: 0 }, ground: null });
  Object.assign(f, { action: 'fall', actionFrame: 1, jumpsUsed: 1, facing: 1 });
  Object.assign(o, { pos: { x: 40, y: o.pos.y }, prevPos: { x: 40, y: o.pos.y } });
  for (let i = 0; i < 120 && f.action !== 'ledgeHang'; i++) runPorts(m, 1, []);
  expect(f.action, fighter).toBe('ledgeHang');
  runPorts(m, 30, []);
  return { m, f, o };
}

/** Put `o` falling just outside the left ledge, where it catches the ledge on the next frame. */
function catchNext(o: FighterState): void {
  const p = { x: LEDGE.x - 2, y: LEDGE.y - marioReference.stats.height * 0.7 };
  Object.assign(o, { pos: p, prevPos: { ...p }, vel: { x: 0, y: 0 }, ground: null });
  Object.assign(o, { action: 'fall', actionFrame: 1, jumpsUsed: 2, facing: 1, ledgeLock: 0 });
}

/**
 * `fighter` starts a getup with `start` from the hang; with `caught`, Mario catches the ledge on the getup's next
 * frame. Returns where `fighter` is and what it does on each of the next 40 frames, and what Mario does at the end.
 */
function getup(fighter: string, start: Hold, caught: boolean): { path: string[]; mario: string } {
  const { m, f, o } = hanging(fighter);
  runPorts(m, 1, [start]);
  if (caught) catchNext(o);
  const path: string[] = [];
  for (let i = 0; i < 40; i++) {
    runPorts(m, 1, []);
    path.push(`${f.action} ${f.actionFrame} ${f.pos.x.toFixed(3)} ${f.pos.y.toFixed(3)}`);
  }
  return { path, mario: o.action };
}

const FIGHTERS = Object.values(allFighters())
  .filter((d) => d.selectable !== false)
  .map((d) => d.id);

const GETUPS: [string, Hold][] = [
  ['jump', { buttons: ['jump'] }],
  ['climb', { x: 50 }],
  ['roll', { buttons: ['shield'] }],
  ['attack', { buttons: ['attack'] }],
];

describe('ledge trumps', () => {
  it('a fighter catching a ledge another fighter hangs from pushes it off', () => {
    const { m, f, o } = hanging(marioReference.id);
    catchNext(o);
    runPorts(m, 1, []);
    expect(o.action).toBe('ledgeCatch');
    expect(o.ledge).toBe(LEFT);
    expect(f.action).toBe('fall');
    expect(f.ledge).toBe(-1);
  });

  // A getup that has started has let go of the ledge (SmashWiki "Edgeguarding": a getup buffered out of the catch
  // escapes the trump). Ours still holds `ledge` until it leaves the corner, and before this a catch then pushed the
  // fighter off: Wheely's ledge jump turned into a fall under the ledge.
  describe.each(GETUPS)('a ledge %s under way', (name, start) => {
    it.each(FIGHTERS)('plays out the same for %s when another fighter catches the ledge', (fighter) => {
      const alone = getup(fighter, start, false);
      const caught = getup(fighter, start, true);
      expect(alone.path[0], name).toMatch(/^ledge/);
      expect(caught.path).toEqual(alone.path);
      expect(caught.mario).toMatch(/^ledge(Catch|Hang)$/);
    });
  });
});
