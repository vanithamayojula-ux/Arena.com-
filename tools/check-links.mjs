/* ============================================================================
 * Deployment link check.
 *
 * Guards the class of bug that made the portal 404 in production: a file the
 * portal links to is either missing, or gitignored (and Vercel excludes
 * gitignored files from the deployment, so the link 404s even though it
 * exists locally).
 *
 * Two things are verified for every game:
 *   1. Its entry file and thumbnail exist on disk.
 *   2. Its entry file is NOT gitignored — i.e. it will actually deploy.
 *      Needs git, so it is skipped (with a warning) outside a repo.
 *
 * Usage: npm run check:links
 * ========================================================================== */

import { readFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function readCatalog() {
  const src = readFileSync(path.join(ROOT, 'games', 'catalog.js'), 'utf8');
  const win = {};
  new Function('window', src)(win);
  return win.ARENA;
}

function isGitIgnored(relPath) {
  try {
    // --no-index is required: a file that is already tracked is not reported
    // as ignored, which would silently hide the bug this check exists to catch
    // (play.html being tracked today, ignored tomorrow).
    execFileSync('git', ['check-ignore', '-q', '--no-index', relPath], { cwd: ROOT, stdio: 'ignore' });
    return true;
  } catch {
    return false; // exit 1 = not ignored
  }
}

// Tracked in git, so it deploys regardless of ignore rules.
function isTracked(relPath) {
  try {
    execFileSync('git', ['ls-files', '--error-unmatch', relPath], { cwd: ROOT, stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function inGitRepo() {
  try {
    execFileSync('git', ['rev-parse', '--is-inside-work-tree'], { cwd: ROOT, stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

const ARENA = readCatalog();
const useGit = inGitRepo();
if (!useGit) console.log('[check-links] Not a git repo — skipping deploy-reachability checks.\n');

let problems = 0;
function fail(msg) {
  problems++;
  console.log('  FAIL  ' + msg);
}

console.log('[check-links] Verifying every URL the portal references exists...\n');

// 1. Files the portal links to directly.
const portalSrc = readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const referenced = new Set(['games/catalog.js']);
for (const m of portalSrc.matchAll(/(?:src|href)="(games\/[^"]+)"/g)) referenced.add(m[1]);
for (const g of ARENA.games) {
  referenced.add(g.entry);
  referenced.add(g.thumb);
  if (g.thumbAlt) referenced.add(g.thumbAlt);
}

for (const ref of [...referenced].sort()) {
  const rel = ref.split('?')[0];
  if (!existsSync(path.join(ROOT, rel))) fail(`missing file: ${rel}`);
}

console.log(`  ${referenced.size} referenced files checked\n`);

// 2. Per-game: entry present, and deployable (not gitignored).
console.log('[check-links] Verifying each game will deploy...\n');
for (const g of ARENA.games) {
  const entry = g.entry.split('?')[0];
  const problemsHere = [];

  if (!existsSync(path.join(ROOT, entry))) problemsHere.push('entry missing on disk');

  // Vercel deploys tracked files, and untracked files only if they are not
  // gitignored. The build produces play.html, which must reach production or
  // the game 404s while still working locally.
  if (useGit && !isTracked(entry) && isGitIgnored(entry)) {
    problemsHere.push(`${entry} is gitignored and untracked, so Vercel will not deploy it`);
  }

  if (problemsHere.length) {
    problemsHere.forEach((p) => fail(`${g.id}: ${p}`));
  } else {
    console.log(`  OK    ${g.id.padEnd(14)} ${entry}`);
  }
}

console.log('');
if (problems) {
  console.error(`[check-links] ${problems} problem(s) found.`);
  process.exit(1);
}
console.log(`[check-links] All checks passed (${ARENA.games.length} games).`);