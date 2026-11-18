import * as THREE from 'three';
import { Reflector } from 'three/addons/objects/Reflector.js';
import {
  rand, rr, V, strut, xf, paint, merge, canvasTex, glowTexture, stripeTex, catenary,
  LAYOUT, PALETTE, TIME,
} from './util.js';
import { Bulbs } from './bulbs.js';

const W = 240, S = 2048;
const P = v => (v + W / 2) / W * S;
const M = m => m * S / W;

const WARM = 0xffc070;
const RIDE_PADS = [
  [LAYOUT.ferris[0], LAYOUT.ferris[1], 15],
  [LAYOUT.carousel[0], LAYOUT.carousel[1], 11.5],
  [LAYOUT.pirate[0], LAYOUT.pirate[1], 11],
  [LAYOUT.coaster[0] - 10, LAYOUT.coaster[1] + 15.5, 7],
];

function drawPaths(ctx, extra = 0) {
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const line = (pts, w) => {
    ctx.lineWidth = M(w + extra); ctx.beginPath();
    pts.forEach((p, i) => i ? ctx.lineTo(P(p[0]), P(p[1])) : ctx.moveTo(P(p[0]), P(p[1])));
    ctx.stroke();
  };
  const disc = (x, z, r) => { ctx.beginPath(); ctx.arc(P(x), P(z), M(r + extra / 2), 0, Math.PI * 2); ctx.fill(); };
  const ring = (r, w) => { ctx.lineWidth = M(w + extra); ctx.beginPath(); ctx.arc(P(0), P(0), M(r), 0, Math.PI * 2); ctx.stroke(); };
  disc(0, 0, 18);
  line([[0, 118], [0, 10]], 9);
  ring(31, 6);
  for (const [x, z, r] of RIDE_PADS) { line([[0, 0], [x, z]], 5); disc(x, z, r); }
  line([[0, 0], [-46, 12]], 4); line([[-32, 36], [-15, 18]], 4); line([[34, 40], [20, 27]], 4);
  disc(-32, 36, 6); disc(34, 40, 6); disc(-46, 12, 6);
  disc(0, 62, 9);
}

function groundTextures() {
  const R = rand;
  const mask = document.createElement('canvas'); mask.width = mask.height = S;
  const mctx = mask.getContext('2d');
  mctx.fillStyle = mctx.strokeStyle = '#fff';
  drawPaths(mctx);

  const map = canvasTex(S, S, (ctx) => {
    ctx.fillStyle = '#0b130b'; ctx.fillRect(0, 0, S, S);
    for (let i = 0; i < 26000; i++) {
      const g = 14 + R() * 26;
      ctx.fillStyle = `rgba(${g * 0.55 | 0},${g | 0},${g * 0.45 | 0},${0.35 + R() * 0.4})`;
      ctx.fillRect(R() * S, R() * S, 2 + R() * 8, 2 + R() * 8);
    }
    // curbs
    ctx.fillStyle = ctx.strokeStyle = '#3a3836';
    drawPaths(ctx, 0.8);
    // paving layer
    const lay = document.createElement('canvas'); lay.width = lay.height = S;
    const l = lay.getContext('2d');
    l.drawImage(mask, 0, 0);
    l.globalCompositeOperation = 'source-in';
    l.fillStyle = '#4a4540'; l.fillRect(0, 0, S, S);
    l.globalCompositeOperation = 'source-atop';
    for (let i = 0; i < 50000; i++) {
      const g = 50 + R() * 40;
      l.fillStyle = `rgba(${g | 0},${(g * 0.95) | 0},${(g * 0.9) | 0},0.5)`;
      const tx = Math.floor(R() * S / 4.3) * 4.3, ty = Math.floor(R() * S / 4.3) * 4.3;
      l.fillRect(tx, ty, 4.3, 4.3);
    }
    l.strokeStyle = 'rgba(20,18,16,0.55)'; l.lineWidth = 0.8;
    for (let x = 0; x < S; x += 4.3) { l.beginPath(); l.moveTo(x, 0); l.lineTo(x, S); l.stroke(); }
    for (let y = 0; y < S; y += 4.3) { l.beginPath(); l.moveTo(0, y); l.lineTo(S, y); l.stroke(); }
    // wet puddles darken
    for (let i = 0; i < 260; i++) {
      l.fillStyle = `rgba(20,22,26,${0.15 + R() * 0.15})`;
      l.beginPath(); l.ellipse(R() * S, R() * S, 6 + R() * 30, 4 + R() * 16, R() * 3, 0, Math.PI * 2); l.fill();
    }
    ctx.drawImage(lay, 0, 0);
  });
  map.wrapS = map.wrapT = THREE.ClampToEdgeWrapping;

  const rough = canvasTex(S, S, (ctx) => {
    ctx.fillStyle = 'rgb(225,225,225)'; ctx.fillRect(0, 0, S, S);
    const lay = document.createElement('canvas'); lay.width = lay.height = S;
    const l = lay.getContext('2d');
    l.drawImage(mask, 0, 0);
    l.globalCompositeOperation = 'source-in';
    l.fillStyle = 'rgb(95,95,95)'; l.fillRect(0, 0, S, S);
    l.globalCompositeOperation = 'source-atop';
    const R2 = rand;
    for (let i = 0; i < 900; i++) {
      const v = 55 + R2() * 30 | 0;
      l.fillStyle = `rgba(${v},${v},${v},${0.3 + R2() * 0.4})`;
      l.beginPath(); l.ellipse(R2() * S, R2() * S, 4 + R2() * 18, 3 + R2() * 10, R2() * 3, 0, Math.PI * 2); l.fill();
    }
    ctx.drawImage(lay, 0, 0);
  }, false);
  return { map, rough };
}

