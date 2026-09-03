# Relativity Express

An interactive 3D demonstration of Einstein's light clock, viewable from two
reference frames. Special relativity computed live from the Lorentz transform.

**Live:** https://itsrecharge.github.io/relativity-train/

## The demonstration

A light clock rides on the train's roof: one photon bouncing between two mirrors,
one tick per round trip.

- **On the train** you sit in the clock's rest frame. The photon bounces straight
  up and down while the contracted world streams past. Your clock is normal.
- **Platform view** shows the same photon chasing the moving mirrors along a longer
  zigzag path. Light always travels at c, so each tick takes longer: the riding
  clock runs slow by exactly 1/gamma.

The photon's trail is drawn in world space, so the straight-line vs zigzag
difference is visible directly. A speed slider (0 to 99.9% of c) drives gamma,
length contraction, and the elapsed-time readouts.

## Notes

- Scene light speed is scaled to 60 m/s so the photon is watchable; all ratios are exact.
- Pure static site: three.js (vendored) + vanilla ES modules, no build step.
- Physics self-tests: `node js/physics.js`.

Built with Claude Code.
