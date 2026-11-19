// Builds the runtime map from authored content. Hobby lists are bundled eagerly;
// each skill tree is its own lazily loaded chunk.

import domainsJson from '../content/domains.json';
import metaJson from '../content/_meta.json';
import { axialToWorld, hexKey, type Axial } from './hex';
import { layoutMap, TILE_R, type Bounds } from './layout';
import type { ContentMeta, Domain, DomainEntry, Hobby, HobbyEntry, SkillTree } from './types';

const hobbyFiles = import.meta.glob<Hobby[]>('../content/hobbies/*.json', { eager: true, import: 'default' });
const treeFiles = import.meta.glob<SkillTree>('../content/trees/*.json', { import: 'default' });

/** What occupies a tile on the map. */
export interface Cell {
  domain: number; // -1 for the hub
  hobby: number; // -1 for an empty lot or the hub
}

export interface Galaxy {
  domains: DomainEntry[];
  hobbies: HobbyEntry[];
  domainById: Map<string, DomainEntry>;
  hobbyById: Map<string, HobbyEntry>;
  /** Every claimed tile, keyed by hexKey(q, r). */
  cells: Map<string, Cell>;
  hub: { cells: Axial[]; pos: [number, number] };
  bounds: Bounds;
}

const fileId = (path: string) => path.slice(path.lastIndexOf('/') + 1, -'.json'.length);

function build(): Galaxy {
  const meta = metaJson as ContentMeta;
  const domainList = domainsJson as Domain[];
  const listsByDomain = new Map<string, Hobby[]>();
  for (const [path, list] of Object.entries(hobbyFiles)) listsByDomain.set(fileId(path), list);

  // Most popular hobbies take the tiles nearest each district's centre.
  const lists = domainList.map((d) =>
    [...(listsByDomain.get(d.id) ?? [])].sort((a, b) => b.pop - a.pop || a.name.localeCompare(b.name)),
  );
  const map = layoutMap(lists.map((l) => l.length));

  const domains: DomainEntry[] = [];
  const hobbies: HobbyEntry[] = [];
  const cells = new Map<string, Cell>();

  domainList.forEach((d, di) => {
    const layout = map.districts[di];
    const list = lists[di];
    const start = hobbies.length;
    list.forEach((h, i) => {
      const cell = layout.cells[i];
      hobbies.push({
        ...h,
        index: start + i,
        domain: d.id,
        domainIndex: di,
        cell,
        pos: axialToWorld(cell[0], cell[1], TILE_R),
        charted: Boolean(meta.hobbies[h.id]),
        meta: meta.hobbies[h.id] ?? null,
      });
    });
    layout.cells.forEach(([q, r], i) => cells.set(hexKey(q, r), { domain: di, hobby: i < list.length ? start + i : -1 }));
    domains.push({
      ...d,
      index: di,
      code: `SEC-${String(di + 1).padStart(2, '0')}`,
      pos: axialToWorld(layout.center[0], layout.center[1], TILE_R),
      cells: layout.cells,
      border: layout.border,
      bounds: layout.bounds,
      hobbies: list.map((_, i) => start + i),
    });
  });
  for (const [q, r] of map.hub.cells) cells.set(hexKey(q, r), { domain: -1, hobby: -1 });

  const hobbyById = new Map(hobbies.map((h) => [h.id, h]));
  // Drop synergies that point at hobbies which haven't been written yet.
  for (const h of hobbies) h.synergies = h.synergies.filter((s) => s !== h.id && hobbyById.has(s));

  return {
    domains,
    hobbies,
    domainById: new Map(domains.map((d) => [d.id, d])),
    hobbyById,
    cells,
    hub: { cells: map.hub.cells, pos: [0, 0] },
    bounds: map.bounds,
  };
}

export const galaxy = build();

const treeCache = new Map<string, Promise<SkillTree | null>>();

export function loadTree(hobbyId: string): Promise<SkillTree | null> {
  const loader = treeFiles[`../content/trees/${hobbyId}.json`];
  if (!loader) return Promise.resolve(null);
  let p = treeCache.get(hobbyId);
  if (!p) {
    p = loader().catch((e) => {
      console.error(`Failed to load tree for ${hobbyId}`, e);
      treeCache.delete(hobbyId);
      return null;
    });
    treeCache.set(hobbyId, p);
  }
  return p;
}
