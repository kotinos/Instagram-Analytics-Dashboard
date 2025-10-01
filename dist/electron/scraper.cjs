const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const { logger } = require('./logger.cjs');

puppeteer.use(StealthPlugin());

class InstagramScraper {
  constructor() { this.browser = null; this.userAgents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  ]; }
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
  const ua = this.userAgents[Math.floor(Math.random() * this.userAgents.length)];
  await page.setUserAgent(ua);
  await page.setExtraHTTPHeaders({ 'Accept-Language': 'en-US,en;q=0.9' });
  await this.simulateHuman(page);
  const url = `https://www.instagram.com/${encodeURIComponent(username)}/`;
  await this.navigateWithRetry(page, url, 3);
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
  parseCount(raw) {
    if (raw == null) return 0;
    const s = String(raw).trim().replace(/[,\s]/g, '');
    const m = s.match(/([0-9]*\.?[0-9]+)([kmbKMB])?/);
    if (!m) {
      const n = Number(s.replace(/[^0-9.]/g, ''));
      return isNaN(n) ? 0 : Math.floor(n);
    }
    const val = parseFloat(m[1]);
    const suf = m[2]?.toLowerCase();
    if (suf === 'k') return Math.round(val * 1e3);
    if (suf === 'm') return Math.round(val * 1e6);
    if (suf === 'b') return Math.round(val * 1e9);
    return Math.round(val);
  }
  getShortcodeFromUrl(url) {
    try {
      const u = new URL(url);
      const m = u.pathname.match(/\/(?:p|reel)\/([A-Za-z0-9_-]+)/);
      return m ? m[1] : null;
    } catch { return null; }
  }
  async scrapeVideos(username, limit = 12) {
    await this.init();
    let page = null;
    const results = [];
    try {
      page = await this.browser.newPage();
      await page.setDefaultNavigationTimeout(15000);
      await page.setDefaultTimeout(10000);
      const ua = this.userAgents[Math.floor(Math.random() * this.userAgents.length)];
      await page.setUserAgent(ua);
      await page.setExtraHTTPHeaders({ 'Accept-Language': 'en-US,en;q=0.9' });
      await this.simulateHuman(page);
      const url = `https://www.instagram.com/${encodeURIComponent(username)}/`;
      await this.navigateWithRetry(page, url, 3);
      await page.waitForTimeout(800 + Math.random() * 400);
      // Collect post URLs from profile grid
      const postUrls = new Set();
      let attempts = 0;
      while (postUrls.size < limit && attempts < 8) {
        const urls = await page.evaluate(() => Array.from(document.querySelectorAll('a[href*="/p/"], a[href*="/reel/"]'))
          .map(a => a.getAttribute('href'))
          .filter(Boolean)
          .map(h => (h.startsWith('http') ? h : `https://www.instagram.com${h}`)));
        urls.forEach(u => postUrls.add(u));
        attempts++;
        if (postUrls.size >= limit) break;
        await page.evaluate(() => window.scrollBy(0, window.innerHeight));
        await page.waitForTimeout(600 + Math.random() * 600);
      }
      const targets = Array.from(postUrls).slice(0, limit);
      for (const postUrl of targets) {
        let p2 = null;
        try {
          p2 = await this.browser.newPage();
          await p2.setDefaultNavigationTimeout(15000);
          await p2.setDefaultTimeout(10000);
          await p2.setUserAgent(ua);
          await p2.setExtraHTTPHeaders({ 'Accept-Language': 'en-US,en;q=0.9' });
          await this.navigateWithRetry(p2, postUrl, 3);
          await p2.waitForTimeout(600 + Math.random() * 400);
          const data = await p2.evaluate(() => {
            const get = (sel, attr = 'content') => document.querySelector(sel)?.getAttribute(attr) || null;
            const text = (sel) => document.querySelector(sel)?.textContent?.trim() || null;
            const description = get('meta[name="description"]') || get('meta[property="og:description"]') || '';
            const title = get('meta[property="og:title"]') || '';
            const video = get('meta[property="og:video"]');
            const image = get('meta[property="og:image"]');
            const timeEl = document.querySelector('time[datetime]');
            const date = timeEl?.getAttribute('datetime') || get('meta[property="og:updated_time"]');
            return { description, title, video, image, date, pathname: location.pathname };
          });
          const shortcode = this.getShortcodeFromUrl(postUrl) || (data.pathname ? (data.pathname.match(/\/(?:p|reel)\/([A-Za-z0-9_-]+)/)?.[1] || null) : null);
          // Parse counts from description: e.g., "1,234 likes, 56 comments"
          let views = 0, likes = 0, comments = 0;
          if (data.description) {
            const d = data.description.toLowerCase();
            const mLikes = d.match(/([0-9][0-9,\.kmb]*)\s+likes/);
            const mComments = d.match(/([0-9][0-9,\.kmb]*)\s+comments/);
            const mViews = d.match(/([0-9][0-9,\.kmb]*)\s+views/);
            if (mLikes) likes = this.parseCount(mLikes[1]);
            if (mComments) comments = this.parseCount(mComments[1]);
            if (mViews) views = this.parseCount(mViews[1]);
          }
          const isReel = /\/reel\//.test(postUrl) || Boolean(data.video);
          results.push({
            instagram_post_id: shortcode || postUrl, // fallback to URL if needed
            instagram_shortcode: shortcode || null,
            is_reel: isReel,
            caption: data.title || null,
            posted_date: data.date || null,
            video_url: data.video || null,
            thumbnail_url: data.image || null,
            views_count: views,
            likes_count: likes,
            comments_count: comments,
            shares_count: 0,
            saves_count: 0,
          });
        } catch (e) {
          logger.warn('scrapeVideos post failed for %s: %s', postUrl, e.message);
        } finally {
          if (p2) { try { await p2.close(); } catch (_) {} }
        }
      }
      return results;
    } catch (err) {
      logger.error('scrapeVideos failed %s: %s', username, err.message);
      throw err;
    } finally {
      if (page) { try { await page.close(); } catch (_) {} }
    }
  }
  async simulateHuman(page) {
    const vp = page.viewport() || { width: 1366, height: 768 };
    const moves = 3 + Math.floor(Math.random() * 4);
    for (let i = 0; i < moves; i++) {
      const x = Math.floor(Math.random() * vp.width);
      const y = Math.floor(Math.random() * vp.height);
      try { await page.mouse.move(x, y, { steps: 5 + Math.floor(Math.random() * 10) }); } catch {}
      await page.waitForTimeout(100 + Math.random() * 200);
    }
  }
  async navigateWithRetry(page, url, max) {
    let attempt = 0;
    while (attempt < max) {
      try {
        await page.goto(url, { waitUntil: 'domcontentloaded' });
        return;
      } catch (e) {
        attempt++;
        const backoff = Math.min(1000 * Math.pow(2, attempt - 1) + Math.random() * 200, 8000);
        logger.warn('navigate failed (%d/%d): %s; retrying in %dms', attempt, max, e.message, backoff);
        await page.waitForTimeout(backoff);
      }
    }
    throw new Error('Navigation failed after retries');
  }
}

module.exports = { InstagramScraper };
