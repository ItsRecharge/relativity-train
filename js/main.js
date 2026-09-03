// main.js — bootstraps the scene and runs the two-frame relativity simulation.
// The core trick: `trainGroup` holds everything at rest in the train frame,
// the world group everything at rest in the platform frame. Whichever frame
// you ride is left at scale 1; the OTHER group gets scale.x = 1/γ and the
// motion. All scenario timing comes from physics.js Lorentz math.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import {
  C_SCENE, TRAIN_PROPER_LENGTH, gamma, accelClockRatio,
} from './physics.js';
import { buildStaticWorld, buildWorldGroup, PERIOD, SPAN, TUNNEL_PROPER_LENGTH } from './world.js';
import { buildTrain } from './train.js';
import { LightClock, MIRROR_GAP } from './lightClock.js';
import { LightningScenario, TunnelScenario } from './lightning.js';
import { RelativisticView } from './doppler.js';
import { TerrellWarp } from './terrell.js';
import { MinkowskiDiagram } from './minkowski.js';
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
camera.position.set(36, 13, 52);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.maxPolarAngle = Math.PI * 0.495;
controls.target.set(0, 5, 0);

// --- world + train ---------------------------------------------------------
buildStaticWorld(scene);
const world = buildWorldGroup();
scene.add(world.group);
const train = buildTrain();
scene.add(train.group);

// light clocks: Bob's on the platform (world frame), Alice's on the train roof
const bobClock = new LightClock({ label: 'BOB CLOCK', color: 0x61d4ff, scene });
const centerMount = world.clockMounts.reduce((a, b) =>
  (Math.abs(a.position.x) < Math.abs(b.position.x) ? a : b));
centerMount.add(bobClock.group);
const aliceClock = new LightClock({ label: 'ALICE CLOCK', color: 0xff9a86, scene });
train.clockMount.add(aliceClock.group);

const relView = new RelativisticView(renderer);
const terrell = new TerrellWarp(train, scene);
const minkowski = new MinkowskiDiagram(document.getElementById('minkowski'));

// --- state -----------------------------------------------------------------
const state = {
  beta: 0.7,
  frame: 'platform',          // 'platform' | 'train'
  paused: false,
  slow: false,
  optics: { doppler: true, aberration: true, headlight: true, terrell: false },
  scenarioType: 'free',
  scenario: null,
  simTime: 0,
  trainPhase: -300,           // platform view: scene x of train center
  worldPhase: 0,              // train view: scene x offset of world group
  tauBob: 0,
  tauAlice: 0,
  race: null,                 // light-clock race bookkeeping
  accel: null,                // accelerating-train mode bookkeeping
};

const WRAP = 1600;            // platform view: train loops through ±800

// --- UI --------------------------------------------------------------------
const ui = initUI({
  onBeta: (b) => setBeta(b),
  onFrame: (f) => setFrame(f),
  onScenario: (s) => startScenario(s),
  onOptic: (k, v) => { state.optics[k] = v; },
  onPause: () => { state.paused = !state.paused; ui.setPaused(state.paused); },
  onSlow: () => { state.slow = !state.slow; ui.setSlow(state.slow); },
  onResetClocks: () => resetClocks(),
});

function setBeta(b) {
  state.beta = Math.min(0.999, Math.max(0, b));
  if (state.accel) exitAccel('β set by hand — back to coasting.');
  if (state.scenarioType === 'lightning' || state.scenarioType === 'tunnel') {
    startScenario(state.scenarioType); // re-derive the event timeline at the new β
  }
}

function resetClocks() {
  state.tauBob = 0; state.tauAlice = 0;
  bobClock.reset(); aliceClock.reset();
}

// --- frame switching -------------------------------------------------------
const camPresets = {
  platform: { pos: new THREE.Vector3(42, 16, 60), tgt: new THREE.Vector3(0, 5, 0), min: 10, max: 280 },
  train: { pos: new THREE.Vector3(2, 9.2, 1.2), tgt: new THREE.Vector3(70, 4.5, -8), min: 2, max: 80 },
};
let camTween = null;

function setFrame(frame) {
  if (frame === state.frame) return;
  state.frame = frame;
  ui.setFrameButtons(frame);

  // zero out the transforms of whichever group is now "at rest"
  if (frame === 'platform') {
    world.group.position.x = 0;
    world.group.scale.x = 1;
    state.trainPhase = -300;
  } else {
    train.group.position.x = 0;
    train.group.scale.x = 1;
    state.worldPhase = 0;
  }
  train.aliceTag.visible = frame === 'platform'; // it would sit in the cabin camera's face
  bobClock.clearTrail(); aliceClock.clearTrail();
  state.simTime = 0;

  const p = camPresets[frame];
  camTween = {
    u: 0,
    fromPos: camera.position.clone(), toPos: p.pos.clone(),
    fromTgt: controls.target.clone(), toTgt: p.tgt.clone(),
  };
  controls.minDistance = p.min;
  controls.maxDistance = p.max;

  ui.log('info', frame === 'platform'
    ? '→ PLATFORM frame: Bob at rest. The train is the moving, contracted, slow-clocked thing.'
    : '→ TRAIN frame: Alice at rest. Now the WORLD contracts and Bob\'s clock crawls. Equally true.');

  // replay a running thought experiment from the other side — the whole point
  if (state.scenarioType === 'lightning' || state.scenarioType === 'tunnel') {
    startScenario(state.scenarioType);
  }
}

