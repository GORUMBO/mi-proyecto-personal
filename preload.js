const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('windowsApp', Object.freeze({
  platform: process.platform,
  isDesktop: true,
  version: '1.186.0'
}));
