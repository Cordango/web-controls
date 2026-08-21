// SPDX-License-Identifier: Apache-2.0
// Copyright (c) Cordango and contributors.
// Part of Cordango Web Controls, the shared Vue controls for Cordango applications: https://github.com/cordango/web-controls
// Licensed under the Apache License, Version 2.0. See LICENSE in the repository root.
// Extracted from the Cordango platform at web/src/views/dayGrid.js. Until web/ consumes this
// package, that copy and this one are two files saying the same thing: check both.

// Placing records on an HOUR axis: the maths behind the day view, with no DOM in it.
//
// The month grid asks "which day?" and stops. A schedule asks "which day, at what time, for how
// long, and what else is happening then" — four questions the existing windowing does not answer,
// which is why this is its own module rather than more branches inside CalendarView.
//
// Two things here are easy to get wrong and both have a visible failure:
//
//   ALL-DAY EVENTS ARE DATES, NOT INSTANTS. A holiday on the 24th is the 24th everywhere; putting
//   it through a timezone conversion is exactly how it lands on the 23rd for anyone west of the
//   organizer. So all-day records never touch the axis — they go in a header strip, keyed by their
//   date string alone.
//
//   OVERLAPS GO SIDE BY SIDE, NOT STACKED. Two ten-o'clock meetings are both an hour tall; stacking
//   them would draw one as a short meeting at a time it does not happen. That is `packColumns`.

import { packColumns } from './timeRange.js'

export const DEFAULT_AXIS = { startHour: 7, endHour: 21, slotMinutes: 30 }

/** Clamp an authored axis into something drawable. An axis that ends before it starts has no height
 *  to draw into, so it falls back rather than producing an invisible surface. */
export function normalizeAxis (axis) {
  const a = { ...DEFAULT_AXIS, ...(axis || {}) }
  let startHour = Number.isFinite(+a.startHour) ? Math.min(23, Math.max(0, Math.trunc(+a.startHour))) : DEFAULT_AXIS.startHour
  let endHour = Number.isFinite(+a.endHour) ? Math.min(24, Math.max(1, Math.trunc(+a.endHour))) : DEFAULT_AXIS.endHour
  if (endHour <= startHour) { startHour = DEFAULT_AXIS.startHour; endHour = DEFAULT_AXIS.endHour }
  const slotMinutes = [15, 30, 60].includes(+a.slotMinutes) ? +a.slotMinutes : DEFAULT_AXIS.slotMinutes
  return { startHour, endHour, slotMinutes }
}

/** The ruled lines: one entry per slot, with the hour labelled only on its first slot. */
export function hourSlots (axis) {
  const { startHour, endHour, slotMinutes } = normalizeAxis(axis)
  const out = []
  for (let m = startHour * 60; m < endHour * 60; m += slotMinutes) {
    const h = Math.floor(m / 60)
    const min = m % 60
    out.push({
      minutes: m,
      isHour: min === 0,
      label: min === 0 ? `${String(h).padStart(2, '0')}:00` : '',
    })
  }
  return out
}

/** 'HH:MM' from minutes since midnight. 1440 reads as 24:00 — the end of this day, which is a real
 *  thing to pick and is not the same sentence as 00:00. */
export function hhmm (minutes) {
  const m = Math.max(0, Math.round(minutes))
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
}

/** "30 min", "1 h", "1 h 30 min" — how long, said the way a person says it. */
export function durationLabel (minutes) {
  const m = Math.max(0, Math.round(minutes))
  const h = Math.floor(m / 60)
  const rest = m % 60
  if (!h) return `${rest} min`
  return rest ? `${h} h ${rest} min` : `${h} h`
}

/**
 * The START times a quick-add may offer, `[{ minutes, label }]`.
 *
 * Bounded by the AXIS, not by the day. Forty-eight options on a surface drawn 07:00–21:00 means you
 * can pick 03:00 and create an appointment that is invisible on the very grid you created it from.
 * `include` (the minute the user actually clicked) is added when it falls outside, because the one
 * time that must always be offered is the one already chosen.
 */
export function timeOptionsForAxis (axis, { include } = {}) {
  const a = normalizeAxis(axis)
  const out = []
  for (let m = a.startHour * 60; m <= a.endHour * 60 - a.slotMinutes; m += a.slotMinutes)
    out.push({ minutes: m, label: hhmm(m) })
  return withInclude(out, include)
}

/**
 * The END times for a given start, `[{ minutes, label }]`, each labelled with how long that makes it.
 *
 * Deliberately NOT bounded by the axis, unlike the starts — the asymmetry is the point. A start
 * outside the drawn hours creates something nobody can see; an end past them is an ordinary long
 * meeting, which the grid already draws clipped with a flat edge. Ends run one slot to `hours` past
 * the start, and never past the end of the day: a quick dialog schedules an appointment, and a
 * multi-day one is what the full form is for.
 */
