import * as THREE from 'three';
import { FW } from './util.js';

const MAXP = 40000;
const COLORS = [
  [1.0, 0.12, 0.08], [0.15, 1.0, 0.25], [0.2, 0.38, 1.0], [1.0, 0.62, 0.18], [0.78, 0.22, 1.0],
  [0.15, 0.9, 1.0], [1.0, 0.3, 0.65], [1.0, 0.42, 0.06], [0.4, 1.0, 0.1],
];
const GOLD = [1.0, 0.6, 0.2];
const R = Math.random;
const rr = (a, b) => a + (b - a) * R();
const pick = a => a[Math.floor(R() * a.length)];

// kinds: 0 star, 1 crackle pop, 2 trail ember, 3 flash, 4 rocket trail, 5 crackle star (pops at death)
export class Fireworks {
  constructor(scene, camPredict) {
    this.camPredict = camPredict;
    this.n = 0;
    this.p = new Float32Array(MAXP * 3);
    this.v = new Float32Array(MAXP * 3);
    this.c = new Float32Array(MAXP * 3);
    this.life = new Float32Array(MAXP);
    this.max = new Float32Array(MAXP);
    this.sz = new Float32Array(MAXP);
    this.drag = new Float32Array(MAXP);
    this.grav = new Float32Array(MAXP);
    this.trail = new Float32Array(MAXP);
    this.kind = new Uint8Array(MAXP);
    this.oc = new Float32Array(MAXP * 3);
    this.os = new Float32Array(MAXP);

    const g = new THREE.BufferGeometry();
    this.posAttr = new THREE.BufferAttribute(this.p, 3).setUsage(THREE.DynamicDrawUsage);
    this.colAttr = new THREE.BufferAttribute(this.oc, 3).setUsage(THREE.DynamicDrawUsage);
    this.szAttr = new THREE.BufferAttribute(this.os, 1).setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('position', this.posAttr);
    g.setAttribute('aCol', this.colAttr);
    g.setAttribute('aSize', this.szAttr);
    g.setDrawRange(0, 0);
    this.geo = g;
    this.mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { uScale: { value: 500 } },
      vertexShader: /* glsl */`
        attribute vec3 aCol; attribute float aSize;
        uniform float uScale;
        varying vec3 vC;
        void main() {
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * mv;
          float px = aSize * uScale / -mv.z;
          float cl = max(px, 2.0);
          gl_PointSize = cl;
          vC = aCol * min(1.0, (px * px) / (cl * cl) * 1.6 + 0.25);
        }`,
      fragmentShader: /* glsl */`
        varying vec3 vC;
        void main() {
          float d = length(gl_PointCoord - 0.5) * 2.0;
          float a = exp(-d * d * 4.5) + 0.6 * exp(-d * d * 30.0);
          gl_FragColor = vec4(vC * a, 1.0);
        }`,
    });
    this.points = new THREE.Points(g, this.mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 3;
    scene.add(this.points);

    this.rockets = [];
    this.queue = [];
    this.nextLaunch = 0.3;
    this.lights = [];
    for (let i = 0; i < 4; i++) {
      const l = new THREE.PointLight(0xffffff, 0, 0, 1.15);
      l.position.set(0, -50, 0);
      scene.add(l);
      this.lights.push({ l, e: 0, col: new THREE.Color(), flick: 0 });
    }
    this.li = 0;
    this.smoke = new Smoke(scene);
  }

  setScale(s) { this.mat.uniforms.uScale.value = s; }

  spawn(x, y, z, vx, vy, vz, c, life, size, drag, grav, trail, kind) {
    if (this.n >= MAXP) return;
    const i = this.n++, i3 = i * 3;
    this.p[i3] = x; this.p[i3 + 1] = y; this.p[i3 + 2] = z;
    this.v[i3] = vx; this.v[i3 + 1] = vy; this.v[i3 + 2] = vz;
    this.c[i3] = c[0]; this.c[i3 + 1] = c[1]; this.c[i3 + 2] = c[2];
    this.life[i] = life; this.max[i] = life; this.sz[i] = size;
    this.drag[i] = drag; this.grav[i] = grav; this.trail[i] = trail; this.kind[i] = kind;
  }

  kill(i) {
    const j = --this.n;
    if (i === j) return;
    const i3 = i * 3, j3 = j * 3;
    for (let k = 0; k < 3; k++) { this.p[i3 + k] = this.p[j3 + k]; this.v[i3 + k] = this.v[j3 + k]; this.c[i3 + k] = this.c[j3 + k]; }
    this.life[i] = this.life[j]; this.max[i] = this.max[j]; this.sz[i] = this.sz[j];
    this.drag[i] = this.drag[j]; this.grav[i] = this.grav[j]; this.trail[i] = this.trail[j]; this.kind[i] = this.kind[j];
  }

  launch(t) {
    const cam = this.camPredict(t + 3.6);
    const dx = -cam.x, dz = -cam.z, dl = Math.hypot(dx, dz);
    const fx = dx / dl, fz = dz / dl;
    const px = -fz, pz = fx;
    const d = rr(12, 48), lat = rr(-34, 34);
    const x = fx * d + px * lat, z = fz * d + pz * lat;
    const h = rr(42, 66);
    const g = 14;
    const vy = Math.sqrt(2 * g * h);
    const type = pick(['peony', 'peony', 'peony', 'ring', 'ring', 'willow', 'willow', 'crackle', 'chrys', 'chrys', 'chrys', 'palm']);
    this.rockets.push({
      p: [x, 0.5, z], v: [rr(-1.2, 1.2), vy, rr(-1.2, 1.2)], type, smokeT: 0,
      c1: pick(COLORS), c2: pick(COLORS),
    });
  }

  burst(r) {
    const [x, y, z] = r.p;
    const sph = () => {
      let a, b, c, l;
      do { a = R() * 2 - 1; b = R() * 2 - 1; c = R() * 2 - 1; l = a * a + b * b + c * c; } while (l > 1 || l < 0.01);
      l = Math.sqrt(l); return [a / l, b / l, c / l];
    };
    const vx0 = r.v[0] * 0.3, vy0 = r.v[1] * 0.3, vz0 = r.v[2] * 0.3;
    let lightCol = r.c1, strength = 1.0;
    const S = this.spawn.bind(this);
    switch (r.type) {
      case 'peony': {
        const n = 190, two = R() < 0.5;
        for (let i = 0; i < n; i++) {
          const d = sph(), s = rr(19, 21.5);
          S(x, y, z, d[0] * s + vx0, d[1] * s + vy0, d[2] * s + vz0, two && i % 2 ? r.c2 : r.c1, rr(1.7, 2.3), 0.9, 1.45, 0.55, 5, 0);
        }
        break;
      }
      case 'ring': {
        const ax = sph(); if (Math.abs(ax[1]) > 0.7) { ax[1] *= 0.3; }
        const a = new THREE.Vector3(...ax).normalize();
        const u = new THREE.Vector3(0, 1, 0).cross(a).normalize();
        const w = a.clone().cross(u).normalize();
        const n = 110;
        for (let i = 0; i < n; i++) {
          const t = i / n * Math.PI * 2, s = 18;
          const dx = u.x * Math.cos(t) + w.x * Math.sin(t), dy = u.y * Math.cos(t) + w.y * Math.sin(t), dz = u.z * Math.cos(t) + w.z * Math.sin(t);
          S(x, y, z, dx * s + vx0, dy * s + vy0, dz * s + vz0, r.c1, rr(1.8, 2.2), 1.0, 1.35, 0.5, 4, 0);
        }
        for (let i = 0; i < 50; i++) {
          const d = sph(), s = rr(6, 8);
          S(x, y, z, d[0] * s, d[1] * s, d[2] * s, r.c2, rr(1.2, 1.6), 0.8, 1.6, 0.5, 0, 0);
        }
        break;
      }
      case 'willow': {
        const n = 130;
        for (let i = 0; i < n; i++) {
          const d = sph(), s = rr(14, 17);
          S(x, y, z, d[0] * s + vx0, d[1] * s + 2 + vy0, d[2] * s + vz0, GOLD, rr(3.6, 4.6), 0.75, 1.7, 0.32, 34, 0);
        }
        lightCol = GOLD; strength = 0.85;
        break;
      }
      case 'crackle': {
        const n = 90;
        const c = R() < 0.3 ? [1, 0.85, 0.55] : r.c1;
        for (let i = 0; i < n; i++) {
          const d = sph(), s = rr(14, 18);
          S(x, y, z, d[0] * s + vx0, d[1] * s + vy0, d[2] * s + vz0, c, rr(1.0, 1.5), 0.85, 1.5, 0.5, 8, 5);
        }
        lightCol = [1, 0.85, 0.6]; strength = 0.8;
        break;
      }
      case 'chrys': {
        const n = 160;
        for (let i = 0; i < n; i++) {
          const d = sph(), s = rr(16, 19);
          S(x, y, z, d[0] * s + vx0, d[1] * s + vy0, d[2] * s + vz0, r.c1, rr(2.0, 2.6), 0.8, 1.4, 0.5, 18, 0);
        }
        for (let i = 0; i < 60; i++) {
          const d = sph(), s = rr(5, 7);
          S(x, y, z, d[0] * s, d[1] * s, d[2] * s, [1, 1, 0.95], rr(1.0, 1.4), 0.9, 1.5, 0.4, 0, 0);
        }
        break;
      }
      case 'palm': {
        const n = 9;
        for (let i = 0; i < n; i++) {
          const t = i / n * Math.PI * 2, el = rr(0.15, 0.5);
          const s = rr(19, 22);
          S(x, y, z, Math.cos(t) * Math.cos(el) * s, Math.sin(el) * s + 3, Math.sin(t) * Math.cos(el) * s, GOLD, rr(2.4, 2.9), 1.7, 1.1, 0.6, 90, 0);
        }
        for (let i = 0; i < 40; i++) {
          const d = sph(), s = rr(4, 7);
          S(x, y, z, d[0] * s, d[1] * s, d[2] * s, r.c1, rr(0.8, 1.2), 0.9, 1.5, 0.4, 0, 0);
        }
        lightCol = GOLD; strength = 0.9;
        break;
      }
    }
    // flash
    S(x, y, z, 0, 0, 0, [1, 0.95, 0.85], 0.12, 9, 0, 0, 0, 3);
    const L = this.lights[this.li++ % 4];
    L.l.position.set(x, y, z);
    L.col.setRGB(lightCol[0] * 0.85 + 0.15, lightCol[1] * 0.85 + 0.15, lightCol[2] * 0.85 + 0.15);
    L.e = 1.6 * strength;
    L.flick = r.type === 'crackle' ? 1 : 0;
    L.delayCrackle = 1.0;
    // smoke
    for (let i = 0; i < 4; i++) {
      const d = sph();
      this.smoke.add(x + d[0] * 6, y + d[1] * 4, z + d[2] * 6, rr(10, 14), rr(22, 32), rr(8, 12), rr(0.05, 0.085));
    }
  }

  update(dt, t) {
    // launches
    if (t >= this.nextLaunch) {
      const salvo = R() < 0.18 ? Math.floor(rr(3, 6)) : 1;
      for (let k = 0; k < salvo; k++) this.queue.push(t + k * rr(0.15, 0.35));
      this.nextLaunch = t + rr(0.35, 1.1) + (salvo > 1 ? 1.0 : 0);
    }
    this.queue = this.queue.filter(q => { if (q <= t) { this.launch(t); return false; } return true; });

    // rockets
    for (let k = this.rockets.length - 1; k >= 0; k--) {
      const r = this.rockets[k];
      r.v[1] -= 14 * dt;
      r.p[0] += r.v[0] * dt; r.p[1] += r.v[1] * dt; r.p[2] += r.v[2] * dt;
      const n = Math.max(2, Math.ceil(Math.hypot(r.v[0], r.v[1], r.v[2]) * dt / 0.12));
      for (let i = 0; i < n; i++) {
        const f = i / n;
        this.spawn(r.p[0] - r.v[0] * dt * f, r.p[1] - r.v[1] * dt * f, r.p[2] - r.v[2] * dt * f,
          rr(-0.8, 0.8) - r.v[0] * 0.05, rr(-0.8, 0.8) - r.v[1] * 0.06, rr(-0.8, 0.8) - r.v[2] * 0.05,
          [1, 0.55, 0.22], rr(0.2, 0.45), 0.42, 2.2, 0.15, 0, 4);
      }
      this.spawn(r.p[0], r.p[1], r.p[2], 0, 0, 0, [1, 0.8, 0.55], 0.03, 1.1, 0, 0, 0, 3);
      r.smokeT -= dt;
      if (r.smokeT <= 0) { r.smokeT = 0.1; this.smoke.add(r.p[0], r.p[1], r.p[2], 1.2, 4, rr(2.5, 4), 0.07); }
      if (r.v[1] < 2.0) { this.burst(r); this.rockets.splice(k, 1); }
    }

    // particles
    const p = this.p, v = this.v, c = this.c, oc = this.oc, os = this.os;
    for (let i = 0; i < this.n;) {
      this.life[i] -= dt;
      if (this.life[i] <= 0) {
        const kd = this.kind[i];
        if (kd === 5) {
          const i3 = i * 3;
          const px = p[i3], py = p[i3 + 1], pz = p[i3 + 2];
          this.kill(i);
          for (let k = 0; k < 4; k++) this.spawn(px, py, pz, rr(-3, 3), rr(-3, 3), rr(-3, 3), [1, 0.95, 0.8], rr(0.15, 0.55), 0.7, 2, 0.3, 0, 1);
        } else if (kd === 1 && R() < 0.35) {
          const i3 = i * 3;
          const px = p[i3], py = p[i3 + 1], pz = p[i3 + 2];
          this.kill(i);
          this.spawn(px, py, pz, 0, 0, 0, [1, 1, 0.9], 0.06, 1.6, 0, 0, 0, 3);
        } else this.kill(i);
        continue;
      }
      const i3 = i * 3;
      const dr = Math.exp(-this.drag[i] * dt);
      v[i3] *= dr; v[i3 + 1] = v[i3 + 1] * dr - 9.8 * this.grav[i] * dt; v[i3 + 2] *= dr;
      v[i3] += 0.6 * dt; // wind
      p[i3] += v[i3] * dt; p[i3 + 1] += v[i3 + 1] * dt; p[i3 + 2] += v[i3 + 2] * dt;
      const kd = this.kind[i];
      const life = this.life[i], max = this.max[i], k = life / max, age = max - life;
      if (this.trail[i] > 0 && R() < this.trail[i] * dt) {
        const gold = kd === 0 && this.trail[i] > 25;
        this.spawn(p[i3], p[i3 + 1], p[i3 + 2], v[i3] * 0.05 + rr(-0.3, 0.3), v[i3 + 1] * 0.05 + rr(-0.3, 0.3), v[i3 + 2] * 0.05 + rr(-0.3, 0.3),
          gold ? [1, 0.55, 0.18] : [c[i3] * 0.7 + 0.3, c[i3 + 1] * 0.7 + 0.25, c[i3 + 2] * 0.7 + 0.15],
          gold ? rr(1.0, 1.9) : rr(0.35, 0.8), this.sz[i] * (gold ? 0.6 : 0.5), 2.5, gold ? 0.22 : 0.35, 0, 2);
      }
      let b, wh = 0;
      if (kd === 0) {
        b = Math.min(1, k * 2.4) * (1 + Math.max(0, 0.2 - age) * 8);
        wh = Math.max(0, 1 - age * 9);
        if (k < 0.3) b *= 0.65 + 0.35 * (R() < 0.6 ? 1 : 0);
      } else if (kd === 5) {
        b = Math.min(1, k * 3) * (1 + Math.max(0, 0.2 - age) * 6);
        wh = Math.max(0, 1 - age * 5);
      } else if (kd === 1) {
        b = R() < 0.55 ? 2.2 : 0.1; wh = 0.6;
      } else if (kd === 2) {
        b = k * k * 0.75;
      } else if (kd === 3) {
        b = 3.2 * k; wh = 0.5;
      } else {
        b = k * 1.1;
      }
      const s = 2.0 * b;
      oc[i3] = (c[i3] + (1 - c[i3]) * wh) * s;
      oc[i3 + 1] = (c[i3 + 1] + (1 - c[i3 + 1]) * wh) * s;
      oc[i3 + 2] = (c[i3 + 2] + (1 - c[i3 + 2]) * wh) * s;
      os[i] = this.sz[i] * (kd === 3 ? 0.5 + k : 1);
      i++;
    }
    this.geo.setDrawRange(0, this.n);
    this.posAttr.needsUpdate = this.colAttr.needsUpdate = this.szAttr.needsUpdate = true;
    this.posAttr.clearUpdateRanges(); this.posAttr.addUpdateRange(0, this.n * 3);
    this.colAttr.clearUpdateRanges(); this.colAttr.addUpdateRange(0, this.n * 3);
    this.szAttr.clearUpdateRanges(); this.szAttr.addUpdateRange(0, this.n);

    // lights
    this.lights.forEach((L, i) => {
      L.e *= Math.exp(-dt * 2.6);
      let e = L.e;
      if (L.flick) {
        L.delayCrackle -= dt;
        if (L.delayCrackle < 0.2 && L.e > 0.05) { L.e = Math.max(L.e, 0.35); e = L.e * (R() < 0.5 ? 1.6 : 0.2); }
      }
      L.l.intensity = e * 900;
      L.l.color.copy(L.col);
      FW.uLP.value[i].copy(L.l.position);
      FW.uLC.value[i].set(L.col.r * e, L.col.g * e, L.col.b * e);
    });
    this.smoke.update(dt, t);
  }
}

