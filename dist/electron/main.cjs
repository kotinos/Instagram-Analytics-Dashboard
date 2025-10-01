const { app, BrowserWindow, shell, session } = require('electron');
const path = require('path');
const fs = require('fs');
const cron = require('node-cron');
const ipc = require('./ipc-handlers.cjs');
const { logger } = require('./logger.cjs');
let queueRef = null;

// Mitigate Windows GPU process crashes by disabling GPU from the start
try {
  app.commandLine.appendSwitch('disable-gpu');
  app.commandLine.appendSwitch('disable-software-rasterizer');
  app.disableHardwareAcceleration();
} catch {}

let mainWindow;
if (process.env.VITE_DEV_SERVER === 'true') {
  app.disableHardwareAcceleration();
}

function createWindow() {
  logger.info('Creating BrowserWindow');
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    },
    show: false,
  });

  const isVite = process.env.VITE_DEV_SERVER === 'true';
  let url;
  if (isVite) {
    url = 'http://localhost:5173';
  } else {
    const distIndex = path.join(process.cwd(), 'dist', 'index.html');
    url = fs.existsSync(distIndex)
      ? `file://${distIndex}`
      : `file://${path.join(__dirname, '..', 'index.html')}`; // fallback (dev template)
  }
  logger.info('Loading URL: %s', url);
  mainWindow.loadURL(url);

  mainWindow.once('ready-to-show', () => {
    logger.info('ready-to-show, showing window');
    mainWindow.show();
  });

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

  mainWindow.webContents.on('render-process-gone', (_e, details) => {
    logger.error('Renderer process gone: %o', details);
  });
  mainWindow.webContents.on('unresponsive', () => {
    logger.warn('Renderer is unresponsive');
  });
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
  // Lazy-init queue (singleton) to be able to close it on shutdown
  ipc.getQueue().then(q => { queueRef = q; }).catch(e => logger.warn('Queue init failed/optional: %s', e.message));
  try {
    const { db } = require('./db.cjs');
    // Nightly at 03:00 local time
    cron.schedule('0 3 * * *', () => {
      try {
        const out = db.backup();
        logger.info('Backup created at %s', out);
      } catch (e) {
        logger.error('Backup job failed: %s', e.message);
      }
    });
  } catch (e) {
    logger.warn('Backup scheduling skipped: %s', e.message);
  }
  app.on('activate', () => {
    logger.info('Activate event');
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  logger.info('All windows closed');
  if (process.platform !== 'darwin') app.quit();
});

async function shutdown(code = 0) {
  try {
    if (queueRef && typeof queueRef.close === 'function') {
      await queueRef.close();
    }
  } catch (e) {
    logger.error('Error during shutdown: %s', e.message);
  } finally {
    app.exit(code);
  }
}

process.on('uncaughtException', (err) => {
  logger.error('Uncaught exception: %s', err.stack || err.message);
});
process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled rejection: %s', (reason && reason.stack) || String(reason));
});
process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));
app.on('before-quit', () => { shutdown(0); });
