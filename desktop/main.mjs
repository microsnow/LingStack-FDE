import { app, BrowserWindow, Menu, Tray, clipboard, dialog, globalShortcut, ipcMain, nativeImage, protocol, shell } from "electron";
import updater from "electron-updater";
import { readFile, stat } from "node:fs/promises";
import { basename, extname, isAbsolute, join, normalize, relative, resolve } from "node:path";
import { loadSmartAssets, saveSmartAssets } from "./asset-store.mjs";
import { getCredentialStorageStatus, listCredentials, removeCredential, saveCredential } from "./credential-store.mjs";
import { getPlatformAdapter } from "./platform-adapter.mjs";
import { scanSkillRoots } from "./skill-scanner.mjs";
import { addSkillRoot, listSkillRoots, removeSkillRoot, updateSkillRoot } from "./skill-roots.mjs";
import { watchSkillRoots } from "./skill-watcher.mjs";

const DEV_SERVER_URL = process.env.FDE_DEV_SERVER_URL;
const BASIC_SMOKE_TEST = process.argv.includes("--smoke-test");
const SKILLS_SMOKE_TEST = process.argv.includes("--skills-smoke-test");
const SMOKE_TEST = BASIC_SMOKE_TEST || SKILLS_SMOKE_TEST;
const APP_PROTOCOL = "fde-app";
const PLATFORM = getPlatformAdapter(process.platform);
const { autoUpdater } = updater;
const MAX_OPEN_FILE_BYTES = 5 * 1024 * 1024;
const OPEN_FILE_EXTENSIONS = [".txt", ".json", ".md", ".csv", ".xml", ".yaml", ".yml", ".html", ".css", ".js", ".properties"];
const MIME_TYPES = {
  ".css": "text/css",
  ".html": "text/html",
  ".js": "text/javascript",
  ".json": "application/json",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".woff2": "font/woff2",
};

let mainWindow;
let tray;
let isQuitting = false;
let skillWatcherSession;
let rendererReady = false;
let updateCheckRunning = false;
const pendingOpenFiles = [];
const openingPaths = new Set();

function assertTrustedSender(event) {
  if (event.sender !== mainWindow?.webContents) throw new Error("Untrusted IPC sender");
}

function rootLocations() {
  return { home: app.getPath("home"), userData: app.getPath("userData") };
}

function stopSkillWatchers() {
  skillWatcherSession?.close();
  skillWatcherSession = undefined;
}

async function refreshSkillWatchers() {
  stopSkillWatchers();
  const { home, userData } = rootLocations();
  skillWatcherSession = watchSkillRoots(await listSkillRoots(home, userData), event => mainWindow?.webContents.send("fde:skills-changed", event));
}

async function openManagedSkillPath(targetPath) {
  if (typeof targetPath !== "string") throw new Error("无效的 Skills 路径");
  const { home, userData } = rootLocations();
  const target = normalize(targetPath);
  const roots = await listSkillRoots(home, userData);
  const allowed = roots.some(root => {
    const child = relative(normalize(root.path), target);
    return child === "" || (!child.startsWith("..") && !isAbsolute(child));
  });
  if (!allowed) throw new Error("只能打开已加入索引的 Skills 路径");
  const message = await shell.openPath(target);
  if (message) throw new Error(message);
}

protocol.registerSchemesAsPrivileged([
  { scheme: APP_PROTOCOL, privileges: { standard: true, secure: true, supportFetchAPI: true } },
]);

const hasLock = app.requestSingleInstanceLock();
if (!hasLock) app.quit();

function showWindow() {
  if (!mainWindow) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
}

function sendToRenderer(channel, value) {
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send(channel, value);
}

function flushPendingOpenFiles() {
  if (!rendererReady) return;
  for (const payload of pendingOpenFiles.splice(0)) sendToRenderer("fde:open-file", payload);
}