const PondShader = {
  name: 'PondShader',
  uniforms: {
    color: { value: null }, tDiffuse: { value: null }, textureMatrix: { value: null }, uTime: { value: 0 },
  },
  vertexShader: /* glsl */`
    uniform mat4 textureMatrix;
    varying vec4 vUv;
    varying vec2 vP;
    void main() {
      vUv = textureMatrix * vec4(position, 1.0);
      vP = position.xy;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }`,
  fragmentShader: /* glsl */`
    uniform vec3 color;
    uniform sampler2D tDiffuse;
    uniform float uTime;
    varying vec4 vUv;
    varying vec2 vP;
    void main() {
      vec2 p = vP;
      vec2 w = vec2(
        sin(p.x * 1.9 + uTime * 1.3) + sin(p.y * 2.7 - uTime * 0.9) + 0.5 * sin((p.x + p.y) * 4.1 + uTime * 2.1),
        cos(p.y * 2.1 + uTime * 1.1) + sin(p.x * 3.1 + uTime * 0.7) + 0.5 * cos((p.x - p.y) * 3.7 - uTime * 1.7));
      vec4 uv = vUv;
      uv.xy += w * 0.0045 * uv.w;
      vec3 refl = texture2DProj(tDiffuse, uv).rgb;
      float e = length(p / vec2(10.0, 7.0));
      vec3 c = refl * color * (0.85 - 0.25 * e) + vec3(0.002, 0.005, 0.01);
      gl_FragColor = vec4(c, 1.0);
    }`,
};

function makeGlowDecals(scene, list) {
  const geo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  const mat = new THREE.MeshBasicMaterial({
    map: glowTexture(), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
  });
  const mesh = new THREE.InstancedMesh(geo, mat, list.length);
  const m = new THREE.Matrix4(), c = new THREE.Color();
  list.forEach(([x, z, r, col, k], i) => {
    m.makeScale(r * 2, 1, r * 2); m.setPosition(x, 0.07, z);
    mesh.setMatrixAt(i, m);
    c.set(col).multiplyScalar(k ?? 0.5);
    mesh.setColorAt(i, c);
  });
  mesh.renderOrder = 0.5;
  scene.add(mesh);
}

function stringLights(group, bulbs, a, b, sag, n, phase0, colors, wire) {
  const pts = catenary(a, b, sag, n);
  for (let i = 1; i < n; i++) {
    const p = pts[i].clone(); p.y -= 0.12;
    bulbs.add(p, colors[(i + phase0) % colors.length], phase0 + i);
  }
  for (let i = 0; i < n; i++) wire.push(pts[i], pts[i + 1]);
}

