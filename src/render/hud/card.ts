import { ColorMatrixFilter, Container, FillGradient, Graphics, Text, TextStyle } from 'pixi.js';
import { hudFontFamily } from './font';
import { iconView } from './icon';
import { brighten, damageColor, formatDamage, hitEffect, slotColor } from './style';
import type { HudPlayer } from './types';

const INK = 0x15110c;
const PORTRAIT = { x: 50, y: 64, size: 90, tilt: -0.12 } as const;
const NUMBER = { right: 254, base: 98 } as const;
const BAR = { left: 64, right: 260, top: 106, bottom: 125, slant: 6 } as const;
const PORT_LABEL_X = 102;
const STOCK_Y = 139;
const STOCK_SIZE = 24;

/** The squares `iconView` fits a fighter's icon into on the card: the portrait and each stock. */
export const ICON_SIZES = { portrait: PORTRAIT.size * 0.94, stock: STOCK_SIZE } as const;

function mixColor(a: number, b: number, t: number): number {
  let out = 0;
  for (const shift of [16, 8, 0]) {
    const ca = (a >> shift) & 255;
    const cb = (b >> shift) & 255;
    out |= Math.round(ca + (cb - ca) * t) << shift;
  }
  return out;
}

const numberFill = new FillGradient({
  type: 'linear',
  start: { x: 0, y: 0 },
  end: { x: 0, y: 1 },
  colorStops: [
    { offset: 0, color: 0xffffff },
    { offset: 0.55, color: 0xf4f4f4 },
    { offset: 1, color: 0xbdbdbd },
  ],
  textureSpace: 'local',
});

function numberStyle(size: number, letterSpacing: number): TextStyle {
  return new TextStyle({
    fontFamily: hudFontFamily(),
    fontSize: size,
    fill: numberFill,
    letterSpacing,
    stroke: { color: INK, width: size * 0.13, join: 'round' },
    dropShadow: {
      color: 0x000000,
      alpha: 0.55,
      angle: Math.PI / 2,
      blur: 0,
      distance: Math.max(2, size * 0.06),
    },
    padding: 6,
  });
}

function labelStyle(size: number, stroke: number): TextStyle {
  return new TextStyle({
    fontFamily: hudFontFamily(),
    fontSize: size,
    fill: 0xffffff,
    letterSpacing: 0.6,
    stroke: stroke > 0 ? { color: INK, width: stroke, join: 'round' } : undefined,
  });
}

/**
 * One player's damage card, Ultimate layout in Flash dress: tilted port-coloured portrait, big italic damage with
 * a smaller tenth, port stripe over the name bar, and stock icons. Rebuilds pieces only when their inputs change;
 * everything that moves is a pure function of the frame and the player's hitFrame.
 */
export class DamageCard {
  readonly container = new Container({ label: 'damage-card' });
  private readonly portrait = new Container({ label: 'portrait' });
  private readonly emblem = new Graphics({ label: 'emblem' });
  private readonly burst = new Graphics({ label: 'burst' });
  private readonly number = new Container({ label: 'damage' });
  private readonly whole = new Text({ text: '0', style: numberStyle(64, -1), anchor: { x: 1, y: 1 } });
  private readonly tenth = new Text({ text: '.0%', style: numberStyle(30, 0), anchor: { x: 1, y: 1 } });
  private readonly bar = new Graphics({ label: 'name-bar' });
  private readonly nameText = new Text({ text: '', style: labelStyle(17, 0), anchor: { x: 1, y: 0.5 } });
  private readonly portText = new Text({ text: '', style: labelStyle(15, 3), anchor: { x: 0, y: 0.5 } });
  private readonly stocks = new Container({ label: 'stocks' });
  private readonly grey = new ColorMatrixFilter();
  private fonts = '';
  private shown = {
    port: -1,
    cpu: false,
    icon: '\0',
    name: '\0',
    damage: NaN,
    stocks: -1,
    maxStocks: -1,
    eliminated: false,
  };

  constructor() {
    this.grey.desaturate();
    this.burst.star(0, 0, 14, 72, 34).fill({ color: 0xfff2a0 });
    this.burst.star(0, 0, 14, 50, 22, 0.22).fill({ color: 0xffffff });
    this.number.addChild(this.whole, this.tenth);
    this.number.pivot.set(-72, -26);
    this.number.skew.set(-0.2, 0);
    this.container.addChild(
      this.emblem,
      this.burst,
      this.bar,
      this.portrait,
      this.number,
      this.nameText,
      this.portText,
      this.stocks,
    );
    this.nameText.position.set(BAR.right - BAR.slant - 8, (BAR.top + BAR.bottom) / 2 + 1);
    this.portText.position.set(PORT_LABEL_X, (BAR.top + BAR.bottom) / 2 + 1);
  }

