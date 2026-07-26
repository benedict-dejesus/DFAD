/**
 * DFAD — DCPA Faculty Advisers Directory
 * Coordinator dashboard.
 * Built and developed by Benedict de Jesus.
 *
 * Reached by signing in with a coordinator access code. Adds and removes
 * faculty records, issues access codes, and edits the site-wide settings that
 * appear in the header and footer.
 *
 * Deliberately thin: faculty maintain their own profiles, so the coordinator's
 * job is only ever roster management, not data entry.
 */

import {
  html, raw, render, $, $$, delegate, on, normalize, fullName,
  initials, relTime, plural
} from '../util.js';
import { icon, toast, openSheet, confirmDialog, showCodeOnce, emptyState, errorState } from '../ui.js';
import { state, signOut, loadDirectory } from '../store.js';
import { api } from '../api.js';

const AFFILIATIONS = ['DCPA', 'Guest'];
const STATUSES = ['Pending', 'Active', 'Hidden', 'Archived'];
const SETTING_FIELDS = [
  ['announcement', 'Announcement banner', 'Shown at the top of the directory. Leave blank to hide.'],
  ['term', 'Current term', 'e.g. First Semester, AY 2026–2027'],
  ['site_title', 'Site title', ''],
  ['site_tagline', 'Tagline', ''],
  ['contact_email', 'Department contact email', ''],
  ['dean', 'College Dean', 'Shown in the footer and on the About page.'],
  ['dean_title', 'Dean’s title', 'e.g. Dean, College of Arts and Letters'],
  ['chair', 'Department Chairperson', 'Shown in the footer and on the About page.'],
  ['chair_title', 'Chairperson’s title', 'e.g. Chairperson, Department of Communication and Performing Arts'],
  ['proponent', 'Proponent', 'Who proposed the idea. Shown in the footer and on the About page.'],
  ['proponent_title', 'Proponent’s credit line', 'e.g. Proponent — originated the idea for DFAD'],
  ['author', 'Developer credit', 'Shown in the footer and on the About page.']
];

let data = { faculty: [], settings: {} };
let query = '';
let statusFilter = 'All';

/* --------------------------------------------------------------------------
   Rows
   -------------------------------------------------------------------------- */

function facultyRow(person) {
  const tone = person.status === 'Active' ? 'ok'
    : person.status === 'Hidden' ? 'warn'
    : person.status === 'Pending' ? 'info' : '';
  const unclaimed = person.status === 'Pending' && !person.name;
  return html`
    <div class="slot" data-row="${person.id}" style="grid-template-columns:42px 1fr auto">
      <div class="avatar" style="--size:42px;border-radius:14px">
        ${person.photo ? html`<img src="${person.photo}" alt="" loading="lazy" onerror="this.remove()">` : ''}
        ${unclaimed ? person.slotNo || '—' : initials(person.name)}
      </div>
      <div style="min-width:0">
        <div class="slot__time" style="font-weight:700">
          ${unclaimed ? html`<span style="color:var(--text-faint)">Slot ${person.slotNo} — unclaimed</span>` : fullName(person)}
        </div>
        <div class="slot__meta">
          <span class="badge ${tone ? `badge--${tone}` : ''}">${person.status}</span>
          <span class="badge ${person.affiliation === 'Guest' ? 'badge--accent' : 'badge--brand'}">
            ${person.affiliation}
          </span>
          ${person.activeCodes
            ? html`<span class="badge">${plural(person.activeCodes, 'code')}</span>`
            : html`<span class="badge badge--stop">No code</span>`}
          ${person.lastUsedAt ? html`<span class="badge">Signed in ${relTime(person.lastUsedAt)}</span>` : ''}
          <span class="badge">${plural((person.slots || []).length, 'slot')}</span>
        </div>
      </div>
      <div class="slot__actions">
        <button class="icon-btn" type="button" data-act="admin-edit" data-id="${person.id}"
                aria-label="Manage ${person.name}">${icon('edit')}</button>
      </div>
    </div>
  `;
}

