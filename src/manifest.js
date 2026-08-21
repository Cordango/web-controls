// SPDX-License-Identifier: Apache-2.0
// Copyright (c) Cordango and contributors.
// Part of Cordango Web Controls, the shared Vue controls for Cordango applications: https://github.com/cordango/web-controls
// Licensed under the Apache License, Version 2.0. See LICENSE in the repository root.
// Extracted from the Cordango platform at web/src/manifest.js. Until web/ consumes this
// package, that copy and this one are two files saying the same thing: check both.
//
// DIVERGENCE, ON PURPOSE: the platform copy still formats with `toLocale*(undefined)` in seven
// places. `undefined` is the BROWSER's locale, not the application's, so a German workspace renders
// English dates for anyone whose browser is set to English, and the reverse. This copy formats
// through `currentLocale()` instead. Everything else is byte-identical; when web/ adopts this
// package, or fixes its own copy, this note goes.

// Pure manifest helpers shared by the renderer and the view components (no Vue deps).

import { currentLocale } from './locale.js'

export function entityOf(manifest, key) { return (manifest?.entities || []).find(e => e.key === key) }
export function declaredFields(e) { return (e?.fields || []).filter(f => !f.system) }
export function fieldMap(e) { return Object.fromEntries((e?.fields || []).map(f => [f.key, f])) }
export function optionsOf(f) { return f?.options || [] }

// A reference at the platform person directory rather than at a record in this application. Pure:
// it reads three properties of a field. It sat in the data layer because that is where the person
// directory is fetched, which made a predicate look like a network concern.
export function isPersonField(f) {
  return f?.type === 'reference' && f?.targetApp === 'platform' && f?.targetEntity === 'person'
}
export function optionColor(f, v) { return optionsOf(f).find(o => o.value === v)?.color || '#64748b' }
export function optionLabel(f, v) { const o = optionsOf(f).find(o => o.value === v); return o?.label ?? v }

export function firstSelectField(e) { return declaredFields(e).find(f => ['select', 'multiselect'].includes(f.type)) }
export function firstDateField(e) { return declaredFields(e).find(f => ['date', 'datetime'].includes(f.type)) }

// --- archetype role helpers (Forms etc.) ---
export function entityByRole(manifest, role) { return (manifest?.entities || []).find(e => e.role === role) }
export function fieldByRole(entity, role) { return (entity?.fields || []).find(f => f.role === role) }
export function refFieldTo(entity, targetKey) { return (entity?.fields || []).find(f => f.type === 'reference' && f.targetEntity === targetKey) }

// Map a formField's answerType value to a renderer kind (loose match — the AI names the option values).
export function answerKind(typeValue) {
  const t = String(typeValue || '').toLowerCase()
  if (/multi/.test(t)) return 'multi'
  if (/single|choice|select|radio|dropdown/.test(t)) return 'single'
  if (/yes|no|bool|toggle/.test(t)) return 'boolean'
  if (/scale|rating|nps|star|likert/.test(t)) return 'scale'
  if (/long|paragraph|comment|textarea/.test(t)) return 'longtext'
  if (/number|numeric|int|decimal/.test(t)) return 'number'
  if (/date|time/.test(t)) return 'date'
  return 'text'
}

// The platform people directory, injected by data.js once loaded (loadPeople), so these PURE
// title/label helpers can resolve a person reference to a real name without importing data.js
// (which imports this file — the injection breaks the cycle). Empty until the first load.
let _peopleById = {}
export function setPeopleDirectory(byId) { _peopleById = byId || {} }
export function personName(id) { return _peopleById[id]?.full_name || null }
export function personOf(id) { return _peopleById[id] || null }
function isPersonRef(f) { return f?.type === 'reference' && f?.targetApp === 'platform' && f?.targetEntity === 'person' }

