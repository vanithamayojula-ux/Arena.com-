/* AFTERGLOW — canvas UI: the story box, choices, HUD, cards. Everything is
   drawn with the same ink-and-gold language: thin rules, ember accents. */

import { clamp, wrapLines, TAU } from './util.js';
import { CAST, drawPortrait } from './actors.js';
import { PAL } from './paint.js';

const SERIF = '"Spectral", Georgia, serif';
const DISP = '"Cormorant Garamond", Georgia, serif';

export function setFonts(g) {
  g.textBaseline = 'alphabetic';
}

/* ---- dialogue ---- */
export function drawDialogue(g, W, H, dlg, t, opts = {}) {
  const boxH = opts.boxH || 150;
  const boxW = Math.min(W - 80, 860);
  const bx = (W - boxW) / 2, by = H - boxH - 26;
  // parchment-dark plate
  roundPanel(g, bx, by, boxW, boxH, 10);
  const hasSpeaker = dlg.who && dlg.who !== 'narrator';
  if (hasSpeaker) {
    const c = CAST[dlg.who] || CAST.crowd;
    g.font = `600 15px ${SERIF}`;
    g.fillStyle = c.trim || PAL.ember;
    g.fillText((c.name || dlg.who).toUpperCase(), bx + 92, by + 26);
    g.save();
    drawPortrait(g, bx + 52, by + boxH / 2 - 8, 34, dlg.who, dlg.mood || 0, t);
    g.restore();
  }
  g.font = `${hasSpeaker ? '16.5' : 'italic 17'}px ${SERIF}`;
  g.fillStyle = '#dfe4ee';
  const tx = bx + (hasSpeaker ? 96 : 28);
  const lines = wrapLines(g, dlg.shown, boxW - (hasSpeaker ? 130 : 60));
  const lh = hasSpeaker ? 23 : 25;
  let y = by + (hasSpeaker ? 48 : 40);
  for (const ln of lines) {
    if (y > by + boxH - 14) break;
    g.fillText(ln, tx, y);
    y += lh;
  }
  if (dlg.done) {
    g.save();
    g.globalAlpha = 0.6 + Math.sin(t * 5) * 0.3;
    g.fillStyle = PAL.ember;
    g.font = `12px ${SERIF}`;
    g.fillText(opts.awaitHint || '▼ SPACE', bx + boxW - 70, by + boxH - 12);
    g.restore();
  }
}

export function drawChoices(g, W, H, choices, idx, t, opts = {}) {
  const cw = Math.min(W - 120, 640);
  const cx = (W - cw) / 2;
  let cy = opts.startY ?? (H - 230);
  g.font = `15.5px ${SERIF}`;
  for (let i = 0; i < choices.length; i++) {
    const c = choices[i];
    const lines = wrapLines(g, c.t, cw - 54);
    const h = lines.length * 21 + 16;
    const on = i === idx;
    g.save();
    g.fillStyle = on ? 'rgba(28,20,10,0.94)' : 'rgba(10,13,20,0.88)';
    g.strokeStyle = on ? 'rgba(232,182,76,0.85)' : 'rgba(120,140,170,0.28)';
    g.lineWidth = on ? 1.6 : 1;
    roundRect(g, cx, cy, cw, h, 8);
    g.fill(); g.stroke();
    if (on) {
      g.fillStyle = `rgba(232,182,76,${0.12 + Math.sin(t * 4) * 0.04})`;
      roundRect(g, cx, cy, cw, h, 8); g.fill();
      g.fillStyle = PAL.ember;
      g.font = `13px ${SERIF}`;
      g.fillText('❖', cx + 14, cy + h / 2 + 5);
    }
    g.font = `15.5px ${SERIF}`;
    g.fillStyle = on ? '#f4e8d0' : '#b9c2d2';
    let ty = cy + 22;
    for (const ln of lines) { g.fillText(ln, cx + 34, ty); ty += 21; }
    if (c.note) {
      g.font = `italic 12.5px ${SERIF}`;
      g.fillStyle = on ? 'rgba(232,182,76,0.9)' : 'rgba(160,170,190,0.55)';
      g.fillText(c.note, cx + cw - 20 - g.measureText(c.note).width, cy + h / 2 + 4);
    }
    g.restore();
    cy += h + 8;
  }
}

