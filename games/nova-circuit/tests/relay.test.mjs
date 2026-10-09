import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createRequire } from 'node:module';
const relay = createRequire(import.meta.url)('../relay.cjs');

let server, base;
test.before(async () => {
  server = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://x');
    relay.handle(req, res, u.pathname, u.searchParams).then((ok) => { if (!ok) { res.writeHead(404); res.end(); } });
  });
  await new Promise((r) => server.listen(0, r));
  base = `http://127.0.0.1:${server.address().port}`;
});
test.after(() => { server.closeAllConnections?.(); server.close(); });

const post = async (path, body) => { const r = await fetch(base + '/api/nc/' + path, { method: 'POST', body: JSON.stringify(body) }); return { status: r.status, json: await r.json() }; };

async function listen(room, pid) {
  const ctl = new AbortController();
  const r = await fetch(`${base}/api/nc/events?room=${room}&pid=${pid}`, { signal: ctl.signal });
  assert.equal(r.status, 200);
  const events = [];
  let waiter = null;
  (async () => {
    const dec = new TextDecoder(); let buf = '';
    try {
      for await (const chunk of r.body) {
        buf += dec.decode(chunk, { stream: true });
        let i;
        while ((i = buf.indexOf('\n\n')) >= 0) {
          const frame = buf.slice(0, i); buf = buf.slice(i + 2);
          if (frame.startsWith('data: ')) { events.push(JSON.parse(frame.slice(6))); waiter?.(); }
        }
      }
    } catch { /* aborted */ }
  })();
  return {
    events,
    close: () => ctl.abort(),
    async until(pred, ms = 2000) {
      const t0 = Date.now();
      while (Date.now() - t0 < ms) { const f = events.find(pred); if (f) return f; await new Promise((res) => { waiter = res; setTimeout(res, 30); }); }
      throw new Error('timeout waiting for event; got ' + JSON.stringify(events));
    },
  };
}

test('create / join / broadcast / targeted send / leave', async () => {
  const a = await post('create', { name: 'alice<script>' });
  assert.equal(a.status, 200);
  assert.match(a.json.room, /^[A-Z]{4}$/);
  const ea = await listen(a.json.room, a.json.pid);
  const w = await ea.until((e) => e.sys === 'welcome');
  assert.equal(w.host, a.json.pid);
  assert.ok(!/[<>]/.test(w.players[0].name), 'names are sanitised');

  const b = await post('join', { room: a.json.room.toLowerCase(), name: 'bob' });
  assert.equal(b.status, 200);
  await ea.until((e) => e.sys === 'join' && e.name === 'BOB');
  const eb = await listen(a.json.room, b.json.pid);
  const wb = await eb.until((e) => e.sys === 'welcome');
  assert.equal(wb.players.length, 2);

  // broadcast reaches the other pilot only
  await post('send', { room: a.json.room, pid: a.json.pid, msgs: [{ t: 's', p: [1] }, { t: 's', p: [2] }] });
  const got = await eb.until((e) => e.msgs);
  assert.equal(got.from, a.json.pid);
  assert.equal(got.msgs.length, 2);
  assert.ok(!ea.events.some((e) => e.msgs), 'sender does not get its own messages');

  // send to host
  await post('send', { room: a.json.room, pid: b.json.pid, to: 'host', msgs: [{ t: 'profile' }] });
  await ea.until((e) => e.msgs && e.msgs[0].t === 'profile');

  // leave -> notification, host migration
  await post('leave', { room: a.json.room, pid: a.json.pid });
  await eb.until((e) => e.sys === 'host' && e.pid === b.json.pid);
  await eb.until((e) => e.sys === 'leave' && e.pid === a.json.pid);
  ea.close();
  await post('leave', { room: a.json.room, pid: b.json.pid });
  const gone = await post('join', { room: a.json.room, name: 'late' });
  assert.equal(gone.status, 404, 'empty rooms are removed');
  eb.close();
});

test('rooms cap at six pilots and reject unknown rooms', async () => {
  const a = await post('create', { name: 'host' });
  for (let i = 0; i < 5; i++) assert.equal((await post('join', { room: a.json.room, name: 'p' + i })).status, 200);
  const full = await post('join', { room: a.json.room, name: 'extra' });
  assert.equal(full.status, 409);
  assert.equal((await post('join', { room: 'ZZZZ', name: 'x' })).status, 404);
  assert.equal((await post('send', { room: a.json.room, pid: 'nope', msgs: [] })).status, 404);
});

test('messages sent before the stream connects are queued', async () => {
  const a = await post('create', { name: 'one' });
  const b = await post('join', { room: a.json.room, name: 'two' });
  await post('send', { room: a.json.room, pid: a.json.pid, msgs: [{ t: 'early' }] });
  const eb = await listen(a.json.room, b.json.pid);
  await eb.until((e) => e.msgs && e.msgs[0].t === 'early');
  eb.close();
});
