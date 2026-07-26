/**
 * DFAD — DCPA Faculty Advisers Directory
 * Student dashboard: the read-only directory of advisers.
 * Built and developed by Benedict de Jesus.
 *
 * This is everything a student gets — browse, search, filter, open a profile.
 * There is no sign-in and nothing here writes to the database.
 *
 * The shell (hero + filter bar) renders once; only the results list is
 * re-rendered as the student types or taps a filter.
 */

import {
  html, raw, render, $, $$, delegate, on, debounce, normalize,
  revealOnScroll, initials, fullName, shortDay, plural
} from '../util.js';
import { icon, skeletonCards, errorState, emptyState, toast } from '../ui.js';
import {
  state, subscribe, loadDirectory, setFilter, resetFilters,
  visibleFaculty, facetCounts
} from '../store.js';
import { navigate } from '../router.js';

/** The four thesis tasks a faculty member can offer to handle. */
const ROLE_LABELS = {
  adviser: 'Thesis Adviser',
  consultant: 'Thesis Consultant',
  critic: 'Critic',
  media: 'Media Expert'
};

const PROGRAM_SHORT = {
  'BA Broadcasting': 'Broadcasting',
  'BA Journalism': 'Journalism',
  'Bachelor in Performing Arts': 'Performing Arts'
};

/* --------------------------------------------------------------------------
   Fragments
   -------------------------------------------------------------------------- */

export function availabilityBadges(person, { compact = false } = {}) {
  const entries = Object.entries(person.roles || {})
    .filter(([, v]) => v === 'Open' || v === 'Limited');
  if (!entries.length) {
    return html`<span class="badge">Not accepting requests</span>`;
  }
  const shown = compact ? entries.slice(0, 2) : entries;
  const rest = entries.length - shown.length;
  return html`
    ${shown.map(([key, value]) => html`
      <span class="badge badge--${value === 'Open' ? 'ok' : 'warn'}">
        <i class="dot${value === 'Open' ? ' dot--pulse' : ''}"></i>${ROLE_LABELS[key]}
      </span>
    `)}
    ${rest > 0 ? html`<span class="badge">+${rest} more</span>` : ''}
  `;
}

export function avatar(person, size = '') {
  const src = person.photo;
  return html`
    <div class="avatar ${size}" aria-hidden="true">
      ${src
        ? html`<img src="${src}" alt="" loading="lazy" decoding="async"
                    onerror="this.remove()">`
        : ''}
      ${initials(person.name)}
    </div>
  `;
}

function scheduleSummary(person) {
  const slots = person.slots || [];
  if (!slots.length) return 'No posted consultation hours';
  const days = [...new Set(slots.map((s) => shortDay(s.day)))];
  const shown = days.slice(0, 3).join(' · ');
  return `${shown}${days.length > 3 ? ' +' : ''} — ${plural(slots.length, 'slot')}`;
}

function facultyCard(person) {
  const programs = (person.programs || []).map((p) => PROGRAM_SHORT[p] || p);
  return html`
    <button class="fcard reveal" type="button" data-faculty="${person.id}">
      <div class="fcard__top">
        ${avatar(person)}
        <div style="min-width:0">
          <div class="fcard__name">${fullName(person)}</div>
          <div class="fcard__rank">${[person.rank, person.affiliation === 'Guest' ? person.department : ''].filter(Boolean).join(' · ')}</div>
        </div>
      </div>

      <div class="fcard__tags">
        <span class="badge ${person.affiliation === 'Guest' ? 'badge--accent' : 'badge--brand'}">
          ${person.affiliation === 'Guest' ? 'Guest faculty' : 'DCPA'}
        </span>
        ${programs.map((p) => html`<span class="badge">${p}</span>`)}
      </div>

      ${(person.expertise || []).length
        ? html`<p class="fcard__expertise">${person.expertise.join(' · ')}</p>`
        : ''}

      <div class="fcard__tags">${availabilityBadges(person, { compact: true })}</div>

      <div class="fcard__foot">
        ${icon('calendar')}
        <span>${scheduleSummary(person)}</span>
        ${channelHints(person)}
      </div>
    </button>
  `;
}

