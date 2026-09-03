// lightClock.js — Einstein light clock: a photon bouncing between two mirrors.
// The photon is animated in the clock's PROPER time; when the clock rides a
// moving (γ-contracted) group, the photon's world path automatically becomes
// the correct diagonal zigzag at exactly speed c. One tick = one round trip.
import * as THREE from 'three';
import { C_SCENE } from './physics.js';
import { makeTextPlane } from './labels.js';

export const MIRROR_GAP = 9; // proper distance between mirrors → tick = 2·9/60 = 0.3 s

export class LightClock {
  constructor({ label, color = 0x53e0ff, scene }) {
    this.group = new THREE.Group();
    this.tau = 0;
    this.ticks = 0;
    this.scene = scene;

    const mirrorMat = new THREE.MeshStandardMaterial({
      color: 0xd8e6ff, metalness: 0.9, roughness: 0.15,
      emissive: 0x223344,
    });
    const mirrorGeo = new THREE.CylinderGeometry(1.5, 1.5, 0.25, 24);
    this.bottom = new THREE.Mesh(mirrorGeo, mirrorMat);
    this.top = new THREE.Mesh(mirrorGeo, mirrorMat);
    this.bottom.position.y = 0;
    this.top.position.y = MIRROR_GAP;
    this.group.add(this.bottom, this.top);

    const strutMat = new THREE.MeshStandardMaterial({ color: 0x39404f, roughness: 0.6 });
    for (const z of [-1.3, 1.3]) {
      const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, MIRROR_GAP), strutMat);
      strut.position.set(-1.2, MIRROR_GAP / 2, z);
      this.group.add(strut);
    }

    this.photon = new THREE.Mesh(
      new THREE.SphereGeometry(0.42, 14, 14),
      new THREE.MeshBasicMaterial({ color })
    );
    this.group.add(this.photon);
    this.glow = new THREE.PointLight(color, 30, 18, 2);
    this.group.add(this.glow);

    if (label) {
      const tag = makeTextPlane(label, 0.9, { color: '#bfe9ff' });
      tag.position.y = MIRROR_GAP + 2.2;
      this.group.add(tag);
    }

    // Photon trail lives in SCENE space so the zigzag of a moving clock shows.
    this.trailMax = 140;
    this.trailPts = [];
    const trailGeo = new THREE.BufferGeometry();
    trailGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(this.trailMax * 3), 3));
    this.trail = new THREE.Line(trailGeo, new THREE.LineBasicMaterial({
      color, transparent: true, opacity: 0.55,
    }));
    this.trail.frustumCulled = false;
    scene.add(this.trail);
    this._tmp = new THREE.Vector3();
  }

  // Advance by dtau seconds of PROPER time.
  update(dtau) {
    this.tau += dtau;
    const halfPeriod = MIRROR_GAP / C_SCENE;          // one leg of the bounce
    const phase = (this.tau / halfPeriod) % 2;        // 0..2
    const yFrac = phase < 1 ? phase : 2 - phase;      // triangle wave
    this.photon.position.y = yFrac * MIRROR_GAP;
    this.glow.position.copy(this.photon.position);
    this.ticks = Math.floor(this.tau / (2 * halfPeriod));
  }

  // Call after all group transforms are final for the frame.
  recordTrail() {
    this.photon.getWorldPosition(this._tmp);
    const prev = this.trailPts[this.trailPts.length - 1];
    if (prev && prev.distanceTo(this._tmp) > 40) this.trailPts.length = 0; // wrap jump
    this.trailPts.push(this._tmp.clone());
    if (this.trailPts.length > this.trailMax) this.trailPts.shift();
    const attr = this.trail.geometry.attributes.position;
    for (let i = 0; i < this.trailPts.length; i++) {
      attr.setXYZ(i, this.trailPts[i].x, this.trailPts[i].y, this.trailPts[i].z);
    }
    // pad remaining slots with the last point so the line doesn't shoot to 0,0,0
    const last = this.trailPts[this.trailPts.length - 1];
    if (last) {
      for (let i = this.trailPts.length; i < this.trailMax; i++) attr.setXYZ(i, last.x, last.y, last.z);
    }
    attr.needsUpdate = true;
  }

  clearTrail() {
    this.trailPts.length = 0;
  }

  reset() {
    this.tau = 0;
    this.ticks = 0;
    this.clearTrail();
  }
}
