import * as THREE from 'three';
import { V, strut, xf, paint, merge, canvasTex, stripeTex, LAYOUT, PALETTE, rr, rand } from './util.js';
import { Bulbs } from './bulbs.js';

const steelWhite = () => new THREE.MeshStandardMaterial({ color: 0xdfe4ea, metalness: 0.55, roughness: 0.35 });

// truss between a and b: two rails offset by +-w/2 along 'perp', zig-zag bracing
function truss(a, b, perp, w, n, r, out) {
  const o = perp.clone().multiplyScalar(w / 2);
  const a1 = a.clone().add(o), a2 = a.clone().sub(o), b1 = b.clone().add(o), b2 = b.clone().sub(o);
  out.push(strut(a1, b1, r), strut(a2, b2, r));
  for (let i = 0; i < n; i++) {
    const t0 = i / n, t1 = (i + 1) / n;
    const p = new THREE.Vector3().lerpVectors(a1, b1, t0);
    const q = new THREE.Vector3().lerpVectors(a2, b2, t1);
    const p2 = new THREE.Vector3().lerpVectors(a1, b1, t1);
    out.push(strut(p, q, r * 0.55, 4), strut(q, p2, r * 0.55, 4));
  }
}

// =====================================================================
// Ferris wheel
// =====================================================================
export function makeFerris(scene) {
  const [X, Z] = LAYOUT.ferris;
  const root = new THREE.Group();
  root.position.set(X, 0, Z);
  root.rotation.y = Math.atan2(-X, -Z) - 0.5;
  scene.add(root);
  const H = 19.5, R = 15, NS = 16, ZW = 1.6, NG = 16;
  const steel = steelWhite();

  const wheel = new THREE.Group();
  wheel.position.y = H;
  root.add(wheel);
  const parts = [];
  for (const sz of [-ZW, ZW]) {
    parts.push(xf(new THREE.TorusGeometry(R, 0.17, 6, 128), [0, 0, sz]));
    parts.push(xf(new THREE.TorusGeometry(R * 0.6, 0.12, 6, 96), [0, 0, sz]));
    parts.push(xf(new THREE.TorusGeometry(2.2, 0.16, 6, 32), [0, 0, sz * 1.1]));
    for (let i = 0; i < NS; i++) {
      const a = i / NS * Math.PI * 2, c = Math.cos(a), s = Math.sin(a);
      const a2 = (i + 0.5) / NS * Math.PI * 2, c2 = Math.cos(a2), s2 = Math.sin(a2);
      parts.push(strut(V(c * 1.3, s * 1.3, sz * 1.15), V(c * R, s * R, sz), 0.09));
      parts.push(strut(V(c * R * 0.6, s * R * 0.6, sz), V(c2 * R, s2 * R, sz), 0.06, 4));
      parts.push(strut(V(c2 * R, s2 * R, sz), V(Math.cos(a + Math.PI * 2 / NS) * R * 0.6, Math.sin(a + Math.PI * 2 / NS) * R * 0.6, sz), 0.06, 4));
    }
  }
  for (let i = 0; i < NG; i++) {
    const a = i / NG * Math.PI * 2;
    parts.push(strut(V(Math.cos(a) * R, Math.sin(a) * R, -ZW), V(Math.cos(a) * R, Math.sin(a) * R, ZW), 0.09));
    const b = (i + 0.5) / NG * Math.PI * 2;
    parts.push(strut(V(Math.cos(b) * R * 0.6, Math.sin(b) * R * 0.6, -ZW), V(Math.cos(b) * R * 0.6, Math.sin(b) * R * 0.6, ZW), 0.06, 4));
  }
  parts.push(xf(new THREE.CylinderGeometry(1.3, 1.3, 3.8, 24), [0, 0, 0], [Math.PI / 2, 0, 0]));
  wheel.add(new THREE.Mesh(merge(parts), steel));
  const hubCap = new THREE.Mesh(new THREE.CircleGeometry(1.25, 24),
    new THREE.MeshStandardMaterial({ color: 0xc03040, roughness: 0.4, metalness: 0.4 }));
  hubCap.position.z = 1.91; wheel.add(hubCap);
  const hubCap2 = hubCap.clone(); hubCap2.position.z = -1.91; hubCap2.rotation.y = Math.PI; wheel.add(hubCap2);

  // supports (static)
  const sp = [];
  const perpZ = V(0, 0, 1);
  for (const sz of [-1, 1]) {
    const top = V(0, H - 0.4, sz * 2.7);
    for (const sx of [-1, 1]) {
      truss(V(sx * 10, 0, sz * 4.4), top, perpZ, 0.9, 12, 0.13, sp);
    }
    sp.push(strut(V(-6.9, 6, sz * 3.85), V(6.9, 6, sz * 3.85), 0.12));
    sp.push(strut(V(-4.2, 11.5, sz * 3.5), V(4.2, 11.5, sz * 3.5), 0.1));
    sp.push(strut(V(-6.9, 6, sz * 3.85), V(4.2, 11.5, sz * 3.5), 0.08, 4));
    sp.push(strut(V(6.9, 6, sz * 3.85), V(-4.2, 11.5, sz * 3.5), 0.08, 4));
  }
  sp.push(xf(new THREE.CylinderGeometry(0.45, 0.45, 6.4, 16), [0, H, 0], [Math.PI / 2, 0, 0]));
  root.add(new THREE.Mesh(merge(sp), steel));
  // platform
  const conc = new THREE.MeshStandardMaterial({ color: 0x55504a, roughness: 0.6 });
  const plat = new THREE.Mesh(new THREE.BoxGeometry(9, 0.8, 5.2), conc); plat.position.y = 0.4; root.add(plat);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const f = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.5, 1.6), conc); f.position.set(sx * 10, 0.25, sz * 4.4); root.add(f);
  }
  const stair = new THREE.Mesh(new THREE.BoxGeometry(3, 0.4, 1.4), conc); stair.position.set(0, 0.2, 3.2); root.add(stair);
  const booth = new THREE.Mesh(new THREE.BoxGeometry(2, 2.4, 1.6), new THREE.MeshStandardMaterial({ color: 0x2a3a7a, roughness: 0.5 }));
  booth.position.set(5.5, 2.0, 0); root.add(booth);

  // wheel bulbs
  const wb = new Bulbs();
  for (const sz of [-ZW, ZW]) {
    const zz = sz * 1.08;
    for (let i = 0; i < 128; i++) {
      const a = i / 128 * Math.PI * 2;
      wb.add(V(Math.cos(a) * R, Math.sin(a) * R, zz), PALETTE[Math.floor(i / 4) % 6], i);
    }
    for (let i = 0; i < 64; i++) {
      const a = i / 64 * Math.PI * 2;
      wb.add(V(Math.cos(a) * R * 0.6, Math.sin(a) * R * 0.6, zz), 0xffd890, i * 2);
    }
  }
  const wheelBulbs = wb.build({ radius: 0.17, scale: 0.0625, speed: 1.0, offset: 0, bright: 1.9 });
  wheel.add(wheelBulbs);
  const spk = new Bulbs();
  for (const sz of [-ZW, ZW]) {
    for (let i = 0; i < NS; i++) {
      const a = i / NS * Math.PI * 2, c = Math.cos(a), s = Math.sin(a);
      for (let j = 0; j < 6; j++) {
        const t = (j + 1) / 7;
        const r = 1.3 + (R - 1.3) * t;
        spk.add(V(c * r, s * r, (sz * 1.15 + (sz - sz * 1.15) * t) * 1.06), [0xff3a8a, 0x3ad0ff, 0xffd040, 0x8a5aff][i % 4], j + (i % 2) * 4.5);
      }
    }
    for (let i = 0; i < 24; i++) {
      const a = i / 24 * Math.PI * 2;
      spk.add(V(Math.cos(a) * 2.2, Math.sin(a) * 2.2, sz * 1.2), 0xffffff, i);
    }
  }
  wheel.add(spk.build({ radius: 0.15, scale: 0.16, speed: 1.3, offset: 4, bright: 1.7 }));
  const legB = new Bulbs();
  for (const sz of [-1, 1]) for (const sx of [-1, 1]) {
    for (let i = 0; i < 14; i++) {
      const t = i / 14;
      legB.add(V(sx * 10 * (1 - t), (H - 0.4) * t + 0.3, sz * (4.4 + (2.7 - 4.4) * t) + sz * 0.55), 0xffe0b0, i);
    }
  }
  root.add(legB.build({ radius: 0.13, scale: 0.08, offset: 7 }));

  // gondolas (instanced, pivot at origin hanging down)
  const body = merge([
    xf(new THREE.CylinderGeometry(0.35, 1.05, 0.55, 16), [0, -1.05, 0]),
    xf(new THREE.CylinderGeometry(1.05, 1.05, 0.12, 16), [0, -1.38, 0]),
    xf(new THREE.CylinderGeometry(1.08, 0.9, 1.0, 16), [0, -2.5, 0]),
    xf(new THREE.SphereGeometry(0.5, 12, 6, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), [0, -2.95, 0], [0, 0, 0], [1.8, 0.5, 1.8]),
  ]);
  const frame = merge([
    strut(V(0, 0.05, -0.9), V(0, -0.85, -0.3), 0.06),
    strut(V(0, 0.05, 0.9), V(0, -0.85, 0.3), 0.06),
    xf(new THREE.CylinderGeometry(0.11, 0.11, 2.0, 8), [0, 0, 0], [Math.PI / 2, 0, 0]),
    ...[0, 1, 2, 3].map(k => {
      const a = k / 4 * Math.PI * 2 + Math.PI / 4;
      return strut(V(Math.cos(a) * 0.97, -1.4, Math.sin(a) * 0.97), V(Math.cos(a) * 1.0, -2.05, Math.sin(a) * 1.0), 0.05);
    }),
  ]);
  const gBody = new THREE.InstancedMesh(body, new THREE.MeshStandardMaterial({ roughness: 0.35, metalness: 0.3 }), NG);
  const gFrame = new THREE.InstancedMesh(frame, steel, NG);
  const gLamp = new THREE.InstancedMesh(new THREE.SphereGeometry(0.2, 8, 6).translate(0, -1.5, 0),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(2.6, 1.9, 1.1) }), NG);
  const gcols = [0xe03040, 0xf0a020, 0x30b060, 0x3070e0, 0xa040d0, 0xe05090, 0x20b0c0, 0xf06030];
  const c = new THREE.Color();
  for (let i = 0; i < NG; i++) gBody.setColorAt(i, c.set(gcols[i % gcols.length]));
  for (const m of [gBody, gFrame, gLamp]) { m.frustumCulled = false; root.add(m); }

  const light = new THREE.PointLight(0xff70c0, 260, 0, 1.6);
  light.position.set(0, H, 0);
  root.add(light);

  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), pos = new THREE.Vector3(), one = V(1, 1, 1), zAxis = V(0, 0, 1);
  const omega = Math.PI * 2 / 42;
  return {
    update(t) {
      const ang = t * omega;
      wheel.rotation.z = ang;
      for (let i = 0; i < NG; i++) {
        const a = ang + i / NG * Math.PI * 2;
        pos.set(Math.cos(a) * R, H + Math.sin(a) * R, 0);
        q.setFromAxisAngle(zAxis, 0.035 * Math.sin(t * 1.1 + i * 1.7) - 0.03 * Math.cos(a));
        m4.compose(pos, q, one);
        gBody.setMatrixAt(i, m4); gFrame.setMatrixAt(i, m4); gLamp.setMatrixAt(i, m4);
      }
      gBody.instanceMatrix.needsUpdate = gFrame.instanceMatrix.needsUpdate = gLamp.instanceMatrix.needsUpdate = true;
      light.color.setHSL((0.9 + 0.08 * Math.sin(t * 0.3)) % 1, 0.8, 0.6);
    },
  };
}

