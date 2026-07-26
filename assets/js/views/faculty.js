/**
 * DFAD — DCPA Faculty Advisers' Directory
 * Adviser detail sheet — the student's read-only view of one faculty member.
 * Built and developed by Benedict de Jesus.
 *
 * Opened by the `/faculty/:id` route on top of whatever view is showing.
 * Everything here is view-only: students read, tap through to an adviser's
 * Facebook or LinkedIn, or save the consultation hours to their calendar.
 * Nothing on this screen can change the database.
 */

import {
  html, render, $$, delegate, fullName, fmtRange, relTime,
  isSlotNow, safeUrl, copyText, plural, sortSlots
} from '../util.js';
import { icon, openSheet, toast } from '../ui.js';
import { findFaculty } from '../store.js';
import { api } from '../api.js';
import { downloadIcs } from '../ics.js';
import { avatar } from './home.js';

/** The four thesis tasks a faculty member can offer to handle. */
const ROLE_LABELS = {
  adviser: 'Thesis Adviser',
  consultant: 'Thesis Consultant',
  critic: 'Critic',
  media: 'Media Expert'
};

const MODE_ICON = { 'Face-to-face': 'pin', Online: 'video', Hybrid: 'users' };

/* --------------------------------------------------------------------------
   Panels
   -------------------------------------------------------------------------- */

function contactRows(person) {
  const rows = [];
  if (person.email) {
    rows.push({ glyph: 'mail', label: 'Email', value: person.email, href: `mailto:${person.email}` });
  }
  if (person.phone) {
    rows.push({ glyph: 'phone', label: 'Phone', value: person.phone, href: `tel:${person.phone.replace(/[^\d+]/g, '')}` });
  }
  if (person.office) {
    rows.push({ glyph: 'pin', label: 'Office', value: person.office });
  }
  if (!rows.length) {
    return html`
      <div class="notice">${icon('info')}<div>
        This faculty member has not published contact details. Reach them through
        the department office or during the consultation hours below.
      </div></div>`;
  }
  return html`
    <dl class="deflist">
      ${rows.map((row) => html`
        <div class="deflist__row">
          ${icon(row.glyph)}
          <div>
            <dt>${row.label}</dt>
            <dd>${row.href ? html`<a href="${safeUrl(row.href)}">${row.value}</a>` : row.value}</dd>
          </div>
        </div>
      `)}
    </dl>
  `;
}

function profilePanel(person) {
  return html`
    <div class="tabpanel stack" data-panel="profile">
      ${person.bio ? html`<p>${person.bio}</p>` : ''}

      ${(person.expertise || []).length ? html`
        <div>
          <h3 class="section__title" style="font-size:var(--fs-md);margin-bottom:8px">Fields of expertise</h3>
          <div class="fcard__tags">
            ${person.expertise.map((e) => html`<span class="badge badge--brand">${e}</span>`)}
          </div>
        </div>` : ''}

      ${(person.programs || []).length ? html`
        <div>
          <h3 class="section__title" style="font-size:var(--fs-md);margin-bottom:8px">Teaches / advises in</h3>
          <div class="fcard__tags">
            ${person.programs.map((p) => html`<span class="badge">${p}</span>`)}
          </div>
        </div>` : ''}

      <hr class="divider">
      ${contactRows(person)}

      ${person.email || person.phone || person.office ? html`
        <button class="btn btn--sm" type="button" data-act="copy" style="width:max-content">
          ${icon('copy', 'btn__icon')} Copy contact details
        </button>` : ''}
    </div>
  `;
}

/**
 * Facebook and LinkedIn get full-width action buttons because, realistically,
 * that is how most students will actually reach an adviser.
 */