  /** `faded` drops the card to 40% while a fighter is behind it, like Ultimate. */
  update(p: HudPlayer, frame: number, faded = false): void {
    const s = this.shown;
    const family = hudFontFamily();
    if (family.join() !== this.fonts) {
      this.fonts = family.join();
      for (const t of [this.whole, this.tenth, this.nameText, this.portText]) t.style.fontFamily = family;
      s.name = '\0';
      s.damage = NaN;
    }
    const cpu = p.cpu ?? false;
    if (p.port !== s.port || (p.icon ?? '') !== s.icon || cpu !== s.cpu) {
      this.drawPortrait(p);
      this.drawEmblem(slotColor(p.port, cpu));
      this.drawBar(slotColor(p.port, cpu));
    }
    if (p.name !== s.name || p.port !== s.port || cpu !== s.cpu) {
      this.nameText.text = p.name.toUpperCase();
      const room = BAR.right - PORT_LABEL_X - 44;
      this.nameText.scale.set(1);
      if (this.nameText.width > room) this.nameText.scale.set(room / this.nameText.width);
      this.portText.text = cpu ? 'CPU' : `P${p.port + 1}`;
      this.portText.style.fill = slotColor(p.port, cpu);
    }
    if (p.damage !== s.damage) {
      const { whole, tenth } = formatDamage(p.damage);
      this.whole.text = whole;
      this.tenth.text = tenth;
      this.whole.scale.set(whole.length >= 3 ? 0.94 : 1);
      this.tenth.position.set(0, -2);
      this.whole.position.set(-this.tenth.width + 10, 3);
    }
    if (
      p.stocks !== s.stocks ||
      p.maxStocks !== s.maxStocks ||
      p.eliminated !== s.eliminated ||
      (p.icon ?? '') !== s.icon ||
      p.port !== s.port
    )
      this.drawStocks(p);
    if (p.eliminated !== s.eliminated || s.port === -1) {
      this.container.filters = p.eliminated ? [this.grey] : [];
      this.number.visible = !p.eliminated;
    }
    Object.assign(s, {
      port: p.port,
      cpu,
      icon: p.icon ?? '',
      name: p.name,
      damage: p.damage,
      stocks: p.stocks,
      maxStocks: p.maxStocks,
      eliminated: p.eliminated,
    });
    this.container.alpha = (p.eliminated ? 0.55 : 1) * (faded ? 0.4 : 1);

    const fx = p.eliminated ? hitEffect(0, -1, p.port) : hitEffect(frame, p.hitFrame, p.port);
    const color = brighten(damageColor(p.damage), fx.flash * 0.35);
    this.whole.tint = color;
    this.tenth.tint = color;
    this.number.position.set(NUMBER.right - 72 + fx.dx, NUMBER.base - 26 + fx.dy);
    this.number.scale.set(fx.scale);
    this.burst.visible = fx.burst >= 0;
    if (fx.burst >= 0) {
      this.burst.position.set(NUMBER.right - 96 + fx.dx, NUMBER.base - 30 + fx.dy);
      this.burst.scale.set(0.55 + fx.burst * 0.85);
      this.burst.alpha = 0.95 * (1 - fx.burst) ** 1.5;
      this.burst.rotation = fx.burst * 0.5;
    }
    this.portrait.position.set(PORTRAIT.x + fx.dx * 0.35, PORTRAIT.y + fx.dy * 0.35);
  }