function queueOpenFile(filePath) {
  if (typeof filePath !== "string" || !filePath || openingPaths.has(filePath)) return;
  openingPaths.add(filePath);
  void (async () => {
    try {
      const absolutePath = resolve(filePath);
      if (!OPEN_FILE_EXTENSIONS.includes(extname(absolutePath).toLocaleLowerCase()))
        throw new Error("暂不支持此文件类型");
      const metadata = await stat(absolutePath);
      if (!metadata.isFile()) throw new Error("选择的路径不是文件");
      if (metadata.size > MAX_OPEN_FILE_BYTES) throw new Error("文件不能超过 5 MB");
      const text = await readFile(absolutePath, "utf8");
      const payload = { name: basename(absolutePath), text };
      if (rendererReady) sendToRenderer("fde:open-file", payload);
      else pendingOpenFiles.push(payload);
      showWindow();
    } catch (error) {
      const payload = { name: basename(filePath), error: error instanceof Error ? error.message : "文件读取失败" };
      if (rendererReady) sendToRenderer("fde:open-file", payload);
      else pendingOpenFiles.push(payload);
      showWindow();
    } finally {
      openingPaths.delete(filePath);
    }
  })();
}

function findOpenFileArgument(values) {
  return values.find(value => typeof value === "string" && !value.startsWith("-") && OPEN_FILE_EXTENSIONS.includes(extname(value).toLocaleLowerCase()));
}

async function openFileDialog() {
  const selection = await dialog.showOpenDialog(mainWindow, {
    title: "打开文件到 DevKit",
    properties: ["openFile"],
    filters: [{ name: "文本与数据文件", extensions: OPEN_FILE_EXTENSIONS.map(value => value.slice(1)) }],
  });
  if (!selection.canceled && selection.filePaths[0]) queueOpenFile(selection.filePaths[0]);
}

function sendUpdateProgress(value) {
  sendToRenderer("fde:update-progress", value);
}

async function checkForUpdates() {
  if (!app.isPackaged) return { status: "development", message: "请在已安装的桌面客户端中检查更新。" };
  if (process.env.PORTABLE_EXECUTABLE_DIR)
    return { status: "portable", message: "便携版暂不支持应用内更新，请从 GitHub Releases 下载最新版。" };
  if (PLATFORM.updateMode !== "electron-updater")
    return { status: "package-manager", message: "Linux 更新由系统包管理器或新版本安装包提供。" };
  if (updateCheckRunning) return { status: "busy", message: "正在检查或下载更新。" };

  updateCheckRunning = true;
  try {
    const result = await autoUpdater.checkForUpdates();
    if (!result) return { status: "unavailable", message: "更新服务当前不可用。" };
    if (!result.isUpdateAvailable)
      return { status: "current", version: app.getVersion(), message: `当前已是最新版本（${app.getVersion()}）。` };

    const version = result.updateInfo.version;
    const downloadChoice = await dialog.showMessageBox(mainWindow, {
      type: "info",
      title: "发现灵栈 FDE 更新",
      message: `发现新版本 ${version}。是否下载并安装？`,
      detail: result.updateInfo.releaseNotes?.toString().slice(0, 2000) ?? "更新包将从灵栈 FDE 的 GitHub Releases 下载。",
      buttons: ["下载并安装", "稍后"],
      defaultId: 0,
      cancelId: 1,
      noLink: true,
    });
    if (downloadChoice.response !== 0) return { status: "available", version, message: `发现新版本 ${version}，稍后可再次检查。` };

    sendUpdateProgress({ status: "downloading", version, percent: 0 });
    await autoUpdater.downloadUpdate();
    const installChoice = await dialog.showMessageBox(mainWindow, {
      type: "info",
      title: "更新已下载",
      message: `灵栈 FDE ${version} 已下载完成。`,
      detail: "安装时应用将关闭并重新启动。",
      buttons: ["立即安装", "下次退出时安装"],
      defaultId: 0,
      cancelId: 1,
      noLink: true,
    });
    if (installChoice.response === 0) {
      isQuitting = true;
      autoUpdater.quitAndInstall(false, true);
      return { status: "installing", version, message: "正在退出并安装更新。" };
    }
    return { status: "downloaded", version, message: "更新已下载，将在下次退出时安装。" };
  } catch (error) {
    if (error?.code === "ERR_UPDATER_NO_PUBLISHED_VERSIONS")
      return { status: "no-release", message: "GitHub Releases 尚无可用安装包；发布首个版本后即可检查更新。" };
    const message = error instanceof Error ? error.message : "更新检查失败";
    sendUpdateProgress({ status: "error", message });
    return { status: "error", message: `更新失败：${message}` };
  } finally {
    updateCheckRunning = false;
  }
}

function sendClipboardToWorkspace() {
  showWindow();
  mainWindow?.webContents.send("fde:clipboard-input", clipboard.readText());
}

