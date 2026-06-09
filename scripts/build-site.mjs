#!/usr/bin/env node
/**
 * Copies the static site (the files the hub serves) into desktop/site/ so the
 * Electron app can embed and serve them on the LAN. Run after `npm run build:sync`
 * (which produces js/sync.bundle.js). Whitelist-based: only ship runtime assets,
 * never dev tooling, node_modules, src, or campaign data.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'desktop', 'site');

// Top-level entries to ship (files + whole dirs).
const INCLUDE = [
  'index.html', 'cs.html', 'npc-sheet.html', 'organisations.html',
  'nightcity.html', 'galmap.html', 'outfit-designer.html', 'gm.html',
  'join.html', 'not_found.html', 'robots.txt',
  'EurostileExtendedBlack.ttf', 'EurostileExtendedBlack.woff2', 'terminal-grotesque.ttf',
  'css', 'js', 'img', 'data', 'pdfs',
];

// Within js/, skip sourcemaps.
function copyFiltered(src, dst) {
  fs.cpSync(src, dst, {
    recursive: true,
    filter: (s) => !s.endsWith('.map') && !s.endsWith('.DS_Store'),
  });
}

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

let copied = 0, missing = [];
for (const entry of INCLUDE) {
  const src = path.join(ROOT, entry);
  if (!fs.existsSync(src)) { missing.push(entry); continue; }
  copyFiltered(src, path.join(OUT, entry));
  copied++;
}

if (!fs.existsSync(path.join(OUT, 'js', 'sync.bundle.js'))) {
  console.error('  ! js/sync.bundle.js missing — run `npm run build:sync` first.');
  process.exit(1);
}
console.log(`  build-site: copied ${copied} entries → ${path.relative(ROOT, OUT)}`);
if (missing.length) console.log('  (skipped missing: ' + missing.join(', ') + ')');
