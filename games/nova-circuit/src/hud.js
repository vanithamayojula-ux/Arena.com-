// Per-viewport heads-up display (DOM based, so it works for split-screen too).
import { ITEMS, LIVERIES, C, wrapD } from './sim.js';

const THREE = window.THREE;
const fmtTime = (t) => {
  if (!isFinite(t)) return '--:--.--';
  const m = Math.floor(t / 60);
  const s = t - m * 60;
  return `${m}:${s.toFixed(2).padStart(5, '0')}`;
};
export { fmtTime };
const ord = (n) => n + (['TH', 'ST', 'ND', 'RD'][n % 10 > 3 || Math.floor(n / 10) === 1 ? 0 : n % 10]);

const TEMPLATE = `
<div class="hud-tl">
  <div class="h-pos"><b data-k="pos">1</b><sup data-k="posOrd">ST</sup><span data-k="posTotal">/6</span></div>
  <div class="h-lap">LAP <b data-k="lap">1</b><span data-k="laps">/3</span></div>
  <div class="h-time" data-k="time">0:00.00</div>
  <div class="h-best">BEST <span data-k="best">--:--.--</span></div>
</div>
<div class="hud-tr">
  <canvas class="mini" width="200" height="200"></canvas>
  <div class="feed" data-k="feed"></div>
</div>
<div class="hud-bl">
  <div class="gun"><label>PULSE CANNON</label><div class="bar heat"><i data-k="heat"></i></div></div>
  <div class="msl"><label>HOMING MISSILES</label><div class="pips" data-k="pips"></div></div>
  <div class="item" data-k="item"><div class="ico" data-k="itemIco"></div><div class="nm" data-k="itemName">NO ITEM</div><div class="key" data-k="itemKey"></div></div>
</div>
<div class="hud-bc">
  <div class="speed"><b data-k="speed">0</b><span>KM/H</span></div>
  <div class="bars">
    <div class="bar boost"><label>BOOST</label><i data-k="boost"></i></div>
    <div class="bar hull"><label>HULL</label><i data-k="hull"></i><u data-k="shield"></u></div>
  </div>
</div>
<div class="hud-center">
  <div class="count" data-k="count"></div>
  <div class="msg" data-k="msg"></div>
  <div class="sub" data-k="sub"></div>
</div>
<div class="reticles" data-k="ret"></div>
<div class="warn" data-k="warn">⚠ MISSILE INCOMING — EVADE</div>
<div class="drafting" data-k="draft">SLIPSTREAM</div>
<div class="dead" data-k="dead">SHIP DESTROYED<small>RE-DEPLOYING…</small></div>
<div class="hud-hint" data-k="hint"></div>
`;

export class HUD {
  constructor(host, opts = {}) {
    this.host = host;
    host.innerHTML = TEMPLATE;
    host.classList.add('hud');
    this.opts = opts;
    this.q = {};
    host.querySelectorAll('[data-k]').forEach((el) => (this.q[el.dataset.k] = el));
    this.mini = host.querySelector('.mini');
    this.mctx = this.mini.getContext('2d');
    this.cache = {};
    this.retPool = [];
    this.msgT = 0;
    this.subT = 0;
    this.lastCount = null;
    this.shipRef = null;
    this.keysText = opts.keys || '';
    this.q.hint.textContent = opts.hint || '';
  }

  set(k, v) {
    if (this.cache[k] !== v) { this.cache[k] = v; this.q[k].textContent = v; }
  }

  setTrack(track) {
    // minimap geometry (top-down, normalised)
    const { N, P } = track;
    let minx = 1e9, maxx = -1e9, minz = 1e9, maxz = -1e9;
    for (let i = 0; i < N; i++) { minx = Math.min(minx, P[i * 3]); maxx = Math.max(maxx, P[i * 3]); minz = Math.min(minz, P[i * 3 + 2]); maxz = Math.max(maxz, P[i * 3 + 2]); }
    const W = 200, pad = 16;
    const sc = Math.min((W - pad * 2) / (maxx - minx), (W - pad * 2) / (maxz - minz));
    const ox = (W - (maxx - minx) * sc) / 2 - minx * sc, oz = (W - (maxz - minz) * sc) / 2 - minz * sc;
    this.mapT = { sc, ox, oz };
    const c = document.createElement('canvas');
    c.width = c.height = W;
    const g = c.getContext('2d');
    g.lineJoin = 'round'; g.lineCap = 'round';
    const draw = (w, style) => { g.lineWidth = w; g.strokeStyle = style; g.beginPath(); for (let i = 0; i <= N; i += 3) { const k = i % N; const x = P[k * 3] * sc + ox, y = P[k * 3 + 2] * sc + oz; i ? g.lineTo(x, y) : g.moveTo(x, y); } g.closePath(); g.stroke(); };
    draw(8, 'rgba(0,0,0,0.55)');
    draw(5, 'rgba(120,220,255,0.35)');
    draw(2, track.def.art.palette.accent);
    g.fillStyle = '#fff'; g.fillRect(P[0] * sc + ox - 4, P[2] * sc + oz - 1.5, 8, 3);
    this.mapCanvas = c;
    this.track = track;
  }