function shell() {
  return html`
    <div class="shell">
      <div class="panel" style="margin-top:16px">
        <div class="row" style="gap:12px">
          <span class="avatar" style="--size:44px;border-radius:14px">${icon('shield')}</span>
          <div style="flex:1;min-width:0">
            <h1 class="panel__title" style="font-size:var(--fs-xl)">Coordinator dashboard</h1>
            <p class="section__sub" style="margin:0">
              Manage the DCPA faculty directory and its access codes.
            </p>
          </div>
          <button class="icon-btn" type="button" data-act="signout" aria-label="Sign out" title="Sign out">
            ${icon('logout')}
          </button>
        </div>
      </div>

      <div class="panel" style="margin-top:16px">
        <div class="section__head" style="margin-bottom:12px">
          <h2 class="panel__title" style="font-size:var(--fs-md)">Faculty records</h2>
          <div class="row" style="gap:8px">
            <button class="btn btn--sm" type="button" data-act="refresh">
              ${icon('refresh', 'btn__icon')} Refresh
            </button>
            <button class="btn btn--primary btn--sm" type="button" data-act="add">
              ${icon('plus', 'btn__icon')} Add faculty
            </button>
          </div>
        </div>

        <div class="search ${query ? 'has-value' : ''}" style="margin-bottom:12px">
          ${icon('search')}
          <input id="aq" type="search" placeholder="Search records" aria-label="Search records" value="${query}">
        </div>

        <div class="chiprow" role="group" aria-label="Filter by status" style="margin-bottom:14px">
          ${['All', 'Active', 'Pending', 'Hidden', 'Archived'].map((s) => html`
            <button class="chip" type="button" data-status="${s}"
                    aria-pressed="${statusFilter === s ? 'true' : 'false'}">${s}</button>`)}
        </div>

        <div id="adminList" class="slotlist"></div>

        <div class="notice" style="margin-top:14px">
          ${icon('info')}
          <div>
            <b>Pending</b> slots are pre-issued codes nobody has claimed yet.
            They stay invisible to students until the faculty member signs in
            and saves their name — then they list themselves automatically.
          </div>
        </div>
      </div>

      <div class="panel" style="margin-top:16px">
        <h2 class="panel__title" style="font-size:var(--fs-md)">Site settings</h2>
        <p class="section__sub">These appear on the public directory.</p>
        <form class="form" id="settingsForm">
          ${SETTING_FIELDS.map(([key, label, hint]) => html`
            <div class="field">
              <label for="set_${key}">${label}</label>
              ${key === 'announcement'
                ? html`<textarea class="textarea" id="set_${key}" maxlength="400"
                                 style="min-height:80px">${data.settings[key] || ''}</textarea>`
                : html`<input class="input" id="set_${key}" value="${data.settings[key] || ''}" maxlength="200">`}
              ${hint ? html`<p class="field__hint">${hint}</p>` : ''}
            </div>`)}
          <button class="btn btn--primary" type="submit" id="saveSettings" style="width:max-content">
            ${icon('check', 'btn__icon')} Save settings
          </button>
        </form>
      </div>

      <p style="text-align:center;margin-top:20px">
        <span class="credit">
          ${icon('star')} DFAD is designed and developed by <b>Benedict de Jesus</b>
        </span>
      </p>
    </div>
  `;
}

/* --------------------------------------------------------------------------
   Editors
   -------------------------------------------------------------------------- */

