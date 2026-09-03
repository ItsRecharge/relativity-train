// ui.js — DOM wiring for the control panel and readouts.
import { gamma, contracted, kmh, TRAIN_PROPER_LENGTH } from './physics.js';

const $ = (id) => document.getElementById(id);

const EXPLAIN = {
  platform: 'You watch the clock ride past. Its photon must chase the moving mirrors, ' +
    'tracing a longer <b>zigzag</b> path. Light always travels at c, so each tick takes ' +
    'longer: the riding clock runs slow by exactly 1/γ.',
  train: 'You ride beside the clock. In this frame it is at rest, so the photon bounces ' +
    '<b>straight up and down</b> while the world rushes by. Nothing here is unusual, and ' +
    'that is the point: your own clock always ticks normally.',
};

export function initUI(cb) {
  const slider = $('speedSlider');

  slider.addEventListener('input', () => cb.onBeta(parseFloat(slider.value) / 100));
  document.querySelectorAll('#presets button').forEach((b) =>
    b.addEventListener('click', () => {
      const beta = parseFloat(b.dataset.beta);
      slider.value = (beta * 100).toFixed(1);
      cb.onBeta(beta);
    })
  );

  $('btnPlatform').addEventListener('click', () => cb.onFrame('platform'));
  $('btnTrain').addEventListener('click', () => cb.onFrame('train'));
  $('btnPause').addEventListener('click', cb.onPause);
  $('btnReset').addEventListener('click', cb.onReset);

  return {
    setFrame(frame) {
      $('btnPlatform').classList.toggle('active', frame === 'platform');
      $('btnTrain').classList.toggle('active', frame === 'train');
      $('explain').innerHTML = EXPLAIN[frame];
    },

    setPaused(paused) {
      $('btnPause').textContent = paused ? 'Play' : 'Pause';
    },

    update({ beta, frame, tauPlatform, tauTrain, ticksTrain }) {
      const g = gamma(beta);
      $('betaValue').textContent = beta.toFixed(3);
      $('roGamma').textContent = g >= 10 ? g.toFixed(2) : g.toFixed(3);
      $('roSpeed').textContent = beta === 0 ? '0 km/h'
        : `${(kmh(beta) / 1e9).toFixed(3)} billion km/h`;
      if (frame === 'platform') {
        $('roLengthLabel').textContent = 'Train length here';
        $('roLength').textContent = `${contracted(TRAIN_PROPER_LENGTH, beta).toFixed(1)} m of ${TRAIN_PROPER_LENGTH} m`;
        $('roRateLabel').textContent = 'Train clock ticks at';
      } else {
        $('roLengthLabel').textContent = 'Platform lengths here';
        $('roLength').textContent = `shrunk to ${(100 / g).toFixed(1)}%`;
        $('roRateLabel').textContent = 'Platform clocks tick at';
      }
      $('roRate').textContent = `${(100 / g).toFixed(1)}%`;
      $('clockPlatform').textContent = `${tauPlatform.toFixed(2)} s`;
      $('clockTrain').textContent = `${tauTrain.toFixed(2)} s`;
      $('ticksTrain').textContent = `${ticksTrain} ticks`;
    },
  };
}
