// Animated dashed arcs from a hobby tile to its synergies, shown while hovering.

import { Color, Group } from 'three';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { LineSegments2 } from 'three/addons/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js';
import type { Galaxy } from '../lib/data';

const STEPS = 32;

export class SynergyArcs {
  readonly group = new Group();
  private readonly material: LineMaterial;
  private line: LineSegments2 | null = null;
  private current = -1;
  private fade = 0;
  private fadeTarget = 0;

  constructor(private g: Galaxy) {
    this.material = new LineMaterial({
      vertexColors: true,
      linewidth: 1.5,
      transparent: true,
      dashed: true,
      dashSize: 14,
      gapSize: 10,
      depthTest: false,
      depthWrite: false,
    });
  }

  /** Show arcs from hobby index `from` to its synergies, or fade them out with -1. */
  show(from: number) {
    if (from === this.current) return;
    this.current = from;
    const src = from >= 0 ? this.g.hobbies[from] : null;
    const targets = src ? src.synergies.map((id) => this.g.hobbyById.get(id)!).filter(Boolean) : [];
    if (!src || !targets.length) {
      this.fadeTarget = 0;
      return;
    }
    const [ax, ay] = src.pos;
    const ca = new Color(this.g.domains[src.domainIndex].color);
    const pos: number[] = [];
    const col: number[] = [];
    const c = new Color();
    for (const t of targets) {
      const [bx, by] = t.pos;
      const cb = new Color(this.g.domains[t.domainIndex].color);
      // Bow each arc sideways by a fifth of its length.
      const mx = (ax + bx) / 2 - (by - ay) * 0.2;
      const my = (ay + by) / 2 + (bx - ax) * 0.2;
      let px = ax;
      let py = ay;
      for (let s = 1; s <= STEPS; s++) {
        const u = s / STEPS;
        const x = (1 - u) * (1 - u) * ax + 2 * (1 - u) * u * mx + u * u * bx;
        const y = (1 - u) * (1 - u) * ay + 2 * (1 - u) * u * my + u * u * by;
        pos.push(px, py, 0, x, y, 0);
        c.copy(ca).lerp(cb, (s - 1) / STEPS);
        col.push(c.r, c.g, c.b);
        c.copy(ca).lerp(cb, u);
        col.push(c.r, c.g, c.b);
        px = x;
        py = y;
      }
    }
    const geo = new LineSegmentsGeometry();
    geo.setPositions(pos);
    geo.setColors(col);
    if (!this.line) {
      this.line = new LineSegments2(geo, this.material);
      this.line.frustumCulled = false;
      this.line.renderOrder = 8;
      this.group.add(this.line);
    } else {
      this.line.geometry.dispose();
      this.line.geometry = geo;
    }
    this.line.computeLineDistances();
    this.fade = Math.min(this.fade, 0.2);
    this.fadeTarget = 1;
  }

  setResolution(w: number, h: number) {
    this.material.resolution.set(w, h);
  }

  update(dt: number) {
    this.fade += (this.fadeTarget - this.fade) * (1 - Math.exp(-dt * 8));
    this.material.opacity = this.fade * 0.8;
    this.material.dashOffset -= dt * 40;
    if (this.line) this.line.visible = this.fade > 0.01;
  }

  dispose() {
    this.line?.geometry.dispose();
    this.material.dispose();
  }
}
