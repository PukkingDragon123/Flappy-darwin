// Procedural pixel-art sprite sheet for Flappy Darwin.
// Sprites are authored as character maps and baked to offscreen canvases at load.
(function () {
  const PAL = {
    'o': '#33203a', // outline (dark plum)
    'r': '#e98b3f', // bird orange
    'R': '#c1622a', // bird orange shade
    'q': '#f7ab5e', // bird orange light
    'w': '#fbe7bb', // cream belly
    'W': '#e5c28c', // belly shade
    'k': '#5a3d54', // dark feather
    'K': '#7c5470', // dark feather light
    'y': '#f6c945', // beak yellow
    'Y': '#cf9330', // beak shade
    'e': '#ffffff', // eye white
    'p': '#221426', // pupil
    't': '#3fc0b0', // evo teal accent
    'T': '#2c8a80', // evo teal shade
    'g': '#5cad3c', // leaf green
    'G': '#3d7f2a', // leaf dark
    'l': '#96d454', // leaf light
    'b': '#8a5532', // bark brown
    'B': '#653a20', // bark dark
    'n': '#a76f3e', // nut brown
    'N': '#7b4d26', // nut dark
    'c': '#e0525c', // berry red
    'C': '#a83248', // berry dark
    'd': '#f2748f', // berry light
    'u': '#a8e4f2', // wing shimmer blue
    'U': '#6db6d8', // wing shimmer shade
    'f': '#fff3a8', // gold light
    'F': '#e0a232', // gold shade
    's': '#9aa2b5', // stone gray
    'S': '#5f6579', // stone dark
    'v': '#c9d2e0', // stone light
    'z': '#f2f7ff', // white/snow
    'x': '#161020', // near-black
  };

  function bake(rows, pal) {
    pal = pal || PAL;
    const h = rows.length, w = rows[0].length;
    const cv = document.createElement('canvas');
    cv.width = w; cv.height = h;
    const c = cv.getContext('2d');
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const ch = rows[y][x];
        if (ch && ch !== '.') {
          c.fillStyle = pal[ch] || '#f0f';
          c.fillRect(x, y, 1, 1);
        }
      }
    }
    return cv;
  }

  // ---- bird body (faces right; head top-right, tail attaches left) ----
  const BODY = bake([
    '..........oooo....',
    '.........orrqqo...',
    '........orrqqqqo..',
    '.......orrrqqqqo..',
    '..ooooorrrrrrrro..',
    '.orrrrrrrrrrrrro..',
    'orrrrrrrrrwwwwro..',
    'orrrRrrrwwwwwwo...',
    '.orrRRrwwwwwwWo...',
    '..orrRwwwwwwWo....',
    '...oRRwwwwWWo.....',
    '....oowwWWoo......',
    '......oooo........',
  ]);

  // chubby overfed belly, drawn behind/below body
  const TUMMY = bake([
    '..ooooo...',
    '.owwwwwo..',
    'owwwwwwWo.',
    'owwwwwWWo.',
    'owwwwWWWo.',
    '.owwWWWo..',
    '..ooooo...',
  ]);

  const WING_UP = bake([
    '......oo.',
    '....ooqqo',
    '...oqqqro',
    '..oqrrro.',
    '.orrrro..',
    '.orrRo...',
    '.oRRo....',
    '..oo.....',
  ]);
  const WING_MID = bake([
    '.ooo.....',
    'oqqroo...',
    '.oqrrrro.',
    '..oRRrrRo',
    '...ooRRo.',
  ]);
  const WING_DOWN = bake([
    '.ooo....',
    'oqrro...',
    '.oqrro..',
    '..orrRo.',
    '..oRrRo.',
    '...oRRo.',
    '...oRo..',
    '....o...',
  ]);

  const BEAK_S = bake([
    'oo...',
    'oyyo.',
    'oyYYo',
    '.oo..',
  ]);
  const BEAK_S_OPEN = bake([
    'oyyo.',
    'oyYo.',
    '.....',
    'oyyo.',
    '.oYo.',
  ]);
  const BEAK_B = bake([
    'oo.....',
    'oyyyo..',
    'oyyyYo.',
    'oyYYYYo',
    '.oYYo..',
    '..oo...',
  ]);
  const BEAK_B_OPEN = bake([
    'oyyyo..',
    'oyyYYo.',
    'oyYo...',
    '.......',
    'oyYYo..',
    'oYYYYo.',
    '.oYo...',
  ]);

  const TAIL_S = bake([
    'oo...',
    'oRqo.',
    'oRqro',
    'oRro.',
    'oo...',
  ]);
  const TAIL_BIG = bake([
    'oo.....',
    'ottTo..',
    'okKKto.',
    'okKrrto',
    'okKro..',
    'ottTo..',
    'oo.....',
  ]);

  const CREST1 = bake([
    '.o.',
    'oro',
    '.o.',
  ]);
  const CREST2 = bake([
    '.o.o',
    'oror',
    '.oro',
    '..o.',
  ]);
  const CREST3 = bake([
    '.o.o.o',
    'ototot',
    '.otot.',
    '..oo..',
  ]);

  const EYE = bake([
    'ee',
    'ep',
  ]);
  const EYE_BLINK = bake([
    '..',
    'oo',
  ]);

  // ---- foods ----
  const BERRY = bake([
    '...oG.',
    '..oGo.',
    '.occo.',
    'ocdcco',
    'occcCo',
    '.oCCo.',
  ]);
  const SEED = bake([
    '.oo.',
    'onno',
    'onNo',
    'oNNo',
    '.oo.',
  ]);
  const NUT = bake([
    '..oBo..',
    '.oBbBo.',
    'oBbbbBo',
    'onnnnno',
    'onwnnNo',
    'onnnNNo',
    '.onNNo.',
    '..ooo..',
  ]);
  const BUG1 = bake([
    'p..o..p',
    '.p.uu.p',
    '.okuuo.',
    'okkkko.',
    '.okko..',
  ]);
  const BUG2 = bake([
    'p.....p',
    '.p.o..p',
    '.okkuo.',
    'okkkkuo',
    '.okkoU.',
  ]);
  const GOLD = bake([
    '...oG..',
    '..oo...',
    '.offo..',
    'offffo.',
    'ofyffFo',
    'oyyfFFo',
    '.oFFo..',
    '..oo...',
  ]);

  // ---- HUD ----
  const HEART = bake([
    '.oo.oo.',
    'ocdoddo',
    'occccco',
    '.occCo.',
    '..oCo..',
    '...o...',
  ]);
  const HEART_EMPTY = bake([
    '.oo.oo.',
    'oxxoxxo',
    'oxxxxxo',
    '.oxxxo.',
    '..oxo..',
    '...o...',
  ]);
  const DNA = bake([
    't..t',
    '.tt.',
    't..t',
    't..t',
    '.tt.',
    't..t',
  ]);
  const SKULL = bake([
    '.zzz.',
    'zzzzz',
    'zpzpz',
    '.zzz.',
    '.z.z.',
  ]);
  const FEATHER = bake([
    '.or',
    'orr',
    'oro',
    'o..',
  ]);

  // ---- biome icons (for path cards), all 14x14 ----
  function pad14(rows) {
    return rows.map(function (r) { return (r + '..............').slice(0, 14); });
  }
  const ICON_MEADOW = bake(pad14([
    '.....ooo......',
    '...oogggoo....',
    '..oggglggggo..',
    '.oggclgggggo..',
    '.ogggggclggo..',
    '..ogggggggo...',
    '...oogggoo....',
    '.....obo......',
    '.....obo......',
    '.....obbo.....',
    '....obbbo.....',
    'ggggobbbogggg.',
    'GgGgggggggGgG.',
    '..............',
  ]));
  const ICON_GROVE = bake(pad14([
    '.....oooo.....',
    '...ooBbbBoo...',
    '..oBbbbbbbBo..',
    '.oBbbbbbbbbBo.',
    '.oooooooooooo.',
    '..onnnnnnnno..',
    '..onwnnnnnNo..',
    '..onnnnnnNNo..',
    '...onnnnNNo...',
    '...onnnNNo....',
    '....onnNo.....',
    '.....oNo......',
    '......o.......',
    '..............',
  ]));
  const ICON_MARSH = bake(pad14([
    '......o..p....',
    '..o...o..p.p..',
    '..o..oNo..uu..',
    '.oNo.oNo.okko.',
    '.oNo.oNo.okko.',
    '.oNo..o...oo..',
    '..o...o.......',
    '..o...o...o...',
    '..og..o..go...',
    '.ogg..o..ggo..',
    'gggggggggggg..',
    'GgGgGggGgGgG..',
    '..............',
    '..............',
  ]));
  const ICON_CRAGS = bake(pad14([
    '......oo......',
    '.....ovso.....',
    '....ovsso.....',
    '....ossSo.....',
    '...ossssSo....',
    '...osssSSo....',
    '..osssssSSo...',
    '..osssSSSSo...',
    '.osssssSSSSo..',
    '.of...........',
    'ofo...f.......',
    '.of..ofo......',
    '......of......',
    '..............',
  ]));

  // ---- clouds (3 sizes) ----
  const CLOUD1 = bake([
    '....zzzz......',
    '..zzzzzzzz....',
    'zzzzzzzzzzzz..',
    '.uzzzzzzzzu...',
  ], { z: '#ffffff', u: '#d8ecf7' });
  const CLOUD2 = bake([
    '......zzzzz.......',
    '...zzzzzzzzzz.....',
    '.zzzzzzzzzzzzzzz..',
    'zzzzzzzzzzzzzzzzz.',
    '.uzzzzzzzzzzzzu...',
  ], { z: '#ffffff', u: '#d8ecf7' });
  const CLOUD3 = bake([
    '...zzz....',
    '.zzzzzzz..',
    'uzzzzzzzu.',
  ], { z: '#ffffff', u: '#d8ecf7' });

  // Compose the bird from its parts. cfg:
  //  frame 0..2 (wing up/mid/down), open (beak open), bigBeak, bigWings,
  //  crest 0..3, bigTail, stuffed, blink, shield
  function drawBird(ctx, x, y, rot, cfg) {
    ctx.save();
    ctx.translate(Math.round(x), Math.round(y));
    ctx.rotate(rot);
    // origin at body center (roughly col 8, row 6 of BODY)
    const ox = -9, oy = -7;

    if (cfg.shield) {
      ctx.globalAlpha = 0.35 + 0.15 * Math.sin(cfg.time * 8);
      ctx.fillStyle = PAL.u;
      ctx.beginPath();
      ctx.arc(1, 0, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    if (cfg.bigTail) ctx.drawImage(TAIL_BIG, ox - 5, oy + 4);
    else ctx.drawImage(TAIL_S, ox - 3, oy + 5);

    if (cfg.stuffed) ctx.drawImage(TUMMY, ox + 4, oy + 6);
    ctx.drawImage(BODY, ox, oy);

    // crest
    if (cfg.crest === 1) ctx.drawImage(CREST1, ox + 12, oy - 2);
    else if (cfg.crest === 2) ctx.drawImage(CREST2, ox + 11, oy - 3);
    else if (cfg.crest >= 3) ctx.drawImage(CREST3, ox + 10, oy - 3);

    // eye
    ctx.drawImage(cfg.blink ? EYE_BLINK : EYE, ox + 13, oy + 2);

    // beak
    if (cfg.bigBeak) {
      ctx.drawImage(cfg.open ? BEAK_B_OPEN : BEAK_B, ox + 17, oy + (cfg.open ? 1 : 2));
    } else {
      ctx.drawImage(cfg.open ? BEAK_S_OPEN : BEAK_S, ox + 17, oy + (cfg.open ? 2 : 3));
    }

    // wing (layered twice when evolved for a broader silhouette)
    const wing = cfg.frame === 0 ? WING_UP : (cfg.frame === 1 ? WING_MID : WING_DOWN);
    const wx = ox + 3, wy = cfg.frame === 0 ? oy - 3 : (cfg.frame === 1 ? oy + 4 : oy + 5);
    if (cfg.bigWings) ctx.drawImage(wing, wx - 2, wy + 1);
    ctx.drawImage(wing, wx, wy);

    ctx.restore();
  }

  // beak tip offset from bird center, pre-rotation
  function beakTip(cfg) {
    return { x: cfg.bigBeak ? 14 : 12, y: -1 };
  }

  window.SPR = {
    PAL: PAL, bake: bake,
    BODY: BODY, TUMMY: TUMMY,
    WING_UP: WING_UP, WING_MID: WING_MID, WING_DOWN: WING_DOWN,
    BEAK_S: BEAK_S, BEAK_B: BEAK_B,
    TAIL_S: TAIL_S, TAIL_BIG: TAIL_BIG,
    CREST1: CREST1, CREST2: CREST2, CREST3: CREST3,
    BERRY: BERRY, SEED: SEED, NUT: NUT, BUG1: BUG1, BUG2: BUG2, GOLD: GOLD,
    HEART: HEART, HEART_EMPTY: HEART_EMPTY, DNA: DNA, SKULL: SKULL, FEATHER: FEATHER,
    ICON_MEADOW: ICON_MEADOW, ICON_GROVE: ICON_GROVE, ICON_MARSH: ICON_MARSH, ICON_CRAGS: ICON_CRAGS,
    CLOUD1: CLOUD1, CLOUD2: CLOUD2, CLOUD3: CLOUD3,
    drawBird: drawBird, beakTip: beakTip,
  };
})();
