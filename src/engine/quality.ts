// Render settings: phones and small screens get a lower pixel ratio.

const coarse = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
const small = Math.min(innerWidth, innerHeight) < 700;

export const quality = {
  pixelRatio: Math.min(devicePixelRatio || 1, coarse || small ? 1.5 : 2),
};
