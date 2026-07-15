// Procedural pixel-art sprite sheet for Flappy Darwin.
// One shared naturalistic palette; sprites are authored as character maps and
// baked to offscreen canvases at load. The bird is composed from parts so its
// wings, beak, tail and crest can animate and evolve independently.
(function () {
  // ---- master palette (warm sepia + naturalistic green + evolution teal) ----
  const PAL = {
    'o': '#2b1d20', // primary outline (warm umber, not pure black)
    'x': '#161020', // deepest ink
    'K': '#55371f', // sepia shadow
    'b': '#77502e', // sepia base (back / bark)
    'H': '#9a6c41', // sepia light (sunward rim)
    'f': '#d9c39a', // buff (wingbar / feather edge)
    'w': '#fbe7bb', // cream belly / dry sand
    'W': '#e5c28c', // cream shade / sand mid
    'c': '#925127', // rufous cap / covert
    'r': '#8a4a2a', // rufous deep
    'n': '#a76f3e', // nut / wet sand
    'N': '#7b4d26', // nut dark
    'P': '#402a1c', // dark flight feather
    'y': '#d8b46f', // beak pale horn
    'Y': '#a07a37', // beak shade
    'e': '#f7f0e2', // eye white / catchlight
    'p': '#1b1114', // pupil
    'D': '#12572a', // green deepest
    'G': '#3d7f2a', // green dark
    'g': '#5cad3c', // green base
    'm': '#7fc23e', // green mid-light
    'l': '#96d454', // green light
    'L': '#bfe87a', // green sunlit
    'A': '#e0525c', // berry red / poppy
    'C': '#a83248', // berry dark / maw interior
    'd': '#f2748f', // berry light / flower
    'M': '#ff5f9e', // orchid magenta
    's': '#9aa2b5', // stone gray
    'S': '#5f6579', // stone dark
    'v': '#c9d2e0', // stone light
    'z': '#f2f7ff', // snow / foam / fang
    'u': '#a8e4f2', // shallow water shimmer
    'U': '#68b7cf', // shallow shade
    't': '#3fc0b0', // EVOLUTION TEAL
    'T': '#2c8a80', // teal shade
    'J': '#3e7a2e', // snake body
    'j': '#c7d94a', // snake venom / aim dots
    'h': '#3a6b4a', // snapper bog green
    'a': '#7a5a3a', // hawk brown
    'q': '#b98a55', // mid horn / warm mid
  };

  // bird-specific roles drawn from the same family
  const BIRD_PAL = Object.assign({}, PAL, {
    'g': '#bd8a62', // <- legs (override green within bird sprites only)
  });

  function bake(rows, pal) {
    pal = pal || PAL;
    let w = 0;
    for (const r of rows) if (r.length > w) w = r.length;
    const h = rows.length;
    const cv = document.createElement('canvas');
    cv.width = w; cv.height = h;
    const c = cv.getContext('2d');
    for (let y = 0; y < h; y++) {
      const row = rows[y];
      for (let x = 0; x < row.length; x++) {
        const ch = row[x];
        if (ch && ch !== '.') {
          c.fillStyle = pal[ch] || '#f0f';
          c.fillRect(x, y, 1, 1);
        }
      }
    }
    return cv;
  }
  function bakeBird(rows) { return bake(rows, BIRD_PAL); }

  // ============================================================
  //  BIRD  — a detailed finch, ~22x14 silhouette, faces right
  // ============================================================
  // Torso (belly cream below, sepia back above); tail attaches left,
  // head attaches upper-right.
  const BODY = bakeBird([
    '......ooooo.....',
    '....ooHHHbbo....',
    '..ooHbbbbbbbo...',
    '.oHHbbbbbbbbbo..',
    '.oKbbbbbbbbbbbo.',
    'oKKbbbbbfwwwbbo.',
    'oKKbbbfwwwwwwwo.',
    '.oKbbwwwwwwwwWo.',
    '.oKwwwwwwwwwWo..',
    '..oWWwwwwwWWo...',
    '...oWWWwWWoo....',
    '....oooooo......',
  ]);

  // Head — round, rufous cap, pale cheek/throat, faces right.
  const HEAD = bakeBird([
    '..ooooo..',
    '.occccbo.',
    'occcbbbbo',
    'ocbbbbbHo',
    'obbbbbbHo',
    'obbbbwwHo',
    '.obbwwwo.',
    '..ooooo..',
  ]);

  const EYE = bakeBird([
    'oee',
    'epp',
    'opp',
  ]);
  const EYE_BLINK = bakeBird([
    '...',
    'ooo',
    '...',
  ]);

  // short conical seed-cracker beak, projects right
  const BEAK_S = bakeBird([
    'ooo..',
    'oyyyo',
    'oqYYo',
    '.oooo',
  ]);
  const BEAK_S_OPEN = bakeBird([
    'oyyo.',
    'oqyo.',
    '.oo..',
    'oqYo.',
    'oYYo.',
  ]);
  // evolved wide beak
  const BEAK_B = bakeBird([
    'oooo..',
    'oyyyyo',
    'oqqYYo',
    'oqYYYo',
    '.ooooo',
  ]);
  const BEAK_B_OPEN = bakeBird([
    'oyyyo.',
    'oqqyo.',
    'oqyo..',
    '.oo...',
    'oqYYo.',
    'oYYYo.',
  ]);

  // ---- wings: covert layer (b/H) + primary tips (P) ----
  const WING_DOWN = bakeBird([   // swept down along the flank
    '.oooo....',
    'obbbbo...',
    'oHbbbPo..',
    '.oHbbPo..',
    '..oHbPo..',
    '...obPPo.',
    '....oPPo.',
    '.....ooo.',
  ]);
  const WING_MID = bakeBird([    // extended outward
    '.ooooo....',
    'obbbbbHo..',
    'oHbbbbbPo.',
    '.oPPPPPPPo',
    '..ooooooo.',
  ]);
  const WING_UP = bakeBird([     // raised high on upstroke
    '.......oo',
    '.....obHo',
    '....obbHo',
    '...obbbo.',
    '..obbPo..',
    '.obbPo...',
    '.oHbPo...',
    '.oPPo....',
    '..oo.....',
  ]);

  // ---- tail: notched / forked, attaches at right ----
  const TAIL_S = bakeBird([
    'ooo.....',
    'oPPbbo..',
    '.oPbbbo.',
    '..oPbbbo',
    '.oPbbbo.',
    'oPPbbo..',
    'ooo.....',
  ]);
  const TAIL_BIG = bakeBird([    // evolved fanned rudder w/ teal
    'ooo......',
    'ottPbbo..',
    '.oPtbbbo.',
    '..oPtbbbo',
    '.oPtbbbo.',
    'ottPbbo..',
    'ooo......',
  ]);

  const LEG = bakeBird([
    'g..g',
    'g..g',
    'og.go',
    'go.og',
  ]);

  const CREST1 = bakeBird([
    '..t.',
    '.tto',
    'obo.',
  ]);
  const CREST2 = bakeBird([
    '.t.t.',
    'ottto',
    '.obo.',
    '..o..',
  ]);
  const CREST3 = bakeBird([
    't.t.t',
    'ttttt',
    'ottto',
    '.obo.',
  ]);

  // ============================================================
  //  PREDATORS
  // ============================================================
  const SNAKE_COIL = bake([   // resting head, tongue tucked
    '.ooo...',
    'oJJJo..',
    'oJjJJo.',
    'oJpJJo.',
    'oJJJJo.',
    '.oJJo..',
    '..oo...',
  ]);
  const SNAKE_REAR = bake([    // reared, hood up, eye bright, tongue flick
    '..ooo..',
    '.oJJJo.',
    'oJjjJo.',
    'oJpjJoj',
    'oJJJJo.',
    'oJJJo..',
    '.oo....',
  ]);
  const SNAKE_STRIKE = bake([  // mouth agape lunging right
    '.ooo...',
    'oJJJoj.',
    'oJjJo.j',
    'oJpJCCo',
    'oJJCzzo',
    'oJJoCCo',
    '.oo.oo.',
  ]);

  const SNAPPER_LURK = bake([  // eyes/snout above the waterline
    '.o.....o.',
    'ohjo..ohjo'.slice(0, 9),
    'ohhho.ohho'.slice(0, 9),
    'ooooo.oooo'.slice(0, 9),
  ]);
  const SNAPPER_GAPE = bake([  // rising open maw
    '.o.......o.',
    'ohjo...ohjo',
    'ohhhohhhhho',
    'ohhhhhhhhho',
    'ohhCCCCChho',
    'ozCCCCCCzho',
    'oCzCCCzCCho',
    'ohoCCCoChho',
    '.ohhhhhho..',
    '..ooooo....',
  ]);

  const HAWK_MID = bake([      // wings spread, seen from below
    'a...........a',
    'aa.........aa',
    '.aaa..a..aaa.',
    '..aaaaHaaaaa.',
    '.aaPPaaaPPaa.',
    '...aa.a.aa...',
    '......o......',
  ]);
  const HAWK_UP = bake([       // wings raised
    '..aa.....aa..',
    '.aaaa...aaaa.',
    '..aaa.a.aaa..',
    '...aaaHaaa...',
    '....PPaPP....',
    '......a......',
  ]);

  // falcon (sleeker, swept pointed wings, slate-blue) — a pursuit predator
  const FALCON_PAL = Object.assign({}, PAL, { a: '#5b6474', H: '#8c96a8', P: '#343b4a', y: '#e0b24a' });
  const FALCON_MID = bake([
    'a...........a',
    '.aa.......aa.',
    '..aaa...aaa..',
    '...aaaHaaa...',
    '..aaPPyPPaa..',
    '....a.y.a....',
    '......P......',
  ], FALCON_PAL);
  const FALCON_UP = bake([
    '.aa.......aa.',
    '..aaa...aaa..',
    '...aaa.aaa...',
    '....aaHaa....',
    '....PPyPP....',
    '.....a.a.....',
  ], FALCON_PAL);
  const FALCON_DIVE = bake([   // folded, stooping toward prey
    '.a.........a.',
    '..aa.....aa..',
    '...aaaHaaa...',
    '....aayaa....',
    '.....PyP.....',
    '.....a.a.....',
    '......P......',
  ], FALCON_PAL);

  // ============================================================
  //  FOODS
  // ============================================================
  const BERRY = bake([
    '..oGo.',
    '.oGGo.',
    'oAddAo',
    'oAAdAo',
    'oCAACo',
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
    '..oNo..',
    '.oNbNo.',
    'oNbbbNo',
    'onnnnno',
    'onwfnNo',
    'onnnNNo',
    '.onNNo.',
    '..ooo..',
  ]);
  const NECTAR = bake([        // dew-drop blossom
    '.dod.',
    'odMdo',
    'oMwMo',
    'odMdo',
    '.ooo.',
  ]);
  const GRUB = bake([          // pale curled larva
    '.oooo.',
    'owWWfo',
    'ofwWWo',
    'owWWfo',
    '.oooo.',
  ]);
  const FROG = bake([
    'o.oo.o',
    'ogegego'.slice(0, 6),
    'ogggggo'.slice(0, 6),
    'oGgggGo',
    '.oGGo.',
    'o.oo.o',
  ]);
  const MANGO = bake([         // ripe orange teardrop
    '..oGo.',
    '.onno.',
    'onqfno',
    'oqqfno',
    'onqqNo',
    '.onNo.',
  ]);
  const BUG1 = bake([
    'p..o..p',
    '.p.uu.p',
    '.oJuuo.',
    'oJJJJo.',
    '.oJJo..',
  ]);
  const BUG2 = bake([
    'p.....p',
    '.p.o..p',
    '.oJJuo.',
    'oJJJJuo',
    '.oJJoU.',
  ]);
  const GOLD = bake([          // radiant golden fruit
    '...oG..',
    '..oo...',
    '.offLo.',
    'offLfo.',
    'ofyLLYo',
    'oyyLYYo',
    '.oYYo..',
    '..oo...',
  ], Object.assign({}, PAL, { L: '#fff3a8', f: '#ffe27a', y: '#ffd257', Y: '#e0a232' }));

  // ============================================================
  //  HUD ICONS
  // ============================================================
  const HEART = bake([
    '.oo.oo.',
    'oAddAAo',
    'oAAAAAo',
    '.oAACo.',
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
    'T..T',
    't..t',
    '.TT.',
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
    '..oH',
    '.oHb',
    'oHbo',
    'obo.',
    'oo..',
  ], BIRD_PAL);
  const TUMMY = bake([
    '.ooooo.',
    'owwwwwo',
    'owwwwWo',
    'owwwWWo',
    '.owWWo.',
    '..ooo..',
  ]);

  // ============================================================
  //  BIOME ICONS (14x14) for path cards
  // ============================================================
  function pad14(rows) { return rows.map(function (r) { return (r + '..............').slice(0, 14); }); }

  const ICON_MEADOW = bake(pad14([
    '.....ooo......',
    '...oogggoo....',
    '..oglgggmgo...',
    '.ogAlgggggo...',
    '.ogggglAggo...',
    '..ogggggmo....',
    '...oogggoo....',
    '.....obo......',
    '.....obo......',
    '....obbo......',
    'llloobboolll..',
    'GgGgggggGgGg..',
    '..............',
    '..............',
  ]));
  const ICON_FOREST = bake(pad14([
    '......L.......',
    '.....oLo......',
    '....oGmGo.....',
    '....oGmGo.....',
    '...oGmmmGo....',
    '...oGmmmGo....',
    '..oGmmmmmGo...',
    '..oDmmmmmGo...',
    '.oDmmmmmmmGo..',
    '.....oNo......',
    '.....oNo......',
    'WWWWWoNoWWWWW.',
    'nWnWnWnWnWnW..',
    '..............',
  ]));
  const ICON_GROVE = bake(pad14([
    '....oooo......',
    '..ooGmmGoo....',
    '.oGmmmmmmGo...',
    '.oGmmmLmmGo...',
    '.oomlmmmmoo...',
    '..onnnnno.....',
    '..onwfnNo.....',
    '..onnnNNo.....',
    '...onNNo......',
    '....obo.......',
    '....obo.......',
    'WWWWoboWWWWWW.',
    'nWnWnWnWnWnW..',
    '..............',
  ]));
  const ICON_MARSH = bake(pad14([
    '..p...........',
    '.p.uu....o....',
    '..oJuo..oGo...',
    '.oJJo..oGGGo..',
    '..oo..oGGGGGo.',
    'oNo....oGGGo..',
    'oNo.oNo.oGo...',
    'oNo.oNo..o....',
    'oNo.oNo.oNo...',
    'ogogGogoGGo...',
    'GGGGGGGGGGGG..',
    'DGDGDGDGDGDG..',
    '..............',
    '..............',
  ]));
  const ICON_SWAMP = bake(pad14([
    '....oGo.......',
    '..oGmGGo......',
    '.oGGmmmGo.....',
    '.oGmGmGmGo....',
    '..hoGmGoh.....',
    '..h.oGo.h.....',
    '.oJo.o.oNo....',
    'oJjJ...oNo....',
    'oJpJ...oNo....',
    '.oJo.h.oNo.h..',
    'hhGhhGhhGhhh..',
    'hDhDhDhDhDhD..',
    '..............',
    '..............',
  ]));
  const ICON_CRAGS = bake(pad14([
    '......oo......',
    '.a...ovso...a.',
    'aa..ovsso..aa.',
    '.aa.ossSo.aa..',
    '..aossssSo....',
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
  const ICON_JUNGLE = bake(pad14([
    '..L..oo...L...',
    '.oGooGGooGo...',
    'oGmGGmmGGmGo..',
    'oGmmMmmMmmGo..',
    '.oGmmmmmmGo...',
    '..GoGmmGoG....',
    '..G.oNNo.G....',
    '.G.oNbbNo.G...',
    '...oNbbNo.....',
    'M..oNbbNo..d..',
    'GGGGoNNoGGGG..',
    'DGDGDGDGDGDG..',
    '..............',
    '..............',
  ]));

  // ============================================================
  //  CLOUDS
  // ============================================================
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

  // ============================================================
  //  FOREST PROPS, HAZARDS & META
  // ============================================================
  const DURIAN = bake([
    '...y.y.y....',
    '..yGyGyGy...',
    '.yGgGgGgGy..',
    'yGgllllgGy..',
    'oGllLLllGGo.',
    'yGgllllgGGy.',
    '.yGgGgGgGGy.',
    '..yGyGyGGy..',
    '...y.y.yo...',
    '.....o......',
  ], Object.assign({}, PAL, { y: '#6f5a1e', G: '#4f7a24', g: '#6ea233', l: '#93c94a', L: '#c7e88a' }));

  const EGG = bake([
    '.ooo.',
    'oewwo',
    'owcwo',
    'owwWo',
    'owWco',
    'oWWWo',
    '.ooo.',
  ]);
  const EGG_CRACK = bake([
    '.ooo.',
    'oewwo',
    'oowoo',
    'owoWo',
    'ooooW'.slice(0, 5),
    'oWWWo',
    '.ooo.',
  ]);
  const NEST = bake([
    '.ooooooooooo.',
    'obNbNbNbNbNbo',
    'oNbHbNbHbNbNo',
    'oHbNbHbNbHbHo',
    '.oNbNbNbNbNo.',
    '..oNbbbbbNo..',
    '...ooooooo...',
  ]);
  const HATCHLING = bake([
    '..oo...',
    '.oHbo..',
    'oHbbyo.',
    'owwwwo.',
    '.owWo..',
    '.o..o..',
  ], BIRD_PAL);

  const MUSHROOM = bake([
    '.oAAAo.',
    'oAzAzAo',
    'oAAzAAo',
    '.owwwo.',
    '.owwWo.',
    '.oowoo.',
  ]);
  const MUSHROOM2 = bake([
    '.ooo.',
    'oyqyo',
    'oyyqo',
    '.owo.',
    '.owo.',
    '.ooo.',
  ], Object.assign({}, PAL, { y: '#d98a3d', q: '#e8b060' }));
  const FERN = bake([
    '..l...l..',
    '.lGl.lGl.',
    'l.oGoGo.l',
    '..lGGGl..',
    '...oGo...',
    '...oGo...',
  ]);
  const BUSH = bake([
    '...ooooo....',
    '..oGmmmGo...',
    '.oGmlllmGo..',
    'oGmllLllmGo.',
    'oGmmlllmmGo.',
    '.oGmmmmmGo..',
    '..ooooooo...',
  ]);
  const LOG = bake([
    '.ooooooooooo.',
    'oNbbbbbbbbNo',
    'oHNbnbnbnbNo',
    'oNbnbnbnbbNo',
    '.oooooooooo.',
  ]);
  const GRASSB = bake([
    'l...l..l.',
    'lGl.lGllGl'.slice(0, 9),
    'oGloGloGlo'.slice(0, 9),
  ]);

  // carnivorous pitcher / snap-vine (forest ground ambush)
  const PITCHER_LURK = bake([
    '.o...o.',
    'oGo.oGo',
    'oGgGgGo',
    'oGGGGGo',
    '.ooooo.',
  ]);
  const PITCHER_GAPE = bake([
    '.o.....o.',
    'oGo...oGo',
    'oGgo.ogGo',
    'oGCCCCCGo',
    'oCzCzCzCo',
    'oCCCCCCCo',
    'oGCCCCCGo',
    '.oGGGGGo.',
    '..ooooo..',
  ]);

  // glowing chase-bug (firefly beetle)
  const CHASE_BUG = bake([
    'p..o..p',
    '.LLfLL.',
    'LfFyFfL',
    '.LLfLL.',
    'p..o..p',
  ], Object.assign({}, PAL, { L: '#fff3a8', f: '#ffe27a', F: '#ffd257', y: '#fffbe0', p: '#3a3320' }));
  const CHASE_BUG2 = bake([
    'p.....p',
    '.LLfLL.',
    'LfFyFfL',
    '.LLfLL.',
    'p.o.o.p',
  ], Object.assign({}, PAL, { L: '#fff3a8', f: '#ffe27a', F: '#ffd257', y: '#fffbe0', p: '#3a3320' }));

  // ---- wasp swarm ----
  const WASP_PAL = Object.assign({}, PAL, { y: '#f6c945', P: '#2b1d20', u: '#cfeaf5', o: '#241a12', p: '#241a12' });
  const WASP1 = bake([
    'u..o..u',
    '.oyPyo.',
    'oPyPyPo',
    '.oyPyo.',
    '..ooo..',
    '...p...',
  ], WASP_PAL);
  const WASP2 = bake([
    '.o...o.',
    'uoyPyou',
    'oPyPyPo',
    '.oyPyo.',
    '..ooo..',
    '...p...',
  ], WASP_PAL);

  // ---- spider (drops on a thread) ----
  const SPIDER = bake([
    'p.......p',
    '.o.....o.',
    'o.oPPPo.o',
    '.oPzPzPo.',
    'o.oPKPo.o',
    '.o.....o.',
    'p.......p',
  ], Object.assign({}, PAL, { P: '#2e2028', z: '#e8e0f0', K: '#8a3244', o: '#3a2b34', p: '#241a20' }));

  // ---- Charles Darwin (interactive-tutorial guide portrait) ----
  const DARWIN = bake([
    '......oooooo......',
    '....oobbbbbboo....',
    '...obbwwwwwwbbo...',
    '..obwwwwwwwwwwbo..',
    '..obwwwwwwwwwwbo..',
    '..obwbwwwwwwbwbo..',
    '..obwpwwwwwwpwbo..',
    '..obwwwwwwwwwwbo..',
    '..oobwwwwwwwwboo..',
    '...ozzwwwwwwzzo...',
    '..ozzzzwwwwzzzzo..',
    '..ozzzzzzzzzzzzo..',
    '..ovzzzzzzzzzzvo..',
    '..ovvzzzzzzzzvvo..',
    '...ovvzzzzzzvvo...',
    '....ovvzzzzvvo....',
    '..PPPPovvvvoPPPP..',
    '.PPSSPPPPPPPPSSPP.',
    'PPSSSSPPPPPPSSSSPP',
    'PPPPPPPPPPPPPPPPPP',
  ], Object.assign({}, PAL, {
    o: '#241a1c', b: '#6a5548', w: '#f0cfa0', p: '#241a1c',
    z: '#eceef2', v: '#b9bcc4', P: '#39323f', S: '#514859',
  }));

  // ============================================================
  //  NEW ENEMIES & MINI-GAME CRITTERS
  // ============================================================
  // ---- bat: erratic dusk flyer ----
  const BAT_PAL = Object.assign({}, PAL, { o: '#1f1626', P: '#43314a', b: '#63496b', e: '#ffd257' });
  const BAT1 = bake([   // wings raised
    'o.o.....o.o',
    'oPoo...ooPo',
    'oPPPo.oPPPo',
    '.bPPPPPPPb.',
    '..oPe.ePo..',
    '...o.o.o...',
  ], BAT_PAL);
  const BAT2 = bake([   // wings lowered
    '...........',
    '.oo.....oo.',
    'oPPPo.oPPPo',
    '.bPPPPPPPb.',
    '..oPe.ePo..',
    '..o.o.o.o..',
  ], BAT_PAL);

  // ---- dragonfly: hovers then dashes (faces left) ----
  const DFLY_PAL = Object.assign({}, PAL, { u: '#a8e4f2', G: '#2c8a80', t: '#3fc0b0', e: '#ffd257', o: '#18342f' });
  const DFLY1 = bake([   // wings out
    '..u.....u..',
    '.uuu...uuu.',
    '..uu...uu..',
    'eeGtGtGtGtt',
    '..uu...uu..',
    '.uuu...uuu.',
    '..u.....u..',
  ], DFLY_PAL);
  const DFLY2 = bake([   // wings folded
    '...........',
    '.uu.....uu.',
    '..u.....u..',
    'eeGtGtGtGtt',
    '..u.....u..',
    '.uu.....uu.',
    '...........',
  ], DFLY_PAL);

  // ---- bullfrog: floor leaper (distinct from the small FROG food) ----
  const BFROG_PAL = Object.assign({}, PAL, { g: '#5cad3c', G: '#3d7f2a', e: '#ffd257', p: '#161020', w: '#cfe8a0' });
  const BFROG = bake([
    '..e.....e..',
    '.epe...epe.',
    '.ggggggggg.',
    'ggGgggggGgg',
    'gGggwwwwggG',
    'GGGGGGGGGGG',
    '.GG.....GG.',
  ], BFROG_PAL);

  // ---- jellyfish: slow ocean drifter (2 pulse frames) ----
  const JELLY_PAL = Object.assign({}, PAL, { u: '#a8e4f2', U: '#68b7cf', d: '#f2748f', o: '#5a7f9a' });
  const JELLY1 = bake([
    '..ouuo..',
    '.ouuuuo.',
    'ouuuuuuo',
    'oUduuduo',
    '.o.oo.o.',
    '.d.u.d.u',
    '.u.d.u.d',
    '..d...u.',
  ], JELLY_PAL);
  const JELLY2 = bake([
    '..ouuo..',
    '.ouuuuo.',
    '.ouuuuo.',
    'oUduuduo',
    '.oo..oo.',
    '.u.dd.u.',
    '..d..u..',
    '..u..d..',
  ], JELLY_PAL);

  // ---- piranha: leaps from the water (faces up-left) ----
  const PIR_PAL = Object.assign({}, PAL, { s: '#5f6f7a', S: '#3a4650', d: '#e0525c', z: '#f2f7ff', e: '#ffd257', o: '#20282e' });
  const PIRANHA = bake([
    '...ooo...',
    '..ossSo..',
    '.osssSSo.',
    'oseszsSSo',
    'oszzzzsSo',
    'oSsssdSSo',
    '.oSddSo..',
    '..oooo...',
  ], PIR_PAL);

  // ---- vulture: circles then dives (bald pink head) ----
  const VULT_PAL = Object.assign({}, PAL, { a: '#4a3d34', H: '#6a5a4a', P: '#2a221c', d: '#c97a6a', y: '#e0b24a' });
  const VULT_MID = bake([
    'a...........a',
    'aaa.......aaa',
    '.aaaa...aaaa.',
    '..aaaHdHaaa..',
    '..aaPPyPPaa..',
    '.....a.a.....',
  ], VULT_PAL);
  const VULT_UP = bake([
    '..aa.....aa..',
    '.aaaa...aaaa.',
    '..aaa.d.aaa..',
    '...aaHdHaa...',
    '....PPyPP....',
    '.....a.a.....',
  ], VULT_PAL);

  // ---- firefly (mini-game trail dot, green glow) ----
  const FIREFLY = bake([
    '.o.o.',
    'oLlLo',
    'oltLo',
    'oLlLo',
    '.oto.',
  ], Object.assign({}, PAL, { L: '#c7ff9a', l: '#96f0a0', t: '#5cad3c', o: '#26401f' }));

  // ---- butterfly (friendly swarm, 2 flap frames) ----
  const BFLY_PAL = Object.assign({}, PAL, { M: '#ff9f4d', d: '#ffd257', o: '#3a2418', P: '#5a3a1c', e: '#fff3a8' });
  const BFLY1 = bake([   // wings open
    'oMMo.oMMo',
    'oMdMoMdMo',
    'oMMdPdMMo',
    'oMdMoMdMo',
    'oMMo.oMMo',
  ], BFLY_PAL);
  const BFLY2 = bake([   // wings up
    '.oo...oo.',
    'oMMo.oMMo',
    'oMdPdMo..'.slice(0, 9),
    'oMMdPdMMo',
    '.oMo.oMo.',
  ], BFLY_PAL);

  // ---- gear (settings icon) ----
  const GEAR = bake([
    '..o.o.o..',
    '.oyoyoyo.',
    'ooyyyyyoo',
    'oyyoooyoy'.slice(0, 9),
    '.yyoSoyy.',
    'oyyoooyoy'.slice(0, 9),
    'ooyyyyyoo',
    '.oyoyoyo.',
    '..o.o.o..',
  ], Object.assign({}, PAL, { y: '#c9b088', S: '#241611', o: '#5c3a1e' }));

  // ============================================================
  //  BIRD COMPOSITOR
  // ============================================================
  // cfg: frame(0..2), open, bigBeak, bigWings, bigTail, crest(0..3),
  //      stuffed, blink, shield, time, sx, sy, glidePose, legsDown
  function drawBird(ctx, x, y, rot, cfg) {
    ctx.save();
    ctx.translate(Math.round(x), Math.round(y));
    if (rot) ctx.rotate(rot);
    if (cfg.sx || cfg.sy) ctx.scale(cfg.sx || 1, cfg.sy || 1);

    if (cfg.shield) {
      ctx.globalAlpha = 0.3 + 0.14 * Math.sin((cfg.time || 0) * 8);
      ctx.fillStyle = PAL.u;
      ctx.beginPath();
      ctx.arc(0, 0, 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    // body-space origin roughly at torso centre
    const ox = -8, oy = -6;

    // tail (attaches at back-left)
    const tail = cfg.bigTail ? TAIL_BIG : TAIL_S;
    ctx.drawImage(tail, ox - tail.width + 2, oy + 2);

    // legs (behind body when tucked, extended when landing)
    if (cfg.legsDown) ctx.drawImage(LEG, ox + 4, oy + 11);
    else ctx.drawImage(LEG, ox + 5, oy + 10);

    // body
    if (cfg.stuffed) { ctx.save(); ctx.scale(1.08, 1.06); }
    ctx.drawImage(BODY, ox, oy);
    if (cfg.stuffed) ctx.restore();

    // head (upper-right)
    const hx = ox + 8, hy = oy - 3;
    ctx.drawImage(HEAD, hx, hy);

    // crest on the crown
    if (cfg.crest === 1) ctx.drawImage(CREST1, hx + 1, hy - 2);
    else if (cfg.crest === 2) ctx.drawImage(CREST2, hx, hy - 3);
    else if (cfg.crest >= 3) ctx.drawImage(CREST3, hx - 1, hy - 3);

    // eye
    ctx.drawImage(cfg.blink ? EYE_BLINK : EYE, hx + 5, hy + 2);

    // beak (projects from the head front)
    const beak = cfg.bigBeak
      ? (cfg.open ? BEAK_B_OPEN : BEAK_B)
      : (cfg.open ? BEAK_S_OPEN : BEAK_S);
    ctx.drawImage(beak, hx + 8, hy + (cfg.open ? 2 : 3));

    // near wing over the flank
    let wing, wx, wy;
    if (cfg.glidePose) { wing = WING_MID; wx = ox + 2; wy = oy - 1; }
    else if (cfg.frame === 0) { wing = WING_UP; wx = ox + 2; wy = oy - 6; }
    else if (cfg.frame === 2) { wing = WING_DOWN; wx = ox + 3; wy = oy + 3; }
    else { wing = WING_MID; wx = ox + 2; wy = oy + 1; }
    if (cfg.bigWings) ctx.drawImage(wing, wx - 2, wy + 1);
    ctx.drawImage(wing, wx, wy);

    ctx.restore();
  }

  // beak tip offset from bird centre, pre-rotation
  function beakTip(cfg) {
    return { x: cfg.bigBeak ? 12 : 10, y: -3 };
  }

  window.SPR = {
    PAL: PAL, BIRD_PAL: BIRD_PAL, bake: bake, bakeBird: bakeBird,
    BODY: BODY, HEAD: HEAD, TUMMY: TUMMY,
    WING_UP: WING_UP, WING_MID: WING_MID, WING_DOWN: WING_DOWN,
    BEAK_S: BEAK_S, BEAK_B: BEAK_B, TAIL_S: TAIL_S, TAIL_BIG: TAIL_BIG,
    CREST1: CREST1, CREST2: CREST2, CREST3: CREST3, LEG: LEG,
    SNAKE_COIL: SNAKE_COIL, SNAKE_REAR: SNAKE_REAR, SNAKE_STRIKE: SNAKE_STRIKE,
    SNAPPER_LURK: SNAPPER_LURK, SNAPPER_GAPE: SNAPPER_GAPE,
    HAWK_MID: HAWK_MID, HAWK_UP: HAWK_UP, FALCON_MID: FALCON_MID, FALCON_UP: FALCON_UP, FALCON_DIVE: FALCON_DIVE,
    BERRY: BERRY, SEED: SEED, NUT: NUT, NECTAR: NECTAR, GRUB: GRUB,
    FROG: FROG, MANGO: MANGO, BUG1: BUG1, BUG2: BUG2, GOLD: GOLD,
    HEART: HEART, HEART_EMPTY: HEART_EMPTY, DNA: DNA, SKULL: SKULL, FEATHER: FEATHER,
    ICON_MEADOW: ICON_MEADOW, ICON_FOREST: ICON_FOREST, ICON_GROVE: ICON_GROVE,
    ICON_MARSH: ICON_MARSH, ICON_SWAMP: ICON_SWAMP, ICON_CRAGS: ICON_CRAGS, ICON_JUNGLE: ICON_JUNGLE,
    CLOUD1: CLOUD1, CLOUD2: CLOUD2, CLOUD3: CLOUD3,
    DURIAN: DURIAN, EGG: EGG, EGG_CRACK: EGG_CRACK, NEST: NEST, HATCHLING: HATCHLING,
    MUSHROOM: MUSHROOM, MUSHROOM2: MUSHROOM2, FERN: FERN, BUSH: BUSH, LOG: LOG, GRASSB: GRASSB,
    PITCHER_LURK: PITCHER_LURK, PITCHER_GAPE: PITCHER_GAPE,
    CHASE_BUG: CHASE_BUG, CHASE_BUG2: CHASE_BUG2, DARWIN: DARWIN,
    WASP1: WASP1, WASP2: WASP2, SPIDER: SPIDER,
    BAT1: BAT1, BAT2: BAT2, DFLY1: DFLY1, DFLY2: DFLY2, BFROG: BFROG,
    JELLY1: JELLY1, JELLY2: JELLY2, PIRANHA: PIRANHA, VULT_MID: VULT_MID, VULT_UP: VULT_UP,
    FIREFLY: FIREFLY, BFLY1: BFLY1, BFLY2: BFLY2, GEAR: GEAR,
    drawBird: drawBird, beakTip: beakTip,
  };
})();
