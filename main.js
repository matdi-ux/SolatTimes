// main.js - Electron main process: creates the application window
const { app, BrowserWindow } = require('electron');
const path = require('path');

function createWindow() {
  const win = new BrowserWindow({
    width: 1100, height: 780, minWidth: 900, minHeight: 600,
    title: 'SolatTime',
    webPreferences: { contextIsolation: true, nodeIntegration: false } // secure defaults
  });
  win.setMenuBarVisibility(false);
  win.webContents.on('did-fail-load', (_event, code, description, url) => {
    console.error(`Failed to load ${url} (${code}): ${description}`);
  });
  win.webContents.on('render-process-gone', (_event, details) => {
    console.error('Renderer process exited:', details);
  });
  win.loadFile(path.join(__dirname, 'renderer', 'index.html')).catch(error => {
    console.error('Failed to open the dashboard:', error);
  });
}
app.whenReady().then(createWindow);
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