export function socialActions(person) {
  const links = [
    person.facebook && {
      kind: 'facebook', glyph: 'facebook', label: 'Message on Facebook',
      handle: handleOf(person.facebook), url: person.facebook
    },
    person.linkedin && {
      kind: 'linkedin', glyph: 'linkedin', label: 'Connect on LinkedIn',
      handle: handleOf(person.linkedin), url: person.linkedin
    },
    person.website && {
      kind: 'website', glyph: 'globe', label: 'Personal or research page',
      handle: hostOf(person.website), url: person.website
    }
  ].filter(Boolean);

  if (!links.length) return '';

  return html`
    <div>
      <h3 class="section__title" style="font-size:var(--fs-md);margin-bottom:10px">Reach them online</h3>
      <div class="socials">
        ${links.map((l) => html`
          <a class="social-btn social-btn--${l.kind}" href="${safeUrl(l.url)}"
             target="_blank" rel="noopener noreferrer">
            <span class="social-btn__glyph">${icon(l.glyph)}</span>
            <span class="social-btn__text">
              ${l.label}
              <small>${l.handle}</small>
            </span>
          </a>`)}
      </div>
    </div>
  `;
}

/** The trailing path segment of a profile URL, shown under the button label. */
function handleOf(url) {
  const parts = String(url || '').replace(/\/+$/, '').split('/');
  return parts.length ? '@' + parts[parts.length - 1] : '';
}

function hostOf(url) {
  return String(url || '').replace(/^https?:\/\/(www\.)?/i, '').split('/')[0];
}

function schedulePanel(person) {
  const slots = sortSlots(person.slots);
  if (!slots.length) {
    return html`
      <div class="tabpanel" data-panel="schedule">
        <div class="empty">
          ${icon('calendar')}
          <h3>No consultation hours posted</h3>
          <p>Message this faculty member directly to arrange a time.</p>
        </div>
      </div>`;
  }
  return html`
    <div class="tabpanel stack" data-panel="schedule">
      <p class="section__sub">
        ${plural(slots.length, 'weekly consultation slot')}. Times are local campus time —
        always confirm before dropping by.
      </p>
      <div class="slotlist">
        ${slots.map((slot) => html`
          <div class="slot ${isSlotNow(slot) ? 'is-now' : ''}">
            <div class="slot__day">${slot.day.slice(0, 3)}</div>
            <div>
              <div class="slot__time">${fmtRange(slot.start, slot.end)}</div>
              <div class="slot__meta">
                ${slot.mode}${slot.venue ? ` · ${slot.venue}` : ''}
                ${slot.note ? html`<br>${slot.note}` : ''}
              </div>
            </div>
            <div class="slot__actions">
              ${isSlotNow(slot)
                ? html`<span class="badge badge--ok"><i class="dot dot--pulse"></i>Now</span>`
                : html`<span class="badge">${icon(MODE_ICON[slot.mode] || 'pin')}</span>`}
            </div>
          </div>
        `)}
      </div>
      <button class="btn btn--block" type="button" data-act="ics">
        ${icon('download', 'btn__icon')} Add to my calendar
      </button>
      ${person.availabilityNote ? html`
        <div class="notice">${icon('info')}<div>${person.availabilityNote}</div></div>` : ''}
    </div>
  `;
}

function availabilityPanel(person) {
  const roles = person.roles || {};
  return html`
    <div class="tabpanel stack" data-panel="availability">
      <p class="section__sub">
        What this faculty member is currently accepting. “Limited” means a few
        slots remain — ask early.
      </p>
      <div class="roles">
        ${Object.entries(ROLE_LABELS).map(([key, label]) => {
          const value = roles[key] || 'Closed';
          const tone = value === 'Open' ? 'ok' : value === 'Limited' ? 'warn' : '';
          return html`
            <div class="role" data-state="${value}">
              <span class="role__label">${label}</span>
              <span class="badge ${tone ? `badge--${tone}` : ''}">
                ${value === 'Closed' ? '' : html`<i class="dot"></i>`}${value}
              </span>
            </div>`;
        })}
      </div>
      ${person.availabilityNote
        ? html`<div class="notice">${icon('info')}<div>${person.availabilityNote}</div></div>`
        : ''}
      ${person.email ? html`
        <a class="btn btn--primary btn--block"
           href="${safeUrl(`mailto:${person.email}?subject=${encodeURIComponent('Consultation request — DCPA')}`)}">
          ${icon('mail', 'btn__icon')} Email a request
        </a>` : ''}
    </div>
  `;
}

/* --------------------------------------------------------------------------
   Sheet
   -------------------------------------------------------------------------- */

/**
 * @param {string} id faculty id
 * @param {{onClose?:Function}} [options]
 */
