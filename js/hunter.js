// Canopy Rangers — an Amazon wildlife-hunter take on the Dave the Diver loop.
// DAY: climb the rainforest, swing on vines & grapple, tranquilize animals and
// carry them back to the truck. NIGHT: run your wildlife sanctuary — feed, play,
// welcome visitors, earn money. Spend it on gear & enclosures. Repeat.
// Pure vanilla JS + canvas. Sprites drawn procedurally; SFX synthesized (audio.js).
(function () {
  'use strict';

  const W = 320, H = 180;
  const cv = document.getElementById('game');
  const ctx = cv.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  const drawText = FONT.drawText, drawTextShadow = FONT.drawTextShadow, drawTextOutline = FONT.drawTextOutline, textW = FONT.textWidth;
  const A = window.AUDIO;

  // ---------------- display scaling ----------------
  let scale = 1, rect = null;
  const isTouchDevice = ('ontouchstart' in window) || (navigator.maxTouchPoints || 0) > 0;
  function fit() {
    const s = Math.min(window.innerWidth / W, window.innerHeight / H);
    // crisp integer scaling on desktop; on touch/small screens fill as much as possible
    scale = (isTouchDevice || s < 1) ? s : Math.floor(s);
    cv.style.width = (W * scale) + 'px';
    cv.style.height = (H * scale) + 'px';
    rect = cv.getBoundingClientRect();
  }
  window.addEventListener('resize', fit);
  window.addEventListener('orientationchange', function () { setTimeout(fit, 80); });
  fit();
  window.addEventListener('scroll', function () { rect = cv.getBoundingClientRect(); }, true);

  // ---------------- math helpers ----------------
  const clamp = (v, a, b) => v < a ? a : (v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = t => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
  const easeOut = t => { t = clamp(t, 0, 1); return 1 - Math.pow(1 - t, 3); };
  const easeInOut = t => { t = clamp(t, 0, 1); return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
  const rnd = (a, b) => a + Math.random() * (b - a);
  const irnd = (a, b) => Math.floor(rnd(a, b + 1));
  const pick = arr => arr[Math.floor(Math.random() * arr.length)];
  const dist2 = (ax, ay, bx, by) => { const dx = ax - bx, dy = ay - by; return dx * dx + dy * dy; };
  function hexToRgb(h) { return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]; }
  function mix(h1, h2, t) { const a = hexToRgb(h1), b = hexToRgb(h2); let o = '#'; for (let i = 0; i < 3; i++) o += ('0' + Math.round(lerp(a[i], b[i], t)).toString(16)).slice(-2); return o; }
  function pickWeighted(entries) { let tot = 0; for (const e of entries) tot += e.w; let r = Math.random() * tot; for (const e of entries) { r -= e.w; if (r <= 0) return e.v; } return entries[entries.length - 1].v; }

  // ---------------- input ----------------
  const keys = {};
  const mouse = { x: W / 2, y: H / 2, down: false, rdown: false, clicked: false, rclicked: false };
  function mapMouse(e) {
    if (!rect) rect = cv.getBoundingClientRect();
    const cx = (e.touches ? e.touches[0].clientX : e.clientX);
    const cy = (e.touches ? e.touches[0].clientY : e.clientY);
    mouse.x = clamp((cx - rect.left) / (rect.width / W), 0, W);
    mouse.y = clamp((cy - rect.top) / (rect.height / H), 0, H);
  }
  window.addEventListener('keydown', e => {
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.code)) e.preventDefault();
    if (!keys[e.code]) keys[e.code + '_p'] = true; // edge
    keys[e.code] = true;
    A.unlock();
  });
  window.addEventListener('keyup', e => { keys[e.code] = false; });
  cv.addEventListener('mousemove', mapMouse);
  cv.addEventListener('mousedown', e => {
    mapMouse(e); A.unlock();
    if (e.button === 2) { mouse.rdown = true; mouse.rclicked = true; }
    else { mouse.down = true; mouse.clicked = true; }
  });
  window.addEventListener('mouseup', e => { if (e.button === 2) mouse.rdown = false; else mouse.down = false; });
  cv.addEventListener('contextmenu', e => e.preventDefault());

  // ---------------- multi-touch virtual gamepad ----------------
  let TOUCH = false;                       // becomes true once any touch happens
  const stick = { active: false, id: -1, ax: 0, ay: 0, x: 0, y: 0 };
  const tbtn = {};                         // held state per virtual button
  const tbtnEdge = {};                     // one-shot press
  const touchRole = new Map();             // touch id -> role ('stick' | 'aim' | 'tap' | button id)
  const vprev = {};                        // previous virtual key state (for edge)
  function toGame(clientX, clientY) {
    if (!rect) rect = cv.getBoundingClientRect();
    return { x: clamp((clientX - rect.left) / (rect.width / W), 0, W), y: clamp((clientY - rect.top) / (rect.height / H), 0, H) };
  }
  function padButtons() {
    return [
      { id: 'jump', x: W - 17, y: H - 16, r: 14, label: 'JUMP' },
      { id: 'hook', x: W - 17, y: H - 45, r: 12, label: 'HOOK' },
      { id: 'ammo', x: W - 45, y: H - 15, r: 11, label: 'AMMO' },
    ];
  }
  function expActive() { return phase === 'expedition' && !EXP.done && EXP.P && !EXP.P.dead && !EXP.extracting; }
  cv.addEventListener('touchstart', e => {
    e.preventDefault(); A.unlock(); TOUCH = true;
    for (const tch of e.changedTouches) {
      const g = toGame(tch.clientX, tch.clientY); let role = null;
      if (expActive()) {
        for (const b of padButtons()) { if (dist2(g.x, g.y, b.x, b.y) < (b.r + 3) * (b.r + 3)) { role = b.id; tbtn[b.id] = true; tbtnEdge[b.id] = true; break; } }
        if (!role) {
          if (g.x < W * 0.42 && g.y > 16 && !stick.active) { role = 'stick'; stick.active = true; stick.id = tch.identifier; stick.ax = g.x; stick.ay = g.y; stick.x = g.x; stick.y = g.y; }
          else if (g.x < W * 0.42 && g.y > 16) { role = 'idle'; }   // second finger in move zone: ignore
          else { role = 'aim'; mouse.x = g.x; mouse.y = g.y; mouse.clicked = true; }
        }
      } else { role = 'tap'; mouse.x = g.x; mouse.y = g.y; mouse.down = true; mouse.clicked = true; }
      touchRole.set(tch.identifier, role);
    }
  }, { passive: false });
  cv.addEventListener('touchmove', e => {
    e.preventDefault();
    for (const tch of e.changedTouches) {
      const role = touchRole.get(tch.identifier); const g = toGame(tch.clientX, tch.clientY);
      if (role === 'stick' && tch.identifier === stick.id) { stick.x = g.x; stick.y = g.y; }
      else if (role === 'aim' || role === 'tap') { mouse.x = g.x; mouse.y = g.y; }
    }
  }, { passive: false });
  function endTouch(e) {
    e.preventDefault();
    for (const tch of e.changedTouches) {
      const role = touchRole.get(tch.identifier); touchRole.delete(tch.identifier);
      if (role === 'stick') { if (tch.identifier === stick.id) stick.active = false; }
      else if (role && tbtn[role] !== undefined) tbtn[role] = false;
      else if (role === 'tap') mouse.down = false;
    }
  }
  cv.addEventListener('touchend', endTouch, { passive: false });
  cv.addEventListener('touchcancel', endTouch, { passive: false });

  function vset(code, on) { if (on && !vprev[code]) keys[code + '_p'] = true; keys[code] = on; vprev[code] = on; }
  function cycleAmmo() {
    const P = EXP.P; if (!P) return;
    const order = ['dart']; if (S.ammo.heavy > 0) order.push('heavy'); if (S.ammo.net > 0) order.push('net');
    let i = order.indexOf(P.ammoType); i = (i + 1) % order.length; P.ammoType = order[i]; A.play('select');
  }
  function applyTouch() {
    if (!TOUCH) return;
    const exp = expActive();
    let L = false, R = false, U = false, Dn = false;
    if (exp && stick.active) {
      const dx = stick.x - stick.ax, dy = stick.y - stick.ay, dead = 3;
      if (dx < -dead) L = true; if (dx > dead) R = true;
      if (dy < -dead) U = true; if (dy > dead * 1.5) Dn = true;
    }
    keys['ArrowLeft'] = L; keys['ArrowRight'] = R; keys['ArrowUp'] = U; keys['ArrowDown'] = Dn;
    vset('Space', exp && !!tbtn['jump']);
    vset('KeyF', exp && !!tbtn['hook']);
    if (exp && tbtnEdge['ammo']) cycleAmmo();
    tbtnEdge['ammo'] = false; tbtnEdge['jump'] = false; tbtnEdge['hook'] = false;
  }

  function keyPressed(code) { return !!keys[code + '_p']; }
  function clearEdges() {
    for (const k in keys) if (k.endsWith('_p')) keys[k] = false;
    mouse.clicked = false; mouse.rclicked = false;
  }

  // =====================================================================
  //  DATA
  // =====================================================================
  const ANIMALS = {
    parrot:   { name: 'MACAW',    layer: 'air',  r: 6,  tranq: 1, value: 28,  rarity: 'common', flies: true,  danger: 0,  col: ['#e8433a', '#f2b134', '#3b8ade'], move: 46 },
    monkey:   { name: 'MONKEY',   layer: 'low',  r: 6,  tranq: 2, value: 40,  rarity: 'common', danger: 1,  col: ['#7a4a2a', '#a9713f', '#f0d6a8'], move: 34, jumps: true },
    boar:     { name: 'BOAR',     layer: 'low',  r: 8,  tranq: 3, value: 55,  rarity: 'common', danger: 2,  col: ['#4a3324', '#6b4a33', '#2a1c14'], move: 22, charges: true },
    snake:    { name: 'SNAKE',    layer: 'mid',  r: 6,  tranq: 2, value: 60,  rarity: 'uncommon', danger: 2,  col: ['#3e7a2e', '#6fae3a', '#c7d94a'], move: 10, strikes: true },
    sloth:    { name: 'SLOTH',    layer: 'mid',  r: 7,  tranq: 1, value: 85,  rarity: 'uncommon', danger: 0,  col: ['#8a7a5a', '#b0a080', '#5a4a34'], move: 6 },
    toucan:   { name: 'TOUCAN',   layer: 'air',  r: 6,  tranq: 2, value: 75,  rarity: 'uncommon', flies: true, danger: 0,  col: ['#1a1a22', '#f2a03a', '#e8e2d0'], move: 40 },
    jaguar:   { name: 'JAGUAR',   layer: 'high', r: 9,  tranq: 5, value: 160, rarity: 'rare', danger: 3,  col: ['#c79a4a', '#8a6320', '#2a1c10'], move: 40, pounces: true },
    goldfrog: { name: 'GOLD FROG', layer: 'high', r: 5, tranq: 1, value: 220, rarity: 'epic', danger: 0,  col: ['#f6d13a', '#f2a640', '#fff2a0'], move: 30, jumps: true },
    // --- birds & new fauna ---
    hummer:   { name: 'HUMMER',   layer: 'air',  r: 4,  tranq: 1, value: 70,  rarity: 'uncommon', flies: true, danger: 0, col: ['#2ab89a', '#f24a7a', '#ffe08a'], move: 74, darts: true },
    morpho:   { name: 'MORPHO',   layer: 'air',  r: 5,  tranq: 1, value: 48,  rarity: 'common',   flies: true, danger: 0, col: ['#3a6ae0', '#7aa8ff', '#12205a'], move: 20, drifts: true },
    heron:    { name: 'HERON',    layer: 'air',  r: 8,  tranq: 2, value: 95,  rarity: 'uncommon', flies: true, danger: 0, col: ['#e2e8ee', '#aab6c4', '#f2b23a'], move: 26, wader: true },
    macaw2:   { name: 'SCARLET',  layer: 'air',  r: 6,  tranq: 1, value: 58,  rarity: 'common',   flies: true, danger: 0, col: ['#e83a2e', '#f2d13a', '#2a6ad0'], move: 50 },
    harpy:    { name: 'HARPY',    layer: 'air',  r: 9,  tranq: 4, value: 205, rarity: 'rare',     flies: true, danger: 3, col: ['#4a4a56', '#c8ccd4', '#f2c83a'], move: 54, dives: true },
    capybara: { name: 'CAPYBARA', layer: 'low',  r: 8,  tranq: 3, value: 72,  rarity: 'common',   danger: 0, col: ['#8a5a34', '#a9713f', '#5a3a22'], move: 16 },
    caiman:   { name: 'CAIMAN',   layer: 'low',  r: 9,  tranq: 4, value: 135, rarity: 'rare',     danger: 3, col: ['#3a4a2e', '#5a6e3c', '#1c2814'], move: 24, lunges: true, water: true },
  };
  const ANIMAL_KEYS = Object.keys(ANIMALS);
  const RARITY = { common: { c: '#c9d2c0', l: 'COMMON' }, uncommon: { c: '#6db6d8', l: 'UNCOMMON' }, rare: { c: '#c98fe0', l: 'RARE' }, epic: { c: '#f6c945', l: 'EPIC' } };

  const AMMO = {
    dart:  { name: 'TRANQ DART', dose: 1, key: 'Digit1', infinite: true },
    heavy: { name: 'HEAVY DART', dose: 3, key: 'Digit2' },
    net:   { name: 'CAPTURE NET', dose: 99, key: 'Digit3', net: true },
  };

  // forageable collectibles that reward exploration off the main climb
  const PICKUPS = {
    fruit:  { name: 'WILD FRUIT', r: 3, value: 10, col: '#e8433a', rarity: 'common' },
    egg:    { name: 'RARE EGG',   r: 3, value: 24, col: '#efe6cc', rarity: 'uncommon' },
    orchid: { name: 'ORCHID',     r: 4, value: 44, col: '#d46ae0', rarity: 'rare' },
  };

  const UPGRADES = [
    { id: 'mag',     cat: 'GUN',    name: 'BIGGER MAG',     desc: '+2 DARTS PER MAGAZINE', max: 4, cost: l => 60 + l * 55 },
    { id: 'reload',  cat: 'GUN',    name: 'FAST RELOAD',    desc: 'RELOAD 20% FASTER',     max: 4, cost: l => 55 + l * 50 },
    { id: 'power',   cat: 'GUN',    name: 'POTENT SERUM',   desc: '+0.5 DART DOSE',        max: 3, cost: l => 90 + l * 80 },
    { id: 'stamina', cat: 'CLIMB',  name: 'IRON GRIP',      desc: '+30 MAX STAMINA',       max: 4, cost: l => 50 + l * 45 },
    { id: 'rope',    cat: 'CLIMB',  name: 'LONG LINE',      desc: '+30 GRAPPLE RANGE',     max: 4, cost: l => 55 + l * 50 },
    { id: 'boots',   cat: 'CLIMB',  name: 'SPRING BOOTS',   desc: 'HIGHER JUMP',           max: 3, cost: l => 70 + l * 60 },
    { id: 'cargo',   cat: 'CARGO',  name: 'CARGO RACK',     desc: '+1 CARRY SLOT',         max: 5, cost: l => 80 + l * 70 },
    { id: 'ench',    cat: 'ZOO',    name: 'NEW ENCLOSURE',  desc: '+1 SANCTUARY PEN',      max: 6, cost: l => 90 + l * 80 },
    { id: 'food',    cat: 'ZOO',    name: 'PREMIUM FEED',   desc: 'FEEDING GIVES MORE JOY', max: 3, cost: l => 70 + l * 65 },
    { id: 'decor',   cat: 'ZOO',    name: 'DECOR & PATHS',  desc: '+20% VISITOR SPENDING', max: 4, cost: l => 85 + l * 75 },
  ];

  // ---------------- persistent save ----------------
  const SAVE_KEY = 'canopyRangers_v1';
  function newSave() {
    return {
      day: 1, money: 40,
      up: { mag: 0, reload: 0, power: 0, stamina: 0, rope: 0, boots: 0, cargo: 0, ench: 0, food: 0, decor: 0 },
      ammo: { heavy: 3, net: 1 },
      pens: [], // {type, happy, hunger}
      totalCaptured: 0, best: 0,
      unlockedNet: false, unlockedHeavy: true,
    };
  }
  function loadSave() {
    try { const s = JSON.parse(localStorage.getItem(SAVE_KEY)); if (s && s.up) return Object.assign(newSave(), s); } catch (e) {}
    return null;
  }
  function persist() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch (e) {} }

  // derived stats
  const D = {
    get magSize() { return 3 + S.up.mag * 2; },
    get reloadTime() { return Math.max(0.45, 1.25 - S.up.reload * 0.2); },
    get dose() { return 1 + S.up.power * 0.5; },
    get staminaMax() { return 100 + S.up.stamina * 30; },
    get ropeMax() { return 95 + S.up.rope * 30; },
    get jump() { return 3.0 + S.up.boots * 0.45; },
    get cargoMax() { return 3 + S.up.cargo; },
    get pens() { return 4 + S.up.ench; },
    get foodJoy() { return 22 + S.up.food * 9; },
    get spendMult() { return 1 + S.up.decor * 0.2; },
  };

  // =====================================================================
  //  GLOBAL GAME STATE
  // =====================================================================
  let S = newSave();
  let phase = 'boot';
  let hasSave = false;
  let t = 0;              // global time
  const parts = [];       // particles
  const floats = [];      // floating score text
  let shake = 0;
  let flash = 0, flashCol = '#fff';
  let fade = 1, fadeTarget = 0, fadeCb = null;

  function addPart(x, y, vx, vy, life, col, size, grav) { parts.push({ x, y, vx, vy, life, max: life, col, size: size || 1, grav: grav || 0 }); }
  function burst(x, y, n, col, spd, grav) { for (let i = 0; i < n; i++) { const a = rnd(0, Math.PI * 2), s = rnd(spd * 0.3, spd); addPart(x, y, Math.cos(a) * s, Math.sin(a) * s, rnd(0.3, 0.7), col, irnd(1, 2), grav || 0); } }
  function floatText(x, y, str, col) { floats.push({ x, y, str, col, life: 1.1 }); }
  function doShake(a) { shake = Math.max(shake, a); }
  function doFlash(a, col) { flash = a; flashCol = col || '#fff'; }
  function startFade(cb) { fadeTarget = 1; fade = Math.max(fade, 0.001); fadeCb = cb; }

  // =====================================================================
  //  DRAWING PRIMITIVES (procedural pixel art w/ dither shading)
  // =====================================================================
  function px(x, y, c) { ctx.fillStyle = c; ctx.fillRect(x | 0, y | 0, 1, 1); }
  function rectf(x, y, w, h, c) { ctx.fillStyle = c; ctx.fillRect(x | 0, y | 0, w | 0, h | 0); }
  function circ(x, y, r, c) {
    ctx.fillStyle = c;
    for (let dy = -r; dy <= r; dy++) { const s = Math.floor(Math.sqrt(r * r - dy * dy)); ctx.fillRect((x - s) | 0, (y + dy) | 0, s * 2 + 1, 1); }
  }
  function ellipse(x, y, rx, ry, c) {
    ctx.fillStyle = c;
    for (let dy = -ry; dy <= ry; dy++) { const s = Math.floor(rx * Math.sqrt(1 - (dy * dy) / (ry * ry))); ctx.fillRect((x - s) | 0, (y + dy) | 0, s * 2 + 1, 1); }
  }
  const BAYER = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];
  // vertical dithered gradient into a rect
  function ditherV(x, y, w, h, c1, c2) {
    for (let j = 0; j < h; j++) {
      const tt = j / (h - 1 || 1);
      for (let i = 0; i < w; i++) {
        const thr = (BAYER[(y + j) & 3][(x + i) & 3] + 0.5) / 16;
        px(x + i, y + j, tt > thr ? c2 : c1);
      }
    }
  }

  // shadow blob
  function shadow(x, y, w, a) { ctx.fillStyle = 'rgba(0,0,0,' + (a || 0.28) + ')'; for (let dy = 0; dy < 3; dy++) { const s = Math.floor(w * (1 - dy * 0.28)); ctx.fillRect((x - s) | 0, (y + dy) | 0, s * 2, 1); } }

  // =====================================================================
  //  MENU / TITLE
  // =====================================================================
  const menu = { sel: 0, items: [] };
  function initMenu() {
    hasSave = !!loadSave();
    menu.items = hasSave ? ['CONTINUE', 'NEW EXPEDITION', 'HOW TO PLAY'] : ['NEW EXPEDITION', 'HOW TO PLAY'];
    menu.sel = 0;
    phase = 'menu';
  }
  let howto = false;

  function updateMenu(dt) {
    if (howto) { if (keyPressed('Space') || keyPressed('Enter') || keyPressed('Escape') || mouse.clicked) { howto = false; A.play('select'); } return; }
    if (keyPressed('ArrowDown') || keyPressed('KeyS')) { menu.sel = (menu.sel + 1) % menu.items.length; A.play('select'); }
    if (keyPressed('ArrowUp') || keyPressed('KeyW')) { menu.sel = (menu.sel + menu.items.length - 1) % menu.items.length; A.play('select'); }
    // mouse hover select
    for (let i = 0; i < menu.items.length; i++) {
      const yy = 96 + i * 20;
      if (mouse.y > yy - 6 && mouse.y < yy + 8) { menu.sel = i; if (mouse.clicked) chooseMenu(); }
    }
    if (keyPressed('Enter') || keyPressed('Space')) chooseMenu();
  }
  function chooseMenu() {
    const it = menu.items[menu.sel]; A.play('confirm');
    if (it === 'HOW TO PLAY') { howto = true; return; }
    if (it === 'CONTINUE') { S = loadSave() || newSave(); }
    else { S = newSave(); persist(); }
    startFade(() => startBrief());
  }

  // =====================================================================
  //  DAY BRIEFING  (choose region -> start expedition)
  // =====================================================================
  const REGIONS = [
    { id: 'basin', name: 'RIVER BASIN', height: 980, danger: 1, tint: '#3fa06a',
      sky: ['#bfe4cf', '#5fae86'], ground: '#3c5a2a', water: true, grass: true, fog: 0.10, mountains: false,
      spawn: ['parrot', 'macaw2', 'monkey', 'boar', 'capybara', 'heron', 'morpho', 'caiman', 'sloth'] },
    { id: 'canopy', name: 'DEEP CANOPY', height: 1220, danger: 2, tint: '#2f8a58',
      sky: ['#9fd0b8', '#2f7a52'], ground: '#2a4620', water: false, grass: true, fog: 0.28, mountains: false,
      spawn: ['parrot', 'macaw2', 'monkey', 'boar', 'snake', 'sloth', 'toucan', 'hummer', 'morpho'] },
    { id: 'highlands', name: 'MISTY HIGHLANDS', height: 1480, danger: 3, tint: '#3a7a7a',
      sky: ['#cfe0ea', '#4a8a86'], ground: '#33503e', water: false, grass: true, fog: 0.42, mountains: true,
      spawn: ['monkey', 'snake', 'toucan', 'hummer', 'jaguar', 'goldfrog', 'harpy', 'sloth'] },
    { id: 'flooded', name: 'FLOODED FOREST', height: 1600, danger: 4, tint: '#2e7a6a',
      sky: ['#a8d0d4', '#2a6a6a'], ground: '#284a30', water: true, grass: true, fog: 0.30, mountains: false,
      spawn: ['heron', 'caiman', 'capybara', 'snake', 'morpho', 'jaguar', 'harpy', 'toucan'] },
  ];
  function regionsAvail() { return clamp(1 + Math.floor((S.day - 1)), 1, REGIONS.length); }
  let brief = { sel: 0 };
  function startBrief() {
    // pick regions available by day
    brief.sel = 0;
    phase = 'brief';
  }
  function briefCard(i, avail) { const cw = avail <= 3 ? 84 : 74, gap = avail <= 3 ? 92 : 78; const cx = W / 2 + (i - (avail - 1) / 2) * gap; return { cx, cw, y0: 58, h: 96 }; }
  function updateBrief(dt) {
    const avail = regionsAvail();
    if (brief.sel >= avail) brief.sel = avail - 1;
    if (keyPressed('ArrowRight') || keyPressed('KeyD')) { brief.sel = (brief.sel + 1) % avail; A.play('select'); }
    if (keyPressed('ArrowLeft') || keyPressed('KeyA')) { brief.sel = (brief.sel + avail - 1) % avail; A.play('select'); }
    for (let i = 0; i < avail; i++) { const C = briefCard(i, avail); if (mouse.x > C.cx - C.cw / 2 && mouse.x < C.cx + C.cw / 2 && mouse.y > C.y0 && mouse.y < C.y0 + C.h) { if (brief.sel !== i) A.play('select'); brief.sel = i; if (mouse.clicked) beginExpedition(); } }
    if (keyPressed('Enter') || keyPressed('Space')) beginExpedition();
  }
  function beginExpedition() { A.play('confirm'); startFade(() => startExpedition(REGIONS[brief.sel])); }

  // =====================================================================
  //  EXPEDITION (day) — the climb-and-tranq core
  // =====================================================================
  const EXP = {};
  function startExpedition(region) {
    A.play('dayStart');
    const LH = region.height;
    const P = {
      x: W / 2, y: LH - 26, vx: 0, vy: 0, w: 8, h: 12, onGround: false, face: 1,
      stamina: D.staminaMax, health: 3, maxHealth: 3, hurt: 0,
      rope: null,       // {ax, ay, len}
      ammoType: 'dart', mag: D.magSize, reloading: 0,
      climbAnim: 0, invuln: 0, dead: false,
    };
    EXP.region = region; EXP.LH = LH; EXP.P = P;
    EXP.cam = LH - H; EXP.branches = []; EXP.vines = []; EXP.animals = []; EXP.darts = []; EXP.hook = null;
    EXP.cargo = []; EXP.score = 0; EXP.time = 0; EXP.extracting = false; EXP.extractT = 0; EXP.done = false;
    EXP.msg = ''; EXP.msgT = 0; EXP.highest = LH - 26;
    EXP.netFx = []; EXP.pickups = []; EXP.treasures = 0; EXP.treasuresTotal = 0;
    EXP.waterY = region.water ? LH - 6 : LH + 40;   // river surface line at the forest floor
    EXP.foreFerns = []; for (let i = 0; i < 10; i++) EXP.foreFerns.push({ x: rnd(0, W), s: rnd(0.7, 1.4), h: rnd(10, 22) });
    genLevel(region);
    phase = 'expedition';
    setMsg('CLIMB! TRANQ WILDLIFE, RETURN TO TRUCK');
  }
  function setMsg(m) { EXP.msg = m; EXP.msgT = 3.2; }

  function genLevel(region) {
    const LH = EXP.LH;
    // ground platform + truck (parked to one side so the river reads across the floor)
    EXP.branches.push({ x: 0, y: LH - 14, w: W, tip: -1, ground: true });
    EXP.truck = { x: region.water ? 48 : W / 2, y: LH - 14 };
    // river-edge fauna live down at the water line in watery biomes
    if (region.water) {
      spawnAt(region, 'caiman', clamp(W - irnd(40, 90), 30, W - 20), LH - 18);
      if (Math.random() < 0.8) spawnAt(region, 'heron', clamp(irnd(120, W - 30), 20, W - 20), LH - 30);
      if (Math.random() < 0.7) spawnAt(region, 'capybara', clamp(irnd(90, W - 40), 20, W - 20), LH - 18);
    }
    // procedural branches climbing up
    let y = LH - 46;
    let side = Math.random() < 0.5 ? -1 : 1;
    let idx = 0;
    while (y > 34) {
      // every few levels open a wide "clearing" platform for a breather / vista
      const clearing = idx > 1 && Math.random() < 0.14;
      const bw = clearing ? irnd(120, 168) : irnd(48, 96);
      let bx;
      if (clearing) bx = clamp(irnd(20, W - bw - 20), 2, W - bw - 2);
      else bx = side < 0 ? irnd(2, 42) : irnd(Math.max(2, W - bw - 42), W - bw - 2);
      const heightFrac = 1 - (y / LH); // 0 bottom .. 1 top
      const b = { x: bx, y: y, w: bw, tip: side < 0 ? bx + bw : bx, heightFrac, grass: region.grass && Math.random() < 0.7 };
      EXP.branches.push(b);
      // a second small ledge on the opposite side sometimes — encourages branching routes
      if (!clearing && Math.random() < 0.32) {
        const bw2 = irnd(34, 58), bx2 = side < 0 ? irnd(W - bw2 - 30, W - bw2 - 4) : irnd(4, 30);
        const b2 = { x: bx2, y: y - irnd(4, 14), w: bw2, tip: bx2, heightFrac, grass: region.grass && Math.random() < 0.6 };
        EXP.branches.push(b2);
        if (Math.random() < 0.5) spawnPickupOn(region, b2, heightFrac);
      }
      // vine sometimes hangs from a branch (grabbable anchor)
      if (Math.random() < (clearing ? 0.7 : 0.45)) {
        const vx = bx + irnd(10, Math.max(11, bw - 10));
        EXP.vines.push({ ax: vx, ay: y, len: irnd(34, 74), sway: rnd(0, 6.28) });
      }
      // forageable treasure rewards straying from the direct line up
      if (idx > 0 && Math.random() < 0.4) spawnPickupOn(region, b, heightFrac);
      // spawn an animal on/near this branch based on region + height
      if (idx > 0 && Math.random() < (clearing ? 0.9 : 0.8)) spawnAnimalFor(region, b, heightFrac);
      y -= clearing ? irnd(48, 66) : irnd(36, 58);
      side = -side + (Math.random() < 0.25 ? side : 0); // mostly alternate
      if (Math.random() < 0.3) side = Math.random() < 0.5 ? -1 : 1;
      idx++;
    }
  }

  function spawnPickupOn(region, b, hf) {
    const key = pickWeighted([{ v: 'fruit', w: 6 }, { v: 'egg', w: 2.4 }, { v: 'orchid', w: 0.7 + hf }]);
    const def = PICKUPS[key];
    const x = clamp(b.x + irnd(6, Math.max(7, b.w - 6)), 6, W - 6);
    EXP.pickups.push({ key, def, x, y: b.y - def.r - 2, bob: rnd(0, 6.28), got: false });
    EXP.treasuresTotal++;
  }

  function spawnAt(region, key, x, y) {
    const def = ANIMALS[key]; if (!def) return;
    EXP.animals.push({
      key, def, x, y, homeX: x, baseY: y, branch: { x: 0, y: EXP.LH - 14, w: W, ground: true },
      vx: def.flies ? (Math.random() < 0.5 ? -1 : 1) * def.move / 60 : 0, vy: 0,
      tranq: 0, state: 'idle', dir: Math.random() < 0.5 ? -1 : 1, aggro: 0, timer: rnd(0.5, 2),
      asleep: false, collected: false, phase: rnd(0, 6.28), atkCD: 0, netted: 0, onGround: !def.flies, hop: 0,
    });
  }

  function spawnAnimalFor(region, b, hf) {
    // choose species weighted by height & region list
    const list = region.spawn.slice();
    const entries = list.map(k => {
      const a = ANIMALS[k];
      let w = a.rarity === 'common' ? 5 : a.rarity === 'uncommon' ? 3 : a.rarity === 'rare' ? 1.4 : 0.6;
      // higher animals prefer higher branches, water animals stay near the floor
      if (a.layer === 'high' && hf < 0.55) w *= 0.15;
      if (a.layer === 'air' && hf < 0.2) w *= 0.4;
      if (a.layer === 'low' && hf > 0.7) w *= 0.4;
      if (a.water) w *= 0.05;                 // caiman handled at the river, not up trees
      if (a.dives && hf < 0.5) w *= 0.2;      // harpy eagles hunt high
      return { v: k, w };
    });
    const key = pickWeighted(entries);
    const def = ANIMALS[key];
    let ax = b.x + b.w / 2, ay = b.y - def.r - 2;
    if (def.flies) { ay = b.y - irnd(20, 44); ax = clamp(ax + irnd(-30, 30), 12, W - 12); }
    EXP.animals.push({
      key, def, x: ax, y: ay, homeX: ax, baseY: ay, branch: b,
      vx: def.flies ? (Math.random() < 0.5 ? -1 : 1) * def.move / 60 : 0, vy: 0,
      tranq: 0, state: 'idle', dir: Math.random() < 0.5 ? -1 : 1, aggro: 0, timer: rnd(0.5, 2),
      asleep: false, collected: false, phase: rnd(0, 6.28), atkCD: 0, netted: 0, onGround: !def.flies, hop: 0,
    });
  }

  // ---- expedition update ----
  function updateExpedition(dt) {
    const P = EXP.P; EXP.time += dt;
    if (EXP.done) return;

    if (!P.dead && !EXP.extracting) updatePlayer(dt);
    else if (EXP.extracting) { EXP.extractT += dt; if (EXP.extractT > 1.1) finishExpedition(); }

    updateDarts(dt);
    updateHook(dt);
    for (const a of EXP.animals) updateAnimal(a, dt);
    // cull collected
    for (let i = EXP.animals.length - 1; i >= 0; i--) if (EXP.animals[i].collected) EXP.animals.splice(i, 1);

    // camera follows player, keep him ~58% down
    let target = P.y - H * 0.56;
    EXP.cam += (target - EXP.cam) * Math.min(1, dt * 6);
    EXP.cam = clamp(EXP.cam, 0, EXP.LH - H);

    EXP.highest = Math.min(EXP.highest, P.y);
    if (EXP.msgT > 0) EXP.msgT -= dt;

    // reach truck to extract (press E)
    if (!EXP.extracting && !P.dead && P.onGround && Math.abs(P.x - EXP.truck.x) < 26 && P.y > EXP.LH - 40) {
      EXP.nearTruck = true;
      if (keyPressed('KeyE')) beginExtract();
    } else EXP.nearTruck = false;

    // death -> forced extract dropping half cargo
    if (P.health <= 0 && !P.dead) { P.dead = true; A.play('die'); doShake(6); doFlash(0.7, '#a02020'); setTimeout(() => {}, 0);
      // drop half
      const keep = Math.ceil(EXP.cargo.length / 2); EXP.cargo = EXP.cargo.slice(0, keep);
      EXP.deathMsg = 'KNOCKED OUT! HALF YOUR CATCH SLIPPED AWAY';
      setTimeout(() => { if (phase === 'expedition') beginExtract(); }, 1200);
    }
  }

  function updatePlayer(dt) {
    const P = EXP.P;
    const left = keys['ArrowLeft'] || keys['KeyA'];
    const right = keys['ArrowRight'] || keys['KeyD'];
    const up = keys['ArrowUp'] || keys['KeyW'];
    const down = keys['ArrowDown'] || keys['KeyS'];
    if (P.hurt > 0) P.hurt -= dt;
    if (P.invuln > 0) P.invuln -= dt;

    // ---- shooting ----
    if (P.reloading > 0) { P.reloading -= dt; if (P.reloading <= 0) { P.mag = D.magSize; A.play('reload'); } }
    // ammo switch
    if (keyPressed('Digit1')) P.ammoType = 'dart';
    if (keyPressed('Digit2') && S.ammo.heavy > 0) P.ammoType = 'heavy';
    if (keyPressed('Digit3') && S.ammo.net > 0) P.ammoType = 'net';
    if (P.ammoType === 'heavy' && S.ammo.heavy <= 0) P.ammoType = 'dart';
    if (P.ammoType === 'net' && S.ammo.net <= 0) P.ammoType = 'dart';
    if ((mouse.clicked || keyPressed('KeyJ'))) fireDart();
    if (keyPressed('KeyR') && P.reloading <= 0 && P.mag < D.magSize && P.ammoType === 'dart') { P.reloading = D.reloadTime; }

    // ---- grapple ----
    if (mouse.rclicked || keyPressed('KeyF') || keyPressed('ShiftLeft')) toggleGrapple();

    const sx = P.x - EXP.cam * 0 + 0; // player world x (no horiz cam)

    if (P.rope) {
      // pendulum physics
      const r = P.rope;
      // reel
      if (up) r.len = Math.max(16, r.len - 46 * dt);
      if (down) r.len = Math.min(D.ropeMax, r.len + 40 * dt);
      // gravity
      P.vy += 15 * dt;
      // air steer to pump the swing
      if (left) P.vx -= 22 * dt;
      if (right) P.vx += 22 * dt;
      P.vx *= 0.995;
      P.x += P.vx; P.y += P.vy;
      // constrain to circle
      let dx = P.x - r.ax, dy = P.y - r.ay; let dl = Math.sqrt(dx * dx + dy * dy) || 0.001;
      if (dl > r.len) {
        dx /= dl; dy /= dl;
        P.x = r.ax + dx * r.len; P.y = r.ay + dy * r.len;
        // remove radial velocity component
        const radial = P.vx * dx + P.vy * dy;
        P.vx -= dx * radial; P.vy -= dy * radial;
      }
      // stamina drains while hanging
      P.stamina -= 10 * dt;
      // release
      if (keyPressed('Space')) { releaseRope(); }
      // detach if grounded
      P.onGround = false;
    } else {
      // normal platforming
      const accel = P.onGround ? 40 : 26;
      if (left) { P.vx -= accel * dt; P.face = -1; }
      if (right) { P.vx += accel * dt; P.face = 1; }
      if (!left && !right) P.vx *= P.onGround ? 0.78 : 0.94;
      P.vx = clamp(P.vx, -1.9, 1.9);
      P.vy += 15.5 * dt; // gravity
      P.vy = Math.min(P.vy, 5.5);
      // jump
      if (keyPressed('Space') && P.onGround) { P.vy = -D.jump; P.onGround = false; A.play('whoosh'); P.stamina -= 3; }
      P.x += P.vx; P.y += P.vy;
      // grab a nearby vine automatically when pressing grapple handled in toggleGrapple

      // branch collision (one-way, land on top)
      P.onGround = false;
      const feet = P.y + P.h / 2;
      for (const b of EXP.branches) {
        if (P.x + P.w / 2 > b.x && P.x - P.w / 2 < b.x + b.w) {
          const top = b.y;
          if (P.vy >= 0 && feet >= top && feet <= top + 8 + P.vy) {
            P.y = top - P.h / 2; P.vy = 0; P.onGround = true;
          }
        }
      }
      // stamina regen on ground, drain in air slowly
      if (P.onGround) P.stamina += 24 * dt; else P.stamina -= 2 * dt;
    }
    // walls
    P.x = clamp(P.x, 5, W - 5);
    P.stamina = clamp(P.stamina, 0, D.staminaMax);
    // exhausted: slip / take tick
    if (P.stamina <= 0) {
      if (P.rope) releaseRope();
      if (P.invuln <= 0 && Math.random() < dt * 1.2) hurtPlayer(0.34, 0);
    }
    // fall off bottom (shouldn't) clamp
    if (P.y > EXP.LH + 30) { P.y = EXP.LH - 26; P.vy = 0; }

    // climbing anim
    P.climbAnim += (Math.abs(P.vx) + (P.rope ? 3 : 0)) * dt * 6;

    // collect sleeping animals by touch
    for (const a of EXP.animals) {
      if (a.asleep && !a.collected && dist2(P.x, P.y, a.x, a.y) < 12 * 12) collectAnimal(a);
    }
    // forage collectibles by touch (instant cash reward for exploring)
    for (const pk of EXP.pickups) {
      if (!pk.got && dist2(P.x, P.y, pk.x, pk.y) < 11 * 11) collectPickup(pk);
    }
  }

  function collectPickup(pk) {
    pk.got = true; EXP.treasures++;
    S.money += pk.def.value; EXP.score += pk.def.value;
    A.play('pickup'); burst(pk.x, pk.y, 7, pk.def.col, 1.8, 0);
    floatText(pk.x, pk.y - 6, '+$' + pk.def.value, '#f6d13a');
    doFlash(0.12, '#fff2b0');
  }

  function hurtPlayer(dmg, kx) {
    const P = EXP.P; if (P.invuln > 0 || P.dead) return;
    P.health -= dmg; P.hurt = 0.4; P.invuln = 1.0;
    P.vx += kx; P.vy = -1.6; if (P.rope) releaseRope();
    A.play('hit'); doShake(4); doFlash(0.35, '#c04030');
    if (P.health < 0) P.health = 0;
  }

  function fireDart() {
    const P = EXP.P;
    if (P.rope && false) return;
    if (P.ammoType === 'dart') {
      if (P.reloading > 0) return;
      if (P.mag <= 0) { P.reloading = D.reloadTime; A.play('empty'); return; }
      P.mag--;
    } else if (P.ammoType === 'heavy') {
      if (S.ammo.heavy <= 0) { P.ammoType = 'dart'; return; }
      S.ammo.heavy--;
    } else if (P.ammoType === 'net') {
      if (S.ammo.net <= 0) { P.ammoType = 'dart'; return; }
      S.ammo.net--;
    }
    const sx = P.x, sy = P.y - 2;
    const aimx = mouse.x, aimy = mouse.y + EXP.cam;
    let dx = aimx - sx, dy = aimy - sy; const dl = Math.sqrt(dx * dx + dy * dy) || 1; dx /= dl; dy /= dl;
    P.face = dx < 0 ? -1 : 1;
    const spd = P.ammoType === 'net' ? 3.1 : 4.6;
    EXP.darts.push({ x: sx, y: sy, vx: dx * spd, vy: dy * spd, type: P.ammoType, life: 1.6, net: P.ammoType === 'net' });
    A.play(P.ammoType === 'net' ? 'net' : 'dart');
    if (P.ammoType === 'dart' && P.mag <= 0) P.reloading = D.reloadTime;
  }

  function updateDarts(dt) {
    for (let i = EXP.darts.length - 1; i >= 0; i--) {
      const d = EXP.darts[i];
      d.vy += (d.net ? 7 : 4) * dt; // slight gravity
      d.x += d.vx; d.y += d.vy; d.life -= dt;
      addPart(d.x, d.y, 0, 0, 0.18, d.net ? '#dfe8d0' : '#e8f0b0', 1, 0);
      let hit = false;
      for (const a of EXP.animals) {
        if (a.asleep || a.collected) continue;
        if (dist2(d.x, d.y, a.x, a.y) < (a.def.r + 2) * (a.def.r + 2)) {
          applyTranq(a, d); hit = true; break;
        }
      }
      // hit branch or off screen
      if (!hit) for (const b of EXP.branches) { if (d.x > b.x && d.x < b.x + b.w && Math.abs(d.y - b.y) < 3 && d.vy > 0) { hit = true; addPart(d.x, d.y, 0, -0.3, 0.3, '#8a6a3a', 1, 4); break; } }
      if (hit || d.life <= 0 || d.y > EXP.LH + 10 || d.x < -6 || d.x > W + 6) EXP.darts.splice(i, 1);
    }
  }

  function applyTranq(a, d) {
    const dose = d.net ? 99 : (d.type === 'heavy' ? 3 : D.dose);
    a.tranq += dose;
    A.play('dartHit'); burst(a.x, a.y, 5, '#c7d94a', 1.6, 0); doShake(1.5);
    floatText(a.x, a.y - a.def.r - 4, '+' + (Math.round(dose * 10) / 10), '#c7d94a');
    a.aggro = Math.min(a.aggro, 0.5); a.wince = 0.2;
    if (d.net) { a.netted = 1; }
    if (a.tranq >= a.def.tranq) sedate(a);
    else if (a.def.danger > 0 && !a.def.flies) { a.state = 'flee'; a.timer = 1.2; a.dir = a.x < EXP.P.x ? -1 : 1; }
  }

  function sedate(a) {
    if (a.asleep) return;
    a.asleep = true; a.state = 'sleep'; a.vx = 0; a.vy = a.def.flies ? 1.2 : 0;
    A.play('sedate'); burst(a.x, a.y, 10, '#9ad0e8', 1.8, 0);
    floatText(a.x, a.y - a.def.r - 6, 'SEDATED', '#9ad0e8');
    EXP.score += a.def.value;
  }

  function collectAnimal(a) {
    if (EXP.cargo.length >= D.cargoMax) { if (!EXP.fullMsgT || EXP.fullMsgT <= 0) { setMsg('CARGO FULL! RETURN TO TRUCK'); EXP.fullMsgT = 2; } return; }
    a.collected = true; EXP.cargo.push(a.key);
    A.play('stow'); A.play('happy');
    burst(a.x, a.y, 8, RARITY[a.def.rarity].c, 2, 0);
    floatText(EXP.P.x, EXP.P.y - 14, a.def.name + ' CAUGHT', RARITY[a.def.rarity].c);
    doFlash(0.2, '#ffffff');
  }

  // ---- grapple / vine ----
  function toggleGrapple() {
    const P = EXP.P;
    if (P.rope) { releaseRope(); return; }
    if (EXP.hook) { EXP.hook = null; return; }
    // if near a vine anchor, grab it directly
    let best = null, bd = 30 * 30;
    for (const v of EXP.vines) { const hx = v.ax + Math.sin(v.sway + t) * 3, hy = v.ay + v.len; const dd = dist2(P.x, P.y, v.ax, v.ay + v.len * 0.5); if (dd < bd) { bd = dd; best = v; } }
    // fire hook toward aim
    const aimx = mouse.x, aimy = mouse.y + EXP.cam;
    let dx = aimx - P.x, dy = aimy - (P.y - 2); const dl = Math.sqrt(dx * dx + dy * dy) || 1; dx /= dl; dy /= dl;
    EXP.hook = { x: P.x, y: P.y - 2, vx: dx * 6.4, vy: dy * 6.4, life: 0.6 };
    A.play('grapple');
  }
  function updateHook(dt) {
    const P = EXP.P; if (!EXP.hook || P.rope) { return; }
    const hk = EXP.hook; hk.x += hk.vx; hk.y += hk.vy; hk.life -= dt;
    const trav = dist2(hk.x, hk.y, P.x, P.y - 2);
    addPart(hk.x, hk.y, 0, 0, 0.12, '#cdbf9a', 1, 0);
    // attach if hit a branch within range
    let attached = false;
    for (const b of EXP.branches) {
      if (hk.x > b.x - 2 && hk.x < b.x + b.w + 2 && Math.abs(hk.y - b.y) < 4) {
        if (Math.sqrt(trav) <= D.ropeMax) { attachRope(hk.x, b.y); attached = true; }
        break;
      }
    }
    // attach to a vine
    if (!attached) for (const v of EXP.vines) { if (dist2(hk.x, hk.y, v.ax, v.ay) < 8 * 8 && Math.sqrt(trav) <= D.ropeMax) { attachRope(v.ax, v.ay); attached = true; break; } }
    if (attached) { EXP.hook = null; return; }
    if (hk.life <= 0 || Math.sqrt(trav) > D.ropeMax || hk.y < 0 || hk.x < -8 || hk.x > W + 8) EXP.hook = null;
  }
  function attachRope(ax, ay) {
    const P = EXP.P;
    const len = Math.max(18, Math.sqrt(dist2(P.x, P.y, ax, ay)));
    P.rope = { ax, ay, len };
    // give upward reel kick
    P.vy = Math.min(P.vy, -0.5);
    A.play('latch'); EXP.hook = null;
  }
  function releaseRope() { const P = EXP.P; if (!P.rope) return; P.rope = null; P.vy -= 0.6; A.play('swing'); }

  // ---- animal AI ----
  function updateAnimal(a, dt) {
    const P = EXP.P; const def = a.def;
    if (a.wince > 0) a.wince -= dt;
    if (a.asleep) {
      // gently fall to a branch below then rest
      a.vy += 8 * dt; a.y += a.vy;
      for (const b of EXP.branches) { if (a.x > b.x && a.x < b.x + b.w && a.y >= b.y - def.r && a.y <= b.y + 6 && a.vy >= 0) { a.y = b.y - def.r; a.vy = 0; } }
      if (a.y > EXP.LH - 14 - def.r) { a.y = EXP.LH - 14 - def.r; a.vy = 0; }
      a.z = (a.z || 0) + dt; // sleep timer for Zzz
      return;
    }
    a.phase += dt;
    a.timer -= dt; if (a.atkCD > 0) a.atkCD -= dt;
    const near = dist2(P.x, P.y, a.x, a.y);
    const seePlayer = near < 60 * 60 && Math.abs(a.y - P.y) < 40;

    if (def.flies) {
      if (def.drifts) {
        // morpho butterfly: slow lazy wander, easy to net
        a.x += a.vx * 0.6 + Math.sin(a.phase * 1.3) * 0.16;
        a.baseY += Math.sin(a.phase * 0.7) * 0.35;
        a.y = a.baseY + Math.sin(a.phase * 3) * 3;
        if (a.x < 10 || a.x > W - 10) a.vx *= -1;
      } else if (def.darts) {
        // hummingbird: fast, erratic direction flicks
        if (a.timer <= 0) { a.vx = (Math.random() < 0.5 ? -1 : 1) * def.move / 60 * rnd(0.7, 1.3); a.timer = rnd(0.3, 0.8); }
        a.x += a.vx;
        a.y = a.baseY + Math.sin(a.phase * 9) * 4 + Math.sin(a.phase * 2.3) * 3;
        if (a.x < 10 || a.x > W - 10) a.vx *= -1;
      } else if (def.dives) {
        // harpy eagle: patrol high, then swoop at prey below
        if (a.state === 'dive') {
          const dx = a.tx - a.x, dy = a.ty - a.y, dl = Math.sqrt(dx * dx + dy * dy) || 1;
          a.x += dx / dl * 150 * dt; a.y += dy / dl * 150 * dt; a.dir = dx < 0 ? -1 : 1;
          if (dl < 7 || dy < -2) a.state = 'return';
        } else if (a.state === 'return') {
          a.y -= 70 * dt; a.x += a.vx * 0.5; if (a.y <= a.baseY) { a.y = a.baseY; a.state = 'idle'; }
        } else {
          a.x += a.vx; a.y = a.baseY + Math.sin(a.phase * 2) * 4;
          if (a.x < 10 || a.x > W - 10) a.vx *= -1;
          if (a.atkCD <= 0 && near < 96 * 96 && P.y > a.y + 6) { a.state = 'dive'; a.tx = P.x; a.ty = P.y; a.atkCD = 3.0; A.play('hawkScreech'); }
        }
      } else {
        // default birds (macaw, toucan, heron): horizontal patrol with sine bob
        a.x += a.vx;
        a.y = a.baseY + Math.sin(a.phase * 2) * 5;
        if (a.x < 10 || a.x > W - 10) a.vx *= -1;
      }
      if (a.state === 'flee') { a.baseY -= 22 * dt; a.vx *= 1.005; }
      a.x = clamp(a.x, 6, W - 6);
      if (def.danger > 0 && P.invuln <= 0 && near < (def.r + 7) * (def.r + 7)) hurtPlayer(0.5 + def.danger * 0.16, P.x < a.x ? -1.6 : 1.6);
      return;
    }

    // grounded animals
    a.vy += 14 * dt; a.y += a.vy;
    // settle on its branch
    const b = a.branch;
    if (a.vy >= 0 && a.y >= b.y - def.r && a.y <= b.y + 8) { a.y = b.y - def.r; a.vy = 0; a.onGround = true; }

    if (a.state === 'flee') {
      a.x += a.dir * def.move / 60 * 1.6;
      a.timer -= 0; if (a.timer <= 0) a.state = 'idle';
    } else if (def.charges && seePlayer && a.atkCD <= 0 && Math.abs(a.y - P.y) < 16) {
      a.state = 'charge'; a.dir = P.x < a.x ? -1 : 1; a.timer = 0.9; a.atkCD = 2.4; A.play('charge');
    } else if (def.pounces && seePlayer && a.atkCD <= 0) {
      a.state = 'pounce'; a.vy = -3; a.vx = (P.x < a.x ? -1 : 1) * 2.2; a.atkCD = 2.6; A.play('growl');
    } else if (def.strikes && near < 34 * 34 && a.atkCD <= 0) {
      a.state = 'strike'; a.timer = 0.5; a.atkCD = 1.6; A.play('snakeStrike');
    } else if (def.lunges && near < 46 * 46 && a.atkCD <= 0 && Math.abs(a.y - P.y) < 20) {
      a.state = 'charge'; a.dir = P.x < a.x ? -1 : 1; a.timer = 0.7; a.atkCD = 2.0; A.play('chomp');
    } else if (def.jumps && a.timer <= 0) {
      // monkey/frog hops along/among branches
      a.vy = -2.4; a.dir = Math.random() < 0.5 ? -1 : 1; a.timer = rnd(1.2, 2.6); if (a.key === 'monkey') A.play('monkey');
    } else if (a.state === 'idle') {
      // wander on branch
      a.x += Math.sin(a.phase * 0.8) * def.move / 60 * 0.4;
    }

    if (a.state === 'charge') { a.x += a.dir * def.move / 60 * 2.2; if (a.timer <= 0) a.state = 'idle'; }
    if (a.state === 'pounce') { a.x += a.vx; if (a.onGround && a.vy === 0) a.state = 'idle'; }
    if (a.state === 'strike' && a.timer <= 0) a.state = 'idle';
    if (def.jumps && !a.onGround) a.x += a.dir * def.move / 60;

    // keep near home-ish and on-screen
    a.x = clamp(a.x, 4, W - 4);

    // contact damage
    if (def.danger > 0 && !a.asleep) {
      const contact = (a.state === 'charge' || a.state === 'pounce' || a.state === 'strike' || def.danger >= 2);
      if (near < (def.r + 7) * (def.r + 7) && P.invuln <= 0) {
        hurtPlayer(0.5 + def.danger * 0.16, P.x < a.x ? -1.8 : 1.8);
      }
    }
    a.onGround = a.vy === 0;
  }

  function beginExtract() {
    if (EXP.extracting) return;
    EXP.extracting = true; EXP.extractT = 0; A.play('nightStart'); doFlash(0.3, '#ffe6a0');
  }
  function finishExpedition() {
    if (EXP.done) return; EXP.done = true;
    // move cargo into save collection
    S.dayCatch = EXP.cargo.slice();
    S.totalCaptured += EXP.cargo.length;
    EXP.result = summarizeCatch(EXP.cargo);
    startFade(() => startSanctuary());
  }
  function summarizeCatch(cargo) {
    const counts = {}; let val = 0;
    for (const k of cargo) { counts[k] = (counts[k] || 0) + 1; val += ANIMALS[k].value; }
    return { counts, val, n: cargo.length };
  }

  // =====================================================================
  //  SANCTUARY (night) — placement, feeding, playing, visitors, income
  // =====================================================================
  const SAN = {};
  function startSanctuary() {
    A.play('dayStart');
    // assign new catch to pens
    const incoming = S.dayCatch || [];
    let released = 0, releaseCash = 0;
    for (const k of incoming) {
      if (S.pens.length < D.pens) S.pens.push({ type: k, happy: 55, hunger: 70 });
      else { released++; releaseCash += Math.round(ANIMALS[k].value * 0.5); }
    }
    if (releaseCash > 0) { S.money += releaseCash; }
    SAN.released = released; SAN.releaseCash = releaseCash;
    SAN.clock = 42;           // seconds of "night"
    SAN.income = 0; SAN.baseIncome = 0;
    SAN.visitors = []; SAN.spawnT = 0.5;
    SAN.sel = -1; SAN.menu = null; SAN.mini = null;
    SAN.ambient = 0;
    SAN.done = false; SAN.summaryT = 0;
    SAN.newIncoming = incoming.slice();
    phase = 'sanctuary';
  }

  function penLayout(i) {
    // up to 5 pens per row, 2 rows fit above the visitor path
    const cols = 5;
    const col = i % cols, row = Math.floor(i / cols);
    const x = 8 + col * 61;
    const y = 42 + row * 52;
    return { x, y, w: 52, h: 40 };
  }
  function pathY() { return 152; }
  function penMenuY(i) { const L = penLayout(i); let by = L.y + L.h + 4; if (by + 36 > H) by = L.y - 36; return by; }

  function updateSanctuary(dt) {
    if (SAN.done) { SAN.summaryT += dt; if ((keyPressed('Space') || keyPressed('Enter') || mouse.clicked) && SAN.summaryT > 0.6) { A.play('confirm'); startFade(() => startShop()); } return; }
    SAN.ambient += dt;

    // minigame overlay takes priority
    if (SAN.mini) { updateMini(dt); return; }

    SAN.clock -= dt;
    if (SAN.clock <= 0) { SAN.clock = 0; endNight(); return; }

    // visitors flow
    SAN.spawnT -= dt;
    const rate = 1.6 - Math.min(1.0, S.pens.length * 0.12);
    if (SAN.spawnT <= 0 && S.pens.length > 0) { SAN.spawnT = rnd(rate * 0.6, rate); spawnVisitor(); }
    for (let i = SAN.visitors.length - 1; i >= 0; i--) { updateVisitor(SAN.visitors[i], dt); if (SAN.visitors[i].gone) SAN.visitors.splice(i, 1); }

    // pens decay hunger -> happiness
    for (const p of S.pens) {
      p.hunger = clamp(p.hunger - 3.2 * dt, 0, 100);
      p.happy = clamp(p.happy + (p.hunger > 50 ? 2 : -3.5) * dt, 0, 100);
    }

    // interaction: click a pen
    if (mouse.clicked && !SAN.menu) {
      for (let i = 0; i < S.pens.length; i++) { const L = penLayout(i); if (mouse.x > L.x && mouse.x < L.x + L.w && mouse.y > L.y && mouse.y < L.y + L.h) { SAN.menu = { pen: i, sel: 0 }; A.play('select'); break; } }
    }
    // menu
    if (SAN.menu) updatePenMenu(dt);

    // skip night
    if (keyPressed('Enter')) endNight();
  }

  function updatePenMenu(dt) {
    const opts = ['FEED', 'PLAY', 'CLOSE'];
    const m = SAN.menu; const L = penLayout(m.pen);
    const bx = clamp(L.x + L.w / 2 - 30, 4, W - 64), by = penMenuY(m.pen);
    for (let i = 0; i < opts.length; i++) {
      const oy = by + i * 12;
      if (mouse.x > bx && mouse.x < bx + 60 && mouse.y > oy && mouse.y < oy + 11) { m.sel = i; if (mouse.clicked) choosePenOpt(); }
    }
    if (keyPressed('ArrowDown')) { m.sel = (m.sel + 1) % opts.length; A.play('select'); }
    if (keyPressed('ArrowUp')) { m.sel = (m.sel + opts.length - 1) % opts.length; A.play('select'); }
    if (keyPressed('Enter') || keyPressed('Space')) choosePenOpt();
    if (keyPressed('Escape')) { SAN.menu = null; }
  }
  function choosePenOpt() {
    const m = SAN.menu; const opts = ['FEED', 'PLAY', 'CLOSE'];
    const o = opts[m.sel]; A.play('confirm');
    if (o === 'CLOSE') { SAN.menu = null; return; }
    startMini(o.toLowerCase(), m.pen);
    SAN.menu = null;
  }

  function spawnVisitor() {
    const pal = pick([['#e8a', '#c58'], ['#8ad', '#59b'], ['#ed8', '#ca5'], ['#8e9', '#5b6'], ['#d9e', '#a7c']]);
    SAN.visitors.push({ x: -8, y: pathY() + irnd(-2, 6), spd: rnd(20, 30), col: pal, paidTo: -1, bob: rnd(0, 6.28), gone: false, kid: Math.random() < 0.3, pause: 0, admire: -1 });
  }
  function updateVisitor(v, dt) {
    v.bob += dt * 8;
    if (v.pause > 0) v.pause -= dt; else { v.x += v.spd * dt; v.admire = -1; }
    // pay for each pen as the visitor strolls past it
    const n = S.pens.length;
    for (let i = v.paidTo + 1; i < n; i++) {
      if (v.x >= L_center(i)) {
        v.paidTo = i; const p = S.pens[i];
        if (p) {
          const base = ANIMALS[p.type].value * 0.14;
          const pay = Math.max(1, Math.round(base * (0.4 + p.happy / 100) * D.spendMult));
          SAN.income += pay; S.money += pay;
          floatText(L_center(i), penLayout(i).y + penLayout(i).h - 4, '+$' + pay, '#f6d13a');
          A.play('coin');
          v.pause = 0.45; v.admire = i; // pause to admire this exhibit
        }
      } else break;
    }
    if (v.x > W + 8) v.gone = true;
  }
  function L_center(i) { const L = penLayout(i); return L.x + L.w / 2; }

  function endNight() {
    if (SAN.done) return; SAN.done = true; SAN.summaryT = 0; A.play('cheer');
  }

  // ---- minigames ----
  function startMini(kind, pen) {
    if (kind === 'feed') SAN.mini = { kind, pen, round: 0, rounds: 3, marker: 0, dir: 1, zone: rnd(0.25, 0.7), zw: 0.16, hits: 0, done: false, t: 0 };
    else SAN.mini = { kind, pen, mashes: 0, need: 18, timeLeft: 5, ballx: W / 2, bally: 90, bvx: rnd(-1, 1), bvy: -1.5, done: false, t: 0 };
    A.play('play');
  }
  function updateMini(dt) {
    const m = SAN.mini; m.t += dt;
    if (m.done) { if (m.t > 1.0 && (mouse.clicked || keyPressed('Space') || keyPressed('Enter'))) { SAN.mini = null; } return; }
    if (m.kind === 'feed') {
      m.marker += m.dir * dt * (1.1 + m.round * 0.25);
      if (m.marker > 1) { m.marker = 1; m.dir = -1; } if (m.marker < 0) { m.marker = 0; m.dir = 1; }
      if (mouse.clicked || keyPressed('Space')) {
        if (m.marker > m.zone && m.marker < m.zone + m.zw) { m.hits++; A.play('feed'); burst(160, 70, 6, '#f2a03a', 1.6, 4); }
        else { A.play('empty'); }
        m.round++; m.zone = rnd(0.15, 0.72); m.zw = Math.max(0.1, 0.17 - m.round * 0.01);
        if (m.round >= m.rounds) finishMini();
      }
      if (keyPressed('Escape')) finishMini();
    } else {
      m.timeLeft -= dt;
      // bounce ball
      m.ballx += m.bvx; m.bally += m.bvy; m.bvy += 0.12; m.bvx *= 0.999;
      if (m.ballx < 120 || m.ballx > 200) m.bvx *= -1;
      if (m.bally > 110) { m.bally = 110; m.bvy = -Math.abs(m.bvy) * 0.7; }
      if (mouse.clicked || keyPressed('Space')) {
        m.mashes++; m.bvy = -2.4; m.bvx = rnd(-1.4, 1.4); A.play('play'); burst(m.ballx, m.bally, 4, '#8ae0ff', 1.6, 0);
      }
      if (m.timeLeft <= 0 || m.mashes >= m.need) finishMini();
    }
  }
  function finishMini() {
    const m = SAN.mini; const p = S.pens[m.pen]; if (!p) { SAN.mini = null; return; }
    let joy = 0, msg = '';
    if (m.kind === 'feed') { p.hunger = clamp(p.hunger + 45, 0, 100); joy = (m.hits / m.rounds) * D.foodJoy; msg = m.hits + '/' + m.rounds + ' FED'; }
    else { const ratio = Math.min(1, m.mashes / m.need); joy = ratio * (D.foodJoy * 0.9); msg = 'PLAYTIME!'; }
    p.happy = clamp(p.happy + joy, 0, 100);
    m.result = { joy: Math.round(joy), msg }; m.done = true; m.t = 0; A.play('happy');
    doFlash(0.15, '#ffffff');
  }

  // =====================================================================
  //  SHOP (between days)
  // =====================================================================
  const SHOP = {};
  function startShop() {
    SHOP.sel = 0; SHOP.cat = 0; SHOP.buyMsg = ''; SHOP.buyMsgT = 0;
    SHOP.consum = [ { id: 'heavy', name: 'HEAVY DARTS x3', cost: 35, give: () => S.ammo.heavy += 3 },
                    { id: 'net', name: 'CAPTURE NET x1', cost: 45, give: () => S.ammo.net += 1 } ];
    phase = 'shop';
    persist();
  }
  function shopList() {
    const list = UPGRADES.map(u => ({ kind: 'up', u })).concat(SHOP.consum.map(c => ({ kind: 'con', c })));
    return list;
  }
  function updateShop(dt) {
    if (SHOP.buyMsgT > 0) SHOP.buyMsgT -= dt;
    const list = shopList();
    const cols = 2; const rows = Math.ceil(list.length / cols);
    if (keyPressed('ArrowDown') || keyPressed('KeyS')) { SHOP.sel = Math.min(list.length - 1, SHOP.sel + cols); A.play('select'); }
    if (keyPressed('ArrowUp') || keyPressed('KeyW')) { SHOP.sel = Math.max(0, SHOP.sel - cols); A.play('select'); }
    if (keyPressed('ArrowRight') || keyPressed('KeyD')) { SHOP.sel = Math.min(list.length - 1, SHOP.sel + 1); A.play('select'); }
    if (keyPressed('ArrowLeft') || keyPressed('KeyA')) { SHOP.sel = Math.max(0, SHOP.sel - 1); A.play('select'); }
    // mouse
    for (let i = 0; i < list.length; i++) { const L = shopCard(i); if (mouse.x > L.x && mouse.x < L.x + L.w && mouse.y > L.y && mouse.y < L.y + L.h) { SHOP.sel = i; if (mouse.clicked) buyItem(); } }
    if (keyPressed('Enter') || keyPressed('Space')) buyItem();
    // next day
    if (mouse.clicked && mouse.x > W - 70 && mouse.y < 16) nextDay();
    if (keyPressed('KeyN')) nextDay();
  }
  function shopCard(i) { const cols = 2; const col = i % cols, row = Math.floor(i / cols); return { x: 12 + col * 150, y: 30 + row * 24, w: 142, h: 21 }; }
  function buyItem() {
    const list = shopList(); const it = list[SHOP.sel]; if (!it) return;
    if (it.kind === 'up') {
      const u = it.u; const lvl = S.up[u.id]; if (lvl >= u.max) { SHOP.buyMsg = 'MAXED OUT'; SHOP.buyMsgT = 1.4; A.play('empty'); return; }
      const cost = u.cost(lvl);
      if (S.money < cost) { SHOP.buyMsg = 'NOT ENOUGH $'; SHOP.buyMsgT = 1.4; A.play('empty'); return; }
      S.money -= cost; S.up[u.id]++; A.play('buy'); if (u.id === 'ench') {} SHOP.buyMsg = u.name + ' UP!'; SHOP.buyMsgT = 1.4; A.play('levelup'); persist();
    } else {
      const c = it.c; if (S.money < c.cost) { SHOP.buyMsg = 'NOT ENOUGH $'; SHOP.buyMsgT = 1.4; A.play('empty'); return; }
      S.money -= c.cost; c.give(); A.play('buy'); SHOP.buyMsg = c.name + ' BOUGHT'; SHOP.buyMsgT = 1.4; persist();
    }
  }
  function nextDay() {
    A.play('confirm'); S.day++; if (S.totalCaptured > S.best) S.best = S.totalCaptured; persist();
    startFade(() => startBrief());
  }

  // =====================================================================
  //  MAIN LOOP
  // =====================================================================
  let last = performance.now();
  function frame(now) {
    let dt = (now - last) / 1000; last = now;
    if (dt > 0.05) dt = 0.05; // clamp
    t += dt;
    update(dt);
    render();
    clearEdges();
    requestAnimationFrame(frame);
  }
  function update(dt) {
    applyTouch();
    // fade transitions
    if (fadeTarget === 1) { fade += dt * 3.2; if (fade >= 1) { fade = 1; fadeTarget = 0; if (fadeCb) { const cb = fadeCb; fadeCb = null; cb(); } } }
    else if (fade > 0) { fade -= dt * 3.2; if (fade < 0) fade = 0; }

    if (shake > 0) shake = Math.max(0, shake - dt * 22);
    if (flash > 0) flash = Math.max(0, flash - dt * 2.4);

    // particles + floats always
    for (let i = parts.length - 1; i >= 0; i--) { const p = parts[i]; p.vy += p.grav * dt; p.x += p.vx; p.y += p.vy; p.life -= dt; if (p.life <= 0) parts.splice(i, 1); }
    for (let i = floats.length - 1; i >= 0; i--) { const f = floats[i]; f.y -= dt * 14; f.life -= dt; if (f.life <= 0) floats.splice(i, 1); }

    if (fadeTarget === 1 && fade > 0.5) { /* mid-transition, skip phase update to avoid input bleed */ }

    switch (phase) {
      case 'menu': updateMenu(dt); break;
      case 'brief': updateBrief(dt); break;
      case 'expedition': updateExpedition(dt); break;
      case 'sanctuary': updateSanctuary(dt); break;
      case 'shop': updateShop(dt); break;
    }
  }

  function render() {
    ctx.save();
    let ox = 0, oy = 0;
    if (shake > 0.2) { ox = (Math.random() - 0.5) * shake; oy = (Math.random() - 0.5) * shake; ctx.translate(ox | 0, oy | 0); }

    switch (phase) {
      case 'boot': rectf(0, 0, W, H, '#05080a'); break;
      case 'menu': renderMenu(); break;
      case 'brief': renderBrief(); break;
      case 'expedition': renderExpedition(); break;
      case 'sanctuary': renderSanctuary(); break;
      case 'shop': renderShop(); break;
    }

    // global particles/floats drawn in each phase's space where relevant; also draw screen-space ones
    ctx.restore();

    // flash
    if (flash > 0.01) { ctx.globalAlpha = flash; rectf(0, 0, W, H, flashCol); ctx.globalAlpha = 1; }
    // fade
    if (fade > 0.001) { ctx.globalAlpha = fade; rectf(0, 0, W, H, '#05080a'); ctx.globalAlpha = 1; }

    // cursor (crosshair) except menus use pointer
    drawCursor();
  }

  function drawCursor() {
    if (phase === 'expedition' && !EXP.done && !EXP.P.dead) {
      const x = mouse.x | 0, y = mouse.y | 0;
      ctx.fillStyle = '#f2f0d0';
      ctx.fillRect(x - 4, y, 3, 1); ctx.fillRect(x + 2, y, 3, 1); ctx.fillRect(x, y - 4, 1, 3); ctx.fillRect(x, y + 2, 1, 3);
      ctx.fillStyle = 'rgba(242,240,208,0.5)'; ctx.fillRect(x, y, 1, 1);
    } else {
      const x = mouse.x | 0, y = mouse.y | 0;
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.fillRect(x, y, 2, 2); ctx.fillRect(x, y + 2, 1, 3); ctx.fillRect(x + 1, y + 2, 3, 1);
      ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(x + 1, y + 5, 2, 1);
    }
  }

  // draw particles helper (world offset)
  function drawParts(offy) {
    for (const p of parts) { ctx.globalAlpha = clamp(p.life / p.max, 0, 1); ctx.fillStyle = p.col; ctx.fillRect((p.x) | 0, (p.y - (offy || 0)) | 0, p.size, p.size); }
    ctx.globalAlpha = 1;
  }
  function drawFloats(offy) {
    for (const f of floats) { ctx.globalAlpha = clamp(f.life, 0, 1); drawTextShadow(ctx, f.str, f.x, f.y - (offy || 0), f.col, 1, 'center'); }
    ctx.globalAlpha = 1;
  }

  // =====================================================================
  //  RENDER: MENU
  // =====================================================================
  let leaves = [], motes = [];
  function ensureLeaves() {
    if (leaves.length) return;
    for (let i = 0; i < 22; i++) leaves.push({ x: rnd(0, W), y: rnd(0, H), s: irnd(2, 4), r: rnd(0, 6.28), sp: rnd(5, 13), c: pick(['#3d7f2a', '#4f9a34', '#2f6a24', '#e8a13a', '#d4b23a']) });
    for (let i = 0; i < 24; i++) motes.push({ x: rnd(0, W), y: rnd(0, H), sp: rnd(2, 6), ph: rnd(0, 6.28) });
  }
  function drawMenuMacaw(x, y) {
    const flap = Math.sin(t * 6) * 2;
    ellipse(x, y - 2, 3, 4, '#e83a2e');                                   // body
    ctx.fillStyle = '#f2d13a'; ctx.fillRect(x - 3, y - 4 - Math.abs(flap), 3, 2 + Math.abs(flap)); // wing
    circ(x + 1, y - 5, 2, '#e83a2e'); px(x + 2, y - 6, '#111');
    rectf(x + 2, y - 5, 2, 1, '#1a1a22');                                 // beak
    rectf(x - 5, y, 5, 1, '#2a6ad0');                                     // tail
  }
  function renderMenu() {
    ensureLeaves();
    // deep sky with a slow dawn drift
    const dawn = (Math.sin(t * 0.08) * 0.5 + 0.5);
    ditherV(0, 0, W, H, mix('#123a2a', '#1a4658', dawn * 0.5), mix('#2a6a44', '#357a58', dawn * 0.4));
    // sun glow behind the canopy
    ctx.globalAlpha = 0.45; circ(W * 0.66, 44, 20, mix('#f2e6a0', '#f0c070', dawn)); ctx.globalAlpha = 0.18; circ(W * 0.66, 44, 34, '#f2e6a0'); ctx.globalAlpha = 1;
    // distant hills
    for (let p = 0; p < 2; p++) { const hc = mix('#0d2a1e', '#274a54', 0.25 + p * 0.2); for (let x = -10; x < W + 30; x += 40) { const h = 18 + ((x * 7 + p * 20) % 16); ellipse(x, 58 + p * 8, 26, h, hc); } }
    // a flock crossing the sky
    for (let i = 0; i < 6; i++) { const bx = ((t * 14 + i * 26) % (W + 60)) - 30; const by = 20 + Math.sin(t * 0.6 + i) * 3 + (i % 3) * 4; const wf = Math.sin(t * 8 + i) * 1.4; ctx.fillStyle = '#0d1f16'; ctx.fillRect((bx - 2) | 0, (by - wf) | 0, 2, 1); ctx.fillRect((bx + 1) | 0, (by - wf) | 0, 2, 1); px(bx | 0, by | 0, '#0d1f16'); }
    // parallax canopy silhouettes
    for (let layer = 0; layer < 4; layer++) {
      const yy = 32 + layer * 28; const col = ['#0d2a1e', '#123725', '#17442d', '#1c5030'][layer];
      const drift = Math.sin(t * (0.2 + layer * 0.05)) * (layer + 1);
      for (let x = -10; x < W + 24; x += 24) { const h = 16 + ((x * 7 + layer * 13) % 16); ellipse(x + drift, yy, 20, h, col); }
    }
    // god rays
    ctx.globalAlpha = 0.10; ctx.fillStyle = '#f4ecb0';
    for (let i = 0; i < 4; i++) { const x = 20 + i * 78 + Math.sin(t * 0.3 + i) * 6; ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + 24, 0); ctx.lineTo(x + 54, H); ctx.lineTo(x + 16, H); ctx.closePath(); ctx.fill(); }
    ctx.globalAlpha = 1;
    // floating dust motes
    for (const m of motes) { m.y -= m.sp * 0.01; m.x += Math.sin(t * 0.5 + m.ph) * 0.08; if (m.y < 0) { m.y = H; m.x = rnd(0, W); } ctx.globalAlpha = 0.25 + Math.sin(t * 2 + m.ph) * 0.2; px(m.x | 0, m.y | 0, '#e8f0c0'); } ctx.globalAlpha = 1;
    // swinging monkey on a vine
    const sw = Math.sin(t * 1.6); const mvx = 34 + sw * 10;
    ctx.strokeStyle = '#2e6a24'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(38, 18); ctx.lineTo(mvx, 58); ctx.stroke();
    ellipse(mvx, 60, 3, 4, '#4a3320'); circ(mvx, 56, 2, '#4a3320'); px(mvx - 1, 55, '#f0d6a8'); px(mvx + 1, 55, '#f0d6a8');
    // river along the bottom
    const ry = H - 18; ditherV(0, ry, W, 18, '#2f6a8a', '#12324a'); rectf(0, ry, W, 1, '#8fd0e8');
    ctx.globalAlpha = 0.4; ctx.fillStyle = '#bfe4f0'; for (let i = 0; i < 12; i++) { const rx = ((i * 30 + t * 18) % (W + 20)) - 10; ctx.fillRect(rx | 0, ry + 4 + (i % 3) * 4, 4, 1); } ctx.globalAlpha = 1;
    // drifting leaves
    for (const lf of leaves) { lf.y += lf.sp * 0.016; lf.x += Math.sin(t + lf.r) * 0.3; lf.r += 0.02; if (lf.y > H + 8) { lf.y = -6; lf.x = rnd(0, W); } ctx.globalAlpha = 0.7; ctx.fillStyle = lf.c; ctx.fillRect(lf.x | 0, lf.y | 0, lf.s, lf.s - 1); ctx.globalAlpha = 1; }
    // fireflies
    for (let i = 0; i < 10; i++) { const fx = (i * 37 + Math.sin(t * 0.6 + i) * 20 + 20) % W; const fy = 74 + Math.sin(t * 0.9 + i * 2) * 26; const gl = Math.sin(t * 3 + i) * 0.5 + 0.5; ctx.globalAlpha = gl * 0.8; px(fx | 0, fy | 0, '#eaff8a'); if (gl > 0.75) { ctx.globalAlpha = 0.3; circ(fx | 0, fy | 0, 2, '#eaff8a'); } } ctx.globalAlpha = 1;
    // foreground framing fronds
    for (let i = 0; i < 5; i++) { const bx = i * (W / 4) - 10; for (let k = 0; k < 5; k++) ellipse(bx + Math.sin(t * 0.5 + i) * 2, H + 4 - k * 5, (6 - k) * 1.6, 2.2, '#08160e'); }
    ellipse(4, 4, 18, 10, '#08160e'); ellipse(W - 4, 4, 18, 10, '#08160e');

    // title with soft glow + perched macaw
    const bob = Math.sin(t * 1.3) * 1;
    ctx.globalAlpha = 0.25; drawTextOutline(ctx, 'CANOPY', W / 2, 24 + bob, '#f6e24a', 3, 'center', '#f6e24a'); ctx.globalAlpha = 1;
    drawTextOutline(ctx, 'CANOPY', W / 2, 24 + bob, '#f2d98a', 3, 'center', '#12300f');
    drawTextOutline(ctx, 'RANGERS', W / 2, 48 + bob, '#8ad06a', 3, 'center', '#12300f');
    drawMenuMacaw(W / 2 + 44, 48 + bob);
    drawTextShadow(ctx, 'AMAZON WILDLIFE HUNTER', W / 2, 72, '#cfe8b0', 1, 'center');

    if (howto) { renderHowto(); return; }

    for (let i = 0; i < menu.items.length; i++) {
      const y = 96 + i * 20; const on = i === menu.sel;
      if (on) { rectf(W / 2 - 68, y - 4, 136, 14, 'rgba(12,34,20,0.82)'); ctx.strokeStyle = 'rgba(246,209,58,0.6)'; ctx.strokeRect(W / 2 - 68.5, y - 4.5, 136, 14); drawText(ctx, '>', W / 2 - 62 + Math.sin(t * 6), y, '#f6d13a', 1, 'left'); }
      drawTextShadow(ctx, menu.items[i], W / 2, y, on ? '#fff2b0' : '#a8c898', on ? 2 : 1, 'center');
    }
    drawTextShadow(ctx, 'BEST CATCH: ' + (S.best || 0) + '   DAY ' + (hasSave ? (loadSaveDay()) : 1), W / 2, H - 8, '#7a9a78', 1, 'center');
    if (TOUCH) drawTextShadow(ctx, 'TAP AN OPTION', W / 2, H - 15, '#6a8a68', 1, 'center');
  }
  function loadSaveDay() { const s = loadSave(); return s ? s.day : 1; }
  function renderHowto() {
    rectf(18, 82, W - 36, H - 92, 'rgba(8,20,14,0.94)');
    ctx.strokeStyle = '#3d7f2a'; ctx.strokeRect(18.5, 82.5, W - 37, H - 93);
    const lines = TOUCH ? [
      'DAY - CLIMB THE RAINFOREST:',
      'LEFT STICK: MOVE / CLIMB / REEL',
      'TAP RIGHT SIDE: AIM + FIRE DART',
      'HOOK BUTTON: GRAPPLE + SWING',
      'JUMP BUTTON: JUMP / LET GO OF ROPE',
      'AMMO BUTTON: DART / HEAVY / NET',
      'FORAGE FRUIT, SEDATE & STOW ANIMALS,',
      'RETURN TO THE TRUCK TO EXTRACT.',
      '',
      'NIGHT - TAP A PEN TO FEED / PLAY.',
      'HAPPY ANIMALS = MORE VISITOR $.',
      '',
      'TAP TO CLOSE',
    ] : [
      'DAY - CLIMB THE RAINFOREST:',
      'MOVE A/D   JUMP SPACE   AIM MOUSE',
      'CLICK: FIRE TRANQ DART',
      'RIGHT-CLICK / F: GRAPPLE + SWING',
      'W/S WHILE SWINGING: REEL IN/OUT',
      '1/2/3: DART / HEAVY / NET',
      'FORAGE FRUIT, SEDATE & STOW ANIMALS,',
      'RETURN TO THE TRUCK TO EXTRACT.',
      '',
      'NIGHT - CLICK A PEN TO FEED / PLAY.',
      'HAPPY ANIMALS = MORE VISITOR $.',
      '',
      'CLICK OR SPACE TO CLOSE',
    ];
    for (let i = 0; i < lines.length; i++) drawText(ctx, lines[i], 24, 88 + i * 7, (i === 0 || i === 9) ? '#f6d13a' : '#cfe8b0', 1, 'left');
  }

  // =====================================================================
  //  RENDER: BRIEF
  // =====================================================================
  function renderBrief() {
    ditherV(0, 0, W, H, '#16323f', '#2a5a5a');
    // faint canopy backdrop
    for (let layer = 0; layer < 3; layer++) { const yy = 30 + layer * 26, col = ['#12303a', '#173a44', '#1c4650'][layer]; for (let x = -10; x < W + 20; x += 26) ellipse(x + Math.sin(t * 0.2 + layer) * 2, yy, 20, 14, col); }
    drawTextOutline(ctx, 'CHOOSE REGION', W / 2, 16, '#f2d98a', 2, 'center', '#12303a');
    drawTextShadow(ctx, 'DAY ' + S.day + '   $' + S.money, W / 2, 38, '#cfe8b0', 1, 'center');
    const avail = regionsAvail();
    for (let i = 0; i < avail; i++) {
      const r = REGIONS[i]; const C = briefCard(i, avail); const cx = C.cx, cw = C.cw, hw = cw / 2; const on = i === brief.sel;
      const y0 = C.y0, h = C.h;
      const lift = on ? -3 : 0;
      rectf(cx - hw, y0 + lift, cw, h, on ? mix(r.tint, '#ffffff', 0.15) : mix(r.tint, '#000000', 0.35));
      ctx.strokeStyle = on ? '#f6d13a' : '#0d2a1e'; ctx.strokeRect((cx - hw) + 0.5, y0 + lift + 0.5, cw - 1, h - 1);
      // mini biome scene: sky + water + canopy
      const sy = y0 + lift + 12;
      ditherV(cx - hw + 2, sy, cw - 4, 24, r.sky[0], r.sky[1]);
      if (r.water) { rectf(cx - hw + 2, sy + 24, cw - 4, 6, mix('#3f7fae', '#173a56', 0.3)); rectf(cx - hw + 2, sy + 24, cw - 4, 1, '#8fd0e8'); }
      else { rectf(cx - hw + 2, sy + 24, cw - 4, 6, mix(r.ground, '#000', 0.2)); }
      if (r.mountains) { ctx.fillStyle = mix(r.sky[1], '#2a3a4a', 0.4); for (let mx = cx - hw + 6; mx < cx + hw - 4; mx += 10) { ctx.beginPath(); ctx.moveTo(mx - 6, sy + 20); ctx.lineTo(mx, sy + 8); ctx.lineTo(mx + 6, sy + 20); ctx.closePath(); ctx.fill(); } }
      for (let b = 0; b < 4; b++) ellipse(cx - hw + 8 + b * (cw / 5), sy + 6 + (b % 2) * 4, 8, 5, mix(r.tint, '#0d2a1e', 0.15));
      drawTextShadow(ctx, r.name, cx, y0 + lift + 2, on ? '#fff2b0' : '#dfeecf', 1, 'center');
      // danger pips
      for (let d = 0; d < 4; d++) { ctx.fillStyle = d < r.danger ? '#e8623a' : '#33443a'; ctx.fillRect(cx - 11 + d * 7, y0 + lift + h - 9, 5, 4); }
      drawText(ctx, 'DANGER', cx, y0 + lift + h - 17, '#cfe8b0', 1, 'center');
      // species icon dots
      const ns = Math.min(5, r.spawn.length);
      for (let s = 0; s < ns; s++) { const a = ANIMALS[r.spawn[s]]; circ(cx - (ns - 1) * 6 + s * 12, sy + 34, 3, a.col[0]); if (a.rarity === 'rare' || a.rarity === 'epic') px(cx - (ns - 1) * 6 + s * 12, sy + 30, RARITY[a.rarity].c); }
    }
    drawTextShadow(ctx, TOUCH ? 'TAP A REGION TO DEPLOY' : 'ARROWS TO CHOOSE - SPACE TO DEPLOY', W / 2, H - 10, '#a8c898', 1, 'center');
    drawParts(0); drawFloats(0);
  }

  // =====================================================================
  //  RENDER: EXPEDITION
  // =====================================================================
  function renderExpedition() {
    const cam = EXP.cam, P = EXP.P, region = EXP.region;
    // sky gradient — biome palette brightened toward the canopy tops
    const hf = clamp(1 - (P.y / EXP.LH), 0, 1);
    const topC = mix(region.sky[0], '#eaf4ff', hf * 0.5);
    const botC = region.sky[1];
    ditherV(0, 0, W, H, topC, botC);

    // distant mountain silhouettes (highlands) — deepest parallax
    if (region.mountains) {
      const my = 70 - (cam * 0.12) % 40;
      for (let pass = 0; pass < 2; pass++) {
        const mc = mix(region.sky[1], '#2a3a4a', 0.4 + pass * 0.25);
        for (let x = -20; x < W + 40; x += 44) { const peak = 26 + ((x * 7 + pass * 30) % 20); ctx.fillStyle = mc; ctx.beginPath(); ctx.moveTo(x - 24, my + 40 + pass * 8); ctx.lineTo(x, my - peak + pass * 8); ctx.lineTo(x + 24, my + 40 + pass * 8); ctx.closePath(); ctx.fill(); }
      }
    }

    // parallax canopy layers (scroll with camera*factor)
    for (let layer = 0; layer < 3; layer++) {
      const f = [0.25, 0.5, 0.78][layer];
      const col = [mix(region.tint, '#0a1810', 0.55), mix(region.tint, '#0d2216', 0.35), mix(region.tint, '#123725', 0.15)][layer];
      ctx.fillStyle = col;
      // repeating foliage blobs; vertical position derived from camera parallax
      const baseY = -((cam * f) % 60);
      for (let yy = baseY - 60; yy < H + 60; yy += 60) {
        for (let x = -20 + (layer * 13); x < W + 20; x += 40) {
          const jitter = ((x * 13 + yy * 7 + layer * 91) % 20);
          ellipse(x + jitter, yy + 20, 22 - layer * 3, 16, col);
        }
      }
    }
    // drifting mist bands (fog) — soft horizontal fog that scrolls slowly
    if (region.fog > 0) {
      ctx.globalAlpha = region.fog * 0.5;
      for (let i = 0; i < 4; i++) {
        const my = ((i * 52 - cam * 0.4) % (H + 60) + H + 60) % (H + 60) - 30;
        const mx = Math.sin(t * 0.25 + i) * 12;
        ctx.fillStyle = '#dfeef0';
        ellipse(W / 2 + mx, my, W * 0.7, 7, '#dfeef0');
      }
      ctx.globalAlpha = 1;
    }
    // god rays
    ctx.globalAlpha = 0.08 + hf * 0.06; ctx.fillStyle = '#f4ecb0';
    for (let i = 0; i < 3; i++) { const x = 40 + i * 110 + Math.sin(t * 0.2 + i) * 8; ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + 26, 0); ctx.lineTo(x + 70, H); ctx.lineTo(x + 30, H); ctx.closePath(); ctx.fill(); }
    ctx.globalAlpha = 1;

    // ground/trunk column (a big central trunk climbing whole level)
    drawTrunk(cam, region);

    // branches
    for (const b of EXP.branches) drawBranch(b, cam, region);
    // forageable pickups
    for (const pk of EXP.pickups) drawPickup(pk, cam);
    // vines
    for (const v of EXP.vines) drawVine(v, cam);
    // truck
    drawTruck(EXP.truck, cam);

    // darts
    for (const d of EXP.darts) drawDart(d, cam);
    // hook + rope
    drawRope(cam);

    // animals
    for (const a of EXP.animals) drawAnimal(a, cam);

    // player
    if (!P.dead || Math.floor(t * 10) % 2) drawHunter(P, cam);

    // particles (world space)
    drawParts(cam); drawFloats(cam);

    // foreground framing ferns + vignette for depth
    drawForeground(cam);

    // extraction wipe
    if (EXP.extracting) { const e = clamp(EXP.extractT / 1.1, 0, 1); ctx.globalAlpha = e; rectf(0, 0, W, H, '#ffe6a0'); ctx.globalAlpha = 1; }

    renderExpHUD();
    if (TOUCH) drawTouchControls();
  }

  function drawForeground(cam) {
    const region = EXP.region;
    // out-of-focus dark fronds hugging the bottom corners
    ctx.fillStyle = mix(region.tint, '#050a06', 0.72);
    for (const fn of EXP.foreFerns) {
      const sway = Math.sin(t * 0.8 + fn.x) * 2;
      const bx = fn.x + sway, by = H + 2;
      for (let i = 0; i < 6; i++) { const fy = by - i * (fn.h / 6); const fw = (6 - i) * fn.s; ellipse(bx, fy, fw, 2.2 * fn.s, mix(region.tint, '#050a06', 0.72)); }
    }
    // soft vignette
    ctx.globalAlpha = 0.22; rectf(0, 0, W, 10, '#050a06'); rectf(0, H - 12, W, 12, '#050a06');
    ctx.fillStyle = '#050a06'; rectf(0, 0, 6, H, '#050a06'); rectf(W - 6, 0, 6, H, '#050a06'); ctx.globalAlpha = 1;
  }

  function drawPickup(pk, cam) {
    if (pk.got) return;
    const y = pk.y - cam + Math.sin(t * 3 + pk.bob) * 1.2; if (y < -10 || y > H + 10) return;
    const d = pk.def; const gl = (Math.sin(t * 4 + pk.bob) * 0.5 + 0.5);
    ctx.globalAlpha = 0.25 + gl * 0.25; circ(pk.x, y, d.r + 2, d.col); ctx.globalAlpha = 1;
    if (pk.key === 'fruit') { circ(pk.x, y, d.r, d.col); px(pk.x, y - d.r, '#3a7a2a'); px(pk.x - 1, y - 1, mix(d.col, '#fff', 0.5)); }
    else if (pk.key === 'egg') { ellipse(pk.x, y, d.r - 1, d.r, d.col); px(pk.x - 1, y - 1, '#fff'); px(pk.x + 1, y, mix(d.col, '#000', 0.15)); }
    else { // orchid
      ctx.fillStyle = d.col; for (let a2 = 0; a2 < 5; a2++) { const ang = a2 / 5 * 6.28 + t * 0.5; px(pk.x + Math.cos(ang) * 3, y + Math.sin(ang) * 3, d.col); }
      circ(pk.x, y, 1, '#f6e24a');
    }
    // sparkle glints
    if (Math.floor(t * 6 + pk.bob) % 5 === 0) px(pk.x + irnd(-d.r, d.r), y - irnd(0, d.r), '#fff');
  }

  // on-screen virtual gamepad (mobile)
  function drawTouchControls() {
    const P = EXP.P; if (!P || EXP.done || P.dead) return;
    // movement stick
    if (stick.active) {
      ctx.globalAlpha = 0.28; circ(stick.ax, stick.ay, 18, '#dfeecf'); ctx.globalAlpha = 1;
      const dx = clamp(stick.x - stick.ax, -16, 16), dy = clamp(stick.y - stick.ay, -16, 16);
      ctx.globalAlpha = 0.6; circ(stick.ax + dx, stick.ay + dy, 7, '#f2f0d0'); ctx.globalAlpha = 1;
    } else {
      // faint idle hint ring so first-time players know where to plant a thumb
      ctx.globalAlpha = 0.13; circ(30, H - 40, 15, '#dfeecf');
      ctx.globalAlpha = 0.4; ctx.strokeStyle = '#cfe8b0'; ctx.beginPath(); ctx.arc(30, H - 40, 15, 0, 6.283); ctx.stroke(); ctx.globalAlpha = 1;
    }
    // buttons
    for (const b of padButtons()) {
      const held = !!tbtn[b.id];
      ctx.globalAlpha = held ? 0.55 : 0.32; circ(b.x, b.y, b.r, held ? '#f6d13a' : '#12241a'); ctx.globalAlpha = 0.8;
      ctx.strokeStyle = '#cfe8b0'; ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, 6.283); ctx.stroke();
      let lbl = b.label; if (b.id === 'ammo') lbl = P.ammoType === 'net' ? 'NET' : P.ammoType === 'heavy' ? 'HVY' : 'DART';
      drawText(ctx, lbl, b.x, b.y - 2, '#fff2b0', 1, 'center'); ctx.globalAlpha = 1;
    }
  }

  function drawTrunk(cam, region) {
    const tx = W / 2 - 16;
    // main trunk spanning level
    for (let x = 0; x < 32; x++) {
      const shade = x < 6 ? 0.0 : x < 12 ? 0.15 : x < 22 ? 0.35 : x < 27 ? 0.2 : 0.05;
      // not used per-column gradient; draw bands
    }
    ditherV(tx, 0, 32, H, mix('#6b4a2c', '#3a2414', 0.2), mix('#4a3018', '#2a1a0e', 0.2));
    // bark lines
    ctx.fillStyle = 'rgba(30,18,10,0.5)';
    for (let y = -(cam % 18); y < H; y += 18) { ctx.fillRect(tx + 6, y, 1, 12); ctx.fillRect(tx + 20, y + 6, 1, 10); ctx.fillRect(tx + 26, y + 2, 1, 8); }
    // moss highlight
    ctx.fillStyle = 'rgba(90,150,70,0.25)';
    for (let y = -(cam % 30); y < H; y += 30) ctx.fillRect(tx + 2, y, 3, 6);
  }

  function drawBranch(b, cam, region) {
    const y = b.y - cam;
    if (y < -20 || y > H + 20) return;
    if (b.ground) {
      const gcol = region.ground;
      if (region.water) {
        // earthy bank, then a flowing river down to the bottom of the screen
        const bankH = 5;
        ditherV(0, y, W, bankH, mix(gcol, '#6a5a2a', 0.4), mix(gcol, '#2a1c10', 0.3));
        const wy = y + bankH;
        ditherV(0, wy, W, H - wy + 4, '#3f7fae', '#173a56');
        rectf(0, wy, W, 1, '#9fd0e8');                       // surface glint
        ctx.globalAlpha = 0.4; ctx.fillStyle = '#bfe4f0';    // drifting ripples
        for (let i = 0; i < 10; i++) { const rx = ((i * 41 + t * 22) % (W + 20)) - 10; const ry = wy + 4 + (i % 4) * 5; ctx.fillRect(rx | 0, ry | 0, 4, 1); }
        ctx.globalAlpha = 0.14; for (let i = 0; i < 3; i++) { const rx = 40 + i * 110 + Math.sin(t * 0.2 + i) * 8; rectf(rx, wy, 9, H - wy, '#eaf4ff'); } ctx.globalAlpha = 1;
      } else {
        ditherV(0, y, W, H - y + 4, mix(gcol, '#3a2a16', 0.4), '#161008');
      }
      ctx.fillStyle = mix(gcol, '#000', 0.35); ctx.fillRect(0, y, W, 1);
      // grassy fringe or ferns along the floor
      if (region.grass) {
        for (let x = 2; x < W; x += 5) { const gh = 2 + ((x * 7) % 4); const sway = Math.sin(t * 1.2 + x) * 0.6; px((x + sway) | 0, y - gh, mix(region.tint, '#1f5a2a', 0.5)); px((x + sway) | 0, y - gh + 1, mix(region.tint, '#1f5a2a', 0.4)); }
        ctx.fillStyle = mix(region.tint, '#a8e060', 0.4); for (let x = 4; x < W; x += 12) ctx.fillRect(x, y - 1, 1, 1);
      } else {
        ctx.fillStyle = '#1f5a2a'; for (let x = 4; x < W; x += 16) { ctx.fillRect(x, y - 4, 1, 4); ctx.fillRect(x - 2, y - 2, 5, 1); }
      }
      return;
    }
    // shadow
    ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.fillRect(b.x + 3, y + 5, b.w, 2);
    // branch body with rounded shading
    rectf(b.x, y, b.w, 6, '#5a3a1e');
    rectf(b.x, y, b.w, 2, '#7a5230');
    rectf(b.x, y + 5, b.w, 1, '#31200f');
    // mossy top on grassy branches
    if (b.grass) {
      rectf(b.x, y, b.w, 1, mix(region.tint, '#5aa03a', 0.5));
      ctx.fillStyle = mix(region.tint, '#2f6a24', 0.5);
      for (let x = b.x + 2; x < b.x + b.w - 1; x += 4) { const gh = 2 + ((x * 5) % 3); const sway = Math.sin(t * 1.1 + x) * 0.5; ctx.fillRect((x + sway) | 0, y - gh, 1, gh); }
    }
    // leaf clumps on top
    ctx.fillStyle = mix(region.tint, '#0d2a1e', 0.1);
    for (let x = b.x + 4; x < b.x + b.w; x += 12) { ellipse(x, y - 3, 8, 5, mix(region.tint, '#0d2a1e', 0.05)); }
    ctx.fillStyle = mix(region.tint, '#ffffff', 0.2);
    for (let x = b.x + 6; x < b.x + b.w; x += 14) ellipse(x, y - 5, 5, 3, mix(region.tint, '#a8e060', 0.25));
  }

  function drawVine(v, cam) {
    const topY = v.ay - cam; if (topY > H + 10 || topY + v.len < -10) return;
    const sway = Math.sin(v.sway + t) * 3;
    ctx.strokeStyle = '#2e6a24'; ctx.lineWidth = 1; ctx.beginPath();
    for (let s = 0; s <= v.len; s += 3) { const xx = v.ax + Math.sin(v.sway + t) * (s / v.len) * 3; const yy = topY + s; if (s === 0) ctx.moveTo(xx, yy); else ctx.lineTo(xx, yy); }
    ctx.stroke();
    // leaves
    ctx.fillStyle = '#3d7f2a';
    for (let s = 8; s < v.len; s += 12) { const xx = v.ax + Math.sin(v.sway + t) * (s / v.len) * 3; ctx.fillRect((xx - 2) | 0, (topY + s) | 0, 2, 3); ctx.fillRect((xx + 1) | 0, (topY + s + 3) | 0, 2, 2); }
  }

  function drawTruck(tr, cam) {
    const x = tr.x, y = tr.y - cam;
    if (y < -30 || y > H + 30) return;
    shadow(x, y + 4, 18, 0.3);
    // jeep body
    rectf(x - 16, y - 12, 32, 12, '#3a5a3a');
    rectf(x - 16, y - 12, 32, 3, '#5a7a4a');
    rectf(x - 10, y - 18, 16, 7, '#2a4a2a'); // cab
    rectf(x - 9, y - 17, 6, 5, '#8ac0e0'); // window
    // cage on back
    ctx.strokeStyle = '#caa060'; for (let i = 0; i < 4; i++) ctx.strokeRect(x + 2 + i * 3 - 0.5 + 0.5, y - 11.5, 3, 10);
    rectf(x + 2, y - 12, 12, 1, '#caa060');
    // wheels
    circ(x - 10, y, 3, '#161210'); circ(x + 9, y, 3, '#161210');
    circ(x - 10, y, 1, '#4a4038'); circ(x + 9, y, 1, '#4a4038');
    // flag / marker
    drawTextShadow(ctx, 'TRUCK', x, y - 27, '#f6d13a', 1, 'center');
    if (EXP.nearTruck && !EXP.extracting) { if (Math.floor(t * 2) % 2) drawTextShadow(ctx, 'PRESS E: DRIVE TO SANCTUARY (' + EXP.cargo.length + ')', x, y - 36, '#fff2b0', 1, 'center'); }
  }

  function drawDart(d, cam) {
    const y = d.y - cam;
    if (d.net) {
      ctx.fillStyle = '#e8ecd8'; circ(d.x, y, 3, 'rgba(220,228,208,0.6)');
      ctx.strokeStyle = '#b8c0a8'; ctx.strokeRect(d.x - 3.5, y - 3.5, 7, 7);
    } else {
      const ang = Math.atan2(d.vy, d.vx);
      ctx.save(); ctx.translate(d.x, y); ctx.rotate(ang);
      rectf(-3, -0.5, 6, 1, d.type === 'heavy' ? '#e85a3a' : '#d8e070');
      rectf(2, -0.5, 2, 1, '#f2f0d0');
      rectf(-4, -1, 1, 2, '#f2748f');
      ctx.restore();
    }
  }

  function drawRope(cam) {
    const P = EXP.P;
    if (P.rope) {
      const ax = P.rope.ax, ay = P.rope.ay - cam;
      ctx.strokeStyle = '#8a6a3a'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(P.x, P.y - cam - 2); ctx.stroke();
      // anchor
      rectf(ax - 1, ay - 1, 3, 3, '#caa060');
    } else if (EXP.hook) {
      const hk = EXP.hook; ctx.strokeStyle = '#8a6a3a'; ctx.beginPath(); ctx.moveTo(P.x, P.y - cam - 2); ctx.lineTo(hk.x, hk.y - cam); ctx.stroke();
      rectf(hk.x - 1, hk.y - cam - 1, 3, 3, '#caa060');
    }
  }

  // ---- draw hunter ----
  function drawHunter(P, cam) {
    const x = P.x | 0, y = (P.y - cam) | 0, f = P.face;
    shadow(x, P.onGround ? (P.y - cam + 6) : (P.y - cam + 8), 6, 0.25);
    const flick = P.invuln > 0 && Math.floor(t * 20) % 2;
    ctx.globalAlpha = flick ? 0.4 : 1;
    const swing = P.rope ? Math.sin(t * 8) * 1 : 0;
    // legs
    const legPhase = Math.sin(P.climbAnim);
    ctx.fillStyle = '#3a4a2a';
    ctx.fillRect(x - 3, y + 2, 2, 4 + (P.rope ? 0 : Math.max(0, legPhase) * 2));
    ctx.fillRect(x + 1, y + 2, 2, 4 + (P.rope ? 0 : Math.max(0, -legPhase) * 2));
    // boots
    ctx.fillStyle = '#2a1c12'; ctx.fillRect(x - 3, y + 6, 3, 2); ctx.fillRect(x + 1, y + 6, 3, 2);
    // torso (ranger vest)
    rectf(x - 4, y - 4, 8, 7, '#4a7a3a');
    rectf(x - 4, y - 4, 8, 2, '#6a9a4a');
    // belt + pouches
    rectf(x - 4, y + 1, 8, 1, '#2a1c12'); rectf(x - 4, y, 2, 2, '#7a5a2a');
    // backpack (cargo)
    ctx.fillStyle = '#7a5a34'; ctx.fillRect(x - 6 * f - (f < 0 ? -1 : 0), y - 3, 3, 6);
    // head + hat
    circ(x, y - 7, 3, '#e0b088');
    rectf(x - 4, y - 9, 8, 2, '#5a4326'); // hat brim
    rectf(x - 2, y - 11, 4, 2, '#6a5030');
    // arm holding tranq gun toward aim
    const aimx = mouse.x, aimy = mouse.y + cam;
    let dx = aimx - P.x, dy = aimy - (P.y - 2); const dl = Math.sqrt(dx * dx + dy * dy) || 1; dx /= dl; dy /= dl;
    const gx = x + dx * 6, gy = (y - 2) + dy * 6;
    ctx.strokeStyle = '#e0b088'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x, y - 2); ctx.lineTo(gx, gy); ctx.stroke();
    // gun
    ctx.save(); ctx.translate(gx, gy); ctx.rotate(Math.atan2(dy, dx));
    rectf(0, -1, 7, 2, '#3a4048'); rectf(6, -0.5, 2, 1, '#8ad0e8'); rectf(-1, -1, 2, 3, '#2a3038');
    ctx.restore();
    ctx.globalAlpha = 1;
    // muzzle flash after fire
    ctx.lineWidth = 1;
  }

  // ---- draw animals ----
  function drawAnimal(a, cam) {
    const y = (a.y - cam) | 0, x = a.x | 0, def = a.def;
    if (y < -30 || y > H + 30) return;
    const c = def.col;
    if (!a.asleep) shadow(x, (a.onGround ? (a.branch ? a.branch.y - cam : y + def.r) : y + def.r + 4), def.r * 0.8, 0.22);
    const wince = a.wince > 0 ? (Math.random() - 0.5) * 2 : 0;
    ctx.save(); ctx.translate(x + wince, y);
    const dir = a.dir || 1;

    switch (a.key) {
      case 'parrot': case 'toucan': case 'macaw2': {
        const flap = Math.sin(t * 14) * 3;
        // body
        ellipse(0, 0, 5, 4, c[0]);
        ellipse(1 * dir, -1, 3, 3, c[2] || c[0]);
        // wing
        ctx.fillStyle = mix(c[0], '#000', 0.2); ctx.fillRect(-2, -3 - Math.abs(flap), 4, 2 + Math.abs(flap));
        // tail
        rectf(-6 * dir, 0, 4, 2, c[1]);
        // head + beak
        circ(4 * dir, -3, 2, c[1]);
        ctx.fillStyle = a.key === 'toucan' ? '#f2a03a' : '#e8d048'; ctx.fillRect((5 * dir) | 0, -3, 3 * dir, a.key === 'toucan' ? 3 : 1);
        px(4 * dir, -4, '#111');
        break;
      }
      case 'monkey': {
        ellipse(0, 1, 4, 5, c[0]); // body
        ellipse(0, -4, 3, 3, c[0]); // head
        circ(0, -4, 2, c[2]); // face
        px(-1, -4, '#111'); px(1, -4, '#111');
        // limbs
        ctx.fillStyle = c[1]; ctx.fillRect(-4, 0, 2, 4); ctx.fillRect(2, 0, 2, 4);
        // tail curl
        ctx.strokeStyle = c[1]; ctx.beginPath(); ctx.arc(5 * dir, 2, 3, 0, Math.PI); ctx.stroke();
        break;
      }
      case 'boar': {
        ellipse(0, 0, 7, 4, c[0]);
        rectf(-8 * dir, -1, 4, 4, c[1]); // snout
        px(-8 * dir, -1, '#f2f0d0'); px(-7 * dir, -1, '#f2f0d0'); // tusks
        px(2 * dir, -2, '#111');
        ctx.fillStyle = c[2]; ctx.fillRect(-6, -4, 8, 2); // bristles
        rectf(-4, 3, 2, 3, c[2]); rectf(3, 3, 2, 3, c[2]); // legs
        if (a.state === 'charge') burst(x + wince - dir * 8, y + 3, 1, '#c9a060', 0.6, 3);
        break;
      }
      case 'snake': {
        ctx.fillStyle = c[0];
        for (let s = -6; s <= 6; s++) { const yy = Math.sin(s * 0.6 + t * (a.state === 'strike' ? 0 : 3)) * 3; ctx.fillRect(s, yy - 1, 2, 2); }
        const hx = a.state === 'strike' ? 8 * dir : 6 * dir;
        circ(hx, Math.sin(6 * 0.6 + t * 3) * 3, 2, c[1]); px(hx + dir, -1, '#111');
        if (a.state === 'strike') { ctx.fillStyle = c[2]; ctx.fillRect((hx + dir) | 0, 0, dir, 2); }
        break;
      }
      case 'sloth': {
        ellipse(0, 0, 6, 5, c[0]);
        circ(0, -4, 3, c[1]);
        px(-1, -4, '#111'); px(1, -4, '#111');
        ctx.strokeStyle = c[2]; ctx.beginPath(); ctx.arc(-4, -6, 3, 0, Math.PI * 1.2); ctx.stroke();
        ctx.strokeStyle = c[2]; ctx.beginPath(); ctx.arc(4, -6, 3, Math.PI * -0.2, Math.PI); ctx.stroke();
        break;
      }
      case 'jaguar': {
        ellipse(0, 0, 9, 5, c[0]);
        // spots
        ctx.fillStyle = c[2]; for (let i = -6; i < 8; i += 4) ctx.fillRect(i, -2 + (i % 8 === 0 ? 2 : 0), 2, 2);
        ellipse(8 * dir, -3, 3, 3, c[0]); // head
        rectf(6 * dir, 0, 2, 4, c[1]); rectf(-6, 3, 2, 3, c[1]); // legs
        px(9 * dir, -3, '#f2d13a'); px(7 * dir, -3, '#f2d13a');
        rectf(-10 * dir, -1, 5, 2, c[1]); // tail
        if (a.state === 'pounce') { ctx.globalAlpha = 0.4; circ(0, 0, 11, '#f2d13a'); ctx.globalAlpha = 1; }
        break;
      }
      case 'goldfrog': {
        ellipse(0, 0, 5, 4, c[0]);
        circ(-3, -3, 2, c[0]); circ(3, -3, 2, c[0]);
        px(-3, -3, '#111'); px(3, -3, '#111');
        ctx.fillStyle = c[2]; ctx.fillRect(-1, 0, 3, 1);
        // sparkle
        if (Math.floor(t * 6) % 3 === 0) px(irnd(-4, 4), irnd(-4, 2), '#fff');
        break;
      }
      case 'hummer': {
        const blur = Math.sin(t * 40) * 3;
        ellipse(0, 0, 3, 3, c[0]);            // iridescent body
        px(0, -1, mix(c[0], '#fff', 0.4));
        ctx.fillStyle = c[1]; ctx.fillRect(-1, 1, 2, 1); // throat
        // blurred wings
        ctx.globalAlpha = 0.5; ctx.fillStyle = mix(c[0], '#fff', 0.5);
        ctx.fillRect(-4, -2 - Math.abs(blur), 3, 1 + Math.abs(blur)); ctx.fillRect(1, -2 - Math.abs(blur), 3, 1 + Math.abs(blur)); ctx.globalAlpha = 1;
        // long needle beak
        rectf(3 * dir, -1, 4 * dir, 1, '#2a2a2a');
        px(2 * dir, -1, '#111');
        break;
      }
      case 'morpho': {
        const fl = (Math.sin(t * 8) * 0.5 + 0.5);            // 0..1 wing open
        const wy = 1 + fl * 3;
        ctx.fillStyle = c[0];
        ellipse(-2, 0, 3, wy, c[0]); ellipse(2, 0, 3, wy, c[0]);           // wings
        ctx.fillStyle = mix(c[0], c[1], 0.6);
        ellipse(-2, -1, 2, Math.max(1, wy - 1), mix(c[0], c[1], 0.6)); ellipse(2, -1, 2, Math.max(1, wy - 1), mix(c[0], c[1], 0.6));
        ctx.fillStyle = c[2]; ctx.fillRect(-0.5, -2, 1, 5);                // body
        px(-1, -3, '#111'); px(1, -3, '#111');                            // antennae dots
        break;
      }
      case 'heron': {
        // long legs
        ctx.fillStyle = c[2]; ctx.fillRect(-2, 3, 1, 5); ctx.fillRect(1, 3, 1, 5);
        ellipse(0, 1, 5, 3, c[0]);            // body
        ctx.fillStyle = mix(c[1], '#000', 0.1); ctx.fillRect(-4, 0, 5, 2); // folded wing
        // S-neck + head
        ctx.fillStyle = c[0]; ctx.fillRect((2 * dir) | 0, -5, 1, 6);
        circ(3 * dir, -6, 2, c[0]);
        rectf(4 * dir, -6, 4 * dir, 1, c[2]);  // dagger beak
        px(3 * dir, -7, '#111');
        break;
      }
      case 'harpy': {
        const diving = a.state === 'dive';
        if (diving) { ctx.globalAlpha = 0.35; circ(0, 0, 12, '#f2c83a'); ctx.globalAlpha = 1; }
        // spread wings
        ctx.fillStyle = mix(c[0], '#000', 0.15);
        const wf = diving ? 6 : Math.sin(t * 8) * 2;
        ctx.fillRect(-11, -2 - wf * 0.3, 8, 3); ctx.fillRect(3, -2 - wf * 0.3, 8, 3);
        ellipse(0, 0, 6, 4, c[0]);             // body
        ctx.fillStyle = c[1]; ctx.fillRect(-2, 1, 5, 3);   // pale chest
        circ(5 * dir, -3, 3, c[1]);            // head
        // face crest
        px(4 * dir, -6, c[0]); px(6 * dir, -6, c[0]);
        ctx.fillStyle = c[2]; ctx.fillRect((6 * dir) | 0, -3, 2 * dir, 2); // hooked beak
        px(5 * dir, -4, '#111');
        // talons
        ctx.fillStyle = c[2]; ctx.fillRect(-2, 4, 1, 2); ctx.fillRect(1, 4, 1, 2);
        break;
      }
      case 'capybara': {
        ellipse(0, 0, 8, 5, c[0]);             // barrel body
        ellipse(6 * dir, -2, 3, 3, c[1]);      // blunt head
        rectf(8 * dir, -1, 2, 2, c[2]);        // muzzle
        px(6 * dir, -3, '#111');
        ctx.fillStyle = c[2]; ctx.fillRect(-5, 4, 2, 3); ctx.fillRect(3, 4, 2, 3); // legs
        px(5 * dir, -4, c[2]); // ear
        break;
      }
      case 'caiman': {
        // long low reptile
        ellipse(0, 1, 9, 3, c[0]);
        rectf(6 * dir, 0, 6 * dir, 2, c[1]);   // snout
        // ridged back
        ctx.fillStyle = c[2]; for (let i = -6; i < 5; i += 3) ctx.fillRect(i, -2, 1, 2);
        rectf(-12 * dir, 0, 4 * dir, 1, c[0]); // tail
        px(4 * dir, -1, '#f2d13a'); // eye
        if (a.state === 'charge') { ctx.fillStyle = c[2]; ctx.fillRect((10 * dir) | 0, -1, 2 * dir, 3); } // open jaw
        break;
      }
    }
    ctx.restore();

    // tranq meter above (only when partly darted & awake)
    if (!a.asleep && a.tranq > 0) {
      const w = def.r * 2 + 2, tx = x - w / 2, ty = y - def.r - 6;
      rectf(tx, ty, w, 2, '#2a2a2a');
      rectf(tx, ty, w * clamp(a.tranq / def.tranq, 0, 1), 2, '#c7d94a');
    }
    // rarity glimmer for rare/epic
    if ((def.rarity === 'rare' || def.rarity === 'epic') && !a.asleep && Math.floor(t * 4) % 4 === 0) px(x + irnd(-def.r, def.r), y - irnd(0, def.r), RARITY[def.rarity].c);
    // Zzz when asleep
    if (a.asleep) { ctx.globalAlpha = 0.8; drawText(ctx, 'Z', x + 4 + Math.sin(t * 3) * 1, y - def.r - 4 - ((a.z || 0) * 4 % 8), '#9ad0e8', 1, 'left'); ctx.globalAlpha = 1; }
  }

  // ---- expedition HUD ----
  function renderExpHUD() {
    const P = EXP.P;
    // top bar
    rectf(0, 0, W, 12, 'rgba(8,20,14,0.55)');
    // height
    const height = Math.max(0, Math.round((EXP.LH - 26 - P.y) / 5));
    drawTextShadow(ctx, height + 'M', 4, 3, '#cfe8b0', 1, 'left');
    // treasures foraged
    if (EXP.treasuresTotal > 0) { px(34, 5, '#d46ae0'); drawTextShadow(ctx, EXP.treasures + '/' + EXP.treasuresTotal, 38, 3, '#e4a6f0', 1, 'left'); }
    // score/value
    drawTextShadow(ctx, '$' + EXP.score, W / 2, 3, '#f6d13a', 1, 'center');
    // cargo pips
    for (let i = 0; i < D.cargoMax; i++) { const cx = W - 6 - i * 8; ctx.fillStyle = i < EXP.cargo.length ? '#f2a03a' : 'rgba(255,255,255,0.2)'; ctx.fillRect(cx - 4, 3, 6, 6); if (i < EXP.cargo.length) { const k = EXP.cargo[EXP.cargo.length - 1 - i]; circ(cx - 1, 6, 2, ANIMALS[k].col[0]); } }

    // health hearts
    for (let i = 0; i < P.maxHealth; i++) { const hx = 4 + i * 9, hy = 15; const full = P.health >= i + 1; const half = !full && P.health > i; drawHeart(hx, hy, full ? '#e8433a' : half ? '#e8a33a' : '#3a2a2a'); }

    // stamina bar (grip)
    const sw = 60; rectf(4, 26, sw, 4, 'rgba(0,0,0,0.5)');
    const sr = clamp(P.stamina / D.staminaMax, 0, 1);
    rectf(4, 26, sw * sr, 4, sr > 0.35 ? '#5ad0a0' : '#e85a3a');
    drawText(ctx, 'GRIP', 4, 32, '#8ab0a0', 1, 'left');

    // ammo indicator bottom-left
    const at = P.ammoType; const adef = AMMO[at];
    rectf(4, H - 16, 70, 12, 'rgba(8,20,14,0.6)');
    drawText(ctx, adef.name, 7, H - 13, at === 'net' ? '#e8ecd8' : at === 'heavy' ? '#e85a3a' : '#d8e070', 1, 'left');
    if (at === 'dart') { for (let i = 0; i < D.magSize; i++) { ctx.fillStyle = i < P.mag ? '#d8e070' : 'rgba(255,255,255,0.18)'; ctx.fillRect(7 + i * 4, H - 7, 3, 3); } if (P.reloading > 0) { rectf(7, H - 7, 40 * (1 - P.reloading / D.reloadTime), 2, '#8ad0e8'); drawText(ctx, 'RELOAD', 50, H - 7, '#8ad0e8', 1, 'left'); } }
    else drawText(ctx, 'x' + (at === 'heavy' ? S.ammo.heavy : S.ammo.net), 7, H - 7, '#fff', 1, 'left');

    // ammo select hints (keyboard only)
    if (!TOUCH) drawText(ctx, '1 2 3', W - 22, H - 8, 'rgba(255,255,255,0.5)', 1, 'left');

    // message
    if (EXP.msgT > 0) { ctx.globalAlpha = clamp(EXP.msgT, 0, 1); drawTextShadow(ctx, EXP.msg, W / 2, H - 30, '#fff2b0', 1, 'center'); ctx.globalAlpha = 1; }

    if (P.dead) { rectf(0, H / 2 - 12, W, 24, 'rgba(80,10,10,0.6)'); drawTextOutline(ctx, 'KNOCKED OUT', W / 2, H / 2 - 8, '#ff9a8a', 2, 'center', '#3a0a0a'); if (EXP.deathMsg) drawTextShadow(ctx, EXP.deathMsg, W / 2, H / 2 + 6, '#f0c0b0', 1, 'center'); }

    // objective arrow to truck when cargo full-ish
    if ((EXP.cargo.length >= D.cargoMax || P.stamina < D.staminaMax * 0.25) && !EXP.extracting && !EXP.nearTruck) {
      if (Math.floor(t * 2) % 2) { drawTextShadow(ctx, 'v RETURN TO TRUCK v', W / 2, 14, '#ffd070', 1, 'center'); }
    }
  }
  function drawHeart(x, y, col) { ctx.fillStyle = col; ctx.fillRect(x, y + 1, 2, 2); ctx.fillRect(x + 3, y + 1, 2, 2); ctx.fillRect(x + 1, y + 2, 3, 2); ctx.fillRect(x + 2, y + 4, 1, 1); }

  // =====================================================================
  //  RENDER: SANCTUARY
  // =====================================================================
  function renderSanctuary() {
    // dusk sky
    ditherV(0, 0, W, 60, '#2a2350', '#7a4a6a');
    ditherV(0, 40, W, H - 40, '#3a5a3a', '#1c2a18');
    // stars/fireflies
    for (let i = 0; i < 20; i++) { const x = (i * 53 + 7) % W, y = (i * 29) % 44; if (Math.floor(t * 2 + i) % 3 === 0) px(x, y, '#f2e8b0'); }
    // moon
    circ(W - 34, 20, 8, '#f2ecc8'); circ(W - 30, 17, 7, mix('#2a2350', '#7a4a6a', 0.5));
    // treeline silhouette
    ctx.fillStyle = '#16281a'; for (let x = -6; x < W + 6; x += 18) ellipse(x, 52, 14, 16, '#16281a');

    // sanctuary sign
    drawTextOutline(ctx, 'SANCTUARY', W / 2, 4, '#f2d98a', 2, 'center', '#1a2a12');

    // visitor path
    rectf(0, pathY() + 4, W, 12, '#5a4a34'); rectf(0, pathY() + 4, W, 2, '#6a5a44');
    ctx.fillStyle = '#4a3c28'; for (let x = 6; x < W; x += 14) ctx.fillRect(x, pathY() + 8, 4, 1);

    // pens
    for (let i = 0; i < D.pens; i++) drawPen(i);

    // visitors
    for (const v of SAN.visitors) drawVisitor(v);

    drawParts(0); drawFloats(0);

    // HUD
    rectf(0, 0, W, 12, 'rgba(8,10,20,0.4)');
    drawTextShadow(ctx, 'NIGHT ' + S.day, 4, 3, '#cfe8b0', 1, 'left');
    drawTextShadow(ctx, '$' + S.money, 52, 3, '#f6d13a', 1, 'left');
    // clock bar
    const cw = 60; rectf(W - cw - 4, 4, cw, 4, 'rgba(0,0,0,0.5)'); rectf(W - cw - 4, 4, cw * clamp(SAN.clock / 42, 0, 1), 4, '#8ad0e8');

    if (SAN.releaseCash > 0 && SAN.ambient < 4) { drawTextShadow(ctx, SAN.released + ' RELEASED (+$' + SAN.releaseCash + ') PENS FULL', W / 2, 16, '#f0c080', 1, 'center'); }
    if (S.pens.length === 0) drawTextShadow(ctx, 'NO ANIMALS YET - GO HUNT!', W / 2, 90, '#fff2b0', 1, 'center');
    else if (!SAN.menu && !SAN.mini) drawTextShadow(ctx, 'CLICK A PEN TO FEED / PLAY   -   NIGHT $' + SAN.income, W / 2, H - 8, '#a8c898', 1, 'center');

    // pen action menu
    if (SAN.menu) drawPenMenu();
    // minigame overlay
    if (SAN.mini) drawMini();

    // night summary
    if (SAN.done) drawNightSummary();
  }

  function drawPen(i) {
    const L = penLayout(i); const p = S.pens[i];
    const has = !!p;
    // fence base
    ctx.fillStyle = has ? '#6a8a4a' : '#2a3a26'; ctx.fillRect(L.x, L.y + L.h - 8, L.w, 8);
    ditherV(L.x, L.y, L.w, L.h - 6, has ? '#5a7a3a' : '#26301e', has ? '#3a5a2a' : '#161c12');
    // fence posts
    ctx.fillStyle = '#8a6a3a'; for (let x = L.x; x <= L.x + L.w; x += 8) ctx.fillRect(x, L.y - 2, 2, L.h);
    ctx.fillStyle = '#7a5a2a'; ctx.fillRect(L.x, L.y + 4, L.w, 1); ctx.fillRect(L.x, L.y + L.h - 3, L.w, 1);
    // hover highlight
    if (mouse.x > L.x && mouse.x < L.x + L.w && mouse.y > L.y && mouse.y < L.y + L.h && !SAN.mini) { ctx.strokeStyle = '#f6d13a'; ctx.strokeRect(L.x + 0.5, L.y + 0.5, L.w - 1, L.h - 1); }

    if (!has) { drawText(ctx, 'EMPTY', L.x + L.w / 2, L.y + L.h / 2 - 2, '#5a6a4a', 1, 'center'); return; }
    // animal sitting in pen (reuse animal drawer via a fake object)
    const def = ANIMALS[p.type];
    const ax = L.x + L.w / 2, ay = L.y + L.h - 12 + Math.sin(t * 2 + i) * 0.5;
    // little enrichment: rock + plant
    ellipse(L.x + 10, L.y + L.h - 8, 4, 2, '#5a5a4a');
    ctx.fillStyle = '#2f6a24'; ctx.fillRect(L.x + L.w - 12, L.y + L.h - 14, 2, 6); ctx.fillRect(L.x + L.w - 14, L.y + L.h - 12, 6, 2);
    drawPenAnimal(p.type, ax, ay, i);
    // name + happiness
    drawText(ctx, def.name, ax, L.y - 1, '#dfeecf', 1, 'center');
    // happy hearts / bar
    const bw = L.w - 8; rectf(L.x + 4, L.y + L.h + 1, bw, 3, 'rgba(0,0,0,0.5)');
    rectf(L.x + 4, L.y + L.h + 1, bw * (p.happy / 100), 3, p.happy > 60 ? '#e8557a' : p.happy > 30 ? '#e8a33a' : '#e85a3a');
    // hunger pip
    if (p.hunger < 30 && Math.floor(t * 2) % 2) drawText(ctx, 'HUNGRY', ax, L.y + L.h + 5, '#e8a33a', 1, 'center');
    // happy emote
    if (p.happy > 75 && Math.floor(t + i) % 3 === 0) drawText(ctx, '*', ax + irnd(-6, 6), L.y + irnd(2, 8), '#f6d13a', 1, 'center');
  }
  function drawPenAnimal(type, x, y, i) {
    const def = ANIMALS[type]; const c = def.col;
    shadow(x, y + 4, def.r * 0.8, 0.25);
    // simplified sitting version
    ctx.save(); ctx.translate(x | 0, y | 0);
    ellipse(0, 0, def.r * 0.8, def.r * 0.6, c[0]);
    circ(0, -def.r * 0.6, def.r * 0.4, c[1] || c[0]);
    px(-1, (-def.r * 0.6) | 0, '#111'); px(1, (-def.r * 0.6) | 0, '#111');
    if (def.flies) { ctx.fillStyle = c[1]; ctx.fillRect(2, -1, 3, 1); }
    ctx.restore();
  }
  function drawVisitor(v) {
    const x = v.x | 0, y = v.y | 0; const moving = v.pause <= 0; const bob = moving ? Math.abs(Math.sin(v.bob)) : 0;
    shadow(x, pathY() + 12, 3, 0.2);
    // body
    ctx.fillStyle = v.col[0]; ctx.fillRect(x - 2, y - (v.kid ? 3 : 5) - bob, 4, v.kid ? 4 : 6);
    // head
    ctx.fillStyle = '#e0b088'; ctx.fillRect(x - 1, y - (v.kid ? 6 : 8) - bob, 3, 3);
    // legs
    ctx.fillStyle = v.col[1]; ctx.fillRect(x - 2, y + 1, 1, 2); ctx.fillRect(x + 1, y + 1, 1, 2);
    // admiring an exhibit
    if (v.pause > 0 && Math.floor(t * 3) % 2) drawText(ctx, '*', x, y - (v.kid ? 10 : 12), '#f6d13a', 1, 'center');
  }
  function drawPenMenu() {
    const m = SAN.menu; const L = penLayout(m.pen); const opts = ['FEED', 'PLAY', 'CLOSE'];
    const bx = clamp(L.x + L.w / 2 - 30, 4, W - 64), by = penMenuY(m.pen);
    for (let i = 0; i < opts.length; i++) { const oy = by + i * 12; const on = i === m.sel; rectf(bx, oy, 60, 11, on ? '#3a6a2a' : 'rgba(10,20,12,0.9)'); ctx.strokeStyle = on ? '#f6d13a' : '#2a4a1e'; ctx.strokeRect(bx + 0.5, oy + 0.5, 59, 10); drawText(ctx, opts[i], bx + 30, oy + 3, on ? '#fff2b0' : '#cfe8b0', 1, 'center'); }
  }

  function drawMini() {
    const m = SAN.mini;
    rectf(0, 0, W, H, 'rgba(6,14,10,0.82)');
    const def = ANIMALS[S.pens[m.pen] ? S.pens[m.pen].type : 'monkey'];
    if (m.kind === 'feed') {
      drawTextOutline(ctx, 'FEEDING TIME', W / 2, 20, '#f2d98a', 2, 'center', '#1a2a12');
      drawTextShadow(ctx, 'CLICK WHEN THE MARKER HITS THE FRUIT', W / 2, 40, '#cfe8b0', 1, 'center');
      // animal mouth
      drawPenAnimal(S.pens[m.pen].type, W / 2, 78, 0);
      // timing bar
      const bx = 60, bw = W - 120, by = 110;
      rectf(bx, by, bw, 8, '#2a2a2a');
      rectf(bx + bw * m.zone, by, bw * m.zw, 8, '#3a8a3a'); // zone
      // fruit icon on zone
      circ(bx + bw * (m.zone + m.zw / 2), by + 4, 3, '#e8433a');
      // marker
      const mx = bx + bw * m.marker; rectf(mx - 1, by - 3, 2, 14, '#f6d13a');
      // rounds
      for (let i = 0; i < m.rounds; i++) { ctx.fillStyle = i < m.round ? (i < m.hits ? '#5ad0a0' : '#e85a3a') : '#444'; ctx.fillRect(W / 2 - 12 + i * 9, 126, 6, 6); }
      drawText(ctx, 'HITS ' + m.hits + '/' + m.rounds, W / 2, 138, '#cfe8b0', 1, 'center');
    } else {
      drawTextOutline(ctx, 'PLAYTIME', W / 2, 20, '#f2d98a', 2, 'center', '#1a2a12');
      drawTextShadow(ctx, 'CLICK / SPACE TO KEEP THE BALL UP!', W / 2, 40, '#cfe8b0', 1, 'center');
      drawPenAnimal(S.pens[m.pen].type, W / 2, 120, 0);
      // ball
      circ(m.ballx, m.bally, 3, '#f2a03a'); px(m.ballx - 1, m.bally - 1, '#fff');
      // meter
      const bw = 120; rectf(W / 2 - bw / 2, 60, bw, 6, '#2a2a2a'); rectf(W / 2 - bw / 2, 60, bw * clamp(m.mashes / m.need, 0, 1), 6, '#8ae0ff');
      drawText(ctx, 'TIME ' + Math.ceil(m.timeLeft), W / 2, 50, '#cfe8b0', 1, 'center');
    }
    if (m.done) { rectf(W / 2 - 60, 66, 120, 30, 'rgba(10,30,16,0.95)'); ctx.strokeStyle = '#f6d13a'; ctx.strokeRect(W / 2 - 60.5, 66.5, 120, 29); drawTextShadow(ctx, m.result.msg, W / 2, 72, '#fff2b0', 1, 'center'); drawTextShadow(ctx, '+' + m.result.joy + ' HAPPINESS', W / 2, 84, '#e8557a', 1, 'center'); if (m.t > 1) drawText(ctx, 'CLICK TO CONTINUE', W / 2, 100, '#a8c898', 1, 'center'); }
  }

  function drawNightSummary() {
    rectf(30, 40, W - 60, H - 80, 'rgba(8,18,12,0.95)'); ctx.strokeStyle = '#3d7f2a'; ctx.strokeRect(30.5, 40.5, W - 61, H - 81);
    drawTextOutline(ctx, 'NIGHT COMPLETE', W / 2, 48, '#f2d98a', 2, 'center', '#1a2a12');
    drawTextShadow(ctx, 'ADMISSION EARNED  $' + SAN.income, W / 2, 72, '#f6d13a', 1, 'center');
    drawTextShadow(ctx, 'ANIMALS IN CARE  ' + S.pens.length, W / 2, 86, '#cfe8b0', 1, 'center');
    drawTextShadow(ctx, 'TOTAL FUNDS  $' + S.money, W / 2, 100, '#fff2b0', 1, 'center');
    if (SAN.summaryT > 0.6 && Math.floor(t * 2) % 2) drawTextShadow(ctx, 'CLICK / SPACE FOR SHOP', W / 2, H - 52, '#a8c898', 1, 'center');
  }

  // =====================================================================
  //  RENDER: SHOP
  // =====================================================================
  function renderShop() {
    ditherV(0, 0, W, H, '#20301e', '#0e1810');
    rectf(0, 0, W, 14, 'rgba(8,20,14,0.7)');
    drawTextOutline(ctx, 'OUTFITTER', 8, 2, '#f2d98a', 1, 'left', '#1a2a12');
    drawTextShadow(ctx, '$' + S.money, W / 2, 3, '#f6d13a', 1, 'center');
    // next day button
    const nb = (mouse.x > W - 70 && mouse.y < 16);
    rectf(W - 68, 2, 64, 10, nb ? '#3a6a2a' : 'rgba(10,20,12,0.8)'); ctx.strokeStyle = '#f6d13a'; ctx.strokeRect(W - 68.5, 2.5, 64, 9);
    drawText(ctx, 'NEXT DAY >', W - 36, 4, '#fff2b0', 1, 'center');

    const list = shopList();
    for (let i = 0; i < list.length; i++) {
      const L = shopCard(i); const on = i === SHOP.sel; const it = list[i];
      let name, desc, cost, lvl = 0, maxed = false, cat = '';
      if (it.kind === 'up') { name = it.u.name; desc = it.u.desc; lvl = S.up[it.u.id]; maxed = lvl >= it.u.max; cost = maxed ? 0 : it.u.cost(lvl); cat = it.u.cat; }
      else { name = it.c.name; desc = 'CONSUMABLE'; cost = it.c.cost; cat = 'AMMO'; }
      const afford = maxed || S.money >= cost;
      rectf(L.x, L.y, L.w, L.h, on ? 'rgba(50,90,40,0.9)' : 'rgba(14,26,16,0.85)');
      ctx.strokeStyle = on ? '#f6d13a' : '#2a4a1e'; ctx.strokeRect(L.x + 0.5, L.y + 0.5, L.w - 1, L.h - 1);
      // cat tag
      drawText(ctx, cat, L.x + 3, L.y + 2, '#7aa86a', 1, 'left');
      drawTextShadow(ctx, name, L.x + 3, L.y + 8, afford ? '#fff2b0' : '#8a8a7a', 1, 'left');
      drawText(ctx, desc, L.x + 3, L.y + 15, '#9ab88a', 1, 'left');
      // level pips
      if (it.kind === 'up') { for (let k = 0; k < it.u.max; k++) { ctx.fillStyle = k < lvl ? '#5ad0a0' : 'rgba(255,255,255,0.15)'; ctx.fillRect(L.x + L.w - 4 - (it.u.max - k) * 4, L.y + 2, 3, 3); } }
      // cost
      if (maxed) drawTextShadow(ctx, 'MAX', L.x + L.w - 4, L.y + 8, '#5ad0a0', 1, 'right');
      else drawTextShadow(ctx, '$' + cost, L.x + L.w - 4, L.y + 8, afford ? '#f6d13a' : '#c05a4a', 1, 'right');
    }
    if (SHOP.buyMsgT > 0) { ctx.globalAlpha = clamp(SHOP.buyMsgT, 0, 1); drawTextOutline(ctx, SHOP.buyMsg, W / 2, H - 14, '#fff2b0', 1, 'center', '#1a2a12'); ctx.globalAlpha = 1; }
    drawTextShadow(ctx, 'ARROWS+SPACE TO BUY   -   N FOR NEXT DAY', W / 2, H - 6, '#7a9a78', 1, 'center');
  }

  // =====================================================================
  //  BOOT
  // =====================================================================
  if (location.search.indexOf('dev=1') >= 0) {
    window.CR = {
      state: () => S, phase: () => phase,
      toSanctuary: (types) => { S.dayCatch = types || ['sloth', 'boar', 'parrot', 'monkey']; startSanctuary(); },
      toShop: () => { startShop(); },
      giveMoney: (n) => { S.money += (n || 500); },
      region: (i) => { startExpedition(REGIONS[clamp(i || 0, 0, REGIONS.length - 1)]); },
      setDay: (d) => { S.day = d; },
      regions: () => REGIONS.map(r => r.name),
      animals: () => Object.keys(ANIMALS),
    };
  }
  initMenu();
  requestAnimationFrame(frame);
})();
