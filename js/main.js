// main.js — one demonstration, two frames.
// `train.group` holds everything at rest in the train frame, the world group
// everything at rest in the platform frame. Whichever frame you ride stays at
// scale 1; the OTHER group gets scale.x = 1/γ and the motion. The light clock
// is animated purely in its own proper time, which makes its world-space path
// automatically correct in both views: straight bounce or zigzag, both at c.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { C_SCENE, gamma } from './physics.js';
import { buildStaticWorld, buildWorldGroup, PERIOD, SPAN } from './world.js';
import { buildTrain } from './train.js';
import { LightClock } from './lightClock.js';
import { initUI } from './ui.js';

// --- renderer / scene ------------------------------------------------------
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.18;
document.getElementById('app').appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x10142a, 80, 700);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 9000);
camera.position.set(34, 15, 50);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.maxPolarAngle = Math.PI * 0.495;
controls.target.set(0, 7.5, 0);

// --- world + train + clock -------------------------------------------------
buildStaticWorld(scene);
const world = buildWorldGroup();
scene.add(world.group);
const train = buildTrain();
scene.add(train.group);

const clock = new LightClock({ scene });
train.clockMount.add(clock.group);

// --- state -----------------------------------------------------------------
const state = {
  beta: 0.7,
  frame: 'platform',          // 'platform' | 'train'
  paused: false,
  trainPhase: -180,           // platform view: scene x of the train center
  worldPhase: 0,              // train view: scene x offset of the world group
  tauPlatform: 0,
  tauTrain: 0,
};
const WRAP = 460;             // platform view: train loop length; short enough that
                              // the pass repeats every few seconds instead of vanishing

const ui = initUI({
  onBeta: (b) => { state.beta = Math.min(0.999, Math.max(0, b)); },
  onFrame: setFrame,
  onPause: () => { state.paused = !state.paused; ui.setPaused(state.paused); },
  onReset: resetClocks,
});

function resetClocks() {
  state.tauPlatform = 0;
  state.tauTrain = 0;
  clock.reset();
}

// --- frame switching -------------------------------------------------------
const camPresets = {
  // platform: stand back, watch the clock zigzag by inside the glass car
  platform: { pos: new THREE.Vector3(34, 15, 50), tgt: new THREE.Vector3(0, 7.5, 0), min: 12, max: 280 },
  // train: hover beside the glass side; the world streams past behind it
  train: { pos: new THREE.Vector3(21, 16, 31), tgt: new THREE.Vector3(0, 7.5, 0), min: 6, max: 120 },
};
let camTween = null;

function setFrame(frame) {
  if (frame === state.frame) return;
  state.frame = frame;
  ui.setFrame(frame);

  if (frame === 'platform') {
    world.group.position.x = 0;
    world.group.scale.x = 1;
    state.trainPhase = -180;
  } else {
    train.group.position.x = 0;
    train.group.scale.x = 1;
    state.worldPhase = 0;
  }
  clock.clearTrail();

  const p = camPresets[frame];
  camTween = {
    u: 0,
    fromPos: camera.position.clone(), toPos: p.pos.clone(),
    fromTgt: controls.target.clone(), toTgt: p.tgt.clone(),
  };
  controls.minDistance = p.min;
  controls.maxDistance = p.max;
}

function wrapInto(x, span) {
  const half = span / 2;
  return ((x + half) % span + span) % span - half;
}

// --- keyboard --------------------------------------------------------------
window.addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT') return;
  const k = e.key.toLowerCase();
  if (k === 'f') setFrame(state.frame === 'platform' ? 'train' : 'platform');
  else if (k === ' ') { e.preventDefault(); state.paused = !state.paused; ui.setPaused(state.paused); }
  else if (k === 'r') resetClocks();
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// --- main loop -------------------------------------------------------------
const frameClock = new THREE.Clock();

function tick() {
  requestAnimationFrame(tick);
  const rawDt = Math.min(frameClock.getDelta(), 0.05);
  const dt = state.paused ? 0 : rawDt;

  const beta = state.beta;
  const g = gamma(beta);
  const v = beta * C_SCENE;

  // -- geometry: contract and move whichever group is foreign to this frame --
  if (state.frame === 'platform') {
    train.group.scale.x = 1 / g;
    state.trainPhase = wrapInto(state.trainPhase + v * dt, WRAP);
    train.group.position.x = state.trainPhase;
    world.group.position.x = 0;
    world.group.scale.x = 1;
    scene.fog.far = 700; scene.fog.near = 80;
  } else {
    world.group.scale.x = 1 / g;
    const cp = PERIOD / g;
    state.worldPhase = wrapInto(state.worldPhase - v * dt, cp);
    world.group.position.x = state.worldPhase;
    train.group.position.x = 0;
    train.group.scale.x = 1;
    const far = Math.min(700, Math.max(110, (SPAN / g) * 0.42));
    scene.fog.far = far; scene.fog.near = far * 0.12;
  }

  // -- proper times: the frame you ride runs at dt, the other at dt/γ --------
  if (state.frame === 'platform') {
    state.tauPlatform += dt;
    state.tauTrain += dt / g;
    clock.update(dt / g);
  } else {
    state.tauTrain += dt;
    state.tauPlatform += dt / g;
    clock.update(dt);
  }

  // -- camera ---------------------------------------------------------------
  if (camTween) {
    camTween.u += rawDt / 0.9;
    const e = camTween.u >= 1 ? 1 : 1 - Math.pow(1 - camTween.u, 3);
    camera.position.lerpVectors(camTween.fromPos, camTween.toPos, e);
    controls.target.lerpVectors(camTween.fromTgt, camTween.toTgt, e);
    if (camTween.u >= 1) camTween = null;
  }
  controls.update();

  // -- photon trail (needs final world transforms) --------------------------
  scene.updateMatrixWorld();
  if (dt > 0) clock.recordTrail();

  ui.update({
    beta,
    frame: state.frame,
    tauPlatform: state.tauPlatform,
    tauTrain: state.tauTrain,
    ticksTrain: clock.ticks,
  });

  renderer.render(scene, camera);
}

// --- go --------------------------------------------------------------------
window.__sim = state; // debug/test handle
ui.setFrame('platform');
ui.setPaused(false);
tick();
