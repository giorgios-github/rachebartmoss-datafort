/**
 * Bartmoss GM Hub — Electron main process.
 *
 * Starts the local hub (createHub) in-process and opens a window on the GM
 * dashboard served by it. Players connect to http://<lan-ip>:<port>/ on the
 * same Wi-Fi. Campaign sheets are stored as JSON files in a visible folder the
 * GM can open/edit.
 */
const { app, BrowserWindow, Menu, shell, dialog, clipboard } = require('electron');
const path = require('node:path');
const fs = require('node:fs');

// createHub is bundled (with its deps) into hub.bundle.cjs by `npm run build:hub`.
const { createHub } = require('./hub.bundle.cjs');

const CAMPAIGN = 'main';
const DEFAULT_PORT = 8787;

let win = null;
let hub = null;
let dataDir = defaultDataDir();

function defaultDataDir() {
  // Visible, user-editable folder (not the hidden app-data dir).
  return path.join(app.getPath('documents'), 'Bartmoss Campaigns');
}
function siteRoot() {
  // Dev: serve the repo root. Packaged: the embedded site copied by build-site.
  return app.isPackaged ? path.join(process.resourcesPath, 'site') : path.join(__dirname, '..');
}

async function startHub() {
  if (hub) { try { hub.stop(); } catch {} hub = null; }
  hub = await createHub({ port: DEFAULT_PORT, root: siteRoot(), campaign: CAMPAIGN, dataDir });
  return hub;
}

// The app opens on the role chooser (app.html); GM/Player routes from there.
function appUrl() { return `http://127.0.0.1:${hub.port}/app.html`; }
function dashboardUrl() { return `http://127.0.0.1:${hub.port}/gm.html?campaign=${CAMPAIGN}`; }
function lanDashboardUrl() { return `http://${hub.primaryHost}:${hub.port}/gm.html?campaign=${CAMPAIGN}`; }

function buildMenu() {
  const template = [
    ...(process.platform === 'darwin' ? [{ role: 'appMenu' }] : []),
    {
      label: 'Campaign',
      submenu: [
        { label: 'Reveal campaign folder', click: () => shell.openPath(hub ? hub.sheetsDir : dataDir) },
        {
          label: 'Change campaign folder…',
          click: async () => {
            const r = await dialog.showOpenDialog(win, { properties: ['openDirectory', 'createDirectory'] });
            if (!r.canceled && r.filePaths[0]) { dataDir = r.filePaths[0]; await startHub(); win.loadURL(dashboardUrl()); }
          },
        },
        { type: 'separator' },
        {
          label: 'Copy player links',
          click: () => {
            const ls = hub ? hub.links() : [];
            clipboard.writeText(ls.length ? ls.map((l) => `${l.name}: ${l.url}`).join('\n') : 'No sheets yet.');
          },
        },
        { label: 'Open dashboard in browser', click: () => shell.openExternal(lanDashboardUrl()) },
        { type: 'separator' },
        { label: 'Restart hub', click: async () => { await startHub(); win.loadURL(dashboardUrl()); } },
      ],
    },
    { role: 'editMenu' },
    { role: 'viewMenu' },
    { role: 'windowMenu' },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

async function createWindow() {
  win = new BrowserWindow({
    width: 1200, height: 820, minWidth: 720, minHeight: 480,
    title: 'Bartmoss Datafort',
    webPreferences: { contextIsolation: true, nodeIntegration: false },
  });
  await win.loadURL(appUrl());
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) { app.quit(); }
else {
  app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });

  app.whenReady().then(async () => {
    try { fs.mkdirSync(dataDir, { recursive: true }); } catch {}
    await startHub();
    buildMenu();
    await createWindow();
    app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
  });

  app.on('window-all-closed', () => { if (hub) try { hub.stop(); } catch {}; if (process.platform !== 'darwin') app.quit(); });
}
