const { app, BrowserWindow, ipcMain } = require("electron");
const path = require('path');


let mainWindow;

app.whenReady().then(() => {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 720,
    fullscreen: true,
    frame: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    },
  });

  mainWindow.loadFile(path.join(__dirname, 'login', 'index.html'));
});

ipcMain.on('load-user-profile', (event, username) => {
  const userProfilePath = path.join(__dirname, 'users', username, 'index.html');
  mainWindow.loadFile(userProfilePath);
});

ipcMain.on('load-login', () => {
  mainWindow.loadFile(path.join(__dirname, 'login', 'index.html'));
});