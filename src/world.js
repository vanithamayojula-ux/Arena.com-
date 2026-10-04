// The valley itself: procedural terrain, blocking scenery, and a pre-rendered
// ground layer so the per-frame draw stays cheap.

import { WORLD, COLORS } from './config.js';
import { makeRandom, makeNoise, clamp, dist2 } from './utils.js';

const TERRAIN_SCALE = 1; // world pixels per terrain-canvas pixel

export class World {
  constructor(seed = 20260604) {
    this.rand = makeRandom(seed);
    this.noise = makeNoise(seed);
    this.rockNoise = makeNoise(seed ^ 0x9e37);
    this.terrain = null;
    this.canopy = null;
    this.rocks = []; // solid, block movement
    this.water = []; // slows movement
    this.ferns = []; // decoration
    this.trees = []; // solid trunk + overhanging canopy drawn above entities
    this.grassTargets = []; // where prey like to graze
    this.gusts = []; // drifting grass sway offsets (purely visual)
    this.generate();
  }

  get width() {
    return WORLD.w;
  }
  get height() {
    return WORLD.h;
  }

  generate() {
    const { rand } = this;

    // --- Waterholes: irregular blobs, kept away from the exact centre so the
    //     player never spawns in a puddle.
    this.water = [];
    for (let i = 0; i < 5; i++) {
      let x, y;
      let tries = 0;
      do {
        x = rand.range(260, WORLD.w - 260);
        y = rand.range(260, WORLD.h - 260);
        tries++;
      } while (dist2(x, y, WORLD.w / 2, WORLD.h / 2) < 340 * 340 && tries < 40);
      this.water.push({
        x,
        y,
        rx: rand.range(95, 175),
        ry: rand.range(70, 130),
        rot: rand.range(0, Math.PI),
        wobble: rand.range(0, 100),
      });
    }

    // --- Boulders.
    this.rocks = [];
    for (let i = 0; i < 34; i++) {
      const x = rand.range(120, WORLD.w - 120);
      const y = rand.range(120, WORLD.h - 120);
      if (dist2(x, y, WORLD.w / 2, WORLD.h / 2) < 190 * 190) continue;
      this.rocks.push({
        x,
        y,
        r: rand.range(24, 58),
        rot: rand.range(0, Math.PI * 2),
        seed: rand.int(0, 9999),
      });
    }

    // --- Trees (trunk blocks, canopy overhangs above everything).
    //     Kept sparse + modest so the chase is never hidden under foliage.
    this.trees = [];
    for (let i = 0; i < 30; i++) {
      const x = rand.range(90, WORLD.w - 90);
      const y = rand.range(90, WORLD.h - 90);
      if (dist2(x, y, WORLD.w / 2, WORLD.h / 2) < 240 * 240) continue;
      this.trees.push({
        x,
        y,
        trunk: rand.range(8, 13),
        canopy: rand.range(36, 54),
        rot: rand.range(0, Math.PI * 2),
        seed: rand.int(0, 9999),
      });
    }

    // --- Fern clumps (cosmetic, prey can hide behind them).
    this.ferns = [];
    for (let i = 0; i < 170; i++) {
      this.ferns.push({
        x: rand.range(30, WORLD.w - 30),
        y: rand.range(30, WORLD.h - 30),
        r: rand.range(12, 26),
        rot: rand.range(0, Math.PI * 2),
        seed: rand.int(0, 9999),
      });
    }

    // --- Grazing spots: prefer dry, open ground.
    this.grassTargets = [];
    for (let i = 0; i < 90; i++) {
      const x = rand.range(140, WORLD.w - 140);
      const y = rand.range(140, WORLD.h - 140);
      if (this.solidAt(x, y, 30)) continue;
      if (this.inWater(x, y)) continue;
      this.grassTargets.push({ x, y });
    }
    if (this.grassTargets.length < 12) {
      // Safety net: always keep somewhere for the herd to graze.
      this.grassTargets.push({ x: WORLD.w * 0.5, y: WORLD.h * 0.42 });
      this.grassTargets.push({ x: WORLD.w * 0.25, y: WORLD.h * 0.6 });
      this.grassTargets.push({ x: WORLD.w * 0.75, y: WORLD.h * 0.62 });
    }
  }

