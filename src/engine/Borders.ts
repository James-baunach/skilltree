// Neon outlines around each district's honeycomb, brightened for the hovered or selected district.

import { Color } from 'three';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { LineSegments2 } from 'three/addons/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js';
import type { Galaxy } from '../lib/data';

export class Borders {
  readonly line: LineSegments2;
  private readonly material: LineMaterial;
  private readonly segDomain: number[] = [];
  private readonly colors: Color[];
  private readonly populated: boolean[];
  private key = '';

  constructor(g: Galaxy) {
    this.populated = g.domains.map((d) => d.hobbies.length > 0);
    const pos: number[] = [];
    for (const d of g.domains) {
      for (let i = 0; i < d.border.length; i += 4) {
        pos.push(d.border[i], d.border[i + 1], 0, d.border[i + 2], d.border[i + 3], 0);
        this.segDomain.push(d.index);
      }
    }
    this.colors = g.domains.map((d) => new Color(d.color));
    const geo = new LineSegmentsGeometry();
    geo.setPositions(pos);
    this.material = new LineMaterial({ vertexColors: true, linewidth: 1.4, transparent: true, depthTest: false, depthWrite: false });
    this.line = new LineSegments2(geo, this.material);
    this.line.frustumCulled = false;
    this.line.renderOrder = 1;
    this.setEmphasis(-1, -1);
  }

  /** Brighten one district (selected) and slightly another (hovered); dim the rest while one is selected. */
  setEmphasis(selected: number, hovered: number) {
    const key = `${selected}:${hovered}`;
    if (key === this.key) return;
    this.key = key;
    const col: number[] = [];
    const c = new Color();
    for (const d of this.segDomain) {
      const base = this.populated[d] ? 0.6 : 0.32; // districts still waiting for content stay quieter
      const k = d === selected ? 1 : d === hovered ? 0.85 : selected >= 0 ? base * 0.55 : base;
      c.copy(this.colors[d]).multiplyScalar(k);
      col.push(c.r, c.g, c.b, c.r, c.g, c.b);
    }
    (this.line.geometry as LineSegmentsGeometry).setColors(col);
  }

  setResolution(w: number, h: number) {
    this.material.resolution.set(w, h);
  }

  dispose() {
    this.line.geometry.dispose();
    this.material.dispose();
  }
}
