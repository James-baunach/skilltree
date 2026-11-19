// Skill trees drawn inside hobby tiles, Novice → Master from left to right, joined by
// circuit traces. Trees load lazily as their tiles come into view at a readable size and
// fade in with zoom, so scrolling into a hobby simply reveals its tree.

import {
  BufferAttribute,
  Color,
  CustomBlending,
  Group,
  InstancedBufferAttribute,
  InstancedBufferGeometry,
  Mesh,
  OneFactor,
  OneMinusSrcAlphaFactor,
  ShaderMaterial,
} from 'three';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { LineSegments2 } from 'three/addons/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js';
import { loadTree, type Galaxy } from '../lib/data';
import { layoutTileTree, TILE_R, type TileTree } from '../lib/layout';
import { nodeKey, type ProgressMap } from '../lib/progress';
import type { HobbyEntry, SkillTree } from '../lib/types';
import { nodeFrag, nodeVert } from './shaders';
import { shared } from './uniforms';

export type NodeVisual = 'locked' | 'available' | 'learning' | 'learned';

const STATE_COLOR: Record<NodeVisual, Color> = {
  locked: new Color('#7083a8'),
  available: new Color('#2ee6ff'),
  learning: new Color('#ff3fd8'),
  learned: new Color('#ffc65c'),
};
const STATE_FILL: Record<NodeVisual, number> = { locked: 0.1, available: 0.2, learning: 0.45, learned: 0.9 };
const STATE_LINE: Record<NodeVisual, number> = { locked: 0.6, available: 1, learning: 1, learned: 1 };
const TRACE_GOLD = new Color('#ffc65c').multiplyScalar(0.95);
const TRACE_LIVE = new Color('#2ee6ff').multiplyScalar(0.7);
const TRACE_DIM = new Color('#7083a8').multiplyScalar(0.42);
const NODE_R = 3.6; // node circumradius in tile-local units
const UNIT = TILE_R / 100; // layouts are authored for a tile of radius 100
const MAX_BUILT = 48;

interface BuiltTree {
  hobby: HobbyEntry;
  tree: SkillTree;
  layout: TileTree;
  nodes: Mesh<InstancedBufferGeometry, ShaderMaterial>;
  traces: LineSegments2;
  traceOfSegment: number[];
  world: Float32Array; // node centres, xy per node in tree order
  states: NodeVisual[];
  used: number;
}

/** What the trees need to know about the rest of the app to draw themselves. */
export interface TreeContext {
  selHobby: string | null;
  selNode: string | null;
  hoverHobby: string | null;
  hoverNode: string | null;
  party: boolean;
  dim: (hobby: number) => number;
}

type Channel = 'iColor' | 'iFill' | 'iLine' | 'iRing' | 'iPulse' | 'iDim';

export class Trees {
  readonly group = new Group();
  private built = new Map<number, BuiltTree>();
  private loading = new Set<number>();
  private readonly nodeMat: ShaderMaterial;
  private readonly traceMat: LineMaterial;
  private progress: ProgressMap = {};
  private ctx: TreeContext = { selHobby: null, selNode: null, hoverHobby: null, hoverNode: null, party: false, dim: () => 1 };
  private dirty = false;

  constructor(private g: Galaxy) {
    this.nodeMat = new ShaderMaterial({
      vertexShader: nodeVert,
      fragmentShader: nodeFrag,
      uniforms: { uScale: shared.uScale, uTime: shared.uTime, uAlpha: { value: 0 } },
      transparent: true,
      depthTest: false,
      depthWrite: false,
      blending: CustomBlending,
      blendSrc: OneFactor,
      blendDst: OneMinusSrcAlphaFactor,
    });
    this.traceMat = new LineMaterial({ vertexColors: true, linewidth: 1.3, transparent: true, depthTest: false, depthWrite: false });
  }

  get(hobby: number) {
    return this.built.get(hobby);
  }

  /** Load and build the trees for these hobbies if they aren't already. */
  require(hobbies: number[], now: number) {
    for (const i of hobbies) {
      const b = this.built.get(i);
      if (b) {
        b.used = now;
        continue;
      }
      if (this.loading.has(i)) continue;
      this.loading.add(i);
      loadTree(this.g.hobbies[i].id).then((tree) => {
        this.loading.delete(i);
        if (tree && !this.built.has(i)) this.build(i, tree, performance.now());
      });
    }
    if (this.built.size > MAX_BUILT) this.evict(now);
  }