export function endOptionsFrom (axis, startMinutes, { include, hours = 12 } = {}) {
  const a = normalizeAxis(axis)
  const start = Number.isFinite(+startMinutes) ? +startMinutes : a.startHour * 60
  const last = Math.min(start + hours * 60, 24 * 60)
  const at = m => ({ minutes: m, label: `${hhmm(m)} (${durationLabel(m - start)})` })

  const out = []
  for (let m = start + a.slotMinutes; m <= last; m += a.slotMinutes) out.push(at(m))
  // An end that no longer fits the rule still has to be selectable, or moving the start silently
  // rewrites an end somebody chose.
  const keep = +include
  if (Number.isFinite(keep) && keep > start && !out.some(o => o.minutes === keep))
    return [...out, at(keep)].sort((x, y) => x.minutes - y.minutes)
  return out
}

function withInclude (options, include) {
  if (!Number.isFinite(+include) || options.some(o => o.minutes === +include)) return options
  return [...options, { minutes: +include, label: hhmm(+include) }].sort((x, y) => x.minutes - y.minutes)
}

/**
 * Minutes since local midnight of `dayIso` for an instant, or null when it is not a real instant.
 * May be negative (yesterday) or past 1440 (tomorrow) — the caller clips; that is what lets a
 * meeting running from 23:00 to 01:00 still draw its visible half.
 */
export function minutesInto (dayIso, value) {
  const t = new Date(value)
  if (isNaN(t.getTime())) return null
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(dayIso ?? ''))
  if (!m) return null
  const midnight = new Date(+m[1], +m[2] - 1, +m[3])
  return (t.getTime() - midnight.getTime()) / 60000
}

/**
 * A click's vertical position on the track → minutes since midnight.
 *
 * Snapped DOWN to the slot ruling and clamped inside the drawn hours. Snapping is not cosmetic: an
 * appointment created at 10:07 is one nobody asked for and everybody has to correct. Clamped to the
 * last slot's START, so a click at the very bottom creates something that fits rather than one
 * beginning where the axis ends.
 *
 * Here rather than in the component so it can be asserted without a DOM — and so the test is
 * checking THIS, not a copy of it that stays green while the component drifts.
 */
export function slotAt (axis, fraction) {
  const a = normalizeAxis(axis)
  const spanMin = (a.endHour - a.startHour) * 60
  const raw = a.startHour * 60 + fraction * spanMin
  const snapped = Math.floor(raw / a.slotMinutes) * a.slotMinutes
  return Math.min(Math.max(snapped, a.startHour * 60), a.endHour * 60 - a.slotMinutes)
}

/** The field an all-day entry is flagged with. A platform convention rather than one app's field
 *  name — the layout reads it here and the quick-add writes it, and a literal in two places is how
 *  they end up disagreeing about which entries belong on the axis. */
export const ALL_DAY_FIELD = 'is_all_day'

/** Is this record an all-day one? Explicit flag first; otherwise a date-only start (no time part). */
export function isAllDay (rec, startField) {
  if (rec?.[ALL_DAY_FIELD] === true) return true
  const v = rec?.[startField]
  return typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)
}

/**
 * Lay a day's records onto the axis.
 *
 * Returns `{ timed, allDay }`. Each timed entry carries `topPct`/`heightPct` (of the axis) and
 * `col`/`cols` (its share of the width), plus `clipTop`/`clipBottom` when it runs past the drawn
 * hours — a flat edge is how a surface admits it is not showing the whole thing.
 */
export function layoutDay (records, { dayIso, startField, endField, axis, defaultMinutes = 30 }) {
  const ax = normalizeAxis(axis)
  const from = ax.startHour * 60
  const to = ax.endHour * 60
  const span = to - from

  const allDay = []
  const timed = []

  for (const rec of records || []) {
    if (isAllDay(rec, startField)) { allDay.push({ rec }); continue }

    const s = minutesInto(dayIso, rec?.[startField])
    if (s == null) continue
    // No end field, or an end at or before the start (bad data, or a zero-length marker): give it a
    // readable default rather than a zero-height sliver nobody can click.
    const rawEnd = endField ? minutesInto(dayIso, rec?.[endField]) : null
    const e = rawEnd != null && rawEnd > s ? rawEnd : s + defaultMinutes

    if (e <= from || s >= to) continue                 // entirely outside the drawn hours
    timed.push({ rec, from: Math.max(s, from), to: Math.min(e, to), clipTop: s < from, clipBottom: e > to })
  }

  packColumns(timed)
  for (const t of timed) {
    t.topPct = ((t.from - from) / span) * 100
    t.heightPct = ((t.to - t.from) / span) * 100
  }
  return { timed, allDay }
}
