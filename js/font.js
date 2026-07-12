// Tiny 3x5 bitmap font — keeps every piece of UI text on the pixel grid.
(function () {
  const G = {
    'A': ['.x.', 'x.x', 'xxx', 'x.x', 'x.x'],
    'B': ['xx.', 'x.x', 'xx.', 'x.x', 'xx.'],
    'C': ['.xx', 'x..', 'x..', 'x..', '.xx'],
    'D': ['xx.', 'x.x', 'x.x', 'x.x', 'xx.'],
    'E': ['xxx', 'x..', 'xx.', 'x..', 'xxx'],
    'F': ['xxx', 'x..', 'xx.', 'x..', 'x..'],
    'G': ['.xx', 'x..', 'x.x', 'x.x', '.xx'],
    'H': ['x.x', 'x.x', 'xxx', 'x.x', 'x.x'],
    'I': ['xxx', '.x.', '.x.', '.x.', 'xxx'],
    'J': ['..x', '..x', '..x', 'x.x', '.x.'],
    'K': ['x.x', 'x.x', 'xx.', 'x.x', 'x.x'],
    'L': ['x..', 'x..', 'x..', 'x..', 'xxx'],
    'M': ['x.x', 'xxx', 'xxx', 'x.x', 'x.x'],
    'N': ['xx.', 'x.x', 'x.x', 'x.x', 'x.x'],
    'O': ['.x.', 'x.x', 'x.x', 'x.x', '.x.'],
    'P': ['xx.', 'x.x', 'xx.', 'x..', 'x..'],
    'Q': ['.x.', 'x.x', 'x.x', '.x.', '..x'],
    'R': ['xx.', 'x.x', 'xx.', 'x.x', 'x.x'],
    'S': ['.xx', 'x..', '.x.', '..x', 'xx.'],
    'T': ['xxx', '.x.', '.x.', '.x.', '.x.'],
    'U': ['x.x', 'x.x', 'x.x', 'x.x', 'xxx'],
    'V': ['x.x', 'x.x', 'x.x', 'x.x', '.x.'],
    'W': ['x.x', 'x.x', 'xxx', 'xxx', 'x.x'],
    'X': ['x.x', 'x.x', '.x.', 'x.x', 'x.x'],
    'Y': ['x.x', 'x.x', '.x.', '.x.', '.x.'],
    'Z': ['xxx', '..x', '.x.', 'x..', 'xxx'],
    '0': ['xxx', 'x.x', 'x.x', 'x.x', 'xxx'],
    '1': ['.x.', 'xx.', '.x.', '.x.', 'xxx'],
    '2': ['xx.', '..x', '.x.', 'x..', 'xxx'],
    '3': ['xxx', '..x', '.xx', '..x', 'xxx'],
    '4': ['x.x', 'x.x', 'xxx', '..x', '..x'],
    '5': ['xxx', 'x..', 'xx.', '..x', 'xx.'],
    '6': ['.xx', 'x..', 'xxx', 'x.x', 'xxx'],
    '7': ['xxx', '..x', '.x.', '.x.', '.x.'],
    '8': ['xxx', 'x.x', 'xxx', 'x.x', 'xxx'],
    '9': ['xxx', 'x.x', 'xxx', '..x', 'xx.'],
    ' ': ['...', '...', '...', '...', '...'],
    '.': ['...', '...', '...', '...', '.x.'],
    ',': ['...', '...', '...', '.x.', 'x..'],
    '!': ['.x.', '.x.', '.x.', '...', '.x.'],
    '?': ['xx.', '..x', '.x.', '...', '.x.'],
    ':': ['...', '.x.', '...', '.x.', '...'],
    "'": ['.x.', '.x.', '...', '...', '...'],
    '-': ['...', '...', 'xxx', '...', '...'],
    '+': ['...', '.x.', 'xxx', '.x.', '...'],
    '/': ['..x', '..x', '.x.', 'x..', 'x..'],
    '(': ['.x.', 'x..', 'x..', 'x..', '.x.'],
    ')': ['.x.', '..x', '..x', '..x', '.x.'],
    '%': ['x.x', '..x', '.x.', 'x..', 'x.x'],
    '>': ['x..', '.x.', '..x', '.x.', 'x..'],
    '<': ['..x', '.x.', 'x..', '.x.', '..x'],
    '*': ['x.x', '.x.', 'xxx', '.x.', 'x.x'],
  };

  function textWidth(str, scale) {
    scale = scale || 1;
    return str.length ? (str.length * 4 - 1) * scale : 0;
  }

  // align: 'left' | 'center' | 'right'
  function drawText(ctx, str, x, y, color, scale, align) {
    scale = scale || 1;
    str = String(str).toUpperCase();
    let px = Math.round(x);
    const w = textWidth(str, scale);
    if (align === 'center') px -= Math.floor(w / 2);
    else if (align === 'right') px -= w;
    ctx.fillStyle = color;
    for (let i = 0; i < str.length; i++) {
      const g = G[str[i]] || G['?'];
      for (let r = 0; r < 5; r++) {
        const row = g[r];
        for (let c = 0; c < 3; c++) {
          if (row[c] === 'x') {
            ctx.fillRect(px + c * scale, Math.round(y) + r * scale, scale, scale);
          }
        }
      }
      px += 4 * scale;
    }
  }

  function drawTextShadow(ctx, str, x, y, color, scale, align, shadowColor) {
    drawText(ctx, str, x + (scale || 1), y + (scale || 1), shadowColor || 'rgba(20,12,28,0.9)', scale, align);
    drawText(ctx, str, x, y, color, scale, align);
  }

  // crisp 1px outline in 8 directions — for big logo text
  function drawTextOutline(ctx, str, x, y, color, scale, align, outlineColor) {
    const oc = outlineColor || '#33203a';
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        if (dx || dy) drawText(ctx, str, x + dx, y + dy, oc, scale, align);
      }
    }
    drawText(ctx, str, x, y, color, scale, align);
  }

  window.FONT = { drawText: drawText, drawTextShadow: drawTextShadow, drawTextOutline: drawTextOutline, textWidth: textWidth };
})();
