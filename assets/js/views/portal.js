/**
 * DAD — DCPA Advisers' Directory
 * Faculty dashboard — the only part of DAD that can change the database.
 * Built and developed by Benedict de Jesus.
 *
 * Faculty and guest faculty sign in with an access code and maintain their own
 * profile, consultation schedule and thesis-task availability. Coordinators
 * are handed off to the coordinator dashboard in admin.js.
 *
 * The whole point of this screen is that nothing here should ever land back on
 * the administrator's desk: everything a faculty member needs to change, they
 * can change themselves, in plain language, on a phone.
 */

import {
  html, raw, render, $, $$, delegate, on, DAYS, fmtRange, fullName,
  initials, plural, sortSlots
} from '../util.js';
import { icon, toast, openSheet, confirmDialog, progress, showCodeOnce } from '../ui.js';
import { state, subscribe, signIn, signOut, setProfile, loadDirectory } from '../store.js';
import { api, ApiError } from '../api.js';
import { navigate } from '../router.js';
import { mountAdmin } from './admin.js';

const PROGRAMS = ['BA Broadcasting', 'BA Journalism', 'Bachelor in Performing Arts'];
const MODES = ['Face-to-face', 'Online', 'Hybrid'];

/**
 * The four thesis tasks, in the order faculty think about them.
 * `key` matches the API; `column` lives in the spreadsheet.
 */
const TASKS = [
  ['adviser', 'Thesis Adviser', 'users', 'Supervising a thesis from proposal to defence.'],
  ['critic', 'Critic', 'clipboard', 'Sitting on a panel as critic or reactor.'],
  ['consultant', 'Thesis Consultant', 'spark', 'Advising on method, production or craft — without being the adviser.'],
  ['media', 'Media Expert', 'video', 'Interviews, expert commentary and media requests.']
];

/** Longest edge of an uploaded photo after the browser resizes it. */
const PHOTO_MAX_EDGE = 600;
const PHOTO_QUALITY = 0.82;

/* ==========================================================================
   Sign-in
   ========================================================================== */

function loginCard() {
  return html`
    <div class="shell">
      <div class="panel setup-card" style="margin-top:24px">
        <div class="row" style="gap:12px;margin-bottom:18px">
          <span class="avatar" style="--size:44px;border-radius:14px">${icon('key')}</span>
          <div>
            <h1 class="panel__title">Faculty dashboard</h1>
            <p class="section__sub" style="margin:0">
              For DCPA and guest faculty members only.
            </p>
          </div>
        </div>

        <form class="form" id="loginForm" novalidate>
          <div class="field">
            <label for="code">Access code</label>
            <input class="input input--code" id="code" name="code" autocomplete="one-time-code"
                   inputmode="text" spellcheck="false" autocapitalize="characters"
                   placeholder="DCPA-XXXX-XXXX" maxlength="20" required autofocus>
            <p class="field__hint">
              Case does not matter and the dashes are optional. Codes never use
              the characters <b>0</b>, <b>O</b>, <b>1</b>, <b>I</b> or <b>L</b>,
              so there is nothing to second-guess.
            </p>
            <p class="field__error" id="loginError" hidden></p>
          </div>

          <button class="btn btn--primary btn--lg btn--block" type="submit" id="loginBtn">
            ${icon('shield', 'btn__icon')} Sign in
          </button>
        </form>

        <hr class="divider">

        <div class="notice">
          ${icon('info')}
          <div>
            <b>Are you a student?</b> You do not need an account — the
            <a href="#/">advisers' directory</a> is open to everyone.
          </div>
        </div>
        <div class="notice" style="margin-top:10px">
          ${icon('key')}
          <div>
            <b>Faculty without a code?</b> Ask the DCPA coordinator. Codes are
            already prepared — they only need to hand you one.
          </div>
        </div>
      </div>

      <div class="panel setup-card" style="margin-top:16px">
        <h2 class="panel__title" style="font-size:var(--fs-md)">What you can manage here</h2>
        <ul class="stack stack--tight" style="margin-top:12px">
          ${[
            ['camera', 'Your photo — upload it straight from your phone or laptop'],
            ['edit', 'Your profile: rank, fields of expertise, a short bio'],
            ['users', 'The thesis tasks you can take on, and whether slots are still open'],
            ['calendar', 'Your weekly consultation hours, with venue and mode'],
            ['facebook', 'Your Facebook and LinkedIn, so students can reach you where they already are'],
            ['mail', 'Which contact details students are allowed to see']
          ].map(([glyph, text]) => html`
            <li class="row" style="gap:10px;align-items:flex-start;flex-wrap:nowrap">
              <span style="color:var(--brand-500);flex:none;margin-top:2px">${icon(glyph)}</span>
              <span>${text}</span>
            </li>`)}
        </ul>
      </div>

      <p style="text-align:center;margin-top:20px">
        <span class="credit">${icon('star')} DAD by <b>Benedict de Jesus</b></span>
      </p>
    </div>
  `;
}

