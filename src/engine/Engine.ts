// Owns the WebGL renderer and the 2D map. Zoom is continuous and "semantic": what's drawn and
// labelled depends on how tall a tile is on screen, so scrolling into a district reveals its
// hobbies and scrolling into a hobby reveals its skill tree. Clicking selects and frames things.

import './color';
import { LinearSRGBColorSpace, Scene, WebGLRenderer } from 'three';
import { get } from 'svelte/store';
import { galaxy } from '../lib/data';
import { TILE_H, TILE_HEAD_Y, TILE_R, TIER_HEAD_Y } from '../lib/layout';
import { character, progress, type ProgressMap } from '../lib/progress';
import {
  focus,
  hasPartyTricks,
  highlight,
  hover,
  nav,
  openMenu,
  partyMode,
  type Focus,
  type HoverInfo,
} from '../lib/stores';
import { TIER_NAMES, type HobbyEntry } from '../lib/types';
import { Borders } from './Borders';
import { Grid } from './Grid';
import { Labels, type LabelCandidate } from './Labels';
import { MapCamera, type WorldRect } from './MapCamera';
import { pickAt, type Pick } from './Picker';
import { quality } from './quality';
import { SynergyArcs } from './SynergyArcs';
import { Tiles } from './Tiles';
import { Trees } from './Trees';
import { shared } from './uniforms';

const MOBILE_BREAK = 760;
const NODE_R = 3.8; // approximate skill-node radius in world units, for label offsets

/** Smoothstep from 0 at a to 1 at b. */
const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(Math.max((x - a) / (b - a), 0), 1);
  return t * t * (3 - 2 * t);
};

/** Semantic-zoom thresholds, as on-screen tile heights in CSS px. */
const Z = {
  hobbyName: [46, 78],
  districtFar: [28, 46],
  districtHeadOut: [900, 1300],
  treeLoad: 100,
  treeIn: [120, 280],
  tileHead: [150, 230],
  summary: [380, 520],
  tier: [380, 500],
  nodeName: [540, 640],
} as const;

/** World distance between neighbouring district centres; overview names are sized to fit it. */
const DISTRICT_PITCH = (() => {
  const ds = galaxy.domains;
  let best = Infinity;
  for (let i = 0; i < ds.length; i++)
    for (let j = i + 1; j < ds.length; j++)
      best = Math.min(best, Math.hypot(ds[i].pos[0] - ds[j].pos[0], ds[i].pos[1] - ds[j].pos[1]));
  return best;
})();

export class Engine {
  private renderer: WebGLRenderer;
  private scene = new Scene();
  private cam: MapCamera;
  private grid = new Grid();
  private tiles = new Tiles(galaxy);
  private borders = new Borders(galaxy);
  private trees = new Trees(galaxy);
  private arcs = new SynergyArcs(galaxy);
  private labels: Labels;
  private ro: ResizeObserver;

  private w = 1;
  private h = 1;
  private panelW = 420; // the HUD side panel's width, from the --panel-w CSS variable
  private raf = 0;
  private last = 0;
  private f: Focus = get(focus);
  private progressMap: ProgressMap = get(progress);
  private hobbyProgress = new Float32Array(galaxy.hobbies.length);
  private highlightSet: Set<number> | null = null;
  private party = false;
  private level = 1;
  private hovered: Pick | null = null;
  private mouse = { x: 0, y: 0, inside: false, moved: false };
  private stateDirty = true;
  private unsubs: (() => void)[] = [];