/* ---- HUD ---- */
export function drawHUD(g, W, H, G, t, opts = {}) {
  g.save();
  const pad = 18;
  // objective
  if (opts.objective) {
    g.font = `italic 14px ${SERIF}`;
    g.fillStyle = 'rgba(222,228,240,0.8)';
    const ln = '— ' + opts.objective;
    g.fillText(ln, pad, H - 22);
  }
  // left cluster: oil, hearts, ammo, chits
  g.globalAlpha = opts.fade ?? 1;
  // oil gauge as a lantern flask
  const ox = pad, oy = pad;
  g.fillStyle = 'rgba(8,11,18,0.55)';
  roundRect(g, ox - 6, oy - 6, 196, 44 + (G.showMembers ? 64 : 0), 9); g.fill();
  g.strokeStyle = 'rgba(120,140,170,0.25)'; roundRect(g, ox - 6, oy - 6, 196, 44 + (G.showMembers ? 64 : 0), 9); g.stroke();
  g.font = `11px ${SERIF}`;
  g.fillStyle = '#93a3bb';
  g.fillText('LANTERN OIL', ox + 2, oy + 9);
  const ow = 120, ratio = clamp(G.oil / G.oilMax, 0, 1);
  g.fillStyle = 'rgba(0,0,0,0.5)';
  roundRect(g, ox + 2, oy + 14, ow, 9, 4); g.fill();
  const og = g.createLinearGradient(ox, 0, ox + ow, 0);
  og.addColorStop(0, '#7a4a18'); og.addColorStop(1, ratio < 0.25 ? '#ff5030' : '#ffb45e');
  g.fillStyle = og;
  roundRect(g, ox + 2, oy + 14, Math.max(2, ow * ratio), 9, 4); g.fill();
  if (ratio < 0.25) { g.globalAlpha = (opts.fade ?? 1) * (0.5 + Math.sin(t * 6) * 0.5); }
  g.fillStyle = '#d8c9a8';
  g.fillText(`${Math.round(G.oil)}%`, ox + ow + 10, oy + 22);
  g.globalAlpha = opts.fade ?? 1;

  // hearts (small embers) + ammo + chits
  for (let i = 0; i < G.hpMax; i++) {
    const hx = ox + 4 + i * 15, hy = oy + 34;
    g.beginPath(); g.arc(hx, hy, 4.6, 0, TAU);
    g.fillStyle = i < G.hp ? (i < 1 ? '#ff4b3a' : PAL.ember2) : 'rgba(90,105,130,0.3)';
    g.fill();
    if (i < G.hp) { g.strokeStyle = 'rgba(255,220,160,0.5)'; g.stroke(); }
  }
  g.font = `12px ${SERIF}`;
  g.fillStyle = '#aeb9cc';
  g.fillText(`⌾ ${G.chits}`, ox + 78, oy + 38);
  if (G.ammo > 0) {
    g.fillStyle = '#c9a27b';
    g.fillText(`✦ ${G.ammo}`, ox + 136, oy + 38);
  }
  // troupe trust embers
  if (G.showMembers) {
    let my = oy + 52;
    for (const k of ['bod', 'nadia', 'tomas', ...(G.pell ? ['pell'] : [])]) {
      const c = CAST[k];
      g.font = `11px ${SERIF}`;
      g.fillStyle = '#8fa0b8';
      g.fillText(c.name, ox + 2, my + 4);
      for (let i = 0; i < 4; i++) {
        g.beginPath();
        g.arc(ox + 74 + i * 12, my, 3.4, 0, TAU);
        g.fillStyle = i < G.trust[k] ? 'rgba(255,170,80,0.95)' : 'rgba(120,135,160,0.25)';
        g.fill();
      }
      my += 15;
    }
  }
  g.restore();
}