  /** Nearest grazing target to a point. */
  nearestGrass(x, y) {
    let best = null;
    let bestD = Infinity;
    for (const g of this.grassTargets) {
      const d = dist2(x, y, g.x, g.y);
      if (d < bestD) {
        bestD = d;
        best = g;
      }
    }
    return best || { x: WORLD.w / 2, y: WORLD.h / 2 };
  }

  inWater(x, y) {
    for (const w of this.water) {
      const c = Math.cos(-w.rot);
      const s = Math.sin(-w.rot);
      const dx = x - w.x;
      const dy = y - w.y;
      const lx = dx * c - dy * s;
      const ly = dx * s + dy * c;
      if ((lx * lx) / (w.rx * w.rx) + (ly * ly) / (w.ry * w.ry) <= 1) return true;
    }
    return false;
  }

  solidAt(x, y, r) {
    for (const rock of this.rocks) {
      const rr = rock.r + r;
      if (dist2(x, y, rock.x, rock.y) < rr * rr) return true;
    }
    for (const t of this.trees) {
      const rr = t.trunk + r;
      if (dist2(x, y, t.x, t.y) < rr * rr) return true;
    }
    return false;
  }

  /** Push a circle out of solid scenery; returns true if it was resolved. */
  resolveSolids(e) {
    let hit = false;
    const pushOut = (cx, cy, cr) => {
      const dx = e.x - cx;
      const dy = e.y - cy;
      const rr = cr + e.radius;
      const d2 = dx * dx + dy * dy;
      if (d2 >= rr * rr || d2 === 0) return;
      const d = Math.sqrt(d2);
      const nx = dx / d;
      const ny = dy / d;
      e.x = cx + nx * rr;
      e.y = cy + ny * rr;
      // Cancel velocity into the surface, keep the tangential slide.
      const vn = e.vx * nx + e.vy * ny;
      if (vn < 0) {
        e.vx -= vn * nx;
        e.vy -= vn * ny;
      }
      hit = true;
    };
    for (const rock of this.rocks) pushOut(rock.x, rock.y, rock.r);
    for (const t of this.trees) pushOut(t.x, t.y, t.trunk);
    return hit;
  }

  /** Water and dense ferns sap speed. Returns a 0..1 multiplier. */
  terrainSpeed(x, y) {
    if (this.inWater(x, y)) return 0.48;
    return 1;
  }

  /** A random open spot, biased away from solid scenery. */
  randomOpenSpot(margin = 160) {
    for (let i = 0; i < 60; i++) {
      const x = this.rand.range(margin, WORLD.w - margin);
      const y = this.rand.range(margin, WORLD.h - margin);
      if (!this.solidAt(x, y, 30) && !this.inWater(x, y)) return { x, y };
    }
    return { x: WORLD.w / 2, y: WORLD.h / 2 };
  }

  clampToWalls(e) {
    const m = e.radius;
    e.x = clamp(e.x, m, WORLD.w - m);
    e.y = clamp(e.y, m, WORLD.h - m);
  }

  // ---------------------------------------------------------------- rendering

  buildLayers(canvasFactory) {
    const w = Math.round(WORLD.w * TERRAIN_SCALE);
    const h = Math.round(WORLD.h * TERRAIN_SCALE);

    this.terrain = canvasFactory(w, h);
    this.canopy = canvasFactory(w, h);
    this.paintGround(this.terrain.getContext('2d'), w, h);
    this.paintCanopy(this.canopy.getContext('2d'));
  }