// ---------------------------------------------------------------------
// Smoke and haze as lit billboards
// ---------------------------------------------------------------------
const MAXS = 600;
class Smoke {
  constructor(scene) {
    this.n = 0;
    this.p = new Float32Array(MAXS * 3);
    this.age = new Float32Array(MAXS);
    this.life = new Float32Array(MAXS);
    this.s0 = new Float32Array(MAXS);
    this.s1 = new Float32Array(MAXS);
    this.a0 = new Float32Array(MAXS);
    this.seed = new Float32Array(MAXS);
    this.haze = new Uint8Array(MAXS);
    this.iSize = new Float32Array(MAXS);
    this.iAlpha = new Float32Array(MAXS);
    const quad = new THREE.PlaneGeometry(1, 1);
    const g = new THREE.InstancedBufferGeometry();
    g.index = quad.index;
    g.setAttribute('position', quad.attributes.position);
    g.setAttribute('uv', quad.attributes.uv);
    this.aPos = new THREE.InstancedBufferAttribute(this.p, 3).setUsage(THREE.DynamicDrawUsage);
    this.aSize = new THREE.InstancedBufferAttribute(this.iSize, 1).setUsage(THREE.DynamicDrawUsage);
    this.aAlpha = new THREE.InstancedBufferAttribute(this.iAlpha, 1).setUsage(THREE.DynamicDrawUsage);
    this.aSeed = new THREE.InstancedBufferAttribute(this.seed, 1).setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('iPos', this.aPos);
    g.setAttribute('iSize', this.aSize);
    g.setAttribute('iAlpha', this.aAlpha);
    g.setAttribute('iSeed', this.aSeed);
    g.instanceCount = 0;
    this.geo = g;
    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false,
      uniforms: { uLP: FW.uLP, uLC: FW.uLC },
      vertexShader: /* glsl */`
        attribute vec3 iPos; attribute float iSize; attribute float iAlpha; attribute float iSeed;
        uniform vec3 uLP[4]; uniform vec3 uLC[4];
        varying vec2 vUv; varying vec3 vCol; varying float vA; varying float vSeed;
        void main() {
          vec4 mv = viewMatrix * vec4(iPos, 1.0);
          float a = iSeed * 6.2831;
          vec2 q = mat2(cos(a), -sin(a), sin(a), cos(a)) * position.xy;
          mv.xy += q * iSize;
          gl_Position = projectionMatrix * mv;
          vUv = uv;
          vec3 L = vec3(0.010, 0.012, 0.022) + vec3(0.05, 0.028, 0.034) * exp(-max(iPos.y, 0.0) / 12.0);
          for (int i = 0; i < 4; i++) {
            vec3 d = uLP[i] - iPos;
            L += uLC[i] * 0.16 * 900.0 / (dot(d, d) + 900.0);
          }
          vCol = L;
          // fade out when very close to camera
          vA = iAlpha * smoothstep(4.0, 25.0, -mv.z);
          vSeed = iSeed;
        }`,
      fragmentShader: /* glsl */`
        varying vec2 vUv; varying vec3 vCol; varying float vA; varying float vSeed;
        void main() {
          vec2 q = vUv - 0.5;
          float r = length(q) * 2.0;
          float a = smoothstep(1.0, 0.0, r);
          a *= a;
          float n = 0.7 + 0.3 * sin(q.x * 11.0 + vSeed * 40.0) * sin(q.y * 9.0 - vSeed * 25.0)
                  + 0.15 * sin((q.x + q.y) * 23.0 + vSeed * 13.0);
          gl_FragColor = vec4(vCol, clamp(a * n * vA, 0.0, 1.0));
        }`,
    });
    this.mesh = new THREE.Mesh(g, mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 2;
    scene.add(this.mesh);
    // permanent haze
    for (let i = 0; i < 46; i++) {
      const a = Math.random() * Math.PI * 2, d = Math.sqrt(Math.random()) * 70;
      this.add(Math.cos(a) * d, rr(5, 26), Math.sin(a) * d, rr(30, 55), 0, 1e9, rr(0.03, 0.06), true);
    }
  }
  add(x, y, z, s0, s1, life, a0, haze = false) {
    if (this.n >= MAXS) return;
    const i = this.n++;
    this.p[i * 3] = x; this.p[i * 3 + 1] = y; this.p[i * 3 + 2] = z;
    this.age[i] = 0; this.life[i] = life; this.s0[i] = s0; this.s1[i] = haze ? s0 : s1; this.a0[i] = a0;
    this.seed[i] = Math.random(); this.haze[i] = haze ? 1 : 0;
  }
  kill(i) {
    const j = --this.n;
    if (i === j) return;
    for (let k = 0; k < 3; k++) this.p[i * 3 + k] = this.p[j * 3 + k];
    this.age[i] = this.age[j]; this.life[i] = this.life[j]; this.s0[i] = this.s0[j]; this.s1[i] = this.s1[j];
    this.a0[i] = this.a0[j]; this.seed[i] = this.seed[j]; this.haze[i] = this.haze[j];
  }
  update(dt, t) {
    for (let i = 0; i < this.n;) {
      this.age[i] += dt;
      const x = this.age[i] / this.life[i];
      if (x >= 1) { this.kill(i); continue; }
      const i3 = i * 3;
      if (this.haze[i]) {
        this.p[i3] += 1.2 * dt;
        if (this.p[i3] > 75) this.p[i3] -= 150;
        this.iSize[i] = this.s0[i];
        const edge = Math.min(1, (75 - Math.abs(this.p[i3])) / 15);
        this.iAlpha[i] = this.a0[i] * edge * (0.8 + 0.2 * Math.sin(t * 0.2 + this.seed[i] * 30));
        this.seed[i] += dt * 0.004;
      } else {
        this.p[i3] += 1.6 * dt; this.p[i3 + 1] += 0.25 * dt;
        this.iSize[i] = this.s0[i] + (this.s1[i] - this.s0[i]) * Math.sqrt(x);
        this.iAlpha[i] = this.a0[i] * Math.min(1, x * 12) * Math.pow(1 - x, 1.5);
        this.seed[i] += dt * 0.01;
      }
      i++;
    }
    this.geo.instanceCount = this.n;
    this.aPos.needsUpdate = this.aSize.needsUpdate = this.aAlpha.needsUpdate = this.aSeed.needsUpdate = true;
  }
}
