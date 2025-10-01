import { describe, it, expect } from 'vitest';

// Re-implement small pure helper mirroring scraper.cjs logic for unit testing.
function parseCount(raw: unknown) {
  if (raw == null) return 0;
  const s = String(raw).trim().replace(/[\,\s]/g, '');
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

describe('parseCount', () => {
  it('parses integers', () => {
    expect(parseCount('123')).toBe(123);
    expect(parseCount('1,234')).toBe(1234);
  });
  it('parses suffixes', () => {
    expect(parseCount('1.2k')).toBe(1200);
    expect(parseCount('3.4M')).toBe(3400000);
    expect(parseCount('0.5b')).toBe(500000000);
  });
  it('handles garbage', () => {
    expect(parseCount('likes: --')).toBe(0);
    expect(parseCount(null)).toBe(0);
  });
});
