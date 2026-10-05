const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
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
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.wasm': 'application/wasm'
};

const server = http.createServer((req, res) => {
  // Parse URL safely
  let reqUrl = decodeURI(req.url.split('?')[0]);

  // Clean trailing slashes or normalize
  let filePath = path.join(ROOT, reqUrl);

  // Normalize route shortcuts
  if (reqUrl === '/' || reqUrl === '') {
    filePath = path.join(ROOT, 'index.html');
  } else if (reqUrl === '/games/cyberstrike' || reqUrl === '/games/cyberstrike/') {
    filePath = path.join(ROOT, 'games', 'cyberstrike', 'play.html');
  } else if (reqUrl === '/games/typestorm' || reqUrl === '/games/typestorm/') {
    filePath = path.join(ROOT, 'games', 'typestorm', 'play.html');
  } else if (reqUrl === '/games/neon-run' || reqUrl === '/games/neon-run/') {
    filePath = path.join(ROOT, 'games', 'neon-run', 'index.html');
  } else if (reqUrl === '/games/apex' || reqUrl === '/games/apex/') {
    filePath = path.join(ROOT, 'games', 'apex', 'index.html');
  } else if (reqUrl === '/games/ghibli-style-delivery-game' || reqUrl === '/games/ghibli-style-delivery-game/') {
    filePath = path.join(ROOT, 'games', 'ghibli-style-delivery-game', 'play.html');
  } else if (reqUrl === '/games/time-echo' || reqUrl === '/games/time-echo/') {
    filePath = path.join(ROOT, 'games', 'time-echo', 'index.html');
  } else if (reqUrl === '/games/afterglow' || reqUrl === '/games/afterglow/') {
    filePath = path.join(ROOT, 'games', 'afterglow', 'index.html');
  }

  // Prevent directory traversal
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('403 Forbidden');
    return;
  }

  fs.stat(filePath, (err, stats) => {
    if (err) {
      // If file not found, try adding index.html if it was a directory
      res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(`<h1>404 Not Found</h1><p>The path <code>${reqUrl}</code> was not found.</p><p><a href="/">Return to Arena Lobby</a></p>`);
      return;
    }

    if (stats.isDirectory()) {
      filePath = path.join(filePath, 'index.html');
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    fs.readFile(filePath, (readErr, content) => {
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

server.listen(PORT, () => {
  console.log(`\n======================================================`);
  console.log(`  🎮  ARENA.COM Arcade Server is Running!`);
  console.log(`  👉  Local Link: http://localhost:${PORT}`);
  console.log(`======================================================\n`);
  console.log(`Available game routes:`);
  console.log(`  - Arena Hub:     http://localhost:${PORT}/`);
  console.log(`  - Apex Chase:    http://localhost:${PORT}/games/apex/`);
  console.log(`  - Neon Run:      http://localhost:${PORT}/games/neon-run/`);
  console.log(`  - Cyberstrike:   http://localhost:${PORT}/games/cyberstrike/`);
  console.log(`  - Typestorm:     http://localhost:${PORT}/games/typestorm/`);
  console.log(`  - Letters Wind:  http://localhost:${PORT}/games/ghibli-style-delivery-game/`);
  console.log(`  - Time Echo:     http://localhost:${PORT}/games/time-echo/\n`);
  console.log(`  - Afterglow:     http://localhost:${PORT}/games/afterglow/\n`);
});
