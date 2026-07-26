/**
 * DFAD — DCPA Faculty Advisers' Directory
 * Application bootstrap.
 * Built and developed by Benedict de Jesus.
 *
 * Wires the router to lazily-loaded views, keeps the chrome (theme, nav
 * highlighting, titles) in sync, and restores any saved faculty session.
 *
 * Two dashboards live behind this router: the student directory (open to
 * everyone, read-only) and the faculty dashboard (access code required).
 */

import { $, $$, html, render, on, transition } from './util.js';
import { CONFIG } from './config.js';
import { icon, toast } from './ui.js';
import { state, subscribe, loadMeta, loadDirectory, restoreSession } from './store.js';
import { route, startRouter, navigate, back, currentRoute } from './router.js';

/* --------------------------------------------------------------------------
   Routes
   -------------------------------------------------------------------------- */

route('/', 'home');
route('/schedules', 'schedules');
route('/portal', 'portal');
route('/about', 'about');
route('/faculty/:id', 'faculty');

const VIEWS = {
  home: () => import('./views/home.js'),
  schedules: () => import('./views/schedules.js'),
  portal: () => import('./views/portal.js'),
  about: () => import('./views/about.js')
};

const TITLES = {
  home: 'Advisers',
  schedules: 'Consultation hours',
  portal: 'Faculty dashboard',
  about: 'About'
};

/* --------------------------------------------------------------------------
   View lifecycle
   -------------------------------------------------------------------------- */

const viewHost = $('#view');
let mountedName = '';
let unmountCurrent = null;

async function mountView(name) {
  if (mountedName === name) return;
  const loader = VIEWS[name];
  if (!loader) {
    mountedName = 'notfound';
    if (unmountCurrent) unmountCurrent();
    unmountCurrent = null;
    render(viewHost, notFound());
    return;
  }

  const module = await loader();
  if (unmountCurrent) unmountCurrent();
  unmountCurrent = null;
  mountedName = name;

  transition(() => {
    unmountCurrent = module.mount(viewHost) || null;
  });

  window.scrollTo(0, 0);
}

function notFound() {
  return html`
    <div class="shell">
      <div class="empty" style="margin-top:32px">
        ${icon('empty')}
        <h3>Page not found</h3>
        <p>That link does not lead anywhere in DFAD.</p>
        <a class="btn btn--primary" href="#/">${icon('back', 'btn__icon')} Back to the directory</a>
      </div>
    </div>`;
}

/* --------------------------------------------------------------------------
   Faculty detail overlay
   -------------------------------------------------------------------------- */

let sheetClose = null;
let sheetId = null;
let sheetSuppressBack = false;

async function openFacultySheet(id) {
  const { openFacultyDetail } = await import('./views/faculty.js');
  sheetId = id;
  sheetClose = await openFacultyDetail(id, {
    onClose() {
      const suppress = sheetSuppressBack;
      sheetSuppressBack = false;
      sheetClose = null;
      sheetId = null;
      // Closing by tapping the scrim or pressing Escape should also step the
      // URL back out of /faculty/:id.
      if (!suppress && currentRoute().name === 'faculty') back('/');
    }
  });
}

function closeFacultySheet() {
  if (!sheetClose) return;
  sheetSuppressBack = true;
  sheetClose();
  sheetClose = null;
  sheetId = null;
}

/* --------------------------------------------------------------------------
   Chrome
   -------------------------------------------------------------------------- */

function syncNav(name) {
  const key = name === 'faculty' ? 'home' : name;
  $$('[data-nav]').forEach((link) => {
    if (link.dataset.nav === key) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });

  const site = state.meta?.site;
  const base = site?.title || "DFAD — DCPA Faculty Advisers' Directory";
  document.title = TITLES[key] ? `${TITLES[key]} · ${base}` : base;
}

function syncSiteChrome() {
  const site = state.meta?.site;
  if (!site) return;
  const footer = $('#footerMeta');
  if (footer) {
    footer.textContent = [
      site.department || 'Department of Communication and Performing Arts',
      site.college,
      site.university,
      site.term
    ].filter(Boolean).join(' · ');
  }
  // Names are editable from the coordinator dashboard — officers change, and
  // the footer should follow the setting rather than the hard-coded fallback.
  const bind = (attr, value) => {
    if (!value) return;
    $$(`[${attr}]`).forEach((node) => { node.textContent = value; });
  };
  bind('data-author', site.author || 'Benedict de Jesus');
  bind('data-proponent', site.proponent);
  bind('data-dean', site.dean);
  bind('data-chair', site.chair);
}

