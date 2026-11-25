import { Container, Graphics } from 'pixi.js';
import { motionOffset } from '../../../sim/movingStage';
import { PATROLS } from '../hazards';

const INK = 0x14132d;
const BLUE = 0x2346e5;
const LIGHT = 0x89a1ff;

export function createHazards() {
  const container = new Container({ label: 'worlds-hardest-game-hazards', visible: false });
  const dots = PATROLS.map(({ boxes }, i) => {
    const { radius } = boxes[0]!;
    return new Graphics({ label: `blue-patrol-${i}` })
      .circle(0, 0, radius)
      .fill(INK)
      .circle(0, 0, radius * 0.79)
      .fill(BLUE)
      .ellipse(-radius * 0.29, -radius * 0.34, radius * 0.23, radius * 0.13)
      .fill(LIGHT);
  });
  container.addChild(...dots);

  return {
    container,
    update(frame: number, alpha: number, enabled: boolean) {
      container.visible = enabled;
      if (!enabled) return;

      const previous = Math.max(0, frame - 1);
      for (const [index, patrol] of PATROLS.entries()) {
        const [px, py] = motionOffset(patrol.motion, previous);
        const [x, y] = motionOffset(patrol.motion, frame);
        dots[index]!.position.set(patrol.x + px + (x - px) * alpha, -patrol.y - py - (y - py) * alpha);
      }
    },
  };
}
