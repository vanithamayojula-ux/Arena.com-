// A tiny software painter that implements the slice of CanvasRenderingContext2D
// EMBERFALL's art.js actually uses — including real gradient interpolation and the
// four blend modes the dusk is built from. Same spirit as games/apex/tools/raster.mjs,
// but with true radial gradients and destination-out compositing, so the screenshots
// are honest frames, not approximations.

import { deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';

// ---------------------------------------------------------------- color & gradient

export function parseColor(c) {
  if (c && typeof c === 'object' && c.__grad) return c;
  const s = String(c).trim();
  let m = s.match(/^rgba?\(([^)]+)\)$/i);
  if (m) {
    const p = m[1].split(',').map((v) => parseFloat(v));
    return { rgb: [p[0] / 255, p[1] / 255, p[2] / 255], a: p.length > 3 ? p[3] : 1 };
  }
  if (s[0] === '#') {
    let h = s.slice(1);
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    const n = parseInt(h, 16);
    return { rgb: [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255], a: 1 };
  }
  if (s === 'transparent') return { rgb: [0, 0, 0], a: 0 };
  return { rgb: [1, 0, 1], a: 1 };
}

function makeGradient(kind, args) {
  const g = { __grad: true, kind, a: args.slice(), stops: [] };
  g.addColorStop = (o, c) => g.stops.push({ o, c: parseColor(c) });
  return g;
}

function gradColor(g, x, y) {
  let t;
  if (g.kind === 'l') {
    const [x0, y0, x1, y1] = g.a;
    const dx = x1 - x0, dy = y1 - y0;
    const len2 = dx * dx + dy * dy || 1;
    t = Math.min(1, Math.max(0, ((x - x0) * dx + (y - y0) * dy) / len2));
  } else {
    const [x0, y0, r0, x1, y1, r1] = g.a;
    const d = Math.hypot(x - x1, y - y1);
    t = r1 === r0 ? 1 : Math.min(1, Math.max(0, (d - r0) / (r1 - r0)));
  }
  const st = g.stops;
  if (!st.length) return { rgb: [1, 0, 1], a: 0 };
  if (t <= st[0].o) return st[0].c;
  for (let i = 1; i < st.length; i++) {
    if (t <= st[i].o) {
      const a2 = st[i - 1], b2 = st[i];
      const k = (t - a2.o) / ((b2.o - a2.o) || 1);
      return {
        rgb: [a2.c.rgb[0] + (b2.c.rgb[0] - a2.c.rgb[0]) * k, a2.c.rgb[1] + (b2.c.rgb[1] - a2.c.rgb[1]) * k, a2.c.rgb[2] + (b2.c.rgb[2] - a2.c.rgb[2]) * k],
        a: a2.c.a + (b2.c.a - a2.c.a) * k,
      };
    }
  }
  return st[st.length - 1].c;
}

// ---------------------------------------------------------------- canvas

