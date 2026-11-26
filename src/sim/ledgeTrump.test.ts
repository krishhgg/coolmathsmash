import { describe, expect, it } from 'vitest';
import { allFighters } from '../fighters/registry';
import { getStage } from '../stages/registry';
import { isIntangible } from './actions/registry';
import { LEDGE_TRUMP } from './constants';
import type { FighterState } from './fighter';
import { createMatch, type MatchState } from './match';
import ref from './reference/physics-constants.json';
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

/**
 * Mario at port `p` hangs from Battlefield's left ledge, 30 frames into the hang, and the other Mario catches it, which
 * trumps him. Returns both after the trump frame.
 */
function trumped(p: 0 | 1): { m: MatchState; f: FighterState; o: FighterState } {
  const m = createMatch({
    seed: 1,
    stage: 'battlefield',
    stocks: 3,
    ports: [{ fighter: marioReference.id }, { fighter: marioReference.id }],
  });
  runPorts(m, 10, []);
  const f = m.fighters[p]!;
  const o = m.fighters[1 - p]!;
  const at = { x: LEDGE.x - 3, y: LEDGE.y - 6 };
  Object.assign(f, { pos: at, prevPos: { ...at }, vel: { x: 0, y: 0 }, ground: null });
  Object.assign(f, { action: 'fall', actionFrame: 1, jumpsUsed: 1, facing: 1 });
  Object.assign(o, { pos: { x: 40, y: o.pos.y }, prevPos: { x: 40, y: o.pos.y } });
  for (let i = 0; i < 120 && f.action !== 'ledgeHang'; i++) runPorts(m, 1, []);
  runPorts(m, 30, []);
  expect(f.action).toBe('ledgeHang');
  catchNext(o);
  runPorts(m, 1, []);
  expect(o.action).toBe('ledgeCatch');
  return { m, f, o };
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
  it("uses Ultimate's params: 0.9 units a frame, 28 frames without control, 44 without a ledge", () => {
    expect(LEDGE_TRUMP.speedX).toBe(ref.ledge.trump.speed_x);
    expect(LEDGE_TRUMP.speedY).toBe(0);
    expect(LEDGE_TRUMP.noControl).toBe(ref.ledge.trump.no_control_frames);
    expect(LEDGE_TRUMP.regrabLock).toBe(ref.ledge.no_regrab_after_release_frames);
    expect(LEDGE_TRUMP.intangible).toBe(0);
  });

  it('a fighter catching a ledge another fighter hangs from pushes it straight out, with no intangibility', () => {
    const { f, o } = trumped(0);
    expect(o.ledge).toBe(LEFT);
    expect(f.action).toBe('trumped');
    expect(f.ledge).toBe(-1);
    expect(f.vel).toEqual({ x: LEDGE.side * LEDGE_TRUMP.speedX, y: LEDGE_TRUMP.speedY });
    expect(f.intangible).toBe(0);
    expect(isIntangible(f)).toBe(false);
    expect(f.ledgeLock).toBe(LEDGE_TRUMP.regrabLock);
    // It keeps its double jump, as after a drop.
    expect(f.jumpsUsed).toBe(1);
  });

  it.each([0, 1] as const)(
    'the trumped fighter (port %d) cannot act or drift for 28 frames, and acts on the 29th',
    (p) => {
      const { m, f } = trumped(p);
      const frames: number[] = [];
      const speeds: number[] = [];
      for (let i = 0; i < 40 && f.action === 'trumped'; i++) {
        if (f.actionFrame > 0) {
          frames.push(f.actionFrame);
          speeds.push(f.vel.x);
          expect(isIntangible(f)).toBe(false);
        }
        // Stick toward the stage and Jump pressed every other frame: none of it does anything until frame 29.
        const holds: Hold[] = [];
        holds[p] = { x: 100, buttons: i % 2 ? [] : ['jump'] };
        holds[1 - p] = {};
        runPorts(m, 1, holds);
      }
      expect(frames).toEqual(Array.from({ length: LEDGE_TRUMP.noControl }, (_, i) => i + 1));
      // The push slows by air friction only, as with the stick at rest.
      const friction = marioReference.stats.airFriction;
      speeds.forEach((v, i) => expect(v).toBeCloseTo(-(LEDGE_TRUMP.speedX - (i + 1) * friction), 9));
      expect(f.action).toBe('doubleJump');
    },
  );

  it('the trumped fighter catches no ledge until its 45th frame off it, and the catch gives no intangibility', () => {
    const { m, f, o } = trumped(0);
    // Hold it where it would catch the ledge, falling, until it does (trumping Mario back); frame 1 is its first
    // frame off the ledge. A drop's first frame off is its release frame, so both catch on the 45th.
    let caught = 0;
    for (let t = 1; t <= 60 && !caught; t++) {
      Object.assign(f, { pos: { x: LEDGE.x - 3, y: LEDGE.y - 6 }, vel: { x: 0, y: 0 } });
      f.prevPos = { ...f.pos };
      runPorts(m, 1, []);
      if (f.action.startsWith('ledge')) caught = t;
    }
    expect(caught).toBe(LEDGE_TRUMP.regrabLock + 1);
    expect(f.ledgeGrabs).toBe(2);
    expect(f.intangible).toBe(0);
    expect(o.action).toBe('trumped');
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
