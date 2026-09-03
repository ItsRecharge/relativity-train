// terrell.js — Terrell–Penrose rotation: what a CAMERA actually records.
// Length contraction is what you MEASURE (simultaneous positions); what you
// SEE is different, because light from the far end left earlier than light
// from the near end. Solving the retarded-time equation per vertex makes a
// passing train appear ROTATED rather than squashed.
//
// For a vertex whose platform-frame instantaneous position is (px, y, z) on a
// train moving at v along +x, the light reaching the camera NOW left Δ seconds
// ago, when the vertex was at (px − vΔ, y, z), with
//   (c² − v²)Δ² + 2v(px−cx)Δ − ((px−cx)² + dy² + dz²) = 0  → positive root.
import * as THREE from 'three';
import { C_SCENE, gamma } from './physics.js';

export class TerrellWarp {
  constructor(train, scene) {
    this.train = train;
    this.scene = scene;
    this.group = new THREE.Group();
    this.group.visible = false;
    scene.add(this.group);

    this.entries = [];
    for (const src of train.warpables) {
      const geo = src.geometry.clone();
      const mesh = new THREE.Mesh(geo, src.material);
      mesh.frustumCulled = false;
      mesh.matrixAutoUpdate = false;   // vertices are written in world space
      mesh.castShadow = false;
      this.group.add(mesh);
      this.entries.push({
        mesh,
        rest: src.userData.restPositions,   // rest-frame local coords
        local: src.matrix.clone(),          // static transform inside train group
      });
    }
    this._v = new THREE.Vector3();
  }

  setEnabled(on) {
    this.group.visible = on;
  }

  /**
   * @param trainX  scene x of the train's center (platform frame)
   * @param beta    v/c
   * @param camera  active camera (world position used for retarded time)
   */
  update(trainX, beta, camera) {
    if (!this.group.visible) return;
    const g = gamma(beta);
    const c = C_SCENE;
    const v = beta * c;
    const c2v2 = c * c - v * v;
    const cx = camera.position.x;
    const cy = camera.position.y;
    const cz = camera.position.z;

    // Retardation of the train's CENTER — subtracted from every vertex so the
    // image shows the apparent SHAPE (rotation) at the measured location,
    // instead of lagging the whole train behind by v·Δ.
    const dx0 = trainX - cx;
    const b0 = (4.6 - cy) * (4.6 - cy) + cz * cz;
    const B0 = 2 * v * dx0;
    const C0 = -(dx0 * dx0 + b0);
    const delta0 = (-B0 + Math.sqrt(B0 * B0 - 4 * c2v2 * C0)) / (2 * c2v2);
    const recenter = v * delta0;

    for (const e of this.entries) {
      const rest = e.rest;
      const attr = e.mesh.geometry.attributes.position;
      const out = attr.array;
      const m = e.local.elements;
      for (let i = 0; i < rest.length; i += 3) {
        const rx = rest[i], ry = rest[i + 1], rz = rest[i + 2];
        // rest-frame position within the train (proper coords)
        const x0 = m[0] * rx + m[4] * ry + m[8] * rz + m[12];
        const y0 = m[1] * rx + m[5] * ry + m[9] * rz + m[13];
        const z0 = m[2] * rx + m[6] * ry + m[10] * rz + m[14];
        // platform-frame instantaneous (measured, contracted) position
        const px = trainX + x0 / g;
        const dx = px - cx;
        const dy = y0 - cy;
        const dz = z0 - cz;
        // retarded time
        const b2 = dy * dy + dz * dz;
        const B = 2 * v * dx;
        const Cc = -(dx * dx + b2);
        const delta = (-B + Math.sqrt(B * B - 4 * c2v2 * Cc)) / (2 * c2v2);
        out[i] = px - v * delta + recenter;
        out[i + 1] = y0;
        out[i + 2] = z0;
      }
      attr.needsUpdate = true;
      e.mesh.geometry.computeVertexNormals();
      e.mesh.geometry.computeBoundingSphere();
    }
  }
}