// A record's human title. When the displayField is a REFERENCE, the raw value is a foreign id — resolve
// it: a platform-person ref to the person's name, a local ref via `refMaps` (id -> display string the
// caller loaded). This is what stops a record whose identity IS a linked record (an employee = a person,
// a booking = its room) from showing a bare GUID. `refMaps` is optional; person refs resolve without it.
export function displayTitle(entity, rec, refMaps) {
  const df = entity?.displayField
  const fd = df ? fieldMap(entity)[df] : null
  if (fd && rec?.[df] != null && rec[df] !== '') {
    if (isPersonRef(fd)) return personName(rec[df]) || rec[df]
    if (fd.type === 'reference') return refMaps?.[df]?.[rec[df]] ?? rec[df]
    return rec[df]
  }
  return (df && rec?.[df]) || rec?.[declaredFields(entity)[0]?.key] || rec?.id || '—'
}

/** A record's PICTURE, if its entity declares one — the peer of displayTitle. Null when the entity
 *  has no `imageField`, when the field is empty, or when the value is not something an <img> can
 *  load: an image field pointed at the wrong column would otherwise render a broken-image glyph on
 *  every row, which is worse than the initials it replaced. Same-origin paths are allowed because
 *  that is how the platform serves what it fetched itself. */
export function displayImage(entity, rec) {
  const key = entity?.imageField
  const v = key ? rec?.[key] : null
  if (typeof v !== 'string' || !v) return null
  return /^(https?:\/\/|\/)/.test(v) ? v : null
}
// --- summarising a record into one line ---------------------------------------------------------
// Two surfaces do this: the related-record rows on a detail screen, and a table row rendered as a
// card on a narrow screen. They used to be two copies of the same heuristic in two files, which is
// how the same record ends up described two different ways depending on where you met it.
//
// Both take `fields` in the order they should be considered, with the TITLE FIRST — whatever the
// caller is already showing above the line. A detail passes `declaredFields(entity)`; a table passes
// the columns the reader has left visible, so a column they hid does not reappear on the card.

/**
 * The one status chip: the first select/multiselect that actually HAS a value on this row.
 *
 * Deliberately not `firstSelectField`, which asks a question about the ENTITY. Here an empty status
 * is no status, because a chip reading nothing is worse than no chip at all.
 */
export function recordStatus(rec, fields) {
  // `hasStatus` rather than a bare truthiness test: a multiselect with nothing selected arrives as
  // `[]`, which is truthy, so the original produced a chip labelled `undefined` for every record
  // whose tags were empty. An empty list is no status.
  const hasStatus = (x) => {
    const v = rec?.[x.key]
    return Array.isArray(v) ? v.length > 0 : v != null && v !== ''
  }
  const f = (fields ?? []).find(x => ['select', 'multiselect'].includes(x.type) && hasStatus(x))
  if (!f) return null
  const val = Array.isArray(rec[f.key]) ? rec[f.key][0] : rec[f.key]
  return { field: f, color: optionColor(f, val), label: optionLabel(f, val) }
}

/**
 * The line under the title: the next couple of fields, formatted and joined.
 *
 * The title field drops out because it is already on screen above this, and selects drop out because
 * `recordStatus` spent them on the chip. Empty values drop out too rather than contributing a run of
 * bare separators.
 */
export function recordSubtitle(rec, fields, refMaps = null, max = 2) {
  const titleKey = fields?.[0]?.key
  return (fields ?? [])
    .filter(f => f.key !== titleKey && !['select', 'multiselect'].includes(f.type))
    .slice(0, max)
    .map(f => fmtValue(f, rec?.[f.key], refMaps?.[f.key]))
    .filter(x => x && x !== '—')
    .join(' · ')
}

