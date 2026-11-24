import { Container, Graphics, Text } from 'pixi.js';
import { hudFontFamily } from './font';
import { CPU_COLOR, portColor, SCREEN_H, SCREEN_W } from './style';

/** One fighter's overhead tag target, in screen pixels. */
export interface TagTarget {
  port: number;
  cpu: boolean;
  /** The point just above the fighter's head. */
  x: number;
  y: number;
  visible: boolean;
}

export type TagSide = 'down' | 'up' | 'left' | 'right';

export const TAG_H = 22;
export const POINTER = 7;
const MARGIN = 6;

export const tagLabel = (port: number, cpu: boolean) => (cpu ? 'CPU' : `P${port + 1}`);
export const tagWidth = (label: string) => (label.length > 2 ? 50 : 38);

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/**
 * The pill's centre for a head at (x, y) and the side its pointer is on. On screen the tag sits above the head with
 * the pointer down; when that would leave the screen the pill is clamped inside the edge and the pointer turns
 * toward the fighter.
 */
export function placeTag(x: number, y: number, w: number): { x: number; y: number; side: TagSide } {
  const cx = x;
  const cy = y - POINTER - TAG_H / 2;
  const minX = MARGIN + w / 2;
  const maxX = SCREEN_W - MARGIN - w / 2;
  const minY = MARGIN + TAG_H / 2;
  const maxY = SCREEN_H - MARGIN - TAG_H / 2;
  let px = clamp(cx, minX, maxX);
  let py = clamp(cy, minY, maxY);
  if (px === cx && py === cy) return { x: px, y: py, side: 'down' };
  const dx = x - px;
  const dy = y - py;
  const side: TagSide = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : dy < 0 ? 'up' : 'down';
  if (side === 'left') px = Math.max(px, minX + POINTER);
  if (side === 'right') px = Math.min(px, maxX - POINTER);
  if (side === 'up') py = Math.max(py, minY + POINTER);
  if (side === 'down') py = Math.min(py, maxY - POINTER);
  return { x: px, y: py, side };
}

class Tag {
  readonly container = new Container();
  private readonly shape = new Graphics();
  private readonly text = new Text({
    text: '',
    style: {
      fontFamily: hudFontFamily(),
      fontSize: 16,
      fill: 0xffffff,
      stroke: { color: 0x000000, width: 3, alpha: 0.35 },
    },
  });
  private key = '';

  constructor() {
    this.text.anchor.set(0.5, 0.52);
    this.container.addChild(this.shape, this.text);
  }

  draw(label: string, color: number, side: TagSide): void {
    const family = hudFontFamily();
    const key = `${label}|${color}|${side}|${family.join()}`;
    if (key === this.key) return;
    this.key = key;
    this.text.text = label;
    this.text.style.fontFamily = family;
    const w = tagWidth(label);
    const edge = side === 'down' || side === 'up' ? TAG_H / 2 : w / 2;
    const flip = side === 'up' || side === 'left' ? -1 : 1;
    const at = (along: number, across: number): [number, number] =>
      side === 'down' || side === 'up' ? [across, along * flip] : [along * flip, across];
    const [ax, ay] = at(edge - 2, -5);
    const [tx, ty] = at(edge + POINTER, 0);
    const [bx, by] = at(edge - 2, 5);
    this.shape
      .clear()
      .roundRect(-w / 2, -TAG_H / 2, w, TAG_H, TAG_H / 2)
      .fill(color)
      .stroke({ color: 0x000000, width: 2 })
      .poly([ax, ay, tx, ty, bx, by])
      .fill(color)
      .moveTo(ax, ay)
      .lineTo(tx, ty)
      .lineTo(bx, by)
      .stroke({ color: 0x000000, width: 2, join: 'round' });
  }
}

/** "P1" / "CPU" pills over each fighter, in the port colour (CPUs grey), kept on screen when a fighter leaves it. */
export class OverheadTags {
  readonly container = new Container();
  private readonly tags: Tag[] = [];

  update(targets: readonly TagTarget[]): void {
    while (this.tags.length < targets.length) {
      const tag = new Tag();
      this.tags.push(tag);
      this.container.addChild(tag.container);
    }
    this.tags.forEach((tag, i) => {
      const t = targets[i];
      tag.container.visible = !!t?.visible;
      if (!t?.visible) return;
      const label = tagLabel(t.port, t.cpu);
      const at = placeTag(t.x, t.y, tagWidth(label));
      tag.draw(label, t.cpu ? CPU_COLOR : portColor(t.port), at.side);
      tag.container.position.set(Math.round(at.x), Math.round(at.y));
    });
  }
}