// =====================================================================
// Roller coaster
// =====================================================================
export function makeCoaster(scene) {
  const [X, Z] = LAYOUT.coaster;
  const root = new THREE.Group();
  root.position.set(X, 0, Z);
  scene.add(root);

  const cp = [
    [-14, 2, 14], [-7, 2, 14], [-1, 4, 14], [4, 9.5, 14], [8, 15, 14], [11.5, 19, 14], [15, 20.5, 14],
    [18.5, 18, 13.6], [21.5, 11, 12], [23.5, 4.5, 8.5], [24, 3.2, 3], [22.5, 5, -2], [19, 7.5, -6],
    [13.5, 6.5, -8.4], [8, 3.2, -8.3], [3.5, 2.2, -8],
  ];
  const xc = -2, yc = 9.2, rl = 7, z0 = -8, z1 = -4;
  for (let k = 0; k <= 8; k++) {
    const f = k / 8 * Math.PI * 2;
    cp.push([xc - rl * Math.sin(f) * (k === 0 || k === 8 ? 1 : 1), yc - rl * Math.cos(f), z0 + (z1 - z0) * k / 8]);
  }
  cp.push([-7.5, 2.4, -3.6], [-12.5, 6.5, -3], [-16.5, 9, -1.5], [-20, 6, 1.5], [-23, 3.5, 6], [-22.5, 2.8, 11], [-19, 2.2, 13.6]);
  const curve = new THREE.CatmullRomCurve3(cp.map(p => V(...p)), true, 'centripetal');
  const Ltot = curve.getLength();
  const N = 2000;
  const ds = Ltot / N;
  const Pp = [], T = [], Nn = [], Bb = [];
  for (let i = 0; i < N; i++) {
    const u = i / N;
    Pp.push(curve.getPointAt(u));
    T.push(curve.getTangentAt(u).normalize());
  }
  // parallel transport of the up vector
  const up = V(0, 1, 0);
  let n0 = up.clone().sub(T[0].clone().multiplyScalar(T[0].dot(up))).normalize();
  Nn.push(n0);
  for (let i = 1; i <= N; i++) {
    const t = T[i % N];
    const prev = Nn[i - 1];
    const n = prev.clone().sub(t.clone().multiplyScalar(t.dot(prev))).normalize();
    Nn.push(n);
  }
  const nEnd = Nn.pop();
  const twist = Math.atan2(new THREE.Vector3().crossVectors(nEnd, Nn[0]).dot(T[0]), nEnd.dot(Nn[0]));
  for (let i = 0; i < N; i++) Nn[i].applyAxisAngle(T[i], twist * i / N);
  // banking
  const lat = new Float32Array(N);
  const K = 18;
  for (let i = 0; i < N; i++) {
    const a = T[(i - K + N) % N], b = T[(i + K) % N];
    const dT = b.clone().sub(a).divideScalar(2 * K * ds);
    const B = new THREE.Vector3().crossVectors(Nn[i], T[i]);
    lat[i] = dT.dot(B) * THREE.MathUtils.smoothstep(Nn[i].y, 0.6, 0.95);
  }
  let lat2 = lat;
  for (let pass = 0; pass < 3; pass++) {
    const o = new Float32Array(N), w = 30;
    for (let i = 0; i < N; i++) { let s = 0; for (let k = -w; k <= w; k++) s += lat2[(i + k + N) % N]; o[i] = s / (2 * w + 1); }
    lat2 = o;
  }
  const Nb = [];
  for (let i = 0; i < N; i++) {
    const B = new THREE.Vector3().crossVectors(Nn[i], T[i]);
    const roll = THREE.MathUtils.clamp(lat2[i] * 7.5, -1.0, 1.0);
    const n = Nn[i].clone().multiplyScalar(Math.cos(roll)).add(B.multiplyScalar(Math.sin(roll))).normalize();
    Nb.push(n);
    Bb.push(new THREE.Vector3().crossVectors(n, T[i]).normalize());
  }

  // speeds
  let hMax = 0; for (const p of Pp) hMax = Math.max(hMax, p.y);
  const hRef = hMax + 1.0;
  let vel = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const p = Pp[i];
    const zone = p.z > 11 && p.x < 14.5 && p.y < hMax - 0.3;
    const station = p.z > 11 && p.x < -4 && p.x > -16;
    vel[i] = station ? 2.6 : zone ? 3.6 : Math.max(3.6, Math.sqrt(2 * 9.81 * (hRef - p.y)) * 0.92);
  }
  for (let pass = 0; pass < 3; pass++) {
    const o = new Float32Array(N), w = 40;
    for (let i = 0; i < N; i++) { let s = 0; for (let k = -w; k <= w; k++) s += vel[(i + k + N) % N]; o[i] = s / (2 * w + 1); }
    vel = o;
  }

  // ---- track geometry
  const railMat = new THREE.MeshStandardMaterial({ color: 0xd8302a, metalness: 0.5, roughness: 0.3 });
  const supMat = new THREE.MeshStandardMaterial({ color: 0xd8dde4, metalness: 0.5, roughness: 0.4 });
  const tube = (off, r) => {
    const pts = [];
    for (let i = 0; i < N; i += 2) pts.push(Pp[i].clone().addScaledVector(Bb[i], off[0]).addScaledVector(Nb[i], off[1]));
    return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, true), N, r, 7, true);
  };
  root.add(new THREE.Mesh(merge([tube([0.55, 0], 0.08), tube([-0.55, 0], 0.08)]), railMat));
  root.add(new THREE.Mesh(tube([0, -0.55], 0.22), railMat));
  // ties
  const tieGeo = merge([
    xf(new THREE.BoxGeometry(1.25, 0.1, 0.14), [0, -0.1, 0]),
    xf(new THREE.BoxGeometry(0.1, 0.42, 0.1), [0, -0.33, 0]),
    strut(V(0.55, -0.08, 0), V(0, -0.5, 0), 0.035, 4),
    strut(V(-0.55, -0.08, 0), V(0, -0.5, 0), 0.035, 4),
  ]);
  const tieStep = 6;
  const ties = new THREE.InstancedMesh(tieGeo, supMat, Math.floor(N / tieStep));
  const m4 = new THREE.Matrix4();
  for (let i = 0, k = 0; i + tieStep <= N; i += tieStep, k++) {
    m4.makeBasis(Bb[i], Nb[i], T[i]); m4.setPosition(Pp[i]);
    ties.setMatrixAt(k, m4);
  }
  root.add(ties);
  // supports
  const sg = [];
  const footings = [];
  for (let i = 0; i < N; i += 26) {
    if (Nb[i].y < 0.55) continue;
    const p = Pp[i].clone().addScaledVector(Nb[i], -0.6);
    if (p.y < 1.2) continue;
    let blocked = false;
    for (let j = 0; j < N; j += 3) {
      const d = Math.min(Math.abs(j - i), N - Math.abs(j - i));
      if (d < 50) continue;
      if (Pp[j].y < p.y && Math.hypot(Pp[j].x - p.x, Pp[j].z - p.z) < 1.9) { blocked = true; break; }
    }
    if (blocked) continue;
    if (p.y > 7.5) {
      const bh = V(Bb[i].x, 0, Bb[i].z).normalize();
      const spread = 1.0 + p.y * 0.1;
      const g1 = p.clone().addScaledVector(bh, spread); g1.y = 0;
      const g2 = p.clone().addScaledVector(bh, -spread); g2.y = 0;
      sg.push(strut(p, g1, 0.17), strut(p, g2, 0.17));
      const levels = Math.floor(p.y / 5);
      for (let l = 1; l <= levels; l++) {
        const t = 1 - l * 5 / p.y;
        if (t < 0.15) continue;
        const a = new THREE.Vector3().lerpVectors(g1, p, t), b = new THREE.Vector3().lerpVectors(g2, p, t);
        sg.push(strut(a, b, 0.08, 4));
        const t2 = Math.min(0.97, t + 2.5 / p.y);
        sg.push(strut(a, new THREE.Vector3().lerpVectors(g2, p, t2), 0.06, 4));
      }
      footings.push(g1, g2);
    } else {
      const g = p.clone(); g.y = 0;
      sg.push(strut(g, p, 0.2, 8));
      footings.push(g);
    }
  }
  // loop side supports
  root.add(new THREE.Mesh(merge(sg), supMat));
  const conc = new THREE.MeshStandardMaterial({ color: 0x5a5550, roughness: 0.7 });
  const ft = new THREE.InstancedMesh(new THREE.BoxGeometry(0.8, 0.35, 0.8), conc, footings.length);
  footings.forEach((f, i) => { m4.makeTranslation(f.x, 0.17, f.z); ft.setMatrixAt(i, m4); });
  root.add(ft);

  // track bulbs
  const tb = new Bulbs();
  for (let i = 0, k = 0; i < N; i += 11, k++) {
    for (const s of [-1, 1]) {
      const p = Pp[i].clone().addScaledVector(Bb[i], s * 0.72).addScaledVector(Nb[i], -0.12);
      tb.add(p, PALETTE[(k >> 2) % 6], k);
    }
  }
  root.add(tb.build({ radius: 0.12, scale: 0.05, speed: 1.4, offset: 2, bright: 1.9 }));

  // station
  {
    const plat = new THREE.Mesh(new THREE.BoxGeometry(11, 1.5, 2.6), conc);
    plat.position.set(-10.5, 0.75, 16.1); root.add(plat);
    const roofMat = new THREE.MeshStandardMaterial({ map: stripeTex('#c02838', '#f2e8d8', 14), roughness: 0.5, side: THREE.DoubleSide });
    const roof = new THREE.Mesh(new THREE.BoxGeometry(12, 0.25, 6.2), roofMat);
    roof.position.set(-10.5, 5.6, 14.8); root.add(roof);
    const posts = [];
    for (const x of [-16, -10.5, -5]) for (const z of [12.0, 17.6]) posts.push(xf(new THREE.CylinderGeometry(0.15, 0.15, 5.5, 8), [x, 2.75, z]));
    root.add(new THREE.Mesh(merge(posts), supMat));
    const sb = new Bulbs();
    for (let i = 0; i <= 30; i++) {
      const x = -16.5 + i * 0.4;
      sb.add(V(x, 5.4, 17.95), PALETTE[i % 6], i);
      sb.add(V(x, 5.4, 11.65), PALETTE[(i + 3) % 6], i);
    }
    root.add(sb.build({ radius: 0.12, scale: 0.12, offset: 6 }));
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(10, 0.1, 0.3), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 2.2, 2.0) }));
    lamp.position.set(-10.5, 5.42, 14.8); root.add(lamp);
  }

  // ---- train
  const cars = [];
  const NC = 5, gap = 2.45;
  const prof = new THREE.Shape();
  prof.moveTo(-1.1, 0.15); prof.lineTo(0.95, 0.15);
  prof.quadraticCurveTo(1.25, 0.2, 1.2, 0.7);
  prof.lineTo(0.75, 0.82); prof.lineTo(0.55, 0.55); prof.lineTo(-0.35, 0.55);
  prof.lineTo(-0.55, 1.0); prof.lineTo(-1.1, 1.0); prof.closePath();
  const bodyGeo = new THREE.ExtrudeGeometry(prof, { depth: 1.3, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.05, bevelSegments: 2 });
  bodyGeo.translate(0, 0, -0.65); bodyGeo.rotateY(-Math.PI / 2);
  const chassis = merge([
    xf(new THREE.BoxGeometry(1.0, 0.18, 1.8), [0, 0.06, 0]),
    ...[-0.7, 0.7].flatMap(z => [-0.55, 0.55].map(x => xf(new THREE.CylinderGeometry(0.11, 0.11, 0.12, 10), [x, 0.0, z], [0, 0, Math.PI / 2]))),
    xf(new THREE.BoxGeometry(1.1, 0.35, 0.12), [0, 0.95, -0.35]),
    xf(new THREE.BoxGeometry(1.1, 0.06, 0.06), [0, 1.0, 0.25]),
  ]);
  const chMat = new THREE.MeshStandardMaterial({ color: 0x202228, metalness: 0.6, roughness: 0.4 });
  const carCols = [0xf0c020, 0x2a7ae0, 0xe03a8a, 0x30c070, 0xf07020];
  const hl = new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 2.8, 2.2) });
  for (let k = 0; k < NC; k++) {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(bodyGeo, new THREE.MeshStandardMaterial({ color: carCols[k], metalness: 0.4, roughness: 0.25 })));
    g.add(new THREE.Mesh(chassis, chMat));
    if (k === 0) for (const x of [-0.4, 0.4]) {
      const h = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), hl); h.position.set(x, 0.55, 1.24); g.add(h);
    }
    // riders: simple heads
    for (const x of [-0.3, 0.3]) {
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), new THREE.MeshStandardMaterial({ color: [0x3a2a20, 0xc89060, 0x201510, 0xe0b080][(k + (x > 0)) % 4], roughness: 0.6 }));
      head.position.set(x, 1.15, -0.05); g.add(head);
      const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.2, 0.5, 8), new THREE.MeshStandardMaterial({ color: PALETTE[(k * 2 + (x > 0)) % 6], roughness: 0.7 }));
      torso.position.set(x, 0.8, -0.05); g.add(torso);
    }
    const trimB = new Bulbs();
    for (let i = 0; i < 6; i++) for (const x of [-0.72, 0.72]) trimB.add(V(x, 0.45, -0.9 + i * 0.38), 0xffffff, i + k * 6);
    g.add(trimB.build({ radius: 0.06, scale: 0.15, speed: 2, bright: 2.2 }));
    root.add(g);
    cars.push(g);
  }
  const light = new THREE.PointLight(0xff4080, 220, 0, 1.6);
  light.position.set(0, 8, 2); root.add(light);

  const tp = new THREE.Vector3(), tt = new THREE.Vector3(), tn = new THREE.Vector3(), tb2 = new THREE.Vector3();
  function frameAt(s) {
    s = ((s % Ltot) + Ltot) % Ltot;
    const f = s / ds;
    const i0 = Math.floor(f) % N, i1 = (i0 + 1) % N, a = f - Math.floor(f);
    tp.lerpVectors(Pp[i0], Pp[i1], a);
    tt.lerpVectors(T[i0], T[i1], a).normalize();
    tn.lerpVectors(Nb[i0], Nb[i1], a);
    tn.addScaledVector(tt, -tt.dot(tn)).normalize();
    tb2.crossVectors(tn, tt);
    return i0;
  }
  let sHead = Ltot * 0.35;
  return {
    update(t, dt) {
      const mid = frameAt(sHead - gap * (NC - 1) / 2);
      const v = vel[mid];
      sHead += v * dt;
      for (let k = 0; k < NC; k++) {
        frameAt(sHead - k * gap);
        m4.makeBasis(tb2, tn, tt);
        cars[k].quaternion.setFromRotationMatrix(m4);
        cars[k].position.copy(tp).addScaledVector(tn, 0.12);
      }
      light.color.setHSL((0.95 + 0.1 * Math.sin(t * 0.21)) % 1, 0.8, 0.6);
    },
  };
}

