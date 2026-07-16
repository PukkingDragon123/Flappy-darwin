// Synthesized retro sound effects via WebAudio — no audio assets required.
(function () {
  let ctx = null;
  let master = null;
  let muted = false;

  function ensure() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume();
    return true;
  }

  function tone(freq, dur, type, vol, slideTo, delay) {
    if (muted || !ensure()) return;
    const t0 = ctx.currentTime + (delay || 0);
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type || 'square';
    o.frequency.setValueAtTime(freq, t0);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(30, slideTo), t0 + dur);
    g.gain.setValueAtTime(vol || 0.2, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    o.connect(g); g.connect(master);
    o.start(t0); o.stop(t0 + dur + 0.02);
  }

  function noise(dur, vol, freq, delay) {
    if (muted || !ensure()) return;
    const t0 = ctx.currentTime + (delay || 0);
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(freq || 1200, t0);
    f.frequency.exponentialRampToValueAtTime(200, t0 + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol || 0.25, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    src.connect(f); f.connect(g); g.connect(master);
    src.start(t0);
  }

  const SFX = {
    flap: function () { noise(0.09, 0.16, 900); tone(300, 0.06, 'triangle', 0.08, 180); },
    catch: function () { tone(880, 0.07, 'square', 0.16, 1320); },
    gulp: function () { tone(420, 0.12, 'sine', 0.22, 130); tone(180, 0.1, 'sine', 0.15, 90, 0.08); },
    denied: function () { tone(200, 0.08, 'square', 0.12, 160); },
    stuffed: function () { tone(220, 0.18, 'sawtooth', 0.12, 90); },
    hit: function () { noise(0.22, 0.35, 700); tone(150, 0.22, 'sawtooth', 0.22, 55); },
    splash: function () { noise(0.4, 0.3, 500); },
    shield: function () { tone(700, 0.15, 'triangle', 0.2, 250); },
    point: function () { tone(660, 0.05, 'square', 0.08, 720); },
    rustle: function () { noise(0.07, 0.09, 2600); },
    whoosh: function () { noise(0.16, 0.11, 1600, 0); tone(520, 0.14, 'sine', 0.05, 1100); },
    pop: function () { tone(760, 0.05, 'triangle', 0.14, 1200); },
    chirp: function () { tone(1500, 0.05, 'sine', 0.12, 2100); tone(1900, 0.05, 'sine', 0.1, null, 0.05); },
    flare: function () { noise(0.18, 0.1, 900); },
    arrive: function () { [660, 880, 1100].forEach(function (f, i) { tone(f, 0.1, 'triangle', 0.12, null, i * 0.07); }); },
    snakeHiss: function () { noise(0.35, 0.13, 3200); },
    snakeStrike: function () { tone(340, 0.1, 'sawtooth', 0.2, 90); noise(0.08, 0.14, 1400, 0.02); },
    snakeWhiff: function () { noise(0.14, 0.09, 2000); },
    chomp: function () { tone(160, 0.12, 'square', 0.24, 60); noise(0.1, 0.2, 700); },
    snapperRise: function () { noise(0.4, 0.14, 600); tone(120, 0.3, 'sine', 0.1, 220); },
    snapperMiss: function () { noise(0.3, 0.2, 500); },
    hawkScreech: function () { tone(1400, 0.18, 'sawtooth', 0.14, 900); tone(1100, 0.16, 'sawtooth', 0.1, 700, 0.12); },
    hawkWhoosh: function () { noise(0.22, 0.2, 1800); tone(300, 0.2, 'sine', 0.06, 120); },
    evolve: function () {
      [523, 659, 784, 1047, 1319].forEach(function (f, i) {
        tone(f, 0.16, 'square', 0.14, null, i * 0.09);
      });
    },
    evoReady: function () { tone(523, 0.08, 'square', 0.12, 659); tone(784, 0.1, 'square', 0.12, null, 0.09); },
    select: function () { tone(500, 0.05, 'square', 0.1, 620); },
    confirm: function () { tone(620, 0.07, 'square', 0.12, 830); tone(930, 0.09, 'square', 0.1, null, 0.06); },
    heart: function () { tone(700, 0.1, 'triangle', 0.16, 900); tone(1100, 0.14, 'triangle', 0.14, null, 0.09); },
    land: function () { noise(0.12, 0.14, 600); tone(240, 0.09, 'triangle', 0.1, 180); },
    wind: function () { noise(0.8, 0.12, 400); },
    die: function () {
      tone(400, 0.5, 'sawtooth', 0.2, 60);
      noise(0.5, 0.2, 900, 0.05);
    },
    slash: function () { noise(0.09, 0.16, 2400); tone(700, 0.07, 'triangle', 0.08, 260); },
    zap: function () { tone(1800, 0.12, 'sawtooth', 0.16, 200); noise(0.1, 0.12, 3200, 0.02); },
    beam: function () { tone(880, 0.3, 'sawtooth', 0.08, 1320); tone(440, 0.3, 'sine', 0.1, 660); },
    kill: function () { tone(520, 0.06, 'square', 0.14, 780); tone(1040, 0.08, 'triangle', 0.12, null, 0.05); },
    petJoin: function () { [880, 1100, 1320].forEach(function (f, i) { tone(f, 0.09, 'sine', 0.12, null, i * 0.06); }); },
  };

  window.AUDIO = {
    play: function (name) { if (SFX[name]) SFX[name](); },
    toggleMute: function () { muted = !muted; return muted; },
    isMuted: function () { return muted; },
    unlock: ensure,
  };
})();
