/**
 * DAD — DCPA Advisers' Directory
 * Apps Script client.
 * Built and developed by Benedict de Jesus.
 *
 * Apps Script web apps cannot answer a CORS preflight, so writes are sent as
 * `text/plain` POSTs (a "simple request"). Public reads go out as GET, and if
 * that fails — some campus networks break the cross-origin redirect Apps
 * Script issues — we retry the same read over JSONP.
 *
 * Only faculty members ever reach the write half of this file. Student
 * browsing touches `meta`, `directory` and `faculty` and sends nothing
 * identifying.
 */

import { CONFIG } from './config.js';

export class ApiError extends Error {
  constructor(message, code = 0) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
  }
}

const PUBLIC_READS = new Set(['ping', 'meta', 'directory', 'faculty']);

/** A stable-but-anonymous id, used only for server-side login throttling. */
function fingerprint() {
  try {
    let fp = localStorage.getItem(CONFIG.storageKeys.fingerprint);
    if (!fp) {
      fp = (crypto.randomUUID ? crypto.randomUUID() : String(Math.random())).slice(0, 20);
      localStorage.setItem(CONFIG.storageKeys.fingerprint, fp);
    }
    return fp;
  } catch (e) {
    return 'anon';
  }
}

function requireBase() {
  if (!CONFIG.isConfigured) {
    throw new ApiError(
      'This site is not connected to its database yet. Add the Apps Script Web App URL in assets/js/config.js.',
      0
    );
  }
  return CONFIG.apiBase;
}

function unwrap(payload) {
  if (!payload || typeof payload !== 'object') {
    throw new ApiError('The server sent an unexpected response.', 502);
  }
  if (payload.ok) return payload.data;
  const err = payload.error || {};
  throw new ApiError(err.message || 'Something went wrong.', err.code || 500);
}

/* -------------------------------------------------------------------------- */

let jsonpSeq = 0;

function jsonp(action, params, timeoutMs = 20000) {
  return new Promise((resolve, reject) => {
    const name = `__dad_cb_${Date.now().toString(36)}_${jsonpSeq++}`;
    const query = new URLSearchParams({ ...params, action, callback: name });
    const script = document.createElement('script');

    const cleanup = () => {
      delete window[name];
      script.remove();
      clearTimeout(timer);
    };
    const timer = setTimeout(() => {
      cleanup();
      reject(new ApiError('The directory took too long to respond.', 504));
    }, timeoutMs);

    window[name] = (payload) => {
      cleanup();
      try { resolve(unwrap(payload)); } catch (e) { reject(e); }
    };
    script.onerror = () => {
      cleanup();
      reject(new ApiError('Could not reach the directory service.', 0));
    };

    script.src = `${requireBase()}?${query.toString()}`;
    document.head.appendChild(script);
  });
}

async function httpGet(action, params, signal) {
  const query = new URLSearchParams({ ...params, action });
  const res = await fetch(`${requireBase()}?${query.toString()}`, {
    method: 'GET',
    redirect: 'follow',
    signal
  });
  if (!res.ok) throw new ApiError(`Directory service error (${res.status}).`, res.status);
  return unwrap(await res.json());
}

async function httpPost(action, params, signal) {
  const res = await fetch(requireBase(), {
    method: 'POST',
    // text/plain keeps this a "simple request" so no preflight is needed.
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ ...params, action }),
    redirect: 'follow',
    signal
  });
  if (!res.ok) throw new ApiError(`Directory service error (${res.status}).`, res.status);
  return unwrap(await res.json());
}

/**
 * Calls one API action.
 * @param {string} action
 * @param {object} params
 * @param {{signal?: AbortSignal}} [options]
 */