// --- scenarios -------------------------------------------------------------
function setTunnelsVisible(v) {
  for (const t of world.tunnels) t.group.visible = v;
}

function disposeScenario() {
  state.scenario?.dispose();
  state.scenario = null;
}

function exitAccel(msg) {
  if (!state.accel) return;
  state.accel = null;
  ui.showAccelCard(false);
  ui.setSliderFromBeta(state.beta);
  if (msg) ui.log('info', msg);
}

function startScenario(name) {
  disposeScenario();
  setTunnelsVisible(name === 'tunnel');
  if (name !== 'accel') exitAccel();
  state.race = null;
  state.scenarioType = name;
  ui.setScenarioButtons(name);

  if (name === 'lightning') {
    if (state.beta < 0.005) { ui.toast('Give the train some speed first — try 0.866c'); }
    state.scenario = new LightningScenario({
      scene, frame: state.frame, beta: Math.max(state.beta, 0.005),
      log: ui.log, toast: ui.toast,
    });
  } else if (name === 'tunnel') {
    if (state.beta < 0.005) { ui.toast('Speed up first — the train only fits above 0.661c'); }
    state.scenario = new TunnelScenario({
      scene, frame: state.frame, beta: Math.max(state.beta, 0.005),
      tunnelLength: TUNNEL_PROPER_LENGTH,
      doors: {
        front: world.tunnels.map((t) => t.doorFront),
        rear: world.tunnels.map((t) => t.doorRear),
      },
      log: ui.log, toast: ui.toast,
    });
  } else if (name === 'clockrace') {
    resetClocks();
    state.race = { target: 12 };
    ui.toast('⏱ Both light clocks zeroed — first count is taken when the home clock hits 12 ticks');
    ui.log('major', `LIGHT-CLOCK RACE at β=${state.beta.toFixed(3)} — the moving clock's photon zigzags, so it ticks ${(100 / gamma(state.beta)).toFixed(0)}% as fast.`);
  } else if (name === 'accel') {
    state.accel = { a: 9, front: 0, rear: 0, beta0: state.beta };
    state.beta = 0;
    ui.showAccelCard(true);
    ui.toast('🌀 Proper acceleration engaged — watch the front clock outrun the rear');
    ui.log('major', 'ACCELERATING TRAIN — the equivalence principle says this is indistinguishable from gravity pointing toward the rear.');
  }
}

function endScenario() {
  // adopt the scenario's final geometry so free-run motion continues smoothly
  const drive = state.scenario?.drive();
  if (drive?.trainX !== undefined) state.trainPhase = wrapInto(drive.trainX, WRAP);
  if (drive?.worldX !== undefined) state.worldPhase = drive.worldX;
  disposeScenario();
  setTunnelsVisible(false);
  state.scenarioType = 'free';
  ui.setScenarioButtons('free');
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
  else if (k === 's') { state.slow = !state.slow; ui.setSlow(state.slow); }
  else if (k === 'h' || k === '?') ui.toggleHelp();
  else if (k === 'r') resetClocks();
  else if (k === 't') { state.optics.terrell = !state.optics.terrell; ui.setOptic('terrell', state.optics.terrell); }
  else if (k === 'd') { state.optics.doppler = !state.optics.doppler; ui.setOptic('doppler', state.optics.doppler); }
  else if (k === '1') startScenario('free');
  else if (k === '2') startScenario('lightning');
  else if (k === '3') startScenario('tunnel');
  else if (k === '4') startScenario('clockrace');
  else if (k === '5') startScenario('accel');
});

// --- resize ----------------------------------------------------------------
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  relView.setSize(window.innerWidth, window.innerHeight, renderer.getPixelRatio());
  minkowski.resize();
});

// --- main loop -------------------------------------------------------------
const clock = new THREE.Clock();
let raceAnnounced = false;

