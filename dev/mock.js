/**
 * DFAD — DCPA Faculty Advisers Directory
 * In-browser mock of the Apps Script API.
 * Built and developed by Benedict de Jesus.
 *
 * Load the site with `?mock` (e.g. http://localhost:4321/?mock) to run the
 * whole interface against sample data with no spreadsheet and no deployment.
 * Useful for previewing design changes and for showing the coordinator what
 * the faculty dashboard looks like before anything is live.
 *
 * Sample access codes:
 *   DCPA-TEST-2345  — faculty (a claimed profile)
 *   DCPA-NEW-7788   — faculty (an unclaimed Pending slot)
 *   DFAD-HEAD-2345  — coordinator
 *
 * Nothing here ships to production: app.js only imports this file when the
 * `mock` query parameter is present.
 */

const MOCK_BASE = 'https://script.google.com/macros/s/MOCK-DEPLOYMENT/exec';

try {
  localStorage.setItem('dad:apiBase', MOCK_BASE);
  sessionStorage.removeItem('dad:directoryCache');
} catch (e) {
  /* ignore */
}

/* --------------------------------------------------------------------------
   Seed data
   -------------------------------------------------------------------------- */

const blankRoles = () => ({ adviser: 'Closed', consultant: 'Closed', critic: 'Closed', media: 'Closed' });

