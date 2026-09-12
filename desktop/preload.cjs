/* eslint-disable @typescript-eslint/no-require-imports */
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("fdeDesktop", {
  platform: process.platform,
  readClipboardText: () => ipcRenderer.invoke("fde:read-clipboard"),
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
  onDeepLink: callback => {
    const listener = (_event, value) => callback(typeof value === "string" ? value : "");
    ipcRenderer.on("fde:deep-link", listener);
    return () => ipcRenderer.removeListener("fde:deep-link", listener);
  },
});
