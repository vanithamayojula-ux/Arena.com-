// The beat-runner: plays a list of dialogue beats in the book-box at the bottom of
// the screen. Choices can apply state, set flags, or hop to another beat — which is
// how every "branch" in Emberfall actually works: small hops, big consequences.

import { ui, resolveTx } from './ui.js';
import * as audio from './audio.js';

function waitTyping() {
  return new Promise((res) => {
    if (!ui.typing) return res();
    ui.typingDone = res;
  });
}

export async function runBeats(beats, ctx) {
  // ctx: { state, apply(set), onAct(beat), start, backdrop }
  let i = ctx.start || 0;
  ui.showInDialogue();
  while (i < beats.length) {
    const raw = beats[i];
    if (!raw) { i++; continue; }
    const b = typeof raw === 'string' ? { tx: raw } : raw;
    i++;
    if (b.when && !b.when(ctx.state)) continue;
    if (b.act && ctx.onAct) await ctx.onAct(b, ctx);
    const text = resolveTx(b.tx, ctx.state, ctx);
    if (b.sp !== undefined || b.set || b.fx) ui.say(b.sp || '', text, b.tone);
    else ui.say(b.sp || '', text, b.tone);
    if (b.set && ctx.apply) ctx.apply(b.set);
    if (b.fx && ctx.fx) await ctx.fx(b.fx);
    if (b.choices && b.choices.length) {
      const opts = b.choices.map((c) => ({
        label: c.label,
        cost: c.cost ? (typeof c.cost === 'function' ? c.cost(ctx.state) : c.cost) : null,
        req: c.req === undefined ? true : (typeof c.req === 'function' ? !!c.req(ctx.state) : !!c.req),
        reqNote: c.reqNote,
      }));
      const pick = await new Promise((res) => {
        ui.offerChoices(opts, (idx) => { audio.choice(); res(idx); });
      });
      const c = b.choices[pick];
      if (c) {
        if (c.set && ctx.apply) ctx.apply(c.set);
        if (c.do) await c.do(ctx.state, ctx);
        if (c.say) {
          ui.say(c.say.sp || '', resolveTx(c.say.tx, ctx.state, ctx), c.say.tone);
          await waitTyping();
        }
        if (typeof c.goto === 'number') i = c.goto;
        else if (typeof c.goto === 'function') i = c.goto(ctx.state, ctx);
      }
    } else if (b.auto === false) {
      await waitTyping();
    } else {
      await waitTyping();
      if (!ui.fast) await new Promise((r) => setTimeout(r, Math.min(900, 180 + text.length * 7)));
    }
    if (ctx.aborted && ctx.aborted()) break;
  }
}
