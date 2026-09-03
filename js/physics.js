// physics.js — special relativity math, pure functions, no three.js deps.
// Scene convention: x is the direction of motion, β = v/c, c in scene units below.

export const C = 299792458;            // m/s, real speed of light
export const C_SCENE = 60;             // scene units per second — scaled c so light is watchable
export const TRAIN_PROPER_LENGTH = 80; // scene units, rest length of the train

export function gamma(beta) {
  return 1 / Math.sqrt(1 - beta * beta);
}

// Length of an object moving at β, as measured in the observer's frame.
export function contracted(properLength, beta) {
  return properLength / gamma(beta);
}

// Relativistic velocity addition (parallel velocities, in units of c).
export function addVelocity(u, v) {
  return (u + v) / (1 + u * v);
}

// Relativistic Doppler factor for light arriving from angle θ (in the observer's
// frame) relative to the direction of motion. cosTheta = +1 → dead ahead.
// Observed frequency = emitted × D. D > 1 blueshift, D < 1 redshift.
export function dopplerFactor(beta, cosTheta) {
  return 1 / (gamma(beta) * (1 - beta * cosTheta));
}

// Relativistic aberration: a ray at angle θ in the rest frame appears at θ'
// for an observer moving at β toward θ = 0. Returns cos θ'.
export function aberrate(cosTheta, beta) {
  return (cosTheta + beta) / (1 + beta * cosTheta);
}

// Headlight-effect intensity boost ∝ D^4 (bolometric); we expose D so callers
// can choose an exponent that looks good.
export function kmh(beta) {
  return beta * C * 3.6;
}

// Lorentz transform of an event (t, x) from the platform frame S to the train
// frame S' moving at +β. Times in scene seconds, x in scene units, c = C_SCENE.
export function lorentz(t, x, beta) {
  const g = gamma(beta);
  return {
    t: g * (t - (beta * x) / C_SCENE),
    x: g * (x - beta * C_SCENE * t),
  };
}

export function inverseLorentz(tp, xp, beta) {
  return lorentz(tp, xp, -beta);
}

// ---------------------------------------------------------------------------
// Lightning thought experiment.
// Setup (platform frame S): at t = 0 the train's midpoint passes the platform
// observer at x = 0, and lightning strikes both ends of the (contracted)
// train simultaneously — at x = ±L/2 where L = L0/γ.
// Returns every interesting event in both frames.
// ---------------------------------------------------------------------------
export function lightningEvents(beta, L0 = TRAIN_PROPER_LENGTH) {
  const g = gamma(beta);
  const L = L0 / g;              // train length in platform frame
  const c = C_SCENE;
  const v = beta * c;

  // Platform frame S ------------------------------------------------------
  const strikeFront_S = { t: 0, x: +L / 2 };
  const strikeRear_S  = { t: 0, x: -L / 2 };
  // Platform observer fixed at x = 0 receives both flashes together:
  const platformSees = L / (2 * c);
  // Train observer rides the midpoint, x = v t. Front flash travels −x:
  //   v t = L/2 − c t  →  t = L / (2(c+v))
  const trainSeesFront_S = L / (2 * (c + v));
  //   v t = −L/2 + c t →  t = L / (2(c−v))
  const trainSeesRear_S  = L / (2 * (c - v));

  // Train frame S' (via Lorentz) ------------------------------------------
  const strikeFront_T = lorentz(strikeFront_S.t, strikeFront_S.x, beta);
  const strikeRear_T  = lorentz(strikeRear_S.t,  strikeRear_S.x,  beta);
  // In S' the strikes land on the train's own ends at x' = ±L0/2 — sanity
  // handled in tests. Front strike happens EARLIER (t' < 0), rear later.

  return {
    beta, gamma: g, L, L0,
    S: {
      strikeFront: strikeFront_S,
      strikeRear: strikeRear_S,
      platformSeesBoth: platformSees,
      trainSeesFront: trainSeesFront_S,
      trainSeesRear: trainSeesRear_S,
    },
    T: {
      strikeFront: strikeFront_T,   // t' = −γβL0' ... < 0 (front fires first)
      strikeRear: strikeRear_T,     // t' > 0
      trainSeesFront: strikeFront_T.t + L0 / (2 * c),
      trainSeesRear:  strikeRear_T.t  + L0 / (2 * c),
    },
  };
}

