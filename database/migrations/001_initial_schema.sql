PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS creators (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  uuid TEXT UNIQUE NOT NULL DEFAULT (lower(hex(randomblob(16)))),
  username TEXT UNIQUE NOT NULL COLLATE NOCASE,
  display_name TEXT,
  biography TEXT,
  profile_picture_url TEXT,
  profile_picture_local_path TEXT,
  follower_count INTEGER DEFAULT 0,
  following_count INTEGER DEFAULT 0,
  posts_count INTEGER DEFAULT 0,
  is_verified INTEGER DEFAULT 0,
  is_private INTEGER DEFAULT 0,
  added_date DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_scraped DATETIME,
  last_successful_scrape DATETIME,
  scrape_failures INTEGER DEFAULT 0,
  is_active INTEGER DEFAULT 1,
  metadata JSON,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_creators_username ON creators(username);
CREATE INDEX IF NOT EXISTS idx_creators_active ON creators(is_active);
CREATE INDEX IF NOT EXISTS idx_creators_last_scraped ON creators(last_scraped);

CREATE TABLE IF NOT EXISTS videos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  uuid TEXT UNIQUE NOT NULL DEFAULT (lower(hex(randomblob(16)))),
  creator_id INTEGER NOT NULL,
  instagram_post_id TEXT UNIQUE NOT NULL,
  instagram_shortcode TEXT UNIQUE,
  video_url TEXT,
  thumbnail_url TEXT,
  thumbnail_local_path TEXT,
  caption TEXT,
  hashtags JSON,
  mentions JSON,
  duration_seconds INTEGER,
  posted_date DATETIME,
  discovered_date DATETIME DEFAULT CURRENT_TIMESTAMP,
  is_reel INTEGER DEFAULT 1,
  is_deleted INTEGER DEFAULT 0,
  metadata JSON,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (creator_id) REFERENCES creators(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_videos_creator ON videos(creator_id);
CREATE INDEX IF NOT EXISTS idx_videos_posted ON videos(posted_date);
CREATE INDEX IF NOT EXISTS idx_videos_instagram_id ON videos(instagram_post_id);

CREATE TABLE IF NOT EXISTS video_metrics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  video_id INTEGER NOT NULL,
  views_count INTEGER DEFAULT 0,
  likes_count INTEGER DEFAULT 0,
  comments_count INTEGER DEFAULT 0,
  shares_count INTEGER DEFAULT 0,
  saves_count INTEGER DEFAULT 0,
  engagement_rate REAL GENERATED ALWAYS AS (
    CASE WHEN views_count > 0 THEN CAST((likes_count + comments_count + shares_count + saves_count) AS REAL) / views_count * 100 ELSE 0 END
  ) STORED,
  likes_delta INTEGER DEFAULT 0,
  views_delta INTEGER DEFAULT 0,
  recorded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  scrape_session_id TEXT,
  FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_metrics_video ON video_metrics(video_id);
CREATE INDEX IF NOT EXISTS idx_metrics_recorded ON video_metrics(recorded_at);
CREATE INDEX IF NOT EXISTS idx_metrics_engagement ON video_metrics(engagement_rate);

CREATE TABLE IF NOT EXISTS scraping_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT UNIQUE NOT NULL,
  creator_id INTEGER,
  started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  completed_at DATETIME,
  status TEXT CHECK(status IN ('running','completed','failed','cancelled')),
  videos_scraped INTEGER DEFAULT 0,
  errors JSON,
  metadata JSON,
  FOREIGN KEY (creator_id) REFERENCES creators(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value JSON NOT NULL,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS analytics_cache (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  cache_key TEXT UNIQUE NOT NULL,
  data JSON NOT NULL,
  expires_at DATETIME NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_cache_expires ON analytics_cache(expires_at);

CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entity_type TEXT NOT NULL,
  entity_id INTEGER NOT NULL,
  action TEXT NOT NULL,
  old_value JSON,
  new_value JSON,
  user_action TEXT,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TRIGGER IF NOT EXISTS update_creators_timestamp AFTER UPDATE ON creators BEGIN
  UPDATE creators SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS update_videos_timestamp AFTER UPDATE ON videos BEGIN
  UPDATE videos SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;
