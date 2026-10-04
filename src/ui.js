// HUD, journal, subtitles. Deliberately thin: the city should be the loudest thing.

export function createUI(handlers = {}) {
  const $ = (id) => document.getElementById(id);
  const hud = $('hud');
  const objective = $('objective');
  const objArrow = $('objArrow');
  const objLabel = $('objLabel');
  const objDist = $('objDist');
  const lucidityFill = $('lucidityFill');
  const oilFill = $('oilFill');
  const eclipseFill = $('eclipseFill');
  const crosshair = $('crosshair');
  const prompt = $('prompt');
  const promptText = $('promptText');
  const promptRing = $('promptRing');
  const subtitle = $('subtitle');
  const subWho = $('subWho');
  const subLine = $('subLine');
  const toastEl = $('toast');
  const journal = $('journal');
  const memoryList = $('memoryList');
  const journalFoot = $('journalFoot');
  const start = $('start');
  const pause = $('pause');
  const finale = $('finale');
  const finaleTitle = $('finaleTitle');
  const finaleText = $('finaleText');
  const remainBtn = $('remainBtn');
  const loading = $('loading');

  let toastTimer = null;
  let typeTimer = null;
  const last = { obj: '', objDist: '', prompt: '', progress: -1, stats: {} };
  const ringLen = 2 * Math.PI * 17;

  promptRing.style.strokeDasharray = ringLen;
  promptRing.style.strokeDashoffset = ringLen;

  const ui = {
    els: { hud, start, pause, journal, finale },

    loadingDone() { loading.classList.add('hidden'); },
    showStart() { start.classList.remove('hidden'); hud.classList.add('hidden'); },
    hideStart() { start.classList.add('hidden'); hud.classList.remove('hidden'); },
    showPause(stats = '') {
      pause.classList.remove('hidden');
      $('pauseStats').textContent = stats;
      $('pauseControls').textContent = 'W A S D wade · shift hurry · space step up · E listen · F lantern · TAB memories';
    },
    hidePause() { pause.classList.add('hidden'); },
    onBegin: handlers.onBegin, onResume: handlers.onResume, onRemain: handlers.onRemain,

    setObjective(label, dist, bearing, yaw) {
      if (label === null) {
        if (last.obj !== null) { objective.style.opacity = '0'; last.obj = null; }
        return;
      }
      if (objective.style.opacity !== '.85') objective.style.opacity = '.85';
      if (label !== last.obj) { objLabel.textContent = label; last.obj = label; }
      const dt2 = dist != null ? `${Math.round(dist)} m` : '';
      if (dt2 !== last.objDist) { objDist.textContent = dt2; last.objDist = dt2; }
      if (bearing != null && yaw != null) {
        // the camera looks along (-sin yaw, -cos yaw); turn the arrow by how far
        // you still have to rotate, and the arrow points the way you must go
        const rel = yaw + Math.PI - bearing;
        objArrow.style.display = 'inline-block';
        objArrow.style.transform = `rotate(${rel}rad)`;
      }
    },

    setStats({ lucidity, oil, eclipse }) {
      // only touch the DOM when a bar actually moves
      const put = (key, el, v, step) => {
        if (v === undefined) return;
        const q = Math.round(Math.max(0, Math.min(1, v)) * step);
        if (last.stats[key] === q) return;
        last.stats[key] = q;
        el.style.width = `${(q / step) * 100}%`;
      };
      put('lucidity', lucidityFill, lucidity, 200);
      put('oil', oilFill, oil, 200);
      put('eclipse', eclipseFill, eclipse, 100);
    },

    setAim(tight) { crosshair.classList.toggle('tight', !!tight); },

    setPrompt(visible, text = 'hold E to listen', progress = 0) {
      if (visible !== last.promptVisible) {
        prompt.classList.toggle('hidden', !visible);
        last.promptVisible = visible;
      }
      if (!visible) return;
      if (text && text !== last.prompt) { promptText.textContent = text; last.prompt = text; }
      const p = Math.round(Math.max(0, Math.min(1, progress)) * 60);
      if (p !== last.progress) {
        last.progress = p;
        promptRing.style.strokeDashoffset = String(ringLen * (1 - p / 60));
      }
    },

    say(who, line, { instant = false } = {}) {
      subtitle.classList.remove('hidden');
      subWho.textContent = who || '';
      subLine.classList.remove('show');
      clearInterval(typeTimer);
      const text = line || '';
      if (instant) {
        subLine.textContent = text;
        requestAnimationFrame(() => subLine.classList.add('show'));
        return;
      }
      let i = 0;
      subLine.textContent = '';
      typeTimer = setInterval(() => {
        i += 1;
        subLine.textContent = text.slice(0, i);
        if (i === 1) subLine.classList.add('show');
        if (i >= text.length) clearInterval(typeTimer);
      }, 26);
    },
    quiet() { clearInterval(typeTimer); subtitle.classList.add('hidden'); subLine.classList.remove('show'); },

    toast(text, ms = 5200) {
      toastEl.textContent = text;
      toastEl.classList.remove('hidden');
      requestAnimationFrame(() => toastEl.classList.add('show'));
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => {
        toastEl.classList.remove('show');
        setTimeout(() => toastEl.classList.add('hidden'), 1200);
      }, ms);
    },

    /* ── journal ── */
    renderJournal(memories, foundIds, progress) {
      memoryList.innerHTML = '';
      memories.forEach((m) => {
        const li = document.createElement('li');
        const found = foundIds.has(m.id);
        if (found) li.classList.add('found');
        const h = document.createElement('h3');
        h.innerHTML = `<span>${found ? m.title : '— — — —'}</span><em>${found ? m.kind : `fragment ${m.order}`}</em>`;
        li.appendChild(h);
        const who = document.createElement('div');
        who.className = 'who';
        who.textContent = found ? m.speaker : 'not yet remembered';
        li.appendChild(who);
        const body = document.createElement('div');
        if (found) { body.className = 'body'; body.textContent = m.journal; }
        else { body.className = 'locked'; body.textContent = 'Someone in the city is still holding this. Listen for the light.'; }
        li.appendChild(body);
        memoryList.appendChild(li);
      });
      journalFoot.textContent = `${foundIds.size} of ${memories.length} fragments restored  ·  the tide is at ${(progress * 100).toFixed(0)}%`;
    },
    toggleJournal(force) {
      const showing = force !== undefined ? force : journal.classList.contains('hidden');
      journal.classList.toggle('hidden', !showing);
      return showing;
    },

    /* ── endings ── */
    showFinale(title, lines) {
      finale.classList.remove('hidden');
      finaleTitle.textContent = title;
      finaleText.textContent = lines.join('\n\n');
      requestAnimationFrame(() => finale.querySelector('.finale-inner').classList.add('show'));
    },
    setEpilogue(text, showButton = true) {
      finaleText.textContent = text;
      remainBtn.classList.toggle('hidden', !showButton);
    },
    hideFinale() { finale.classList.add('hidden'); },
  };

  $('beginBtn').addEventListener('click', () => handlers.onBegin?.());
  $('resumeBtn').addEventListener('click', () => handlers.onResume?.());
  remainBtn.addEventListener('click', () => handlers.onRemain?.());

  return ui;
}
