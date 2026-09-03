# 🚄 Relativity Express

An interactive 3D simulation of Einstein's train thought experiment — special relativity
computed live from the Lorentz transform, viewable from **two reference frames**.

**Live:** https://itsrecharge.github.io/relativity-train/

## What it does

- **Two frames, one button** — stand on the platform with Bob (the train contracts,
  Alice's clock runs slow) or ride the train with Alice (the *world* contracts,
  Bob's clock runs slow). Both are correct; that's the point.
- **Speed slider 0–99.9 % of c** with live γ gauge, contracted length, time-dilation
  and Doppler readouts.
- **⚡ Lightning simultaneity** — the classic 1916 thought experiment, replayable from
  either frame. Wavefronts expand at c from points fixed in whichever frame you ride;
  strike times come straight from the Lorentz transform (front strike at
  t′ = −γβL₀/2c in the train frame).
- **🚇 Train-in-tunnel (ladder) paradox** — an 80 m train and a 60 m tunnel; doors
  close simultaneously only in the tunnel's frame.
- **⏱ Light-clock race** — two photon clocks, one on the platform, one on the roof;
  the moving one's photon zigzags and loses by exactly 1/γ.
- **🌀 Accelerating train** — the general-relativity doorway: equivalence principle,
  front clock outrunning the rear by 1 + aL/c².
- **Relativistic optics** (train view): Doppler colour shift, aberration, headlight
  beaming — implemented as a fullscreen GLSL pass.
- **Terrell–Penrose rotation** (platform view): what a camera *sees* vs what you
  *measure*, via per-vertex retarded-time solving.
- **Live Minkowski diagram** — tilting simultaneity lines, light cones, lightning
  events and receptions plotted in real time.

## Notes

- Scene light speed is scaled to 60 m/s so wavefronts are watchable; all ratios are exact.
- Pure static site: three.js (vendored) + vanilla ES modules, no build step.
- Physics self-tests: `node js/physics.js`.

Built with Claude Code.
