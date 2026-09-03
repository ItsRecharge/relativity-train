// lightning.js — timed thought-experiment scenarios: the classic simultaneity
// lightning strikes, and the train-in-tunnel (ladder) paradox. Each scenario
// owns a small timeline of events computed EXACTLY from the Lorentz transform
// (physics.js) for whichever frame is being viewed, and drives the train/world
// position so the geometry lines up with the events.
import * as THREE from 'three';
import {
  C_SCENE, TRAIN_PROPER_LENGTH, gamma, lightningEvents, tunnelEvents, lorentz,
} from './physics.js';

class Timeline {
  constructor(events, t0) {
    // events: [{t, fn, label}]
    this.events = [...events].sort((a, b) => a.t - b.t);
    this.t = t0;
    this.fired = 0;
  }
  update(dt) {
    this.t += dt;
    while (this.fired < this.events.length && this.events[this.fired].t <= this.t) {
      this.events[this.fired].fn(this.t);
      this.fired++;
    }
  }
  get done() { return this.fired >= this.events.length; }
}

// --- shared visual helpers -------------------------------------------------

function makeBolt(x, topY = 58, bottomY = 10) {
  const pts = [];
  let y = topY;
  let bx = x;
  while (y > bottomY) {
    pts.push(new THREE.Vector3(bx, y, 0));
    y -= 4 + Math.random() * 5;
    bx = x + (Math.random() - 0.5) * 5;
  }
  pts.push(new THREE.Vector3(x, bottomY, 0));
  const geo = new THREE.BufferGeometry().setFromPoints(pts);
  const line = new THREE.Line(geo, new THREE.LineBasicMaterial({
    color: 0xfff8d0, transparent: true, opacity: 1, linewidth: 2,
  }));
  const flash = new THREE.PointLight(0xcfe0ff, 900, 220, 1.6);
  flash.position.set(x, 25, 6);
  const g = new THREE.Group();
  g.add(line, flash);
  g.userData = { line, flash, age: 0 };
  return g;
}

function makeWavefront(x, color) {
  const g = new THREE.Group();
  g.position.set(x, 6, 0);
  const shell = new THREE.Mesh(
    new THREE.SphereGeometry(1, 40, 24),
    new THREE.MeshBasicMaterial({
      color, transparent: true, opacity: 0.13, side: THREE.DoubleSide, depthWrite: false,
    })
  );
  const wire = new THREE.Mesh(
    new THREE.SphereGeometry(1, 24, 12),
    new THREE.MeshBasicMaterial({ color, wireframe: true, transparent: true, opacity: 0.3, depthWrite: false })
  );
  g.add(shell, wire);
  g.userData = { birth: null };
  return g;
}

function makeReceiveRing(color) {
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.6, 1, 40),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.95, side: THREE.DoubleSide, depthWrite: false })
  );
  ring.rotation.x = -Math.PI / 2;
  ring.userData = { age: 0 };
  return ring;
}

const fmt = (t) => `${t >= 0 ? '+' : '−'}${Math.abs(t).toFixed(3)} s`;

