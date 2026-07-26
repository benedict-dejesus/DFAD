/**
 * DAD — shared interface pieces: toasts, bottom-sheet dialogs, confirmations,
 * the top progress bar, and the small icon set used across views.
 */

import { $, html, raw, el, render, on, trapFocus, copyText } from './util.js';

/* --------------------------------------------------------------------------
   Icons (stroked, 24x24, inherit currentColor)
   -------------------------------------------------------------------------- */

const PATHS = {
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  check: '<path d="m5 13 4 4 10-10"/>',
  alert: '<path d="M12 8v5M12 16.5v.5"/><circle cx="12" cy="12" r="9"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 7.6v.6"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="3"/><path d="m3.5 7.5 7.2 5a2.2 2.2 0 0 0 2.6 0l7.2-5"/>',
  phone: '<path d="M6.5 3h3l1.5 4-2 1.5a12 12 0 0 0 5.5 5.5L16 12l4 1.5v3a2 2 0 0 1-2.2 2A16.5 16.5 0 0 1 4.5 5.2 2 2 0 0 1 6.5 3Z"/>',
  pin: '<path d="M12 21s7-5.5 7-11a7 7 0 1 0-14 0c0 5.5 7 11 7 11Z"/><circle cx="12" cy="10" r="2.6"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7.5V12l3 1.8"/>',
  video: '<rect x="3" y="6" width="12" height="12" rx="3"/><path d="m15 11 6-3.5v9L15 13z"/>',
  users: '<circle cx="9" cy="8" r="3.2"/><path d="M2.5 19a6.5 6.5 0 0 1 13 0"/><path d="M16 5.5a3.2 3.2 0 0 1 0 6M17.5 19a6.5 6.5 0 0 0-2-4.7"/>',
  spark: '<path d="M12 3.5 13.8 9l5.7 1.8-5.7 1.8L12 18l-1.8-5.4-5.7-1.8L10.2 9z"/>',
  link: '<path d="M10 13.5a4 4 0 0 0 5.7 0l2.6-2.6a4 4 0 1 0-5.7-5.7L11.5 6.4"/><path d="M14 10.5a4 4 0 0 0-5.7 0l-2.6 2.6a4 4 0 1 0 5.7 5.7l1.1-1.1"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  trash: '<path d="M4 7h16M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7"/><path d="M6.5 7 7.6 19a2 2 0 0 0 2 1.8h4.8a2 2 0 0 0 2-1.8L17.5 7"/>',
  edit: '<path d="M4 20h4L19 9a2.5 2.5 0 0 0-3.5-3.5L4.5 16.5z"/>',
  logout: '<path d="M14 4h3.5A2.5 2.5 0 0 1 20 6.5v11a2.5 2.5 0 0 1-2.5 2.5H14"/><path d="M10 8 6 12l4 4M6 12h9"/>',
  copy: '<rect x="9" y="9" width="11" height="11" rx="2.5"/><path d="M15 5.5A1.5 1.5 0 0 0 13.5 4h-7A2.5 2.5 0 0 0 4 6.5v7A1.5 1.5 0 0 0 5.5 15"/>',
  download: '<path d="M12 4v11M8 11.5l4 4 4-4"/><path d="M5 19.5h14"/>',
  refresh: '<path d="M20 12a8 8 0 1 1-2.6-5.9"/><path d="M20 4v4h-4"/>',
  shield: '<path d="M12 3.5 19 6v5.5c0 4-2.9 7.5-7 9-4.1-1.5-7-5-7-9V6z"/><path d="m9.2 12 2 2 3.6-3.8"/>',
  key: '<circle cx="8.5" cy="12" r="4"/><path d="M12.5 12H21M18 12v3M15.5 12v2.2"/>',
  empty: '<path d="M4 8.5 12 4l8 4.5v7L12 20l-8-4.5z"/><path d="m4 8.5 8 4.5 8-4.5M12 13v7"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  back: '<path d="M19 12H5M11 6l-6 6 6 6"/>',
  filter: '<path d="M4 6h16M7 12h10M10 18h4"/>',
  facebook: '<path d="M14 8.5V7a1.5 1.5 0 0 1 1.5-1.5H17V3h-2.2A3.8 3.8 0 0 0 11 6.8v1.7H9V11h2v10h3V11h2.2l.5-2.5z"/>',
  linkedin: '<rect x="3" y="3" width="18" height="18" rx="3"/><path d="M7.5 10.5V17M7.5 7.4v.2M11.5 17v-3.6a2.4 2.4 0 0 1 4.8 0V17M11.5 17v-6.5"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3.5 9.5h17M3.5 14.5h17"/><path d="M12 3a15 15 0 0 1 0 18 15 15 0 0 1 0-18Z"/>',
  camera: '<path d="M4 8.5h3l1.4-2.2h7.2L17 8.5h3a1 1 0 0 1 1 1V18a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9.5a1 1 0 0 1 1-1Z"/><circle cx="12" cy="13.2" r="3.4"/>',
  upload: '<path d="M12 16V5M8 8.5 12 4.5l4 4"/><path d="M5 19.5h14"/>',
  student: '<path d="M12 4 2.5 9 12 14l9.5-5z"/><path d="M6.5 11.2V16c0 1.4 2.5 2.6 5.5 2.6s5.5-1.2 5.5-2.6v-4.8M21 9.5v5"/>',
  star: '<path d="m12 4 2.4 5 5.6.8-4 3.9 1 5.5-5-2.6-5 2.6 1-5.5-4-3.9 5.6-.8z"/>',
  clipboard: '<rect x="5" y="5" width="14" height="16" rx="2.5"/><path d="M9 5V4a1.5 1.5 0 0 1 1.5-1.5h3A1.5 1.5 0 0 1 15 4v1"/><path d="M9 11h6M9 15h4"/>'
};

