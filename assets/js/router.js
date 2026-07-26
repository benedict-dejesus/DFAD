/**
 * DAD — hash router.
 *
 * Hash routing keeps GitHub Pages happy: every URL is served by index.html,
 * so deep links like #/faculty/fac_123 survive a refresh with no 404 rules.
 *
 * In-app links (`<a href="#/...">`) are intercepted and pushed through
 * `navigate()` so that history entries carry a depth marker. That marker is
 * what lets `back()` know whether going back would leave the site.
 */

const routes = [];
let current = { name: '', path: '', params: {} };
let onChange = null;
let started = false;

/**
 * Registers a route.
 * @param {string} pattern e.g. "/faculty/:id"
 * @param {string} name
 */
export function route(pattern, name) {
  const keys = [];
  const regex = new RegExp(
    '^' +
      pattern
        .replace(/\/+$/, '')
        .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        .replace(/:(\w+)/g, (_, key) => {
          keys.push(key);
          return '([^/]+)';
        }) +
      '/?$'
  );
  routes.push({ name, regex, keys });
  return { pattern, name };
}

export function parseHash(hash = location.hash) {
  const path = '/' + String(hash || '').replace(/^#\/?/, '').replace(/\/+$/, '');
  for (const entry of routes) {
    const match = entry.regex.exec(path);
    if (!match) continue;
    const params = {};
    entry.keys.forEach((key, i) => {
      params[key] = decodeURIComponent(match[i + 1]);
    });
    return { name: entry.name, path, params };
  }
  return { name: 'notfound', path, params: {} };
}

export function currentRoute() {
  return current;
}

function depth() {
  return (history.state && typeof history.state.d === 'number') ? history.state.d : 0;
}

/**
 * Navigates within the app.
 * @param {string} path
 * @param {{replace?:boolean}} [options]
 */
export function navigate(path, { replace = false } = {}) {
  const target = '#' + (path.startsWith('/') ? path : '/' + path);
  const url = location.pathname + location.search + target;

  if (replace) history.replaceState({ d: depth() }, '', url);
  else history.pushState({ d: depth() + 1 }, '', url);

  handle();
}

/** Goes back if we have somewhere to go, otherwise falls back to a route. */
export function back(fallback = '/') {
  if (depth() > 0) history.back();
  else navigate(fallback, { replace: true });
}

function handle() {
  const next = parseHash();
  const previous = current;
  current = next;
  if (onChange) onChange(next, previous);
}

export function startRouter(handler) {
  if (started) return;
  started = true;
  onChange = handler;

  // Give the entry point a depth so `back()` knows it is the first page.
  history.replaceState({ d: 0 }, '', location.href);

  window.addEventListener('popstate', handle);
  // Covers manual URL edits and any link we did not intercept.
  window.addEventListener('hashchange', () => {
    if (current.path !== parseHash().path) handle();
  });

  document.addEventListener('click', (event) => {
    if (event.defaultPrevented || event.button !== 0) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const link = event.target.closest('a[href^="#/"]');
    if (!link || link.target === '_blank') return;
    event.preventDefault();
    navigate(link.getAttribute('href').slice(1));
  });

  handle();
}
