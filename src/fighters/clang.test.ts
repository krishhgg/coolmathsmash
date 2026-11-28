import { describe, expect, it } from 'vitest';
import './registry';
import { entityDef } from '../sim/entities/entities';
import { moveDef } from '../sim/sharedMoves';
import { allFighters, getFighter } from './lookup';
import type { HitboxDef, MoveDef } from './types';

/**
 * Which hitboxes can't clank (HitboxDef.transcendent), and which projectiles can't be absorbed, following each move's
 * Ultimate reference in SmashWiki's hitbox tables (`clang=f`; `absorbable` unset means not absorbable). Rebound isn't
 * modelled, so it isn't checked.
 */

const boxes = (move: MoveDef): HitboxDef[] => move.hits.flatMap((w) => w.boxes);
const move = (fighter: string, name: string): MoveDef => {
  const m = moveDef(getFighter(fighter), name);
  if (!m) throw new Error(`${fighter} has no ${name}`);
  return m;
};
const cantClank = (b: HitboxDef) => b.transcendent === true;

describe("hitboxes that can't clank, as their Ultimate references can't", () => {
  it("every fighter's getup attack and ledge attack: every Ultimate fighter's floor and edge attacks are clang=f", () => {
    for (const def of Object.values(allFighters())) {
      for (const name of ['getupAttack', 'ledgeAttack']) {
        const m = moveDef(def, name);
        expect(m, `${def.id} ${name}`).toBeDefined();
        for (const b of boxes(m!)) expect(cantClank(b), `${def.id} ${name} box ${b.id}`).toBe(true);
      }
    }
  });

  /** [fighter, move, reference (SmashWiki page and rows), which boxes can't clank: all, or a test on each box]. */
  const cases: [string, string, string, 'all' | ((b: HitboxDef, window: number) => boolean)][] = [
    ['runner', 'finalSmash', 'Peach (SSBU)/Final Smash: every row', 'all'],
    ['fireboy', 'sideB', 'Mario (SSBU)/Side special (Cape): every row', 'all'],
    ['watergirl', 'sideB', 'Mario (SSBU)/Side special (Cape): every row', 'all'],
    ['runner', 'downB', 'Kirby (SSBU)/Down special (Stone): landing', 'all'],
    ['runner', 'downBAir', 'Kirby (SSBU)/Down special (Stone): falling', 'all'],
    ['snailbob', 'downB', 'Bowser (SSBU)/Down special: Start only, not the fall', (_, w) => w === 0],
    ['snailbob', 'downBAir', 'Bowser (SSBU)/Down special: the fall clangs', () => false],
    ['wheely', 'sideB', 'Wario (SSBU)/Side special: Riding', 'all'],
    ['wheely', 'upB', 'Steve (SSBU)/Up special: clean and late', 'all'],
    ['raftwars', 'upB', 'Snake (SSBU)/Side special (Remote Missile): every row', 'all'],
    ['fireboy', 'fsmash', 'Mario (SSBU)/Forward smash: the flame sweetspot, not the arm', (b) => b.id === 0],
    [
      'watergirl',
      'fsmash',
      'Mario (SSBU)/Forward smash: the flame sweetspot, not the arm',
      (b) => b.id === 0,
    ],
    [
      'papa-louie',
      'fsmash',
      'Mario (SSBU)/Forward smash: the flame sweetspot, not the arm',
      (b) => b.id === 0,
    ],
    ['wheely', 'fsmash', 'Mario (SSBU)/Forward smash: the flame sweetspot, not the arm', (b) => b.id === 0],
    ['bob-the-robber', 'usmash', 'Young Link (SSBU)/Up smash: Hit 3, the finisher', (_, w) => w === 4],
    ['snailbob', 'usmash', 'R.O.B. (SSBU)/Up smash: Hit 2', 'all'],
    ['snailbob', 'bair', 'R.O.B. (SSBU)/Back aerial: every row', 'all'],
    ['snailbob', 'dairLand', "Toon Link (SSBU)/Down aerial: the landing's 5% slash", 'all'],
    ['runner', 'jabRapid', 'Kirby (SSBU)/Neutral attack/Infinite: rapid jab and finisher', 'all'],
    ['runner', 'dashAttack', 'Kirby (SSBU)/Dash attack: every row', 'all'],
  ];

  it.each(cases)('%s %s (%s)', (fighter, name, _ref, which) => {
    const m = move(fighter, name);
    m.hits.forEach((w, i) => {
      for (const b of w.boxes) {
        const expected = which === 'all' || which(b, i);
        expect(cantClank(b), `window ${i} box ${b.id}`).toBe(expected);
      }
    });
  });
});

describe("projectiles that reflect but can't be absorbed, as their Ultimate references", () => {
  it("Raft Wars' slingshot shots, Villager's slingshot (Forward and Back aerial: reflectable, absorbable unset)", () => {
    for (const kind of ['raftwars/airShot', 'raftwars/recoilShot']) {
      expect(entityDef(kind).reflectable, kind).toBeUndefined();
      expect(entityDef(kind).absorbable, kind).toBe(false);
    }
  });
});
