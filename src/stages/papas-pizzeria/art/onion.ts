import { Container, Graphics } from 'pixi.js';
import { motionOffset, scheduledOn } from '../../../sim/movingStage';
import { ONION_ENTRY, ONION_PERIOD, ONION_WARNING, rollingOnion } from '../hazards';
import { stage } from '../geometry';

export function createOnion() {
  const container = new Container({ label: 'onion-hazard' });
  const onion = new Graphics({ label: 'rolling-onion' });
  onion
    .moveTo(0.2, -3.6)
    .bezierCurveTo(-0.85, -4.4, -2.1, -4.6, -2.2, -6.4)
    .quadraticCurveTo(-0.56, -5.8, 0.14, -4.5)
    .quadraticCurveTo(0.4, -6.1, 2.2, -6.5)
    .quadraticCurveTo(2.03, -5.2, 1.5, -4.3)
    .lineTo(1.28, -3.45)
    .closePath()
    .fill(0x779144)
    .stroke({ width: 0.38, color: 0x333528, join: 'round' })
    .moveTo(0.05, -4.15)
    .bezierCurveTo(1.5, -4.75, 4.15, -2.4, 4.25, 0.55)
    .bezierCurveTo(4.48, 3.08, 2.44, 4.13, -0.17, 4.15)
    .bezierCurveTo(-3.2, 4.13, -4.32, 2.7, -4.14, 0.32)
    .bezierCurveTo(-4.05, -2.16, -1.75, -3.45, 0.05, -4.15)
    .closePath()
    .fill(0x8d55a3)
    .stroke({ width: 0.5, color: 0x412a4b, join: 'round' });
  onion.moveTo(-0.18, -3.2).quadraticCurveTo(-3.2, -0.67, -2.61, 2.1).stroke({
    width: 0.52,
    color: 0xd5a3ca,
    cap: 'round',
  });
  onion.moveTo(0.8, -3.25).quadraticCurveTo(3.01, -0.9, 1.88, 3.2).stroke({
    width: 0.57,
    color: 0x6a3d79,
    cap: 'round',
  });
  const warning = new Graphics({ label: 'onion-entry-warning' });
  warning
    .roundRect(-2.8, -3.2, 5.6, 6.4, 1.4)
    .fill(0xf6cf73)
    .stroke({ width: 0.45, color: 0x684019 })
    .roundRect(-0.38, -1.9, 0.76, 2.45, 0.3)
    .fill(0x59371d)
    .circle(0, 1.44, 0.48)
    .fill(0x59371d);
  warning.position.set(stage.ledges[0]!.x + 4.5, -6.5);
  container.addChild(onion, warning);
  return {
    container,
    update(frame: number, hazards: boolean, alpha: number) {
      const tick = frame % ONION_PERIOD;
      warning.visible = hazards && tick >= ONION_WARNING && tick < ONION_ENTRY;
      warning.alpha = 0.7 + 0.3 * Math.sin((tick - ONION_WARNING) * 0.37);
      onion.visible = hazards && scheduledOn(rollingOnion.schedule, frame);
      if (!onion.visible) return;
      const now = tick === ONION_ENTRY ? frame : frame - 1 + alpha;
      const [dx, dy] = motionOffset(rollingOnion.motion, now);
      onion.position.set(rollingOnion.x + dx, -(rollingOnion.y + dy));
      onion.rotation = dx / rollingOnion.boxes[0]!.radius;
    },
  };
}
