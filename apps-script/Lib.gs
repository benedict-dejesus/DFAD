/**
 * DAD — DCPA Advisers' Directory
 * Department of Communication and Performing Arts, College of Arts and Letters
 * Bulacan State University
 *
 * Built and developed by Benedict de Jesus.
 *
 * Lib.gs — storage, authentication and validation.
 *
 * The database holds exactly three things:
 *   1. faculty access codes (hashed) and their permissions,
 *   2. faculty profile data,
 *   3. schedule and availability updates.
 *
 * Students never sign in and nothing about them is recorded.
 */

/* ------------------------------------------------------------------ *
 * Configuration
 * ------------------------------------------------------------------ */

const SHEETS = {
  FACULTY: 'Faculty',
  SLOTS: 'Consultations',
  CODES: 'Codes',
  SESSIONS: 'Sessions',
  SETTINGS: 'Settings',
  HANDOUT: 'Codes to hand out'
};

const HEADERS = {
  Faculty: [
    'id', 'slot_no', 'status', 'sort_order', 'name', 'honorific', 'suffix', 'rank',
    'affiliation', 'department', 'programs', 'expertise', 'bio',
    'email', 'show_email', 'phone', 'show_phone', 'office',
    'photo', 'photo_file_id', 'facebook', 'linkedin', 'website',
    'availability_note', 'role_adviser', 'role_consultant', 'role_critic',
    'role_media', 'created_at', 'updated_at'
  ],
  Consultations: [
    'id', 'faculty_id', 'day', 'start', 'end', 'mode', 'venue', 'note',
    'active', 'created_at', 'updated_at'
  ],
  Codes: [
    'code_hash', 'salt', 'faculty_id', 'slot_no', 'role', 'label', 'status',
    'created_at', 'last_used_at'
  ],
  Sessions: ['token', 'faculty_id', 'role', 'created_at', 'expires_at', 'last_seen'],
  Settings: ['key', 'value', 'note']
};

/** How long a faculty portal session stays valid (hours). */
const SESSION_HOURS = 12;

/** Login attempts allowed per rolling window, per client fingerprint. */
const LOGIN_MAX_ATTEMPTS = 8;
const LOGIN_WINDOW_SECONDS = 900; // 15 minutes

/** Largest photo we accept after the browser has already resized it. */
const MAX_PHOTO_BYTES = 1500000;

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const MODES = ['Face-to-face', 'Online', 'Hybrid'];
const ROLE_STATES = ['Open', 'Limited', 'Closed'];
const STATUSES = ['Pending', 'Active', 'Hidden', 'Archived'];
const AFFILIATIONS = ['DCPA', 'Guest'];
const PROGRAMS = ['BA Broadcasting', 'BA Journalism', 'Bachelor in Performing Arts'];

/** The four thesis tasks a faculty member can offer to handle. */
const TASK_COLUMNS = {
  adviser: 'role_adviser',
  consultant: 'role_consultant',
  critic: 'role_critic',
  media: 'role_media'
};

/* ------------------------------------------------------------------ *
 * Spreadsheet access
 * ------------------------------------------------------------------ */

/**
 * The bound spreadsheet, or the one named by the SPREADSHEET_ID script
 * property when the project is standalone.
 */
function book_() {
  const cached = book_._ss;
  if (cached) return cached;
  let ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) {
    const id = props_().getProperty('SPREADSHEET_ID');
    if (!id) {
      throw new Error(
        'No spreadsheet bound to this script and no SPREADSHEET_ID script property set.'
      );
    }
    ss = SpreadsheetApp.openById(id);
  }
  book_._ss = ss;
  return ss;
}

function props_() {
  return PropertiesService.getScriptProperties();
}

function sheet_(name) {
  const sh = book_().getSheetByName(name);
  if (!sh) throw new Error('Missing sheet tab: "' + name + '". Run setup() once.');
  return sh;
}

/**
 * Reads a whole tab into plain objects keyed by its header row.
 * Each row also carries a non-enumerable `_row` (1-based sheet row).
 */
