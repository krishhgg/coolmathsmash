import { Container } from 'pixi.js';
import { DamageCard } from './card';
import { CARD_H, CARD_SCALE, CARD_TOP, CARD_W, cardSlots } from './style';
import type { HudPlayer } from './types';

/** Screen-space point of something the HUD should get out of the way of (a fighter's centre). */
export interface HudOccluder {
  x: number;
  y: number;
}

/**
 * Smash Ultimate-style damage cards along the bottom of the 1280x720 screen for 2-4 players. `update` is a pure
 * function of its arguments (the shake and flash come from `hitFrame`); call it every rendered frame. Pass the
 * fighters' screen positions as `occluders` to fade a card while someone is behind it.
 */
export class Hud {
  readonly container = new Container({ label: 'hud' });
  private readonly cards = new Map<number, DamageCard>();

  update(players: HudPlayer[], frame: number, occluders: readonly HudOccluder[] = []): void {
    const slots = cardSlots(players.length);
    const w = CARD_W * CARD_SCALE;
    const h = CARD_H * CARD_SCALE;
    const live = new Set<number>();
    players.forEach((p, i) => {
      let card = this.cards.get(p.port);
      if (!card) {
        card = new DamageCard();
        card.container.scale.set(CARD_SCALE);
        this.cards.set(p.port, card);
        this.container.addChild(card.container);
      }
      const x = Math.round(slots[i]! - w / 2);
      card.container.position.set(x, CARD_TOP);
      const faded = occluders.some((o) => o.x >= x && o.x <= x + w && o.y >= CARD_TOP && o.y <= CARD_TOP + h);
      card.update(p, frame, faded);
      live.add(p.port);
    });
    for (const [port, card] of this.cards) {
      if (live.has(port)) continue;
      card.container.destroy({ children: true });
      this.cards.delete(port);
    }
  }
}
