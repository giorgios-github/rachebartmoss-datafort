#!/usr/bin/env node
/**
 * Bartmoss Datafort — GM hub CLI.
 * Thin wrapper over createHub() (hub/createHub.mjs). The Electron app uses the
 * same createHub directly.
 *
 * Usage: node hub/server.mjs [--port 8787] [--campaign main] [--data <dir>] [--root <dir>]
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHub } from './createHub.mjs';

const _here = path.dirname(fileURLToPath(import.meta.url));
function arg(flag, def) { const i = process.argv.indexOf(flag); return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : def; }

const root = path.resolve(arg('--root', path.join(_here, '..')));
const opts = {
  port: parseInt(arg('--port', '8787'), 10),
  root,
  campaign: arg('--campaign', 'main'),
  dataDir: arg('--data', path.join(root, 'campaign-data')),
};

createHub(opts).then((hub) => {
  console.log('\n  ╔════════════════════════════════════════════╗');
  console.log('  ║   RACHE BARTMOSS — GM HUB (local LAN)       ║');
  console.log('  ╚════════════════════════════════════════════╝\n');
  console.log(`  Campaign: "${hub.campaign}"  ·  loaded ${hub.loaded} sheet(s)`);
  console.log(`  Folder:   ${hub.sheetsDir}\n`);
  console.log('  GM dashboard:');
  console.log(`     http://${hub.primaryHost}:${hub.port}/gm.html?campaign=${hub.campaign}\n`);
  const ls = hub.links();
  if (ls.length) { console.log('  Player sheet links (give each player theirs):'); ls.forEach((l) => console.log(`     ${(l.name).padEnd(20)} ->  ${l.url}`)); }
  else console.log('  No sheets yet. Create one in the dashboard (its link prints here).');
  if (hub.primaryHost === 'localhost') console.log('\n  ! No LAN interface detected — only this machine can connect.');
  console.log('');
});
