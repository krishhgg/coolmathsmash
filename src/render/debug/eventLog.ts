import { Container, Graphics, Text } from 'pixi.js';
import { VIEW_WIDTH } from '../../config';
import type { SimEvent } from '../../sim/events';

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
    case 'throw':
      return `${p(e.attacker)} ${e.move} ${p(e.victim)}`;
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
    default:
      return `${p(e.port)} ${e.type}`;
  }
}

/** Debug overlay: the latest sim events, one line each, newest at the bottom. */
export class EventLog {
  readonly container = new Container();
  private readonly lines: string[] = [];
  private readonly text = new Text({
    text: '',
    style: { fontFamily: 'monospace', fontSize: 12, fill: '#ffffff', lineHeight: 15 },
  });
  private dirty = false;

  constructor() {
    const bg = new Graphics()
      .roundRect(0, 0, WIDTH, LINES * 15 + 12, 8)
      .fill({ color: '#000000', alpha: 0.55 });
    this.container.position.set(VIEW_WIDTH - WIDTH - 16, 16);
    this.text.position.set(8, 6);
    this.container.addChild(bg, this.text);
  }

  record(events: readonly SimEvent[], frame: number): void {
    if (events.length === 0) return;
    for (const e of events) this.lines.push(`${String(frame).padStart(5)} ${describe(e)}`);
    this.lines.splice(0, Math.max(0, this.lines.length - LINES));
    this.dirty = true;
  }

  update(): void {
    if (!this.dirty) return;
    this.text.text = this.lines.join('\n');
    this.dirty = false;
  }
}
