// A tiny software rasteriser implementing the CanvasRenderingContext2D slice the
// renderer uses, plus a PNG encoder built on node:zlib. This exists so the
// procedural art can actually be looked at in a sandbox with no browser.

import { deflateSync } from 'node:zlib';

export function parseColor(c, alpha) {
  if (c && typeof c === 'object' && c.stops) {
    const first = c.stops[0];
    return parseColor(first ? first.color : '#fff', alpha);
  }
  const s = String(c).trim();
  let m = s.match(/^rgba?\(([^)]+)\)$/i);
  if (m) {
    const p = m[1].split(',').map((v) => parseFloat(v));
    return [p[0], p[1], p[2], (p.length > 3 ? p[3] : 1) * alpha];
  }
  if (s[0] === '#') {
    let h = s.slice(1);
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    const n = parseInt(h, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255, alpha];
  }
  const named = { white: [255, 255, 255], black: [0, 0, 0], transparent: [0, 0, 0] };
  const n = named[s.toLowerCase()];
  if (n) return [n[0], n[1], n[2], s.toLowerCase() === 'transparent' ? 0 : alpha];
  return [255, 0, 255, alpha];
}

// ------------------------------------------------------------------- PNG encode

const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

export function encodePNG(width, height, rgba) {
  const stride = width * 4 + 1;
  const raw = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y++) {
    raw[y * stride] = 0; // filter: none
    rgba.copy(raw, y * stride + 1, y * width * 4, (y + 1) * width * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 6 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ------------------------------------------------------------ rasterising ctx

export class RasterCtx {
  constructor(width, height) {
    this.width = width;
    this.height = height;
    this.pixels = Buffer.alloc(width * height * 4);
    this.pixels.fill(0);
    this.m = [1, 0, 0, 1, 0, 0];
    this.stack = [];
    this.subs = [];
    this.cur = null;
    this.fillStyle = '#000';
    this.strokeStyle = '#000';
    this.lineWidth = 1;
    this.globalAlpha = 1;
    this.lineCap = 'butt';
    this.lineJoin = 'miter';
    this.font = '10px sans-serif';
    this.textAlign = 'start';
    this.textBaseline = 'alphabetic';
    this.dash = [];
  }

  // --- transform helpers (same semantics as canvas)
  _mul(n) {
    const [a, b, c, d, e, f] = this.m;
    const [a2, b2, c2, d2, e2, f2] = n;
    this.m = [
      a * a2 + c * b2,
      b * a2 + d * b2,
      a * c2 + c * d2,
      b * c2 + d * d2,
      a * e2 + c * f2 + e,
      b * e2 + d * f2 + f,
    ];
  }
  save() {
    this.stack.push({
      m: [...this.m],
      fillStyle: this.fillStyle,
      strokeStyle: this.strokeStyle,
      lineWidth: this.lineWidth,
      globalAlpha: this.globalAlpha,
      lineCap: this.lineCap,
      lineJoin: this.lineJoin,
      font: this.font,
      textAlign: this.textAlign,
    });
  }
  restore() {
    const s = this.stack.pop();
    if (s) Object.assign(this, s);
  }
  translate(x, y) {
    this._mul([1, 0, 0, 1, x, y]);
  }
  scale(x, y) {
    this._mul([x, 0, 0, y === undefined ? x : y, 0, 0]);
  }
  rotate(r) {
    this._mul([Math.cos(r), Math.sin(r), -Math.sin(r), Math.cos(r), 0, 0]);
  }
  setTransform(a, b, c, d, e, f) {
    this.m = [a, b, c, d, e, f];
  }
  resetTransform() {
    this.m = [1, 0, 0, 1, 0, 0];
  }
  _pt(x, y) {
    const [a, b, c, d, e, f] = this.m;
    return [a * x + c * y + e, b * x + d * y + f];
  }
  get _scale() {
    const [a, b, c, d] = this.m;
    return Math.sqrt(Math.abs(a * d - b * c)) || 1;
  }

  // --- path building (flattened to polylines in device space)
  beginPath() {
    this.subs = [];
    this.cur = null;
  }
  moveTo(x, y) {
    this.cur = { pts: [], closed: false };
    this.subs.push(this.cur);
    this.cur.pts.push(this._pt(x, y));
  }
  lineTo(x, y) {
    if (!this.cur) return this.moveTo(x, y);
    this.cur.pts.push(this._pt(x, y));
  }
  quadraticCurveTo(cx, cy, x, y) {
    if (!this.cur) this.moveTo(cx, cy);
    const p0 = this.cur.pts[this.cur.pts.length - 1];
    const [qc1, qc2] = this._pt(cx, cy);
    const [px, py] = this._pt(x, y);
    const steps = 10;
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const mt = 1 - t;
      this.cur.pts.push([
        mt * mt * p0[0] + 2 * mt * t * qc1 + t * t * px,
        mt * mt * p0[1] + 2 * mt * t * qc2 + t * t * py,
      ]);
    }
  }
  bezierCurveTo(a1, b1, a2, b2, x, y) {
    if (!this.cur) this.moveTo(a1, b1);
    const p0 = this.cur.pts[this.cur.pts.length - 1];
    const [c1x, c1y] = this._pt(a1, b1);
    const [c2x, c2y] = this._pt(a2, b2);
    const [px, py] = this._pt(x, y);
    const steps = 12;
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const mt = 1 - t;
      this.cur.pts.push([
        mt ** 3 * p0[0] + 3 * mt * mt * t * c1x + 3 * mt * t * t * c2x + t ** 3 * px,
        mt ** 3 * p0[1] + 3 * mt * mt * t * c1y + 3 * mt * t * t * c2y + t ** 3 * py,
      ]);
    }
  }
  closePath() {
    if (this.cur) this.cur.closed = true;
  }
  rect(x, y, w, h) {
    this.moveTo(x, y);
    this.lineTo(x + w, y);
    this.lineTo(x + w, y + h);
    this.lineTo(x, y + h);
    this.closePath();
  }
  arc(cx, cy, r, a0, a1, ccw) {
    this._ellipse(cx, cy, r, r, 0, a0, a1, ccw);
  }
  ellipse(cx, cy, rx, ry, rot, a0, a1, ccw) {
    this._ellipse(cx, cy, rx, ry, rot || 0, a0, a1, ccw);
  }
  _ellipse(cx, cy, rx, ry, rot, a0, a1, ccw) {
    let span = a1 - a0;
    const full = Math.abs(span) >= Math.PI * 2 - 1e-6;
    if (full) {
      a0 = 0;
      a1 = Math.PI * 2;
      span = a1;
    } else if (ccw && span > 0) span -= Math.PI * 2;
    else if (!ccw && span < 0) span += Math.PI * 2;
    const steps = Math.max(10, Math.ceil((Math.abs(span) / (Math.PI * 2)) * 40));
    for (let i = 0; i <= steps; i++) {
      const a = a0 + (span * i) / steps;
      const ex = Math.cos(a) * rx;
      const ey = Math.sin(a) * ry;
      const x = cx + ex * Math.cos(rot) - ey * Math.sin(rot);
      const y = cy + ex * Math.sin(rot) + ey * Math.cos(rot);
      if (i === 0) this.moveTo(x, y);
      else this.lineTo(x, y);
    }
    if (full && this.cur) this.cur.closed = true;
  }

  // --- pixel work
  _blend(x, y, col) {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return;
    const a = col[3];
    if (a <= 0) return;
    const i = (y * this.width + x) * 4;
    const p = this.pixels;
    if (a >= 0.999) {
      p[i] = col[0];
      p[i + 1] = col[1];
      p[i + 2] = col[2];
      p[i + 3] = 255;
      return;
    }
    const ia = 1 - a;
    p[i] = col[0] * a + p[i] * ia;
    p[i + 1] = col[1] * a + p[i + 1] * ia;
    p[i + 2] = col[2] * a + p[i + 2] * ia;
    p[i + 3] = Math.max(p[i + 3], a * 255);
  }

  /** Non-zero winding scanline fill over every subpath. */
  fill() {
    const col = parseColor(this.fillStyle, this.globalAlpha);
    if (col[3] <= 0.004) return;

    const edges = [];
    let minY = Infinity;
    let maxY = -Infinity;
    for (const s of this.subs) {
      const pts = s.pts;
      if (pts.length < 2) continue;
      const n = pts.length;
      const last = s.closed ? n : n - 1;
      for (let i = 0; i < last; i++) {
        const [x0, y0] = pts[i];
        const [x1, y1] = pts[(i + 1) % n];
        if (y0 === y1) continue;
        edges.push(y0 < y1 ? [y0, y1, x0, x1, 1] : [y1, y0, x1, x0, -1]);
        if (y0 < minY) minY = y0;
        if (y1 < minY) minY = y1;
        if (y0 > maxY) maxY = y0;
        if (y1 > maxY) maxY = y1;
      }
    }
    if (!edges.length) return;

    const y0 = Math.max(0, Math.floor(minY));
    const y1 = Math.min(this.height - 1, Math.ceil(maxY));
    for (let y = y0; y <= y1; y++) {
      const sy = y + 0.5;
      const xs = [];
      for (const e of edges) {
        if (sy < e[0] || sy >= e[1]) continue;
        const t = (sy - e[0]) / (e[1] - e[0]);
        xs.push([e[2] + (e[3] - e[2]) * t, e[4]]);
      }
      if (!xs.length) continue;
      xs.sort((a, b) => a[0] - b[0]);
      let winding = 0;
      for (let i = 0; i < xs.length; i++) {
        const prev = winding;
        winding += xs[i][1];
        if (prev === 0 && winding !== 0) {
          const start = xs[i][0];
          const end = i + 1 < xs.length ? xs[i + 1][0] : start;
          const xa = Math.max(0, Math.ceil(start - 0.5));
          const xb = Math.min(this.width - 1, Math.floor(end - 0.5));
          for (let x = xa; x <= xb; x++) this._blend(x, y, col);
        } else if (prev !== 0 && winding === 0) {
          /* span closed at this crossing */
        }
      }
    }
  }

  /** Stroke by stamping a disc along each segment. */
  stroke() {
    const col = parseColor(this.strokeStyle, this.globalAlpha);
    if (col[3] <= 0.004) return;
    const w = Math.max(0.4, this.lineWidth * this._scale);
    const r = w / 2;
    for (const s of this.subs) {
      const pts = s.pts;
      const n = pts.length;
      const count = s.closed ? n : n - 1;
      for (let i = 0; i < count; i++) {
        const [x0, y0] = pts[i];
        const [x1, y1] = pts[(i + 1) % n];
        const len = Math.hypot(x1 - x0, y1 - y0);
        const steps = Math.max(1, Math.ceil(len / Math.max(0.5, r * 0.5)));
        for (let k = 0; k <= steps; k++) {
          const t = k / steps;
          this._disc(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, r, col);
        }
      }
    }
  }

  _disc(cx, cy, r, col) {
    const x0 = Math.max(0, Math.floor(cx - r));
    const x1 = Math.min(this.width - 1, Math.ceil(cx + r));
    const y0 = Math.max(0, Math.floor(cy - r));
    const y1 = Math.min(this.height - 1, Math.ceil(cy + r));
    const r2 = r * r;
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const dx = x + 0.5 - cx;
        const dy = y + 0.5 - cy;
        if (dx * dx + dy * dy <= r2) this._blend(x, y, col);
      }
    }
  }

  clip() {}

  /** Blit another raster canvas through the current (scale+translate) matrix. */
  drawImage(img, ...args) {
    const src = img && img._ctx ? img._ctx : null;
    if (!src) return;
    let sx, sy, sw, sh, dx, dy, dw, dh;
    if (args.length === 8) [sx, sy, sw, sh, dx, dy, dw, dh] = args;
    else if (args.length === 2) {
      [dx, dy] = args;
      sx = 0;
      sy = 0;
      sw = img.width;
      sh = img.height;
      dw = sw;
      dh = sh;
    } else return;

    const [a, , , d, e, f] = this.m; // assume no rotation/shear for blits
    const x0 = Math.max(0, Math.floor(a * dx + e));
    const x1 = Math.min(this.width - 1, Math.ceil(a * (dx + dw) + e));
    const y0 = Math.max(0, Math.floor(d * dy + f));
    const y1 = Math.min(this.height - 1, Math.ceil(d * (dy + dh) + f));
    const sp = src.pixels;
    const dp = this.pixels;
    for (let py = y0; py <= y1; py++) {
      const wy = (py - f) / d - dy;
      const sv = Math.floor(sy + (wy / dh) * sh);
      if (sv < 0 || sv >= src.height) continue;
      for (let px = x0; px <= x1; px++) {
        const wx = (px - e) / a - dx;
        const su = Math.floor(sx + (wx / dw) * sw);
        if (su < 0 || su >= src.width) continue;
        const si = (sv * src.width + su) * 4;
        const sa = sp[si + 3] / 255;
        if (sa <= 0) continue;
        const di = (py * this.width + px) * 4;
        dp[di] = sp[si] * sa + dp[di] * (1 - sa);
        dp[di + 1] = sp[si + 1] * sa + dp[di + 1] * (1 - sa);
        dp[di + 2] = sp[si + 2] * sa + dp[di + 2] * (1 - sa);
        dp[di + 3] = Math.max(dp[di + 3], sp[si + 3]);
      }
    }
  }

  fillRect(x, y, w, h) {
    this.beginPath();
    this.rect(x, y, w, h);
    this.fill();
  }
  strokeRect(x, y, w, h) {
    this.beginPath();
    this.rect(x, y, w, h);
    this.stroke();
  }
  clearRect(x, y, w, h) {
    const xa = Math.max(0, Math.floor(x));
    const ya = Math.max(0, Math.floor(y));
    const xb = Math.min(this.width, Math.ceil(x + w));
    const yb = Math.min(this.height, Math.ceil(y + h));
    for (let yy = ya; yy < yb; yy++) {
      for (let xx = xa; xx < xb; xx++) {
        const i = (yy * this.width + xx) * 4;
        this.pixels[i] = this.pixels[i + 1] = this.pixels[i + 2] = this.pixels[i + 3] = 0;
      }
    }
  }
  setLineDash(d) {
    this.dash = d || [];
  }
  getLineDash() {
    return this.dash;
  }
  createRadialGradient() {
    const g = {
      stops: [],
      addColorStop(o, c) {
        g.stops.push({ o, color: c });
      },
    };
    return g;
  }
  createLinearGradient() {
    return this.createRadialGradient();
  }
  createPattern() {
    return null;
  }
  measureText(t) {
    return { width: String(t).length * 6 };
  }
  // text is not rasterised; a small tick marks where it would sit
  fillText(t, x, y) {
    const [px, py] = this._pt(x, y);
    const col = parseColor(this.fillStyle, this.globalAlpha);
    const w = String(t).length * 5;
    this._disc(px, py - 2, 1.6, col);
    void w;
  }
  strokeText() {}

  png() {
    return encodePNG(this.width, this.height, this.pixels);
  }
}

export function rasterCanvas(w, h) {
  const ctx = new RasterCtx(w, h);
  return {
    width: w,
    height: h,
    getContext: () => ctx,
    _ctx: ctx,
    png: () => ctx.png(),
  };
}
