const { app, BrowserWindow, screen, ipcMain, Tray, Menu, nativeImage } = require('electron');
const path = require('path');

let mainWindow;
let tray;

function createWindow() {
  const { width } = screen.getPrimaryDisplay().workAreaSize;

  mainWindow = new BrowserWindow({
    width: 340,
    height: 220,
    minWidth: 220,
    minHeight: 160,
    x: width - 360,
    y: 20,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: true,
    focusable: true,
    hasShadow: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  // 'screen-saver' level keeps it above fullscreen apps too
  mainWindow.setAlwaysOnTop(true, 'screen-saver');
  mainWindow.loadFile(path.join(__dirname, 'index.html'));
  mainWindow.on('closed', () => { mainWindow = null; });
}

function createTray() {
  const img = nativeImage.createEmpty();
  tray = new Tray(img);

  const contextMenu = Menu.buildFromTemplate([
    { label: 'Work Timer Widget', enabled: false },
    { type: 'separator' },
    {
      label: 'Show / Hide',
      click: () => {
        if (!mainWindow) return;
        mainWindow.isVisible() ? mainWindow.hide() : mainWindow.show();
      },
    },
    { type: 'separator' },
    { label: 'Quit', click: () => app.quit() },
  ]);

  tray.setToolTip('Work Timer');
  tray.setContextMenu(contextMenu);
  tray.on('click', () => {
    if (!mainWindow) return;
    mainWindow.isVisible() ? mainWindow.hide() : mainWindow.show();
  });
}

app.whenReady().then(() => {
  createWindow();
  createTray();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// ── IPC: move window (drag) ──────────────────────────────────────
ipcMain.on('move-window', (_event, { dx, dy }) => {
  if (!mainWindow) return;
  const [x, y] = mainWindow.getPosition();
  mainWindow.setPosition(x + dx, y + dy);
});

// ── IPC: quit app ────────────────────────────────────────────────
ipcMain.on('quit-app', () => app.quit());

// ── IPC: hide window ─────────────────────────────────────────────
ipcMain.on('hide-window', () => {
  if (mainWindow) mainWindow.hide();
});

// ── IPC: resize window ───────────────────────────────────────────
ipcMain.on('resize-window', (_event, { width, height }) => {
  if (!mainWindow) return;
  const [minW, minH] = mainWindow.getMinimumSize();
  const w = Math.max(width, minW);
  const h = Math.max(height, minH);
  mainWindow.setSize(w, h);
});

// ── IPC: snap to compact / restore expanded ──────────────────────
let expandedSize = null; // { w, h } saved before compacting

ipcMain.on('snap-compact', (_event, { contentHeight }) => {
  if (!mainWindow) return;
  const [w] = mainWindow.getSize();
  expandedSize = { w, h: mainWindow.getSize()[1] };
  // Allow window to go below the normal minHeight for compact mode
  mainWindow.setMinimumSize(w, 1);
  mainWindow.setSize(w, contentHeight);
});

ipcMain.on('snap-expand', () => {
  if (!mainWindow || !expandedSize) return;
  mainWindow.setMinimumSize(220, 160);
  mainWindow.setSize(expandedSize.w, expandedSize.h);
  expandedSize = null;
});
