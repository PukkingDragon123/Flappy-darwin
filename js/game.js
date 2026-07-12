// Flappy Darwin — a pixel-art roguelike about flapping, feasting and evolving.
(function () {
  'use strict';

  const W = 320, H = 180, SEA_Y = 166, BIRD_X = 70;
  const cv = document.getElementById('game');
  const ctx = cv.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  const drawText = FONT.drawText, drawTextShadow = FONT.drawTextShadow;

  // ---------- display scaling ----------
  function fit() {
    const s = Math.min(window.innerWidth / W, window.innerHeight / H);
    const scale = s >= 1 ? Math.floor(s) : s;
    cv.style.width = (W * scale) + 'px';
    cv.style.height = (H * scale) + 'px';
  }
  window.addEventListener('resize', fit);
  fit();

  // ---------- helpers ----------
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function hexToRgb(h) {
    return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  }
  function mixColor(h1, h2, t) {
    const a = hexToRgb(h1), b = hexToRgb(h2);
    let out = '#';
    for (let i = 0; i < 3; i++) {
      out += ('0' + Math.round(lerp(a[i], b[i], t)).toString(16)).slice(-2);
    }
    return out;
  }
  // deterministic per-obstacle detail rng
  function orand(seed, i) {
    let x = (seed * 374761393 + i * 668265263) >>> 0;
    x = ((x ^ (x >>> 13)) * 1274126177) >>> 0;
    return (x >>> 8) / 16777216;
  }
  function rnd(a, b) { return a + Math.random() * (b - a); }
  function irnd(a, b) { return Math.floor(rnd(a, b + 1)); }
  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
  function pickWeighted(entries) { // [{v, w}]
    let total = 0;
    for (const e of entries) total += e.w;
    let roll = Math.random() * total;
    for (const e of entries) { roll -= e.w; if (roll <= 0) return e.v; }
    return entries[entries.length - 1].v;
  }

  // ---------- data ----------
  const FOODS = {
    berry: { spr: SPR.BERRY, nutr: 12, digest: 1.6, r: 3, name: 'BERRY' },
    seed:  { spr: SPR.SEED,  nutr: 7,  digest: 1.0, r: 2, name: 'SEED' },
    nut:   { spr: SPR.NUT,   nutr: 24, digest: 3.6, r: 3, name: 'NUT' },
    bug:   { spr: SPR.BUG1,  nutr: 9,  digest: 0.7, r: 3, name: 'BUG', moves: true },
    gold:  { spr: SPR.GOLD,  nutr: 45, digest: 4.5, r: 3, name: 'GOLDEN FRUIT', sparkle: true },
  };

  const BIOMES = {
    meadow: {
      name: 'MEADOW ISLES', danger: 1, obst: 'tree', gapBase: 50, icon: SPR.ICON_MEADOW,
      foods: { berry: 5, seed: 3, bug: 1, nut: 0.5, gold: 0.15 },
      hint: ['BERRIES +', 'GENTLE TREES'], deco: '#e0525c',
      foodIcons: ['berry', 'seed'],
    },
    grove: {
      name: 'OAKNUT GROVE', danger: 2, obst: 'tree', gapBase: 44, dense: true, icon: SPR.ICON_GROVE,
      foods: { nut: 5, seed: 2, berry: 1, gold: 0.2 },
      hint: ['HEARTY NUTS', 'DENSE TREES'], deco: '#a76f3e',
      foodIcons: ['nut', 'seed'],
    },
    marsh: {
      name: 'BUZZING MARSH', danger: 2, obst: 'branch', gapBase: 47, icon: SPR.ICON_MARSH,
      foods: { bug: 6, berry: 1.5, seed: 1, gold: 0.2 },
      hint: ['QUICK BUGS', 'TANGLED BOUGHS'], deco: '#5cad3c',
      foodIcons: ['bug', 'berry'],
    },
    crags: {
      name: 'STORM CRAGS', danger: 3, obst: 'rock', gapBase: 46, wind: true, icon: SPR.ICON_CRAGS,
      foods: { seed: 2, nut: 2, berry: 2, gold: 0.7 },
      hint: ['RICH PICKINGS', 'WILD GUSTS'], deco: '#9aa2b5',
      foodIcons: ['gold', 'nut'],
    },
  };
  const BIOME_KEYS = Object.keys(BIOMES);

  const MUTATIONS = [
    { id: 'wings',   name: 'MIGHTY WINGS',   desc: 'FLAP 25% STRONGER',            diet: 'berry', icon: SPR.WING_UP },
    { id: 'hollow',  name: 'HOLLOW BONES',   desc: 'FALL 18% SLOWER',              diet: 'berry', icon: SPR.FEATHER },
    { id: 'rudder',  name: 'TAIL RUDDER',    desc: 'DIVE SPEED CAPPED -30%',       diet: 'berry', icon: SPR.TAIL_BIG },
    { id: 'glide',   name: 'GLIDER WING',    desc: 'HOLD FLAP TO GLIDE',           diet: 'berry', icon: SPR.CLOUD3 },
    { id: 'beak',    name: 'WIDE BEAK',      desc: 'BIGGER CATCH RANGE',           diet: 'nut',   icon: SPR.BEAK_B },
    { id: 'gut',     name: 'RAPID GUT',      desc: 'DIGEST 35% FASTER',            diet: 'bug',   icon: SPR.SEED },
    { id: 'crop',    name: 'CROP POUCH',     desc: 'STASH A SECOND FOOD',          diet: 'nut',   icon: SPR.NUT },
    { id: 'gizzard', name: 'IRON GIZZARD',   desc: 'NUTS DIGEST FAST +25% VALUE',  diet: 'nut',   icon: SPR.NUT },
    { id: 'downy',   name: 'DOWNY PLUME',    desc: '+1 HEART, FULLY MENDED',       diet: 'any',   icon: SPR.HEART, repeat: true },
    { id: 'sweet',   name: 'SWEET TOOTH',    desc: 'BERRIES +50% VALUE',           diet: 'berry', icon: SPR.BERRY },
    { id: 'snatch',  name: 'BUG SNATCHER',   desc: 'BUGS DRIFT TO YOUR BEAK',      diet: 'bug',   icon: SPR.BUG1 },
    { id: 'shield',  name: 'FEATHER SHIELD', desc: 'BLOCK FIRST HIT EACH FLIGHT',  diet: 'any',   icon: SPR.HEART_EMPTY },
    { id: 'stomach', name: 'SECOND STOMACH', desc: 'OVERFULL LIMIT +40%',          diet: 'nut',   icon: SPR.TUMMY },
  ];

  const DEATHS = {
    tree: 'SPLINTERED ON AN ANCIENT TREE',
    branch: 'TANGLED IN THE MARSH BOUGHS',
    rock: 'DASHED AGAINST THE STORM CRAGS',
    water: 'THE HUNGRY SEA CLAIMED DARWIN',
  };

  // ---------- persistent best ----------
  function loadBest() {
    try { return JSON.parse(localStorage.getItem('flappyDarwinBest')) || { score: 0, depth: 0, evos: 0 }; }
    catch (e) { return { score: 0, depth: 0, evos: 0 }; }
  }
  function saveBest(b) {
    try { localStorage.setItem('flappyDarwinBest', JSON.stringify(b)); } catch (e) { /* private mode */ }
  }
  let best = loadBest();

  // ---------- game state ----------
  let STATE = 'title'; // title | fly | island | over
  let paused = false;
  let time = 0;
  let freezeT = 0;
  const shake = { t: 0, mag: 0 };

  let run = null;   // per-run data
  let bird = null;
  let world = null; // per-leg data
  let ui = {};      // island/menu ui state
  let parts = [];   // particles
  let floats = [];  // floating texts
  let newBestFlag = false;

  function newRun() {
    run = {
      depth: 0,
      score: 0,
      evo: 0, evoNeed: 60, evolutions: 0,
      taken: [],                       // mutation ids
      diet: { berry: 0, seed: 0, nut: 0, bug: 0, gold: 0 },
      foodEaten: 0, obstaclesPassed: 0,
      evoReadyPinged: false,
      tut: { flap: true, catch: true, digest: true },
    };
    bird = {
      x: BIRD_X, y: 84, vy: 0, rot: 0,
      hearts: 3, maxHearts: 3, invuln: 0,
      carried: null, crop: null, digestT: 0, digestNeed: 0,
      fullness: 0, stuffed: false,
      flapT: 0, animT: 0, blinkT: rnd(1.5, 4), blinking: 0, openT: 0,
      glideHeld: false, shieldUp: false, dead: false, deathBy: null,
    };
    newBestFlag = false;
    parts = []; floats = [];
    newLeg('meadow');
  }

  function has(id) { return run.taken.indexOf(id) !== -1; }

  function stats() {
    let flap = -167, grav = 620, maxFall = 240, catchR = 6, digestMul = 1, cap = 70;
    if (has('wings')) flap *= 1.25;
    if (has('hollow')) grav *= 0.82;
    if (has('rudder')) maxFall *= 0.7;
    if (has('beak')) catchR += 3;
    if (has('gut')) digestMul *= 0.65;
    if (has('stomach')) cap *= 1.4;
    if (bird.stuffed) { flap *= 0.82; grav *= 1.28; }
    return {
      flap: flap, grav: grav, maxFall: maxFall, catchR: catchR, digestMul: digestMul,
      cap: cap, glide: has('glide'), cropSlots: has('crop') ? 1 : 0,
    };
  }

  function newLeg(biomeKey) {
    run.depth++;
    const d = run.depth;
    const biome = BIOMES[biomeKey];
    world = {
      biomeKey: biomeKey, biome: biome,
      dist: 0,
      speed: Math.min(92, 55 + (d - 1) * 3.5),
      spacing: Math.max(80, (biome.dense ? 96 : 106) - d * 2),
      gapH: Math.max(34, biome.gapBase - d * 1.2),
      legLen: Math.min(22, 7 + d * 2),
      spawned: 0, nextSpawnX: W + 50,
      obstacles: [], foods: [],
      phase: 'fly', island: null, landT: 0,
      banner: 2.4, fade: 1,
      gust: null, gustTimer: biome.wind ? rnd(2.5, 4.5) : -1,
      legDiet: { berry: 0, seed: 0, nut: 0, bug: 0, gold: 0 },
    };
    bird.x = BIRD_X; bird.y = 84; bird.vy = 0; bird.rot = 0; bird.dead = false;
    bird.shieldUp = has('shield');
    STATE = 'fly';
  }

  // ---------- input ----------
  let flapQueued = false;
  let actionQueued = false;

  function press() {
    AUDIO.unlock();
    if (STATE === 'title') { AUDIO.play('confirm'); newRun(); return; }
    if (STATE === 'over') { if (ui.overT > 0.7) { AUDIO.play('confirm'); STATE = 'title'; } return; }
    if (paused) { paused = false; return; }
    if (STATE === 'fly') {
      if (world.phase === 'fly' || world.phase === 'approach') flapQueued = true;
      return;
    }
    if (STATE === 'island') actionQueued = true;
  }

  window.addEventListener('keydown', function (e) {
    if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') {
      e.preventDefault();
      if (!e.repeat) { press(); bird && (bird.glideHeld = true); }
      return;
    }
    if (e.code === 'KeyM') { AUDIO.toggleMute(); return; }
    if (e.code === 'KeyP' && (STATE === 'fly' || STATE === 'island')) { paused = !paused; return; }
    if (e.code === 'KeyR' && (STATE === 'over' || STATE === 'fly' || STATE === 'island')) {
      AUDIO.play('confirm'); STATE = 'title'; return;
    }
    if (STATE === 'island' && ui.cards) {
      if (e.code === 'ArrowLeft' || e.code === 'KeyA') { ui.sel = (ui.sel + ui.cards.length - 1) % ui.cards.length; AUDIO.play('select'); }
      if (e.code === 'ArrowRight' || e.code === 'KeyD') { ui.sel = (ui.sel + 1) % ui.cards.length; AUDIO.play('select'); }
      if (e.code === 'Enter') actionQueued = true;
    } else if (e.code === 'Enter') {
      if (!e.repeat) press();
    }
  });
  window.addEventListener('keyup', function (e) {
    if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') bird && (bird.glideHeld = false);
  });

  cv.addEventListener('pointerdown', function (e) {
    e.preventDefault();
    const r = cv.getBoundingClientRect();
    const gx = (e.clientX - r.left) / r.width * W;
    const gy = (e.clientY - r.top) / r.height * H;
    AUDIO.unlock();
    if (STATE === 'island' && ui.cards && ui.cardRects) {
      for (let i = 0; i < ui.cardRects.length; i++) {
        const c = ui.cardRects[i];
        if (gx >= c.x && gx <= c.x + c.w && gy >= c.y && gy <= c.y + c.h) {
          if (ui.sel === i) { actionQueued = true; }
          else { ui.sel = i; AUDIO.play('select'); }
          return;
        }
      }
      return; // tap outside the cards does nothing
    }
    press();
    if (bird) bird.glideHeld = true;
  });
  window.addEventListener('pointerup', function () { if (bird) bird.glideHeld = false; });

  // ---------- particles / floats ----------
  function spawnParts(n, fn) { for (let i = 0; i < n; i++) parts.push(fn(i)); }
  function feather(x, y) {
    return { type: 'feather', x: x, y: y, vx: rnd(-25, -5), vy: rnd(-20, 10), g: 26, t: 0, life: rnd(0.5, 1.1), color: pick(['#e98b3f', '#f7ab5e', '#fbe7bb']) };
  }
  function crumb(x, y, color) {
    return { type: 'crumb', x: x, y: y, vx: rnd(-20, 25), vy: rnd(-45, -10), g: 130, t: 0, life: rnd(0.4, 0.8), color: color };
  }
  function sparkle(x, y, color) {
    return { type: 'sparkle', x: x, y: y, vx: rnd(-8, 8), vy: rnd(-14, 2), g: 0, t: 0, life: rnd(0.4, 0.9), color: color || '#fff3a8' };
  }
  function puff(x, y) {
    return { type: 'puff', x: x, y: y, vx: rnd(-30, -12), vy: rnd(-6, 6), g: -8, t: 0, life: rnd(0.25, 0.5), color: 'rgba(255,255,255,0.85)' };
  }
  function splashP(x, y) {
    return { type: 'crumb', x: x, y: y, vx: rnd(-45, 45), vy: rnd(-130, -40), g: 300, t: 0, life: rnd(0.4, 0.9), color: pick(['#68b7cf', '#a8e4f2', '#ffffff']) };
  }
  function streak(y) {
    return { type: 'streak', x: W + 10, y: y, vx: -rnd(220, 320), vy: 0, g: 0, t: 0, life: 1.4, color: 'rgba(255,255,255,0.5)' };
  }
  function leaf(x, y, color) {
    return { type: 'leaf', x: x, y: y, vx: rnd(-50, -25), vy: rnd(-10, 25), g: 18, t: 0, life: rnd(0.6, 1.4), color: color };
  }
  function addFloat(x, y, str, color) {
    floats.push({ x: x, y: y, str: str, color: color || '#ffffff', t: 0, life: 1.3 });
  }
  function shakeIt(mag, dur) { shake.mag = Math.max(shake.mag, mag); shake.t = Math.max(shake.t, dur); }

  // ---------- food & digestion ----------
  function spawnFoodAt(x) {
    const b = world.biome;
    const entries = [];
    for (const k in b.foods) entries.push({ v: k, w: b.foods[k] });
    const kind = pickWeighted(entries);
    const count = (kind === 'bug' && Math.random() < 0.5) ? irnd(2, 3) : 1;
    for (let i = 0; i < count; i++) {
      world.foods.push({
        kind: kind, def: FOODS[kind],
        x: x + rnd(-10, 10) + i * 9,
        baseY: rnd(34, SEA_Y - 26), y: 0,
        phase: rnd(0, 6.28), wander: rnd(0, 6.28),
      });
    }
  }

  function beakPos() {
    const off = SPR.beakTip({ bigBeak: has('beak') });
    const c = Math.cos(bird.rot), s = Math.sin(bird.rot);
    return { x: bird.x + off.x * c - off.y * s, y: bird.y + off.x * s + off.y * c };
  }

  function tryCatch(f, st) {
    if (bird.carried && (st.cropSlots === 0 || bird.crop)) return false;
    const bp = beakPos();
    const dx = f.x - bp.x, dy = f.y - bp.y;
    if (dx * dx + dy * dy > (st.catchR + f.def.r) * (st.catchR + f.def.r)) return false;
    if (bird.carried) {
      bird.crop = f.kind;
      addFloat(bird.x, bird.y - 14, 'STASHED!', '#f6c945');
    } else {
      startDigest(f.kind, st);
      if (run.tut.digest) { run.tut.digest = false; addFloat(bird.x, bird.y - 20, 'DIGESTING... WAIT!', '#a8e4f2'); }
    }
    AUDIO.play('catch');
    bird.openT = 0.18;
    spawnParts(3, function () { return sparkle(f.x, f.y, '#ffffff'); });
    return true;
  }

  function startDigest(kind, st) {
    const def = FOODS[kind];
    bird.carried = kind;
    bird.digestT = 0;
    let need = def.digest * st.digestMul;
    if (kind === 'nut' && has('gizzard')) need *= 0.4;
    bird.digestNeed = need;
  }

  function finishDigest(st) {
    const kind = bird.carried;
    const def = FOODS[kind];
    let nutr = def.nutr;
    if (kind === 'berry' && has('sweet')) nutr = Math.round(nutr * 1.5);
    if (kind === 'nut' && has('gizzard')) nutr = Math.round(nutr * 1.25);
    bird.carried = null;
    run.diet[kind]++; world.legDiet[kind]++;
    run.foodEaten++;
    run.score += nutr;
    run.evo += nutr;
    bird.fullness += nutr;
    AUDIO.play('gulp');
    addFloat(bird.x + 6, bird.y - 12, '+' + nutr, kind === 'gold' ? '#fff3a8' : '#96d454');
    const col = kind === 'berry' ? '#e0525c' : (kind === 'gold' ? '#f6c945' : (kind === 'bug' ? '#5a3d54' : '#a76f3e'));
    spawnParts(5, function () { return crumb(bird.x + 8, bird.y, col); });
    if (bird.fullness > st.cap && !bird.stuffed) {
      bird.stuffed = true;
      AUDIO.play('stuffed');
      addFloat(bird.x, bird.y - 20, 'STUFFED!', '#e0525c');
    }
    if (run.evo >= run.evoNeed && !run.evoReadyPinged) {
      run.evoReadyPinged = true;
      AUDIO.play('evoReady');
      addFloat(bird.x, bird.y - 26, 'EVOLUTION READY!', '#3fc0b0');
    }
    if (bird.crop) {
      const k = bird.crop; bird.crop = null;
      startDigest(k, st);
    }
  }

  function dropFood() {
    if (!bird.carried && !bird.crop) return;
    const bp = beakPos();
    [bird.carried, bird.crop].forEach(function (k) {
      if (!k) return;
      spawnParts(4, function () { return crumb(bp.x, bp.y, '#e5c28c'); });
    });
    if (bird.carried) addFloat(bird.x, bird.y - 16, 'DROPPED!', '#e0525c');
    bird.carried = null; bird.crop = null;
  }

  // ---------- damage ----------
  function hurt(source) {
    if (bird.invuln > 0 || bird.dead) return;
    if (bird.shieldUp) {
      bird.shieldUp = false;
      bird.invuln = 1.0;
      AUDIO.play('shield');
      addFloat(bird.x, bird.y - 16, 'SHIELD!', '#a8e4f2');
      spawnParts(8, function () { return sparkle(bird.x, bird.y, '#a8e4f2'); });
      return;
    }
    bird.hearts--;
    bird.invuln = 1.8;
    dropFood();
    AUDIO.play('hit');
    shakeIt(3, 0.35);
    freezeT = 0.08;
    spawnParts(8, function () { return feather(bird.x, bird.y); });
    if (bird.hearts <= 0) {
      bird.dead = true;
      bird.deathBy = source;
      bird.vy = -140;
      AUDIO.play('die');
    } else {
      bird.vy = -130;
    }
  }

  function gameOver() {
    if (run.score > best.score) { newBestFlag = true; }
    best = {
      score: Math.max(best.score, run.score),
      depth: Math.max(best.depth, run.depth),
      evos: Math.max(best.evos, run.evolutions),
    };
    saveBest(best);
    ui = { overT: 0 };
    STATE = 'over';
  }

  // ---------- island / card ui ----------
  function makeMutationCards() {
    const pool = MUTATIONS.filter(function (m) { return m.repeat || !has(m.id); });
    const cards = [];
    const bag = pool.slice();
    while (cards.length < 3 && bag.length) {
      const entries = bag.map(function (m) {
        const dietBonus = m.diet === 'any' ? 1 : run.diet[m.diet] * 0.25;
        return { v: m, w: 1 + dietBonus };
      });
      const m = pickWeighted(entries);
      bag.splice(bag.indexOf(m), 1);
      cards.push({ kind: 'mut', mut: m, title: m.name, lines: wrap(m.desc, 14), icon: m.icon });
    }
    return cards;
  }

  function makePathCards() {
    const options = [];
    const keys = BIOME_KEYS.filter(function (k) { return k !== world.biomeKey; });
    // shuffle
    for (let i = keys.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const t = keys[i]; keys[i] = keys[j]; keys[j] = t;
    }
    const n = run.depth === 1 ? 2 : (Math.random() < 0.6 ? 3 : 2);
    for (let i = 0; i < Math.min(n, keys.length); i++) {
      const b = BIOMES[keys[i]];
      options.push({ kind: 'path', biomeKey: keys[i], title: b.name, lines: b.hint, icon: b.icon, danger: Math.min(5, b.danger + Math.floor(run.depth / 3)) });
    }
    return options;
  }

  function wrap(str, maxChars) {
    const words = str.split(' ');
    const lines = [];
    let cur = '';
    for (const w2 of words) {
      if ((cur + ' ' + w2).trim().length > maxChars) { if (cur) lines.push(cur); cur = w2; }
      else cur = (cur + ' ' + w2).trim();
    }
    if (cur) lines.push(cur);
    return lines;
  }

  function applyMutation(m) {
    run.taken.push(m.id);
    run.evolutions++;
    run.evo = Math.max(0, run.evo - run.evoNeed);
    run.evoNeed += 30;
    run.evoReadyPinged = run.evo >= run.evoNeed;
    run.score += 150;
    if (m.id === 'downy') {
      bird.maxHearts = Math.min(5, bird.maxHearts + 1);
      bird.hearts = bird.maxHearts;
      AUDIO.play('heart');
    }
    AUDIO.play('evolve');
    spawnParts(20, function () { return sparkle(bird.x + rnd(-14, 14), bird.y + rnd(-14, 8), '#3fc0b0'); });
  }

  // ---------- update: flying ----------
  function updateFly(dt) {
    const st = stats();
    world.dist += world.speed * dt;
    if (world.banner > 0) world.banner -= dt;
    if (world.fade > 0) world.fade -= dt * 2.2;

    // spawn obstacles
    if (world.phase === 'fly') {
      while (world.spawned < world.legLen && world.nextSpawnX - world.dist < W + 60) {
        const margin = 26;
        const gapY = rnd(margin + world.gapH / 2, SEA_Y - 22 - world.gapH / 2 - margin * 0.4);
        world.obstacles.push({
          x: world.nextSpawnX, gapY: gapY, gapH: world.gapH, w: 26,
          seed: irnd(1, 99999), passed: false, kind: world.biome.obst,
        });
        // food between this and next obstacle
        if (Math.random() < 0.85) spawnFoodAt(world.nextSpawnX + world.spacing * 0.5);
        if (Math.random() < 0.25) spawnFoodAt(world.nextSpawnX + world.spacing * 0.72);
        world.spawned++;
        world.nextSpawnX += world.spacing;
      }
      if (world.spawned >= world.legLen && world.obstacles.length === 0) {
        world.phase = 'approach';
        world.island = { x: W + 80 };
      }
    }

    // wind gusts
    if (world.gustTimer > 0 && world.phase === 'fly') {
      world.gustTimer -= dt;
      if (world.gustTimer <= 0) {
        world.gust = { t: 0, warn: 0.85, dur: 1.3, dir: pick([-1, -1, 1]) }; // mostly downdrafts... skyward gusts too
        AUDIO.play('wind');
      }
    }
    if (world.gust) {
      const g = world.gust;
      g.t += dt;
      if (g.t > g.warn && g.t < g.warn + g.dur) {
        bird.vy += 105 * g.dir * dt * (g.dir < 0 ? 1.4 : 1.9);
        if (Math.random() < 0.5) parts.push(streak(rnd(10, SEA_Y - 6)));
      } else if (g.t >= g.warn + g.dur) {
        world.gust = null;
        world.gustTimer = rnd(3.5, 6.5);
      }
    }

    // bird physics
    if (!bird.dead && (world.phase === 'fly' || world.phase === 'approach')) {
      if (flapQueued) {
        flapQueued = false;
        bird.vy = st.flap;
        bird.flapT = 0.24;
        AUDIO.play('flap');
        parts.push(puff(bird.x - 6, bird.y + 5));
        if (Math.random() < 0.3) parts.push(feather(bird.x - 4, bird.y + 3));
      }
      let grav = st.grav, maxFall = st.maxFall;
      if (st.glide && bird.glideHeld && bird.vy > 0) { grav *= 0.35; maxFall *= 0.42; }
      bird.vy = Math.min(bird.vy + grav * dt, maxFall);
      bird.y += bird.vy * dt;
      if (bird.y < 6) { bird.y = 6; bird.vy = Math.max(bird.vy, 0); }
      bird.rot = clamp(bird.vy / 300, -0.45, 0.9) * 0.7;
    } else if (bird.dead) {
      bird.vy = Math.min(bird.vy + 700 * dt, 320);
      bird.y += bird.vy * dt;
      bird.rot += dt * 6;
      if (bird.y > SEA_Y + 6) {
        AUDIO.play('splash');
        spawnParts(14, function () { return splashP(bird.x, SEA_Y); });
        gameOver();
        return;
      }
    }

    // landing choreography
    if (world.phase === 'approach') {
      world.island.x -= world.speed * dt;
      if (world.island.x <= 212) { world.island.x = 212; world.phase = 'landing'; }
    } else if (world.phase === 'landing') {
      const px = world.island.x - 4, py = 95;
      bird.x += (px - bird.x) * Math.min(1, dt * 2.2);
      bird.y += (py - bird.y) * Math.min(1, dt * 2.2);
      bird.rot *= 1 - Math.min(1, dt * 6);
      bird.vy = 0;
      bird.flapT = 0.2; // keep wings busy
      if (Math.abs(bird.x - px) < 1.2 && Math.abs(bird.y - py) < 1.2) {
        bird.x = px; bird.y = py; bird.rot = 0;
        AUDIO.play('land');
        run.score += 50;
        islandArrive();
        return;
      }
    }

    // obstacles: scroll, pass, collide
    const bx0 = bird.x - 6, bx1 = bird.x + 6, by0 = bird.y - 5, by1 = bird.y + 5;
    for (let i = world.obstacles.length - 1; i >= 0; i--) {
      const o = world.obstacles[i];
      const sx = o.x - world.dist;
      if (!o.passed && sx + o.w < bird.x - 8) {
        o.passed = true;
        run.obstaclesPassed++;
        run.score += 10;
        AUDIO.play('point');
        const col = o.kind === 'rock' ? '#c9d2e0' : '#5cad3c';
        spawnParts(2, function () { return leaf(sx + o.w, o.gapY, col); });
      }
      if (sx + o.w < -40) { world.obstacles.splice(i, 1); continue; }
      if (!bird.dead && bird.invuln <= 0) {
        const topH = o.gapY - o.gapH / 2, botY = o.gapY + o.gapH / 2;
        if (bx1 > sx && bx0 < sx + o.w && (by0 < topH || by1 > botY)) {
          hurt(o.kind);
        }
      }
    }

    // sea contact
    if (!bird.dead && bird.y + 5 > SEA_Y && (world.phase === 'fly' || world.phase === 'approach')) {
      spawnParts(10, function () { return splashP(bird.x, SEA_Y); });
      AUDIO.play('splash');
      if (bird.hearts > 1 || bird.shieldUp) {
        hurt('water');
        bird.y = SEA_Y - 6;
        bird.vy = -200;
      } else {
        bird.hearts = 0;
        bird.dead = true;
        bird.deathBy = 'water';
        gameOver();
        return;
      }
    }

    // foods
    for (let i = world.foods.length - 1; i >= 0; i--) {
      const f = world.foods[i];
      if (f.def.moves) {
        f.wander += dt * 2.1;
        f.baseY += Math.sin(f.wander) * 14 * dt;
        f.baseY = clamp(f.baseY, 26, SEA_Y - 20);
        if (has('snatch') && !bird.dead) {
          const bp = beakPos();
          const dx = bp.x - f.x, dy = bp.y - f.baseY;
          const d2 = dx * dx + dy * dy;
          if (d2 < 45 * 45 && d2 > 4) {
            const d = Math.sqrt(d2);
            f.x += dx / d * 55 * dt;
            f.baseY += dy / d * 55 * dt;
          }
        }
      }
      f.x -= world.speed * dt;
      f.y = f.baseY + Math.sin(time * 3 + f.phase) * 4;
      if (f.def.sparkle && Math.random() < 0.12) parts.push(sparkle(f.x + rnd(-4, 4), f.y + rnd(-5, 3)));
      if (f.x < -12) { world.foods.splice(i, 1); continue; }
      if (!bird.dead && tryCatch(f, st)) world.foods.splice(i, 1);
    }

    // digestion
    if (bird.carried && !bird.dead) {
      bird.digestT += dt;
      if (bird.digestT >= bird.digestNeed) finishDigest(st);
    }
    bird.fullness = Math.max(0, bird.fullness - 7 * dt);
    if (bird.stuffed) {
      if (Math.random() < 0.06) parts.push(sparkle(bird.x + rnd(-6, 8), bird.y - 9, '#a8e4f2'));
      if (bird.fullness < st.cap * 0.6) bird.stuffed = false;
    }

    bird.invuln = Math.max(0, bird.invuln - dt);
    updateBirdCosmetics(dt);
  }

  function updateBirdCosmetics(dt) {
    bird.flapT = Math.max(0, bird.flapT - dt);
    bird.openT = Math.max(0, bird.openT - dt);
    bird.animT += dt;
    bird.blinkT -= dt;
    if (bird.blinkT <= 0) { bird.blinking = 0.12; bird.blinkT = rnd(1.8, 4.5); }
    bird.blinking = Math.max(0, bird.blinking - dt);
  }

  // ---------- update: island ----------
  function islandArrive() {
    STATE = 'island';
    ui = { phase: 'summary', t: 0, cards: null, sel: 0, cardRects: null };
  }

  function updateIsland(dt) {
    ui.t += dt;
    updateBirdCosmetics(dt);
    // digest continues while perched (double speed - resting helps)
    const st = stats();
    if (bird.carried) {
      bird.digestT += dt * 2;
      if (bird.digestT >= bird.digestNeed) finishDigest(st);
    }
    bird.fullness = Math.max(0, bird.fullness - 10 * dt);
    if (bird.stuffed && bird.fullness < st.cap * 0.6) bird.stuffed = false;

    if (ui.phase === 'takeoff') {
      ui.t2 = (ui.t2 || 0) + dt;
      bird.flapT = 0.2;
      if (ui.t2 > 0.35) {
        bird.x += (60 + ui.t2 * 260) * dt;
        bird.y -= 34 * dt;
        bird.rot = -0.15;
        if (Math.random() < 0.4) parts.push(puff(bird.x - 8, bird.y + 4));
      }
      if (bird.x > W + 24) newLeg(ui.nextBiome);
      return;
    }

    if (!actionQueued) return;
    actionQueued = false;

    if (ui.phase === 'summary') {
      if (ui.t < 0.45) return;
      if (run.evo >= run.evoNeed) {
        ui.phase = 'mutate';
        ui.cards = makeMutationCards();
        ui.sel = 0; ui.t = 0;
        AUDIO.play('evoReady');
      } else {
        ui.phase = 'path';
        ui.cards = makePathCards();
        ui.sel = 0; ui.t = 0;
      }
      return;
    }
    if (ui.phase === 'mutate') {
      if (ui.t < 0.3) return;
      applyMutation(ui.cards[ui.sel].mut);
      ui.phase = 'path';
      ui.cards = makePathCards();
      ui.sel = 0; ui.t = 0;
      return;
    }
    if (ui.phase === 'path') {
      if (ui.t < 0.3) return;
      AUDIO.play('confirm');
      ui.nextBiome = ui.cards[ui.sel].biomeKey;
      ui.cards = null;
      ui.phase = 'takeoff';
      ui.t = 0;
      return;
    }
  }

  // ---------- update: shared ----------
  function updateParts(dt) {
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      p.t += dt;
      if (p.t > p.life) { parts.splice(i, 1); continue; }
      p.vy += (p.g || 0) * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.type === 'feather') p.x += Math.sin(p.t * 9) * 14 * dt;
    }
    for (let i = floats.length - 1; i >= 0; i--) {
      const f = floats[i];
      f.t += dt;
      f.y -= 14 * dt;
      if (f.t > f.life) floats.splice(i, 1);
    }
    if (shake.t > 0) shake.t -= dt;
  }

  function update(dt) {
    time += dt;
    if (paused) return;
    if (freezeT > 0) { freezeT -= dt; return; }
    if (STATE === 'fly') updateFly(dt);
    else if (STATE === 'island') updateIsland(dt);
    else if (STATE === 'over') { ui.overT += dt; updateBirdCosmetics(dt); }
    else if (STATE === 'title') {
      updateBirdCosmetics(dt);
      // demo bird bobs and auto-flaps
      ui.demoY = 78 + Math.sin(time * 1.6) * 7;
      if (Math.sin(time * 1.6) > 0.93 && Math.random() < 0.2) bird && (bird.flapT = 0.22);
    }
    updateParts(dt);
    actionQueued = false; flapQueued = false;
  }

  // ---------- render: background ----------
  const SKY_TIERS = [
    { top: '#69b9e4', bot: '#c9ecf4', sun: '#fff3a8' },   // day
    { top: '#6a4c93', bot: '#f2b48c', sun: '#ffb35c' },   // dusk
    { top: '#12122e', bot: '#37406e', sun: '#e8ecff' },   // night
  ];
  const stars = [];
  for (let i = 0; i < 40; i++) stars.push({ x: Math.random() * W, y: Math.random() * 90, tw: Math.random() * 6 });

  let clouds = [];
  function seedClouds() {
    clouds = [];
    for (let i = 0; i < 7; i++) {
      clouds.push({ x: Math.random() * (W + 60) - 30, y: rnd(8, 78), spr: pick([SPR.CLOUD1, SPR.CLOUD2, SPR.CLOUD3]), mul: rnd(0.18, 0.4) });
    }
  }
  seedClouds();

  // far island silhouettes strip
  const FAR = document.createElement('canvas');
  FAR.width = 480; FAR.height = 26;
  (function () {
    const c = FAR.getContext('2d');
    c.fillStyle = '#7fb2c4';
    let x = 10;
    while (x < 470) {
      const w2 = irnd(24, 60), h2 = irnd(5, 14);
      for (let i = 0; i < w2; i += 2) {
        const hh = Math.max(1, Math.round(h2 * Math.sin((i / w2) * Math.PI)));
        c.fillRect(x + i, 26 - hh, 2, hh);
      }
      if (Math.random() < 0.6) { // tiny tree
        c.fillRect(x + w2 / 2, 26 - h2 - 3, 1, 3);
        c.fillRect(x + w2 / 2 - 1, 26 - h2 - 5, 3, 2);
      }
      x += w2 + irnd(14, 40);
    }
  })();

  const VIGNETTE = document.createElement('canvas');
  VIGNETTE.width = W; VIGNETTE.height = H;
  (function () {
    const c = VIGNETTE.getContext('2d');
    const g = c.createRadialGradient(W / 2, H / 2, 70, W / 2, H / 2, 200);
    g.addColorStop(0, 'rgba(10,6,18,0)');
    g.addColorStop(1, 'rgba(10,6,18,0.42)');
    c.fillStyle = g;
    c.fillRect(0, 0, W, H);
  })();

  function skyTier() {
    const d = run ? run.depth : 1;
    if (d <= 2) return { a: SKY_TIERS[0], b: SKY_TIERS[0], t: 0 };
    if (d === 3) return { a: SKY_TIERS[0], b: SKY_TIERS[1], t: 0.6 };
    if (d <= 5) return { a: SKY_TIERS[1], b: SKY_TIERS[1], t: 0 };
    if (d === 6) return { a: SKY_TIERS[1], b: SKY_TIERS[2], t: 0.6 };
    return { a: SKY_TIERS[2], b: SKY_TIERS[2], t: 0 };
  }

  function drawBackground(scrollX) {
    const tier = skyTier();
    const top = mixColor(tier.a.top, tier.b.top, tier.t);
    const bot = mixColor(tier.a.bot, tier.b.bot, tier.t);
    // banded gradient keeps the pixel look
    for (let i = 0; i < 9; i++) {
      ctx.fillStyle = mixColor(top, bot, i / 8);
      ctx.fillRect(0, i * 20, W, 20);
    }
    const night = (run && run.depth >= 6) ? 1 : 0;
    // sun / moon
    ctx.fillStyle = mixColor(tier.a.sun, tier.b.sun, tier.t);
    if (night) {
      ctx.beginPath(); ctx.arc(262, 26, 9, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = mixColor(SKY_TIERS[2].top, SKY_TIERS[2].bot, 0.3);
      ctx.beginPath(); ctx.arc(258, 23, 7, 0, Math.PI * 2); ctx.fill();
      for (const s of stars) {
        const a = 0.4 + 0.6 * Math.abs(Math.sin(time * 1.5 + s.tw));
        ctx.fillStyle = 'rgba(255,255,255,' + a.toFixed(2) + ')';
        ctx.fillRect(Math.round(s.x), Math.round(s.y), 1, 1);
      }
    } else {
      ctx.beginPath(); ctx.arc(258, 30, 11, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 0.35;
      ctx.beginPath(); ctx.arc(258, 30, 15, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
    }
    // far islands
    ctx.globalAlpha = 0.55;
    const fx = Math.floor((scrollX * 0.08) % 480);
    ctx.drawImage(FAR, -fx, SEA_Y - 26);
    ctx.drawImage(FAR, -fx + 480, SEA_Y - 26);
    ctx.globalAlpha = 1;
    // clouds
    for (const cl of clouds) {
      let x = cl.x - scrollX * cl.mul;
      x = ((x % (W + 80)) + (W + 80)) % (W + 80) - 40;
      ctx.globalAlpha = 0.85;
      ctx.drawImage(cl.spr, Math.round(x), Math.round(cl.y));
      ctx.globalAlpha = 1;
    }
  }

  function drawSea() {
    ctx.fillStyle = '#2e6f8e';
    ctx.fillRect(0, SEA_Y, W, H - SEA_Y);
    ctx.fillStyle = '#3d8aa8';
    ctx.fillRect(0, SEA_Y, W, 3);
    // animated wave crests
    ctx.fillStyle = '#8fd4e8';
    for (let x = 0; x < W; x += 4) {
      const o = Math.sin(x * 0.11 + time * 2.4) > 0.55 ? 1 : 0;
      if (o) ctx.fillRect(x, SEA_Y + Math.round(Math.sin(x * 0.31 + time * 3.1)), 3, 1);
    }
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    for (let x = 0; x < W; x += 7) {
      if (Math.sin(x * 1.7 + time * 1.3) > 0.8) ctx.fillRect(x, SEA_Y + 5 + (x % 5), 2, 1);
    }
  }

  // ---------- render: obstacles ----------
  function leafBlob(cx, cy, rw, rh, seed, base) {
    // layered leaf clusters
    const shades = ['#3d7f2a', '#5cad3c', '#96d454'];
    for (let layer = 0; layer < 3; layer++) {
      ctx.fillStyle = shades[layer];
      const n = 16 - layer * 4;
      for (let i = 0; i < n; i++) {
        const a = orand(seed, i * 3 + layer * 91) * Math.PI * 2;
        const rr = orand(seed, i * 7 + layer * 37);
        const px = cx + Math.cos(a) * rw * rr - 2;
        const py = cy + Math.sin(a) * rh * rr - 2 - layer;
        const s = layer === 2 ? 2 : (3 + Math.round(orand(seed, i * 11) * 2));
        ctx.fillRect(Math.round(px), Math.round(py), s, s);
      }
    }
  }

  function fruitDots(cx, cy, rw, rh, seed, color) {
    ctx.fillStyle = color;
    for (let i = 0; i < 5; i++) {
      const a = orand(seed, 500 + i * 13) * Math.PI * 2;
      const rr = 0.3 + orand(seed, 600 + i * 17) * 0.6;
      ctx.fillRect(Math.round(cx + Math.cos(a) * rw * rr), Math.round(cy + Math.sin(a) * rh * rr), 2, 2);
    }
  }

  function drawTreeObstacle(sx, o, fruitColor) {
    const topH = o.gapY - o.gapH / 2;
    const botY = o.gapY + o.gapH / 2;
    const cx = sx + o.w / 2;
    // ----- bottom: island tree -----
    // trunk
    ctx.fillStyle = '#8a5532';
    ctx.fillRect(cx - 5, botY + 12, 10, SEA_Y - botY - 12);
    ctx.fillStyle = '#653a20';
    ctx.fillRect(cx + 2, botY + 12, 3, SEA_Y - botY - 12);
    for (let i = 0; i < 4; i++) {
      const yy = botY + 18 + orand(o.seed, i + 40) * (SEA_Y - botY - 24);
      ctx.fillRect(cx - 4, Math.round(yy), 4, 1);
    }
    // roots
    ctx.fillStyle = '#653a20';
    ctx.fillRect(cx - 8, SEA_Y - 2, 16, 2);
    // canopy sits right at the gap edge
    leafBlob(cx, botY + 9, o.w / 2 + 3, 9, o.seed, null);
    ctx.fillStyle = '#2c5c1e';
    ctx.fillRect(sx + 2, botY, o.w - 4, 2); // crisp top edge of canopy
    fruitDots(cx, botY + 9, o.w / 2, 7, o.seed, fruitColor);
    // ----- top: hanging canopy mass -----
    if (topH > 2) {
      ctx.fillStyle = '#2f6322';
      ctx.fillRect(sx, 0, o.w, Math.max(0, topH - 8));
      ctx.fillStyle = '#3d7f2a';
      for (let i = 0; i < 14; i++) {
        const px = sx + orand(o.seed, 100 + i * 7) * (o.w - 3);
        const py = orand(o.seed, 130 + i * 11) * Math.max(1, topH - 10);
        ctx.fillRect(Math.round(px), Math.round(py), 3, 3);
      }
      leafBlob(cx, topH - 7, o.w / 2 + 3, 8, o.seed + 7, null);
      ctx.fillStyle = '#2c5c1e';
      ctx.fillRect(sx + 2, topH - 1, o.w - 4, 1);
      fruitDots(cx, topH - 7, o.w / 2, 6, o.seed + 7, fruitColor);
      // hanging vines (visual only)
      ctx.fillStyle = '#3d7f2a';
      for (let i = 0; i < 3; i++) {
        const vx = sx + 4 + Math.round(orand(o.seed, 200 + i * 9) * (o.w - 8));
        const vl = 3 + Math.round(orand(o.seed, 230 + i * 5) * 4);
        ctx.fillRect(vx, topH, 1, vl);
        ctx.fillStyle = '#5cad3c';
        ctx.fillRect(vx, topH + vl, 1, 1);
        ctx.fillStyle = '#3d7f2a';
      }
    }
  }

  function drawRockObstacle(sx, o) {
    const topH = o.gapY - o.gapH / 2;
    const botY = o.gapY + o.gapH / 2;
    // bottom spire tapers upward
    for (let y = botY; y < SEA_Y; y += 1) {
      const t = (y - botY) / Math.max(1, SEA_Y - botY);
      const half = Math.round(lerp(6, o.w / 2, Math.min(1, t * 1.6)));
      const cx = sx + o.w / 2;
      ctx.fillStyle = '#9aa2b5';
      ctx.fillRect(cx - half, y, half * 2, 1);
      ctx.fillStyle = '#c9d2e0';
      ctx.fillRect(cx - half, y, 2, 1);
      ctx.fillStyle = '#5f6579';
      ctx.fillRect(cx + half - 3, y, 3, 1);
    }
    // cracks
    ctx.fillStyle = '#5f6579';
    for (let i = 0; i < 4; i++) {
      const yy = botY + 6 + orand(o.seed, i * 3) * (SEA_Y - botY - 10);
      const xx = sx + 6 + orand(o.seed, i * 5 + 1) * (o.w - 12);
      ctx.fillRect(Math.round(xx), Math.round(yy), 1, 3 + Math.round(orand(o.seed, i) * 3));
    }
    ctx.fillStyle = '#f2f7ff'; // cap
    ctx.fillRect(sx + o.w / 2 - 5, botY, 10, 2);
    // top stalactite
    if (topH > 2) {
      for (let y = 0; y < topH; y++) {
        const t = 1 - y / topH;
        const half = Math.round(lerp(5, o.w / 2, Math.min(1, t * 1.5)));
        const cx = sx + o.w / 2;
        ctx.fillStyle = '#8a92a5';
        ctx.fillRect(cx - half, y, half * 2, 1);
        ctx.fillStyle = '#b9c2d0';
        ctx.fillRect(cx - half, y, 2, 1);
      }
      ctx.fillStyle = '#5f6579';
      ctx.fillRect(sx + o.w / 2 - 4, topH - 2, 8, 2);
    }
  }

  function drawBranchObstacle(sx, o) {
    const topH = o.gapY - o.gapH / 2;
    const botY = o.gapY + o.gapH / 2;
    const cx = sx + o.w / 2;
    // bottom: mangrove reeds bundle
    for (let i = 0; i < 6; i++) {
      const rx = sx + 2 + Math.round(orand(o.seed, i * 3) * (o.w - 6));
      const sway = Math.round(Math.sin(time * 1.6 + i) * 1);
      ctx.fillStyle = i % 2 ? '#3d7f2a' : '#5cad3c';
      ctx.fillRect(rx + sway, botY + 4, 2, SEA_Y - botY - 4);
      // cattail head
      ctx.fillStyle = '#7b4d26';
      ctx.fillRect(rx + sway - 1, botY + 4 + Math.round(orand(o.seed, i * 7) * 8), 3, 5);
    }
    ctx.fillStyle = '#2c5c1e';
    ctx.fillRect(sx + 1, botY, o.w - 2, 3);
    ctx.fillStyle = '#5cad3c';
    for (let i = 0; i < 5; i++) ctx.fillRect(sx + 2 + i * 5, botY - 1, 2, 2);
    // top: mossy bough
    if (topH > 2) {
      ctx.fillStyle = '#653a20';
      ctx.fillRect(sx + 4, 0, 8, topH - 2);
      ctx.fillStyle = '#8a5532';
      ctx.fillRect(sx + 6, 0, 3, topH - 2);
      ctx.fillStyle = '#653a20';
      ctx.fillRect(sx, topH - 4, o.w, 4);
      ctx.fillStyle = '#8a5532';
      ctx.fillRect(sx, topH - 4, o.w, 2);
      // moss drips
      ctx.fillStyle = '#5cad3c';
      for (let i = 0; i < 4; i++) {
        const mx = sx + 2 + Math.round(orand(o.seed, 60 + i * 3) * (o.w - 5));
        ctx.fillRect(mx, topH, 2, 2 + Math.round(orand(o.seed, 80 + i) * 3));
      }
    }
  }

  function drawObstacles() {
    const fruitColor = world.biome.deco;
    for (const o of world.obstacles) {
      const sx = Math.round(o.x - world.dist);
      if (sx > W + 4 || sx + o.w < -8) continue;
      if (o.kind === 'tree') drawTreeObstacle(sx, o, fruitColor);
      else if (o.kind === 'rock') drawRockObstacle(sx, o);
      else drawBranchObstacle(sx, o);
    }
  }

  // ---------- render: island scene ----------
  function drawIsland(ix) {
    // mound
    const topY = 118;
    for (let y = topY; y < SEA_Y; y++) {
      const t = (y - topY) / (SEA_Y - topY);
      const hw = Math.round(18 + t * 30);
      if (y < topY + 4) ctx.fillStyle = y === topY ? '#96d454' : '#5cad3c';
      else if (y > SEA_Y - 3) ctx.fillStyle = '#e5c28c';
      else ctx.fillStyle = '#8a5532';
      ctx.fillRect(ix - hw, y, hw * 2, 1);
    }
    // dirt speckles
    ctx.fillStyle = '#653a20';
    for (let i = 0; i < 8; i++) {
      ctx.fillRect(ix - 20 + Math.round(orand(777, i * 3) * 40), topY + 8 + Math.round(orand(777, i * 7) * 34), 2, 2);
    }
    // grass tufts + flowers
    for (let i = 0; i < 6; i++) {
      const gx2 = ix - 16 + Math.round(orand(555, i * 5) * 32);
      ctx.fillStyle = '#96d454';
      ctx.fillRect(gx2, topY - 2, 1, 2);
      ctx.fillRect(gx2 + 2, topY - 1, 1, 1);
      if (i % 2) { ctx.fillStyle = world.biome.deco; ctx.fillRect(gx2 + 1, topY - 3, 1, 1); }
    }
    // tree with perch branch
    const tx = ix - 10;
    ctx.fillStyle = '#8a5532';
    ctx.fillRect(tx - 2, 92, 5, topY - 92);
    ctx.fillStyle = '#653a20';
    ctx.fillRect(tx + 1, 92, 2, topY - 92);
    // perch branch to the right
    ctx.fillStyle = '#8a5532';
    ctx.fillRect(tx + 3, 100, 12, 2);
    ctx.fillStyle = '#653a20';
    ctx.fillRect(tx + 3, 101, 12, 1);
    leafBlob(tx, 84, 15, 10, 4242, null);
    fruitDots(tx, 84, 12, 8, 4242, world.biome.deco);
  }

  // ---------- render: bird ----------
  function birdCfg() {
    let frame = 1;
    if (bird.flapT > 0.16) frame = 2;
    else if (bird.flapT > 0.06) frame = 1;
    else if (bird.flapT > 0) frame = 0;
    else frame = bird.vy < -20 ? 0 : 1;
    if (STATE === 'island' || STATE === 'title') {
      frame = bird.flapT > 0 ? Math.floor(bird.animT * 14) % 3 : 1;
    }
    const nearFood = bird.openT > 0;
    const crest = Math.min(3, Math.ceil(run ? run.evolutions / 2 : 0));
    return {
      frame: frame,
      open: nearFood,
      bigBeak: run ? has('beak') : false,
      bigWings: run ? has('wings') : false,
      bigTail: run ? has('rudder') : false,
      crest: crest,
      stuffed: bird.stuffed,
      blink: bird.blinking > 0,
      shield: bird.shieldUp,
      time: time,
    };
  }

  function drawBirdFull() {
    if (bird.invuln > 0 && Math.floor(time * 14) % 2 === 0 && !bird.dead) return;
    const cfg = birdCfg();
    SPR.drawBird(ctx, bird.x, bird.y, bird.rot, cfg);
    // carried food rides on the beak tip
    if (bird.carried) {
      const bp = beakPos();
      const spr = bird.carried === 'bug'
        ? (Math.floor(time * 10) % 2 ? SPR.BUG1 : SPR.BUG2)
        : FOODS[bird.carried].spr;
      ctx.drawImage(spr, Math.round(bp.x - spr.width / 2 + 2), Math.round(bp.y - spr.height / 2));
      // digest progress bar above the bird
      const w2 = 14, px = Math.round(bird.x - w2 / 2), py = Math.round(bird.y - 15);
      ctx.fillStyle = 'rgba(20,12,28,0.8)';
      ctx.fillRect(px - 1, py - 1, w2 + 2, 4);
      const t = clamp(bird.digestT / bird.digestNeed, 0, 1);
      ctx.fillStyle = t < 1 ? '#f6c945' : '#96d454';
      ctx.fillRect(px, py, Math.round(w2 * t), 2);
    }
    if (bird.crop) { // crop bulge dot at the throat
      ctx.fillStyle = '#fbe7bb';
      ctx.fillRect(Math.round(bird.x + 4), Math.round(bird.y + 4), 3, 3);
      ctx.fillStyle = '#33203a';
      ctx.fillRect(Math.round(bird.x + 4), Math.round(bird.y + 7), 3, 1);
    }
    // perched feet
    if (STATE === 'island' && ui.phase !== 'takeoff') {
      ctx.fillStyle = '#cf9330';
      ctx.fillRect(Math.round(bird.x - 2), Math.round(bird.y + 6), 1, 3);
      ctx.fillRect(Math.round(bird.x + 2), Math.round(bird.y + 6), 1, 3);
    }
  }

  // ---------- render: HUD ----------
  function drawPanel(x, y, w2, h2) {
    ctx.fillStyle = 'rgba(18,12,30,0.92)';
    ctx.fillRect(x + 1, y + 1, w2 - 2, h2 - 2);
    ctx.fillStyle = '#6a5a8c';
    ctx.fillRect(x + 1, y, w2 - 2, 1);
    ctx.fillRect(x + 1, y + h2 - 1, w2 - 2, 1);
    ctx.fillRect(x, y + 1, 1, h2 - 2);
    ctx.fillRect(x + w2 - 1, y + 1, 1, h2 - 2);
  }

  function drawHUD() {
    const st = stats();
    // hearts
    for (let i = 0; i < bird.maxHearts; i++) {
      ctx.drawImage(i < bird.hearts ? SPR.HEART : SPR.HEART_EMPTY, 4 + i * 9, 4);
    }
    // shield pip
    if (bird.shieldUp) {
      ctx.fillStyle = '#a8e4f2';
      ctx.fillRect(4 + bird.maxHearts * 9 + 2, 6, 3, 3);
    }
    // evo meter
    const ew = 56, ex = Math.round(W / 2 - ew / 2), ey = 5;
    ctx.drawImage(SPR.DNA, ex - 7, ey - 1);
    ctx.fillStyle = 'rgba(20,12,28,0.8)';
    ctx.fillRect(ex - 1, ey, ew + 2, 5);
    const et = clamp(run.evo / run.evoNeed, 0, 1);
    const ready = run.evo >= run.evoNeed;
    ctx.fillStyle = ready ? (Math.floor(time * 6) % 2 ? '#3fc0b0' : '#96f0e4') : '#3fc0b0';
    ctx.fillRect(ex, ey + 1, Math.round(ew * et), 3);
    if (ready) drawTextShadow(ctx, 'EVO READY!', W / 2, ey + 8, '#96f0e4', 1, 'center');
    // score + depth
    drawTextShadow(ctx, String(run.score), W - 4, 4, '#ffffff', 1, 'right');
    drawTextShadow(ctx, 'DEPTH ' + run.depth, W - 4, 11, '#c9d2e0', 1, 'right');
    // tummy bar
    const tw = 30, tx2 = 4, ty = H - 9;
    drawTextShadow(ctx, 'TUMMY', tx2, ty - 7, '#e5c28c', 1);
    ctx.fillStyle = 'rgba(20,12,28,0.8)';
    ctx.fillRect(tx2 - 1, ty, tw + 2, 5);
    const ft = clamp(bird.fullness / st.cap, 0, 1);
    ctx.fillStyle = bird.stuffed ? (Math.floor(time * 8) % 2 ? '#e0525c' : '#f2748f') : (ft > 0.75 ? '#f6c945' : '#96d454');
    ctx.fillRect(tx2, ty + 1, Math.round(tw * ft), 3);
    if (bird.stuffed) drawTextShadow(ctx, 'STUFFED!', tx2 + tw + 6, ty - 1, '#e0525c', 1);
    // gust warning
    if (world && world.gust && world.gust.t < world.gust.warn) {
      if (Math.floor(time * 8) % 2) {
        const dir = world.gust.dir < 0 ? 'GUST RISING!' : 'GUST FALLING!';
        drawTextShadow(ctx, '! ' + dir + ' !', W / 2, 40, '#f6c945', 1, 'center');
      }
    }
  }

  function drawBanner() {
    if (!world || world.banner <= 0 || STATE !== 'fly') return;
    const a = clamp(world.banner > 2 ? (2.4 - world.banner) * 3 : world.banner / 0.7, 0, 1);
    ctx.globalAlpha = a;
    drawPanel(W / 2 - 74, 30, 148, 24);
    drawTextShadow(ctx, 'DEPTH ' + run.depth, W / 2, 34, '#f6c945', 1, 'center');
    drawTextShadow(ctx, world.biome.name, W / 2, 43, '#ffffff', 1, 'center');
    ctx.globalAlpha = 1;
    if (run.depth === 1 && world.banner < 1.4) {
      drawTextShadow(ctx, 'TAP / SPACE TO FLAP', W / 2, 62, '#ffffff', 1, 'center');
      drawTextShadow(ctx, 'CATCH FOOD ON YOUR BEAK!', W / 2, 70, '#a8e4f2', 1, 'center');
    }
  }

  // ---------- render: particles & floats ----------
  function drawParts() {
    for (const p of parts) {
      const lifeT = p.t / p.life;
      if (p.type === 'sparkle') {
        ctx.fillStyle = p.color;
        const s = lifeT < 0.5 ? 1 : 0;
        ctx.fillRect(Math.round(p.x), Math.round(p.y) - 1 - s, 1, 3 + s * 2);
        ctx.fillRect(Math.round(p.x) - 1 - s, Math.round(p.y), 3 + s * 2, 1);
      } else if (p.type === 'streak') {
        ctx.fillStyle = p.color;
        ctx.fillRect(Math.round(p.x), Math.round(p.y), 14, 1);
      } else if (p.type === 'puff') {
        ctx.globalAlpha = 1 - lifeT;
        ctx.fillStyle = p.color;
        const s = 2 + Math.round(lifeT * 3);
        ctx.fillRect(Math.round(p.x - s / 2), Math.round(p.y - s / 2), s, s);
        ctx.globalAlpha = 1;
      } else if (p.type === 'feather' || p.type === 'leaf') {
        ctx.fillStyle = p.color;
        const w2 = p.type === 'leaf' ? 2 : 2;
        ctx.fillRect(Math.round(p.x), Math.round(p.y), w2, 1 + (Math.floor(p.t * 10) % 2));
      } else {
        ctx.globalAlpha = 1 - lifeT * 0.6;
        ctx.fillStyle = p.color;
        ctx.fillRect(Math.round(p.x), Math.round(p.y), 2, 2);
        ctx.globalAlpha = 1;
      }
    }
    for (const f of floats) {
      ctx.globalAlpha = clamp(1.4 - f.t, 0, 1);
      drawTextShadow(ctx, f.str, f.x, f.y, f.color, 1, 'center');
      ctx.globalAlpha = 1;
    }
  }

  // ---------- render: foods ----------
  function drawFoods() {
    for (const f of world.foods) {
      const spr = f.kind === 'bug' ? (Math.floor(time * 12 + f.phase) % 2 ? SPR.BUG1 : SPR.BUG2) : f.def.spr;
      ctx.drawImage(spr, Math.round(f.x - spr.width / 2), Math.round(f.y - spr.height / 2));
    }
  }

  // ---------- render: cards ----------
  function drawCards(title) {
    const cards = ui.cards;
    const isPath = cards[0].kind === 'path';
    const cw = 82, ch = isPath ? 92 : 78, gap = 8;
    const total = cards.length * cw + (cards.length - 1) * gap;
    const x0 = Math.round(W / 2 - total / 2);
    const y0 = isPath ? 46 : 52;
    ctx.fillStyle = 'rgba(10,6,18,0.55)';
    ctx.fillRect(0, 0, W, H);
    drawTextShadow(ctx, title, W / 2, 22, '#f6c945', 1, 'center');
    ui.cardRects = [];
    for (let i = 0; i < cards.length; i++) {
      const c = cards[i];
      const sel = i === ui.sel;
      const cx = x0 + i * (cw + gap);
      const cy = y0 + (sel ? -3 : 0);
      ui.cardRects.push({ x: cx, y: cy, w: cw, h: ch });
      drawPanel(cx, cy, cw, ch);
      if (sel) {
        ctx.fillStyle = '#f6c945';
        ctx.fillRect(cx + 1, cy, cw - 2, 1);
        ctx.fillRect(cx + 1, cy + ch - 1, cw - 2, 1);
        ctx.fillRect(cx, cy + 1, 1, ch - 2);
        ctx.fillRect(cx + cw - 1, cy + 1, 1, ch - 2);
        const bob = Math.floor(time * 4) % 2;
        drawText(ctx, '*', cx + cw / 2 - 1, cy - 9 - bob, '#f6c945', 1);
      }
      // icon, centered in the top zone
      const icon = c.icon;
      const isc = 2;
      const iy = cy + 7 + Math.max(0, Math.round((28 - icon.height * isc) / 2));
      ctx.drawImage(icon, Math.round(cx + cw / 2 - icon.width * isc / 2), iy, icon.width * isc, icon.height * isc);
      // title (wrapped)
      const tl = wrap(c.title, 12);
      let ty = cy + 40;
      for (const line of tl) { drawTextShadow(ctx, line, cx + cw / 2, ty, sel ? '#f6c945' : '#ffffff', 1, 'center'); ty += 7; }
      ty += 2;
      for (const line of c.lines) { drawText(ctx, line, cx + cw / 2, ty, '#c9d2e0', 1, 'center'); ty += 7; }
      // danger skulls for path cards
      if (c.kind === 'path') {
        const n = c.danger;
        const sx0 = cx + cw / 2 - (n * 7 - 2) / 2;
        for (let s = 0; s < n; s++) ctx.drawImage(SPR.SKULL, Math.round(sx0 + s * 7), cy + ch - 10);
      }
    }
    drawTextShadow(ctx, '< > CHOOSE   SPACE/TAP CONFIRM', W / 2, y0 + ch + 10, '#8f86a8', 1, 'center');
  }

  // ---------- render: main states ----------
  function renderFly() {
    drawBackground(world.dist);
    drawObstacles();
    if (world.island) drawIsland(Math.round(world.island.x));
    drawFoods();
    drawSea();
    drawBirdFull();
    drawParts();
    drawHUD();
    drawBanner();
    if (world.fade > 0) {
      ctx.fillStyle = 'rgba(10,6,18,' + clamp(world.fade, 0, 1).toFixed(2) + ')';
      ctx.fillRect(0, 0, W, H);
    }
  }

  function renderIsland() {
    drawBackground(world.dist + time * 4);
    drawIsland(212);
    drawSea();
    drawBirdFull();
    drawParts();
    drawHUD();
    if (ui.phase === 'summary') {
      drawPanel(20, 40, 130, 96);
      drawTextShadow(ctx, 'ISLAND REACHED!', 85, 46, '#f6c945', 1, 'center');
      drawText(ctx, 'DEPTH ' + run.depth + ' CLEARED', 85, 56, '#ffffff', 1, 'center');
      let yy = 68;
      const keys = ['berry', 'seed', 'nut', 'bug', 'gold'];
      let any = false;
      for (const k of keys) {
        if (!world.legDiet[k]) continue;
        any = true;
        const spr = FOODS[k].spr;
        ctx.drawImage(spr, 34, yy - 2);
        drawText(ctx, 'X' + world.legDiet[k] + ' ' + FOODS[k].name, 46, yy, '#c9d2e0', 1);
        yy += 10;
      }
      if (!any) { drawText(ctx, 'NOTHING EATEN...', 85, yy, '#8f86a8', 1, 'center'); yy += 10; }
      yy = Math.max(yy + 4, 112);
      if (run.evo >= run.evoNeed) drawTextShadow(ctx, 'EVOLUTION AWAITS!', 85, yy, '#3fc0b0', 1, 'center');
      else drawText(ctx, 'EVO ' + Math.round(run.evo) + '/' + run.evoNeed, 85, yy, '#3fc0b0', 1, 'center');
      if (Math.floor(time * 2) % 2) drawText(ctx, 'SPACE/TAP TO CONTINUE', 85, 126, '#8f86a8', 1, 'center');
    } else if (ui.phase === 'mutate') {
      drawCards('CHOOSE YOUR EVOLUTION');
    } else if (ui.phase === 'path') {
      drawCards('CHOOSE YOUR MIGRATION');
    }
  }

  function renderTitle() {
    drawBackground(time * 12);
    drawSea();
    // demo island
    // logo
    const ly = 32 + Math.round(Math.sin(time * 1.2) * 2);
    FONT.drawTextOutline(ctx, 'FLAPPY', W / 2, ly, '#f6c945', 3, 'center');
    FONT.drawTextOutline(ctx, 'DARWIN', W / 2, ly + 22, '#3fc0b0', 3, 'center');
    ctx.drawImage(SPR.DNA, W / 2 - 62, ly + 24);
    ctx.drawImage(SPR.DNA, W / 2 + 58, ly + 24);
    drawTextShadow(ctx, 'EAT. DIGEST. EVOLVE.', W / 2, ly + 46, '#ffffff', 1, 'center');
    // demo bird
    const dy = ui.demoY || 84;
    SPR.drawBird(ctx, 70, dy, Math.sin(time * 1.6 + 1) * 0.1, {
      frame: Math.floor(time * 9) % 3, open: false, bigBeak: false, bigWings: false,
      bigTail: false, crest: 0, stuffed: false, blink: Math.sin(time * 0.7) > 0.97, shield: false, time: time,
    });
    if (Math.random() < 0.06) parts.push(feather(62, dy + 4));
    // food teaser orbiting
    ctx.drawImage(SPR.BERRY, 96, Math.round(dy - 6 + Math.sin(time * 2.2) * 3));
    drawParts();
    if (Math.floor(time * 2) % 2) drawTextShadow(ctx, 'PRESS SPACE OR TAP TO MIGRATE', W / 2, 124, '#ffffff', 1, 'center');
    drawTextShadow(ctx, 'CATCH FOOD ON YOUR BEAK - WAIT TO DIGEST', W / 2, 140, '#a8e4f2', 1, 'center');
    drawTextShadow(ctx, "DON'T OVEREAT... EVOLVE OR GO EXTINCT", W / 2, 148, '#a8e4f2', 1, 'center');
    if (best.score > 0) drawTextShadow(ctx, 'BEST ' + best.score + '  DEPTH ' + best.depth + '  EVOS ' + best.evos, W / 2, 162, '#f6c945', 1, 'center');
    drawText(ctx, 'M MUTE  P PAUSE  R RESTART', W / 2, 171, '#8f86a8', 1, 'center');
  }

  function renderOver() {
    drawBackground(world ? world.dist : 0);
    drawSea();
    drawParts();
    ctx.fillStyle = 'rgba(10,6,18,0.6)';
    ctx.fillRect(0, 0, W, H);
    const py = 22;
    drawPanel(60, py, 200, 136);
    drawTextShadow(ctx, 'EXTINCT!', W / 2, py + 8, '#e0525c', 2, 'center');
    drawText(ctx, DEATHS[bird.deathBy] || 'NATURAL SELECTION WINS', W / 2, py + 24, '#c9d2e0', 1, 'center');
    drawTextShadow(ctx, 'SCORE ' + run.score, W / 2, py + 38, '#ffffff', 2, 'center');
    if (newBestFlag && Math.floor(time * 4) % 2) drawTextShadow(ctx, 'NEW BEST!', W / 2, py + 52, '#f6c945', 1, 'center');
    drawText(ctx, 'DEPTH ' + run.depth + '   FOOD ' + run.foodEaten + '   TREES ' + run.obstaclesPassed, W / 2, py + 64, '#c9d2e0', 1, 'center');
    // trait list
    drawText(ctx, 'EVOLVED TRAITS:', W / 2, py + 76, '#3fc0b0', 1, 'center');
    if (run.taken.length === 0) {
      drawText(ctx, 'NONE... A HUMBLE FINCH', W / 2, py + 86, '#8f86a8', 1, 'center');
    } else {
      const names = run.taken.map(function (id) {
        const m = MUTATIONS.filter(function (x) { return x.id === id; })[0];
        return m ? m.name : id;
      });
      let yy = py + 86;
      for (let i = 0; i < Math.min(4, names.length); i++) {
        let line = names[i];
        if (i === 3 && names.length > 4) line += ' +' + (names.length - 4) + ' MORE';
        drawText(ctx, line, W / 2, yy, '#ffffff', 1, 'center');
        yy += 8;
      }
    }
    if (ui.overT > 0.7 && Math.floor(time * 2) % 2) {
      drawTextShadow(ctx, 'SPACE/TAP: TRY AGAIN', W / 2, py + 122, '#f6c945', 1, 'center');
    }
  }

  function render() {
    ctx.imageSmoothingEnabled = false;
    ctx.save();
    if (shake.t > 0) {
      ctx.translate(Math.round(rnd(-shake.mag, shake.mag)), Math.round(rnd(-shake.mag, shake.mag)));
    }
    if (STATE === 'title') renderTitle();
    else if (STATE === 'fly') renderFly();
    else if (STATE === 'island') renderIsland();
    else if (STATE === 'over') renderOver();
    ctx.restore();
    ctx.drawImage(VIGNETTE, 0, 0);
    if (paused) {
      ctx.fillStyle = 'rgba(10,6,18,0.7)';
      ctx.fillRect(0, 0, W, H);
      drawTextShadow(ctx, 'PAUSED', W / 2, 80, '#ffffff', 2, 'center');
      drawText(ctx, 'P TO RESUME', W / 2, 98, '#8f86a8', 1, 'center');
    }
    if (AUDIO.isMuted()) drawText(ctx, 'MUTED', 4, H - 24, '#8f86a8', 1);
  }

  // ---------- main loop ----------
  // a bird exists on the title screen for the demo
  newRun();
  STATE = 'title';
  ui = { demoY: 84 };

  // tiny debug/testing handle
  window.__FD = {
    snap: function () {
      const nextObs = (STATE === 'fly' && world)
        ? world.obstacles.filter(function (o) { return o.x - world.dist + o.w > bird.x - 8; })[0]
        : null;
      return {
        state: STATE, phase: world && world.phase, uiPhase: ui && ui.phase,
        y: bird && bird.y, hearts: bird && bird.hearts, depth: run && run.depth,
        evo: run && Math.round(run.evo), evoNeed: run && run.evoNeed, score: run && run.score,
        gapY: nextObs ? nextObs.gapY : null,
        carried: bird && bird.carried, fullness: bird && Math.round(bird.fullness),
      };
    },
    feed: function (n) { if (run) run.evo += n; },
  };

  let last = 0;
  function frame(t) {
    const dt = Math.min((t - last) / 1000, 0.05);
    last = t;
    update(dt);
    render();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