class Ctx2D {
  constructor(cv) {
    this.cv = cv;
    this.m = [1, 0, 0, 1, 0, 0];
    this.stack = [];
    this.fillStyle = '#000'; this.strokeStyle = '#000';
    this.lineWidth = 1; this.lineCap = 'butt'; this.lineJoin = 'miter';
    this.globalAlpha = 1; this.globalCompositeOperation = 'source-over';
    this.font = ''; this.textAlign = 'left'; this.textBaseline = 'alphabetic';
    this.pts = [];
  }
  save() {
    this.stack.push({ m: this.m.slice(), fillStyle: this.fillStyle, strokeStyle: this.strokeStyle, lineWidth: this.lineWidth, globalAlpha: this.globalAlpha, gco: this.globalCompositeOperation });
  }
  restore() {
    const s = this.stack.pop();
    if (!s) return;
    this.m = s.m; this.fillStyle = s.fillStyle; this.strokeStyle = s.strokeStyle;
    this.lineWidth = s.lineWidth; this.globalAlpha = s.globalAlpha; this.globalCompositeOperation = s.gco;
  }
  translate(x, y) { this._mul([1, 0, 0, 1, x, y]); }
  scale(x, y) { this._mul([x, 0, 0, y, 0, 0]); }
  rotate(r) { const c = Math.cos(r), s = Math.sin(r); this._mul([c, s, -s, c, 0, 0]); }
  setTransform(a, b, c, d, e, f) { this.m = [a, b, c, d, e, f]; }
  resetTransform() { this.m = [1, 0, 0, 1, 0, 0]; }
  _mul(n) {
    const [a, b, c, d, e, f] = this.m, [g, h, i, j, k, l] = n;
    this.m = [a * g + c * h, b * g + d * h, a * i + c * j, b * i + d * j, a * k + c * l + e, b * k + d * l + f];
  }
  _t(x, y) { const [a, b, c, d, e, f] = this.m; return [a * x + c * y + e, b * x + d * y + f]; }
  _sx(v) { const m = this.m; return v * Math.hypot(m[0], m[1]); }
  beginPath() { this.pts = []; this.subs = [[]]; this.closedFlags = [false]; }
  _p() { const s = this.subs[this.subs.length - 1]; return s; }
  moveTo(x, y) { const p = this._t(x, y); this._p().push(p); }
  lineTo(x, y) { const p = this._t(x, y); const s = this._p(); if (s.length) s[s.length - 1] = s[s.length - 1]; s.push(p); }
  quadraticCurveTo(cx, cy, x, y) {
    const s = this._p(); const n2 = s.length ? s[s.length - 1] : this._t(cx, cy);
    const c = this._t(cx, cy), e = this._t(x, y);
    for (let i = 1; i <= 8; i++) {
      const t = i / 8, u = 1 - t;
      s.push([u * u * n2[0] + 2 * u * t * c[0] + t * t * e[0], u * u * n2[1] + 2 * u * t * c[1] + t * t * e[1]]);
    }
  }
  bezierCurveTo(x1, y1, x2, y2, x, y) {
    const s = this._p(); const n2 = s.length ? s[s.length - 1] : this._t(x1, y1);
    const c1 = this._t(x1, y1), c2 = this._t(x2, y2), e = this._t(x, y);
    for (let i = 1; i <= 12; i++) {
      const t = i / 12, u = 1 - t;
      s.push([u * u * u * n2[0] + 3 * u * u * t * c1[0] + 3 * u * t * t * c2[0] + t * t * t * e[0],
        u * u * u * n2[1] + 3 * u * u * t * c1[1] + 3 * u * t * t * c2[1] + t * t * t * e[1]]);
    }
  }
  arc(cx, cy, r, a0, a1, ccw) {
    if (r < 0) return;
    let span = a1 - a0;
    if (ccw && span > 0) span -= Math.PI * 2;
    if (!ccw && span < 0) span += Math.PI * 2;
    const n = Math.max(10, Math.min(64, Math.ceil(Math.abs(span) * r / 2.5)));
    const s = this._p();
    for (let i = 0; i <= n; i++) {
      const a = a0 + span * (i / n);
      s.push(this._t(cx + Math.cos(a) * r, cy + Math.sin(a) * r));
    }
  }
  ellipse(cx, cy, rx, ry, rot, a0, a1) { this.arc(cx, cy, Math.max(rx, ry), a0, a1); } // art.js pre-scales via transform
  rect(x, y, w, h) {
    const p0 = this._t(x, y), p1 = this._t(x + w, y), p2 = this._t(x + w, y + h), p3 = this._t(x, y + h);
    this.subs.push([p0, p1, p2, p3]); this.closedFlags.push(true);
    this.subs[this.subs.length - 2].push(p0); // leave an open degenerate current sub
  }
  closePath() { const s = this._p(); if (s.length > 2) s.push(s[0]); this.closedFlags[this.subs.length - 1] = true; }
  _evalStyle(style) {
    const g = typeof style === 'object' && style.__grad ? style : null;
    return { grad: g, col: g ? null : parseColor(style) };
  }
  fill() {
    const { grad, col } = this._evalStyle(this.fillStyle);
    const alpha = this.globalAlpha;
    for (const s of this.subs) {
      if (s.length < 3) continue;
      // scanline even-odd over bbox
      let minY = Infinity, maxY = -Infinity;
      for (const [, y] of s) { if (y < minY) minY = y; if (y > maxY) maxY = y; }
      const y0 = Math.max(0, Math.floor(minY)), y1 = Math.min(this.cv.height - 1, Math.ceil(maxY));
      const n = s.length - 1;
      for (let y = y0; y <= y1; y++) {
        const sy = y + 0.5;
        const xs = [];
        for (let i = 0; i < n; i++) {
          const [ax, ay] = s[i], [bx, by] = s[i + 1];
          if ((ay > sy) === (by > sy)) continue;
          xs.push(ax + ((sy - ay) / (by - ay)) * (bx - ax));
        }
        xs.sort((p, q) => p - q);
        for (let i = 0; i + 1 < xs.length; i += 2) {
          const xa = Math.max(0, Math.ceil(xs[i] - 0.5)), xb = Math.min(this.cv.width - 1, Math.floor(xs[i + 1] - 0.5));
          if (grad) {
            for (let x = xa; x <= xb; x++) {
              const c = gradColor(grad, x + 0.5, sy);
              this.cv.blend(x, y, c.rgb, c.a * alpha, this.globalCompositeOperation);
            }
          } else {
            for (let x = xa; x <= xb; x++) this.cv.blend(x, y, col.rgb, col.a * alpha, this.globalCompositeOperation);
          }
        }
      }
    }
  }
  stroke() {
    const { grad, col } = this._evalStyle(this.strokeStyle);
    const w = Math.max(0.3, this._sx(this.lineWidth));
    const r = w / 2, alpha = this.globalAlpha;
    for (const s of this.subs) {
      for (let i = 0; i + 1 < s.length; i++) {
        const [x0, y0] = s[i], [x1, y1] = s[i + 1];
        const len = Math.hypot(x1 - x0, y1 - y0);
        const steps = Math.max(1, Math.ceil(len / Math.max(0.6, r * 0.7)));
        for (let k = 0; k <= steps; k++) {
          const t = k / steps;
          this.cv.disc(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, r, grad, col, alpha * (grad ? gradColor(grad, x0, y0).a : col.a), this.globalCompositeOperation, grad ? gradColor(grad, x0, y0).rgb : null);
        }
      }
    }
  }
  fillRect(x, y, w, h) { this.beginPath(); this.rect(x, y, w, h); this.fill(); }
  strokeRect(x, y, w, h) { this.beginPath(); this.rect(x, y, w, h); this.closePath(); this.stroke(); }
  clearRect(x, y, w, h) {
    const x0 = Math.max(0, Math.floor(x)), x1 = Math.min(this.cv.width, Math.ceil(x + w));
    const y0 = Math.max(0, Math.floor(y)), y1 = Math.min(this.cv.height, Math.ceil(y + h));
    for (let yy = y0; yy < y1; yy++) for (let xx = x0; xx < x1; xx++) this.cv.clear(xx, yy);
  }
  clip() {}
  setLineDash() {}
  fillText() {}
  strokeText() {}
  measureText(t) { return { width: String(t).length * 6 }; }
  createLinearGradient(...a) { return makeGradient('l', a); }
  createRadialGradient(...a) { return makeGradient('r', a); }
  drawImage(img, dx = 0, dy = 0, dw, dh) {
    const s = this.globalCompositeOperation, al = this.globalAlpha;
    const m = this.cv;
    dw = dw === undefined ? img.width : dw; dh = dh === undefined ? img.height : dh;
    const sx0 = img.width / (dw || 1), sy0 = img.height / (dh || 1);
    for (let y = Math.max(0, Math.floor(dy)); y < Math.min(m.height, Math.ceil(dy + dh)); y++) {
      for (let x = Math.max(0, Math.floor(dx)); x < Math.min(m.width, Math.ceil(dx + dw)); x++) {
        const ox = Math.floor((x - dx) * sx0), oy = Math.floor((y - dy) * sy0);
        const c = img.peek(ox, oy);
        if (c.a <= 0.001) { if (s === 'destination-out') m.clear(x, y); continue; }
        m.blend(x, y, c.rgb, c.a * al, s === 'destination-out' ? 'source-over' : s);
        if (s === 'destination-out') m.setA(x, y, m.at(x, y) * (1 - c.a * al));
      }
    }
  }
}

