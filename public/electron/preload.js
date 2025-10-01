import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  ping: () => ipcRenderer.invoke('ping'),
  db: {
    init: () => ipcRenderer.invoke('db:init'),
    addCreator: (data) => ipcRenderer.invoke('db:add-creator', data),
    listCreators: () => ipcRenderer.invoke('db:list-creators'),
  },
  scrape: {
    enqueue: (username) => ipcRenderer.invoke('scrape:enqueue', { username }),
    bulk: (usernames) => ipcRenderer.invoke('scrape:bulk', { usernames }),
    onProgress: (handler) => {
      const listener = (_event, payload) => handler(payload);
      ipcRenderer.on('scrape:progress', listener);
      return () => ipcRenderer.off('scrape:progress', listener);
    }
  }
});