  msg(text, kind = '', dur = 1.8) {
    const el = this.q.msg;
    el.textContent = text;
    el.className = 'msg ' + kind;
    void el.offsetWidth;
    el.classList.add('show');
    this.msgT = dur;
  }
  sub(text, dur = 2.2) {
    const el = this.q.sub;
    el.textContent = text;
    el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
    this.subT = dur;
  }
  feed(text, color = '#fff') {
    const d = document.createElement('div');
    d.className = 'fi';
    d.innerHTML = text;
    d.style.borderColor = color;
    this.q.feed.prepend(d);
    while (this.q.feed.children.length > 4) this.q.feed.lastChild.remove();
    setTimeout(() => d.remove(), 5200);
  }

  onEvent(e, ship, race) {
    const mine = (s) => s === ship;
    switch (e.type) {
      case 'lap':
        if (mine(e.ship)) { this.msg(`LAP ${e.lap}`, 'lap'); this.sub(`${fmtTime(e.time)}${e.best ? '  ·  BEST LAP' : ''}`); }
        break;
      case 'finish':
        if (mine(e.ship)) this.msg(`FINISHED  ${ord(e.ship.place)}`, 'fin', 4);
        break;
      case 'pickup':
        if (mine(e.ship)) {
          const t = { ammo: '+3 MISSILES', energy: '+BOOST CELL', repair: 'HULL REPAIRED', shield: 'SHIELD ONLINE', emp: 'EMP PULSE', mines: 'MINE LAYER ×3', overdrive: 'OVERDRIVE' }[e.kind];
          this.sub(t, 1.4);
        }
        break;
      case 'kill': {
        const k = e.killer, v = e.victim;
        if (k && mine(k)) { this.msg('TAKEDOWN', 'kill', 1.6); this.sub(`${v.name} DESTROYED  ·  +BOOST`, 2); }
        const kc = k ? LIVERIES[k.livery % LIVERIES.length].a : '#aaa';
        this.feed(k ? `<b style="color:${kc}">${k.name}</b> ⌖ ${v.name}` : `<b>${v.name}</b> ✕ crashed`, kc);
        break;
      }
      case 'launch':
        if (mine(e.ship)) this.msg(e.perfect ? 'PERFECT LAUNCH' : 'ENGINE FLOODED', e.perfect ? 'lap' : 'warnmsg', 1.5);
        break;
      case 'boostPad': if (mine(e.ship)) this.sub('BOOST PAD', 1); break;
      case 'jumpPad': if (mine(e.ship)) this.sub('AIRBORNE', 1); break;
      case 'overheat': if (mine(e.ship)) this.sub('CANNON OVERHEAT', 1.4); break;
      case 'evade': if (mine(e.ship)) this.msg('MISSILE EVADED', 'lap', 1.2); break;
      case 'damage': break;
      case 'respawn': if (mine(e.ship)) this.sub('SHIELDS UP — GO GO GO', 1.6); break;
      case 'locked': if (mine(e.ship)) this.sub('TARGET LOCKED  ·  FIRE MISSILE', 1); break;
      default: break;
    }
  }