export function fmtMoney(field, v) {
  const n = Number(v)
  if (isNaN(n)) return v
  try { return n.toLocaleString(currentLocale(), { style: 'currency', currency: field.currency || 'EUR' }) }
  catch { return `${n.toLocaleString(currentLocale(), { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${field.currency || ''}`.trim() }
}
// Bare numbers. `scale` was declared on every decimal field and read by nobody, so a computed ratio
// printed every digit the arithmetic produced ('0.7294117647058823' in a table cell); `unit` is the
// display suffix that makes a bare 3.25 read as '3.25x' and 40.7 as '40.7%'.
// Integers are deliberately NOT group-separated: the type covers counts AND years, and '2,021' is
// wrong more visibly than '2021' is unreadable. A decimal groups, since it is always a quantity.
export function fmtNumber(field, v) {
  const n = Number(v)
  if (isNaN(n)) return v
  const unit = field?.unit ?? ''
  // An integer field holding a fractional value means it was AVERAGED — round rather than print the
  // artifact of the division.
  if (field?.type === 'integer') return `${Math.round(n)}${unit}`
  const opts = {}
  if (typeof field?.scale === 'number') { opts.minimumFractionDigits = field.scale; opts.maximumFractionDigits = field.scale }
  return `${n.toLocaleString(currentLocale(), opts)}${unit}`
}
// Shared, locale-aware date formatters — the renderer had none, so date/datetime fields printed raw
// ISO strings everywhere (SLA lists, hub facts, child-block timestamps). Invalid values pass through.
export function fmtDate(v) {
  const d = new Date(v)
  return isNaN(d.getTime()) ? v : d.toLocaleDateString(currentLocale(), { year: 'numeric', month: 'short', day: 'numeric' })
}
export function fmtDateTime(v) {
  const d = new Date(v)
  return isNaN(d.getTime()) ? v
    : d.toLocaleString(currentLocale(), { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}
// Fine-grained relative time for a conversational thread — "just now", "5m ago", "3h ago", "2d ago",
// then an absolute short date past a week. (fmtSince is month-granular tenure; this is recent + precise.)
export function fmtAgo(v) {
  const d = new Date(v)
  if (isNaN(d.getTime())) return v ?? ''
  const secs = Math.floor((Date.now() - d.getTime()) / 1000)
  if (secs < 45) return 'just now'
  if (secs < 3600) return `${Math.max(1, Math.round(secs / 60))}m ago`
  if (secs < 86400) return `${Math.round(secs / 3600)}h ago`
  if (secs < 604800) return `${Math.round(secs / 86400)}d ago`
  return fmtDate(v)
}
// Elapsed time from a date to today, e.g. "5 years · 2 months" — the "tenure"/"time in role" a real HR
// profile shows, without needing a stored date-diff (a computed expr can't subtract from `today`).
export function fmtSince(v) {
  const d = new Date(v)
  if (isNaN(d.getTime())) return v ?? '—'
  let months = (new Date().getFullYear() - d.getFullYear()) * 12 + (new Date().getMonth() - d.getMonth())
  if (new Date().getDate() < d.getDate()) months--
  if (months < 0) return 'not started'
  const y = Math.floor(months / 12), m = months % 12
  const parts = []
  if (y) parts.push(`${y} year${y > 1 ? 's' : ''}`)
  if (m) parts.push(`${m} month${m > 1 ? 's' : ''}`)
  return parts.join(' · ') || 'this month'
}
/**
 * The address a field's value points at, or null when it points at nothing.
 *
 * Two cases, one answer, because a table cell and a record panel rendering the same field as
 * different things is how somebody concludes the link only works in one place:
 *
 *   · a declared `url` field is its own address;
 *   · a `slug` field with a `prefix` IS an address — the prefix is the fixed part of it, which is
 *     exactly why the form shows it inside the box. A booking page stores `intro-call` and lives at
 *     `/book/intro-call`; without this the one thing the record exists to hand out is unclickable
 *     text you have to assemble in your head.
 *
 * Relative on purpose for the slug case: it resolves against whatever origin the reader is on, which
 * is the workspace's own host. UiLink then decides whether it is safe to follow (http/https only).
 */
export function fieldHref(field, value) {
  if (value == null || value === '') return null
  if (field?.type === 'url') return String(value)
  if (field?.input === 'slug' && field?.prefix) return `${field.prefix}${value}`
  return null
}

export function fmtValue(field, v, refMap) {
  if (v == null || v === '') return '—'
  if (field.type === 'reference') return refMap?.[v] ?? v
  if (field.type === 'boolean') return v ? 'Yes' : 'No'
  if (field.type === 'money') return fmtMoney(field, v)
  if (field.type === 'select') return optionLabel(field, v)
  if (field.type === 'multiselect' && Array.isArray(v)) return v.map(x => optionLabel(field, x)).join(', ')
  if (field.type === 'date') return fmtDate(v)
  if (field.type === 'datetime') return fmtDateTime(v)
  if (field.type === 'integer' || field.type === 'decimal') return fmtNumber(field, v)
  return v
}

// --- binding scopes (G2) -------------------------------------------------------------------
// A block reads data through a SCOPE CHAIN rather than a single parent. Each `repeat` that declares
// `as:'row'|'col'|<name>` publishes its current item under that name, so a descendant can see BOTH
// axes at once (`{{row.id}}` and `{{col.date}}`) — which is what makes a grid expressible. `item` is
// always the nearest enclosing row, `record` the bound detail record, `actor` the signed-in user.
const EXPR_RE = /^\{\{\s*([\w.+\- ]+?)\s*\}\}$/

// The clock tokens, mirroring backend/AppBuilder.Definition/ExprTokens.cs — the gate validates that
// grammar, so anything it accepts has to resolve here too:
//   {{today}} {{now}} {{today+7}} {{today-30d}} {{today+2w}} {{now-4h}}
// Units are d/w/h only. There is deliberately NO month unit: JS setMonth overflows (Jan 31 + 1m =
// Mar 3) where .NET AddMonths clamps (Feb 28), so a month offset would filter differently in the
// renderer than in the engine. Weeks are exactly 7 days on both sides.
// `today` is the viewer's LOCAL date — their working day is what "due today" means to them.
const REL_RE = /^(today|now)(?:\s*([+-])\s*(\d{1,4})\s*([dwh])?)?$/
function resolveClock(token) {
  const m = REL_RE.exec(token)
  if (!m) return undefined
  const [, anchor, sign, n, unit] = m
  const d = new Date()
  if (anchor === 'today') d.setHours(0, 0, 0, 0)
  if (sign) {
    const k = (sign === '-' ? -1 : 1) * Number(n)
    if (unit === 'h') d.setHours(d.getHours() + k)
    else if (unit === 'w') d.setDate(d.getDate() + k * 7)
    else d.setDate(d.getDate() + k)
  }
  return anchor === 'today' ? isoDay(d) : d.toISOString()
}

/** Resolve `{{scope.path}}` against the scope chain. Non-expression values pass through unchanged. */
export function resolveExpr(v, scopes) {
  if (typeof v !== 'string') return v
  const m = EXPR_RE.exec(v)
  if (!m) return v
  const token = m[1]
  const clock = resolveClock(token)
  if (clock !== undefined) return clock
  // One user, two spellings: the renderer has always said {{actor.id}} and the engine
  // {{currentUser.id}}. Both mean the signed-in user, so both resolve, everywhere.
  const path = token === 'currentUser.id' ? 'actor.id' : token
  let cur = scopes || {}
  for (const seg of path.split('.')) {
    if (cur == null) return undefined
    cur = cur[seg]
  }
  return cur
}
/** Interpolate every `{{...}}` occurrence inside a string (for labels/templates, not filter values). */
export function interpolate(s, scopes) {
  if (typeof s !== 'string') return s
  return s.replace(/\{\{\s*([\w.+\- ]+?)\s*\}\}/g, (_, path) => {
    const v = resolveExpr(`{{${path}}}`, scopes)
    return v == null ? '' : String(v)
  })
}
/** Filter values may reference the scope chain: {field:'section', operator:'eq', value:'{{row.id}}'} */
export function resolveFilters(filters, scopes) {
  if (!Array.isArray(filters)) return filters
  return filters.map(f => ({ ...f, value: resolveExpr(f.value, scopes) }))
}

// --- axis sources (G1) ---------------------------------------------------------------------
// `repeat` iterates records today, which means a non-record axis (Mon..Sun, a select's options) is
// inexpressible — and with it every 2-D surface. These build the same {id,...} item shape from a
// date range or a select field's options so the SAME repeat engine drives either axis.
const DAY_MS = 86400000
function isoDay(d) { return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10) }

/**
 * {dates:{from,to,step:'day'|'week'|'month',count?}} → [{id,date,next,label,weekday,isWeekend,isToday}]
 *
 * `next` is the start of the FOLLOWING bucket, which is what makes "what falls on this day"
 * expressible at all: `gte {{day.date}}` + `lt {{day.next}}` is the half-open interval. Without it
 * the only thing an author could write was two filters against `{{day.date}}`, which matches
 * nothing — that is the bug that made every cell of the 2026-08-02 MeetingPrep week grid render
 * permanently empty, silently, because emptyText was "".
 *
 * BUCKET SEMANTICS. Buckets are derived from LOCAL calendar dates (isoDay applies the browser's
 * offset) and compared against the stored value as an ordinal string (see matchFilter/cmp), so for
 * a `datetime` field the bucket edges land on UTC instants: a record stored 2026-08-03T23:00:00Z
 * falls in the 2026-08-03 bucket even where that is already the 4th locally. The property this
 * guarantees, and the one that matters, is that the buckets are CONTIGUOUS AND DISJOINT — each
 * bucket's `next` is exactly the following bucket's `date`, so every record lands in exactly one.
 * Tenant timezones are not modelled here; when they are, this is the single place to change.
 */
export function dateAxis(spec, scopes) {
  const step = spec.step || 'day'
  const from = new Date(resolveExpr(spec.from, scopes) ?? Date.now())
  if (isNaN(from.getTime())) return []
  const count = Number(resolveExpr(spec.count, scopes)) || null
  const to = spec.to ? new Date(resolveExpr(spec.to, scopes)) : null
  const bump = d => {
    const n = new Date(d)
    if (step === 'week') n.setDate(n.getDate() + 7)
    else if (step === 'month') {
      // Anchor to the 1st before advancing, then clamp back. Plain setMonth(+1) inherits
      // JavaScript's overflow: Jan 31 becomes Mar 3, so a month axis SKIPS February entirely.
      const day = n.getDate()
      n.setDate(1)
      n.setMonth(n.getMonth() + 1)
      n.setDate(Math.min(day, new Date(n.getFullYear(), n.getMonth() + 1, 0).getDate()))
    }
    else n.setDate(n.getDate() + 1)
    return n
  }
  const out = []
  const today = isoDay(new Date())
  let cur = new Date(from)
  const limit = count ?? 366 // guard: a bad range must not hang the renderer
  while (out.length < limit) {
    if (to && !isNaN(to.getTime()) && cur > to) break
    const id = isoDay(cur)
    const nextCur = bump(cur)
    out.push({
      id, date: id, next: isoDay(nextCur),
      label: cur.toLocaleDateString(currentLocale(), step === 'month' ? { month: 'short', year: 'numeric' } : { weekday: 'short', day: 'numeric' }),
      weekday: cur.toLocaleDateString(currentLocale(), { weekday: 'short' }),
      isWeekend: cur.getDay() === 0 || cur.getDay() === 6,
      isToday: id === today,
    })
    cur = nextCur
    if (!to && !count) break // no end and no count → a single bucket, not an infinite axis
  }
  return out
}
/** {options:{entity,field}} → [{id,value,label,color}] from a select field's declared options. */
export function optionsAxis(manifest, spec) {
  const e = entityOf(manifest, spec.entity)
  const f = fieldMap(e)[spec.field]
  return optionsOf(f).map(o => ({ id: o.value, value: o.value, label: o.label ?? o.value, color: o.color }))
}

// Comparison semantics, deliberately identical to ConditionEvaluator.Compare on the server: numeric
// when BOTH sides are numbers (or numeric strings), ordinal string compare otherwise, and `null` when
// the two aren't comparable at all. The old `Number(v) > Number(val)` made every date comparison
// NaN, so `due_date lt {{today}}` (overdue) silently matched nothing — which is why relative dates
// needed this fixed before they could be worth anything.
const empty = v => v == null || v === '' || (Array.isArray(v) && !v.length)
function cmp(a, b) {
  if (empty(a) || empty(b)) return empty(a) && empty(b) ? 0 : null
  const an = Number(a), bn = Number(b)
  if (typeof a !== 'boolean' && typeof b !== 'boolean' && Number.isFinite(an) && Number.isFinite(bn)) return an - bn
  // Ordinal, not localeCompare — the server compares ordinally and the two must agree on ids.
  const sa = String(a), sb = String(b)
  return sa < sb ? -1 : sa > sb ? 1 : 0
}
const ord = (c, f) => c !== null && f(c)

/**
 * Order rows by an authored `sort` clause ([{field, direction}], first key wins ties downward).
 * Uses the SAME comparison as filters, so "after 2026-01-01" and "sorted by date" agree about what
 * a date is. Empty values sort last in either direction — a blank due date is not "earliest".
 * Returns a new array; an empty/absent clause returns the input untouched.
 */
export function sortRows(rows, sort) {
  if (!Array.isArray(sort) || !sort.length) return rows
  const keys = sort.filter(s => s?.field)
  if (!keys.length) return rows
  return [...rows].sort((ra, rb) => {
    for (const { field, direction } of keys) {
      const a = ra?.[field], b = rb?.[field]
      if (empty(a) || empty(b)) {
        if (empty(a) && empty(b)) continue
        return empty(a) ? 1 : -1          // blanks last, whichever way the column is pointing
      }
      const c = cmp(a, b)
      if (c) return direction === 'desc' ? -c : c
    }
    return 0
  })
}
/** Is `v` inside the inclusive pair `[lo, hi]`? */
function between(v, val) {
  if (!Array.isArray(val) || val.length !== 2) return false
  return ord(cmp(v, val[0]), c => c >= 0) && ord(cmp(v, val[1]), c => c <= 0)
}
/** A bare calendar date (yyyy-MM-dd) rather than an instant — the boundary rule below turns on it. */
const dateOnly = v => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)
/** Does the row's range [start, end] overlap the window [from, to]?
 *  DATE-only endpoints are inclusive (a date is a whole day, so a task ending Monday overlaps a week
 *  starting Monday); anything with a time is half-open (a booking ending at 10:00 does not collide
 *  with one starting at 10:00). Same rule as ConditionEvaluator.Overlaps. */
