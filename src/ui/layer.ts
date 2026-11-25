import { VIEW_HEIGHT, VIEW_WIDTH } from '../config';
import { h } from './dom';

/**
 * The DOM layer the menus and match overlays draw into: a fixed 1280x720 box laid exactly over the game canvas and
 * scaled with it, so screens are authored in the same pixels as the renderer and the capture harness.
 */
export class UiLayer {
  readonly root = h('div', { class: 'ui-root' });

  constructor(host: HTMLElement, canvas: HTMLElement) {
    host.appendChild(this.root);
    const fit = () => {
      const scale = canvas.getBoundingClientRect().width / VIEW_WIDTH || 1;
      this.root.style.setProperty('--ui-scale', String(scale));
    };
    new ResizeObserver(fit).observe(canvas);
    fit();
    this.root.style.width = `${VIEW_WIDTH}px`;
    this.root.style.height = `${VIEW_HEIGHT}px`;
  }
}
