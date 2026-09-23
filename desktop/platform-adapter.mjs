const adapters = {
  win32: {
    id: "windows",
    name: "Windows",
    updateMode: "electron-updater",
    fileOpenEvent: false,
    fileOpenArgs: true,
    globalShortcut: "Control+Shift+K",
  },
  darwin: {
    id: "macos",
    name: "macOS",
    updateMode: "electron-updater",
    fileOpenEvent: true,
    fileOpenArgs: false,
    globalShortcut: "Command+Shift+K",
  },
  linux: {
    id: "linux",
    name: "Linux",
    updateMode: "package-manager",
    fileOpenEvent: false,
    fileOpenArgs: true,
    globalShortcut: "Control+Shift+K",
  },
};

export function getPlatformAdapter(platform = process.platform) {
  return adapters[platform] ?? {
    id: "unsupported",
    name: platform,
    updateMode: "manual",
    fileOpenEvent: false,
    fileOpenArgs: false,
    globalShortcut: "Control+Shift+K",
  };
}
