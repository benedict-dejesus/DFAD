/**
 * DFAD — DCPA Faculty Advisers' Directory
 * Built and developed by Benedict de Jesus.
 *
 * Setup.gs — one-time installer, roster preparation, and the spreadsheet menu.
 *
 * Run `setup()` once from the Apps Script editor. It is safe to re-run: it
 * only creates what is missing and never overwrites existing data.
 */

/** How many adviser slots `prepareRoster()` creates by default. */
const DEFAULT_ROSTER_SIZE = 50;

/* ------------------------------------------------------------------ *
 * Installer
 * ------------------------------------------------------------------ */

function setup() {
  const ss = book_();
  Object.keys(HEADERS).forEach(function (name) {
    ensureSheet_(ss, name, HEADERS[name]);
  });
  seedSettings_();
  applyValidation_();
  pepper_(); // make sure the pepper exists before the first sign-in

  const existingAdmin = readTable_(SHEETS.CODES).filter(function (c) {
    return str_(c.role) === 'admin' && str_(c.status).toLowerCase() === 'active';
  });

  let adminCode = null;
  if (!existingAdmin.length) {
    adminCode = issueCode_('', 'admin', 'Coordinator (created by setup)', '');
  }

  const lines = [
    "DFAD — DCPA Faculty Advisers' Directory: setup complete.",
    '',
    'Spreadsheet: ' + ss.getName(),
    'Tabs ready: ' + Object.keys(HEADERS).join(', ')
  ];
  if (adminCode) {
    lines.push(
      '',
      '=====================================================',
      '  COORDINATOR ACCESS CODE:  ' + adminCode,
      '  Copy it now — it is hashed and cannot be shown again.',
      '=====================================================',
      '',
      'Next: run prepareRoster() to create ' + DEFAULT_ROSTER_SIZE +
        ' adviser slots and their access codes.'
    );
  } else {
    lines.push('', 'A coordinator code already exists. Use newCoordinatorCode() to issue another.');
  }
  const message = lines.join('\n');
  console.log(message);
  alert_(message);
  return message;
}

function ensureSheet_(ss, name, headers) {
  let sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);

  const existing = sh.getLastColumn()
    ? sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(function (h) { return str_(h); })
    : [];

  if (existing.join('|') !== headers.join('|')) {
    // Add any header that is missing, keeping columns already in use so that
    // re-running setup after an upgrade never loses data.
    const merged = existing.filter(Boolean).slice();
    headers.forEach(function (h) {
      if (merged.indexOf(h) === -1) merged.push(h);
    });
    sh.getRange(1, 1, 1, merged.length).setValues([merged]);
  }

  const width = Math.max(sh.getLastColumn(), headers.length);
  sh.getRange(1, 1, 1, width)
    .setFontWeight('bold')
    .setBackground('#10593f')
    .setFontColor('#FFFFFF')
    .setVerticalAlignment('middle');
  sh.setFrozenRows(1);
  sh.setRowHeight(1, 32);

  if (name === SHEETS.CODES || name === SHEETS.SESSIONS) sh.setTabColor('#a52a2a');
  else sh.setTabColor('#10593f');
  return sh;
}

function seedSettings_() {
  const current = settings_();
  const defaults = {
    site_title: "DFAD — DCPA Faculty Advisers' Directory",
    site_tagline: 'Advisers, consultants, critics and media experts',
    department: 'Department of Communication and Performing Arts',
    college: 'College of Arts and Letters',
    university: 'Bulacan State University',
    author: 'Benedict de Jesus',
    dean: 'Dr. Lois Ruth B. Villavicencio',
    dean_title: 'Dean, College of Arts and Letters',
    chair: 'Mr. Marlon B. Santos',
    chair_title: 'Chairperson, Department of Communication and Performing Arts',
    term: '',
    announcement: '',
    contact_email: ''
  };
  Object.keys(defaults).forEach(function (k) {
    if (!(k in current)) setSetting_(k, defaults[k]);
  });
}