// ---------------------------------------------------------------------------
// Tunnel (ladder) paradox geometry.
// Tunnel proper length chosen = L0/γref so at high β the train fits.
// Returns door-closing events in both frames for tunnel of proper length Lt.
// ---------------------------------------------------------------------------
export function tunnelEvents(beta, Lt, L0 = TRAIN_PROPER_LENGTH) {
  const g = gamma(beta);
  const c = C_SCENE;
  // Tunnel frame = platform frame S; doors at x = ±Lt/2 close at t = 0 when
  // the (contracted) train midpoint is centered. Train fits iff L0/γ ≤ Lt.
  const closeFront_S = { t: 0, x: +Lt / 2 };
  const closeRear_S  = { t: 0, x: -Lt / 2 };
  const closeFront_T = lorentz(0, +Lt / 2, beta); // front door closes FIRST in train frame? t' = −γβLt/2c < 0 — yes, earlier
  const closeRear_T  = lorentz(0, -Lt / 2, beta);
  return {
    fits_S: L0 / g <= Lt,
    contractedTrain: L0 / g,
    contractedTunnel: Lt / g,
    S: { closeFront: closeFront_S, closeRear: closeRear_S },
    T: { closeFront: closeFront_T, closeRear: closeRear_T },
  };
}

// Equivalence-principle bonus: clock rate ratio between front and back of a
// train with proper acceleration a (m/s²-equivalent in scene units) and
// proper length L: rate_front / rate_back ≈ 1 + aL/c².
export function accelClockRatio(a, L = TRAIN_PROPER_LENGTH) {
  return 1 + (a * L) / (C_SCENE * C_SCENE);
}

// ---------------------------------------------------------------------------
// Self-tests — run with `node js/physics.js`
// ---------------------------------------------------------------------------
const isNode = typeof process !== 'undefined' && process.argv?.[1]?.endsWith('physics.js');
if (isNode) {
  const close = (a, b, eps = 1e-9) => Math.abs(a - b) < eps;
  const assert = (name, ok) => {
    if (!ok) { console.error(`FAIL ${name}`); process.exitCode = 1; }
    else console.log(`ok   ${name}`);
  };

  assert('γ(0.866c) ≈ 2', close(gamma(0.8660254037844386), 2, 1e-9));
  assert('γ(0.99c) ≈ 7.0888', close(gamma(0.99), 7.088812050083354, 1e-9));
  assert('contraction 0.99c', close(contracted(80, 0.99), 80 / 7.088812050083354));
  assert('velocity addition 0.9+0.9 = 0.9945c', close(addVelocity(0.9, 0.9), 1.8 / 1.81));
  assert('doppler ahead 0.9c blueshift', close(dopplerFactor(0.9, 1), Math.sqrt((1 + 0.9) / (1 - 0.9))));
  assert('doppler behind 0.9c redshift', close(dopplerFactor(0.9, -1), Math.sqrt((1 - 0.9) / (1 + 0.9))));
  assert('aberration identity β=0', close(aberrate(0.5, 0), 0.5));

  // Lorentz round-trip
  const e = lorentz(1.23, 45.6, 0.8);
  const back = inverseLorentz(e.t, e.x, 0.8);
  assert('lorentz round trip', close(back.t, 1.23) && close(back.x, 45.6));

  // Lightning: strikes land on train ends in train frame
  const ev = lightningEvents(0.7);
  assert('lightning: front strike at x′=+L0/2', close(ev.T.strikeFront.x, +ev.L0 / 2, 1e-6));
  assert('lightning: rear strike at x′=−L0/2', close(ev.T.strikeRear.x, -ev.L0 / 2, 1e-6));
  assert('lightning: front strike earlier in train frame', ev.T.strikeFront.t < 0 && ev.T.strikeRear.t > 0);
  assert('lightning: train sees front before rear (S)', ev.S.trainSeesFront < ev.S.trainSeesRear);
  assert('lightning: platform sees both between train arrivals',
    ev.S.trainSeesFront < ev.S.platformSeesBoth && ev.S.platformSeesBoth < ev.S.trainSeesRear);
  // Arrival order agrees between frames (invariant fact)
  assert('lightning: front-first invariant across frames', ev.T.trainSeesFront < ev.T.trainSeesRear);

  // Tunnel
  const tu = tunnelEvents(0.9, 60);
  assert('tunnel: 80m train fits 60m tunnel at 0.9c (γ≈2.29)', tu.fits_S);
  assert('tunnel: front door closes first in train frame', tu.T.closeFront.t < tu.T.closeRear.t);

  console.log('physics self-tests done');
}
