// Picking on the 2D map: the hex grid tells us which tile is under a world point directly,
// then we look for a skill node if that tile's tree is showing.

import type { Galaxy } from '../lib/data';
import { hexKey, worldToAxial } from '../lib/hex';
import { TILE_R } from '../lib/layout';
import type { Trees } from './Trees';

export interface Pick {
  kind: 'domain' | 'hobby' | 'node' | 'core';
  id: string;
  index: number; // domain index, hobby index, or node index within its tree
  hobby?: number; // for nodes: the hobby whose tree it's in
}

/** Below this on-screen tile height (px), tiles are too small to aim at, so clicks pick whole districts. */
export const DISTRICT_PICK_PX = 36;

export function pickAt(g: Galaxy, trees: Trees, wx: number, wy: number, scale: number, tilePx: number, treeAlpha: number): Pick | null {
  const [q, r] = worldToAxial(wx, wy, TILE_R);
  const cell = g.cells.get(hexKey(q, r));
  if (!cell) return null;
  if (cell.domain < 0) return { kind: 'core', id: 'core', index: -1 };
  const d = g.domains[cell.domain];
  if (tilePx < DISTRICT_PICK_PX || cell.hobby < 0) return { kind: 'domain', id: d.id, index: d.index };
  if (treeAlpha > 0.4) {
    const j = trees.pick(cell.hobby, wx, wy, Math.max(5, 12 / scale));
    if (j >= 0) return { kind: 'node', id: trees.get(cell.hobby)!.tree.nodes[j].id, index: j, hobby: cell.hobby };
  }
  const h = g.hobbies[cell.hobby];
  return { kind: 'hobby', id: h.id, index: h.index };
}