export async function call(action, params = {}, options = {}) {
  const isRead = PUBLIC_READS.has(action);
  const payload = { ...params };
  if (action === 'login') payload.fp = fingerprint();

  try {
    return isRead
      ? await httpGet(action, payload, options.signal)
      : await httpPost(action, payload, options.signal);
  } catch (error) {
    if (error.name === 'AbortError') throw error;
    // Only network-level failures are worth retrying; a real API error
    // (bad code, expired session) would just fail again.
    const isNetwork = error instanceof TypeError || (error instanceof ApiError && error.code === 0);
    if (isRead && isNetwork) return jsonp(action, payload);
    if (error instanceof ApiError) throw error;
    throw new ApiError(
      'Could not reach the directory service. Check your connection and try again.',
      0
    );
  }
}

/* --------------------------------------------------------------------------
   Cached public reads
   -------------------------------------------------------------------------- */

function readCache(key) {
  try {
    const hit = JSON.parse(sessionStorage.getItem(key) || 'null');
    if (!hit || typeof hit.at !== 'number') return null;
    return { data: hit.data, age: Date.now() - hit.at };
  } catch (e) {
    return null;
  }
}

function writeCache(key, data) {
  try {
    sessionStorage.setItem(key, JSON.stringify({ at: Date.now(), data }));
  } catch (e) {
    /* quota or private mode — caching is optional */
  }
}

/**
 * Serves the directory from cache instantly when it is fresh, and revalidates
 * in the background when it is merely recent.
 * @param {(data:object)=>void} [onRefresh] called if a background fetch changes the data
 */
export async function getDirectory({ force = false, onRefresh } = {}) {
  const key = CONFIG.storageKeys.directory;
  const cached = force ? null : readCache(key);

  if (cached && cached.age < CONFIG.cacheTtl) {
    if (cached.age > CONFIG.cacheTtl / 2 && onRefresh) {
      call('directory')
        .then((fresh) => {
          writeCache(key, fresh);
          if (fresh.fetchedAt !== cached.data.fetchedAt) onRefresh(fresh);
        })
        .catch(() => {});
    }
    return cached.data;
  }

  try {
    const fresh = await call('directory');
    writeCache(key, fresh);
    return fresh;
  } catch (error) {
    // Better a slightly stale directory than a blank page.
    if (cached) return { ...cached.data, stale: true };
    throw error;
  }
}

export function clearDirectoryCache() {
  try { sessionStorage.removeItem(CONFIG.storageKeys.directory); } catch (e) {}
}

export const api = {
  meta: () => call('meta'),
  directory: getDirectory,
  faculty: (id) => call('faculty', { id }),

  login: (code) => call('login', { code }),
  session: (token) => call('session', { token }),
  logout: (token) => call('logout', { token }),

  saveProfile: (token, profile, facultyId) => call('saveProfile', { token, profile, facultyId }),
  uploadPhoto: (token, image, facultyId) => call('uploadPhoto', { token, image, facultyId }),
  removePhoto: (token, facultyId) => call('removePhoto', { token, facultyId }),
  saveSlot: (token, slot, facultyId) => call('saveSlot', { token, slot, facultyId }),
  deleteSlot: (token, id, facultyId) => call('deleteSlot', { token, id, facultyId }),
  rotateCode: (token) => call('rotateCode', { token }),
  archiveProfile: (token, confirm) => call('archiveProfile', { token, confirm }),

  adminList: (token) => call('adminList', { token }),
  adminCreate: (token, profile) => call('adminCreateFaculty', { token, profile }),
  adminUpdate: (token, facultyId, profile) => call('adminUpdateFaculty', { token, facultyId, profile }),
  adminIssueCode: (token, facultyId, label) => call('adminIssueCode', { token, facultyId, label }),
  adminRevokeCodes: (token, facultyId) => call('adminRevokeCodes', { token, facultyId }),
  adminDelete: (token, facultyId, confirm) => call('adminDeleteFaculty', { token, facultyId, confirm }),
  adminSetSetting: (token, key, value) => call('adminSetSetting', { token, key, value })
};