function openAddFaculty(onDone) {
  const close = openSheet({
    title: 'Add a faculty member',
    subtitle: 'An access code is generated once you save.',
    body: html`
      <form class="form" id="addForm" novalidate>
        <div class="field">
          <label for="newName">Full name <span aria-hidden="true">*</span></label>
          <input class="input" id="newName" required autofocus maxlength="120" placeholder="Juana dela Cruz">
        </div>
        <div class="form__grid form__grid--2">
          <div class="field">
            <label for="newHonorific">Title</label>
            <input class="input" id="newHonorific" placeholder="Dr. / Prof." maxlength="24">
          </div>
          <div class="field">
            <label for="newRank">Rank / position</label>
            <input class="input" id="newRank" placeholder="Instructor I" maxlength="80">
          </div>
        </div>
        <div class="field">
          <label for="newAffiliation">Affiliation</label>
          <select class="select" id="newAffiliation">
            ${AFFILIATIONS.map((a) => html`
              <option value="${a}">${a === 'DCPA' ? 'DCPA faculty' : 'Guest faculty (other CAL department)'}</option>`)}
          </select>
        </div>
        <div class="field">
          <label for="newDepartment">Department</label>
          <input class="input" id="newDepartment" maxlength="140"
                 value="Department of Communication and Performing Arts">
        </div>
        <div class="field">
          <label for="newEmail">Email</label>
          <input class="input" id="newEmail" type="email" placeholder="name@bulsu.edu.ph">
          <p class="field__hint">
            The faculty member can fill in everything else themselves once they sign in.
          </p>
        </div>
        <p class="field__error" id="addError" hidden></p>
      </form>
    `,
    footer: html`
      <button class="btn" type="button" data-act="cancel">Cancel</button>
      <span class="spacer"></span>
      <button class="btn btn--primary" type="button" data-act="create">
        ${icon('plus', 'btn__icon')} Create &amp; issue code
      </button>
    `,
    onMount(node) {
      node.querySelector('[data-act="cancel"]').addEventListener('click', () => close());

      // Guests default to a blank department so the coordinator fills in theirs.
      on($('#newAffiliation', node), 'change', (event) => {
        const dept = $('#newDepartment', node);
        if (event.target.value === 'Guest' &&
            dept.value === 'Department of Communication and Performing Arts') {
          dept.value = '';
          dept.focus();
        } else if (event.target.value === 'DCPA' && !dept.value) {
          dept.value = 'Department of Communication and Performing Arts';
        }
      });

      const button = node.querySelector('[data-act="create"]');
      button.addEventListener('click', async () => {
        const errorEl = $('#addError', node);
        const profile = {
          name: $('#newName', node).value.trim(),
          honorific: $('#newHonorific', node).value.trim(),
          rank: $('#newRank', node).value.trim(),
          affiliation: $('#newAffiliation', node).value,
          department: $('#newDepartment', node).value.trim(),
          email: $('#newEmail', node).value.trim(),
          showEmail: true,
          status: 'Active'
        };
        if (!profile.name) {
          errorEl.textContent = 'A name is required.';
          errorEl.hidden = false;
          return;
        }
        button.classList.add('is-busy');
        try {
          const result = await api.adminCreate(state.token, profile);
          close();
          showCodeOnce(result.code, `Access code for ${profile.name}`);
          onDone?.();
        } catch (error) {
          errorEl.textContent = error.message;
          errorEl.hidden = false;
        } finally {
          button.classList.remove('is-busy');
        }
      });
    }
  });
}