/** Dropdowns so the sheet stays safely hand-editable. */
function applyValidation_() {
  const ss = book_();

  const dropdown = function (sheetName, header, values) {
    const sh = ss.getSheetByName(sheetName);
    if (!sh) return;
    const head = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0]
      .map(function (h) { return str_(h); });
    const col = head.indexOf(header) + 1;
    if (!col) return;
    const rule = SpreadsheetApp.newDataValidation()
      .requireValueInList(values, true)
      .setAllowInvalid(false)
      .build();
    sh.getRange(2, col, Math.max(sh.getMaxRows() - 1, 1), 1).setDataValidation(rule);
  };

  dropdown(SHEETS.FACULTY, 'status', STATUSES);
  dropdown(SHEETS.FACULTY, 'affiliation', AFFILIATIONS);
  dropdown(SHEETS.FACULTY, 'show_email', ['TRUE', 'FALSE']);
  dropdown(SHEETS.FACULTY, 'show_phone', ['TRUE', 'FALSE']);
  Object.keys(TASK_COLUMNS).forEach(function (key) {
    dropdown(SHEETS.FACULTY, TASK_COLUMNS[key], ROLE_STATES);
  });
  dropdown(SHEETS.SLOTS, 'day', DAYS);
  dropdown(SHEETS.SLOTS, 'mode', MODES);
  dropdown(SHEETS.SLOTS, 'active', ['TRUE', 'FALSE']);
  dropdown(SHEETS.CODES, 'role', ['faculty', 'admin']);
  dropdown(SHEETS.CODES, 'status', ['active', 'revoked']);
}

/* ------------------------------------------------------------------ *
 * Roster: 50 adviser slots, each with an access code
 * ------------------------------------------------------------------ */

/**
 * Creates blank adviser slots and issues one access code for each, then
 * writes the codes to a temporary "Codes to hand out" tab.
 *
 * A slot stays invisible to students until the faculty member signs in and
 * saves their name — at that moment it flips from Pending to Active on its
 * own. So you can hand out all 50 codes today and let people claim them
 * whenever they get round to it.
 *
 * @param {number} [count] defaults to 50
 */
function prepareRoster(count) {
  const total = Math.max(1, Math.min(Number(count) || DEFAULT_ROSTER_SIZE, 200));
  const created = [];

  const existing = readTable_(SHEETS.FACULTY);
  let next = existing.reduce(function (max, r) {
    return Math.max(max, Number(str_(r.slot_no)) || 0);
  }, 0);

  for (let i = 0; i < total; i++) {
    next += 1;
    const slotNo = pad2_(next);
    const id = uid_('fac');
    insertRow_(SHEETS.FACULTY, {
      id: id,
      slot_no: slotNo,
      status: 'Pending',
      sort_order: 0,
      name: '',
      affiliation: 'DCPA',
      department: 'Department of Communication and Performing Arts',
      show_email: 'TRUE',
      show_phone: 'FALSE',
      role_adviser: 'Closed',
      role_consultant: 'Closed',
      role_critic: 'Closed',
      role_media: 'Closed',
      created_at: nowIso_(),
      updated_at: ''
    });
    created.push({ slotNo: slotNo, code: issueCode_(id, 'faculty', 'Slot ' + slotNo, slotNo) });
  }

  writeHandoutSheet_(created);

  const message = total + ' adviser slots created (slots ' + created[0].slotNo + '–' +
    created[created.length - 1].slotNo + ').\n\n' +
    'The codes are on the "' + SHEETS.HANDOUT + '" tab.\n\n' +
    'Hand them out, note who got which slot in the "given to" column, then use\n' +
    'DAD ▸ Delete hand-out sheet once you are done. The codes cannot be\n' +
    'recovered after that — issue a new one if someone loses theirs.';
  console.log(message);
  alert_(message);
  return message;
}

/** Convenience wrapper so the menu item takes no arguments. */
function prepareRoster50() {
  return prepareRoster(DEFAULT_ROSTER_SIZE);
}

/**
 * The one place a readable code is ever written down. It is a working
 * document for distribution, not part of the database — delete it afterwards.
 */