function overlaps(start, end, val) {
  if (!Array.isArray(val) || val.length !== 2) return false
  if (empty(start) || empty(end) || empty(val[0]) || empty(val[1])) return false
  const startVsTo = cmp(start, val[1]), endVsFrom = cmp(end, val[0])
  if (startVsTo === null || endVsFrom === null) return false
  return [start, end, val[0], val[1]].every(dateOnly)
    ? startVsTo <= 0 && endVsFrom >= 0
    : startVsTo < 0 && endVsFrom > 0
}

/** `row`/`leaf` are only needed by `overlaps`, which reads a SECOND field (`endField`) off the row. */
export function matchFilter(v, op, val, row, leaf) {
  switch (op) {
    // A LIST value on eq/neq is "any of" / "none of" — a multi-select facet writes its selection into
    // an authored `eq` leaf ({{state.status}}), and the leaf has to mean what the picker shows.
    case 'eq': return Array.isArray(val) ? val.some(x => cmp(v, x) === 0) : cmp(v, val) === 0
    case 'neq': return Array.isArray(val) ? !val.some(x => cmp(v, x) === 0) : cmp(v, val) !== 0
    case 'in': return Array.isArray(val) && val.some(x => cmp(v, x) === 0)
    case 'notIn': return !(Array.isArray(val) && val.some(x => cmp(v, x) === 0))
    case 'gt': return ord(cmp(v, val), c => c > 0)
    case 'gte': return ord(cmp(v, val), c => c >= 0)
    case 'lt': return ord(cmp(v, val), c => c < 0)
    case 'lte': return ord(cmp(v, val), c => c <= 0)
    case 'contains': return String(v ?? '').toLowerCase().includes(String(val).toLowerCase())
    case 'isEmpty': return v == null || v === ''
    case 'isNotEmpty': return v != null && v !== ''
    case 'between': return between(v, val)
    case 'overlaps': return leaf?.endField ? overlaps(v, row?.[leaf.endField], val) : false
    default: return true
  }
}
// A filter addresses either a plain `field` on the row, or a dotted `path` that HOPS A RELATION
// ("shift.shift_date" = the date of the shift this assignment points at). Without the hop, a cell can
// only be keyed by fields the row itself carries — so a board of assignments × days is inexpressible,
// because an assignment knows its shift but not its date. `related` maps refField -> {id: record}.
export function getPath(row, path, related) {
  if (!path?.includes('.')) return row?.[path]
  const [ref, ...rest] = path.split('.')
  let cur = related?.[ref]?.[row?.[ref]]
  for (const seg of rest) { if (cur == null) return undefined; cur = cur[seg] }
  return cur
}
/** First segment of every dotted filter path — the reference fields whose targets must be loaded. */
export function filterRefFields(filters) {
  return [...new Set((filters || []).map(f => f.path).filter(p => p?.includes('.')).map(p => p.split('.')[0]))]
}
/** Reference fields a block subtree reads THROUGH via a dotted `field` ("shift.start_time"). The hop a
 *  filter can already make has to be available to leaves too, or a cell can select the right records
 *  but not show anything about them. Recurses the whole subtree, so one load covers every descendant. */
