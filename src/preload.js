const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  showNotification: (msg) => ipcRenderer.send('show-notification', msg),
  quitApp: () => ipcRenderer.send('quit-app')
});
