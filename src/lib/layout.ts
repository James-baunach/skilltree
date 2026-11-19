// Deterministic layouts for the 2D map. Districts are hex-shaped honeycombs of hobby tiles
// arranged around a central hub, and each hobby's skill tree is drawn inside its own tile.

import { axialToWorld, corner, DIRS, EDGE_DIRS, hexKey, spiral, SQRT3, type Axial } from './hex';
import type { SkillNode, SkillTree, Tier } from './types';

export const TILE_R = 100; // tile circumradius in world units (tree layouts below assume 100)
export const TILE_H = TILE_R * SQRT3; // flat-to-flat height of a tile
export const HUB_RINGS = 1;
const MIN_RINGS = 2;

export interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/** Smallest honeycomb radius (in rings) that holds `count` tiles, never below MIN_RINGS. */
export function ringsFor(count: number): number {
  let n = 0;
  while (1 + 3 * n * (n + 1) < count) n++;
  return Math.max(MIN_RINGS, n);
}

const add = (a: Axial, b: Axial): Axial => [a[0] + b[0], a[1] + b[1]];
const mul = (a: Axial, k: number): Axial => [a[0] * k, a[1] * k];

/**
 * District slots on the macro lattice, in domain order. Each group of eight domains in
 * domains.json fills one 120° wedge, inner ring first, so related domains sit together.
 */
function macroSlots(count: number): Axial[] {
  const D = DIRS;
  const slots: Axial[] = [];
  for (let g = 0; g < 3; g++) {
    const s0 = 2 * g;
    const s1 = 2 * g + 1;
    const s2 = (2 * g + 2) % 6;
    slots.push(D[s0], D[s1], add(D[s0], D[s1]), mul(D[s0], 2), mul(D[s1], 2), add(D[s1], D[s2]), mul(D[s0], 3), mul(D[s1], 3));
  }
  // Any domains beyond the designed 24 continue outward.
  const used = new Set(slots.map(([q, r]) => hexKey(q, r)));
  for (const cell of spiral([0, 0], 8)) {
    if (slots.length >= count) break;
    const k = hexKey(cell[0], cell[1]);
    if (k !== hexKey(0, 0) && !used.has(k)) {
      slots.push(cell);
      used.add(k);
    }
  }
  return slots.slice(0, count);
}

function boundsOf(cells: Axial[]): Bounds {
  const b = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
  for (const [q, r] of cells) {
    const [x, y] = axialToWorld(q, r, TILE_R);
    b.minX = Math.min(b.minX, x - TILE_R);
    b.maxX = Math.max(b.maxX, x + TILE_R);
    b.minY = Math.min(b.minY, y - TILE_H / 2);
    b.maxY = Math.max(b.maxY, y + TILE_H / 2);
  }
  return b;
}

/** Outline of a group of cells: every tile edge that doesn't touch another cell of the group. */
function borderOf(cells: Axial[]): number[] {
  const inGroup = new Set(cells.map(([q, r]) => hexKey(q, r)));
  const segs: number[] = [];
  for (const [q, r] of cells) {
    const [cx, cy] = axialToWorld(q, r, TILE_R);
    for (let k = 0; k < 6; k++) {
      if (inGroup.has(hexKey(q + EDGE_DIRS[k][0], r + EDGE_DIRS[k][1]))) continue;
      segs.push(...corner(cx, cy, TILE_R, k), ...corner(cx, cy, TILE_R, k + 1));
    }
  }
  return segs;
}

export interface DistrictLayout {
  center: Axial;
  rings: number;
  cells: Axial[]; // spiral order; hobbies fill them from the centre out
  border: number[]; // world line segments, flat [x1, y1, x2, y2, …]
  bounds: Bounds;
}

export interface MapLayout {
  districts: DistrictLayout[];
  hub: { center: Axial; cells: Axial[] };
  bounds: Bounds;
}

export function layoutMap(counts: number[]): MapLayout {
  const rings = counts.map(ringsFor);
  // A macro lattice for honeycombs of radius N - 1 leaves a two-tile street between neighbours.
  const N = Math.max(HUB_RINGS, ...rings) + 1;
  const v1: Axial = [2 * N + 1, -N];
  const v2: Axial = [N, N + 1];
  const districts = macroSlots(counts.length).map(([I, J], i) => {
    const center: Axial = [I * v1[0] + J * v2[0], I * v1[1] + J * v2[1]];
    const cells = spiral(center, rings[i]);
    return { center, rings: rings[i], cells, border: borderOf(cells), bounds: boundsOf(cells) };
  });
  const hubCells = spiral([0, 0], HUB_RINGS);
  const all = [...districts.map((d) => d.bounds), boundsOf(hubCells)];
  const bounds = {
    minX: Math.min(...all.map((b) => b.minX)),
    minY: Math.min(...all.map((b) => b.minY)),
    maxX: Math.max(...all.map((b) => b.maxX)),
    maxY: Math.max(...all.map((b) => b.maxY)),
  };
  return { districts, hub: { center: [0, 0], cells: hubCells }, bounds };
}

// ---------------------------------------------------------------- skill trees inside a tile