export async function openFacultyDetail(id, { onClose } = {}) {
  let person = findFaculty(id);

  const closeSheet = openSheet({
    title: person ? fullName(person) : 'Loading profile…',
    subtitle: person ? [person.rank, person.department].filter(Boolean).join(' · ') : '',
    body: person ? detailBody(person) : loadingBody(),
    onMount(node, close) {
      const paint = (data) => {
        render(node.querySelector('.sheet__body'), detailBody(data));
        node.querySelector('.sheet__title').textContent = fullName(data);
        node.querySelector('.sheet__sub')?.remove();
        wire(node, data, close);
      };

      if (person) {
        wire(node, person, close);
      } else {
        // Deep link into a profile the directory has not loaded yet.
        api.faculty(id)
          .then((data) => {
            person = data.faculty;
            paint(person);
          })
          .catch((error) => {
            render(node.querySelector('.sheet__body'), html`
              <div class="empty">
                ${icon('alert')}
                <h3>Profile unavailable</h3>
                <p>${error.message}</p>
              </div>`);
          });
      }
    },
    onClose
  });

  return closeSheet;
}

function loadingBody() {
  return html`
    <div class="stack">
      <div class="row" style="gap:16px;align-items:flex-start">
        <div class="skel skel--avatar" style="width:84px;height:84px;border-radius:24px"></div>
        <div class="stack stack--tight" style="flex:1">
          <div class="skel skel--title"></div>
          <div class="skel skel--line" style="width:55%"></div>
        </div>
      </div>
      <div class="skel skel--line"></div>
      <div class="skel skel--line" style="width:85%"></div>
      <div class="skel skel--line" style="width:70%"></div>
    </div>`;
}

function detailBody(person) {
  return html`
    <div class="profile">
      <header class="profile__head">
        ${avatar(person, 'avatar--lg')}
        <div class="profile__id">
          <h2 class="profile__name">${fullName(person)}</h2>
          <p class="profile__rank">${[person.rank, person.department].filter(Boolean).join(' · ')}</p>
          <div class="fcard__tags" style="margin-top:10px">
            <span class="badge ${person.affiliation === 'Guest' ? 'badge--accent' : 'badge--brand'}">
              ${person.affiliation === 'Guest' ? 'Guest faculty' : 'DCPA faculty'}
            </span>
            ${person.updatedAt
              ? html`<span class="badge">Updated ${relTime(person.updatedAt)}</span>`
              : ''}
          </div>
        </div>
      </header>

      ${socialActions(person)}

      <div class="tabs" role="tablist">
        <button role="tab" type="button" data-tab="profile" aria-selected="true">Profile</button>
        <button role="tab" type="button" data-tab="schedule" aria-selected="false">
          Schedule${(person.slots || []).length ? ` (${person.slots.length})` : ''}
        </button>
        <button role="tab" type="button" data-tab="availability" aria-selected="false">Availability</button>
      </div>

      <div id="panelHost">${profilePanel(person)}</div>

      <p style="text-align:center;margin-top:24px">
        <span class="credit">${icon('star')} DFAD by <b>Benedict de Jesus</b></span>
      </p>
    </div>
  `;
}

function wire(node, person, close) {
  const host = node.querySelector('#panelHost');
  const panels = {
    profile: () => profilePanel(person),
    schedule: () => schedulePanel(person),
    availability: () => availabilityPanel(person)
  };

  delegate(node, 'click', '[data-tab]', (event, tab) => {
    $$('[data-tab]', node).forEach((t) => t.setAttribute('aria-selected', String(t === tab)));
    render(host, panels[tab.dataset.tab]());
  });

  delegate(node, 'click', '[data-act="ics"]', () => {
    downloadIcs(person);
    toast('Calendar file downloaded — open it to add the weekly slots.', 'ok');
  });

  delegate(node, 'click', '[data-act="copy"]', async () => {
    const text = [fullName(person), person.rank, person.email, person.phone, person.office]
      .filter(Boolean)
      .join('\n');
    const ok = await copyText(text);
    toast(
      ok ? 'Contact details copied' : 'Could not copy — long-press to select instead',
      ok ? 'ok' : 'err'
    );
  });
}