  constructor(
    private host: HTMLElement,
    labelLayer: HTMLElement,
  ) {
    this.renderer = new WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.outputColorSpace = LinearSRGBColorSpace; // colours are authored as plain sRGB (see color.ts)
    this.renderer.setPixelRatio(quality.pixelRatio);
    host.appendChild(this.renderer.domElement);
    this.cam = new MapCamera(this.renderer.domElement);
    this.scene.add(this.grid.mesh, this.tiles.mesh, this.borders.line, this.trees.group, this.arcs.group);
    this.labels = new Labels(labelLayer);

    const el = this.renderer.domElement;
    el.addEventListener('pointermove', this.onPointerMove);
    el.addEventListener('pointerup', this.onPointerUp);
    el.addEventListener('pointerleave', this.onPointerLeave);
    addEventListener('keydown', this.onKey);
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(host);
    this.resize();

    // Open slightly zoomed out and ease in to the whole map.
    const home = this.homeView();
    this.cam.jumpTo(home.x, home.y, home.scale * 0.6);
    this.cam.flyTo(home.x, home.y, home.scale);
    if (import.meta.env.DEV) Object.assign(window, { __engine: this });

    this.unsubs.push(
      progress.subscribe((p) => {
        this.progressMap = p;
        this.computeHobbyProgress();
        this.trees.setProgress(p);
      }),
      highlight.subscribe((s) => {
        this.highlightSet = s;
        this.stateDirty = true;
      }),
      partyMode.subscribe((v) => {
        this.party = v;
        this.stateDirty = true;
      }),
      character.subscribe((c) => (this.level = c.level)),
      focus.subscribe((f) => this.onFocus(f)),
    );
  }

  start() {
    this.raf = requestAnimationFrame(this.frame);
  }

  // ------------------------------------------------------------ selection & framing

  private onFocus(f: Focus) {
    this.f = f;
    this.stateDirty = true;
    if (!f.fly) return;
    if (f.level === 'map') {
      const v = this.homeView();
      this.cam.flyTo(v.x, v.y, v.scale);
    } else if (f.level === 'domain') {
      const b = galaxy.domainById.get(f.domain!)!.bounds;
      this.frameRect({ minX: b.minX, maxX: b.maxX, minY: b.minY, maxY: b.maxY + TILE_R * 0.6 });
    } else {
      const h = galaxy.hobbyById.get(f.hobby!)!;
      if (!this.isFramed(h)) {
        this.frameRect({ minX: h.pos[0] - TILE_R, maxX: h.pos[0] + TILE_R, minY: h.pos[1] - TILE_H / 2, maxY: h.pos[1] + TILE_H / 2 });
      }
    }
  }

  private frameRect(rect: WorldRect) {
    const t = this.cam.fit(rect, this.freeRect(this.f.level), 0.9);
    this.cam.flyTo(t.x, t.y, t.scale);
  }

  /** True if the tile is already big and in the clear part of the screen, so selecting it shouldn't move the view. */
  private isFramed(h: HobbyEntry) {
    const r = this.freeRect('hobby');
    const fit = this.cam.fit({ minX: -TILE_R, maxX: TILE_R, minY: -TILE_H / 2, maxY: TILE_H / 2 }, r, 0.9);
    const [sx, sy] = this.cam.worldToScreen(h.pos[0], h.pos[1]);
    return this.cam.scale >= fit.scale * 0.6 && sx > r.x0 && sx < r.x1 && sy > r.y0 && sy < r.y1;
  }

  /** The whole map, fitted to the screen with no panel open. */
  private homeView() {
    return this.cam.fit(galaxy.bounds, this.freeRect('map'), 0.94);
  }

  /** Screen rectangle (CSS px) the HUD leaves free: below the header, beside the panel or above the sheet. */
  private freeRect(level: Focus['level']) {
    const mobile = this.w < MOBILE_BREAK;
    const top = mobile ? 128 : 64;
    if (level === 'map') return { x0: 0, y0: top, x1: this.w, y1: this.h - 28 };
    if (mobile) return { x0: 0, y0: top, x1: this.w, y1: this.h * 0.56 };
    return { x0: 0, y0: top, x1: this.w - this.panelW, y1: this.h - 24 };
  }

  private computeHobbyProgress() {
    const learned = new Map<string, number>();
    for (const [k, v] of Object.entries(this.progressMap)) {
      if (v.s !== 'learned') continue;
      const id = k.slice(0, k.indexOf('/'));
      learned.set(id, (learned.get(id) ?? 0) + 1);
    }
    galaxy.hobbies.forEach((h, i) => {
      const n = h.meta?.nodes ?? 0;
      this.hobbyProgress[i] = n ? Math.min(1, (learned.get(h.id) ?? 0) / n) : 0;
    });
    this.stateDirty = true;
  }

