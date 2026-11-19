// Full-screen background drawn in one pass: dark gradient, faint hex grid, coarse survey grid.

import { Mesh, PlaneGeometry, ShaderMaterial, Vector2 } from 'three';
import { TILE_R } from '../lib/layout';
import { gridFrag, gridVert } from './shaders';

export class Grid {
  readonly mesh: Mesh<PlaneGeometry, ShaderMaterial>;

  constructor() {
    this.mesh = new Mesh(
      new PlaneGeometry(2, 2),
      new ShaderMaterial({
        vertexShader: gridVert,
        fragmentShader: gridFrag,
        uniforms: {
          uCenter: { value: new Vector2() },
          uScale: { value: 1 },
          uViewport: { value: new Vector2(1, 1) },
          uTileR: { value: TILE_R },
        },
        depthTest: false,
        depthWrite: false,
      }),
    );
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = -100;
  }

  update(x: number, y: number, scale: number, w: number, h: number) {
    const u = this.mesh.material.uniforms;
    u.uCenter.value.set(x, y);
    u.uScale.value = scale;
    u.uViewport.value.set(w, h);
  }

  dispose() {
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
  }
}
