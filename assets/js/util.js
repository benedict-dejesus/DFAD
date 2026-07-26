/**
 * DFAD — DOM helpers, safe templating and formatting.
 *
 * Everything a faculty member types ends up in a spreadsheet cell and then on
 * this page, so `html` escapes every interpolation by default. Use `raw()`
 * only for markup this codebase produced.
 */

/* --------------------------------------------------------------------------
   Safe templating
   -------------------------------------------------------------------------- */

const RAW = Symbol('dad.raw');

export function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function raw(markup) {
  return { [RAW]: String(markup ?? '') };
}

function flatten(value) {
  if (value === null || value === undefined || value === false || value === true) return '';
  if (Array.isArray(value)) return value.map(flatten).join('');
  if (typeof value === 'object' && RAW in value) return value[RAW];
  return esc(value);
}

/** Tagged template that escapes interpolations and returns a raw fragment. */
export function html(strings, ...values) {
  let out = strings[0];
  for (let i = 0; i < values.length; i++) out += flatten(values[i]) + strings[i + 1];
  return raw(out);
}

/** Renders a raw fragment (or string) into an element. */
export function render(target, fragment) {
  target.innerHTML = flatten(fragment);
  return target;
}

/** Builds a detached element from a raw fragment. */
export function el(fragment) {
  const tpl = document.createElement('template');
  tpl.innerHTML = flatten(fragment).trim();
  return tpl.content.firstElementChild;
}

/** Only ever emit URLs we have vetted — blocks `javascript:` and friends. */
export function safeUrl(url) {
  const s = String(url ?? '').trim();
  return /^(https?:|mailto:|tel:)/i.test(s) ? s : '#';
}

/* --------------------------------------------------------------------------
   DOM
   -------------------------------------------------------------------------- */

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

export function on(target, type, handler, options) {
  target.addEventListener(type, handler, options);
  return () => target.removeEventListener(type, handler, options);
}

/** Event delegation: `delegate(list, 'click', '[data-id]', fn)`. */
export function delegate(root, type, selector, handler) {
  return on(root, type, (event) => {
    const match = event.target.closest(selector);
    if (match && root.contains(match)) handler(event, match);
  });
}

export function debounce(fn, wait = 220) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), wait);
  };
}

/** Fades content in as it scrolls into view, with a small stagger. */
export function revealOnScroll(root = document, step = 45) {
  const nodes = $$('.reveal:not(.is-in)', root);
  if (!nodes.length) return;

  if (!('IntersectionObserver' in window) ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    nodes.forEach((n) => n.classList.add('is-in'));
    return;
  }

  const io = new IntersectionObserver((entries, observer) => {
    let shown = 0;
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.style.setProperty('--stagger', `${shown++ * step}ms`);
      entry.target.classList.add('is-in');
      observer.unobserve(entry.target);
    });
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.05 });

  nodes.forEach((n) => io.observe(n));
}

/** Runs an update inside a View Transition when the browser supports it. */
export function transition(update) {
  if (!document.startViewTransition ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    update();
    return;
  }
  document.startViewTransition(update);
}

/** Traps Tab within a container and restores focus when released. */
export function trapFocus(container) {
  const previous = document.activeElement;
  const selector =
    'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]),' +
    ' textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

  const onKey = (event) => {
    if (event.key !== 'Tab') return;
    const items = $$(selector, container).filter((n) => n.offsetParent !== null);
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  container.addEventListener('keydown', onKey);
  requestAnimationFrame(() => {
    const target = container.querySelector('[autofocus]') || $$(selector, container)[0];
    if (target) target.focus({ preventScroll: true });
  });

  return () => {
    container.removeEventListener('keydown', onKey);
    if (previous && previous.isConnected) previous.focus({ preventScroll: true });
  };
}

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (e) {
    // Clipboard API needs a secure context; fall back to a hidden textarea.
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.cssText = 'position:fixed;top:-1000px;opacity:0';
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch (err) { ok = false; }
    ta.remove();
    return ok;
  }
}

/* --------------------------------------------------------------------------
   Formatting
   -------------------------------------------------------------------------- */

export const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

/** "13:30" -> "1:30 PM" */
export function fmtTime(hhmm) {
  const parts = String(hhmm || '').split(':');
  if (parts.length < 2) return String(hhmm || '');
  const h = Number(parts[0]);
  const m = parts[1].padStart(2, '0');
  if (Number.isNaN(h)) return String(hhmm);
  const suffix = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${m} ${suffix}`;
}

export function fmtRange(start, end) {
  return `${fmtTime(start)} – ${fmtTime(end)}`;
}

export function shortDay(day) {
  return String(day || '').slice(0, 3);
}

export function initials(name) {
  const words = String(name || '')
    .replace(/\b(?:Dr|Prof|Mr|Ms|Mrs|Engr|Atty)\.?\s*/gi, '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!words.length) return '?';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

export function fullName(person) {
  return [person.honorific, person.name, person.suffix].filter(Boolean).join(' ').trim();
}

/** "3 days ago" style, falling back to a plain date past a week. */
export function relTime(iso) {
  const t = Date.parse(iso || '');
  if (!t) return '';
  const diff = Date.now() - t;
  const mins = Math.round(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} hr${hours === 1 ? '' : 's'} ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days} day${days === 1 ? '' : 's'} ago`;
  return new Date(t).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

/** Weekday order, then start time. The server sorts too — this is belt and braces. */
export function sortSlots(slots) {
  return (slots || []).slice().sort((a, b) =>
    DAYS.indexOf(a.day) - DAYS.indexOf(b.day) || String(a.start).localeCompare(String(b.start)));
}

export function todayName() {
  return DAYS[(new Date().getDay() + 6) % 7];
}

/** True when `slot` is happening right now (used for the "live" highlight). */
export function isSlotNow(slot) {
  if (slot.day !== todayName()) return false;
  const now = new Date();
  const mins = now.getHours() * 60 + now.getMinutes();
  const toMins = (v) => {
    const p = String(v || '').split(':');
    return Number(p[0]) * 60 + Number(p[1] || 0);
  };
  return mins >= toMins(slot.start) && mins < toMins(slot.end);
}

export function plural(n, one, many) {
  return `${n} ${n === 1 ? one : many || `${one}s`}`;
}

/* --------------------------------------------------------------------------
   Misc
   -------------------------------------------------------------------------- */

/** Case/diacritic-insensitive haystack for the search box. */
export function normalize(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/gu, '');
}

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
