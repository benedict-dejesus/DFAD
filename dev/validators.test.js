/**
 * DFAD — DCPA Faculty Advisers' Directory
 * Tests for the Apps Script validation layer.
 * Built and developed by Benedict de Jesus.
 *
 *     node dev/validators.test.js
 *
 * These are the functions that decide what is allowed into the spreadsheet:
 * time parsing, access-code hashing and alphabet, social-profile parsing,
 * photo handling, and the rules about which fields a faculty member may
 * change versus a coordinator. Run this after editing `apps-script/Lib.gs`.
 *
 * No dependencies — the handful of Google services Lib.gs touches are stubbed
 * below and the file is evaluated in a VM context, the same shared global
 * scope Apps Script itself uses.
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..', 'apps-script');

let uuidCounter = 0;
const sandbox = {
  console,
  Utilities: {
    getUuid: () => `0123456789abcdef0123456789abcd${String(uuidCounter++).padStart(2, '0')}`,
    computeDigest: (_alg, s) =>
      Array.from(Buffer.from(require('crypto').createHash('sha256').update(s).digest())),
    DigestAlgorithm: { SHA_256: 'SHA_256' },
    Charset: { UTF_8: 'UTF_8' }
  },
  PropertiesService: (() => {
    // Script Properties persist in real Apps Script — one shared store.
    const store = {};
    const api = { getProperty: (k) => store[k] || null, setProperty: (k, v) => { store[k] = v; } };
    return { getScriptProperties: () => api };
  })(),
  SpreadsheetApp: { getActiveSpreadsheet: () => null },
  DriveApp: { Access: {}, Permission: {} },
  CacheService: { getScriptCache: () => ({ get: () => null, put: () => {}, remove: () => {} }) },
  LockService: { getScriptLock: () => ({ tryLock: () => true, releaseLock: () => {} }) }
};
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(root, 'Lib.gs'), 'utf8'), sandbox);

let pass = 0;
let fail = 0;
function check(label, actual, expected) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) { pass++; console.log(`  ok   ${label}`); }
  else { fail++; console.log(`  FAIL ${label}\n         got      ${a}\n         expected ${e}`); }
}
function throws(label, fn, fragment) {
  try { fn(); fail++; console.log(`  FAIL ${label} — did not throw`); }
  catch (e) {
    if (String(e.message).includes(fragment)) { pass++; console.log(`  ok   ${label}`); }
    else { fail++; console.log(`  FAIL ${label} — wrong error: ${e.message}`); }
  }
}
/**
 * Function declarations land on the sandbox object; top-level `const`s live in
 * the context's lexical scope, so those have to be evaluated by name.
 */
const run = (name) => sandbox[name];
const constant = (name) => vm.runInContext(name, sandbox);

console.log('\ntime normalisation');
check('24h passthrough', run('normTime_')('09:05'), '09:05');
check('compact form', run('normTime_')('0930'), '09:30');
check('single-digit hour', run('normTime_')('9:30'), '09:30');
check('rejects garbage', run('normTime_')('lunchtime'), '');
check('rejects hour 24', run('normTime_')('24:00'), '');
check('rejects minute 60', run('normTime_')('10:60'), '');
check('midnight', run('normTime_')('00:00'), '00:00');

console.log('\naccess code alphabet (no 0 O 1 l I)');
const alphabet = constant('CODE_ALPHABET');
check('excludes zero', alphabet.includes('0'), false);
check('excludes capital O', alphabet.includes('O'), false);
check('excludes one', alphabet.includes('1'), false);
check('excludes capital I', alphabet.includes('I'), false);
check('excludes capital L', alphabet.includes('L'), false);
check('31 usable characters', alphabet.length, 31);
const many = Array.from({ length: 300 }, () => run('generateCode_')('DCPA'));
check('no look-alike ever generated', many.some((c) => /[OIL01]/.test(c.slice(5))), false);
check('every code matches the expected shape',
  many.every((c) => /^DCPA-[ABCDEFGHJKMNPQRSTUVWXYZ2-9]{4}-[ABCDEFGHJKMNPQRSTUVWXYZ2-9]{4}$/.test(c)), true);
check('coordinator prefix', run('generateCode_')('DFAD').startsWith('DFAD-'), true);

