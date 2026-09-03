// train.js — the RELATIVITY EXPRESS. Proper length TRAIN_PROPER_LENGTH along x,
// nose pointing +x. All geometry lives in the train's rest frame; main.js
// applies contraction by scaling the group. Meshes that should participate in
// the Terrell–Penrose warp are collected in `warpables` (plain meshes only).
import * as THREE from 'three';
import { TRAIN_PROPER_LENGTH } from './physics.js';
import { makeTextPlane } from './labels.js';
import { buildPerson } from './world.js';

export function buildTrain() {
  const L = TRAIN_PROPER_LENGTH;
  const g = new THREE.Group();
  g.name = 'train';
  const warpables = [];
  const track = (mesh) => { warpables.push(mesh); return mesh; };

  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x8e1f2f, roughness: 0.35, metalness: 0.25 });
  const creamMat = new THREE.MeshStandardMaterial({ color: 0xe8d9b0, roughness: 0.5 });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x1d1f26, roughness: 0.7 });

  // Main hull — heavily segmented along x so the Terrell warp bends smoothly
  const hull = track(new THREE.Mesh(new THREE.BoxGeometry(L - 10, 5.2, 6, 72, 5, 5), bodyMat));
  hull.position.y = 4.6;
  hull.castShadow = true;
  g.add(hull);

  // Streamlined nose (front, +x) and tail
  const nose = track(new THREE.Mesh(new THREE.SphereGeometry(3, 24, 18), bodyMat));
  nose.scale.set(1.9, 0.87, 1);
  nose.position.set(L / 2 - 5, 4.6, 0);
  nose.castShadow = true;
  g.add(nose);
  const tail = track(new THREE.Mesh(new THREE.SphereGeometry(3, 18, 14), bodyMat));
  tail.scale.set(1.25, 0.87, 1);
  tail.position.set(-L / 2 + 5, 4.6, 0);
  tail.castShadow = true;
  g.add(tail);

  // Cream speed-stripe
  const stripe = track(new THREE.Mesh(new THREE.BoxGeometry(L - 9, 0.9, 6.14, 60, 1, 1), creamMat));
  stripe.position.y = 5.1;
  g.add(stripe);

  // Chassis + wheel skirt
  const chassis = track(new THREE.Mesh(new THREE.BoxGeometry(L - 8, 1.6, 5.6, 60, 1, 1), darkMat));
  chassis.position.y = 2.0;
  chassis.castShadow = true;
  g.add(chassis);

  // Wheels — plain low-poly meshes so the Terrell warp can carry them
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x2c2f38, metalness: 0.6, roughness: 0.5 });
  const wheelGeo = new THREE.CylinderGeometry(1.05, 1.05, 0.5, 14);
  for (let i = 0; i < 9; i++) {
    const x = -L / 2 + 8 + i * ((L - 16) / 8);
    for (const z of [-2.55, 2.55]) {
      const w = track(new THREE.Mesh(wheelGeo, wheelMat));
      w.rotation.x = Math.PI / 2;
      w.position.set(x, 1.05, z);
      g.add(w);
    }
  }

  // Roof fin
  const fin = track(new THREE.Mesh(new THREE.BoxGeometry(16, 1.4, 0.5, 24, 2, 1), darkMat));
  fin.position.set(-26, 7.6, 0);
  g.add(fin);

  // Windows — emissive amber, both sides
  const winMat = new THREE.MeshBasicMaterial({ color: 0xffd98c });
  const winGeo = new THREE.PlaneGeometry(2.6, 1.7);
  for (let i = 0; i < 14; i++) {
    const x = -L / 2 + 10 + i * ((L - 22) / 13);
    if (Math.abs(x) < 8) continue; // lounge window occupies the middle
    for (const side of [1, -1]) {
      const w = track(new THREE.Mesh(winGeo, winMat));
      w.position.set(x, 5.2, side * 3.03);
      if (side < 0) w.rotation.y = Math.PI;
      g.add(w);
    }
  }

  // Central lounge window (platform side) with ALICE, the train observer
  const loungeGeo = new THREE.PlaneGeometry(13, 3.1);
  const lounge = track(new THREE.Mesh(loungeGeo, new THREE.MeshBasicMaterial({
    color: 0xffe6ae, transparent: true, opacity: 0.85,
  })));
  lounge.position.set(0, 5.1, 3.03);
  g.add(lounge);

  const alice = buildPerson(0xb3402f, 0xd9b38c);
  alice.scale.setScalar(0.85);
  alice.position.set(0, 2.4, 1.4);
  g.add(alice);
  const aliceTag = makeTextPlane('ALICE · train frame', 1.0, { color: '#ffb3a0' });
  aliceTag.position.set(0, 9.6, 0);
  g.add(aliceTag);

  // Livery lettering
  for (const side of [1, -1]) {
    const name = makeTextPlane('RELATIVITY ✦ EXPRESS', 1.05, {
      color: '#f5d98a', font: 'bold 90px Georgia, serif',
    });
    name.position.set(side * 14, 6.35, side * 3.08);
    if (side < 0) name.rotation.y = Math.PI;
    g.add(name);
  }

  // Headlight: emissive disc + real spotlight punching forward
  const lampMat = new THREE.MeshBasicMaterial({ color: 0xfff3c8 });
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.65, 12, 12), lampMat);
  lamp.position.set(L / 2 + 0.4, 4.9, 0);
  g.add(lamp);
  const headlight = new THREE.SpotLight(0xffedb8, 250, 260, 0.3, 0.5, 1.2);
  headlight.position.set(L / 2, 5, 0);
  headlight.target.position.set(L / 2 + 60, 2, 0);
  g.add(headlight, headlight.target);

  // Tail light
  const tailLampL = new THREE.Mesh(new THREE.SphereGeometry(0.4, 10, 10),
    new THREE.MeshBasicMaterial({ color: 0xff4444 }));
  tailLampL.position.set(-L / 2 - 0.2, 4.9, 0);
  g.add(tailLampL);

  // End markers — glowing posts at the exact proper ends (lightning targets)
  const markerMat = new THREE.MeshBasicMaterial({ color: 0x66ccff, transparent: true, opacity: 0.85 });
  const frontMarker = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 8.4), markerMat);
  frontMarker.position.set(L / 2, 5.6, 0);
  const rearMarker = frontMarker.clone();
  rearMarker.position.x = -L / 2;
  g.add(frontMarker, rearMarker);

  // Roof mount for the train's light clock
  const clockMount = new THREE.Object3D();
  clockMount.position.set(-18, 8.2, 0);
  g.add(clockMount);

  // Cabin camera anchor + a simple window frame the camera peers through in train view
  const cabinCam = new THREE.Object3D();
  cabinCam.position.set(0, 7.4, 0);
  g.add(cabinCam);

  const frameMat = new THREE.MeshStandardMaterial({ color: 0x3a2c22, roughness: 0.8 });
  const windowFrame = new THREE.Group();
  const barGeoH = new THREE.BoxGeometry(30, 0.35, 0.35);
  const top = new THREE.Mesh(barGeoH, frameMat); top.position.set(0, 10.6, 3.4);
  const bottom = new THREE.Mesh(barGeoH, frameMat); bottom.position.set(0, 3.4, 3.4);
  windowFrame.add(top, bottom);
  windowFrame.visible = false;
  g.add(windowFrame);

  // Capture rest-frame vertex data for the Terrell warp
  for (const meshy of warpables) {
    meshy.updateMatrix();
    meshy.userData.restPositions = meshy.geometry.attributes.position.array.slice();
  }

  return {
    group: g,
    warpables,
    headlight,
    clockMount,
    cabinCam,
    windowFrame,
    frontMarker,
    rearMarker,
    aliceTag,
    length: L,
  };
}
