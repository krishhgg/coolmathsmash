import { Container } from 'pixi.js';
import { VIEW_HEIGHT, VIEW_WIDTH } from '../../config';
import { Hud, loadHudFont, type HudPlayer } from '../../render/hud';
import { REF_CAMERA } from '../../stages/battlefield/art/parallax';
import { createStageView } from '../../stages/battlefield/view';
import type { LabScene } from '../types';

/** Lab-only sample icon to exercise the SVG path (gradients included); fighters ship their own. */
const RED_BALL = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
<defs><radialGradient id="rb" cx="0.38" cy="0.32" r="0.72"><stop offset="0" stop-color="#ff8f7f"/><stop offset="0.55" stop-color="#e8231a"/><stop offset="1" stop-color="#8f0c08"/></radialGradient></defs>
<circle cx="50" cy="52" r="42" fill="url(#rb)" stroke="#1a0c08" stroke-width="5"/>
<ellipse cx="38" cy="46" rx="9" ry="12" fill="#ffffff" stroke="#1a0c08" stroke-width="3"/>
<ellipse cx="64" cy="46" rx="9" ry="12" fill="#ffffff" stroke="#1a0c08" stroke-width="3"/>
<circle cx="41" cy="49" r="4.5" fill="#1a0c08"/><circle cx="61" cy="49" r="4.5" fill="#1a0c08"/>
<path d="M36 70 Q50 80 64 70" fill="none" stroke="#1a0c08" stroke-width="4"/>
<ellipse cx="34" cy="26" rx="11" ry="6" fill="#ffffff" opacity="0.45"/>
</svg>`;

export function samplePlayers(count: number, frame: number): HudPlayer[] {
  const all: HudPlayer[] = [
    { port: 0, name: 'Fireboy', damage: 0, stocks: 3, maxStocks: 3, eliminated: false, hitFrame: -1 },
    { port: 1, name: 'Watergirl', damage: 47.3, stocks: 2, maxStocks: 3, eliminated: false, hitFrame: -1 },
    {
      port: 2,
      name: 'Papa Louie',
      damage: 122.8,
      stocks: 1,
      maxStocks: 3,
      eliminated: false,
      hitFrame: frame - 4,
    },
    {
      port: 3,
      name: 'Red Ball',
      damage: 180,
      stocks: 2,
      maxStocks: 3,
      eliminated: false,
      hitFrame: -1,
      icon: RED_BALL,
    },
  ];
  return count <= 2 ? [all[0]!, { ...all[1]!, hitFrame: frame - 3 }] : all.slice(0, count);
}

let setPlayers: (players: HudPlayer[], frame: number) => void = () => {};

/**
 * The bottom HUD over the stage: ?scene=hud&players=2|4&frame=120, &ko=<port> greys a player out,
 * &stage=0 drops the stage backdrop.
 */
export const scene: LabScene = {
  title: 'Damage HUD',
  async mount(app, params) {
    await loadHudFont();
    if (params.get('stage') !== '0') {
      const view = createStageView();
      const world = new Container();
      world.addChild(view.world);
      world.position.set(
        VIEW_WIDTH / 2 - REF_CAMERA.x * REF_CAMERA.zoom,
        VIEW_HEIGHT / 2 + REF_CAMERA.y * REF_CAMERA.zoom,
      );
      world.scale.set(REF_CAMERA.zoom);
      view.update(0, REF_CAMERA);
      app.stage.addChild(view.background, world);
    }
    const hud = new Hud();
    app.stage.addChild(hud.container);
    setPlayers = (players, frame) => hud.update(players, frame);
    const frame = Number(params.get('frame') ?? 120) || 120;
    const players = samplePlayers(Number(params.get('players') ?? 4), frame);
    const ko = params.get('ko');
    for (const p of players)
      if (ko !== null && p.port === Number(ko)) Object.assign(p, { eliminated: true, stocks: 0 });
    hud.update(players, frame);
  },
  api: {
    set: (players: HudPlayer[], frame: number) => setPlayers(players, frame),
  },
};
