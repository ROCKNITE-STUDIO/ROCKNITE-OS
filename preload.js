const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
    fetchRemoteVersion: (gameName) => ipcRenderer.invoke('fetch-remote-version', gameName),
    fetchPatchNotes: (gameName) => ipcRenderer.invoke('fetch-patch-notes', gameName),
    loadUserProfile: (username) => ipcRenderer.send('load-user-profile', username),
    loadLogin: () => ipcRenderer.send('load-login')
});