export interface TileTree {
  pos: Map<string, [number, number]>; // tile-local coordinates (tile circumradius 100, y up)
  traces: { from: string | null; to: string; pts: number[] }[]; // polylines, flat [x0, y0, x1, y1, …]
  tiers: { tier: Tier; x: number }[]; // column centres, for the tier headings
  port: [number, number]; // where the hobby feeds its root skills
}

const TREE = { x0: -62, x1: 62, y0: -60, y1: 48, maxStep: 16, depthStep: 6 };
export const TIER_HEAD_Y = 59; // local y of the tier headings
export const TILE_HEAD_Y = 73; // local y of the tile title while its tree is showing

/**
 * Tiers run left to right (Novice → Master). A skill that depends on another skill in the
 * same tier sits a little to the right of it, so every trace flows rightwards.
 */
export function layoutTileTree(tree: SkillTree): TileTree {
  const byId = new Map(tree.nodes.map((n) => [n.id, n]));
  const depth = new Map<string, number>();
  const depthOf = (n: SkillNode): number => {
    const known = depth.get(n.id);
    if (known !== undefined) return known;
    depth.set(n.id, 0); // cycle guard
    let d = 0;
    for (const r of n.requires) {
      const req = byId.get(r);
      if (req && req.tier === n.tier) d = Math.max(d, depthOf(req) + 1);
    }
    depth.set(n.id, d);
    return d;
  };

  const tiers = ([1, 2, 3, 4, 5] as Tier[]).filter((t) => tree.nodes.some((n) => n.tier === t));
  const colW = (TREE.x1 - TREE.x0) / tiers.length;
  const pos = new Map<string, [number, number]>();
  const order = new Map<string, number>(); // 0 = top of its column, 1 = bottom

  tiers.forEach((tier, ti) => {
    const nodes = tree.nodes.filter((n) => n.tier === tier);
    const maxDepth = Math.max(...nodes.map(depthOf));
    const dx = maxDepth ? Math.min(TREE.depthStep, (colW * 0.45) / maxDepth) : 0;
    const cx = TREE.x0 + colW * (ti + 0.5);

    // Sort by where the prerequisites sit, so traces cross as little as possible.
    const keys = new Map<string, number>();
    const keyOf = (n: SkillNode, guard = 0): number => {
      const known = keys.get(n.id) ?? order.get(n.id);
      if (known !== undefined) return known;
      const reqs = n.requires.map((r) => byId.get(r)).filter((r): r is SkillNode => r !== undefined);
      let k: number;
      if (!reqs.length || guard > 8) k = nodes.indexOf(n) / Math.max(1, nodes.length - 1);
      else {
        const ks = reqs.map((r) => (r.tier === tier ? keyOf(r, guard + 1) + 0.001 : (order.get(r.id) ?? 0.5)));
        k = ks.reduce((a, b) => a + b, 0) / ks.length;
      }
      keys.set(n.id, k);
      return k;
    };
    const sorted = [...nodes].sort((a, b) => keyOf(a) - keyOf(b) || depthOf(a) - depthOf(b));
    const step = nodes.length > 1 ? Math.min(TREE.maxStep, (TREE.y1 - TREE.y0) / (nodes.length - 1)) : 0;
    const top = (TREE.y0 + TREE.y1) / 2 + (step * (nodes.length - 1)) / 2;
    sorted.forEach((n, i) => {
      pos.set(n.id, [cx - (maxDepth * dx) / 2 + depthOf(n) * dx, top - i * step]);
      order.set(n.id, nodes.length > 1 ? i / (nodes.length - 1) : 0.5);
    });
  });

  const port: [number, number] = [-84, 0];
  const traces: TileTree['traces'] = [];
  let e = 0;
  for (const n of tree.nodes) {
    const [bx, by] = pos.get(n.id)!;
    const reqs = n.requires.filter((r) => pos.has(r));
    if (!reqs.length) traces.push({ from: null, to: n.id, pts: route(port[0], port[1], bx, by, e++) });
    for (const r of reqs) {
      const [ax, ay] = pos.get(r)!;
      traces.push({ from: r, to: n.id, pts: route(ax, ay, bx, by, e++) });
    }
  }
  return { pos, traces, tiers: tiers.map((tier, ti) => ({ tier, x: TREE.x0 + colW * (ti + 0.5) })), port };
}

/** Circuit-board routing: out horizontally, a chamfered vertical jog, then in horizontally. */
function route(ax: number, ay: number, bx: number, by: number, seed: number): number[] {
  const dy = by - ay;
  if (Math.abs(dy) < 0.5) return [ax, ay, bx, by];
  const c = Math.min(Math.abs(dy) / 2, Math.abs(bx - ax) / 4, 3);
  const jitter = ((seed % 5) - 2) * 0.9; // separate traces that share a channel
  const xm = Math.min(Math.max((ax + bx) / 2 + jitter, ax + c + 0.5), bx - c - 0.5);
  const sy = Math.sign(dy);
  return [ax, ay, xm - c, ay, xm, ay + sy * c, xm, by - sy * c, xm + c, by, bx, by];
}
