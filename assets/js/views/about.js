/**
 * DAD — DCPA Advisers' Directory
 * About page, credits, and the connection settings panel used during setup.
 * Built and developed by Benedict de Jesus.
 */

import { html, render, $, delegate } from '../util.js';
import { icon, toast } from '../ui.js';
import { CONFIG } from '../config.js';
import { state, loadDirectory } from '../store.js';
import { api } from '../api.js';

const FAQ = [
  [
    'How do I choose an adviser?',
    'Filter by the thesis task you need — Thesis Adviser, Critic, Thesis Consultant ' +
    'or Media Expert — then look at fields of expertise. “Open” means they are ' +
    'accepting; “Limited” means a few slots remain. Always message before dropping by.'
  ],
  [
    'The schedule says a slot is open. Do I still need to message first?',
    'Yes. Consultation hours are when a faculty member is usually available, not a ' +
    'booking. A short message avoids a wasted trip across campus.'
  ],
  [
    'Can I message an adviser on Facebook?',
    'If they have added their Facebook or LinkedIn, you will see a button for it on ' +
    'their profile. Keep it professional and introduce yourself — year, programme, ' +
    'and what you are working on.'
  ],
  [
    'Why can I not see someone’s phone number?',
    'Each faculty member decides which contact details are published. If nothing is ' +
    'listed, reach them through the department office.'
  ],
  [
    'Do I need an account to browse?',
    'No. The directory is completely open and nothing about your visit is recorded. ' +
    'Only faculty members sign in, and only to edit their own entry.'
  ],
  [
    'I am faculty. How do I get in?',
    'The department coordinator issues you an access code. Open the Faculty portal ' +
    'and sign in — you can then edit your profile, photo, consultation hours and ' +
    'availability yourself, from your phone.'
  ],
  [
    'I lost my access code.',
    'Codes are stored hashed, so nobody can look yours up. Ask the coordinator to ' +
    'issue a new one; the old code stops working the moment they do.'
  ]
];

