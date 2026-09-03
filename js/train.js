// train.js — the RELATIVITY EXPRESS observation car. Proper length
// TRAIN_PROPER_LENGTH along x, nose pointing +x. The camera-facing half of the
// hull (+z) is glass, so the light clock and its two riders are visible inside
// from both views. main.js applies contraction by scaling the group.
import * as THREE from 'three';
import { TRAIN_PROPER_LENGTH } from './physics.js';
import { makeTextPlane } from './labels.js';
import { buildPerson } from './world.js';

export function buildTrain() {
  const L = TRAIN_PROPER_LENGTH;
  const g = new THREE.Group();
  g.name = 'train';

  const HULL_H = 10.4;          // tall observation car: the 9 m mirror gap fits inside
  const HULL_CY = 7.2;          // hull center height, spans y = 2 .. 12.4
  const FLOOR_Y = 2.8;          // chassis top = interior floor

  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x8e1f2f, roughness: 0.35, metalness: 0.25 });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x1d1f26, roughness: 0.7 });
  const glassMat = new THREE.MeshStandardMaterial({
    color: 0xbfd7e8, roughness: 0.12, metalness: 0.1,
    transparent: true, opacity: 0.16, depthWrite: false,
  });

  // Hull, split lengthwise: far half solid, near half (+z, camera side) glass
  const solidHalf = new THREE.Mesh(new THREE.BoxGeometry(L - 10, HULL_H, 3), bodyMat);
  solidHalf.position.set(0, HULL_CY, -1.5);
  solidHalf.castShadow = true;
  g.add(solidHalf);

  const glassHalf = new THREE.Mesh(new THREE.BoxGeometry(L - 10, HULL_H, 3), glassMat);
  glassHalf.position.set(0, HULL_CY, 1.5);
  g.add(glassHalf);

  // Mullions framing the glass side
  const railGeo = new THREE.BoxGeometry(L - 10, 0.35, 0.3);
  for (const y of [2.2, 12.25]) {
    const rail = new THREE.Mesh(railGeo, darkMat);
    rail.position.set(0, y, 3.02);
    g.add(rail);
  }
  const postGeo = new THREE.BoxGeometry(0.35, HULL_H, 0.3);
  for (const x of [-(L - 10) / 2, -22, 22, (L - 10) / 2]) {
    const post = new THREE.Mesh(postGeo, darkMat);
    post.position.set(x, HULL_CY, 3.02);
    g.add(post);
  }

  // Interior floor plate
  const floor = new THREE.Mesh(
    new THREE.BoxGeometry(L - 11, 0.25, 5.4),
    new THREE.MeshStandardMaterial({ color: 0x3a3630, roughness: 0.9 })
  );
  floor.position.set(0, FLOOR_Y - 0.15, 0);
  g.add(floor);

  // Nose (front, +x) and tail, scaled to the tall hull profile
  const nose = new THREE.Mesh(new THREE.SphereGeometry(4, 24, 18), bodyMat);
  nose.scale.set(1.7, 1.3, 0.75);
  nose.position.set(L / 2 - 5, HULL_CY, 0);
  nose.castShadow = true;
  g.add(nose);
  const tail = new THREE.Mesh(new THREE.SphereGeometry(4, 18, 14), bodyMat);
  tail.scale.set(1.15, 1.3, 0.75);
  tail.position.set(-L / 2 + 5, HULL_CY, 0);
  tail.castShadow = true;
  g.add(tail);

  // Chassis + wheels
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
  fin.position.set(-28, 13.0, 0);
  g.add(fin);

  // Windows on the solid side only (two rows), plus livery lettering
  const winMat = new THREE.MeshBasicMaterial({ color: 0xffd98c });
  const winGeo = new THREE.PlaneGeometry(2.6, 1.7);
  for (let i = 0; i < 14; i++) {
    const x = -L / 2 + 10 + i * ((L - 22) / 13);
    if (Math.abs(x) < 8) continue;
    for (const y of [5.0, 9.4]) {
      const w = new THREE.Mesh(winGeo, winMat);
      w.position.set(x, y, -3.03);
      w.rotation.y = Math.PI;
      g.add(w);
    }
  }
  const name = makeTextPlane('RELATIVITY EXPRESS', 1.05, {
    color: '#f5d98a', font: 'bold 90px "Helvetica Neue", Arial, sans-serif',
  });
  name.position.set(-14, 7.2, -3.08);
  name.rotation.y = Math.PI;
  g.add(name);

  // Headlight and tail light
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.7, 12, 12),
    new THREE.MeshBasicMaterial({ color: 0xfff3c8 }));
  lamp.position.set(L / 2 + 1.4, 6.6, 0);
  g.add(lamp);
  const headlight = new THREE.SpotLight(0xffedb8, 250, 260, 0.3, 0.5, 1.2);
  headlight.position.set(L / 2, 6.6, 0);
  headlight.target.position.set(L / 2 + 60, 2, 0);
  g.add(headlight, headlight.target);

  const tailLamp = new THREE.Mesh(new THREE.SphereGeometry(0.45, 10, 10),
    new THREE.MeshBasicMaterial({ color: 0xff4444 }));
  tailLamp.position.set(-L / 2 - 0.6, 6.6, 0);
  g.add(tailLamp);

  // Soft interior light so the riders and clock read through the glass
  const cabinLight = new THREE.PointLight(0xffe0b0, 40, 30, 2);
  cabinLight.position.set(0, 9, 0);
  g.add(cabinLight);

  // Two riders on the carriage floor, flanking the clock
  const riderA = buildPerson(0xb3402f, 0xd9b38c);
  riderA.scale.setScalar(0.9);
  riderA.position.set(-6.5, FLOOR_Y, 0.6);
  g.add(riderA);
  const riderB = buildPerson(0x46628a, 0xc9a284);
  riderB.scale.setScalar(0.9);
  riderB.position.set(6.5, FLOOR_Y, 0.6);
  g.add(riderB);

  // The light clock stands inside, dead center of the car
  const clockMount = new THREE.Object3D();
  clockMount.position.set(0, FLOOR_Y + 0.2, 0);
  g.add(clockMount);

  return { group: g, headlight, clockMount, length: L };
}
