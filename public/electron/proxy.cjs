class ProxyManager {
  constructor(list = null) {
    this.proxies = Array.isArray(list) && list.length ? list : this.loadFromEnv();
    this.index = 0;
  }
  loadFromEnv() {
    const raw = process.env.PROXIES || '';
    return raw.split(',').map(s => s.trim()).filter(Boolean);
  }
  getNext() {
    if (!this.proxies.length) return null;
    const p = this.proxies[this.index % this.proxies.length];
    this.index++;
    return p;
  }
}

module.exports = { ProxyManager };