/** `icon('mail')` -> raw <svg> fragment. */
export function icon(name, className = '') {
  const body = PATHS[name] || PATHS.info;
  return html`<svg viewBox="0 0 24 24" aria-hidden="true"${className ? raw(` class="${className}"`) : ''}>${raw(body)}</svg>`;
}

/* --------------------------------------------------------------------------
   Progress bar
   -------------------------------------------------------------------------- */

let progressTimer;

export const progress = {
  start() {
    const bar = $('#progress');
    if (!bar) return;
    clearTimeout(progressTimer);
    bar.classList.remove('is-done');
    bar.classList.add('is-active');
  },
  done() {
    const bar = $('#progress');
    if (!bar) return;
    bar.classList.remove('is-active');
    bar.classList.add('is-done');
    progressTimer = setTimeout(() => bar.classList.remove('is-done'), 320);
  }
};

/* --------------------------------------------------------------------------
   Toasts
   -------------------------------------------------------------------------- */

/**
 * @param {string} message
 * @param {'info'|'ok'|'err'} [tone]
 * @param {number} [ms] 0 keeps it until dismissed
 */
export function toast(message, tone = 'info', ms = 4200) {
  const host = $('#toastHost');
  if (!host) return () => {};

  const glyph = tone === 'ok' ? 'check' : tone === 'err' ? 'alert' : 'info';
  const node = el(html`
    <div class="toast toast--${tone === 'info' ? '' : tone}" role="${tone === 'err' ? 'alert' : 'status'}">
      ${icon(glyph)}
      <div>${message}</div>
      <button class="toast__close" type="button" aria-label="Dismiss">${icon('close')}</button>
    </div>
  `);

  const close = () => {
    if (!node.isConnected) return;
    node.classList.add('is-closing');
    node.addEventListener('animationend', () => node.remove(), { once: true });
    setTimeout(() => node.remove(), 400);
  };

  node.querySelector('.toast__close').addEventListener('click', close);
  host.appendChild(node);
  if (ms > 0) setTimeout(close, ms);

  // Never let toasts stack past a readable number.
  while (host.children.length > 3) host.firstElementChild.remove();
  return close;
}

