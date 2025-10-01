const { InstagramScraper } = require('./scraper.cjs');
const { logger } = require('./logger.cjs');

class ScraperQueue {
  constructor({ intervalMs = 1500, concurrency = 2, maxRetries = 3, baseDelayMs = 1000, jitterMs = 250 } = {}) {
    this.intervalMs = intervalMs;
    this.concurrency = concurrency;
    this.maxRetries = maxRetries;
    this.baseDelayMs = baseDelayMs;
    this.jitterMs = jitterMs;
    this.scraper = new InstagramScraper();
    this.queue = [];
    this.active = 0;
  }

  add(task) {
    const item = { priority: 0, attempts: 0, ...task };
    this.queue.push(item);
    // Simple priority: higher first
    this.queue.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
    this.drain();
  }

  async drain() {
    while (this.active < this.concurrency && this.queue.length > 0) {
      const task = this.queue.shift();
      this.runTask(task);
    }
  }

  async runTask(task) {
    this.active++;
    try {
      let data = null;
      if (typeof task.run === 'function') {
        data = await task.run(this.scraper);
      } else {
        data = await this.scraper.scrapeProfile(task.username);
      }
      await task.onSuccess?.(data);
    } catch (err) {
      task.attempts = (task.attempts || 0) + 1;
      const delay = this.backoffDelay(task.attempts);
      logger.error('Task failed for %s (attempt %d/%d): %s. Retrying in %d ms', task.username, task.attempts, this.maxRetries, err.message, delay);
      await task.onError?.(err);
      if (task.attempts < this.maxRetries) {
        setTimeout(() => { this.queue.push(task); this.drain(); }, delay);
      } else {
        logger.error('Task permanently failed for %s after %d attempts', task.username, task.attempts);
      }
    } finally {
      await this.sleep(this.intervalMs);
      this.active--;
      this.drain();
    }
  }

  backoffDelay(attempt) {
    const exp = Math.pow(2, attempt - 1);
    const base = this.baseDelayMs * exp;
    const jitter = Math.floor(Math.random() * this.jitterMs);
    return base + jitter;
  }

  sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

  async close() {
    try {
      if (this.scraper && typeof this.scraper.close === 'function') {
        await this.scraper.close();
      }
    } catch (e) {
      logger && logger.warn && logger.warn('Queue close error: %s', e.message);
    }
  }
}

module.exports = { ScraperQueue };
