import { ipcMain, BrowserWindow } from 'electron';
import Joi from 'joi';
import { db } from './db.js';
import { logger } from './logger.js';

let queue = null;
async function getQueue() {
  if (!queue) {
    const mod = await import('./queue.js');
    queue = new mod.ScraperQueue({ intervalMs: 2000 });
  }
  return queue;
}

function broadcast(channel, payload) {
  try {
    const wins = BrowserWindow.getAllWindows();
    for (const w of wins) w.webContents.send(channel, payload);
  } catch (err) {
    logger.error('broadcast failed: %s', err.message);
  }
}

ipcMain.handle('ping', async () => {
  return 'pong';
});

ipcMain.handle('db:init', async () => {
  db.init();
  return { ok: true };
});

ipcMain.handle('db:add-creator', async (_event, data) => {
  const schema = Joi.object({
    username: Joi.string().trim().alphanum().min(1).max(30).required(),
    displayName: Joi.string().trim().max(100).optional(),
  });
  const { error, value } = schema.validate(data);
  if (error) throw new Error(error.message);

  const id = db.addCreator(value.username, value.displayName ?? null);
  return { id };
});

ipcMain.handle('db:list-creators', async () => {
  return db.listCreators(100);
});

// Scraping IPC
ipcMain.handle('scrape:enqueue', async (_event, payload) => {
  const schema = Joi.object({
    username: Joi.string().trim().alphanum().min(1).max(30).required(),
  });
  const { error, value } = schema.validate(payload);
  if (error) throw new Error(error.message);

  const q = await getQueue();
  q.add({
    username: value.username,
    onSuccess: async (data) => {
      try {
        // Ensure creator exists and upsert meta
        const existing = db.getCreatorByUsername(data.username);
        if (!existing) db.addCreator(data.username, data.display_name ?? null);
        db.upsertCreatorMeta({
          username: data.username,
          display_name: data.display_name ?? null,
          follower_count: data.follower_count ?? null,
          following_count: data.following_count ?? null,
          posts_count: data.posts_count ?? null,
          is_verified: data.is_verified ?? null,
          is_private: data.is_private ?? null,
        });
        const final = db.getCreatorByUsername(data.username);
        if (final) db.touchScraped(final.id);
        broadcast('scrape:progress', { username: data.username, status: 'success', data });
      } catch (err) {
        logger.error('post-success handling failed: %s', err.message);
        broadcast('scrape:progress', { username: data.username, status: 'error', error: err.message });
      }
    },
    onError: async (err) => {
      broadcast('scrape:progress', { username: value.username, status: 'error', error: err.message });
    }
  });

  return { enqueued: true };
});

ipcMain.handle('scrape:bulk', async (_event, payload) => {
  const schema = Joi.object({
    usernames: Joi.array().items(Joi.string().trim().alphanum().min(1).max(30)).min(1).max(100).required(),
  });
  const { error, value } = schema.validate(payload);
  if (error) throw new Error(error.message);

  const q = await getQueue();
  for (const username of value.usernames) {
    q.add({ username,
      onSuccess: async (data) => {
        try {
          const existing = db.getCreatorByUsername(data.username);
          if (!existing) db.addCreator(data.username, data.display_name ?? null);
          db.upsertCreatorMeta({
            username: data.username,
            display_name: data.display_name ?? null,
            follower_count: data.follower_count ?? null,
            following_count: data.following_count ?? null,
            posts_count: data.posts_count ?? null,
            is_verified: data.is_verified ?? null,
            is_private: data.is_private ?? null,
          });
          const final = db.getCreatorByUsername(data.username);
          if (final) db.touchScraped(final.id);
          broadcast('scrape:progress', { username: data.username, status: 'success', data });
        } catch (err) {
          logger.error('post-success handling failed: %s', err.message);
          broadcast('scrape:progress', { username: data.username, status: 'error', error: err.message });
        }
      },
      onError: async (err) => {
        broadcast('scrape:progress', { username, status: 'error', error: err.message });
      }
    });
  }
  return { enqueued: value.usernames.length };
});