function openManageFaculty(person, onDone) {
  const close = openSheet({
    title: fullName(person),
    subtitle: [person.rank, person.department].filter(Boolean).join(' · '),
    body: html`
      <form class="form" id="manageForm">
        <div class="form__grid form__grid--2">
          <div class="field">
            <label for="mStatus">Listing status</label>
            <select class="select" id="mStatus">
              ${STATUSES.map((s) => html`
                <option value="${s}" ${person.status === s ? raw('selected') : ''}>
                  ${s === 'Active' ? 'Active — visible to students'
                    : s === 'Hidden' ? 'Hidden — temporarily off the directory'
                    : 'Archived — kept for records only'}
                </option>`)}
            </select>
          </div>
          <div class="field">
            <label for="mAffiliation">Affiliation</label>
            <select class="select" id="mAffiliation">
              ${AFFILIATIONS.map((a) => html`
                <option value="${a}" ${person.affiliation === a ? raw('selected') : ''}>
                  ${a === 'DCPA' ? 'DCPA faculty' : 'Guest faculty'}
                </option>`)}
            </select>
          </div>
        </div>

        <div class="form__grid form__grid--2">
          <div class="field">
            <label for="mName">Name</label>
            <input class="input" id="mName" value="${person.name}" maxlength="120">
          </div>
          <div class="field">
            <label for="mSort">Sort order</label>
            <input class="input" id="mSort" type="number" value="${person.sortOrder || 0}" step="1">
            <p class="field__hint">Lower numbers appear first. Ties fall back to A–Z.</p>
          </div>
        </div>

        <div class="field">
          <label for="mDepartment">Department</label>
          <input class="input" id="mDepartment" value="${person.department || ''}" maxlength="140">
        </div>

        <button class="btn btn--primary" type="submit" id="mSave" style="width:max-content">
          ${icon('check', 'btn__icon')} Save changes
        </button>
      </form>

      <hr class="divider">

      <h3 class="panel__title" style="font-size:var(--fs-md)">Access</h3>
      <p class="section__sub">
        ${person.activeCodes
          ? `${plural(person.activeCodes, 'active code')}${person.lastUsedAt ? ` · last used ${relTime(person.lastUsedAt)}` : ' · never used'}`
          : 'No active code — issue one so they can sign in.'}
      </p>
      <div class="row" style="gap:8px">
        <button class="btn btn--sm" type="button" data-act="issue">
          ${icon('key', 'btn__icon')} Issue new code
        </button>
        <button class="btn btn--sm" type="button" data-act="revoke">
          ${icon('shield', 'btn__icon')} Revoke all codes
        </button>
      </div>

      <hr class="divider">

      <h3 class="panel__title" style="font-size:var(--fs-md);color:var(--stop-fg)">Danger zone</h3>
      <p class="section__sub">
        Deleting removes the record, its consultation slots and its codes for good.
        Prefer <b>Archived</b> above if you might need the record later.
      </p>
      <button class="btn btn--danger btn--sm" type="button" data-act="delete">
        ${icon('trash', 'btn__icon')} Delete permanently
      </button>
    `,
    onMount(node) {
      on($('#manageForm', node), 'submit', async (event) => {
        event.preventDefault();
        const button = $('#mSave', node);
        button.classList.add('is-busy');
        try {
          await api.adminUpdate(state.token, person.id, {
            status: $('#mStatus', node).value,
            affiliation: $('#mAffiliation', node).value,
            name: $('#mName', node).value.trim(),
            department: $('#mDepartment', node).value.trim(),
            sortOrder: Number($('#mSort', node).value) || 0
          });
          toast('Record updated', 'ok');
          close();
          onDone?.();
        } catch (error) {
          toast(error.message, 'err', 6000);
        } finally {
          button.classList.remove('is-busy');
        }
      });

      node.querySelector('[data-act="issue"]').addEventListener('click', async () => {
        const ok = await confirmDialog({
          title: 'Issue a new code?',
          message: `Any code ${person.name} is using now will stop working immediately.`,
          confirmLabel: 'Issue new code',
          tone: 'primary'
        });
        if (!ok) return;
        try {
          const result = await api.adminIssueCode(state.token, person.id, person.name);
          close();
          showCodeOnce(result.code, `Access code for ${person.name}`);
          onDone?.();
        } catch (error) {
          toast(error.message, 'err', 6000);
        }
      });

      node.querySelector('[data-act="revoke"]').addEventListener('click', async () => {
        const ok = await confirmDialog({
          title: 'Revoke all codes?',
          message: `${person.name} will be signed out and will not be able to sign in until you issue a new code.`,
          confirmLabel: 'Revoke codes'
        });
        if (!ok) return;
        try {
          const result = await api.adminRevokeCodes(state.token, person.id);
          toast(`${plural(result.revoked, 'code')} revoked`, 'ok');
          close();
          onDone?.();
        } catch (error) {
          toast(error.message, 'err', 6000);
        }
      });

      node.querySelector('[data-act="delete"]').addEventListener('click', async () => {
        const ok = await confirmDialog({
          title: `Delete ${person.name}?`,
          message: 'This permanently removes the profile, its consultation slots and its access codes. It cannot be undone.',
          confirmLabel: 'Delete permanently',
          requireText: 'DELETE'
        });
        if (!ok) return;
        try {
          await api.adminDelete(state.token, person.id, 'DELETE');
          toast('Record deleted', 'ok');
          close();
          onDone?.();
        } catch (error) {
          toast(error.message, 'err', 6000);
        }
      });
    }
  });
}

