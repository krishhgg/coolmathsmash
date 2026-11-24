/** FNV-1a over a canonical serialisation: equal simulation states always hash equal. */
export function hashState(value: unknown): string {
  let h = 0x811c9dc5;
  const feed = (s: string) => {
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
  };
  const walk = (v: unknown): void => {
    if (v === null || v === undefined) return feed('n');
    if (typeof v === 'number') return feed(Object.is(v, -0) ? '0' : String(v));
    if (typeof v === 'string') return feed(JSON.stringify(v));
    if (typeof v === 'boolean') return feed(v ? 't' : 'f');
    if (Array.isArray(v)) {
      feed('[');
      for (const item of v) {
        walk(item);
        feed(',');
      }
      return feed(']');
    }
    if (typeof v === 'object') {
      feed('{');
      for (const key of Object.keys(v).sort()) {
        feed(key);
        feed(':');
        walk((v as Record<string, unknown>)[key]);
        feed(',');
      }
      return feed('}');
    }
    throw new Error(`unhashable value of type ${typeof v}`);
  };
  walk(value);
  return (h >>> 0).toString(16).padStart(8, '0');
}