/**
 * A quiet hint that this adviser can be reached on Facebook or LinkedIn. Not
 * a link — the whole card is already a button, and nesting one interactive
 * element inside another breaks both keyboard and screen-reader behaviour.
 * The real action buttons live on the profile sheet.
 */
function channelHints(person) {
  const channels = [
    person.facebook && ['facebook', 'Reachable on Facebook'],
    person.linkedin && ['linkedin', 'Reachable on LinkedIn']
  ].filter(Boolean);
  if (!channels.length) return '';
  return html`
    <span class="row" style="gap:5px;margin-inline-start:auto;flex-wrap:nowrap">
      ${channels.map(([glyph, label]) => html`
        <span class="social-mini social-btn--${glyph}" title="${label}" aria-label="${label}"
              style="width:24px;height:24px;border-radius:7px">${icon(glyph)}</span>`)}
    </span>
  `;
}

/* --------------------------------------------------------------------------
   Filter bar
   -------------------------------------------------------------------------- */

function chip(name, value, label, count) {
  const active = state.filters[name] === value;
  return html`
    <button class="chip" type="button" data-filter="${name}" data-value="${value}"
            aria-pressed="${active ? 'true' : 'false'}">
      ${label}${count !== undefined ? html`<span class="chip__count">${count}</span>` : ''}
    </button>
  `;
}

function filterBar() {
  const counts = facetCounts();
  const f = state.filters;
  return html`
    <div class="filterbar" id="filterbar">
      <div class="search ${f.query ? 'has-value' : ''}">
        ${icon('search')}
        <input id="q" type="search" inputmode="search" autocomplete="off"
               placeholder="Search name, expertise, or programme"
               aria-label="Search faculty" value="${f.query}">
        <button class="search__clear" type="button" aria-label="Clear search" data-clear>
          ${icon('close')}
        </button>
      </div>

      <div class="chiprow" role="group" aria-label="Filter by group">
        ${chip('affiliation', 'all', 'Everyone', state.faculty.length)}
        ${chip('affiliation', 'DCPA', 'DCPA faculty', counts.affiliation.DCPA || 0)}
        ${chip('affiliation', 'Guest', 'Guest faculty', counts.affiliation.Guest || 0)}
      </div>

      <div class="chiprow" role="group" aria-label="Filter by availability">
        ${chip('role', 'all', 'Any role')}
        ${Object.entries(ROLE_LABELS).map(([key, label]) =>
          chip('role', key, label, counts.role[key] || 0))}
      </div>

      <details class="filter-more">
        <summary class="btn btn--ghost btn--sm" style="width:max-content;margin-top:12px">
          ${icon('filter', 'btn__icon')} More filters
        </summary>
        <div class="chiprow chiprow--wrap" role="group" aria-label="Filter by programme" style="margin-top:10px">
          ${chip('program', 'all', 'All programmes')}
          ${Object.keys(PROGRAM_SHORT).map((p) => chip('program', p, PROGRAM_SHORT[p], counts.program[p] || 0))}
        </div>
        <div class="chiprow chiprow--wrap" role="group" aria-label="Filter by consultation day" style="margin-top:8px">
          ${chip('day', 'all', 'Any day')}
          ${['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
            .map((d) => chip('day', d, shortDay(d), counts.day[d] || 0))}
        </div>
      </details>

      <div class="filterbar__meta">
        <span id="resultCount" aria-live="polite"></span>
        <label class="row" style="gap:6px">
          <span class="visually-hidden">Sort results</span>
          <select class="select" id="sort" style="padding-right:32px">
            <option value="name" ${f.sort === 'name' ? raw('selected') : ''}>A–Z</option>
            <option value="availability" ${f.sort === 'availability' ? raw('selected') : ''}>Most available</option>
            <option value="slots" ${f.sort === 'slots' ? raw('selected') : ''}>Most consultation hours</option>
            <option value="updated" ${f.sort === 'updated' ? raw('selected') : ''}>Recently updated</option>
          </select>
        </label>
      </div>
    </div>
  `;
}

