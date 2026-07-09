/**
 * Datafort (Bartmoss GM app) — Electron main process.
 *
 * Starts the local hub (createHub) in-process and opens a window on the GM
 * dashboard served by it. Players connect to http://<lan-ip>:<port>/ on the
 * same Wi-Fi. Campaign sheets are stored as JSON files in a visible folder the
 * GM can open/edit.
 */
const { app, BrowserWindow, Menu, shell, dialog, clipboard, ipcMain } = require('electron');
const path = require('node:path');
const fs = require('node:fs');

// Force the display name early so the macOS menu bar / dock say "Datafort"
// instead of "Electron" in dev (packaged apps already use productName).
app.setName('Datafort');

// Folder picker for the campaign manager: returns text files' { name, content }.
ipcMain.handle('pick-folder-files', async () => {
  const r = await dialog.showOpenDialog(liveWin() || undefined, { properties: ['openDirectory'] });
  if (r.canceled || !r.filePaths[0]) return [];
  const dir = r.filePaths[0];
  const out = [];
  for (const f of fs.readdirSync(dir)) {
    if (!/\.(json|md|txt)$/i.test(f)) continue;
    try { out.push({ name: f, content: fs.readFileSync(path.join(dir, f), 'utf8') }); } catch {}
  }
  return out;
});

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
function lanAppUrl() { return `http://${hub.primaryHost}:${hub.port}/app.html`; }

// Forward a tab/palette shortcut to the focused window's renderer (see preload).
function sendNav(action) { const w = BrowserWindow.getFocusedWindow(); if (w) w.webContents.send('nav-shortcut', action); }

function buildMenu() {
  const template = [
    // Explicit app menu (instead of role:'appMenu') so the macOS menu bar shows
    // "Datafort" even in dev, where role:'appMenu' would inherit the Electron
    // bundle name. Packaged builds would say Datafort either way.
    ...(process.platform === 'darwin' ? [{
      label: 'Datafort',
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'hide' }, { role: 'hideOthers' }, { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' },
      ],
    }] : []),
    {
      label: 'Campaign',
      submenu: [
        { label: 'Reveal campaign folder', click: () => shell.openPath(hub ? hub.sheetsDir : dataDir) },
        {
          label: 'Change campaign folder…',
          click: async () => {
            const r = await dialog.showOpenDialog(liveWin() || undefined, { properties: ['openDirectory', 'createDirectory'] });
            if (!r.canceled && r.filePaths[0]) { dataDir = r.filePaths[0]; await startHub(); if (liveWin()) liveWin().loadURL(appUrl()); else createWindow(); }
          },
        },
        { type: 'separator' },
        { label: 'New player window', click: () => openAppWindow() },
        {
          label: 'Copy player links',
          click: () => {
            const ls = hub ? hub.links() : [];
            clipboard.writeText(ls.length ? ls.map((l) => `${l.name}: ${l.url}`).join('\n') : 'No sheets yet.');
          },
        },
        { label: 'Open the app in a browser', click: () => shell.openExternal(lanAppUrl()) },
        { type: 'separator' },
        { label: 'Restart hub', click: async () => { await startHub(); if (liveWin()) liveWin().loadURL(appUrl()); else createWindow(); } },
      ],
    },
    {
      label: 'Tabs',
      submenu: [
        { label: 'New tab', accelerator: 'CmdOrCtrl+T', click: () => sendNav('newtab') },
        { label: 'Close tab', accelerator: 'CmdOrCtrl+W', click: () => sendNav('closetab') },
        { label: 'Reopen closed tab', accelerator: 'Shift+CmdOrCtrl+T', click: () => sendNav('reopen') },
        { type: 'separator' },
        { label: 'Command palette…', accelerator: 'CmdOrCtrl+K', click: () => sendNav('palette') },
      ],
    },
    { role: 'editMenu' },
    { role: 'viewMenu' },
    // Custom Window menu: the default windowMenu binds ⌘W to "Close window",
    // which we re-map to ⌘⇧W so plain ⌘W closes the active tab instead.
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        { type: 'separator' },
        { label: 'Close window', accelerator: 'Shift+CmdOrCtrl+W', role: 'close' },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// Open an app window on the role chooser. Returns it WITHOUT touching the
// global `win` — used both for the primary window and extra player windows.
function openAppWindow() {
  const w = new BrowserWindow({
    width: 1200, height: 820, minWidth: 720, minHeight: 480,
    title: 'Datafort',
    webPreferences: { contextIsolation: true, nodeIntegration: false, preload: path.join(__dirname, 'preload.js') },
  });
  w.loadURL(appUrl());
  return w;
}
// A live (non-destroyed) reference to the primary window, or null.
function liveWin() { return win && !win.isDestroyed() ? win : null; }

async function createWindow() {
  win = openAppWindow();
  win.on('closed', function () { win = null; });
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) { app.quit(); }
else {
  app.on('second-instance', () => { var w = liveWin(); if (w) { if (w.isMinimized()) w.restore(); w.focus(); } else createWindow(); });

  app.whenReady().then(async () => {
    // In dev (`electron .`) the dock shows Electron's default icon — the
    // build.icon only applies to packaged apps. Set it explicitly so dev looks
    // right. Packaged builds use the bundled .icns (build/ isn't shipped).
    if (process.platform === 'darwin' && !app.isPackaged) {
      try { app.dock.setIcon(path.join(__dirname, 'build', 'icon.png')); } catch {}
    }
    try { fs.mkdirSync(dataDir, { recursive: true }); } catch {}
    await startHub();
    buildMenu();
    await createWindow();
    // Re-clicking the dock icon (macOS) recreates the window. The hub stays
    // alive while the app runs, but guard against it being gone — otherwise the
    // new window loads a dead http://127.0.0.1:<port> and shows blank.
    app.on('activate', async () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        if (!hub) await startHub();
        await createWindow();
      }
    });
  });

  // Keep the hub running when the last window closes on macOS (the app itself
  // stays alive there); only quit on Windows/Linux. The hub is stopped for real
  // on quit.
  app.on('window-all-closed', () => { if (process.platform !== 'darwin') { if (hub) { try { hub.stop(); } catch {} } app.quit(); } });
  app.on('before-quit', () => { if (hub) { try { hub.stop(); } catch {} hub = null; } });
}
