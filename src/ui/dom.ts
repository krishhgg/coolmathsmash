type Child = Node | string | number | null | undefined | false;
type Listener = (e: Event) => void;

type Attr = string | number | boolean | null | undefined;

export interface Props {
  class?: string;
  style?: string;
  /** `data-*` attributes. */
  data?: Record<string, string | number>;
  on?: Record<string, Listener>;
  [attr: string]: Attr | Record<string, string | number> | Record<string, Listener>;
}

/** Build an element: `h('div', { class: 'tile', data: { nav: '' } }, 'text', child)`. */
export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Props | null = null,
  ...children: (Child | Child[])[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  const { data, on, ...attrs } = props ?? {};
  for (const [k, v] of Object.entries(data ?? {})) el.dataset[k] = String(v);
  for (const [k, v] of Object.entries(on ?? {})) el.addEventListener(k, v);
  for (const [key, value] of Object.entries(attrs)) {
    if (value === true) el.setAttribute(key, '');
    else if (typeof value === 'string' || typeof value === 'number') el.setAttribute(key, String(value));
  }
  for (const child of children.flat()) {
    if (child === null || child === undefined || child === false) continue;
    el.append(typeof child === 'number' ? String(child) : child);
  }
  return el;
}

/** Parse trusted SVG markup (our own art) into an element. */
export function svg(markup: string, className?: string): SVGSVGElement {
  const doc = new DOMParser().parseFromString(markup, 'image/svg+xml');
  const el = document.importNode(doc.documentElement, true) as unknown as SVGSVGElement;
  if (className) el.setAttribute('class', className);
  return el;
}