function readTable_(name) {
  const sh = sheet_(name);
  const values = sh.getDataRange().getValues();
  if (values.length < 2) return [];
  const head = values[0].map(function (h) { return String(h).trim(); });
  const out = [];
  for (let r = 1; r < values.length; r++) {
    const row = values[r];
    if (row.every(isBlank_)) continue;
    const obj = {};
    for (let c = 0; c < head.length; c++) {
      if (!head[c]) continue;
      obj[head[c]] = row[c];
    }
    Object.defineProperty(obj, '_row', { value: r + 1, enumerable: false });
    out.push(obj);
  }
  return out;
}

/** Appends one object as a row, filling only the columns that exist. */
function insertRow_(name, obj) {
  const sh = sheet_(name);
  const head = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  const row = head.map(function (h) {
    const key = String(h).trim();
    return Object.prototype.hasOwnProperty.call(obj, key) ? toCell_(obj[key]) : '';
  });
  sh.appendRow(row);
  return sh.getLastRow();
}

/** Patches a single row in place; only the supplied keys are written. */
function updateRow_(name, rowIndex, patch) {
  const sh = sheet_(name);
  const head = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  for (let c = 0; c < head.length; c++) {
    const key = String(head[c]).trim();
    if (Object.prototype.hasOwnProperty.call(patch, key)) {
      sh.getRange(rowIndex, c + 1).setValue(toCell_(patch[key]));
    }
  }
}

function deleteRow_(name, rowIndex) {
  sheet_(name).deleteRow(rowIndex);
}

/** Deletes every row matching a predicate, bottom-up so indexes stay valid. */
function deleteWhere_(name, predicate) {
  const rows = readTable_(name).filter(predicate).map(function (r) { return r._row; });
  rows.sort(function (a, b) { return b - a; });
  const sh = sheet_(name);
  rows.forEach(function (r) { sh.deleteRow(r); });
  return rows.length;
}

function toCell_(v) {
  if (v === null || v === undefined) return '';
  if (v instanceof Date) return v;
  if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
  return v;
}

/* ------------------------------------------------------------------ *
 * Small utilities
 * ------------------------------------------------------------------ */

function isBlank_(v) {
  return v === '' || v === null || v === undefined;
}

function str_(v) {
  return v === null || v === undefined ? '' : String(v).trim();
}

function bool_(v) {
  const s = str_(v).toLowerCase();
  return s === 'true' || s === 'yes' || s === '1' || v === true;
}

function nowIso_() {
  return new Date().toISOString();
}

function uid_(prefix) {
  const raw = Utilities.getUuid().replace(/-/g, '').slice(0, 12);
  return (prefix || 'id') + '_' + raw;
}

/** Clamps free text and strips control characters before it reaches the sheet. */
function clean_(v, maxLen) {
  let s = str_(v).replace(/[\x00-\x1F\x7F]/g, '');
  if (maxLen && s.length > maxLen) s = s.slice(0, maxLen);
  return s;
}

/** Splits a `;`-separated cell into a trimmed, de-duplicated list. */
function list_(v) {
  return str_(v)
    .split(/[;\n]+/)
    .map(function (s) { return s.trim(); })
    .filter(function (s, i, arr) { return s && arr.indexOf(s) === i; });
}

/** Cleans, de-duplicates (case-insensitively) and caps a list for storage. */
function joinList_(arr, maxItems, maxLen) {
  if (!Array.isArray(arr)) arr = list_(arr);
  const seen = {};
  const out = [];
  for (let i = 0; i < arr.length && out.length < (maxItems || 40); i++) {
    const value = clean_(arr[i], maxLen || 120);
    if (!value) continue;
    const key = value.toLowerCase();
    if (seen[key]) continue;
    seen[key] = true;
    out.push(value);
  }
  return out.join('; ');
}

function oneOf_(value, allowed, fallback) {
  const s = str_(value);
  for (let i = 0; i < allowed.length; i++) {
    if (allowed[i].toLowerCase() === s.toLowerCase()) return allowed[i];
  }
  return fallback;
}

/** "9:05" / "0930" -> "09:05" / "09:30"; anything unparseable -> ''. */
function normTime_(v) {
  const s = str_(v);
  let m = s.match(/^(\d{1,2}):(\d{2})/);
  if (!m) m = s.match(/^(\d{2})(\d{2})$/);
  if (!m) return '';
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (!(h >= 0 && h <= 23) || !(min >= 0 && min <= 59)) return '';
  return pad2_(h) + ':' + pad2_(min);
}

