// ui.js — DOM wiring for the control panel, readouts, log, toast, help.
import { gamma, contracted, dopplerFactor, kmh, TRAIN_PROPER_LENGTH } from './physics.js';

const $ = (id) => document.getElementById(id);

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

  document.querySelectorAll('.scen').forEach((b) =>
    b.addEventListener('click', () => cb.onScenario(b.dataset.scenario))
  );

  for (const [id, key] of [
    ['optDoppler', 'doppler'], ['optAberration', 'aberration'],
    ['optHeadlight', 'headlight'], ['optTerrell', 'terrell'],
  ]) {
    $(id).addEventListener('change', (e) => cb.onOptic(key, e.target.checked));
  }

  $('btnPause').addEventListener('click', cb.onPause);
  $('btnSlow').addEventListener('click', cb.onSlow);
  $('btnResetClocks').addEventListener('click', cb.onResetClocks);
  $('btnHelp').addEventListener('click', () => $('help').classList.toggle('hidden'));
  $('btnCloseHelp').addEventListener('click', () => $('help').classList.add('hidden'));
  $('help').addEventListener('click', (e) => { if (e.target.id === 'help') $('help').classList.add('hidden'); });
  $('btnMink').addEventListener('click', () => {
    const p = $('minkowskiPanel');
    p.classList.toggle('collapsed');
    $('btnMink').textContent = p.classList.contains('collapsed') ? 'show' : 'hide';
  });

  let toastTimer = null;

  const api = {
    setFrameButtons(frame) {
      $('btnPlatform').classList.toggle('active', frame === 'platform');
      $('btnTrain').classList.toggle('active', frame === 'train');
    },

    setScenarioButtons(name) {
      document.querySelectorAll('.scen').forEach((b) =>
        b.classList.toggle('active', b.dataset.scenario === name));
    },

    setPaused(paused) {
      $('btnPause').textContent = paused ? '▶ play' : '⏸ pause';
      $('btnPause').classList.toggle('on', paused);
    },

    setSlow(on) {
      $('btnSlow').classList.toggle('on', on);
    },

    setSliderFromBeta(beta) {
      slider.value = (beta * 100).toFixed(1);
    },

    updateReadouts({ beta, tauBob, tauAlice, ticksBob, ticksAlice }) {
      const g = gamma(beta);
      $('betaValue').textContent = beta.toFixed(3);
      $('gammaValue').textContent = `γ = ${g >= 10 ? g.toFixed(2) : g.toFixed(3)}`;
      // gauge: log scale, γ 1 → 22.4
      const frac = Math.min(1, Math.log(g) / Math.log(22.4));
      const arc = document.getElementById('gaugeArc');
      const len = arc.getTotalLength();
      arc.style.strokeDasharray = `${len}`;
      arc.style.strokeDashoffset = `${len * (1 - frac)}`;

      const speed = kmh(beta);
      $('roSpeed').textContent = beta === 0 ? '0 km/h'
        : `${(speed / 1e9).toFixed(3)}×10⁹ km/h`;
      $('roLength').textContent = `${contracted(TRAIN_PROPER_LENGTH, beta).toFixed(2)} m of ${TRAIN_PROPER_LENGTH} m`;
      $('roDilation').textContent = `${(100 / g).toFixed(1)} % speed`;
      $('roDoppler').textContent = `×${dopplerFactor(beta, 1).toFixed(2)} freq`;

      $('clockBob').textContent = `${tauBob.toFixed(2)} s`;
      $('clockAlice').textContent = `${tauAlice.toFixed(2)} s`;
      $('ticksBob').textContent = `${ticksBob} ticks`;
      $('ticksAlice').textContent = `${ticksAlice} ticks`;
    },

    log(kind, msg) {
      const el = document.createElement('div');
      el.className = `logentry ${kind}`;
      el.textContent = msg;
      const box = $('eventlog');
      box.prepend(el);
      while (box.children.length > 40) box.lastChild.remove();
    },

    toast(msg) {
      const t = $('toast');
      t.textContent = msg;
      t.classList.add('show');
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => t.classList.remove('show'), 3400);
    },

    showAccelCard(show) {
      $('accelCard').classList.toggle('hidden', !show);
    },

    updateAccelClocks(front, rear, status) {
      $('clockFront').textContent = `${front.toFixed(3)} s`;
      $('clockRear').textContent = `${rear.toFixed(3)} s`;
      if (status) $('accelStatus').textContent = status;
    },

    toggleHelp() { $('help').classList.toggle('hidden'); },

    setOptic(key, val) {
      const map = { doppler: 'optDoppler', aberration: 'optAberration', headlight: 'optHeadlight', terrell: 'optTerrell' };
      $(map[key]).checked = val;
    },
  };

  return api;
}
