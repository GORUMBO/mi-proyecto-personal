const { app, BrowserWindow, shell, dialog } = require('electron');
const path = require('path');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 900,
    minHeight: 620,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#f0f4f1',
    icon: path.join(__dirname, 'assets', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: true
    }
  });

  mainWindow.loadFile('index.html');
  mainWindow.once('ready-to-show', () => mainWindow.show());

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (url !== mainWindow.webContents.getURL() && /^https?:\/\//i.test(url)) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });
}

// v1.187.4: UNA sola instancia. Si se abre otro lanzador mientras la app ya corre,
// la segunda instancia enfoca la ventana existente y se cierra. Así se evita la
// "app vacía" causada por el bloqueo del perfil de datos de Chromium (leveldb LOCK).
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    createWindow();
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

process.on('uncaughtException', (error) => {
  dialog.showErrorBox('Mi Proyecto Personal', `Ocurrió un error inesperado:\n${error.message}`);
});