const db = {
  settings: {
    site_title: "DFAD — DCPA Faculty Advisers Directory",
    site_tagline: 'Advisers, consultants, critics and media experts',
    department: 'Department of Communication and Performing Arts',
    college: 'College of Arts and Letters',
    university: 'Bulacan State University',
    author: 'Benedict de Jesus',
    proponent: 'Mr. Joshua Nicdao',
    proponent_title: 'Proponent — originated the idea for DFAD',
    dean: 'Dr. Lois Ruth B. Villavicencio',
    dean_title: 'Dean, College of Arts and Letters',
    chair: 'Mr. Marlon B. Santos',
    chair_title: 'Chairperson, Department of Communication and Performing Arts',
    term: 'First Semester, AY 2026–2027',
    announcement: 'Thesis proposal defences run 10–21 August. Advisers may respond more slowly that fortnight.',
    contact_email: 'dcpa@bulsu.edu.ph'
  },
  faculty: [
    {
      id: 'fac_one', slotNo: '01', status: 'Active', sortOrder: 0,
      name: 'Amihan R. Salvador', honorific: 'Dr.', suffix: '',
      rank: 'Associate Professor II', affiliation: 'DCPA',
      department: 'Department of Communication and Performing Arts',
      programs: ['BA Broadcasting', 'BA Journalism'],
      expertise: ['Broadcast production', 'Media ethics', 'Audience research', 'Community radio'],
      bio: 'Twelve years in provincial broadcasting before moving to the academe. Research sits at the meeting point of community radio and disaster communication.',
      email: 'a.salvador@bulsu.edu.ph', showEmail: true,
      phone: '+63 917 000 0001', showPhone: false,
      office: 'CAL Building, Room 201', photo: '', photoFileId: '',
      facebook: 'https://www.facebook.com/amihan.salvador',
      linkedin: 'https://www.linkedin.com/in/amihan-salvador',
      website: 'https://orcid.org/0000-0000-0000-0000',
      availabilityNote: 'Accepting up to five thesis advisees this semester. Message before dropping by.',
      roles: { adviser: 'Open', consultant: 'Open', critic: 'Limited', media: 'Open' },
      updatedAt: new Date(Date.now() - 2 * 864e5).toISOString(),
      slots: [
        { id: 's1', facultyId: 'fac_one', day: 'Tuesday', start: '09:00', end: '11:00', mode: 'Face-to-face', venue: 'CAL 201', note: '', active: true },
        { id: 's2', facultyId: 'fac_one', day: 'Thursday', start: '13:00', end: '15:00', mode: 'Online', venue: 'Google Meet — link on request', note: 'Thesis advisees first', active: true }
      ]
    },
    {
      id: 'fac_two', slotNo: '02', status: 'Active', sortOrder: 0,
      name: 'Benigno T. Lazaro', honorific: '', suffix: '',
      rank: 'Instructor I', affiliation: 'DCPA',
      department: 'Department of Communication and Performing Arts',
      programs: ['Bachelor in Performing Arts'],
      expertise: ['Theatre direction', 'Movement', 'Production design'],
      bio: 'Directs the university repertory company. Interested in Bulacan folk forms staged for contemporary audiences.',
      email: 'b.lazaro@bulsu.edu.ph', showEmail: true,
      phone: '', showPhone: false,
      office: 'Little Theater', photo: '', photoFileId: '',
      facebook: 'https://www.facebook.com/benigno.lazaro', linkedin: '', website: '',
      availabilityNote: '',
      roles: { adviser: 'Limited', consultant: 'Open', critic: 'Open', media: 'Closed' },
      updatedAt: new Date(Date.now() - 9 * 864e5).toISOString(),
      slots: [
        { id: 's3', facultyId: 'fac_two', day: 'Wednesday', start: '10:00', end: '12:00', mode: 'Face-to-face', venue: 'Little Theater', note: '', active: true },
        { id: 's4', facultyId: 'fac_two', day: 'Friday', start: '15:00', end: '17:00', mode: 'Hybrid', venue: 'Little Theater / Meet', note: 'Rehearsal blocks permitting', active: true }
      ]
    },
    {
      id: 'fac_three', slotNo: '03', status: 'Active', sortOrder: 0,
      name: 'Corazon M. Villegas', honorific: 'Prof.', suffix: '',
      rank: 'Assistant Professor III', affiliation: 'Guest',
      department: 'Department of Humanities (CAL)',
      programs: ['BA Journalism'],
      expertise: ['Literary criticism', 'Creative nonfiction', 'Filipino literature'],
      bio: 'Teaches literature and creative nonfiction. Sits regularly on journalism thesis panels.',
      email: 'c.villegas@bulsu.edu.ph', showEmail: true,
      phone: '', showPhone: false,
      office: 'Humanities Faculty Room', photo: '', photoFileId: '',
      facebook: '', linkedin: 'https://www.linkedin.com/in/corazon-villegas', website: '',
      availabilityNote: 'Panel work only — not taking new advisees this term.',
      roles: { adviser: 'Closed', consultant: 'Open', critic: 'Open', media: 'Limited' },
      updatedAt: new Date(Date.now() - 21 * 864e5).toISOString(),
      slots: [
        { id: 's5', facultyId: 'fac_three', day: 'Friday', start: '14:00', end: '16:00', mode: 'Face-to-face', venue: 'Humanities Faculty Room', note: '', active: true }
      ]
    },
    {
      id: 'fac_four', slotNo: '04', status: 'Active', sortOrder: 0,
      name: 'Delfin P. Aguinaldo', honorific: '', suffix: '',
      rank: 'Associate Professor I', affiliation: 'DCPA',
      department: 'Department of Communication and Performing Arts',
      programs: ['BA Broadcasting', 'Bachelor in Performing Arts'],
      expertise: ['Sound design', 'Radio drama', 'Post-production'],
      bio: 'Runs the audio laboratory. Long-running interest in radio drama as a teaching form.',
      email: 'd.aguinaldo@bulsu.edu.ph', showEmail: true,
      phone: '', showPhone: false,
      office: 'Audio Lab, CAL Annex', photo: '', photoFileId: '',
      facebook: '', linkedin: '', website: '',
      availabilityNote: '',
      roles: { adviser: 'Open', consultant: 'Limited', critic: 'Closed', media: 'Limited' },
      updatedAt: new Date(Date.now() - 40 * 864e5).toISOString(),
      slots: []
    },
    {
      id: 'fac_five', slotNo: '05', status: 'Hidden', sortOrder: 0,
      name: 'Elena S. Bautista', honorific: 'Dr.', suffix: '',
      rank: 'Professor I', affiliation: 'DCPA',
      department: 'Department of Communication and Performing Arts',
      programs: ['BA Journalism'],
      expertise: ['Investigative reporting', 'Media law'],
      bio: 'On study leave for the semester.',
      email: 'e.bautista@bulsu.edu.ph', showEmail: false,
      phone: '', showPhone: false,
      office: '', photo: '', photoFileId: '',
      facebook: '', linkedin: '', website: '',
      availabilityNote: 'On study leave until the second semester.',
      roles: blankRoles(),
      updatedAt: new Date(Date.now() - 90 * 864e5).toISOString(),
      slots: []
    },
    // An unclaimed slot from prepareRoster(): a code exists, nobody has used it.
    {
      id: 'fac_pending', slotNo: '06', status: 'Pending', sortOrder: 0,
      name: '', honorific: '', suffix: '', rank: '', affiliation: 'DCPA',
      department: 'Department of Communication and Performing Arts',
      programs: [], expertise: [], bio: '',
      email: '', showEmail: true, phone: '', showPhone: false,
      office: '', photo: '', photoFileId: '',
      facebook: '', linkedin: '', website: '',
      availabilityNote: '', roles: blankRoles(), updatedAt: '', slots: []
    }
  ],
  codes: {
    DCPATEST2345: { facultyId: 'fac_one', role: 'faculty', label: 'Amihan R. Salvador' },
    DCPANEW7788: { facultyId: 'fac_pending', role: 'faculty', label: 'Slot 06' },
    DFADHEAD2345: { facultyId: '', role: 'admin', label: 'Coordinator' }
  },
  sessions: {}
};

