const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

let win;

function createWindow() {
  win = new BrowserWindow({
    fullscreen: true,
    width: 1280,
    height: 720,
    minWidth: 960,
    minHeight: 600,
    frame: false,
    resizable: true,
    title: 'Dragon Roll',
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      preload: path.join(__dirname, 'electron-preload.js')
    }
  });

  win.loadFile(path.join(__dirname, 'index.html'));
}

ipcMain.handle('window:set-fullscreen', (event, value) => {
  const target = BrowserWindow.fromWebContents(event.sender);
  if (!target) return false;

  if (value) {
    target.setFullScreen(true);
  } else {
    target.setFullScreen(false);
    target.setSize(1280, 720);
    target.center();
  }

  return target.isFullScreen();
});

ipcMain.handle('window:get-fullscreen', (event) => {
  const target = BrowserWindow.fromWebContents(event.sender);
  return target ? target.isFullScreen() : false;
});

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
