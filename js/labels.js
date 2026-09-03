// labels.js — canvas-texture text helpers shared by world/train builders.
import * as THREE from 'three';

// Returns a THREE.CanvasTexture of text on a transparent (or colored) panel.
export function makeTextTexture(text, {
  font = 'bold 96px "Helvetica Neue", Arial, sans-serif',
  color = '#ffffff',
  bg = null,
  padX = 40,
  padY = 24,
} = {}) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  ctx.font = font;
  const w = Math.ceil(ctx.measureText(text).width) + padX * 2;
  const h = Math.ceil(parseInt(font.match(/(\d+)px/)[1], 10) * 1.4) + padY * 2;
  canvas.width = w;
  canvas.height = h;
  if (bg) {
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);
  }
  ctx.font = font;
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, w / 2, h / 2);
  const tex = new THREE.CanvasTexture(canvas);
  tex.anisotropy = 4;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.userData = { aspect: w / h };
  return tex;
}

// Double-sided unlit text plane, sized by height in world units.
export function makeTextPlane(text, height, opts = {}) {
  const tex = makeTextTexture(text, opts);
  const mat = new THREE.MeshBasicMaterial({
    map: tex,
    transparent: !opts.bg,
    side: THREE.DoubleSide,
  });
  const geo = new THREE.PlaneGeometry(height * tex.userData.aspect, height);
  return new THREE.Mesh(geo, mat);
}