// =====================================================================
// Carousel
// =====================================================================
function horseGeometry(bodyC, maneC, saddleC) {
  const P = (g, c) => paint(g, c);
  const parts = [
    P(xf(new THREE.SphereGeometry(0.5, 14, 10), [0, 0, 0], [0, 0, 0], [1.25, 0.58, 0.46]), bodyC),
    P(xf(new THREE.SphereGeometry(0.33, 12, 8), [0.48, 0.06, 0], [0, 0, 0], [1, 1.05, 1.15]), bodyC),
    P(strut(V(0.55, 0.12, 0), V(0.86, 0.68, 0), 0.17, 10), bodyC),
    P(xf(new THREE.SphereGeometry(0.2, 12, 8), [1.03, 0.68, 0], [0, 0, -0.65], [1.55, 0.95, 0.85]), bodyC),
    P(xf(new THREE.ConeGeometry(0.05, 0.16, 5), [0.86, 0.9, 0.07]), bodyC),
    P(xf(new THREE.ConeGeometry(0.05, 0.16, 5), [0.86, 0.9, -0.07]), bodyC),
    P(xf(new THREE.BoxGeometry(0.12, 0.6, 0.06), [0.66, 0.55, 0], [0, 0, -0.65]), maneC),
    P(xf(new THREE.ConeGeometry(0.13, 0.75, 8), [-0.72, -0.1, 0], [0, 0, -2.4]), maneC),
    P(xf(new THREE.BoxGeometry(0.5, 0.09, 0.52), [0.02, 0.28, 0]), saddleC),
    P(xf(new THREE.BoxGeometry(0.62, 0.32, 0.5), [0.02, 0.12, 0], [0, 0, 0], [1, 1, 1.02]), saddleC),
  ];
  for (const z of [-0.14, 0.14]) {
    parts.push(P(strut(V(0.45, -0.18, z), V(0.78, -0.42, z), 0.07, 6), bodyC));
    parts.push(P(strut(V(0.78, -0.42, z), V(0.62, -0.72, z), 0.06, 6), bodyC));
    parts.push(P(strut(V(-0.45, -0.2, z), V(-0.58, -0.6, z), 0.08, 6), bodyC));
    parts.push(P(strut(V(-0.58, -0.6, z), V(-0.82, -0.9, z), 0.06, 6), bodyC));
  }
  return merge(parts);
}

