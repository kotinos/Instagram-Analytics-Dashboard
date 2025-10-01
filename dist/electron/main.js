import { app, BrowserWindow, shell, session } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import './ipc-handlers.js';
import { logger } from './logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow;

// Mitigate potential GPU/driver issues causing blank/black screens
if (process.env.VITE_DEV_SERVER === 'true') {
  app.disableHardwareAcceleration();
}

function createWindow() {
  logger.info('Creating BrowserWindow');
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    },
    show: false,
  });

  const isVite = process.env.VITE_DEV_SERVER === 'true';
  const url = isVite ? 'http://localhost:5173' : `file://${path.join(__dirname, '..', 'index.html')}`;
  logger.info('Loading URL: %s', url);
  mainWindow.loadURL(url);

  mainWindow.once('ready-to-show', () => {
    logger.info('ready-to-show, showing window');
    mainWindow.show();
  });

  if (isVite) {
    // Open devtools in dev to inspect renderer errors causing blank screen
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  }

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  const isDev = process.env.VITE_DEV_SERVER === 'true';
  if (!isDev) {
    session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
      const prodCsp = [
        "default-src 'self'",
        "script-src 'self'",
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data:",
        "connect-src 'self'",
        "font-src 'self' data:",
        "worker-src 'self'",
        "object-src 'none'",
      ].join('; ');
  
      callback({
        responseHeaders: {
          ...details.responseHeaders,
          'Content-Security-Policy': [prodCsp]
        }
      });
    });
  }

  // Diagnostics for renderer crashes/unresponsive states
  mainWindow.webContents.on('render-process-gone', (_e, details) => {
    logger.error('Renderer process gone: %o', details);
  });
  mainWindow.webContents.on('unresponsive', () => {
    logger.warn('Renderer is unresponsive');
  });

  // Log load failures and attempt one retry
  let retried = false;
  mainWindow.webContents.on('did-fail-load', (_e, ec, desc, _url, isMainFrame) => {
    if (!isMainFrame) return;
    logger.error('did-fail-load: %s %s', ec, desc);
    if (!retried) {
      retried = true;
      setTimeout(() => mainWindow.loadURL(url), 500);
    }
  });

  mainWindow.webContents.on('did-finish-load', () => {
    logger.info('did-finish-load fired');
  });
}

app.whenReady().then(() => {
  logger.info('App ready');
  createWindow();

  app.on('activate', () => {
    logger.info('Activate event');
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  logger.info('All windows closed');
  if (process.platform !== 'darwin') app.quit();
});