function createWindow() {
  const windowIcon = join(app.getAppPath(), "public", "icon.png");
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 960,
    minHeight: 640,
    show: false,
    backgroundColor: "#071019",
    title: "灵栈 FDE · 开发者工作台",
    icon: windowIcon,
    webPreferences: {
      preload: join(import.meta.dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  if (!SMOKE_TEST) mainWindow.once("ready-to-show", () => mainWindow?.show());
  mainWindow.webContents.on("did-start-loading", () => { rendererReady = false; });
  mainWindow.webContents.on("did-finish-load", () => {
    rendererReady = true;
    flushPendingOpenFiles();
  });
  if (SMOKE_TEST) mainWindow.webContents.once("did-finish-load", async () => {
    const locations = rootLocations();
    const skills = SKILLS_SMOKE_TEST ? await scanSkillRoots(await listSkillRoots(locations.home, locations.userData)) : undefined;
    console.log(JSON.stringify({ ok: true, title: mainWindow?.getTitle(), url: mainWindow?.webContents.getURL(), skills: skills?.summary }));
    app.exit(0);
  });
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  mainWindow.on("close", event => {
    if (isQuitting || SMOKE_TEST) return;
    event.preventDefault();
    mainWindow?.hide();
  });
  mainWindow.webContents.on("will-navigate", (event, url) => {
    const allowed = DEV_SERVER_URL ? url.startsWith(DEV_SERVER_URL) : url.startsWith(`${APP_PROTOCOL}://app/`);
    if (!allowed) event.preventDefault();
  });

  if (DEV_SERVER_URL) void mainWindow.loadURL(DEV_SERVER_URL);
  else void mainWindow.loadURL(`${APP_PROTOCOL}://app/index.html`);
}

function createTray() {
  const iconPath = join(app.getAppPath(), "public", "icon.png");
  const icon = nativeImage.createFromPath(iconPath);
  tray = new Tray(icon.resize({ width: 16, height: 16 }));
  tray.setToolTip("灵栈 FDE · 开发者工作台");
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: "打开灵栈 FDE", click: showWindow },
    { label: "打开文件到 DevKit…", click: () => void openFileDialog() },
    { label: "处理剪贴板", click: sendClipboardToWorkspace },
    { type: "separator" },
    { label: "退出", click: () => app.quit() },
  ]));
  tray.on("double-click", showWindow);
}

function registerLocalProtocol() {
  protocol.handle(APP_PROTOCOL, async request => {
    const url = new URL(request.url);
    const requestedPath = decodeURIComponent(url.pathname).replace(/^\/+/, "") || "index.html";
    const distRoot = normalize(join(app.getAppPath(), "dist"));
    const filePath = normalize(join(distRoot, requestedPath));
    const relativePath = relative(distRoot, filePath);
    if (relativePath.startsWith("..") || isAbsolute(relativePath)) return new Response("Not found", { status: 404 });

    try {
      const data = await readFile(filePath);
      const contentType = MIME_TYPES[extname(filePath)] ?? "application/octet-stream";
      return new Response(data, { status: 200, headers: { "content-type": contentType } });
    } catch {
      return new Response("Not found", { status: 404 });
    }
  });
}

app.on("second-instance", (_event, commandLine) => {
  showWindow();
  const deepLink = commandLine.find(value => value.startsWith("fde://"));
  if (deepLink) mainWindow?.webContents.send("fde:deep-link", deepLink);
  const filePath = findOpenFileArgument(commandLine.slice(1));
  if (filePath) queueOpenFile(filePath);
});

if (PLATFORM.fileOpenEvent) {
  app.on("open-file", (event, filePath) => {
    event.preventDefault();
    queueOpenFile(filePath);
  });
}

app.on("open-url", (event, url) => {
  event.preventDefault();
  showWindow();
  mainWindow?.webContents.send("fde:deep-link", url);
});