export function makeCarousel(scene) {
  const [X, Z] = LAYOUT.carousel;
  const root = new THREE.Group(); root.position.set(X, 0, Z); scene.add(root);
  const gold = new THREE.MeshStandardMaterial({ color: 0xe0a840, metalness: 0.85, roughness: 0.25 });
  const base = new THREE.Mesh(new THREE.CylinderGeometry(8.4, 8.6, 0.5, 48), new THREE.MeshStandardMaterial({ color: 0x6a5a50, roughness: 0.5 }));
  base.position.y = 0.25; root.add(base);
  const step = new THREE.Mesh(new THREE.CylinderGeometry(9.1, 9.2, 0.22, 48), new THREE.MeshStandardMaterial({ color: 0x4a423c, roughness: 0.6 }));
  step.position.y = 0.11; root.add(step);

  const rot = new THREE.Group(); rot.position.y = 0.5; root.add(rot);
  const deck = canvasTex(512, 512, (ctx, w, h) => {
    ctx.fillStyle = '#6a3a22'; ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#3a2012'; ctx.lineWidth = 3;
    for (let i = 0; i < 32; i++) {
      const a = i / 32 * Math.PI * 2;
      ctx.beginPath(); ctx.moveTo(w / 2, h / 2); ctx.lineTo(w / 2 + Math.cos(a) * w, h / 2 + Math.sin(a) * h); ctx.stroke();
    }
    for (let r = 40; r < w / 2; r += 40) { ctx.beginPath(); ctx.arc(w / 2, h / 2, r, 0, 7); ctx.stroke(); }
  });
  const platform = new THREE.Mesh(new THREE.CylinderGeometry(7.9, 7.9, 0.25, 48),
    [new THREE.MeshStandardMaterial({ color: 0xd8a040, metalness: 0.7, roughness: 0.3 }), new THREE.MeshStandardMaterial({ map: deck, roughness: 0.5 }), new THREE.MeshStandardMaterial({ color: 0x302018 })]);
  platform.position.y = 0.12; rot.add(platform);

  const mirror = canvasTex(512, 256, (ctx, w, h) => {
    ctx.fillStyle = '#5a1020'; ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 8; i++) {
      const x = i * w / 8;
      ctx.fillStyle = '#e0b050'; ctx.fillRect(x + 4, 20, w / 8 - 8, h - 40);
      const g = ctx.createLinearGradient(x, 0, x + w / 8, h);
      g.addColorStop(0, '#a0c8ff'); g.addColorStop(0.5, '#fff4d8'); g.addColorStop(1, '#8090c0');
      ctx.fillStyle = g; ctx.fillRect(x + 12, 30, w / 8 - 24, h - 60);
    }
  });
  const column = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.4, 5.6, 24, 1, true),
    new THREE.MeshStandardMaterial({ map: mirror, emissiveMap: mirror, emissive: 0xffffff, emissiveIntensity: 0.9, roughness: 0.2, metalness: 0.3 }));
  column.position.y = 3.0; rot.add(column);

  const board = canvasTex(1024, 128, (ctx, w, h) => {
    ctx.fillStyle = '#8a1428'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#e8b850'; ctx.fillRect(0, 0, w, 10); ctx.fillRect(0, h - 10, w, 10);
    for (let i = 0; i < 16; i++) {
      const x = (i + 0.5) * w / 16;
      ctx.strokeStyle = '#f0c860'; ctx.lineWidth = 5;
      ctx.beginPath(); ctx.ellipse(x, h / 2, 22, 34, 0, 0, 7); ctx.stroke();
      ctx.fillStyle = ['#40a0e0', '#f0e0c0'][i % 2];
      ctx.beginPath(); ctx.ellipse(x, h / 2, 16, 28, 0, 0, 7); ctx.fill();
    }
  });
  const ring = new THREE.Mesh(new THREE.CylinderGeometry(8.2, 8.2, 1.1, 64, 1, true),
    new THREE.MeshStandardMaterial({ map: board, emissiveMap: board, emissive: 0xffffff, emissiveIntensity: 0.35, side: THREE.DoubleSide, roughness: 0.4 }));
  ring.position.y = 6.25; rot.add(ring);
  const canopyTex = stripeTex('#c01830', '#f6ecd6', 24, 1024, 64, (ctx, w, h) => {
    ctx.fillStyle = '#e8b850'; ctx.fillRect(0, h - 6, w, 6);
  });
  const canopy = new THREE.Mesh(new THREE.ConeGeometry(8.6, 3.2, 48, 1, true),
    new THREE.MeshStandardMaterial({ map: canopyTex, roughness: 0.5, side: THREE.DoubleSide }));
  canopy.position.y = 6.8 + 1.6; rot.add(canopy);
  const under = new THREE.Mesh(new THREE.CircleGeometry(8.2, 48).rotateX(Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: 0xf0d8a0, emissive: 0x402810, roughness: 0.6 }));
  under.position.y = 5.7; rot.add(under);
  const drum = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 0.9, 24), gold); drum.position.y = 10.2; rot.add(drum);
  const cap = new THREE.Mesh(new THREE.ConeGeometry(1.4, 1.4, 24), new THREE.MeshStandardMaterial({ map: canopyTex, roughness: 0.5 }));
  cap.position.y = 11.3; rot.add(cap);
  const fin = new THREE.Mesh(new THREE.SphereGeometry(0.3, 12, 8), gold); fin.position.y = 12.2; rot.add(fin);
  const flag = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.6), new THREE.MeshStandardMaterial({ color: 0x2060e0, side: THREE.DoubleSide }));
  flag.position.set(0.6, 12.8, 0); rot.add(flag);
  const fpole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.4, 6), gold); fpole.position.y = 12.8; rot.add(fpole);
  // scallops
  const sc = [];
  for (let i = 0; i < 64; i++) {
    const a = i / 64 * Math.PI * 2;
    const g = new THREE.CircleGeometry(0.42, 10, Math.PI, Math.PI);
    g.translate(0, 0, 0);
    g.rotateY(-a + Math.PI / 2);
    g.translate(Math.cos(a) * 8.22, 5.7, Math.sin(a) * 8.22);
    sc.push(paint(g, i % 2 ? 0xe0b050 : 0xb01830));
  }
  const scm = new THREE.Mesh(merge(sc), new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.4 }));
  rot.add(scm);

  // poles & horses
  const variants = [
    horseGeometry(0xf4f0e8, 0xe0c070, 0xc02030),
    horseGeometry(0x2a2a30, 0xd8d8d8, 0x2050c0),
    horseGeometry(0x8a4a26, 0x2a1a10, 0x20a060),
    horseGeometry(0xb8b8c4, 0x505058, 0xd09020),
  ];
  const hm = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.3, metalness: 0.15 });
  const horses = [];
  const poleGeos = [];
  for (const [r, n, off] of [[6.3, 12, 0], [4.2, 10, 0.3]]) {
    for (let i = 0; i < n; i++) {
      const a = i / n * Math.PI * 2 + off;
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      poleGeos.push(xf(new THREE.CylinderGeometry(0.055, 0.055, 5.3, 8), [x, 2.9, z]));
      const h = new THREE.Mesh(variants[(i + (r < 5 ? 2 : 0)) % 4], hm);
      h.position.set(x, 2.2, z);
      h.rotation.y = Math.PI / 2 - a;
      h.scale.setScalar(r < 5 ? 1.0 : 1.12);
      rot.add(h);
      horses.push({ h, ph: i * 1.7 + r });
    }
  }
  rot.add(new THREE.Mesh(merge(poleGeos), gold));

  // bulbs
  const b1 = new Bulbs();
  for (let i = 0; i < 96; i++) {
    const a = i / 96 * Math.PI * 2;
    b1.add(V(Math.cos(a) * 8.28, 6.6, Math.sin(a) * 8.28), [0xffd890, 0xffd890, 0xff4060][i % 3], i);
    b1.add(V(Math.cos(a) * 8.28, 5.92, Math.sin(a) * 8.28), [0xffd890, 0x60c0ff][i % 2], i + 0.5);
  }
  rot.add(b1.build({ radius: 0.13, scale: 0.0625, offset: 1, bright: 2.0 }));
  const b2 = new Bulbs();
  for (let i = 0; i < 24; i++) {
    const a = i / 24 * Math.PI * 2;
    for (let j = 0; j < 7; j++) {
      const t = j / 7;
      const r = 8.6 * (1 - t) + 0.9 * t;
      b2.add(V(Math.cos(a) * (r + 0.08), 6.8 + 3.2 * (1 - r / 8.6) + 0.08, Math.sin(a) * (r + 0.08)), PALETTE[i % 6], j + i * 0.5);
    }
  }
  for (let i = 0; i < 20; i++) {
    const a = i / 20 * Math.PI * 2;
    b2.add(V(Math.cos(a) * 1.25, 10.6, Math.sin(a) * 1.25), 0xffffff, i);
    b2.add(V(Math.cos(a) * 1.45, 5.75, Math.sin(a) * 1.45), 0xffd890, i);
  }
  rot.add(b2.build({ radius: 0.12, scale: 0.14, speed: 1.2, offset: 3.5, bright: 1.9 }));
  const b3 = new Bulbs();
  for (let i = 0; i < 72; i++) {
    const a = i / 72 * Math.PI * 2;
    b3.add(V(Math.cos(a) * 8.65, 0.55, Math.sin(a) * 8.65), 0xffc070, i);
  }
  root.add(b3.build({ radius: 0.1, scale: 0.1, offset: 6 }));

  const light = new THREE.PointLight(0xffb060, 160, 0, 1.6);
  light.position.set(0, 4.5, 0); root.add(light);
  const light2 = new THREE.PointLight(0xffa050, 40, 0, 2);
  light2.position.set(0, 8, 0); root.add(light2);

  const omega = Math.PI * 2 / 16;
  return {
    update(t) {
      rot.rotation.y = t * omega;
      for (const { h, ph } of horses) h.position.y = 2.15 + 0.42 * Math.sin(t * 2.3 + ph);
      flag.rotation.y = Math.sin(t * 3) * 0.2;
    },
  };
}

