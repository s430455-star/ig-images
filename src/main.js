import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { TIME } from './util.js';
import { updateBulbs } from './bulbs.js';
import { makeSky, MOON_DIR } from './sky.js';
import { makePark } from './park.js';
import { makeFerris, makeCoaster, makeCarousel, makePirate } from './rides.js';
import { Fireworks } from './fireworks.js';

const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
const DPR = Math.min(window.devicePixelRatio || 1, 1.5);
renderer.setPixelRatio(DPR);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x0f1120, 0.0062);
const camera = new THREE.PerspectiveCamera(56, window.innerWidth / window.innerHeight, 0.5, 1400);

scene.add(new THREE.HemisphereLight(0x3a4a78, 0x120e14, 0.55));
const moonLight = new THREE.DirectionalLight(0x8090c8, 0.45);
moonLight.position.copy(MOON_DIR).multiplyScalar(100);
scene.add(moonLight);

const sky = makeSky(scene);
makePark(scene);
const rides = [makeFerris(scene), makeCoaster(scene), makeCarousel(scene), makePirate(scene)];

// Camera orbit: one revolution every 24 s
const LOOP = 24;
function camPos(t, out = new THREE.Vector3()) {
  const th = t * Math.PI * 2 / LOOP + 0.55;
  const r = 84 + 6 * Math.sin(t * Math.PI * 2 / 48);
  const y = 25 + 5 * Math.sin(t * Math.PI * 2 / 36 + 1.0);
  return out.set(Math.sin(th) * r, y, Math.cos(th) * r);
}
const look = new THREE.Vector3();
function camLook(t) { return look.set(0, 19 + 3 * Math.sin(t * Math.PI * 2 / 30), 0); }

const fireworks = new Fireworks(scene, (t) => camPos(t));

const rt = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 });
const composer = new EffectComposer(renderer, rt);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(512, 512), 0.55, 0.25, 0.88);
composer.addPass(bloom);
composer.addPass(new OutputPass());

function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
  composer.setSize(w, h);
  bloom.resolution.set(w * DPR * 0.5, h * DPR * 0.5);
  const scale = h * DPR / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)));
  fireworks.setScale(scale);
  sky.setPixelRatio(DPR);
}
window.addEventListener('resize', resize);
resize();

let t = 0;
function step(dt) {
  t += dt;
  TIME.value = t;
  updateBulbs(t);
  for (const r of rides) r.update(t, dt);
  fireworks.update(dt, t);
  camPos(t, camera.position);
  camera.lookAt(camLook(t));
}
function render() {
  sky.update(camera);
  composer.render();
}

// warm up so the sky already has fireworks at start
for (let i = 0; i < 90; i++) step(1 / 30);

const clock = new THREE.Clock();
renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 1 / 20);
  step(dt);
  render();
});