console.log('\naccess code hashing');
check('normalises dashes/case', run('normalizeCode_')('dcpa-7f3k-92qx'), 'DCPA7F3K92QX');
check('strips spaces', run('normalizeCode_')(' DFAD 7F3K 92QX '), 'DFAD7F3K92QX');
const code = run('generateCode_')('DCPA');
const salt = 'saltysalt';
const h1 = run('hashCode_')(code, salt);
check('hash is 64 hex chars', /^[0-9a-f]{64}$/.test(h1), true);
check('same code+salt -> same hash', run('hashCode_')(code, salt), h1);
check('formatting-insensitive', run('hashCode_')(code.toLowerCase().replace(/-/g, ''), salt), h1);
check('different salt -> different hash', run('hashCode_')(code, 'other') === h1, false);
check('safeEqual match', run('safeEqual_')(h1, h1), true);
check('safeEqual mismatch', run('safeEqual_')(h1, h1.slice(0, -1) + '0'), false);
check('safeEqual length mismatch', run('safeEqual_')('abc', 'abcd'), false);

console.log('\ntext hygiene');
check('strips control chars', run('clean_')('bio' + String.fromCharCode(0) + 'with' + String.fromCharCode(31) + 'junk'), 'biowithjunk');
check('truncates', run('clean_')('abcdefghij', 4), 'abcd');
check('list splits + dedupes', run('list_')('A; B;A ; ;C'), ['A', 'B', 'C']);
check('joinList_ dedupes case-insensitively',
  run('joinList_')(['Radio', 'radio', 'Sound']), 'Radio; Sound');
check('oneOf_ case-insensitive', run('oneOf_')('open', ['Open', 'Limited', 'Closed'], 'Closed'), 'Open');
check('oneOf_ fallback', run('oneOf_')('maybe', ['Open', 'Closed'], 'Closed'), 'Closed');
check('email valid', run('isEmail_')('a.salvador@bulsu.edu.ph'), true);
check('email invalid', run('isEmail_')('not an email'), false);

console.log('\nphotos');
check('drive share link -> thumbnail',
  run('normPhoto_')('https://drive.google.com/file/d/1AbCdEfGhIjKlMn/view?usp=sharing'),
  'https://drive.google.com/thumbnail?id=1AbCdEfGhIjKlMn&sz=w600');
check('already-a-thumbnail stays stable',
  run('normPhoto_')('https://drive.google.com/thumbnail?id=1AbCdEfGhIjKlMn&sz=w600'),
  'https://drive.google.com/thumbnail?id=1AbCdEfGhIjKlMn&sz=w600');
check('plain https kept', run('normPhoto_')('https://example.org/p.jpg'), 'https://example.org/p.jpg');
check('javascript: rejected', run('normPhoto_')('javascript:alert(1)'), '');
check('data: rejected', run('normPhoto_')('data:image/svg+xml,<svg onload=alert(1)>'), '');

console.log('\nsocial profiles (students tap straight through to these)');
check('facebook full url',
  run('normFacebook_')('https://www.facebook.com/juana.delacruz'),
  'https://www.facebook.com/juana.delacruz');
check('facebook without scheme',
  run('normFacebook_')('facebook.com/juana.delacruz'), 'https://www.facebook.com/juana.delacruz');
check('facebook with tracking junk stripped',
  run('normFacebook_')('https://m.facebook.com/juana.delacruz?ref=bookmarks'),
  'https://www.facebook.com/juana.delacruz');
check('facebook bare handle', run('normFacebook_')('juana.delacruz'), 'https://www.facebook.com/juana.delacruz');
check('facebook @handle', run('normFacebook_')('@juana.delacruz'), 'https://www.facebook.com/juana.delacruz');
check('facebook rejects another site', run('normFacebook_')('https://evil.example.com/x'), '');
check('facebook blank stays blank', run('normFacebook_')(''), '');
check('linkedin full url',
  run('normLinkedIn_')('https://www.linkedin.com/in/juana-dela-cruz-123'),
  'https://www.linkedin.com/in/juana-dela-cruz-123');
check('linkedin in/ prefix', run('normLinkedIn_')('in/juana-dela-cruz'), 'https://www.linkedin.com/in/juana-dela-cruz');
check('linkedin bare handle', run('normLinkedIn_')('juana-dela-cruz'), 'https://www.linkedin.com/in/juana-dela-cruz');
check('linkedin rejects another site', run('normLinkedIn_')('https://evil.example.com/x'), '');
check('website adds scheme', run('normWebsite_')('example.org/me'), 'https://example.org/me');
check('website rejects nonsense', run('normWebsite_')('not a website'), '');

