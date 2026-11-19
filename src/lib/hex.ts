// Flat-top hexagon grid maths in axial coordinates (q, r). World y points up.
// Reference: https://www.redblobgames.com/grids/hexagons/

export const SQRT3 = Math.sqrt(3);

export type Axial = [number, number];

/** The six neighbour directions, in ring-walking order. */
export const DIRS: Axial[] = [
  [1, 0],
  [1, -1],
  [0, -1],
  [-1, 0],
  [-1, 1],
  [0, 1],
];

/** Neighbour across edge k of a tile, where edge k joins corner k and corner k + 1 (corner k sits at 60°·k). */
export const EDGE_DIRS: Axial[] = [
  [1, 0],
  [0, 1],
  [-1, 1],
  [-1, 0],
  [0, -1],
  [1, -1],
];

export const hexKey = (q: number, r: number) => `${q},${r}`;

export function axialToWorld(q: number, r: number, size: number): [number, number] {
  return [size * 1.5 * q, size * SQRT3 * (r + q / 2)];
}

export function worldToAxial(x: number, y: number, size: number): Axial {
  return axialRound(((2 / 3) * x) / size, ((-1 / 3) * x + (SQRT3 / 3) * y) / size);
}

export function axialRound(q: number, r: number): Axial {
  const s = -q - r;
  let rq = Math.round(q);
  let rr = Math.round(r);
  const rs = Math.round(s);
  const dq = Math.abs(rq - q);
  const dr = Math.abs(rr - r);
  const ds = Math.abs(rs - s);
  if (dq > dr && dq > ds) rq = -rr - rs;
  else if (dr > ds) rr = -rq - rs;
  return [rq, rr];
}

/** Cells in spiral order: the centre, then ring 1, ring 2 … out to `radius`. */
export function spiral(center: Axial, radius: number): Axial[] {
  const out: Axial[] = [center];
  for (let k = 1; k <= radius; k++) {
    let q = center[0] + DIRS[4][0] * k;
    let r = center[1] + DIRS[4][1] * k;
    for (let side = 0; side < 6; side++) {
      for (let step = 0; step < k; step++) {
        out.push([q, r]);
        q += DIRS[side][0];
        r += DIRS[side][1];
      }
    }
  }
  return out;
}

/** World-space corner k of a flat-top hexagon (corner 0 points along +x). */
export function corner(cx: number, cy: number, size: number, k: number): [number, number] {
  const a = (Math.PI / 3) * k;
  return [cx + size * Math.cos(a), cy + size * Math.sin(a)];
}
