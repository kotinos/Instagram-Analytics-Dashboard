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
    };
  }
  init() { this.migrate(); return { ok: true }; }
  addCreator(username, displayName = null) { const res = this.stmts.insertCreator.run(username, displayName); return Number(res.lastInsertRowid); }
  listCreators(limit = 100) { return this.stmts.listCreators.all(limit); }
  getCreatorByUsername(username) { return this.stmts.getCreatorByUsername.get(username) || null; }
  touchScraped(id) { this.stmts.touchLastScraped.run(id); }
  upsertCreatorMeta(meta) { return this.stmts.upsertCreatorMeta.run(meta); }
}

module.exports = { db: new DB() };
