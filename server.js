/* ============================================================================
 * Dependency-free static server for local development.
 *
 *   npm start          -> http://localhost:3000
 *
 * Mirrors what Vercel does at deploy time: serve the repo root as static
 * files. Game routes are resolved from games/catalog.js, so a newly added
 * game gets working URLs without touching this file.
 * ========================================================================== */

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';
const ROOT = __dirname;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.wasm': 'application/wasm'
};

// The catalog is written as a browser global, so evaluate it in a sandbox to
// recover the GAMES list for routing without pulling in a JS parser.
function loadCatalog() {
  const catalogPath = path.join(ROOT, 'games', 'catalog.js');
  try {
    const source = fs.readFileSync(catalogPath, 'utf8');
    const sandbox = { window: undefined };
    // eslint-disable-next-line no-new-func
    new Function('window', source)(sandbox.window = {});
    return (sandbox.window && sandbox.window.ARENA && sandbox.window.ARENA.games) || [];
  } catch (err) {
    console.warn('[server] Could not read games/catalog.js:', err.message);
    return [];
  }
}

const GAMES = loadCatalog();

// Map /games/<slug> and /games/<slug>/ to the catalog's entry file.
const ROUTES = new Map();
for (const game of GAMES) {
  if (!game.entry) continue;
  ROUTES.set('/games/' + game.id, game.entry);
  ROUTES.set('/games/' + game.id + '/', game.entry);
}

const server = http.createServer((req, res) => {
  let reqUrl;
  try {
    reqUrl = decodeURIComponent(req.url.split('?')[0]);
  } catch {
    res.writeHead(400, { 'Content-Type': 'text/plain' });
    res.end('400 Bad Request');
    return;
  }

  if (reqUrl === '/' || reqUrl === '') {
    reqUrl = '/index.html';
  } else if (ROUTES.has(reqUrl)) {
    reqUrl = '/' + ROUTES.get(reqUrl);
  }

  // Resolve inside ROOT only — blocks ../ traversal.
  const filePath = path.join(ROOT, reqUrl);
  if (filePath !== ROOT && !filePath.startsWith(ROOT + path.sep)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('403 Forbidden');
    return;
  }

  fs.stat(filePath, (err, stats) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(`<h1>404 Not Found</h1><p>The path <code>${reqUrl}</code> was not found.</p><p><a href="/">Return to Arena Lobby</a></p>`);
      return;
    }

    const resolved = stats.isDirectory() ? path.join(filePath, 'index.html') : filePath;
    const ext = path.extname(resolved).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    fs.readFile(resolved, (readErr, content) => {
      if (readErr) {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('500 Internal Server Error');
        return;
      }

      res.writeHead(200, {
        'Content-Type': contentType,
        'Cache-Control': 'no-cache',
        'X-Content-Type-Options': 'nosniff'
      });
      res.end(content);
    });
  });
});

server.listen(PORT, HOST, () => {
  console.log('\n======================================================');
  console.log('  ARENA ARCADE dev server');
  console.log(`  http://localhost:${PORT}`);
  console.log('======================================================\n');
  console.log(`  Portal:  http://localhost:${PORT}/`);
  for (const game of GAMES) {
    console.log(`  ${game.rank === 'S' ? 'S' : 'A'}-rank  http://localhost:${PORT}/games/${game.id}/  ${game.title}`);
  }
  console.log('');
});