function wireLogin(container) {
  const form = $('#loginForm', container);
  const input = $('#code', container);
  const errorEl = $('#loginError', container);
  const button = $('#loginBtn', container);

  // Tidy the code as it is typed without re-grouping it: prefixes vary in
  // length (DCPA-… for faculty, DAD-… for coordinators), so imposing a fixed
  // 4-4-4 shape would visibly mangle what the user pasted.
  on(input, 'input', () => {
    const caretAtEnd = input.selectionStart === input.value.length;
    const cleaned = input.value.toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 20);
    if (cleaned !== input.value) {
      input.value = cleaned;
      if (caretAtEnd) input.setSelectionRange(cleaned.length, cleaned.length);
    }
    errorEl.hidden = true;
    input.setAttribute('aria-invalid', 'false');
  });

  on(form, 'submit', async (event) => {
    event.preventDefault();
    const code = input.value.trim();
    if (code.replace(/[^A-Za-z0-9]/g, '').length < 8) {
      errorEl.textContent = 'That code looks too short — check it and try again.';
      errorEl.hidden = false;
      input.setAttribute('aria-invalid', 'true');
      input.focus();
      return;
    }

    button.classList.add('is-busy');
    progress.start();
    try {
      const data = await signIn(code);
      toast(
        data.role === 'admin'
          ? 'Signed in as coordinator'
          : `Welcome${data.profile?.name ? ', ' + data.profile.name : ''}`,
        'ok'
      );
      loadDirectory({ force: true });
    } catch (error) {
      errorEl.textContent = error instanceof ApiError
        ? error.message
        : 'Could not sign in. Please try again.';
      errorEl.hidden = false;
      input.setAttribute('aria-invalid', 'true');
      input.select();
    } finally {
      button.classList.remove('is-busy');
      progress.done();
    }
  });
}

/* ==========================================================================
   Photo upload
   ========================================================================== */

/**
 * Reads a file the faculty member picked, squares it off around the centre and
 * shrinks it to `PHOTO_MAX_EDGE`. Doing this in the browser means we upload
 * ~60 KB instead of a 5 MB phone photo, and Apps Script never has to resize.
 */
