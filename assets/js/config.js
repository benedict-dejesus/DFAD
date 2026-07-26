/**
 * DAD — runtime configuration.
 *
 * Paste the Apps Script Web App URL below (the one ending in `/exec`).
 * See apps-script/GUIDE.md, step 6.
 *
 * You can also override it without editing this file — handy while testing —
 * by opening the site with `#/settings` and pasting the URL there, or by
 * running this in the browser console:
 *
 *     localStorage.setItem('dad:apiBase', 'https://script.google.com/.../exec')
 */

const BUILT_IN_API_BASE = 'https://script.google.com/macros/s/AKfycbwgvOYTAeQsFH5EiA4LODyCHat7IA2GYpdroDiaRWzPPjl8JWboJZjBuRbJ6rgTc_fy/exec';

function storedApiBase() {
  try {
    return localStorage.getItem('dad:apiBase') || '';
  } catch (e) {
    return '';
  }
}

export const CONFIG = {
  get apiBase() {
    return (storedApiBase() || BUILT_IN_API_BASE).trim().replace(/\/+$/, '');
  },
  get isConfigured() {
    return /^https:\/\/script\.google(usercontent)?\.com\//.test(this.apiBase);
  },
  setApiBase(url) {
    try {
      if (url) localStorage.setItem('dad:apiBase', String(url).trim());
      else localStorage.removeItem('dad:apiBase');
    } catch (e) {
      /* private mode — the built-in value still applies */
    }
  },
  /** How long the public directory may be served from cache (ms). */
  cacheTtl: 5 * 60 * 1000,
  storageKeys: {
    token: 'dad:token',
    tokenExp: 'dad:tokenExpiry',
    theme: 'dad:theme',
    directory: 'dad:directoryCache',
    fingerprint: 'dad:fp'
  }
};
