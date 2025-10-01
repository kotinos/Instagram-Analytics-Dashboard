import Database, { Database as BetterSqlite3Database } from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

/**
 * Service for managing the local SQLite database using better-sqlite3.
 * Ensures WAL mode and foreign keys, and can execute SQL migrations.
 */
export class DatabaseService {
  private db: BetterSqlite3Database;

  /**
   * @param dbPath Optional absolute or workspace-relative path to the DB file.
   */
  constructor(dbPath?: string) {
    const resolved = dbPath ?? path.join(process.cwd(), 'database', 'analytics.db');
    this.db = new Database(resolved);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');
  }

  /**
   * Executes all .sql files in the provided directory in lexical order within a single transaction.
   */
  migrate(migrationsDir: string): void {
    const files = fs.readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort();
    const sqlBatches = files.map((f) => fs.readFileSync(path.join(migrationsDir, f), 'utf-8'));
    const exec = this.db.exec.bind(this.db);
    this.db.transaction(() => {
      for (const sql of sqlBatches) exec(sql);
    })();
  }
}