export function mount(container) {
  const site = state.meta?.site || {};
  const author = site.author || 'Benedict de Jesus';

  render(container, html`
    <div class="shell">
      <section class="panel" style="margin-top:16px">
        <div class="seal-lockup" style="margin-bottom:20px">
          <span class="seals">
            <span class="seal seal--adaptive">
              <img src="assets/img/cal-logo.png" width="192" height="191"
                   alt="Seal of the College of Arts and Letters, Bulacan State University">
            </span>
            <span class="seal seal--adaptive">
              <img src="assets/img/dcpa-logo.png" width="192" height="192"
                   alt="Seal of the Department of Communication and Performing Arts">
            </span>
          </span>
          <div class="seal-lockup__text">
            <h3>${site.department || 'Department of Communication and Performing Arts'}</h3>
            <p>
              ${site.college || 'College of Arts and Letters'} ·
              ${site.university || 'Bulacan State University'}
            </p>
          </div>
        </div>

        <h1 class="panel__title" style="font-size:var(--fs-2xl)">About DAD</h1>
        <p class="panel__sub">DCPA Advisers' Directory</p>
        <p>
          DAD is the advisers' directory of the <b>Department of Communication and
          Performing Arts</b> — ${site.college || 'College of Arts and Letters'},
          ${site.university || 'Bulacan State University'}. It brings together the
          people students in BA Broadcasting, BA Journalism and the Bachelor in
          Performing Arts need to reach: their fields of expertise, where and when
          they hold consultations, the thesis tasks they can take on, and how to
          contact them.
        </p>
        <p style="margin-top:12px">
          Guest faculty from the other departments of CAL are listed alongside DCPA
          faculty, because thesis panels and creative projects rarely stay inside
          one department.
        </p>
        ${site.term ? html`<p style="margin-top:12px"><span class="badge badge--brand">${site.term}</span></p>` : ''}
      </section>

      <section class="panel" style="margin-top:16px">
        <h2 class="panel__title" style="font-size:var(--fs-lg)">Two ways in</h2>
        <p class="panel__sub">One site, two very different jobs.</p>
        <div class="form__grid form__grid--2" style="margin-top:8px">
          <div class="card card--pad">
            <div class="row" style="gap:10px;margin-bottom:8px">
              <span class="social-btn__glyph" style="--social:var(--brand-500)">${icon('student')}</span>
              <b>Students</b>
            </div>
            <p class="section__sub" style="margin:0">
              View only. Browse and search advisers, read profiles and schedules,
              tap through to Facebook or LinkedIn, export consultation hours to
              your calendar. No sign-in, no account, nothing recorded.
            </p>
          </div>
          <div class="card card--pad">
            <div class="row" style="gap:10px;margin-bottom:8px">
              <span class="social-btn__glyph" style="--social:var(--accent-600)">${icon('key')}</span>
              <b>Faculty</b>
            </div>
            <p class="section__sub" style="margin:0">
              Sign in with an access code to maintain your own entry — photo,
              expertise, thesis tasks, consultation hours and contact details.
              You are the only person who can edit your profile.
            </p>
          </div>
        </div>
      </section>

      <section class="panel" style="margin-top:16px">
        <h2 class="panel__title" style="font-size:var(--fs-lg)">Who keeps it current</h2>
        <p class="panel__sub">Every profile is maintained by the faculty member it belongs to.</p>
        <ul class="stack stack--tight">
          ${[
            ['users', 'Faculty members sign in with an access code and edit their own record — no forms to submit, no waiting on an administrator.'],
            ['shield', 'The department coordinator issues codes, adds new members, and keeps the roster tidy.'],
            ['calendar', 'Consultation hours are published by each faculty member and can be added straight to your calendar.']
          ].map(([glyph, text]) => html`
            <li class="row" style="gap:10px;align-items:flex-start;flex-wrap:nowrap">
              <span style="color:var(--brand-500);flex:none;margin-top:2px">${icon(glyph)}</span>
              <span>${text}</span>
            </li>`)}
        </ul>
      </section>

      <section class="panel" style="margin-top:16px">
        <h2 class="panel__title" style="font-size:var(--fs-lg)">Questions</h2>
        <div class="stack stack--tight" style="margin-top:12px">
          ${FAQ.map(([question, answer]) => html`
            <details class="card card--pad faq">
              <summary><b>${question}</b></summary>
              <p style="margin-top:10px;color:var(--text-muted)">${answer}</p>
            </details>`)}
        </div>
      </section>

      <section class="panel" style="margin-top:16px">
        <h2 class="panel__title" style="font-size:var(--fs-lg)">Privacy</h2>
        <p>
          Students are not tracked. No accounts, no analytics, no record of who
          looked at what — browsing DAD leaves nothing behind. The database holds
          only three things: faculty access codes, faculty profile data, and the
          schedule and availability updates faculty make themselves.
        </p>
        <p style="margin-top:12px">
          Only what a faculty member chooses to publish appears here. Email and
          phone each have their own visibility switch, social links are entirely
          optional, and any member can remove themselves from the directory at
          any time.
        </p>
        ${site.contactEmail ? html`
          <p style="margin-top:12px">
            Corrections or concerns:
            <a href="mailto:${site.contactEmail}">${site.contactEmail}</a>
          </p>` : ''}
      </section>

      <section class="panel" style="margin-top:16px">
        <h2 class="panel__title" style="font-size:var(--fs-lg)">College and Department leadership</h2>
        <p class="panel__sub">
          DAD serves the Department under the leadership of:
        </p>
        <ul class="leaders">
          <li class="leader">
            <span class="leader__mark" aria-hidden="true">${icon('star')}</span>
            <span class="leader__text">
              <b>${site.dean || 'Dr. Lois Ruth B. Villavicencio'}</b>
              <span>${site.deanTitle || 'Dean, College of Arts and Letters'}</span>
            </span>
          </li>
          <li class="leader">
            <span class="leader__mark" aria-hidden="true">${icon('star')}</span>
            <span class="leader__text">
              <b>${site.chair || 'Mr. Marlon B. Santos'}</b>
              <span>${site.chairTitle || 'Chairperson, Department of Communication and Performing Arts'}</span>
            </span>
          </li>
        </ul>
      </section>

      <section class="panel" style="margin-top:16px">
        <h2 class="panel__title" style="font-size:var(--fs-lg)">Developer</h2>
        <div class="author-card" style="margin-top:12px">
          <span class="author-card__mark" aria-hidden="true">BdJ</span>
          <div>
            <h3>${author}</h3>
            <p class="author-card__role">Sole developer &amp; administrator, DAD</p>
            <p>
              ${author} designed, built and maintains DAD single-handedly — the
              architecture, the interface, the database design and the
              documentation.
            </p>
            <p style="margin-top:10px">
              DAD is a personal gift to the Department of Communication and
              Performing Arts: built so that resource persons for thesis work —
              advisers, consultants, critics and media experts — are findable by
              the students who need them, and so that keeping the directory
              accurate never becomes anyone's second job.
            </p>
          </div>
        </div>
        <p class="section__sub" style="margin-top:14px">
          Built with plain HTML, CSS and JavaScript over Google Sheets and Apps
          Script. No framework, no tracking, no dependencies to rot.
        </p>
      </section>

      <details class="panel" style="margin-top:16px" id="connPanel">
        <summary style="cursor:pointer;font-weight:700">
          ${icon('link')} Connection settings
        </summary>
        <div class="stack" style="margin-top:16px">
          <p class="section__sub" style="margin:0">
            Where this site reads its data from. You only need this when setting
            the site up or moving it to a new spreadsheet.
          </p>
          <div class="field">
            <label for="apiBase">Apps Script Web App URL</label>
            <input class="input" id="apiBase" type="url" spellcheck="false"
                   placeholder="https://script.google.com/macros/s/…/exec"
                   value="${CONFIG.apiBase}">
            <p class="field__hint">
              Saved in this browser only. For a permanent setting, paste it into
              <code>assets/js/config.js</code> and commit.
            </p>
          </div>
          <div class="row">
            <button class="btn btn--primary btn--sm" type="button" data-act="save-api">
              ${icon('check', 'btn__icon')} Save &amp; test
            </button>
            <button class="btn btn--ghost btn--sm" type="button" data-act="clear-api">Clear override</button>
          </div>
          <div id="connResult"></div>
        </div>
      </details>

      <p style="text-align:center;margin-top:24px">
        <span class="credit">${icon('star')} DAD — designed and developed by <b>${author}</b></span>
      </p>
    </div>
  `);

  const offs = [];

  offs.push(delegate(container, 'click', '[data-act="save-api"]', async (event, button) => {
    const url = $('#apiBase', container).value.trim();
    CONFIG.setApiBase(url);
    button.classList.add('is-busy');
    const result = $('#connResult', container);
    try {
      const pong = await api.meta();
      render(result, html`
        <div class="notice notice--ok">${icon('check')}<div>
          Connected. Reading “${pong.site?.title || 'directory'}”.
        </div></div>`);
      loadDirectory({ force: true });
      toast('Connected to the directory service', 'ok');
    } catch (error) {
      render(result, html`
        <div class="notice notice--stop">${icon('alert')}<div>${error.message}</div></div>`);
    } finally {
      button.classList.remove('is-busy');
    }
  }));

  offs.push(delegate(container, 'click', '[data-act="clear-api"]', () => {
    CONFIG.setApiBase('');
    $('#apiBase', container).value = CONFIG.apiBase;
    render($('#connResult', container), '');
    toast('Override cleared', 'info');
  }));

  // Open the connection panel automatically when nothing is configured yet.
  if (!CONFIG.isConfigured) $('#connPanel', container).open = true;

  return () => offs.forEach((off) => off());
}
