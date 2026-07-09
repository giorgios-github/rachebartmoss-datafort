const { contextBridge, ipcRenderer } = require('electron');

// Minimal, safe bridge for the in-app campaign manager.
contextBridge.exposeInMainWorld('bartmoss', {
  // Opens a native folder picker; returns [{ name, content }] for the JSON/text
  // files inside, so the renderer can POST them into a campaign.
  pickFolderFiles: () => ipcRenderer.invoke('pick-folder-files'),
  // Tab/palette shortcuts routed from the native menu (⌘T/⌘W/⌘⇧T/⌘K), which would
  // otherwise be swallowed by Electron's window accelerators.
  onNavShortcut: (cb) => ipcRenderer.on('nav-shortcut', (_e, action) => cb(action)),
});
