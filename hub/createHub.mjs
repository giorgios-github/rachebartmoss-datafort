/**
 * Bartmoss Datafort — GM hub (reusable module).
 *
 * createHub({ port, root, campaign, dataDir }) starts:
 *   1. a static file server for the app (LAN; http origin so plain ws:// is OK),
 *   2. a Yjs relay (same yjs@13 + y-protocols as the browser bundle),
 *   3. campaign persistence as a folder of JSON files (one per sheet).
 *
 * Used by both the CLI (hub/server.mjs) and the Electron app (desktop/main.js).
 * Returns a promise resolving to { port, primaryHost, sheetsDir, dataDir,
 * campaign, links(), stop() }.
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { WebSocketServer } from 'ws';
import * as Y from 'yjs';
import * as syncProtocol from 'y-protocols/sync';
import * as awarenessProtocol from 'y-protocols/awareness';
import * as encoding from 'lib0/encoding';
import * as decoding from 'lib0/decoding';

export function lanAddresses() {
  const out = [];
  const ifaces = os.networkInterfaces();
  for (const name of Object.keys(ifaces)) for (const ni of ifaces[name] || []) if (ni.family === 'IPv4' && !ni.internal) out.push(ni.address);
  return out;
}

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif',
  '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.woff2': 'font/woff2',
  '.woff': 'font/woff', '.ttf': 'font/ttf', '.pdf': 'application/pdf', '.map': 'application/json',
};

export function createHub(opts = {}) {
  const ROOT = path.resolve(opts.root || process.cwd());
  const CAMPAIGN = opts.campaign || 'main';
  const DATA = path.resolve(opts.dataDir || path.join(ROOT, 'campaign-data'));
  // Per-campaign folder: <DATA>/<campaign>/{sheets,npcs,orgs,nightcity,documents}.
  const CAMPAIGN_DIR = path.join(DATA, CAMPAIGN);
  const SHEETS_DIR = path.join(CAMPAIGN_DIR, 'sheets');
  // Migrate the legacy flat layout (<DATA>/sheets) into <DATA>/<campaign>/sheets.
  try {
    const legacy = path.join(DATA, 'sheets');
    if (fs.existsSync(legacy) && !fs.existsSync(SHEETS_DIR)) {
      fs.mkdirSync(CAMPAIGN_DIR, { recursive: true });
      fs.renameSync(legacy, SHEETS_DIR);
    }
  } catch (e) { /* ignore */ }
  const REQ_PORT = Number.isFinite(opts.port) ? opts.port : 8787;
  const log = opts.log || console.log;

  let PRIMARY_HOST = lanAddresses()[0] || 'localhost';
  let PORT = REQ_PORT;
  const playerLink = (id) => `http://${PRIMARY_HOST}:${PORT}/cs.html?campaign=${encodeURIComponent(CAMPAIGN)}&sheet=${encodeURIComponent(id)}`;

  /* ── Yjs relay (rooms) ── */
  const MSG_SYNC = 0, MSG_AWARENESS = 1;
  const rooms = new Map();
  const send = (conn, msg) => { if (conn.readyState !== 0 && conn.readyState !== 1) return; try { conn.send(msg); } catch { conn.close(); } };
  const broadcast = (room, msg) => room.conns.forEach((c) => send(c, msg));

  function getRoom(name) {
    let room = rooms.get(name);
    if (room) return room;
    const doc = new Y.Doc();
    const awareness = new awarenessProtocol.Awareness(doc);
    awareness.setLocalState(null);
    room = { doc, awareness, conns: new Set() };
    doc.on('update', (update) => {
      const enc = encoding.createEncoder();
      encoding.writeVarUint(enc, MSG_SYNC); syncProtocol.writeUpdate(enc, update);
      broadcast(room, encoding.toUint8Array(enc));
    });
    awareness.on('update', ({ added, updated, removed }) => {
      const changed = added.concat(updated, removed);
      const enc = encoding.createEncoder();
      encoding.writeVarUint(enc, MSG_AWARENESS);
      encoding.writeVarUint8Array(enc, awarenessProtocol.encodeAwarenessUpdate(awareness, changed));
      broadcast(room, encoding.toUint8Array(enc));
    });
    rooms.set(name, room);
    return room;
  }

  function onConnection(conn, req) {
    conn.binaryType = 'arraybuffer';
    const name = (req.url || '').slice(1).split('?')[0] || CAMPAIGN;
    const room = getRoom(name);
    room.conns.add(conn);
    conn.controlledIds = new Set();
    const awarenessChange = ({ added, removed }, origin) => {
      if (origin === conn) { added.forEach((id) => conn.controlledIds.add(id)); removed.forEach((id) => conn.controlledIds.delete(id)); }
    };
    room.awareness.on('update', awarenessChange);
    conn.on('message', (data) => {
      try {
        const decoder = decoding.createDecoder(new Uint8Array(data));
        const type = decoding.readVarUint(decoder);
        if (type === MSG_SYNC) {
          const enc = encoding.createEncoder();
          encoding.writeVarUint(enc, MSG_SYNC);
          syncProtocol.readSyncMessage(decoder, enc, room.doc, conn);
          if (encoding.length(enc) > 1) send(conn, encoding.toUint8Array(enc));
        } else if (type === MSG_AWARENESS) {
          awarenessProtocol.applyAwarenessUpdate(room.awareness, decoding.readVarUint8Array(decoder), conn);
        }
      } catch (e) { log('  ! message error:', e.message); }
    });
    conn.on('close', () => {
      room.conns.delete(conn);
      awarenessProtocol.removeAwarenessStates(room.awareness, Array.from(conn.controlledIds), null);
      room.awareness.off('update', awarenessChange);
    });
    const enc1 = encoding.createEncoder();
    encoding.writeVarUint(enc1, MSG_SYNC); syncProtocol.writeSyncStep1(enc1, room.doc);
    send(conn, encoding.toUint8Array(enc1));
    const states = room.awareness.getStates();
    if (states.size > 0) {
      const enc2 = encoding.createEncoder();
      encoding.writeVarUint(enc2, MSG_AWARENESS);
      encoding.writeVarUint8Array(enc2, awarenessProtocol.encodeAwarenessUpdate(room.awareness, Array.from(states.keys())));
      send(conn, encoding.toUint8Array(enc2));
    }
  }

  /* ── Campaign folder persistence (+ legacy junk guard) ── */
  const _warnedJunk = new Set();
  const isJunkId = (id) => /^nc-/.test(String(id || ''));
  function loadSheetsInto(sheetsMap, doc) {
    let loaded = 0;
    for (const f of fs.existsSync(SHEETS_DIR) ? fs.readdirSync(SHEETS_DIR) : []) {
      if (!f.endsWith('.json')) continue;
      const base = f.replace(/\.json$/, '');
      if (isJunkId(base)) { try { fs.unlinkSync(path.join(SHEETS_DIR, f)); log('  - removed legacy junk file', f); } catch {} continue; }
      try {
        const raw = JSON.parse(fs.readFileSync(path.join(SHEETS_DIR, f), 'utf8'));
        let rec;
        if (raw && raw.id && raw.json) rec = { id: base, ownerId: raw.ownerId ?? null, name: raw.name || base, updatedAt: raw.updatedAt || Date.now(), json: raw.json };
        else { raw._id = base; rec = { id: base, ownerId: null, name: raw.handle || raw.name || base, updatedAt: Date.now(), json: raw }; }
        doc.transact(() => sheetsMap.set(rec.id, rec));
        loaded++;
      } catch (e) { log('  ! skipped', f, '-', e.message); }
    }
    return loaded;
  }
  const _writeTimers = new Map();
  function scheduleWrite(id, rec) {
    if (isJunkId(id)) { if (!_warnedJunk.has(id)) { _warnedJunk.add(id); log('  ! ignoring legacy id "' + id + '" pushed by a stale client — reload/close old browser tabs.'); } return; }
    clearTimeout(_writeTimers.get(id));
    _writeTimers.set(id, setTimeout(() => {
      try { fs.writeFileSync(path.join(SHEETS_DIR, id + '.json'), JSON.stringify((rec && rec.json) || {}, null, 2)); log('  · saved', (rec && rec.name) || id); }
      catch (e) { log('  ! write failed', id, '-', e.message); }
    }, 400));
  }
  const _knownIds = new Set();
  function bindCampaignFolder() {
    fs.mkdirSync(SHEETS_DIR, { recursive: true });
    const room = getRoom(CAMPAIGN);
    const sheets = room.doc.getMap('sheets');
    const n = loadSheetsInto(sheets, room.doc);
    sheets.forEach((_rec, id) => _knownIds.add(id));
    sheets.observeDeep(() => {
      sheets.forEach((rec, id) => {
        if (!rec || !id) return;
        scheduleWrite(id, rec);
        if (!_knownIds.has(id)) { _knownIds.add(id); log(`  + new sheet "${rec.name || id}"  ->  ${playerLink(id)}`); }
      });
    });
    return n;
  }

  /* ── Campaign JSON API (file-backed, used by the in-app campaign manager) ── */
  const DOC_TYPES = ['sheets', 'npcs', 'orgs', 'nightcity', 'documents'];
  const slug = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'campaign';
  const safeName = (n) => path.basename(String(n || '')).replace(/[^\w. -]+/g, '_');
  const campDir = (id) => path.join(DATA, safeName(id));
  function jsonRes(res, code, obj) { res.writeHead(code, { 'content-type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(obj)); }
  function readBody(req) { return new Promise((resolve) => { let b = ''; req.on('data', (c) => { b += c; if (b.length > 60 * 1024 * 1024) req.destroy(); }); req.on('end', () => resolve(b)); req.on('error', () => resolve('')); }); }
  function listType(id, type) {
    const dir = path.join(campDir(id), type);
    if (!fs.existsSync(dir)) return [];
    return fs.readdirSync(dir).filter((f) => !f.startsWith('.')).map((f) => { const st = fs.statSync(path.join(dir, f)); return { name: f, size: st.size, mtime: st.mtimeMs }; });
  }
  function listCampaigns() {
    if (!fs.existsSync(DATA)) return [];
    return fs.readdirSync(DATA).filter((d) => { try { return fs.statSync(path.join(DATA, d)).isDirectory(); } catch { return false; } })
      .map((id) => { let meta = {}; try { meta = JSON.parse(fs.readFileSync(path.join(DATA, id, 'meta.json'), 'utf8')); } catch {} return { id, name: meta.name || id, sheets: listType(id, 'sheets').length }; });
  }
  function ensureCampaign(id, name) {
    const dir = campDir(id);
    DOC_TYPES.forEach((t) => fs.mkdirSync(path.join(dir, t), { recursive: true }));
    const mp = path.join(dir, 'meta.json');
    if (!fs.existsSync(mp)) fs.writeFileSync(mp, JSON.stringify({ id, name: name || id, createdAt: Date.now() }, null, 2));
  }
  async function apiHandler(req, res, urlPath) {
    const parts = urlPath.replace(/^\/__api\//, '').split('/').filter(Boolean).map(decodeURIComponent);
    const m = req.method;
    // /campaigns
    if (parts.length === 1 && parts[0] === 'campaigns') {
      if (m === 'GET') return jsonRes(res, 200, { campaigns: listCampaigns() });
      if (m === 'POST') { const body = await readBody(req); let name = ''; try { name = (JSON.parse(body || '{}').name || '').trim(); } catch {} if (!name) return jsonRes(res, 400, { error: 'name required' }); let id = slug(name), n = 2; while (fs.existsSync(campDir(id))) id = slug(name) + '-' + n++; ensureCampaign(id, name); return jsonRes(res, 200, { id, name }); }
      return jsonRes(res, 405, { error: 'method' });
    }
    if (parts[0] === 'campaigns' && parts[1]) {
      const id = parts[1];
      if (!fs.existsSync(campDir(id)) && m !== 'PUT') { /* allow PUT to create */ }
      // /campaigns/:id
      if (parts.length === 2) {
        if (m === 'GET') { let meta = {}; try { meta = JSON.parse(fs.readFileSync(path.join(campDir(id), 'meta.json'), 'utf8')); } catch {} const docs = {}; DOC_TYPES.forEach((t) => docs[t] = listType(id, t)); return jsonRes(res, 200, { id, meta, docs }); }
        if (m === 'DELETE') { try { fs.rmSync(campDir(id), { recursive: true, force: true }); } catch {} return jsonRes(res, 200, { ok: true }); }
        if (m === 'PUT') { const body = await readBody(req); let meta = {}; try { meta = JSON.parse(body || '{}'); } catch {} ensureCampaign(id, meta.name); fs.writeFileSync(path.join(campDir(id), 'meta.json'), JSON.stringify(Object.assign({ id }, meta), null, 2)); return jsonRes(res, 200, { ok: true }); }
        return jsonRes(res, 405, { error: 'method' });
      }
      const type = parts[2];
      if (DOC_TYPES.indexOf(type) < 0) return jsonRes(res, 400, { error: 'bad type' });
      const typeDir = path.join(campDir(id), type);
      // /campaigns/:id/:type
      if (parts.length === 3) {
        if (m === 'GET') return jsonRes(res, 200, { items: listType(id, type) });
        if (m === 'POST') { const body = await readBody(req); let payload; try { payload = JSON.parse(body || '{}'); } catch { return jsonRes(res, 400, { error: 'bad json' }); } var nm = safeName(payload.name || ((payload.json && (payload.json.handle || payload.json.name)) || 'item') + '.json'); if (!/\.[a-z0-9]+$/i.test(nm)) nm += '.json'; fs.mkdirSync(typeDir, { recursive: true }); var content = typeof payload.content === 'string' ? payload.content : JSON.stringify(payload.json != null ? payload.json : {}, null, 2); fs.writeFileSync(path.join(typeDir, nm), content); return jsonRes(res, 200, { name: nm }); }
        return jsonRes(res, 405, { error: 'method' });
      }
      // /campaigns/:id/:type/:name
      if (parts.length === 4) {
        const nm = safeName(parts[3]); const fp = path.join(typeDir, nm);
        if (!fp.startsWith(typeDir)) return jsonRes(res, 403, { error: 'path' });
        if (m === 'GET') { if (!fs.existsSync(fp)) return jsonRes(res, 404, { error: 'not found' }); res.writeHead(200, { 'content-type': nm.endsWith('.json') ? 'application/json; charset=utf-8' : 'text/plain; charset=utf-8' }); res.end(fs.readFileSync(fp)); return; }
        if (m === 'PUT') { const body = await readBody(req); fs.mkdirSync(typeDir, { recursive: true }); fs.writeFileSync(fp, body); return jsonRes(res, 200, { ok: true, name: nm }); }
        if (m === 'DELETE') { try { fs.unlinkSync(fp); } catch {} return jsonRes(res, 200, { ok: true }); }
        return jsonRes(res, 405, { error: 'method' });
      }
    }
    return jsonRes(res, 404, { error: 'no route' });
  }

  /* ── HTTP static server ── */
  const server = http.createServer((req, res) => {
    try {
      const urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
      if (urlPath === '/__hubinfo') {
        res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ host: PRIMARY_HOST, port: PORT, campaign: CAMPAIGN }));
        return;
      }
      if (urlPath.startsWith('/__api/')) { apiHandler(req, res, urlPath).catch(() => { try { res.writeHead(500); res.end('api error'); } catch {} }); return; }
      const rel = urlPath === '/' ? 'index.html' : urlPath.replace(/^\/+/, '');
      const filePath = path.join(ROOT, rel);
      if (!filePath.startsWith(ROOT)) { res.writeHead(403); res.end('forbidden'); return; }
      fs.stat(filePath, (err, st) => {
        if (err || !st.isFile()) { res.writeHead(404); res.end('not found'); return; }
        const ext = path.extname(filePath).toLowerCase();
        const headers = { 'content-type': MIME[ext] || 'application/octet-stream' };
        if (ext === '.js' || ext === '.html') headers['cache-control'] = 'no-store, must-revalidate';
        res.writeHead(200, headers);
        fs.createReadStream(filePath).pipe(res);
      });
    } catch { res.writeHead(500); res.end('error'); }
  });
  const wss = new WebSocketServer({ noServer: true });
  wss.on('connection', onConnection);
  server.on('upgrade', (req, socket, head) => { wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req)); });

  function links() {
    const sheets = getRoom(CAMPAIGN).doc.getMap('sheets');
    const out = [];
    sheets.forEach((rec, id) => { if (!isJunkId(id)) out.push({ id, name: rec.name || id, url: playerLink(id) }); });
    return out;
  }
  function stop() { try { wss.close(); } catch {} try { server.close(); } catch {} }

  // Listen, with one fallback to an ephemeral port if the requested one is taken.
  return new Promise((resolve) => {
    let triedFallback = false;
    server.on('error', (e) => {
      if (e && e.code === 'EADDRINUSE' && !triedFallback) {
        triedFallback = true; log(`  ! port ${PORT} busy, picking a free one…`);
        server.listen(0, '0.0.0.0');
      } else { throw e; }
    });
    server.on('listening', () => {
      PORT = server.address().port;
      const loaded = bindCampaignFolder();
      resolve({ port: PORT, primaryHost: PRIMARY_HOST, sheetsDir: SHEETS_DIR, dataDir: DATA, campaign: CAMPAIGN, loaded, links, stop, server });
    });
    server.listen(REQ_PORT, '0.0.0.0');
  });
}
