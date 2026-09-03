// lightClock.js — Einstein light clock: one photon bouncing between two mirrors.
// The photon is animated in the clock's PROPER time; when the clock rides a
// moving (γ-contracted) group, its world-space path automatically becomes the
// correct diagonal zigzag at exactly speed c. One tick = one round trip.
//
// The trail is recorded in WORLD space, which is the whole demonstration:
// straight vertical line in the clock's own frame, zigzag from the platform.
import * as THREE from 'three';
import { C_SCENE } from './physics.js';

export const MIRROR_GAP = 9; // proper distance between mirrors: tick = 2·9/60 = 0.3 s
const ACCENT = 0xf5b942;

export class LightClock {
  constructor({ scene }) {
    this.group = new THREE.Group();
    this.tau = 0;
    this.ticks = 0;
    this.scene = scene;

    const mirrorMat = new THREE.MeshStandardMaterial({
      color: 0xd8e6ff, metalness: 0.9, roughness: 0.15, emissive: 0x28313f,
    });
    const mirrorGeo = new THREE.CylinderGeometry(2.0, 2.0, 0.28, 28);
    const bottom = new THREE.Mesh(mirrorGeo, mirrorMat);
    const top = new THREE.Mesh(mirrorGeo, mirrorMat);
    top.position.y = MIRROR_GAP;
    this.group.add(bottom, top);

    const strutMat = new THREE.MeshStandardMaterial({ color: 0x39404f, roughness: 0.6 });
    for (const z of [-1.7, 1.7]) {
      const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, MIRROR_GAP), strutMat);
      strut.position.set(-1.5, MIRROR_GAP / 2, z);
      this.group.add(strut);
    }

    this.photon = new THREE.Mesh(
      new THREE.SphereGeometry(0.55, 16, 16),
      new THREE.MeshBasicMaterial({ color: ACCENT })
    );
    this.group.add(this.photon);
    this.glow = new THREE.PointLight(ACCENT, 60, 26, 2);
    this.group.add(this.glow);

    // Trail: scene-space line, additive-blended, color fades to black at the tail
    this.trailMax = 360;
    this.trailPts = [];
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(this.trailMax * 3), 3));
    geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(this.trailMax * 3), 3));
    this.trail = new THREE.Line(geo, new THREE.LineBasicMaterial({
      vertexColors: true,
      blending: THREE.AdditiveBlending,
      transparent: true,
      depthWrite: false,
    }));
    this.trail.frustumCulled = false;
    scene.add(this.trail);
    this._tmp = new THREE.Vector3();
    this._accent = new THREE.Color(ACCENT);
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

    const pos = this.trail.geometry.attributes.position;
    const col = this.trail.geometry.attributes.color;
    const n = this.trailPts.length;
    for (let i = 0; i < n; i++) {
      const p = this.trailPts[i];
      pos.setXYZ(i, p.x, p.y, p.z);
      const f = (i / n) ** 1.6; // fade toward the tail
      col.setXYZ(i, this._accent.r * f, this._accent.g * f, this._accent.b * f);
    }
    const last = this.trailPts[n - 1];
    if (last) {
      for (let i = n; i < this.trailMax; i++) {
        pos.setXYZ(i, last.x, last.y, last.z);
        col.setXYZ(i, 0, 0, 0);
      }
    }
    pos.needsUpdate = true;
    col.needsUpdate = true;
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