function writeHandoutSheet_(rows) {
  const ss = book_();
  let sh = ss.getSheetByName(SHEETS.HANDOUT);
  if (!sh) sh = ss.insertSheet(SHEETS.HANDOUT);
  sh.setTabColor('#bd8d24');

  const startRow = sh.getLastRow() > 2 ? sh.getLastRow() + 1 : 3;
  if (startRow === 3) {
    sh.clear();
    sh.getRange('A1:D1').merge()
      .setValue('⚠  TEMPORARY — these are readable access codes. Hand them out, then delete this tab (DAD ▸ Delete hand-out sheet).')
      .setBackground('#faf4e5').setFontColor('#7d5a10').setFontWeight('bold').setWrap(true);
    sh.setRowHeight(1, 40);
    sh.getRange('A2:D2').setValues([['Slot', 'Access code', 'Given to', 'Date given']])
      .setFontWeight('bold').setBackground('#10593f').setFontColor('#FFFFFF');
    sh.setFrozenRows(2);
  }

  const values = rows.map(function (r) { return [r.slotNo, r.code, '', '']; });
  sh.getRange(startRow, 1, values.length, 4).setValues(values);
  sh.getRange(startRow, 2, values.length, 1).setFontFamily('Roboto Mono');
  sh.setColumnWidth(1, 60);
  sh.setColumnWidth(2, 170);
  sh.setColumnWidth(3, 220);
  sh.setColumnWidth(4, 110);
  sh.activate();
}

function deleteHandoutSheet() {
  const ss = book_();
  const sh = ss.getSheetByName(SHEETS.HANDOUT);
  if (!sh) {
    alert_('There is no hand-out sheet to delete.');
    return;
  }
  ss.deleteSheet(sh);
  alert_('Hand-out sheet deleted. The access codes now exist only where you wrote them down.');
}

/* ------------------------------------------------------------------ *
 * Sample data (optional)
 * ------------------------------------------------------------------ */

/**
 * Adds three clearly-labelled placeholder profiles so the site has something
 * to render before real data is entered. Delete these rows before launch.
 */
function seedSampleData() {
  const samples = [
    {
      name: 'Sample Adviser One',
      honorific: 'Dr.',
      rank: 'Associate Professor II',
      affiliation: 'DCPA',
      programs: 'BA Broadcasting; BA Journalism',
      expertise: 'Broadcast production; Media ethics; Audience research',
      bio: 'Placeholder profile created by seedSampleData(). Replace or delete before launch.',
      email: 'sample.one@bulsu.edu.ph',
      office: 'CAL Building, Room 201',
      facebook: 'https://www.facebook.com/bulsu.official',
      role_adviser: 'Open', role_consultant: 'Open', role_critic: 'Limited', role_media: 'Open',
      availability_note: 'Accepting up to five thesis advisees this term.',
      slots: [
        { day: 'Tuesday', start: '09:00', end: '11:00', mode: 'Face-to-face', venue: 'CAL 201' },
        { day: 'Thursday', start: '13:00', end: '15:00', mode: 'Online', venue: 'Google Meet (link on request)' }
      ]
    },
    {
      name: 'Sample Adviser Two',
      rank: 'Instructor I',
      affiliation: 'DCPA',
      programs: 'Bachelor in Performing Arts',
      expertise: 'Theatre direction; Movement; Production design',
      bio: 'Placeholder profile created by seedSampleData().',
      email: 'sample.two@bulsu.edu.ph',
      office: 'Little Theater',
      role_adviser: 'Limited', role_consultant: 'Open', role_critic: 'Open', role_media: 'Closed',
      slots: [
        { day: 'Wednesday', start: '10:00', end: '12:00', mode: 'Face-to-face', venue: 'Little Theater' }
      ]
    },
    {
      name: 'Sample Guest Adviser',
      honorific: 'Prof.',
      rank: 'Assistant Professor III',
      affiliation: 'Guest',
      department: 'Department of Humanities (CAL)',
      programs: 'BA Journalism',
      expertise: 'Literary criticism; Creative nonfiction',
      bio: 'Placeholder guest-faculty profile created by seedSampleData().',
      email: 'sample.guest@bulsu.edu.ph',
      role_adviser: 'Closed', role_consultant: 'Open', role_critic: 'Open', role_media: 'Limited',
      slots: [
        { day: 'Friday', start: '14:00', end: '16:00', mode: 'Hybrid', venue: 'Humanities Faculty Room' }
      ]
    }
  ];

  const issued = [];
  samples.forEach(function (s) {
    const slots = s.slots || [];
    delete s.slots;
    const id = uid_('fac');
    const slotNo = nextSlotNumber_();
    insertRow_(SHEETS.FACULTY, Object.assign({
      id: id,
      slot_no: slotNo,
      status: 'Active',
      sort_order: 0,
      department: 'Department of Communication and Performing Arts',
      show_email: 'TRUE',
      show_phone: 'FALSE',
      role_adviser: 'Closed', role_consultant: 'Closed', role_critic: 'Closed', role_media: 'Closed',
      created_at: nowIso_(),
      updated_at: nowIso_()
    }, s, { id: id, slot_no: slotNo }));

    slots.forEach(function (slot) {
      insertRow_(SHEETS.SLOTS, Object.assign({
        id: uid_('slot'),
        faculty_id: id,
        active: 'TRUE',
        note: '',
        created_at: nowIso_(),
        updated_at: nowIso_()
      }, slot));
    });

    issued.push(s.name + ': ' + issueCode_(id, 'faculty', s.name, slotNo));
  });

  const msg = 'Sample profiles created.\n\nAccess codes (copy now):\n' + issued.join('\n');
  console.log(msg);
  alert_(msg);
  return msg;
}

