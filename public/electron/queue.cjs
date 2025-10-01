const { InstagramScraper } = require('./scraper.cjs');
const { logger } = require('./logger.cjs');

class ScraperQueue {
  constructor({ intervalMs = 1500 } = {}) {
    this.intervalMs = intervalMs;
    this.scraper = new InstagramScraper();
    this.queue = [];
    this.running = false;
  }
  add(task) { this.queue.push(task); this.process(); }
  async process() {
    if (this.running) return;
    this.running = true;
    while (this.queue.length > 0) {
      const task = this.queue.shift();
      try {
        const data = await this.scraper.scrapeProfile(task.username);
        await task.onSuccess?.(data);
      } catch (err) {
        logger.error('Task failed for %s: %s', task.username, err.message);
        await task.onError?.(err);
      }
      await new Promise(r => setTimeout(r, this.intervalMs));
    }
    this.running = false;
  }
}

module.exports = { ScraperQueue };
