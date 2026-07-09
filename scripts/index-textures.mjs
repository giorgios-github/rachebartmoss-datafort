#!/usr/bin/env node
// Regenerate img/webtextures/index.json by scanning the folder.
// Run after dropping new textures:  node scripts/index-textures.mjs
import { readdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dir = join(root, 'img', 'webtextures');
const OK = /\.(bmp|gif|png|jpe?g|webp)$/i;

const files = readdirSync(dir)
  .filter((f) => OK.test(f) && !f.startsWith('.'))
  .sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));

writeFileSync(join(dir, 'index.json'), JSON.stringify(files, null, 0) + '\n');
console.log(`indexed ${files.length} textures → img/webtextures/index.json`);
