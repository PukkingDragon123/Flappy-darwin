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
      hazards: [], durian: true, foods: { seed: 5, nut: 3, berry: 1.5, grub: 1, gold: 0.2 },
      hint: ['TALL PINES', 'SEEDS + NUTS'], foodIcons: ['seed', 'nut'], icon: SPR.ICON_FOREST },
    grove: { name: 'OAKNUT GROVE', danger: 2, obst: 'tree', tree: 'nutoak', gapBase: 54, dense: true, sky: 'golden', deco: '#a76f3e',
      hazards: ['snapper', 'bfrog', 'shieldbug'], durian: true, foods: { nut: 5, seed: 2, berry: 1, grub: 0.6, gold: 0.2 },
      hint: ['PITCHER JAWS', 'FALLING DURIAN'], foodIcons: ['nut', 'seed'], icon: SPR.ICON_GROVE },
    marsh: { name: 'BUZZING MARSH', danger: 2, obst: 'tree', tree: 'mangrove', gapBase: 58, sky: 'day', deco: '#d4c24a',
      hazards: ['dfly', 'bfrog'], foods: { bug: 6, grub: 1.5, berry: 1.5, seed: 1, gold: 0.2 },
      hint: ['DARTING DRAGONFLIES', 'LEAPING FROGS'], foodIcons: ['bug', 'berry'], icon: SPR.ICON_MARSH },
    swamp: { name: 'MIRE SWAMP', danger: 2, obst: 'tree', tree: 'cypress', gapBase: 56, dense: true, sky: 'misty', deco: '#8a4f6b',
      hazards: ['snake', 'snapper', 'bat'], foods: { bug: 4, grub: 3, frog: 2, berry: 1, gold: 0.3 },
      hint: ['LURKING JAWS', 'GRUBS + FROGS'], foodIcons: ['grub', 'frog'], icon: SPR.ICON_SWAMP },
    crags: { name: 'STORM CRAGS', danger: 3, obst: 'rock', tree: null, gapBase: 54, wind: true, sky: 'stormy', deco: '#9aa2b5',
      hazards: ['hawk', 'falcon', 'vulture'], foods: { seed: 2, nut: 2, berry: 2, gold: 0.7 },
      hint: ['HAWKS + VULTURES', 'WILD GUSTS'], foodIcons: ['gold', 'nut'], icon: SPR.ICON_CRAGS },
    jungle: { name: 'LUSH JUNGLE', danger: 3, obst: 'tree', tree: 'broadleaf', gapBase: 52, dense: true, sky: 'golden', deco: '#ff5f9e',
      hazards: ['snake', 'hawk', 'snapper', 'bat', 'dfly'], durian: true, foods: { mango: 4, nectar: 3, nut: 2, berry: 2, bug: 2, frog: 1.5, gold: 0.8 },
      hint: ['EVERY DANGER', 'RICH FRUIT'], foodIcons: ['mango', 'gold'], icon: SPR.ICON_JUNGLE },
  };
  // new environments beyond the forest
  BIOMES.coast = { name: 'CORAL COAST', danger: 2, obst: 'tree', tree: 'palm', gapBase: 58, env: 'ocean', sky: 'day', deco: '#ff9f4d',
    hazards: ['falcon', 'jelly', 'piranha'], foods: { nectar: 3, berry: 2, bug: 2, mango: 1, gold: 0.4 },
    hint: ['DRIFTING JELLYFISH', 'LEAPING PIRANHAS'], foodIcons: ['nectar', 'gold'], icon: SPR.ICON_MEADOW };
  BIOMES.tundra = { name: 'FROST REACH', danger: 3, obst: 'tree', tree: 'snowpine', gapBase: 55, env: 'tundra', sky: 'misty', wind: true, deco: '#a8e4f2',
    hazards: ['falcon', 'hawk', 'bat', 'shieldbug'], foods: { seed: 4, nut: 2, berry: 1, gold: 0.4 },
    hint: ['ICY GUSTS', 'RAPTORS HUNT'], foodIcons: ['seed', 'gold'], icon: SPR.ICON_FOREST };
  BIOMES.desert = { name: 'DUNE SEA', danger: 3, obst: 'cactus', tree: 'cactus', gapBase: 56, env: 'desert', sky: 'golden', deco: '#ff7a4d',
    hazards: ['snake', 'falcon', 'vulture'], foods: { seed: 3, bug: 2, frog: 1, gold: 0.6 },
    hint: ['SPINY CACTI', 'CIRCLING VULTURES'], foodIcons: ['gold', 'seed'], icon: SPR.ICON_CRAGS };
  // boss arenas — three area bosses rotate as you migrate deeper
  BIOMES.aerie = { name: 'THE AERIE', danger: 5, obst: 'rock', tree: null, gapBase: 99, env: 'forest', sky: 'stormy', deco: '#c6cfe0', boss: true, bossKind: 'eagle', hazards: [], foods: {}, hint: ['THE GREAT EAGLE'], foodIcons: ['gold', 'gold'], icon: SPR.ICON_CRAGS };
  BIOMES.pit = { name: 'THE SERPENT PIT', danger: 5, obst: 'tree', tree: 'cypress', gapBase: 99, env: 'forest', sky: 'misty', deco: '#c7d94a', boss: true, bossKind: 'serpent', hazards: [], foods: {}, hint: ['THE SERPENT KING'], foodIcons: ['gold', 'gold'], icon: SPR.ICON_SWAMP };
  BIOMES.gale = { name: 'THE FROZEN GALE', danger: 5, obst: 'rock', tree: null, gapBase: 99, env: 'tundra', sky: 'stormy', deco: '#a8e4f2', boss: true, bossKind: 'owl', hazards: [], foods: {}, hint: ['THE FROST OWL'], foodIcons: ['gold', 'gold'], icon: SPR.ICON_FOREST };
  for (var _bk in BIOMES) if (!BIOMES[_bk].env) BIOMES[_bk].env = 'forest';
  const BIOME_KEYS = Object.keys(BIOMES);

  // per-variant tree palettes + soft/solid geometry
  const TREES = {
    oak:       { soft: 6, coreHalf: 3, ry: 11, canopy: { deep: '#1f4a16', base: '#2f6322', mid: '#4f9a2e', top: '#7fc23e', hi: '#bfe87a' }, bark: { light: '#9c6238', mid: '#7a4a28', dark: '#4a2c16' } },
    nutoak:    { soft: 5, coreHalf: 4, ry: 11, canopy: { deep: '#2a4416', base: '#3d5f1f', mid: '#5c8a2c', top: '#86b43e', hi: '#c2cf5a' }, bark: { light: '#a76f3e', mid: '#7b4d26', dark: '#573417' } },
    mangrove:  { soft: 5, coreHalf: 4, ry: 10, canopy: { deep: '#173d17', base: '#2c5c1e', mid: '#4c9636', top: '#78c24a', hi: '#9ad85e' }, bark: { light: '#7a5636', mid: '#5a3f28', dark: '#38251a' } },
    cypress:   { soft: 6, coreHalf: 3, ry: 12, canopy: { deep: '#2a4420', base: '#35502a', mid: '#5c7d3a', top: '#8aa74e', hi: '#b0b06a' }, bark: { light: '#8a6a54', mid: '#5a4030', dark: '#3a2a1f' }, moss: '#9fb488' },
    pine:      { soft: 4, coreHalf: 3, ry: 12, canopy: { deep: '#123a20', base: '#1f4a2b', mid: '#2f6b3a', top: '#55915a', hi: '#9ecf8e' }, bark: { light: '#7a5236', mid: '#5a3a24', dark: '#3a2416' } },
    broadleaf: { soft: 7, coreHalf: 4, ry: 12, canopy: { deep: '#123a17', base: '#1f5322', mid: '#3d8a36', top: '#63b544', hi: '#9be05a' }, bark: { light: '#8a6a42', mid: '#63482c', dark: '#3a2a1a' }, vine: '#3d7f2a', flower: '#ff5f9e' },
    palm: { soft: 5, coreHalf: 3, ry: 9, canopy: { deep: '#1f5a2a', base: '#2f7a34', mid: '#4fa03e', top: '#79c24a', hi: '#a8e05e' }, bark: { light: '#b08a52', mid: '#8a6636', dark: '#5a4020' } },
    snowpine: { soft: 4, coreHalf: 3, ry: 12, canopy: { deep: '#2a5648', base: '#356b57', mid: '#4c8a72', top: '#84b8a2', hi: '#e2f2ec' }, bark: { light: '#6a5240', mid: '#4d3a2c', dark: '#332619' }, snow: '#eef6ff' },
  };

  const MUTATIONS = [
    { id: 'wings',   name: 'MIGHTY WINGS',   desc: 'FLAP 25% STRONGER',       diet: 'berry', rarity: 'common', icon: SPR.WING_UP },
    { id: 'hollow',  name: 'HOLLOW BONES',   desc: 'FALL 18% SLOWER',         diet: 'berry', rarity: 'common', icon: SPR.FEATHER },
    { id: 'rudder',  name: 'TAIL RUDDER',    desc: 'DIVE SPEED CAPPED',       diet: 'berry', rarity: 'common', icon: SPR.TAIL_BIG },
    { id: 'glide',   name: 'GLIDER WING',    desc: 'HOLD FLAP TO GLIDE',      diet: 'berry', rarity: 'rare',   icon: SPR.CLOUD3 },
    { id: 'beak',    name: 'WIDE BEAK',      desc: 'BIGGER CATCH RANGE',      diet: 'nut',   rarity: 'common', icon: SPR.BEAK_B },
    { id: 'gut',     name: 'RAPID GUT',      desc: 'DIGEST 35% FASTER',       diet: 'bug',   rarity: 'common', icon: SPR.GRUB },
    { id: 'crop',    name: 'CROP POUCH',     desc: 'STASH A SECOND FOOD',     diet: 'nut',   rarity: 'rare',   icon: SPR.NUT },
    { id: 'gizzard', name: 'IRON GIZZARD',   desc: 'NUTS DIGEST FAST+VALUE',  diet: 'nut',   rarity: 'rare',   icon: SPR.NUT },
    { id: 'downy',   name: 'DOWNY PLUME',    desc: '+1 HEART, MENDED',        diet: 'any',   rarity: 'rare',   icon: SPR.HEART, repeat: true },
    { id: 'sweet',   name: 'SWEET TOOTH',    desc: 'FRUIT +50% VALUE',        diet: 'berry', rarity: 'common', icon: SPR.MANGO },
    { id: 'snatch',  name: 'BUG SNATCHER',   desc: 'BUGS DRIFT TO BEAK',      diet: 'bug',   rarity: 'common', icon: SPR.BUG1 },
    { id: 'shield',  name: 'FEATHER SHIELD', desc: 'BLOCK 1 HIT PER LEG',     diet: 'any',   rarity: 'rare',   icon: SPR.HEART_EMPTY },
    { id: 'stomach', name: 'SECOND STOMACH', desc: 'OVERFULL LIMIT +40%',     diet: 'nut',   rarity: 'common', icon: SPR.TUMMY },
    { id: 'lungs',   name: 'BIG LUNGS',      desc: '+45 MAX WING ENERGY',     diet: 'seed',  rarity: 'common', icon: SPR.FEATHER },
    { id: 'light',   name: 'LIGHT FRAME',    desc: 'FLAPS COST 32% LESS',     diet: 'seed',  rarity: 'rare',   icon: SPR.WING_MID },
    { id: 'photo',   name: 'SUN FEATHERS',   desc: 'ENERGY REGENS FASTER',    diet: 'seed',  rarity: 'common', icon: SPR.GOLD },
    { id: 'forager', name: 'KEEN FORAGER',   desc: 'ALL FOOD +25% VALUE',     diet: 'any',   rarity: 'common', icon: SPR.BERRY },
    { id: 'nimble',  name: 'NIMBLE FRAME',   desc: 'SMALLER HITBOX',          diet: 'bug',   rarity: 'rare',   icon: SPR.SEED },
    { id: 'ironbeak',name: 'IRON BEAK',      desc: 'DURIANS BOUNCE OFF',      diet: 'nut',   rarity: 'rare',   icon: SPR.DURIAN },
    { id: 'aerial',  name: 'AERIAL MASTER',  desc: 'GLIDE FAR, FALL SLOW',    diet: 'berry', rarity: 'epic',   icon: SPR.CLOUD3 },
    { id: 'apex',    name: 'APEX INSTINCT',  desc: 'PREDATORS STRIKE SLOWER', diet: 'any',   rarity: 'epic',   icon: SPR.SNAKE_REAR },
  ];
  const RARITY = { common: { w: 1.0, col: '#c9d2e0', label: 'COMMON' }, rare: { w: 0.5, col: '#6db6d8', label: 'RARE' }, epic: { w: 0.22, col: '#f6c945', label: 'EPIC' }, skill: { w: 0, col: '#ff9f4d', label: 'ATTACK SKILL' } };

  const DEATHS = {
    tree: 'SPLINTERED ON AN ANCIENT TREE', pine: 'IMPALED ON A PINE SPIRE',
    mangrove: 'TANGLED IN THE MARSH ROOTS', cypress: 'SWALLOWED BY THE MIRE',
    broadleaf: 'LOST IN THE JUNGLE CANOPY', rock: 'DASHED AGAINST THE STORM CRAGS',
    palm: 'SPEARED ON A PALM TRUNK', snowpine: 'IMPALED ON A FROZEN PINE', cactus: 'SKEWERED ON A CACTUS',
    water: 'SWALLOWED BY THE HUNGRY SEA', ground: 'CRASHED INTO THE UNDERGROWTH',
    ice: 'LOST BENEATH THE ICE', sand: 'BURIED IN THE DUNES',
    snake: 'SWALLOWED BY A CANOPY SERPENT', snapper: 'DEVOURED BY A PITCHER MAW',
    hawk: 'SNATCHED FROM THE SKY BY A HAWK', falcon: 'RUN DOWN BY A HUNTING FALCON',
    durian: 'FLATTENED BY A FALLING DURIAN', eagle: 'SEIZED BY THE GREAT EAGLE',
    wasp: 'STUNG DOWN BY THE SWARM', spider: 'ENSNARED BY A SPIDER',
    bat: 'BLINDSIDED BY A DUSK BAT', dfly: 'SLICED BY A DRAGONFLY DASH',
    bfrog: 'BOWLED OVER BY A BULLFROG', jelly: 'STUNG BY A DRIFTING JELLYFISH',
    piranha: 'SNAPPED UP BY A LEAPING PIRANHA', vulture: 'RUN DOWN BY A DIVING VULTURE',
    serpent: 'CRUSHED BY THE SERPENT KING', owl: 'FROZEN BY THE FROST OWL',
    hornet: 'STUNG BY A FURIOUS HORNET', sbug: 'RAMMED BY AN ARMORED SHIELDBUG',
  };

  // ---------- combat: 10 attack skills ----------
  const SKILLS = {
    peck:   { name: 'POWER PECK',     cd: 0.9, dmg: 2, desc: 'LUNGE AND STRIKE',   icon: SPR.SK_PECK },
    seed:   { name: 'SEED SHOT',      cd: 0.8, dmg: 2, desc: 'SPIT A FAST SEED',   icon: SPR.SK_SEED },
    volley: { name: 'FEATHER VOLLEY', cd: 1.3, dmg: 1, desc: 'FAN OF 3 QUILLS',    icon: SPR.SK_VOLLEY },
    slash:  { name: 'WING SLASH',     cd: 1.1, dmg: 3, desc: 'ARC AROUND YOU',     icon: SPR.SK_SLASH },
    chirp:  { name: 'SONIC CHIRP',    cd: 2.4, dmg: 1, desc: 'WAVE HITS ALL FOES', icon: SPR.SK_CHIRP },
    egg:    { name: 'EGG BOMB',       cd: 1.9, dmg: 3, desc: 'LOBBED BLAST',       icon: SPR.SK_EGG },
    vortex: { name: 'GUST VORTEX',    cd: 2.1, dmg: 2, desc: 'PIERCING TWISTER',   icon: SPR.SK_VORTEX },
    bolt:   { name: 'STORM CALL',     cd: 2.3, dmg: 4, desc: 'SMITE NEAREST FOE',  icon: SPR.SK_BOLT },
    ray:    { name: 'SUN RAY',        cd: 2.8, dmg: 3, desc: 'BEAM ACROSS SKY',    icon: SPR.SK_RAY },
    venom:  { name: 'VENOM SPIT',     cd: 1.5, dmg: 1, desc: 'POISONS OVER TIME',  icon: SPR.SK_VENOM, dot: true },
  };

  // diet passives — keep eating one food group and the flock adapts
  const PASSIVES = {
    berry: { at: 8, name: 'BERRY VIGOR', desc: 'EVERY 8 BERRIES HEAL', icon: SPR.BERRY },
    seed:  { at: 8, name: 'SWIFT WINGS', desc: 'FLAPS COST 20% LESS',  icon: SPR.SEED },
    nut:   { at: 8, name: 'HARD SHELL',  desc: 'SHIELD EVERY LEG',     icon: SPR.NUT },
    bug:   { at: 8, name: 'HUNTER GUT',  desc: 'ATTACKS +1 DAMAGE',    icon: SPR.BUG1 },
    gold:  { at: 3, name: 'MIDAS GLOW',  desc: 'FOOD +50% SCORE',      icon: SPR.GOLD },
  };

  const BOSS_NAMES = { eagle: 'THE GREAT EAGLE', serpent: 'THE SERPENT KING', owl: 'THE FROST OWL' };
  const BOSS_PATTERNS = { eagle: ['dive', 'sweep', 'feathers'], serpent: ['rise', 'sweep', 'globs'], owl: ['dive', 'shards', 'gust'] };
  const PET_NAMES = { chick: 'PIP THE CHICK', noodle: 'NOODLE THE SNAKE', lumen: 'LUMEN THE FIREFLY' };
  const FLOORKEY = { forest: 'ground', ocean: 'water', tundra: 'ice', desert: 'sand' };
  const FLOORDUST = { forest: ['#5cad3c', '#6b4a2a'], ocean: ['#68b7cf', '#a8e4f2', '#ffffff'], tundra: ['#eef6ff', '#c9dce8'], desert: ['#e8c98a', '#c9a86a'] };

  // ---------- persistent save: DNA (meta currency) + best + tutorial flag + settings ----------
  const SAVE_KEY = 'flappyDarwinSave';
  const DEFAULT_SETTINGS = { shake: true, flash: true, difficulty: 'normal' };
  function normSettings(s) {
    s = s || {};
    const out = {};
    for (const k in DEFAULT_SETTINGS) out[k] = (s[k] === undefined) ? DEFAULT_SETTINGS[k] : s[k];
    if (['easy', 'normal', 'hard'].indexOf(out.difficulty) < 0) out.difficulty = 'normal';
    return out;
  }
  function loadSave() {
    try { const s = JSON.parse(localStorage.getItem(SAVE_KEY)); if (s && s.best) { if (s.dna == null) s.dna = 0; s.settings = normSettings(s.settings); return s; } } catch (e) { /* ignore */ }
    let b = { score: 0, depth: 0, evos: 0 };
    try { const old = JSON.parse(localStorage.getItem('flappyDarwinBest')); if (old) b = old; } catch (e) { /* ignore */ }
    return { dna: 0, best: b, tutorialDone: false, settings: normSettings(null) };
  }
  function persist() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) { /* private mode */ } }
  let save = loadSave();
  let best = save.best;
  let settings = save.settings;
  // difficulty knobs: easy = slower telegraphs + rarer hazards, hard = the reverse
  const DIFF_TABLE = {
    easy:   { tele: 1.35, timer: 1.4,  speed: 0.92, label: 'EASY' },
    normal: { tele: 1.0,  timer: 1.0,  speed: 1.0,  label: 'NORMAL' },
    hard:   { tele: 0.78, timer: 0.72, speed: 1.08, label: 'HARD' },
  };
  function diff() { return DIFF_TABLE[settings.difficulty] || DIFF_TABLE.normal; }
  function addDNA(n) { if (run) run.dnaEarned = (run.dnaEarned || 0) + n; }
  function hatchCost() { return run.checkpoint ? 8 + run.checkpoint.depth * 3 : 999; }

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
  function shakeIt(mag, dur) { if (!settings.shake) return; shake.mag = Math.max(shake.mag, mag); shake.t = Math.max(shake.t, dur); }
  function setFlash(v) { if (settings.flash) flashT = Math.max(flashT, v); }

  // Features reveal gradually so the game opens simple and teaches one thing at a
  // time. Values are the depth (leg) at which each system switches on.
  const FEATURES = { energy: 3, hazards: 4, combat: 4, minigames: 5 };
  function unlocked(f) { return !run || run.depth >= (FEATURES[f] || 1); }

  function newRun(tutorialMode) {
    run = {
      depth: 0, score: 0, scorePop: 0,
      evo: 0, evoNeed: 45, evolutions: 0,
      taken: [], diet: { berry: 0, seed: 0, nut: 0, bug: 0, gold: 0 },
      foodEaten: 0, obstaclesPassed: 0, evoReadyPinged: false, bugsChased: 0,
      dnaEarned: 0, checkpoint: null,
      skillId: 'peck', pets: [], passives: {}, kills: 0,
      tutorialMode: !!tutorialMode || !save.tutorialDone,
      darwin: null, tip: null, seenTips: {}, journey: [{ depth: 0, key: 'meadow', type: 'start', danger: 0 }],
      tut: { flap: true, catch: true, digest: true, snake: true, snapper: true, hawk: true, energy: true, durian: true, chase: true, falcon: true, bat: true, dfly: true, bfrog: true, jelly: true, piranha: true, vulture: true, sbug: true, hornet: true },
    };
    bird = {
      x: BIRD_X, y: 84, vy: 0, rot: 0,
      hearts: 3, maxHearts: 3, invuln: 0,
      carried: null, crop: null, digestT: 0, digestNeed: 0,
      fullness: 0, stuffed: false, boost: 0, latched: null,
      energy: 100, maxEnergy: 100, tired: 0,
      atkCd: 0, atkLunge: 0,
      flapT: 0, animT: 0, blinkT: rnd(1.5, 4), blinking: 0, openT: 0,
      catchPop: 0, grazeActive: 0, grazeCd: 0,
      glideHeld: false, shieldUp: false, dead: false, deathBy: null,
      legsDown: false, glidePose: false,
    };
    newBestFlag = false;
    parts = []; floats = [];
    newLeg('meadow');
    startIntro(); // open with the hatch cutscene (newLeg left us at STATE 'fly')
  }

  function has(id) { return run.taken.indexOf(id) !== -1; }

  function stats() {
    let flap = -172, grav = 560, maxFall = 210, catchR = 6, digestMul = 1, cap = 70;
    let flapCost = 13, maxEnergy = 100, regen = 20;
    if (has('wings')) flap *= 1.25;
    if (has('hollow')) grav *= 0.82;
    if (has('rudder')) maxFall *= 0.7;
    if (has('beak')) catchR += 3;
    if (has('gut')) digestMul *= 0.65;
    if (has('stomach')) cap *= 1.4;
    if (has('lungs')) maxEnergy += 45;
    if (has('light')) flapCost *= 0.68;
    if (has('photo')) regen += 9;
    if (has('aerial')) maxFall *= 0.8;
    if (run.passives.seed) flapCost *= 0.8; // SWIFT WINGS diet passive
    if (bird.stuffed) { flap *= 0.88; grav *= 1.18; flapCost *= 1.2; }
    return {
      flap: flap, grav: grav, maxFall: maxFall, catchR: catchR, digestMul: digestMul,
      cap: cap, glide: has('glide') || has('aerial'), cropSlots: has('crop') ? 1 : 0,
      flapCost: flapCost, maxEnergy: maxEnergy, regen: regen,
    };
  }

  function newLeg(biomeKey) {
    run.depth++;
    const d = run.depth;
    const biome = BIOMES[biomeKey];
    const hasPred = biome.hazards.length > 0;
    if (d > 1) addDNA(2); // reaching a new leg earns DNA
    // checkpoint = snapshot at the start of this leg, so death can hatch you back here
    run.checkpoint = { depth: d, biomeKey: biomeKey, taken: run.taken.slice(), maxHearts: bird ? bird.maxHearts : 3, evolutions: run.evolutions, evoNeed: run.evoNeed, score: run.score, dnaEarned: run.dnaEarned, skillId: run.skillId, pets: run.pets.map(function (p) { return p.kind; }), passives: Object.assign({}, run.passives) };
    // Darwin's interactive tutorial runs on the first leg
    if (d === 1 && run.tutorialMode) run.darwin = { step: 0, t: 0, done: false, flapped: false, ate: false, digested: false, grazed: false };
    if (!biome.boss) run.journey.push({ depth: d, key: biomeKey, type: 'biome', danger: biome.danger });
    const DT = diff().timer, has2 = function (h) { return biome.hazards.indexOf(h) >= 0; };
    world = {
      biomeKey: biomeKey, biome: biome,
      dist: 0,
      speed: (d === 1 ? 42 : Math.min(84, 46 + (d - 1) * 3.0)) * diff().speed,
      spacing: Math.max(90, (biome.dense ? 108 : 118) - d * 1.6),
      gapH: Math.max(40, biome.gapBase - (d - 1) * 0.9),
      legLen: (d === 1 ? 6 : Math.min(20, 6 + d * 2)) - (hasPred ? 1 : 0),
      spawned: 0, nextSpawnX: W + (d === 1 ? 110 : 60),
      obstacles: [], foods: [], snappers: [], hawk: null,
      phase: 'fly', island: null, cine: null,
      banner: 2.4, fade: 1,
      gust: null, gustTimer: biome.wind ? rnd(2.5, 4.5) * DT : -1,
      snapperTimer: has2('snapper') ? rnd(3.5, 6) * DT : -1,
      hawkTimer: has2('hawk') ? rnd(4, 7) * DT : -1,
      falconTimer: has2('falcon') ? rnd(5, 9) * DT : -1, falcon: null,
      chaseTimer: rnd(4.5, 9), chaseBug: null, thermal: null, rush: null, eventBanner: null,
      legDiet: { berry: 0, seed: 0, nut: 0, bug: 0, gold: 0 },
      cam: { scale: 1, focusX: W / 2, focusY: H / 2, kickX: 0, kickY: 0 },
      // new hazards (roaming flyers + floor leapers)
      bat: null,   batTimer: has2('bat') ? rnd(4, 7) * DT : -1,
      dfly: null,  dflyTimer: has2('dfly') ? rnd(4, 8) * DT : -1,
      vulture: null, vultureTimer: has2('vulture') ? rnd(5, 9) * DT : -1,
      leapers: [], leaperTimer: (has2('bfrog') || has2('jelly') || has2('piranha')) ? rnd(3.5, 6) * DT : -1,
      sbugs: [], sbugTimer: has2('shieldbug') ? rnd(4, 7) * DT : -1,
      hornets: [],
      slalom: null, trail: null, storm: null, flutter: null,
      shots: [], fx: [],
    };
    bird.x = BIRD_X; bird.y = 84; bird.vy = 0; bird.rot = 0; bird.dead = false;
    bird.shieldUp = has('shield') || !!run.passives.nut; bird.invuln = 0.8; bird.legsDown = false; bird.glidePose = false;
    world.wasps = null; world.waspT = 0;
    // early legs stay calm — hold hazards and bonus events back until they unlock
    if (!unlocked('hazards')) { world.gustTimer = -1; world.snapperTimer = -1; world.hawkTimer = -1; world.falconTimer = -1; world.batTimer = -1; world.dflyTimer = -1; world.vultureTimer = -1; world.leaperTimer = -1; world.sbugTimer = -1; }
    if (!unlocked('minigames')) world.chaseTimer = 1e9;
    if (biome.boss) {
      world.isBoss = true; world.legLen = 0; world.banner = 3.0;
      world.boss = { kind: biome.bossKind || 'eagle', hp: 110, maxHp: 110, state: 'enter', t: 0, x: W + 30, y: 34, wing: 0, pattern: null, attacks: 0, lockY: bird.y, lockX: bird.x, feathers: [], first: true };
    }
    // Darwin the guide returns to introduce each system as it switches on
    if (!run.darwin) {
      if (biome.boss) guide('boss', ['A BOSS! DODGE', 'ITS PATTERNS -', 'AND FIGHT BACK!']);
      else if (d === FEATURES.energy) guide('energy', ['YOUR WINGS TIRE', 'NOW - GLIDE AND', 'EAT TO RECOVER']);
      else if (d === FEATURES.hazards) guide('danger', ['DANGER AHEAD!', 'DODGE FOES - OR', 'PRESS X TO FIGHT']);
      else if (d === FEATURES.minigames) guide('events', ['BONUS EVENTS', 'APPEAR NOW -', 'CHASE THE PRIZES!']);
    }
    STATE = 'fly';
  }

  // ---------- input ----------
  let flapQueued = false, actionQueued = false, boostQueued = false, swipeQueued = false, attackQueued = false, lastFlapPress = -1;
  const REROLL_COST = 5, BOOST_COST = 22;

  function menuItems() { return ['PLAY', 'TUTORIAL', 'SETTINGS', AUDIO.isMuted() ? 'UNMUTE' : 'MUTE']; }
  function gotoTitle() { STATE = 'title'; ui = { demoY: 84, menuSel: 0 }; }
  function activateMenu() {
    const sel = ui.menuSel || 0;
    if (sel === 0) { AUDIO.play('confirm'); newRun(false); }
    else if (sel === 1) { AUDIO.play('confirm'); newRun(true); }
    else if (sel === 2) { AUDIO.play('confirm'); openSettings(); }
    else AUDIO.toggleMute();
  }

  // ---------- settings screen ----------
  function openSettings() { STATE = 'settings'; ui = { menuSel: 0, confirmReset: false, t: 0, resetFlash: 0 }; }
  function settingsItems() {
    return [
      { key: 'sfx',        label: 'SOUND FX',     val: AUDIO.isMuted() ? 'OFF' : 'ON' },
      { key: 'shake',      label: 'SCREEN SHAKE', val: settings.shake ? 'ON' : 'OFF' },
      { key: 'flash',      label: 'HIT FLASH',    val: settings.flash ? 'ON' : 'OFF' },
      { key: 'difficulty', label: 'DIFFICULTY',   val: diff().label },
      { key: 'reset',      label: 'RESET SAVE',   val: ui.confirmReset ? 'PRESS AGAIN!' : '-', action: true },
      { key: 'back',       label: 'BACK',         val: '', action: true },
    ];
  }
  function doResetSave() {
    save = { dna: 0, best: { score: 0, depth: 0, evos: 0 }, tutorialDone: false, settings: normSettings(settings) };
    best = save.best; settings = save.settings; persist();
    AUDIO.play('evolve'); ui.confirmReset = false; ui.resetFlash = 0.6;
  }
  function settingChange(sel, mode) { // mode: -1 left, +1 right, 0 activate
    const it = settingsItems()[sel]; if (!it) return;
    if (it.key === 'reset') { if (mode === 0) { if (ui.confirmReset) doResetSave(); else { ui.confirmReset = true; AUDIO.play('select'); } } return; }
    if (it.key === 'back') { if (mode === 0) { persist(); AUDIO.play('confirm'); gotoTitle(); } return; }
    ui.confirmReset = false;
    if (it.key === 'sfx') AUDIO.toggleMute();
    else if (it.key === 'shake') settings.shake = !settings.shake;
    else if (it.key === 'flash') settings.flash = !settings.flash;
    else if (it.key === 'difficulty') { const order = ['easy', 'normal', 'hard']; let i = order.indexOf(settings.difficulty); i = (i + (mode === 0 ? 1 : mode) + 3) % 3; settings.difficulty = order[i]; }
    persist(); AUDIO.play('select');
  }
  function activateOver() {
    const opt = (ui.options || ['new'])[ui.sel || 0];
    if (opt === 'hatch') hatchFromCheckpoint();
    else { AUDIO.play('confirm'); gotoTitle(); }
  }
  function rerollCards() {
    if (STATE !== 'island' || ui.phase !== 'mutate') return;
    if (save.dna < REROLL_COST) { AUDIO.play('denied'); return; }
    save.dna -= REROLL_COST; persist();
    ui.cards = makeMutationCards(); ui.sel = 0; AUDIO.play('select');
  }

  function press() {
    AUDIO.unlock();
    if (STATE === 'intro') { skipIntro(); return; }
    if (STATE === 'title') { activateMenu(); return; }
    if (STATE === 'over') { if (ui.overT > 0.7) activateOver(); return; }
    if (paused) { paused = false; return; }
    if (STATE === 'fly') {
      if (world.phase === 'fly') {
        if (bird.latched) { swipeQueued = true; return; }
        if (time - lastFlapPress < 0.30) boostQueued = true;
        lastFlapPress = time;
        flapQueued = true;
      } else if (world.phase === 'cine') skipCine();
      return;
    }
    if (STATE === 'island') actionQueued = true;
  }

  window.addEventListener('keydown', function (e) {
    const up = e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW';
    if (STATE === 'intro') { if (!e.repeat) { e.preventDefault(); skipIntro(); } return; }
    if (STATE === 'title') {
      const n = menuItems().length;
      if (e.code === 'ArrowUp' || e.code === 'KeyW') { e.preventDefault(); ui.menuSel = (ui.menuSel + n - 1) % n; AUDIO.play('select'); return; }
      if (e.code === 'ArrowDown' || e.code === 'KeyS') { e.preventDefault(); ui.menuSel = (ui.menuSel + 1) % n; AUDIO.play('select'); return; }
      if (up || e.code === 'Enter') { e.preventDefault(); if (!e.repeat) activateMenu(); return; }
    }
    if (STATE === 'settings') {
      const n = settingsItems().length;
      if (e.code === 'ArrowUp' || e.code === 'KeyW') { e.preventDefault(); ui.menuSel = (ui.menuSel + n - 1) % n; ui.confirmReset = false; AUDIO.play('select'); return; }
      if (e.code === 'ArrowDown' || e.code === 'KeyS') { e.preventDefault(); ui.menuSel = (ui.menuSel + 1) % n; ui.confirmReset = false; AUDIO.play('select'); return; }
      if (e.code === 'ArrowLeft' || e.code === 'KeyA') { e.preventDefault(); settingChange(ui.menuSel, -1); return; }
      if (e.code === 'ArrowRight' || e.code === 'KeyD') { e.preventDefault(); settingChange(ui.menuSel, +1); return; }
      if (up || e.code === 'Enter') { e.preventDefault(); if (!e.repeat) settingChange(ui.menuSel, 0); return; }
      if (e.code === 'Escape' || e.code === 'KeyR') { e.preventDefault(); persist(); AUDIO.play('confirm'); gotoTitle(); return; }
      return;
    }
    if (STATE === 'over') {
      const opts = ui.options || ['new'];
      if ((e.code === 'ArrowLeft' || e.code === 'KeyA') && opts.length > 1) { ui.sel = (ui.sel + opts.length - 1) % opts.length; AUDIO.play('select'); return; }
      if ((e.code === 'ArrowRight' || e.code === 'KeyD') && opts.length > 1) { ui.sel = (ui.sel + 1) % opts.length; AUDIO.play('select'); return; }
      if (up || e.code === 'Enter') { e.preventDefault(); if (!e.repeat && ui.overT > 0.7) activateOver(); return; }
    }
    if (up) { e.preventDefault(); if (!e.repeat) { press(); bird && (bird.glideHeld = true); } return; }
    if (e.code === 'KeyX' || e.code === 'KeyC') { if (STATE === 'fly') { e.preventDefault(); attackQueued = true; } return; }
    if (e.code === 'KeyM') { AUDIO.toggleMute(); return; }
    if (e.code === 'KeyP' && (STATE === 'fly' || STATE === 'island')) { paused = !paused; return; }
    if (e.code === 'KeyR') {
      if (STATE === 'island' && ui.phase === 'mutate') { rerollCards(); return; }
      if (STATE === 'fly' || STATE === 'island') { AUDIO.play('confirm'); gotoTitle(); return; }
    }
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
    if (STATE === 'title' && ui.menuRects) {
      for (let i = 0; i < ui.menuRects.length; i++) { const c = ui.menuRects[i]; if (gx >= c.x && gx <= c.x + c.w && gy >= c.y && gy <= c.y + c.h) { if (ui.menuSel === i) activateMenu(); else { ui.menuSel = i; AUDIO.play('select'); } return; } }
      activateMenu(); return;
    }
    if (STATE === 'settings') {
      if (ui.setRects) for (let i = 0; i < ui.setRects.length; i++) { const c = ui.setRects[i]; if (gx >= c.x && gx <= c.x + c.w && gy >= c.y && gy <= c.y + c.h) { if (ui.menuSel === i) settingChange(i, 0); else { ui.menuSel = i; ui.confirmReset = false; AUDIO.play('select'); } return; } }
      return;
    }
    if (STATE === 'over' && ui.overRects) {
      for (let i = 0; i < ui.overRects.length; i++) { const c = ui.overRects[i]; if (gx >= c.x && gx <= c.x + c.w && gy >= c.y && gy <= c.y + c.h) { if (ui.sel === i) { if (ui.overT > 0.7) activateOver(); } else { ui.sel = i; AUDIO.play('select'); } return; } }
      if (ui.overT > 0.7) activateOver();
      return;
    }
    if (STATE === 'fly' && world && world.phase === 'fly' && ui.atkRect) { // tap the attack button
      const c = ui.atkRect;
      if (gx >= c.x - 3 && gx <= c.x + c.w + 3 && gy >= c.y - 3 && gy <= c.y + c.h + 3) { attackQueued = true; return; }
    }
    if (STATE === 'island' && ui.phase === 'mutate' && ui.rerollRect) {
      const c = ui.rerollRect;
      if (gx >= c.x && gx <= c.x + c.w && gy >= c.y && gy <= c.y + c.h) { rerollCards(); return; }
    }
    if (STATE === 'island' && ui.cards && ui.cardRects) {
      for (let i = 0; i < ui.cardRects.length; i++) {
        const c = ui.cardRects[i];
        if (gx >= c.x && gx <= c.x + c.w && gy >= c.y && gy <= c.y + c.h) {
          if (ui.sel === i) actionQueued = true; else { ui.sel = i; AUDIO.play('select'); }
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
    if (run.darwin) run.darwin.ate = true;
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
    if (has('forager')) nutr = Math.round(nutr * 1.25);
    if (run.passives.gold) nutr = Math.round(nutr * 1.5); // MIDAS GLOW diet passive
    bird.carried = null;
    run.diet[def.bucket]++; world.legDiet[def.bucket]++;
    checkPassives(def.bucket);
    run.foodEaten++; run.score += nutr; run.scorePop = 0.25;
    run.evo += nutr; bird.fullness += nutr;
    bird.energy = Math.min(st.maxEnergy, bird.energy + Math.round(nutr * 0.8)); // eating refuels the wings
    addDNA(1); if (run.darwin) run.darwin.digested = true;
    AUDIO.play('gulp');
    addFloat(beakPos().x + 4, bird.y - 12, '+' + nutr, kind === 'gold' ? '#fff3a8' : '#96d454', nutr >= 24);
    const col = def.bucket === 'berry' ? '#e0525c' : (kind === 'gold' ? '#f6c945' : (def.bucket === 'bug' ? '#3e7a2e' : '#a76f3e'));
    spawnParts(5, function () { return crumb(bird.x + 8, bird.y, col); });
    if (bird.fullness > st.cap && !bird.stuffed) { bird.stuffed = true; AUDIO.play('stuffed'); addFloat(bird.x, bird.y - 20, 'STUFFED!', '#e0525c'); }
    if (run.evo >= run.evoNeed && !run.evoReadyPinged) { run.evoReadyPinged = true; AUDIO.play('evoReady'); addFloat(bird.x, bird.y - 26, 'EVOLUTION READY!', '#3fc0b0'); }
    if (bird.crop) { const k = bird.crop; bird.crop = null; startDigest(k, st); }
  }

  // diet passives — devotion to one food group awakens an ability
  function checkPassives(bucket) {
    const P = PASSIVES[bucket]; if (!P) return;
    if (!run.passives[bucket] && run.diet[bucket] >= P.at) {
      run.passives[bucket] = true;
      AUDIO.play('evolve');
      addFloat(bird.x, bird.y - 30, 'PASSIVE: ' + P.name + '!', '#96f0e4', true);
      addFloat(bird.x, bird.y - 20, P.desc, '#c9d2e0');
      spawnParts(14, function () { return sparkle(bird.x + rnd(-10, 10), bird.y + rnd(-10, 6), '#96f0e4'); });
      if (bucket === 'nut') bird.shieldUp = true;
    } else if (bucket === 'berry' && run.passives.berry && run.diet.berry % PASSIVES.berry.at === 0 && bird.hearts < bird.maxHearts) {
      bird.hearts++; AUDIO.play('heart'); addFloat(bird.x, bird.y - 22, '+1 HEART', '#f2748f', true);
    }
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
    if (run.darwin) run.darwin.grazed = true;
    if (dir > 0) { bird.y = surfaceY - 4; bird.vy = bird.vy > 0 ? -GRAZE_NUDGE : Math.max(bird.vy, -GRAZE_NUDGE); }
    else { bird.y = surfaceY + 4; bird.vy = bird.vy < 0 ? GRAZE_NUDGE * 0.6 : Math.min(bird.vy, GRAZE_NUDGE * 0.6); }
    bird.grazeActive = 0.06;
    if (time - _grazeSfx > 0.16) {
      _grazeSfx = time; AUDIO.play('rustle'); shakeIt(0.6, 0.08);
      bird.energy = Math.min(bird.maxEnergy || 100, bird.energy + 9); // sliding along leaves restores wing energy
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
    if (opts.flash) setFlash(opts.flash);
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
    best.score = Math.max(best.score, run.score);
    best.depth = Math.max(best.depth, run.depth);
    best.evos = Math.max(best.evos, run.evolutions);
    save.best = best;
    save.dna += (run.dnaEarned || 0); run.dnaEarned = 0; // bank this life's DNA
    persist();
    const canHatch = !!run.checkpoint && save.dna >= hatchCost();
    ui = { overT: 0, sel: 0, canHatch: canHatch, options: canHatch ? ['hatch', 'new'] : ['new'] };
    STATE = 'over';
  }

  function hatchFromCheckpoint() {
    const cp = run.checkpoint; if (!cp) { newRun(); return; }
    const cost = hatchCost();
    if (save.dna < cost) { return; }
    save.dna -= cost; persist();
    run.taken = cp.taken.slice(); run.evolutions = cp.evolutions; run.evoNeed = cp.evoNeed;
    run.evo = 0; run.evoReadyPinged = false; run.score = cp.score; run.dnaEarned = cp.dnaEarned || 0;
    run.depth = cp.depth - 1;
    run.skillId = cp.skillId || 'peck';
    run.passives = Object.assign({}, cp.passives || {});
    run.pets = (cp.pets || []).map(function (k) { return { kind: k, x: BIRD_X - 14, y: 84, t: rnd(0, 6.28), cd: 2 }; });
    bird.maxHearts = cp.maxHearts; bird.hearts = cp.maxHearts; bird.dead = false;
    bird.carried = null; bird.crop = null; bird.fullness = 0; bird.stuffed = false; bird.energy = 100;
    parts = []; floats = [];
    AUDIO.play('evolve');
    newLeg(cp.biomeKey);
  }

  // threat budget — never arm two predators / a gust at once
  function threatFree() {
    if (world.gust && world.gust.t < world.gust.warn + world.gust.dur) return false;
    for (const o of world.obstacles) if (o.snake && (o.snake.state === 'windup' || o.snake.state === 'strike')) return false;
    for (const s of world.snappers) if (s.state === 'telegraph' || s.state === 'lunge') return false;
    if (world.hawk && (world.hawk.state === 'warn' || world.hawk.state === 'swoop')) return false;
    if (world.falcon && (world.falcon.state === 'warn' || world.falcon.state === 'chase')) return false;
    if (world.bat && world.bat.state !== 'gone') return false;
    if (world.dfly && world.dfly.state !== 'gone') return false;
    if (world.vulture && world.vulture.state !== 'gone') return false;
    if (world.leapers) for (const l of world.leapers) if (l.state === 'telegraph' || l.state === 'leap') return false;
    return true;
  }

  // ---------- island / card ui ----------
  function makeMutationCards() {
    const pool = MUTATIONS.filter(function (m) { return m.repeat || !has(m.id); });
    const cards = [];
    const bag = pool.slice();
    const traitCount = unlocked('combat') ? 2 : 3; // full trait choice before skills exist
    while (cards.length < traitCount && bag.length) {
      const entries = bag.map(function (m) {
        const dietBonus = m.diet === 'any' ? 0.6 : run.diet[m.diet] * 0.3;
        const rw = RARITY[m.rarity] ? RARITY[m.rarity].w : 1;
        return { v: m, w: rw * (1 + dietBonus) };
      });
      const m = pickWeighted(entries);
      bag.splice(bag.indexOf(m), 1);
      cards.push({ kind: 'mut', mut: m, title: m.name, lines: wrap(m.desc, 13), icon: m.icon, rarity: m.rarity });
    }
    // once combat is unlocked, the third card teaches a new attack skill
    const skIds = unlocked('combat') ? Object.keys(SKILLS).filter(function (k) { return k !== run.skillId; }) : [];
    if (skIds.length) {
      const sid = pick(skIds), sk = SKILLS[sid];
      cards.push({ kind: 'skill', skill: sid, title: sk.name, lines: wrap(sk.desc, 13), icon: sk.icon, rarity: 'skill' });
    }
    return cards;
  }

  function makePathCards() {
    if (run.depth > 0 && run.depth % 4 === 0) { // a boss stage looms — the three area bosses rotate
      const bk = ['aerie', 'pit', 'gale'][(Math.floor(run.depth / 4) - 1) % 3];
      return [{ kind: 'path', biomeKey: bk, title: BIOMES[bk].name, lines: ['A BOSS AWAITS'], icon: BIOMES[bk].icon, danger: 5, boss: true }];
    }
    let keys = BIOME_KEYS.filter(function (k) { return k !== world.biomeKey && !BIOMES[k].boss; });
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

  function hatchCommon() { // shared new-generation fanfare
    run.evolutions++;
    run.evo = Math.max(0, run.evo - run.evoNeed);
    run.evoNeed += 15;
    run.evoReadyPinged = run.evo >= run.evoNeed;
    run.score += 150; addDNA(5);
    AUDIO.play('evolve'); AUDIO.play('chirp');
    freezeT = 0.12; shakeIt(1.5, 0.30); ui.flash = 0.35;
    if (STATE === 'island') { ui.hatched = true; ui.hatchAnim = 0; } // egg cracks -> baby born
    addFloat(bird.x, bird.y - 24, 'GEN ' + (run.evolutions + 1) + ' HATCHED!', '#3fc0b0', true);
    spawnParts(28, function () { return sparkle(bird.x + rnd(-16, 16), bird.y + rnd(-16, 10), '#3fc0b0'); });
    spawnParts(14, function () { return crumb(bird.x + rnd(-5, 5), bird.y - 2, pick(['#fbe7bb', '#e5c28c', '#ffffff'])); }); // eggshell
  }
  function applyMutation(m) {
    run.taken.push(m.id);
    ui.lastGain = m.name;
    if (m.id === 'downy') { bird.maxHearts = Math.min(5, bird.maxHearts + 1); bird.hearts = bird.maxHearts; AUDIO.play('heart'); }
    hatchCommon();
  }
  function applySkill(sid) {
    run.skillId = sid;
    ui.lastGain = SKILLS[sid].name;
    AUDIO.play('slash');
    addFloat(bird.x, bird.y - 32, 'LEARNED ' + SKILLS[sid].name + '!', '#ff9f4d', true);
    hatchCommon();
  }

  // ---------- update: flying ----------
  function updateFly(dt) {
    const st = stats();
    if (bird.boost > 0) bird.boost = Math.max(0, bird.boost - dt);
    world.dist += world.speed * (bird.boost > 0 ? 1.9 : 1) * dt;
    if (world.banner > 0) world.banner -= dt;
    if (world.fade > 0) world.fade -= dt * 2.2;

    // combat
    bird.atkCd = Math.max(0, bird.atkCd - dt);
    bird.atkLunge = Math.max(0, bird.atkLunge - dt);
    if (attackQueued) { attackQueued = false; tryAttack(); }
    updateShots(dt); updateFx(dt); tickPoison(dt);

    // spawn obstacles
    if (world.phase === 'fly' && !world.isBoss) {
      while (world.spawned < world.legLen && world.nextSpawnX - world.dist < W + 60) {
        const margin = 26;
        const hz = unlocked('hazards'); // hold canopy hazards back on the opening legs
        let gh = world.gapH;
        if (run.depth === 1 && world.spawned < 2) gh += 14; // tutorial
        const snakeRoll = hz && world.biome.hazards.indexOf('snake') >= 0 &&
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
          if (!prevSnake) o.snake = { state: 'dormant', t: 0, lockY: 0, spent: false, first: run.tut.snake, hp: 3, maxhp: 3 };
        }
        // durian: spiky fruit that hangs from the canopy and drops when you near it
        if (hz && !o.snake && world.biome.durian && world.spawned > 0 && Math.random() < 0.3) {
          o.durian = { state: 'hang', t: 0, vy: 0, worldX: o.x + o.w / 2, y: (gapY - gh / 2) + 5, first: run.tut.durian, hp: 1, maxhp: 1 };
        }
        // spider: drops on a thread into the gap
        if (hz && !o.snake && !o.durian && world.biome.obst === 'tree' && ['jungle', 'swamp', 'marsh', 'grove'].indexOf(world.biomeKey) >= 0 && world.spawned > 0 && Math.random() < 0.22) {
          o.spider = { state: 'hidden', t: 0, y: 0, hp: 1, maxhp: 1 };
        }
        // hornet nest: papery hive under the canopy that releases angry hornets
        if (hz && !o.snake && !o.durian && !o.spider && ['marsh', 'jungle'].indexOf(world.biomeKey) >= 0 && world.spawned > 0 && Math.random() < 0.18) {
          o.hnest = { hp: 4, maxhp: 4, cd: 0.9, dead: false, first: run.tut.hornet };
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
    if (bird.latched && !bird.dead) {
      bird.maxEnergy = st.maxEnergy;
      updateLatch(dt);
    } else if (!bird.dead && world.phase === 'fly') {
      bird.maxEnergy = st.maxEnergy;
      if (boostQueued) { boostQueued = false; tryBoost(st); }
      if (flapQueued) {
        flapQueued = false;
        const cost = unlocked('energy') ? st.flapCost : 0; // free flaps until wing energy unlocks
        if (bird.energy >= cost) { bird.vy = st.flap; bird.energy -= cost; }
        else {
          if (bird.tired <= 0) AUDIO.play('denied');
          bird.vy = st.flap * 0.62; bird.energy = 0; bird.tired = 0.4;
          if (run.tut.energy) { run.tut.energy = false; addFloat(bird.x, bird.y - 22, 'TIRED! GLIDE + EAT', '#f6c945'); }
        }
        bird.flapT = 0.24;
        if (run.darwin) run.darwin.flapped = true;
        AUDIO.play('flap');
        parts.push(puff(bird.x - 6, bird.y + 5));
        if (Math.random() < 0.3) parts.push(feather(bird.x - 4, bird.y + 3));
      }
      let grav = st.grav, maxFall = st.maxFall, regen = st.regen;
      bird.glidePose = false;
      if (st.glide && bird.glideHeld && bird.vy > 0) { grav *= (has('aerial') ? 0.24 : 0.35); maxFall *= (has('aerial') ? 0.32 : 0.42); bird.glidePose = true; regen += 12; }
      bird.energy = Math.min(st.maxEnergy, bird.energy + regen * dt);
      bird.tired = Math.max(0, bird.tired - dt);
      bird.vy = Math.min(bird.vy + grav * dt, maxFall);
      bird.y += bird.vy * dt;
      if (bird.y < 6) { bird.y = 6; bird.vy = Math.max(bird.vy, 0); }
      bird.rot = clamp(bird.vy / 300, -0.45, 0.9) * 0.7;
    } else if (bird.dead) {
      bird.vy = Math.min(bird.vy + 700 * dt, 320);
      bird.y += bird.vy * dt;
      bird.rot += dt * 6;
      if (bird.y > SEA_Y + 6) { AUDIO.play('land'); spawnParts(16, function () { return dust(bird.x, SEA_Y, pick(['#5cad3c', '#6b4a2a', '#3d7f2a'])); }); gameOver(); return; }
    }

    // obstacles: scroll, pass, soft/solid collide
    const hx = has('nimble') ? 4 : HX, hy = has('nimble') ? 3 : HY;
    const bx0 = bird.x - hx, bx1 = bird.x + hx, by0 = bird.y - hy, by1 = bird.y + hy;
    for (let i = world.obstacles.length - 1; i >= 0; i--) {
      const o = world.obstacles[i];
      const sx = o.x - world.dist;
      if (!o.passed && sx + o.w < bird.x - 8) {
        o.passed = true; run.obstaclesPassed++; run.score += 10; run.scorePop = 0.25; addDNA(1); AUDIO.play('point');
        const tH = o.gapY - o.gapH / 2, bY = o.gapY + o.gapH / 2;
        if (by0 - tH < 7 || bY - by1 < 7) { AUDIO.play('whoosh'); parts.push(streak(bird.y)); }
        const col = o.kind === 'rock' ? '#c9d2e0' : '#5cad3c';
        spawnParts(2, function () { return leaf(sx + o.w, o.gapY, col); });
      }
      if (sx + o.w < -40) { world.obstacles.splice(i, 1); continue; }
      if (bird.dead || bird.latched) continue;
      if (bx1 <= sx || bx0 >= sx + o.w) continue;
      const topH = o.gapY - o.gapH / 2, botY = o.gapY + o.gapH / 2, cx = sx + o.w / 2;
      if (o.kind === 'rock' || o.kind === 'cactus') { if (bird.invuln <= 0 && (by0 < topH || by1 > botY)) hurt(o.kind); continue; }
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

    // predators & hazards
    updateSnakes(dt);
    updateSnappers(dt);
    updateHawk(dt);
    if (world.falconTimer > 0 && world.phase === 'fly' && !world.falcon) {
      world.falconTimer -= dt;
      if (world.falconTimer <= 0) {
        if (threatFree()) { world.falcon = { state: 'warn', t: 0, x: -20, y: bird.y, snapCd: 0, first: run.tut.falcon, hp: 4, maxhp: 4 }; AUDIO.play('hawkScreech'); if (world.falcon.first) { run.tut.falcon = false; addFloat(BIRD_X, bird.y - 24, 'FALCON!', '#a8b4c4'); } }
        else world.falconTimer = 0.5;
      }
    }
    updateFalcon(dt);
    updateDurians(dt);
    updateSpiders(dt);
    updateWasps(dt);
    updateBat(dt);
    updateDragonfly(dt);
    updateVulture(dt);
    updateLeapers(dt);
    updateShieldbugs(dt);
    updateHornets(dt);
    if (world.isBoss) updateBoss(dt);
    // random bonus event: mini-games + the wasp swarm
    if (world.chaseTimer > 0 && world.phase === 'fly') {
      world.chaseTimer -= dt;
      if (world.chaseTimer <= 0 && world.spawned > 2 && !eventBusy()) {
        startEvent(pick(['chase', 'thermal', 'rush', 'wasps', 'slalom', 'trail', 'storm', 'flutter']));
        world.chaseTimer = rnd(8, 14); // allow another event later this leg
      }
    }
    updateChase(dt); updateThermal(dt); updateRush(dt);
    updateSlalom(dt); updateTrail(dt); updateStorm(dt); updateFlutter(dt);
    if (world.eventBanner) { world.eventBanner.t += dt; if (world.eventBanner.t > 2.2) world.eventBanner = null; }

    // floor contact — varies by environment
    if (!bird.dead && bird.y + 5 > SEA_Y && world.phase === 'fly') {
      const fk = FLOORKEY[world.biome.env] || 'ground';
      const fd = FLOORDUST[world.biome.env] || FLOORDUST.forest;
      spawnParts(10, function () { return dust(bird.x, SEA_Y, pick(fd)); });
      AUDIO.play(world.biome.env === 'ocean' ? 'splash' : 'land');
      if (bird.hearts > 1 || bird.shieldUp) { hurt(fk); bird.y = SEA_Y - 6; bird.vy = -200; }
      else { bird.hearts = 0; bird.dead = true; bird.deathBy = fk; gameOver(); return; }
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
      if (!bird.dead && !bird.latched && tryCatch(f, st)) world.foods.splice(i, 1);
    }

    // digestion
    if (bird.carried && !bird.dead) { bird.digestT += dt; if (bird.digestT >= bird.digestNeed) finishDigest(st); }
    bird.fullness = Math.max(0, bird.fullness - 7 * dt);
    if (bird.stuffed) {
      if (Math.random() < 0.06) parts.push(sparkle(bird.x + rnd(-6, 8), bird.y - 9, '#a8e4f2'));
      if (bird.fullness < st.cap * 0.6) bird.stuffed = false;
    }

    bird.invuln = Math.max(0, bird.invuln - dt);
    if (run.darwin) updateDarwin(dt);
    updateTip(dt);
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

  // ---------- combat: attacks, projectiles, VFX, enemy health ----------
  function atkDmg(base) { return base + (run.passives.bug ? 1 : 0); }

  // every hittable foe on screen right now, as {kind, x, y, r, o}
  function enemyTargets() {
    const out = [];
    if (!world) return out;
    const push = function (kind, x, y, r, o) { if (o && o.hp > 0 && x > -10 && x < W + 10) out.push({ kind: kind, x: x, y: y, r: r, o: o }); };
    if (world.bat && world.bat.state !== 'gone') push('bat', world.bat.x, world.bat.y, 6, world.bat);
    if (world.dfly && world.dfly.state !== 'gone') push('dfly', world.dfly.x, world.dfly.y, 6, world.dfly);
    if (world.vulture && world.vulture.state !== 'gone') push('vulture', world.vulture.x, world.vulture.y, 8, world.vulture);
    if (world.falcon && world.falcon.state !== 'gone') push('falcon', world.falcon.x, world.falcon.y, 8, world.falcon);
    if (world.hawk && world.hawk.state === 'swoop') push('hawk', world.hawk.hx, world.hawk.hy, 8, world.hawk);
    if (world.wasps) for (const w of world.wasps) push('wasp', w.x, w.y, 4, w);
    if (world.hornets) for (const h of world.hornets) push('hornet', h.x, h.y, 4, h);
    if (world.sbugs) for (const s of world.sbugs) push('sbug', s.sx, s.y, 7, s);
    for (const s of world.snappers) if (s.state !== 'spent') push('snapper', s.sx, (s.state === 'lunge' || s.state === 'retract') ? (s.mawY || SEA_Y) + 5 : SEA_Y - 4, 7, s);
    for (const l of world.leapers) {
      if (l.kind === 'jelly') push('jelly', l.sx, l.y, 5, l);
      else if (l.state !== 'spent') push(l.kind, l.sx, l.state === 'leap' ? l.ly : SEA_Y - 4, 6, l);
    }
    for (const o of world.obstacles) {
      const sx = o.x - world.dist;
      if (o.snake && o.snake.state !== 'spent') {
        const s = o.snake;
        const struck = s.state === 'strike' || s.state === 'recoil' || s.state === 'latched';
        push('snake', struck ? s.headX : (sx + o.w * 0.7), struck ? s.headY : ((o.gapY - o.gapH / 2) + 4), 6, s);
      }
      if (o.spider && (o.spider.state === 'drop' || o.spider.state === 'hang' || o.spider.state === 'climb')) push('spider', o.spider.sx != null ? o.spider.sx : (sx + o.w * 0.5), o.spider.y, 5, o.spider);
      if (o.durian && o.durian.state !== 'spent') push('durian', o.durian.worldX - world.dist, o.durian.y, 4, o.durian);
      if (o.hnest && !o.hnest.dead && o.hnest.sx != null) push('hnest', o.hnest.sx, o.hnest.ny, 6, o.hnest);
    }
    if (world.boss && world.boss.state !== 'defeated' && world.boss.state !== 'enter') push('boss', world.boss.x, world.boss.y, 13, world.boss);
    return out;
  }

  function damageEnemy(t, dmg, opts) {
    const o = t.o;
    if (o.hp == null || o.hp <= 0) return;
    o.hp -= dmg;
    addFloat(t.x, t.y - 8, '-' + dmg, '#ff9f4d');
    spawnParts(4, function () { return sparkle(t.x + rnd(-4, 4), t.y + rnd(-4, 4), '#fff3a8'); });
    AUDIO.play('pop');
    if (t.kind === 'boss') {
      shakeIt(1, 0.1);
      if (o.hp <= 0) { o.state = 'defeated'; o.t = 0; AUDIO.play('die'); bossReward(); }
      return;
    }
    if (opts && opts.dot && o.hp > 0 && !o.poisonT) { o.poisonT = 3.0; o.poisonTick = 0.6; addFloat(t.x, t.y - 14, 'POISONED', '#c7d94a'); }
    if (o.hp <= 0) killEnemy(t);
  }

  function killEnemy(t) {
    const o = t.o, kind = t.kind;
    run.kills++;
    run.score += 20; run.scorePop = 0.25; addDNA(1);
    AUDIO.play('kill');
    addFloat(t.x, t.y - 10, '+20', '#ffd257');
    spawnParts(10, function () { return sparkle(t.x + rnd(-6, 6), t.y + rnd(-6, 6), pick(['#fff3a8', '#ffd257', '#ff9f4d'])); });
    spawnParts(4, function () { return feather(t.x, t.y); });
    if (Math.random() < 0.3) { // a felled foe sometimes drops a snack
      const kd = pick(['berry', 'seed', 'bug']);
      world.foods.push({ kind: kd, def: FOODS[kd], x: t.x, baseY: clamp(t.y, 30, SEA_Y - 24), y: 0, phase: rnd(0, 6.28), wander: 0, hopT: 0, vy: 0 });
    }
    if (kind === 'bat') { world.bat = null; world.batTimer = rnd(5, 9) * diff().timer; }
    else if (kind === 'dfly') { world.dfly = null; world.dflyTimer = rnd(4, 8) * diff().timer; }
    else if (kind === 'vulture') { world.vulture = null; world.vultureTimer = rnd(6, 10) * diff().timer; }
    else if (kind === 'falcon') { world.falcon = null; world.falconTimer = rnd(5, 9) * diff().timer; }
    else if (kind === 'hawk') { world.hawk = null; }
    else if (kind === 'wasp') { const i = world.wasps ? world.wasps.indexOf(o) : -1; if (i >= 0) world.wasps.splice(i, 1); if (world.wasps && !world.wasps.length) world.wasps = null; }
    else if (kind === 'hornet') { const i = world.hornets.indexOf(o); if (i >= 0) world.hornets.splice(i, 1); }
    else if (kind === 'sbug') { const i = world.sbugs.indexOf(o); if (i >= 0) world.sbugs.splice(i, 1); spawnFoodAt(world.dist + t.x); }
    else if (kind === 'snapper') { o.state = 'spent'; }
    else if (kind === 'snake') { if (bird.latched && bird.latched.s === o) freeLatch(true); o.state = 'spent'; o.spent = true; }
    else if (kind === 'spider') { o.state = 'spent'; }
    else if (kind === 'durian') { o.state = 'spent'; spawnParts(6, function () { return leaf(t.x, t.y, '#6ea233'); }); }
    else if (kind === 'hnest') { o.dead = true; run.score += 20; addDNA(2); addFloat(t.x, t.y - 16, 'NEST DOWN!', '#f2a63c'); spawnParts(8, function () { return crumb(t.x, t.y, '#c9b088'); }); }
    else { const i = world.leapers.indexOf(o); if (i >= 0) world.leapers.splice(i, 1); } // bfrog / piranha / jelly
  }

  function tickPoison(dt) {
    const ts = enemyTargets();
    for (const t of ts) {
      const o = t.o;
      if (o.poisonT > 0) {
        o.poisonT -= dt; o.poisonTick -= dt;
        if (Math.random() < 0.2) parts.push(crumb(t.x + rnd(-3, 3), t.y + rnd(-3, 3), '#c7d94a'));
        if (o.poisonTick <= 0) { o.poisonTick = 0.6; damageEnemy(t, 1); }
      }
    }
  }

  function hitArea(x, y, r, dmg, opts) {
    const ts = enemyTargets();
    for (const t of ts) { const dx = t.x - x, dy = t.y - y; if (dx * dx + dy * dy <= (r + t.r) * (r + t.r)) damageEnemy(t, dmg, opts); }
  }

  function tryAttack() {
    if (bird.dead || bird.latched || world.phase !== 'fly') return;
    if (!unlocked('combat')) return;
    if (bird.atkCd > 0) return;
    const id = SKILLS[run.skillId] ? run.skillId : 'peck';
    bird.atkCd = SKILLS[id].cd;
    useSkill(id);
  }

  function useSkill(id) {
    const sk = SKILLS[id], bp = beakPos(), dmg = atkDmg(sk.dmg);
    if (id === 'peck') {
      bird.atkLunge = 0.18; bird.catchPop = 0.15; AUDIO.play('slash');
      world.fx.push({ type: 'slash', x: bp.x + 7, y: bp.y, t: 0, life: 0.18, col: '#f2f7ff' });
      hitArea(bp.x + 10, bp.y, 14, dmg);
    } else if (id === 'seed') {
      AUDIO.play('pop');
      world.shots.push({ kind: 'seed', x: bp.x, y: bp.y, vx: 250, vy: 0, g: 0, dmg: dmg, r: 3 });
    } else if (id === 'volley') {
      AUDIO.play('whoosh');
      for (let i = -1; i <= 1; i++) world.shots.push({ kind: 'quill', x: bp.x, y: bp.y, vx: 230, vy: i * 60, g: 0, dmg: dmg, r: 3 });
    } else if (id === 'slash') {
      AUDIO.play('slash'); bird.atkLunge = 0.14;
      world.fx.push({ type: 'slash', x: bird.x + 4, y: bird.y, t: 0, life: 0.22, col: '#a8e4f2', big: true });
      hitArea(bird.x, bird.y, 22, dmg);
    } else if (id === 'chirp') {
      AUDIO.play('chirp');
      world.fx.push({ type: 'ring', x: bird.x, y: bird.y, t: 0, life: 0.55 });
      const ts = enemyTargets(); for (const t of ts) damageEnemy(t, dmg);
    } else if (id === 'egg') {
      AUDIO.play('whoosh');
      world.shots.push({ kind: 'egg', x: bp.x, y: bp.y - 2, vx: 165, vy: -130, g: 430, dmg: dmg, r: 4, aoe: 20 });
    } else if (id === 'vortex') {
      AUDIO.play('wind');
      world.shots.push({ kind: 'vortex', x: bp.x, y: bp.y, vx: 115, vy: 0, g: 0, dmg: dmg, r: 8, pierce: true, life: 2.4, hitList: [] });
    } else if (id === 'bolt') {
      const ts = enemyTargets();
      let best = null, bd = 1e9;
      for (const t of ts) { const d = (t.x - bird.x) * (t.x - bird.x) + (t.y - bird.y) * (t.y - bird.y); if (d < bd) { bd = d; best = t; } }
      AUDIO.play('zap');
      if (best) { world.fx.push({ type: 'bolt', x: best.x, y: best.y, t: 0, life: 0.3 }); damageEnemy(best, dmg); shakeIt(1.5, 0.12); }
      else world.fx.push({ type: 'bolt', x: bird.x + 44, y: bird.y, t: 0, life: 0.3 });
    } else if (id === 'ray') {
      AUDIO.play('beam');
      world.fx.push({ type: 'beam', x: bp.x, y: bp.y, t: 0, life: 0.4 });
      const ts = enemyTargets(); for (const t of ts) if (t.x > bird.x && Math.abs(t.y - bp.y) < 10) damageEnemy(t, dmg);
    } else if (id === 'venom') {
      AUDIO.play('pop');
      world.shots.push({ kind: 'venom', x: bp.x, y: bp.y, vx: 210, vy: -30, g: 140, dmg: dmg, r: 3, dot: true });
    }
  }

  function explodeEgg(s) {
    AUDIO.play('chomp'); shakeIt(1.5, 0.14);
    world.fx.push({ type: 'burst', x: s.x, y: s.y, t: 0, life: 0.35 });
    spawnParts(10, function () { return crumb(s.x + rnd(-4, 4), s.y + rnd(-4, 4), pick(['#fbe7bb', '#e5c28c', '#ffffff'])); });
    hitArea(s.x, s.y, s.aoe || 20, s.dmg);
  }

  function updateShots(dt) {
    for (let i = world.shots.length - 1; i >= 0; i--) {
      const s = world.shots[i];
      s.t = (s.t || 0) + dt;
      s.vy += (s.g || 0) * dt;
      s.x += s.vx * dt; s.y += s.vy * dt;
      if (s.kind === 'vortex') { s.y += Math.sin(s.t * 7) * 16 * dt; if (Math.random() < 0.5) parts.push(puff(s.x - 5, s.y + rnd(-5, 5))); }
      let dead = s.x > W + 16 || s.y < -12 || (s.life && s.t > s.life);
      if (s.y > SEA_Y - 1) { if (s.kind === 'egg') explodeEgg(s); dead = true; }
      if (!dead) {
        const ts = enemyTargets();
        for (const t of ts) {
          if (s.pierce && s.hitList.indexOf(t.o) >= 0) continue;
          const dx = t.x - s.x, dy = t.y - s.y;
          if (dx * dx + dy * dy <= (s.r + t.r) * (s.r + t.r)) {
            if (s.kind === 'egg') { explodeEgg(s); dead = true; break; }
            damageEnemy(t, s.dmg, { dot: s.dot });
            if (s.pierce) { s.hitList.push(t.o); continue; }
            dead = true; break;
          }
        }
      }
      if (dead) world.shots.splice(i, 1);
    }
  }

  function drawShots() {
    for (const s of world.shots) {
      if (s.kind === 'seed') ctx.drawImage(SPR.SEED, Math.round(s.x - 2), Math.round(s.y - 2));
      else if (s.kind === 'quill') { ctx.fillStyle = '#d9c39a'; ctx.fillRect(Math.round(s.x - 3), Math.round(s.y), 5, 1); ctx.fillStyle = '#9a6c41'; ctx.fillRect(Math.round(s.x + 1), Math.round(s.y), 2, 1); }
      else if (s.kind === 'egg') ctx.drawImage(SPR.EGG, Math.round(s.x - 3), Math.round(s.y - 4));
      else if (s.kind === 'venom') { ctx.fillStyle = '#c7d94a'; ctx.fillRect(Math.round(s.x - 1), Math.round(s.y - 1), 3, 3); ctx.fillStyle = '#3e7a2e'; ctx.fillRect(Math.round(s.x), Math.round(s.y), 1, 1); }
      else if (s.kind === 'vortex') {
        const a = s.t * 12;
        ctx.strokeStyle = 'rgba(168,228,242,0.85)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(s.x, s.y, 6, a, a + 4); ctx.stroke();
        ctx.beginPath(); ctx.arc(s.x, s.y, 4, -a, -a + 4); ctx.stroke();
        ctx.beginPath(); ctx.arc(s.x, s.y, 8, a * 0.7 + 2, a * 0.7 + 5); ctx.stroke();
      }
    }
  }

  function updateFx(dt) { for (let i = world.fx.length - 1; i >= 0; i--) { const f = world.fx[i]; f.t += dt; if (f.t > f.life) world.fx.splice(i, 1); } }

  function drawFx() {
    for (const f of world.fx) {
      const k = clamp(f.t / f.life, 0, 1);
      if (f.type === 'slash') {
        const r = (f.big ? 14 : 9) + k * 8;
        ctx.globalAlpha = 1 - k;
        ctx.strokeStyle = f.col || '#f2f7ff'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(f.x, f.y, r, -0.9, 0.9); ctx.stroke();
        ctx.strokeStyle = 'rgba(168,228,242,0.8)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(f.x, f.y, Math.max(2, r - 3), -0.7, 0.7); ctx.stroke();
        ctx.globalAlpha = 1;
      } else if (f.type === 'ring') {
        const r = 6 + k * 130;
        ctx.globalAlpha = 0.85 * (1 - k);
        ctx.strokeStyle = '#96f0e4'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(f.x, f.y, r, 0, 6.28); ctx.stroke();
        ctx.strokeStyle = '#3fc0b0'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(f.x, f.y, r * 0.8, 0, 6.28); ctx.stroke();
        ctx.globalAlpha = 1;
      } else if (f.type === 'bolt') {
        ctx.globalAlpha = 1 - k * 0.7;
        let px = f.x + rnd(-3, 3), py = 0;
        while (py < f.y - 4) {
          const ny = py + rnd(8, 16), nx = f.x + rnd(-6, 6);
          ctx.strokeStyle = '#ffe27a'; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(nx, ny); ctx.stroke();
          ctx.strokeStyle = '#fffbe0'; ctx.lineWidth = 1;
          ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(nx, ny); ctx.stroke();
          px = nx; py = ny;
        }
        ctx.fillStyle = '#fffbe0'; ctx.fillRect(Math.round(f.x - 3), Math.round(f.y - 3), 6, 6);
        ctx.globalAlpha = 1;
      } else if (f.type === 'beam') {
        const hh = 3 + Math.sin(f.t * 40);
        ctx.globalAlpha = 0.85 * (1 - k);
        ctx.fillStyle = '#f6c945'; ctx.fillRect(Math.round(f.x), Math.round(f.y - hh), W - Math.round(f.x), Math.round(hh * 2));
        ctx.fillStyle = '#fffbe0'; ctx.fillRect(Math.round(f.x), Math.round(f.y - 1), W - Math.round(f.x), 2);
        ctx.globalAlpha = 1;
      } else if (f.type === 'burst') {
        const r = 4 + k * 18;
        ctx.globalAlpha = 1 - k;
        ctx.strokeStyle = '#ffd257'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(f.x, f.y, r, 0, 6.28); ctx.stroke();
        ctx.globalAlpha = 1;
      }
    }
  }

  // tiny health bars over foes that have taken damage
  function drawEnemyHp() {
    const ts = enemyTargets();
    for (const t of ts) {
      const o = t.o;
      if (t.kind === 'boss' || !o.maxhp || o.maxhp <= 1 || o.hp >= o.maxhp) continue;
      const bw = 10, bx = Math.round(t.x - bw / 2), by = Math.round(t.y - t.r - 5);
      ctx.fillStyle = 'rgba(20,12,28,0.8)'; ctx.fillRect(bx - 1, by, bw + 2, 3);
      ctx.fillStyle = o.poisonT > 0 ? '#c7d94a' : '#e0525c'; ctx.fillRect(bx, by + 1, Math.max(1, Math.round(bw * o.hp / o.maxhp)), 1);
    }
  }

  // ---------- pets: cute companions that trail behind you ----------
  function grantPet() {
    const order = ['chick', 'noodle', 'lumen'];
    const owned = run.pets.map(function (p) { return p.kind; });
    const next = order.filter(function (k) { return owned.indexOf(k) < 0; })[0];
    if (!next) { run.score += 100; addFloat(bird.x, bird.y - 32, 'FLOCK BONUS +100', '#ffd257'); return; }
    run.pets.push({ kind: next, x: bird.x - 14, y: bird.y, t: rnd(0, 6.28), cd: 2 });
    AUDIO.play('petJoin');
    addFloat(bird.x, bird.y - 32, PET_NAMES[next] + ' JOINS YOU!', '#ffd257', true);
    guide('pets', ['A PET! IT TRAILS', 'YOU AND HELPS', 'ON EVERY FLIGHT']);
  }

  function updatePets(dt) {
    let tx = bird.x - 13, ty = bird.y + 2;
    const inFlight = STATE === 'fly' && world && world.phase === 'fly';
    for (const p of run.pets) {
      p.t += dt; p.cd = Math.max(0, p.cd - dt);
      const spring = Math.min(1, dt * 5);
      p.x += (tx - p.x) * spring;
      p.y += (ty + Math.sin(p.t * 3) * 3 - p.y) * spring;
      if (p.kind === 'lumen') { // a living lantern: trickle of wing energy
        bird.energy = Math.min(bird.maxEnergy || 100, bird.energy + 4 * dt);
        if (Math.random() < 0.12) parts.push(sparkle(p.x + rnd(-3, 3), p.y + rnd(-3, 3), '#c7ff9a'));
      } else if (p.kind === 'noodle' && inFlight) { // nudges nearby food toward you
        for (const f of world.foods) { const dx = bird.x - f.x, dy = bird.y - f.baseY, d2 = dx * dx + dy * dy; if (d2 < 52 * 52 && d2 > 9) { const d = Math.sqrt(d2); f.x += dx / d * 40 * dt; f.baseY += dy / d * 40 * dt; } }
      } else if (p.kind === 'chick' && inFlight && p.cd <= 0) { // pecks at nearby foes
        const ts = enemyTargets();
        for (const t of ts) {
          const dx = t.x - p.x, dy = t.y - p.y;
          if (dx * dx + dy * dy < 44 * 44) { p.cd = 2.6; world.fx.push({ type: 'slash', x: t.x, y: t.y, t: 0, life: 0.16, col: '#ffe27a' }); damageEnemy(t, 1); addFloat(p.x, p.y - 8, 'PIP!', '#ffe27a'); break; }
        }
      }
      tx = p.x - 11; ty = p.y; // the next pet trails this one
    }
  }

  function drawPets() {
    if (!run || !run.pets) return;
    for (const p of run.pets) {
      let spr;
      if (p.kind === 'chick') spr = Math.floor(time * 10 + p.t) % 2 ? SPR.PET_CHICK1 : SPR.PET_CHICK2;
      else if (p.kind === 'noodle') spr = SPR.PET_NOODLE;
      else spr = SPR.PET_LUMEN;
      ctx.drawImage(spr, Math.round(p.x - spr.width / 2), Math.round(p.y - spr.height / 2));
    }
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

  function tryBoost(st) {
    if (bird.latched || bird.dead || bird.boost > 0.4) return;
    if (bird.energy < BOOST_COST) { AUDIO.play('denied'); return; }
    bird.energy -= BOOST_COST; bird.boost = 0.85;
    AUDIO.play('whoosh'); shakeIt(1, 0.12);
    spawnParts(6, function () { return { type: 'streak', x: bird.x + rnd(-2, 6), y: bird.y + rnd(-6, 6), vx: -rnd(220, 340), vy: 0, g: 0, t: 0, life: 0.5, color: 'rgba(255,255,255,0.6)' }; });
    if (world.falcon && world.falcon.state === 'chase') world.falcon.x -= 42;
    addFloat(bird.x, bird.y - 16, 'BOOST!', '#a8e4f2');
  }
  function startLatch(o, s) {
    if (bird.latched) return;
    s.state = 'latched'; s.headX = bird.x - 5; s.headY = bird.y - 3;
    bird.latched = { o: o, s: s, swipes: 0, t: 0, cd: 0 };
    AUDIO.play('chomp'); shakeIt(2.5, 0.25); freezeT = Math.max(freezeT, 0.1);
    addFloat(bird.x, bird.y - 22, 'SNAKE! SWIPE FREE!', '#c7d94a');
  }
  function updateLatch(dt) {
    const L = bird.latched; if (!L) return;
    L.t += dt; L.cd = Math.max(0, L.cd - dt);
    bird.energy = Math.max(0, bird.energy - 20 * dt);
    bird.vy = Math.min(bird.vy + 260 * dt, 110);
    bird.y = clamp(bird.y + bird.vy * dt * 0.5, 6, SEA_Y - 4);
    bird.rot = Math.sin(time * 40) * 0.12;
    if (Math.random() < 0.18) parts.push(feather(bird.x, bird.y));
    if (swipeQueued) {
      swipeQueued = false;
      if (L.cd <= 0) {
        L.swipes++; L.cd = 0.1; AUDIO.play('flap'); shakeIt(1.6, 0.08);
        spawnParts(2, function () { return feather(bird.x, bird.y); });
        if (L.swipes >= 5) freeLatch(true);
      }
    }
    if (bird.latched && L.swipes < 5 && L.t > 4.0) freeLatch(false);
  }
  function freeLatch(escaped) {
    const L = bird.latched; if (!L) return;
    if (L.s) { L.s.state = 'recoil'; L.s.t = 0; L.s.spent = true; }
    bird.latched = null; bird.x = BIRD_X;
    if (escaped) { bird.invuln = 1.0; bird.vy = -160; AUDIO.play('whoosh'); addFloat(bird.x, bird.y - 16, 'SHOOK IT OFF!', '#96f0e4'); run.score += 20; addDNA(2); spawnParts(10, function () { return scaleP(bird.x, bird.y, '#3e7a2e'); }); }
    else { hurt('snake', { sfx: 'chomp', shake: 3.5, shakeDur: 0.4, freeze: 0.12, flash: 0.14, feathers: 10, knockVy: -120 }); }
  }
  function updateFalcon(dt) {
    const f = world.falcon; if (!f) return;
    const WARN = 1.0 * (f.first ? 1.4 : 1);
    if (f.state === 'warn') {
      f.t += dt; f.x = lerp(-20, 34, clamp(f.t / WARN, 0, 1)); f.y += (bird.y - f.y) * Math.min(1, dt * 3);
      if (f.t >= WARN) { f.state = 'chase'; f.t = 0; AUDIO.play('hawkWhoosh'); }
    } else if (f.state === 'chase') {
      f.t += dt; f.snapCd = Math.max(0, f.snapCd - dt);
      f.x += ((bird.x - 12) - f.x) * Math.min(1, dt * 1.4);
      f.y += (bird.y - f.y) * Math.min(1, dt * 3.2);
      if (!bird.dead && !bird.latched && bird.invuln <= 0 && !f.first && f.snapCd <= 0 && Math.abs(f.x - bird.x) < 12 && Math.abs(f.y - bird.y) < 8) {
        hurt('falcon', { sfx: 'chomp', shake: 4, shakeDur: 0.4, freeze: 0.12, flash: 0.14, feathers: 10, knockVy: 120 });
        f.snapCd = 1.3; spawnParts(3, function () { return scaleP(bird.x, bird.y, '#5b6474'); });
      }
      if (f.t > 6.5 || f.x < -34) f.state = 'gone';
    } else if (f.state === 'gone') {
      f.x -= 150 * dt; f.y -= 24 * dt;
      if (f.x < -40) world.falcon = null;
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
        const wu = WINDUP * (s.first ? 1.4 : 1) * (has('apex') ? 1.5 : 1);
        if (!s.spent && ax > BIRD_X && ax <= BIRD_X + 8 + world.speed * wu && threatFree()) {
          s.state = 'windup'; s.t = 0; s.wu = wu;
          s.lockY = clamp(bird.y, topH + 2, botY - 2);
          AUDIO.play('snakeHiss');
          if (s.first) { run.tut.snake = false; addFloat(ax, topH - 10, 'SNAKE!', '#c7d94a'); }
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
        if (!bird.dead && !bird.latched && bird.invuln <= 0 && s.t > 0.03 && s.t < 0.13 && !s.first) {
          if (Math.abs(s.headX - bird.x) < 9 && Math.abs(s.headY - bird.y) < 8) {
            if (bird.shieldUp) hurt('snake', { sfx: 'chomp', shake: 4, feathers: 8 });
            else startLatch(o, s);
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
      } else if (s.state === 'latched') {
        s.headX = bird.x - 5; s.headY = bird.y - 3;
        if (bird.latched && ax < -30) freeLatch(false);
      }
    }
  }

  function updateSnappers(dt) {
    if (world.snapperTimer > 0 && world.phase === 'fly') {
      world.snapperTimer -= dt;
      if (world.snapperTimer <= 0) {
        world.snappers.push({ worldX: world.dist + W + 20, state: 'lurk', t: 0, bob: rnd(0, 6.28), first: run.tut.snapper, hp: 4, maxhp: 4 });
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
          if (s.first) { run.tut.snapper = false; addFloat(s.sx, SEA_Y - 22, 'PITCHER!', '#96d454'); }
        }
      } else if (s.state === 'telegraph') {
        s.t += dt;
        if (Math.random() < 0.4) parts.push(bubble(s.sx + rnd(-4, 4), SEA_Y - 2));
        if (s.t >= TELE * (s.first ? 1.4 : 1) * (has('apex') ? 1.5 : 1)) { s.state = 'lunge'; s.t = 0; AUDIO.play('chomp'); }
      } else if (s.state === 'lunge') {
        s.t += dt;
        const k = easeOutCubic(s.t / LUNGE);
        s.mawY = lerp(SEA_Y, APEX, k);
        if (!bird.dead && bird.invuln <= 0 && s.t > 0.04 && s.t < 0.16 && !s.first) {
          if (Math.abs(s.sx - bird.x) < 11 && (bird.y + 4) > APEX) {
            hurt('snapper', { sfx: 'chomp', shake: 4, shakeDur: 0.40, freeze: 0.12, flash: 0.14, feathers: 9, knockVy: -150 });
            spawnParts(10, function () { return leaf(bird.x, APEX, pick(['#3d7f2a', '#5cad3c', '#96d454'])); });
            s.hit = true;
          }
        }
        if (s.t >= LUNGE) { s.state = 'retract'; s.t = 0; if (!s.hit) AUDIO.play('snapperMiss'); spawnParts(8, function () { return dust(s.sx, SEA_Y, '#5cad3c'); }); }
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
        if (threatFree()) { world.hawk = { state: 'warn', t: 0, lockY: bird.y, first: run.tut.hawk, hp: 3, maxhp: 3 }; AUDIO.play('hawkScreech'); if (world.hawk.first) { run.tut.hawk = false; addFloat(BIRD_X, bird.y - 22, 'HAWK!', '#7a5a3a'); } }
        else world.hawkTimer = 0.5;
      }
    }
    const h = world.hawk;
    if (!h) return;
    const WARN = 1.0 * (h.first ? 1.4 : 1) * (has('apex') ? 1.5 : 1), SWOOP = 0.5;
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

  function updateDurians(dt) {
    const WOB = 0.7;
    for (const o of world.obstacles) {
      const d = o.durian;
      if (!d || d.state === 'spent') continue;
      const sx = d.worldX - world.dist;
      if (d.state === 'hang') {
        if (sx < BIRD_X + 46 && sx > BIRD_X - 6) {
          d.state = 'wobble'; d.t = 0; d.wob = WOB * (d.first ? 1.5 : 1); AUDIO.play('rustle');
          if (d.first) { run.tut.durian = false; addFloat(sx, d.y - 10, 'DURIAN!', '#c7e88a'); }
        }
      } else if (d.state === 'wobble') {
        d.t += dt;
        if (d.t >= d.wob) { d.state = 'fall'; d.t = 0; AUDIO.play('whoosh'); }
      } else if (d.state === 'fall') {
        d.vy += 520 * dt; d.y += d.vy * dt;
        if (!bird.dead && bird.invuln <= 0 && !d.first && Math.abs(sx - bird.x) < 7 && Math.abs(d.y - bird.y) < 7) {
          if (has('ironbeak')) { d.state = 'spent'; AUDIO.play('shield'); addFloat(bird.x, bird.y - 14, 'CLANG!', '#c9d2e0'); spawnParts(8, function () { return sparkle(bird.x + rnd(-4, 4), bird.y, '#c9d2e0'); }); }
          else {
            hurt('durian', { sfx: 'chomp', shake: 3.5, shakeDur: 0.35, freeze: 0.10, flash: 0.12, feathers: 8, knockVy: 70 });
            spawnParts(6, function () { return leaf(bird.x, bird.y, '#6ea233'); });
            d.state = 'spent';
          }
        }
        if (d.y > SEA_Y - 2) { d.state = 'spent'; AUDIO.play('land'); spawnParts(6, function () { return dust(sx, SEA_Y, '#6ea233'); }); }
      }
    }
  }

  function updateChase(dt) {
    const c = world.chaseBug;
    if (!c) return;
    c.t += dt; c.phase += dt * 6;
    if (c.t < c.life) {
      const flee = lerp(46, 8, clamp(c.t / c.life, 0, 1)); // the bug tires; you close in
      c.x += ((bird.x + flee) - c.x) * Math.min(1, dt * 3.5);
      c.y = clamp(bird.y + Math.sin(c.phase) * 12, 24, SEA_Y - 18);
      if (Math.random() < 0.5) parts.push(sparkle(c.x + rnd(-3, 3), c.y + rnd(-3, 3), '#fff3a8'));
      if (!bird.dead) {
        const bp = beakPos();
        if (Math.abs(c.x - bp.x) < 8 && Math.abs(c.y - bp.y) < 8) {
          run.score += 60; run.evo += 30; run.scorePop = 0.25; run.bugsChased++; addDNA(3);
          bird.energy = bird.maxEnergy || 100;
          AUDIO.play('heart'); AUDIO.play('confirm');
          addFloat(bird.x, bird.y - 18, 'CAUGHT! +60', '#fff3a8', true);
          slowmo(0.14); freezeT = Math.max(freezeT, 0.06);
          spawnParts(16, function () { return sparkle(c.x + rnd(-8, 8), c.y + rnd(-8, 8), pick(['#fff3a8', '#ffe27a', '#96f0e4'])); });
          world.chaseBug = null;
          if (run.evo >= run.evoNeed && !run.evoReadyPinged) { run.evoReadyPinged = true; AUDIO.play('evoReady'); addFloat(bird.x, bird.y - 28, 'EVOLUTION READY!', '#3fc0b0'); }
          return;
        }
      }
    } else { // escapes up and away
      c.x += 40 * dt; c.y -= 60 * dt;
      if (c.t >= c.life + 1) world.chaseBug = null;
    }
  }

  // ---------- Charles Darwin interactive tutorial ----------
  // Leg-1 tutorial: purely action-based — each beat waits for you to DO the thing.
  const DARWIN_STEPS = [
    { lines: ["I'M DARWIN!", 'TAP OR SPACE', 'TO FLAP!'], cond: function (d) { return d.flapped; } },
    { lines: ['GOOD! NOW FLY', 'INTO FOOD TO', 'CATCH IT!'], cond: function (d) { return d.ate; } },
    { lines: ['NOW WAIT...', 'LET IT DIGEST', 'FULLY'], cond: function (d) { return d.digested; } },
    { lines: ['SKIM THE', 'TREETOPS - SOFT', 'LEAVES ARE SAFE'], cond: function (d) { return d.grazed; } },
    { lines: ['PERFECT! REACH', 'THE NEST TO', 'HATCH & EVOLVE'], cond: function (d) { return d.t > 3.2; } },
  ];
  function updateDarwin(dt) {
    const d = run.darwin; if (!d || d.done) return;
    d.t += dt;
    const step = DARWIN_STEPS[d.step];
    if (step && d.t > 0.6 && step.cond(d)) {
      d.step++; d.t = 0; AUDIO.play('chirp');
      if (d.step >= DARWIN_STEPS.length) { d.done = true; run.darwin = null; }
    }
  }
  function drawDarwin() {
    const d = run.darwin; if (!d || d.done) return;
    const step = DARWIN_STEPS[d.step]; if (!step) return;
    const px = 4, py = H - 44;
    ctx.drawImage(SPR.DARWIN, px, py);
    drawSpeech(px + 22, py - 4, step.lines, 96);
  }

  // Guide: Darwin pops back to introduce each new system, once each, non-blocking.
  function guide(id, lines, life) {
    if (!run || run.seenTips[id]) return;
    run.seenTips[id] = true;
    run.tip = { lines: lines, t: 0, life: life || 5.5 };
    AUDIO.play('chirp');
  }
  function updateTip(dt) {
    if (run && run.tip) { run.tip.t += dt; if (run.tip.t > run.tip.life) run.tip = null; }
  }
  function drawTip() {
    if (!run || !run.tip || run.darwin) return; // never stack on the leg-1 tutorial
    const a = clamp(Math.min(run.tip.t * 3, run.tip.life - run.tip.t), 0, 1);
    ctx.globalAlpha = a;
    const px = 4, py = H - 44;
    ctx.drawImage(SPR.DARWIN, px, py);
    drawSpeech(px + 22, py - 4, run.tip.lines, 100);
    ctx.globalAlpha = 1;
  }

  // ---------- mini-game events ----------
  function eventBusy() {
    return !!(world.chaseBug || world.thermal || world.rush || world.wasps || world.slalom || world.trail || world.storm || world.flutter);
  }
  function startEvent(ev) {
    if (ev === 'chase') { world.chaseBug = { x: bird.x + 72, y: bird.y, t: 0, life: 6, phase: 0 }; if (run.tut.chase) { run.tut.chase = false; addFloat(bird.x, bird.y - 24, 'CHASE!', '#fff3a8'); } AUDIO.play('evoReady'); }
    else if (ev === 'thermal') startThermal();
    else if (ev === 'wasps') startWasps();
    else if (ev === 'rush') startRush();
    else if (ev === 'slalom') startSlalom();
    else if (ev === 'trail') startTrail();
    else if (ev === 'storm') startStorm();
    else if (ev === 'flutter') startFlutter();
  }

  function startThermal() {
    world.thermal = { x: W + 24, y: rnd(48, SEA_Y - 48), t: 0, passed: false };
    world.eventBanner = { text: 'THERMAL RING', t: 0 };
    AUDIO.play('evoReady');
  }
  function updateThermal(dt) {
    const th = world.thermal; if (!th) return;
    th.t += dt; th.x -= world.speed * dt;
    if (Math.random() < 0.4) parts.push({ type: 'puff', x: th.x + rnd(-9, 9), y: th.y + 12, vx: rnd(-6, 6), vy: -rnd(20, 44), g: -6, t: 0, life: 0.6, color: 'rgba(255,210,140,0.6)' });
    if (!th.passed && !bird.dead && !bird.latched && Math.abs(th.x - bird.x) < 7 && Math.abs(th.y - bird.y) < 11) {
      th.passed = true; th.fade = 0.5;
      bird.boost = Math.max(bird.boost, 0.7); bird.energy = bird.maxEnergy || 100; bird.vy = -110;
      run.score += 40; run.evo += 20; run.scorePop = 0.25; addDNA(2);
      AUDIO.play('heart'); AUDIO.play('confirm'); slowmo(0.12);
      addFloat(bird.x, bird.y - 18, 'PERFECT! +40', '#fff3a8', true);
      spawnParts(16, function () { return sparkle(th.x + rnd(-10, 10), th.y + rnd(-10, 10), pick(['#fff3a8', '#ffd257', '#a8e4f2'])); });
    }
    if (th.x < -22) world.thermal = null;
  }
  function drawThermal() {
    const th = world.thermal; if (!th) return;
    const pulse = 11 + Math.sin(time * 6) * 1.5;
    ctx.strokeStyle = th.passed ? 'rgba(150,240,180,0.9)' : 'rgba(255,210,120,' + (0.55 + 0.25 * Math.sin(time * 8)).toFixed(2) + ')';
    ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(th.x, th.y, 7, pulse, 0, 0, 6.28); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.ellipse(th.x, th.y, 7, pulse, 0, 0, 6.28); ctx.stroke();
  }
  function startRush() {
    world.rush = { t: 0, dur: 4.5, cd: 0, startFood: run.foodEaten };
    world.eventBanner = { text: 'FRUIT RUSH', t: 0 };
    AUDIO.play('evoReady');
  }
  function updateRush(dt) {
    const r = world.rush; if (!r) return;
    r.t += dt; r.cd -= dt;
    if (r.cd <= 0 && r.t < r.dur) {
      r.cd = 0.34;
      const kind = pick(['berry', 'nectar', 'mango', 'berry', 'gold']), def = FOODS[kind];
      world.foods.push({ kind: kind, def: def, x: W + 12, baseY: rnd(34, SEA_Y - 26), y: 0, phase: rnd(0, 6.28), wander: 0, hopT: 0, vy: 0 });
    }
    if (r.t >= r.dur) {
      const eaten = run.foodEaten - r.startFood;
      if (eaten >= 3) { const bonus = eaten * 8; run.score += bonus; addDNA(eaten); addFloat(bird.x, bird.y - 20, 'FEAST! +' + bonus, '#f6c945', true); AUDIO.play('confirm'); }
      world.rush = null;
    }
  }

  // ---------- mini-game: RING SLALOM — chain of rings for escalating bonus ----------
  function startSlalom() {
    const rings = [], n = 4; let y = rnd(50, SEA_Y - 50);
    for (let i = 0; i < n; i++) { y = clamp(y + rnd(-30, 30), 40, SEA_Y - 40); rings.push({ dx: 40 + i * 40, y: y, hit: false }); }
    world.slalom = { t: 0, x0: W + 30, rings: rings, combo: 0 };
    world.eventBanner = { text: 'RING SLALOM!', t: 0 }; AUDIO.play('evoReady');
  }
  function updateSlalom(dt) {
    const s = world.slalom; if (!s) return;
    s.t += dt; s.x0 -= world.speed * dt;
    let remaining = 0;
    for (const r of s.rings) {
      r.x = s.x0 + r.dx;
      if (Math.random() < 0.2) parts.push({ type: 'puff', x: r.x + rnd(-8, 8), y: r.y + 10, vx: rnd(-5, 5), vy: -rnd(16, 36), g: -5, t: 0, life: 0.5, color: 'rgba(168,228,242,0.5)' });
      if (!r.hit) {
        remaining++;
        if (!bird.dead && !bird.latched && Math.abs(r.x - bird.x) < 7 && Math.abs(r.y - bird.y) < 11) {
          r.hit = true; s.combo++;
          const pts = 20 * s.combo; run.score += pts; run.evo += 10; addDNA(1);
          bird.energy = bird.maxEnergy || 100; bird.boost = Math.max(bird.boost, 0.4);
          AUDIO.play('point'); AUDIO.play('pop');
          addFloat(r.x, r.y - 12, 'x' + s.combo + ' +' + pts, '#a8e4f2');
          spawnParts(8, function () { return sparkle(r.x + rnd(-8, 8), r.y + rnd(-10, 10), '#a8e4f2'); });
        }
      }
    }
    if (s.x0 + s.rings[s.rings.length - 1].dx < -20) {
      if (s.combo >= s.rings.length) { run.score += 60; addDNA(3); addFloat(bird.x, bird.y - 20, 'CLEAN SLALOM! +60', '#96f0e4', true); AUDIO.play('confirm'); slowmo(0.12); }
      world.slalom = null;
    }
  }
  function drawSlalom() {
    const s = world.slalom; if (!s) return;
    const pulse = 10 + Math.sin(time * 6) * 1.5;
    for (let i = 0; i < s.rings.length; i++) {
      const r = s.rings[i]; if (r.x < -14 || r.x > W + 14) continue;
      const next = !r.hit && (i === 0 || s.rings[i - 1].hit);
      ctx.strokeStyle = r.hit ? 'rgba(150,240,180,0.85)' : (next ? 'rgba(168,228,242,' + (0.6 + 0.3 * Math.sin(time * 8)).toFixed(2) + ')' : 'rgba(150,170,200,0.5)');
      ctx.lineWidth = next ? 2 : 1; ctx.beginPath(); ctx.ellipse(r.x, r.y, 6, pulse, 0, 0, 6.28); ctx.stroke();
    }
  }

  // ---------- mini-game: FIREFLY TRAIL — a curving chain of glowing dots to collect ----------
  function startTrail() {
    const dots = [], n = 9; let y = clamp(bird.y, 40, SEA_Y - 40);
    for (let i = 0; i < n; i++) { y = clamp(y + Math.sin(i * 0.9) * 16, 30, SEA_Y - 30); dots.push({ dx: 30 + i * 20, y: y, got: false, ph: rnd(0, 6.28) }); }
    world.trail = { t: 0, x0: W + 20, dots: dots, got: 0 };
    world.eventBanner = { text: 'FIREFLY TRAIL', t: 0 }; AUDIO.play('evoReady');
  }
  function updateTrail(dt) {
    const tr = world.trail; if (!tr) return;
    tr.t += dt; tr.x0 -= world.speed * dt;
    for (const d of tr.dots) {
      d.x = tr.x0 + d.dx; d.ph += dt * 6;
      if (!d.got) {
        if (Math.random() < 0.1) parts.push(sparkle(d.x + rnd(-2, 2), d.y + rnd(-2, 2), '#c7ff9a'));
        const bp = beakPos();
        if (!bird.dead && !bird.latched && Math.abs(d.x - bp.x) < 7 && Math.abs(d.y - bp.y) < 7) {
          d.got = true; tr.got++;
          run.score += 12; run.evo += 6; addDNA(1); bird.energy = Math.min(bird.maxEnergy || 100, bird.energy + 12);
          AUDIO.play('catch'); addFloat(d.x, d.y - 8, '+12', '#c7ff9a');
          spawnParts(5, function () { return sparkle(d.x + rnd(-4, 4), d.y + rnd(-4, 4), '#c7ff9a'); });
        }
      }
    }
    if (tr.x0 + tr.dots[tr.dots.length - 1].dx < -16) {
      if (tr.got >= tr.dots.length) { run.score += 80; addDNA(4); addFloat(bird.x, bird.y - 20, 'FULL TRAIL! +80', '#c7ff9a', true); AUDIO.play('confirm'); slowmo(0.12); }
      world.trail = null;
    }
  }
  function drawTrail() {
    const tr = world.trail; if (!tr) return;
    for (const d of tr.dots) {
      if (d.got || d.x < -8 || d.x > W + 8) continue;
      const yy = d.y + Math.sin(d.ph) * 2;
      ctx.drawImage(SPR.FIREFLY, Math.round(d.x - 2), Math.round(yy - 2));
    }
  }

  // ---------- mini-game: NUT STORM — dodge a rain of falling acorns for a survival bonus ----------
  function startStorm() {
    world.storm = { t: 0, dur: 5.0, cd: 0, drops: [], hits: 0 };
    world.eventBanner = { text: 'NUT STORM!', t: 0 }; AUDIO.play('snakeHiss');
  }
  function updateStorm(dt) {
    const s = world.storm; if (!s) return;
    s.t += dt; s.cd -= dt;
    if (s.cd <= 0 && s.t < s.dur) { s.cd = rnd(0.22, 0.4) / diff().speed; s.drops.push({ x: rnd(W * 0.2, W + 10), y: -6, vy: rnd(120, 190), rot: 0 }); }
    for (let i = s.drops.length - 1; i >= 0; i--) {
      const d = s.drops[i]; d.vy += 260 * dt; d.y += d.vy * dt; d.x -= world.speed * 0.3 * dt; d.rot += dt * 8;
      if (!bird.dead && !bird.latched && bird.invuln <= 0 && Math.abs(d.x - bird.x) < 6 && Math.abs(d.y - bird.y) < 6) { hurt('durian', { sfx: 'hit', shake: 2, feathers: 4, knockVy: 40 }); s.hits++; s.drops.splice(i, 1); continue; }
      if (d.y > SEA_Y - 2) { spawnParts(3, function () { return dust(d.x, SEA_Y, '#a76f3e'); }); s.drops.splice(i, 1); }
    }
    if (s.t >= s.dur && !s.drops.length) {
      if (s.hits === 0) { run.score += 90; addDNA(5); addFloat(bird.x, bird.y - 20, 'UNSCATHED! +90', '#f6c945', true); AUDIO.play('confirm'); slowmo(0.14); }
      else if (s.hits <= 2) { run.score += 30; addDNA(2); addFloat(bird.x, bird.y - 20, 'WEATHERED IT +30', '#f6c945'); AUDIO.play('confirm'); }
      world.storm = null;
    }
  }
  function drawStorm() {
    const s = world.storm; if (!s) return;
    if (s.t < 0.9 && Math.floor(time * 8) % 2) drawTextShadow(ctx, 'LOOK OUT ABOVE!', W / 2, 40, '#f6c945', 1, 'center');
    for (const d of s.drops) ctx.drawImage(SPR.NUT, Math.round(d.x - SPR.NUT.width / 2), Math.round(d.y - SPR.NUT.height / 2));
  }

  // ---------- mini-game: BUTTERFLY SWARM — a friendly cloud to glide through for energy ----------
  function startFlutter() {
    const flies = [];
    for (let i = 0; i < 10; i++) flies.push({ x: W + 10 + rnd(0, 60), y: rnd(30, SEA_Y - 30), ph: rnd(0, 6.28), got: false });
    world.flutter = { t: 0, flies: flies, got: 0 };
    world.eventBanner = { text: 'BUTTERFLIES', t: 0 }; AUDIO.play('chirp');
  }
  function updateFlutter(dt) {
    const fl = world.flutter; if (!fl) return;
    fl.t += dt;
    let alive = 0;
    for (const b of fl.flies) {
      b.ph += dt * 4; b.x -= (world.speed * 0.75) * dt; b.y += Math.sin(b.ph) * 14 * dt;
      if (b.x > -8) alive++;
      if (!b.got && !bird.dead && !bird.latched && Math.abs(b.x - bird.x) < 8 && Math.abs(b.y - bird.y) < 8) {
        b.got = true; run.score += 8; addDNA(1); bird.energy = Math.min(bird.maxEnergy || 100, bird.energy + 10);
        AUDIO.play('pop'); addFloat(b.x, b.y - 8, '+8', '#ffd257');
        spawnParts(4, function () { return sparkle(b.x + rnd(-4, 4), b.y + rnd(-4, 4), '#ffd257'); });
      }
    }
    if (!alive) {
      if (fl.got >= 8) { run.score += 50; addDNA(3); addFloat(bird.x, bird.y - 20, 'DANCED THROUGH! +50', '#ffd257', true); AUDIO.play('confirm'); }
      world.flutter = null;
    }
    fl.got = fl.flies.filter(function (b) { return b.got; }).length;
  }
  function drawFlutter() {
    const fl = world.flutter; if (!fl) return;
    for (const b of fl.flies) {
      if (b.got || b.x < -8 || b.x > W + 8) continue;
      const spr = Math.floor(time * 12 + b.ph) % 2 ? SPR.BFLY1 : SPR.BFLY2;
      ctx.drawImage(spr, Math.round(b.x - spr.width / 2), Math.round(b.y - spr.height / 2));
    }
  }

  // ---------- new enemies: wasp swarm + spider ----------
  function startWasps() {
    world.wasps = []; world.waspT = 0;
    for (let i = 0; i < 6; i++) world.wasps.push({ x: W + 10 + i * 5, y: rnd(30, SEA_Y - 30), ph: rnd(0, 6.28), hp: 1, maxhp: 1 });
    world.eventBanner = { text: 'WASP SWARM!', t: 0 }; AUDIO.play('snakeHiss');
  }
  function updateWasps(dt) {
    if (!world.wasps || !world.wasps.length) return;
    world.waspT += dt;
    const flee = world.waspT > 4.4;
    for (let i = world.wasps.length - 1; i >= 0; i--) {
      const w = world.wasps[i]; w.ph += dt * 8;
      if (flee) { w.x -= 130 * dt; w.y += Math.sin(w.ph) * 20 * dt; if (w.x < -12) world.wasps.splice(i, 1); continue; }
      const dx = bird.x - w.x, dy = bird.y - w.y, d = Math.max(1, Math.hypot(dx, dy));
      w.x += (dx / d * 34) * dt + Math.cos(w.ph) * 10 * dt - world.speed * 0.12 * dt;
      w.y += (dy / d * 34) * dt + Math.sin(w.ph * 1.3) * 12 * dt;
      w.y = clamp(w.y, 20, SEA_Y - 6);
      if (!bird.dead && !bird.latched && bird.invuln <= 0 && Math.abs(w.x - bird.x) < 6 && Math.abs(w.y - bird.y) < 6) hurt('wasp', { sfx: 'hit', shake: 2, feathers: 4, knockVy: -80 });
    }
    if (!world.wasps.length) world.wasps = null;
  }
  function drawWasps() {
    if (!world.wasps) return;
    for (const w of world.wasps) { const spr = Math.floor(time * 20 + w.ph) % 2 ? SPR.WASP1 : SPR.WASP2; ctx.drawImage(spr, Math.round(w.x - 3), Math.round(w.y - 3)); }
  }

  function updateSpiders(dt) {
    for (const o of world.obstacles) {
      const sp = o.spider; if (!sp || sp.state === 'spent') continue;
      const sx = o.x - world.dist + o.w * 0.5, topH = o.gapY - o.gapH / 2;
      sp.sx = sx; sp.topH = topH;
      if (sp.state === 'hidden') { if (sx < BIRD_X + 58 && sx > BIRD_X - 6) { sp.state = 'drop'; sp.t = 0; sp.targetY = o.gapY + rnd(-6, 6); sp.y = topH; AUDIO.play('rustle'); } }
      else if (sp.state === 'drop') { sp.t += dt; sp.y = lerp(topH, sp.targetY, Math.min(1, sp.t / 0.4)); if (sp.t >= 0.4) { sp.state = 'hang'; sp.t = 0; } }
      else if (sp.state === 'hang') { sp.t += dt; sp.y = sp.targetY + Math.sin(time * 5) * 1.5; if (sp.t >= 1.3) { sp.state = 'climb'; sp.t = 0; } }
      else if (sp.state === 'climb') { sp.t += dt; sp.y = lerp(sp.targetY, topH, Math.min(1, sp.t / 0.5)); if (sp.t >= 0.5) sp.state = 'spent'; }
      if ((sp.state === 'drop' || sp.state === 'hang') && !bird.dead && !bird.latched && bird.invuln <= 0 && Math.abs(sx - bird.x) < 6 && Math.abs(sp.y - bird.y) < 6) hurt('spider', { sfx: 'hit', shake: 2.5, feathers: 5, knockVy: -90 });
    }
  }
  function drawSpiders() {
    for (const o of world.obstacles) {
      const sp = o.spider; if (!sp || sp.state === 'spent' || sp.state === 'hidden') continue;
      const sx = sp.sx; if (sx < -8 || sx > W + 8) continue;
      ctx.strokeStyle = 'rgba(230,230,240,0.6)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(sx, sp.topH); ctx.lineTo(sx, sp.y - 2); ctx.stroke();
      ctx.drawImage(SPR.SPIDER, Math.round(sx - 4), Math.round(sp.y - 3));
    }
  }

  // ---------- new enemies: bat / dragonfly / vulture (roaming flyers) ----------
  function updateBat(dt) {
    if (world.batTimer > 0 && world.phase === 'fly' && !world.bat) {
      world.batTimer -= dt;
      if (world.batTimer <= 0) {
        if (threatFree()) { world.bat = { state: 'warn', t: 0, x: W + 8, y: rnd(16, 40), first: run.tut.bat, hp: 2, maxhp: 2 }; AUDIO.play('snakeHiss'); if (world.bat.first) { run.tut.bat = false; addFloat(W - 30, 32, 'BAT!', '#c8b9e0'); } }
        else world.batTimer = 0.5;
      }
    }
    const b = world.bat; if (!b) return;
    const WARN = 0.5 * (b.first ? 1.5 : 1) * diff().tele;
    if (b.state === 'warn') {
      b.t += dt; b.x = lerp(W + 8, W - 22, clamp(b.t / WARN, 0, 1)); b.y += Math.sin(time * 12) * 20 * dt;
      if (b.t >= WARN) { b.state = 'dive'; b.t = 0; AUDIO.play('hawkWhoosh'); }
    } else if (b.state === 'dive') {
      b.t += dt;
      b.x -= (86 + world.speed * 0.4) * dt;
      b.y += (bird.y - b.y) * Math.min(1, dt * 1.1) + Math.sin(b.t * 11) * 48 * dt; // loose homing + erratic wobble
      b.y = clamp(b.y, 12, SEA_Y - 8);
      if (!bird.dead && !bird.latched && bird.invuln <= 0 && !b.first && Math.abs(b.x - bird.x) < 6 && Math.abs(b.y - bird.y) < 6) hurt('bat', { sfx: 'hit', shake: 2.5, feathers: 5, knockVy: -90 });
      if (b.x < -12) { world.bat = null; world.batTimer = rnd(5, 9) * diff().timer; }
    } else { world.bat = null; world.batTimer = rnd(5, 9) * diff().timer; }
  }
  function drawBat() {
    const b = world.bat; if (!b) return;
    if (b.state === 'warn' && Math.floor(time * 10) % 2) drawTextShadow(ctx, '!', Math.round(b.x), Math.round(b.y - 9), '#e0525c', 1, 'center');
    const spr = Math.floor(time * 18 + b.x) % 2 ? SPR.BAT1 : SPR.BAT2;
    ctx.drawImage(spr, Math.round(b.x - spr.width / 2), Math.round(b.y - spr.height / 2));
  }

  function updateDragonfly(dt) {
    if (world.dflyTimer > 0 && world.phase === 'fly' && !world.dfly) {
      world.dflyTimer -= dt;
      if (world.dflyTimer <= 0) {
        if (threatFree()) { world.dfly = { state: 'hover', t: 0, x: W + 6, y: clamp(bird.y, 24, SEA_Y - 20), first: run.tut.dfly, hp: 2, maxhp: 2 }; AUDIO.play('rustle'); if (world.dfly.first) { run.tut.dfly = false; addFloat(W - 26, clamp(bird.y, 24, SEA_Y - 20) - 10, 'DRAGONFLY!', '#7fe0d0'); } }
        else world.dflyTimer = 0.5;
      }
    }
    const f = world.dfly; if (!f) return;
    const HOVER = 0.85 * (f.first ? 1.5 : 1) * diff().tele;
    if (f.state === 'hover') {
      f.t += dt; f.x += ((W - 22) - f.x) * Math.min(1, dt * 5);
      if (f.t < 0.35) f.y += (bird.y - f.y) * Math.min(1, dt * 5); // lock onto the bird's lane early
      if (Math.random() < 0.3) parts.push(sparkle(f.x + rnd(-4, 4), f.y + rnd(-3, 3), '#7fe0d0'));
      if (f.t >= HOVER) { f.state = 'dash'; f.t = 0; AUDIO.play('hawkWhoosh'); }
    } else if (f.state === 'dash') {
      f.t += dt; f.x -= 320 * dt;
      if (!bird.dead && !bird.latched && bird.invuln <= 0 && !f.first && Math.abs(f.x - bird.x) < 7 && Math.abs(f.y - bird.y) < 6) hurt('dfly', { sfx: 'hit', shake: 2.5, feathers: 4, knockVy: -70 });
      if (f.x < -12) { world.dfly = null; world.dflyTimer = rnd(4, 8) * diff().timer; }
    } else { world.dfly = null; world.dflyTimer = rnd(4, 8) * diff().timer; }
  }
  function drawDragonfly() {
    const f = world.dfly; if (!f) return;
    if (f.state === 'hover' && Math.floor(time * 8) % 2) { ctx.fillStyle = 'rgba(127,224,208,0.35)'; ctx.fillRect(0, Math.round(f.y) - 1, Math.round(f.x), 3); }
    const spr = Math.floor(time * 24) % 2 ? SPR.DFLY1 : SPR.DFLY2;
    ctx.drawImage(spr, Math.round(f.x - spr.width / 2), Math.round(f.y - spr.height / 2));
  }

  function updateVulture(dt) {
    if (world.vultureTimer > 0 && world.phase === 'fly' && !world.vulture) {
      world.vultureTimer -= dt;
      if (world.vultureTimer <= 0) {
        if (threatFree()) { world.vulture = { state: 'circle', t: 0, cx: W - 44, cy: 24, x: W - 44, y: 24, ang: 0, lockY: bird.y, first: run.tut.vulture, hp: 3, maxhp: 3 }; AUDIO.play('hawkScreech'); if (world.vulture.first) { run.tut.vulture = false; addFloat(W - 40, 20, 'VULTURE!', '#c97a6a'); } }
        else world.vultureTimer = 0.5;
      }
    }
    const v = world.vulture; if (!v) return;
    const CIRC = 1.3 * (v.first ? 1.4 : 1) * diff().tele;
    if (v.state === 'circle') {
      v.t += dt; v.ang += dt * 5;
      v.x = v.cx + Math.cos(v.ang) * 16; v.y = v.cy + Math.sin(v.ang) * 7;
      if (v.t < 0.45) v.lockY = bird.y;
      if (v.t >= CIRC) { v.state = 'dive'; v.t = 0; AUDIO.play('hawkWhoosh'); }
    } else if (v.state === 'dive') {
      v.t += dt;
      const k = Math.min(1, v.t / 0.7);
      v.x = lerp(v.cx, bird.x - 6, k); v.y = lerp(v.cy, v.lockY, Math.sin(k * Math.PI * 0.5));
      if (!bird.dead && !bird.latched && bird.invuln <= 0 && !v.first && Math.abs(v.x - bird.x) < 11 && Math.abs(v.y - bird.y) < 10) hurt('vulture', { sfx: 'chomp', shake: 4, shakeDur: 0.4, freeze: 0.12, flash: 0.14, feathers: 10, knockVy: 120 });
      if (v.t > 0.85) { v.state = 'rise'; v.t = 0; }
    } else if (v.state === 'rise') {
      v.t += dt; v.x += 60 * dt; v.y -= 90 * dt;
      if (v.y < -16) { world.vulture = null; world.vultureTimer = rnd(6, 10) * diff().timer; }
    } else { world.vulture = null; world.vultureTimer = rnd(6, 10) * diff().timer; }
  }
  function drawVulture() {
    const v = world.vulture; if (!v) return;
    if (v.state === 'circle' && Math.floor(time * 8) % 2) { // target reticle at the intercept lane
      ctx.strokeStyle = 'rgba(201,122,106,0.8)'; ctx.lineWidth = 1;
      ctx.strokeRect(Math.round(bird.x - 6), Math.round(v.lockY - 6), 12, 12);
    }
    const spr = Math.floor(time * 10) % 2 ? SPR.VULT_MID : SPR.VULT_UP;
    ctx.drawImage(spr, Math.round(v.x - spr.width / 2), Math.round(v.y - spr.height / 2));
  }

  // ---------- new enemies: floor leapers (bullfrog / piranha) + jellyfish drifter ----------
  function spawnLeaper() {
    const hz = world.biome.hazards, kinds = [];
    if (hz.indexOf('bfrog') >= 0) kinds.push('bfrog');
    if (hz.indexOf('piranha') >= 0) kinds.push('piranha');
    if (hz.indexOf('jelly') >= 0) kinds.push('jelly');
    if (!kinds.length) return;
    const kind = pick(kinds), first = run.tut[kind];
    if (kind === 'jelly') { world.leapers.push({ kind: 'jelly', worldX: world.dist + W + 12, y: SEA_Y - 8, state: 'rise', t: 0, bob: rnd(0, 6.28), first: first, hp: 2, maxhp: 2 }); return; }
    if (kind === 'piranha') { for (let i = 0; i < 3; i++) world.leapers.push({ kind: 'piranha', worldX: world.dist + W + 20 + i * 16, state: 'lurk', t: 0, bob: rnd(0, 6.28), first: first && i === 0, hp: 1, maxhp: 1 }); return; }
    world.leapers.push({ kind: 'bfrog', worldX: world.dist + W + 20, state: 'lurk', t: 0, bob: rnd(0, 6.28), first: first, hp: 2, maxhp: 2 });
  }
  function updateJelly(l, dt) {
    l.t += dt;
    if (l.state === 'rise') { l.y -= (11 + Math.sin(l.t * 2) * 4) * dt; if (l.y < 42) l.state = 'drift'; }
    else { l.y -= 7 * dt; if (l.y < 6) { const idx = world.leapers.indexOf(l); if (idx >= 0) world.leapers.splice(idx, 1); return; } }
    l.y += Math.sin(l.t * 3) * 8 * dt;
    if (l.first && l.sx < W - 12) { run.tut.jelly = false; l.first = false; addFloat(l.sx, l.y - 12, 'JELLYFISH!', '#a8e4f2'); }
    if (Math.random() < 0.04) parts.push(bubble(l.sx + rnd(-4, 4), l.y + 4));
    if (!bird.dead && !bird.latched && bird.invuln <= 0 && Math.abs(l.sx - bird.x) < 6 && Math.abs(l.y - bird.y) < 7) hurt('jelly', { sfx: 'hit', shake: 2, feathers: 4, knockVy: -70 });
  }
  function updateLeapers(dt) {
    if (world.leaperTimer > 0 && world.phase === 'fly') {
      world.leaperTimer -= dt;
      if (world.leaperTimer <= 0) { spawnLeaper(); world.leaperTimer = rnd(3.5, 6) * diff().timer; }
    }
    for (let i = world.leapers.length - 1; i >= 0; i--) {
      const l = world.leapers[i];
      l.sx = l.worldX - world.dist; l.bob += dt * 3;
      if (l.sx < -20) { world.leapers.splice(i, 1); continue; }
      if (l.kind === 'jelly') { updateJelly(l, dt); continue; }
      const TELE = (l.kind === 'piranha' ? 0.4 : 0.62) * (l.first ? 1.5 : 1) * diff().tele;
      if (l.state === 'lurk') {
        if (l.kind === 'piranha' && Math.random() < 0.05) parts.push(bubble(l.sx, SEA_Y - 2));
        if (l.sx <= BIRD_X + 40 && l.sx > BIRD_X - 4 && threatFree()) {
          l.state = 'telegraph'; l.t = 0; AUDIO.play(l.kind === 'piranha' ? 'snapperRise' : 'rustle');
          if (l.first) { run.tut[l.kind] = false; addFloat(l.sx, SEA_Y - 24, l.kind === 'piranha' ? 'PIRANHA!' : 'BULLFROG!', '#96d454'); }
        }
      } else if (l.state === 'telegraph') {
        l.t += dt;
        if (l.kind === 'bfrog' && Math.random() < 0.3) parts.push(dust(l.sx, SEA_Y, '#5cad3c'));
        if (l.t >= TELE) { l.state = 'leap'; l.t = 0; l.vy = l.kind === 'piranha' ? -250 : -300; l.ly = SEA_Y - 4; AUDIO.play(l.kind === 'piranha' ? 'chomp' : 'whoosh'); }
      } else if (l.state === 'leap') {
        l.t += dt; l.vy += 620 * dt; l.ly += l.vy * dt;
        if (!bird.dead && bird.invuln <= 0 && !l.first && Math.abs(l.sx - bird.x) < 8 && Math.abs(l.ly - bird.y) < 8) { hurt(l.kind, { sfx: 'chomp', shake: 3.5, shakeDur: 0.35, freeze: 0.1, flash: 0.12, feathers: 8, knockVy: -120 }); l.hit = true; }
        if (l.ly >= SEA_Y - 4 && l.vy > 0) { l.state = 'spent'; l.ly = SEA_Y - 4; if (!l.hit) AUDIO.play('land'); spawnParts(6, function () { return dust(l.sx, SEA_Y, l.kind === 'piranha' ? '#68b7cf' : '#5cad3c'); }); }
      }
    }
  }
  function drawLeapers() {
    for (const l of world.leapers) {
      const sx = l.sx; if (sx < -12 || sx > W + 12) continue;
      if (l.kind === 'jelly') {
        const spr = Math.floor(time * 3 + l.bob) % 2 ? SPR.JELLY1 : SPR.JELLY2;
        ctx.globalAlpha = 0.92; ctx.drawImage(spr, Math.round(sx - spr.width / 2), Math.round(l.y - spr.height / 2)); ctx.globalAlpha = 1;
        continue;
      }
      const spr = l.kind === 'bfrog' ? SPR.BFROG : SPR.PIRANHA;
      let yy;
      if (l.state === 'lurk') yy = SEA_Y - 3;
      else if (l.state === 'telegraph') yy = SEA_Y - 3 + (l.kind === 'bfrog' ? Math.sin(time * 26) * 1 : 0);
      else yy = l.ly;
      ctx.drawImage(spr, Math.round(sx - spr.width / 2), Math.round(yy - spr.height / 2));
    }
  }

  // ---------- new attackable enemies: armored shieldbug + hornet nest ----------
  function updateShieldbugs(dt) {
    if (world.sbugTimer > 0 && world.phase === 'fly') {
      world.sbugTimer -= dt;
      if (world.sbugTimer <= 0) {
        world.sbugs.push({ worldX: world.dist + W + 16, y: rnd(40, SEA_Y - 44), ph: rnd(0, 6.28), hp: 6, maxhp: 6, first: run.tut.sbug });
        world.sbugTimer = rnd(6, 9) * diff().timer;
      }
    }
    for (let i = world.sbugs.length - 1; i >= 0; i--) {
      const s = world.sbugs[i];
      s.ph += dt * 2;
      s.worldX -= 12 * dt; // drifts slowly against the scroll — a flying wall
      s.sx = s.worldX - world.dist;
      s.y += Math.sin(s.ph) * 8 * dt;
      if (s.first && s.sx < W - 12) { s.first = false; run.tut.sbug = false; addFloat(s.sx, s.y - 12, 'SHIELDBUG!', '#c9d2e0'); }
      if (s.sx < -14) { world.sbugs.splice(i, 1); continue; }
      if (!bird.dead && !bird.latched && bird.invuln <= 0 && Math.abs(s.sx - bird.x) < 8 && Math.abs(s.y - bird.y) < 7) hurt('sbug', { sfx: 'hit', shake: 2, feathers: 4, knockVy: -80 });
    }
  }
  function drawShieldbugs() {
    for (const s of world.sbugs) {
      if (s.sx < -12 || s.sx > W + 12) continue;
      const spr = Math.floor(time * 14) % 2 ? SPR.SHIELDBUG1 : SPR.SHIELDBUG2;
      ctx.drawImage(spr, Math.round(s.sx - 4), Math.round(s.y - 4));
    }
  }

  function updateHornets(dt) {
    for (const o of world.obstacles) {
      const n = o.hnest; if (!n || n.dead) continue;
      const sx = o.x - world.dist + o.w * 0.5;
      n.sx = sx; n.ny = (o.gapY - o.gapH / 2) + 9;
      if (sx < W - 4 && sx > 30 && world.phase === 'fly') {
        if (n.first) { n.first = false; run.tut.hornet = false; addFloat(sx, n.ny - 14, 'HORNET NEST!', '#f2a63c'); AUDIO.play('snakeHiss'); }
        n.cd -= dt;
        if (n.cd <= 0 && world.hornets.length < 3) { n.cd = 1.6 * diff().tele; world.hornets.push({ x: sx, y: n.ny + 5, ph: rnd(0, 6.28), hp: 1, maxhp: 1 }); AUDIO.play('rustle'); }
      }
    }
    for (let i = world.hornets.length - 1; i >= 0; i--) {
      const h = world.hornets[i]; h.ph += dt * 9;
      const dx = bird.x - h.x, dy = bird.y - h.y, d = Math.max(1, Math.hypot(dx, dy));
      h.x += (dx / d * 40) * dt + Math.cos(h.ph) * 9 * dt - world.speed * 0.25 * dt;
      h.y += (dy / d * 40) * dt + Math.sin(h.ph * 1.2) * 10 * dt;
      h.y = clamp(h.y, 16, SEA_Y - 6);
      if (h.x < -12) { world.hornets.splice(i, 1); continue; }
      if (!bird.dead && !bird.latched && bird.invuln <= 0 && Math.abs(h.x - bird.x) < 6 && Math.abs(h.y - bird.y) < 6) { hurt('hornet', { sfx: 'hit', shake: 2, feathers: 4, knockVy: -80 }); world.hornets.splice(i, 1); }
    }
  }
  function drawHornets() {
    for (const o of world.obstacles) {
      const n = o.hnest; if (!n || n.dead || n.sx == null) continue;
      if (n.sx < -10 || n.sx > W + 10) continue;
      ctx.drawImage(SPR.HORNET_NEST, Math.round(n.sx - 4), Math.round(n.ny - 5 + Math.sin(time * 2) * 1));
    }
    for (const h of world.hornets) { const spr = Math.floor(time * 20 + h.ph) % 2 ? SPR.HORNET1 : SPR.HORNET2; ctx.drawImage(spr, Math.round(h.x - 3), Math.round(h.y - 3)); }
  }

  // ---------- boss: THE GREAT EAGLE ----------
  function ellipseFill(cx, cy, rx, ry, col) {
    ctx.fillStyle = col;
    for (let dy = -ry; dy <= ry; dy++) { const hw = Math.round(rx * Math.sqrt(Math.max(0, 1 - (dy / ry) * (dy / ry)))); if (hw <= 0) continue; ctx.fillRect(Math.round(cx - hw), Math.round(cy + dy), hw * 2, 1); }
  }
  function drawEagle(cx, cy, flap) {
    const P = '#3a2c18', a = '#6b4f2e', H = '#9a7a4a', z = '#efe6d2', y = '#e0b24a';
    for (let s = -1; s <= 1; s += 2) {
      for (let fI = 0; fI < 5; fI++) {
        const wx = cx + s * (5 + fI * 5), wyy = cy - 1 + flap * (2 + fI * 2), len = Math.max(2, 7 - fI);
        ctx.fillStyle = fI % 2 ? a : H; ctx.fillRect(Math.round(wx - 2), Math.round(wyy - len / 2), 4, len);
        ctx.fillStyle = P; ctx.fillRect(Math.round(wx - 2), Math.round(wyy + len / 2 - 1), 4, 1);
      }
    }
    ellipseFill(cx, cy + 3, 5, 9, a); ellipseFill(cx - 1, cy + 3, 2, 8, H);
    ctx.fillStyle = H; ctx.fillRect(cx - 4, cy + 11, 8, 4); ctx.fillStyle = P; ctx.fillRect(cx - 4, cy + 14, 8, 1);
    ellipseFill(cx, cy - 5, 4, 4, z);
    ctx.fillStyle = y; ctx.fillRect(cx - 1, cy - 3, 2, 3); ctx.fillStyle = '#b8882e'; ctx.fillRect(cx - 1, cy - 1, 2, 1);
    ctx.fillStyle = P; ctx.fillRect(cx - 2, cy - 6, 1, 1); ctx.fillRect(cx + 1, cy - 6, 1, 1);
    ctx.fillStyle = y; ctx.fillRect(cx - 3, cy + 14, 1, 2); ctx.fillRect(cx + 2, cy + 14, 1, 2);
  }
  function endAttack(B) {
    B.attacks++; B.hp = Math.max(0, B.hp - 14); // outlasting an attack chips the boss too
    if (B.hp <= 0) { B.state = 'defeated'; B.t = 0; AUDIO.play('die'); bossReward(); }
    else { B.state = 'recover'; B.t = 0; }
  }
  function bossReward() {
    run.score += 300; addDNA(20);
    bird.maxHearts = Math.min(6, bird.maxHearts + 1); bird.hearts = bird.maxHearts;
    AUDIO.play('heart'); AUDIO.play('evolve');
    addFloat(bird.x, bird.y - 22, 'BOSS DRIVEN OFF!', '#96f0e4', true);
    spawnParts(24, function () { return sparkle(bird.x + rnd(-20, 20), bird.y + rnd(-16, 10), pick(['#fff3a8', '#e0b24a', '#96f0e4'])); });
    grantPet(); // every boss tames a cute companion
  }
  function updateBoss(dt) {
    const B = world.boss; if (!B) return;
    B.t += dt; B.wing += dt * 6;
    for (let i = B.feathers.length - 1; i >= 0; i--) {
      const f = B.feathers[i]; f.t += dt; f.vy += (f.g == null ? 240 : f.g) * dt; f.x += f.vx * dt; f.y += f.vy * dt;
      if (!bird.dead && bird.invuln <= 0 && Math.abs(f.x - bird.x) < 6 && Math.abs(f.y - bird.y) < 6) { hurt(B.kind, { sfx: 'chomp', shake: 3, feathers: 6, knockVy: 60 }); f.dead = true; }
      if (f.dead || f.y > SEA_Y || f.x < -20 || f.y < -24 || f.t > 4) B.feathers.splice(i, 1);
    }
    if (B.state === 'enter') {
      B.x += ((W - 64) - B.x) * Math.min(1, dt * 1.5); B.y += (34 - B.y) * Math.min(1, dt * 2);
      if (B.t > 1.6) { B.state = 'idle'; B.t = 0; if (B.first) { B.first = false; addFloat(W / 2, 62, BOSS_NAMES[B.kind], '#e0b24a', true); } AUDIO.play('hawkScreech'); }
    } else if (B.state === 'idle') {
      B.x += ((W - 64) - B.x) * Math.min(1, dt * 2); B.y = 34 + Math.sin(B.t * 3) * 3;
      if (B.t > 0.8) {
        B.pattern = pick(BOSS_PATTERNS[B.kind] || BOSS_PATTERNS.eagle);
        if (B.pattern === 'gust') B.gustDir = pick([-1, 1]);
        B.state = 'telegraph'; B.t = 0; B.lockY = bird.y; B.lockX = bird.x;
        AUDIO.play(B.kind === 'serpent' ? 'snakeHiss' : 'hawkScreech');
      }
    } else if (B.state === 'telegraph') {
      if (B.t < 0.3) { B.lockY = bird.y; B.lockX = bird.x; }
      if (B.t > 0.85) {
        B.state = 'attack'; B.t = 0; AUDIO.play('hawkWhoosh');
        if (B.pattern === 'feathers') { for (let i = 0; i < 5; i++) B.feathers.push({ x: B.x - 10 + i * 8, y: B.y + 6, vx: rnd(-24, 24), vy: rnd(-10, 20), t: 0 }); }
        else if (B.pattern === 'globs') { for (let i = 0; i < 4; i++) B.feathers.push({ x: B.x - 4, y: B.y + 2, vx: -rnd(60, 150), vy: -rnd(30, 110), g: 260, t: 0 }); AUDIO.play('snakeStrike'); }
        else if (B.pattern === 'shards') { for (let i = 0; i < 4; i++) { const dx = bird.x - B.x, dy = (bird.y + (i - 1.5) * 12) - B.y, d = Math.max(1, Math.hypot(dx, dy)); B.feathers.push({ x: B.x - 6, y: B.y + 2, vx: dx / d * 170, vy: dy / d * 170, g: 0, t: 0 }); } AUDIO.play('zap'); }
      }
    } else if (B.state === 'attack') {
      if (B.pattern === 'dive') {
        const k = Math.min(1, B.t / 0.6); B.x = lerp(W - 64, bird.x, Math.min(1, k * 1.25)); B.y = lerp(34, B.lockY, Math.sin(k * Math.PI));
        if (!bird.dead && bird.invuln <= 0 && Math.abs(B.x - bird.x) < 12 && Math.abs(B.y - bird.y) < 11) hurt(B.kind, { sfx: 'chomp', shake: 5, shakeDur: 0.4, freeze: 0.14, flash: 0.16, feathers: 12, knockVy: 130 });
        if (B.t > 0.7) endAttack(B);
      } else if (B.pattern === 'sweep') {
        B.y = B.lockY; B.x -= 250 * dt;
        if (!bird.dead && bird.invuln <= 0 && Math.abs(B.x - bird.x) < 13 && Math.abs(B.y - bird.y) < 9) hurt(B.kind, { sfx: 'chomp', shake: 5, shakeDur: 0.4, freeze: 0.14, flash: 0.16, feathers: 12, knockVy: 130 });
        if (B.x < -30) { B.x = W + 30; endAttack(B); }
      } else if (B.pattern === 'rise') { // a serpent neck erupts from the mire at your column
        const k = Math.min(1, B.t / 0.75);
        B.riseY = SEA_Y - (SEA_Y - 30) * Math.sin(k * Math.PI);
        if (!bird.dead && bird.invuln <= 0 && Math.abs(bird.x - B.lockX) < 9 && bird.y > B.riseY - 5) hurt(B.kind, { sfx: 'chomp', shake: 5, shakeDur: 0.4, freeze: 0.14, flash: 0.16, feathers: 12, knockVy: -130 });
        if (B.t > 0.8) endAttack(B);
      } else if (B.pattern === 'gust') { // the owl beats a freezing wind — fight the push
        bird.vy += 175 * B.gustDir * dt;
        if (Math.random() < 0.6) parts.push(streak(rnd(10, SEA_Y - 6)));
        if (B.t > 1.4) endAttack(B);
      } else { // volley patterns: feathers / globs / shards
        B.x += ((W - 64) - B.x) * Math.min(1, dt * 2);
        if ((B.t > 1.0 && B.feathers.length === 0) || B.t > 2.6) endAttack(B);
      }
    } else if (B.state === 'recover') {
      B.x += ((W - 64) - B.x) * Math.min(1, dt * 2.5); B.y += (34 - B.y) * Math.min(1, dt * 3);
      if (B.t > 0.6) { B.state = 'idle'; B.t = 0; }
    } else if (B.state === 'defeated') {
      B.x += 40 * dt; B.y -= 70 * dt; B.wing += dt * 4;
      if (Math.random() < 0.3) parts.push(feather(B.x, B.y));
      if (B.y < -30) { world.boss = null; enterCine(); }
    }
  }

  function drawSerpentHead(cx, cy) {
    ellipseFill(cx, cy, 7, 6, '#3e7a2e');
    ellipseFill(cx - 1, cy - 2, 5, 3, '#5cad3c');
    ctx.fillStyle = '#c7d94a'; ctx.fillRect(cx - 4, cy - 2, 2, 2); ctx.fillRect(cx + 2, cy - 2, 2, 2);
    ctx.fillStyle = '#161020'; ctx.fillRect(cx - 4, cy - 2, 1, 1); ctx.fillRect(cx + 2, cy - 2, 1, 1);
    if (Math.floor(time * 5) % 3 === 0) { ctx.fillStyle = '#e0525c'; ctx.fillRect(cx - 1, cy + 5, 1, 3); ctx.fillRect(cx - 2, cy + 8, 1, 1); ctx.fillRect(cx, cy + 8, 1, 1); }
  }
  function drawSerpent(cx, cy) {
    const segs = 9; // body coils down to the mire at the right edge
    for (let i = segs; i >= 1; i--) {
      const k = i / segs;
      const bx = lerp(cx, W - 12, k) + Math.sin(time * 3 + k * 5) * (3 * k);
      const by = lerp(cy + 4, SEA_Y - 2, k * k);
      const r = Math.round(3 + k * 4);
      ellipseFill(bx, by, r, r, i % 2 ? '#2f6b2a' : '#3e7a2e');
    }
    drawSerpentHead(cx, cy);
  }
  function drawOwl(cx, cy, flap) {
    for (let s = -1; s <= 1; s += 2) {
      for (let fI = 0; fI < 5; fI++) {
        const wx = cx + s * (5 + fI * 5), wyy = cy + flap * (2 + fI * 2), len = Math.max(2, 7 - fI);
        ctx.fillStyle = fI % 2 ? '#8a97a6' : '#c9d2e0'; ctx.fillRect(Math.round(wx - 2), Math.round(wyy - len / 2), 4, len);
        ctx.fillStyle = '#5b6474'; ctx.fillRect(Math.round(wx - 2), Math.round(wyy + len / 2 - 1), 4, 1);
      }
    }
    ellipseFill(cx, cy + 3, 6, 8, '#c9d2e0'); ellipseFill(cx, cy + 4, 4, 6, '#eef6ff');
    ellipseFill(cx, cy - 4, 5, 5, '#eef6ff');
    ctx.fillStyle = '#5b6474'; ctx.fillRect(cx - 5, cy - 10, 2, 3); ctx.fillRect(cx + 3, cy - 10, 2, 3);
    ctx.fillStyle = '#f6c945'; ctx.fillRect(cx - 3, cy - 5, 2, 2); ctx.fillRect(cx + 1, cy - 5, 2, 2);
    ctx.fillStyle = '#161020'; ctx.fillRect(cx - 2, cy - 5, 1, 1); ctx.fillRect(cx + 2, cy - 5, 1, 1);
    ctx.fillStyle = '#e0b24a'; ctx.fillRect(cx - 1, cy - 3, 2, 2);
    ctx.fillStyle = '#f6c945'; ctx.fillRect(cx - 3, cy + 11, 1, 2); ctx.fillRect(cx + 2, cy + 11, 1, 2);
  }

  function drawBoss() {
    const B = world.boss; if (!B) return;
    if (B.state === 'telegraph' && Math.floor(time * 8) % 2) {
      if (B.pattern === 'dive') { ctx.fillStyle = 'rgba(224,178,74,0.4)'; ctx.fillRect(bird.x - 13, 0, 26, SEA_Y); }
      else if (B.pattern === 'sweep') { ctx.fillStyle = 'rgba(224,178,74,0.5)'; ctx.fillRect(0, Math.round(B.lockY) - 1, W, 3); }
      else if (B.pattern === 'rise') { ctx.fillStyle = 'rgba(199,217,74,0.4)'; ctx.fillRect(Math.round(B.lockX - 10), 30, 20, SEA_Y - 30); }
      else if (B.pattern === 'gust') drawTextShadow(ctx, B.gustDir < 0 ? '! UPDRAFT !' : '! DOWNDRAFT !', W / 2, 52, '#a8e4f2', 1, 'center');
    }
    if (B.pattern === 'rise' && B.state === 'attack' && B.riseY != null) { // the erupting neck column
      const hx = Math.round(B.lockX), hy = Math.round(B.riseY);
      ctx.fillStyle = '#2f6b2a'; ctx.fillRect(hx - 4, hy, 8, SEA_Y - hy);
      ctx.fillStyle = '#3e7a2e'; ctx.fillRect(hx - 2, hy, 3, SEA_Y - hy);
      drawSerpentHead(hx, hy);
    }
    if (B.kind === 'serpent') drawSerpent(B.x, B.y);
    else if (B.kind === 'owl') drawOwl(B.x, B.y, Math.sin(B.wing * 3));
    else drawEagle(B.x, B.y, Math.sin(B.wing * 3));
    const pc = B.kind === 'serpent' ? '#c7d94a' : (B.kind === 'owl' ? '#a8e4f2' : '#6b4f2e');
    ctx.fillStyle = pc;
    for (const f of B.feathers) ctx.fillRect(Math.round(f.x), Math.round(f.y), 2, 3);
  }

  // ---------- cutscene + island ----------
  const CINE = { reveal: 0, pan: 0.5, panEnd: 1.6, glide: 2.15, flare: 2.55, touch: 2.95, settle: 3.15, end: 3.95 };
  const ISLAND_REST = 176;

  function buildIsland() {
    return { seed: irnd(1, 99999), x: W + 80, halfW: 46, capY: 104, baseY: SEA_Y, nestDX: 8, treeDX: -16, perchY: 94, biome: world.biome };
  }

  function enterCine() {
    world.phase = 'cine';
    world.island = buildIsland();
    world.foods.length = 0;
    world.shots.length = 0; world.fx.length = 0; world.hornets.length = 0; world.sbugs.length = 0;
    world.cine = { t: 0, skipped: false, bobT: 0, startX: bird.x, startY: bird.y, startVy: bird.vy };
    bird.glideHeld = false;
  }

  function perchX() { return world.island.x + world.island.nestDX; }
  function landY() { return world.island.perchY - 3; }

  function updateCine(dt) {
    const c = world.cine, isl = world.island, cam = world.cam;
    c.t += dt;
    const t = c.t;
    // grove scrolls in to rest during the reveal
    if (t < CINE.pan) isl.x = Math.max(ISLAND_REST, W + 80 - (W + 80 - ISLAND_REST) * easeOutCubic(t / CINE.pan));
    else isl.x = ISLAND_REST;

    // camera zoom
    let sc = 1;
    if (t < CINE.pan) sc = lerp(1.0, 1.26, easeOutCubic(t / CINE.pan));
    else if (t < CINE.glide) sc = 1.26;
    else if (t < CINE.touch) sc = lerp(1.26, 1.32, easeInOutCubic((t - CINE.glide) / (CINE.touch - CINE.glide)));
    else if (t < CINE.end) sc = lerp(1.32, 1.08, easeInOutCubic((t - CINE.touch) / (CINE.end - CINE.touch)));
    cam.scale = sc;

    // OVERVIEW PAN: sweep the camera across the grove, then settle on the nest
    let focusTarget;
    if (t < CINE.pan) focusTarget = isl.x;
    else if (t < CINE.panEnd) focusTarget = lerp(isl.x - 34, isl.x + 34, easeInOutCubic((t - CINE.pan) / (CINE.panEnd - CINE.pan)));
    else focusTarget = lerp(isl.x + 34, perchX(), easeInOutCubic(clamp((t - CINE.panEnd) / (CINE.end - CINE.panEnd), 0, 1)));
    cam.focusX = clamp(focusTarget, 90, 232);
    cam.focusY = clamp(t < CINE.glide ? 86 : (landY() + bird.y) / 2, 60, 122);

    const px = perchX(), py = landY(), hoverX = ISLAND_REST - 74;
    if (t < CINE.glide) {
      // glide in and hover at the edge, wings spread, taking in the grove
      bird.glidePose = true; bird.vy = 0;
      bird.x = lerp(c.startX, hoverX, easeOutCubic(clamp(t / CINE.pan, 0, 1)));
      bird.y = lerp(c.startY, 84 + Math.sin(t * 3) * 3, easeOutCubic(clamp(t / CINE.glide, 0, 1)));
      bird.rot = lerp(bird.rot, -0.05, dt * 4);
      if (t < dt * 2) AUDIO.play('chirp');
    } else if (t < CINE.flare) {
      const k = easeInOutCubic((t - CINE.glide) / (CINE.flare - CINE.glide));
      bird.x = lerp(hoverX, px - 18, k); bird.y = lerp(84, py - 14, k);
      bird.rot = -0.12; bird.glidePose = true;
      if (t < CINE.glide + dt * 2) AUDIO.play('chirp');
    } else if (t < CINE.touch) {
      const k = easeOutBack((t - CINE.flare) / (CINE.touch - CINE.flare));
      bird.x = lerp(px - 18, px, k); bird.y = lerp(py - 14, py, k);
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
      if (t >= CINE.settle && Math.random() < 0.3) parts.push(sparkle(perchX() + rnd(-16, 16), landY() + rnd(-14, 4), '#3fc0b0'));
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
    save.dna += (run.dnaEarned || 0); run.dnaEarned = 0; persist(); // bank DNA at the nest
    if (run.tutorialMode && run.depth >= 1) { save.tutorialDone = true; persist(); }
    world.cam.scale = 1; world.cam.kickX = 0; world.cam.kickY = 0;
    ui = { phase: 'summary', t: 0, cards: null, sel: 0, cardRects: null, flash: 0 };
  }

  // ---------- update: island ----------
  function updateIsland(dt) {
    ui.t += dt;
    if (ui.flash > 0) ui.flash -= dt;
    if (ui.hatched) ui.hatchAnim = (ui.hatchAnim || 0) + dt;
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
    if (ui.phase === 'hatching') { // the egg cracks and the baby is born, then paths appear
      if (ui.t >= 1.7) { ui.phase = 'path'; ui.cards = makePathCards(); ui.sel = 0; ui.t = 0; }
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
      const cc = ui.cards[ui.sel];
      if (cc.kind === 'skill') applySkill(cc.skill); else applyMutation(cc.mut);
      ui.phase = 'hatching'; ui.cards = null; ui.t = 0;
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
      updateTitleScene(dt);
    }
    else if (STATE === 'settings') { ui.t = (ui.t || 0) + dt; if (ui.resetFlash > 0) ui.resetFlash -= dt; updateBirdCosmetics(dt); }
    else if (STATE === 'intro') { updateIntro(dt); updateBirdCosmetics(dt); }
    if (run && run.pets && run.pets.length && (STATE === 'fly' || STATE === 'island')) updatePets(dt);
    updateParts(dt);
    actionQueued = false; flapQueued = false; attackQueued = false;
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

  // parallax forest depth bands
  function buildForestBand(w, h, pal, density, canR) {
    const cvv = document.createElement('canvas'); cvv.width = w; cvv.height = h;
    const c = cvv.getContext('2d');
    function lobe(cx, cy, rx, ry) {
      for (let dy = -ry; dy <= ry; dy++) {
        const yy = Math.round(cy + dy);
        const hw = Math.round(rx * Math.sqrt(Math.max(0, 1 - (dy / ry) * (dy / ry))));
        if (hw <= 0) continue;
        const lit = 0.5 - dy / ry * 0.5;
        c.fillStyle = lit > 0.72 ? pal.hi : (lit > 0.46 ? pal.mid : (lit > 0.2 ? pal.mid : pal.deep));
        c.fillRect(Math.round(cx - hw), yy, hw * 2, 1);
      }
    }
    let x = 8;
    while (x < w - 6) {
      const th = irnd(Math.floor(h * 0.5), h - 2), tw = irnd(2, 4), cx = x + Math.floor(tw / 2);
      // tapered shaded trunk
      c.fillStyle = pal.trunk; c.fillRect(cx - Math.floor(tw / 2), h - th, tw, th);
      c.fillStyle = pal.deep; c.fillRect(cx + Math.floor(tw / 2) - 1, h - th, 1, th);
      const cr = irnd(canR[0], canR[1]), cyc = h - th + cr - 1;
      // a couple of branches poking toward the canopy
      c.fillStyle = pal.trunk;
      for (let bI = 0; bI < 2; bI++) { const side = bI ? 1 : -1; for (let l = 1; l < cr * 0.7; l++) c.fillRect(cx + side * l, Math.round(cyc + cr * 0.4 - l * 0.5), 1, 1); }
      // layered organic canopy (3 lobes) with a lit crown
      lobe(cx - cr * 0.5, cyc + cr * 0.18, cr * 0.6, cr * 0.66);
      lobe(cx + cr * 0.5, cyc + cr * 0.12, cr * 0.6, cr * 0.66);
      lobe(cx, cyc - cr * 0.22, cr, cr * 0.9);
      // scattered rim leaves
      c.fillStyle = pal.hi;
      for (let i = 0; i < 7; i++) { const a = orand(x * 7 + i, i * 3) * 6.28; c.fillRect(Math.round(cx + Math.cos(a) * cr * 0.92), Math.round(cyc - cr * 0.2 + Math.sin(a) * cr * 0.82), 1, 1); }
      x += tw + irnd(density[0], density[1]);
    }
    return cvv;
  }
  const FARFOR = buildForestBand(560, 74, { trunk: '#5c6f6a', deep: '#486850', mid: '#5f8064', hi: '#789670' }, [10, 24], [8, 13]);
  const MIDFOR = buildForestBand(600, 100, { trunk: '#3f5240', deep: '#26472c', mid: '#356b39', hi: '#4c8a49' }, [14, 30], [11, 18]);
  const TUNDRA_FAR = buildForestBand(560, 58, { trunk: '#8a97a6', deep: '#7f95a2', mid: '#a7bcc4', hi: '#cfe0e6' }, [12, 26], [6, 11]);
  const TUNDRA_MID = buildForestBand(600, 82, { trunk: '#5f7480', deep: '#5f8078', mid: '#8fb0a2', hi: '#d2ece0' }, [16, 32], [9, 15]);
  const pollen = [];
  for (let i = 0; i < 28; i++) pollen.push({ x: Math.random() * W, y: Math.random() * (SEA_Y - 10), s: rnd(0.05, 0.22), r: rnd(0, 6.28) });

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

  function skyGrad(topC, botC) { for (let i = 0; i < 9; i++) { ctx.fillStyle = mixColor(topC, botC, i / 8); ctx.fillRect(0, i * 20, W, 20); } }
  function drawSunDisc(tier, x, y, r) { ctx.globalAlpha = 0.45; ctx.fillStyle = tier.sun; ctx.beginPath(); ctx.arc(x, y, r, 0, 6.28); ctx.fill(); ctx.globalAlpha = 1; }
  function drawBand(cvv, scrollX, mul, alpha, yoff) { let mx = Math.floor((scrollX * mul) % cvv.width); if (mx < 0) mx += cvv.width; ctx.globalAlpha = alpha; const yy = SEA_Y - cvv.height + (yoff || 0); ctx.drawImage(cvv, -mx, yy); ctx.drawImage(cvv, -mx + cvv.width, yy); ctx.globalAlpha = 1; }
  function drawPollenLayer(scrollX, col) { ctx.fillStyle = col; for (const m of pollen) { let px = (m.x - scrollX * m.s) % W; if (px < 0) px += W; ctx.fillRect(Math.round(px), Math.round(m.y + Math.sin(time * 0.6 + m.r) * 5), 1, 1); } }
  function drawCloudsLayer(scrollX) { for (const cl of clouds) { let x = cl.x - scrollX * cl.mul; x = ((x % (W + 80)) + (W + 80)) % (W + 80) - 40; ctx.globalAlpha = 0.85; ctx.drawImage(cl.spr, Math.round(x), Math.round(cl.y)); ctx.globalAlpha = 1; } }
  function drawSnowfall(scrollX) {
    ctx.fillStyle = '#eef6ff';
    for (const m of pollen) { let px = (m.x - scrollX * m.s * 0.5) % W; if (px < 0) px += W; const py = (m.y + time * (16 + m.s * 40)) % (SEA_Y - 4); ctx.fillRect(Math.round(px + Math.sin(time + m.r) * 3), Math.round(py), 1, 1); }
  }
  function drawDunes(scrollX) {
    for (let layer = 0; layer < 2; layer++) {
      ctx.fillStyle = layer === 0 ? '#d3ac6e' : '#c39a56';
      const amp = 9 + layer * 7, base = SEA_Y - 18 + layer * 8, freq = 0.018 + layer * 0.006, off = scrollX * (0.1 + layer * 0.16);
      for (let x = 0; x < W; x++) { const y = Math.round(base - amp * (0.5 + 0.5 * Math.sin((x + off) * freq))); ctx.fillRect(x, y, 1, SEA_Y - y); }
    }
  }

  function drawBackground(scrollX) {
    const env = world ? (world.biome.env || 'forest') : 'forest';
    const tier = skyOf();
    if (env === 'ocean') {
      skyGrad(tier.top, mixColor(tier.bot, '#bfe6f2', 0.4));
      drawSunDisc(tier, 250, 26, 14);
      drawCloudsLayer(scrollX);
      drawBand(FARFOR, scrollX, 0.08, 0.32, 4);
      drawPollenLayer(scrollX, 'rgba(255,255,255,0.5)');
      return;
    }
    if (env === 'tundra') {
      skyGrad(mixColor(tier.top, '#aebfd0', 0.45), mixColor(tier.bot, '#e8f0f8', 0.55));
      drawSunDisc(tier, 250, 24, 15);
      drawBand(TUNDRA_FAR, scrollX, 0.13, 0.5);
      drawBand(TUNDRA_MID, scrollX, 0.3, 0.85);
      drawSnowfall(scrollX);
      ctx.fillStyle = 'rgba(220,235,245,0.12)'; ctx.fillRect(0, 24, W, SEA_Y - 24);
      return;
    }
    if (env === 'desert') {
      skyGrad(mixColor(tier.top, '#e6a45e', 0.4), mixColor(tier.bot, '#f6dca0', 0.5));
      drawSunDisc(tier, 252, 26, 18);
      drawDunes(scrollX);
      drawPollenLayer(scrollX, 'rgba(240,220,170,0.55)');
      ctx.fillStyle = 'rgba(255,220,150,0.05)'; ctx.fillRect(0, SEA_Y - 42, W, 42);
      return;
    }
    forestBG(scrollX, tier);
  }

  function forestBG(scrollX, tier) {
    // canopy-filtered light: sky at the top fading into deep-forest haze below
    const haze = mixColor(tier.bot, '#2c5436', 0.6);
    for (let i = 0; i < 9; i++) { ctx.fillStyle = mixColor(tier.top, haze, i / 8); ctx.fillRect(0, i * 20, W, 20); }
    // soft sun shafting through the canopy
    ctx.globalAlpha = 0.45; ctx.fillStyle = tier.sun;
    ctx.beginPath(); ctx.arc(248, 22, 15, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
    // far forest band
    let fx = Math.floor((scrollX * 0.12) % FARFOR.width); if (fx < 0) fx += FARFOR.width;
    ctx.globalAlpha = 0.5; ctx.drawImage(FARFOR, -fx, SEA_Y - FARFOR.height); ctx.drawImage(FARFOR, -fx + FARFOR.width, SEA_Y - FARFOR.height); ctx.globalAlpha = 1;
    // mid forest band
    let mx = Math.floor((scrollX * 0.32) % MIDFOR.width); if (mx < 0) mx += MIDFOR.width;
    ctx.globalAlpha = 0.82; ctx.drawImage(MIDFOR, -mx, SEA_Y - MIDFOR.height); ctx.drawImage(MIDFOR, -mx + MIDFOR.width, SEA_Y - MIDFOR.height); ctx.globalAlpha = 1;
    // god rays
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 3; i++) {
      const rx = ((i * 128 + time * 5) % (W + 140)) - 70;
      ctx.globalAlpha = 0.05 + 0.02 * Math.sin(time + i);
      ctx.fillStyle = tier.sun;
      ctx.beginPath(); ctx.moveTo(rx, 0); ctx.lineTo(rx + 26, 0); ctx.lineTo(rx - 26, SEA_Y); ctx.lineTo(rx - 60, SEA_Y); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
    // drifting pollen / spores
    ctx.fillStyle = 'rgba(232,240,190,0.55)';
    for (const m of pollen) { let px = (m.x - scrollX * m.s) % W; if (px < 0) px += W; ctx.fillRect(Math.round(px), Math.round(m.y + Math.sin(time * 0.6 + m.r) * 5), 1, 1); }
    // top canopy overhang framing the screen
    const ov = mixColor(tier.top, '#16351f', 0.78);
    for (let x = 0; x <= W; x += 8) { const hh = 5 + Math.round(4 * Math.sin(x * 0.4 + 1)); ctx.fillStyle = ov; ctx.fillRect(x, 0, 8, hh); }
    ctx.fillStyle = 'rgba(16,36,22,0.55)'; ctx.fillRect(0, 0, W, 3);
    if (world && world.biome.sky === 'misty') { ctx.fillStyle = 'rgba(210,225,215,0.12)'; ctx.fillRect(0, 24, W, SEA_Y - 24); }
    if (world && world.biome.sky === 'stormy' && Math.random() < 0.01) { ctx.fillStyle = 'rgba(255,255,255,0.45)'; ctx.fillRect(0, 0, W, H); }
  }

  function drawSea() {
    const env = world ? (world.biome.env || 'forest') : 'forest';
    const scroll = world ? world.dist : time * 30;
    if (env === 'ocean') drawWaterFloor(scroll);
    else if (env === 'tundra') drawSnowFloor(scroll);
    else if (env === 'desert') drawSandFloor(scroll);
    else drawForestFloor(scroll);
  }

  function drawWaterFloor(scroll) {
    ctx.fillStyle = '#2e6f8e'; ctx.fillRect(0, SEA_Y, W, H - SEA_Y);
    ctx.fillStyle = '#3d8aa8'; ctx.fillRect(0, SEA_Y, W, 3);
    ctx.fillStyle = '#8fd4e8';
    for (let x = 0; x < W; x += 4) { if (Math.sin(x * 0.11 + time * 2.4) > 0.55) ctx.fillRect(x, SEA_Y + Math.round(Math.sin(x * 0.31 + time * 3.1)), 3, 1); }
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    for (let x = 0; x < W; x += 7) { if (Math.sin(x * 1.7 + time * 1.3) > 0.8) ctx.fillRect(x, SEA_Y + 5 + (x % 5), 2, 1); }
  }
  function drawSnowFloor(scroll) {
    ctx.fillStyle = '#e6eef6'; ctx.fillRect(0, SEA_Y, W, H - SEA_Y);
    ctx.fillStyle = '#f6fbff'; ctx.fillRect(0, SEA_Y, W, 3);
    ctx.fillStyle = '#cddbe8';
    for (let x = 0; x < W; x += 5) { const o = (x + Math.floor(scroll)) % 11; if (o < 3) ctx.fillRect(x, SEA_Y + 5 + (x % 5), 2, 1); }
    ctx.fillStyle = '#ffffff';
    for (let x = 0; x < W; x += 9) { if ((x + Math.floor(scroll)) % 17 < 2) ctx.fillRect(x, SEA_Y + 2 + (x % 6), 1, 1); }
  }
  function drawSandFloor(scroll) {
    ctx.fillStyle = '#d3ac6e'; ctx.fillRect(0, SEA_Y, W, H - SEA_Y);
    ctx.fillStyle = '#e8c98a'; ctx.fillRect(0, SEA_Y, W, 3);
    ctx.fillStyle = '#c39a56';
    for (let x = 0; x < W; x += 4) { const y = SEA_Y + 5 + Math.round(2 * Math.sin((x + scroll) * 0.14)); ctx.fillRect(x, y, 3, 1); }
    ctx.fillStyle = '#b4894c';
    for (let x = 0; x < W; x += 13) { if ((x + Math.floor(scroll)) % 20 < 3) ctx.fillRect(x, SEA_Y + 9 + (x % 5), 2, 1); }
  }

  function drawFloorProps(scroll) {
    const spacing = 44;
    const start = Math.floor(scroll / spacing) - 1;
    for (let i = start; i < start + 10; i++) {
      const wx = i * spacing + orand(i, 1) * 30;
      const sx = Math.round(wx - scroll);
      if (sx < -24 || sx > W + 12) continue;
      const k = Math.floor(orand(i, 2) * 6);
      const spr = k === 0 ? SPR.FERN : k === 1 ? SPR.BUSH : k === 2 ? SPR.MUSHROOM : k === 3 ? SPR.LOG : k === 4 ? SPR.MUSHROOM2 : SPR.FERN;
      ctx.drawImage(spr, sx, SEA_Y - spr.height + 3);
    }
  }

  function drawForestFloor(scroll) {
    // undergrowth soil band
    ctx.fillStyle = '#2c3b22'; ctx.fillRect(0, SEA_Y, W, H - SEA_Y);
    ctx.fillStyle = '#233018'; ctx.fillRect(0, SEA_Y + 6, W, H - SEA_Y - 6);
    // soil speckle
    ctx.fillStyle = '#3a4d28';
    for (let x = 0; x < W; x += 5) { const o = (x + Math.floor(scroll)) % 13; if (o < 3) ctx.fillRect(x, SEA_Y + 6 + (x % 6), 2, 1); }
    // scrolling undergrowth props (behind the grass fringe)
    drawFloorProps(scroll);
    // grass fringe along the top edge of the floor
    const gx = Math.floor(scroll % 8);
    for (let x = -gx; x < W; x += 3) {
      const hh = 3 + (Math.abs(Math.floor((x + gx) * 0.7)) % 3);
      ctx.fillStyle = ((x + gx) % 9 === 0) ? '#96d454' : (((x + gx) % 5 === 0) ? '#3d7f2a' : '#5cad3c');
      ctx.fillRect(x, SEA_Y - hh + 1, 1, hh);
    }
    ctx.fillStyle = '#3d5a2a'; ctx.fillRect(0, SEA_Y, W, 2);
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
    if (tv.snow) { ctx.fillStyle = tv.snow; for (let i = 0; i < 6; i++) ctx.fillRect(Math.round(cx - o.w / 2 + orand(o.seed, i * 3 + 1) * o.w), Math.round(edgeY + dir * (2 + orand(o.seed, i * 2) * 22)), 2, 1); }
  }

  function drawPalmHalf(cx, edgeY, dir, o, tv) {
    const crownY = edgeY + dir * 2, nf = 6;
    const sway = Math.sin(time * 1.6 + o.seed * 0.02) * 2;
    for (let i = 0; i < nf; i++) {
      const ang = (i / (nf - 1) - 0.5) * 2.3, len = 12 + orand(o.seed, i * 5) * 6;
      const ex = cx + Math.sin(ang) * len + sway, ey = crownY + dir * (Math.abs(Math.cos(ang)) * len * 0.55 + 2);
      drawLimb(cx, crownY, ex, ey, 2, tv.bark);
      ctx.fillStyle = i % 2 ? tv.canopy.mid : tv.canopy.top;
      for (let t = 0.35; t <= 1; t += 0.22) { const px = lerp(cx, ex, t), py = lerp(crownY, ey, t); ctx.fillRect(Math.round(px), Math.round(py), 2, 2); }
      ctx.fillStyle = tv.canopy.hi; ctx.fillRect(Math.round(ex), Math.round(ey), 1, 1);
    }
    ctx.fillStyle = tv.bark.dark; ctx.fillRect(cx - 2, Math.round(crownY - 1), 4, 3);
    ctx.fillStyle = '#5a3a20'; ctx.fillRect(cx - 3, Math.round(crownY + dir * 3), 2, 2); ctx.fillRect(cx + 1, Math.round(crownY + dir * 3), 2, 2);
  }

  function drawCactusObstacle(sx, o) {
    const topH = o.gapY - o.gapH / 2, botY = o.gapY + o.gapH / 2, cx = sx + o.w / 2, half = 5;
    function column(y0, y1) {
      if (y1 <= y0) return;
      ctx.fillStyle = '#3f8f4e'; ctx.fillRect(cx - half, y0, half * 2, y1 - y0);
      ctx.fillStyle = '#5bb56a'; ctx.fillRect(cx - half, y0, 2, y1 - y0);
      ctx.fillStyle = '#2f6b3a'; ctx.fillRect(cx + half - 2, y0, 2, y1 - y0);
      ctx.fillStyle = '#2f6b3a'; for (let x = cx - half + 2; x < cx + half - 2; x += 3) ctx.fillRect(x, y0, 1, y1 - y0);
      ctx.fillStyle = '#e8e0c0'; for (let y = y0 + 1; y < y1; y += 4) { ctx.fillRect(cx - half - 1, y, 1, 1); ctx.fillRect(cx + half, y, 1, 1); }
    }
    column(botY, SEA_Y);
    ctx.fillStyle = '#3f8f4e'; ctx.fillRect(cx + 3, botY + 10, 7, 4); ctx.fillRect(cx + 7, botY + 2, 4, 12);
    ctx.fillStyle = '#5bb56a'; ctx.fillRect(cx + 7, botY + 2, 2, 12);
    ctx.fillStyle = '#e0525c'; ctx.fillRect(cx - 1, botY - 2, 2, 2);
    if (topH > 2) {
      column(0, topH);
      ctx.fillStyle = '#3f8f4e'; ctx.fillRect(cx - 10, topH - 12, 7, 4); ctx.fillRect(cx - 11, topH - 14, 4, 12);
      ctx.fillStyle = '#e8c94a'; ctx.fillRect(cx - 1, topH, 2, 2);
    }
  }

  // filled shaded ellipse of leaves (top-lit), ragged organic edge + dapples
  function canopyEllipse(cx, cy, rx, ry, pal, seed, sway) {
    if (rx < 1 || ry < 1) return;
    for (let dy = -ry; dy <= ry; dy++) {
      const yy = Math.round(cy + dy);
      const hw = Math.round(rx * Math.sqrt(Math.max(0, 1 - (dy / ry) * (dy / ry))));
      if (hw <= 0) continue;
      const lit = 0.5 - dy / ry * 0.5;
      const col = lit > 0.8 ? pal.hi : lit > 0.58 ? pal.top : lit > 0.36 ? pal.mid : lit > 0.16 ? pal.base : pal.deep;
      const jit = Math.round((orand(seed, dy + 40) - 0.5) * 2) + Math.round(sway * (0.3 + Math.abs(dy / ry) * 0.7));
      ctx.fillStyle = col; ctx.fillRect(Math.round(cx - hw + jit), yy, hw * 2, 1);
    }
    ctx.fillStyle = pal.hi;
    for (let i = 0; i < 5; i++) { const a = orand(seed, i * 13) * 6.28, rr = orand(seed, i * 7) * 0.7; ctx.fillRect(Math.round(cx + Math.cos(a) * rx * rr + sway), Math.round(cy + Math.sin(a) * ry * rr), 1, 1); }
    // scattered leaf detail on the perimeter for a fuller, leafier canopy
    for (let i = 0; i < 12; i++) {
      const a = orand(seed, 200 + i * 9) * 6.28;
      const px = cx + Math.cos(a) * rx * (0.82 + orand(seed, 210 + i) * 0.32) + sway;
      const py = cy + Math.sin(a) * ry * (0.82 + orand(seed, 220 + i) * 0.32);
      ctx.fillStyle = i % 3 === 0 ? pal.hi : (i % 3 === 1 ? pal.top : pal.mid);
      ctx.fillRect(Math.round(px), Math.round(py), 1, 1);
    }
  }

  // a tapered woody limb from (x0,y0) to (x1,y1)
  function drawLimb(x0, y0, x1, y1, w, bark) {
    const steps = Math.max(2, Math.round(Math.hypot(x1 - x0, y1 - y0)));
    for (let i = 0; i <= steps; i++) {
      const t = i / steps, x = lerp(x0, x1, t), y = lerp(y0, y1, t), ww = Math.max(1, Math.round(w * (1 - t * 0.7)));
      ctx.fillStyle = i > steps * 0.5 ? bark.dark : bark.mid;
      ctx.fillRect(Math.round(x - ww / 2), Math.round(y - ww / 2), ww, ww);
    }
  }

  function drawLeafyHalf(cx, edgeY, dir, o, tv, fruitColor) {
    const organic = o.variant !== 'cypress';
    const sway = Math.sin(time * (o.variant === 'broadleaf' || o.variant === 'mangrove' ? 1.9 : 1.3) + o.seed * 0.017) * (o.variant === 'broadleaf' ? 2 : 1);
    const rx = o.w / 2 + (tv.soft - 3), ry = tv.ry;
    const cy = edgeY + dir * ry;
    // branches forking from the trunk core into and through the canopy
    for (let i = 0; i < 3; i++) {
      const side = (i % 2 ? 1 : -1);
      const baseY = edgeY + dir * (ry * 0.95 + i * 3);
      const ang = 0.5 + orand(o.seed, i * 7) * 0.55;
      const blen = rx * (0.6 + orand(o.seed, i * 5) * 0.55);
      const tipx = cx + side * Math.cos(ang) * blen, tipy = baseY - dir * Math.sin(ang) * blen;
      drawLimb(cx, baseY, tipx, tipy, tv.coreHalf, tv.bark);
      canopyEllipse(tipx + sway, tipy, 5, 4, tv.canopy, o.seed + i * 11, sway * 0.5);
    }
    // organic canopy: central mass + offset lobes for a lumpy natural silhouette
    canopyEllipse(cx, cy, rx, ry, tv.canopy, o.seed, sway);
    if (organic) {
      canopyEllipse(cx - rx * 0.55, cy + dir * ry * 0.18, rx * 0.62, ry * 0.72, tv.canopy, o.seed + 3, sway);
      canopyEllipse(cx + rx * 0.55, cy + dir * ry * 0.12, rx * 0.62, ry * 0.72, tv.canopy, o.seed + 5, sway);
      canopyEllipse(cx, cy - dir * ry * 0.5, rx * 0.72, ry * 0.6, tv.canopy, o.seed + 7, sway);
    } else {
      canopyEllipse(cx, cy + dir * ry * 0.8, rx * 0.6, ry * 0.7, tv.canopy, o.seed + 3, sway);
    }
    // crisp lit lip = readable soft graze edge
    ctx.fillStyle = tv.canopy.hi;
    ctx.fillRect(Math.round(cx - rx * 0.6 + sway), edgeY - (dir > 0 ? 0 : 1), Math.round(rx * 1.2), 1);
    // decorations
    if (o.variant === 'nutoak') fruitDots(cx, cy, rx * 0.7, ry * 0.7, o.seed, '#7b4d26');
    else if (o.variant === 'broadleaf') {
      fruitDots(cx, cy, rx * 0.7, ry * 0.6, o.seed, tv.flower);
      ctx.fillStyle = tv.vine;
      for (let i = 0; i < 4; i++) { const vx = cx - 10 + Math.round(orand(o.seed, 200 + i * 9) * 20); const vl = 5 + Math.round(orand(o.seed, 230 + i) * 7); ctx.fillRect(vx, edgeY, 1, dir > 0 ? -vl : vl); ctx.fillStyle = tv.flower; if (i % 2) ctx.fillRect(vx, edgeY + (dir > 0 ? -vl : vl), 1, 1); ctx.fillStyle = tv.vine; }
    } else if (o.variant === 'cypress' && tv.moss) {
      ctx.fillStyle = tv.moss;
      for (let i = 0; i < 5; i++) { const mx = cx - 11 + Math.round(orand(o.seed, 60 + i * 3) * 22); const ml = 3 + Math.round(orand(o.seed, 80 + i) * 6); ctx.fillRect(mx, edgeY, 1, dir > 0 ? -ml : ml); }
    } else fruitDots(cx, cy, rx * 0.65, ry * 0.65, o.seed, fruitColor);
  }

  function drawTreeObstacle(sx, o, fruitColor) {
    const topH = o.gapY - o.gapH / 2, botY = o.gapY + o.gapH / 2, cx = sx + o.w / 2, tv = TREES[o.variant] || TREES.oak;
    const isPine = o.variant === 'pine' || o.variant === 'snowpine', isPalm = o.variant === 'palm';
    const trunkGap = (isPine || isPalm) ? 6 : 3;
    function half(edgeY, dir) {
      if (isPalm) drawPalmHalf(cx, edgeY, dir, o, tv);
      else if (isPine) drawPineHalf(cx, edgeY, dir, o, tv);
      else drawLeafyHalf(cx, edgeY, dir, o, tv, fruitColor);
    }
    // bottom piece: trunk from ground up, canopy top at botY
    barkColumn(cx, botY + trunkGap, SEA_Y, tv.coreHalf + 1, tv.bark, o.seed);
    if (o.variant === 'mangrove') { // prop roots
      ctx.fillStyle = tv.bark.dark;
      for (let i = -1; i <= 1; i += 2) { for (let r = 0; r < 8; r++) ctx.fillRect(cx + i * (2 + r), SEA_Y - 8 + r, 1, 2); }
    }
    half(botY, +1);
    // top piece: trunk from ceiling down, canopy bottom at topH
    if (topH > 2) {
      barkColumn(cx, 0, topH - trunkGap, tv.coreHalf + 1, tv.bark, o.seed + 5);
      half(topH, -1);
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
      else if (o.kind === 'cactus') drawCactusObstacle(sx, o);
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
      const spr = (s.state === 'strike' || s.state === 'latched') ? SPR.SNAKE_STRIKE : (s.state === 'windup' ? SPR.SNAKE_REAR : SPR.SNAKE_COIL);
      ctx.drawImage(spr, Math.round(hx - spr.width / 2), Math.round(hy - spr.height / 2));
      if (s.state === 'windup') drawAim(hx, hy, clamp(BIRD_X, ax - 26, ax + 4), s.lockY, '#c7d94a', time * 6);
    }
  }

  function drawSnappers() {
    for (const s of world.snappers) {
      const sx = Math.round(s.sx);
      if (sx < -14 || sx > W + 14) continue;
      if (s.state === 'lurk') { ctx.drawImage(SPR.PITCHER_LURK, sx - 3, Math.round(SEA_Y - 5 + Math.sin(s.bob))); }
      else if (s.state === 'telegraph') {
        ctx.drawImage(SPR.PITCHER_LURK, sx - 3, SEA_Y - 6);
        ctx.fillStyle = 'rgba(150,212,84,0.7)';
        for (let i = 0; i < 3; i++) ctx.fillRect(Math.round(sx + Math.sin(time * 12 + i) * 5), SEA_Y - 8 - i * 2, 1, 1);
      } else if (s.state === 'lunge' || s.state === 'retract') {
        ctx.drawImage(SPR.PITCHER_GAPE, sx - 5, Math.round(s.mawY - 4));
      }
    }
  }

  function drawDurians() {
    for (const o of world.obstacles) {
      const d = o.durian;
      if (!d || d.state === 'spent') continue;
      const sx = d.worldX - world.dist;
      if (sx < -12 || sx > W + 12) continue;
      let dx = sx;
      if (d.state === 'wobble') dx += Math.sin(time * 30) * 2;
      if (d.state !== 'fall') { ctx.strokeStyle = '#5a3f28'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(sx, d.y - 6); ctx.lineTo(dx, d.y - 3); ctx.stroke(); }
      if (d.state === 'wobble' || d.state === 'fall') { ctx.fillStyle = 'rgba(20,12,10,0.28)'; ctx.beginPath(); ctx.ellipse(sx, SEA_Y - 1, 5, 2, 0, 0, 6.28); ctx.fill(); }
      ctx.drawImage(SPR.DURIAN, Math.round(dx - SPR.DURIAN.width / 2), Math.round(d.y - SPR.DURIAN.height / 2));
    }
  }

  function drawChase() {
    const c = world.chaseBug;
    if (!c) return;
    ctx.globalAlpha = 0.3 + 0.16 * Math.sin(time * 10); ctx.fillStyle = '#fff3a8';
    ctx.beginPath(); ctx.arc(c.x, c.y, 6, 0, 6.28); ctx.fill(); ctx.globalAlpha = 1;
    const spr = Math.floor(time * 14) % 2 ? SPR.CHASE_BUG : SPR.CHASE_BUG2;
    ctx.drawImage(spr, Math.round(c.x - spr.width / 2), Math.round(c.y - spr.height / 2));
  }

  function drawFalcon() {
    const f = world.falcon; if (!f) return;
    const spr = (f.state === 'chase' && Math.abs(f.x - bird.x) < 22) ? SPR.FALCON_DIVE : (Math.floor(time * 12) % 2 ? SPR.FALCON_MID : SPR.FALCON_UP);
    ctx.globalAlpha = 0.25; ctx.drawImage(spr, Math.round(f.x - spr.width / 2 - 6), Math.round(f.y - spr.height / 2)); ctx.globalAlpha = 1;
    ctx.drawImage(spr, Math.round(f.x - spr.width / 2), Math.round(f.y - spr.height / 2));
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
  // a forest clearing with the flock's nest
  function drawIsland(isl) {
    const ix = Math.round(isl.x), b = isl.biome;
    const tv = b.tree ? (TREES[b.tree] || TREES.oak) : TREES.oak;
    const topY = isl.capY;
    // raised earthen clearing (grass cap over soil)
    for (let y = topY; y < SEA_Y + 8; y++) {
      const t = (y - topY) / (SEA_Y - topY);
      const hw = Math.round(isl.halfW * Math.sqrt(Math.max(0, Math.sin(t * Math.PI * 0.5 + 0.2))));
      if (y < topY + 3) ctx.fillStyle = (y === topY) ? '#96d454' : '#5cad3c';
      else if (y < topY + 10) ctx.fillStyle = '#3d7f2a';
      else ctx.fillStyle = mixColor('#6b4a2a', '#2c1e12', t);
      ctx.fillRect(ix - hw, y, hw * 2, 1);
    }
    // rim grass + flowers
    for (let i = 0; i < 9; i++) {
      const gx2 = ix - isl.halfW + Math.round(orand(isl.seed, i * 5) * isl.halfW * 2);
      ctx.fillStyle = '#96d454'; ctx.fillRect(gx2, topY - 2, 1, 2); ctx.fillRect(gx2 + 2, topY - 1, 1, 1);
      if (i % 2) { ctx.fillStyle = b.deco; ctx.fillRect(gx2 + 1, topY - 3, 1, 1); }
    }
    // big nesting tree behind the nest
    const tx = ix + isl.treeDX;
    barkColumn(tx, isl.perchY - 2, topY, 4, tv.bark, isl.seed + 9);
    canopyMound(tx, isl.perchY - 6, -1, 22, 15, tv.canopy, isl.seed + 3, Math.sin(time * 1.3) * 1);
    fruitDots(tx, isl.perchY - 16, 16, 10, isl.seed, b.deco);
    // the nest on a short stump
    const nx = ix + isl.nestDX;
    barkColumn(nx, isl.perchY + 2, topY, 3, tv.bark, isl.seed + 2);
    ctx.drawImage(SPR.NEST, Math.round(nx - SPR.NEST.width / 2), Math.round(isl.perchY - 2));
    // egg waiting -> cracking -> a baby hatchling once a new generation is born
    if (STATE === 'island' && ui.hatched) {
      const t = ui.hatchAnim || 0, pop = Math.min(1, t / 0.4);
      const by = isl.perchY - 6 - Math.round(pop * 3) + Math.round(Math.sin(time * 6) * 0.6);
      ctx.drawImage(SPR.HATCHLING, Math.round(nx - SPR.HATCHLING.width / 2 - 9), by);
      if (t < 0.6 && Math.floor(time * 8) % 2) drawText(ctx, '!', nx - 4, by - 6, '#fff3a8', 1);
    } else if (run.evo >= run.evoNeed) {
      const hatching = (STATE === 'island' && ui.phase === 'mutate');
      const wob = hatching ? Math.round(Math.sin(time * 16)) : 0;
      const es = (hatching && Math.floor(time * 3) % 2) ? SPR.EGG_CRACK : SPR.EGG;
      ctx.drawImage(es, Math.round(nx - 2 + wob), Math.round(isl.perchY - 7));
    }
    // undergrowth foliage around the clearing
    ctx.drawImage(SPR.FERN, ix - isl.halfW + 3, topY - 2);
    ctx.drawImage(SPR.BUSH, ix + isl.halfW - 14, SEA_Y - 9);
    ctx.drawImage(SPR.MUSHROOM, ix - isl.halfW + 12, SEA_Y - 8);
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
    if (!bird.dead && (Math.abs(bird.vy) > 200 || bird.boost > 0)) {
      const tdx = bird.boost > 0 ? 9 : bird.vy * 0.012;
      ctx.globalAlpha = bird.boost > 0 ? 0.3 : 0.18; SPR.drawBird(ctx, bird.x - tdx, bird.y - bird.vy * 0.02, bird.rot, cfg);
      if (bird.boost > 0) { ctx.globalAlpha = 0.16; SPR.drawBird(ctx, bird.x - tdx * 2, bird.y - bird.vy * 0.02, bird.rot, cfg); }
      ctx.globalAlpha = 1;
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
  // wooden Stardew-style sign panel: carved wood frame + dark inner board
  function drawPanel(x, y, w2, h2) {
    x = Math.round(x); y = Math.round(y); w2 = Math.round(w2); h2 = Math.round(h2);
    // wood frame body with plank grain
    ctx.fillStyle = '#5c3a1e'; ctx.fillRect(x, y, w2, h2);
    ctx.fillStyle = '#7c4f28'; ctx.fillRect(x + 1, y + 1, w2 - 2, h2 - 2);
    ctx.fillStyle = '#8f5e34'; ctx.fillRect(x + 1, y + 1, w2 - 2, 1); ctx.fillRect(x + 1, y + 1, 1, h2 - 2);
    ctx.fillStyle = '#3f2712'; ctx.fillRect(x + 1, y + h2 - 2, w2 - 2, 1); ctx.fillRect(x + w2 - 2, y + 1, 1, h2 - 2);
    ctx.fillStyle = '#6a4526';
    for (let gx = x + 4; gx < x + w2 - 3; gx += 7) ctx.fillRect(gx, y + 1, 1, h2 - 2);
    // dark inner board
    const b = 3;
    if (w2 > 2 * b + 2 && h2 > 2 * b + 2) {
      ctx.fillStyle = '#241611'; ctx.fillRect(x + b, y + b, w2 - 2 * b, h2 - 2 * b);
      ctx.fillStyle = '#31201a'; ctx.fillRect(x + b, y + b, w2 - 2 * b, 1);
      ctx.fillStyle = '#180f0a'; ctx.fillRect(x + b, y + h2 - b - 1, w2 - 2 * b, 1);
    }
    // corner nails
    if (w2 >= 20 && h2 >= 16) {
      const nn = [[x + 3, y + 3], [x + w2 - 5, y + 3], [x + 3, y + h2 - 5], [x + w2 - 5, y + h2 - 5]];
      for (const c of nn) { ctx.fillStyle = '#d8b878'; ctx.fillRect(c[0], c[1], 2, 2); ctx.fillStyle = '#8a6a2e'; ctx.fillRect(c[0] + 1, c[1] + 1, 1, 1); }
    }
  }

  function drawSpeech(x, y, lines, w2) {
    const h2 = lines.length * 8 + 6;
    drawPanel(x, y, w2, h2);
    for (let i = 0; i < lines.length; i++) drawText(ctx, lines[i], x + 4, y + 4 + i * 8, '#ffffff', 1);
    ctx.fillStyle = 'rgba(18,12,30,0.92)'; ctx.fillRect(x + 2, y + h2, 3, 2); ctx.fillRect(x, y + h2 + 2, 2, 2);
  }

  function drawHUD() {
    const st = stats();
    for (let i = 0; i < bird.maxHearts; i++) ctx.drawImage(i < bird.hearts ? SPR.HEART : SPR.HEART_EMPTY, 4 + i * 9, 4);
    if (bird.shieldUp) { ctx.fillStyle = '#a8e4f2'; ctx.fillRect(4 + bird.maxHearts * 9 + 2, 6, 3, 3); }
    // wing-energy (stamina) bar under the hearts — hidden until it switches on
    const en = clamp(bird.energy / (st.maxEnergy || 100), 0, 1);
    const ebx = 3, eby = 13, ebw = 36, showEnergy = unlocked('energy');
    if (showEnergy) {
      ctx.drawImage(SPR.FEATHER, ebx, eby - 1);
      ctx.fillStyle = 'rgba(20,12,28,0.8)'; ctx.fillRect(ebx + 5, eby, ebw + 2, 5);
      ctx.fillStyle = (en < 0.25 || bird.tired > 0) ? (Math.floor(time * 10) % 2 ? '#e0525c' : '#f2748f') : (en < 0.5 ? '#f6c945' : '#8fd66a');
      ctx.fillRect(ebx + 6, eby + 1, Math.round(ebw * en), 3);
    }
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
    drawTextShadow(ctx, 'DNA ' + (save.dna + (run.dnaEarned || 0)), W - 4, 18, '#3fc0b0', 1, 'right');
    drawTextShadow(ctx, 'GEN ' + (run.evolutions + 1), ebx + 3, showEnergy ? eby + 8 : eby, '#8fd6c8', 1);
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
    if (bird.latched) {
      const n = bird.latched.swipes;
      drawTextShadow(ctx, 'SWIPE! ' + n + '/5', W / 2, 30, Math.floor(time * 12) % 2 ? '#f6c945' : '#e0525c', 2, 'center');
      drawTextShadow(ctx, 'TAP FAST TO SHAKE IT OFF', W / 2, 48, '#ffffff', 1, 'center');
      const bw = 60, bx = W / 2 - bw / 2;
      ctx.fillStyle = 'rgba(20,12,28,0.8)'; ctx.fillRect(bx - 1, 54, bw + 2, 5);
      ctx.fillStyle = '#96f0e4'; ctx.fillRect(bx, 55, Math.round(bw * n / 5), 3);
    }
    if (bird.boost > 0) drawTextShadow(ctx, 'BOOST', bird.x - 22, bird.y - 2, '#a8e4f2', 1, 'right');
    // attack-skill button (X key / tap) with cooldown shade — only once combat is unlocked
    ui.atkRect = null;
    if (unlocked('combat')) {
      const sk = SKILLS[run.skillId] || SKILLS.peck;
      const abx = W - 27, aby = H - 27, abw = 23, abh = 23;
      drawPanel(abx, aby, abw, abh);
      ctx.drawImage(sk.icon, abx + 7, aby + 7);
      const cdk = sk.cd > 0 ? clamp(bird.atkCd / sk.cd, 0, 1) : 0;
      if (cdk > 0) { const hh2 = Math.round((abh - 4) * cdk); ctx.fillStyle = 'rgba(10,6,18,0.72)'; ctx.fillRect(abx + 2, aby + 2 + (abh - 4 - hh2), abw - 4, hh2); }
      else if (Math.floor(time * 4) % 2) {
        ctx.fillStyle = '#ffe27a';
        ctx.fillRect(abx, aby, abw, 1); ctx.fillRect(abx, aby + abh - 1, abw, 1); ctx.fillRect(abx, aby, 1, abh); ctx.fillRect(abx + abw - 1, aby, 1, abh);
      }
      drawTextShadow(ctx, 'X', abx - 6, aby + 8, '#c9b088', 1);
      ui.atkRect = { x: abx, y: aby, w: abw, h: abh };
    }
    // active diet passives as tiny badges by the energy bar
    let pxi = 0;
    for (const k in PASSIVES) if (run.passives[k]) { ctx.drawImage(PASSIVES[k].icon, 48 + pxi * 9, 11); pxi++; }
    if (run.kills > 0) drawTextShadow(ctx, 'KO ' + run.kills, W - 4, 25, '#ff9f4d', 1, 'right');
    // boss stamina bar
    if (world.isBoss && world.boss && world.boss.state !== 'defeated') {
      const B = world.boss, bw = 96, bx = W / 2 - bw / 2, by = 20;
      drawTextShadow(ctx, BOSS_NAMES[B.kind] || 'BOSS', W / 2, by - 8, '#e0b24a', 1, 'center');
      ctx.drawImage(SPR.FEATHER, bx - 8, by - 1);
      ctx.fillStyle = 'rgba(20,12,28,0.85)'; ctx.fillRect(bx - 1, by, bw + 2, 6);
      const t = clamp(B.hp / B.maxHp, 0, 1);
      ctx.fillStyle = t > 0.5 ? '#e0525c' : (t > 0.25 ? '#f6c945' : '#96f0e4');
      ctx.fillRect(bx, by + 1, Math.round(bw * t), 4);
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
      const rc = (c.rarity && RARITY[c.rarity]) ? RARITY[c.rarity].col : '#f6c945';
      ui.cardRects.push({ x: cx, y: cy, w: cw, h: ch });
      drawPanel(cx, cy, cw, ch);
      // rarity accent strip along the card top
      if (c.kind === 'mut' || c.kind === 'skill') { ctx.fillStyle = rc; ctx.fillRect(cx + 1, cy + 1, cw - 2, 2); }
      if (sel) {
        const bc = c.kind === 'mut' ? rc : '#f6c945';
        ctx.fillStyle = bc;
        ctx.fillRect(cx + 1, cy, cw - 2, 1); ctx.fillRect(cx + 1, cy + ch - 1, cw - 2, 1);
        ctx.fillRect(cx, cy + 1, 1, ch - 2); ctx.fillRect(cx + cw - 1, cy + 1, 1, ch - 2);
        const bob = Math.floor(time * 4) % 2; drawText(ctx, '*', cx + cw / 2 - 1, cy - 9 - bob, bc, 1);
      }
      const icon = c.icon, isc = 2, iy = cy + 9 + Math.max(0, Math.round((26 - icon.height * isc) / 2));
      ctx.drawImage(icon, Math.round(cx + cw / 2 - icon.width * isc / 2), iy, icon.width * isc, icon.height * isc);
      const tl = wrap(c.title, 12); let ty = cy + 40;
      for (const line of tl) { drawTextShadow(ctx, line, cx + cw / 2, ty, sel ? rc : '#ffffff', 1, 'center'); ty += 7; }
      ty += 2;
      for (const line of c.lines) { drawText(ctx, line, cx + cw / 2, ty, '#c9d2e0', 1, 'center'); ty += 7; }
      if ((c.kind === 'mut' || c.kind === 'skill') && c.rarity) drawTextShadow(ctx, RARITY[c.rarity].label, cx + cw / 2, cy + ch - 9, rc, 1, 'center');
      if (c.kind === 'path') { const n = c.danger, sx0 = cx + cw / 2 - (n * 7 - 2) / 2; for (let s = 0; s < n; s++) ctx.drawImage(SPR.SKULL, Math.round(sx0 + s * 7), cy + ch - 10); }
    }
    let hy = y0 + ch + 9;
    ui.rerollRect = null;
    if (cards[0].kind === 'mut') {
      const afford = save.dna >= REROLL_COST;
      const bw = 96, bx = W / 2 - bw / 2, by = hy;
      drawPanel(bx, by, bw, 12);
      drawTextShadow(ctx, 'REROLL -' + REROLL_COST + ' DNA', W / 2, by + 3, afford ? '#3fc0b0' : '#6a5a6a', 1, 'center');
      ui.rerollRect = { x: bx, y: by, w: bw, h: 12 };
      hy += 16;
    }
    drawTextShadow(ctx, '< > CHOOSE   SPACE/TAP CONFIRM', W / 2, hy, '#8f86a8', 1, 'center');
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
    drawSpiders();
    drawDurians();
    drawFoods();
    drawChase();
    drawThermal();
    drawSlalom();
    drawTrail();
    drawFlutter();
    drawSnappers();
    drawLeapers();
    drawHornets();
    drawSea();
    drawStorm();
    drawPets();
    drawBirdFull();
    drawHawk();
    drawFalcon();
    drawWasps();
    drawBat();
    drawDragonfly();
    drawVulture();
    drawShieldbugs();
    if (world.isBoss) drawBoss();
    drawShots();
    drawFx();
    drawEnemyHp();
    drawParts();
    ctx.restore();
    drawHUD();
    drawBanner();
    if (world.eventBanner && Math.floor(time * 6) % 2) drawTextShadow(ctx, world.eventBanner.text, W / 2, 58, '#fff3a8', 1, 'center');
    if (!cine && run.darwin) drawDarwin();
    if (!cine) drawTip();
    if (cine) drawCineTitle();
    if (world.fade > 0) { ctx.fillStyle = 'rgba(10,6,18,' + clamp(world.fade, 0, 1).toFixed(2) + ')'; ctx.fillRect(0, 0, W, H); }
  }

  function renderIsland() {
    ctx.save();
    drawBackground(world.dist + time * 4);
    if (world.island) drawIsland(world.island); else drawIsland({ x: ISLAND_REST, seed: 7, halfW: 46, capY: 104, baseY: SEA_Y, nestDX: 8, treeDX: -16, perchY: 94, biome: world.biome });
    drawSea();
    drawPets();
    drawBirdFull();
    drawParts();
    ctx.restore();
    drawHUD();
    if (ui.phase === 'summary') {
      drawJourneyMap(4); // the run map so far
      drawPanel(20, 40, 130, 96);
      drawTextShadow(ctx, 'THE NEST', 85, 46, '#f6c945', 1, 'center');
      drawText(ctx, 'DEPTH ' + run.depth + ' - GEN ' + (run.evolutions + 1), 85, 56, '#ffffff', 1, 'center');
      let yy = 68; const keys = ['berry', 'seed', 'nut', 'bug', 'gold']; let any = false;
      for (const k of keys) {
        if (!world.legDiet[k]) continue; any = true;
        const spr = FOODS[k].spr; ctx.drawImage(spr, 34, yy - 2);
        drawText(ctx, 'X' + world.legDiet[k] + ' ' + FOODS[k].name, 46, yy, '#c9d2e0', 1); yy += 10;
      }
      if (!any) { drawText(ctx, 'NOTHING EATEN...', 85, yy, '#8f86a8', 1, 'center'); yy += 10; }
      yy = Math.max(yy + 4, 112);
      if (run.evo >= run.evoNeed) drawTextShadow(ctx, 'A NEW GENERATION STIRS!', 85, yy, '#3fc0b0', 1, 'center');
      else drawText(ctx, 'HATCH ' + Math.round(run.evo) + '/' + run.evoNeed, 85, yy, '#3fc0b0', 1, 'center');
      if (Math.floor(time * 2) % 2) drawText(ctx, 'SPACE/TAP TO CONTINUE', 85, 126, '#8f86a8', 1, 'center');
    } else if (ui.phase === 'mutate') drawCards('HATCH A NEW GENERATION');
    else if (ui.phase === 'hatching') {
      drawTextShadow(ctx, 'GENERATION ' + (run.evolutions + 1) + ' IS BORN!', W / 2, 30, Math.floor(time * 4) % 2 ? '#96f0e4' : '#3fc0b0', 1, 'center');
      if (ui.lastGain) drawTextShadow(ctx, 'INHERITS: ' + ui.lastGain, W / 2, 42, '#ffffff', 1, 'center');
    }
    else if (ui.phase === 'path') drawCards('CHOOSE YOUR MIGRATION');
    if (ui.flash > 0) { ctx.fillStyle = 'rgba(63,192,176,' + (ui.flash * 0.6).toFixed(2) + ')'; ctx.fillRect(0, 0, W, H); }
  }

  // small wooden plaque with a label + value (for DNA / BEST)
  function drawPlaque(x, y, w2, icon, label, col) {
    drawPanel(x, y, w2, 15);
    if (icon) ctx.drawImage(icon, x + 4, y + 4);
    drawTextShadow(ctx, label, x + w2 - 4, y + 5, col, 1, 'right');
  }

  // ---------- Slay-the-Spire-style run map ----------
  // renders the migration so far as a ribbon of wooden nodes with biome icons;
  // the current leg glows and the fork ahead shows a "?" or a boss skull.
  function drawJourneyMap(y) {
    if (!run || !run.journey || !run.journey.length) return;
    drawTextShadow(ctx, 'YOUR JOURNEY', W / 2, y, '#c9b088', 1, 'center');
    const bossNext = run.depth > 0 && run.depth % 4 === 0;
    const list = run.journey.slice(); list.push({ type: bossNext ? 'bossNext' : 'next' });
    const maxN = 6, show = list.slice(Math.max(0, list.length - maxN));
    const n = show.length, gap = Math.min(48, (W - 44) / Math.max(1, n - 1));
    const totalW = (n - 1) * gap, x0 = Math.round(W / 2 - totalW / 2), ny = y + 9, cy = ny + 9;
    ctx.fillStyle = '#8f5e34';
    for (let i = 0; i < n - 1; i++) { for (let px = x0 + i * gap + 11; px < x0 + (i + 1) * gap - 11; px += 4) ctx.fillRect(px, cy - 1, 2, 2); }
    for (let i = 0; i < n; i++) {
      const nd = show[i], cx = Math.round(x0 + i * gap), isCurrent = (i === n - 2);
      if (isCurrent) { ctx.fillStyle = Math.floor(time * 6) % 2 ? '#f6c945' : '#ffd257'; ctx.fillRect(cx - 11, ny - 1, 22, 22); }
      drawPanel(cx - 10, ny, 20, 20);
      if (nd.type === 'next' || nd.type === 'bossNext') {
        if (nd.type === 'bossNext') ctx.drawImage(SPR.SKULL, cx - Math.round(SPR.SKULL.width / 2), cy - Math.round(SPR.SKULL.height / 2));
        else drawTextShadow(ctx, '?', cx, cy - 3, Math.floor(time * 4) % 2 ? '#f6c945' : '#c9b088', 1, 'center');
      } else {
        const icon = nd.type === 'start' ? SPR.NEST : ((BIOMES[nd.key] && BIOMES[nd.key].icon) || SPR.ICON_MEADOW);
        ctx.drawImage(icon, cx - Math.round(icon.width / 2), cy - Math.round(icon.height / 2));
      }
    }
  }

  // ---------- interactive title scene: distant gulls + fluttering butterflies ----------
  let titleBirds = [], titleFlies = [];
  function updateTitleScene(dt) {
    if (titleBirds.length < 3 && Math.random() < 0.012) titleBirds.push({ x: W + 10, y: rnd(16, 58), sp: rnd(16, 30), flap: rnd(0, 6.28) });
    for (let i = titleBirds.length - 1; i >= 0; i--) { const b = titleBirds[i]; b.x -= b.sp * dt; b.flap += dt * 8; if (b.x < -12) titleBirds.splice(i, 1); }
    if (!titleFlies.length) for (let i = 0; i < 3; i++) titleFlies.push({ cx: rnd(30, 70), cy: rnd(64, 92), r: rnd(6, 14), a: rnd(0, 6.28), sp: rnd(1.2, 2.2), ph: rnd(0, 6.28) });
    for (const f of titleFlies) f.a += dt * f.sp;
  }
  function drawTitleBirds() {
    ctx.fillStyle = 'rgba(38,28,48,0.55)';
    for (const b of titleBirds) {
      const x = Math.round(b.x), y = Math.round(b.y), up = Math.sin(b.flap) > 0;
      const d = up ? -1 : 1;
      ctx.fillRect(x - 3, y + d, 2, 1); ctx.fillRect(x - 1, y, 3, 1); ctx.fillRect(x + 2, y + d, 2, 1);
    }
  }
  function drawTitleFlies() {
    for (const f of titleFlies) {
      const x = Math.round(f.cx + Math.cos(f.a) * f.r), yy = Math.round(f.cy + Math.sin(f.a * 1.3) * f.r * 0.6);
      const spr = Math.floor(time * 10 + f.ph) % 2 ? SPR.BFLY1 : SPR.BFLY2;
      ctx.drawImage(spr, x - Math.round(spr.width / 2), yy - Math.round(spr.height / 2));
    }
  }

  // ---------- settings screen ----------
  function renderSettings() {
    drawBackground(time * 10);
    drawSea();
    ctx.fillStyle = 'rgba(10,6,18,0.55)'; ctx.fillRect(0, 0, W, H);
    drawPanel(W / 2 - 90, 12, 180, 20);
    drawTextShadow(ctx, 'SETTINGS', W / 2, 18, '#f6c945', 2, 'center');
    ctx.drawImage(SPR.GEAR, W / 2 - 90 + 6, 15);
    const items = settingsItems();
    ui.setRects = [];
    const rw = 200, rx = W / 2 - rw / 2, y0 = 42, rh = 18;
    for (let i = 0; i < items.length; i++) {
      const it = items[i], sel = (ui.menuSel || 0) === i, ry = y0 + i * (rh + 3);
      ui.setRects.push({ x: rx, y: ry, w: rw, h: rh });
      drawPanel(rx, ry, rw, rh);
      if (sel) {
        ctx.fillStyle = Math.floor(time * 6) % 2 ? '#f6c945' : '#ffd257';
        ctx.fillRect(rx, ry, rw, 1); ctx.fillRect(rx, ry + rh - 1, rw, 1); ctx.fillRect(rx, ry, 1, rh); ctx.fillRect(rx + rw - 1, ry, 1, rh);
      }
      const lcol = it.action ? (it.key === 'reset' ? '#e0525c' : '#f6c945') : '#e5c28c';
      drawTextShadow(ctx, it.label, rx + 8, ry + 6, sel ? '#ffffff' : lcol, 1);
      if (it.val) {
        const on = it.val === 'ON', off = it.val === 'OFF';
        const vc = on ? '#8fd66a' : (off ? '#8f6a6a' : (sel ? '#ffe27a' : '#c9d2e0'));
        if (!it.action) drawTextShadow(ctx, '< ' + it.val + ' >', rx + rw - 8, ry + 6, vc, 1, 'right');
        else drawTextShadow(ctx, it.val, rx + rw - 8, ry + 6, '#e0525c', 1, 'right');
      }
    }
    drawTextShadow(ctx, 'ARROWS MOVE   < > CHANGE   ESC BACK', W / 2, H - 8, '#8f7a5a', 1, 'center');
    if (ui.resetFlash > 0) { ctx.fillStyle = 'rgba(224,82,92,' + (ui.resetFlash * 0.5).toFixed(2) + ')'; ctx.fillRect(0, 0, W, H); }
  }

  // ---------- opening cutscene: the hatch ----------
  const INTRO = { fadein: 0.9, wobble: 1.6, crack: 2.5, hatch: 3.1, d1: 3.6, d2: 5.0, lift: 6.2, end: 7.6 };
  function startIntro() { STATE = 'intro'; ui = { t: 0, hatched: false, burst: 0 }; }
  function skipIntro() { STATE = 'fly'; if (world) world.banner = 2.4; }
  function updateIntro(dt) {
    ui.t += dt;
    const t = ui.t;
    if (!ui.hatched && t >= INTRO.hatch) {
      ui.hatched = true; ui.burst = 0.5; AUDIO.play('chirp'); AUDIO.play('flare'); shakeIt(2.5, 0.3);
      spawnParts(22, function () { return sparkle(W / 2 + rnd(-14, 14), 100 + rnd(-10, 10), pick(['#fff3a8', '#ffe27a', '#96f0e4'])); });
      spawnParts(12, function () { return crumb(W / 2 + rnd(-6, 6), 104, pick(['#fbe7bb', '#e5c28c', '#ffffff'])); });
    }
    if (t >= INTRO.lift && t < INTRO.lift + dt * 2) { AUDIO.play('flap'); spawnParts(6, function () { return feather(W / 2, 104); }); }
    if (ui.burst > 0) ui.burst -= dt;
    if (t >= INTRO.end) skipIntro();
  }
  function renderIntro() {
    const t = ui.t, cx = W / 2, groundY = 128;
    drawBackground(0); drawSea();
    const dim = clamp(0.5 - t * 0.05, 0.1, 0.5);
    ctx.fillStyle = 'rgba(10,8,20,' + dim.toFixed(2) + ')'; ctx.fillRect(0, 0, W, H);
    // shaft of dawn light onto the nest
    ctx.save(); ctx.globalAlpha = 0.16 + 0.04 * Math.sin(t * 2); ctx.fillStyle = '#fff3c0';
    ctx.beginPath(); ctx.moveTo(cx - 10, 0); ctx.lineTo(cx + 10, 0); ctx.lineTo(cx + 34, groundY); ctx.lineTo(cx - 34, groundY); ctx.closePath(); ctx.fill(); ctx.restore();
    // branch + nest (scaled up for a cinematic close-up)
    ctx.fillStyle = '#5a3a1e'; ctx.fillRect(cx - 62, groundY + 8, 124, 6);
    ctx.fillStyle = '#7c4f28'; ctx.fillRect(cx - 62, groundY + 8, 124, 2);
    const nestS = 3, nw = SPR.NEST.width * nestS, nh = SPR.NEST.height * nestS;
    ctx.drawImage(SPR.NEST, Math.round(cx - nw / 2), Math.round(groundY + 10 - nh), nw, nh);
    if (!ui.hatched) {
      const wob = (t > INTRO.wobble) ? Math.round(Math.sin(t * 22) * (t > INTRO.crack ? 2 : 1)) : 0;
      const es = (t > INTRO.crack && Math.floor(t * 6) % 2) ? SPR.EGG_CRACK : SPR.EGG;
      const s = 3.4, ew = es.width * s, eh = es.height * s;
      ctx.drawImage(es, Math.round(cx - ew / 2 + wob), Math.round(groundY - eh + 8), Math.round(ew), Math.round(eh));
    } else {
      const s = 3, hw = SPR.HATCHLING.width * s, hh = SPR.HATCHLING.height * s;
      let hy = groundY - hh + 8 + Math.round(Math.sin(t * 8) * 2);
      if (t > INTRO.lift) { const k = clamp((t - INTRO.lift) / (INTRO.end - INTRO.lift), 0, 1); hy -= Math.round(easeOutCubic(k) * 130); }
      ctx.drawImage(SPR.HATCHLING, Math.round(cx - hw / 2), Math.round(hy), hw, hh);
    }
    drawParts();
    if (ui.burst > 0) { ctx.fillStyle = 'rgba(255,243,200,' + clamp(ui.burst, 0, 1).toFixed(2) + ')'; ctx.fillRect(0, 0, W, H); }
    // Darwin's welcome, in beats
    if (t >= INTRO.d1 && t < INTRO.lift) {
      const lines = t < INTRO.d2 ? ['A NEW FINCH', 'IS BORN...'] : ['EAT, EVOLVE,', 'AND SURVIVE!'];
      ctx.drawImage(SPR.DARWIN, 6, H - 46);
      drawSpeech(28, H - 47, lines, 96);
    }
    // title card + fades
    FONT.drawTextOutline(ctx, 'FLAPPY DARWIN', cx, 12, '#f6c945', 1, 'center');
    if (t < INTRO.fadein) { ctx.fillStyle = 'rgba(6,5,12,' + (1 - t / INTRO.fadein).toFixed(2) + ')'; ctx.fillRect(0, 0, W, H); }
    if (t > INTRO.end - 0.5) { ctx.fillStyle = 'rgba(6,5,12,' + clamp((t - (INTRO.end - 0.5)) * 2, 0, 1).toFixed(2) + ')'; ctx.fillRect(0, 0, W, H); }
    if (Math.floor(t * 2) % 2) drawText(ctx, 'TAP TO SKIP', cx, H - 7, '#c9b088', 1, 'center');
  }

  function renderTitle() {
    drawBackground(time * 12);
    drawSea();
    drawTitleBirds(); // distant flapping gulls
    // atmospheric dim + drifting embers for a Slay-the-Spire mood
    ctx.fillStyle = 'rgba(12,8,20,0.32)'; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(255,196,110,0.5)';
    for (let i = 0; i < 14; i++) { const ex = (i * 53 + time * (8 + i % 5)) % W; const ey = (H - 20 - ((time * (10 + i % 4) + i * 40) % (H - 30))); ctx.fillRect(Math.round(ex), Math.round(ey), 1, 1); }

    // title banner (wooden sign) + logo
    drawPanel(W / 2 - 78, 8, 156, 44);
    const ly = 13 + Math.round(Math.sin(time * 1.2) * 1);
    FONT.drawTextOutline(ctx, 'FLAPPY', W / 2, ly, '#f6c945', 3, 'center');
    FONT.drawTextOutline(ctx, 'DARWIN', W / 2, ly + 18, '#3fc0b0', 3, 'center');
    drawText(ctx, 'EAT. DIGEST. EVOLVE.', W / 2, ly + 35, '#c9b088', 1, 'center');

    // a perched evolved "hero" bird beside the sign, with fluttering butterflies
    const dby = 70 + Math.sin(time * 1.6) * 3;
    drawTitleFlies();
    SPR.drawBird(ctx, 46, dby, Math.sin(time * 1.6 + 1) * 0.08, {
      frame: bird && bird.flapT > 0 ? Math.floor(time * 12) % 3 : 1, open: false, bigWings: true, bigTail: true, crest: 3,
      legsDown: true, blink: Math.sin(time * 0.7) > 0.97, time: time, sx: 1, sy: 1,
    });
    if (Math.random() < 0.04) parts.push(feather(40, dby + 4));
    drawParts();

    // menu as vertical wooden cards (compact to fit 4 items)
    const items = menuItems(); ui.menuRects = [];
    const cw = 116, mx = W / 2 - cw / 2, my0 = 62, sp = 18, ch = 16;
    for (let i = 0; i < items.length; i++) {
      const sel = (ui.menuSel || 0) === i, yy = my0 + i * sp + (sel ? -1 : 0);
      ui.menuRects.push({ x: mx, y: my0 + i * sp, w: cw, h: ch });
      drawPanel(mx, yy, cw, ch);
      if (sel) {
        ctx.fillStyle = Math.floor(time * 6) % 2 ? '#f6c945' : '#ffd257';
        ctx.fillRect(mx, yy, cw, 1); ctx.fillRect(mx, yy + ch - 1, cw, 1); ctx.fillRect(mx, yy, 1, ch); ctx.fillRect(mx + cw - 1, yy, 1, ch);
        drawText(ctx, '>', mx + 7, yy + 6, '#ffd257', 1); drawText(ctx, '<', mx + cw - 11, yy + 6, '#ffd257', 1);
      }
      drawTextShadow(ctx, items[i], W / 2, yy + 5, sel ? '#ffe27a' : '#b79666', 1, 'center');
    }

    // Darwin welcome sign
    ctx.drawImage(SPR.DARWIN, 4, H - 40);
    drawSpeech(24, H - 42, ["I'M DARWIN.", 'PICK TUTORIAL', 'IF NEW HERE!'], 74);
    // stat plaques
    drawPlaque(W - 74, H - 44, 70, SPR.DNA, 'DNA ' + save.dna, '#8fd6c8');
    drawPlaque(W - 74, H - 27, 70, SPR.SKULL, best.score > 0 ? (best.score + ' D' + best.depth) : 'NO RUNS', '#f6c945');
    drawText(ctx, 'ARROWS + ENTER / TAP', W / 2, H - 5, '#8f7a5a', 1, 'center');
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
    drawText(ctx, 'DEPTH ' + run.depth + '   FOOD ' + run.foodEaten + '   PASSED ' + run.obstaclesPassed, W / 2, py + 62, '#c9d2e0', 1, 'center');
    drawTextShadow(ctx, 'GEN ' + (run.evolutions + 1) + '   DNA BANKED: ' + save.dna, W / 2, py + 72, '#3fc0b0', 1, 'center');
    // evolved traits
    if (run.taken.length === 0) drawText(ctx, 'NO TRAITS - A HUMBLE FINCH', W / 2, py + 84, '#8f86a8', 1, 'center');
    else {
      const names = run.taken.map(function (id) { const m = MUTATIONS.filter(function (x) { return x.id === id; })[0]; return m ? m.name : id; });
      let line = names.slice(0, 3).join(' - ');
      if (names.length > 3) line += ' +' + (names.length - 3);
      drawText(ctx, line, W / 2, py + 84, '#ffffff', 1, 'center');
    }
    // options
    ui.overRects = [];
    if (ui.overT > 0.7) {
      const opts = ui.options || ['new'];
      const labels = { hatch: 'HATCH FROM NEST  -' + hatchCost() + ' DNA', new: 'NEW LINEAGE' };
      const oy = py + 100;
      for (let i = 0; i < opts.length; i++) {
        const bw = opts.length > 1 ? 176 : 130, bx = W / 2 - bw / 2, byy = oy + i * 15, sel = (ui.sel || 0) === i;
        ui.overRects.push({ x: bx, y: byy, w: bw, h: 13 });
        if (sel) drawPanel(bx, byy, bw, 13);
        const col = (opts[i] === 'hatch') ? '#3fc0b0' : '#f6c945';
        drawTextShadow(ctx, (sel ? '> ' : '') + labels[opts[i]] + (sel ? ' <' : ''), W / 2, byy + 4, sel ? col : '#c9d2e0', 1, 'center');
      }
    }
  }

  function render() {
    ctx.imageSmoothingEnabled = false;
    ctx.save();
    if (shake.t > 0) ctx.translate(Math.round(rnd(-shake.mag, shake.mag)), Math.round(rnd(-shake.mag, shake.mag)));
    if (STATE === 'title') renderTitle();
    else if (STATE === 'intro') renderIntro();
    else if (STATE === 'settings') renderSettings();
    else if (STATE === 'fly') renderFly();
    else if (STATE === 'island') renderIsland();
    else if (STATE === 'over') renderOver();
    ctx.restore();
    ctx.drawImage(VIGNETTE, 0, 0);
    if (flashT > 0) { ctx.fillStyle = 'rgba(224,82,92,' + clamp(flashT * 1.4, 0, 0.6).toFixed(2) + ')'; ctx.fillRect(0, 0, W, H); }
    if (paused) {
      ctx.fillStyle = 'rgba(10,6,18,0.7)'; ctx.fillRect(0, 0, W, H);
      drawTextShadow(ctx, 'PAUSED', W / 2, 74, '#ffffff', 2, 'center');
      drawText(ctx, 'P TO RESUME', W / 2, 92, '#8f86a8', 1, 'center');
      if (run && run.journey) drawJourneyMap(112);
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
    depthJump: function (n, k) { if (run) { run.depth = (n || 1) - 1; newLeg(k || (world ? world.biomeKey : 'meadow')); } },
    unlocked: function (f) { return unlocked(f); },
    state: function () { return STATE; },
    tip: function () { return run && run.tip ? run.tip.lines.join(' ') : null; },
    seenTips: function () { return run ? Object.keys(run.seenTips) : []; },
    introT: function () { return STATE === 'intro' ? ui.t : -1; },
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
        cand.snake = { state: 'windup', t: 0, wu: 0.75, lockY: clamp(bird.y, topH + 2, botY - 2), spent: false, first: false, hp: 3, maxhp: 3 };
        AUDIO.play('snakeHiss');
      }
    },
    forceHawk: function () { if (world && !world.hawk) { world.hawk = { state: 'warn', t: 0, lockY: bird.y, first: false, hp: 3, maxhp: 3 }; AUDIO.play('hawkScreech'); } },
    forceSnapper: function () { if (world) world.snappers.push({ worldX: world.dist + bird.x + 60, state: 'lurk', t: 0, bob: 0, first: false, hp: 4, maxhp: 4 }); },
    noInvuln: function () { if (bird) bird.invuln = 0; },
    dbg: function () { return Object.assign({}, DBG); },
    dbgReset: function () { DBG.graze = 0; DBG.hurtTree = 0; DBG.hurtWater = 0; DBG.hurtPred = 0; },
    energy: function () { return bird ? Math.round(bird.energy) : 0; },
    dna: function () { return save.dna + (run ? (run.dnaEarned || 0) : 0); },
    giveDna: function (n) { save.dna += n; persist(); },
    kill: function () { if (bird && !bird.dead) { bird.hearts = 0; bird.dead = true; bird.deathBy = 'tree'; gameOver(); } },
    forceChase: function () { if (world) world.chaseBug = { x: bird.x + 44, y: bird.y, t: 0, life: 6, phase: 0 }; },
    forceFalcon: function () { if (world) world.falcon = { state: 'chase', t: 0, x: bird.x - 34, y: bird.y, snapCd: 0, first: false, hp: 4, maxhp: 4 }; },
    forceThermal: function () { if (world) { world.thermal = { x: bird.x + 60, y: bird.y, t: 0, passed: false }; world.eventBanner = { text: 'THERMAL RING', t: 0 }; } },
    forceRush: function () { if (world) startRush(); },
    forceWasps: function () { if (world) startWasps(); },
    forceSlalom: function () { if (world) startSlalom(); },
    forceTrail: function () { if (world) startTrail(); },
    forceStorm: function () { if (world) startStorm(); },
    forceFlutter: function () { if (world) startFlutter(); },
    forceBat: function () { if (world) { world.bat = { state: 'dive', t: 0, x: W - 20, y: bird.y - 20, first: false, hp: 2, maxhp: 2 }; } },
    forceDragonfly: function () { if (world) { world.dfly = { state: 'hover', t: 0, x: W + 6, y: clamp(bird.y, 24, SEA_Y - 20), first: false, hp: 2, maxhp: 2 }; } },
    forceVulture: function () { if (world) { world.vulture = { state: 'circle', t: 0, cx: W - 44, cy: 24, x: W - 44, y: 24, ang: 0, lockY: bird.y, first: false, hp: 3, maxhp: 3 }; } },
    forceLeaper: function (kind) { if (!world) return 'no world'; const k = kind || 'bfrog'; if (k === 'jelly') world.leapers.push({ kind: 'jelly', worldX: world.dist + bird.x + 40, y: SEA_Y - 8, state: 'rise', t: 0, bob: 0, first: false, hp: 2, maxhp: 2 }); else world.leapers.push({ kind: k, worldX: world.dist + bird.x + 34, state: 'telegraph', t: 0, bob: 0, first: false, hp: 2, maxhp: 2 }); return 'ok'; },
    forceSpider: function () { if (!world) return 'no world'; for (const o of world.obstacles) { const sx = o.x - world.dist; if (sx > bird.x + 20 && sx < W) { o.spider = { state: 'drop', t: 0, targetY: bird.y, y: o.gapY - o.gapH / 2, hp: 1, maxhp: 1 }; return 'ok'; } } return 'none'; },
    forceBoss: function (key) { if (run) { run.depth--; newLeg(key && BIOMES[key] && BIOMES[key].boss ? key : 'aerie'); } },
    bossHp: function () { return (world && world.boss) ? world.boss.hp : -1; },
    bossKind: function () { return (world && world.boss) ? world.boss.kind : null; },
    setSkill: function (id) { if (run && SKILLS[id]) run.skillId = id; },
    attack: function () { attackQueued = true; },
    atkCd: function () { return bird ? bird.atkCd : -1; },
    targets: function () { return enemyTargets().map(function (t) { return { kind: t.kind, hp: t.o.hp, x: Math.round(t.x), y: Math.round(t.y) }; }); },
    kills: function () { return run ? run.kills : 0; },
    givePet: function (k) { if (run) { run.pets.push({ kind: k || 'chick', x: bird.x - 14, y: bird.y, t: 0, cd: 2 }); } },
    pets: function () { return run ? run.pets.map(function (p) { return p.kind; }) : []; },
    passives: function () { return run ? Object.assign({}, run.passives) : {}; },
    eat: function (bucket, n) { if (!run) return; for (let i = 0; i < (n || 1); i++) { run.diet[bucket]++; checkPassives(bucket); } },
    forceSbug: function () { if (world) world.sbugs.push({ worldX: world.dist + bird.x + 60, y: bird.y, ph: 0, hp: 6, maxhp: 6, first: false }); },
    forceHnest: function () { if (!world) return 'none'; for (const o of world.obstacles) { const sx = o.x - world.dist; if (sx > bird.x + 20 && sx < W) { o.hnest = { hp: 4, maxhp: 4, cd: 0.2, dead: false, first: false }; return 'ok'; } } return 'none'; },
    skillId: function () { return run ? run.skillId : null; },
    forceLatch: function () {
      if (!world) return 'no world';
      for (const o of world.obstacles) { if (o.snake && o.snake.state !== 'spent') { startLatch(o, o.snake); return 'ok'; } }
      for (const o of world.obstacles) { const sx = o.x - world.dist; if (sx > bird.x - 10 && sx < W) { o.snake = { state: 'strike', t: 0, ax: sx + o.w * 0.7, topH: o.gapY - o.gapH / 2, botY: o.gapY + o.gapH / 2, restY: o.gapY - o.gapH / 2 + 4, hp: 3, maxhp: 3 }; startLatch(o, o.snake); return 'made'; } }
      return 'none';
    },
    latched: function () { return bird && bird.latched ? bird.latched.swipes : -1; },
    refill: function () { if (bird) bird.energy = 999; },
    forceDurian: function () { if (!world) return; for (const o of world.obstacles) { const sx = o.x - world.dist; if (sx > bird.x + 16 && sx < bird.x + 90) { o.durian = { state: 'wobble', t: 0, wob: 0.7, vy: 0, worldX: o.x + o.w / 2, y: (o.gapY - o.gapH / 2) + 5, first: false, hp: 1, maxhp: 1 }; return 'ok'; } } return 'none'; },
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
  gotoTitle();

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
