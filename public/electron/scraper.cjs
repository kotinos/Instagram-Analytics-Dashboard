const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const { logger } = require('./logger.cjs');

puppeteer.use(StealthPlugin());

class InstagramScraper {
  constructor() { this.browser = null; }
  async init() {
    if (this.browser) return;
    this.browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox','--disable-setuid-sandbox','--disable-blink-features=AutomationControlled','--disable-features=IsolateOrigins,site-per-process'],
      defaultViewport: { width: 1366, height: 768 }
    });
  }
  async close() { if (this.browser) { await this.browser.close(); this.browser = null; } }
  async scrapeProfile(username) {
    await this.init();
    let page = null;
    try {
      page = await this.browser.newPage();
      await page.setDefaultNavigationTimeout(15000);
      await page.setDefaultTimeout(10000);
      await page.goto(`https://www.instagram.com/${encodeURIComponent(username)}/`, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(500 + Math.random() * 500);
      const data = await page.evaluate(() => ({
        display_name: document.title?.replace(/ • Instagram photos and videos$/i, '') || null,
      }));
      return { username, ...data };
    } catch (err) {
      logger.error('scrapeProfile failed %s: %s', username, err.message);
      throw err;
    } finally {
      if (page) { try { await page.close(); } catch (_) {} }
    }
  }
}

module.exports = { InstagramScraper };
