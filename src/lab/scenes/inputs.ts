import { Container } from 'pixi.js';
import { neutralInput } from '../../input/types';
import { InputDisplay } from '../../render/debug/inputDisplay';
import { createControl, feedControl } from '../../sim/control';
import type { PlayerState } from '../../sim/match';
import type { LabScene } from '../types';

/** The input display on its own, fed with fixed stick/button values. */
export const scene: LabScene = {
  title: 'Input display',
  mount(app) {
    const display = new InputDisplay();
    const root = new Container();
    root.addChild(display.container);
    app.stage.addChild(root);
    const players: PlayerState[] = [0, 1].map((port) => ({ port, tapJump: true, control: createControl() }));
    feedControl(players[0]!.control, { ...neutralInput(), x: 100, buttons: 1 | 4 });
    feedControl(players[1]!.control, { ...neutralInput(), y: -100, cx: 100, buttons: 8 });
    display.update(players);
  },
};
