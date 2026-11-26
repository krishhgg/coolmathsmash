import { Container, Graphics, Text } from 'pixi.js';
import { VIEW_WIDTH } from '../../config';
import type { SimEvent } from '../../sim/events';
import type { MatchState } from '../../sim/match';

const LINES = 16;
const WIDTH = 420;
const p = (port: number) => `P${port + 1}`;
const n = (v: number) => v.toFixed(1);

function describe(e: SimEvent): string {
  switch (e.type) {
    case 'hit':
      return `${p(e.attacker)} hit ${p(e.victim)} ${e.move ?? ''} +${n(e.damage)}% kb ${n(e.kb)}${e.tumble ? ' tumble' : ''}`;
    case 'shieldHit':
      return `${p(e.attacker)} hit ${p(e.victim)}'s shield ${e.move ?? ''} (${n(e.shieldHp)} left)`;
    case 'parry':
      return `${p(e.victim)} parried ${p(e.attacker)} ${e.move ?? ''}`;
    case 'ko':
      return `${p(e.port)} KO ${e.side}, ${e.stocks} left`;
    case 'jump':
      return `${p(e.port)} jump ${e.kind}`;
    case 'land':
      return `${p(e.port)} land lag ${e.lag}`;
    case 'move':
      return `${p(e.port)} ${e.move}`;
    case 'action':
      return `${p(e.port)} ${e.from} > ${e.to}`;
    case 'transform':
      return `${p(e.port)} transform ${e.from} > ${e.to}`;
    case 'grab':
    case 'commandGrab':
    case 'throw':
      return `${p(e.attacker)} ${e.move} ${p(e.victim)}`;
    case 'counter':
      return `${p(e.port)} counters ${p(e.attacker)} ${n(e.damage)}% > ${e.move}`;
    case 'pummel':
      return `${p(e.attacker)} pummel ${p(e.victim)} +${n(e.damage)}%`;
    case 'grabRelease':
      return `${p(e.held)} grab release`;
    case 'grabClank':
      return `${p(e.ports[0])} ${p(e.ports[1])} grab clank`;
    case 'stageHit':
      return `${p(e.victim)} hit by ${e.element ?? 'stage hitbox'} +${n(e.damage)}% kb ${n(e.kb)}`;
    case 'stagePiece':
      return `${e.piece} ${e.index} ${e.on ? 'appears' : 'vanishes'}`;
    case 'entitySpawn':
      return `${e.kind}#${e.id} spawn`;
    case 'entityDestroy':
      return `${e.kind}#${e.id} gone (${e.reason})`;
    case 'reflect':
      return `${p(e.port)} reflect ${e.kind}#${e.id}`;
    case 'absorb':
      return `${p(e.port)} absorb ${e.kind}#${e.id} -${n(e.heal)}%`;
    case 'entityHit':
      return `${e.kind}#${e.id} hit ${n(e.damage)} (${n(e.hp)} hp left)`;
    case 'tetherLatch':
      return `${p(e.port)} tether on ${e.kind}`;
    case 'tetherFighterHit':
      return `${p(e.port)} tether hit ${p(e.target)}`;
    default:
      return `${p(e.port)} ${e.type}`;
  }
}

/**
 * Debug overlay: the latest sim events, one line each, newest at the bottom. A new match (a different `state.config`,
 * as the renderer and MatchHud tell matches apart) starts the log empty.
 */
export class EventLog {
  readonly container = new Container();
  private readonly lines: string[] = [];
  private readonly text = new Text({
    text: '',
    style: { fontFamily: 'monospace', fontSize: 12, fill: '#ffffff', lineHeight: 15 },
  });
  private dirty = false;
  private config: unknown = null;

  constructor() {
    const bg = new Graphics()
      .roundRect(0, 0, WIDTH, LINES * 15 + 12, 8)
      .fill({ color: '#000000', alpha: 0.55 });
    this.container.position.set(VIEW_WIDTH - WIDTH - 16, 16);
    this.text.position.set(8, 6);
    this.container.addChild(bg, this.text);
  }

  /** The lines as drawn on the last update. */
  get shown(): string {
    return this.text.text;
  }

  /** Forget the last match's lines when `state` is from another one. */
  private sync(state: Pick<MatchState, 'config'>): void {
    if (this.config === state.config) return;
    this.config = state.config;
    this.lines.length = 0;
    this.dirty = true;
  }

  record(events: readonly SimEvent[], state: Pick<MatchState, 'config' | 'frame'>): void {
    this.sync(state);
    if (events.length === 0) return;
    for (const e of events) this.lines.push(`${String(state.frame).padStart(5)} ${describe(e)}`);
    this.lines.splice(0, Math.max(0, this.lines.length - LINES));
    this.dirty = true;
  }

  update(state: Pick<MatchState, 'config'>): void {
    this.sync(state);
    if (!this.dirty) return;
    this.text.text = this.lines.join('\n');
    this.dirty = false;
  }
}