  update(race, ship, rend, viewIdx, dt) {
    const q = this.q;
    this.shipRef = ship;
    const L = race.track.length;
    // header
    const total = race.ships.length;
    this.set('pos', String(ship.place));
    this.set('posOrd', ord(ship.place).replace(/^\d+/, ''));
    this.set('posTotal', '/' + total);
    this.set('lap', String(Math.min(race.laps, Math.max(1, ship.lap))));
    this.set('laps', '/' + race.laps);
    const t = race.state === 'countdown' ? 0 : ship.finished ? ship.finishTime : race.time;
    this.set('time', fmtTime(t));
    this.set('best', isFinite(ship.bestLap) ? fmtTime(ship.bestLap) : '--:--.--');
    // speed
    const kmh = Math.round(ship.vs * 1.9);
    this.set('speed', String(kmh));
    q.speed.parentElement.classList.toggle('boosting', ship.boosting);
    q.boost.style.width = Math.max(0, Math.min(100, ship.energy)) + '%';
    q.boost.parentElement.classList.toggle('on', ship.boosting);
    q.boost.parentElement.classList.toggle('low', ship.energy < 15);
    q.hull.style.width = Math.max(0, ship.hp / ship.hpMax * 100) + '%';
    q.hull.parentElement.classList.toggle('low', ship.hp < ship.hpMax * 0.3);
    q.shield.style.width = ship.shield > 0 ? Math.min(100, ship.shield / 9 * 100) + '%' : '0%';
    q.heat.style.width = ship.heat + '%';
    q.heat.parentElement.classList.toggle('over', ship.overheated);
    // missiles
    const pipKey = ship.ammo + '|' + (ship.locked ? 1 : 0);
    if (this.cache.pips !== pipKey) {
      this.cache.pips = pipKey;
      q.pips.innerHTML = Array.from({ length: Math.max(3, ship.ammo) }, (_, i) => `<i class="${i < ship.ammo ? 'on' : ''}"></i>`).join('');
    }
    q.pips.classList.toggle('lock', ship.locked);
    // item
    const it = ship.item ? ITEMS[ship.item] : null;
    this.set('itemName', it ? `${it.name}${ship.itemUses > 1 ? ' ×' + ship.itemUses : ''}` : 'NO ITEM');
    this.set('itemIco', it ? it.icon : '·');
    q.item.classList.toggle('has', !!it);
    q.item.style.setProperty('--ic', it ? it.color : '#6b7a99');
    this.set('itemKey', this.keysText);
    // warnings
    q.warn.classList.toggle('on', ship.incoming > 0 && ship.alive);
    q.draft.classList.toggle('on', ship.draft > 0.15);
    q.dead.classList.toggle('on', !ship.alive && !ship.finished);
    // countdown
    if (race.state === 'countdown') {
      const n = Math.ceil(race.countdown);
      if (n !== this.lastCount) { this.lastCount = n; q.count.textContent = n > 0 ? String(n) : ''; q.count.className = 'count pop'; void q.count.offsetWidth; q.count.classList.add('go'); }
    } else if (this.lastCount !== null) {
      this.lastCount = null;
      q.count.textContent = 'GO!';
      q.count.className = 'count pop goo';
      setTimeout(() => { q.count.textContent = ''; q.count.className = 'count'; }, 900);
    }
    if (this.msgT > 0) { this.msgT -= dt; if (this.msgT <= 0) q.msg.classList.remove('show'); }
    if (this.subT > 0) { this.subT -= dt; if (this.subT <= 0) q.sub.classList.remove('show'); }
    this.drawMap(race, ship);
    this.drawReticles(race, ship, rend, viewIdx, L);
  }

  drawMap(race, ship) {
    const g = this.mctx;
    const T = this.mapT;
    if (!this.mapCanvas) return;
    g.clearRect(0, 0, 200, 200);
    g.drawImage(this.mapCanvas, 0, 0);
    const P = (d) => { const f = race.track.sample(d); return [f.P[0] * T.sc + T.ox, f.P[2] * T.sc + T.oz]; };
    for (const s of race.ships) {
      if (!s.alive || s === ship) continue;
      const [x, y] = P(s.dist);
      g.fillStyle = LIVERIES[s.livery % LIVERIES.length].a;
      g.beginPath(); g.arc(x, y, s.human ? 4 : 3, 0, 6.283); g.fill();
    }
    if (ship.alive) {
      const [x, y] = P(ship.dist);
      g.fillStyle = '#fff'; g.strokeStyle = '#000'; g.lineWidth = 2;
      g.beginPath(); g.arc(x, y, 5.5, 0, 6.283); g.stroke(); g.fill();
    }
  }

  drawReticles(race, ship, rend, viewIdx, L) {
    const host = this.q.ret;
    let used = 0;
    const v = new THREE.Vector3();
    const view = rend.views?.[viewIdx];
    if (!view || !ship.alive) { for (const r of this.retPool) r.style.display = 'none'; return; }
    for (const s of race.ships) {
      if (s === ship || !s.alive) continue;
      const ds = wrapD(s.dist - ship.dist, L);
      if (ds < 8 || ds > 900) continue;
      rend.worldPos(s.dist, s.x, s.h + 1.5, v);
      const p = rend.project(viewIdx, v);
      if (!p) continue;
      let el = this.retPool[used];
      if (!el) {
        el = document.createElement('div');
        el.className = 'ret';
        el.innerHTML = '<div class="box"></div><div class="nm"></div><div class="lk"></div>';
        host.appendChild(el);
        this.retPool.push(el);
      }
      used++;
      el.style.display = 'block';
      el.style.transform = `translate(${p.lx.toFixed(0)}px,${p.ly.toFixed(0)}px)`;
      const isTarget = ship.lockTarget === s;
      el.classList.toggle('target', isTarget);
      el.classList.toggle('locked', isTarget && ship.locked);
      el.classList.toggle('far', ds > 520);
      const sz = Math.max(26, Math.min(110, 3600 / (ds + 30)));
      const box = el.firstChild;
      box.style.width = box.style.height = sz + 'px';
      box.style.margin = `${-sz / 2}px 0 0 ${-sz / 2}px`;
      const nm = el.children[1];
      const label = `${s.name}  ${Math.round(ds)}m`;
      if (nm.textContent !== label) nm.textContent = label;
      nm.style.top = sz / 2 + 4 + 'px';
      const lk = el.children[2];
      const txt = isTarget ? (ship.locked ? 'LOCKED' : `LOCK ${Math.round(Math.min(1, ship.lockTime / C.LOCK_TIME) * 100)}%`) : '';
      if (lk.textContent !== txt) lk.textContent = txt;
      lk.style.top = -sz / 2 - 18 + 'px';
    }
    for (let i = used; i < this.retPool.length; i++) this.retPool[i].style.display = 'none';
  }
}