// =====================================================================
// Swinging pirate ship
// =====================================================================
export function makePirate(scene) {
  const [X, Z] = LAYOUT.pirate;
  const root = new THREE.Group(); root.position.set(X, 0, Z); root.rotation.y = 0.35; scene.add(root);
  const PH = 13;
  const steel = new THREE.MeshStandardMaterial({ color: 0x2a5ab0, metalness: 0.5, roughness: 0.35 });
  const fr = [];
  const perpZ = V(0, 0, 1);
  for (const sz of [-1, 1]) {
    for (const sx of [-1, 1]) truss(V(sx * 8.5, 0, sz * 4.3), V(0, PH + 0.3, sz * 3.0), perpZ, 0.7, 10, 0.13, fr);
    fr.push(strut(V(-5.6, 4.5, sz * 3.86), V(5.6, 4.5, sz * 3.86), 0.11));
  }
  fr.push(xf(new THREE.CylinderGeometry(0.4, 0.4, 7.2, 16), [0, PH, 0], [Math.PI / 2, 0, 0]));
  root.add(new THREE.Mesh(merge(fr), steel));
  const conc = new THREE.MeshStandardMaterial({ color: 0x55504a, roughness: 0.6 });
  const pad = new THREE.Mesh(new THREE.BoxGeometry(19, 0.3, 10), conc); pad.position.y = 0.15; root.add(pad);
  const fence = [];
  for (let i = 0; i <= 18; i++) fence.push(xf(new THREE.CylinderGeometry(0.04, 0.04, 1, 4), [-9 + i, 0.8, 5]));
  fence.push(xf(new THREE.BoxGeometry(18, 0.06, 0.06), [0, 1.25, 5]));
  root.add(new THREE.Mesh(merge(fence), steel));

  const swing = new THREE.Group(); swing.position.y = PH; root.add(swing);
  const arms = [];
  const HY = -11.0; // hull center offset
  for (const sz of [-1.95, 1.95]) {
    arms.push(strut(V(0, 0, sz), V(-3.8, HY + 1.0, sz), 0.15));
    arms.push(strut(V(0, 0, sz), V(3.8, HY + 1.0, sz), 0.15));
    arms.push(strut(V(-3.8, HY + 1.0, sz), V(3.8, HY + 1.0, sz), 0.12));
    arms.push(strut(V(-1.9, HY / 2 + 0.5, sz), V(1.9, HY / 2 + 0.5, sz), 0.09));
  }
  arms.push(xf(new THREE.CylinderGeometry(0.9, 0.9, 4.4, 16), [0, 0, 0], [Math.PI / 2, 0, 0]));
  swing.add(new THREE.Mesh(merge(arms), steel));

  const hullTex = canvasTex(256, 512, (ctx, w, h) => {
    ctx.fillStyle = '#5a3018'; ctx.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 16) {
      ctx.fillStyle = `rgb(${70 + Math.random() * 30 | 0},${38 + Math.random() * 16 | 0},${18 + Math.random() * 10 | 0})`;
      ctx.fillRect(0, y, w, 14);
    }
    const row = v => (1 - v) * h;
    ctx.fillStyle = '#e0b050'; ctx.fillRect(0, row(0.69), w, 14);
    ctx.fillStyle = '#a01820'; ctx.fillRect(0, row(0.56), w, 34);
    ctx.fillStyle = '#e0b050'; ctx.fillRect(0, row(0.48), w, 6);
  });
  hullTex.wrapS = hullTex.wrapT = THREE.RepeatWrapping;
  hullTex.repeat.set(1 / 12, 1 / 4);
  hullTex.offset.set(0.5, 0.425);
  const shape = new THREE.Shape();
  shape.moveTo(-6.2, 2.4);
  shape.quadraticCurveTo(-4.8, -1.7, 0, -1.7);
  shape.quadraticCurveTo(4.8, -1.7, 6.2, 2.4);
  shape.lineTo(5.4, 2.4); shape.lineTo(4.6, 1.0); shape.lineTo(-4.6, 1.0); shape.lineTo(-5.4, 2.4); shape.closePath();
  const hullGeo = new THREE.ExtrudeGeometry(shape, { depth: 3.4, bevelEnabled: true, bevelThickness: 0.08, bevelSize: 0.08, bevelSegments: 2, curveSegments: 24 });
  hullGeo.translate(0, HY, -1.7);
  const hull = new THREE.Mesh(hullGeo, new THREE.MeshStandardMaterial({ map: hullTex, roughness: 0.55 }));
  swing.add(hull);
  const seats = [];
  for (let i = -3; i <= 3; i++) {
    seats.push(xf(new THREE.BoxGeometry(0.5, 0.4, 3.2), [i * 1.3, HY + 1.2, 0]));
    seats.push(xf(new THREE.BoxGeometry(0.12, 0.7, 3.2), [i * 1.3 - 0.3 * Math.sign(i || 1), HY + 1.5, 0]));
  }
  swing.add(new THREE.Mesh(merge(seats), new THREE.MeshStandardMaterial({ color: 0x3a2214, roughness: 0.7 })));
  // mast & sail
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 7.5, 10), new THREE.MeshStandardMaterial({ color: 0x4a2a14 }));
  mast.position.set(0, HY + 4.6, 0); swing.add(mast);
  const yard = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 3.6, 6).rotateX(Math.PI / 2), mast.material);
  yard.position.set(0, HY + 7.3, 0); swing.add(yard);
  const sailGeo = new THREE.PlaneGeometry(3.3, 3.4, 8, 8);
  const sp = sailGeo.attributes.position;
  for (let i = 0; i < sp.count; i++) {
    const x = sp.getX(i), y = sp.getY(i);
    sp.setZ(i, 0.45 * Math.cos(x / 3.3 * Math.PI) * (0.6 + 0.4 * Math.cos(y / 3.4 * Math.PI)));
  }
  sailGeo.computeVertexNormals();
  sailGeo.rotateY(Math.PI / 2);
  const sail = new THREE.Mesh(sailGeo, new THREE.MeshStandardMaterial({ map: stripeTex('#f0e6d0', '#b02028', 6, 256, 64), side: THREE.DoubleSide, roughness: 0.7 }));
  sail.position.set(0.1, HY + 5.5, 0); swing.add(sail);
  const flag = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.7), new THREE.MeshStandardMaterial({ color: 0x101014, side: THREE.DoubleSide }));
  flag.position.set(0.6, HY + 8.0, 0); swing.add(flag);
  // shields
  const sh = [];
  for (let i = -3; i <= 3; i++) for (const sz of [-1, 1]) {
    const g = new THREE.CircleGeometry(0.34, 14);
    if (sz < 0) g.rotateY(Math.PI);
    g.translate(i * 1.3, HY + 0.55, sz * 1.82);
    sh.push(paint(g, [0xd0a040, 0x2050b0, 0xb02028][(i + 3) % 3]));
  }
  swing.add(new THREE.Mesh(merge(sh), new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.6, roughness: 0.3 })));

  // bulbs along the hull
  const hb = new Bulbs();
  const qb = (t, p0, p1, p2) => (1 - t) * (1 - t) * p0 + 2 * (1 - t) * t * p1 + t * t * p2;
  for (const sz of [-1.86, 1.86]) {
    let k = 0;
    for (let i = 0; i <= 24; i++) { // keel curve
      const t = i / 24;
      const x = t < 0.5 ? qb(t * 2, -6.2, -4.8, 0) : qb(t * 2 - 1, 0, 4.8, 6.2);
      const y = t < 0.5 ? qb(t * 2, 2.4, -1.7, -1.7) : qb(t * 2 - 1, -1.7, -1.7, 2.4);
      hb.add(V(x * 0.97, HY + y * 0.94 + 0.12, sz), PALETTE[k % 6], k++);
    }
    for (let i = 0; i <= 18; i++) hb.add(V(-4.6 + i * 9.2 / 18, HY + 1.12, sz), 0xffd890, i);
  }
  for (let i = 0; i < 10; i++) hb.add(V(0, HY + 1.2 + i * 0.7, 0.2), 0xffffff, i);
  swing.add(hb.build({ radius: 0.13, scale: 0.08, speed: 1.4, offset: 2.5, bright: 1.9 }));
  const ab = new Bulbs();
  for (const sz of [-2.15, 2.15]) for (const sx of [-1, 1]) for (let i = 0; i < 12; i++) {
    const t = (i + 0.5) / 12;
    ab.add(V(sx * 3.8 * t, HY * t + 1.0 * t, sz), 0x60c0ff, i);
  }
  swing.add(ab.build({ radius: 0.11, scale: 0.08, speed: 1.8, offset: 8 }));
  const fb = new Bulbs();
  for (const sz of [-1, 1]) for (const sx of [-1, 1]) for (let i = 0; i < 14; i++) {
    const t = i / 14;
    fb.add(V(sx * 8.5 * (1 - t), PH * t + 0.4, sz * (4.3 - 1.3 * t) + sz * 0.45), 0xffe0b0, i);
  }
  root.add(fb.build({ radius: 0.12, scale: 0.07, offset: 4 }));

  const light = new THREE.PointLight(0x50a0ff, 140, 0, 1.6);
  light.position.set(0, 4, 0); root.add(light);

  return {
    update(t) {
      const A = 0.92 + 0.22 * Math.sin(t * 0.09);
      swing.rotation.z = A * Math.sin(t * Math.PI * 2 / 7.2);
      flag.rotation.y = Math.sin(t * 4) * 0.3;
    },
  };
}
