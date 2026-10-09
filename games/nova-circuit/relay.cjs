// Nova Circuit online relay: tiny room-based message relay over HTTP (POST) and
// Server-Sent Events. Dependency-free, plugs into the arcade's server.js.
//
//   POST /api/nc/create  {name}                -> {room, pid}
//   POST /api/nc/join    {room, name}          -> {room, pid}
//   GET  /api/nc/events?room=&pid=             -> SSE stream
//   POST /api/nc/send    {room, pid, msgs:[], to?} -> {ok}
//   POST /api/nc/leave   {room, pid}
//
// The relay never interprets game messages; it just fans them out. Clients run
// their own ship simulation and exchange state (see src/net.js).

const crypto = require('crypto');

const ROOMS = new Map();
const MAX_ROOMS = 200;
const MAX_PLAYERS = 6;
const IDLE_MS = 15 * 60 * 1000;
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';

function code() {
  for (let tries = 0; tries < 50; tries++) {
    let c = '';
    for (let i = 0; i < 4; i++) c += CODE_CHARS[crypto.randomInt(CODE_CHARS.length)];
    if (!ROOMS.has(c)) return c;
  }
  return null;
}

function json(res, status, obj) {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(obj));
}

function body(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (c) => {
      data += c;
      if (data.length > 64 * 1024) { reject(new Error('too large')); req.destroy(); }
    });
    req.on('end', () => { try { resolve(data ? JSON.parse(data) : {}); } catch (e) { reject(e); } });
    req.on('error', reject);
  });
}

function sse(p, payload) {
  const line = `data: ${JSON.stringify(payload)}\n\n`;
  if (p.res) p.res.write(line);
  else { p.queue.push(line); if (p.queue.length > 200) p.queue.shift(); }
}

function broadcast(room, payload, exceptPid) {
  for (const p of room.players.values()) if (p.pid !== exceptPid) sse(p, payload);
}

function removePlayer(room, pid) {
  const p = room.players.get(pid);
  if (!p) return;
  room.players.delete(pid);
  try { p.res && p.res.end(); } catch {}
  if (room.players.size === 0) { ROOMS.delete(room.code); return; }
  if (room.host === pid) {
    room.host = room.players.keys().next().value;
    broadcast(room, { sys: 'host', pid: room.host });
  }
  broadcast(room, { sys: 'leave', pid });
}

function cleanName(n) {
  return String(n || 'PILOT').replace(/[^\w \-.]/g, '').slice(0, 14).toUpperCase() || 'PILOT';
}

async function handle(req, res, pathname, query) {
  if (!pathname.startsWith('/api/nc/')) return false;
  const route = pathname.slice(8);
  try {
    if (route === 'events' && req.method === 'GET') {
      const room = ROOMS.get(String(query.get('room') || '').toUpperCase());
      const p = room && room.players.get(String(query.get('pid')));
      if (!p) { json(res, 404, { error: 'no such room' }); return true; }
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
      });
      res.write(': connected\n\n');
      p.res = res;
      for (const line of p.queue) res.write(line);
      p.queue = [];
      const players = [...room.players.values()].map((q) => ({ pid: q.pid, name: q.name }));
      res.write(`data: ${JSON.stringify({ sys: 'welcome', pid: p.pid, host: room.host, players })}\n\n`);
      const ka = setInterval(() => { try { res.write(': ka\n\n'); } catch {} }, 12000);
      req.on('close', () => {
        clearInterval(ka);
        if (p.res === res) { p.res = null; p.closedAt = Date.now(); setTimeout(() => { if (!p.res && room.players.get(p.pid) === p) removePlayer(room, p.pid); }, 8000); }
      });
      return true;
    }
    if (req.method !== 'POST') { json(res, 405, { error: 'method' }); return true; }
    const b = await body(req);
    if (route === 'create') {
      if (ROOMS.size >= MAX_ROOMS) { json(res, 503, { error: 'server busy' }); return true; }
      const c = code();
      if (!c) { json(res, 503, { error: 'server busy' }); return true; }
      const pid = crypto.randomBytes(4).toString('hex');
      const room = { code: c, host: pid, players: new Map(), created: Date.now(), last: Date.now() };
      room.players.set(pid, { pid, name: cleanName(b.name), res: null, queue: [] });
      ROOMS.set(c, room);
      json(res, 200, { room: c, pid });
      return true;
    }
    if (route === 'join') {
      const room = ROOMS.get(String(b.room || '').toUpperCase());
      if (!room) { json(res, 404, { error: 'Room not found' }); return true; }
      if (room.players.size >= MAX_PLAYERS) { json(res, 409, { error: 'Room is full' }); return true; }
      const pid = crypto.randomBytes(4).toString('hex');
      const name = cleanName(b.name);
      broadcast(room, { sys: 'join', pid, name });
      room.players.set(pid, { pid, name, res: null, queue: [] });
      room.last = Date.now();
      json(res, 200, { room: room.code, pid });
      return true;
    }
    const room = ROOMS.get(String(b.room || '').toUpperCase());
    const p = room && room.players.get(String(b.pid));
    if (!p) { json(res, 404, { error: 'no such room' }); return true; }
    room.last = Date.now();
    if (route === 'send') {
      const msgs = Array.isArray(b.msgs) ? b.msgs.slice(0, 80) : [];
      const payload = { from: p.pid, msgs };
      if (b.to === 'host') { const h = room.players.get(room.host); if (h && h !== p) sse(h, payload); }
      else if (b.to && room.players.has(b.to)) sse(room.players.get(b.to), payload);
      else broadcast(room, payload, p.pid);
      json(res, 200, { ok: 1 });
      return true;
    }
    if (route === 'leave') { removePlayer(room, p.pid); json(res, 200, { ok: 1 }); return true; }
    json(res, 404, { error: 'unknown route' });
  } catch (e) {
    json(res, 400, { error: String(e.message || e) });
  }
  return true;
}

setInterval(() => {
  const now = Date.now();
  for (const room of ROOMS.values()) if (now - room.last > IDLE_MS) { for (const pid of [...room.players.keys()]) removePlayer(room, pid); ROOMS.delete(room.code); }
}, 60 * 1000).unref();

module.exports = { handle, _rooms: ROOMS };
