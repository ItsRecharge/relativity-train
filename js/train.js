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

  // Hollow hull: solid far wall, glass near pane (+z, camera side), roof, end caps
  const farWall = new THREE.Mesh(new THREE.BoxGeometry(L - 10, HULL_H, 0.3), bodyMat);
  farWall.position.set(0, HULL_CY, -2.85);
  farWall.castShadow = true;
  g.add(farWall);

  const glassPane = new THREE.Mesh(new THREE.BoxGeometry(L - 10, HULL_H, 0.2), glassMat);
  glassPane.position.set(0, HULL_CY, 2.9);
  g.add(glassPane);

  const roof = new THREE.Mesh(new THREE.BoxGeometry(L - 10, 0.35, 6.3), bodyMat);
  roof.position.set(0, HULL_CY + HULL_H / 2 + 0.15, 0);
  roof.castShadow = true;
  g.add(roof);

  for (const ex of [-(L - 10) / 2, (L - 10) / 2]) {
    const cap = new THREE.Mesh(new THREE.BoxGeometry(0.3, HULL_H, 6), bodyMat);
    cap.position.set(ex, HULL_CY, 0);
    g.add(cap);
  }

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

  // Interior lights so the cabin, rider and clock read through the glass
  for (const x of [-22, 0, 22]) {
    const cabinLight = new THREE.PointLight(0xffe0b0, 90, 42, 2);
    cabinLight.position.set(x, 10, 0.5);
    g.add(cabinLight);
  }

  // The rider, standing beside the clock
  const rider = buildPerson(0xb3402f, 0xd9b38c);
  rider.scale.setScalar(0.9);
  rider.position.set(-6, FLOOR_Y, 0.6);
  g.add(rider);

  furnish(g, L, FLOOR_Y);

  // The light clock stands inside, dead center of the car
  const clockMount = new THREE.Object3D();
  clockMount.position.set(0, FLOOR_Y + 0.2, 0);
  g.add(clockMount);

  return { group: g, headlight, clockMount, length: L };
}

// Interior fittings for the observation car: seats against the solid wall,
// tables with reading lamps, a luggage rack, a rug down the aisle, ceiling
// lights and a little wall art. The center stays clear for the clock.
function furnish(g, L, floorY) {
  const seatMat = new THREE.MeshStandardMaterial({ color: 0x41755b, roughness: 0.85 });
  const woodMat = new THREE.MeshStandardMaterial({ color: 0x6b4c33, roughness: 0.8 });
  const brassMat = new THREE.MeshStandardMaterial({ color: 0xa8853f, metalness: 0.7, roughness: 0.35 });

  // Seat benches, backrests against the solid wall
  for (const x of [-31, -25, -19, 19, 25, 31]) {
    const base = new THREE.Mesh(new THREE.BoxGeometry(3.4, 1.0, 2.0), seatMat);
    base.position.set(x, floorY + 0.5, -1.4);
    g.add(base);
    const back = new THREE.Mesh(new THREE.BoxGeometry(3.4, 2.3, 0.35), seatMat);
    back.position.set(x, floorY + 2.1, -2.45);
    g.add(back);
  }

  // Tables between seat pairs, each with a small brass reading lamp
  for (const x of [-22, 22]) {
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 1.7, 10), brassMat);
    stem.position.set(x, floorY + 0.85, -0.9);
    g.add(stem);
    const top = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.15, 0.12, 20), woodMat);
    top.position.set(x, floorY + 1.75, -0.9);
    g.add(top);
    const shade = new THREE.Mesh(new THREE.SphereGeometry(0.3, 10, 10),
      new THREE.MeshBasicMaterial({ color: 0xffd98c }));
    shade.position.set(x, floorY + 2.25, -0.9);
    g.add(shade);
  }

  // Aisle rug
  const rug = new THREE.Mesh(new THREE.BoxGeometry(L - 16, 0.06, 2.6),
    new THREE.MeshStandardMaterial({ color: 0x5a1f28, roughness: 1 }));
  rug.position.set(0, floorY + 0.03, 0.7);
  g.add(rug);

  // Luggage rack along the solid wall, with a few suitcases
  const rack = new THREE.Mesh(new THREE.BoxGeometry(L - 20, 0.15, 1.2), brassMat);
  rack.position.set(0, 10.6, -2.0);
  g.add(rack);
  const caseColors = [0x6b4a2f, 0x3d4a5c, 0x704438, 0x4a3a52];
  [-26, -9, 12, 27].forEach((x, i) => {
    const c = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.1, 1.0),
      new THREE.MeshStandardMaterial({ color: caseColors[i], roughness: 0.9 }));
    c.position.set(x, 11.3, -2.0);
    g.add(c);
  });

  // Ceiling lights
  for (const x of [-32, -16, 16, 32]) {
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 0.1, 16),
      new THREE.MeshBasicMaterial({ color: 0xffe0b0 }));
    disc.position.set(x, 12.25, 0);
    g.add(disc);
  }

  // Framed prints on the interior of the solid wall
  const artColors = [0x35507a, 0x7a5a35, 0x4a6b4f];
  [-12, 0, 12].forEach((x, i) => {
    const frame = new THREE.Mesh(new THREE.BoxGeometry(2.7, 2.1, 0.08), woodMat);
    frame.position.set(x, 8.6, -2.85);
    g.add(frame);
    const art = new THREE.Mesh(new THREE.PlaneGeometry(2.3, 1.7),
      new THREE.MeshBasicMaterial({ color: artColors[i] }));
    art.position.set(x, 8.6, -2.8);
    g.add(art);
  });
}
