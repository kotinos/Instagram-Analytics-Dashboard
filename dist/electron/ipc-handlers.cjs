const { ipcMain, BrowserWindow } = require('electron');
const Joi = require('joi');
const { db } = require('./db.cjs');
const { logger } = require('./logger.cjs');

let queue = null;
async function getQueue() {
  if (!queue) {
    const mod = require('./queue.cjs');
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

ipcMain.handle('ping', async () => 'pong');

// Basic system health check
ipcMain.handle('system:health', async () => {
  const health = { db: false, queue: false, scraper: false };
  try {
    db.listCreators(1);
    health.db = true;
  } catch (e) {
    logger.error('Health DB check failed: %s', e.message);
  }
  try {
    const q = await getQueue();
    health.queue = Boolean(q);
    // try a lightweight init of scraper without opening a page
    if (q && q.scraper) {
      await q.scraper.init();
      health.scraper = true;
      await q.scraper.close();
    }
  } catch (e) {
    logger.error('Health queue/scraper check failed: %s', e.message);
  }
  return health;
});

ipcMain.handle('db:init', async () => db.init());

ipcMain.handle('db:add-creator', async (_e, data) => {
  const schema = Joi.object({
    username: Joi.string().trim().pattern(/^[A-Za-z0-9._-]+$/).min(1).max(30).required(),
    displayName: Joi.string().trim().max(100).optional(),
  });
  const { error, value } = schema.validate(data);
  if (error) throw new Error(error.message);
  const id = db.addCreator(value.username, value.displayName ?? null);
  return { id };
});

ipcMain.handle('db:list-creators', async () => db.listCreators(100));

ipcMain.handle('scrape:enqueue', async (_e, payload) => {
  const schema = Joi.object({ username: Joi.string().trim().pattern(/^[A-Za-z0-9._-]+$/).min(1).max(30).required() });
  const { error, value } = schema.validate(payload);
  if (error) throw new Error(error.message);
  const q = await getQueue();
  q.add({
    username: value.username,
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
    onError: async (err) => broadcast('scrape:progress', { username: value.username, status: 'error', error: err.message }),
  });
  return { enqueued: true };
});

ipcMain.handle('scrape:bulk', async (_e, payload) => {
  const schema = Joi.object({ usernames: Joi.array().items(Joi.string().trim().pattern(/^[A-Za-z0-9._-]+$/).min(1).max(30)).min(1).max(100).required() });
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
      onError: async (err) => broadcast('scrape:progress', { username, status: 'error', error: err.message }),
    });
  }
  return { enqueued: value.usernames.length };
});

// Scrape profile + videos and ingest
ipcMain.handle('scrape:profileAndVideos', async (_e, payload) => {
  const schema = Joi.object({ username: Joi.string().trim().pattern(/^[A-Za-z0-9._-]+$/).min(1).max(30).required(), limit: Joi.number().integer().min(1).max(50).default(12) });
  const { error, value } = schema.validate(payload);
  if (error) throw new Error(error.message);
  const session_id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const q = await getQueue();
  q.add({ priority: 1, run: async (scraper) => {
    const username = value.username;
    broadcast('scrape:progress', { username, status: 'running', session_id });
    db.beginScrapeSession({ session_id, creator_id: null, metadata: JSON.stringify({ username }) });
    try {
      const profile = await scraper.scrapeProfile(username);
      const existing = db.getCreatorByUsername(username);
      if (!existing) db.addCreator(username, profile.display_name ?? null);
      db.upsertCreatorMeta({
        username,
        display_name: profile.display_name ?? null,
        follower_count: null,
        following_count: null,
        posts_count: null,
        is_verified: null,
        is_private: null,
      });
      const creator = db.getCreatorByUsername(username);
      const videos = await scraper.scrapeVideos(username, value.limit);
      let videos_scraped = 0;
      db.transaction(() => {
        for (const v of videos) {
          db.upsertVideo(creator.id, {
            instagram_post_id: v.instagram_post_id,
            instagram_shortcode: v.instagram_shortcode,
            is_reel: v.is_reel ? 1 : 0,
            caption: v.caption,
            posted_date: v.posted_date,
            video_url: v.video_url,
            thumbnail_url: v.thumbnail_url,
          });
          const vidRow = db.stmts.getVideoByPostId.get(v.instagram_post_id);
          if (vidRow?.id) {
            db.insertVideoMetrics(vidRow.id, {
              views_count: v.views_count,
              likes_count: v.likes_count,
              comments_count: v.comments_count,
              shares_count: v.shares_count,
              saves_count: v.saves_count,
            }, session_id);
            videos_scraped++;
            broadcast('scrape:progress', { username, status: 'video', shortcode: v.instagram_shortcode, session_id });
          }
        }
      });
      db.finishScrapeSession({ session_id, videos_scraped });
      if (creator) db.touchScraped(creator.id);
      broadcast('scrape:progress', { username, status: 'success', session_id, count: videos_scraped });
      return { profile, videos_scraped };
    } catch (err) {
      db.failScrapeSession({ session_id, errors: { message: err.message } });
      broadcast('scrape:progress', { username: value.username, status: 'error', error: err.message, session_id });
      throw err;
    }
  }});
  return { enqueued: true, session_id };
});

module.exports = { getQueue };
