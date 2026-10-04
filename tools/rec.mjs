// A recording 2D context: implements the slice of CanvasRenderingContext2D that
// the renderer uses and emits SVG, so the procedural art can be inspected
// without a browser (ImageMagick rasterises the result).

function normColor(c, alpha) {
  if (c && typeof c === 'object' && c.stops) {
    const first = c.stops[0];
    return normColor(first ? first.color : '#fff', alpha);
  }
  const s = String(c);
  let m = s.match(/^rgba?\(([^)]+)\)$/);
  if (m) {
    const parts = m[1].split(',').map((v) => parseFloat(v));
    const a = parts.length > 3 ? parts[3] : 1;
    const hex = (n) => Math.round(n).toString(16).padStart(2, '0');
    return { hex: `#${hex(parts[0])}${hex(parts[1])}${hex(parts[2])}`, alpha: a * alpha };
  }
  if (s.startsWith('#')) {
    if (s.length === 4) {
      return { hex: `#${s[1]}${s[1]}${s[2]}${s[2]}${s[3]}${s[3]}`, alpha };
    }
    return { hex: s, alpha };
  }
  const named = { white: '#ffffff', black: '#000000', transparent: '#000000' };
  return { hex: named[s] || '#ff00ff', alpha: s === 'transparent' ? 0 : alpha };
}

export class RecCtx {
  constructor(width, height) {
    this.width = width;
    this.height = height;
    this.out = [];
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

  // --- transform
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
  get _scale() {
    const [a, b, c, d] = this.m;
    return Math.sqrt(Math.abs(a * d - b * c)) || 1;
  }
  _pt(x, y) {
    const [a, b, c, d, e, f] = this.m;
    return [a * x + c * y + e, b * x + d * y + f];
  }

  // --- paths
  beginPath() {
    this.subs = [];
    this.cur = null;
  }
  moveTo(x, y) {
    this.cur = { closed: false, d: [] };
    this.subs.push(this.cur);
    const [px, py] = this._pt(x, y);
    this.cur.d.push(`M${px.toFixed(2)} ${py.toFixed(2)}`);
  }
  lineTo(x, y) {
    if (!this.cur) this.moveTo(x, y);
    else {
      const [px, py] = this._pt(x, y);
      this.cur.d.push(`L${px.toFixed(2)} ${py.toFixed(2)}`);
    }
  }
  quadraticCurveTo(cx, cy, x, y) {
    if (!this.cur) this.moveTo(cx, cy);
    const [c1, c2] = this._pt(cx, cy);
    const [px, py] = this._pt(x, y);
    this.cur.d.push(`Q${c1.toFixed(2)} ${c2.toFixed(2)} ${px.toFixed(2)} ${py.toFixed(2)}`);
  }
  bezierCurveTo(a1, b1, a2, b2, x, y) {
    const [p1, p2] = this._pt(a1, b1);
    const [p3, p4] = this._pt(a2, b2);
    const [px, py] = this._pt(x, y);
    this.cur.d.push(
      `C${p1.toFixed(2)} ${p2.toFixed(2)} ${p3.toFixed(2)} ${p4.toFixed(2)} ${px.toFixed(2)} ${py.toFixed(2)}`
    );
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
    this._ellipsePath(cx, cy, r, r, 0, a0, a1, ccw);
  }
  ellipse(cx, cy, rx, ry, rot, a0, a1, ccw) {
    this._ellipsePath(cx, cy, rx, ry, rot || 0, a0, a1, ccw);
  }
  _ellipsePath(cx, cy, rx, ry, rot, a0, a1, ccw) {
    let span = a1 - a0;
    const full = Math.abs(span) >= Math.PI * 2 - 1e-6;
    if (full) {
      a0 = 0;
      a1 = Math.PI * 2;
      span = a1;
    } else if (ccw && span > 0) {
      span -= Math.PI * 2;
    } else if (!ccw && span < 0) {
      span += Math.PI * 2;
    }
    const steps = Math.max(8, Math.ceil((Math.abs(span) / (Math.PI * 2)) * 28));
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

  _d() {
    return this.subs.map((s) => s.d.join(' ') + (s.closed ? ' Z' : '')).join(' ');
  }

  fill() {
    const d = this._d();
    if (!d.trim()) return;
    const { hex, alpha } = normColor(this.fillStyle, this.globalAlpha);
    if (alpha <= 0.003) return;
    this.out.push(`<path d="${d}" fill="${hex}" fill-opacity="${alpha.toFixed(3)}"/>`);
  }
  stroke() {
    const d = this._d();
    if (!d.trim()) return;
    const { hex, alpha } = normColor(this.strokeStyle, this.globalAlpha);
    if (alpha <= 0.003) return;
    const w = Math.max(0.15, this.lineWidth * this._scale);
    this.out.push(
      `<path d="${d}" fill="none" stroke="${hex}" stroke-opacity="${alpha.toFixed(3)}" stroke-width="${w.toFixed(2)}" stroke-linecap="${this.lineCap}" stroke-linejoin="${this.lineJoin}"${
        this.dash.length ? ` stroke-dasharray="${this.dash.join(' ')}"` : ''
      }/>`
    );
  }
  clip() {}

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
  clearRect() {}

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

  drawImage() {}
  measureText(t) {
    return { width: String(t).length * 6 };
  }
  fillText(t, x, y) {
    const [px, py] = this._pt(x, y);
    const size = parseFloat(String(this.font).match(/(\d+(?:\.\d+)?)px/)?.[1] || '12') * this._scale;
    const { hex, alpha } = normColor(this.fillStyle, this.globalAlpha);
    const anchor = this.textAlign === 'center' ? 'middle' : this.textAlign === 'right' ? 'end' : 'start';
    this.out.push(
      `<text x="${px.toFixed(1)}" y="${py.toFixed(1)}" font-size="${size.toFixed(1)}" font-family="sans-serif" font-weight="bold" text-anchor="${anchor}" fill="${hex}" fill-opacity="${alpha.toFixed(3)}">${String(
        t
      ).replace(/&/g, '&amp;').replace(/</g, '&lt;')}</text>`
    );
  }
  strokeText() {}

  svg(extra = '') {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${this.width}" height="${this.height}" viewBox="0 0 ${this.width} ${this.height}">${extra}${this.out.join(
      ''
    )}</svg>`;
  }
}

export function recCanvas(w, h) {
  const ctx = new RecCtx(w, h);
  const canvas = {
    width: w,
    height: h,
    getContext: () => ctx,
    _ctx: ctx,
    svg: (extra) => ctx.svg(extra),
  };
  return canvas;
}
