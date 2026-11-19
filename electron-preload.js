const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  setFullscreen: (value) =>
    ipcRenderer.invoke('window:set-fullscreen', Boolean(value)),
  getFullscreen: () =>
    ipcRenderer.invoke('window:get-fullscreen')
});