  paintGround(g, w, h) {
    const noise = this.noise;
    g.fillStyle = COLORS.grassBase;
    g.fillRect(0, 0, w, h);

    // Blotchy grass built from noise cells — much cheaper than per-pixel.
    const cell = 26;
    for (let y = 0; y < h; y += cell) {
      for (let x = 0; x < w; x += cell) {
        const n = noise(x / 210, y / 210);
        const n2 = this.rockNoise(x / 60, y / 60);
        if (n > 0.56) g.fillStyle = COLORS.grassLight;
        else if (n < 0.42) g.fillStyle = COLORS.grassDark;
        else continue;
        g.globalAlpha = 0.32 + n2 * 0.3;
        g.beginPath();
        g.ellipse(x + cell / 2, y + cell / 2, cell * (0.7 + n2 * 0.6), cell * (0.6 + n * 0.5), n * 3, 0, Math.PI * 2);
        g.fill();
      }
    }
    g.globalAlpha = 1;

    // Dry dirt patches where the noise reads lowest.
    g.globalAlpha = 0.35;
    g.fillStyle = COLORS.dirt;
    for (let i = 0; i < 26; i++) {
      const x = this.rand.range(0, w);
      const y = this.rand.range(0, h);
      const r = this.rand.range(50, 150);
      g.beginPath();
      g.ellipse(x, y, r, r * this.rand.range(0.5, 0.85), this.rand.range(0, 3), 0, Math.PI * 2);
      g.fill();
    }
    g.globalAlpha = 1;

    // Grass tufts.
    for (let i = 0; i < 5200; i++) {
      const x = this.rand.range(0, w);
      const y = this.rand.range(0, h);
      const n = noise(x / 130, y / 130);
      const light = n > 0.5;
      g.strokeStyle = light ? 'rgba(126,160,74,0.42)' : 'rgba(35,54,30,0.4)';
      g.lineWidth = 1.4;
      const len = 4 + n * 7;
      const lean = (this.rockNoise(x / 40, y / 40) - 0.5) * 6;
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + lean, y - len);
      g.stroke();
    }

    // Waterholes.
    for (const wt of this.water) {
      g.save();
      g.translate(wt.x, wt.y);
      g.rotate(wt.rot);
      // muddy rim
      g.fillStyle = COLORS.dirt;
      g.globalAlpha = 0.85;
      g.beginPath();
      g.ellipse(0, 0, wt.rx + 16, wt.ry + 14, 0, 0, Math.PI * 2);
      g.fill();
      // water body
      const grad = g.createRadialGradient(0, 0, wt.ry * 0.2, 0, 0, Math.max(wt.rx, wt.ry));
      grad.addColorStop(0, COLORS.waterEdge);
      grad.addColorStop(1, COLORS.water);
      g.globalAlpha = 1;
      g.fillStyle = grad;
      g.beginPath();
      g.ellipse(0, 0, wt.rx, wt.ry, 0, 0, Math.PI * 2);
      g.fill();
      // surface sheen
      g.strokeStyle = 'rgba(190,230,230,0.22)';
      g.lineWidth = 2;
      for (let i = 0; i < 5; i++) {
        const t = i / 5;
        g.beginPath();
        g.ellipse(0, -wt.ry * 0.15 + i * 8, wt.rx * (0.75 - t * 0.14), wt.ry * 0.1, 0, 0, Math.PI * 2);
        g.stroke();
      }
      g.restore();
    }
    g.globalAlpha = 1;

