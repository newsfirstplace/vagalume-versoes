const KEY = "uno_stats";
const DEFAULTS = { wins: 0, losses: 0 };

function area() {
  try {
    if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
      return chrome.storage.local;
    }
  } catch (e) {}
  return null;
}

export async function loadStats() {
  const a = area();
  if (a) {
    return new Promise((res) => a.get(KEY, (d) => res({ ...DEFAULTS, ...(d[KEY] || {}) })));
  }
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || "{}") };
  } catch (e) {
    return { ...DEFAULTS };
  }
}

export async function saveStats(s) {
  const a = area();
  if (a) return new Promise((res) => a.set({ [KEY]: s }, res));
  localStorage.setItem(KEY, JSON.stringify(s));
}
