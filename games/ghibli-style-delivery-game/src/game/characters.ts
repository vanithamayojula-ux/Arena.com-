export type Facing = "down" | "up" | "left" | "right";

export interface Look {
  skin: string;
  hair: string;
  hairStyle: 0 | 1 | 2 | 3 | 4; // 0 short, 1 bob, 2 long, 3 bun, 4 bald-ish
  shirt: string;
  pants: string;
  dress?: boolean;
  apron?: string;
  hat?: { color: string; type: "cap" | "straw" | "beret" | "bow" | "post" };
  glasses?: boolean;
  beard?: string;
  satchel?: boolean;
  scale?: number;
}

export const PLAYER_LOOK: Look = {
  skin: "#f6d3b3",
  hair: "#4a2f22",
  hairStyle: 0,
  shirt: "#3f7f9a",
  pants: "#3a3f55",
  hat: { color: "#2f5d50", type: "post" },
  satchel: true,
};

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/**
 * Draw a chibi character with feet at (x, y).
 */
export function drawCharacter(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  look: Look,
  facing: Facing,
  walk: number,
  moving: boolean,
  sx = 1,
  sy = 1,
  time = 0,
  letters = 0,
  shadow = true
) {
  const s = look.scale ?? 1;
  if (shadow) {
    ctx.fillStyle = "rgba(40,55,35,0.28)";
    ctx.beginPath();
    ctx.ellipse(x, y, 10 * s * sx, 4 * s, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s * sx, s * sy);
  const side = facing === "left" || facing === "right";
  if (facing === "left") ctx.scale(-1, 1);
  const up = facing === "up";

  const sw = Math.sin(walk);
  const bob = moving ? -Math.abs(Math.cos(walk)) * 2.2 : Math.sin(time * 2.2) * 0.6;

  // legs
  const legA = moving ? sw * 3 : 0;
  ctx.fillStyle = look.pants;
  if (side) {
    roundRect(ctx, -3 + legA, -11, 5, 10, 2);
    ctx.fill();
    roundRect(ctx, -3 - legA, -11, 5, 10, 2);
    ctx.fill();
    ctx.fillStyle = "#5a3b2a";
    roundRect(ctx, -3 + legA, -3, 7, 3.5, 1.5);
    ctx.fill();
    roundRect(ctx, -3 - legA, -3, 7, 3.5, 1.5);
    ctx.fill();
  } else {
    const l1 = moving ? Math.max(0, sw) * 2.5 : 0;
    const l2 = moving ? Math.max(0, -sw) * 2.5 : 0;
    roundRect(ctx, -6, -11 - l1, 5, 10, 2);
    ctx.fill();
    roundRect(ctx, 1, -11 - l2, 5, 10, 2);
    ctx.fill();
    ctx.fillStyle = "#5a3b2a";
    roundRect(ctx, -6.5, -3.5 - l1, 6, 3.5, 1.5);
    ctx.fill();
    roundRect(ctx, 0.5, -3.5 - l2, 6, 3.5, 1.5);
    ctx.fill();
  }

  ctx.translate(0, bob);

  // satchel behind when facing down
  const drawSatchel = () => {
    if (!look.satchel) return;
    ctx.fillStyle = "#8a5a35";
    const bx = side ? -9 : up ? -2 : 4;
    roundRect(ctx, bx, -17, 10, 8, 2.5);
    ctx.fill();
    ctx.fillStyle = "#6e4527";
    roundRect(ctx, bx, -17, 10, 3.5, 1.5);
    ctx.fill();
    for (let i = 0; i < Math.min(3, letters); i++) {
      ctx.fillStyle = i === 0 ? "#fffaf0" : "#f3e7cf";
      ctx.fillRect(bx + 1.5 + i * 2.3, -20 + (i % 2), 4, 4);
    }
  };
  if (side) drawSatchel();

  // arms
  const arm = moving ? sw * 3.2 : Math.sin(time * 2) * 0.4;
  ctx.fillStyle = look.shirt;
  if (side) {
    roundRect(ctx, -2 - arm, -21, 4.5, 10, 2.2);
    ctx.fill();
  } else {
    roundRect(ctx, -10, -21 + arm, 4.5, 9.5, 2.2);
    ctx.fill();
    roundRect(ctx, 5.5, -21 - arm, 4.5, 9.5, 2.2);
    ctx.fill();
    ctx.fillStyle = look.skin;
    ctx.beginPath();
    ctx.arc(-7.7, -11.5 + arm, 2.2, 0, Math.PI * 2);
    ctx.arc(7.7, -11.5 - arm, 2.2, 0, Math.PI * 2);
    ctx.fill();
  }

  // body
  ctx.fillStyle = look.shirt;
  if (look.dress) {
    ctx.beginPath();
    ctx.moveTo(-6, -23);
    ctx.lineTo(6, -23);
    ctx.lineTo(9, -8);
    ctx.quadraticCurveTo(0, -6, -9, -8);
    ctx.closePath();
    ctx.fill();
  } else {
    roundRect(ctx, -7, -23, 14, 13.5, 4);
    ctx.fill();
  }
  if (look.apron && !up) {
    ctx.fillStyle = look.apron;
    roundRect(ctx, side ? -1 : -5, -19, side ? 7 : 10, 11, 2);
    ctx.fill();
  }
  // collar shading
  ctx.fillStyle = "rgba(0,0,0,0.08)";
  ctx.fillRect(-7, -12, 14, 2.5);

  if (look.satchel && !side) {
    // strap
    ctx.strokeStyle = "#6e4527";
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    if (up) {
      ctx.moveTo(5, -23);
      ctx.lineTo(-4, -13);
    } else {
      ctx.moveTo(-5, -23);
      ctx.lineTo(6, -13);
    }
    ctx.stroke();
    drawSatchel();
  }
  if (side && look.satchel) {
    ctx.strokeStyle = "#6e4527";
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(2, -23);
    ctx.lineTo(-4, -15);
    ctx.stroke();
  }

  // head
  const hy = -31;
  ctx.fillStyle = look.skin;
  ctx.beginPath();
  ctx.arc(0, hy, 9.5, 0, Math.PI * 2);
  ctx.fill();

  // hair
  ctx.fillStyle = look.hair;
  const hs = look.hairStyle;
  if (hs !== 4) {
    if (up) {
      ctx.beginPath();
      ctx.arc(0, hy, 10, 0, Math.PI * 2);
      ctx.fill();
      if (hs === 2) {
        roundRect(ctx, -9, hy, 18, 13, 5);
        ctx.fill();
      }
      if (hs === 3) {
        ctx.beginPath();
        ctx.arc(0, hy - 9, 4.5, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (side) {
      ctx.beginPath();
      ctx.arc(-1, hy - 1, 10, Math.PI * 0.85, Math.PI * 2.08);
      ctx.lineTo(3, hy - 4);
      ctx.lineTo(-4, hy + 2);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.arc(-3, hy, 8, Math.PI * 0.5, Math.PI * 1.5);
      ctx.fill();
      if (hs === 1 || hs === 2) {
        roundRect(ctx, -10, hy - 3, 8, hs === 2 ? 17 : 11, 4);
        ctx.fill();
      }
      if (hs === 3) {
        ctx.beginPath();
        ctx.arc(-7, hy - 7, 4.5, 0, Math.PI * 2);
        ctx.fill();
      }
    } else {
      ctx.beginPath();
      ctx.arc(0, hy - 1, 10, Math.PI * 0.95, Math.PI * 2.05);
      ctx.quadraticCurveTo(5, hy - 6, 1, hy - 4);
      ctx.quadraticCurveTo(-4, hy - 7, -9.6, hy + 1);
      ctx.closePath();
      ctx.fill();
      if (hs === 1 || hs === 2) {
        roundRect(ctx, -10.5, hy - 4, 4.5, hs === 2 ? 18 : 11, 2.5);
        ctx.fill();
        roundRect(ctx, 6, hy - 4, 4.5, hs === 2 ? 18 : 11, 2.5);
        ctx.fill();
      }
      if (hs === 3) {
        ctx.beginPath();
        ctx.arc(0, hy - 10, 4.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  } else {
    ctx.beginPath();
    ctx.arc(side ? -6 : -8, hy + 1, 3.5, 0, Math.PI * 2);
    if (!side) ctx.arc(8, hy + 1, 3.5, 0, Math.PI * 2);
    ctx.fill();
  }

  // face
  if (!up) {
    const ex = side ? 4.5 : 3.4;
    ctx.fillStyle = "#2b2420";
    if (side) {
      ctx.beginPath();
      ctx.ellipse(ex, hy + 1, 1.3, 1.8, 0, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.ellipse(-ex, hy + 1, 1.3, 1.8, 0, 0, Math.PI * 2);
      ctx.ellipse(ex, hy + 1, 1.3, 1.8, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = "rgba(240,120,110,0.45)";
    ctx.beginPath();
    if (side) ctx.arc(3, hy + 4.2, 2, 0, Math.PI * 2);
    else {
      ctx.arc(-5.5, hy + 4, 2, 0, Math.PI * 2);
      ctx.arc(5.5, hy + 4, 2, 0, Math.PI * 2);
    }
    ctx.fill();
    if (look.glasses) {
      ctx.strokeStyle = "#3a2f28";
      ctx.lineWidth = 1;
      ctx.beginPath();
      if (side) ctx.arc(ex, hy + 1, 3, 0, Math.PI * 2);
      else {
        ctx.arc(-ex, hy + 1, 3, 0, Math.PI * 2);
        ctx.moveTo(ex + 3, hy + 1);
        ctx.arc(ex, hy + 1, 3, 0, Math.PI * 2);
      }
      ctx.stroke();
    }
    if (look.beard) {
      ctx.fillStyle = look.beard;
      ctx.beginPath();
      if (side) ctx.ellipse(3, hy + 6.5, 5, 4, 0, 0, Math.PI * 2);
      else ctx.ellipse(0, hy + 6.5, 6.5, 4.5, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // hat
  if (look.hat) {
    const h = look.hat;
    ctx.fillStyle = h.color;
    if (h.type === "cap" || h.type === "post") {
      ctx.beginPath();
      ctx.arc(0, hy - 3, 9.8, Math.PI, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(-9.8, hy - 4, 19.6, 2.5);
      // brim
      ctx.fillStyle = "#1f3f37";
      if (side) {
        roundRect(ctx, 4, hy - 4, 9, 3, 1.5);
        ctx.fill();
      } else if (!up) {
        ctx.beginPath();
        ctx.ellipse(0, hy - 2.5, 9, 3, 0, 0, Math.PI);
        ctx.fill();
      }
      if (h.type === "post" && !up) {
        ctx.fillStyle = "#f2c94c";
        ctx.beginPath();
        ctx.arc(side ? 3 : 0, hy - 8, 2, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (h.type === "straw") {
      ctx.beginPath();
      ctx.ellipse(0, hy - 5, 15, 5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(0, hy - 6, 8, Math.PI, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#c9573f";
      ctx.fillRect(-8, hy - 8, 16, 2.5);
    } else if (h.type === "beret") {
      ctx.beginPath();
      ctx.ellipse(side ? -1 : 0, hy - 8, 10.5, 4.5, side ? -0.2 : 0, 0, Math.PI * 2);
      ctx.fill();
    } else if (h.type === "bow") {
      ctx.beginPath();
      ctx.ellipse(-4, hy - 10, 4.5, 3, -0.4, 0, Math.PI * 2);
      ctx.ellipse(4, hy - 10, 4.5, 3, 0.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(0, hy - 10, 1.8, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  ctx.restore();
}
