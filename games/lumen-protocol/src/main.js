/* LUMEN PROTOCOL — the shell. Runs the dialogue graph, drives the city
   canvas, paints the HUD (traits / skills / packs / whispers), owns screens
   and saves. DOM lives only in here. */

import * as STORY from './story.js';
import { createGame, can, apply, personaOf, carrying, SKILLS, PACKS, CALIBS, saveGame, loadGame, clearSave, enterScene, curNode, visibleState, advance, choiceAt, finishScene, nextChapter } from './game.js';

const $ = id => document.getElementById(id);
const TRAITS = ['empathy', 'lucidity', 'defiance', 'relic'];
const TRAIT_COL = { empathy: '#ff8ab5', lucidity: '#3fd8ff', defiance: '#ff2d78', relic: '#8f5bff' };

import { makeCity } from './city.js';

export function boot() {
  const canvas = $('city');
  const app = {
    g: null, screen: 'title', typing: false, typeT: 0, typeFull: '', lastTs: 0,
    toastQ: [], whisperIdx: 0, whisperT: 0, pendingCalib: null, errored: null, city: null,
  };
  window.__lp = app;
  try { app.city = makeCity(canvas); } catch (e) { app.errored = e; }
  const city = {
    frame(dt) { try { app.city && app.city.frame(dt); } catch (e) { app.errored = app.errored || e; } },
    setBg(k) { try { app.city && app.city.setBg(k); } catch {} },
    resize() { try { app.city && app.city.resize(); } catch {} },
    pulse(a) { try { app.city && app.city.pulse(a); } catch {} },
  };

  const ui = {
    play: $('playUI'), who: $('who'), line: $('line'), choices: $('choices'),
    tap: $('tapHint'), title: $('sceneTitle'), hud: $('hud'),
    persona: $('hudPersona'), traits: $('hudTraits'), skills: $('hudSkills'),
    tray: $('tray'), ticker: $('ticker'), chapterCard: $('chapterCard'),
    ccTitle: $('ccTitle'), ccName: $('ccName'), epi: $('epiScreen'), epiCards: $('epiCards'),
  };

  /* ---------------------------------------------------------- helpers -- */
  function storage() { return typeof localStorage !== 'undefined' ? localStorage : null; }
  function toast(text, col) {
    app.toastQ.push({ text, col, t: 4 });
    if (app.toastQ.length > 4) app.toastQ.shift();
    renderToasts();
  }
  function renderToasts() {
    let el = $('toasts');
    if (!el) return;
    el.innerHTML = '';
    for (const t of app.toastQ) {
      const d = document.createElement('div');
      d.className = 'toast';
      if (t.col) d.style.color = t.col, d.style.borderColor = t.col;
      d.textContent = t.text;
      el.appendChild(d);
    }
  }

  function showScreen(name) {
    app.screen = name;
    for (const s of ['titleScreen', 'calibScreen', 'epiScreen', 'chapterCard']) $(s).classList.toggle('on', false);
    ui.play.classList.toggle('on', name === 'play');
    try { document.body.classList.toggle('playing', name === 'play'); } catch {}
    if (name === 'title') $('titleScreen').classList.add('on');
    if (name === 'calib') $('calibScreen').classList.add('on');
    if (name === 'epi') $('epiScreen').classList.add('on');
    if (name === 'chapterCard') { $('chapterCard').classList.add('on'); }
  }

  /* ------------------------------------------------------------ HUD -- */
  function renderHud() {
    const g = app.g; if (!g) return;
    const p = personaOf(g);
    ui.persona.textContent = p.name;
    ui.persona.title = p.blurb;
    let th = '';
    for (const t of TRAITS) {
      const v = g.traits[t];
      th += `<div class="trait"><span class="tname" style="color:${TRAIT_COL[t]}">${t.toUpperCase()}</span><span class="pips">`;
      for (let i = 0; i < 6; i++) th += `<i class="pip${i < v ? ' on' : ''}" style="${i < v ? 'background:' + TRAIT_COL[t] + ';box-shadow:0 0 6px ' + TRAIT_COL[t] : ''}"></i>`;
      th += '</span></div>';
    }
    ui.traits.innerHTML = th;
    ui.skills.innerHTML = g.skills.map(id => { const s = SKILLS[id]; return s ? `<span class="skill" title="${s.desc}">${s.name}</span>` : ''; }).join('') || '<span class="skill empty">— no skills yet; your choices will change that —</span>';
    const packs = carrying(g);
    ui.tray.innerHTML = packs.map(id => { const p = PACKS[id]; return p ? `<div class="pack" title="${p.desc}  ·  ${p.passive}"><b>▣</b> ${p.name}</div>` : ''; }).join('') || '<div class="pack empty">▣ cargo bay: empty</div>';
  }
  function renderTicker() {
    const g = app.g; if (!g) return;
    const w = [];
    for (const id of carrying(g)) { const p = PACKS[id]; if (p && p.whisper) w.push({ id, text: p.whisper }); }
    if (!w.length) { ui.ticker.textContent = ''; ui.ticker.classList.remove('on'); return; }
    ui.ticker.classList.add('on');
    const cur = w[app.whisperIdx % w.length];
    ui.ticker.innerHTML = `<i>${(PACKS[cur.id] || {}).name || ''}</i> ▸ ${cur.text}`;
  }

  /* ------------------------------------------------------ dialogue UI -- */
  function typeLine(who, text) {
    ui.who.textContent = who === 'sys' ? '// SYSTEM' : who.toUpperCase();
    ui.who.className = 'who w-' + (who || 'me');
    app.typeFull = text; app.typeT = 0; app.typing = true;
    ui.line.textContent = '';
    ui.choices.innerHTML = '';
    ui.tap.classList.remove('on');
  }
  function finishTyping() { ui.line.textContent = app.typeFull; app.typing = false; ui.tap.classList.add('on'); }

  function renderNode() {
    const g = app.g, vs = visibleState(g, STORY);
    if (vs.mode === 'line') { typeLine(vs.line[0], vs.line[1]); afterRender(); return; }
    if (vs.mode === 'choices') {
      // finish current line if any
      renderChoices(vs.node);
      ui.tap.classList.remove('on');
      afterRender();
      return;
    }
    if (vs.mode === 'auto') { const r = advance(g, STORY); if (r.sceneEnd || r.goto) return resolveEnd(r); if (visibleState(g, STORY).mode === 'choices') return renderNode(); return renderNode(); }
    renderNodeEnd();
  }
  function afterRender() { renderHud(); renderTicker(); const sc = STORY.SCENES[g_scene()]; if (sc && sc.title) ui.title.textContent = sc.title; }
  const g_scene = () => app.g && app.g.scene;

  function renderNodeEnd() {
    const r = advance(app.g, STORY);
    if (r.goto || r.sceneEnd) return resolveEnd(r);
    renderNode();
  }
  function resolveEnd(r) {
    save();
    if (r.goto) { enterScene(app.g, STORY, r.goto); onSceneEnter(); renderNode(); return; }
    // sceneEnd
    const res = finishScene(app.g, STORY);
    if (res.chapterDone) {
      const nc = nextChapter(app.g, STORY);
      if (nc.done) return showEpilogue();
      chapterCard(() => { onSceneEnter(); renderNode(); });
      return;
    }
    if (res.next) { onSceneEnter(); renderNode(); }
    save();
  }
  function onSceneEnter() {
    const sc = STORY.SCENES[app.g.scene];
    city.setBg(sc ? sc.bg : 'shaft');
    city.pulse(0.6);
    save();
  }
  function chapterCard(cb) {
    const ch = STORY.CHAPTERS[app.g.chapter - 1];
    ui.ccTitle.textContent = 'CHAPTER ' + (app.g.chapter) + (ch ? ' · ' + ['I', 'II', 'III'][app.g.chapter - 1] : '');
    ui.ccName.textContent = ch ? ch.name : 'EPILOGUE';
    showScreen('chapterCard');
    ui.chapterCard.onclick = () => { showScreen('play'); cb && cb(); };
    setTimeout(() => { if (app.screen === 'chapterCard' && !app.userPausedCard) { /* wait for click */ } }, 800);
  }

  function renderChoices(node) {
    ui.who.textContent = '// CHOOSE';
    ui.who.className = 'who w-sys';
    if (!app.typing) ui.line.textContent = '';
    ui.choices.innerHTML = '';
    (node.choices || []).forEach((c, i) => {
      const ok = can(app.g, c.need);
      const b = document.createElement('button');
      b.className = 'choice' + (ok ? '' : ' locked');
      const tag = c.tag ? `<span class="ctag"${ok ? ' style="color:#5affc8;border-color:#5affc844"' : ''}>${c.tag}</span>` : '';
      b.innerHTML = `<span class="cnum">${i + 1}</span><span class="ctext">${c.t}</span>${tag}${ok ? '' : '<span class="clock">LOCKED</span>'}`;
      if (ok) b.onclick = () => takeChoice(i);
      ui.choices.appendChild(b);
    });
  }
  function takeChoice(i) {
    const res = choiceAt(app.g, STORY, i);
    if (!res.ok) return;
    for (const e of res.evs) {
      if (e.t === 'skill') { const s = SKILLS[e.id]; toast('SKILL GAINED — ' + s.name, '#5affc8'); }
      if (e.t === 'skillLost') { toast('SKILL FADED — ' + (SKILLS[e.id] || {}).name, '#ff2d78'); }
      if (e.t === 'gain') toast('CARGO: ' + PACKS[e.id].name, '#8f5bff');
      if (e.t === 'deliver') toast('DELIVERED · ' + (e.mode === 'copy' ? 'COPY RETAINED' : e.mode.toUpperCase()), '#ffb347');
      if (e.t === 'scar') toast('PERSONAL PERMANENT CHANGE LOGGED', '#ff8ab5');
      if (e.t === 'trait' && Math.abs(e.delta) >= 1) toast(`${e.k.toUpperCase()} ${e.up ? '+' : '−'}1`, TRAIT_COL[e.k]);
    }
    city.pulse(1);
    if (res.goto) { enterScene(app.g, STORY, res.goto); onSceneEnter(); renderNode(); }
    else if (res.sceneEnd) resolveEnd({ sceneEnd: true });
    else renderNode();
    save();
  }

  function advanceBeat() {
    if (app.screen !== 'play') return;
    if (app.typing) return finishTyping();
    const g = app.g;
    const vs = visibleState(g, STORY);
    if (vs.mode === 'choices') return;
    const r = advance(g, STORY);
    if (r.goto || r.sceneEnd) return resolveEnd(r);
    renderNode();
  }

  /* --------------------------------------------------------- epilogue -- */
  function showEpilogue() {
    const cards = STORY.buildEpilogue(app.g);
    let html = '';
    for (const c of cards) html += `<div class="epi-card sys"><div class="epi-who">${c.head}</div><p>${c.body}</p></div>`;
    const t = app.g.traits;
    html += `<div class="epi-card sys final"><div class="epi-who">SCARS ON FILE</div><p>${app.g.scars.length ? app.g.scars.map(s => '— ' + s).join('<br>') : '— The ledger is clean. The implant disagrees, gently.'}</p></div>`;
    html += `<div class="epi-card sys"><div class="epi-who">LUMEN PROTOCOL · STATUS</div><p>${{ returned: 'AT REST. Filed as “force of nature, declined.”', choir: 'RUNNING THROUGH THE COURIER. No audit possible; it is weather.', broadcast: 'ONE (1) MINUTE · DELIVERED. The city keeps the change.', glitch: 'DISTRIBUTED AS FOLKLORE. Unauditable, load-bearing, kind.' }[app.g.flags.ending] || 'UNACTIVATED. The city keeps its polite weather.'}</p></div>`;
    html += `<p class="epi-stats">FINAL CALIBRATION — EMPATHY ${t.empathy} · LUCIDITY ${t.lucidity} · DEFIANCE ${t.defiance} · RELIC ${t.relic} · SKILLS ${app.g.skills.length} · SCARS ${app.g.scars.length}</p>`;
    ui.epiCards.innerHTML = html;
    clearSave(storage());
    showScreen('epi');
    city.setBg('roof');
  }

  /* ------------------------------------------------------------ saving -- */
  function save() { if (app.g) saveGame(app.g, storage()); }

  /* ------------------------------------------------------------ screens */
  function buildCalib() {
    const el = $('calibCards'); el.innerHTML = '';
    for (const id of Object.keys(CALIBS)) {
      const c = CALIBS[id];
      const b = document.createElement('button');
      b.className = 'calib-card sys';
      const s = SKILLS[c.skill];
      b.innerHTML = `<h3>${c.name}</h3><p>${c.blurb}</p><div class="cal-meta">${Object.entries(c.traits).map(([k, v]) => `<span style="color:${TRAIT_COL[k]}">${k.toUpperCase()} ${v}</span>`).join(' ')}${s ? ` · <span class="cal-skill">${s.name}</span>` : ''}</div>`;
      b.onclick = () => startRun(id);
      el.appendChild(b);
    }
  }
  function startRun(calib) {
    app.g = createGame(calib);
    enterScene(app.g, STORY, STORY.CHAPTERS[0].scenes[0]);
    showScreen('play');
    ui.title.textContent = STORY.SCENES[app.g.scene].title;
    city.setBg(STORY.SCENES[app.g.scene].bg);
    renderNode();
    save();
  }
  function continueRun() {
    const g = loadGame(storage());
    if (!g) return;
    app.g = g;
    showScreen('play');
    const sc = STORY.SCENES[g.scene];
    if (sc) city.setBg(sc.bg);
    // re-render the current node
    const vs = visibleState(g, STORY);
    if (vs.mode === 'choices') { ui.line.textContent = (vs.node.lines || []).map(l => l[1]).join(' '); renderChoices(vs.node); afterRender(); }
    else { renderNode(); afterRender(); }
  }

  /* ------------------------------------------------------------- input */
  $('btnStart').onclick = () => { buildCalib(); showScreen('calib'); };
  $('btnHow').onclick = () => $('howto').classList.add('on');
  $('howtoClose').onclick = () => $('howto').classList.remove('on');
  $('btnNewRun').onclick = () => { buildCalib(); showScreen('calib'); };
  const cont = $('btnContinue');
  cont.onclick = () => continueRun();
  if (!loadGame(storage())) cont.classList.add('dim');

  $('dialogueBox').addEventListener('click', (e) => { if (e.target.closest && e.target.closest('.choice')) return; advanceBeat(); });
  window.addEventListener('keydown', (e) => {
    if (app.screen === 'play') {
      if (e.code === 'Space' || e.code === 'Enter') {
        const g = app.g, vs = visibleState(g, STORY);
        if (!app.typing && vs.mode === 'choices') { /* keyboard uses digits */ e.preventDefault(); return; }
        advanceBeat(); e.preventDefault(); return;
      }
      const n = parseInt(e.key, 10);
      if (n >= 1 && n <= 9 && app.g && app.g.scene) {
        const node = curNode(app.g, STORY);
        if (node && node.choices && !app.typing) {
          const c = node.choices[n - 1];
          if (c) { if (can(app.g, c.need)) takeChoice(n - 1); else toast('LOCKED — ' + (c.tag || 'requirements not met'), '#ff2d78'); }
          e.preventDefault();
        }
      }
    } else if (app.screen === 'chapterCard') {
      $('chapterCard').click();
    } else if (app.screen === 'calib') {
      const n = parseInt(e.key, 10);
      if (n >= 1 && n <= 3) startRun(Object.keys(CALIBS)[n - 1]);
    }
  });

  /* -------------------------------------------------------------- loop */
  let last = performance.now();
  function loop(ts) {
    try {
      const dt = Math.min(0.05, (ts - last) / 1000 || 0.016); last = ts;
      city.frame(dt);
      if (app.typing) {
        app.typeT += dt;
        const chars = Math.floor(app.typeT * 90);
        if (app.typeFull.slice(0, chars) === app.typeFull) finishTyping();
        else ui.line.textContent = app.typeFull.slice(0, chars);
      }
      app.whisperT += dt;
      if (app.whisperT > 7.5) { app.whisperT = 0; app.whisperIdx++; renderTicker(); }
      for (const tt of app.toastQ) tt.t -= dt;
      if (app.toastQ.some(x => x.t <= 0)) { app.toastQ = app.toastQ.filter(x => x.t > 0); renderToasts(); }
    } catch (e) { app.errored = app.errored || e; }
    requestAnimationFrame(loop);
  }
  try { requestAnimationFrame(loop); } catch {}
  window.addEventListener('resize', () => city.resize());

  showScreen('title');
  return app;
}