console.log('\nslot validation');
check('valid slot', run('sanitizeSlot_')({ day: 'tuesday', start: '9:00', end: '11:00', mode: 'online', venue: 'Meet' }),
  { day: 'Tuesday', start: '09:00', end: '11:00', mode: 'Online', venue: 'Meet', note: '', active: true });
throws('rejects bad day', () => run('sanitizeSlot_')({ day: 'Funday', start: '09:00', end: '10:00' }), 'day of the week');
throws('rejects end before start', () => run('sanitizeSlot_')({ day: 'Monday', start: '11:00', end: '09:00' }), 'end time has to be after');
throws('rejects zero-length', () => run('sanitizeSlot_')({ day: 'Monday', start: '09:00', end: '09:00' }), 'end time has to be after');
throws('rejects missing time', () => run('sanitizeSlot_')({ day: 'Monday', start: '', end: '10:00' }), 'valid start and end');

console.log('\nprofile sanitisation');
const asFaculty = run('sanitizeProfile_')({
  name: '  Amihan R. Salvador ', email: 'A@bulsu.edu.ph', showEmail: true, showPhone: 'no',
  programs: ['BA Broadcasting', 'Underwater Basketweaving'],
  expertise: ['Media ethics', 'Media ethics', 'Radio'],
  roles: { adviser: 'open', consultant: 'nonsense' },
  facebook: '@amihan.salvador',
  status: 'Active', affiliation: 'Guest', sortOrder: 5
}, false);
check('trims name', asFaculty.name, 'Amihan R. Salvador');
check('keeps only known programmes', asFaculty.programs, 'BA Broadcasting');
check('dedupes expertise', asFaculty.expertise, 'Media ethics; Radio');
check('normalises task state', asFaculty.role_adviser, 'Open');
check('unknown task state -> Closed', asFaculty.role_consultant, 'Closed');
check('facebook handle expanded', asFaculty.facebook, 'https://www.facebook.com/amihan.salvador');
check('booleans coerced', [asFaculty.show_email, asFaculty.show_phone], [true, false]);
check('faculty cannot set status', 'status' in asFaculty, false);
check('faculty cannot set affiliation', 'affiliation' in asFaculty, false);
check('faculty cannot reorder', 'sort_order' in asFaculty, false);

const asAdmin = run('sanitizeProfile_')({ name: 'X', status: 'Pending', affiliation: 'Guest', sortOrder: 5 }, true);
check('admin may set status', asAdmin.status, 'Pending');
check('admin may set affiliation', asAdmin.affiliation, 'Guest');
check('admin may reorder', asAdmin.sort_order, 5);
throws('blank name rejected', () => run('sanitizeProfile_')({ name: '   ' }, false), 'Name is required');
throws('bad email rejected', () => run('sanitizeProfile_')({ email: 'nope' }, false), 'does not look valid');
throws('bad facebook rejected', () => run('sanitizeProfile_')({ facebook: 'https://evil.example.com' }, false), 'Facebook profile');
throws('bad linkedin rejected', () => run('sanitizeProfile_')({ linkedin: 'https://evil.example.com' }, false), 'LinkedIn profile');
check('empty email allowed', run('sanitizeProfile_')({ email: '' }, false).email, '');
check('clearing facebook allowed', run('sanitizeProfile_')({ facebook: '' }, false).facebook, '');

console.log('\nschema');
check('no student-facing log tab', Object.keys(constant('HEADERS')).includes('Audit'), false);
check('tabs are exactly the four data stores plus settings',
  Object.keys(constant('HEADERS')), ['Faculty', 'Consultations', 'Codes', 'Sessions', 'Settings']);
check('faculty table carries social columns',
  ['facebook', 'linkedin', 'website'].every((c) => constant('HEADERS').Faculty.includes(c)), true);
check('faculty table carries the four thesis tasks',
  Object.values(constant('TASK_COLUMNS')).every((c) => constant('HEADERS').Faculty.includes(c)), true);
check('pending is a valid status', constant('STATUSES').includes('Pending'), true);

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