  private build(i: number, tree: SkillTree, now: number) {
    const hobby = this.g.hobbies[i];
    const layout = layoutTileTree(tree);
    const [hx, hy] = hobby.pos;
    const n = tree.nodes.length;
    const count = n + 1; // every skill, plus the port where the hobby feeds its roots
    const world = new Float32Array(n * 2);
    const pos = new Float32Array(count * 2);
    const size = new Float32Array(count);
    const shape = new Float32Array(count);
    tree.nodes.forEach((node, j) => {
      const [lx, ly] = layout.pos.get(node.id)!;
      world[j * 2] = hx + lx * UNIT;
      world[j * 2 + 1] = hy + ly * UNIT;
      size[j] = NODE_R * UNIT * (0.85 + node.tier * 0.06);
      shape[j] = node.partyTrick !== undefined ? 1 : 0;
    });
    pos.set(world);
    pos.set([hx + layout.port[0] * UNIT, hy + layout.port[1] * UNIT], n * 2);
    size[n] = NODE_R * UNIT * 0.8;
    shape[n] = 1;

    const geo = new InstancedBufferGeometry();
    geo.setAttribute('position', new BufferAttribute(new Float32Array([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0]), 3));
    geo.setIndex([0, 1, 2, 0, 2, 3]);
    geo.setAttribute('iPos', new InstancedBufferAttribute(pos, 2));
    geo.setAttribute('iSize', new InstancedBufferAttribute(size, 1));
    geo.setAttribute('iShape', new InstancedBufferAttribute(shape, 1));
    geo.setAttribute('iColor', new InstancedBufferAttribute(new Float32Array(count * 3), 3));
    for (const ch of ['iFill', 'iLine', 'iRing', 'iPulse', 'iDim'] as Channel[]) {
      geo.setAttribute(ch, new InstancedBufferAttribute(new Float32Array(count), 1));
    }
    geo.instanceCount = count;
    const nodes = new Mesh(geo, this.nodeMat);
    nodes.frustumCulled = false;
    nodes.renderOrder = 6;

    const seg: number[] = [];
    const traceOfSegment: number[] = [];
    layout.traces.forEach((t, ti) => {
      for (let p = 0; p + 3 < t.pts.length; p += 2) {
        seg.push(hx + t.pts[p] * UNIT, hy + t.pts[p + 1] * UNIT, 0, hx + t.pts[p + 2] * UNIT, hy + t.pts[p + 3] * UNIT, 0);
        traceOfSegment.push(ti);
      }
    });
    const lgeo = new LineSegmentsGeometry();
    lgeo.setPositions(seg);
    lgeo.setColors(new Float32Array(seg.length));
    const traces = new LineSegments2(lgeo, this.traceMat);
    traces.frustumCulled = false;
    traces.renderOrder = 5;

    this.group.add(traces, nodes);
    const b: BuiltTree = { hobby, tree, layout, nodes, traces, traceOfSegment, world, states: [], used: now };
    this.built.set(i, b);
    this.refresh(b);
  }

  /** Drop the least recently needed trees once too many are built. */
  private evict(now: number) {
    const old = [...this.built.entries()].filter(([, b]) => now - b.used > 2000).sort((a, b) => a[1].used - b[1].used);
    while (this.built.size > MAX_BUILT && old.length) {
      const [i, b] = old.shift()!;
      this.group.remove(b.nodes, b.traces);
      b.nodes.geometry.dispose();
      b.traces.geometry.dispose();
      this.built.delete(i);
    }
  }

  setProgress(p: ProgressMap) {
    this.progress = p;
    this.dirty = true;
  }

  setContext(ctx: TreeContext) {
    const c = this.ctx;
    if (
      c.selHobby === ctx.selHobby &&
      c.selNode === ctx.selNode &&
      c.hoverHobby === ctx.hoverHobby &&
      c.hoverNode === ctx.hoverNode &&
      c.party === ctx.party &&
      c.dim === ctx.dim
    )
      return;
    this.ctx = ctx;
    this.dirty = true;
  }

  /** Mark styling stale, e.g. when filters change what each tile's dim factor is. */
  invalidate() {
    this.dirty = true;
  }