export function makePark(scene) {
  const decals = [];
  const wire = [];
  const strings = new Bulbs();
  const deco = new Bulbs();

  // ---------- Ground ----------
  const { map, rough } = groundTextures();
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(W, W).rotateX(-Math.PI / 2),
    new THREE.MeshStandardMaterial({ map, roughnessMap: rough, roughness: 1, metalness: 0.0, color: 0xb0b0b0 }));
  scene.add(ground);
  // far ground beyond the textured area
  const far = new THREE.Mesh(new THREE.RingGeometry(W / 2 * 0.98, 700, 64).rotateX(-Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: 0x070b07, roughness: 1 }));
  far.position.y = -0.02;
  scene.add(far);

  // ---------- Pond with reflection ----------
  const pondGeo = new THREE.CircleGeometry(1, 72).scale(10, 7, 1);
  const pond = new Reflector(pondGeo, {
    textureWidth: 768, textureHeight: 768, clipBias: 0.002, color: 0x8090a8, shader: PondShader,
  });
  pond.material.uniforms.uTime = TIME;
  pond.rotation.x = -Math.PI / 2;
  pond.position.set(0, 0.08, 0);
  scene.add(pond);
  class Ell extends THREE.Curve {
    getPoint(t, o = new THREE.Vector3()) { const a = t * Math.PI * 2; return o.set(Math.cos(a) * 10.25, 0.14, Math.sin(a) * 7.25); }
  }
  const stone = new THREE.MeshStandardMaterial({ color: 0x77706a, roughness: 0.55 });
  scene.add(new THREE.Mesh(new THREE.TubeGeometry(new Ell(), 160, 0.38, 8, true), stone));
  // small fountain jets as lights in the pond
  for (let i = 0; i < 16; i++) {
    const a = i / 16 * Math.PI * 2;
    deco.add(V(Math.cos(a) * 10.25, 0.6, Math.sin(a) * 7.25), PALETTE[i % 6], i);
  }

  const iron = new THREE.MeshStandardMaterial({ color: 0x1c2620, roughness: 0.4, metalness: 0.7 });
  const wood = new THREE.MeshStandardMaterial({ color: 0x4a3222, roughness: 0.7 });
  const white = new THREE.MeshStandardMaterial({ color: 0xe8e2d8, roughness: 0.5 });
  const red = new THREE.MeshStandardMaterial({ color: 0xa8222a, roughness: 0.45 });
  const gold = new THREE.MeshStandardMaterial({ color: 0xd8a040, roughness: 0.3, metalness: 0.8 });

  // ---------- Entrance gate ----------
  {
    const g = new THREE.Group();
    g.position.set(LAYOUT.gate[0], 0, LAYOUT.gate[1]);
    scene.add(g);
    const towerTex = canvasTex(128, 512, (ctx, w, h) => {
      ctx.fillStyle = '#7a1e2a'; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#e8d8b0';
      for (let y = 0; y < h; y += 64) { ctx.fillRect(0, y, w, 6); }
      ctx.fillStyle = '#d8a040';
      for (let y = 32; y < h; y += 64) { ctx.beginPath(); ctx.arc(w / 2, y, 14, 0, 7); ctx.fill(); }
    });
    const towerMat = new THREE.MeshStandardMaterial({ map: towerTex, roughness: 0.5 });
    const roofMat = new THREE.MeshStandardMaterial({ map: stripeTex('#1d3f8a', '#e8d8b0', 8, 256, 64), roughness: 0.45, side: THREE.DoubleSide });
    for (const sx of [-1, 1]) {
      const tw = new THREE.Mesh(new THREE.BoxGeometry(3, 11, 3), towerMat);
      tw.position.set(sx * 8.5, 5.5, 0); g.add(tw);
      const roof = new THREE.Mesh(new THREE.ConeGeometry(2.7, 4.5, 4, 1, true), roofMat);
      roof.rotation.y = Math.PI / 4; roof.position.set(sx * 8.5, 13.25, 0); g.add(roof);
      const ball = new THREE.Mesh(new THREE.SphereGeometry(0.35, 12, 8), gold);
      ball.position.set(sx * 8.5, 15.7, 0); g.add(ball);
      const cap = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.4, 3.4), gold);
      cap.position.set(sx * 8.5, 11.1, 0); g.add(cap);
      for (let i = 0; i < 14; i++) for (const cz of [-1, 1]) for (const cx of [-1, 1]) {
        if (cz < 0) continue;
        deco.add(V(sx * 8.5 + cx * 1.55, 0.6 + i * 0.75, cz * 1.55), [0xffd890, 0xff4040][i % 2], i);
      }
      for (let i = 0; i < 8; i++) { // roof edges
        const t = i / 8;
        for (const c of [[-1, 1], [1, 1]]) deco.add(V(sx * 8.5 + c[0] * 1.9 * (1 - t), 11.3 + t * 4.3, c[1] * 1.9 * (1 - t)), 0xffe0a0, 20 + i);
      }
    }
    const arch = new THREE.Mesh(new THREE.TorusGeometry(8.5, 0.45, 10, 48, Math.PI), gold);
    arch.position.set(0, 9, 0); g.add(arch);
    const arch2 = new THREE.Mesh(new THREE.TorusGeometry(7.4, 0.25, 8, 48, Math.PI), red);
    arch2.position.set(0, 9, 0); g.add(arch2);
    for (let i = 0; i <= 44; i++) {
      const a = i / 44 * Math.PI;
      deco.add(V(Math.cos(a) * 8.5, 9 + Math.sin(a) * 8.5, 0.55), PALETTE[i % 6], i);
      deco.add(V(Math.cos(a) * 8.5, 9 + Math.sin(a) * 8.5, -0.55), PALETTE[(i + 3) % 6], i);
    }
    const panelTex = canvasTex(512, 128, (ctx, w, h) => {
      const gr = ctx.createLinearGradient(0, 0, 0, h);
      gr.addColorStop(0, '#2a1060'); gr.addColorStop(1, '#5a1a70');
      ctx.fillStyle = gr; ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = '#e8b850'; ctx.lineWidth = 8; ctx.strokeRect(8, 8, w - 16, h - 16);
      for (let i = 0; i < 9; i++) {
        const x = 40 + i * 54, y = h / 2;
        ctx.fillStyle = ['#ffd040', '#ff5080', '#50d0ff'][i % 3];
        ctx.beginPath();
        for (let k = 0; k < 10; k++) {
          const r = k % 2 ? 9 : 22, a = k / 10 * Math.PI * 2 - Math.PI / 2;
          ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
        }
        ctx.fill();
      }
    });
    const panel = new THREE.Mesh(new THREE.BoxGeometry(10, 2.4, 0.4),
      new THREE.MeshStandardMaterial({ map: panelTex, emissiveMap: panelTex, emissive: 0xffffff, emissiveIntensity: 0.6, roughness: 0.5 }));
    panel.position.set(0, 14.6, 0.1); g.add(panel);
    for (let i = 0; i <= 20; i++) {
      deco.add(V(-5 + i * 0.5, 15.9, 0.35), 0xffe0a0, i);
      deco.add(V(-5 + i * 0.5, 13.3, 0.35), 0xffe0a0, i);
    }
    // turnstiles
    for (let i = -2; i <= 2; i++) {
      const ts = new THREE.Mesh(new THREE.BoxGeometry(0.3, 1.0, 1.4), iron);
      ts.position.set(i * 2.2, 0.5, 0); g.add(ts);
    }
    decals.push([0, 62, 13, WARM, 0.55]);
  }

  // ---------- Ticket booth ----------
  {
    const g = new THREE.Group(); g.position.set(13, 0, 68); g.rotation.y = -0.3; scene.add(g);
    const body = new THREE.Mesh(new THREE.BoxGeometry(3.4, 2.8, 2.8), new THREE.MeshStandardMaterial({ color: 0x2a6a5a, roughness: 0.5 }));
    body.position.y = 1.4; g.add(body);
    const win = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.1), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 1.1, 0.55) }));
    win.position.set(0, 1.7, 1.41); g.add(win);
    const sill = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.12, 0.5), white); sill.position.set(0, 1.12, 1.55); g.add(sill);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(2.9, 2.0, 4, 1, true),
      new THREE.MeshStandardMaterial({ map: stripeTex('#c02030', '#f0e6d0', 8, 256, 64), side: THREE.DoubleSide, roughness: 0.5 }));
    roof.rotation.y = Math.PI / 4; roof.position.y = 3.8; g.add(roof);
    const fin = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), gold); fin.position.y = 4.9; g.add(fin);
    const bb = new Bulbs();
    for (let i = 0; i < 28; i++) {
      const side = Math.floor(i / 7), t = (i % 7) / 7;
      const c = [[-2, -2], [2, -2], [2, 2], [-2, 2]];
      const a = c[side], b = c[(side + 1) % 4];
      bb.add(V(a[0] + (b[0] - a[0]) * t, 2.85, a[1] + (b[1] - a[1]) * t), [0xffd890, 0xff4040, 0x40c0ff][i % 3], i);
    }
    g.add(bb.build({ radius: 0.12, scale: 0.15, offset: 3 }));
    decals.push([13, 68, 5, WARM, 0.5]);
  }

  // ---------- Stalls ----------
  const stallCols = [0x2860a8, 0xb03040, 0x2a8a50, 0x8a3aa0, 0xc07020, 0x2090a0, 0xa02860, 0x5060c0];
  const awnings = [
    stripeTex('#d02030', '#f4ead8', 10), stripeTex('#2050c0', '#f4ead8', 10),
    stripeTex('#20a050', '#f8e070', 10), stripeTex('#a030b0', '#f4ead8', 10),
  ].map(t => new THREE.MeshStandardMaterial({ map: t, side: THREE.DoubleSide, roughness: 0.6 }));
  const prizeTex = canvasTex(256, 128, (ctx, w, h) => {
    ctx.fillStyle = '#3a2010'; ctx.fillRect(0, 0, w, h);
    for (let row = 0; row < 3; row++) {
      ctx.fillStyle = '#7a5030'; ctx.fillRect(0, 38 + row * 40, w, 4);
      for (let i = 0; i < 9; i++) {
        ctx.fillStyle = ['#ff4060', '#40c0ff', '#ffd040', '#60ff80', '#ff80e0', '#ffffff'][(i + row * 2) % 6];
        ctx.beginPath(); ctx.arc(16 + i * 28, 24 + row * 40, 10, 0, 7); ctx.fill();
      }
    }
  });
  const prizeMat = new THREE.MeshBasicMaterial({ map: prizeTex, color: new THREE.Color(1.3, 1.1, 0.9) });
  let si = 0;
  for (const side of [-1, 1]) {
    for (const z of [24, 33, 42, 51]) {
      const g = new THREE.Group();
      g.position.set(side * 10.5, 0, z);
      g.rotation.y = side > 0 ? -Math.PI / 2 : Math.PI / 2;
      scene.add(g);
      g.updateMatrixWorld(true);
      const wallMat = new THREE.MeshStandardMaterial({ color: stallCols[si % 8], roughness: 0.55 });
      const parts = [
        xf(new THREE.BoxGeometry(4, 2.8, 0.15), [0, 1.4, -1.4]),
        xf(new THREE.BoxGeometry(0.15, 2.8, 2.9), [-1.95, 1.4, 0]),
        xf(new THREE.BoxGeometry(0.15, 2.8, 2.9), [1.95, 1.4, 0]),
        xf(new THREE.BoxGeometry(3.8, 1.1, 0.5), [0, 0.55, 1.2]),
        xf(new THREE.BoxGeometry(4.3, 0.18, 3.3), [0, 2.9, 0]),
        xf(new THREE.BoxGeometry(3.2, 0.8, 0.14), [0, 3.45, 1.25]),
      ];
      g.add(new THREE.Mesh(merge(parts), wallMat));
      const top = new THREE.Mesh(new THREE.BoxGeometry(4.0, 0.12, 0.7), white); top.position.set(0, 1.15, 1.25); g.add(top);
      const back = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 1.7), prizeMat); back.position.set(0, 1.95, -1.3); g.add(back);
      const aw = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 1.6), awnings[si % 4]);
      aw.position.set(0, 2.55, 2.0); aw.rotation.x = -Math.PI / 2 + 0.55; g.add(aw);
      // scallops
      const sc = [];
      for (let k = 0; k < 9; k++) sc.push(xf(new THREE.CircleGeometry(0.25, 8, Math.PI, Math.PI), [-2.0 + k * 0.5, 2.17, 2.68]));
      const scm = new THREE.Mesh(merge(sc), awnings[si % 4]); g.add(scm);
      // interior light
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 2.2, 1.2) }));
      lamp.position.set(0, 2.6, 0.2); g.add(lamp);
      // goods on counter
      for (let k = 0; k < 5; k++) {
        const b = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6),
          new THREE.MeshStandardMaterial({ color: PALETTE[(k + si) % 6], roughness: 0.3, emissive: PALETTE[(k + si) % 6], emissiveIntensity: 0.15 }));
        b.position.set(-1.4 + k * 0.7, 1.35, 1.25); g.add(b);
      }
      // balloons on strings
      if (si % 2 === 0) {
        for (let k = 0; k < 6; k++) {
          const bl = new THREE.Mesh(new THREE.SphereGeometry(0.32, 12, 10),
            new THREE.MeshStandardMaterial({ color: PALETTE[(k + 1) % 6], roughness: 0.25, emissive: PALETTE[(k + 1) % 6], emissiveIntensity: 0.12 }));
          bl.scale.set(1, 1.2, 1);
          bl.position.set(1.7 + (k % 3 - 1) * 0.4, 4.3 + Math.floor(k / 3) * 0.6, 1.0 + (k % 2) * 0.3);
          g.add(bl);
          wire.push(g.localToWorld(V(1.7, 2.95, 1.1)), g.localToWorld(bl.position.clone().add(V(0, -0.35, 0))));
        }
      }
      // sign board bulbs
      const sb = [];
      for (let k = 0; k <= 12; k++) {
        sb.push([V(-1.6 + k * 0.2667, 3.88, 1.35), k], [V(-1.6 + k * 0.2667, 3.02, 1.35), k]);
      }
      for (const [p, k] of sb) deco.add(g.localToWorld(p.clone()), PALETTE[(k + si) % 6], k + si * 13);
      // front valance lights
      stringLights(g, strings, g.localToWorld(V(-2.1, 2.2, 2.7)), g.localToWorld(V(2.1, 2.2, 2.7)), 0.2, 9, si * 9, [0xffd890, 0xff6040], wire);
      decals.push([side * 7.5, z, 4.5, WARM, 0.4]);
      si++;
    }
  }

  // string lights zig-zag over the main path
  {
    const poles = [];
    const wp = [];
    for (let i = 0; i < 8; i++) {
      const z = 18 + i * 5.5;
      for (const sx of [-1, 1]) {
        const x = sx * 6.6, zz = z + (sx > 0 ? 2.75 : 0);
        poles.push(V(x, 6.2, zz));
        wp.push(xf(new THREE.CylinderGeometry(0.1, 0.13, 6.2, 6), [x, 3.1, zz]));
      }
    }
    scene.add(new THREE.Mesh(merge(wp), wood));
    const cols = [0xff4040, 0xffd040, 0x40ff80, 0x40a0ff, 0xff60e0];
    for (let i = 0; i < poles.length - 1; i++) {
      stringLights(scene, strings, poles[i], poles[i + 1], 0.9, 12, i * 12, cols, wire);
    }
    for (let i = 0; i + 2 < poles.length; i++) {
      stringLights(scene, strings, poles[i], poles[i + 2], 0.5, 10, i * 10 + 5, [0xffe0a0], wire);
    }
  }

  // ---------- Tents ----------
  const tentSpots = [[-32, 36, 0x2050c0], [34, 40, 0xc02030], [-46, 12, 0x20a050]];
  for (const [x, z, c] of tentSpots) {
    const g = new THREE.Group(); g.position.set(x, 0, z); scene.add(g);
    const hex = '#' + new THREE.Color(c).getHexString();
    const tm = new THREE.MeshStandardMaterial({ map: stripeTex(hex, '#f4ead8', 16), side: THREE.DoubleSide, roughness: 0.6 });
    const wall = new THREE.Mesh(new THREE.CylinderGeometry(4, 4, 2.8, 32, 1, true), tm); wall.position.y = 1.4; g.add(wall);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(4.8, 3.6, 32, 1, true), tm); roof.position.y = 4.6; g.add(roof);
    const door = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 2.2), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.4, 0.9, 0.45) }));
    const toC = Math.atan2(-x, -z);
    door.position.set(Math.sin(toC) * 4.02, 1.1, Math.cos(toC) * 4.02); door.rotation.y = toC; g.add(door);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.6, 6), gold); pole.position.y = 7.1; g.add(pole);
    const flag = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.6), new THREE.MeshStandardMaterial({ color: 0xffc020, side: THREE.DoubleSide }));
    flag.position.set(0.5, 7.6, 0); g.add(flag);
    for (let k = 0; k < 10; k++) {
      const a = k / 10 * Math.PI * 2;
      stringLights(g, strings, V(x, 6.4, z), V(x + Math.cos(a) * 4.8, 2.85, z + Math.sin(a) * 4.8), 0.3, 7, k * 7, PALETTE, wire);
    }
    for (let k = 0; k < 36; k++) {
      const a = k / 36 * Math.PI * 2;
      deco.add(V(x + Math.cos(a) * 4.85, 2.7, z + Math.sin(a) * 4.85), PALETTE[k % 6], k);
    }
    decals.push([x, z, 9, c, 0.35]);
  }

  // ---------- Lamp posts ----------
  const lamps = [];
  for (let i = 0; i < 7; i++) for (const sx of [-1, 1]) lamps.push([sx * 5.4, 14 + i * 8 + (sx > 0 ? 4 : 0)]);
  for (let i = 0; i < 12; i++) {
    const a = i / 12 * Math.PI * 2 + 0.26;
    if (Math.abs(Math.cos(a)) < 0.2 && Math.sin(a) > 0) continue;
    lamps.push([Math.cos(a) * 19.5, Math.sin(a) * 19.5]);
  }
  for (let i = 0; i < 20; i++) {
    const a = i / 20 * Math.PI * 2;
    const x = Math.cos(a) * 34.5, z = Math.sin(a) * 34.5;
    if (RIDE_PADS.some(([px, pz, r]) => Math.hypot(px - x, pz - z) < r + 2)) continue;
    if (Math.hypot(x - 30, z + 8) < 26) continue;
    lamps.push([x, z]);
  }
  for (let z = 70; z < 115; z += 10) for (const sx of [-1, 1]) lamps.push([sx * 6, z]);
  {
    const pole = merge([
      xf(new THREE.CylinderGeometry(0.22, 0.28, 0.5, 8), [0, 0.25, 0]),
      xf(new THREE.CylinderGeometry(0.07, 0.09, 4.2, 8), [0, 2.4, 0]),
      xf(new THREE.CylinderGeometry(0.28, 0.2, 0.15, 8), [0, 4.12, 0]),
      xf(new THREE.ConeGeometry(0.36, 0.4, 8), [0, 4.85, 0]),
      xf(new THREE.SphereGeometry(0.08, 6, 4), [0, 5.1, 0]),
    ]);
    const pm = new THREE.InstancedMesh(pole, iron, lamps.length);
    const head = new THREE.InstancedMesh(new THREE.SphereGeometry(0.24, 12, 8).scale(1, 1.3, 1),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(3.2, 2.1, 1.0) }), lamps.length);
    const m = new THREE.Matrix4();
    lamps.forEach(([x, z], i) => {
      m.makeTranslation(x, 0, z); pm.setMatrixAt(i, m);
      m.makeTranslation(x, 4.45, z); head.setMatrixAt(i, m);
      decals.push([x, z, 4.2, 0xffb060, 0.45]);
    });
    scene.add(pm, head);
  }

  // ---------- Trees ----------
  {
    const spots = [];
    const ok = (x, z) => {
      if (Math.abs(x) < 10 && z > 8) return false;
      if (RIDE_PADS.some(([px, pz, r]) => Math.hypot(px - x, pz - z) < r + 5)) return false;
      if (Math.hypot(x - 30, z + 8) < 30) return false;
      if (tentSpots.some(([px, pz]) => Math.hypot(px - x, pz - z) < 8)) return false;
      const d = Math.hypot(x, z);
      if (d < 24) return false;
      if (Math.abs(d - 31) < 5) return false;
      return true;
    };
    for (let i = 0; i < 400 && spots.length < 120; i++) {
      const a = rand() * Math.PI * 2;
      const d = i < 260 ? rr(66, 92) : rr(38, 58);
      const x = Math.cos(a) * d, z = Math.sin(a) * d;
      if (!ok(x, z)) continue;
      if (spots.some(s => Math.hypot(s[0] - x, s[1] - z) < 4.5)) continue;
      spots.push([x, z, rr(0.8, 1.5), rand() < 0.55]);
    }
    const trunk = new THREE.CylinderGeometry(0.18, 0.3, 2.4, 6).translate(0, 1.2, 0);
    const pine = merge([
      xf(new THREE.ConeGeometry(2.4, 3.2, 8), [0, 3.4, 0]),
      xf(new THREE.ConeGeometry(1.9, 2.8, 8), [0, 5.0, 0]),
      xf(new THREE.ConeGeometry(1.3, 2.4, 8), [0, 6.5, 0]),
    ]);
    const round = merge([
      xf(new THREE.IcosahedronGeometry(2.3, 1), [0, 4.2, 0]),
      xf(new THREE.IcosahedronGeometry(1.7, 1), [1.2, 4.9, 0.6]),
      xf(new THREE.IcosahedronGeometry(1.6, 1), [-1.0, 5.2, -0.6]),
    ]);
    const leaf = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85, flatShading: true });
    const trunks = new THREE.InstancedMesh(trunk, new THREE.MeshStandardMaterial({ color: 0x2e2018, roughness: 0.9 }), spots.length);
    const pines = new THREE.InstancedMesh(pine, leaf, spots.filter(s => s[3]).length);
    const rounds = new THREE.InstancedMesh(round, leaf, spots.filter(s => !s[3]).length);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), c = new THREE.Color();
    let ip = 0, ir = 0;
    spots.forEach(([x, z, s, isPine], i) => {
      q.setFromAxisAngle(V(0, 1, 0), rand() * 6.28);
      m.compose(V(x, 0, z), q, V(s, s * rr(0.9, 1.2), s));
      trunks.setMatrixAt(i, m);
      c.setHSL(rr(0.25, 0.36), rr(0.35, 0.55), rr(0.1, 0.17));
      if (isPine) { pines.setMatrixAt(ip, m); pines.setColorAt(ip++, c); }
      else { rounds.setMatrixAt(ir, m); rounds.setColorAt(ir++, c); }
    });
    scene.add(trunks, pines, rounds);
  }

  // ---------- Fence ----------
  {
    const R = LAYOUT.fenceR;
    const posts = [];
    const n = Math.round(Math.PI * 2 * R / 2.5);
    for (let i = 0; i < n; i++) {
      const a = i / n * Math.PI * 2;
      const x = Math.cos(a) * R, z = Math.sin(a) * R;
      if (Math.abs(x) < 10.2 && z > 0) continue;
      posts.push([x, z, a]);
    }
    const pg = merge([
      xf(new THREE.BoxGeometry(0.14, 1.5, 0.14), [0, 0.75, 0]),
      xf(new THREE.SphereGeometry(0.1, 6, 4), [0, 1.55, 0]),
    ]);
    const rail = new THREE.BoxGeometry(0.06, 0.08, 1);
    const pm = new THREE.InstancedMesh(pg, iron, posts.length);
    const rm = new THREE.InstancedMesh(rail, iron, posts.length * 2);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion();
    let ri = 0;
    posts.forEach(([x, z, a], i) => {
      m.makeTranslation(x, 0, z); pm.setMatrixAt(i, m);
      const a2 = a + Math.PI * 2 / n;
      const x2 = Math.cos(a2) * R, z2 = Math.sin(a2) * R;
      if (Math.abs(x2) < 10.2 && z2 > 0) return;
      const len = Math.hypot(x2 - x, z2 - z);
      q.setFromAxisAngle(V(0, 1, 0), Math.atan2(x2 - x, z2 - z));
      for (const h of [0.5, 1.3]) {
        m.compose(V((x + x2) / 2, h, (z + z2) / 2), q, V(1, 1, len));
        rm.setMatrixAt(ri++, m);
      }
    });
    rm.count = ri;
    scene.add(pm, rm);
  }

  // ---------- Benches & bins around plaza ----------
  {
    const bench = merge([
      xf(new THREE.BoxGeometry(1.8, 0.08, 0.5), [0, 0.5, 0]),
      xf(new THREE.BoxGeometry(1.8, 0.4, 0.06), [0, 0.78, -0.24]),
      xf(new THREE.BoxGeometry(0.08, 0.5, 0.5), [-0.8, 0.25, 0]),
      xf(new THREE.BoxGeometry(0.08, 0.5, 0.5), [0.8, 0.25, 0]),
    ]);
    const list = [];
    for (let i = 0; i < 10; i++) {
      const a = i / 10 * Math.PI * 2 + 0.55;
      if (Math.abs(Math.cos(a)) < 0.25 && Math.sin(a) > 0) continue;
      list.push(a);
    }
    const bm = new THREE.InstancedMesh(bench, wood, list.length);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion();
    list.forEach((a, i) => {
      q.setFromAxisAngle(V(0, 1, 0), -a - Math.PI / 2);
      m.compose(V(Math.cos(a) * 16.5, 0, Math.sin(a) * 16.5), q, V(1, 1, 1));
      bm.setMatrixAt(i, m);
    });
    scene.add(bm);
  }

  // wires
  const wg = new THREE.BufferGeometry().setFromPoints(wire);
  scene.add(new THREE.LineSegments(wg, new THREE.LineBasicMaterial({ color: 0x15120f })));

  scene.add(strings.build({ radius: 0.11, scale: 0.08, speed: 1.0, offset: 1.5, bright: 1.8 }));
  scene.add(deco.build({ radius: 0.13, scale: 0.12, speed: 1.1, offset: 5, bright: 1.9 }));

  // ride glow pools
  decals.push([LAYOUT.carousel[0], LAYOUT.carousel[1], 16, 0xffa040, 0.55]);
  decals.push([LAYOUT.ferris[0], LAYOUT.ferris[1], 20, 0xff60c0, 0.4]);
  decals.push([LAYOUT.pirate[0], LAYOUT.pirate[1], 14, 0x40a0ff, 0.4]);
  decals.push([LAYOUT.coaster[0] - 10, LAYOUT.coaster[1] + 16, 10, 0xff4060, 0.4]);
  decals.push([0, 36, 14, WARM, 0.35]);
  makeGlowDecals(scene, decals);

  return { pond };
}
