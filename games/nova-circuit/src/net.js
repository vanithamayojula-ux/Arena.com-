// Online client for the Nova Circuit relay (see relay.cjs).
// Messages are batched into one POST every ~40ms and received over SSE.

export class Net {
  constructor() {
    this.room = null;
    this.pid = null;
    this.host = null;
    this.players = new Map();
    this.es = null;
    this.outbox = [];
    this.outTo = new Map();
    this.timer = null;
    this.onMsg = null; // (from, msg)
    this.onSys = null; // (sysEvent)
    this.connected = false;
    this.rtt = 0;
  }

  async post(path, body) {
    const r = await fetch('/api/nc/' + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || 'Connection failed');
    return j;
  }

  async create(name) {
    const j = await this.post('create', { name });
    await this.open(j.room, j.pid);
    return j.room;
  }
  async join(code, name) {
    const j = await this.post('join', { room: code.trim().toUpperCase(), name });
    await this.open(j.room, j.pid);
    return j.room;
  }

  open(room, pid) {
    this.room = room; this.pid = pid;
    return new Promise((resolve, reject) => {
      const es = new EventSource(`/api/nc/events?room=${room}&pid=${pid}`);
      this.es = es;
      let done = false;
      es.onmessage = (ev) => {
        let d; try { d = JSON.parse(ev.data); } catch { return; }
        if (d.sys === 'welcome') {
          this.host = d.host;
          this.players = new Map(d.players.map((p) => [p.pid, p.name]));
          this.connected = true;
          if (!done) { done = true; resolve(); }
        } else if (d.sys) {
          if (d.sys === 'join') this.players.set(d.pid, d.name);
          if (d.sys === 'leave') this.players.delete(d.pid);
          if (d.sys === 'host') this.host = d.pid;
          this.onSys?.(d);
        } else if (d.msgs) {
          for (const m of d.msgs) this.onMsg?.(d.from, m);
        }
      };
      es.onerror = () => {
        if (!done) { done = true; reject(new Error('Could not reach the online relay')); this.close(); }
        else if (this.connected && es.readyState === 2) { this.connected = false; this.onSys?.({ sys: 'disconnected' }); }
      };
    });
  }

  get isHost() { return this.pid && this.pid === this.host; }

  /** Queue a message. `to` may be 'host', a pid, or omitted for everyone else. */
  send(msg, to) {
    if (!this.room) return;
    const k = to || '*';
    if (!this.outTo.has(k)) this.outTo.set(k, []);
    this.outTo.get(k).push(msg);
    if (!this.timer) this.timer = setTimeout(() => this.flush(), 40);
  }
  flush() {
    this.timer = null;
    for (const [to, msgs] of this.outTo) {
      fetch('/api/nc/send', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ room: this.room, pid: this.pid, to: to === '*' ? undefined : to, msgs }), keepalive: false }).catch(() => {});
    }
    this.outTo.clear();
  }

  close() {
    if (this.es) { this.es.close(); this.es = null; }
    if (this.room && this.pid) {
      try { navigator.sendBeacon?.('/api/nc/leave', new Blob([JSON.stringify({ room: this.room, pid: this.pid })], { type: 'application/json' })); } catch {}
    }
    this.room = null; this.pid = null; this.connected = false; this.players = new Map();
    if (this.timer) { clearTimeout(this.timer); this.timer = null; }
    this.outTo.clear();
  }
}
