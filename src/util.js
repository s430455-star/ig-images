import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export const rand = rng(20261118);
export const rr = (a, b) => a + (b - a) * rand();
export const V = (x, y, z) => new THREE.Vector3(x, y, z);

// Park layout (world x, z)
export const LAYOUT = {
  ferris: [-34, -18],
  coaster: [30, -8],
  carousel: [-15, 18],
  pirate: [20, 27],
  gate: [0, 62],
  fenceR: 62,
};

// Shared firework-light uniforms (positions and colour*energy of the 4 burst lights)
export const FW = {
  uLP: { value: [V(0, -999, 0), V(0, -999, 0), V(0, -999, 0), V(0, -999, 0)] },
  uLC: { value: [V(0, 0, 0), V(0, 0, 0), V(0, 0, 0), V(0, 0, 0)] },
};
export const TIME = { value: 0 };

const UP = new THREE.Vector3(0, 1, 0);
export function strut(a, b, r, seg = 6) {
  const d = new THREE.Vector3().subVectors(b, a);
  const len = d.length();
  const g = new THREE.CylinderGeometry(r, r, len, seg, 1, true);
  const q = new THREE.Quaternion().setFromUnitVectors(UP, d.normalize());
  g.applyMatrix4(new THREE.Matrix4().compose(
    new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5), q, new THREE.Vector3(1, 1, 1)));
  return g;
}

export function xf(g, p = [0, 0, 0], r = [0, 0, 0], s = [1, 1, 1]) {
  g.applyMatrix4(new THREE.Matrix4().compose(
    new THREE.Vector3(...p),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(...r)),
    new THREE.Vector3(...s)));
  return g;
}

export function paint(g, hex) {
  const c = new THREE.Color(hex);
  const n = g.attributes.position.count;
  const a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(a, 3));
  return g;
}

export function merge(list) {
  const hasColor = list.every(g => g.attributes.color);
  const gs = list.map(g => {
    const h = g.index ? g.toNonIndexed() : g;
    for (const k of Object.keys(h.attributes)) {
      if (!(k === 'position' || k === 'normal' || k === 'uv' || (hasColor && k === 'color'))) h.deleteAttribute(k);
    }
    if (!h.attributes.normal) h.computeVertexNormals();
    if (!h.attributes.uv) h.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(h.attributes.position.count * 2), 2));
    return h;
  });
  return mergeGeometries(gs, false);
}

export function canvasTex(w, h, draw, srgb = true) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  draw(ctx, w, h);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

let _glow = null;
export function glowTexture() {
  if (_glow) return _glow;
  _glow = canvasTex(128, 128, (ctx, w, h) => {
    const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.25, 'rgba(255,255,255,0.55)');
    g.addColorStop(0.6, 'rgba(255,255,255,0.15)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  }, false);
  return _glow;
}

export function stripeTex(c1, c2, n = 16, w = 512, h = 64, extra) {
  return canvasTex(w, h, (ctx) => {
    for (let i = 0; i < n; i++) {
      ctx.fillStyle = i % 2 ? c2 : c1;
      ctx.fillRect(i * w / n, 0, w / n + 1, h);
    }
    if (extra) extra(ctx, w, h);
  });
}

// A simple catenary between a and b with sag s, n points
export function catenary(a, b, sag, n) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const p = new THREE.Vector3().lerpVectors(a, b, t);
    p.y -= sag * 4 * t * (1 - t);
    pts.push(p);
  }
  return pts;
}

export const PALETTE = [0xff3a2a, 0xffc22a, 0x3aff6a, 0x3aa8ff, 0xff4ad8, 0xffe0a0];
