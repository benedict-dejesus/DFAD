/**
 * DAD — application state.
 *
 * A tiny observable store: views subscribe, mutations notify. No framework,
 * no build step, and the whole state is inspectable from the console via
 * `window.__DAD__`.
 */

import { CONFIG } from './config.js';
import { api, clearDirectoryCache } from './api.js';

const listeners = new Set();

export const state = {
  meta: null,
  faculty: [],
  fetchedAt: '',
  loading: false,
  error: null,
  stale: false,

  // portal session
  token: '',
  role: '',
  profile: null,

  // directory filters
  filters: {
    query: '',
    affiliation: 'all',
    program: 'all',
    role: 'all',
    day: 'all',
    sort: 'name'
  }
};

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function notify() {
  listeners.forEach((fn) => {
    try {
      fn(state);
    } catch (e) {
      console.error('store listener failed', e);
    }
  });
}

/* --------------------------------------------------------------------------
   Session persistence
   -------------------------------------------------------------------------- */

export function loadStoredSession() {
  try {
    const token = localStorage.getItem(CONFIG.storageKeys.token) || '';
    const exp = Number(localStorage.getItem(CONFIG.storageKeys.tokenExp) || 0);
    if (token && exp > Date.now()) {
      state.token = token;
      return token;
    }
  } catch (e) {
    /* private mode */
  }
  clearStoredSession();
  return '';
}

export function storeSession(token, expiresAt) {
  state.token = token;
  try {
    localStorage.setItem(CONFIG.storageKeys.token, token);
    localStorage.setItem(
      CONFIG.storageKeys.tokenExp,
      String(Date.parse(expiresAt) || Date.now() + 6 * 3600 * 1000)
    );
  } catch (e) {}
}

export function clearStoredSession() {
  state.token = '';
  state.role = '';
  state.profile = null;
  try {
    localStorage.removeItem(CONFIG.storageKeys.token);
    localStorage.removeItem(CONFIG.storageKeys.tokenExp);
  } catch (e) {}
}

/* --------------------------------------------------------------------------
   Actions
   -------------------------------------------------------------------------- */

export async function loadMeta() {
  if (state.meta) return state.meta;
  try {
    state.meta = await api.meta();
  } catch (e) {
    // The site still works without the settings tab; fall back to defaults.
    state.meta = {
      site: {
        title: "DAD — DCPA Advisers' Directory",
        tagline: 'Department of Communication and Performing Arts',
        college: 'College of Arts and Letters',
        university: 'Bulacan State University'
      },
      options: null
    };
  }
  notify();
  return state.meta;
}

export async function loadDirectory({ force = false } = {}) {
  state.loading = true;
  state.error = null;
  notify();
  try {
    const data = await api.directory({
      force,
      onRefresh: (fresh) => {
        state.faculty = fresh.faculty || [];
        state.fetchedAt = fresh.fetchedAt || '';
        state.stale = false;
        notify();
      }
    });
    state.faculty = data.faculty || [];
    state.fetchedAt = data.fetchedAt || '';
    state.stale = Boolean(data.stale);
  } catch (error) {
    state.error = error;
  } finally {
    state.loading = false;
    notify();
  }
  return state.faculty;
}

export function invalidateDirectory() {
  clearDirectoryCache();
}

export async function restoreSession() {
  const token = loadStoredSession();
  if (!token) return null;
  try {
    const data = await api.session(token);
    state.role = data.role;
    state.profile = data.profile;
    notify();
    return data;
  } catch (e) {
    clearStoredSession();
    notify();
    return null;
  }
}

export async function signIn(code) {
  const data = await api.login(code);
  storeSession(data.token, data.expiresAt);
  state.role = data.role;
  state.profile = data.profile;
  notify();
  return data;
}

export async function signOut() {
  const token = state.token;
  clearStoredSession();
  notify();
  if (token) {
    try { await api.logout(token); } catch (e) {}
  }
}

export function setProfile(profile) {
  state.profile = profile;
  invalidateDirectory();
  notify();
}

export function setFilter(patch) {
  Object.assign(state.filters, patch);
  notify();
}

export function resetFilters() {
  state.filters = { query: '', affiliation: 'all', program: 'all', role: 'all', day: 'all', sort: 'name' };
  notify();
}

/* --------------------------------------------------------------------------
   Derived data
   -------------------------------------------------------------------------- */

const ROLE_KEYS = { adviser: 'adviser', consultant: 'consultant', critic: 'critic', media: 'media' };

/** Matches the current filters against the loaded faculty list. */
export function visibleFaculty(normalize) {
  const f = state.filters;
  const needle = normalize(f.query).trim();
  const terms = needle ? needle.split(/\s+/) : [];

  let list = state.faculty.filter((person) => {
    if (f.affiliation !== 'all' && person.affiliation !== f.affiliation) return false;
    if (f.program !== 'all' && !(person.programs || []).includes(f.program)) return false;

    if (f.role !== 'all') {
      const key = ROLE_KEYS[f.role];
      const stateOf = (person.roles || {})[key];
      if (stateOf !== 'Open' && stateOf !== 'Limited') return false;
    }

    if (f.day !== 'all' && !(person.slots || []).some((s) => s.day === f.day)) return false;

    if (terms.length) {
      const hay = normalize([
        person.name, person.honorific, person.suffix, person.rank, person.department,
        (person.programs || []).join(' '),
        (person.expertise || []).join(' '),
        person.bio, person.office, person.availabilityNote
      ].filter(Boolean).join(' '));
      if (!terms.every((t) => hay.includes(t))) return false;
    }
    return true;
  });

  const openCount = (p) =>
    Object.values(p.roles || {}).filter((v) => v === 'Open').length * 2 +
    Object.values(p.roles || {}).filter((v) => v === 'Limited').length;

  const sorters = {
    name: (a, b) => a.name.localeCompare(b.name),
    availability: (a, b) => openCount(b) - openCount(a) || a.name.localeCompare(b.name),
    slots: (a, b) => (b.slots || []).length - (a.slots || []).length || a.name.localeCompare(b.name),
    updated: (a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || ''))
  };
  list = list.slice().sort(sorters[f.sort] || sorters.name);
  return list;
}

/** Counts used for the filter chips, so students see what is worth tapping. */
export function facetCounts() {
  const counts = { affiliation: {}, program: {}, role: { adviser: 0, consultant: 0, critic: 0, media: 0 }, day: {} };
  state.faculty.forEach((p) => {
    counts.affiliation[p.affiliation] = (counts.affiliation[p.affiliation] || 0) + 1;
    (p.programs || []).forEach((prog) => {
      counts.program[prog] = (counts.program[prog] || 0) + 1;
    });
    Object.keys(ROLE_KEYS).forEach((key) => {
      const v = (p.roles || {})[key];
      if (v === 'Open' || v === 'Limited') counts.role[key] += 1;
    });
    const days = new Set((p.slots || []).map((s) => s.day));
    days.forEach((d) => { counts.day[d] = (counts.day[d] || 0) + 1; });
  });
  return counts;
}

export function findFaculty(id) {
  return state.faculty.find((p) => p.id === id) || null;
}

/** All consultation slots across the department, grouped by weekday. */
export function slotsByDay() {
  const byDay = {};
  state.faculty.forEach((person) => {
    (person.slots || []).forEach((slot) => {
      (byDay[slot.day] = byDay[slot.day] || []).push({ ...slot, person });
    });
  });
  Object.values(byDay).forEach((list) =>
    list.sort((a, b) => String(a.start).localeCompare(String(b.start)) || a.person.name.localeCompare(b.person.name))
  );
  return byDay;
}