/* --------------------------------------------------------------------------
   Mount
   -------------------------------------------------------------------------- */

export function mountAdmin(container) {
  const offs = [];
  let loadError = null;

  const paintList = () => {
    const host = $('#adminList', container);
    if (!host) return;

    if (loadError) {
      render(host, errorState(loadError));
      return;
    }

    const needle = normalize(query).trim();
    const list = data.faculty.filter((p) => {
      if (statusFilter !== 'All' && p.status !== statusFilter) return false;
      if (!needle) return true;
      return normalize([p.name, p.rank, p.department, p.email].filter(Boolean).join(' '))
        .includes(needle);
    });

    if (!list.length) {
      render(host, emptyState({
        title: 'No records here',
        message: data.faculty.length
          ? 'Nothing matches this filter yet.'
          : 'Add your first faculty member to get started.'
      }));
      return;
    }
    render(host, html`${list.map(facultyRow)}`);
  };

  // The settings form is rendered before the first fetch resolves, so its
  // values are filled in afterwards rather than re-rendering the whole shell.
  const paintSettings = () => {
    SETTING_FIELDS.forEach(([key]) => {
      const field = $(`#set_${key}`, container);
      if (field && document.activeElement !== field) field.value = data.settings[key] || '';
    });
  };

  const load = async () => {
    try {
      data = await api.adminList(state.token);
      loadError = null;
    } catch (error) {
      loadError = error;
    }
    paintList();
    paintSettings();
  };

  const paintShell = () => {
    render(container, shell());
    paintList();
  };

  offs.push(delegate(container, 'click', '[data-status]', (event, node) => {
    statusFilter = node.dataset.status;
    $$('[data-status]', container).forEach((n) =>
      n.setAttribute('aria-pressed', String(n.dataset.status === statusFilter)));
    paintList();
  }));

  offs.push(on(container, 'input', (event) => {
    if (event.target.id !== 'aq') return;
    query = event.target.value;
    event.target.closest('.search')?.classList.toggle('has-value', Boolean(query));
    paintList();
  }));

  offs.push(delegate(container, 'click', '[data-act="add"]', () => {
    openAddFaculty(async () => {
      await load();
      loadDirectory({ force: true });
    });
  }));

  offs.push(delegate(container, 'click', '[data-act="admin-edit"]', (event, button) => {
    const person = data.faculty.find((p) => p.id === button.dataset.id);
    if (!person) return;
    openManageFaculty(person, async () => {
      await load();
      loadDirectory({ force: true });
    });
  }));

  offs.push(delegate(container, 'click', '[data-act="refresh"]', async () => {
    await load();
    loadDirectory({ force: true });
    toast('Records refreshed', 'ok', 1800);
  }));

  offs.push(delegate(container, 'click', '[data-retry]', load));

  offs.push(delegate(container, 'click', '[data-act="signout"]', async () => {
    await signOut();
    toast('Signed out', 'info');
  }));

  offs.push(on(container, 'submit', async (event) => {
    if (event.target.id !== 'settingsForm') return;
    event.preventDefault();
    const button = $('#saveSettings', container);
    button.classList.add('is-busy');
    try {
      for (const [key] of SETTING_FIELDS) {
        const field = $(`#set_${key}`, container);
        if (!field) continue;
        const value = field.value.trim();
        if (value === (data.settings[key] || '')) continue;
        await api.adminSetSetting(state.token, key, value);
        data.settings[key] = value;
      }
      toast('Settings saved — students see them on the next refresh.', 'ok');
    } catch (error) {
      toast(error.message, 'err', 6000);
    } finally {
      button.classList.remove('is-busy');
    }
  }));

  paintShell();
  load();

  return () => offs.forEach((off) => off());
}
