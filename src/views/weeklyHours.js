// SPDX-License-Identifier: Apache-2.0
// Copyright (c) Cordango and contributors.
// Part of Cordango Web Controls, the shared Vue controls for Cordango applications: https://github.com/cordango/web-controls
// Licensed under the Apache License, Version 2.0. See LICENSE in the repository root.
// Extracted from the Cordango platform at web/src/views/weeklyHours.js. Until web/ consumes this
// package, that copy and this one are two files saying the same thing: check both.

// Opening hours as data — the pure half of the `weeklyHours` input.
//
// The shape is the one AvailabilityService parses, and the two must not drift, so it is written down
// here once:
//
//   { "weekly":     { "mon": [["09:00","17:00"], ["18:00","20:00"]], ... },
//     "exceptions": [ { "date": "2026-12-24", "windows": [] } ] }
//
// An exception with an EMPTY windows list is the point of exceptions: it means closed that day, which
// is a different statement from "no exception recorded" and the reason this cannot just be a list of
// extra windows.
//
// Times are "HH:mm" strings rather than a platform field type, deliberately: a slot rule is not worth
// a column type, and "09:00" stays legible to anyone reading the stored blob.
//
// No DOM, no data.js — tested under `node --test`.

/** Monday-first, because a working week starts on Monday everywhere this ships. */
export const DAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']

/** The weekday's name in the reader's own language. Derived, not a hard-coded English list: a German
 *  workspace must not read "Mon". 2024-01-01 was a Monday. */
export function dayLabel (key, locale) {
  const i = DAY_KEYS.indexOf(key)
  if (i < 0) return key
  return new Date(2024, 0, 1 + i).toLocaleDateString(locale, { weekday: 'long' })
}

const CLOCK = /^([01]\d|2[0-3]):([0-5]\d)$/

export const isClock = (s) => CLOCK.test(String(s ?? ''))
export const toMinutes = (s) => (isClock(s) ? +s.slice(0, 2) * 60 + +s.slice(3, 5) : null)
export const fromMinutes = (m) => {
  const v = Math.max(0, Math.min(24 * 60 - 1, Math.round(m)))
  return `${String(Math.floor(v / 60)).padStart(2, '0')}:${String(v % 60).padStart(2, '0')}`
}

/** A window is only a window if it is a real span. Anything else is dropped rather than stored as a
 *  rule that can never match — an author who typed 17:00–09:00 gets an empty day they can SEE. */
const validWindow = (w) =>
  Array.isArray(w) && isClock(w[0]) && isClock(w[1]) && toMinutes(w[1]) > toMinutes(w[0])

/**
 * Whatever is stored → the editor's state.
 *
 * Tolerant on purpose: the value may be a parsed object (jsonb round-trips as one), a JSON string
 * (what the old one-line text box produced), null, or something malformed a person typed. None of
 * those may throw — this runs while a form is opening.
 */
export function parseAvailability (value) {
  let raw = value
  if (typeof raw === 'string') { try { raw = JSON.parse(raw) } catch { raw = null } }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) raw = {}

  const weekly = {}
  for (const key of DAY_KEYS) {
    const list = Array.isArray(raw.weekly?.[key]) ? raw.weekly[key] : []
    weekly[key] = list.filter(validWindow).map(w => [w[0], w[1]])
  }

  const exceptions = (Array.isArray(raw.exceptions) ? raw.exceptions : [])
    .filter(e => e && /^\d{4}-\d{2}-\d{2}$/.test(String(e.date ?? '')))
    .map(e => ({
      date: e.date,
      windows: (Array.isArray(e.windows) ? e.windows : []).filter(validWindow).map(w => [w[0], w[1]]),
    }))

  return { weekly, exceptions }
}

/**
 * The editor's state → what gets stored.
 *
 * Days with no windows are OMITTED rather than written as empty arrays. The parser reads "no key" and
 * "empty list" the same way for a weekday, so an empty key is noise; an exception's empty list is the
 * opposite and is always kept.
 */
export function serializeAvailability (state) {
  const weekly = {}
  for (const key of DAY_KEYS) {
    const windows = (state?.weekly?.[key] || []).filter(validWindow)
    if (windows.length) weekly[key] = windows.map(w => [w[0], w[1]])
  }
  const exceptions = (state?.exceptions || [])
    .filter(e => /^\d{4}-\d{2}-\d{2}$/.test(String(e?.date ?? '')))
    .map(e => ({ date: e.date, windows: (e.windows || []).filter(validWindow).map(w => [w[0], w[1]]) }))
    .sort((a, b) => a.date.localeCompare(b.date))

  return { weekly, exceptions }
}

/** Mon–Fri, 09:00–17:00. What a page opens with when nobody has said anything: a booking page that
 *  offers NOTHING reads as broken, and this is the same default the server falls back to. */
export function defaultAvailability () {
  const weekly = {}
  for (const key of DAY_KEYS) weekly[key] = ['sat', 'sun'].includes(key) ? [] : [['09:00', '17:00']]
  return { weekly, exceptions: [] }
}

/** Is anything bookable at all? Drives the warning — a page with every day off takes bookings from
 *  nobody, and that is worth saying out loud before it is published. */
export const isEmpty = (state) =>
  DAY_KEYS.every(k => !(state?.weekly?.[k] || []).length)

/**
 * A window added to a day, placed so it does not collide.
 *
 * After the last one with an hour's gap where that fits, else the standard morning window. Guessing
 * a sensible next range beats making somebody fix 00:00–00:00 every time they click Add.
 */
export function nextWindow (windows) {
  const last = (windows || []).filter(validWindow).at(-1)
  if (!last) return ['09:00', '17:00']
  const from = toMinutes(last[1]) + 60
  if (from + 60 > 24 * 60) return null          // no room left today
  return [fromMinutes(from), fromMinutes(Math.min(from + 60, 24 * 60 - 1))]
}

/**
 * Windows overlapping each other on one day, as a set of indexes.
 *
 * Not repaired automatically — two overlapping windows are somebody mid-edit, and silently merging
 * them would rewrite what they typed while they are still typing. Flagged, not fixed.
 */
export function overlapping (windows) {
  const bad = new Set()
  const list = (windows || []).map((w, i) => ({ i, w })).filter(x => validWindow(x.w))
  for (let a = 0; a < list.length; a++)
    for (let b = a + 1; b < list.length; b++) {
      const [x, y] = [list[a], list[b]]
      if (toMinutes(x.w[0]) < toMinutes(y.w[1]) && toMinutes(y.w[0]) < toMinutes(x.w[1])) {
        bad.add(x.i); bad.add(y.i)
      }
    }
  return bad
}
