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

  // ---------- math helpers ----------
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function smooth(t) { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); }
  function easeOutCubic(t) { t = clamp(t, 0, 1); return 1 - Math.pow(1 - t, 3); }
  function easeInOutCubic(t) { t = clamp(t, 0, 1); return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
  function easeOutBack(t) { t = clamp(t, 0, 1); const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); }
  function springKick(t, freq, decay) { return Math.sin(t * freq) * Math.exp(-t * decay); }
  function hexToRgb(h) { return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]; }
  function mixColor(h1, h2, t) {
    const a = hexToRgb(h1), b = hexToRgb(h2);
    let out = '#';
    for (let i = 0; i < 3; i++) out += ('0' + Math.round(lerp(a[i], b[i], t)).toString(16)).slice(-2);
    return out;
  }
  function orand(seed, i) {
    let x = (seed * 374761393 + i * 668265263) >>> 0;
    x = ((x ^ (x >>> 13)) * 1274126177) >>> 0;
    return (x >>> 8) / 16777216;
  }
  function rnd(a, b) { return a + Math.random() * (b - a); }
  function irnd(a, b) { return Math.floor(rnd(a, b + 1)); }
  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
  function pickWeighted(entries) {
    let total = 0;
    for (const e of entries) total += e.w;
    let roll = Math.random() * total;
    for (const e of entries) { roll -= e.w; if (roll <= 0) return e.v; }
    return entries[entries.length - 1].v;
  }

  // ---------- data ----------
  const FOODS = {
    seed:   { spr: SPR.SEED,   nutr: 7,  digest: 1.0, r: 2, name: 'SEED',         bucket: 'seed' },
    bug:    { spr: SPR.BUG1,   nutr: 9,  digest: 0.7, r: 3, name: 'BUG',          bucket: 'bug',   moves: true },
    nectar: { spr: SPR.NECTAR, nutr: 10, digest: 0.8, r: 3, name: 'NECTAR',       bucket: 'berry' },
    berry:  { spr: SPR.BERRY,  nutr: 12, digest: 1.6, r: 3, name: 'BERRY',        bucket: 'berry' },
    grub:   { spr: SPR.GRUB,   nutr: 16, digest: 1.3, r: 3, name: 'GRUB',         bucket: 'bug',   moves: true, slow: true },
    nut:    { spr: SPR.NUT,    nutr: 24, digest: 3.6, r: 3, name: 'NUT',          bucket: 'nut' },
    frog:   { spr: SPR.FROG,   nutr: 30, digest: 2.8, r: 3, name: 'FROG',         bucket: 'bug',   moves: true, hop: true },
    mango:  { spr: SPR.MANGO,  nutr: 34, digest: 3.2, r: 3, name: 'MANGO',        bucket: 'berry' },
    gold:   { spr: SPR.GOLD,   nutr: 45, digest: 4.5, r: 3, name: 'GOLDEN FRUIT', bucket: 'gold',  sparkle: true },
  };

  const BIOMES = {
    meadow: { name: 'MEADOW ISLES', danger: 1, obst: 'tree', tree: 'oak', gapBase: 62, sky: 'day', deco: '#e0525c',
      hazards: [], foods: { berry: 5, seed: 3, bug: 1, nectar: 0.6, nut: 0.5, gold: 0.15 },
      hint: ['BERRIES +', 'GENTLE TREES'], foodIcons: ['berry', 'seed'], icon: SPR.ICON_MEADOW },
    forest: { name: 'PINEWOOD REACH', danger: 1, obst: 'tree', tree: 'pine', gapBase: 60, sky: 'misty', deco: '#d98a3d',
      hazards: [], foods: { seed: 5, nut: 3, berry: 1.5, grub: 1, gold: 0.2 },
      hint: ['TALL PINES', 'SEEDS + NUTS'], foodIcons: ['seed', 'nut'], icon: SPR.ICON_FOREST },
    grove: { name: 'OAKNUT GROVE', danger: 2, obst: 'tree', tree: 'nutoak', gapBase: 54, dense: true, sky: 'golden', deco: '#a76f3e',
      hazards: [], foods: { nut: 5, seed: 2, berry: 1, grub: 0.6, gold: 0.2 },
      hint: ['HEARTY NUTS', 'DENSE TREES'], foodIcons: ['nut', 'seed'], icon: SPR.ICON_GROVE },
    marsh: { name: 'BUZZING MARSH', danger: 2, obst: 'tree', tree: 'mangrove', gapBase: 58, sky: 'day', deco: '#d4c24a',
      hazards: [], foods: { bug: 6, grub: 1.5, berry: 1.5, seed: 1, gold: 0.2 },
      hint: ['QUICK BUGS', 'TANGLED ROOTS'], foodIcons: ['bug', 'berry'], icon: SPR.ICON_MARSH },
    swamp: { name: 'MIRE SWAMP', danger: 2, obst: 'tree', tree: 'cypress', gapBase: 56, dense: true, sky: 'misty', deco: '#8a4f6b',
      hazards: ['snake', 'snapper'], foods: { bug: 4, grub: 3, frog: 2, berry: 1, gold: 0.3 },
      hint: ['LURKING JAWS', 'GRUBS + FROGS'], foodIcons: ['grub', 'frog'], icon: SPR.ICON_SWAMP },
    crags: { name: 'STORM CRAGS', danger: 3, obst: 'rock', tree: null, gapBase: 54, wind: true, sky: 'stormy', deco: '#9aa2b5',
      hazards: ['hawk'], foods: { seed: 2, nut: 2, berry: 2, gold: 0.7 },
      hint: ['DIVING HAWKS', 'WILD GUSTS'], foodIcons: ['gold', 'nut'], icon: SPR.ICON_CRAGS },
    jungle: { name: 'LUSH JUNGLE', danger: 3, obst: 'tree', tree: 'broadleaf', gapBase: 52, dense: true, sky: 'golden', deco: '#ff5f9e',
      hazards: ['snake', 'hawk'], foods: { mango: 4, nectar: 3, nut: 2, berry: 2, bug: 2, frog: 1.5, gold: 0.8 },
      hint: ['SNAKES + HAWKS', 'RICH FRUIT'], foodIcons: ['mango', 'gold'], icon: SPR.ICON_JUNGLE },
  };
  const BIOME_KEYS = Object.keys(BIOMES);

  // per-variant tree palettes + soft/solid geometry
  const TREES = {
    oak:       { soft: 6, coreHalf: 3, ry: 11, canopy: { deep: '#1f4a16', base: '#2f6322', mid: '#4f9a2e', top: '#7fc23e', hi: '#bfe87a' }, bark: { light: '#9c6238', mid: '#7a4a28', dark: '#4a2c16' } },
    nutoak:    { soft: 5, coreHalf: 4, ry: 11, canopy: { deep: '#2a4416', base: '#3d5f1f', mid: '#5c8a2c', top: '#86b43e', hi: '#c2cf5a' }, bark: { light: '#a76f3e', mid: '#7b4d26', dark: '#573417' } },
    mangrove:  { soft: 5, coreHalf: 4, ry: 10, canopy: { deep: '#173d17', base: '#2c5c1e', mid: '#4c9636', top: '#78c24a', hi: '#9ad85e' }, bark: { light: '#7a5636', mid: '#5a3f28', dark: '#38251a' } },
    cypress:   { soft: 6, coreHalf: 3, ry: 12, canopy: { deep: '#2a4420', base: '#35502a', mid: '#5c7d3a', top: '#8aa74e', hi: '#b0b06a' }, bark: { light: '#8a6a54', mid: '#5a4030', dark: '#3a2a1f' }, moss: '#9fb488' },
    pine:      { soft: 4, coreHalf: 3, ry: 12, canopy: { deep: '#123a20', base: '#1f4a2b', mid: '#2f6b3a', top: '#55915a', hi: '#9ecf8e' }, bark: { light: '#7a5236', mid: '#5a3a24', dark: '#3a2416' } },
    broadleaf: { soft: 7, coreHalf: 4, ry: 12, canopy: { deep: '#123a17', base: '#1f5322', mid: '#3d8a36', top: '#63b544', hi: '#9be05a' }, bark: { light: '#8a6a42', mid: '#63482c', dark: '#3a2a1a' }, vine: '#3d7f2a', flower: '#ff5f9e' },
  };

  const MUTATIONS = [
    { id: 'wings',   name: 'MIGHTY WINGS',   desc: 'FLAP 25% STRONGER',            diet: 'berry', icon: SPR.WING_UP },
    { id: 'hollow',  name: 'HOLLOW BONES',   desc: 'FALL 18% SLOWER',              diet: 'berry', icon: SPR.FEATHER },
    { id: 'rudder',  name: 'TAIL RUDDER',    desc: 'DIVE SPEED CAPPED',            diet: 'berry', icon: SPR.TAIL_BIG },
    { id: 'glide',   name: 'GLIDER WING',    desc: 'HOLD FLAP TO GLIDE',           diet: 'berry', icon: SPR.CLOUD3 },
    { id: 'beak',    name: 'WIDE BEAK',      desc: 'BIGGER CATCH RANGE',           diet: 'nut',   icon: SPR.BEAK_B },
    { id: 'gut',     name: 'RAPID GUT',      desc: 'DIGEST 35% FASTER',            diet: 'bug',   icon: SPR.GRUB },
    { id: 'crop',    name: 'CROP POUCH',     desc: 'STASH A SECOND FOOD',          diet: 'nut',   icon: SPR.NUT },
    { id: 'gizzard', name: 'IRON GIZZARD',   desc: 'NUTS DIGEST FAST +VALUE',      diet: 'nut',   icon: SPR.NUT },
    { id: 'downy',   name: 'DOWNY PLUME',    desc: '+1 HEART, FULLY MENDED',       diet: 'any',   icon: SPR.HEART, repeat: true },
    { id: 'sweet',   name: 'SWEET TOOTH',    desc: 'FRUIT +50% VALUE',             diet: 'berry', icon: SPR.MANGO },
    { id: 'snatch',  name: 'BUG SNATCHER',   desc: 'BUGS DRIFT TO BEAK',           diet: 'bug',   icon: SPR.BUG1 },
    { id: 'shield',  name: 'FEATHER SHIELD', desc: 'BLOCK FIRST HIT / LEG',        diet: 'any',   icon: SPR.HEART_EMPTY },
    { id: 'stomach', name: 'SECOND STOMACH', desc: 'OVERFULL LIMIT +40%',          diet: 'nut',   icon: SPR.TUMMY },
  ];

  const DEATHS = {
    tree: 'SPLINTERED ON AN ANCIENT TREE', pine: 'IMPALED ON A PINE SPIRE',
    mangrove: 'TANGLED IN THE MARSH ROOTS', cypress: 'SWALLOWED BY THE MIRE',
    broadleaf: 'LOST IN THE JUNGLE CANOPY', rock: 'DASHED AGAINST THE STORM CRAGS',
    water: 'THE HUNGRY SEA CLAIMED DARWIN', snake: 'SWALLOWED BY A CANOPY SERPENT',
    snapper: 'DRAGGED UNDER BY A BOG SNAPPER', hawk: 'SNATCHED FROM THE SKY BY A HAWK',
  };

  // ---------- persistent best ----------
  function loadBest() {
    try { return JSON.parse(localStorage.getItem('flappyDarwinBest')) || { score: 0, depth: 0, evos: 0 }; }
    catch (e) { return { score: 0, depth: 0, evos: 0 }; }
  }
  function saveBest(b) { try { localStorage.setItem('flappyDarwinBest', JSON.stringify(b)); } catch (e) { /* private */ } }
  let best = loadBest();

  // ---------- game state ----------
  let STATE = 'title'; // title | fly | island | over
  let paused = false;
  let time = 0;
  let freezeT = 0;
  let slowT = 0;
  let flashT = 0;
  const SLOW_SCALE = 0.35;
  const shake = { t: 0, mag: 0 };

  let run = null, bird = null, world = null, ui = {};
  let parts = [], floats = [];
  let newBestFlag = false;

  function slowmo(d) { slowT = Math.max(slowT, d); }
  function shakeIt(mag, dur) { shake.mag = Math.max(shake.mag, mag); shake.t = Math.max(shake.t, dur); }

  function newRun() {
    run = {
      depth: 0, score: 0, scorePop: 0,
      evo: 0, evoNeed: 60, evolutions: 0,
      taken: [], diet: { berry: 0, seed: 0, nut: 0, bug: 0, gold: 0 },
      foodEaten: 0, obstaclesPassed: 0, evoReadyPinged: false,
      tut: { flap: true, catch: true, digest: true, snake: true, snapper: true, hawk: true },
    };
    bird = {
      x: BIRD_X, y: 84, vy: 0, rot: 0,
      hearts: 3, maxHearts: 3, invuln: 0,
      carried: null, crop: null, digestT: 0, digestNeed: 0,
      fullness: 0, stuffed: false,
      flapT: 0, animT: 0, blinkT: rnd(1.5, 4), blinking: 0, openT: 0,
      catchPop: 0, grazeActive: 0, grazeCd: 0,
      glideHeld: false, shieldUp: false, dead: false, deathBy: null,
      legsDown: false, glidePose: false,
    };
    newBestFlag = false;
    parts = []; floats = [];
    newLeg('meadow');
  }

  function has(id) { return run.taken.indexOf(id) !== -1; }

  function stats() {
    let flap = -172, grav = 560, maxFall = 210, catchR = 6, digestMul = 1, cap = 70;
    if (has('wings')) flap *= 1.25;
    if (has('hollow')) grav *= 0.82;
    if (has('rudder')) maxFall *= 0.7;
    if (has('beak')) catchR += 3;
    if (has('gut')) digestMul *= 0.65;
    if (has('stomach')) cap *= 1.4;
    if (bird.stuffed) { flap *= 0.88; grav *= 1.18; }
    return {
      flap: flap, grav: grav, maxFall: maxFall, catchR: catchR, digestMul: digestMul,
      cap: cap, glide: has('glide'), cropSlots: has('crop') ? 1 : 0,
    };
  }

  function newLeg(biomeKey) {
    run.depth++;
    const d = run.depth;
    const biome = BIOMES[biomeKey];
    const hasPred = biome.hazards.length > 0;
    world = {
      biomeKey: biomeKey, biome: biome,
      dist: 0,
      speed: d === 1 ? 42 : Math.min(84, 46 + (d - 1) * 3.0),
      spacing: Math.max(90, (biome.dense ? 108 : 118) - d * 1.6),
      gapH: Math.max(40, biome.gapBase - (d - 1) * 0.9),
      legLen: (d === 1 ? 6 : Math.min(20, 6 + d * 2)) - (hasPred ? 1 : 0),
      spawned: 0, nextSpawnX: W + (d === 1 ? 110 : 60),
      obstacles: [], foods: [], snappers: [], hawk: null,
      phase: 'fly', island: null, cine: null,
      banner: 2.4, fade: 1,
      gust: null, gustTimer: biome.wind ? rnd(2.5, 4.5) : -1,
      snapperTimer: biome.hazards.indexOf('snapper') >= 0 ? rnd(3.5, 6) : -1,
      hawkTimer: biome.hazards.indexOf('hawk') >= 0 ? rnd(4, 7) : -1,
      legDiet: { berry: 0, seed: 0, nut: 0, bug: 0, gold: 0 },
      cam: { scale: 1, focusX: W / 2, focusY: H / 2, kickX: 0, kickY: 0 },
    };
    bird.x = BIRD_X; bird.y = 84; bird.vy = 0; bird.rot = 0; bird.dead = false;
    bird.shieldUp = has('shield'); bird.invuln = 0.8; bird.legsDown = false; bird.glidePose = false;
    STATE = 'fly';
  }

  // ---------- input ----------
  let flapQueued = false, actionQueued = false;

  function press() {
    AUDIO.unlock();
    if (STATE === 'title') { AUDIO.play('confirm'); newRun(); return; }
    if (STATE === 'over') { if (ui.overT > 0.7) { AUDIO.play('confirm'); STATE = 'title'; } return; }
    if (paused) { paused = false; return; }
    if (STATE === 'fly') {
      if (world.phase === 'fly') flapQueued = true;
      else if (world.phase === 'cine') skipCine();
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
    if (e.code === 'KeyR' && (STATE === 'over' || STATE === 'fly' || STATE === 'island')) { AUDIO.play('confirm'); STATE = 'title'; return; }
    if (STATE === 'island' && ui.cards) {
      if (e.code === 'ArrowLeft' || e.code === 'KeyA') { ui.sel = (ui.sel + ui.cards.length - 1) % ui.cards.length; AUDIO.play('select'); }
      if (e.code === 'ArrowRight' || e.code === 'KeyD') { ui.sel = (ui.sel + 1) % ui.cards.length; AUDIO.play('select'); }
      if (e.code === 'Enter') actionQueued = true;
    } else if (e.code === 'Enter') { if (!e.repeat) press(); }
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
          if (ui.sel === i) actionQueued = true;
          else { ui.sel = i; AUDIO.play('select'); }
          return;
        }
      }
      return;
    }
    press();
    if (bird) bird.glideHeld = true;
  });
  window.addEventListener('pointerup', function () { if (bird) bird.glideHeld = false; });

  // ---------- particles / floats ----------
  function spawnParts(n, fn) { for (let i = 0; i < n; i++) parts.push(fn(i)); }
  function feather(x, y) { return { type: 'feather', x: x, y: y, vx: rnd(-25, -5), vy: rnd(-20, 10), g: 26, t: 0, life: rnd(0.5, 1.1), color: pick(['#9a6c41', '#77502e', '#d9c39a']) }; }
  function crumb(x, y, color) { return { type: 'crumb', x: x, y: y, vx: rnd(-20, 25), vy: rnd(-45, -10), g: 130, t: 0, life: rnd(0.4, 0.8), color: color }; }
  function sparkle(x, y, color) { return { type: 'sparkle', x: x, y: y, vx: rnd(-8, 8), vy: rnd(-14, 2), g: 0, t: 0, life: rnd(0.4, 0.9), color: color || '#fff3a8' }; }
  function puff(x, y) { return { type: 'puff', x: x, y: y, vx: rnd(-30, -12), vy: rnd(-6, 6), g: -8, t: 0, life: rnd(0.25, 0.5), color: 'rgba(255,255,255,0.85)' }; }
  function dust(x, y, color) { return { type: 'puff', x: x, y: y, vx: rnd(-24, 24), vy: rnd(-20, -4), g: 40, t: 0, life: rnd(0.3, 0.6), color: color || 'rgba(214,190,138,0.85)' }; }
  function splashP(x, y) { return { type: 'crumb', x: x, y: y, vx: rnd(-45, 45), vy: rnd(-130, -40), g: 300, t: 0, life: rnd(0.4, 0.9), color: pick(['#68b7cf', '#a8e4f2', '#ffffff']) }; }
  function bubble(x, y) { return { type: 'bubble', x: x, y: y, vx: rnd(-6, 6), vy: rnd(-24, -12), g: 0, t: 0, life: rnd(0.5, 1.1), color: 'rgba(168,228,242,0.7)' }; }
  function streak(y) { return { type: 'streak', x: W + 10, y: y, vx: -rnd(240, 340), vy: 0, g: 0, t: 0, life: 1.0, color: 'rgba(255,255,255,0.5)' }; }
  function leaf(x, y, color) { return { type: 'leaf', x: x, y: y, vx: rnd(-55, -25), vy: rnd(-14, 22), g: 20, t: 0, life: rnd(0.6, 1.4), color: color }; }
  function scaleP(x, y, color) { return { type: 'leaf', x: x, y: y, vx: rnd(-40, 20), vy: rnd(-40, -10), g: 120, t: 0, life: rnd(0.4, 0.9), color: color }; }
  function addFloat(x, y, str, color, big) { floats.push({ x: x, y: y, str: str, color: color || '#ffffff', t: 0, life: 1.3, big: !!big }); }

  // ---------- food & digestion ----------
  function spawnFoodAt(x) {
    const b = world.biome;
    const entries = [];
    for (const k in b.foods) entries.push({ v: k, w: b.foods[k] });
    const kind = pickWeighted(entries);
    const def = FOODS[kind];
    const count = (def.moves && !def.hop && Math.random() < 0.45) ? irnd(2, 3) : 1;
    for (let i = 0; i < count; i++) {
      world.foods.push({
        kind: kind, def: def,
        x: x + rnd(-10, 10) + i * 9,
        baseY: rnd(34, SEA_Y - 26), y: 0,
        phase: rnd(0, 6.28), wander: rnd(0, 6.28), hopT: rnd(0, 1.4), vy: 0,
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
      if (run.tut.digest) { run.tut.digest = false; addFloat(bird.x, bird.y - 22, 'DIGESTING... WAIT!', '#a8e4f2'); }
    }
    AUDIO.play('catch'); AUDIO.play('pop');
    bird.openT = 0.18; bird.catchPop = 0.18; freezeT = Math.max(freezeT, 0.05);
    spawnParts(8, function (i) { const a = i / 8 * 6.28; return { type: 'sparkle', x: f.x + Math.cos(a) * 4, y: f.y + Math.sin(a) * 4, vx: Math.cos(a) * 30, vy: Math.sin(a) * 30, g: 0, t: 0, life: 0.4, color: '#ffffff' }; });
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
    if (def.bucket === 'berry' && has('sweet')) nutr = Math.round(nutr * 1.5);
    if (kind === 'nut' && has('gizzard')) nutr = Math.round(nutr * 1.25);
    bird.carried = null;
    run.diet[def.bucket]++; world.legDiet[def.bucket]++;
    run.foodEaten++; run.score += nutr; run.scorePop = 0.25;
    run.evo += nutr; bird.fullness += nutr;
    AUDIO.play('gulp');
    addFloat(beakPos().x + 4, bird.y - 12, '+' + nutr, kind === 'gold' ? '#fff3a8' : '#96d454', nutr >= 24);
    const col = def.bucket === 'berry' ? '#e0525c' : (kind === 'gold' ? '#f6c945' : (def.bucket === 'bug' ? '#3e7a2e' : '#a76f3e'));
    spawnParts(5, function () { return crumb(bird.x + 8, bird.y, col); });
    if (bird.fullness > st.cap && !bird.stuffed) { bird.stuffed = true; AUDIO.play('stuffed'); addFloat(bird.x, bird.y - 20, 'STUFFED!', '#e0525c'); }
    if (run.evo >= run.evoNeed && !run.evoReadyPinged) { run.evoReadyPinged = true; AUDIO.play('evoReady'); addFloat(bird.x, bird.y - 26, 'EVOLUTION READY!', '#3fc0b0'); }
    if (bird.crop) { const k = bird.crop; bird.crop = null; startDigest(k, st); }
  }

  function dropFood() {
    if (!bird.carried && !bird.crop) return;
    const bp = beakPos();
    spawnParts(5, function () { return crumb(bp.x, bp.y, '#e5c28c'); });
    if (bird.carried) addFloat(bird.x, bird.y - 16, 'DROPPED!', '#e0525c');
    bird.carried = null; bird.crop = null;
  }

  // ---------- soft collision ----------
  const HX = 5, HY = 4, SOFT_TOP = 6, GRAZE_NUDGE = 42;
  const DBG = { graze: 0, hurtTree: 0, hurtWater: 0, hurtPred: 0 };
  let _grazeSfx = 0;
  function grazeSoft(surfaceY, dir) {
    DBG.graze++;
    if (dir > 0) { bird.y = surfaceY - 4; bird.vy = bird.vy > 0 ? -GRAZE_NUDGE : Math.max(bird.vy, -GRAZE_NUDGE); }
    else { bird.y = surfaceY + 4; bird.vy = bird.vy < 0 ? GRAZE_NUDGE * 0.6 : Math.min(bird.vy, GRAZE_NUDGE * 0.6); }
    bird.grazeActive = 0.06;
    if (time - _grazeSfx > 0.16) {
      _grazeSfx = time; AUDIO.play('rustle'); shakeIt(0.6, 0.08);
      const lc = ['#3d7f2a', '#5cad3c', '#96d454'];
      spawnParts(4, function () { return leaf(bird.x + rnd(-4, 6), surfaceY + rnd(-2, 2), pick(lc)); });
    }
  }

  // ---------- damage ----------
  function hurt(source, opts) {
    opts = opts || {};
    if (bird.invuln > 0 || bird.dead) return;
    if (bird.shieldUp) {
      bird.shieldUp = false; bird.invuln = 1.0;
      AUDIO.play('shield');
      addFloat(bird.x, bird.y - 16, 'SHIELD!', '#a8e4f2');
      spawnParts(8, function () { return sparkle(bird.x, bird.y, '#a8e4f2'); });
      return;
    }
    if (source === 'water') DBG.hurtWater++;
    else if (source === 'snake' || source === 'snapper' || source === 'hawk') DBG.hurtPred++;
    else DBG.hurtTree++;
    bird.hearts--; bird.invuln = 1.8; dropFood();
    AUDIO.play(opts.sfx || 'hit');
    shakeIt(opts.shake || 2.4, opts.shakeDur || 0.28);
    freezeT = Math.max(freezeT, opts.freeze || 0.10);
    if (opts.flash) flashT = opts.flash;
    spawnParts(opts.feathers || 8, function () { return feather(bird.x, bird.y); });
    if (bird.hearts <= 0) {
      bird.dead = true; bird.deathBy = source; bird.vy = -140;
      freezeT = 0.14; shakeIt(4, 0.5); AUDIO.play('die');
    } else {
      bird.vy = (opts.knockVy != null ? opts.knockVy : -110);
    }
  }

  function gameOver() {
    if (run.score > best.score) newBestFlag = true;
    best = { score: Math.max(best.score, run.score), depth: Math.max(best.depth, run.depth), evos: Math.max(best.evos, run.evolutions) };
    saveBest(best);
    ui = { overT: 0 };
    STATE = 'over';
  }

  // threat budget — never arm two predators / a gust at once
  function threatFree() {
    if (world.gust && world.gust.t < world.gust.warn + world.gust.dur) return false;
    for (const o of world.obstacles) if (o.snake && (o.snake.state === 'windup' || o.snake.state === 'strike')) return false;
    for (const s of world.snappers) if (s.state === 'telegraph' || s.state === 'lunge') return false;
    if (world.hawk && (world.hawk.state === 'warn' || world.hawk.state === 'swoop')) return false;
    return true;
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
      cards.push({ kind: 'mut', mut: m, title: m.name, lines: wrap(m.desc, 13), icon: m.icon });
    }
    return cards;
  }

  function makePathCards() {
    let keys = BIOME_KEYS.filter(function (k) { return k !== world.biomeKey; });
    if (run.depth < 3) keys = keys.filter(function (k) { return BIOMES[k].danger < 3; });
    for (let i = keys.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); const t = keys[i]; keys[i] = keys[j]; keys[j] = t; }
    // bias toward higher danger as depth climbs
    keys.sort(function (a, b) { return (BIOMES[b].danger - BIOMES[a].danger) * (Math.random() < clamp(run.depth / 8, 0.1, 0.7) ? 1 : -0.3); });
    const options = [];
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
    if (m.id === 'downy') { bird.maxHearts = Math.min(5, bird.maxHearts + 1); bird.hearts = bird.maxHearts; AUDIO.play('heart'); }
    AUDIO.play('evolve');
    freezeT = 0.12; shakeIt(1.5, 0.30); ui.flash = 0.35;
    addFloat(bird.x, bird.y - 24, 'EVOLVED!', '#3fc0b0', true);
    spawnParts(28, function () { return sparkle(bird.x + rnd(-16, 16), bird.y + rnd(-16, 10), '#3fc0b0'); });
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
        let gh = world.gapH;
        if (run.depth === 1 && world.spawned < 2) gh += 14; // tutorial
        const snakeRoll = world.biome.hazards.indexOf('snake') >= 0 &&
          world.spawned > 0 && (world.biomeKey === 'swamp' ? 0.35 : 0.30) > Math.random();
        if (snakeRoll) gh += 8; // snake replaces threading; widen the safe lane
        const gapY = rnd(margin + gh / 2, SEA_Y - 22 - gh / 2 - margin * 0.4);
        const o = {
          x: world.nextSpawnX, gapY: gapY, gapH: gh, w: 26,
          seed: irnd(1, 99999), passed: false, kind: world.biome.obst,
          variant: world.biome.tree, snake: null,
        };
        if (world.biome.tree && TREES[world.biome.tree]) { o.soft = TREES[world.biome.tree].soft; o.coreHalf = TREES[world.biome.tree].coreHalf; }
        else { o.soft = 0; o.coreHalf = 13; }
        // attach a snake to the top canopy (guard adjacency + threat budget deferred to update)
        if (snakeRoll) {
          const prevSnake = world.obstacles.some(function (p) { return p.snake; });
          if (!prevSnake) o.snake = { state: 'dormant', t: 0, lockY: 0, spent: false, first: run.tut.snake };
        }
        world.obstacles.push(o);
        const fp = (run.depth === 1) ? 1.0 : 0.85;
        const fp2 = (run.depth === 1) ? 0.5 : 0.25;
        if (Math.random() < fp) spawnFoodAt(world.nextSpawnX + world.spacing * 0.5);
        if (Math.random() < fp2) spawnFoodAt(world.nextSpawnX + world.spacing * 0.72);
        world.spawned++;
        world.nextSpawnX += world.spacing;
      }
      if (world.spawned >= world.legLen && world.obstacles.length === 0) enterCine();
    }

    // wind gusts
    if (world.gustTimer > 0 && world.phase === 'fly') {
      world.gustTimer -= dt;
      if (world.gustTimer <= 0) {
        if (threatFree()) { world.gust = { t: 0, warn: 0.9, dur: 1.3, dir: pick([-1, -1, 1]) }; AUDIO.play('wind'); }
        else world.gustTimer = 0.5;
      }
    }
    if (world.gust) {
      const g = world.gust;
      g.t += dt;
      if (g.t > g.warn && g.t < g.warn + g.dur) {
        bird.vy += 95 * g.dir * dt * (g.dir < 0 ? 1.4 : 1.9);
        if (Math.random() < 0.5) parts.push(streak(rnd(10, SEA_Y - 6)));
      } else if (g.t >= g.warn + g.dur) { world.gust = null; world.gustTimer = rnd(3.5, 6.5); }
    }

    // bird physics
    if (!bird.dead && world.phase === 'fly') {
      if (flapQueued) {
        flapQueued = false;
        bird.vy = st.flap; bird.flapT = 0.24;
        AUDIO.play('flap');
        parts.push(puff(bird.x - 6, bird.y + 5));
        if (Math.random() < 0.3) parts.push(feather(bird.x - 4, bird.y + 3));
      }
      let grav = st.grav, maxFall = st.maxFall;
      bird.glidePose = false;
      if (st.glide && bird.glideHeld && bird.vy > 0) { grav *= 0.35; maxFall *= 0.42; bird.glidePose = true; }
      bird.vy = Math.min(bird.vy + grav * dt, maxFall);
      bird.y += bird.vy * dt;
      if (bird.y < 6) { bird.y = 6; bird.vy = Math.max(bird.vy, 0); }
      bird.rot = clamp(bird.vy / 300, -0.45, 0.9) * 0.7;
    } else if (bird.dead) {
      bird.vy = Math.min(bird.vy + 700 * dt, 320);
      bird.y += bird.vy * dt;
      bird.rot += dt * 6;
      if (bird.y > SEA_Y + 6) { AUDIO.play('splash'); spawnParts(14, function () { return splashP(bird.x, SEA_Y); }); gameOver(); return; }
    }

    // obstacles: scroll, pass, soft/solid collide
    const bx0 = bird.x - HX, bx1 = bird.x + HX, by0 = bird.y - HY, by1 = bird.y + HY;
    for (let i = world.obstacles.length - 1; i >= 0; i--) {
      const o = world.obstacles[i];
      const sx = o.x - world.dist;
      if (!o.passed && sx + o.w < bird.x - 8) {
        o.passed = true; run.obstaclesPassed++; run.score += 10; run.scorePop = 0.25; AUDIO.play('point');
        const tH = o.gapY - o.gapH / 2, bY = o.gapY + o.gapH / 2;
        if (by0 - tH < 7 || bY - by1 < 7) { AUDIO.play('whoosh'); parts.push(streak(bird.y)); }
        const col = o.kind === 'rock' ? '#c9d2e0' : '#5cad3c';
        spawnParts(2, function () { return leaf(sx + o.w, o.gapY, col); });
      }
      if (sx + o.w < -40) { world.obstacles.splice(i, 1); continue; }
      if (bird.dead) continue;
      if (bx1 <= sx || bx0 >= sx + o.w) continue;
      const topH = o.gapY - o.gapH / 2, botY = o.gapY + o.gapH / 2, cx = sx + o.w / 2;
      if (o.kind === 'rock') { if (bird.invuln <= 0 && (by0 < topH || by1 > botY)) hurt('rock'); continue; }
      const overCore = bx1 > cx - o.coreHalf && bx0 < cx + o.coreHalf;
      if (by1 > botY) {
        if (overCore && (by1 - botY) > o.soft) { if (bird.invuln <= 0) hurt(o.kind); }
        else grazeSoft(botY, +1);
      }
      if (by0 < topH && topH > 2) {
        if (overCore && (topH - by0) > SOFT_TOP) { if (bird.invuln <= 0) hurt(o.kind); }
        else grazeSoft(topH, -1);
      }
    }

    // predators
    updateSnakes(dt);
    updateSnappers(dt);
    updateHawk(dt);

    // sea contact
    if (!bird.dead && bird.y + 5 > SEA_Y && world.phase === 'fly') {
      spawnParts(10, function () { return splashP(bird.x, SEA_Y); });
      AUDIO.play('splash');
      if (bird.hearts > 1 || bird.shieldUp) { hurt('water'); bird.y = SEA_Y - 6; bird.vy = -200; }
      else { bird.hearts = 0; bird.dead = true; bird.deathBy = 'water'; gameOver(); return; }
    }

    // foods
    for (let i = world.foods.length - 1; i >= 0; i--) {
      const f = world.foods[i];
      if (f.def.moves) {
        const sp = f.def.slow ? 1.2 : 2.1;
        f.wander += dt * sp;
        f.baseY += Math.sin(f.wander) * 14 * dt;
        if (f.def.hop) {
          f.hopT -= dt;
          if (f.hopT <= 0) { f.vy = -70; f.hopT = rnd(1.0, 1.8); }
          f.vy += 240 * dt; f.baseY += f.vy * dt;
        }
        f.baseY = clamp(f.baseY, 26, SEA_Y - 20);
        if (has('snatch') && f.def.bucket === 'bug' && !bird.dead) {
          const bp = beakPos();
          const dx = bp.x - f.x, dy = bp.y - f.baseY, d2 = dx * dx + dy * dy;
          if (d2 < 45 * 45 && d2 > 4) { const d = Math.sqrt(d2); f.x += dx / d * 55 * dt; f.baseY += dy / d * 55 * dt; }
        }
      }
      f.x -= world.speed * dt;
      f.y = f.baseY + Math.sin(time * 3 + f.phase) * 4;
      if (f.def.sparkle && Math.random() < 0.12) parts.push(sparkle(f.x + rnd(-4, 4), f.y + rnd(-5, 3)));
      if (f.x < -12) { world.foods.splice(i, 1); continue; }
      if (!bird.dead && tryCatch(f, st)) world.foods.splice(i, 1);
    }

    // digestion
    if (bird.carried && !bird.dead) { bird.digestT += dt; if (bird.digestT >= bird.digestNeed) finishDigest(st); }
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
    bird.catchPop = Math.max(0, bird.catchPop - dt);
    bird.grazeActive = Math.max(0, bird.grazeActive - dt);
    bird.animT += dt;
    bird.blinkT -= dt;
    if (bird.blinkT <= 0) { bird.blinking = 0.12; bird.blinkT = rnd(1.8, 4.5); }
    bird.blinking = Math.max(0, bird.blinking - dt);
    if (run) run.scorePop = Math.max(0, run.scorePop - dt);
  }

  // ---------- predators ----------
  function drawAim(hx, hy, tx, ty, col, ph) {
    ctx.fillStyle = col;
    for (let i = 1; i <= 3; i++) {
      const t = i / 4 + (ph % 1) * 0.08;
      const px = lerp(hx, tx, t), py = lerp(hy, ty, t);
      const s = 3 - i * 0.6;
      ctx.fillRect(Math.round(px - s / 2), Math.round(py - s / 2), Math.ceil(s), Math.ceil(s));
    }
  }

  function updateSnakes(dt) {
    const WINDUP = 0.75, STRIKE = 0.14, RECOIL = 0.30, REACH = 26;
    for (const o of world.obstacles) {
      const s = o.snake;
      if (!s || s.state === 'spent') continue;
      const ax = o.x - world.dist + o.w * 0.7;
      const topH = o.gapY - o.gapH / 2, botY = o.gapY + o.gapH / 2;
      s.ax = ax; s.restY = topH + 4; s.topH = topH; s.botY = botY;
      if (s.state === 'dormant') {
        const wu = WINDUP * (s.first ? 1.4 : 1);
        if (!s.spent && ax > BIRD_X && ax <= BIRD_X + 8 + world.speed * wu && threatFree()) {
          s.state = 'windup'; s.t = 0; s.wu = wu;
          s.lockY = clamp(bird.y, topH + 2, botY - 2);
          AUDIO.play('snakeHiss');
          if (s.first) { run.tut.snake = false; addFloat(ax, topH - 10, 'SNAKE! CLIMB OR DIP', '#c7d94a'); }
        }
      } else if (s.state === 'windup') {
        s.t += dt;
        if (s.t >= s.wu) { s.state = 'strike'; s.t = 0; AUDIO.play('snakeStrike'); }
      } else if (s.state === 'strike') {
        s.t += dt;
        const k = easeOutCubic(s.t / STRIKE);
        const apexX = clamp(BIRD_X, ax - REACH, ax + 4);
        s.headX = lerp(ax, apexX, k);
        s.headY = lerp(s.restY, s.lockY, k);
        if (!bird.dead && bird.invuln <= 0 && s.t > 0.03 && s.t < 0.13 && !s.first) {
          if (Math.abs(s.headX - bird.x) < 9 && Math.abs(s.headY - bird.y) < 8) {
            hurt('snake', { sfx: 'chomp', shake: 4, shakeDur: 0.40, freeze: 0.12, flash: 0.14, feathers: 10, knockVy: 110 });
            spawnParts(3, function () { return scaleP(bird.x, bird.y, '#3e7a2e'); });
            s.hit = true;
          }
        }
        if (s.t >= STRIKE) {
          s.state = 'recoil'; s.t = 0;
          if (!s.hit) {
            const d = Math.abs((s.lockY) - bird.y);
            if (d >= 8 && d <= 20) { slowmo(0.16); AUDIO.play('whoosh'); parts.push(streak(bird.y)); addFloat(bird.x, bird.y - 16, 'WHIFF! +5', '#c7d94a'); run.score += 5; }
            else AUDIO.play('snakeWhiff');
          }
        }
      } else if (s.state === 'recoil') {
        s.t += dt;
        const k = easeInOutCubic(s.t / RECOIL);
        const apexX = clamp(BIRD_X, ax - REACH, ax + 4);
        s.headX = lerp(apexX, ax, k);
        s.headY = lerp(s.lockY, s.restY, k);
        if (s.t >= RECOIL) { s.state = 'spent'; s.spent = true; }
      }
    }
  }

  function updateSnappers(dt) {
    if (world.snapperTimer > 0 && world.phase === 'fly') {
      world.snapperTimer -= dt;
      if (world.snapperTimer <= 0) {
        world.snappers.push({ worldX: world.dist + W + 20, state: 'lurk', t: 0, bob: rnd(0, 6.28), first: run.tut.snapper });
        world.snapperTimer = rnd(4, 7);
      }
    }
    const TELE = 0.6, LUNGE = 0.18, RETRACT = 0.25, APEX = 126;
    for (let i = world.snappers.length - 1; i >= 0; i--) {
      const s = world.snappers[i];
      s.sx = s.worldX - world.dist;
      s.bob += dt * 3;
      if (s.sx < BIRD_X - 30 || s.sx < -20) { world.snappers.splice(i, 1); continue; }
      if (s.state === 'lurk') {
        if (Math.random() < 0.04) parts.push(bubble(s.sx, SEA_Y - 2));
        if (s.sx <= BIRD_X + 40 && s.sx > BIRD_X - 2 && threatFree()) {
          s.state = 'telegraph'; s.t = 0; AUDIO.play('snapperRise');
          if (s.first) { run.tut.snapper = false; addFloat(s.sx, SEA_Y - 22, 'SNAPPER! STAY HIGH', '#3a6b4a'); }
        }
      } else if (s.state === 'telegraph') {
        s.t += dt;
        if (Math.random() < 0.4) parts.push(bubble(s.sx + rnd(-4, 4), SEA_Y - 2));
        if (s.t >= TELE * (s.first ? 1.4 : 1)) { s.state = 'lunge'; s.t = 0; AUDIO.play('chomp'); }
      } else if (s.state === 'lunge') {
        s.t += dt;
        const k = easeOutCubic(s.t / LUNGE);
        s.mawY = lerp(SEA_Y, APEX, k);
        if (!bird.dead && bird.invuln <= 0 && s.t > 0.04 && s.t < 0.16 && !s.first) {
          if (Math.abs(s.sx - bird.x) < 11 && (bird.y + 4) > APEX) {
            hurt('snapper', { sfx: 'chomp', shake: 4, shakeDur: 0.40, freeze: 0.12, flash: 0.14, feathers: 9, knockVy: -150 });
            spawnParts(10, function () { return splashP(bird.x, APEX); });
            s.hit = true;
          }
        }
        if (s.t >= LUNGE) { s.state = 'retract'; s.t = 0; if (!s.hit) AUDIO.play('snapperMiss'); spawnParts(8, function () { return splashP(s.sx, SEA_Y); }); }
      } else if (s.state === 'retract') {
        s.t += dt;
        s.mawY = lerp(APEX, SEA_Y, easeInOutCubic(s.t / RETRACT));
        if (s.t >= RETRACT) s.state = 'spent';
      }
    }
  }

  function updateHawk(dt) {
    if (world.hawkTimer > 0 && world.phase === 'fly' && !world.hawk) {
      world.hawkTimer -= dt;
      if (world.hawkTimer <= 0) {
        if (threatFree()) { world.hawk = { state: 'warn', t: 0, lockY: bird.y, first: run.tut.hawk }; AUDIO.play('hawkScreech'); if (world.hawk.first) { run.tut.hawk = false; addFloat(BIRD_X, bird.y - 22, 'HAWK! DIP LOW', '#7a5a3a'); } }
        else world.hawkTimer = 0.5;
      }
    }
    const h = world.hawk;
    if (!h) return;
    const WARN = 1.0 * (h.first ? 1.4 : 1), SWOOP = 0.5;
    if (h.state === 'warn') {
      h.t += dt;
      if (h.t < 0.3) h.lockY = bird.y;
      if (h.t >= WARN) { h.state = 'swoop'; h.t = 0; AUDIO.play('hawkWhoosh'); }
    } else if (h.state === 'swoop') {
      h.t += dt;
      const k = h.t / SWOOP;
      h.hx = lerp(W + 10, BIRD_X - 30, k);
      h.hy = lerp(-10, h.lockY + 30, k);
      if (!bird.dead && bird.invuln <= 0 && k > 0.18 && k < 0.34 && !h.first) {
        if (Math.abs(h.hx - bird.x) < 10 && Math.abs(h.hy - bird.y) < 9) {
          hurt('hawk', { sfx: 'chomp', shake: 5, shakeDur: 0.45, freeze: 0.14, flash: 0.16, feathers: 12, knockVy: 120 });
          spawnParts(3, function () { return scaleP(bird.x, bird.y, '#7a5a3a'); });
          h.hit = true;
        }
      }
      if (h.t >= SWOOP) { if (!h.hit) { AUDIO.play('whoosh'); } world.hawk = null; }
    }
  }

  // ---------- cutscene + island ----------
  const CINE = { reveal: 0, glide: 0.55, flare: 1.15, touch: 1.60, settle: 1.80, end: 2.55 };
  const ISLAND_REST = 198;

  function buildIsland() {
    return { seed: irnd(1, 99999), x: W + 80, halfW: 40, capY: 100, baseY: SEA_Y, perchDX: -6, perchY: 96, biome: world.biome };
  }

  function enterCine() {
    world.phase = 'cine';
    world.island = buildIsland();
    world.foods.length = 0;
    world.cine = { t: 0, skipped: false, bobT: 0, startX: bird.x, startY: bird.y, startVy: bird.vy };
    bird.glideHeld = false;
  }

  function perchX() { return world.island.x + world.island.perchDX; }
  function landY() { return world.island.perchY; }

  function updateCine(dt) {
    const c = world.cine, isl = world.island, cam = world.cam;
    c.t += dt;
    const t = c.t;
    // island scrolls in and settles
    isl.x = Math.max(ISLAND_REST, isl.x - world.speed * dt * (t < CINE.glide ? 1 : 0.5));
    if (t < CINE.glide) isl.x = Math.max(ISLAND_REST, W + 80 - (W + 80 - ISLAND_REST) * easeOutCubic(t / CINE.glide));

    // camera easing / zoom
    let sc = 1;
    if (t < CINE.glide) sc = lerp(1.0, 1.03, easeOutCubic(t / CINE.glide));
    else if (t < CINE.flare) sc = lerp(1.03, 1.15, easeInOutCubic((t - CINE.glide) / (CINE.flare - CINE.glide)));
    else if (t < CINE.touch) sc = lerp(1.15, 1.22, easeOutCubic((t - CINE.flare) / (CINE.touch - CINE.flare)));
    else if (t < CINE.end) sc = lerp(1.22, 1.06, easeInOutCubic((t - CINE.touch) / (CINE.end - CINE.touch)));
    cam.scale = sc;
    cam.focusX = clamp((perchX() + bird.x) / 2, 110, 200);
    cam.focusY = clamp((landY() + bird.y) / 2, 70, 120);

    const px = perchX() - 4, py = landY();
    if (t < CINE.reveal + 0.001) { /* reveal */ }
    if (t < CINE.glide) {
      bird.vy = lerp(c.startVy, 0, easeOutCubic(t / CINE.glide));
      bird.rot = lerp(bird.rot, 0, dt * 4);
    } else if (t < CINE.flare) {
      const k = easeInOutCubic((t - CINE.glide) / (CINE.flare - CINE.glide));
      bird.x = lerp(c.startX, px - 20, k); bird.y = lerp(c.startY, py - 16, k);
      bird.rot = -0.12; bird.glidePose = true;
      if (t < CINE.glide + dt * 2) AUDIO.play('chirp');
    } else if (t < CINE.touch) {
      const k = easeOutBack((t - CINE.flare) / (CINE.touch - CINE.flare));
      bird.x = lerp(px - 20, px, k); bird.y = lerp(py - 16, py, k);
      bird.rot = lerp(-0.40, 0, k); bird.glidePose = false; bird.flapT = 0.2; bird.legsDown = true;
      if (t < CINE.flare + dt * 2) { AUDIO.play('flare'); spawnParts(3, function () { return feather(bird.x, bird.y); }); }
    } else {
      if (!c.landed) {
        c.landed = true; bird.x = px; bird.y = py; bird.rot = 0; run.score += 50;
        AUDIO.play('land'); AUDIO.play('chirp'); cam.kickY = -1.4;
        spawnParts(7, function () { return dust(bird.x + rnd(-4, 4), py + 6); });
        spawnParts(3, function () { return leaf(bird.x, py, '#5cad3c'); });
      }
      c.bobT += dt;
      bird.y = py + springKick(c.bobT, 26, 8) * 2.2;
      cam.kickY = lerp(cam.kickY, 0, dt * 8);
      if (t >= CINE.settle && !c.cardPinged && Math.random() < 0.3) parts.push(sparkle(rnd(24, 150), rnd(44, 130), '#3fc0b0'));
    }
    if (t >= CINE.end) { c.cardPinged = true; islandArrive(); }
  }

  function skipCine() {
    const c = world.cine;
    if (!c || c.skipped) return;
    c.skipped = true;
    if (!c.landed) { run.score += 50; }
    world.cam.scale = 1; world.cam.kickX = 0; world.cam.kickY = 0;
    bird.x = perchX() - 4; bird.y = landY(); bird.rot = 0; bird.legsDown = true;
    world.island.x = ISLAND_REST;
    AUDIO.play('land');
    islandArrive();
  }

  function islandArrive() {
    STATE = 'island';
    world.cam.scale = 1; world.cam.kickX = 0; world.cam.kickY = 0;
    ui = { phase: 'summary', t: 0, cards: null, sel: 0, cardRects: null, flash: 0 };
  }

  // ---------- update: island ----------
  function updateIsland(dt) {
    ui.t += dt;
    if (ui.flash > 0) ui.flash -= dt;
    updateBirdCosmetics(dt);
    ui.bobT = (ui.bobT || 0) + dt;
    bird.y = landY() + Math.sin(ui.bobT * 2) * 1.2;
    bird.legsDown = true;
    const st = stats();
    if (bird.carried) { bird.digestT += dt * 2; if (bird.digestT >= bird.digestNeed) finishDigest(st); }
    bird.fullness = Math.max(0, bird.fullness - 10 * dt);
    if (bird.stuffed && bird.fullness < st.cap * 0.6) bird.stuffed = false;

    if (ui.phase === 'takeoff') {
      ui.t2 = (ui.t2 || 0) + dt;
      bird.flapT = 0.2; bird.legsDown = false;
      if (ui.t2 > 0.35) {
        bird.x += (60 + ui.t2 * 260) * dt; bird.y -= 34 * dt; bird.rot = -0.15;
        if (Math.random() < 0.4) parts.push(puff(bird.x - 8, bird.y + 4));
      }
      if (bird.x > W + 24) newLeg(ui.nextBiome);
      return;
    }

    if (!actionQueued) return;
    actionQueued = false;
    if (ui.phase === 'summary') {
      if (ui.t < 0.45) return;
      if (run.evo >= run.evoNeed) { ui.phase = 'mutate'; ui.cards = makeMutationCards(); ui.sel = 0; ui.t = 0; AUDIO.play('evoReady'); }
      else { ui.phase = 'path'; ui.cards = makePathCards(); ui.sel = 0; ui.t = 0; }
      return;
    }
    if (ui.phase === 'mutate') {
      if (ui.t < 0.3) return;
      applyMutation(ui.cards[ui.sel].mut);
      ui.phase = 'path'; ui.cards = makePathCards(); ui.sel = 0; ui.t = 0;
      return;
    }
    if (ui.phase === 'path') {
      if (ui.t < 0.3) return;
      AUDIO.play('confirm');
      ui.nextBiome = ui.cards[ui.sel].biomeKey;
      ui.cards = null; ui.phase = 'takeoff'; ui.t = 0;
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
      p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.type === 'feather') p.x += Math.sin(p.t * 9) * 14 * dt;
      if (p.type === 'leaf') p.x += Math.sin(p.t * 7) * 10 * dt;
    }
    for (let i = floats.length - 1; i >= 0; i--) {
      const f = floats[i];
      f.t += dt; f.y -= 14 * dt;
      if (f.t > f.life) floats.splice(i, 1);
    }
    if (shake.t > 0) shake.t -= dt;
  }

  function update(dt) {
    time += dt;
    if (paused) return;
    if (freezeT > 0) { freezeT -= dt; return; }
    if (slowT > 0) { slowT -= dt; dt *= SLOW_SCALE; }
    if (flashT > 0) flashT -= dt * 2;
    if (STATE === 'fly') {
      if (world.phase === 'cine') { updateCine(dt); updateBirdCosmetics(dt); }
      else updateFly(dt);
    }
    else if (STATE === 'island') updateIsland(dt);
    else if (STATE === 'over') { ui.overT += dt; updateBirdCosmetics(dt); }
    else if (STATE === 'title') {
      updateBirdCosmetics(dt);
      ui.demoY = 78 + Math.sin(time * 1.6) * 7;
      if (Math.sin(time * 1.6) > 0.93 && Math.random() < 0.2) bird && (bird.flapT = 0.22);
    }
    updateParts(dt);
    actionQueued = false; flapQueued = false;
  }

  // ---------- render: background ----------
  const SKY = {
    day:    { top: '#69b9e4', bot: '#c9ecf4', sun: '#fff3a8' },
    misty:  { top: '#8fa7b4', bot: '#d5e2e0', sun: '#eef4ff' },
    golden: { top: '#e79a5c', bot: '#f7d79a', sun: '#fff0c0' },
    dusk:   { top: '#6a4c93', bot: '#f2b48c', sun: '#ffb35c' },
    stormy: { top: '#3b4258', bot: '#7a8296', sun: '#c6cfe0' },
    night:  { top: '#12122e', bot: '#37406e', sun: '#e8ecff' },
  };
  const stars = [];
  for (let i = 0; i < 40; i++) stars.push({ x: Math.random() * W, y: Math.random() * 90, tw: Math.random() * 6 });

  let clouds = [];
  (function seedClouds() {
    for (let i = 0; i < 7; i++) clouds.push({ x: Math.random() * (W + 60) - 30, y: rnd(8, 78), spr: pick([SPR.CLOUD1, SPR.CLOUD2, SPR.CLOUD3]), mul: rnd(0.18, 0.4) });
  })();

  const FAR = document.createElement('canvas');
  FAR.width = 480; FAR.height = 26;
  (function () {
    const c = FAR.getContext('2d');
    c.fillStyle = '#7fb2c4';
    let x = 10;
    while (x < 470) {
      const w2 = irnd(24, 60), h2 = irnd(5, 14);
      for (let i = 0; i < w2; i += 2) { const hh = Math.max(1, Math.round(h2 * Math.sin((i / w2) * Math.PI))); c.fillRect(x + i, 26 - hh, 2, hh); }
      if (Math.random() < 0.6) { c.fillRect(x + w2 / 2, 26 - h2 - 3, 1, 3); c.fillRect(x + w2 / 2 - 1, 26 - h2 - 5, 3, 2); }
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
    c.fillStyle = g; c.fillRect(0, 0, W, H);
  })();

  function skyOf() {
    const key = world ? world.biome.sky : 'day';
    return SKY[key] || SKY.day;
  }

  function drawBackground(scrollX) {
    const tier = skyOf();
    for (let i = 0; i < 9; i++) { ctx.fillStyle = mixColor(tier.top, tier.bot, i / 8); ctx.fillRect(0, i * 20, W, 20); }
    const night = world && world.biome.sky === 'night';
    ctx.fillStyle = tier.sun;
    if (night) {
      ctx.beginPath(); ctx.arc(262, 26, 9, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = mixColor(tier.top, tier.bot, 0.3);
      ctx.beginPath(); ctx.arc(258, 23, 7, 0, Math.PI * 2); ctx.fill();
      for (const s of stars) { const a = 0.4 + 0.6 * Math.abs(Math.sin(time * 1.5 + s.tw)); ctx.fillStyle = 'rgba(255,255,255,' + a.toFixed(2) + ')'; ctx.fillRect(Math.round(s.x), Math.round(s.y), 1, 1); }
    } else {
      ctx.beginPath(); ctx.arc(258, 30, 11, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 0.35; ctx.beginPath(); ctx.arc(258, 30, 15, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
    }
    ctx.globalAlpha = 0.5;
    const fx = Math.floor((scrollX * 0.08) % 480);
    ctx.drawImage(FAR, -fx, SEA_Y - 26); ctx.drawImage(FAR, -fx + 480, SEA_Y - 26);
    ctx.globalAlpha = 1;
    for (const cl of clouds) {
      let x = cl.x - scrollX * cl.mul;
      x = ((x % (W + 80)) + (W + 80)) % (W + 80) - 40;
      ctx.globalAlpha = 0.85; ctx.drawImage(cl.spr, Math.round(x), Math.round(cl.y)); ctx.globalAlpha = 1;
    }
    if (world && world.biome.sky === 'misty') { ctx.fillStyle = 'rgba(220,230,235,0.14)'; ctx.fillRect(0, 40, W, SEA_Y - 40); }
    if (world && world.biome.sky === 'stormy' && Math.random() < 0.008) { ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.fillRect(0, 0, W, H); }
  }

  function drawSea() {
    ctx.fillStyle = '#2e6f8e'; ctx.fillRect(0, SEA_Y, W, H - SEA_Y);
    ctx.fillStyle = '#3d8aa8'; ctx.fillRect(0, SEA_Y, W, 3);
    ctx.fillStyle = '#8fd4e8';
    for (let x = 0; x < W; x += 4) { if (Math.sin(x * 0.11 + time * 2.4) > 0.55) ctx.fillRect(x, SEA_Y + Math.round(Math.sin(x * 0.31 + time * 3.1)), 3, 1); }
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    for (let x = 0; x < W; x += 7) { if (Math.sin(x * 1.7 + time * 1.3) > 0.8) ctx.fillRect(x, SEA_Y + 5 + (x % 5), 2, 1); }
  }

  // ---------- render: trees ----------
  function canopyMound(cx, edgeY, dir, rx, ry, pal, seed, sway) {
    const cyc = edgeY + dir * ry;
    const sw = sway || 0;
    for (let dy = -ry; dy <= ry; dy++) {
      const yy = Math.round(cyc + dy);
      const frac = dy / ry;
      const hw = Math.round(rx * Math.sqrt(Math.max(0, 1 - frac * frac)));
      if (hw <= 0) continue;
      const litness = dir > 0 ? (0.5 - frac * 0.5) : (0.5 + frac * 0.5);
      let col;
      if (litness > 0.82) col = pal.hi; else if (litness > 0.6) col = pal.top;
      else if (litness > 0.38) col = pal.mid; else if (litness > 0.18) col = pal.base; else col = pal.deep;
      const jitter = Math.round((orand(seed, dy + 40) - 0.5) * 2) + Math.round(sw * (0.4 + Math.abs(frac) * 0.6));
      ctx.fillStyle = col;
      ctx.fillRect(cx - hw + jitter, yy, hw * 2, 1);
    }
    ctx.fillStyle = pal.hi;
    for (let i = 0; i < 7; i++) {
      const a = orand(seed, i * 13) * 6.28, rr = orand(seed, i * 7) * 0.7;
      ctx.fillRect(Math.round(cx + Math.cos(a) * rx * rr + sw), Math.round(cyc + Math.sin(a) * ry * rr - dir), 1, 1);
    }
  }

  function barkColumn(cx, y0, y1, half, bark, seed) {
    y0 = Math.round(y0); y1 = Math.round(y1);
    if (y1 <= y0) return;
    ctx.fillStyle = bark.mid; ctx.fillRect(cx - half, y0, half * 2, y1 - y0);
    ctx.fillStyle = bark.light; ctx.fillRect(cx - half, y0, 2, y1 - y0);
    ctx.fillStyle = bark.dark; ctx.fillRect(cx + half - 2, y0, 2, y1 - y0);
    ctx.fillStyle = bark.dark;
    for (let i = 0; i < 5; i++) { const yy = y0 + orand(seed, i * 3) * (y1 - y0); ctx.fillRect(cx - half + 1, Math.round(yy), Math.max(1, half * 2 - 2), 1); }
  }

  function fruitDots(cx, cy, rw, rh, seed, color) {
    ctx.fillStyle = color;
    for (let i = 0; i < 5; i++) {
      const a = orand(seed, 500 + i * 13) * 6.28, rr = 0.3 + orand(seed, 600 + i * 17) * 0.6;
      ctx.fillRect(Math.round(cx + Math.cos(a) * rw * rr), Math.round(cy + Math.sin(a) * rh * rr), 2, 2);
    }
  }

  function drawPineHalf(cx, edgeY, dir, o, tv) {
    const bark = tv.bark, pal = tv.canopy;
    const H2 = 30, tiers = 3;
    for (let ti = 0; ti < tiers; ti++) {
      const yBase = edgeY + dir * (ti * (H2 / tiers));
      const yTip = edgeY + dir * ((ti + 1) * (H2 / tiers) + 6);
      const half = Math.round(lerp(o.w / 2, 3, ti / tiers));
      for (let y = 0; y <= Math.abs(yTip - yBase); y++) {
        const yy = Math.round(yBase + dir * y);
        const t = y / Math.max(1, Math.abs(yTip - yBase));
        const hw = Math.round(half * (1 - t));
        const col = ti === 0 ? pal.base : (ti === 1 ? pal.mid : pal.top);
        ctx.fillStyle = col; ctx.fillRect(cx - hw, yy, hw * 2, 1);
        ctx.fillStyle = pal.deep; ctx.fillRect(cx + hw - 1, yy, 1, 1);
      }
    }
    ctx.fillStyle = pal.hi;
    for (let i = 0; i < 4; i++) ctx.fillRect(Math.round(cx - o.w / 2 + orand(o.seed, i * 5) * o.w), Math.round(edgeY + dir * (4 + orand(o.seed, i) * 20)), 1, 1);
  }

  function drawLeafyHalf(cx, edgeY, dir, o, tv, fruitColor) {
    const sway = Math.sin(time * (o.variant === 'broadleaf' || o.variant === 'mangrove' ? 1.9 : 1.3) + o.seed * 0.017) * (o.variant === 'broadleaf' ? 2 : 1);
    const rx = o.w / 2 + (tv.soft - 3);
    const ry = tv.ry;
    if (o.variant === 'broadleaf') {
      canopyMound(cx - 6, edgeY, dir, rx - 3, ry - 2, tv.canopy, o.seed + 1, sway);
      canopyMound(cx + 7, edgeY + dir * 2, dir, rx - 4, ry - 3, tv.canopy, o.seed + 2, sway);
      canopyMound(cx, edgeY, dir, rx, ry, tv.canopy, o.seed, sway);
    } else if (o.variant === 'cypress') {
      canopyMound(cx, edgeY, dir, rx - 2, ry, tv.canopy, o.seed, sway);
      canopyMound(cx, edgeY + dir * (ry * 0.8), dir, rx - 5, ry - 3, tv.canopy, o.seed + 3, sway);
    } else {
      canopyMound(cx, edgeY, dir, rx, ry, tv.canopy, o.seed, sway);
    }
    // crisp lit lip = readable soft edge
    ctx.fillStyle = tv.canopy.hi;
    ctx.fillRect(cx - Math.round(rx * 0.7) + Math.round(sway), edgeY - (dir > 0 ? 0 : 1), Math.round(rx * 1.4), 1);
    // decorations
    if (o.variant === 'nutoak') fruitDots(cx, edgeY + dir * ry, rx * 0.7, ry * 0.7, o.seed, '#7b4d26');
    else if (o.variant === 'broadleaf') {
      fruitDots(cx, edgeY + dir * ry, rx * 0.7, ry * 0.6, o.seed, tv.flower);
      ctx.fillStyle = tv.vine;
      for (let i = 0; i < 3; i++) { const vx = cx - 8 + Math.round(orand(o.seed, 200 + i * 9) * 16); const vl = 4 + Math.round(orand(o.seed, 230 + i) * 6); ctx.fillRect(vx, edgeY, 1, dir > 0 ? -vl : vl); }
    } else if (o.variant === 'cypress' && tv.moss) {
      ctx.fillStyle = tv.moss;
      for (let i = 0; i < 4; i++) { const mx = cx - 10 + Math.round(orand(o.seed, 60 + i * 3) * 20); const ml = 3 + Math.round(orand(o.seed, 80 + i) * 5); ctx.fillRect(mx, edgeY, 1, dir > 0 ? -ml : ml); }
    } else fruitDots(cx, edgeY + dir * ry, rx * 0.65, ry * 0.65, o.seed, fruitColor);
  }

  function drawTreeObstacle(sx, o, fruitColor) {
    const topH = o.gapY - o.gapH / 2, botY = o.gapY + o.gapH / 2, cx = sx + o.w / 2, tv = TREES[o.variant] || TREES.oak;
    const isPine = o.variant === 'pine';
    // bottom piece: trunk from ground up, canopy top at botY
    barkColumn(cx, botY + (isPine ? 6 : 3), SEA_Y, tv.coreHalf + 1, tv.bark, o.seed);
    if (o.variant === 'mangrove') { // prop roots
      ctx.fillStyle = tv.bark.dark;
      for (let i = -1; i <= 1; i += 2) { for (let r = 0; r < 8; r++) ctx.fillRect(cx + i * (2 + r), SEA_Y - 8 + r, 1, 2); }
    }
    if (isPine) drawPineHalf(cx, botY, +1, o, tv);
    else drawLeafyHalf(cx, botY, +1, o, tv, fruitColor);
    // top piece: trunk from ceiling down, canopy bottom at topH
    if (topH > 2) {
      barkColumn(cx, 0, topH - (isPine ? 6 : 3), tv.coreHalf + 1, tv.bark, o.seed + 5);
      if (isPine) drawPineHalf(cx, topH, -1, o, tv);
      else drawLeafyHalf(cx, topH, -1, o, tv, fruitColor);
    }
    // re-stamp hard core faintly so the hazard reads under leaves
    ctx.fillStyle = 'rgba(30,20,15,0.28)';
    ctx.fillRect(cx - o.coreHalf, Math.max(0, topH), o.coreHalf * 2, Math.max(0, botY - topH));
  }

  function drawRockObstacle(sx, o) {
    const topH = o.gapY - o.gapH / 2, botY = o.gapY + o.gapH / 2, cx = sx + o.w / 2;
    for (let y = botY; y < SEA_Y; y += 1) {
      const t = (y - botY) / Math.max(1, SEA_Y - botY);
      const half = Math.round(lerp(6, o.w / 2, Math.min(1, t * 1.6)));
      ctx.fillStyle = '#9aa2b5'; ctx.fillRect(cx - half, y, half * 2, 1);
      ctx.fillStyle = '#c9d2e0'; ctx.fillRect(cx - half, y, 2, 1);
      ctx.fillStyle = '#5f6579'; ctx.fillRect(cx + half - 3, y, 3, 1);
    }
    ctx.fillStyle = '#5f6579';
    for (let i = 0; i < 4; i++) { const yy = botY + 6 + orand(o.seed, i * 3) * (SEA_Y - botY - 10); const xx = sx + 6 + orand(o.seed, i * 5 + 1) * (o.w - 12); ctx.fillRect(Math.round(xx), Math.round(yy), 1, 3 + Math.round(orand(o.seed, i) * 3)); }
    ctx.fillStyle = '#f2f7ff'; ctx.fillRect(sx + o.w / 2 - 5, botY, 10, 2);
    if (topH > 2) {
      for (let y = 0; y < topH; y++) {
        const t = 1 - y / topH; const half = Math.round(lerp(5, o.w / 2, Math.min(1, t * 1.5)));
        ctx.fillStyle = '#8a92a5'; ctx.fillRect(cx - half, y, half * 2, 1);
        ctx.fillStyle = '#b9c2d0'; ctx.fillRect(cx - half, y, 2, 1);
      }
      ctx.fillStyle = '#5f6579'; ctx.fillRect(sx + o.w / 2 - 4, topH - 2, 8, 2);
    }
  }

  function drawObstacles() {
    const fruitColor = world.biome.deco;
    for (const o of world.obstacles) {
      const sx = Math.round(o.x - world.dist);
      if (sx > W + 4 || sx + o.w < -8) continue;
      if (o.kind === 'rock') drawRockObstacle(sx, o);
      else drawTreeObstacle(sx, o, fruitColor);
    }
  }

  function drawSnakes() {
    for (const o of world.obstacles) {
      const s = o.snake;
      if (!s || s.state === 'dormant' || s.state === 'spent') continue;
      const ax = s.ax, ay = s.topH;
      let hx = s.headX != null ? s.headX : ax, hy = s.headY != null ? s.headY : s.restY;
      if (s.state === 'windup') { hy = s.restY - 3 - Math.sin(time * 20) * 1; hx = ax; }
      // neck
      ctx.strokeStyle = '#3e7a2e'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(hx, hy); ctx.stroke();
      ctx.strokeStyle = '#2c5c1e'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(hx, hy); ctx.stroke();
      const spr = s.state === 'strike' ? SPR.SNAKE_STRIKE : (s.state === 'windup' ? SPR.SNAKE_REAR : SPR.SNAKE_COIL);
      ctx.drawImage(spr, Math.round(hx - spr.width / 2), Math.round(hy - spr.height / 2));
      if (s.state === 'windup') drawAim(hx, hy, clamp(BIRD_X, ax - 26, ax + 4), s.lockY, '#c7d94a', time * 6);
    }
  }

  function drawSnappers() {
    for (const s of world.snappers) {
      const sx = Math.round(s.sx);
      if (sx < -14 || sx > W + 14) continue;
      if (s.state === 'lurk') { ctx.drawImage(SPR.SNAPPER_LURK, sx - 4, Math.round(SEA_Y - 3 + Math.sin(s.bob) * 1)); }
      else if (s.state === 'telegraph') {
        ctx.drawImage(SPR.SNAPPER_LURK, sx - 4, SEA_Y - 4);
        ctx.fillStyle = 'rgba(168,228,242,0.5)';
        const rw = 6 + Math.sin(time * 12) * 3; ctx.fillRect(Math.round(sx - rw), SEA_Y - 1, Math.round(rw * 2), 1);
      } else if (s.state === 'lunge' || s.state === 'retract') {
        ctx.drawImage(SPR.SNAPPER_GAPE, sx - 5, Math.round(s.mawY - 4));
      }
    }
  }

  function drawHawk() {
    const h = world.hawk;
    if (!h) return;
    if (h.state === 'warn') {
      // shadow telegraph on the bird's lane
      const k = clamp(h.t / (1.0 * (h.first ? 1.4 : 1)), 0, 1);
      const shx = lerp(W - 20, BIRD_X, k);
      ctx.fillStyle = 'rgba(20,12,28,' + (0.15 + 0.2 * k).toFixed(2) + ')';
      ctx.beginPath(); ctx.ellipse(shx, h.lockY, 9, 3, 0, 0, 6.28); ctx.fill();
      if (Math.floor(time * 8) % 2) { ctx.fillStyle = 'rgba(122,90,58,0.5)'; ctx.fillRect(0, Math.round(h.lockY), W, 1); }
    } else if (h.state === 'swoop') {
      const spr = Math.floor(time * 10) % 2 ? SPR.HAWK_MID : SPR.HAWK_UP;
      ctx.drawImage(spr, Math.round(h.hx - spr.width / 2), Math.round(h.hy - spr.height / 2));
    }
  }

  // ---------- render: island scene ----------
  function drawIsland(isl) {
    const ix = Math.round(isl.x), tier = skyOf();
    const b = isl.biome;
    const tv = b.tree ? (TREES[b.tree] || TREES.oak) : TREES.oak;
    // back hill (parallax)
    ctx.fillStyle = mixColor(tv.canopy.base, tier.bot, 0.45);
    for (let y = isl.capY - 6; y < SEA_Y; y++) { const t = (y - (isl.capY - 6)) / (SEA_Y - (isl.capY - 6)); const hw = Math.round(24 + t * 26); ctx.fillRect(ix - hw - 10, y - 3, hw * 2, 1); }
    // sand body (rounded half-ellipse)
    const topY = isl.capY;
    for (let y = topY; y < SEA_Y + 2; y++) {
      const t = (y - topY) / (SEA_Y - topY);
      const hw = Math.round(isl.halfW * Math.sqrt(Math.max(0, Math.sin(t * Math.PI * 0.5 + 0.15))));
      if (y < topY + 3) ctx.fillStyle = y === topY ? tv.canopy.top : '#5cad3c';
      else if (y < topY + 10) ctx.fillStyle = mixColor('#5cad3c', b.deco === '#8a4f6b' ? '#3a6b4a' : '#7a5230', 0.35);
      else if (y > SEA_Y - 4) ctx.fillStyle = '#d8b877';
      else ctx.fillStyle = '#8a5532';
      ctx.fillRect(ix - hw, y, hw * 2, 1);
    }
    // wet sand + foam shoreline
    ctx.fillStyle = '#e5c28c';
    for (let y = SEA_Y - 3; y < SEA_Y; y++) { const t = (y - topY) / (SEA_Y - topY); const hw = Math.round(isl.halfW * Math.sqrt(Math.max(0, Math.sin(t * Math.PI * 0.5 + 0.15)))); ctx.fillRect(ix - hw, y, hw * 2, 1); }
    ctx.fillStyle = '#f2f7ff';
    for (let s = -1; s <= 1; s += 2) { const fx = ix + s * (isl.halfW - 4 + Math.round(Math.sin(time * 4) * 2)); ctx.fillRect(fx - 3, SEA_Y - 1 + Math.round(Math.sin(time * 3 + s) * 1), 6, 1); }
    // grass tufts + flowers
    for (let i = 0; i < 6; i++) { const gx2 = ix - 16 + Math.round(orand(isl.seed, i * 5) * 32); ctx.fillStyle = '#96d454'; ctx.fillRect(gx2, topY - 2, 1, 2); ctx.fillRect(gx2 + 2, topY - 1, 1, 1); if (i % 2) { ctx.fillStyle = b.deco; ctx.fillRect(gx2 + 1, topY - 3, 1, 1); } }
    // perch tree
    const tx = ix + isl.perchDX - 4;
    barkColumn(tx, isl.perchY - 4, topY, 2, tv.bark, isl.seed + 9);
    ctx.fillStyle = tv.bark.mid; ctx.fillRect(tx + 2, isl.perchY, 12, 2);
    ctx.fillStyle = tv.bark.dark; ctx.fillRect(tx + 2, isl.perchY + 1, 12, 1);
    if (b.tree === 'pine') { for (let ti = 0; ti < 3; ti++) { const yy = isl.perchY - 8 - ti * 8; const hw = 12 - ti * 3; ctx.fillStyle = ti === 0 ? tv.canopy.base : tv.canopy.mid; for (let k = 0; k < 8; k++) ctx.fillRect(tx - hw + k * (hw * 2 / 8), yy - k, Math.max(1, hw * 2 - k * 3), 1); } }
    else { canopyMound(tx, isl.perchY - 8, -1, 15, 10, tv.canopy, isl.seed + 3, Math.sin(time * 1.3) * 1); fruitDots(tx, isl.perchY - 16, 12, 8, isl.seed, b.deco); }
    // foreground rock
    ctx.fillStyle = '#6f6a5a'; ctx.fillRect(ix + isl.halfW - 12, SEA_Y - 4, 6, 4); ctx.fillStyle = '#8a8474'; ctx.fillRect(ix + isl.halfW - 12, SEA_Y - 4, 6, 1);
  }

  // ---------- render: bird ----------
  function birdCfg() {
    let frame = 1;
    if (bird.flapT > 0.16) frame = 2; else if (bird.flapT > 0.06) frame = 1; else if (bird.flapT > 0) frame = 0;
    else frame = bird.vy < -20 ? 0 : 1;
    if (STATE === 'island' || STATE === 'title') frame = bird.flapT > 0 ? Math.floor(bird.animT * 14) % 3 : 1;
    const crest = Math.min(3, Math.ceil(run ? run.evolutions / 2 : 0));
    const fp = clamp(bird.flapT / 0.24, 0, 1);
    let sx = 1 + 0.14 * fp, sy = 1 - 0.16 * fp;
    if (bird.grazeActive > 0) { sx = 0.90; sy = 1.10; }
    if (bird.catchPop > 0) { const cp = bird.catchPop / 0.18; sx += 0.12 * cp; sy += 0.12 * cp; }
    return {
      frame: frame, open: bird.openT > 0,
      bigBeak: run ? has('beak') : false, bigWings: run ? has('wings') : false, bigTail: run ? has('rudder') : false,
      crest: crest, stuffed: bird.stuffed, blink: bird.blinking > 0, shield: bird.shieldUp,
      glidePose: bird.glidePose, legsDown: bird.legsDown, sx: sx, sy: sy, time: time,
    };
  }

  function drawBirdFull() {
    if (bird.invuln > 0 && Math.floor(time * 14) % 2 === 0 && !bird.dead) return;
    const cfg = birdCfg();
    // motion trail
    if (!bird.dead && Math.abs(bird.vy) > 200) {
      ctx.globalAlpha = 0.18; SPR.drawBird(ctx, bird.x - bird.vy * 0.012, bird.y - bird.vy * 0.02, bird.rot, cfg); ctx.globalAlpha = 1;
    }
    SPR.drawBird(ctx, bird.x, bird.y, bird.rot, cfg);
    if (bird.carried) {
      const bp = beakPos();
      const spr = bird.carried === 'bug' ? (Math.floor(time * 10) % 2 ? SPR.BUG1 : SPR.BUG2) : FOODS[bird.carried].spr;
      ctx.drawImage(spr, Math.round(bp.x - spr.width / 2 + 2), Math.round(bp.y - spr.height / 2));
      const w2 = 14, px = Math.round(bird.x - w2 / 2), py = Math.round(bird.y - 16);
      ctx.fillStyle = 'rgba(20,12,28,0.8)'; ctx.fillRect(px - 1, py - 1, w2 + 2, 4);
      const t = clamp(bird.digestT / bird.digestNeed, 0, 1);
      ctx.fillStyle = t < 1 ? '#f6c945' : '#96d454'; ctx.fillRect(px, py, Math.round(w2 * t), 2);
    }
    if (bird.crop) { ctx.fillStyle = '#fbe7bb'; ctx.fillRect(Math.round(bird.x + 3), Math.round(bird.y + 4), 3, 3); ctx.fillStyle = '#2b1d20'; ctx.fillRect(Math.round(bird.x + 3), Math.round(bird.y + 7), 3, 1); }
  }

  // ---------- render: HUD ----------
  function drawPanel(x, y, w2, h2) {
    ctx.fillStyle = 'rgba(18,12,30,0.92)'; ctx.fillRect(x + 1, y + 1, w2 - 2, h2 - 2);
    ctx.fillStyle = '#6a5a8c';
    ctx.fillRect(x + 1, y, w2 - 2, 1); ctx.fillRect(x + 1, y + h2 - 1, w2 - 2, 1);
    ctx.fillRect(x, y + 1, 1, h2 - 2); ctx.fillRect(x + w2 - 1, y + 1, 1, h2 - 2);
  }

  function drawHUD() {
    const st = stats();
    for (let i = 0; i < bird.maxHearts; i++) ctx.drawImage(i < bird.hearts ? SPR.HEART : SPR.HEART_EMPTY, 4 + i * 9, 4);
    if (bird.shieldUp) { ctx.fillStyle = '#a8e4f2'; ctx.fillRect(4 + bird.maxHearts * 9 + 2, 6, 3, 3); }
    const ew = 56, ex = Math.round(W / 2 - ew / 2), ey = 5;
    ctx.drawImage(SPR.DNA, ex - 7, ey - 1);
    ctx.fillStyle = 'rgba(20,12,28,0.8)'; ctx.fillRect(ex - 1, ey, ew + 2, 5);
    const et = clamp(run.evo / run.evoNeed, 0, 1), ready = run.evo >= run.evoNeed;
    ctx.fillStyle = ready ? (Math.floor(time * 6) % 2 ? '#3fc0b0' : '#96f0e4') : '#3fc0b0';
    ctx.fillRect(ex, ey + 1, Math.round(ew * et), 3);
    if (ready) drawTextShadow(ctx, 'EVO READY!', W / 2, ey + 8, '#96f0e4', 1, 'center');
    const scoreScale = run.scorePop > 0 ? 2 : 1;
    if (scoreScale === 2) drawTextShadow(ctx, String(run.score), W - 4, 3, '#fff3a8', 1, 'right');
    else drawTextShadow(ctx, String(run.score), W - 4, 4, '#ffffff', 1, 'right');
    drawTextShadow(ctx, 'DEPTH ' + run.depth, W - 4, 11, '#c9d2e0', 1, 'right');
    const tw = 30, tx2 = 4, ty = H - 9;
    drawTextShadow(ctx, 'TUMMY', tx2, ty - 7, '#e5c28c', 1);
    ctx.fillStyle = 'rgba(20,12,28,0.8)'; ctx.fillRect(tx2 - 1, ty, tw + 2, 5);
    const ft = clamp(bird.fullness / st.cap, 0, 1);
    ctx.fillStyle = bird.stuffed ? (Math.floor(time * 8) % 2 ? '#e0525c' : '#f2748f') : (ft > 0.75 ? '#f6c945' : '#96d454');
    ctx.fillRect(tx2, ty + 1, Math.round(tw * ft), 3);
    if (bird.stuffed) drawTextShadow(ctx, 'STUFFED!', tx2 + tw + 6, ty - 1, '#e0525c', 1);
    if (world && world.gust && world.gust.t < world.gust.warn && Math.floor(time * 8) % 2) {
      drawTextShadow(ctx, '! GUST ' + (world.gust.dir < 0 ? 'RISING' : 'FALLING') + ' !', W / 2, 40, '#f6c945', 1, 'center');
    }
  }

  function drawBanner() {
    if (!world || world.banner <= 0 || STATE !== 'fly' || world.phase !== 'fly') return;
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

  function drawCineTitle() {
    const c = world.cine;
    if (!c || c.t < CINE.settle - 0.2) return;
    const a = clamp((c.t - (CINE.settle - 0.2)) * 3, 0, 1);
    ctx.globalAlpha = a;
    drawPanel(W / 2 - 70, 20, 140, 22);
    drawTextShadow(ctx, 'DEPTH ' + run.depth + ' - LANDED', W / 2, 24, '#f6c945', 1, 'center');
    drawTextShadow(ctx, world.biome.name, W / 2, 33, '#ffffff', 1, 'center');
    ctx.globalAlpha = 1;
    if (Math.floor(time * 2) % 2) drawText(ctx, 'TAP TO CONTINUE', W / 2, 50, '#a8e4f2', 1, 'center');
  }

  // ---------- render: particles & floats ----------
  function drawParts() {
    for (const p of parts) {
      const lifeT = p.t / p.life;
      if (p.type === 'sparkle') {
        ctx.fillStyle = p.color; const s = lifeT < 0.5 ? 1 : 0;
        ctx.fillRect(Math.round(p.x), Math.round(p.y) - 1 - s, 1, 3 + s * 2);
        ctx.fillRect(Math.round(p.x) - 1 - s, Math.round(p.y), 3 + s * 2, 1);
      } else if (p.type === 'streak') { ctx.fillStyle = p.color; ctx.fillRect(Math.round(p.x), Math.round(p.y), 14, 1); }
      else if (p.type === 'puff') { ctx.globalAlpha = 1 - lifeT; ctx.fillStyle = p.color; const s = 2 + Math.round(lifeT * 3); ctx.fillRect(Math.round(p.x - s / 2), Math.round(p.y - s / 2), s, s); ctx.globalAlpha = 1; }
      else if (p.type === 'bubble') { ctx.globalAlpha = 0.7 * (1 - lifeT); ctx.fillStyle = p.color; ctx.fillRect(Math.round(p.x), Math.round(p.y), 2, 2); ctx.globalAlpha = 1; }
      else if (p.type === 'feather' || p.type === 'leaf') { ctx.fillStyle = p.color; ctx.fillRect(Math.round(p.x), Math.round(p.y), 2, 1 + (Math.floor(p.t * 10) % 2)); }
      else { ctx.globalAlpha = 1 - lifeT * 0.6; ctx.fillStyle = p.color; ctx.fillRect(Math.round(p.x), Math.round(p.y), 2, 2); ctx.globalAlpha = 1; }
    }
    for (const f of floats) {
      ctx.globalAlpha = clamp(1.4 - f.t, 0, 1);
      drawTextShadow(ctx, f.str, f.x, f.y, f.color, f.big ? 2 : 1, 'center');
      ctx.globalAlpha = 1;
    }
  }

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
    const x0 = Math.round(W / 2 - total / 2), y0 = isPath ? 46 : 52;
    ctx.fillStyle = 'rgba(10,6,18,0.55)'; ctx.fillRect(0, 0, W, H);
    drawTextShadow(ctx, title, W / 2, 22, '#f6c945', 1, 'center');
    ui.cardRects = [];
    for (let i = 0; i < cards.length; i++) {
      const c = cards[i], sel = i === ui.sel, cx = x0 + i * (cw + gap), cy = y0 + (sel ? -3 : 0);
      ui.cardRects.push({ x: cx, y: cy, w: cw, h: ch });
      drawPanel(cx, cy, cw, ch);
      if (sel) {
        ctx.fillStyle = '#f6c945';
        ctx.fillRect(cx + 1, cy, cw - 2, 1); ctx.fillRect(cx + 1, cy + ch - 1, cw - 2, 1);
        ctx.fillRect(cx, cy + 1, 1, ch - 2); ctx.fillRect(cx + cw - 1, cy + 1, 1, ch - 2);
        const bob = Math.floor(time * 4) % 2; drawText(ctx, '*', cx + cw / 2 - 1, cy - 9 - bob, '#f6c945', 1);
      }
      const icon = c.icon, isc = 2, iy = cy + 7 + Math.max(0, Math.round((28 - icon.height * isc) / 2));
      ctx.drawImage(icon, Math.round(cx + cw / 2 - icon.width * isc / 2), iy, icon.width * isc, icon.height * isc);
      const tl = wrap(c.title, 12); let ty = cy + 40;
      for (const line of tl) { drawTextShadow(ctx, line, cx + cw / 2, ty, sel ? '#f6c945' : '#ffffff', 1, 'center'); ty += 7; }
      ty += 2;
      for (const line of c.lines) { drawText(ctx, line, cx + cw / 2, ty, '#c9d2e0', 1, 'center'); ty += 7; }
      if (c.kind === 'path') { const n = c.danger, sx0 = cx + cw / 2 - (n * 7 - 2) / 2; for (let s = 0; s < n; s++) ctx.drawImage(SPR.SKULL, Math.round(sx0 + s * 7), cy + ch - 10); }
    }
    drawTextShadow(ctx, '< > CHOOSE   SPACE/TAP CONFIRM', W / 2, y0 + ch + 10, '#8f86a8', 1, 'center');
  }

  // ---------- render: states ----------
  function applyCam(cam) {
    ctx.translate((cam.kickX || 0), (cam.kickY || 0));
    ctx.translate(cam.focusX, cam.focusY);
    ctx.scale(cam.scale, cam.scale);
    ctx.translate(-cam.focusX, -cam.focusY);
  }

  function renderFly() {
    const cine = world.phase === 'cine';
    ctx.save();
    if (cine) applyCam(world.cam);
    drawBackground(world.dist);
    drawObstacles();
    if (world.island) drawIsland(world.island);
    drawSnakes();
    drawFoods();
    drawSnappers();
    drawSea();
    drawBirdFull();
    drawHawk();
    drawParts();
    ctx.restore();
    drawHUD();
    drawBanner();
    if (cine) drawCineTitle();
    if (world.fade > 0) { ctx.fillStyle = 'rgba(10,6,18,' + clamp(world.fade, 0, 1).toFixed(2) + ')'; ctx.fillRect(0, 0, W, H); }
  }

  function renderIsland() {
    ctx.save();
    drawBackground(world.dist + time * 4);
    if (world.island) drawIsland(world.island); else drawIsland({ x: ISLAND_REST, seed: 7, halfW: 40, capY: 100, baseY: SEA_Y, perchDX: -6, perchY: 96, biome: world.biome });
    drawSea();
    drawBirdFull();
    drawParts();
    ctx.restore();
    drawHUD();
    if (ui.phase === 'summary') {
      drawPanel(20, 40, 130, 96);
      drawTextShadow(ctx, 'ISLAND REACHED!', 85, 46, '#f6c945', 1, 'center');
      drawText(ctx, 'DEPTH ' + run.depth + ' CLEARED', 85, 56, '#ffffff', 1, 'center');
      let yy = 68; const keys = ['berry', 'seed', 'nut', 'bug', 'gold']; let any = false;
      for (const k of keys) {
        if (!world.legDiet[k]) continue; any = true;
        const spr = FOODS[k].spr; ctx.drawImage(spr, 34, yy - 2);
        drawText(ctx, 'X' + world.legDiet[k] + ' ' + FOODS[k].name, 46, yy, '#c9d2e0', 1); yy += 10;
      }
      if (!any) { drawText(ctx, 'NOTHING EATEN...', 85, yy, '#8f86a8', 1, 'center'); yy += 10; }
      yy = Math.max(yy + 4, 112);
      if (run.evo >= run.evoNeed) drawTextShadow(ctx, 'EVOLUTION AWAITS!', 85, yy, '#3fc0b0', 1, 'center');
      else drawText(ctx, 'EVO ' + Math.round(run.evo) + '/' + run.evoNeed, 85, yy, '#3fc0b0', 1, 'center');
      if (Math.floor(time * 2) % 2) drawText(ctx, 'SPACE/TAP TO CONTINUE', 85, 126, '#8f86a8', 1, 'center');
    } else if (ui.phase === 'mutate') drawCards('CHOOSE YOUR EVOLUTION');
    else if (ui.phase === 'path') drawCards('CHOOSE YOUR MIGRATION');
    if (ui.flash > 0) { ctx.fillStyle = 'rgba(63,192,176,' + (ui.flash * 0.6).toFixed(2) + ')'; ctx.fillRect(0, 0, W, H); }
  }

  function renderTitle() {
    drawBackground(time * 12);
    drawSea();
    const ly = 32 + Math.round(Math.sin(time * 1.2) * 2);
    FONT.drawTextOutline(ctx, 'FLAPPY', W / 2, ly, '#f6c945', 3, 'center');
    FONT.drawTextOutline(ctx, 'DARWIN', W / 2, ly + 22, '#3fc0b0', 3, 'center');
    ctx.drawImage(SPR.DNA, W / 2 - 62, ly + 24); ctx.drawImage(SPR.DNA, W / 2 + 58, ly + 24);
    drawTextShadow(ctx, 'EAT. DIGEST. EVOLVE.', W / 2, ly + 46, '#ffffff', 1, 'center');
    const dy = ui.demoY || 84;
    SPR.drawBird(ctx, 70, dy, Math.sin(time * 1.6 + 1) * 0.1, {
      frame: Math.floor(time * 9) % 3, open: false, bigBeak: false, bigWings: false, bigTail: false,
      crest: 0, stuffed: false, blink: Math.sin(time * 0.7) > 0.97, shield: false, time: time, sx: 1, sy: 1,
    });
    if (Math.random() < 0.06) parts.push(feather(62, dy + 4));
    ctx.drawImage(SPR.BERRY, 100, Math.round(dy - 6 + Math.sin(time * 2.2) * 3));
    drawParts();
    if (Math.floor(time * 2) % 2) drawTextShadow(ctx, 'PRESS SPACE OR TAP TO MIGRATE', W / 2, 122, '#ffffff', 1, 'center');
    drawTextShadow(ctx, 'CATCH FOOD ON YOUR BEAK - WAIT TO DIGEST', W / 2, 138, '#a8e4f2', 1, 'center');
    drawTextShadow(ctx, "GRAZE TREETOPS - DODGE SNAKES + HAWKS", W / 2, 146, '#a8e4f2', 1, 'center');
    if (best.score > 0) drawTextShadow(ctx, 'BEST ' + best.score + '  DEPTH ' + best.depth + '  EVOS ' + best.evos, W / 2, 162, '#f6c945', 1, 'center');
    drawText(ctx, 'M MUTE  P PAUSE  R RESTART', W / 2, 171, '#8f86a8', 1, 'center');
  }

  function renderOver() {
    drawBackground(world ? world.dist : 0);
    drawSea();
    drawParts();
    ctx.fillStyle = 'rgba(10,6,18,0.6)'; ctx.fillRect(0, 0, W, H);
    const py = 22;
    drawPanel(60, py, 200, 136);
    drawTextShadow(ctx, 'EXTINCT!', W / 2, py + 8, '#e0525c', 2, 'center');
    drawText(ctx, DEATHS[bird.deathBy] || 'NATURAL SELECTION WINS', W / 2, py + 24, '#c9d2e0', 1, 'center');
    drawTextShadow(ctx, 'SCORE ' + run.score, W / 2, py + 38, '#ffffff', 2, 'center');
    if (newBestFlag && Math.floor(time * 4) % 2) drawTextShadow(ctx, 'NEW BEST!', W / 2, py + 52, '#f6c945', 1, 'center');
    drawText(ctx, 'DEPTH ' + run.depth + '   FOOD ' + run.foodEaten + '   PASSED ' + run.obstaclesPassed, W / 2, py + 64, '#c9d2e0', 1, 'center');
    drawText(ctx, 'EVOLVED TRAITS:', W / 2, py + 76, '#3fc0b0', 1, 'center');
    if (run.taken.length === 0) drawText(ctx, 'NONE... A HUMBLE FINCH', W / 2, py + 86, '#8f86a8', 1, 'center');
    else {
      const names = run.taken.map(function (id) { const m = MUTATIONS.filter(function (x) { return x.id === id; })[0]; return m ? m.name : id; });
      let yy = py + 86;
      for (let i = 0; i < Math.min(4, names.length); i++) { let line = names[i]; if (i === 3 && names.length > 4) line += ' +' + (names.length - 4) + ' MORE'; drawText(ctx, line, W / 2, yy, '#ffffff', 1, 'center'); yy += 8; }
    }
    if (ui.overT > 0.7 && Math.floor(time * 2) % 2) drawTextShadow(ctx, 'SPACE/TAP: TRY AGAIN', W / 2, py + 122, '#f6c945', 1, 'center');
  }

  function render() {
    ctx.imageSmoothingEnabled = false;
    ctx.save();
    if (shake.t > 0) ctx.translate(Math.round(rnd(-shake.mag, shake.mag)), Math.round(rnd(-shake.mag, shake.mag)));
    if (STATE === 'title') renderTitle();
    else if (STATE === 'fly') renderFly();
    else if (STATE === 'island') renderIsland();
    else if (STATE === 'over') renderOver();
    ctx.restore();
    ctx.drawImage(VIGNETTE, 0, 0);
    if (flashT > 0) { ctx.fillStyle = 'rgba(224,82,92,' + clamp(flashT * 1.4, 0, 0.6).toFixed(2) + ')'; ctx.fillRect(0, 0, W, H); }
    if (paused) {
      ctx.fillStyle = 'rgba(10,6,18,0.7)'; ctx.fillRect(0, 0, W, H);
      drawTextShadow(ctx, 'PAUSED', W / 2, 80, '#ffffff', 2, 'center');
      drawText(ctx, 'P TO RESUME', W / 2, 98, '#8f86a8', 1, 'center');
    }
    if (AUDIO.isMuted()) drawText(ctx, 'MUTED', 4, H - 24, '#8f86a8', 1);
  }

  // ---------- debug handle ----------
  window.__FD = {
    snap: function () {
      const nextObs = (STATE === 'fly' && world) ? world.obstacles.filter(function (o) { return o.x - world.dist + o.w > bird.x - 8; })[0] : null;
      return {
        state: STATE, phase: world && world.phase, uiPhase: ui && ui.phase,
        biome: world && world.biomeKey, y: bird && bird.y, hearts: bird && bird.hearts,
        depth: run && run.depth, evo: run && Math.round(run.evo), evoNeed: run && run.evoNeed,
        score: run && run.score, gapY: nextObs ? nextObs.gapY : null,
        carried: bird && bird.carried, fullness: bird && Math.round(bird.fullness),
      };
    },
    feed: function (n) { if (run) run.evo += n; },
    setBiome: function (k) { if (BIOMES[k]) { run.depth--; newLeg(k); } },
    heal: function () { if (bird) bird.hearts = bird.maxHearts; },
    preds: function () {
      const out = { snakes: [], snappers: [], hawk: world && world.hawk && world.hawk.state };
      if (world) { for (const o of world.obstacles) if (o.snake) out.snakes.push(o.snake.state); for (const s of world.snappers) out.snappers.push(s.state); }
      return out;
    },
    forceSnake: function () {
      if (!world) return;
      let cand = null;
      for (const o of world.obstacles) { const sx = o.x - world.dist; if (sx > bird.x + 30 && sx < bird.x + 90 && (!cand || o.x < cand.x)) cand = o; }
      if (!cand) for (const o of world.obstacles) { const sx = o.x - world.dist; if (sx > bird.x + 10 && (!cand || o.x < cand.x)) cand = o; }
      if (cand) {
        const topH = cand.gapY - cand.gapH / 2, botY = cand.gapY + cand.gapH / 2;
        cand.snake = { state: 'windup', t: 0, wu: 0.75, lockY: clamp(bird.y, topH + 2, botY - 2), spent: false, first: false };
        AUDIO.play('snakeHiss');
      }
    },
    forceHawk: function () { if (world && !world.hawk) { world.hawk = { state: 'warn', t: 0, lockY: bird.y, first: false }; AUDIO.play('hawkScreech'); } },
    forceSnapper: function () { if (world) world.snappers.push({ worldX: world.dist + bird.x + 60, state: 'lurk', t: 0, bob: 0, first: false }); },
    noInvuln: function () { if (bird) bird.invuln = 0; },
    dbg: function () { return Object.assign({}, DBG); },
    dbgReset: function () { DBG.graze = 0; DBG.hurtTree = 0; DBG.hurtWater = 0; DBG.hurtPred = 0; },
    // place the bird relative to the nearest on-screen tree's bottom canopy top (botY):
    //   overCore=false -> skim the leafy fringe; overCore=true -> over the trunk column
    probe: function (dyFromBot, overCore) {
      if (!world) return 'no world';
      let o = null;
      for (const ob of world.obstacles) { const sx = ob.x - world.dist; if (ob.kind !== 'rock' && sx > -10 && sx < W - 10 && (!o || ob.x < o.x)) o = ob; }
      if (!o) return 'no tree';
      const sx = o.x - world.dist, cx = sx + o.w / 2, botY = o.gapY + o.gapH / 2;
      bird.x = overCore ? cx : (cx + o.coreHalf + HX + 2);
      bird.y = botY + dyFromBot; bird.vy = 60; bird.invuln = 0; bird.dead = false;
      return { botY: Math.round(botY), birdY: Math.round(bird.y), overCore: !!overCore };
    },
  };

  // ---------- main loop ----------
  newRun();
  STATE = 'title';
  ui = { demoY: 84 };

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
