// Sound: everything synthesized in WebAudio, no files — a two-stroke engine hum that follows
// the throttle, wind that follows the speed, and small bright cues for the moments that
// matter (a ring chime, a splash, a thud, the delivery jingle). Starts on the first gesture,
// because browsers insist, and stays silent in screenshot scenes.

export function createSound() {
  let ctx = null;
  let engineOsc = null;
  let engineGain = null;
  let windGain = null;
  let started = false;

  function start() {
    if (started) return;
    started = true;
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 420;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      engineOsc.connect(filter).connect(engineGain).connect(ctx.destination);
      engineOsc.start();

      const noise = ctx.createBufferSource();
      noise.buffer = noiseBuffer(ctx);
      noise.loop = true;
      const windFilter = ctx.createBiquadFilter();
      windFilter.type = 'bandpass';
      windFilter.frequency.value = 700;
      windGain = ctx.createGain();
      windGain.gain.value = 0;
      noise.connect(windFilter).connect(windGain).connect(ctx.destination);
      noise.start();
    } catch {
      ctx = null; // no audio device: the game flies on in silence
    }
  }

  function tone(freq, at, dur, type = 'sine', vol = 0.16) {
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    const t0 = ctx.currentTime + at;
    gain.gain.setValueAtTime(0, t0);
    gain.gain.linearRampToValueAtTime(vol, t0 + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  return {
    start,
    /** Called every frame with the plane's state; keeps engine and wind honest. */
    update(throttle, speed) {
      if (!ctx || !engineOsc) return;
      const t = ctx.currentTime;
      engineOsc.frequency.setTargetAtTime(52 + throttle * 68, t, 0.08);
      engineGain.gain.setTargetAtTime(0.015 + throttle * 0.05, t, 0.1);
      windGain.gain.setTargetAtTime(Math.min(0.11, speed * 0.0016), t, 0.15);
    },
    chime() {
      tone(1318, 0, 0.35);
      tone(1760, 0.07, 0.45);
    },
    splash() {
      tone(180, 0, 0.4, 'triangle', 0.2);
      tone(120, 0.05, 0.5, 'sine', 0.18);
    },
    thud() {
      tone(70, 0, 0.35, 'square', 0.22);
      tone(48, 0.03, 0.45, 'sine', 0.24);
    },
    jingle() {
      tone(784, 0, 0.22);
      tone(988, 0.11, 0.22);
      tone(1175, 0.22, 0.4);
    },
  };
}

function noiseBuffer(ctx) {
  const buffer = ctx.createBuffer(1, ctx.sampleRate * 1.5, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
  return buffer;
}