/* --------------------------------------------------------------------------
   Bottom sheet / dialog
   -------------------------------------------------------------------------- */

let openSheets = 0;

/**
 * Opens a modal sheet (bottom drawer on phones, centred dialog on desktop).
 * @param {{title:string, subtitle?:string, body:any, footer?:any,
 *          size?:string, onMount?:(node:HTMLElement, close:Function)=>void,
 *          onClose?:Function}} options
 * @returns {(result?:any)=>void} close
 */
export function openSheet(options) {
  const { title, subtitle = '', body, footer = null, onMount, onClose } = options;

  const scrim = el(html`<div class="scrim"></div>`);
  const sheet = el(html`
    <div class="sheet" role="dialog" aria-modal="true" aria-label="${title}">
      <div class="sheet__grab" aria-hidden="true"></div>
      <header class="sheet__head">
        <div>
          <h2 class="sheet__title">${title}</h2>
          ${subtitle ? html`<p class="sheet__sub">${subtitle}</p>` : ''}
        </div>
        <button class="icon-btn sheet__close" type="button" aria-label="Close">${icon('close')}</button>
      </header>
      <div class="sheet__body"></div>
      ${footer ? html`<footer class="sheet__foot"></footer>` : ''}
    </div>
  `);

  render(sheet.querySelector('.sheet__body'), body);
  if (footer) render(sheet.querySelector('.sheet__foot'), footer);

  const host = $('#sheetHost');
  host.append(scrim, sheet);
  openSheets += 1;
  document.body.classList.add('is-locked');

  const releaseFocus = trapFocus(sheet);
  let closed = false;

  const close = (result) => {
    if (closed) return;
    closed = true;
    scrim.classList.add('is-closing');
    sheet.classList.add('is-closing');
    releaseFocus();
    offEsc();
    offScrim();
    detachDrag();
    setTimeout(() => {
      scrim.remove();
      sheet.remove();
      openSheets = Math.max(0, openSheets - 1);
      if (!openSheets) document.body.classList.remove('is-locked');
      if (onClose) onClose(result);
    }, 220);
  };

  const offScrim = on(scrim, 'click', () => close());
  sheet.querySelector('.sheet__close').addEventListener('click', () => close());
  const offEsc = on(document, 'keydown', (event) => {
    if (event.key === 'Escape') {
      event.stopPropagation();
      close();
    }
  });

  const detachDrag = attachSwipeToClose(sheet, close);
  if (onMount) onMount(sheet, close);
  return close;
}

/** Drag the sheet down past a threshold on touch devices to dismiss it. */
function attachSwipeToClose(sheet, close) {
  if (!window.matchMedia('(max-width: 759px)').matches) return () => {};

  let startY = 0;
  let delta = 0;
  let dragging = false;
  const body = sheet.querySelector('.sheet__body');

  const start = (event) => {
    if (body.scrollTop > 0) return;
    startY = event.touches[0].clientY;
    delta = 0;
    dragging = true;
    sheet.style.transition = 'none';
  };
  const move = (event) => {
    if (!dragging) return;
    delta = event.touches[0].clientY - startY;
    if (delta <= 0) return;
    sheet.style.transform = `translateY(${delta}px)`;
  };
  const end = () => {
    if (!dragging) return;
    dragging = false;
    sheet.style.transition = '';
    sheet.style.transform = '';
    if (delta > 110) close();
  };

  sheet.addEventListener('touchstart', start, { passive: true });
  sheet.addEventListener('touchmove', move, { passive: true });
  sheet.addEventListener('touchend', end);

  return () => {
    sheet.removeEventListener('touchstart', start);
    sheet.removeEventListener('touchmove', move);
    sheet.removeEventListener('touchend', end);
  };
}

/**
 * Confirmation dialog. Resolves true only if the user confirms.
 * Pass `requireText` to demand an exact typed phrase for destructive actions.
 */