function fileToSquareDataUrl(file) {
  return new Promise((resolve, reject) => {
    if (!/^image\//.test(file.type)) {
      reject(new Error('That is not an image file. Choose a JPEG, PNG or WebP photo.'));
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      reject(new Error('That photo is very large. Please pick one under 15 MB.'));
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => reject(new Error('That file could not be read.'));
    reader.onload = () => {
      const image = new Image();
      image.onerror = () => reject(new Error('That image could not be opened.'));
      image.onload = () => {
        const edge = Math.min(image.width, image.height);
        const size = Math.min(edge, PHOTO_MAX_EDGE);
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(
          image,
          (image.width - edge) / 2, (image.height - edge) / 2, edge, edge,
          0, 0, size, size
        );
        resolve(canvas.toDataURL('image/jpeg', PHOTO_QUALITY));
      };
      image.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

function photoField(p) {
  return html`
    <div class="photofield" id="photoField">
      <div class="photofield__preview">
        <div class="avatar" id="photoPreview">
          ${p.photo ? html`<img src="${p.photo}" alt="" onerror="this.remove()">` : ''}
          ${initials(p.name)}
        </div>
      </div>
      <div class="photofield__actions">
        <input type="file" id="photoInput" accept="image/png,image/jpeg,image/webp">
        <button class="btn btn--sm" type="button" data-act="pick-photo">
          ${icon('camera', 'btn__icon')} ${p.photo ? 'Change photo' : 'Upload a photo'}
        </button>
        ${p.photo ? html`
          <button class="btn btn--ghost btn--sm" type="button" data-act="remove-photo"
                  style="width:max-content">Remove photo</button>` : ''}
        <p class="photofield__hint">
          A clear head-and-shoulders photo works best. It is cropped to a square
          and shrunk before uploading, so a phone picture is fine. Drag one here
          if you prefer.
        </p>
      </div>
    </div>
  `;
}

/* ==========================================================================
   Profile editor
   ========================================================================== */

function tagField(id, values, placeholder) {
  return html`
    <div class="tagfield" id="${id}" data-tags>
      ${values.map((v) => tagChip(v))}
      <input type="text" placeholder="${placeholder}" aria-label="${placeholder}" data-tag-input>
    </div>
  `;
}

function tagChip(value) {
  return html`
    <span class="tag" data-tag="${value}">
      ${value}
      <button type="button" aria-label="Remove ${value}" data-remove-tag>${icon('close')}</button>
    </span>
  `;
}

function profileForm(p) {
  return html`
    <form class="form" id="profileForm" novalidate>
      ${photoField(p)}

      <div class="form__grid form__grid--3">
        <div class="field">
          <label for="honorific">Title</label>
          <input class="input" id="honorific" value="${p.honorific || ''}" placeholder="Dr. / Prof.">
        </div>
        <div class="field" style="grid-column:span 2">
          <label for="name">Full name <span aria-hidden="true">*</span></label>
          <input class="input" id="name" value="${p.name || ''}" required maxlength="120"
                 placeholder="Juana dela Cruz">
        </div>
      </div>

      <div class="form__grid form__grid--2">
        <div class="field">
          <label for="rank">Academic rank or position</label>
          <input class="input" id="rank" value="${p.rank || ''}" placeholder="Assistant Professor I">
        </div>
        <div class="field">
          <label for="department">Department</label>
          <input class="input" id="department" value="${p.department || ''}"
                 placeholder="Department of Communication and Performing Arts">
          ${p.affiliation === 'Guest'
            ? html`<p class="field__hint">You are listed as guest faculty — your home department.</p>`
            : ''}
        </div>
      </div>

      <div class="field">
        <label>Programmes you teach or advise in</label>
        <div class="togglegroup" id="programs">
          ${PROGRAMS.map((prog) => html`
            <button class="toggle" type="button" data-program="${prog}"
                    aria-pressed="${(p.programs || []).includes(prog) ? 'true' : 'false'}">${prog}</button>`)}
        </div>
      </div>

      <div class="field">
        <label>Fields of expertise</label>
        ${tagField('expertise', p.expertise || [], 'Type a topic, press Enter')}
        <p class="field__hint">
          These power the student search — add the topics you actually want to
          be asked about. Press Enter after each one.
        </p>
      </div>

      <div class="field">
        <label for="bio">Short bio</label>
        <textarea class="textarea" id="bio" maxlength="1200"
                  placeholder="Two or three sentences students will read first.">${p.bio || ''}</textarea>
        <p class="field__hint"><span id="bioCount">${(p.bio || '').length}</span> / 1200</p>
      </div>

      <hr class="divider">

      <h3 class="panel__title" style="font-size:var(--fs-md)">Where students can reach you</h3>
      <p class="section__sub">
        Paste a link or just type your username — DAD works out the rest.
        Leave a field blank to hide that button from your profile.
      </p>

      <div class="form__grid form__grid--2">
        <div class="field">
          <label for="facebook">${icon('facebook')} Facebook</label>
          <input class="input" id="facebook" value="${p.facebook || ''}"
                 placeholder="facebook.com/yourname" spellcheck="false">
        </div>
        <div class="field">
          <label for="linkedin">${icon('linkedin')} LinkedIn</label>
          <input class="input" id="linkedin" value="${p.linkedin || ''}"
                 placeholder="linkedin.com/in/yourname" spellcheck="false">
        </div>
      </div>

      <div class="field">
        <label for="website">Personal or research page (optional)</label>
        <input class="input" id="website" value="${p.website || ''}"
               placeholder="orcid.org/0000-…" spellcheck="false">
      </div>

      <hr class="divider">

      <h3 class="panel__title" style="font-size:var(--fs-md)">Contact details</h3>
      <div class="form__grid form__grid--2">
        <div class="field">
          <label for="email">Email</label>
          <input class="input" id="email" type="email" value="${p.email || ''}"
                 placeholder="name@bulsu.edu.ph">
        </div>
        <div class="field">
          <label for="phone">Phone</label>
          <input class="input" id="phone" type="tel" value="${p.phone || ''}" placeholder="Optional">
        </div>
      </div>

      <div class="field">
        <label for="office">Office or room</label>
        <input class="input" id="office" value="${p.office || ''}" placeholder="CAL Building, Room 201">
      </div>

      <label class="switch">
        <input type="checkbox" id="showEmail" ${p.showEmail ? raw('checked') : ''}>
        <span class="switch__track"></span>
        <span class="switch__text">
          <b>Show my email to students</b>
          <span>Turn this off and only the department office can share it.</span>
        </span>
      </label>

      <label class="switch">
        <input type="checkbox" id="showPhone" ${p.showPhone ? raw('checked') : ''}>
        <span class="switch__track"></span>
        <span class="switch__text">
          <b>Show my phone number to students</b>
          <span>Off by default. Most faculty leave this off.</span>
        </span>
      </label>

      <div class="form__actions">
        <button class="btn btn--primary" type="submit" id="saveProfile">
          ${icon('check', 'btn__icon')} Save profile
        </button>
        <span class="section__sub" id="profileDirty" hidden>Unsaved changes</span>
      </div>
    </form>
  `;
}

function wireTagFields(root) {
  delegate(root, 'keydown', '[data-tag-input]', (event, input) => {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault();
      const value = input.value.trim().replace(/[;,]+$/, '');
      if (!value) return;
      const field = input.closest('[data-tags]');
      const existing = $$('[data-tag]', field).map((t) => t.dataset.tag.toLowerCase());
      if (!existing.includes(value.toLowerCase())) {
        input.insertAdjacentHTML('beforebegin', tagChipMarkup(value));
        field.dispatchEvent(new Event('change', { bubbles: true }));
      }
      input.value = '';
    } else if (event.key === 'Backspace' && !input.value) {
      const last = input.previousElementSibling;
      if (last && last.matches('.tag')) {
        last.remove();
        input.closest('[data-tags]').dispatchEvent(new Event('change', { bubbles: true }));
      }
    }
  });

  delegate(root, 'click', '[data-remove-tag]', (event, button) => {
    const field = button.closest('[data-tags]');
    button.closest('.tag').remove();
    field.dispatchEvent(new Event('change', { bubbles: true }));
  });

  // A half-typed tag should still count when focus leaves the field.
  // (`focusout` bubbles; `blur` does not, so delegation needs this one.)
  delegate(root, 'focusout', '[data-tag-input]', (event, input) => {
    const value = input.value.trim();
    if (!value) return;
    const field = input.closest('[data-tags]');
    const existing = $$('[data-tag]', field).map((t) => t.dataset.tag.toLowerCase());
    if (!existing.includes(value.toLowerCase())) {
      input.insertAdjacentHTML('beforebegin', tagChipMarkup(value));
    }
    input.value = '';
  });
}

function tagChipMarkup(value) {
  const tpl = document.createElement('template');
  render(tpl, tagChip(value));
  return tpl.innerHTML;
}

function readTags(root, id) {
  const field = $(`#${id}`, root);
  if (!field) return [];
  const input = $('[data-tag-input]', field);
  const pending = input && input.value.trim() ? [input.value.trim()] : [];
  return [...$$('[data-tag]', field).map((t) => t.dataset.tag), ...pending];
}

function readProfileForm(root) {
  const val = (id) => ($(`#${id}`, root)?.value || '').trim();
  return {
    name: val('name'),
    honorific: val('honorific'),
    rank: val('rank'),
    department: val('department'),
    bio: val('bio'),
    email: val('email'),
    phone: val('phone'),
    office: val('office'),
    facebook: val('facebook'),
    linkedin: val('linkedin'),
    website: val('website'),
    showEmail: $('#showEmail', root)?.checked || false,
    showPhone: $('#showPhone', root)?.checked || false,
    programs: $$('[data-program][aria-pressed="true"]', root).map((b) => b.dataset.program),
    expertise: readTags(root, 'expertise')
  };
}

/* ==========================================================================
   Thesis tasks & availability
   ========================================================================== */

function tasksPanel(p) {
  const roles = p.roles || {};
  return html`
    <form class="form" id="availForm">
      <div>
        <h3 class="panel__title" style="font-size:var(--fs-md)">
          Which thesis tasks can you handle?
        </h3>
        <p class="section__sub">
          Switch on what you are willing to take. Students filter the directory
          by exactly these, so keeping them current saves everyone a round of
          emails.
        </p>
      </div>

      <div class="tasks" id="tasks">
        ${TASKS.map(([key, label, glyph, hint]) => {
          const value = roles[key] || 'Closed';
          const on = value !== 'Closed';
          return html`
            <div class="task ${on ? 'is-on' : ''}" data-task="${key}" data-level="${value}">
              <button class="task__glyph" type="button" role="switch"
                      data-task-toggle aria-checked="${on ? 'true' : 'false'}"
                      aria-labelledby="task-label-${key}">
                <span class="task__glyph-off" aria-hidden="true">${icon(glyph)}</span>
                <span class="task__glyph-on" aria-hidden="true">${icon('check')}</span>
              </button>
              <span class="task__text">
                <b id="task-label-${key}">${label}</b>
                <span>${hint}</span>
              </span>
              <span class="task__level" role="group" aria-label="${label} availability">
                <button type="button" data-level="Open" aria-pressed="${value === 'Open' ? 'true' : 'false'}">Open</button>
                <button type="button" data-level="Limited" aria-pressed="${value === 'Limited' ? 'true' : 'false'}">Limited</button>
              </span>
            </div>`;
        })}
      </div>

      <div class="notice">
        ${icon('info')}
        <div>
          <b>Open</b> means you are accepting. <b>Limited</b> tells students a
          few slots remain, so they know to ask early. Anything switched off is
          simply not shown as available.
        </div>
      </div>

      <div class="field">
        <label for="availabilityNote">Anything students should know?</label>
        <textarea class="textarea" id="availabilityNote" maxlength="400"
                  placeholder="e.g. Taking up to five advisees this semester. Message me before dropping by.">${p.availabilityNote || ''}</textarea>
      </div>

      <div class="form__actions">
        <button class="btn btn--primary" type="submit" id="saveAvail">
          ${icon('check', 'btn__icon')} Save availability
        </button>
      </div>
    </form>
  `;
}

/** Reads the task picker back into the `{adviser: 'Open', …}` shape. */
function readTasks(root) {
  const roles = {};
  TASKS.forEach(([key]) => {
    const node = $(`[data-task="${key}"]`, root);
    if (!node) return;
    roles[key] = node.dataset.level === 'Closed'
      ? 'Closed'
      : (node.dataset.level === 'Limited' ? 'Limited' : 'Open');
  });
  return roles;
}

/* ==========================================================================
   Schedule editor
   ========================================================================== */

function schedulePanel(p) {
  const slots = sortSlots(p.slots);
  return html`
    <div class="stack">
      <div class="section__head" style="margin:0">
        <div>
          <h3 class="panel__title" style="font-size:var(--fs-md)">Weekly consultation hours</h3>
          <p class="section__sub" style="margin:0">
            ${slots.length ? plural(slots.length, 'slot') : 'None posted yet'} — students see these on your profile.
          </p>
        </div>
        <button class="btn btn--primary btn--sm" type="button" data-act="add-slot">
          ${icon('plus', 'btn__icon')} Add slot
        </button>
      </div>

      ${slots.length ? html`
        <div class="slotlist">
          ${slots.map((slot) => html`
            <div class="slot" data-slot="${slot.id}">
              <div class="slot__day">${slot.day.slice(0, 3)}</div>
              <div>
                <div class="slot__time">${fmtRange(slot.start, slot.end)}</div>
                <div class="slot__meta">
                  ${slot.mode}${slot.venue ? ` · ${slot.venue}` : ''}
                  ${slot.active ? '' : ' · hidden from students'}
                </div>
              </div>
              <div class="slot__actions">
                <button class="icon-btn" type="button" data-act="edit-slot" data-id="${slot.id}"
                        aria-label="Edit ${slot.day} slot">${icon('edit')}</button>
                <button class="icon-btn" type="button" data-act="delete-slot" data-id="${slot.id}"
                        aria-label="Delete ${slot.day} slot">${icon('trash')}</button>
              </div>
            </div>`)}
        </div>
      ` : html`
        <div class="empty">
          ${icon('calendar')}
          <h3>No consultation hours yet</h3>
          <p>Add the times you are usually free. Students can then plan around them
             and add them to their own calendars.</p>
          <button class="btn btn--primary" type="button" data-act="add-slot">
            ${icon('plus', 'btn__icon')} Add your first slot
          </button>
        </div>
      `}
    </div>
  `;
}

function openSlotEditor(slot, onSaved) {
  const editing = Boolean(slot?.id);
  const value = {
    day: slot?.day || 'Monday',
    start: slot?.start || '09:00',
    end: slot?.end || '11:00',
    mode: slot?.mode || 'Face-to-face',
    venue: slot?.venue || '',
    note: slot?.note || '',
    active: slot?.active !== false
  };

  const close = openSheet({
    title: editing ? 'Edit consultation slot' : 'Add consultation slot',
    body: html`
      <form class="form" id="slotForm" novalidate>
        <div class="field">
          <label for="slotDay">Day</label>
          <select class="select" id="slotDay">
            ${DAYS.map((d) => html`<option value="${d}" ${d === value.day ? raw('selected') : ''}>${d}</option>`)}
          </select>
        </div>

        <div class="form__grid form__grid--2">
          <div class="field">
            <label for="slotStart">Start</label>
            <input class="input" id="slotStart" type="time" value="${value.start}" required>
          </div>
          <div class="field">
            <label for="slotEnd">End</label>
            <input class="input" id="slotEnd" type="time" value="${value.end}" required>
          </div>
        </div>

        <div class="field">
          <label for="slotMode">Mode</label>
          <select class="select" id="slotMode">
            ${MODES.map((m) => html`<option value="${m}" ${m === value.mode ? raw('selected') : ''}>${m}</option>`)}
          </select>
        </div>

        <div class="field">
          <label for="slotVenue">Venue or meeting link</label>
          <input class="input" id="slotVenue" value="${value.venue}"
                 placeholder="CAL 201, or a meeting link for online slots">
        </div>

        <div class="field">
          <label for="slotNote">Note (optional)</label>
          <input class="input" id="slotNote" value="${value.note}" maxlength="200"
                 placeholder="e.g. Thesis advisees only — message first">
        </div>

        <label class="switch">
          <input type="checkbox" id="slotActive" ${value.active ? raw('checked') : ''}>
          <span class="switch__track"></span>
          <span class="switch__text">
            <b>Visible to students</b>
            <span>Turn off to keep the slot saved but hidden.</span>
          </span>
        </label>
        <p class="field__error" id="slotError" hidden></p>
      </form>
    `,
    footer: html`
      <button class="btn" type="button" data-act="cancel">Cancel</button>
      <span class="spacer"></span>
      <button class="btn btn--primary" type="button" data-act="save">
        ${icon('check', 'btn__icon')} ${editing ? 'Save changes' : 'Add slot'}
      </button>
    `,
    onMount(node) {
      node.querySelector('[data-act="cancel"]').addEventListener('click', () => close());

      // Keep the end time sensible when the start moves.
      const start = $('#slotStart', node);
      const end = $('#slotEnd', node);
      on(start, 'change', () => {
        if (end.value && end.value <= start.value) {
          const [h, m] = start.value.split(':').map(Number);
          const next = new Date(2000, 0, 1, h + 1, m);
          end.value = `${String(next.getHours()).padStart(2, '0')}:${String(next.getMinutes()).padStart(2, '0')}`;
        }
      });

      const saveBtn = node.querySelector('[data-act="save"]');
      saveBtn.addEventListener('click', async () => {
        const errorEl = $('#slotError', node);
        const payload = {
          id: slot?.id || '',
          day: $('#slotDay', node).value,
          start: start.value,
          end: end.value,
          mode: $('#slotMode', node).value,
          venue: $('#slotVenue', node).value.trim(),
          note: $('#slotNote', node).value.trim(),
          active: $('#slotActive', node).checked
        };

        if (!payload.start || !payload.end || payload.end <= payload.start) {
          errorEl.textContent = 'The end time has to be after the start time.';
          errorEl.hidden = false;
          return;
        }

        saveBtn.classList.add('is-busy');
        errorEl.hidden = true;
        try {
          const data = await api.saveSlot(state.token, payload);
          setProfile(data.profile);
          toast(editing ? 'Slot updated' : 'Slot added', 'ok');
          onSaved?.();
          close();
        } catch (error) {
          errorEl.textContent = error.message;
          errorEl.hidden = false;
        } finally {
          saveBtn.classList.remove('is-busy');
        }
      });
    }
  });
}

/* ==========================================================================
   Account
   ========================================================================== */

function accountPanel(p) {
  return html`
    <div class="stack">
      <div class="panel" style="box-shadow:none">
        <h3 class="panel__title" style="font-size:var(--fs-md)">Your access code</h3>
        <p class="section__sub">
          Codes are stored hashed — nobody, including the coordinator, can read
          yours back. If someone else may have seen it, replace it.
        </p>
        <button class="btn" type="button" data-act="rotate">
          ${icon('key', 'btn__icon')} Replace my access code
        </button>
      </div>

      <div class="panel" style="box-shadow:none">
        <h3 class="panel__title" style="font-size:var(--fs-md)">Visibility</h3>
        <p class="section__sub">
          Your profile is currently
          <b>${p.status === 'Active' ? 'listed publicly' : p.status === 'Pending' ? 'not listed yet' : p.status.toLowerCase()}</b>.
          ${p.slotNo ? html`You hold roster slot <b>${p.slotNo}</b>.` : ''}
        </p>
        ${p.status === 'Active' ? html`
          <a class="btn btn--sm" href="#/faculty/${p.id}">
            ${icon('arrow', 'btn__icon')} View my public profile
          </a>` : ''}
      </div>

      <div class="panel" style="box-shadow:none;border-color:var(--stop-line)">
        <h3 class="panel__title" style="font-size:var(--fs-md);color:var(--stop-fg)">Remove my profile</h3>
        <p class="section__sub">
          This takes you off the directory and deletes your consultation slots.
          The coordinator keeps an archived record and can restore you later.
        </p>
        <button class="btn btn--danger" type="button" data-act="archive">
          ${icon('trash', 'btn__icon')} Remove me from the directory
        </button>
      </div>

      <button class="btn btn--ghost" type="button" data-act="signout" style="width:max-content">
        ${icon('logout', 'btn__icon')} Sign out
      </button>

      <p style="text-align:center;margin-top:8px">
        <span class="credit">${icon('star')} DAD by <b>Benedict de Jesus</b></span>
      </p>
    </div>
  `;
}

/* ==========================================================================
   Dashboard
   ========================================================================== */

const TABS = [
  ['profile', 'Profile'],
  ['tasks', 'Thesis tasks'],
  ['schedule', 'Schedule'],
  ['account', 'Account']
];

let activeTab = 'profile';

/** How complete a profile is, so the dashboard can nudge rather than nag. */
function completeness(p) {
  const items = [
    ['A photo', Boolean(p.photo)],
    ['Your rank', Boolean(p.rank)],
    ['Fields of expertise', (p.expertise || []).length > 0],
    ['A short bio', Boolean(p.bio)],
    ['At least one thesis task', Object.values(p.roles || {}).some((v) => v !== 'Closed')],
    ['Consultation hours', (p.slots || []).length > 0],
    ['A way to reach you', Boolean(p.email || p.facebook || p.linkedin)]
  ];
  const done = items.filter(([, ok]) => ok).length;
  return { done, total: items.length, missing: items.filter(([, ok]) => !ok).map(([label]) => label) };
}

function dashboard(p) {
  const progressInfo = completeness(p);
  const pct = Math.round((progressInfo.done / progressInfo.total) * 100);

  return html`
    <div class="shell">
      ${p.status === 'Pending' ? html`
        <div class="notice notice--warn" style="margin-top:16px">
          ${icon('star')}
          <div>
            <b>Welcome to DAD.</b> Your profile is not listed yet — fill in your
            name below and press <b>Save profile</b>, and you will appear in the
            directory straight away.
          </div>
        </div>` : ''}

      <div class="panel" style="margin-top:16px">
        <div class="row" style="gap:14px;align-items:flex-start">
          <div class="avatar" style="--size:52px">
            ${p.photo ? html`<img src="${p.photo}" alt="" onerror="this.remove()">` : ''}
            ${initials(p.name)}
          </div>
          <div style="flex:1;min-width:0">
            <h1 class="panel__title" style="font-size:var(--fs-xl)">
              ${p.name ? fullName(p) : 'Your profile'}
            </h1>
            <p class="section__sub" style="margin:0">
              ${[p.rank, p.affiliation === 'Guest' ? 'Guest faculty' : 'DCPA faculty']
                .filter(Boolean).join(' · ')}
            </p>
          </div>
          <button class="icon-btn" type="button" data-act="signout" aria-label="Sign out" title="Sign out">
            ${icon('logout')}
          </button>
        </div>

        ${pct < 100 ? html`
          <div class="meter" title="${progressInfo.done} of ${progressInfo.total} done">
            <div class="meter__bar"><span style="width:${pct}%"></span></div>
            <p class="meter__label">
              Profile ${pct}% complete — still to add: ${progressInfo.missing.slice(0, 3).join(', ')}${progressInfo.missing.length > 3 ? '…' : ''}
            </p>
          </div>` : html`
          <div class="meter">
            <p class="meter__label" style="color:var(--ok-fg)">
              ${icon('check')} Your profile is complete. Thank you — students can see everything they need.
            </p>
          </div>`}

        <div class="tabs" role="tablist" style="margin-bottom:0">
          ${TABS.map(([key, label]) => html`
            <button role="tab" type="button" data-ptab="${key}"
                    aria-selected="${activeTab === key ? 'true' : 'false'}">${label}</button>`)}
        </div>
      </div>

      <div class="panel" style="margin-top:16px" id="portalPanel"></div>
    </div>
  `;
}

function paintPanel(container, p) {
  const host = $('#portalPanel', container);
  if (!host) return;
  const panels = {
    profile: () => profileForm(p),
    tasks: () => tasksPanel(p),
    schedule: () => schedulePanel(p),
    account: () => accountPanel(p)
  };
  render(host, html`<div class="tabpanel">${panels[activeTab]()}</div>`);
}

/* ==========================================================================
   Mount
   ========================================================================== */

export function mount(container) {
  const offs = [];
  let mode = '';
  let adminCleanup = null;
  let paintedProfile = null;

  const paint = () => {
    const next = !state.token ? 'login' : state.role === 'admin' ? 'admin' : state.profile ? 'faculty' : 'loading';

    if (next === 'admin') {
      if (mode !== 'admin') {
        mode = 'admin';
        adminCleanup = mountAdmin(container);
      }
      return;
    }
    if (adminCleanup) {
      adminCleanup();
      adminCleanup = null;
    }

    if (next === mode && next === 'faculty') {
      // Only repaint when the profile actually changed — otherwise an
      // unrelated store update would wipe out whatever is being typed.
      if (state.profile !== paintedProfile) {
        paintedProfile = state.profile;
        render(container, dashboard(state.profile));
        paintPanel(container, state.profile);
      }
      return;
    }
    // Every sign-in starts on Profile. Without this, whoever signs in next
    // inherits the last person's tab — and a first-timer told to "fill in your
    // name below" would land on Account with no name field in sight.
    if (mode !== next) activeTab = 'profile';
    mode = next;

    if (next === 'login') {
      render(container, loginCard());
      wireLogin(container);
      return;
    }
    if (next === 'loading') {
      render(container, html`
        <div class="shell"><div class="panel" style="margin-top:24px">
          <div class="stack stack--tight">
            <div class="skel skel--title"></div>
            <div class="skel skel--line"></div>
            <div class="skel skel--line" style="width:70%"></div>
          </div>
        </div></div>`);
      return;
    }

    render(container, dashboard(state.profile));
    paintedProfile = state.profile;
    paintPanel(container, state.profile);
  };

  const repaint = () => {
    paintedProfile = state.profile;
    render(container, dashboard(state.profile));
    paintPanel(container, state.profile);
  };

  /* --- tabs and simple inputs -------------------------------------------- */

  offs.push(delegate(container, 'click', '[data-ptab]', (event, tab) => {
    activeTab = tab.dataset.ptab;
    $$('[data-ptab]', container).forEach((t) =>
      t.setAttribute('aria-selected', String(t.dataset.ptab === activeTab)));
    paintedProfile = state.profile;
    paintPanel(container, state.profile);
  }));

  offs.push(delegate(container, 'click', '[data-program]', (event, button) => {
    const pressed = button.getAttribute('aria-pressed') === 'true';
    button.setAttribute('aria-pressed', String(!pressed));
    markDirty(container);
  }));

  offs.push(on(container, 'input', (event) => {
    if (event.target.closest('#profileForm')) markDirty(container);
    if (event.target.id === 'bio') {
      const counter = $('#bioCount', container);
      if (counter) counter.textContent = String(event.target.value.length);
    }
  }));

  wireTagFields(container);

  /* --- thesis tasks ------------------------------------------------------- */

  // Tapping anywhere on the row (except the Open/Limited buttons) flips the
  // task on or off — the switch itself carries the accessible semantics.
  offs.push(delegate(container, 'click', '.task', (event, task) => {
    if (event.target.closest('.task__level')) return;
    setTaskState(task, task.dataset.level === 'Closed' ? 'Open' : 'Closed');
  }));

  offs.push(delegate(container, 'click', '.task__level button', (event, button) => {
    event.stopPropagation();
    setTaskState(button.closest('.task'), button.dataset.level);
  }));

  /* --- profile save ------------------------------------------------------- */

  offs.push(on(container, 'submit', async (event) => {
    const form = event.target;

    if (form.id === 'profileForm') {
      event.preventDefault();
      const button = $('#saveProfile', container);
      const payload = readProfileForm(container);
      if (!payload.name) {
        toast('Your name cannot be blank.', 'err');
        $('#name', container)?.focus();
        return;
      }
      button.classList.add('is-busy');
      progress.start();
      try {
        const data = await api.saveProfile(state.token, payload);
        const wasPending = state.profile?.status === 'Pending';
        setProfile(data.profile);
        repaint();
        toast(wasPending ? 'You are now listed in the directory.' : 'Profile saved', 'ok');
        loadDirectory({ force: true });
      } catch (error) {
        toast(error.message, 'err', 6000);
      } finally {
        button.classList.remove('is-busy');
        progress.done();
      }
    }

    if (form.id === 'availForm') {
      event.preventDefault();
      const button = $('#saveAvail', container);
      button.classList.add('is-busy');
      try {
        const data = await api.saveProfile(state.token, {
          roles: readTasks(container),
          availabilityNote: $('#availabilityNote', container).value.trim()
        });
        setProfile(data.profile);
        repaint();
        toast('Availability updated', 'ok');
        loadDirectory({ force: true });
      } catch (error) {
        toast(error.message, 'err', 6000);
      } finally {
        button.classList.remove('is-busy');
      }
    }
  }));

  /* --- photo -------------------------------------------------------------- */

  offs.push(delegate(container, 'click', '[data-act="pick-photo"]', () => {
    $('#photoInput', container)?.click();
  }));

  offs.push(on(container, 'change', (event) => {
    if (event.target.id !== 'photoInput') return;
    const file = event.target.files && event.target.files[0];
    event.target.value = '';
    if (file) uploadPhoto(file, container, repaint);
  }));

  offs.push(delegate(container, 'click', '[data-act="remove-photo"]', async () => {
    const ok = await confirmDialog({
      title: 'Remove your photo?',
      message: 'Students will see your initials instead. You can upload a new one any time.',
      confirmLabel: 'Remove photo'
    });
    if (!ok) return;
    try {
      const data = await api.removePhoto(state.token);
      setProfile(data.profile);
      repaint();
      toast('Photo removed', 'ok');
      loadDirectory({ force: true });
    } catch (error) {
      toast(error.message, 'err', 6000);
    }
  }));

  // Drag and drop onto the photo box.
  ['dragenter', 'dragover'].forEach((type) => {
    offs.push(on(container, type, (event) => {
      const field = event.target.closest('#photoField');
      if (!field) return;
      event.preventDefault();
      field.classList.add('is-dragover');
    }));
  });
  offs.push(on(container, 'dragleave', (event) => {
    event.target.closest('#photoField')?.classList.remove('is-dragover');
  }));
  offs.push(on(container, 'drop', (event) => {
    const field = event.target.closest('#photoField');
    if (!field) return;
    event.preventDefault();
    field.classList.remove('is-dragover');
    const file = event.dataTransfer?.files?.[0];
    if (file) uploadPhoto(file, container, repaint);
  }));

  /* --- schedule ----------------------------------------------------------- */

  offs.push(delegate(container, 'click', '[data-act="add-slot"]', () => {
    openSlotEditor(null, () => loadDirectory({ force: true }));
  }));

  offs.push(delegate(container, 'click', '[data-act="edit-slot"]', (event, button) => {
    const slot = (state.profile?.slots || []).find((s) => s.id === button.dataset.id);
    if (slot) openSlotEditor(slot, () => loadDirectory({ force: true }));
  }));

  offs.push(delegate(container, 'click', '[data-act="delete-slot"]', async (event, button) => {
    const slot = (state.profile?.slots || []).find((s) => s.id === button.dataset.id);
    if (!slot) return;
    const ok = await confirmDialog({
      title: 'Delete this slot?',
      message: `${slot.day}, ${fmtRange(slot.start, slot.end)} will be removed from your public schedule.`,
      confirmLabel: 'Delete slot'
    });
    if (!ok) return;
    try {
      const data = await api.deleteSlot(state.token, slot.id);
      setProfile(data.profile);
      repaint();
      toast('Slot deleted', 'ok');
      loadDirectory({ force: true });
    } catch (error) {
      toast(error.message, 'err', 6000);
    }
  }));

  /* --- account ------------------------------------------------------------ */

  offs.push(delegate(container, 'click', '[data-act="rotate"]', async () => {
    const ok = await confirmDialog({
      title: 'Replace your access code?',
      message: 'Your current code stops working immediately. Make sure you can copy the new one down now.',
      confirmLabel: 'Replace code',
      tone: 'primary'
    });
    if (!ok) return;
    try {
      const data = await api.rotateCode(state.token);
      showCodeOnce(data.code, 'Your new access code');
    } catch (error) {
      toast(error.message, 'err', 6000);
    }
  }));

  offs.push(delegate(container, 'click', '[data-act="archive"]', async () => {
    const ok = await confirmDialog({
      title: 'Remove your profile?',
      message: 'Students will no longer see you in the directory, and your consultation slots will be deleted. The coordinator can restore your record later.',
      confirmLabel: 'Remove my profile',
      requireText: 'REMOVE'
    });
    if (!ok) return;
    try {
      await api.archiveProfile(state.token, 'REMOVE');
      await signOut();
      loadDirectory({ force: true });
      toast('Your profile has been removed from the directory.', 'ok', 7000);
      navigate('/');
    } catch (error) {
      toast(error.message, 'err', 6000);
    }
  }));

  offs.push(delegate(container, 'click', '[data-act="signout"]', async () => {
    await signOut();
    toast('Signed out', 'info');
    mode = '';
    paint();
  }));

  offs.push(subscribe(paint));
  paint();

  return () => {
    if (adminCleanup) adminCleanup();
    offs.forEach((off) => off && off());
  };
}

/**
 * Single place that moves a task between Closed / Open / Limited and keeps the
 * switch, the highlight and the level buttons all telling the same story.
 */
function setTaskState(task, level) {
  if (!task) return;
  task.dataset.level = level;
  const isOn = level !== 'Closed';
  task.classList.toggle('is-on', isOn);
  task.querySelector('[data-task-toggle]')?.setAttribute('aria-checked', String(isOn));
  $$('.task__level button', task).forEach((b) =>
    b.setAttribute('aria-pressed', String(isOn && b.dataset.level === level)));
}

async function uploadPhoto(file, container, repaint) {
  const preview = $('#photoPreview', container);
  const busy = document.createElement('div');
  busy.className = 'photofield__busy';

  try {
    const dataUrl = await fileToSquareDataUrl(file);
    // Show the new photo immediately; the upload confirms it a moment later.
    render(preview, html`<img src="${dataUrl}" alt="">`);
    preview.parentElement.appendChild(busy);

    const data = await api.uploadPhoto(state.token, dataUrl);
    setProfile(data.profile);
    repaint();
    toast('Photo updated', 'ok');
    loadDirectory({ force: true });
  } catch (error) {
    busy.remove();
    repaint();
    toast(error.message || 'That photo could not be uploaded.', 'err', 6000);
  }
}

function markDirty(container) {
  $('#profileDirty', container)?.removeAttribute('hidden');
}
