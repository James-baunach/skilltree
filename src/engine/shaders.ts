// GLSL for the 2D map. Shapes are signed distance fields measured in world units, so outlines
// can be held at a constant pixel width at every zoom (px = world units per CSS pixel).

const HEX_SDF = /* glsl */ `
// Signed distance to a flat-top hexagon with apothem r (negative inside). After Inigo Quilez.
float sdHex(vec2 p, float r) {
  const vec3 k = vec3(-0.866025404, 0.5, 0.577350269);
  p = abs(p);
  p -= 2.0 * min(dot(k.xy, p), 0.0) * k.xy;
  p -= vec2(clamp(p.x, -k.z * r, k.z * r), r);
  return length(p) * sign(p.y);
}
`;

/** Full-screen background: dark gradient, the faint hex grid of empty lots, and a coarse survey grid. */
export const gridVert = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

export const gridFrag = /* glsl */ `
uniform vec2 uCenter;   // world point at the middle of the screen
uniform float uScale;   // CSS px per world unit
uniform vec2 uViewport; // CSS px
uniform float uTileR;
varying vec2 vUv;
${HEX_SDF}
vec2 hexRound(vec2 qr) {
  vec3 c = vec3(qr.x, -qr.x - qr.y, qr.y);
  vec3 rc = floor(c + 0.5);
  vec3 diff = abs(rc - c);
  if (diff.x > diff.y && diff.x > diff.z) rc.x = -rc.y - rc.z;
  else if (diff.y > diff.z) rc.y = -rc.x - rc.z;
  else rc.z = -rc.x - rc.y;
  return vec2(rc.x, rc.z);
}
void main() {
  vec2 screen = vUv * uViewport;
  vec2 world = uCenter + (screen - 0.5 * uViewport) / uScale;
  float px = 1.0 / uScale;
  float tilePx = uTileR * 1.7320508 * uScale;

  // Hex grid continuing the honeycomb into the streets, once tiles are big enough
  vec2 qr = vec2((2.0 / 3.0) * world.x, (-1.0 / 3.0) * world.x + 0.57735027 * world.y) / uTileR;
  vec2 c = hexRound(qr);
  vec2 center = vec2(uTileR * 1.5 * c.x, uTileR * 1.7320508 * (c.y + 0.5 * c.x));
  float hexLine = 1.0 - smoothstep(0.0, px * 1.2, abs(sdHex(world - center, uTileR * 0.8660254)));
  float hexA = smoothstep(30.0, 90.0, tilePx) * 0.06;

  // Coarse survey grid with corner ticks, for the zoomed-out view
  float cell = 1200.0;
  vec2 g = abs(fract(world / cell + 0.5) - 0.5) * cell;
  float lines = 1.0 - smoothstep(0.0, px * 1.1, min(g.x, g.y));
  float ticks = lines * step(max(g.x, g.y), px * 7.0);
  float far = 1.0 - smoothstep(35.0, 110.0, tilePx);

  vec3 neon = vec3(0.18, 0.85, 1.0);
  vec3 col = neon * (hexLine * hexA + lines * far * 0.035 + ticks * far * 0.22);

  // Deep blue-black with a gentle vignette
  vec2 uv = (vUv - 0.5) * vec2(uViewport.x / uViewport.y, 1.0);
  float vig = 1.0 - smoothstep(0.25, 1.0, length(uv));
  vec3 base = mix(vec3(0.008, 0.009, 0.018), vec3(0.018, 0.022, 0.04), vig);
  gl_FragColor = vec4(base + col, 1.0);
}
`;

/** Hex tiles: hobbies, empty lots and the hub. One instanced quad each. */
export const tileVert = /* glsl */ `
attribute vec2 iPos;
attribute float iSize;
attribute vec3 iColor;
attribute float iKind;     // 0 empty lot, 1 uncharted hobby, 2 charted hobby, 3 hub
attribute float iFill;
attribute float iLine;
attribute float iDim;
attribute float iHover;
attribute float iSelect;
attribute float iProgress;
attribute float iParty;
varying vec2 vP;
varying float vSize;
varying vec3 vColor;
varying float vKind;
varying float vFill;
varying float vLine;
varying float vDim;
varying float vHover;
varying float vSelect;
varying float vProgress;
varying float vParty;
void main() {
  vec2 local = position.xy * iSize * 1.2;
  vP = local;
  vSize = iSize;
  vColor = iColor;
  vKind = iKind;
  vFill = iFill;
  vLine = iLine;
  vDim = iDim;
  vHover = iHover;
  vSelect = iSelect;
  vProgress = iProgress;
  vParty = iParty;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(iPos + local, 0.0, 1.0);
  if (iDim < 0.003) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
}
`;

