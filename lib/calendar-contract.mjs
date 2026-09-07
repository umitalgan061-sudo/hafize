const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const EVENT_KINDS = new Set(['event', 'reminder']);
const MAX_TITLE = 240;
const MAX_DESCRIPTION = 4_000;
const MAX_ITEMS = 100;
const APPROVAL_ACTIONS = Object.freeze(['calendar.create', 'calendar.update', 'calendar.delete', 'reminder.create', 'reminder.update', 'reminder.delete']);

function fail(code) {
  const error = new Error(code);
  error.code = code;
  throw error;
}

function text(value, max, code) {
  const result = typeof value === 'string' ? value.normalize('NFKC').trim() : '';
  if (!result || result.length > max || result.includes('\0')) fail(code);
  return result;
}

function optionalText(value, max, code) {
  if (value == null || value === '') return null;
  return text(value, max, code);
}

function isoDate(value, code) {
  const date = text(value, 10, code);
  if (!ISO_DATE_PATTERN.test(date)) fail(code);
  const parsed = new Date(`${date}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) fail(code);
  return date;
}

function normalizeKind(value) {
  const kind = text(value, 16, 'INVALID_CALENDAR_KIND').toLocaleLowerCase('en-US');
  if (!EVENT_KINDS.has(kind)) fail('INVALID_CALENDAR_KIND');
  return kind;
}

function normalizeItem(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail('INVALID_CALENDAR_ITEM');
  return Object.freeze({
    id: optionalText(value.id, 120, 'INVALID_CALENDAR_ID'),
    kind: normalizeKind(value.kind),
    title: text(value.title, MAX_TITLE, 'INVALID_CALENDAR_TITLE'),
    description: optionalText(value.description, MAX_DESCRIPTION, 'INVALID_CALENDAR_DESCRIPTION'),
    date: isoDate(value.date, 'INVALID_CALENDAR_DATE'),
    startTime: optionalText(value.startTime, 16, 'INVALID_CALENDAR_TIME'),
    endTime: optionalText(value.endTime, 16, 'INVALID_CALENDAR_TIME'),
    timezone: optionalText(value.timezone, 80, 'INVALID_CALENDAR_TIMEZONE'),
    sourceRef: optionalText(value.sourceRef, 300, 'INVALID_CALENDAR_SOURCE_REF')
  });
}

function normalizeQuery(input = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) fail('INVALID_CALENDAR_QUERY');
  const from = input.from == null ? null : isoDate(input.from, 'INVALID_CALENDAR_FROM');
  const to = input.to == null ? null : isoDate(input.to, 'INVALID_CALENDAR_TO');
  if (from && to && from > to) fail('INVALID_CALENDAR_RANGE');
  const kind = input.kind == null ? null : normalizeKind(input.kind);
  return Object.freeze({ from, to, kind, query: optionalText(input.query, 500, 'INVALID_CALENDAR_QUERY_TEXT') });
}

export function normalizeCalendarRead({ ownerId, query = {} } = {}) {
  const safeOwnerId = text(ownerId, 200, 'INVALID_CALENDAR_OWNER');
  return Object.freeze({ ownerId: safeOwnerId, query: normalizeQuery(query) });
}

export function normalizeCalendarItems({ ownerId, items } = {}) {
  const safeOwnerId = text(ownerId, 200, 'INVALID_CALENDAR_OWNER');
  if (!Array.isArray(items) || items.length > MAX_ITEMS) fail('INVALID_CALENDAR_ITEMS');
  return Object.freeze({ ownerId: safeOwnerId, items: Object.freeze(items.map(normalizeItem)) });
}

export function calendarWriteApproval(action) {
  const value = text(action, 80, 'INVALID_CALENDAR_ACTION');
  if (!APPROVAL_ACTIONS.includes(value)) fail('INVALID_CALENDAR_ACTION');
  return Object.freeze({ action: value, requiresApproval: true });
}

export function assertCalendarWriteApproved({ action, approvalGranted = false } = {}) {
  const contract = calendarWriteApproval(action);
  if (approvalGranted !== true) fail(`CALENDAR_APPROVAL_REQUIRED:${contract.action}`);
  return Object.freeze({ ...contract, approved: true });
}

export const CALENDAR_APPROVAL_ACTIONS = APPROVAL_ACTIONS;
export const CALENDAR_CONTRACT_LIMITS = Object.freeze({ maxItems: MAX_ITEMS, maxTitleLength: MAX_TITLE, maxDescriptionLength: MAX_DESCRIPTION });