export class RasterCanvas {
  constructor(w, h) {
    this._w = w; this._h = h;
    this.buf = new Float32Array(w * h * 4);
    this._ctx = new Ctx2D(this);
  }
  get width() { return this._w; }
  set width(v) { if (v !== this._w) { this._w = v; this.buf = new Float32Array(v * this._h * 4); } }
  get height() { return this._h; }
  set height(v) { if (v !== this._h) { this._h = v; this.buf = new Float32Array(this._w * v * 4); } }
  getContext() { return this._ctx; }
  idx(x, y) { return (y * this.width + x) * 4; }
  peek(x, y) {
    const i = this.idx(x, y);
    return { rgb: [this.buf[i], this.buf[i + 1], this.buf[i + 2]], a: this.buf[i + 3] };
  }
  at(x, y) { return this.buf[this.idx(x, y) + 3]; }
  setA(x, y, a) { this.buf[this.idx(x, y) + 3] = a; }
  clear(x, y) { const i = this.idx(x, y); this.buf[i] = this.buf[i + 1] = this.buf[i + 2] = this.buf[i + 3] = 0; }
  blend(x, y, rgb, a, op) {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height || a <= 0.0005) return;
    const i = this.idx(x, y);
    const B = this.buf;
    if (op === 'destination-out') { B[i + 3] *= (1 - a); return; }
    const sa = Math.min(1, a);
    if (op === 'lighter') {
      B[i] = Math.min(1, B[i] + rgb[0] * sa); B[i + 1] = Math.min(1, B[i + 1] + rgb[1] * sa); B[i + 2] = Math.min(1, B[i + 2] + rgb[2] * sa);
      B[i + 3] = Math.min(1, B[i + 3] + sa);
      return;
    }
    if (op === 'multiply') {
      B[i] = B[i] * (1 - sa) + B[i] * rgb[0] * sa;
      B[i + 1] = B[i + 1] * (1 - sa) + B[i + 1] * rgb[1] * sa;
      B[i + 2] = B[i + 2] * (1 - sa) + B[i + 2] * rgb[2] * sa;
      B[i + 3] = Math.min(1, B[i + 3] + sa * (1 - B[i + 3]));
      return;
    }
    const inv = 1 - sa;
    B[i] = rgb[0] * sa + B[i] * inv; B[i + 1] = rgb[1] * sa + B[i + 1] * inv; B[i + 2] = rgb[2] * sa + B[i + 2] * inv;
    B[i + 3] = Math.min(1, sa + B[i + 3] * inv);
  }
  disc(cx, cy, r, grad, col, alpha, op, gcol) {
    const x0 = Math.max(0, Math.floor(cx - r)), x1 = Math.min(this.width - 1, Math.ceil(cx + r));
    const y0 = Math.max(0, Math.floor(cy - r)), y1 = Math.min(this.height - 1, Math.ceil(cy + r));
    const r2 = r * r;
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const dx = x + 0.5 - cx, dy = y + 0.5 - cy;
        if (dx * dx + dy * dy <= r2) {
          if (grad) this.blend(x, y, gcol, alpha, op);
          else this.blend(x, y, col.rgb, col.a * alpha, op);
        }
      }
    }
  }
  toBuffer() {
    const { width: w, height: h, buf } = this;
    const raw = Buffer.alloc((w * 4 + 1) * h);
    for (let y = 0; y < h; y++) {
      raw[y * (w * 4 + 1)] = 0;
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4, j = y * (w * 4 + 1) + 1 + x * 4;
        const a = Math.max(0, Math.min(1, buf[i + 3]));
        // straight alpha PNG
        raw[j] = Math.round(Math.max(0, Math.min(1, buf[i])) * 255);
        raw[j + 1] = Math.round(Math.max(0, Math.min(1, buf[i + 1])) * 255);
        raw[j + 2] = Math.round(Math.max(0, Math.min(1, buf[i + 2])) * 255);
        raw[j + 3] = Math.round(a * 255);
      }
    }
    return raw;
  }
}

const CRC = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c; }
  return t;
})();
function crc32(b) { let c = 0xffffffff; for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

export function writePng(file, canvas) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(canvas.width, 0); ihdr.writeUInt32BE(canvas.height, 4);
  ihdr[8] = 8; ihdr[9] = 6; // 8-bit RGBA
  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(canvas.toBuffer(), { level: 6 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
  writeFileSync(file, png);
  return png.length;
}
