/**
 * DFAD — department-wide consultation schedule, grouped by weekday.
 */

import {
  html, render, $, $$, delegate, on, DAYS, fmtRange, todayName,
  isSlotNow, initials, fullName, revealOnScroll, plural, normalize
} from '../util.js';
import { icon, skeletonCards, errorState, emptyState } from '../ui.js';
import { state, subscribe, loadDirectory, slotsByDay } from '../store.js';
import { navigate } from '../router.js';

const MODES = ['All modes', 'Face-to-face', 'Online', 'Hybrid'];

let filter = { mode: 'All modes', query: '' };

function slotRow(slot) {
  const person = slot.person;
  return html`
    <button class="slot reveal" type="button" data-faculty="${person.id}"
            style="text-align:start;width:100%;cursor:pointer;border-width:1px"
            aria-label="Open ${fullName(person)}">
      <div class="avatar" style="--size:42px;border-radius:14px">
        ${person.photo ? html`<img src="${person.photo}" alt="" loading="lazy" onerror="this.remove()">` : ''}
        ${initials(person.name)}
      </div>
      <div style="min-width:0">
        <div class="slot__time">${fmtRange(slot.start, slot.end)}</div>
        <div class="slot__meta">
          <b>${fullName(person)}</b><br>
          ${slot.mode}${slot.venue ? ` · ${slot.venue}` : ''}
        </div>
      </div>
      <div class="slot__actions">
        ${isSlotNow(slot)
          ? html`<span class="badge badge--ok"><i class="dot dot--pulse"></i>Now</span>`
          : html`<span class="badge">${slot.mode === 'Online' ? 'Online' : 'On campus'}</span>`}
      </div>
    </button>
  `;
}

function matches(slot) {
  if (filter.mode !== 'All modes' && slot.mode !== filter.mode) return false;
  if (filter.query) {
    const hay = normalize([
      slot.person.name, slot.person.rank, slot.venue, slot.mode,
      (slot.person.expertise || []).join(' ')
    ].join(' '));
    if (!normalize(filter.query).split(/\s+/).every((t) => hay.includes(t))) return false;
  }
  return true;
}

export function mount(container) {
  render(container, html`
    <div class="shell">
      <div class="section__head" style="margin-top:8px">
        <div>
          <h1 class="section__title" style="font-size:var(--fs-2xl)">Consultation hours</h1>
          <p class="section__sub">Every posted slot in the department, one week at a glance.</p>
        </div>
      </div>

      <div class="filterbar">
        <div class="search ${filter.query ? 'has-value' : ''}">
          ${icon('search')}
          <input id="sq" type="search" autocomplete="off" value="${filter.query}"
                 placeholder="Search a name, room, or topic" aria-label="Search consultation hours">
          <button class="search__clear" type="button" aria-label="Clear search" data-clear>${icon('close')}</button>
        </div>
        <div class="chiprow" role="group" aria-label="Filter by mode">
          ${MODES.map((m) => html`
            <button class="chip" type="button" data-mode="${m}"
                    aria-pressed="${filter.mode === m ? 'true' : 'false'}">${m}</button>`)}
        </div>
      </div>

      <div id="week" class="weekgrid"></div>

      <p style="text-align:center;margin-top:32px">
        <span class="credit">
          ${icon('star')} DFAD is designed and developed by <b>Benedict de Jesus</b>
        </span>
      </p>
    </div>
  `);

  const week = $('#week', container);

  const paint = () => {
    if (state.loading && !state.faculty.length) {
      render(week, skeletonCards(3));
      return;
    }
    if (state.error && !state.faculty.length) {
      render(week, errorState(state.error));
      return;
    }

    const byDay = slotsByDay();
    const today = todayName();
    const days = DAYS.map((day) => ({ day, slots: (byDay[day] || []).filter(matches) }))
      .filter((d) => d.slots.length);

    if (!days.length) {
      render(week, emptyState({
        title: 'Nothing scheduled here',
        message: state.faculty.length
          ? 'No consultation hours match this filter yet. Try clearing the search or picking another mode.'
          : 'No faculty member has posted consultation hours yet.'
      }));
      return;
    }

    // Start the week from today so the most useful day is at the top.
    const startIndex = DAYS.indexOf(today);
    const ordered = [...days].sort((a, b) => {
      const ai = (DAYS.indexOf(a.day) - startIndex + 7) % 7;
      const bi = (DAYS.indexOf(b.day) - startIndex + 7) % 7;
      return ai - bi;
    });

    render(week, html`
      ${ordered.map((entry) => html`
        <section class="weekday ${entry.day === today ? 'is-today' : ''}">
          <div class="weekday__head">
            <h3>${entry.day}</h3>
            <span>${entry.day === today ? 'Today · ' : ''}${plural(entry.slots.length, 'slot')}</span>
          </div>
          <div class="slotlist">${entry.slots.map(slotRow)}</div>
        </section>
      `)}
    `);
    revealOnScroll(week);
  };

  const offs = [];

  offs.push(delegate(container, 'click', '[data-faculty]', (event, node) => {
    navigate(`/faculty/${node.dataset.faculty}`);
  }));

  offs.push(delegate(container, 'click', '[data-mode]', (event, node) => {
    filter.mode = node.dataset.mode;
    $$('[data-mode]', container).forEach((n) =>
      n.setAttribute('aria-pressed', String(n.dataset.mode === filter.mode)));
    paint();
  }));

  offs.push(on(container, 'input', (event) => {
    if (event.target.id !== 'sq') return;
    filter.query = event.target.value;
    event.target.closest('.search')?.classList.toggle('has-value', Boolean(filter.query));
    paint();
  }));

  offs.push(delegate(container, 'click', '[data-clear]', () => {
    filter.query = '';
    const input = $('#sq', container);
    input.value = '';
    input.closest('.search')?.classList.remove('has-value');
    paint();
  }));

  offs.push(delegate(container, 'click', '[data-retry]', () => loadDirectory({ force: true })));
  offs.push(subscribe(paint));

  paint();
  if (!state.faculty.length) loadDirectory();

  return () => offs.forEach((off) => off());
}