  private applyState() {
    const f = this.f;
    const selDomain = f.domain ? galaxy.domainById.get(f.domain)!.index : -1;
    const selHobby = f.hobby ? galaxy.hobbyById.get(f.hobby)!.index : -1;
    const hv = this.hovered;
    const hoverHobby = hv?.kind === 'hobby' ? hv.index : hv?.kind === 'node' ? hv.hobby! : -1;
    const hoverDomain = hv?.kind === 'domain' ? hv.index : -1;
    const party = this.party;
    const hl = this.highlightSet;
    this.tiles.setState({
      selDomain,
      selHobby,
      hoverDomain,
      hoverHobby,
      hoverHub: hv?.kind === 'core',
      highlight: hl,
      progress: this.hobbyProgress,
      party: (i) => party && hasPartyTricks(i),
    });
    this.borders.setEmphasis(selDomain, hoverDomain >= 0 ? hoverDomain : hoverHobby >= 0 ? galaxy.hobbies[hoverHobby].domainIndex : -1);
    this.trees.setContext({
      selHobby: f.hobby,
      selNode: f.node,
      hoverHobby: hv?.kind === 'node' ? galaxy.hobbies[hv.hobby!].id : null,
      hoverNode: hv?.kind === 'node' ? hv.id : null,
      party,
      dim: (i) => {
        const h = galaxy.hobbies[i];
        let d = 1;
        if (selHobby >= 0 && i !== selHobby) d *= h.domainIndex === selDomain ? 0.7 : 0.45;
        else if (selHobby < 0 && selDomain >= 0 && h.domainIndex !== selDomain) d *= 0.5;
        if (hl && !hl.has(i)) d *= 0.18;
        return d;
      },
    });
    this.stateDirty = false;
  }

  // ------------------------------------------------------------ input

  private local(e: { clientX: number; clientY: number }): [number, number] {
    const r = this.host.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  }

  private onPointerMove = (e: PointerEvent) => {
    [this.mouse.x, this.mouse.y] = this.local(e);
    this.mouse.inside = e.pointerType !== 'touch';
    this.mouse.moved = true;
  };

  private onPointerLeave = () => {
    this.mouse.inside = false;
    this.mouse.moved = true;
  };

  private onPointerUp = (e: PointerEvent) => {
    if (this.cam.dragged || this.cam.multiTouch || e.button !== 0) return;
    const [x, y] = this.local(e);
    const p = this.pickAt(x, y);
    if (!p) {
      if (this.f.level !== 'map') nav.home(false); // clicking empty space closes the panel
    } else if (p.kind === 'core') openMenu.set('character');
    else if (p.kind === 'domain') nav.domain(p.id);
    else if (p.kind === 'hobby') nav.hobby(p.id);
    else nav.hobby(galaxy.hobbies[p.hobby!].id, p.id);
  };

  private onKey = (e: KeyboardEvent) => {
    const t = e.target as HTMLElement | null;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
    if (e.key === 'Escape') nav.up();
    else if (e.key === '+' || e.key === '=') this.cam.zoomAt(this.w / 2, this.h / 2, 1.6);
    else if (e.key === '-' || e.key === '_') this.cam.zoomAt(this.w / 2, this.h / 2, 1 / 1.6);
    else if (e.key === '0') nav.home(true);
  };