// ---------------------------------------------------------------------------
// LIGHTNING SIMULTANEITY
// ---------------------------------------------------------------------------
export class LightningScenario {
  /**
   * opts: { scene, frame: 'platform'|'train', beta, log(kind, msg), toast(msg) }
   */
  constructor(opts) {
    this.o = opts;
    this.scene = opts.scene;
    this.beta = opts.beta;
    this.frame = opts.frame;
    this.root = new THREE.Group();
    this.scene.add(this.root);
    this.bolts = [];
    this.fronts = [];
    this.rings = [];
    this.disposed = false;

    const ev = lightningEvents(this.beta);
    this.ev = ev;
    const v = this.beta * C_SCENE;
    const L0 = ev.L0;
    const g = ev.gamma;
    const events = [];
    const boltAt = (x, t, who) => events.push({
      t,
      label: who,
      fn: () => {
        const b = makeBolt(x);
        this.root.add(b);
        this.bolts.push(b);
      },
    });
    const waveAt = (x, t, color) => {
      const w = makeWavefront(x, color);
      this.root.add(w);
      this.fronts.push(w);
      events.push({ t, fn: (now) => { w.userData.birth = t; w.visible = true; } });
      w.visible = false;
    };
    const ringAt = (t, xAtT, color, msg) => events.push({
      t,
      fn: () => {
        const r = makeReceiveRing(color);
        r.position.set(typeof xAtT === 'function' ? xAtT(t) : xAtT, 2.1, 0);
        this.root.add(r);
        this.rings.push(r);
        this.o.log('event', msg);
      },
    });

    if (this.frame === 'platform') {
      const L = ev.L;
      boltAt(+L / 2, 0);
      boltAt(-L / 2, 0);
      events.push({ t: 0, fn: () => this.o.toast('⚡⚡ BOTH ends struck — SIMULTANEOUS in the platform frame') });
      waveAt(+L / 2, 0, 0xffc861);
      waveAt(-L / 2, 0, 0x61d4ff);
      ringAt(ev.S.trainSeesFront, (t) => v * t, 0xffc861,
        `t ${fmt(ev.S.trainSeesFront)} — ALICE meets the FRONT flash (she rides toward it)`);
      ringAt(ev.S.platformSeesBoth, 0, 0xffffff,
        `t ${fmt(ev.S.platformSeesBoth)} — BOB gets BOTH flashes at once → "the strikes were simultaneous"`);
      ringAt(ev.S.trainSeesRear, (t) => v * t, 0x61d4ff,
        `t ${fmt(ev.S.trainSeesRear)} — rear flash finally catches ALICE → she saw front FIRST`);
      const tEnd = ev.S.trainSeesRear + 1.0;
      events.push({ t: tEnd, fn: () => { this.finished = true; } });
      this.timeline = new Timeline(events, -1.3);
      this.o.log('major', `PLATFORM FRAME — strikes hit both ends of the ${L.toFixed(1)} m contracted train at the same instant (t = 0).`);
    } else {
      // Train frame: front strike FIRST (t′<0), rear later; both land on the
      // train's own ends x′ = ±L0/2; wavefronts are centered on points fixed
      // in THIS frame. Bob (platform) slides backward yet still receives both
      // flashes together — computed via Lorentz transform of his reception.
      const tF = ev.T.strikeFront.t;
      const tR = ev.T.strikeRear.t;
      boltAt(+L0 / 2, tF);
      boltAt(-L0 / 2, tR);
      events.push({ t: tF, fn: () => this.o.toast('⚡ FRONT struck FIRST — the strikes are NOT simultaneous in the train frame') });
      events.push({ t: tR, fn: () => this.o.toast('⚡ …now the REAR — same two events, different clock readings') });
      waveAt(+L0 / 2, tF, 0xffc861);
      waveAt(-L0 / 2, tR, 0x61d4ff);
      ringAt(ev.T.trainSeesFront, 0, 0xffc861,
        `t′ ${fmt(ev.T.trainSeesFront)} — ALICE (center of train) receives the front flash`);
      ringAt(ev.T.trainSeesRear, 0, 0x61d4ff,
        `t′ ${fmt(ev.T.trainSeesRear)} — ALICE receives the rear flash`);
      const bobRx = lorentz(ev.S.platformSeesBoth, 0, this.beta); // Bob's reception, train coords
      ringAt(bobRx.t, bobRx.x, 0xffffff,
        `t′ ${fmt(bobRx.t)} — BOB (sliding past) still gets both flashes TOGETHER — his simultaneity, not ours`);
      const tEnd = Math.max(ev.T.trainSeesRear, bobRx.t) + 1.0;
      events.push({ t: tEnd, fn: () => { this.finished = true; } });
      this.timeline = new Timeline(events, tF - 1.3);
      this.o.log('major', `TRAIN FRAME — front strike at t′ = ${tF.toFixed(3)} s, rear at t′ = +${tR.toFixed(3)} s (Δt′ = γβL₀/c). Same lightning, no shared "now".`);
    }
  }

  // Scene-space positions main.js must apply while this scenario runs.
  drive() {
    const v = this.beta * C_SCENE;
    const t = this.timeline.t;
    if (this.frame === 'platform') return { trainX: v * t };
    return { worldX: -v * t };
  }

  update(dt) {
    this.timeline.update(dt);
    const t = this.timeline.t;
    for (const w of this.fronts) {
      if (!w.visible) continue;
      const r = Math.max(0.01, C_SCENE * (t - w.userData.birth));
      w.scale.setScalar(r);
      const fade = Math.max(0.03, 1 - r / 260);
      w.children[0].material.opacity = 0.13 * fade;
      w.children[1].material.opacity = 0.3 * fade;
    }
    for (const b of this.bolts) {
      b.userData.age += dt;
      const a = b.userData.age;
      b.userData.line.material.opacity = Math.max(0, 1 - a * 2.4);
      b.userData.flash.intensity = 900 * Math.max(0, 1 - a * 3);
      if (a > 0.6) b.visible = false;
    }
    for (const r of this.rings) {
      r.userData.age += dt;
      const a = r.userData.age;
      r.scale.setScalar(1 + a * 26);
      r.material.opacity = Math.max(0, 0.95 - a * 0.8);
    }
    return this.finished === true;
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.scene.remove(this.root);
    this.root.traverse((o) => {
      o.geometry?.dispose?.();
      o.material?.dispose?.();
    });
  }
}