    // Fern clumps sit on the ground layer.
    for (const f of this.ferns) {
      g.save();
      g.translate(f.x, f.y);
      g.rotate(f.rot);
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * Math.PI * 2;
        g.strokeStyle = i % 2 ? 'rgba(52,84,40,0.85)' : 'rgba(74,112,50,0.8)';
        g.lineWidth = 3;
        g.beginPath();
        g.moveTo(0, 0);
        g.quadraticCurveTo(Math.cos(a) * f.r * 0.6, Math.sin(a) * f.r * 0.6, Math.cos(a) * f.r, Math.sin(a) * f.r);
        g.stroke();
      }
      g.restore();
    }

    // Tree trunks live at ground level (canopies go on the overlay layer).
    for (const t of this.trees) {
      g.save();
      g.translate(t.x, t.y);
      g.fillStyle = 'rgba(0,0,0,0.28)';
      g.beginPath();
      g.ellipse(t.trunk * 0.5, t.trunk * 0.4, t.trunk * 1.5, t.trunk * 1.1, 0, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#5a4432';
      g.beginPath();
      g.arc(0, 0, t.trunk, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#3f3023';
      g.beginPath();
      g.arc(t.trunk * 0.25, t.trunk * 0.2, t.trunk * 0.6, 0, Math.PI * 2);
      g.fill();
      g.restore();
    }

    // Boulders (solid).
    for (const rock of this.rocks) {
      this.paintRock(g, rock);
    }
  }

  paintRock(g, rock) {
    const r = makeRandom(rock.seed);
    g.save();
    g.translate(rock.x, rock.y);
    // shadow
    g.fillStyle = 'rgba(0,0,0,0.3)';
    g.beginPath();
    g.ellipse(rock.r * 0.22, rock.r * 0.3, rock.r * 1.06, rock.r * 0.82, 0, 0, Math.PI * 2);
    g.fill();
    // body
    g.rotate(rock.rot);
    g.fillStyle = COLORS.rock;
    g.beginPath();
    const pts = 9;
    for (let i = 0; i <= pts; i++) {
      const a = (i / pts) * Math.PI * 2;
      const rr = rock.r * (0.78 + r.range(0, 0.3));
      const px = Math.cos(a) * rr;
      const py = Math.sin(a) * rr * 0.86;
      if (i === 0) g.moveTo(px, py);
      else g.lineTo(px, py);
    }
    g.closePath();
    g.fill();
    // facets
    g.fillStyle = COLORS.rockDark;
    g.globalAlpha = 0.4;
    g.beginPath();
    g.ellipse(rock.r * 0.18, rock.r * 0.22, rock.r * 0.55, rock.r * 0.4, 0.4, 0, Math.PI * 2);
    g.fill();
    g.globalAlpha = 0.28;
    g.fillStyle = '#9c9a8e';
    g.beginPath();
    g.ellipse(-rock.r * 0.28, -rock.r * 0.28, rock.r * 0.4, rock.r * 0.26, -0.5, 0, Math.PI * 2);
    g.fill();
    g.restore();
    g.globalAlpha = 1;
  }

  /** Tree trunks are painted on the ground; canopies go on the overlay layer. */
  paintCanopy(g) {
    // trunks on the ground layer happened in paintGround? -> no, draw both here.
    g.clearRect(0, 0, WORLD.w, WORLD.h);
    for (const t of this.trees) {
      const r = makeRandom(t.seed);
      // Canopy shadow
      g.save();
      g.translate(t.x + 14, t.y + 16);
      g.fillStyle = 'rgba(10,20,10,0.34)';
      g.beginPath();
      g.ellipse(0, 0, t.canopy * 1.02, t.canopy * 0.82, 0, 0, Math.PI * 2);
      g.fill();
      g.restore();

      // Canopy blobs
      g.save();
      g.translate(t.x, t.y);
      g.rotate(t.rot);
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        const rr = t.canopy * (0.42 + r.range(0, 0.22));
        const ox = Math.cos(a) * t.canopy * 0.45;
        const oy = Math.sin(a) * t.canopy * 0.38;
        g.fillStyle = i % 2 ? COLORS.tree : COLORS.treeLight;
        g.globalAlpha = 0.86; // translucent so animals stay readable beneath
        g.beginPath();
        g.ellipse(ox, oy, rr, rr * 0.86, r.range(0, 3), 0, Math.PI * 2);
        g.fill();
      }
      g.globalAlpha = 0.3;
      g.fillStyle = '#6f9a45';
      g.beginPath();
      g.ellipse(-t.canopy * 0.22, -t.canopy * 0.24, t.canopy * 0.4, t.canopy * 0.3, 0, 0, Math.PI * 2);
      g.fill();
      g.restore();
    }
    g.globalAlpha = 1;
  }
}