  /** Labels are hit-tested first (they're the easiest thing to aim at), then the map itself. */
  private pickAt(x: number, y: number): Pick | null {
    const l = this.labels.hitTest(x, y);
    if (l?.kind === 'domain' || l?.kind === 'district') {
      const d = galaxy.domainById.get(l.id);
      if (d) return { kind: 'domain', id: d.id, index: d.index };
    } else if (l?.kind === 'hobby' || l?.kind === 'tile-head' || l?.kind === 'summary') {
      const h = galaxy.hobbyById.get(l.id);
      if (h) return { kind: 'hobby', id: h.id, index: h.index };
    } else if (l?.kind === 'node') {
      const [hobbyId, nodeId] = l.id.split('/');
      const h = galaxy.hobbyById.get(hobbyId);
      const j = h ? (this.trees.get(h.index)?.tree.nodes.findIndex((n) => n.id === nodeId) ?? -1) : -1;
      if (h && j >= 0) return { kind: 'node', id: nodeId, index: j, hobby: h.index };
    }
    const [wx, wy] = this.cam.screenToWorld(x, y);
    const tilePx = TILE_H * this.cam.scale;
    return pickAt(galaxy, this.trees, wx, wy, this.cam.scale, tilePx, smooth(Z.treeIn[0], Z.treeIn[1], tilePx));
  }

  private updateHover(cameraMoved: boolean) {
    if (!this.mouse.moved && !cameraMoved) return;
    const p = this.mouse.inside && !this.cam.flying ? this.pickAt(this.mouse.x, this.mouse.y) : null;
    const same = p?.kind === this.hovered?.kind && p?.id === this.hovered?.id && p?.hobby === this.hovered?.hobby;
    if (!same) {
      this.hovered = p;
      this.stateDirty = true;
      this.renderer.domElement.style.cursor = p ? 'pointer' : '';
    }
    if (!same || (p && this.mouse.moved)) hover.set(p ? this.hoverInfo(p) : null);
    this.mouse.moved = false;
    this.arcs.show(this.hovered?.kind === 'hobby' ? this.hovered.index : -1);
  }

  private hoverInfo(p: Pick): HoverInfo {
    const info: HoverInfo = { kind: p.kind, id: p.id, x: this.mouse.x, y: this.mouse.y };
    if (p.kind !== 'node') return info;
    const b = this.trees.get(p.hobby!)!;
    const node = b.tree.nodes[p.index];
    return { ...info, hobby: b.hobby.id, name: node.name, tier: node.tier, hours: node.hours };
  }

  // ------------------------------------------------------------ frame

  private frame = (now: number) => {
    this.raf = requestAnimationFrame(this.frame);
    const dt = this.last ? Math.min(0.1, (now - this.last) / 1000) : 1 / 60;
    this.last = now;
    shared.uTime.value = now / 1000;

    const moved = this.cam.update(dt, now);
    const scale = this.cam.scale;
    shared.uScale.value = scale;
    this.grid.update(this.cam.x, this.cam.y, scale, this.w, this.h);
    const tilePx = TILE_H * scale;
    const view = this.cam.view();

    // Load the trees of charted tiles that are on screen and big enough to show them.
    if (tilePx > Z.treeLoad) this.trees.require(this.visibleHobbies(view, true).map((h) => h.index), now);

    this.updateHover(moved);
    if (this.stateDirty) this.applyState();
    this.tiles.update(dt);
    this.trees.update(smooth(Z.treeIn[0], Z.treeIn[1], tilePx));
    this.arcs.update(dt);
    this.labels.update(this.labelCandidates(tilePx, view), this.cam.camera, this.w, this.h, dt);
    this.renderer.render(this.scene, this.cam.camera);
  };

  private visibleHobbies(view: WorldRect, chartedOnly: boolean): HobbyEntry[] {
    return galaxy.hobbies.filter(
      (h) =>
        (!chartedOnly || h.charted) &&
        h.pos[0] + TILE_R > view.minX &&
        h.pos[0] - TILE_R < view.maxX &&
        h.pos[1] + TILE_H / 2 > view.minY &&
        h.pos[1] - TILE_H / 2 < view.maxY,
    );
  }

