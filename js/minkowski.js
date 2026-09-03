// minkowski.js — live spacetime diagram (2D canvas). Chart drawn in the
// PLATFORM frame (x horizontal, ct vertical) with the train frame's tilted
// axes overlaid. The "now" line is horizontal when you ride the platform and
// tilted (a line of constant t′) when you ride the train — relativity of
// simultaneity as a moving picture.
import { C_SCENE, gamma, lightningEvents } from './physics.js';

export class MinkowskiDiagram {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.range = 150; // scene units shown each side of origin
  }

  resize() {
    const dpr = window.devicePixelRatio || 1;
    const rect = this.canvas.getBoundingClientRect();
    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.w = rect.width;
    this.h = rect.height;
  }

  // world (x, ct) → pixels
  px(x) { return this.w / 2 + (x / this.range) * (this.w / 2) * 0.92; }
  py(ct) { return this.h / 2 - (ct / this.range) * (this.h / 2) * 0.92; }

  line(x1, ct1, x2, ct2, color, width = 1, dash = null) {
    const c = this.ctx;
    c.save();
    if (dash) c.setLineDash(dash);
    c.strokeStyle = color;
    c.lineWidth = width;
    c.beginPath();
    c.moveTo(this.px(x1), this.py(ct1));
    c.lineTo(this.px(x2), this.py(ct2));
    c.stroke();
    c.restore();
  }

  dot(x, ct, color, r = 4, label = null, dx = 8, dy = -6) {
    const c = this.ctx;
    c.fillStyle = color;
    c.beginPath();
    c.arc(this.px(x), this.py(ct), r, 0, Math.PI * 2);
    c.fill();
    if (label) {
      c.fillStyle = color;
      c.font = '10px "SF Mono", Menlo, monospace';
      c.fillText(label, this.px(x) + dx, this.py(ct) + dy);
    }
  }

  update({ beta, frame, simTime, scenarioType }) {
    if (!this.w) this.resize();
    const c = this.ctx;
    const R = this.range;
    c.clearRect(0, 0, this.w, this.h);

    // faint grid
    c.strokeStyle = 'rgba(120,140,200,0.08)';
    c.lineWidth = 1;
    for (let u = -R; u <= R; u += 30) {
      this.line(u, -R, u, R, 'rgba(120,140,200,0.08)');
      this.line(-R, u, R, u, 'rgba(120,140,200,0.08)');
    }

    // light cone
    this.line(-R, -R, R, R, 'rgba(255,210,110,0.5)', 1.5, [5, 4]);
    this.line(-R, R, R, -R, 'rgba(255,210,110,0.5)', 1.5, [5, 4]);

    // platform axes (Bob)
    this.line(-R, 0, R, 0, 'rgba(159,208,255,0.9)', 1.5);
    this.line(0, -R, 0, R, 'rgba(159,208,255,0.9)', 1.5);
    c.fillStyle = 'rgba(159,208,255,0.95)';
    c.font = '11px "SF Mono", Menlo, monospace';
    c.fillText('x', this.px(R) - 14, this.py(0) - 6);
    c.fillText('ct  (BOB)', this.px(0) + 6, this.py(R) + 12);

    // train axes (Alice): ct′ along x = β·ct ; x′ along ct = β·x
    if (beta > 0.001) {
      this.line(-R * beta, -R, R * beta, R, 'rgba(255,150,120,0.9)', 1.5);
      this.line(-R, -R * beta, R, R * beta, 'rgba(255,150,120,0.9)', 1.5);
      c.fillStyle = 'rgba(255,160,130,0.95)';
      c.fillText("ct′ (ALICE)", this.px(R * beta) - 66, this.py(R) + 22);
      c.fillText("x′", this.px(R) - 18, this.py(R * beta) - 6);
    }

    // "now" line for whichever frame is being ridden
    const g = gamma(beta);
    if (frame === 'platform') {
      const ct = C_SCENE * simTime;
      if (Math.abs(ct) <= R) {
        this.line(-R, ct, R, ct, 'rgba(120,255,190,0.85)', 2);
        c.fillStyle = 'rgba(120,255,190,0.95)';
        c.fillText('now (platform)', this.px(-R) + 6, this.py(ct) - 5);
      }
    } else {
      // t′ = simTime → ct = β x + c t′ / γ
      const ct0 = (C_SCENE * simTime) / g;
      this.line(-R, beta * -R + ct0, R, beta * R + ct0, 'rgba(120,255,190,0.85)', 2);
      c.fillStyle = 'rgba(120,255,190,0.95)';
      c.fillText("now (train, t′)", this.px(-R) + 6, this.py(beta * -R + ct0) - 5);
    }

    // worldlines: Bob vertical at x=0 (already the ct axis); Alice x = β ct
    // (drawn as the ct′ axis). Add lightning geometry when relevant.
    if (scenarioType === 'lightning' && beta > 0.001) {
      const ev = lightningEvents(beta);
      const L = ev.L;
      // strikes (platform frame: t=0, x=±L/2)
      this.dot(+L / 2, 0, '#ffc861', 5, '⚡ front');
      this.dot(-L / 2, 0, '#61d4ff', 5, '⚡ rear', -46);
      // photon worldlines (45°) toward both observers
      this.line(L / 2, 0, L / 2 - R, R - 0 * 1, 'rgba(255,200,97,0.7)', 1.2, [3, 3]);
      this.line(L / 2, 0, L / 2 + R, R, 'rgba(255,200,97,0.25)', 1, [3, 3]);
      this.line(-L / 2, 0, -L / 2 + R, R, 'rgba(97,212,255,0.7)', 1.2, [3, 3]);
      this.line(-L / 2, 0, -L / 2 - R, R, 'rgba(97,212,255,0.25)', 1, [3, 3]);
      // receptions
      const ctBob = C_SCENE * ev.S.platformSeesBoth;
      this.dot(0, ctBob, '#ffffff', 4, 'Bob: both');
      const ctA1 = C_SCENE * ev.S.trainSeesFront;
      const ctA2 = C_SCENE * ev.S.trainSeesRear;
      this.dot(beta * ctA1, ctA1, '#ffc861', 4, 'Alice: front', 8, 10);
      this.dot(beta * ctA2, ctA2, '#61d4ff', 4, 'Alice: rear');
      // train-frame simultaneity lines through the strikes (slope β)
      this.line(-R, beta * (-R - L / 2), R, beta * (R - L / 2), 'rgba(255,150,120,0.35)', 1, [2, 4]);
      this.line(-R, beta * (-R + L / 2), R, beta * (R + L / 2), 'rgba(255,150,120,0.35)', 1, [2, 4]);
    }

    // corner readout
    c.fillStyle = 'rgba(220,228,255,0.8)';
    c.font = '10px "SF Mono", Menlo, monospace';
    c.fillText(`β=${beta.toFixed(3)}  γ=${g.toFixed(3)}`, 8, 14);
  }
}
