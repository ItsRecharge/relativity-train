// train.js — the RELATIVITY EXPRESS. Proper length TRAIN_PROPER_LENGTH along x,
// nose pointing +x. All geometry lives in the train's rest frame; main.js
// applies contraction by scaling the group.
import * as THREE from 'three';
import { TRAIN_PROPER_LENGTH } from './physics.js';
import { makeTextPlane } from './labels.js';
import { buildPerson } from './world.js';

export function buildTrain() {
  const L = TRAIN_PROPER_LENGTH;
  const g = new THREE.Group();
  g.name = 'train';

  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x8e1f2f, roughness: 0.35, metalness: 0.25 });
  const creamMat = new THREE.MeshStandardMaterial({ color: 0xe8d9b0, roughness: 0.5 });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x1d1f26, roughness: 0.7 });

  const hull = new THREE.Mesh(new THREE.BoxGeometry(L - 10, 5.2, 6), bodyMat);
  hull.position.y = 4.6;
  hull.castShadow = true;
  g.add(hull);

  // Streamlined nose (front, +x) and tail
  const nose = new THREE.Mesh(new THREE.SphereGeometry(3, 24, 18), bodyMat);
  nose.scale.set(1.9, 0.87, 1);
  nose.position.set(L / 2 - 5, 4.6, 0);
  nose.castShadow = true;
  g.add(nose);
  const tail = new THREE.Mesh(new THREE.SphereGeometry(3, 18, 14), bodyMat);
  tail.scale.set(1.25, 0.87, 1);
  tail.position.set(-L / 2 + 5, 4.6, 0);
  tail.castShadow = true;
  g.add(tail);

  const stripe = new THREE.Mesh(new THREE.BoxGeometry(L - 9, 0.9, 6.14), creamMat);
  stripe.position.y = 5.1;
  g.add(stripe);

  const chassis = new THREE.Mesh(new THREE.BoxGeometry(L - 8, 1.6, 5.6), darkMat);
  chassis.position.y = 2.0;
  chassis.castShadow = true;
  g.add(chassis);

  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x2c2f38, metalness: 0.6, roughness: 0.5 });
  const wheelGeo = new THREE.CylinderGeometry(1.05, 1.05, 0.5, 14);
  for (let i = 0; i < 9; i++) {
    const x = -L / 2 + 8 + i * ((L - 16) / 8);
    for (const z of [-2.55, 2.55]) {
      const w = new THREE.Mesh(wheelGeo, wheelMat);
      w.rotation.x = Math.PI / 2;
      w.position.set(x, 1.05, z);
      g.add(w);
    }
  }

  const fin = new THREE.Mesh(new THREE.BoxGeometry(14, 1.2, 0.5), darkMat);
  fin.position.set(-28, 7.5, 0);
  g.add(fin);

  // Windows, both sides
  const winMat = new THREE.MeshBasicMaterial({ color: 0xffd98c });
  const winGeo = new THREE.PlaneGeometry(2.6, 1.7);
  for (let i = 0; i < 14; i++) {
    const x = -L / 2 + 10 + i * ((L - 22) / 13);
    if (Math.abs(x) < 8) continue; // lounge window occupies the middle
    for (const side of [1, -1]) {
      const w = new THREE.Mesh(winGeo, winMat);
      w.position.set(x, 5.2, side * 3.03);
      if (side < 0) w.rotation.y = Math.PI;
      g.add(w);
    }
  }

  // Central lounge window (platform side) with the rider visible inside
  const lounge = new THREE.Mesh(new THREE.PlaneGeometry(13, 3.1), new THREE.MeshBasicMaterial({
    color: 0xffe6ae, transparent: true, opacity: 0.85,
  }));
  lounge.position.set(0, 5.1, 3.03);
  g.add(lounge);

  const rider = buildPerson(0xb3402f, 0xd9b38c);
  rider.scale.setScalar(0.85);
  rider.position.set(0, 2.4, 1.4);
  g.add(rider);

  // Livery lettering
  for (const side of [1, -1]) {
    const name = makeTextPlane('RELATIVITY EXPRESS', 1.05, {
      color: '#f5d98a', font: 'bold 90px "Helvetica Neue", Arial, sans-serif',
    });
    name.position.set(side * 14, 6.35, side * 3.08);
    if (side < 0) name.rotation.y = Math.PI;
    g.add(name);
  }

  // Headlight
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.65, 12, 12),
    new THREE.MeshBasicMaterial({ color: 0xfff3c8 }));
  lamp.position.set(L / 2 + 0.4, 4.9, 0);
  g.add(lamp);
  const headlight = new THREE.SpotLight(0xffedb8, 250, 260, 0.3, 0.5, 1.2);
  headlight.position.set(L / 2, 5, 0);
  headlight.target.position.set(L / 2 + 60, 2, 0);
  g.add(headlight, headlight.target);

  const tailLamp = new THREE.Mesh(new THREE.SphereGeometry(0.4, 10, 10),
    new THREE.MeshBasicMaterial({ color: 0xff4444 }));
  tailLamp.position.set(-L / 2 - 0.2, 4.9, 0);
  g.add(tailLamp);

  // Roof mount for the light clock, dead center of the train
  const clockMount = new THREE.Object3D();
  clockMount.position.set(0, 8.2, 0);
  g.add(clockMount);

  return { group: g, headlight, clockMount, length: L };
}
