import { Container } from 'pixi.js';
import { DamageCard } from './card';
import { CARD_TOP, CARD_W, cardSlots } from './style';
import type { HudPlayer } from './types';

/**
 * Smash Ultimate-style damage cards along the bottom of the 1280x720 screen for 2-4 players. `update` is a pure
 * function of the players and the frame (the shake and flash come from `hitFrame`); call it every rendered frame.
 */
export class Hud {
  readonly container = new Container({ label: 'hud' });
  private readonly cards = new Map<number, DamageCard>();

  update(players: HudPlayer[], frame: number): void {
    const slots = cardSlots(players.length);
    const live = new Set<number>();
    players.forEach((p, i) => {
      let card = this.cards.get(p.port);
      if (!card) {
        card = new DamageCard();
        this.cards.set(p.port, card);
        this.container.addChild(card.container);
      }
      card.container.position.set(Math.round(slots[i]! - CARD_W / 2), CARD_TOP);
      card.update(p, frame);
      live.add(p.port);
    });
    for (const [port, card] of this.cards) {
      if (live.has(port)) continue;
      card.container.destroy({ children: true });
      this.cards.delete(port);
    }
  }
}
