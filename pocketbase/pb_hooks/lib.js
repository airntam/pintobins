// Shared helpers for hooks. Keep normalize() in sync with web/src/lib/search.ts
module.exports = {
  normalize(s) {
    return String(s || '')
      .toLowerCase()
      .replace(/×/g, 'x')
      .replace(/(\d)\s*x\s*(\d)/g, '$1x$2')
      .replace(/\s+/g, ' ')
      .trim();
  }
};
