// Map-style 2D camera: wheel zooms smoothly around the cursor, drag pans with inertia,
// pinch zooms on touch, and flights use van Wijk & Nuij's smooth zoom-pan path.

import { OrthographicCamera } from 'three';

export interface WorldRect {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

const RHO = Math.SQRT2;
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi);

interface Flight {
  start: number;
  duration: number;
  path: (t: number) => [number, number, number]; // → [x, y, view height in world units]
}

export class MapCamera {
  readonly camera = new OrthographicCamera(-1, 1, 1, -1, -10, 10);
  /** World point at the centre of the screen. */
  x = 0;
  y = 0;
  /** CSS pixels per world unit. */
  scale = 0.1;
  minScale = 0.01;
  maxScale = 20;
  /** Where the camera may wander; the view centre is kept inside these bounds. */
  limits: WorldRect | null = null;
  /** True once the current press has moved far enough to count as a drag rather than a click. */
  dragged = false;
  /** True if the current gesture has used two fingers. */
  multiTouch = false;
  lastInput = 0;

  private w = 1;
  private h = 1;
  private zoomGoal: { scale: number; sx: number; sy: number; wx: number; wy: number } | null = null;
  private vel = { x: 0, y: 0 };
  private flight: Flight | null = null;
  private pointers = new Map<number, { x: number; y: number }>();
  private drag: { id: number; startX: number; startY: number; lastX: number; lastY: number; samples: [number, number, number][] } | null = null;
  private pinch: { dist: number; scale: number; wx: number; wy: number } | null = null;

  constructor(private dom: HTMLElement) {
    dom.addEventListener('wheel', this.onWheel, { passive: false });
    dom.addEventListener('pointerdown', this.onDown);
    dom.addEventListener('pointermove', this.onMove);
    dom.addEventListener('pointerup', this.onUp);
    dom.addEventListener('pointercancel', this.onUp);
    dom.addEventListener('dblclick', this.onDblClick);
  }

  get flying() {
    return this.flight !== null;
  }

  setViewport(w: number, h: number) {
    this.w = w;
    this.h = h;
    this.apply();
  }

  screenToWorld(sx: number, sy: number): [number, number] {
    return [this.x + (sx - this.w / 2) / this.scale, this.y - (sy - this.h / 2) / this.scale];
  }

  worldToScreen(wx: number, wy: number): [number, number] {
    return [(wx - this.x) * this.scale + this.w / 2, (this.y - wy) * this.scale + this.h / 2];
  }

  /** The world-space rectangle currently on screen. */
  view(): WorldRect {
    const hw = this.w / 2 / this.scale;
    const hh = this.h / 2 / this.scale;
    return { minX: this.x - hw, maxX: this.x + hw, minY: this.y - hh, maxY: this.y + hh };
  }

  /** Smoothly zoom by `factor`, keeping the world point under (sx, sy) fixed on screen. */
  zoomAt(sx: number, sy: number, factor: number) {
    const base = this.zoomGoal?.scale ?? this.scale;
    const [wx, wy] = this.screenToWorld(sx, sy);
    this.zoomGoal = { scale: clamp(base * factor, this.minScale, this.maxScale), sx, sy, wx, wy };
    this.flight = null;
    this.lastInput = performance.now();
  }

  jumpTo(x: number, y: number, scale: number) {
    this.flight = null;
    this.zoomGoal = null;
    this.vel = { x: 0, y: 0 };
    this.x = x;
    this.y = y;
    this.scale = clamp(scale, this.minScale, this.maxScale);
    this.apply();
  }

  /** Animate to centre (x, y) at `scale` along a smooth zoom-pan path. */
  flyTo(x: number, y: number, scale: number) {
    scale = clamp(scale, this.minScale, this.maxScale);
    const p0: [number, number, number] = [this.x, this.y, this.h / this.scale];
    const p1: [number, number, number] = [x, y, this.h / scale];
    const { path, length } = smoothZoomPath(p0, p1);
    this.flight = { start: performance.now(), duration: clamp(length * 420, 380, 1500), path };
    this.zoomGoal = null;
    this.vel = { x: 0, y: 0 };
  }

  /** The centre and scale that fit a world rectangle inside a screen rectangle (CSS px). */
  fit(rect: WorldRect, screen: { x0: number; y0: number; x1: number; y1: number }, padding = 0.88) {
    const sw = Math.max(40, screen.x1 - screen.x0);
    const sh = Math.max(40, screen.y1 - screen.y0);
    const scale = clamp(Math.min(sw / (rect.maxX - rect.minX), sh / (rect.maxY - rect.minY)) * padding, this.minScale, this.maxScale);
    const cx = (rect.minX + rect.maxX) / 2;
    const cy = (rect.minY + rect.maxY) / 2;
    // Put the rect's centre at the centre of the screen rectangle.
    return {
      x: cx - ((screen.x0 + screen.x1) / 2 - this.w / 2) / scale,
      y: cy + ((screen.y0 + screen.y1) / 2 - this.h / 2) / scale,
      scale,
    };
  }