export function pathRefFields(blocks) {
  const out = new Set()
  const walk = bs => {
    for (const b of bs || []) {
      if (typeof b?.field === 'string' && b.field.includes('.')) out.add(b.field.split('.')[0])
      for (const k of ['blocks', 'tabs', 'columns']) {
        const v = b?.[k]
        if (Array.isArray(v)) v.forEach(x => walk(Array.isArray(x) ? x : (x?.blocks ?? [x])))
      }
    }
  }
  walk(blocks)
  return [...out]
}
// An `optional` leaf is SKIPPED when its value is empty (unset) — this is how a page facet ("all
// owners") drops out of the filter set instead of matching only rows whose owner is blank. Combined
// with resolveFilters, an unset `{{state.owner}}` facet simply doesn't filter.
function leafActive(f) {
  if (!f.optional) return true
  const v = f.value
  return !(v == null || v === '' || (Array.isArray(v) && !v.length))
}
export function applyFilters(rows, filters, related) {
  if (!Array.isArray(filters) || !filters.length) return rows
  const active = filters.filter(leafActive)
  if (!active.length) return rows
  return rows.filter(r => active.every(f =>
    matchFilter(getPath(r, f.path ?? f.field, related), f.operator, f.value, r, f)))
}

// Free-text search over rows — the page filter bar's search box, shared by the board and the list so
// one query drives both. Matches `q` (case-insensitive substring) against the named `fields`; a
// reference field resolves through refMaps to its label first (so typing an org name matches the deal).
// No fields → match any string-ish value on the row. Empty query → all rows.
export function searchRows(rows, q, fields, refMaps) {
  const term = String(q ?? '').trim().toLowerCase()
  if (!term) return rows
  const keys = Array.isArray(fields) && fields.length ? fields : null
  const hit = v => v != null && v !== '' && String(v).toLowerCase().includes(term)
  return rows.filter(r => {
    if (keys) return keys.some(k => hit((refMaps?.[k] && refMaps[k][r[k]] != null) ? refMaps[k][r[k]] : r[k]))
    return Object.values(r).some(hit)
  })
}

/** Where clicking a record lands: the app's first non-config page about that entity, else the app
 *  root. With a recordId, the same page's record route (the runtime opens the record detail). Used
 *  for Home widget deep links AND for following a reference into the app that owns the record. */
export function deepLinkFor(manifest, handle, entityKey, recordId) {
  const own = (manifest?.pages || []).find(p => p.entity === entityKey && p.group !== 'config')
  const page = own ?? (manifest?.pages || []).find(p => p.group !== 'config')
  const base = page ? `/a/${handle}/${page.key}` : `/a/${handle}`
  if (!recordId || !page) return base
  // No page is ABOUT this entity, so we landed on the app's first page instead. The runtime reads
  // the record's entity from the page unless the URL says otherwise, and it would fetch the wrong
  // entity — a 404, which it treats as a dead link and bounces back to the list. `?e=` is the same
  // parameter the runtime's own pageUrl writes for a record outside its page's entity.
  return own ? `${base}/${recordId}` : `${base}/${recordId}?e=${encodeURIComponent(entityKey)}`
}
