/**
 * DFAD — DCPA Faculty Advisers Directory
 * Calendar export.
 * Built and developed by Benedict de Jesus.
 *
 * Consultation slots are weekly and open-ended, so each becomes a weekly
 * recurring VEVENT starting on the next matching weekday. Times are written
 * as floating local time, which is what students want on a campus calendar.
 */

import { DAYS, fmtRange, fullName } from './util.js';

const ICS_DAYS = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'];

function pad(n) {
  return String(n).padStart(2, '0');
}

function stamp(date) {
  return (
    date.getUTCFullYear() +
    pad(date.getUTCMonth() + 1) +
    pad(date.getUTCDate()) + 'T' +
    pad(date.getUTCHours()) +
    pad(date.getUTCMinutes()) +
    pad(date.getUTCSeconds()) + 'Z'
  );
}

function localStamp(date) {
  return (
    date.getFullYear() +
    pad(date.getMonth() + 1) +
    pad(date.getDate()) + 'T' +
    pad(date.getHours()) +
    pad(date.getMinutes()) + '00'
  );
}

/** The next occurrence of `dayName` at `hh:mm`, today included. */
function nextOccurrence(dayName, hhmm) {
  const target = DAYS.indexOf(dayName);
  if (target < 0) return null;
  const [h, m] = String(hhmm).split(':').map(Number);
  const now = new Date();
  const todayIndex = (now.getDay() + 6) % 7;
  let ahead = (target - todayIndex + 7) % 7;
  const candidate = new Date(now);
  candidate.setHours(h, m, 0, 0);
  if (ahead === 0 && candidate <= now) ahead = 7;
  candidate.setDate(candidate.getDate() + ahead);
  return candidate;
}

/** RFC 5545 wants CRLF, escaped separators, and lines folded at 75 octets. */
function escapeText(value) {
  return String(value || '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

function fold(line) {
  if (line.length <= 74) return line;
  const parts = [line.slice(0, 74)];
  let rest = line.slice(74);
  while (rest.length > 73) {
    parts.push(' ' + rest.slice(0, 73));
    rest = rest.slice(73);
  }
  if (rest) parts.push(' ' + rest);
  return parts.join('\r\n');
}

/**
 * Builds an .ics document for one faculty member's consultation slots.
 * @param {object} person
 * @param {Array} [slots] defaults to `person.slots`
 */
export function buildIcs(person, slots = person.slots || []) {
  const now = stamp(new Date());
  const name = fullName(person);
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//BulSU CAL//DFAD DCPA Faculty Advisers Directory//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeText(name + ' — consultation hours')}`
  ];

  slots.forEach((slot, index) => {
    const start = nextOccurrence(slot.day, slot.start);
    if (!start) return;
    // The end always belongs to the same occurrence as the start.
    const [endH, endM] = String(slot.end).split(':').map(Number);
    const end = new Date(start);
    end.setHours(endH, endM, 0, 0);
    if (end <= start) return;

    const where = slot.mode === 'Online'
      ? (slot.venue || 'Online')
      : [slot.venue, person.office].filter(Boolean).join(' · ');

    const description = [
      `${name} — consultation hours`,
      `${slot.day}, ${fmtRange(slot.start, slot.end)} (${slot.mode})`,
      slot.note,
      person.email ? `Email: ${person.email}` : '',
      "Published through DFAD, the DCPA Faculty Advisers Directory."
    ].filter(Boolean).join('\n');

    lines.push(
      'BEGIN:VEVENT',
      `UID:${(slot.id || `slot${index}`)}-${(person.id || 'dad')}@dad.dcpa`,
      `DTSTAMP:${now}`,
      `DTSTART:${localStamp(start)}`,
      `DTEND:${localStamp(end)}`,
      `RRULE:FREQ=WEEKLY;BYDAY=${ICS_DAYS[DAYS.indexOf(slot.day)]}`,
      `SUMMARY:${escapeText(`Consultation — ${name}`)}`,
      where ? `LOCATION:${escapeText(where)}` : '',
      `DESCRIPTION:${escapeText(description)}`,
      'BEGIN:VALARM',
      'TRIGGER:-PT30M',
      'ACTION:DISPLAY',
      `DESCRIPTION:${escapeText(`Consultation with ${name} in 30 minutes`)}`,
      'END:VALARM',
      'END:VEVENT'
    );
  });

  lines.push('END:VCALENDAR');
  return lines.filter(Boolean).map(fold).join('\r\n');
}

/** Triggers a download of the given faculty member's consultation calendar. */
export function downloadIcs(person, slots) {
  const text = buildIcs(person, slots);
  const blob = new Blob([text], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${String(person.name || 'consultation').replace(/[^\w-]+/g, '-').toLowerCase()}-consultations.ics`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