/* --------------------------------------------------------------------------
   Projections
   -------------------------------------------------------------------------- */

const clone = (v) => JSON.parse(JSON.stringify(v));

function publicView(person) {
  const p = clone(person);
  if (!p.showEmail) p.email = '';
  if (!p.showPhone) p.phone = '';
  p.slots = (p.slots || []).filter((s) => s.active !== false);
  delete p.showEmail;
  delete p.showPhone;
  delete p.status;
  delete p.sortOrder;
  delete p.photoFileId;
  return p;
}

function requireSession(token) {
  const session = db.sessions[token];
  if (!session) throw { code: 401, message: 'Your session is no longer valid. Please sign in again.' };
  return session;
}

function requireAdmin(token) {
  const session = requireSession(token);
  if (session.role !== 'admin') throw { code: 403, message: 'This action needs a coordinator access code.' };
  return session;
}

function findMine(token) {
  const session = requireSession(token);
  const person = db.faculty.find((p) => p.id === session.facultyId);
  if (!person) throw { code: 404, message: 'Profile not found.' };
  return person;
}

function uid(prefix) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

/** Mirrors CODE_ALPHABET in Lib.gs — no 0, O, 1, I or L. */
const MOCK_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

function fakeCode(prefix) {
  const pick = () => MOCK_ALPHABET[Math.floor(Math.random() * MOCK_ALPHABET.length)];
  return `${prefix}-${pick()}${pick()}${pick()}${pick()}-${pick()}${pick()}${pick()}${pick()}`;
}

/* --- the same normalisers the server applies ------------------------------ */