export const tileFrag = /* glsl */ `
uniform float uScale;
uniform float uTime;
varying vec2 vP;
varying float vSize;
varying vec3 vColor;
varying float vKind;
varying float vFill;
varying float vLine;
varying float vDim;
varying float vHover;
varying float vSelect;
varying float vProgress;
varying float vParty;
${HEX_SDF}
void main() {
  float px = 1.0 / uScale;
  float aa = px * 0.8;
  float apo = vSize * 0.8660254;
  float inset = max(vSize * 0.05, px);
  float d = sdHex(vP, apo - inset);
  float inside = 1.0 - smoothstep(-aa, aa, d);

  // Constant-width outline, heavier when hovered or selected
  float w = px * (0.55 + 0.9 * vSelect + 0.45 * vHover);
  float edge = 1.0 - smoothstep(w, w + aa * 1.5, abs(d));
  if (vKind > 0.5 && vKind < 1.5) {
    float a = atan(vP.y, vP.x);
    edge *= 0.35 + 0.65 * step(0.45, fract(a * 9.0 / 3.14159265)); // uncharted: dashed
  }

  // Inner frame, only once it sits a few pixels inside the edge
  float frameInset = vSize * 0.07;
  float room = smoothstep(3.0, 7.0, frameInset / px);
  float frame = (1.0 - smoothstep(px * 0.4, px * 1.4, abs(d + frameInset))) * room * 0.5;

  // Status tab on the top edge of charted hobbies; progress bar along the bottom edge
  float edgeY = apo - inset;
  float barH = max(vSize * 0.025, px * 1.5);
  float tab = 0.0;
  float prog = 0.0;
  if (vKind > 1.5 && vKind < 2.5) {
    tab = step(abs(vP.x), vSize * 0.28) * step(edgeY - barH * 2.0, vP.y) * step(vP.y, edgeY - barH * 0.6);
  }
  if (vKind > 0.5 && vKind < 2.5 && vProgress > 0.001) {
    float inBar = step(abs(vP.x), vSize * 0.4) * step(-edgeY + barH * 0.6, vP.y) * step(vP.y, -edgeY + barH * 2.0);
    prog = inBar * (step(vP.x, -vSize * 0.4 + vSize * 0.8 * vProgress) * 0.9 + 0.12);
  }

  // Hub: concentric frames and a slowly turning ring of ticks
  float hub = 0.0;
  if (vKind > 2.5) {
    float r1 = 1.0 - smoothstep(px * 0.5, px * 1.6, abs(sdHex(vP, apo * 0.72)));
    float core = 1.0 - smoothstep(-aa, aa, sdHex(vP, apo * 0.42));
    float ang = atan(vP.y, vP.x) - uTime * 0.12;
    float band = 1.0 - smoothstep(0.0, max(vSize * 0.022, px), abs(length(vP) - apo * 0.86));
    hub = r1 * 0.5 + core * 0.08 + step(0.7, fract(ang * 48.0 / 6.2831853)) * band * 0.55;
  }

  // Soft, short glow outside the edge for hover, selection and the party-trick layer
  float glowAmt = 0.28 * vSelect + 0.14 * vHover + 0.2 * vParty * (0.6 + 0.4 * sin(uTime * 3.0));
  float glow = glowAmt * exp(-max(d, 0.0) / max(px * 8.0, vSize * 0.02)) * step(0.0, d)
             * (1.0 - smoothstep(vSize * 0.1, vSize * 0.16, d));

  vec3 gold = vec3(1.0, 0.78, 0.36);
  float body = inside * vFill + edge * vLine + frame * vLine * inside + tab * 0.8 + hub;
  vec3 rgb = vColor * (body + glow) + gold * prog;
  gl_FragColor = vec4(rgb * vDim, 1.0);
}
`;

/** Skill nodes inside a tile's tree: small hexagons, diamonds for party tricks. */
export const nodeVert = /* glsl */ `
uniform float uTime;
attribute vec2 iPos;
attribute float iSize;
attribute vec3 iColor;
attribute float iFill;
attribute float iLine;
attribute float iRing;
attribute float iPulse;
attribute float iShape;    // 0 hexagon, 1 diamond
attribute float iDim;
varying vec2 vP;
varying float vSize;
varying vec3 vColor;
varying float vFill;
varying float vLine;
varying float vRing;
varying float vShape;
varying float vDim;
void main() {
  float s = iSize * (1.0 + iPulse * 0.12 * sin(uTime * 4.0 + iPos.x * 0.7));
  vec2 local = position.xy * s * 2.0;
  vP = local;
  vSize = s;
  vColor = iColor;
  vFill = iFill;
  vLine = iLine;
  vRing = iRing;
  vShape = iShape;
  vDim = iDim;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(iPos + local, 0.0, 1.0);
}
`;

export const nodeFrag = /* glsl */ `
uniform float uScale;
uniform float uAlpha;
varying vec2 vP;
varying float vSize;
varying vec3 vColor;
varying float vFill;
varying float vLine;
varying float vRing;
varying float vShape;
varying float vDim;
${HEX_SDF}
void main() {
  float px = 1.0 / uScale;
  float aa = px * 0.8;
  // Pointy-top hexagon (swap axes of the flat-top SDF), or a diamond
  float d = vShape > 0.5 ? (abs(vP.x) + abs(vP.y) - vSize) * 0.70710678 : sdHex(vP.yx, vSize * 0.8660254);
  float inside = 1.0 - smoothstep(-aa, aa, d);
  float edge = 1.0 - smoothstep(px * 0.7, px * 0.7 + aa * 1.5, abs(d));
  float ring = (1.0 - smoothstep(px * 0.8, px * 0.8 + aa * 1.5, abs(sdHex(vP.yx, vSize * 0.8660254 * 1.6)))) * vRing;
  float glow = 0.3 * vLine * exp(-max(d, 0.0) / max(px * 4.0, vSize * 0.35)) * step(0.0, d)
             * (1.0 - smoothstep(vSize * 0.6, vSize * 0.9, d));
  vec3 rgb = vColor * (inside * vFill + edge * vLine + glow) + vec3(0.85, 0.98, 1.0) * ring;
  float a = clamp(inside + edge * vLine + glow + ring, 0.0, 1.0);
  gl_FragColor = vec4(rgb, a) * (vDim * uAlpha); // premultiplied
}
`;
