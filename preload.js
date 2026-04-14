const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    updateShortcuts: (config) => ipcRenderer.send('update-shortcuts', config),
    getShortcuts: () => ipcRenderer.invoke('get-shortcuts'),
    closeOverlay: () => ipcRenderer.send('close-overlay'),
    setLocked: (state) => ipcRenderer.send('set-locked', state),
    suspendShortcuts: () => ipcRenderer.send('suspend-shortcuts'),
    resumeShortcuts: () => ipcRenderer.send('resume-shortcuts'),
    etaEvalTick: (payload) => ipcRenderer.send('eta-eval:tick', payload),
    etaEvalEvent: (payload) => ipcRenderer.send('eta-eval:event', payload),
    etaEvalTripSummary: (payload) => ipcRenderer.send('eta-eval:trip-summary', payload),
    getEtaEvalSession: () => ipcRenderer.invoke('eta-eval:get-session')
});
