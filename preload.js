const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    updateShortcuts: (config) => ipcRenderer.send('update-shortcuts', config),
    getShortcuts: () => ipcRenderer.invoke('get-shortcuts'),
    closeOverlay: () => ipcRenderer.send('close-overlay')
});
