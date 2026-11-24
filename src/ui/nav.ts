import type { Direction } from './input';

/**
 * Spatial navigation over `[data-nav]` elements: a direction moves to the nearest element that way, weighting
 * sideways drift double. An element can pin a direction with `data-nav-up="<selector>"` (and down/left/right).
 */
export function navigable(root: ParentNode): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>('[data-nav]')].filter(
    (el) => !el.hasAttribute('disabled') && el.getClientRects().length > 0,
  );
}

const center = (r: DOMRect) => ({ x: r.left + r.width / 2, y: r.top + r.height / 2 });

export function neighbour(
  from: HTMLElement,
  dir: Direction,
  candidates: readonly HTMLElement[],
  root: ParentNode = document,
): HTMLElement | null {
  const pinned = from.dataset[`nav${dir[0]!.toUpperCase()}${dir.slice(1)}`];
  if (pinned !== undefined) return pinned ? root.querySelector<HTMLElement>(pinned) : null;
  const a = from.getBoundingClientRect();
  const c0 = center(a);
  let best: HTMLElement | null = null;
  let bestScore = Infinity;
  for (const el of candidates) {
    if (el === from) continue;
    const b = el.getBoundingClientRect();
    const c = center(b);
    const dx = c.x - c0.x;
    const dy = c.y - c0.y;
    const along = dir === 'left' ? -dx : dir === 'right' ? dx : dir === 'up' ? -dy : dy;
    if (along <= 2) continue;
    const across = dir === 'left' || dir === 'right' ? Math.abs(dy) : Math.abs(dx);
    const overlap =
      dir === 'left' || dir === 'right'
        ? Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top)
        : Math.min(a.right, b.right) - Math.max(a.left, b.left);
    const score = along + across * (overlap > 0 ? 0.5 : 2);
    if (score < bestScore) {
      bestScore = score;
      best = el;
    }
  }
  return best;
}

/** One focus over a screen's navigable elements (menus driven by any controller). */
export class Focus {
  current: HTMLElement | null = null;

  constructor(
    private readonly root: HTMLElement,
    private readonly onChange: (el: HTMLElement) => void = () => {},
  ) {}

  set(el: HTMLElement | null): void {
    if (!el || el === this.current) return;
    this.current?.classList.remove('is-focus');
    this.current = el;
    el.classList.add('is-focus');
    this.onChange(el);
  }

  move(dir: Direction): boolean {
    const from = this.current ?? navigable(this.root)[0];
    if (!from) return false;
    if (!this.current) {
      this.set(from);
      return true;
    }
    const next = neighbour(from, dir, navigable(this.root), this.root);
    if (next) this.set(next);
    return next !== null;
  }

  /** Focus follows the mouse over navigable elements. */
  hover(): void {
    this.root.addEventListener('pointerover', (e) => {
      const el = (e.target as HTMLElement).closest<HTMLElement>('[data-nav]');
      if (el && this.root.contains(el) && !el.hasAttribute('disabled')) this.set(el);
    });
  }
}