  private labelCandidates(z: number, view: WorldRect): LabelCandidate[] {
    const out: LabelCandidate[] = [];
    const f = this.f;
    const hv = this.hovered;
    const hl = this.highlightSet;
    const margin = TILE_R * 2;

    out.push({
      id: 'core',
      kind: 'core',
      text: 'YOU',
      sub: `LVL ${this.level}`,
      world: [0, 0],
      priority: 115, // below populated districts' names, above empty ones
      opacity: 1,
      state: hv?.kind === 'core' ? 'hover' : undefined,
    });

    // Districts: big names when zoomed out, then a header above the honeycomb. Zoomed out, each
    // name sits on its own honeycomb so it can't be read as a neighbour's, shrinking on small
    // screens so names fit side by side; it hands over to the header before hobby names appear.
    const farScale = Math.min(1, Math.max(0.7, (DISTRICT_PITCH * z) / TILE_H / 165));
    const farOp = 1 - smooth(Z.districtFar[0], Z.districtFar[1], z);
    const headOp = smooth(Z.districtFar[0], Z.districtFar[1], z) * (1 - smooth(Z.districtHeadOut[0], Z.districtHeadOut[1], z));
    for (const d of galaxy.domains) {
      const b = d.bounds;
      if (b.maxX < view.minX - margin || b.minX > view.maxX + margin || b.maxY < view.minY - margin || b.minY > view.maxY + margin) continue;
      const n = d.hobbies.length;
      const isHover = hv?.kind === 'domain' && hv.index === d.index;
      const emphasis = (f.domain === d.id ? 60 : 0) + (isHover ? 80 : 0);
      const fade = n ? 1 : 0.6;
      const state = isHover ? 'hover' : undefined;
      if (farOp > 0.01) {
        out.push({
          id: d.id,
          kind: 'domain',
          text: d.name,
          sub: n ? `${n} hobbies` : 'uncharted',
          world: [d.pos[0], d.pos[1]],
          place: 'middle',
          scale: farScale,
          alts: [
            { world: [d.pos[0], b.maxY], place: 'above', offsetY: 4 },
            { world: [d.pos[0], b.minY], place: 'below', offsetY: 4 },
          ],
          priority: 100 + (n ? 20 : 0) + emphasis,
          opacity: farOp * fade,
          color: d.color,
          state,
        });
      }
      if (headOp > 0.01) {
        out.push({
          id: d.id,
          kind: 'district',
          text: d.name,
          sub: d.code,
          world: [d.pos[0], b.maxY],
          place: 'above',
          offsetY: 8,
          alts: [{ world: [d.pos[0], b.minY], place: 'below', offsetY: 8 }],
          priority: 90 + emphasis,
          opacity: headOp * fade,
          color: d.color,
          state,
        });
      }
    }

    // Hobby tiles: a name in the middle, which moves to the top edge once the tree takes over.
    const nameOp = smooth(Z.hobbyName[0], Z.hobbyName[1], z);
    const headIn = smooth(Z.tileHead[0], Z.tileHead[1], z);
    const summaryOp = smooth(Z.summary[0], Z.summary[1], z);
    if (nameOp > 0.01) {
      for (const h of this.visibleHobbies(view, false)) {
        const color = galaxy.domains[h.domainIndex].color;
        const dim = hl && !hl.has(h.index) ? 0.3 : 1;
        const isHover = hv?.kind === 'hobby' && hv.index === h.index;
        const isSel = f.hobby === h.id;
        const states = [h.charted ? 'charted' : 'uncharted'];
        if (isHover) states.push('hover');
        if (isSel) states.push('selected');
        const boost = isSel || isHover ? 1000 : 0;
        const built = this.trees.get(h.index) !== undefined;
        const centre = nameOp * (built ? 1 - headIn : 1);
        if (centre > 0.01) {
          out.push({
            id: h.id,
            kind: 'hobby',
            text: h.name,
            sub: h.charted ? `${h.meta!.nodes} skills` : 'uncharted',
            world: h.pos,
            priority: 200 + h.pop * 5 + boost,
            opacity: centre * dim,
            color,
            state: states.join(' '),
          });
        }
        if (built && headIn > 0.01) {
          out.push({
            id: h.id,
            kind: 'tile-head',
            text: h.name,
            world: [h.pos[0], h.pos[1] + TILE_HEAD_Y],
            priority: 600 + boost,
            opacity: headIn * dim,
            color,
            state: states.join(' '),
          });
        }
        if (!h.charted && summaryOp > 0.01) {
          out.push({
            id: h.id,
            kind: 'summary',
            text: h.summary,
            sub: 'Full skill tree arrives in a later wave',
            world: [h.pos[0], h.pos[1] - 16],
            place: 'below',
            priority: 150 + boost,
            opacity: summaryOp * dim,
          });
        }
      }
    }

    // Skill trees: tier headings, then skill names once there's room for them.
    const tierOp = smooth(Z.tier[0], Z.tier[1], z);
    const nodeOp = smooth(Z.nodeName[0], Z.nodeName[1], z);
    if (tierOp > 0.01) {
      for (const h of this.visibleHobbies(view, true)) {
        const b = this.trees.get(h.index);
        if (!b) continue;
        const dim = hl && !hl.has(h.index) ? 0.3 : 1;
        for (const t of b.layout.tiers) {
          out.push({
            id: `${h.id}/tier${t.tier}`,
            kind: 'tier',
            text: TIER_NAMES[t.tier - 1],
            world: [h.pos[0] + t.x, h.pos[1] + TIER_HEAD_Y],
            priority: 160,
            opacity: tierOp * dim,
          });
        }
        if (nodeOp < 0.01) continue;
        b.tree.nodes.forEach((node, j) => {
          const x = b.world[j * 2];
          const y = b.world[j * 2 + 1];
          if (x < view.minX || x > view.maxX || y < view.minY || y > view.maxY) return;
          const isSel = f.hobby === h.id && f.node === node.id;
          const isHover = hv?.kind === 'node' && hv.hobby === h.index && hv.id === node.id;
          const states: string[] = [b.states[j]];
          if (isSel) states.push('selected');
          if (isHover) states.push('hover');
          if (this.party && node.partyTrick !== undefined) states.push('party');
          const [sx, sy] = this.cam.worldToScreen(x, y);
          out.push({
            id: `${h.id}/${node.id}`,
            kind: 'node',
            text: node.name,
            world: [x, y],
            place: 'below',
            offsetY: NODE_R * this.cam.scale + 3,
            // Selected and hovered first, then whatever is nearest the middle of the screen.
            priority: 300 - Math.hypot(sx - this.w / 2, sy - this.h / 2) / 40 + (isSel ? 1000 : 0) + (isHover ? 900 : 0),
            opacity: nodeOp * dim * (this.party && node.partyTrick === undefined ? 0.4 : 1),
            state: states.join(' '),
          });
        });
      }
    }
    return out;
  }