function normFacebook(v) {
  let s = String(v || '').trim().replace(/^@/, '');
  if (!s) return '';
  const m = s.match(/^(?:https?:\/\/)?(?:[\w-]+\.)?facebook\.com\/([^/?#\s]+)/i);
  if (m) return 'https://www.facebook.com/' + m[1];
  if (/^https?:\/\//i.test(s)) return null;
  return /^[\w.]{3,60}$/.test(s) ? 'https://www.facebook.com/' + s : null;
}

function normLinkedIn(v) {
  let s = String(v || '').trim().replace(/^@/, '');
  if (!s) return '';
  const m = s.match(/^(?:https?:\/\/)?(?:[\w-]+\.)?linkedin\.com\/(in|pub|company)\/([^/?#\s]+)/i);
  if (m) return 'https://www.linkedin.com/' + m[1].toLowerCase() + '/' + m[2];
  if (/^https?:\/\//i.test(s)) return null;
  const bare = s.replace(/^in\//i, '');
  return /^[\w-]{3,100}$/.test(bare) ? 'https://www.linkedin.com/in/' + bare : null;
}

function normWebsite(v) {
  let s = String(v || '').trim();
  if (!s) return '';
  if (!/^https?:\/\//i.test(s)) s = 'https://' + s;
  return /^https?:\/\/[^\s.]+\.[^\s]{2,}/i.test(s) ? s : null;
}

/* --------------------------------------------------------------------------
   Handlers
   -------------------------------------------------------------------------- */

const handlers = {
  ping: () => ({ pong: true, time: new Date().toISOString() }),

  meta: () => ({
    site: {
      title: db.settings.site_title,
      tagline: db.settings.site_tagline,
      department: db.settings.department,
      college: db.settings.college,
      university: db.settings.university,
      author: db.settings.author,
      proponent: db.settings.proponent,
      proponentTitle: db.settings.proponent_title,
      dean: db.settings.dean,
      deanTitle: db.settings.dean_title,
      chair: db.settings.chair,
      chairTitle: db.settings.chair_title,
      term: db.settings.term,
      announcement: db.settings.announcement,
      contactEmail: db.settings.contact_email
    },
    options: {
      days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
      modes: ['Face-to-face', 'Online', 'Hybrid'],
      roleStates: ['Open', 'Limited', 'Closed'],
      affiliations: ['DCPA', 'Guest'],
      programs: ['BA Broadcasting', 'BA Journalism', 'Bachelor in Performing Arts']
    }
  }),

  directory: () => {
    const list = db.faculty
      .filter((p) => p.status === 'Active' && p.name)
      .map(publicView);
    return { faculty: list, count: list.length, fetchedAt: new Date().toISOString() };
  },

  faculty: ({ id }) => {
    const person = db.faculty.find((p) => p.id === id && p.status === 'Active');
    if (!person) throw { code: 404, message: 'That adviser profile is not listed.' };
    return { faculty: publicView(person) };
  },

  login: ({ code }) => {
    const key = String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    const entry = db.codes[key];
    if (!entry) throw { code: 401, message: 'That access code was not recognised.' };
    const token = uid('tok');
    db.sessions[token] = { ...entry };
    return {
      token,
      expiresAt: new Date(Date.now() + 12 * 3600e3).toISOString(),
      role: entry.role,
      label: entry.label,
      profile: entry.role === 'admin' ? null : clone(db.faculty.find((p) => p.id === entry.facultyId))
    };
  },

  session: ({ token }) => {
    const session = requireSession(token);
    return {
      role: session.role,
      profile: session.role === 'admin' ? null : clone(db.faculty.find((p) => p.id === session.facultyId))
    };
  },

  logout: ({ token }) => {
    delete db.sessions[token];
    return { signedOut: true };
  },

  saveProfile: ({ token, profile }) => {
    const person = findMine(token);
    const patch = { ...profile };

    if ('facebook' in patch) {
      const v = normFacebook(patch.facebook);
      if (v === null) throw { code: 400, message: 'That does not look like a Facebook profile. Paste the link or just your username.' };
      patch.facebook = v;
    }
    if ('linkedin' in patch) {
      const v = normLinkedIn(patch.linkedin);
      if (v === null) throw { code: 400, message: 'That does not look like a LinkedIn profile. Paste the link or just your username.' };
      patch.linkedin = v;
    }
    if ('website' in patch) {
      const v = normWebsite(patch.website);
      if (v === null) throw { code: 400, message: 'That website address does not look valid.' };
      patch.website = v;
    }
    if ('roles' in patch) patch.roles = { ...person.roles, ...patch.roles };

    Object.assign(person, patch);
    // A Pending slot lists itself as soon as it has a name.
    if (person.status === 'Pending' && person.name) person.status = 'Active';
    person.updatedAt = new Date().toISOString();
    return { profile: clone(person) };
  },

  uploadPhoto: ({ token, image }) => {
    const person = findMine(token);
    if (!/^data:image\/(png|jpe?g|webp);base64,/i.test(String(image || ''))) {
      throw { code: 400, message: 'That file is not a supported image. Use a JPEG, PNG or WebP photo.' };
    }
    // The real backend files this in Drive; the mock just keeps the data URL.
    person.photo = image;
    person.photoFileId = uid('file');
    person.updatedAt = new Date().toISOString();
    return { profile: clone(person) };
  },

  removePhoto: ({ token }) => {
    const person = findMine(token);
    person.photo = '';
    person.photoFileId = '';
    person.updatedAt = new Date().toISOString();
    return { profile: clone(person) };
  },

  saveSlot: ({ token, slot }) => {
    const person = findMine(token);
    person.slots = person.slots || [];
    if (slot.end <= slot.start) throw { code: 400, message: 'The end time has to be after the start time.' };

    const clash = person.slots.find((s) =>
      s.id !== slot.id && s.day === slot.day && s.active !== false && slot.active !== false &&
      slot.start < s.end && s.start < slot.end);
    if (clash) {
      throw { code: 409, message: `That overlaps your ${clash.day} ${clash.start}–${clash.end} slot.` };
    }

    if (slot.id) {
      const index = person.slots.findIndex((s) => s.id === slot.id);
      if (index < 0) throw { code: 404, message: 'That consultation slot no longer exists.' };
      person.slots[index] = { ...person.slots[index], ...slot };
    } else {
      person.slots.push({ ...slot, id: uid('slot'), facultyId: person.id });
    }
    const order = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    person.slots.sort((a, b) => order.indexOf(a.day) - order.indexOf(b.day) || a.start.localeCompare(b.start));
    person.updatedAt = new Date().toISOString();
    return { profile: clone(person) };
  },

  deleteSlot: ({ token, id }) => {
    const person = findMine(token);
    person.slots = (person.slots || []).filter((s) => s.id !== id);
    person.updatedAt = new Date().toISOString();
    return { profile: clone(person) };
  },

  rotateCode: ({ token }) => {
    const session = requireSession(token);
    Object.keys(db.codes).forEach((key) => {
      if (db.codes[key].facultyId === session.facultyId) delete db.codes[key];
    });
    const code = fakeCode('DCPA');
    db.codes[code.replace(/[^A-Z0-9]/g, '')] = { facultyId: session.facultyId, role: 'faculty', label: 'rotated' };
    return { code };
  },

  archiveProfile: ({ token, confirm }) => {
    if (String(confirm).toUpperCase() !== 'REMOVE') throw { code: 400, message: 'Type REMOVE to confirm.' };
    const person = findMine(token);
    person.status = 'Archived';
    person.slots = [];
    return { archived: true };
  },

  adminList: ({ token }) => {
    requireAdmin(token);
    return {
      faculty: db.faculty.map((p) => ({
        ...clone(p),
        activeCodes: Object.values(db.codes).filter((c) => c.facultyId === p.id).length,
        lastUsedAt: ''
      })),
      settings: { ...db.settings }
    };
  },

  adminCreateFaculty: ({ token, profile }) => {
    requireAdmin(token);
    const id = uid('fac');
    const slotNo = String(db.faculty.length + 1).padStart(2, '0');
    db.faculty.push({
      id, slotNo, status: 'Active', sortOrder: 0, honorific: '', suffix: '', rank: '',
      affiliation: 'DCPA', department: '', programs: [], expertise: [], bio: '',
      email: '', showEmail: true, phone: '', showPhone: false, office: '',
      photo: '', photoFileId: '', facebook: '', linkedin: '', website: '',
      availabilityNote: '', roles: blankRoles(), slots: [],
      updatedAt: new Date().toISOString(),
      ...profile
    });
    const code = fakeCode('DCPA');
    db.codes[code.replace(/[^A-Z0-9]/g, '')] = { facultyId: id, role: 'faculty', label: profile.name };
    return { id, slotNo, code };
  },

  adminUpdateFaculty: ({ token, facultyId, profile }) => {
    requireAdmin(token);
    const person = db.faculty.find((p) => p.id === facultyId);
    if (!person) throw { code: 404, message: 'Profile not found.' };
    Object.assign(person, profile);
    person.updatedAt = new Date().toISOString();
    return { id: facultyId };
  },

  adminIssueCode: ({ token, facultyId }) => {
    requireAdmin(token);
    Object.keys(db.codes).forEach((key) => {
      if (db.codes[key].facultyId === facultyId) delete db.codes[key];
    });
    const code = fakeCode('DCPA');
    db.codes[code.replace(/[^A-Z0-9]/g, '')] = { facultyId, role: 'faculty', label: 'issued' };
    return { code };
  },

  adminRevokeCodes: ({ token, facultyId }) => {
    requireAdmin(token);
    let revoked = 0;
    Object.keys(db.codes).forEach((key) => {
      if (db.codes[key].facultyId === facultyId) {
        delete db.codes[key];
        revoked += 1;
      }
    });
    return { revoked };
  },

  adminDeleteFaculty: ({ token, facultyId, confirm }) => {
    requireAdmin(token);
    if (String(confirm).toUpperCase() !== 'DELETE') throw { code: 400, message: 'Type DELETE to confirm permanent removal.' };
    db.faculty = db.faculty.filter((p) => p.id !== facultyId);
    return { deleted: true };
  },

  adminSetSetting: ({ token, key, value }) => {
    requireAdmin(token);
    db.settings[key] = value;
    return { key, value };
  }
};

/* --------------------------------------------------------------------------
   fetch interception
   -------------------------------------------------------------------------- */

const realFetch = window.fetch.bind(window);

window.fetch = async function mockFetch(input, init = {}) {
  const url = typeof input === 'string' ? input : input.url;
  if (!url.startsWith(MOCK_BASE)) return realFetch(input, init);

  // A little latency so loading states are actually visible while developing.
  await new Promise((resolve) => setTimeout(resolve, 220 + Math.random() * 180));

  let params = {};
  try {
    new URL(url).searchParams.forEach((value, key) => { params[key] = value; });
  } catch (e) { /* ignore */ }
  if (init.body) {
    try { params = { ...params, ...JSON.parse(init.body) }; } catch (e) { /* ignore */ }
  }

  let payload;
  try {
    const handler = handlers[params.action];
    if (!handler) throw { code: 404, message: `Unknown action: ${params.action}` };
    payload = { ok: true, data: handler(params) };
  } catch (error) {
    payload = {
      ok: false,
      error: { code: error.code || 500, message: error.message || String(error) }
    };
  }
  payload.version = 'mock';

  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
};

console.info(
  "%cDFAD mock API active%c\nfaculty: DCPA-TEST-2345\nunclaimed slot: DCPA-NEW-7788\ncoordinator: DFAD-HEAD-2345",
  'font-weight:bold;color:#10593f', 'color:inherit'
);
