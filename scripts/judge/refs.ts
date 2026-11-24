import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { basename, dirname, join } from 'node:path';

/** scripts/judge/refs.json: which reference images pair with each capture state. */
export interface RefMap {
  /** Reference library root; `~/` expands to the home directory. */
  root: string;
  /** Most references per state; the patterns take turns, so every listed source gets a slot. */
  maxPerState: number;
  /** State name to glob patterns relative to the root, most important first. */
  states: Record<string, string[]>;
}

const IMAGE = /\.(png|jpe?g|gif|webp)$/i;

export const expandHome = (p: string) => (p === '~' || p.startsWith('~/') ? join(homedir(), p.slice(1)) : p);

/** `*` matches within one path segment, `**` across segments, `?` one character. Case-insensitive. */
export function globToRegExp(glob: string): RegExp {
  let re = '';
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i]!;
    if (c === '*' && glob[i + 1] === '*') {
      const slash = glob[i + 2] === '/';
      re += slash ? '(?:.*/)?' : '.*';
      i += slash ? 2 : 1;
    } else if (c === '*') re += '[^/]*';
    else if (c === '?') re += '[^/]';
    else re += c.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  }
  return new RegExp(`^${re}$`, 'i');
}

/** Every image under `root` as a sorted, slash-separated relative path. */
export function listImages(root: string, dir = ''): string[] {
  if (!existsSync(join(root, dir))) return [];
  return readdirSync(join(root, dir), { withFileTypes: true })
    .flatMap((e) => {
      const rel = dir ? `${dir}/${e.name}` : e.name;
      if (e.isDirectory()) return listImages(root, rel);
      return IMAGE.test(e.name) ? [rel] : [];
    })
    .sort();
}

/** Pick up to `max` files: the first match of every pattern in order, then every second match, and so on. */
export function matchRefs(files: readonly string[], patterns: readonly string[], max: number): string[] {
  const groups = patterns.map((p) => {
    const re = globToRegExp(p);
    return files.filter((f) => re.test(f));
  });
  const out: string[] = [];
  for (let i = 0; out.length < max && groups.some((g) => i < g.length); i++) {
    for (const g of groups) {
      const f = g[i];
      if (f && !out.includes(f) && out.length < max) out.push(f);
    }
  }
  return out;
}

const FILE_NAME = /[\w.-]+\.(png|jpe?g|gif|webp)/i;
const SEPARATOR = /^\|[\s|:-]+\|$/;

/**
 * The caption for `file` from the research index.md table in its folder: the "what it shows" column when the
 * table has one, else the column after the file name.
 */
export function refCaption(root: string, file: string): string | undefined {
  const index = join(root, dirname(file), 'index.md');
  if (!existsSync(index)) return undefined;
  const name = basename(file).toLowerCase();
  const lines = readFileSync(index, 'utf8')
    .split('\n')
    .map((l) => l.trim());
  let column = 2;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    if (!line.startsWith('|')) continue;
    const cells = line.split(/(?<!\\)\|/).map((c) => c.trim());
    if (SEPARATOR.test(lines[i + 1] ?? '')) {
      const shows = cells.findIndex((c) => /what it shows|description/i.test(c));
      column = shows > 0 ? shows : 2;
      continue;
    }
    const caption = cells[column];
    if (caption && cells[1]?.match(FILE_NAME)?.[0].toLowerCase() === name)
      return caption.replace(/\\\|/g, '|');
  }
  return undefined;
}