function pad2_(n) {
  return (n < 10 ? '0' : '') + n;
}

function minutes_(hhmm) {
  const p = String(hhmm).split(':');
  return Number(p[0]) * 60 + Number(p[1]);
}

function isEmail_(v) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(str_(v));
}

/**
 * Turns Google Drive share links into a directly embeddable image URL and
 * rejects anything that is not http(s).
 */
function normPhoto_(v) {
  const s = clean_(v, 500);
  if (!s) return '';
  if (!/^https?:\/\//i.test(s)) return '';
  const drive = s.match(/drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?(?:export=\w+&)?id=|thumbnail\?id=)([\w-]{10,})/);
  if (drive) return 'https://drive.google.com/thumbnail?id=' + drive[1] + '&sz=w600';
  return s;
}

/**
 * Accepts what a faculty member is likely to paste and returns a clean
 * profile URL: a full link, a bare handle, or an @handle all work.
 * Returns '' when there is nothing usable, so a blank field clears it.
 */
function normFacebook_(v) {
  let s = clean_(v, 300);
  if (!s) return '';
  s = s.replace(/^@/, '');
  const url = s.match(/^(?:https?:\/\/)?(?:[\w-]+\.)?facebook\.com\/([^/?#\s]+)/i);
  if (url) return 'https://www.facebook.com/' + url[1];
  const fbid = s.match(/^(?:https?:\/\/)?(?:[\w-]+\.)?fb\.com\/([^/?#\s]+)/i);
  if (fbid) return 'https://www.facebook.com/' + fbid[1];
  if (/^https?:\/\//i.test(s)) return '';          // some other site — reject
  if (/^[\w.]{3,60}$/.test(s)) return 'https://www.facebook.com/' + s;
  return '';
}

function normLinkedIn_(v) {
  let s = clean_(v, 300);
  if (!s) return '';
  s = s.replace(/^@/, '');
  const url = s.match(/^(?:https?:\/\/)?(?:[\w-]+\.)?linkedin\.com\/(in|pub|company)\/([^/?#\s]+)/i);
  if (url) return 'https://www.linkedin.com/' + url[1].toLowerCase() + '/' + url[2];
  if (/^https?:\/\//i.test(s)) return '';
  const bare = s.replace(/^in\//i, '');
  if (/^[\w-]{3,100}$/.test(bare)) return 'https://www.linkedin.com/in/' + bare;
  return '';
}

/** Any other personal or research page. */
function normWebsite_(v) {
  let s = clean_(v, 400);
  if (!s) return '';
  if (!/^https?:\/\//i.test(s)) s = 'https://' + s;
  return /^https?:\/\/[^\s.]+\.[^\s]{2,}/i.test(s) ? s : '';
}

/** Serializes writes so two concurrent saves cannot interleave. */
function withLock_(fn) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) {
    throw httpError_(503, 'The directory is busy right now. Please try again in a moment.');
  }
  try {
    return fn();
  } finally {
    lock.releaseLock();
  }
}

function httpError_(code, message) {
  const err = new Error(message);
  err.__code = code;
  return err;
}

/* ------------------------------------------------------------------ *
 * Faculty access codes
 * ------------------------------------------------------------------ */

/**
 * Codes are never stored. We keep salt + SHA-256(salt : code : pepper),
 * where the pepper lives in Script Properties — outside the spreadsheet — so
 * a leaked copy of the sheet still does not reveal working codes.
 */
function pepper_() {
  let p = props_().getProperty('CODE_PEPPER');
  if (!p) {
    p = Utilities.getUuid() + Utilities.getUuid();
    props_().setProperty('CODE_PEPPER', p);
  }
  return p;
}

function hashCode_(code, salt) {
  const raw = salt + ':' + normalizeCode_(code) + ':' + pepper_();
  const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, raw, Utilities.Charset.UTF_8);
  return bytes.map(function (b) {
    return ('0' + (b & 0xff).toString(16)).slice(-2);
  }).join('');
}

/** Codes are compared case-insensitively with dashes and spaces ignored. */
function normalizeCode_(code) {
  return str_(code).toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/**
 * The code alphabet deliberately excludes every glyph people misread when
 * copying a code off a screen or a slip of paper:
 *   0 and O, 1 and I and L.
 * What is left is 31 unambiguous characters.
 */
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

/** Generates a readable code such as DCPA-7F3K-92QX. */
function generateCode_(prefix) {
  const bytes = Utilities.getUuid().replace(/-/g, '');
  let out = '';
  for (let i = 0; i < 8; i++) {
    const n = parseInt(bytes.substr(i * 2, 2), 16);
    out += CODE_ALPHABET[n % CODE_ALPHABET.length];
    if (i === 3) out += '-';
  }
  return (prefix || 'DCPA') + '-' + out;
}

/** Constant-time-ish comparison so timing does not leak the hash. */
function safeEqual_(a, b) {
  a = String(a); b = String(b);
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/**
 * Finds the Codes row matching a submitted code.
 * Every active row is hashed with its own salt, so this is O(number of codes).
 */
function findCodeRow_(code) {
  const norm = normalizeCode_(code);
  if (norm.length < 8) return null;
  const rows = readTable_(SHEETS.CODES);
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (str_(row.status).toLowerCase() !== 'active') continue;
    const hash = hashCode_(norm, str_(row.salt));
    if (safeEqual_(hash, str_(row.code_hash))) return row;
  }
  return null;
}

function issueCode_(facultyId, role, label, slotNo) {
  const code = generateCode_(role === 'admin' ? 'DAD' : 'DCPA');
  const salt = Utilities.getUuid();
  insertRow_(SHEETS.CODES, {
    code_hash: hashCode_(code, salt),
    salt: salt,
    faculty_id: facultyId || '',
    slot_no: slotNo || '',
    role: role || 'faculty',
    label: clean_(label, 80),
    status: 'active',
    created_at: nowIso_(),
    last_used_at: ''
  });
  return code;
}

function revokeCodesFor_(facultyId) {
  const rows = readTable_(SHEETS.CODES).filter(function (r) {
    return str_(r.faculty_id) === facultyId && str_(r.status).toLowerCase() === 'active';
  });
  rows.forEach(function (r) {
    updateRow_(SHEETS.CODES, r._row, { status: 'revoked' });
  });
  return rows.length;
}

/* --- sessions ------------------------------------------------------ */

function createSession_(facultyId, role) {
  const token = Utilities.getUuid() + Utilities.getUuid().replace(/-/g, '');
  const expires = new Date(Date.now() + SESSION_HOURS * 3600 * 1000);
  insertRow_(SHEETS.SESSIONS, {
    token: token,
    faculty_id: facultyId || '',
    role: role || 'faculty',
    created_at: nowIso_(),
    expires_at: expires.toISOString(),
    last_seen: nowIso_()
  });
  pruneSessions_();
  return { token: token, expiresAt: expires.toISOString() };
}

/** Resolves a token to `{facultyId, role, row}` or throws 401. */
function requireSession_(token) {
  const t = str_(token);
  if (!t) throw httpError_(401, 'Please sign in with your access code.');
  const rows = readTable_(SHEETS.SESSIONS);
  for (let i = 0; i < rows.length; i++) {
    if (!safeEqual_(str_(rows[i].token), t)) continue;
    const exp = new Date(str_(rows[i].expires_at) || 0).getTime();
    if (!exp || exp < Date.now()) {
      deleteRow_(SHEETS.SESSIONS, rows[i]._row);
      throw httpError_(401, 'Your session expired. Please sign in again.');
    }
    updateRow_(SHEETS.SESSIONS, rows[i]._row, { last_seen: nowIso_() });
    return {
      facultyId: str_(rows[i].faculty_id),
      role: str_(rows[i].role) || 'faculty',
      row: rows[i]._row
    };
  }
  throw httpError_(401, 'Your session is no longer valid. Please sign in again.');
}

function requireAdmin_(token) {
  const s = requireSession_(token);
  if (s.role !== 'admin') throw httpError_(403, 'This action needs a coordinator access code.');
  return s;
}

function destroySession_(token) {
  const t = str_(token);
  if (!t) return 0;
  return deleteWhere_(SHEETS.SESSIONS, function (r) { return safeEqual_(str_(r.token), t); });
}

function pruneSessions_() {
  const now = Date.now();
  deleteWhere_(SHEETS.SESSIONS, function (r) {
    const exp = new Date(str_(r.expires_at) || 0).getTime();
    return !exp || exp < now;
  });
}

/* --- rate limiting -------------------------------------------------- */

/**
 * Apps Script does not expose the caller IP, so we throttle on a client-side
 * fingerprint plus a global counter. It slows down code-guessing without
 * pretending to be airtight.
 */
function checkLoginRate_(fingerprint) {
  const cache = CacheService.getScriptCache();
  const keys = ['lg_' + (clean_(fingerprint, 40) || 'anon'), 'lg_global'];
  const limits = [LOGIN_MAX_ATTEMPTS, LOGIN_MAX_ATTEMPTS * 12];
  for (let i = 0; i < keys.length; i++) {
    const n = Number(cache.get(keys[i]) || 0) + 1;
    if (n > limits[i]) {
      throw httpError_(429, 'Too many sign-in attempts. Please wait 15 minutes and try again.');
    }
    cache.put(keys[i], String(n), LOGIN_WINDOW_SECONDS);
  }
}

function clearLoginRate_(fingerprint) {
  CacheService.getScriptCache().remove('lg_' + (clean_(fingerprint, 40) || 'anon'));
}

/* ------------------------------------------------------------------ *
 * Profile photos (stored in Drive, linked from the sheet)
 * ------------------------------------------------------------------ */

/** The Drive folder that holds uploaded profile photos, created on demand. */
function photoFolder_() {
  const id = props_().getProperty('PHOTO_FOLDER_ID');
  if (id) {
    try {
      return DriveApp.getFolderById(id);
    } catch (e) {
      // Folder was deleted or moved to trash — fall through and make a new one.
    }
  }
  const folder = DriveApp.createFolder('DAD — Faculty photos');
  folder.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  props_().setProperty('PHOTO_FOLDER_ID', folder.getId());
  return folder;
}

/**
 * Stores a data-URL image in Drive and returns `{url, fileId}`.
 * The browser has already cropped and resized it; this only guards the size
 * and the format.
 */
function storePhoto_(dataUrl, facultyId) {
  const match = str_(dataUrl).match(/^data:image\/(png|jpe?g|webp);base64,([A-Za-z0-9+/=\s]+)$/i);
  if (!match) {
    throw httpError_(400, 'That file is not a supported image. Use a JPEG, PNG or WebP photo.');
  }
  const base64 = match[2].replace(/\s+/g, '');
  // 4 base64 characters encode 3 bytes.
  if (base64.length * 3 / 4 > MAX_PHOTO_BYTES) {
    throw httpError_(413, 'That photo is too large. Please choose a smaller image.');
  }

  const mime = 'image/' + (match[1].toLowerCase() === 'jpg' ? 'jpeg' : match[1].toLowerCase());
  const extension = mime === 'image/jpeg' ? 'jpg' : mime.split('/')[1];
  const blob = Utilities.newBlob(
    Utilities.base64Decode(base64),
    mime,
    facultyId + '-' + Date.now() + '.' + extension
  );

  const file = photoFolder_().createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return {
    url: 'https://drive.google.com/thumbnail?id=' + file.getId() + '&sz=w600',
    fileId: file.getId()
  };
}

/** Best-effort cleanup of a replaced photo; never blocks the save. */
function trashPhoto_(fileId) {
  const id = str_(fileId);
  if (!id) return;
  try {
    DriveApp.getFileById(id).setTrashed(true);
  } catch (e) {
    console.warn('could not trash old photo ' + id + ': ' + e);
  }
}

/* ------------------------------------------------------------------ *
 * Settings
 * ------------------------------------------------------------------ */

function settings_() {
  const out = {};
  readTable_(SHEETS.SETTINGS).forEach(function (r) {
    const k = str_(r.key);
    if (k) out[k] = str_(r.value);
  });
  return out;
}

function setSetting_(key, value) {
  const rows = readTable_(SHEETS.SETTINGS);
  for (let i = 0; i < rows.length; i++) {
    if (str_(rows[i].key) === key) {
      updateRow_(SHEETS.SETTINGS, rows[i]._row, { value: clean_(value, 400) });
      return;
    }
  }
  insertRow_(SHEETS.SETTINGS, { key: key, value: clean_(value, 400), note: '' });
}

/* ------------------------------------------------------------------ *
 * Shaping records for the client
 * ------------------------------------------------------------------ */

/** Public projection — honours each member's contact-visibility switches. */
function publicFaculty_(row, slots) {
  const id = str_(row.id);
  const mine = (slots || []).filter(function (s) {
    return str_(s.faculty_id) === id && bool_(s.active);
  });
  return {
    id: id,
    name: str_(row.name),
    honorific: str_(row.honorific),
    suffix: str_(row.suffix),
    rank: str_(row.rank),
    affiliation: oneOf_(row.affiliation, AFFILIATIONS, 'DCPA'),
    department: str_(row.department),
    programs: list_(row.programs),
    expertise: list_(row.expertise),
    bio: str_(row.bio),
    email: bool_(row.show_email) ? str_(row.email) : '',
    phone: bool_(row.show_phone) ? str_(row.phone) : '',
    office: str_(row.office),
    photo: normPhoto_(row.photo),
    facebook: normFacebook_(row.facebook),
    linkedin: normLinkedIn_(row.linkedin),
    website: normWebsite_(row.website),
    availabilityNote: str_(row.availability_note),
    roles: {
      adviser: oneOf_(row.role_adviser, ROLE_STATES, 'Closed'),
      consultant: oneOf_(row.role_consultant, ROLE_STATES, 'Closed'),
      critic: oneOf_(row.role_critic, ROLE_STATES, 'Closed'),
      media: oneOf_(row.role_media, ROLE_STATES, 'Closed')
    },
    slots: mine.map(publicSlot_).sort(compareSlots_),
    updatedAt: str_(row.updated_at)
  };
}

/** Private projection — what a faculty member sees about their own record. */
function privateFaculty_(row, slots) {
  const pub = publicFaculty_(row, slots);
  const id = str_(row.id);
  pub.email = str_(row.email);
  pub.phone = str_(row.phone);
  pub.showEmail = bool_(row.show_email);
  pub.showPhone = bool_(row.show_phone);
  pub.status = oneOf_(row.status, STATUSES, 'Active');
  pub.slotNo = str_(row.slot_no);
  pub.sortOrder = Number(row.sort_order) || 0;
  pub.photoFileId = str_(row.photo_file_id);
  pub.slots = (slots || [])
    .filter(function (s) { return str_(s.faculty_id) === id; })
    .map(function (s) {
      const o = publicSlot_(s);
      o.active = bool_(s.active);
      return o;
    })
    .sort(compareSlots_);
  return pub;
}

function publicSlot_(s) {
  return {
    id: str_(s.id),
    facultyId: str_(s.faculty_id),
    day: oneOf_(s.day, DAYS, 'Monday'),
    start: normTime_(s.start),
    end: normTime_(s.end),
    mode: oneOf_(s.mode, MODES, 'Face-to-face'),
    venue: str_(s.venue),
    note: str_(s.note),
    active: true
  };
}

function compareSlots_(a, b) {
  const d = DAYS.indexOf(a.day) - DAYS.indexOf(b.day);
  if (d !== 0) return d;
  return String(a.start).localeCompare(String(b.start));
}

/**
 * Validates and normalizes a profile patch coming from the portal.
 * Returns only the sheet columns the caller is allowed to touch.
 */
function sanitizeProfile_(patch, isAdmin) {
  const out = {};
  const has = function (k) { return Object.prototype.hasOwnProperty.call(patch, k); };

  if (has('name')) {
    const name = clean_(patch.name, 120);
    if (!name) throw httpError_(400, 'Name is required.');
    out.name = name;
  }
  if (has('honorific')) out.honorific = clean_(patch.honorific, 24);
  if (has('suffix')) out.suffix = clean_(patch.suffix, 24);
  if (has('rank')) out.rank = clean_(patch.rank, 80);
  if (has('department')) out.department = clean_(patch.department, 140);
  if (has('bio')) out.bio = clean_(patch.bio, 1200);
  if (has('office')) out.office = clean_(patch.office, 120);
  if (has('availability_note') || has('availabilityNote')) {
    out.availability_note = clean_(has('availabilityNote') ? patch.availabilityNote : patch.availability_note, 400);
  }

  if (has('email')) {
    const email = clean_(patch.email, 120);
    if (email && !isEmail_(email)) throw httpError_(400, 'That email address does not look valid.');
    out.email = email;
  }
  if (has('phone')) out.phone = clean_(patch.phone, 40);
  if (has('showEmail') || has('show_email')) {
    out.show_email = bool_(has('showEmail') ? patch.showEmail : patch.show_email);
  }
  if (has('showPhone') || has('show_phone')) {
    out.show_phone = bool_(has('showPhone') ? patch.showPhone : patch.show_phone);
  }

  // A pasted link, a bare handle or an @handle all work; anything we cannot
  // make sense of is rejected outright rather than saved half-broken.
  if (has('facebook')) {
    const fb = normFacebook_(patch.facebook);
    if (str_(patch.facebook) && !fb) {
      throw httpError_(400, 'That does not look like a Facebook profile. Paste the link or just your username.');
    }
    out.facebook = fb;
  }
  if (has('linkedin')) {
    const li = normLinkedIn_(patch.linkedin);
    if (str_(patch.linkedin) && !li) {
      throw httpError_(400, 'That does not look like a LinkedIn profile. Paste the link or just your username.');
    }
    out.linkedin = li;
  }
  if (has('website')) {
    const site = normWebsite_(patch.website);
    if (str_(patch.website) && !site) throw httpError_(400, 'That website address does not look valid.');
    out.website = site;
  }

  if (has('photo')) out.photo = normPhoto_(patch.photo);

  if (has('programs')) {
    const progs = (Array.isArray(patch.programs) ? patch.programs : list_(patch.programs))
      .map(function (p) { return oneOf_(p, PROGRAMS, ''); })
      .filter(Boolean);
    out.programs = joinList_(progs, 6, 60);
  }
  if (has('expertise')) out.expertise = joinList_(patch.expertise, 20, 60);

  // Thesis tasks: `{adviser: 'Open', critic: 'Limited', ...}`.
  if (has('roles') && patch.roles && typeof patch.roles === 'object') {
    Object.keys(TASK_COLUMNS).forEach(function (k) {
      if (Object.prototype.hasOwnProperty.call(patch.roles, k)) {
        out[TASK_COLUMNS[k]] = oneOf_(patch.roles[k], ROLE_STATES, 'Closed');
      }
    });
  }

  // Only coordinators may move a record between DCPA and Guest, change its
  // listing status, or reorder the directory.
  if (isAdmin) {
    if (has('affiliation')) out.affiliation = oneOf_(patch.affiliation, AFFILIATIONS, 'DCPA');
    if (has('status')) out.status = oneOf_(patch.status, STATUSES, 'Active');
    if (has('sortOrder')) out.sort_order = Number(patch.sortOrder) || 0;
  }

  return out;
}

function sanitizeSlot_(patch) {
  const day = oneOf_(patch.day, DAYS, '');
  if (!day) throw httpError_(400, 'Pick a day of the week for this consultation slot.');
  const start = normTime_(patch.start);
  const end = normTime_(patch.end);
  if (!start || !end) throw httpError_(400, 'Enter a valid start and end time.');
  if (minutes_(end) <= minutes_(start)) {
    throw httpError_(400, 'The end time has to be after the start time.');
  }
  return {
    day: day,
    start: start,
    end: end,
    mode: oneOf_(patch.mode, MODES, 'Face-to-face'),
    venue: clean_(patch.venue, 160),
    note: clean_(patch.note, 200),
    active: Object.prototype.hasOwnProperty.call(patch, 'active') ? bool_(patch.active) : true
  };
}

/** Rejects a new slot that overlaps one the member already has that day. */
function assertNoOverlap_(facultyId, slot, ignoreId) {
  const clash = readTable_(SHEETS.SLOTS).filter(function (s) {
    if (str_(s.faculty_id) !== facultyId) return false;
    if (ignoreId && str_(s.id) === ignoreId) return false;
    if (!bool_(s.active) || !slot.active) return false;
    if (oneOf_(s.day, DAYS, '') !== slot.day) return false;
    const a1 = minutes_(normTime_(s.start));
    const a2 = minutes_(normTime_(s.end));
    return minutes_(slot.start) < a2 && a1 < minutes_(slot.end);
  });
  if (clash.length) {
    throw httpError_(
      409,
      'That overlaps your ' + clash[0].day + ' ' + normTime_(clash[0].start) +
      '–' + normTime_(clash[0].end) + ' slot.'
    );
  }
}