  private refresh(b: BuiltTree) {
    const { hobby, tree } = b;
    const learned = (id: string) => this.progress[nodeKey(hobby.id, id)]?.s === 'learned';
    const ctx = this.ctx;
    const dim = ctx.dim(hobby.index);
    const geo = b.nodes.geometry;
    const attr = (name: Channel) => geo.getAttribute(name) as InstancedBufferAttribute;
    const color = attr('iColor').array as Float32Array;
    const fill = attr('iFill').array as Float32Array;
    const line = attr('iLine').array as Float32Array;
    const ring = attr('iRing').array as Float32Array;
    const pulse = attr('iPulse').array as Float32Array;
    const dims = attr('iDim').array as Float32Array;

    b.states = tree.nodes.map((node, j) => {
      const p = this.progress[nodeKey(hobby.id, node.id)];
      const state: NodeVisual =
        p?.s === 'learned' ? 'learned' : p?.s === 'learning' ? 'learning' : node.requires.every(learned) ? 'available' : 'locked';
      const isParty = node.partyTrick !== undefined;
      const c = isParty && ctx.party && state !== 'learned' ? STATE_COLOR.learned : STATE_COLOR[state];
      color.set([c.r, c.g, c.b], j * 3);
      fill[j] = STATE_FILL[state];
      line[j] = STATE_LINE[state];
      const selected = ctx.selHobby === hobby.id && ctx.selNode === node.id;
      const hovered = ctx.hoverHobby === hobby.id && ctx.hoverNode === node.id;
      ring[j] = selected ? 1 : hovered ? 0.55 : 0;
      pulse[j] = state === 'learning' || (ctx.party && isParty) ? 1 : 0;
      dims[j] = dim * (ctx.party && !isParty ? 0.3 : 1);
      return state;
    });
    const n = tree.nodes.length;
    const port = new Color(this.g.domains[hobby.domainIndex].color);
    color.set([port.r, port.g, port.b], n * 3);
    fill[n] = 0.6;
    line[n] = 1;
    ring[n] = 0;
    pulse[n] = 0;
    dims[n] = dim;
    for (const name of ['iColor', 'iFill', 'iLine', 'iRing', 'iPulse', 'iDim'] as Channel[]) attr(name).needsUpdate = true;

    const stateOf = new Map(tree.nodes.map((node, j) => [node.id, b.states[j]]));
    const traceColor = b.layout.traces.map((t) => {
      const fromDone = t.from === null || stateOf.get(t.from) === 'learned';
      const c = fromDone && stateOf.get(t.to) === 'learned' ? TRACE_GOLD : fromDone ? TRACE_LIVE : TRACE_DIM;
      return c.clone().multiplyScalar(dim * (ctx.party ? 0.5 : 1));
    });
    const col = new Float32Array(b.traceOfSegment.length * 6);
    b.traceOfSegment.forEach((ti, s) => {
      const c = traceColor[ti];
      col.set([c.r, c.g, c.b, c.r, c.g, c.b], s * 6);
    });
    (b.traces.geometry as LineSegmentsGeometry).setColors(col);
  }

  /** Fade trees in and out with zoom (alpha 0..1) and apply any pending restyle. */
  update(alpha: number) {
    if (this.dirty) {
      for (const b of this.built.values()) this.refresh(b);
      this.dirty = false;
    }
    this.nodeMat.uniforms.uAlpha.value = alpha;
    this.traceMat.opacity = alpha * 0.95;
    this.group.visible = alpha > 0.003;
  }

  /** The skill nearest (wx, wy) within `radius` world units in this hobby's tree, if any. */
  pick(hobby: number, wx: number, wy: number, radius: number): number {
    const b = this.built.get(hobby);
    if (!b) return -1;
    let best = -1;
    let bestD = radius * radius;
    for (let j = 0; j < b.tree.nodes.length; j++) {
      const d = (b.world[j * 2] - wx) ** 2 + (b.world[j * 2 + 1] - wy) ** 2;
      if (d < bestD) {
        bestD = d;
        best = j;
      }
    }
    return best;
  }

  setResolution(w: number, h: number) {
    this.traceMat.resolution.set(w, h);
  }

  dispose() {
    for (const b of this.built.values()) {
      b.nodes.geometry.dispose();
      b.traces.geometry.dispose();
    }
    this.built.clear();
    this.nodeMat.dispose();
    this.traceMat.dispose();
  }
}
