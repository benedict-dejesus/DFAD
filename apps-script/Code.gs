/**
 * DAD — DCPA Advisers' Directory
 * Built and developed by Benedict de Jesus.
 *
 * Code.gs — HTTP entry points and the API surface.
 *
 * Two audiences, two very different surfaces:
 *
 *   Students   read-only. `meta`, `directory` and `faculty` are the whole of
 *              it. No sign-in, no session, nothing recorded about them.
 *
 *   Faculty    everything else. Every write requires an access code, and the
 *              server checks ownership on each one — it never trusts the page.
 *
 * Transport notes
 * ---------------
 * Apps Script cannot answer a CORS preflight, so the browser client sends
 * POSTs with `Content-Type: text/plain` (a "simple request" that skips
 * preflight) and puts the JSON payload in the body. Public reads may also use
 * GET, and optionally JSONP via `?callback=` for networks that mangle the
 * cross-origin redirect Apps Script issues.
 */

const API_VERSION = '2.0.0';

/** Read-only actions students use. Safe over GET and JSONP. */
const PUBLIC_ACTIONS = ['ping', 'meta', 'directory', 'faculty'];

function doGet(e) {
  return handle_(e, 'GET');
}

function doPost(e) {
  return handle_(e, 'POST');
}

function handle_(e, method) {
  const params = (e && e.parameter) || {};
  let body = {};
  if (e && e.postData && e.postData.contents) {
    try {
      body = JSON.parse(e.postData.contents) || {};
    } catch (err) {
      body = {};
    }
  }
  const req = Object.assign({}, params, body);
  const action = str_(req.action) || 'ping';
  const callback = String(params.callback || '').replace(/[^\w.$]/g, '').slice(0, 60);

  let payload;
  try {
    const routes = routes_();
    const handler = routes[action];
    if (!handler) throw httpError_(404, 'Unknown action: ' + action);
    if (method === 'GET' && PUBLIC_ACTIONS.indexOf(action) === -1) {
      throw httpError_(405, 'This action must be sent as a POST request.');
    }
    payload = { ok: true, data: handler(req) };
  } catch (err) {
    const code = (err && err.__code) || 500;
    if (code >= 500) console.error(action + ' failed: ' + (err && err.stack ? err.stack : err));
    payload = { ok: false, error: { code: code, message: (err && err.message) || String(err) } };
  }
  payload.version = API_VERSION;

  const json = JSON.stringify(payload);
  if (callback && PUBLIC_ACTIONS.indexOf(action) !== -1) {
    return ContentService
      .createTextOutput(callback + '(' + json + ');')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(json).setMimeType(ContentService.MimeType.JSON);
}

function routes_() {
  return {
    // --- student-facing, read-only ---
    ping: apiPing_,
    meta: apiMeta_,
    directory: apiDirectory_,
    faculty: apiFaculty_,
    // --- faculty session ---
    login: apiLogin_,
    session: apiSession_,
    logout: apiLogout_,
    // --- faculty self-service ---
    saveProfile: apiSaveProfile_,
    uploadPhoto: apiUploadPhoto_,
    removePhoto: apiRemovePhoto_,
    saveSlot: apiSaveSlot_,
    deleteSlot: apiDeleteSlot_,
    rotateCode: apiRotateCode_,
    archiveProfile: apiArchiveProfile_,
    // --- coordinator ---
    adminList: apiAdminList_,
    adminCreateFaculty: apiAdminCreateFaculty_,
    adminUpdateFaculty: apiAdminUpdateFaculty_,
    adminIssueCode: apiAdminIssueCode_,
    adminRevokeCodes: apiAdminRevokeCodes_,
    adminDeleteFaculty: apiAdminDeleteFaculty_,
    adminSetSetting: apiAdminSetSetting_
  };
}

/* ------------------------------------------------------------------ *
 * Student-facing endpoints
 * ------------------------------------------------------------------ */

function apiPing_() {
  return { pong: true, time: nowIso_() };
}

function apiMeta_() {
  const s = settings_();
  return {
    site: {
      title: s.site_title || "DAD — DCPA Advisers' Directory",
      tagline: s.site_tagline || 'Advisers, consultants, critics and media experts',
      department: s.department || 'Department of Communication and Performing Arts',
      college: s.college || 'College of Arts and Letters',
      university: s.university || 'Bulacan State University',
      author: s.author || 'Benedict de Jesus',
      dean: s.dean || 'Dr. Lois Ruth B. Villavicencio',
      deanTitle: s.dean_title || 'Dean, College of Arts and Letters',
      chair: s.chair || 'Mr. Marlon B. Santos',
      chairTitle: s.chair_title || 'Chairperson, Department of Communication and Performing Arts',
      term: s.term || '',
      announcement: s.announcement || '',
      contactEmail: s.contact_email || '',
      updatedAt: s.updated_at || ''
    },
    options: {
      days: DAYS,
      modes: MODES,
      roleStates: ROLE_STATES,
      affiliations: AFFILIATIONS,
      programs: PROGRAMS
    }
  };
}

function apiDirectory_() {
  const slots = readTable_(SHEETS.SLOTS);
  const people = readTable_(SHEETS.FACULTY)
    .filter(function (r) {
      // Pending rows are unclaimed placeholders — never show them to students.
      return str_(r.status).toLowerCase() === 'active' && str_(r.id) && str_(r.name);
    })
    .sort(function (a, b) {
      const d = (Number(a.sort_order) || 0) - (Number(b.sort_order) || 0);
      if (d !== 0) return d;
      return str_(a.name).localeCompare(str_(b.name));
    })
    .map(function (r) { return publicFaculty_(r, slots); });

  return { faculty: people, count: people.length, fetchedAt: nowIso_() };
}

function apiFaculty_(req) {
  const id = str_(req.id);
  const row = readTable_(SHEETS.FACULTY).filter(function (r) {
    return str_(r.id) === id && str_(r.status).toLowerCase() === 'active';
  })[0];
  if (!row) throw httpError_(404, 'That adviser profile is not listed.');
  return { faculty: publicFaculty_(row, readTable_(SHEETS.SLOTS)) };
}

/* ------------------------------------------------------------------ *
 * Faculty session endpoints
 * ------------------------------------------------------------------ */

function apiLogin_(req) {
  const code = str_(req.code);
  if (!code) throw httpError_(400, 'Enter your access code.');
  checkLoginRate_(req.fp);

  return withLock_(function () {
    const codeRow = findCodeRow_(code);
    if (!codeRow) throw httpError_(401, 'That access code was not recognised.');

    const role = str_(codeRow.role) || 'faculty';
    const facultyId = str_(codeRow.faculty_id);

    let profile = null;
    if (role !== 'admin') {
      const row = readTable_(SHEETS.FACULTY).filter(function (r) {
        return str_(r.id) === facultyId;
      })[0];
      if (!row) throw httpError_(404, 'This code is not linked to a profile yet. Contact the coordinator.');
      if (str_(row.status).toLowerCase() === 'archived') {
        throw httpError_(403, 'This profile has been archived. Contact the coordinator to restore it.');
      }
      profile = privateFaculty_(row, readTable_(SHEETS.SLOTS));
    }

    updateRow_(SHEETS.CODES, codeRow._row, { last_used_at: nowIso_() });
    clearLoginRate_(req.fp);
    const session = createSession_(facultyId, role);

    return {
      token: session.token,
      expiresAt: session.expiresAt,
      role: role,
      label: str_(codeRow.label),
      profile: profile
    };
  });
}

function apiSession_(req) {
  const s = requireSession_(req.token);
  let profile = null;
  if (s.role !== 'admin' && s.facultyId) {
    const row = readTable_(SHEETS.FACULTY).filter(function (r) {
      return str_(r.id) === s.facultyId;
    })[0];
    if (!row) throw httpError_(404, 'Your profile could not be found.');
    profile = privateFaculty_(row, readTable_(SHEETS.SLOTS));
  }
  return { role: s.role, profile: profile };
}

function apiLogout_(req) {
  destroySession_(req.token);
  return { signedOut: true };
}

/* ------------------------------------------------------------------ *
 * Faculty self-service
 * ------------------------------------------------------------------ */

/** Resolves the caller's own faculty row, or the row an admin is acting on. */
function resolveTarget_(req) {
  const s = requireSession_(req.token);
  const targetId = s.role === 'admin' && str_(req.facultyId) ? str_(req.facultyId) : s.facultyId;
  if (!targetId) throw httpError_(400, 'No profile selected.');
  const row = readTable_(SHEETS.FACULTY).filter(function (r) {
    return str_(r.id) === targetId;
  })[0];
  if (!row) throw httpError_(404, 'Profile not found.');
  return { session: s, row: row, id: targetId, isAdmin: s.role === 'admin' };
}

function freshProfile_(id) {
  const row = readTable_(SHEETS.FACULTY).filter(function (r) { return str_(r.id) === id; })[0];
  return privateFaculty_(row, readTable_(SHEETS.SLOTS));
}

function apiSaveProfile_(req) {
  return withLock_(function () {
    const t = resolveTarget_(req);
    const patch = sanitizeProfile_(req.profile || {}, t.isAdmin);
    if (!Object.keys(patch).length) throw httpError_(400, 'Nothing to save.');

    // A placeholder row becomes a real listing the moment someone claims it
    // by saving a name. No extra step for the faculty member, none for you.
    if (str_(t.row.status) === 'Pending' && (patch.name || str_(t.row.name))) {
      patch.status = 'Active';
    }

    patch.updated_at = nowIso_();
    updateRow_(SHEETS.FACULTY, t.row._row, patch);
    setSetting_('updated_at', nowIso_());
    return { profile: freshProfile_(t.id) };
  });
}

/**
 * Accepts a data-URL photo the browser has already cropped and resized,
 * files it in Drive, and points the profile at it.
 */
function apiUploadPhoto_(req) {
  return withLock_(function () {
    const t = resolveTarget_(req);
    const stored = storePhoto_(req.image, t.id);
    const previous = str_(t.row.photo_file_id);

    updateRow_(SHEETS.FACULTY, t.row._row, {
      photo: stored.url,
      photo_file_id: stored.fileId,
      updated_at: nowIso_()
    });
    if (previous && previous !== stored.fileId) trashPhoto_(previous);
    setSetting_('updated_at', nowIso_());
    return { profile: freshProfile_(t.id) };
  });
}

function apiRemovePhoto_(req) {
  return withLock_(function () {
    const t = resolveTarget_(req);
    const previous = str_(t.row.photo_file_id);
    updateRow_(SHEETS.FACULTY, t.row._row, {
      photo: '', photo_file_id: '', updated_at: nowIso_()
    });
    if (previous) trashPhoto_(previous);
    setSetting_('updated_at', nowIso_());
    return { profile: freshProfile_(t.id) };
  });
}

function apiSaveSlot_(req) {
  return withLock_(function () {
    const t = resolveTarget_(req);
    const slot = sanitizeSlot_(req.slot || {});
    const slotId = str_((req.slot || {}).id);

    if (slotId) {
      const existing = readTable_(SHEETS.SLOTS).filter(function (s) {
        return str_(s.id) === slotId;
      })[0];
      if (!existing) throw httpError_(404, 'That consultation slot no longer exists.');
      if (str_(existing.faculty_id) !== t.id && !t.isAdmin) {
        throw httpError_(403, 'You can only edit your own consultation slots.');
      }
      assertNoOverlap_(str_(existing.faculty_id), slot, slotId);
      slot.updated_at = nowIso_();
      updateRow_(SHEETS.SLOTS, existing._row, slot);
    } else {
      const mine = readTable_(SHEETS.SLOTS).filter(function (s) {
        return str_(s.faculty_id) === t.id;
      });
      if (mine.length >= 30) throw httpError_(400, 'You already have the maximum of 30 consultation slots.');
      assertNoOverlap_(t.id, slot, null);
      slot.id = uid_('slot');
      slot.faculty_id = t.id;
      slot.created_at = nowIso_();
      slot.updated_at = nowIso_();
      insertRow_(SHEETS.SLOTS, slot);
    }

    setSetting_('updated_at', nowIso_());
    return { profile: freshProfile_(t.id) };
  });
}

function apiDeleteSlot_(req) {
  return withLock_(function () {
    const t = resolveTarget_(req);
    const slotId = str_(req.id);
    const existing = readTable_(SHEETS.SLOTS).filter(function (s) {
      return str_(s.id) === slotId;
    })[0];
    if (!existing) throw httpError_(404, 'That consultation slot no longer exists.');
    if (str_(existing.faculty_id) !== t.id && !t.isAdmin) {
      throw httpError_(403, 'You can only remove your own consultation slots.');
    }
    deleteRow_(SHEETS.SLOTS, existing._row);
    setSetting_('updated_at', nowIso_());
    return { profile: freshProfile_(t.id) };
  });
}

/** Replaces the caller's access code and returns the new one exactly once. */
function apiRotateCode_(req) {
  return withLock_(function () {
    const s = requireSession_(req.token);
    if (s.role === 'admin') throw httpError_(400, 'Coordinator codes are rotated from the Codes tab.');
    const row = readTable_(SHEETS.FACULTY).filter(function (r) {
      return str_(r.id) === s.facultyId;
    })[0];
    revokeCodesFor_(s.facultyId);
    const code = issueCode_(s.facultyId, 'faculty', 'self-rotated', row ? str_(row.slot_no) : '');
    return { code: code };
  });
}

/**
 * Removes the member from the public directory. The row is kept (status
 * Archived) so the coordinator has a record; codes and sessions are revoked.
 */
function apiArchiveProfile_(req) {
  return withLock_(function () {
    const s = requireSession_(req.token);
    if (str_(req.confirm).toUpperCase() !== 'REMOVE') {
      throw httpError_(400, 'Type REMOVE to confirm.');
    }
    const row = readTable_(SHEETS.FACULTY).filter(function (r) {
      return str_(r.id) === s.facultyId;
    })[0];
    if (!row) throw httpError_(404, 'Profile not found.');

    updateRow_(SHEETS.FACULTY, row._row, { status: 'Archived', updated_at: nowIso_() });
    deleteWhere_(SHEETS.SLOTS, function (x) { return str_(x.faculty_id) === s.facultyId; });
    revokeCodesFor_(s.facultyId);
    deleteWhere_(SHEETS.SESSIONS, function (x) { return str_(x.faculty_id) === s.facultyId; });
    setSetting_('updated_at', nowIso_());
    return { archived: true };
  });
}

/* ------------------------------------------------------------------ *
 * Coordinator endpoints
 * ------------------------------------------------------------------ */

function apiAdminList_(req) {
  requireAdmin_(req.token);
  const slots = readTable_(SHEETS.SLOTS);
  const codes = readTable_(SHEETS.CODES);
  const people = readTable_(SHEETS.FACULTY)
    .filter(function (r) { return str_(r.id); })
    .map(function (r) {
      const p = privateFaculty_(r, slots);
      const mine = codes.filter(function (c) {
        return str_(c.faculty_id) === p.id && str_(c.status).toLowerCase() === 'active';
      });
      p.activeCodes = mine.length;
      p.lastUsedAt = mine.map(function (c) { return str_(c.last_used_at); }).sort().pop() || '';
      return p;
    })
    .sort(function (a, b) {
      const d = (a.sortOrder || 0) - (b.sortOrder || 0);
      if (d !== 0) return d;
      return String(a.slotNo).localeCompare(String(b.slotNo)) || a.name.localeCompare(b.name);
    });
  return { faculty: people, settings: settings_() };
}

function apiAdminCreateFaculty_(req) {
  return withLock_(function () {
    requireAdmin_(req.token);
    const patch = sanitizeProfile_(req.profile || {}, true);
    if (!patch.name) throw httpError_(400, 'A name is required to create a profile.');

    const id = uid_('fac');
    const slotNo = nextSlotNumber_();
    const row = Object.assign({
      id: id,
      slot_no: slotNo,
      status: 'Active',
      sort_order: 0,
      affiliation: 'DCPA',
      show_email: 'TRUE',
      show_phone: 'FALSE',
      role_adviser: 'Closed',
      role_consultant: 'Closed',
      role_critic: 'Closed',
      role_media: 'Closed',
      created_at: nowIso_(),
      updated_at: nowIso_()
    }, patch);
    row.id = id;
    row.slot_no = slotNo;
    insertRow_(SHEETS.FACULTY, row);

    const code = issueCode_(id, 'faculty', clean_(patch.name, 60), slotNo);
    setSetting_('updated_at', nowIso_());
    return { id: id, slotNo: slotNo, code: code };
  });
}

function apiAdminUpdateFaculty_(req) {
  return withLock_(function () {
    requireAdmin_(req.token);
    const id = str_(req.facultyId || req.id);
    const row = readTable_(SHEETS.FACULTY).filter(function (r) { return str_(r.id) === id; })[0];
    if (!row) throw httpError_(404, 'Profile not found.');
    const patch = sanitizeProfile_(req.profile || {}, true);
    if (!Object.keys(patch).length) throw httpError_(400, 'Nothing to save.');
    patch.updated_at = nowIso_();
    updateRow_(SHEETS.FACULTY, row._row, patch);
    setSetting_('updated_at', nowIso_());
    return { id: id };
  });
}

function apiAdminIssueCode_(req) {
  return withLock_(function () {
    requireAdmin_(req.token);
    const id = str_(req.facultyId);
    const row = readTable_(SHEETS.FACULTY).filter(function (r) { return str_(r.id) === id; })[0];
    if (!row) throw httpError_(404, 'Profile not found.');
    revokeCodesFor_(id);
    const code = issueCode_(id, 'faculty', clean_(req.label || str_(row.name), 60), str_(row.slot_no));
    return { code: code };
  });
}

function apiAdminRevokeCodes_(req) {
  return withLock_(function () {
    requireAdmin_(req.token);
    const id = str_(req.facultyId);
    const n = revokeCodesFor_(id);
    deleteWhere_(SHEETS.SESSIONS, function (x) { return str_(x.faculty_id) === id; });
    return { revoked: n };
  });
}

/** Hard delete — profile row, consultation slots, codes, sessions and photo. */
function apiAdminDeleteFaculty_(req) {
  return withLock_(function () {
    requireAdmin_(req.token);
    const id = str_(req.facultyId);
    if (str_(req.confirm).toUpperCase() !== 'DELETE') {
      throw httpError_(400, 'Type DELETE to confirm permanent removal.');
    }
    const row = readTable_(SHEETS.FACULTY).filter(function (r) { return str_(r.id) === id; })[0];
    if (!row) throw httpError_(404, 'Profile not found.');
    trashPhoto_(str_(row.photo_file_id));
    deleteWhere_(SHEETS.SLOTS, function (x) { return str_(x.faculty_id) === id; });
    deleteWhere_(SHEETS.CODES, function (x) { return str_(x.faculty_id) === id; });
    deleteWhere_(SHEETS.SESSIONS, function (x) { return str_(x.faculty_id) === id; });
    deleteRow_(SHEETS.FACULTY, row._row);
    setSetting_('updated_at', nowIso_());
    return { deleted: true };
  });
}

function apiAdminSetSetting_(req) {
  return withLock_(function () {
    requireAdmin_(req.token);
    const allowed = [
      'site_title', 'site_tagline', 'department', 'college', 'university',
      'author', 'dean', 'dean_title', 'chair', 'chair_title',
      'term', 'announcement', 'contact_email'
    ];
    const key = str_(req.key);
    if (allowed.indexOf(key) === -1) throw httpError_(400, 'That setting cannot be changed here.');
    setSetting_(key, req.value);
    setSetting_('updated_at', nowIso_());
    return { key: key, value: str_(req.value) };
  });
}

/** Slot numbers are just a stable label for the roster: 01, 02, … */
function nextSlotNumber_() {
  const used = readTable_(SHEETS.FACULTY)
    .map(function (r) { return Number(str_(r.slot_no)) || 0; });
  const highest = used.length ? Math.max.apply(null, used) : 0;
  return pad2_(highest + 1);
}