export function confirmDialog({
  title,
  message,
  confirmLabel = 'Confirm',
  tone = 'danger',
  requireText = ''
}) {
  return new Promise((resolve) => {
    let settled = false;

    const close = openSheet({
      title,
      body: html`
        <div class="stack">
          <p>${message}</p>
          ${requireText
            ? html`
              <div class="field">
                <label for="confirmText">Type <b>${requireText}</b> to continue</label>
                <input class="input" id="confirmText" autocomplete="off" autocapitalize="characters"
                       spellcheck="false" placeholder="${requireText}">
              </div>`
            : ''}
        </div>
      `,
      footer: html`
        <button class="btn" data-act="cancel" type="button">Cancel</button>
        <span class="spacer"></span>
        <button class="btn btn--${tone}" data-act="ok" type="button" ${requireText ? raw('disabled') : ''}>
          ${confirmLabel}
        </button>
      `,
      onMount(node) {
        const ok = node.querySelector('[data-act="ok"]');
        const input = node.querySelector('#confirmText');
        if (input) {
          input.addEventListener('input', () => {
            ok.disabled = input.value.trim().toUpperCase() !== requireText.toUpperCase();
          });
          input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !ok.disabled) ok.click();
          });
        }
        ok.addEventListener('click', () => {
          settled = true;
          resolve(true);
          close();
        });
        node.querySelector('[data-act="cancel"]').addEventListener('click', () => close());
      },
      onClose() {
        if (!settled) resolve(false);
      }
    });
  });
}

/**
 * Shows a freshly issued access code exactly once, with a copy button.
 * The server only ever returns a code at the moment it is created.
 */
export function showCodeOnce(code, title = 'New access code') {
  return openSheet({
    title,
    subtitle: 'This is the only time it will be shown.',
    body: html`
      <div class="stack">
        <div class="codebox">
          <output>${code}</output>
          <button class="btn btn--primary" type="button" data-act="copy-code">
            ${icon('copy', 'btn__icon')} Copy code
          </button>
        </div>
        <div class="notice notice--warn">
          ${icon('alert')}
          <div>Write it down or paste it somewhere safe before closing this box —
            it is stored hashed and cannot be recovered.</div>
        </div>
      </div>
    `,
    onMount(node) {
      node.querySelector('[data-act="copy-code"]').addEventListener('click', async () => {
        const ok = await copyText(code);
        toast(ok ? 'Code copied to clipboard' : 'Copy failed — select the code manually', ok ? 'ok' : 'err');
      });
    }
  });
}

/* --------------------------------------------------------------------------
   Small shared fragments
   -------------------------------------------------------------------------- */

export function emptyState({ title, message, action = null }) {
  return html`
    <div class="empty">
      ${icon('empty')}
      <h3>${title}</h3>
      <p>${message}</p>
      ${action || ''}
    </div>
  `;
}

export function errorState(error, retryAttr = 'data-retry') {
  return html`
    <div class="empty">
      ${icon('alert')}
      <h3>We could not load the directory</h3>
      <p>${error?.message || 'Please check your connection and try again.'}</p>
      <button class="btn btn--primary" type="button" ${raw(retryAttr)}>
        ${icon('refresh', 'btn__icon')} Try again
      </button>
    </div>
  `;
}

export function skeletonCards(count = 6) {
  const one = html`
    <div class="card card--pad">
      <div class="row" style="align-items:flex-start;gap:12px">
        <div class="skel skel--avatar"></div>
        <div class="stack stack--tight" style="flex:1">
          <div class="skel skel--title"></div>
          <div class="skel skel--line" style="width:45%"></div>
        </div>
      </div>
      <div class="stack stack--tight" style="margin-top:16px">
        <div class="skel skel--line"></div>
        <div class="skel skel--line" style="width:80%"></div>
      </div>
    </div>
  `;
  return html`<div class="grid-cards" aria-hidden="true">${Array.from({ length: count }, () => one)}</div>`;
}
