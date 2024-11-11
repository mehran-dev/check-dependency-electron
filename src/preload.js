// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts
// preload.js
const { contextBridge, ipcRenderer } = require("electron");

// Expose only the necessary Electron modules via contextBridge
contextBridge.exposeInMainWorld("electronAPI", {
  runAudit: (projectPath) => ipcRenderer.invoke("run-audit", projectPath),
});
