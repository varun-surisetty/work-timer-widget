const { app, BrowserWindow, screen, ipcMain, Tray, Menu, nativeImage } = require('electron');
const path = require('path');
const fs   = require('fs');

let mainWindow;
let tray;

// ── Build a small colored square as tray icon (no external file) ──
function makeTrayIcon() {
  // 16×16 PNG: dark background + a small colored clock-face dot
  // We use a raw RGBA buffer via nativeImage.createFromBuffer
  const size   = 16;
  const buf    = Buffer.alloc(size * size * 4);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i  = (y * size + x) * 4;
      const cx = x - size / 2 + 0.5;
      const cy = y - size / 2 + 0.5;
      const r  = Math.sqrt(cx * cx + cy * cy);

      if (r <= 7) {
        // Outer circle fill — dark blue-grey
        buf[i]   = 30;   // R
        buf[i+1] = 30;   // G
        buf[i+2] = 46;   // B
        buf[i+3] = 255;  // A
      }
      if (r >= 6 && r <= 7.5) {
        // Ring — bright blue to make it visible
        buf[i]   = 0;
        buf[i+1] = 170;
        buf[i+2] = 255;
        buf[i+3] = 255;
      }
      // Inside the ring: keep dark fill above
    }
  }

  return nativeImage.createFromBuffer(buf, { width: size, height: size });
}

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

  mainWindow.setAlwaysOnTop(true, 'screen-saver');
  mainWindow.loadFile(path.join(__dirname, 'index.html'));
  mainWindow.on('closed', () => { mainWindow = null; });

  // If the OS somehow minimizes the window (e.g. Win+D "show desktop"),
  // immediately restore it so it never disappears into a taskbar slot
  // (which would be invisible anyway since skipTaskbar is true).
  mainWindow.on('minimize', () => {
    mainWindow.restore();
  });
}

function showWindow() {
  if (!mainWindow) return;
  mainWindow.show();
  mainWindow.setAlwaysOnTop(true, 'screen-saver');
}

function createTray() {
  tray = new Tray(makeTrayIcon());

  const contextMenu = Menu.buildFromTemplate([
    { label: 'Work Timer Widget', enabled: false },
    { type: 'separator' },
    {
      label: 'Show Widget',
      click: () => showWindow(),
    },
    {
      label: 'Hide Widget',
      click: () => { if (mainWindow) mainWindow.hide(); },
    },
    { type: 'separator' },
    { label: 'Quit', click: () => app.quit() },
  ]);

  tray.setToolTip('Work Timer — click to show');
  tray.setContextMenu(contextMenu);

  // Single click on tray icon always shows the widget
  tray.on('click', () => showWindow());
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

// ── IPC: schedule persistence (userData JSON file) ───────────────
function scheduleFilePath() {
  return path.join(app.getPath('userData'), 'schedule.json');
}

ipcMain.handle('schedule-load', () => {
  try {
    const raw = fs.readFileSync(scheduleFilePath(), 'utf8');
    return JSON.parse(raw);
  } catch (_) {
    return null;
  }
});

ipcMain.handle('schedule-save', (_event, schedule) => {
  try {
    fs.writeFileSync(scheduleFilePath(), JSON.stringify(schedule, null, 2), 'utf8');
    return true;
  } catch (_) {
    return false;
  }
});

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