function setupTheme() {
  const button = $('#themeToggle');
  const apply = (value) => {
    if (value === 'auto') delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = value;
    try {
      if (value === 'auto') localStorage.removeItem(CONFIG.storageKeys.theme);
      else localStorage.setItem(CONFIG.storageKeys.theme, value);
    } catch (e) {}
  };

  on(button, 'click', () => {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const currentIsDark = document.documentElement.dataset.theme
      ? document.documentElement.dataset.theme === 'dark'
      : prefersDark;
    apply(currentIsDark ? 'light' : 'dark');
  });
}

function setupStickyHeader() {
  const bar = $('#topbar');
  let ticking = false;
  on(window, 'scroll', () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      bar.classList.toggle('is-stuck', window.scrollY > 4);
      ticking = false;
    });
  }, { passive: true });
}

/* --------------------------------------------------------------------------
   Boot
   -------------------------------------------------------------------------- */

async function handleRoute(next, previous) {
  if (next.name === 'faculty') {
    // Keep whatever view is underneath; land on the directory for deep links.
    if (!mountedName) await mountView('home');
    if (sheetId === next.params.id) return;
    closeFacultySheet();
    await openFacultySheet(next.params.id);
    syncNav(next.name);
    return;
  }

  closeFacultySheet();
  await mountView(next.name === 'notfound' ? 'notfound' : next.name);
  syncNav(next.name);

  if (previous && previous.name && next.name !== previous.name) {
    $('#main')?.focus({ preventScroll: true });
  }
}

function unconfiguredBanner() {
  return html`
    <div class="shell">
      <div class="panel setup-card" style="margin-top:24px">
        <div class="row" style="gap:12px;margin-bottom:12px">
          <span class="avatar" style="--size:44px;border-radius:14px">${icon('link')}</span>
          <h1 class="panel__title" style="font-size:var(--fs-xl)">Almost there</h1>
        </div>
        <p class="panel__sub">
          DFAD is built and deployed, but it does not know where its data lives yet.
        </p>
        <ol class="stack stack--tight" style="list-style:decimal;padding-left:20px;margin-bottom:16px">
          <li>Follow <code>apps-script/GUIDE.md</code> to create the spreadsheet and deploy the Web App.</li>
          <li>Copy the deployment URL — it ends in <code>/exec</code>.</li>
          <li>Paste it into <code>BUILT_IN_API_BASE</code> in <code>assets/js/config.js</code> and commit.</li>
        </ol>
        <p style="margin-top:18px">
          <span class="credit">${icon('star')} DFAD by <b>Benedict de Jesus</b></span>
        </p>
      </div>
    </div>`;
}

async function boot() {
  setupTheme();
  setupStickyHeader();

  const year = $('#footerYear');
  if (year) year.textContent = String(new Date().getFullYear());

  // `?mock` runs the whole site against sample data with no backend at all.
  // See dev/mock.js — it is never loaded otherwise.
  if (new URLSearchParams(location.search).has('mock')) {
    await import('../../dev/mock.js');
  }

  if (!CONFIG.isConfigured) {
    render(viewHost, unconfiguredBanner());
    // About is static, so it still reads fine with no backend. Everything
    // else needs data and would only show an error, so it stays on the banner.
    startRouter(async (next) => {
      if (next.name === 'about') {
        await mountView('about');
        syncNav('about');
      } else {
        mountedName = '';
        render(viewHost, unconfiguredBanner());
        syncNav(next.name);
      }
    });
    return;
  }

  subscribe(() => {
    syncSiteChrome();
    syncNav(currentRoute().name);
  });

  loadMeta();
  restoreSession();
  startRouter(handleRoute);
  loadDirectory();

  // A tap on the already-active tab scrolls back to the top.
  on(document, 'click', (event) => {
    const link = event.target.closest('[data-nav][aria-current="page"]');
    if (link) window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  window.addEventListener('online', () => {
    toast('Back online — refreshing the directory.', 'ok', 2500);
    loadDirectory({ force: true });
  });
  window.addEventListener('offline', () => {
    toast('You are offline. Showing the last saved copy.', 'err', 4000);
  });

  // Handy while marking papers at 1am, and harmless in production.
  window.__DFAD__ = { state, navigate, loadDirectory, CONFIG };
}

boot().catch((error) => {
  console.error(error);
  render(viewHost, html`
    <div class="shell">
      <div class="empty" style="margin-top:32px">
        ${icon('alert')}
        <h3>DFAD failed to start</h3>
        <p>${error?.message || 'An unexpected error occurred.'}</p>
        <button class="btn btn--primary" type="button" onclick="location.reload()">Reload</button>
      </div>
    </div>`);
});