/* --------------------------------------------------------------------------
   View
   -------------------------------------------------------------------------- */

export function mount(container) {
  render(container, html`
    <div class="shell">
      <section class="hero">
        <span class="hero__eyebrow" id="heroEyebrow">${icon('spark')} College of Arts and Letters</span>
        <h1 class="hero__title">Find the right <em>resource persons</em> for your thesis.</h1>
        <p class="hero__lead">
          Every adviser in the Department of Communication and Performing Arts —
          plus guest faculty from across CAL — with their expertise, consultation
          hours, and the thesis tasks they are currently taking on.
        </p>
        <div class="hero__stats" id="heroStats"></div>
        <p class="hero__note">
          ${icon('student')}
          <span>
            Student view — browse freely, no sign-in needed. Faculty members
            update their own entries through the <a href="#/portal">faculty portal</a>.
          </span>
        </p>
      </section>

      <div id="announceHost"></div>
      <div id="filterHost"></div>
      <div id="results" class="stack"></div>

      <p style="text-align:center;margin-top:32px">
        <span class="credit">
          ${icon('star')} DFAD is designed and developed by <b>Benedict de Jesus</b>
        </span>
      </p>
    </div>
  `);

  const results = $('#results', container);
  const filterHost = $('#filterHost', container);

  // Site settings arrive on their own schedule, so the hero and announcement
  // are filled in whenever they land rather than only at mount time.
  const paintMeta = () => {
    const site = state.meta?.site || {};
    // The seals sit on the hero's dark green, so they get a permanent light
    // tile — the DCPA mark is dark green itself and would otherwise vanish.
    render($('#heroEyebrow', container), html`
      <span class="seals">
        <span class="seal seal--plated" style="--seal:36px">
          <img src="assets/img/cal-logo.png" width="192" height="191"
               alt="Seal of the College of Arts and Letters, Bulacan State University">
        </span>
        <span class="seal seal--plated" style="--seal:36px">
          <img src="assets/img/dcpa-logo.png" width="192" height="192"
               alt="Seal of the Department of Communication and Performing Arts">
        </span>
      </span>
      <span>
        ${[
          site.college || 'College of Arts and Letters',
          site.department || 'Department of Communication and Performing Arts'
        ].join(' — ')}
      </span>
    `);
    render($('#announceHost', container), site.announcement
      ? html`<div class="notice" style="margin-top:20px">${icon('info')}<div>${site.announcement}</div></div>`
      : '');
  };

  const paintStats = () => {
    const dcpa = state.faculty.filter((p) => p.affiliation === 'DCPA').length;
    const guest = state.faculty.length - dcpa;
    const openAdvisers = state.faculty.filter((p) => ['Open', 'Limited'].includes(p.roles?.adviser)).length;
    const hours = state.faculty.reduce((sum, p) => sum + (p.slots || []).length, 0);
    render($('#heroStats', container), html`
      <div class="hero__stat"><b>${dcpa}</b><span>DCPA faculty</span></div>
      <div class="hero__stat"><b>${guest}</b><span>Guest faculty</span></div>
      <div class="hero__stat"><b>${openAdvisers}</b><span>Open to advising</span></div>
      <div class="hero__stat"><b>${hours}</b><span>Consultation slots</span></div>
    `);
  };

  const paintFilters = () => {
    const wasOpen = $('.filter-more', container)?.open;
    render(filterHost, filterBar());
    if (wasOpen) $('.filter-more', container).open = true;
  };

  /**
   * Filter state changes far more often than the data does, so we flip
   * attributes in place rather than re-rendering — that keeps the search
   * field focused and the caret where the student left it.
   */
  const syncFilters = () => {
    $$('[data-filter]', container).forEach((node) => {
      const active = state.filters[node.dataset.filter] === node.dataset.value;
      node.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
    const sort = $('#sort', container);
    if (sort && sort.value !== state.filters.sort) sort.value = state.filters.sort;
    const search = $('.search', container);
    const input = $('#q', container);
    if (input && document.activeElement !== input && input.value !== state.filters.query) {
      input.value = state.filters.query;
    }
    if (search) search.classList.toggle('has-value', Boolean(state.filters.query));
  };

  const paintResults = () => {
    if (state.loading && !state.faculty.length) {
      render(results, skeletonCards(6));
      return;
    }
    if (state.error && !state.faculty.length) {
      render(results, errorState(state.error));
      return;
    }

    const list = visibleFaculty(normalize);
    const countEl = $('#resultCount', container);
    if (countEl) {
      countEl.textContent = list.length === state.faculty.length
        ? `${plural(list.length, 'adviser')} listed`
        : `${list.length} of ${state.faculty.length} shown`;
    }

    if (!list.length) {
      render(results, emptyState({
        title: 'No matches yet',
        message: 'Try a different keyword, or clear the filters to see everyone in the directory.',
        action: html`<button class="btn btn--primary" type="button" data-reset>Clear all filters</button>`
      }));
      return;
    }

    render(results, html`
      ${state.stale
        ? html`<div class="notice notice--warn">${icon('alert')}<div>
            Showing a saved copy — we could not reach the directory service just now.
          </div></div>`
        : ''}
      <div class="grid-cards">${list.map(facultyCard)}</div>
      ${state.fetchedAt
        ? html`<p class="section__sub" style="text-align:center;margin-top:8px">
            Directory updated ${new Date(state.fetchedAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
          </p>`
        : ''}
    `);
    revealOnScroll(results);
  };

  const paintAll = () => {
    paintMeta();
    paintStats();
    paintFilters();
    syncFilters();
    paintResults();
  };

  /* --- events ----------------------------------------------------------- */

  const offs = [];

  offs.push(delegate(container, 'click', '[data-faculty]', (event, node) => {
    navigate(`/faculty/${node.dataset.faculty}`);
  }));

  offs.push(delegate(container, 'click', '[data-filter]', (event, node) => {
    setFilter({ [node.dataset.filter]: node.dataset.value });
  }));

  offs.push(delegate(container, 'click', '[data-clear]', () => {
    setFilter({ query: '' });
    $('#q', container)?.focus();
  }));

  offs.push(delegate(container, 'click', '[data-reset]', () => {
    resetFilters();
    toast('Filters cleared', 'info', 1800);
  }));

  offs.push(delegate(container, 'click', '[data-retry]', () => {
    loadDirectory({ force: true });
  }));

  const onQuery = debounce((value) => setFilter({ query: value }), 180);
  offs.push(on(container, 'input', (event) => {
    if (event.target.id === 'q') {
      event.target.closest('.search')?.classList.toggle('has-value', Boolean(event.target.value));
      onQuery(event.target.value);
    }
  }));

  offs.push(on(container, 'change', (event) => {
    if (event.target.id === 'sort') setFilter({ sort: event.target.value });
  }));

  // `/` focuses search, the way students expect from a search-first page.
  offs.push(on(document, 'keydown', (event) => {
    if (event.key === '/' && !/^(INPUT|TEXTAREA|SELECT)$/.test(event.target.tagName)) {
      event.preventDefault();
      $('#q', container)?.focus();
    }
  }));

  let lastFetch = state.fetchedAt;
  let lastCount = state.faculty.length;
  let lastMeta = state.meta;
  offs.push(subscribe(() => {
    if (state.meta !== lastMeta) {
      lastMeta = state.meta;
      paintMeta();
    }
    if (state.faculty.length !== lastCount || state.fetchedAt !== lastFetch) {
      lastCount = state.faculty.length;
      lastFetch = state.fetchedAt;
      paintAll();
      return;
    }
    syncFilters();
    paintResults();
  }));

  paintAll();
  if (!state.faculty.length) loadDirectory();

  return () => offs.forEach((off) => off());
}
