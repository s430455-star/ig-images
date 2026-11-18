import * as THREE from 'three';
import { FW, TIME, rng, canvasTex, glowTexture } from './util.js';

export const MOON_DIR = new THREE.Vector3(-0.55, 0.36, -0.75).normalize();

export function makeSky(scene) {
  const group = new THREE.Group();
  scene.add(group);

  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: { uLP: FW.uLP, uLC: FW.uLC, uCam: { value: new THREE.Vector3() }, uMoon: { value: MOON_DIR } },
    vertexShader: /* glsl */`
      varying vec3 vDir;
      void main() {
        vDir = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */`
      uniform vec3 uLP[4];
      uniform vec3 uLC[4];
      uniform vec3 uCam;
      uniform vec3 uMoon;
      varying vec3 vDir;
      void main() {
        vec3 d = normalize(vDir);
        float h = d.y;
        vec3 zen = vec3(0.0015, 0.0025, 0.009);
        vec3 hor = vec3(0.010, 0.012, 0.030);
        vec3 c = mix(hor, zen, pow(clamp(h, 0.0, 1.0), 0.4));
        // warm light pollution from the park near the horizon
        c += vec3(0.035, 0.016, 0.022) * exp(-max(h, 0.0) * 14.0);
        vec3 fogc = vec3(0.0060, 0.0068, 0.0140);
        c = mix(c, fogc, smoothstep(0.03, -0.01, h));
        // moon halo
        float mk = max(dot(d, uMoon), 0.0);
        c += vec3(0.06, 0.07, 0.11) * pow(mk, 40.0) + vec3(0.02, 0.025, 0.04) * pow(mk, 6.0);
        // firework glow in the sky
        for (int i = 0; i < 4; i++) {
          vec3 ld = normalize(uLP[i] - uCam);
          float k = max(dot(d, ld), 0.0);
          c += uLC[i] * (pow(k, 60.0) * 0.22 + pow(k, 10.0) * 0.045 + pow(k, 3.0) * 0.008);
        }
        gl_FragColor = vec4(c, 1.0);
      }`,
  });
  const dome = new THREE.Mesh(new THREE.SphereGeometry(520, 48, 24), skyMat);
  dome.renderOrder = -10;
  dome.frustumCulled = false;
  group.add(dome);

  // Stars
  const R = rng(77);
  const N = 2600;
  const pos = new Float32Array(N * 3), size = new Float32Array(N), seed = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    let x, y, z, l;
    do { x = R() * 2 - 1; y = R(); z = R() * 2 - 1; l = Math.hypot(x, y, z); } while (l > 1 || l < 0.1);
    y = Math.pow(y / l, 0.8);
    const v = new THREE.Vector3(x / l, y, z / l).normalize().multiplyScalar(480);
    pos.set([v.x, v.y, v.z], i * 3);
    size[i] = 1.0 + Math.pow(R(), 6) * 3.2;
    seed[i] = R();
  }
  const sg = new THREE.BufferGeometry();
  sg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  sg.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
  sg.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
  const starMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uTime: TIME, uPx: { value: 1 } },
    vertexShader: /* glsl */`
      attribute float aSize; attribute float aSeed;
      uniform float uTime; uniform float uPx;
      varying vec3 vC;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = aSize * uPx;
        float tw = 0.65 + 0.35 * sin(uTime * (1.3 + aSeed * 3.0) + aSeed * 60.0);
        float elev = clamp(normalize(position).y * 4.0, 0.0, 1.0);
        vC = mix(vec3(0.7, 0.8, 1.0), vec3(1.0, 0.88, 0.7), fract(aSeed * 7.31)) * tw * elev * (0.35 + aSize * 0.25);
      }`,
    fragmentShader: /* glsl */`
      varying vec3 vC;
      void main() {
        float d = length(gl_PointCoord - 0.5) * 2.0;
        float a = exp(-d * d * 5.0);
        gl_FragColor = vec4(vC * a, 1.0);
      }`,
  });
  const stars = new THREE.Points(sg, starMat);
  stars.renderOrder = -9;
  stars.frustumCulled = false;
  group.add(stars);

  // Moon
  const moonTex = canvasTex(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#e8e6df'; ctx.fillRect(0, 0, w, h);
    const r = rng(5);
    for (let i = 0; i < 70; i++) {
      const x = r() * w, y = r() * h, s = 4 + Math.pow(r(), 3) * 40;
      ctx.fillStyle = `rgba(120,118,125,${0.15 + r() * 0.25})`;
      ctx.beginPath(); ctx.arc(x, y, s, 0, Math.PI * 2); ctx.fill();
    }
  });
  const moon = new THREE.Mesh(new THREE.SphereGeometry(9, 32, 16),
    new THREE.MeshBasicMaterial({ map: moonTex, color: new THREE.Color(1.15, 1.15, 1.25), fog: false }));
  moon.position.copy(MOON_DIR).multiplyScalar(450);
  moon.renderOrder = -8;
  group.add(moon);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTexture(), color: new THREE.Color(0.18, 0.22, 0.34), blending: THREE.AdditiveBlending,
    depthWrite: false, transparent: true, fog: false,
  }));
  halo.scale.set(110, 110, 1);
  halo.position.copy(moon.position).multiplyScalar(0.99);
  halo.renderOrder = -7;
  group.add(halo);

  return {
    group,
    setPixelRatio(px) { starMat.uniforms.uPx.value = px; },
    update(camera) {
      group.position.copy(camera.position);
      skyMat.uniforms.uCam.value.copy(camera.position);
    },
  };
}