// ---------------------------------------------------------------------------
// TUNNEL (LADDER) PARADOX
// ---------------------------------------------------------------------------
export class TunnelScenario {
  /**
   * opts: { scene, frame, beta, tunnelLength, doors: {front:[], rear:[]}, log, toast }
   * doors are the door meshes across all periodic tunnel copies.
   */
  constructor(opts) {
    this.o = opts;
    this.beta = opts.beta;
    this.frame = opts.frame;
    this.Lt = opts.tunnelLength;
    this.disposed = false;
    const g = gamma(this.beta);
    const tu = tunnelEvents(this.beta, this.Lt);
    this.tu = tu;

    const pulse = (doors, when, events, msg) => {
      events.push({ t: when, fn: () => { this._pulse(doors); this.o.log('event', msg); } });
    };

    const events = [];
    if (this.frame === 'platform') {
      pulse([...this.o.doors.front, ...this.o.doors.rear], 0, events,
        `t = 0 — BOTH doors slam & reopen at once. Train is ${tu.contractedTrain.toFixed(1)} m — ${tu.fits_S ? 'it FITS' : 'it does NOT fit'} in the ${this.Lt} m tunnel.`);
      events.push({
        t: 0,
        fn: () => this.o.toast(tu.fits_S
          ? `✅ γ = ${g.toFixed(2)} → train contracted to ${tu.contractedTrain.toFixed(1)} m — trapped in the tunnel for an instant!`
          : `⚠️ Too slow: train is ${tu.contractedTrain.toFixed(1)} m, tunnel ${this.Lt} m — crank β up past ${(Math.sqrt(1 - (this.Lt / TRAIN_PROPER_LENGTH) ** 2)).toFixed(3)} c`),
      });
      events.push({ t: 1.6, fn: () => { this.finished = true; } });
      this.timeline = new Timeline(events, -1.4);
      this.o.log('major', `PLATFORM (tunnel) FRAME — tunnel is at rest, train contracts.`);
    } else {
      const tF = tu.T.closeFront.t;
      const tR = tu.T.closeRear.t;
      pulse(this.o.doors.front, tF, events,
        `t′ ${fmt(tF)} — FRONT door snaps shut & reopens — while the rear of the train is still outside.`);
      pulse(this.o.doors.rear, tR, events,
        `t′ ${fmt(tR)} — REAR door snaps — the front of the train has already left. Never both shut around us.`);
      events.push({
        t: tR,
        fn: () => this.o.toast(`🚇 Tunnel is only ${tu.contractedTunnel.toFixed(1)} m here — the 80 m train NEVER fits. The doors just don't close together. No paradox.`),
      });
      events.push({ t: tR + 1.4, fn: () => { this.finished = true; } });
      this.timeline = new Timeline(events, tF - 1.4);
      this.o.log('major', `TRAIN FRAME — the TUNNEL contracts (${tu.contractedTunnel.toFixed(1)} m); door closings become non-simultaneous.`);
    }
  }

  _pulse(doorMeshes) {
    for (const d of doorMeshes) d.userData.pulseAge = 0;
    this._pulsing = (this._pulsing || []).concat(doorMeshes);
  }

  drive() {
    const v = this.beta * C_SCENE;
    const t = this.timeline.t;
    if (this.frame === 'platform') return { trainX: v * t };
    return { worldX: -v * t };
  }

  update(dt) {
    this.timeline.update(dt);
    if (this._pulsing) {
      for (const d of this._pulsing) {
        d.userData.pulseAge += dt;
        const a = d.userData.pulseAge;
        d.material.opacity = a < 0.5 ? Math.min(0.85, a * 8) * (1 - a / 0.5) + (a < 0.12 ? 0.85 : 0) : 0;
      }
      this._pulsing = this._pulsing.filter((d) => d.userData.pulseAge < 0.6);
    }
    return this.finished === true;
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    for (const d of [...this.o.doors.front, ...this.o.doors.rear]) d.material.opacity = 0;
  }
}