  /** Advance animations; returns true if the view changed. */
  update(dt: number, now: number): boolean {
    let changed = false;
    if (this.flight) {
      const t = Math.min(1, (now - this.flight.start) / this.flight.duration);
      const [x, y, viewH] = this.flight.path(easeInOut(t));
      this.x = x;
      this.y = y;
      this.scale = this.h / viewH;
      if (t >= 1) this.flight = null;
      changed = true;
    } else {
      const g = this.zoomGoal;
      if (g) {
        const k = 1 - Math.exp(-dt * 16);
        this.scale = Math.exp(Math.log(this.scale) + (Math.log(g.scale) - Math.log(this.scale)) * k);
        if (Math.abs(Math.log(g.scale / this.scale)) < 0.002) {
          this.scale = g.scale;
          this.zoomGoal = null;
        }
        // Keep the anchor exactly under the cursor while the zoom eases.
        this.x = g.wx - (g.sx - this.w / 2) / this.scale;
        this.y = g.wy + (g.sy - this.h / 2) / this.scale;
        changed = true;
      }
      if (!this.drag && (this.vel.x || this.vel.y)) {
        this.x += this.vel.x * dt;
        this.y += this.vel.y * dt;
        const decay = Math.exp(-dt * 4.5);
        this.vel.x *= decay;
        this.vel.y *= decay;
        if (Math.hypot(this.vel.x, this.vel.y) * this.scale < 8) this.vel = { x: 0, y: 0 };
        changed = true;
      }
    }
    if (changed) this.apply();
    return changed;
  }

  private apply() {
    if (this.limits) {
      this.x = clamp(this.x, this.limits.minX, this.limits.maxX);
      this.y = clamp(this.y, this.limits.minY, this.limits.maxY);
    }
    const c = this.camera;
    const hw = this.w / 2 / this.scale;
    const hh = this.h / 2 / this.scale;
    c.left = -hw;
    c.right = hw;
    c.top = hh;
    c.bottom = -hh;
    c.position.set(this.x, this.y, 5);
    c.updateProjectionMatrix();
    c.updateMatrixWorld();
  }

  // ------------------------------------------------------------ input

  private local(e: { clientX: number; clientY: number }): [number, number] {
    const r = this.dom.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  }

  private onWheel = (e: WheelEvent) => {
    e.preventDefault();
    const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 100 : 1;
    const dx = e.deltaX * unit;
    const dy = e.deltaY * unit;
    if (Math.abs(dx) > Math.abs(dy) && !e.ctrlKey) {
      // Sideways trackpad swipes pan rather than zoom.
      this.x += dx / this.scale;
      this.flight = null;
      this.apply();
      this.lastInput = performance.now();
      return;
    }
    const [sx, sy] = this.local(e);
    // Trackpad pinch arrives as ctrl+wheel with small deltas.
    this.zoomAt(sx, sy, Math.exp(-dy * (e.ctrlKey ? 0.01 : 0.0016)));
  };

