import { app, BrowserWindow, Menu, Tray, clipboard, dialog, globalShortcut, ipcMain, nativeImage, protocol, shell } from "electron";
import { readFile } from "node:fs/promises";
import { extname, isAbsolute, join, normalize, relative } from "node:path";
import { scanSkillRoots } from "./skill-scanner.mjs";
import { addSkillRoot, listSkillRoots, removeSkillRoot, updateSkillRoot } from "./skill-roots.mjs";
import { watchSkillRoots } from "./skill-watcher.mjs";

const DEV_SERVER_URL = process.env.FDE_DEV_SERVER_URL;
const BASIC_SMOKE_TEST = process.argv.includes("--smoke-test");
const SKILLS_SMOKE_TEST = process.argv.includes("--skills-smoke-test");
const SMOKE_TEST = BASIC_SMOKE_TEST || SKILLS_SMOKE_TEST;
const APP_PROTOCOL = "fde-app";
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
  else mainWindow.webContents.once("did-finish-load", async () => {
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
});

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
    globalShortcut.register("CommandOrControl+Shift+K", showWindow);
  }

  ipcMain.handle("fde:read-clipboard", event => {
    assertTrustedSender(event);
    return clipboard.readText();
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
