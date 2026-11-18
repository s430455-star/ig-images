import * as THREE from 'three';
import { TIME } from './util.js';

const vs = /* glsl */`
attribute vec3 aColor;
attribute float aPhase;
attribute float aSeed;
uniform float uTime;
uniform float uMode;
uniform float uSpeed;
uniform float uBright;
uniform float uScale;
varying vec3 vCol;
varying vec3 vN;

vec3 hsv(float h, float s, float v) {
  vec3 p = abs(fract(vec3(h) + vec3(1.0, 2.0/3.0, 1.0/3.0)) * 6.0 - 3.0);
  return v * mix(vec3(1.0), clamp(p - 1.0, 0.0, 1.0), s);
}
float wgt(float m, float i) {
  float d = abs(m - i); d = min(d, 4.0 - d);
  return clamp(1.0 - d, 0.0, 1.0);
}
void main() {
  float t = uTime * uSpeed;
  vec3 base = aColor;
  // A: chase
  float ch = pow(0.5 + 0.5 * cos(6.2831853 * (aPhase * uScale - t * 0.7)), 5.0);
  vec3 cA = base * (0.18 + 1.25 * ch) + vec3(1.0, 0.9, 0.7) * ch * 0.35;
  // B: rainbow flow
  vec3 cB = hsv(fract(aPhase * uScale * 0.3 - t * 0.12), 0.85, 1.0) * 0.95;
  // C: alternating blink
  float alt = mod(floor(aPhase + 0.5), 2.0);
  float bl = smoothstep(0.42, 0.5, abs(fract(t * 0.55 + alt * 0.5) - 0.5));
  vec3 cC = base * (0.2 + 0.95 * bl);
  // D: warm sparkle
  float r = fract(sin(aSeed * 127.1 + floor(t * 5.0) * 78.233) * 43758.5453);
  vec3 cD = mix(vec3(1.0, 0.8, 0.5), base, 0.35) * (0.35 + 1.1 * step(0.72, r));
  vec3 col = cA * wgt(uMode, 0.0) + cB * wgt(uMode, 1.0) + cC * wgt(uMode, 2.0) + cD * wgt(uMode, 3.0);
  vec4 mv = modelViewMatrix * instanceMatrix * vec4(position, 1.0);
  vCol = col * uBright;
  vN = normalize(normalMatrix * mat3(instanceMatrix) * normal);
  gl_Position = projectionMatrix * mv;
}`;
const fs = /* glsl */`
varying vec3 vCol;
varying vec3 vN;
void main() {
  float f = 0.55 + 0.45 * abs(vN.z);
  gl_FragColor = vec4(vCol * f, 1.0);
}`;

const registry = [];

export function bulbMaterial({ speed = 1, bright = 1.9, scale = 0.1, offset = 0, period = 9 } = {}) {
  const m = new THREE.ShaderMaterial({
    uniforms: {
      uTime: TIME,
      uMode: { value: 0 },
      uSpeed: { value: speed },
      uBright: { value: bright },
      uScale: { value: scale },
    },
    vertexShader: vs,
    fragmentShader: fs,
  });
  registry.push({ m, offset, period });
  return m;
}

export function updateBulbs(t) {
  for (const r of registry) {
    const x = (t + r.offset) / r.period;
    const f = x - Math.floor(x);
    const k = f < 0.85 ? 0 : (f - 0.85) / 0.15;
    r.m.uniforms.uMode.value = (Math.floor(x) % 4) + k * k * (3 - 2 * k);
  }
}

const geos = {};
function bulbGeo(r) {
  if (!geos[r]) geos[r] = new THREE.IcosahedronGeometry(r, 1);
  return geos[r];
}

export class Bulbs {
  constructor() { this.pts = []; }
  add(p, color, phase, seed = Math.random()) {
    this.pts.push([p.x, p.y, p.z, color, phase, seed]);
    return this;
  }
  get count() { return this.pts.length; }
  build(opts = {}) {
    const n = this.pts.length;
    const geo = bulbGeo(opts.radius || 0.14).clone();
    const mat = opts.material || bulbMaterial(opts);
    const mesh = new THREE.InstancedMesh(geo, mat, Math.max(n, 1));
    mesh.count = n;
    const col = new Float32Array(n * 3), ph = new Float32Array(n), sd = new Float32Array(n);
    const m = new THREE.Matrix4(), c = new THREE.Color();
    this.pts.forEach((p, i) => {
      m.makeTranslation(p[0], p[1], p[2]);
      mesh.setMatrixAt(i, m);
      c.set(p[3]);
      col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
      ph[i] = p[4]; sd[i] = p[5];
    });
    geo.setAttribute('aColor', new THREE.InstancedBufferAttribute(col, 3));
    geo.setAttribute('aPhase', new THREE.InstancedBufferAttribute(ph, 1));
    geo.setAttribute('aSeed', new THREE.InstancedBufferAttribute(sd, 1));
    mesh.frustumCulled = false;
    return mesh;
  }
}