/* ------------------------------------------------------------------ *
 * Spreadsheet menu
 * ------------------------------------------------------------------ */

function onOpen() {
  try {
    SpreadsheetApp.getUi()
      .createMenu('DAD')
      .addItem('Run setup / repair tabs', 'setup')
      .addSeparator()
      .addItem('Prepare ' + DEFAULT_ROSTER_SIZE + ' adviser slots + codes', 'prepareRoster50')
      .addItem('Delete hand-out sheet', 'deleteHandoutSheet')
      .addSeparator()
      .addItem('Issue code for selected row', 'issueCodeForSelectedRow')
      .addItem('Revoke codes for selected row', 'revokeCodesForSelectedRow')
      .addItem('New coordinator code', 'newCoordinatorCode')
      .addSeparator()
      .addItem('Clear expired sessions', 'clearExpiredSessions')
      .addItem('Add sample profiles', 'seedSampleData')
      .addItem('Run self-test', 'selfTest')
      .addToUi();
  } catch (e) {
    console.warn('menu unavailable: ' + e);
  }
}

/** Issues a fresh code for whichever Faculty row the cursor is on. */
function issueCodeForSelectedRow() {
  const sh = SpreadsheetApp.getActiveSheet();
  if (sh.getName() !== SHEETS.FACULTY) {
    alert_('Open the "' + SHEETS.FACULTY + '" tab and click the row you want first.');
    return;
  }
  const row = sh.getActiveRange().getRow();
  if (row < 2) {
    alert_('Click an adviser row (not the header) first.');
    return;
  }
  const head = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0]
    .map(function (h) { return str_(h); });
  const values = sh.getRange(row, 1, 1, sh.getLastColumn()).getValues()[0];
  const rec = {};
  head.forEach(function (h, i) { if (h) rec[h] = values[i]; });

  let id = str_(rec.id);
  if (!id) {
    id = uid_('fac');
    sh.getRange(row, head.indexOf('id') + 1).setValue(id);
  }
  let slotNo = str_(rec.slot_no);
  if (!slotNo) {
    slotNo = nextSlotNumber_();
    sh.getRange(row, head.indexOf('slot_no') + 1).setValue(slotNo);
  }
  if (!str_(rec.status)) {
    sh.getRange(row, head.indexOf('status') + 1).setValue(str_(rec.name) ? 'Active' : 'Pending');
  }

  const revoked = revokeCodesFor_(id);
  const code = issueCode_(id, 'faculty', str_(rec.name) || ('Slot ' + slotNo), slotNo);
  alert_(
    'Access code for ' + (str_(rec.name) || ('Slot ' + slotNo)) + '\n\n' + code +
    '\n\nCopy it now — it is stored hashed and cannot be shown again.' +
    (revoked ? '\n\n(' + revoked + ' previous code(s) revoked.)' : '')
  );
}