  private drawPortrait(p: HudPlayer): void {
    for (const child of this.portrait.removeChildren()) child.destroy({ children: true });
    const color = slotColor(p.port, p.cpu);
    const half = PORTRAIT.size / 2;
    const frame = new Graphics();
    frame.roundRect(-half - 2, -half - 2, PORTRAIT.size + 4, PORTRAIT.size + 4, 12).fill(INK);
    frame.roundRect(-half, -half, PORTRAIT.size, PORTRAIT.size, 11).fill(
      new FillGradient({
        type: 'linear',
        start: { x: 0, y: 0 },
        end: { x: 0, y: 1 },
        colorStops: [
          { offset: 0, color: mixColor(color, 0xffffff, 0.16) },
          { offset: 0.6, color: mixColor(color, 0x000000, 0.08) },
          { offset: 1, color: mixColor(color, 0x000000, 0.28) },
        ],
        textureSpace: 'local',
      }),
    );
    const inside = new Container();
    const mask = new Graphics().roundRect(-half, -half, PORTRAIT.size, PORTRAIT.size, 11).fill(0xffffff);
    const rays = new Graphics();
    for (let i = 0; i < 14; i++) {
      const a0 = (i / 14) * Math.PI * 2;
      const a1 = a0 + Math.PI / 14;
      rays.poly([0, 0, Math.cos(a0) * 90, Math.sin(a0) * 90, Math.cos(a1) * 90, Math.sin(a1) * 90]).fill({
        color: 0xffffff,
        alpha: 0.08,
      });
    }
    rays.position.set(0, 10);
    const head = iconView(p.icon, ICON_SIZES.portrait);
    head.position.set(0, 5);
    const gloss = new Graphics()
      .ellipse(-8, -half + 9, half * 0.95, 18)
      .fill({ color: 0xffffff, alpha: 0.08 });
    inside.addChild(rays, head, gloss);
    inside.mask = mask;
    this.portrait.addChild(frame, inside, mask);
    this.portrait.rotation = PORTRAIT.tilt;
  }

  /** The Coolmath planet in port colour behind the number, where Ultimate shows the series symbol. */
  private drawEmblem(color: number): void {
    const g = this.emblem.clear();
    const cx = 206;
    const cy = 42;
    const tilt = -0.28;
    const ring = (from: number, to: number) => {
      for (let i = 0; i <= 32; i++) {
        const t = from + ((to - from) * i) / 32;
        const ex = Math.cos(t) * 44;
        const ey = Math.sin(t) * 11;
        const x = cx + ex * Math.cos(tilt) - ey * Math.sin(tilt);
        const y = cy + ex * Math.sin(tilt) + ey * Math.cos(tilt);
        if (i === 0) g.moveTo(x, y);
        else g.lineTo(x, y);
      }
    };
    const dark = mixColor(color, 0x000000, 0.45);
    ring(Math.PI, Math.PI * 2);
    g.stroke({ width: 9, color: dark, cap: 'round' });
    ring(Math.PI, Math.PI * 2);
    g.stroke({ width: 5, color, cap: 'round' });
    g.circle(cx, cy, 27).fill(dark);
    g.circle(cx, cy, 24).fill(color);
    g.ellipse(cx + 8, cy - 10, 10, 6).fill({ color: 0xffffff, alpha: 0.35 });
    ring(0, Math.PI);
    g.stroke({ width: 9, color: dark, cap: 'round' });
    ring(0, Math.PI);
    g.stroke({ width: 5, color, cap: 'round' });
    g.alpha = 0.5;
  }

  /** Dark slanted name bar with the port stripe along its top edge, as in Ultimate. */
  private drawBar(color: number): void {
    const g = this.bar.clear();
    const { left, right, top, bottom, slant } = BAR;
    g.poly([left + slant, top, right, top, right - slant, bottom, left, bottom]).fill({
      color: 0x15151c,
      alpha: 0.88,
    });
    g.poly([left + slant + 1, top - 4, right + 1, top - 4, right, top, left + slant, top]).fill(color);
  }

  private drawStocks(p: HudPlayer): void {
    for (const child of this.stocks.removeChildren()) child.destroy({ children: true });
    const left = PORT_LABEL_X - 2 + STOCK_SIZE / 2;
    const remaining = p.eliminated ? 0 : Math.max(0, p.stocks);
    if (p.maxStocks > 5) {
      const icon = iconView(p.icon, ICON_SIZES.stock);
      icon.position.set(left, STOCK_Y);
      const count = new Text({ text: `× ${remaining}`, style: labelStyle(17, 3), anchor: { x: 0, y: 0.5 } });
      count.position.set(left + STOCK_SIZE / 2 + 4, STOCK_Y);
      this.stocks.addChild(icon, count);
      return;
    }
    for (let i = 0; i < Math.max(p.maxStocks, remaining); i++) {
      const icon = iconView(p.icon, ICON_SIZES.stock);
      icon.position.set(left + i * (STOCK_SIZE + 2), STOCK_Y);
      if (i >= remaining) {
        icon.alpha = 0.2;
        icon.tint = 0x202020;
      }
      this.stocks.addChild(icon);
    }
  }
}
