import { Container, Graphics, GraphicsContext, type LineCap, type LineJoin } from 'pixi.js';

/** Neutral head used until a fighter ships its own icon. */
export const PLACEHOLDER_ICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
<path d="M50 9 C77 9 91 29 91 53 C91 79 72 95 50 95 C28 95 9 79 9 53 C9 29 23 9 50 9 Z" fill="#ddd6c6" stroke="#1b1712" stroke-width="5"/>
<path d="M17 47 C19 25 34 14 50 14 C67 14 81 25 83 47 C73 33 62 29 50 29 C38 29 27 33 17 47 Z" fill="#bdb5a3"/>
<path d="M70 60 C78 72 72 86 58 90 C72 80 75 70 70 60 Z" fill="#c4bba9"/>
<ellipse cx="37" cy="55" rx="6" ry="9" fill="#1b1712"/>
<ellipse cx="63" cy="55" rx="6" ry="9" fill="#1b1712"/>
<circle cx="39" cy="51" r="2.3" fill="#ffffff"/>
<circle cx="65" cy="51" r="2.3" fill="#ffffff"/>
<path d="M39 74 Q50 81 61 74" fill="none" stroke="#1b1712" stroke-width="4"/>
</svg>`;

interface IconArt {
  context: GraphicsContext;
  x: number;
  y: number;
  w: number;
  h: number;
}

const cache = new Map<string, IconArt>();

/** The value `attr` takes in the SVG, when every element that sets it sets the same one. */
function onlyValue(svg: string, attr: string): string | undefined {
  const values = new Set(Array.from(svg.matchAll(new RegExp(`${attr}="([a-z]+)"`, 'g')), (m) => m[1]));
  return values.size === 1 ? [...values][0] : undefined;
}

/**
 * Pixi's SVG reader strokes every line with miter joins and butt caps, whatever the SVG says. Fighter icons ask
 * for round ones (as the rig strokes in game), and miters on a jagged outline such as Fluffy's fur spike out up
 * to ten half-widths past the drawing. Put back the join and cap the SVG names, when it names one for all. Runs
 * on a context fresh from `svg()`, before anything has measured or drawn it.
 */
function restoreStrokeShape(context: GraphicsContext, svg: string): void {
  const join = onlyValue(svg, 'stroke-linejoin') as LineJoin | undefined;
  const cap = onlyValue(svg, 'stroke-linecap') as LineCap | undefined;
  if (!join && !cap) return;
  for (const step of context.instructions)
    if (step.action === 'stroke')
      step.data.style = {
        ...step.data.style,
        join: join ?? step.data.style.join,
        cap: cap ?? step.data.style.cap,
      };
}

function iconArt(svg: string): IconArt {
  let art = cache.get(svg);
  if (!art) {
    const vb = /viewBox\s*=\s*["']\s*([-\d.eE]+)[\s,]+([-\d.eE]+)[\s,]+([-\d.eE]+)[\s,]+([-\d.eE]+)/.exec(
      svg,
    );
    const [x, y, w, h] = vb ? vb.slice(1, 5).map(Number) : [0, 0, 100, 100];
    const context = new GraphicsContext().svg(svg);
    restoreStrokeShape(context, svg);
    art = { context, x: x!, y: y!, w: w!, h: h! };
    cache.set(svg, art);
  }
  return art;
}

/**
 * The icon scaled so its viewBox fits a `size` square centred on the returned container's origin. Pixi's SVG
 * reader does not apply `transform` attributes, so an icon SVG must give its paths in viewBox coordinates.
 */
export function iconView(svg: string | undefined, size: number): Container {
  const art = iconArt(svg ?? PLACEHOLDER_ICON);
  const g = new Graphics(art.context);
  const s = size / Math.max(art.w, art.h);
  g.scale.set(s);
  g.position.set(-(art.x + art.w / 2) * s, -(art.y + art.h / 2) * s);
  const holder = new Container();
  holder.addChild(g);
  return holder;
}