function newCoordinatorCode() {
  const code = issueCode_('', 'admin', 'Coordinator', '');
  const msg = 'New coordinator access code:\n\n' + code + '\n\nCopy it now — it cannot be shown again.';
  console.log(msg);
  alert_(msg);
  return msg;
}

function revokeCodesForSelectedRow() {
  const sh = SpreadsheetApp.getActiveSheet();
  if (sh.getName() !== SHEETS.FACULTY) {
    alert_('Open the "' + SHEETS.FACULTY + '" tab and click the row you want first.');
    return;
  }
  const head = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0]
    .map(function (h) { return str_(h); });
  const id = str_(sh.getRange(sh.getActiveRange().getRow(), head.indexOf('id') + 1).getValue());
  if (!id) {
    alert_('That row has no id yet, so it has no codes.');
    return;
  }
  const n = revokeCodesFor_(id);
  deleteWhere_(SHEETS.SESSIONS, function (x) { return str_(x.faculty_id) === id; });
  alert_(n + ' code(s) revoked and any open sessions signed out.');
}

function clearExpiredSessions() {
  pruneSessions_();
  alert_('Expired sessions cleared.');
}

function alert_(message) {
  try {
    SpreadsheetApp.getUi().alert(message);
  } catch (e) {
    // No UI when run headless from the editor — the execution log has it.
  }
}

/* ------------------------------------------------------------------ *
 * Self-test — run after deploying to confirm the wiring works.
 * ------------------------------------------------------------------ */

function selfTest() {
  const results = [];
  const check = function (label, fn) {
    try {
      const value = fn();
      results.push('PASS  ' + label + (value ? '  → ' + value : ''));
    } catch (e) {
      results.push('FAIL  ' + label + '  → ' + e.message);
    }
  };

  check('spreadsheet reachable', function () { return book_().getName(); });
  Object.keys(HEADERS).forEach(function (name) {
    check('tab "' + name + '"', function () { return sheet_(name).getLastColumn() + ' columns'; });
  });
  check('script pepper set', function () { return pepper_() ? 'yes' : 'no'; });
  check('meta endpoint', function () { return apiMeta_().site.title; });
  check('directory endpoint', function () { return apiDirectory_().count + ' listed adviser(s)'; });
  check('roster prepared', function () {
    const pending = readTable_(SHEETS.FACULTY).filter(function (r) {
      return str_(r.status) === 'Pending';
    }).length;
    return pending + ' unclaimed slot(s) waiting';
  });
  check('coordinator code exists', function () {
    const n = readTable_(SHEETS.CODES).filter(function (c) {
      return str_(c.role) === 'admin' && str_(c.status).toLowerCase() === 'active';
    }).length;
    if (!n) throw new Error('none — run newCoordinatorCode()');
    return n + ' active';
  });
  check('code alphabet excludes look-alikes', function () {
    if (/[OIL01]/.test(CODE_ALPHABET)) throw new Error('alphabet contains a look-alike glyph');
    return CODE_ALPHABET.length + ' safe characters';
  });
  check('photo folder reachable', function () { return photoFolder_().getName(); });
  check('time normalisation', function () {
    if (normTime_('bad') !== '' || normTime_('09:05') !== '09:05' || normTime_('0930') !== '09:30') {
      throw new Error('unexpected result');
    }
    return 'ok';
  });

  const out = results.join('\n');
  console.log(out);
  alert_("DFAD — DCPA Faculty Advisers' Directory self-test\n\n" + out);
  return out;
}
