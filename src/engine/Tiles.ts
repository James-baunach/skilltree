// Every hex tile on the map in one instanced draw: hobby tiles, empty lots and the hub.
// Visual state (dimming, hover, selection, progress) eases toward per-tile targets.

import {
  AdditiveBlending,
  BufferAttribute,
  Color,
  InstancedBufferAttribute,
  InstancedBufferGeometry,
  Mesh,
  ShaderMaterial,
} from 'three';
import type { Galaxy } from '../lib/data';
import { axialToWorld } from '../lib/hex';
import { TILE_R } from '../lib/layout';
import { tileFrag, tileVert } from './shaders';
import { shared } from './uniforms';

export const KIND = { lot: 0, uncharted: 1, charted: 2, hub: 3 } as const;
export const HUB_SIZE = TILE_R * 2.75;

export interface TileInfo {
  kind: number;
  domain: number; // -1 for the hub
  hobby: number; // -1 for empty lots and the hub
  x: number;
  y: number;
}

export interface TileState {
  selDomain: number;
  selHobby: number;
  hoverDomain: number;
  hoverHobby: number;
  hoverHub: boolean;
  highlight: Set<number> | null;
  progress: Float32Array; // learned fraction per hobby
  party: (hobby: number) => boolean; // glowing in the party-trick layer
}

type Channel = 'fill' | 'line' | 'dim' | 'hover' | 'select' | 'progress' | 'party';
const CHANNELS: Channel[] = ['fill', 'line', 'dim', 'hover', 'select', 'progress', 'party'];
const BASE: Record<number, [number, number]> = {
  [KIND.lot]: [0.02, 0.14],
  [KIND.uncharted]: [0.05, 0.42],
  [KIND.charted]: [0.085, 0.75],
  [KIND.hub]: [0.05, 0.85],
};

export class Tiles {
  readonly mesh: Mesh<InstancedBufferGeometry, ShaderMaterial>;
  readonly info: TileInfo[] = [];
  private attrs = {} as Record<Channel, InstancedBufferAttribute>;
  private targets = {} as Record<Channel, Float32Array>;

  constructor(g: Galaxy) {
    this.info.push({ kind: KIND.hub, domain: -1, hobby: -1, x: 0, y: 0 });
    for (const d of g.domains) {
      d.cells.forEach(([q, r], i) => {
        const hobby = i < d.hobbies.length ? d.hobbies[i] : -1;
        const kind = hobby < 0 ? KIND.lot : g.hobbies[hobby].charted ? KIND.charted : KIND.uncharted;
        const [x, y] = axialToWorld(q, r, TILE_R);
        this.info.push({ kind, domain: d.index, hobby, x, y });
      });
    }

    const n = this.info.length;
    const pos = new Float32Array(n * 2);
    const size = new Float32Array(n);
    const color = new Float32Array(n * 3);
    const kind = new Float32Array(n);
    const c = new Color();
    this.info.forEach((t, i) => {
      pos.set([t.x, t.y], i * 2);
      size[i] = t.kind === KIND.hub ? HUB_SIZE : TILE_R;
      c.set(t.kind === KIND.hub ? '#ffd27a' : g.domains[t.domain].color);
      color.set([c.r, c.g, c.b], i * 3);
      kind[i] = t.kind;
    });

    const geo = new InstancedBufferGeometry();
    geo.setAttribute('position', new BufferAttribute(new Float32Array([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0]), 3));
    geo.setIndex([0, 1, 2, 0, 2, 3]);
    geo.setAttribute('iPos', new InstancedBufferAttribute(pos, 2));
    geo.setAttribute('iSize', new InstancedBufferAttribute(size, 1));
    geo.setAttribute('iColor', new InstancedBufferAttribute(color, 3));
    geo.setAttribute('iKind', new InstancedBufferAttribute(kind, 1));
    const names: Record<Channel, string> = {
      fill: 'iFill',
      line: 'iLine',
      dim: 'iDim',
      hover: 'iHover',
      select: 'iSelect',
      progress: 'iProgress',
      party: 'iParty',
    };
    for (const ch of CHANNELS) {
      this.attrs[ch] = new InstancedBufferAttribute(new Float32Array(n), 1);
      this.targets[ch] = new Float32Array(n);
      geo.setAttribute(names[ch], this.attrs[ch]);
    }
    geo.instanceCount = n;

    const material = new ShaderMaterial({
      vertexShader: tileVert,
      fragmentShader: tileFrag,
      uniforms: { uScale: shared.uScale, uTime: shared.uTime },
      transparent: true,
      depthTest: false,
      depthWrite: false,
      blending: AdditiveBlending,
    });
    this.mesh = new Mesh(geo, material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 0;
  }

  setState(s: TileState) {
    const t = this.targets;
    this.info.forEach((tile, i) => {
      const [fill, line] = BASE[tile.kind];
      let dim = 1;
      if (tile.kind !== KIND.hub) {
        if (s.selHobby >= 0) dim *= tile.hobby === s.selHobby ? 1 : tile.domain === s.selDomain ? 0.7 : 0.45;
        else if (s.selDomain >= 0) dim *= tile.domain === s.selDomain ? 1 : 0.5;
        if (s.highlight) {
          if (tile.hobby < 0) dim *= 0.4;
          else dim *= s.highlight.has(tile.hobby) ? 1.15 : 0.18;
        }
      }
      t.fill[i] = fill;
      t.line[i] = line;
      t.dim[i] = dim;
      t.hover[i] =
        tile.kind === KIND.hub
          ? Number(s.hoverHub)
          : tile.hobby >= 0 && tile.hobby === s.hoverHobby
            ? 1
            : tile.domain === s.hoverDomain
              ? 0.35
              : 0;
      t.select[i] = tile.hobby >= 0 && tile.hobby === s.selHobby ? 1 : 0;
      t.progress[i] = tile.hobby >= 0 ? s.progress[tile.hobby] : 0;
      t.party[i] = tile.hobby >= 0 && s.party(tile.hobby) ? 1 : 0;
    });
  }

  update(dt: number) {
    const k = 1 - Math.exp(-dt * 10);
    for (const ch of CHANNELS) {
      const cur = this.attrs[ch].array as Float32Array;
      const goal = this.targets[ch];
      let changed = false;
      for (let i = 0; i < cur.length; i++) {
        const d = goal[i] - cur[i];
        if (d > 1e-4 || d < -1e-4) {
          cur[i] += d * k;
          changed = true;
        } else if (d !== 0) {
          cur[i] = goal[i];
          changed = true;
        }
      }
      if (changed) this.attrs[ch].needsUpdate = true;
    }
  }

  dispose() {
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
  }
}
