// Crisp HTML labels projected from world positions every frame. Higher-priority labels
// win when they would overlap; everything fades in and out smoothly.

import { Vector3, type Camera } from 'three';

export type LabelKind = 'domain' | 'district' | 'hobby' | 'tile-head' | 'summary' | 'node' | 'tier' | 'core';

export interface LabelCandidate {
  id: string;
  kind: LabelKind;
  text: string;
  sub?: string;
  world: [number, number];
  priority: number;
  opacity: number; // target opacity 0..1
  color?: string;
  /** 'middle' centres the label on the point; 'below' / 'above' sit it offsetY px under / over the point. */
  place?: 'middle' | 'below' | 'above';
  offsetY?: number;
  /** Uniform size multiplier (e.g. to shrink overview names on small screens). */
  scale?: number;
  /** Fallback spots tried in order if the first one collides (e.g. under a district instead of over it). */
  alts?: { world: [number, number]; place: 'middle' | 'below' | 'above'; offsetY?: number }[];
  state?: string; // space-separated modifiers, each becomes an is-* class
}

interface Label {
  kind: LabelKind;
  id: string;
  rect: [number, number, number, number]; // left, top, width, height (CSS px)
  el: HTMLDivElement;
  text: HTMLSpanElement;
  sub: HTMLSpanElement;
  key: string;
  w: number;
  h: number;
  op: number;
  cls: string;
  seen: boolean;
}

const tmp = new Vector3();
const range = document.createRange();

/** Width of the widest line of text in a span, in layout px (undoing any transform on its label). */
function lineWidth(el: HTMLElement, span: HTMLElement): number {
  range.selectNodeContents(span);
  let w = 0;
  for (const r of range.getClientRects()) w = Math.max(w, r.width);
  const box = el.getBoundingClientRect().width;
  return box ? (w * el.offsetWidth) / box : w;
}

export class Labels {
  private pool = new Map<string, Label>();
  private placed: number[] = [];

  constructor(private layer: HTMLElement) {}

  update(cands: LabelCandidate[], camera: Camera, width: number, height: number, dt: number) {
    for (const l of this.pool.values()) l.seen = false;
    cands.sort((a, b) => b.priority - a.priority);
    this.placed.length = 0;
    const k = 1 - Math.exp(-dt * 12);

    const toScreen = (w: [number, number]): [number, number] => {
      tmp.set(w[0], w[1], 0).project(camera);
      return [(tmp.x * 0.5 + 0.5) * width, (-tmp.y * 0.5 + 0.5) * height];
    };
    const topFor = (y: number, h: number, place: LabelCandidate['place'], off: number) =>
      place === 'below' ? y + off : place === 'above' ? y - h - off : y - h / 2 + off;

    for (const c of cands) {
      const [x, y] = toScreen(c.world);
      if (x < -300 || x > width + 300 || y < -150 || y > height + 150) continue;

      const label = this.get(c);
      const s = c.scale ?? 1;
      const w = label.w * s;
      const h = label.h * s;
      let left = x - w / 2;
      const off = c.offsetY ?? 0;
      let top = topFor(y, h, c.place, off);
      let target = c.opacity;
      if (target > 0.02) {
        // Skill names may flip above their node, and labels with fallback spots try each in turn,
        // before giving up on a collision.
        const spots: [number, number][] = [[left, top]];
        if (c.kind === 'node') spots.push([left, top - (h + off * 2)]);
        for (const a of c.alts ?? []) {
          const [ax, ay] = toScreen(a.world);
          spots.push([ax - w / 2, topFor(ay, h, a.place, a.offsetY ?? 0)]);
        }
        const free = spots.find(([l, t]) => !this.overlaps(l, t, w, h));
        if (!free) target = 0;
        else {
          [left, top] = free;
          this.placed.push(left, top, left + w, top + h);
        }
      }

      label.seen = true;
      label.rect = [left, top, w, h];
      label.op += (target - label.op) * k;
      label.el.style.transform =
        `translate3d(${left.toFixed(1)}px, ${top.toFixed(1)}px, 0)` + (s === 1 ? '' : ` scale(${s.toFixed(3)})`);
      label.el.style.opacity = label.op.toFixed(3);
      label.el.style.visibility = label.op < 0.01 ? 'hidden' : 'visible';
    }

    for (const l of this.pool.values()) {
      if (l.seen) continue;
      l.op += (0 - l.op) * k;
      l.el.style.opacity = l.op.toFixed(3);
      if (l.op < 0.01) l.el.style.visibility = 'hidden';
    }
  }

  /** The clearly visible clickable label under a screen point, if any. */
  hitTest(x: number, y: number): { kind: LabelKind; id: string } | null {
    let hit: { kind: LabelKind; id: string } | null = null;
    for (const l of this.pool.values()) {
      if (!l.seen || l.op < 0.5 || l.kind === 'tier' || l.kind === 'core') continue;
      const [left, top, w, h] = l.rect;
      if (x >= left - 4 && x <= left + w + 4 && y >= top - 3 && y <= top + h + 3) hit = { kind: l.kind, id: l.id };
    }
    return hit;
  }

  private overlaps(x: number, y: number, w: number, h: number): boolean {
    const p = this.placed;
    const pad = 3;
    for (let i = 0; i < p.length; i += 4) {
      if (x < p[i + 2] + pad && x + w > p[i] - pad && y < p[i + 3] + pad && y + h > p[i + 1] - pad) return true;
    }
    return false;
  }

  private get(c: LabelCandidate): Label {
    const id = c.kind + ':' + c.id;
    let l = this.pool.get(id);
    if (!l) {
      const el = document.createElement('div');
      const text = document.createElement('span');
      const sub = document.createElement('span');
      text.className = 'lbl__t';
      sub.className = 'lbl__s';
      el.append(text, sub);
      el.style.visibility = 'hidden';
      this.layer.appendChild(el);
      l = { kind: c.kind, id: c.id, rect: [0, 0, 0, 0], el, text, sub, key: '', w: 0, h: 0, op: 0, cls: '', seen: false };
      this.pool.set(id, l);
    }
    const states = c.state ? c.state.split(' ').map((s) => ' is-' + s).join('') : '';
    const cls = `lbl lbl--${c.kind}${states}`;
    if (cls !== l.cls) {
      l.el.className = cls;
      l.cls = cls;
      l.key = ''; // a class change can change the size; measure again
    }
    if (c.color) l.el.style.setProperty('--c', c.color);
    const key = c.text + '\u0000' + (c.sub ?? '');
    if (key !== l.key) {
      l.text.textContent = c.text;
      l.sub.textContent = c.sub ?? '';
      l.sub.style.display = c.sub ? '' : 'none';
      l.key = key;
      l.w = l.el.offsetWidth;
      l.h = l.el.offsetHeight;
      // A wrapped name leaves its box at full max-width; collide on the lines actually drawn.
      if (c.kind === 'domain') {
        const ink = Math.max(lineWidth(l.el, l.text), c.sub ? lineWidth(l.el, l.sub) : 0);
        l.w = Math.min(l.w, Math.ceil(ink) + 2);
      }
    }
    return l;
  }

  clear() {
    for (const l of this.pool.values()) l.el.remove();
    this.pool.clear();
  }
}