/* meters: tension (negotiation), crowd (performance) */
export function drawMeter(g, x, y, w, label, v, color, opts = {}) {
  g.save();
  g.font = `11px ${SERIF}`;
  g.fillStyle = 'rgba(200,210,228,0.75)';
  g.fillText(label, x, y - 6);
  g.fillStyle = 'rgba(6,9,14,0.6)';
  roundRect(g, x, y, w, 10, 5); g.fill();
  g.strokeStyle = 'rgba(140,160,190,0.3)';
  roundRect(g, x, y, w, 10, 5); g.stroke();
  g.fillStyle = color;
  roundRect(g, x + 1, y + 1, Math.max(1, (w - 2) * clamp(v, 0, 1)), 8, 4); g.fill();
  if (opts.marker != null) {
    g.strokeStyle = 'rgba(255,255,255,0.7)';
    g.beginPath();
    const mx = x + w * clamp(opts.marker, 0, 1);
    g.moveTo(mx, y - 3); g.lineTo(mx, y + 13); g.stroke();
  }
  g.restore();
}

/* title / chapter cards */
export function drawCard(g, W, H, card, t) {
  const p = card.p; // 0..1
  const a = p < 0.2 ? p / 0.2 : p > 0.8 ? (1 - p) / 0.2 : 1;
  g.save();
  g.globalAlpha = clamp(a, 0, 1);
  g.fillStyle = 'rgba(3,4,9,0.86)';
  g.fillRect(0, 0, W, H);
  g.textAlign = 'center';
  if (card.kicker) {
    g.font = `500 13px ${SERIF}`;
    g.fillStyle = 'rgba(210,180,120,0.8)';
    g.fillText(card.kicker.toUpperCase(), W / 2, H * 0.4 - 44);
  }
  g.font = `600 ${Math.min(54, W / 12)}px ${DISP}`;
  g.fillStyle = '#eee6d8';
  g.fillText(card.title, W / 2, H * 0.47);
  // brush underline
  const uw = Math.min(420, W * 0.5);
  g.strokeStyle = 'rgba(232,182,76,0.5)'; g.lineWidth = 1.2;
  g.beginPath();
  for (let x = -uw / 2; x <= uw / 2; x += 8) g.lineTo(W / 2 + x, H * 0.495 + Math.sin(x * 0.05 + t) * 0.8);
  g.stroke();
  if (card.sub) {
    g.font = `italic 16.5px ${SERIF}`;
    g.fillStyle = 'rgba(180,192,212,0.85)';
    let yy = H * 0.545;
    for (const ln of card.sub.split('\n')) { g.fillText(ln, W / 2, yy); yy += 24; }
  }
  if (card.hint) {
    g.font = `12.5px ${SERIF}`;
    g.fillStyle = 'rgba(150,162,182,0.7)';
    g.fillText(card.hint, W / 2, H * 0.9);
  }
  g.restore();
}

/* small floating notifications (trust up / chits / flags) */
export function drawToasts(g, W, H, toasts, t) {
  g.save();
  g.textAlign = 'right';
  let y = 88;
  for (const n of toasts) {
    const a = n.t < 0.4 ? n.t / 0.4 : n.t > n.life - 1 ? clamp(n.life - n.t, 0, 1) : 1;
    g.globalAlpha = a;
    g.font = `13.5px ${SERIF}`;
    g.fillStyle = n.color || '#e8d5a8';
    g.fillText(n.text, W - 22, y);
    y += 22;
  }
  g.restore();
}

export function roundRect(g, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}
export function roundPanel(g, x, y, w, h, r) {
  g.save();
  g.fillStyle = 'rgba(9,11,17,0.92)';
  roundRect(g, x, y, w, h, r); g.fill();
  g.strokeStyle = 'rgba(160,140,100,0.35)'; g.lineWidth = 1;
  roundRect(g, x, y, w, h, r); g.stroke();
  g.strokeStyle = 'rgba(232,182,76,0.16)';
  roundRect(g, x + 3, y + 3, w - 6, h - 6, Math.max(0, r - 3)); g.stroke();
  g.restore();
}

/* letterbox bands for cinematic beats */
export function letterbox(g, W, H, amt) {
  if (amt <= 0.01) return;
  const h = 90 * amt;
  g.save();
  g.fillStyle = '#02030a';
  g.fillRect(0, 0, W, h);
  g.fillRect(0, H - h, W, h);
  g.restore();
}