app.whenReady().then(() => {
  app.setAppUserModelId("dev.fde.workbench");
  registerLocalProtocol();
  createWindow();
  if (!SMOKE_TEST) {
    createTray();
    globalShortcut.register(PLATFORM.globalShortcut, showWindow);
    autoUpdater.autoDownload = false;
    autoUpdater.on("download-progress", progress => sendUpdateProgress({ status: "downloading", percent: Math.round(progress.percent), transferred: progress.transferred, total: progress.total }));
    autoUpdater.on("error", error => sendUpdateProgress({ status: "error", message: error.message }));
    const fileMenu = [
      { label: "打开文件到 DevKit…", accelerator: process.platform === "darwin" ? "Command+O" : "Ctrl+O", click: () => void openFileDialog() },
      { type: "separator" },
      { role: "quit", label: "退出" },
    ];
    const menuTemplate = [
      ...(process.platform === "darwin" ? [{ label: "灵栈 FDE", submenu: [{ role: "about" }, { type: "separator" }, { role: "hide" }, { role: "quit" }] }] : []),
      { label: "文件", submenu: fileMenu },
      { label: "帮助", submenu: [{ label: "检查更新…", click: () => void checkForUpdates() }] },
    ];
    Menu.setApplicationMenu(Menu.buildFromTemplate(menuTemplate));
  }

  if (PLATFORM.fileOpenArgs) {
    const filePath = findOpenFileArgument(process.argv.slice(1));
    if (filePath) queueOpenFile(filePath);
  }

  ipcMain.handle("fde:read-clipboard", event => {
    assertTrustedSender(event);
    return clipboard.readText();
  });
  ipcMain.handle("fde:open-file-dialog", async event => {
    assertTrustedSender(event);
    await openFileDialog();
  });
  ipcMain.handle("fde:load-smart-assets", event => {
    assertTrustedSender(event);
    return loadSmartAssets(app.getPath("userData"));
  });
  ipcMain.handle("fde:save-smart-assets", async (event, assets) => {
    assertTrustedSender(event);
    await saveSmartAssets(app.getPath("userData"), assets);
  });
  ipcMain.handle("fde:credential-status", event => {
    assertTrustedSender(event);
    return getCredentialStorageStatus(process.platform);
  });
  ipcMain.handle("fde:list-credentials", event => {
    assertTrustedSender(event);
    return listCredentials(app.getPath("userData"));
  });
  ipcMain.handle("fde:save-credential", async (event, value) => {
    assertTrustedSender(event);
    if (!value || typeof value.label !== "string" || typeof value.secret !== "string") throw new Error("凭据信息无效");
    return saveCredential(app.getPath("userData"), value.label, value.secret, process.platform);
  });
  ipcMain.handle("fde:remove-credential", async (event, id) => {
    assertTrustedSender(event);
    await removeCredential(app.getPath("userData"), id);
  });
  ipcMain.handle("fde:check-updates", event => {
    assertTrustedSender(event);
    return checkForUpdates();
  });
  ipcMain.handle("fde:list-skill-roots", async event => {
    assertTrustedSender(event);
    const { home, userData } = rootLocations();
    return listSkillRoots(home, userData);
  });
  ipcMain.handle("fde:scan-skills", async event => {
    assertTrustedSender(event);
    const { home, userData } = rootLocations();
    return scanSkillRoots(await listSkillRoots(home, userData));
  });
  ipcMain.handle("fde:add-skill-root", async event => {
    assertTrustedSender(event);
    const selection = await dialog.showOpenDialog(mainWindow, { title: "添加 Skills 目录", properties: ["openDirectory"] });
    if (selection.canceled || !selection.filePaths[0]) return null;
    const { home, userData } = rootLocations();
    const added = await addSkillRoot(home, userData, selection.filePaths[0]);
    await refreshSkillWatchers();
    return added;
  });
  ipcMain.handle("fde:update-skill-root", async (event, value) => {
    assertTrustedSender(event);
    if (!value || typeof value.id !== "string" || !value.patch || typeof value.patch !== "object") throw new Error("无效的目录配置");
    const { home, userData } = rootLocations();
    const updated = await updateSkillRoot(home, userData, value.id, value.patch);
    await refreshSkillWatchers();
    return updated;
  });
  ipcMain.handle("fde:remove-skill-root", async (event, id) => {
    assertTrustedSender(event);
    if (typeof id !== "string") throw new Error("无效的目录配置");
    await removeSkillRoot(app.getPath("userData"), id);
    await refreshSkillWatchers();
  });
  ipcMain.handle("fde:open-skill-path", async (event, path) => {
    assertTrustedSender(event);
    await openManagedSkillPath(path);
  });

  void refreshSkillWatchers();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
    else showWindow();
  });
});

app.on("before-quit", () => { isQuitting = true; });
app.on("will-quit", () => { globalShortcut.unregisterAll(); stopSkillWatchers(); });