  // ------------------------------------------------------------ lifecycle

  private resize() {
    const r = this.host.getBoundingClientRect();
    this.w = Math.max(1, Math.round(r.width));
    this.h = Math.max(1, Math.round(r.height));
    this.panelW = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--panel-w')) || 420;
    this.renderer.setSize(this.w, this.h);
    this.cam.setViewport(this.w, this.h);
    this.cam.minScale = this.homeView().scale * 0.6;
    this.cam.maxScale = 16;
    const b = galaxy.bounds;
    const m = 600;
    this.cam.limits = { minX: b.minX - m, maxX: b.maxX + m, minY: b.minY - m, maxY: b.maxY + m };
    this.borders.setResolution(this.w, this.h);
    this.trees.setResolution(this.w, this.h);
    this.arcs.setResolution(this.w, this.h);
  }

  dispose() {
    cancelAnimationFrame(this.raf);
    this.unsubs.forEach((u) => u());
    this.ro.disconnect();
    removeEventListener('keydown', this.onKey);
    const el = this.renderer.domElement;
    el.removeEventListener('pointermove', this.onPointerMove);
    el.removeEventListener('pointerup', this.onPointerUp);
    el.removeEventListener('pointerleave', this.onPointerLeave);
    this.cam.dispose();
    this.labels.clear();
    this.grid.dispose();
    this.tiles.dispose();
    this.borders.dispose();
    this.trees.dispose();
    this.arcs.dispose();
    this.renderer.dispose();
    el.remove();
  }
}
