/* ============================================================================
 * Builds every game under games/ that has a package.json, then copies each
 * built dist/index.html to <game>/play.html — the file the portal links to.
 *
 * Discovery is automatic: drop a new folder in games/ with a package.json
 * containing a "build" script and it gets built on the next deploy. No edits
 * here or in package.json are needed.
 *
 * Games with no package.json (plain HTML/Canvas/Three.js) are skipped.
 *
 * Usage: node tools/build-games.mjs
 * ========================================================================== */

import { readdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const GAMES_DIR = path.join(ROOT, 'games');

const NPM = process.platform === 'win32' ? 'npm.cmd' : 'npm';

function run(cmd, args, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      cwd,
      stdio: 'inherit',
      shell: process.platform === 'win32',
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${cmd} ${args.join(' ')} exited with code ${code} in ${path.relative(ROOT, cwd)}`));
    });
  });
}

async function main() {
  const entries = await readdir(GAMES_DIR, { withFileTypes: true });
  const buildable = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const pkgPath = path.join(GAMES_DIR, entry.name, 'package.json');
    if (!existsSync(pkgPath)) continue;

    const pkg = JSON.parse(await readFile(pkgPath, 'utf8'));
    if (pkg.scripts && pkg.scripts.build) {
      buildable.push({ name: entry.name, dir: path.join(GAMES_DIR, entry.name) });
    }
  }

  if (buildable.length === 0) {
    console.log('[build-games] No games with a build script found — nothing to do.');
    return;
  }

  console.log(`[build-games] Building ${buildable.length} game(s): ${buildable.map((g) => g.name).join(', ')}`);

  for (const game of buildable) {
    console.log(`\n[build-games] --- ${game.name} ---`);
    await run(NPM, ['run', 'build'], game.dir);

    const built = path.join(game.dir, 'dist', 'index.html');
    if (!existsSync(built)) {
      throw new Error(`${game.name}: build finished but dist/index.html is missing`);
    }

    // The portal links to <game>/play.html, which must live one level above
    // dist/ so the game's own relative asset paths keep working.
    await writeFile(path.join(game.dir, 'play.html'), await readFile(built), 'utf8');
    console.log(`[build-games] ${game.name}: wrote ${path.relative(ROOT, path.join(game.dir, 'play.html'))}`);
  }

  console.log('\n[build-games] All builds complete.');
}

main().catch((err) => {
  console.error('\n[build-games] BUILD FAILED:', err.message);
  process.exit(1);
});