  private onDown = (e: PointerEvent) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    this.dom.setPointerCapture(e.pointerId);
    const [x, y] = this.local(e);
    this.pointers.set(e.pointerId, { x, y });
    this.flight = null;
    this.zoomGoal = null;
    this.vel = { x: 0, y: 0 };
    if (this.pointers.size === 1) {
      this.dragged = false;
      this.multiTouch = false;
      this.drag = { id: e.pointerId, startX: x, startY: y, lastX: x, lastY: y, samples: [] };
    } else if (this.pointers.size === 2) {
      this.multiTouch = true;
      this.drag = null;
      this.startPinch();
    }
  };

  private startPinch() {
    const [a, b] = [...this.pointers.values()];
    const [wx, wy] = this.screenToWorld((a.x + b.x) / 2, (a.y + b.y) / 2);
    this.pinch = { dist: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)), scale: this.scale, wx, wy };
  }

  private onMove = (e: PointerEvent) => {
    const p = this.pointers.get(e.pointerId);
    if (!p) return;
    [p.x, p.y] = this.local(e);
    const now = performance.now();
    if (this.pinch && this.pointers.size >= 2) {
      const [a, b] = [...this.pointers.values()];
      const mx = (a.x + b.x) / 2;
      const my = (a.y + b.y) / 2;
      this.scale = clamp((this.pinch.scale * Math.hypot(a.x - b.x, a.y - b.y)) / this.pinch.dist, this.minScale, this.maxScale);
      this.x = this.pinch.wx - (mx - this.w / 2) / this.scale;
      this.y = this.pinch.wy + (my - this.h / 2) / this.scale;
      this.dragged = true;
      this.lastInput = now;
      this.apply();
      return;
    }
    const d = this.drag;
    if (!d || d.id !== e.pointerId) return;
    if (!this.dragged && Math.hypot(p.x - d.startX, p.y - d.startY) > 5) this.dragged = true;
    if (this.dragged) {
      const dx = p.x - d.lastX;
      const dy = p.y - d.lastY;
      this.x -= dx / this.scale;
      this.y += dy / this.scale;
      d.samples.push([now, dx, dy]);
      while (d.samples.length && now - d.samples[0][0] > 90) d.samples.shift();
      this.lastInput = now;
      this.apply();
    }
    d.lastX = p.x;
    d.lastY = p.y;
  };

  private onUp = (e: PointerEvent) => {
    if (!this.pointers.delete(e.pointerId)) return;
    const d = this.drag;
    if (d && d.id === e.pointerId && this.dragged && d.samples.length > 1) {
      // Fling: carry on at the speed of the last ~90 ms of movement.
      const span = Math.max(16, performance.now() - d.samples[0][0]) / 1000;
      const sx = d.samples.reduce((s, v) => s + v[1], 0);
      const sy = d.samples.reduce((s, v) => s + v[2], 0);
      this.vel = { x: -sx / span / this.scale, y: sy / span / this.scale };
    }
    if (d && d.id === e.pointerId) this.drag = null;
    if (this.pointers.size < 2) this.pinch = null;
    if (this.pointers.size === 1) {
      // Lifting one finger of a pinch hands over to a one-finger drag.
      const [id, p] = [...this.pointers.entries()][0];
      this.drag = { id, startX: p.x, startY: p.y, lastX: p.x, lastY: p.y, samples: [] };
    }
  };

  private onDblClick = (e: MouseEvent) => {
    const [sx, sy] = this.local(e);
    this.zoomAt(sx, sy, e.shiftKey ? 1 / 2.4 : 2.4);
  };

  dispose() {
    const dom = this.dom;
    dom.removeEventListener('wheel', this.onWheel);
    dom.removeEventListener('pointerdown', this.onDown);
    dom.removeEventListener('pointermove', this.onMove);
    dom.removeEventListener('pointerup', this.onUp);
    dom.removeEventListener('pointercancel', this.onUp);
    dom.removeEventListener('dblclick', this.onDblClick);
  }
}

/**
 * Smooth zoom-pan path between two views (van Wijk & Nuij 2003, as in d3.interpolateZoom).
 * Views are [x, y, w] where w is the visible extent in world units. Returns the path and its
 * length in "zoom units", which is proportional to how long the flight should take.
 */
function smoothZoomPath(p0: [number, number, number], p1: [number, number, number]) {
  const [ux0, uy0, w0] = p0;
  const [ux1, uy1, w1] = p1;
  const dx = ux1 - ux0;
  const dy = uy1 - uy0;
  const d2 = dx * dx + dy * dy;
  if (d2 < 1e-6) {
    const S = Math.log(w1 / w0) / RHO;
    return {
      length: Math.abs(S),
      path: (t: number): [number, number, number] => [ux0 + t * dx, uy0 + t * dy, w0 * Math.exp(RHO * t * S)],
    };
  }
  const d1 = Math.sqrt(d2);
  const b0 = (w1 * w1 - w0 * w0 + RHO ** 4 * d2) / (2 * w0 * RHO ** 2 * d1);
  const b1 = (w1 * w1 - w0 * w0 - RHO ** 4 * d2) / (2 * w1 * RHO ** 2 * d1);
  const r0 = Math.log(Math.sqrt(b0 * b0 + 1) - b0);
  const r1 = Math.log(Math.sqrt(b1 * b1 + 1) - b1);
  const S = (r1 - r0) / RHO;
  return {
    length: Math.abs(S),
    path: (t: number): [number, number, number] => {
      const s = t * S;
      const coshr0 = Math.cosh(r0);
      const u = (w0 / (RHO ** 2 * d1)) * (coshr0 * Math.tanh(RHO * s + r0) - Math.sinh(r0));
      return [ux0 + u * dx, uy0 + u * dy, (w0 * coshr0) / Math.cosh(RHO * s + r0)];
    },
  };
}
