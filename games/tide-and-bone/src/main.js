/* TIDE & BONE — the shell. Wires engine ↔ painter ↔ DOM system-window, owns
   the run lifecycle (title → drift → end), input (keys, click, touch) and
   the pacing layer that makes a turn-based grid feel alive. */

import { createRun, act, moodOf, pathFrom, ensureOrgans, harvestReady, diveReady, extractReady, T } from './engine.js';
import { makeRenderer } from './render.js';
import { loadMeta, saveMeta, record, offer, CHARMS, charmById } from './meta.js';

const $ = id => document.getElementById(id);

export function boot() {
  const canvas = $('game');
  const wrap = $('stage');
  const app = {
    mode: 'title', // title | play | over
    paused: false,
    state: null,
    meta: loadMeta(typeof localStorage !== 'undefined' ? localStorage : null),
    rngSeed: 1,
    walkQueue: [],
    walkT: 0,
    lastFrame: 0,
    renderer: null,
    tsGeom: null,
  };
  window.__tb = app; // tests / debug console

  /* -------------------------------------------------------------- sizing */
  let dpr = Math.min(2, (typeof devicePixelRatio === 'number' && devicePixelRatio) || 1);
  function fit() {
    const cssW = Math.min(wrap.clientWidth || 560, 620);
    const cssH = cssW;
    canvas.style.width = cssW + 'px';
    canvas.style.height = cssH + 'px';
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
  }
  fit();
  window.addEventListener('resize', fit);

  /* --------------------------------------------------------------- HUD  */
  const hud = {
    mood: $('mood'), creatureBar: $('creatureFill'), creatureNum: $('creatureNum'),
    dive: $('diveCount'), diveBar: $('diveFill'),
    hpFill: $('hpFill'), hpNum: $('hpNum'),
    salvage: $('salvageNum'), flasks: $('flaskCount'), bombs: $('bombCount'),
    log: $('logfeed'), popups: $('popups'), body: document.body,
    zoneTag: $('zoneTag'), hint: $('ctxHint'),
  };

  function syncHUD() {
    const s = app.state; if (!s) return;
    const mood = moodOf(s);
    hud.mood.textContent = mood;
    hud.mood.className = 'mood-' + mood.toLowerCase();
    hud.body.className = hud.body.className.replace(/\bmode-\w+\b/g, '').trim() + ' mode-' + mood.toLowerCase();
    hud.creatureBar.style.width = s.creature.hp + '%';
    hud.creatureNum.textContent = s.creature.hp;
    hud.dive.textContent = Math.max(0, s.diveIn);
    hud.diveBar.style.width = Math.max(0, Math.min(1, s.diveIn / 15)) * 100 + '%';
    hud.dive.classList.toggle('critical', s.diveIn <= 5);
    const p = s.player;
    hud.hpFill.style.width = Math.max(0, (p.hp / p.maxHp) * 100) + '%';
    hud.hpNum.textContent = `${Math.max(0, p.hp)}/${p.maxHp}`;
    hud.salvage.textContent = p.salvage;
    hud.flasks.textContent = p.items.flask;
    hud.bombs.textContent = p.items.bomb;
    hud.zoneTag.textContent = s.zone === 'shell' ? 'OUTER SHELL' : `ORGAN // ${s.zone.toUpperCase()}`;
    let hint = '';
    if (extractReady(s)) hint = '[ E ] EXTRACT — leave with the haul';
    else if (diveReady(s)) hint = '[ E ] choose a vent — descend';
    else if (s.zone !== 'shell') hint = '[ E ] climb back to the shell';
    else if (harvestReady(s)) hint = '[ E ] harvest';
    hud.hint.textContent = hint;
  }

  function pushLog(text) {
    const li = document.createElement('div');
    li.className = 'logline';
    li.textContent = text;
    hud.log.prepend(li);
    while (hud.log.childElementCount > 6) hud.log.lastChild.remove();
  }
  let popupCount = 0;
  function pushPopup(text, cls) {
    if (popupCount > 3) return;
    popupCount++;
    const d = document.createElement('div');
    d.className = 'sys-pop ' + (cls || '');
    d.textContent = text;
    hud.popups.appendChild(d);
    setTimeout(() => { d.remove(); popupCount--; }, 1900);
  }

  /* ------------------------------------------------------------ actions */
  function commit(action) {
    const s = app.state;
    if (!s || s.over || app.paused || app.mode !== 'play') return;
    app.walkQueue = [];
    act(s, action);
    app.renderer.consumeEvents(s.events);
    for (const e of s.events) {
      if (e.t === 'log') pushLog(e.text);
      else if (e.t === 'popup') pushPopup(e.text, e.cls);
      else if (e.t === 'askzone') openZonePicker();
      else if (e.t === 'slide') { if (e.kind === 'dive' || e.kind === 'emerge' || e.kind === 'flush') $('veil').classList.add('on'); setTimeout(() => $('veil').classList.remove('on'), 320); }
    }
    syncHUD();
    if (s.over) endRun(s.over);
  }

  /* ------------------------------------------------------- zone picker  */
  function openZonePicker() {
    const el = $('zonePicker');
    if (el.classList.contains('on')) { closeZone(); return; }
    ensureOrgans(app.state);
    const danger = { heart: ['THE HEART', 'rich meat · warded hot', 'HIGH'], lung: ['THE LUNG', 'flask pools · spitter nests', 'MED'], gut: ['THE GUT', 'endless flesh · crowded', 'MED'] };
    el.innerHTML = '';
    const head = document.createElement('div'); head.className = 'zp-head'; head.textContent = 'CHOOSE A DESCENT — [1/2/3]';
    el.appendChild(head);
    ['heart', 'lung', 'gut'].forEach((z, i) => {
      const b = document.createElement('button');
      b.className = 'zp-btn zp-' + z;
      b.innerHTML = `<span class="zp-key">${i + 1}</span><span class="zp-name">${danger[z][0]}</span><span class="zp-desc">${danger[z][1]}</span><span class="zp-risk">THREAT ${danger[z][2]}</span>`;
      b.onclick = () => { app.state.player.pendingZone = z; closeZone(); commit({ t: 'interact' }); };
      el.appendChild(b);
    });
    const skip = document.createElement('button');
    skip.className = 'zp-btn zp-skip'; skip.textContent = 'not yet — [ESC]';
    skip.onclick = closeZone;
    el.appendChild(skip);
    el.classList.add('on');
  }
  const closeZone = () => $('zonePicker').classList.remove('on');

  /* ------------------------------------------------------------ overlays */
  function show(el) { el.classList.add('on'); }
  function hide(el) { el.classList.remove('on'); }

  /* --------------------------------------------------------- run flow   */
  function beginRun() {
    app.rngSeed = (Date.now() ^ (Math.random() * 0xffffffff)) >>> 0;
    startRun(app.rngSeed);
  }
  function startRun(seed) {
    app.state = createRun({ seed, charms: app.meta.owned });
    app.renderer = makeRenderer(canvas, app.state);
    app.mode = 'play';
    app.paused = false;
    hide($('titleScreen')); hide($('overScreen')); hide($('howto'));
    $('hud').classList.add('on');
    hud.log.innerHTML = '';
    pushLog(`Drift #${(seed >>> 0).toString(16).slice(0, 6).toUpperCase()} — the Vastmother grazes a dead sky. Harvest. Extract. Be polite about it.`);
    syncHUD();
  }
  function endRun(over) {
    app.mode = 'over';
    const type = over.type;
    const title = type === 'extracted' ? 'EXTRACTED' : type === 'died' ? 'YOU DIED' : 'LOST TO THE DEEP';
    const blurb = type === 'extracted'
      ? `The upwelling takes you clear at the last breath of the tide. ${over.haul} salvage, banked in bone and stubbornness.`
      : type === 'died'
        ? 'The shell closes over you like a lid. Somewhere, a mite inherits your coat.'
        : 'The creature dove. You came with, technically. The dimension keeps you now.';
    $('overTitle').textContent = title;
    $('overTitle').className = 'over-title o-' + type;
    $('overBlurb').textContent = blurb;
    const st = over.stats;
    $('overStats').innerHTML = `
      <div><b>${st.turns}</b><span>TURNS SURVIVED</span></div>
      <div><b>${st.harvests}</b><span>HARVESTS</span></div>
      <div><b>${st.kills}</b><span>KILLS</span></div>
      <div><b>${st.dives}</b><span>DIMENSION SHIFTS</span></div>
      <div><b>${type === 'extracted' ? over.haul : 0}</b><span>SALVAGE BANKED</span></div>
      <div><b>${st.deepest.toUpperCase()}</b><span>DEEPEST ORGAN</span></div>`;
    // charm offer
    const picks = offer(app.meta, app.rngSeed ^ (st.turns * 2654435761));
    const shelf = $('charmOffer');
    shelf.innerHTML = '';
    const head = document.createElement('div'); head.className = 'charm-head';
    head.textContent = type === 'extracted' ? 'CARVE A KEEPSAKE — pick one to keep forever' : 'ONE MERCY — carve a single charm before the next drift';
    shelf.appendChild(head);
    if (!picks.length) {
      const done = document.createElement('div'); done.className = 'charm-none'; done.textContent = 'Every charm is already yours. The Vastmother respects the collection.';
      shelf.appendChild(done);
    }
    for (const c of picks) {
      const b = document.createElement('button');
      b.className = 'charm-btn';
      b.innerHTML = `<span class="charm-ico">${c.icon}</span><span class="charm-name">${c.name}</span><span class="charm-desc">${c.desc}</span>`;
      b.onclick = () => {
        app.meta = record(app.meta, { type, haul: type === 'extracted' ? over.haul : 0 }, c.id, typeof localStorage !== 'undefined' ? localStorage : null);
        shelf.innerHTML = '';
        const ok = document.createElement('div'); ok.className = 'charm-taken';
        ok.textContent = `${c.name} etched into your drift-coat. ${CHARMS.length - app.meta.owned.length ? (CHARMS.length - app.meta.owned.length) + ' charms still unclaimed.' : 'Full set. Absurd.'}`;
        shelf.appendChild(ok);
        $('overGo').disabled = false;
        renderTitleShelf();
      };
      shelf.appendChild(b);
    }
    if (!picks.length) $('overGo').disabled = false;
    else $('overGo').disabled = true;
    $('overGo').textContent = 'RETURN TO THE SURFACE';
    $('overGo').onclick = () => { hide($('overScreen')); app.mode = 'title'; $('titleScreen').classList.add('on'); $('hud').classList.remove('on'); };
    const again = $('overAgain');
    if (again) again.onclick = () => { hide($('overScreen')); beginRun(); };
    show($('overScreen'));
  }

  function renderTitleShelf() {
    const el = $('charmShelf'); if (!el) return;
    if (!app.meta.owned.length) { el.innerHTML = '<span class="shelf-none">no charms yet — they are carved at the end of runs</span>'; return; }
    el.innerHTML = app.meta.owned.map(id => { const c = charmById(id); return c ? `<span class="shelf-charm" title="${c.desc}">${c.icon} ${c.name}</span>` : ''; }).join('');
  }

  /* -------------------------------------------------------------- input */
  const MOVE = { KeyW: [0, -1], ArrowUp: [0, -1], KeyS: [0, 1], ArrowDown: [0, 1], KeyA: [-1, 0], ArrowLeft: [-1, 0], KeyD: [1, 0], ArrowRight: [1, 0] };
  window.addEventListener('keydown', (e) => {
    if (e.repeat && !MOVE[e.code]) return;
    if (e.code === 'Escape') {
      if ($('zonePicker').classList.contains('on')) { closeZone(); e.preventDefault(); return; }
      if ($('howto').classList.contains('on')) { hide($('howto')); e.preventDefault(); return; }
      if (app.mode === 'play') { app.paused = !app.paused; $('pauseOverlay').classList.toggle('on', app.paused); e.preventDefault(); }
      return;
    }
    if (app.mode !== 'play' || app.paused) return;
    const zp = $('zonePicker');
    if (zp.classList.contains('on') && ['Digit1', 'Digit2', 'Digit3'].includes(e.code)) {
      const z = ['heart', 'lung', 'gut'][+e.code.slice(5) - 1];
      app.state.player.pendingZone = z; closeZone(); commit({ t: 'interact' });
      e.preventDefault(); return;
    }
    if (MOVE[e.code]) { const [dx, dy] = MOVE[e.code]; app.walkQueue = []; commit({ t: 'move', dx, dy }); e.preventDefault(); return; }
    switch (e.code) {
      case 'Space': case 'Enter': case 'KeyJ': commit({ t: 'attack' }); break;
      case 'KeyK': case 'ShiftLeft': case 'ShiftRight': commit({ t: 'brace' }); break;
      case 'KeyE': commit({ t: 'interact' }); break;
      case 'KeyR': commit({ t: 'feed' }); break;
      case 'Digit1': commit({ t: 'use', item: 'flask' }); break;
      case 'Digit2': commit({ t: 'use', item: 'bomb' }); break;
      case 'KeyG': case 'Period': commit({ t: 'wait' }); break;
      default: return;
    }
    e.preventDefault();
  });

  /* click / tap: adjacent = interact-with that tile or step; far = auto-walk */
  function canvasPos(ev) {
    const r = canvas.getBoundingClientRect();
    const geom = app.tsGeom;
    if (!geom || !app.state) return null;
    const sx = (ev.clientX - r.left) * (canvas.width / r.width) / dpr;
    const sy = (ev.clientY - r.top) * (canvas.height / r.height) / dpr;
    const tx = Math.floor((sx - geom.ox) / geom.ts), ty = Math.floor((sy - geom.oy) / geom.ts);
    const m = app.state.map;
    if (tx < 0 || ty < 0 || tx >= m.w || ty >= m.h) return null;
    return { tx, ty };
  }
  canvas.addEventListener('click', (ev) => {
    if (app.mode !== 'play' || app.paused) return;
    const hit = canvasPos(ev);
    if (!hit) return;
    const p = app.state.player;
    const dx = hit.tx - p.x, dy = hit.ty - p.y;
    const ad = Math.abs(dx) + Math.abs(dy);
    if (ad === 0) { commit({ t: 'interact' }); return; }
    if (ad === 1) {
      const t = app.state.map.tiles[hit.ty * app.state.map.w + hit.tx];
      if (t === T.FLESH || t === T.ORE || t === T.POOL) { commit({ t: 'harvest', x: hit.tx, y: hit.ty }); return; }
      commit({ t: 'move', dx: Math.sign(dx), dy: Math.sign(dy) }); return;
    }
    const path = pathFrom(app.state.map, p.x, p.y, hit.tx, hit.ty);
    if (!path || !path.length) return;
    app.walkQueue = path.slice(); app.walkT = 0;
  });

  /* touch controls */
  document.querySelectorAll('[data-act]').forEach(btn => {
    const a = btn.dataset.act;
    const fire = (e) => {
      e.preventDefault();
      if (a === 'up') commit({ t: 'move', dx: 0, dy: -1 });
      else if (a === 'down') commit({ t: 'move', dx: 0, dy: 1 });
      else if (a === 'left') commit({ t: 'move', dx: -1, dy: 0 });
      else if (a === 'right') commit({ t: 'move', dx: 1, dy: 0 });
      else if (a === 'flask') commit({ t: 'use', item: 'flask' });
      else if (a === 'bomb') commit({ t: 'use', item: 'bomb' });
      else commit({ t: a });
    };
    btn.addEventListener('pointerdown', fire);
  });

  /* buttons */
  $('btnBegin').onclick = () => beginRun();
  $('btnHowto').onclick = () => show($('howto'));
  $('howtoClose').onclick = () => hide($('howto'));
  $('pauseResume').onclick = () => { app.paused = false; $('pauseOverlay').classList.remove('on'); };
  $('pauseHelp').onclick = () => show($('howto'));
  $('pauseQuit').onclick = () => { app.paused = false; $('pauseOverlay').classList.remove('on'); app.mode = 'title'; hide($('hud')); show($('titleScreen')); };

  /* ------------------------------------------------------------- loop   */
  function frame(ts) {
    const dt = Math.min(0.05, (ts - (app.lastFrame || ts)) / 1000 || 0.016);
    app.lastFrame = ts;
    if (app.mode === 'play' || app.mode === 'over') {
      app.tsGeom = app.renderer.draw(app.state, app.paused ? 0 : dt);
      // auto-walk pacing: one committed turn per short beat, interrupt on threat
      if (app.mode === 'play' && !app.paused && app.walkQueue.length) {
        app.walkT -= dt;
        if (app.walkT <= 0) {
          const s = app.state;
          const threat = s.enemies.some(e => e.hp > 0 && Math.abs(e.x - s.player.x) + Math.abs(e.y - s.player.y) <= 2);
          if (threat) { app.walkQueue = []; pushPopup('YOU BREAK OFF — BLADES NEAR', 'warn'); }
          else {
            const step = app.walkQueue.shift();
            app.walkT = 0.12;
            commit({ t: 'move', dx: Math.sign(step.x - s.player.x), dy: Math.sign(step.y - s.player.y) });
          }
        }
      }
    } else {
      idleDraw(dt);
    }
    requestAnimationFrame(frame);
  }
  let idleT = 0;
  function idleDraw(dt) {
    idleT += dt;
    const g = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.fillStyle = '#0a0a12'; g.fillRect(0, 0, W, H);
    // a vast silhouette drifting under motes
    g.save();
    g.translate(W / 2, H * 0.62 + Math.sin(idleT * 0.6) * H * 0.01);
    g.scale(W / 560, W / 560);
    g.fillStyle = 'rgba(139,46,60,0.14)';
    g.beginPath(); g.ellipse(0, 0, 190, 86, -0.12, 0, 7); g.fill();
    g.fillStyle = 'rgba(20,24,36,0.9)';
    g.beginPath(); g.ellipse(-10, -8, 172, 70, -0.12, 0, 7); g.fill();
    g.strokeStyle = 'rgba(77,163,255,0.28)'; g.lineWidth = 1.6;
    g.beginPath(); g.ellipse(-10, -8, 172, 70, -0.12, 0.6, 2.6); g.stroke();
    for (let i = 0; i < 5; i++) {
      const a = idleT * 0.5 + i * 1.9;
      g.fillStyle = `rgba(232,182,76,${0.12 + 0.1 * Math.sin(a * 2)})`;
      g.beginPath(); g.arc(Math.cos(a) * 120, Math.sin(a) * 46 - 6, 3, 0, 7); g.fill();
    }
    g.restore();
    for (let i = 0; i < 30; i++) {
      const sx = ((i * 191 + idleT * (10 + (i % 6) * 6)) % W);
      const sy = ((i * 83 + idleT * 4) % H);
      g.fillStyle = i % 3 ? 'rgba(120,140,190,0.10)' : 'rgba(77,163,255,0.16)';
      g.fillRect(W - sx, sy, 2, 2);
    }
  }

  /* ------------------------------------------------------------- start  */
  renderTitleShelf();
  $('titleSeed').textContent = (Math.random().toString(16).slice(2, 8) || 'DRIFT0').toUpperCase();
  try { requestAnimationFrame(frame); } catch { /* headless: tests drive frames manually */ }
  return app;
}
