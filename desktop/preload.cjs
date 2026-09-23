/* eslint-disable @typescript-eslint/no-require-imports */
const { contextBridge, ipcRenderer } = require("electron");
const openFileCallbacks = new Set();
const pendingOpenFiles = [];

ipcRenderer.on("fde:open-file", (_event, value) => {
  const payload = value && typeof value === "object" ? value : {};
  if (openFileCallbacks.size) {
    for (const callback of openFileCallbacks) callback(payload);
    return;
  }
  pendingOpenFiles.push(payload);
  if (pendingOpenFiles.length > 4) pendingOpenFiles.shift();
});

contextBridge.exposeInMainWorld("fdeDesktop", {
  platform: process.platform,
  readClipboardText: () => ipcRenderer.invoke("fde:read-clipboard"),
  openFileDialog: () => ipcRenderer.invoke("fde:open-file-dialog"),
  loadSmartAssets: () => ipcRenderer.invoke("fde:load-smart-assets"),
  saveSmartAssets: assets => ipcRenderer.invoke("fde:save-smart-assets", assets),
  getCredentialStatus: () => ipcRenderer.invoke("fde:credential-status"),
  listCredentials: () => ipcRenderer.invoke("fde:list-credentials"),
  saveCredential: (label, secret) => ipcRenderer.invoke("fde:save-credential", { label, secret }),
  removeCredential: id => ipcRenderer.invoke("fde:remove-credential", id),
  checkForUpdates: () => ipcRenderer.invoke("fde:check-updates"),
  listSkillRoots: () => ipcRenderer.invoke("fde:list-skill-roots"),
  scanSkills: () => ipcRenderer.invoke("fde:scan-skills"),
  addSkillRoot: () => ipcRenderer.invoke("fde:add-skill-root"),
  updateSkillRoot: (id, patch) => ipcRenderer.invoke("fde:update-skill-root", { id, patch }),
  removeSkillRoot: id => ipcRenderer.invoke("fde:remove-skill-root", id),
  openSkillPath: path => ipcRenderer.invoke("fde:open-skill-path", path),
  onSkillsChanged: callback => {
    const listener = (_event, value) => callback(value && typeof value === "object" ? value : {});
    ipcRenderer.on("fde:skills-changed", listener);
    return () => ipcRenderer.removeListener("fde:skills-changed", listener);
  },
  onClipboardInput: callback => {
    const listener = (_event, value) => callback(typeof value === "string" ? value : "");
    ipcRenderer.on("fde:clipboard-input", listener);
    return () => ipcRenderer.removeListener("fde:clipboard-input", listener);
  },
  onOpenFile: callback => {
    openFileCallbacks.add(callback);
    for (const value of pendingOpenFiles.splice(0)) callback(value);
    return () => openFileCallbacks.delete(callback);
  },
  onUpdateProgress: callback => {
    const listener = (_event, value) => callback(value && typeof value === "object" ? value : {});
    ipcRenderer.on("fde:update-progress", listener);
    return () => ipcRenderer.removeListener("fde:update-progress", listener);
  },
  onDeepLink: callback => {
    const listener = (_event, value) => callback(typeof value === "string" ? value : "");
    ipcRenderer.on("fde:deep-link", listener);
    return () => ipcRenderer.removeListener("fde:deep-link", listener);
  },
});
