const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');
const { logger } = require('./logger.cjs');

class DB {
  constructor() {
    const dbPath = path.join(process.cwd(), 'database', 'analytics.db');
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');
    this.migrate();
    this.prepare();
  }
  migrate() {
    const dir = path.join(process.cwd(), 'database', 'migrations');
    const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter(f => f.endsWith('.sql')).sort() : [];
    if (files.length === 0) return;
    logger.info('Running migrations: %d files', files.length);
    const exec = this.db.exec.bind(this.db);
    this.db.transaction(() => {
      for (const f of files) {
        const sql = fs.readFileSync(path.join(dir, f), 'utf-8');
        exec(sql);
      }
    })();
  }
  prepare() {
    this.stmts = {
      insertCreator: this.db.prepare('INSERT OR IGNORE INTO creators (username, display_name) VALUES (?, ?)'),
      listCreators: this.db.prepare('SELECT id, username, display_name FROM creators ORDER BY id DESC LIMIT ?'),
      getCreatorByUsername: this.db.prepare('SELECT id, username FROM creators WHERE username = ?'),
      touchLastScraped: this.db.prepare('UPDATE creators SET last_scraped = CURRENT_TIMESTAMP WHERE id = ?'),
      upsertCreatorMeta: this.db.prepare(`
        INSERT INTO creators (username, display_name, follower_count, following_count, posts_count, is_verified, is_private, last_successful_scrape)
        VALUES (@username, @display_name, @follower_count, @following_count, @posts_count, @is_verified, @is_private, CURRENT_TIMESTAMP)
        ON CONFLICT(username) DO UPDATE SET
          display_name=excluded.display_name,
          follower_count=excluded.follower_count,
          following_count=excluded.following_count,
          posts_count=excluded.posts_count,
          is_verified=excluded.is_verified,
          is_private=excluded.is_private,
          last_successful_scrape=CURRENT_TIMESTAMP,
          updated_at=CURRENT_TIMESTAMP
      `),
      // Scraping sessions and audit logs
      createScrapeSession: this.db.prepare(`
        INSERT INTO scraping_sessions (session_id, creator_id, status, started_at, metadata)
        VALUES (@session_id, @creator_id, 'running', CURRENT_TIMESTAMP, @metadata)
      `),
      completeScrapeSession: this.db.prepare(`
        UPDATE scraping_sessions SET status='completed', completed_at=CURRENT_TIMESTAMP, videos_scraped=@videos_scraped, errors=NULL WHERE session_id=@session_id
      `),
      failScrapeSession: this.db.prepare(`
        UPDATE scraping_sessions SET status='failed', completed_at=CURRENT_TIMESTAMP, errors=@errors WHERE session_id=@session_id
      `),
      insertAudit: this.db.prepare(`
        INSERT INTO audit_log (entity_type, entity_id, action, old_value, new_value, user_action)
        VALUES (@entity_type, @entity_id, @action, @old_value, @new_value, @user_action)
      `),
      upsertVideo: this.db.prepare(`
        INSERT INTO videos (creator_id, instagram_post_id, instagram_shortcode, is_reel, caption, posted_date, video_url, thumbnail_url)
        VALUES (@creator_id, @instagram_post_id, @instagram_shortcode, @is_reel, @caption, @posted_date, @video_url, @thumbnail_url)
        ON CONFLICT(instagram_post_id) DO UPDATE SET
          instagram_shortcode=excluded.instagram_shortcode,
          is_reel=excluded.is_reel,
          caption=excluded.caption,
          posted_date=COALESCE(excluded.posted_date, videos.posted_date),
          video_url=COALESCE(excluded.video_url, videos.video_url),
          thumbnail_url=COALESCE(excluded.thumbnail_url, videos.thumbnail_url),
          updated_at=CURRENT_TIMESTAMP
      `),
      getVideoByPostId: this.db.prepare('SELECT id FROM videos WHERE instagram_post_id = ?'),
      getLastMetrics: this.db.prepare('SELECT likes_count, comments_count, views_count FROM video_metrics WHERE video_id=? ORDER BY recorded_at DESC LIMIT 1'),
      insertMetrics: this.db.prepare(`
        INSERT INTO video_metrics (video_id, views_count, likes_count, comments_count, shares_count, saves_count, likes_delta, views_delta, scrape_session_id)
        VALUES (@video_id, @views_count, @likes_count, @comments_count, @shares_count, @saves_count, @likes_delta, @views_delta, @scrape_session_id)
      `),
    };
  }
  init() { this.migrate(); return { ok: true }; }
  addCreator(username, displayName = null) { const res = this.stmts.insertCreator.run(username, displayName); return Number(res.lastInsertRowid); }
  listCreators(limit = 100) { return this.stmts.listCreators.all(limit); }
  getCreatorByUsername(username) { return this.stmts.getCreatorByUsername.get(username) || null; }
  touchScraped(id) { this.stmts.touchLastScraped.run(id); }
  upsertCreatorMeta(meta) { return this.stmts.upsertCreatorMeta.run(meta); }
  upsertVideo(creator_id, v) {
    return this.stmts.upsertVideo.run({ creator_id, ...v });
  }
  insertVideoMetrics(video_id, m, session) {
    const last = this.stmts.getLastMetrics.get(video_id) || { likes_count: 0, views_count: 0 };
    const likes_delta = m.likes_count != null ? (m.likes_count - (last.likes_count || 0)) : 0;
    const views_delta = m.views_count != null ? (m.views_count - (last.views_count || 0)) : 0;
    return this.stmts.insertMetrics.run({
      video_id,
      views_count: m.views_count ?? 0,
      likes_count: m.likes_count ?? 0,
      comments_count: m.comments_count ?? 0,
      shares_count: m.shares_count ?? 0,
      saves_count: m.saves_count ?? 0,
      likes_delta,
      views_delta,
      scrape_session_id: session,
    });
  }

  transaction(fn) {
    return this.db.transaction(fn)();
  }

  beginScrapeSession({ session_id, creator_id, metadata = null }) {
    this.stmts.createScrapeSession.run({ session_id, creator_id, metadata });
  }
  finishScrapeSession({ session_id, videos_scraped = 0 }) {
    this.stmts.completeScrapeSession.run({ session_id, videos_scraped });
  }
  failScrapeSession({ session_id, errors }) {
    this.stmts.failScrapeSession.run({ session_id, errors: JSON.stringify(errors || null) });
  }
  audit(entry) { this.stmts.insertAudit.run({ ...entry, old_value: entry.old_value ? JSON.stringify(entry.old_value) : null, new_value: entry.new_value ? JSON.stringify(entry.new_value) : null }); }

  backup() {
    const src = this.db.name; // path to DB file
    const dir = path.join(process.cwd(), 'database', 'backups');
    fs.mkdirSync(dir, { recursive: true });
    const ts = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
    const dest = path.join(dir, `analytics-${ts}.db`);
    // Use SQLite backup API if available, else file copy when DB is not busy
    try {
      fs.copyFileSync(src, dest);
    } catch (e) {
      logger && logger.error ? logger.error('Backup failed: %s', e.message) : console.error('Backup failed:', e.message);
      throw e;
    }
    // Rotate keep last 7
    try {
      const files = fs.readdirSync(dir).filter(f => f.endsWith('.db')).sort();
      while (files.length > 7) {
        const f = files.shift();
        fs.unlinkSync(path.join(dir, f));
      }
    } catch {}
    return dest;
  }
}

module.exports = { db: new DB() };