function tick() {
  requestAnimationFrame(tick);
  const rawDt = Math.min(clock.getDelta(), 0.05);
  const dt = state.paused ? 0 : rawDt * (state.slow ? 0.25 : 1);

  // accelerating-train mode integrates β itself
  if (state.accel && dt > 0) {
    const A = state.accel;
    const dBeta = (A.a / C_SCENE) * Math.pow(1 - state.beta * state.beta, 1.5) * dt;
    state.beta = Math.min(0.955, state.beta + dBeta);
    const dTauRear = dt / gamma(state.beta);
    const ratio = accelClockRatio(A.a);
    A.rear += dTauRear;
    A.front += dTauRear * ratio;
    ui.updateAccelClocks(A.front, A.rear,
      `β = ${state.beta.toFixed(3)} and climbing · rate ratio = ${ratio.toFixed(4)} · lead = ${((A.front - A.rear) * 1000).toFixed(1)} ms`);
    ui.setSliderFromBeta(state.beta);
  }

  const beta = state.beta;
  const g = gamma(beta);
  const v = beta * C_SCENE;

  // -- advance geometry -----------------------------------------------------
  let driven = null;
  if (state.scenario) {
    const finished = state.scenario.update(dt);
    driven = state.scenario.drive();
    state.simTime = state.scenario.timeline.t;
    if (finished) endScenario();
  } else {
    state.simTime += dt;
  }

  if (state.frame === 'platform') {
    train.group.scale.x = 1 / g;
    if (driven?.trainX !== undefined) {
      train.group.position.x = driven.trainX;
    } else {
      state.trainPhase = wrapInto(state.trainPhase + v * dt, WRAP);
      train.group.position.x = state.trainPhase;
    }
    world.group.position.x = 0;
    world.group.scale.x = 1;
    scene.fog.far = 700; scene.fog.near = 80;
  } else {
    world.group.scale.x = 1 / g;
    if (driven?.worldX !== undefined) {
      world.group.position.x = driven.worldX;
    } else {
      const cp = PERIOD / g;
      state.worldPhase = wrapInto(state.worldPhase - v * dt, cp);
      world.group.position.x = state.worldPhase;
    }
    train.group.position.x = 0;
    train.group.scale.x = 1;
    const far = Math.min(700, Math.max(110, (SPAN / g) * 0.42));
    scene.fog.far = far; scene.fog.near = far * 0.12;
  }

  // -- proper times ---------------------------------------------------------
  const dtHome = dt;
  const dtAway = dt / g;
  if (state.frame === 'platform') {
    state.tauBob += dtHome; state.tauAlice += dtAway;
    bobClock.update(dtHome); aliceClock.update(dtAway);
  } else {
    state.tauAlice += dtHome; state.tauBob += dtAway;
    aliceClock.update(dtHome); bobClock.update(dtAway);
  }

  // light-clock race verdict
  if (state.race) {
    const home = state.frame === 'platform' ? bobClock : aliceClock;
    const away = state.frame === 'platform' ? aliceClock : bobClock;
    if (home.ticks >= state.race.target && !raceAnnounced) {
      raceAnnounced = true;
      const names = state.frame === 'platform' ? ['BOB', 'ALICE'] : ['ALICE', 'BOB'];
      ui.toast(`⏱ ${names[0]}: ${home.ticks} ticks — ${names[1]}: ${away.ticks}. Moving clock lost, exactly by 1/γ = ${(1 / g).toFixed(3)}.`);
      ui.log('major', `RACE RESULT — home ${home.ticks} ticks vs moving ${away.ticks} (predicted ${(state.race.target / g).toFixed(1)}).`);
      state.race = null;
      state.scenarioType = 'free';
      ui.setScenarioButtons('free');
    }
  } else {
    raceAnnounced = false;
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

  // -- Terrell warp ---------------------------------------------------------
  const terrellOn = state.optics.terrell && state.frame === 'platform';
  terrell.setEnabled(terrellOn);
  for (const w of train.warpables) w.visible = !terrellOn;
  train.frontMarker.visible = !terrellOn;
  train.rearMarker.visible = !terrellOn;
  if (terrellOn) terrell.update(train.group.position.x, beta, camera);

  // -- trails (need final world transforms) ---------------------------------
  scene.updateMatrixWorld();
  bobClock.recordTrail();
  aliceClock.recordTrail();

  // -- HUD ------------------------------------------------------------------
  ui.updateReadouts({
    beta,
    tauBob: state.tauBob, tauAlice: state.tauAlice,
    ticksBob: bobClock.ticks, ticksAlice: aliceClock.ticks,
  });
  minkowski.update({
    beta,
    frame: state.frame,
    simTime: state.scenario ? state.simTime : state.simTime % 5,
    scenarioType: state.scenarioType,
  });

  // -- render ---------------------------------------------------------------
  if (state.frame === 'train') {
    relView.render(scene, camera, {
      beta, gamma: g,
      aberration: state.optics.aberration,
      doppler: state.optics.doppler,
      headlight: state.optics.headlight,
    });
  } else {
    renderer.render(scene, camera);
  }
}

// --- go --------------------------------------------------------------------
window.__sim = state; // debug/test handle
minkowski.resize();
ui.setPaused(false);
ui.log('major', 'Welcome aboard the RELATIVITY EXPRESS. c is scaled to 60 m/s so you can watch light move.');
ui.log('info', 'Try: run ⚡ Lightning in the platform frame, then press F and run it again from the train.');
document.getElementById('help').classList.remove('hidden');
tick();
