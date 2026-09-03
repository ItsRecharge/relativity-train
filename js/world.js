// world.js — the embankment: platform, station, scenery. Everything that lives
// in the *platform rest frame* goes into the group returned by buildWorldGroup();
// main.js contracts/moves that group as one unit. Uniform-along-x items (rails,
// ground, sky) are static scene children — their motion/contraction is invisible.
import * as THREE from 'three';
import { makeTextPlane } from './labels.js';

export const PERIOD = 1200;   // proper length of one repeating scenery tile
export const COPIES = 5;      // tiles built (centered on 0) — span = 6000
export const SPAN = PERIOD * COPIES;
export const TUNNEL_PROPER_LENGTH = 60;

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------------------
// Static (frame-independent-looking) backdrop
// ---------------------------------------------------------------------------
export function buildStaticWorld(scene) {
  // Ground
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(9000, 1400),
    new THREE.MeshStandardMaterial({ color: 0x27342a, roughness: 1 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.05;
  ground.receiveShadow = true;
  scene.add(ground);

  // Track bed + rails (uniform along x → static is physically honest)
  const bed = new THREE.Mesh(
    new THREE.BoxGeometry(9000, 0.6, 7),
    new THREE.MeshStandardMaterial({ color: 0x4a4038, roughness: 1 })
  );
  bed.position.y = 0.3;
  bed.receiveShadow = true;
  scene.add(bed);

  const railMat = new THREE.MeshStandardMaterial({ color: 0xb9c0c8, metalness: 0.9, roughness: 0.35 });
  for (const z of [-1.5, 1.5]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(9000, 0.3, 0.22), railMat);
    rail.position.set(0, 0.95, z);
    scene.add(rail);
  }

  // Sky dome — dusk gradient, immune to fog
  const skyGeo = new THREE.SphereGeometry(4000, 32, 16);
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    fog: false,
    depthWrite: false,
    uniforms: {},
    vertexShader: /* glsl */`
      varying vec3 vPos;
      void main() { vPos = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
    `,
    fragmentShader: /* glsl */`
      varying vec3 vPos;
      void main() {
        float h = normalize(vPos).y;
        vec3 top = vec3(0.016, 0.031, 0.10);
        vec3 mid = vec3(0.10, 0.11, 0.28);
        vec3 horizon = vec3(0.85, 0.45, 0.22);
        vec3 col = mix(mid, top, smoothstep(0.06, 0.5, h));
        col = mix(horizon, col, smoothstep(-0.02, 0.14, h));
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
  const sky = new THREE.Mesh(skyGeo, skyMat);
  scene.add(sky);

  // Stars
  const starCount = 1600;
  const starPos = new Float32Array(starCount * 3);
  const rand = mulberry32(7);
  for (let i = 0; i < starCount; i++) {
    const theta = rand() * Math.PI * 2;
    const phi = Math.acos(rand() * 0.85 + 0.12); // keep above horizon
    const r = 3600;
    starPos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    starPos[i * 3 + 1] = r * Math.cos(phi);
    starPos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
  const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({
    color: 0xcfd8ff, size: 5.5, sizeAttenuation: true, fog: false,
    transparent: true, opacity: 0.9,
  }));
  scene.add(stars);

  // Setting sun glow
  const sun = new THREE.Mesh(
    new THREE.SphereGeometry(90, 24, 24),
    new THREE.MeshBasicMaterial({ color: 0xffb46b, fog: false })
  );
  sun.position.set(-1400, 130, -2600);
  scene.add(sun);

  // Distant mountains — fog-proof so far view never dies at extreme γ
  const mountainMat = new THREE.MeshBasicMaterial({ color: 0x141a30, fog: false });
  const mrand = mulberry32(99);
  const mountains = new THREE.Group();
  for (let i = 0; i < 26; i++) {
    const h = 120 + mrand() * 260;
    const m = new THREE.Mesh(new THREE.ConeGeometry(140 + mrand() * 240, h, 4 + Math.floor(mrand() * 3)), mountainMat);
    m.position.set(-2800 + i * 230 + mrand() * 120, h / 2 - 6, -900 - mrand() * 700);
    m.rotation.y = mrand() * Math.PI;
    mountains.add(m);
  }
  scene.add(mountains);

  // Lighting
  const hemi = new THREE.HemisphereLight(0x8899ff, 0x33241a, 1.1);
  scene.add(hemi);
  const dir = new THREE.DirectionalLight(0xffc48a, 2.2);
  dir.position.set(-140, 180, 120);
  dir.castShadow = true;
  dir.shadow.mapSize.set(2048, 2048);
  dir.shadow.camera.left = -180;
  dir.shadow.camera.right = 180;
  dir.shadow.camera.top = 160;
  dir.shadow.camera.bottom = -60;
  dir.shadow.camera.far = 600;
  dir.shadow.bias = -0.0004;
  scene.add(dir);

  return { sky, stars, sun, dirLight: dir };
}

// ---------------------------------------------------------------------------
// One periodic tile of embankment scenery, centered on (cx, 0, 0)
// ---------------------------------------------------------------------------
function buildStation(cx) {
  const g = new THREE.Group();

  // Platform slab (camera side, +z)
  const slab = new THREE.Mesh(
    new THREE.BoxGeometry(150, 1.8, 9),
    new THREE.MeshStandardMaterial({ color: 0x8d8578, roughness: 0.95 })
  );
  slab.position.set(cx, 0.9, 8.5);
  slab.receiveShadow = true;
  slab.castShadow = true;
  g.add(slab);

  // Platform edge stripe
  const stripe = new THREE.Mesh(
    new THREE.BoxGeometry(150, 0.1, 0.7),
    new THREE.MeshStandardMaterial({ color: 0xd9cf9f, roughness: 0.9 })
  );
  stripe.position.set(cx, 1.86, 4.4);
  g.add(stripe);

  // Station house
  const house = new THREE.Group();
  const walls = new THREE.Mesh(
    new THREE.BoxGeometry(34, 10, 9),
    new THREE.MeshStandardMaterial({ color: 0x6e3b34, roughness: 0.9 })
  );
  walls.position.y = 5;
  walls.castShadow = true;
  walls.receiveShadow = true;
  house.add(walls);
  const roof = new THREE.Mesh(
    new THREE.ConeGeometry(24, 6, 4),
    new THREE.MeshStandardMaterial({ color: 0x2b2b33, roughness: 0.85 })
  );
  roof.rotation.y = Math.PI / 4;
  roof.scale.z = 0.45;
  roof.position.y = 13;
  roof.castShadow = true;
  house.add(roof);
  for (const wx of [-10, 0, 10]) {
    const win = new THREE.Mesh(
      new THREE.PlaneGeometry(4, 4.6),
      new THREE.MeshBasicMaterial({ color: 0xffd98c })
    );
    win.position.set(wx, 5.2, -4.51);
    win.rotation.y = Math.PI;
    house.add(win);
  }
  house.position.set(cx + 58, 1.8, 17);
  g.add(house);

  // Station sign
  const sign = makeTextPlane('EINSTEINBACH', 2.2, {
    color: '#ffe9b0', bg: '#1c2030', font: 'bold 110px Georgia, serif',
  });
  sign.position.set(cx, 7.5, 10.4);
  g.add(sign);
  const signPostMat = new THREE.MeshStandardMaterial({ color: 0x24262e });
  for (const dx of [-9, 9]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 5.8), signPostMat);
    post.position.set(cx + dx, 4.6, 10.4);
    g.add(post);
  }

  // Platform observer "Bob" — stands at the tile center, x = cx
  const bob = buildPerson(0x2f6db3, 0xd9b38c);
  bob.position.set(cx, 1.8, 5.4);
  bob.name = 'bob';
  g.add(bob);
  const bobTag = makeTextPlane('BOB · platform frame', 1.0, { color: '#9fd0ff' });
  bobTag.position.set(cx, 8.0, 5.4);
  g.add(bobTag);

  // Benches + lamps
  const benchMat = new THREE.MeshStandardMaterial({ color: 0x40506b, roughness: 0.7 });
  for (const dx of [-30, 30]) {
    const bench = new THREE.Mesh(new THREE.BoxGeometry(7, 0.5, 2), benchMat);
    bench.position.set(cx + dx, 2.6, 9);
    bench.castShadow = true;
    g.add(bench);
  }

  // Marker where the platform light-clock will be mounted by main.js
  const clockMount = new THREE.Object3D();
  clockMount.position.set(cx - 45, 1.8, 7.5);
  clockMount.name = 'clockMount';
  g.add(clockMount);

  return g;
}

export function buildPerson(coat = 0x555555, skin = 0xd9b38c) {
  const p = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.65, 2.1, 6, 12),
    new THREE.MeshStandardMaterial({ color: coat, roughness: 0.8 })
  );
  body.position.y = 1.8;
  body.castShadow = true;
  p.add(body);
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.55, 16, 16),
    new THREE.MeshStandardMaterial({ color: skin, roughness: 0.7 })
  );
  head.position.y = 3.6;
  head.castShadow = true;
  p.add(head);
  return p;
}

// ---------------------------------------------------------------------------
// Full periodic world group
// ---------------------------------------------------------------------------
export function buildWorldGroup() {
  const world = new THREE.Group();
  world.name = 'world';
  const centers = [];
  for (let i = 0; i < COPIES; i++) centers.push((i - (COPIES - 1) / 2) * PERIOD);

  for (const cx of centers) world.add(buildStation(cx));

  // Sleepers — instanced, every 4 units across the whole span
  const sleeperGeo = new THREE.BoxGeometry(1.1, 0.25, 4.6);
  const sleeperMat = new THREE.MeshStandardMaterial({ color: 0x3a2f26, roughness: 1 });
  const sleeperCount = Math.floor(SPAN / 4);
  const sleepers = new THREE.InstancedMesh(sleeperGeo, sleeperMat, sleeperCount);
  const m = new THREE.Matrix4();
  for (let i = 0; i < sleeperCount; i++) {
    m.setPosition(-SPAN / 2 + 2 + i * 4, 0.72, 0);
    sleepers.setMatrixAt(i, m);
  }
  sleepers.instanceMatrix.needsUpdate = true;
  world.add(sleepers);

  // Telegraph poles — the canonical contraction ruler, every 60 units, far side
  const poleGroupGeo = new THREE.CylinderGeometry(0.28, 0.34, 11, 8);
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x4c4033, roughness: 1 });
  const poleCount = Math.floor(SPAN / 60);
  const poles = new THREE.InstancedMesh(poleGroupGeo, poleMat, poleCount);
  const arms = new THREE.InstancedMesh(new THREE.BoxGeometry(0.3, 0.3, 4), poleMat, poleCount);
  for (let i = 0; i < poleCount; i++) {
    const x = -SPAN / 2 + 30 + i * 60;
    m.setPosition(x, 5.5, -9);
    poles.setMatrixAt(i, m);
    m.setPosition(x, 10.2, -9);
    arms.setMatrixAt(i, m);
  }
  poles.castShadow = arms.castShadow = true;
  world.add(poles, arms);

  // Trees — deterministic scatter on the far side
  const rand = mulberry32(1905); // annus mirabilis
  const treeCount = 40 * COPIES;
  const trunkGeo = new THREE.CylinderGeometry(0.4, 0.6, 4, 6);
  const crownGeo = new THREE.ConeGeometry(3.2, 9, 7);
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x4a3626, roughness: 1 });
  const crownMat = new THREE.MeshStandardMaterial({ color: 0x1e4a30, roughness: 1 });
  const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, treeCount);
  const crowns = new THREE.InstancedMesh(crownGeo, crownMat, treeCount);
  const s = new THREE.Vector3();
  const q = new THREE.Quaternion();
  const v = new THREE.Vector3();
  for (let i = 0; i < treeCount; i++) {
    const x = -SPAN / 2 + rand() * SPAN;
    const z = -18 - rand() * 55;
    const scale = 0.8 + rand() * 1.1;
    s.set(scale, scale, scale);
    v.set(x, 2 * scale, z);
    m.compose(v, q, s);
    trunks.setMatrixAt(i, m);
    v.set(x, (4 + 4.5) * scale, z);
    m.compose(v, q, s);
    crowns.setMatrixAt(i, m);
  }
  trunks.castShadow = crowns.castShadow = true;
  world.add(trunks, crowns);

  // Fence line between track and trees
  const fenceCount = Math.floor(SPAN / 12);
  const fence = new THREE.InstancedMesh(
    new THREE.BoxGeometry(0.25, 2.4, 0.25),
    new THREE.MeshStandardMaterial({ color: 0x5c5348, roughness: 1 }),
    fenceCount
  );
  for (let i = 0; i < fenceCount; i++) {
    m.setPosition(-SPAN / 2 + 6 + i * 12, 1.2, -14);
    fence.setMatrixAt(i, m);
  }
  world.add(fence);

  // Km chevron posts every 150 — extra motion/contraction rulers near track
  const postCount = Math.floor(SPAN / 150);
  const chevrons = new THREE.InstancedMesh(
    new THREE.BoxGeometry(0.5, 3.2, 0.14),
    new THREE.MeshStandardMaterial({ color: 0xd8d2c0, emissive: 0x38342a, roughness: 0.6 }),
    postCount
  );
  for (let i = 0; i < postCount; i++) {
    m.setPosition(-SPAN / 2 + 75 + i * 150, 1.6, 4.2);
    chevrons.setMatrixAt(i, m);
  }
  world.add(chevrons);

  // Tunnel (ladder-paradox prop) — one per tile so wrapping stays seamless,
  // hidden until the scenario turns it on. Doors are emissive planes.
  const tunnels = [];
  for (const cx of centers) {
    const t = buildTunnel();
    t.group.position.x = cx;
    world.add(t.group);
    tunnels.push(t);
  }

  const clockMounts = [];
  world.traverse((o) => { if (o.name === 'clockMount') clockMounts.push(o); });

  return { group: world, tunnels, clockMounts };
}

function buildTunnel() {
  const g = new THREE.Group();
  g.visible = false;
  const L = TUNNEL_PROPER_LENGTH;
  const wallMat = new THREE.MeshStandardMaterial({ color: 0x5a5f6e, roughness: 0.9 });

  // Arch: extruded ring segments — cheap version: two walls + curved roof
  for (const z of [-5.2, 5.2]) {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(L, 12, 1.4), wallMat);
    wall.position.set(0, 6, z);
    wall.castShadow = true;
    g.add(wall);
  }
  const roof = new THREE.Mesh(
    new THREE.CylinderGeometry(6.2, 6.2, L, 24, 1, true, 0, Math.PI),
    new THREE.MeshStandardMaterial({ color: 0x5a5f6e, roughness: 0.9, side: THREE.DoubleSide })
  );
  roof.rotation.z = Math.PI / 2;
  roof.rotation.y = Math.PI / 2;
  roof.position.y = 12;
  roof.castShadow = true;
  g.add(roof);

  const doorGeo = new THREE.PlaneGeometry(10.4, 15);
  const mkDoor = () => new THREE.Mesh(doorGeo, new THREE.MeshBasicMaterial({
    color: 0xff3355, transparent: true, opacity: 0, side: THREE.DoubleSide,
  }));
  const doorFront = mkDoor();
  doorFront.position.set(L / 2, 7.5, 0);
  doorFront.rotation.y = Math.PI / 2;
  const doorRear = mkDoor();
  doorRear.position.set(-L / 2, 7.5, 0);
  doorRear.rotation.y = Math.PI / 2;
  g.add(doorFront, doorRear);

  const label = makeTextPlane(`TUNNEL — proper length ${L} m`, 1.6, { color: '#ffd0d8' });
  label.position.set(0, 14.5, 6.5);
  g.add(label);

  return { group: g, doorFront, doorRear };
}
