// SPDX-License-Identifier: Apache-2.0
// Copyright (c) Cordango and contributors.
// Part of Cordango Web Controls, the shared Vue controls for Cordango applications: https://github.com/cordango/web-controls
// Licensed under the Apache License, Version 2.0. See LICENSE in the repository root.
// Extracted from the Cordango platform at web/src/views/dayGrid.test.js. Until web/ consumes this
// package, that copy and this one are two files saying the same thing: check both.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  layoutDay, hourSlots, normalizeAxis, minutesInto, isAllDay, slotAt,
  hhmm, durationLabel, timeOptionsForAxis, endOptionsFrom,
} from './dayGrid.js'
import { packColumns, rangeStart, rangeBuckets, shiftAnchor, rangeLabel, inferRange, isoOf } from './timeRange.js'

const DAY = '2026-09-02'
const AXIS = { startHour: 8, endHour: 18, slotMinutes: 30 }

/** A record with LOCAL wall-clock times — what the browser actually receives once a datetime has
 *  been parsed. Building them as local avoids the test asserting the runner's timezone. */
const at = (h, m = 0) => new Date(2026, 8, 2, h, m).toISOString()
const ev = (h1, m1, h2, m2, extra = {}) => ({ starts_at: at(h1, m1), ends_at: at(h2, m2), ...extra })

const lay = (records, axis = AXIS) =>
  layoutDay(records, { dayIso: DAY, startField: 'starts_at', endField: 'ends_at', axis })

// ---- overlaps go side by side ------------------------------------------------------------------

test('two overlapping meetings share the width and both keep full height', () => {
  const { timed } = lay([ev(10, 0, 11, 0), ev(10, 30, 11, 30)])
  assert.equal(timed.length, 2)
  assert.deepEqual(timed.map(t => t.cols), [2, 2])
  assert.deepEqual(timed.map(t => t.col).sort(), [0, 1])
  // Both are an hour: stacking them would have made one look like a shorter meeting elsewhere.
  assert.equal(timed[0].heightPct, timed[1].heightPct)
})

test('a three-way pile gets three columns', () => {
  const { timed } = lay([ev(9, 0, 10, 0), ev(9, 15, 10, 15), ev(9, 30, 10, 30)])
  assert.deepEqual(timed.map(t => t.cols), [3, 3, 3])
})

test('a later independent meeting is full width, not a third of it', () => {
  // The cluster in the morning must not narrow the afternoon.
  const { timed } = lay([ev(9, 0, 10, 0), ev(9, 15, 10, 15), ev(15, 0, 16, 0)])
  const afternoon = timed.find(t => t.rec.starts_at === at(15))
  assert.equal(afternoon.cols, 1)
  assert.equal(afternoon.col, 0)
})

test('back-to-back meetings do not count as overlapping', () => {
  const { timed } = lay([ev(10, 0, 11, 0), ev(11, 0, 12, 0)])
  assert.deepEqual(timed.map(t => t.cols), [1, 1])
})

// ---- the axis ------------------------------------------------------------------------------------

test('a meeting outside the drawn hours is dropped, one crossing the edge is clipped', () => {
  const { timed } = lay([ev(5, 0, 6, 0), ev(7, 0, 9, 0)])
  assert.equal(timed.length, 1)
  assert.equal(timed[0].clipTop, true)
  assert.equal(timed[0].topPct, 0)          // clipped to the top of the axis, not negative
  assert.ok(timed[0].heightPct > 0)
})

test('positions are percentages of the drawn window, not of the day', () => {
  const { timed } = lay([ev(13, 0, 14, 0)])      // 08:00–18:00 axis → 13:00 is halfway
  assert.equal(Math.round(timed[0].topPct), 50)
  assert.equal(Math.round(timed[0].heightPct), 10)
})

test('an end at or before the start still draws something clickable', () => {
  const { timed } = lay([{ starts_at: at(10), ends_at: at(10) }])
  assert.ok(timed[0].heightPct > 0)
})

test('a missing end field falls back to a readable default', () => {
  const { timed } = layoutDay([{ starts_at: at(10) }],
    { dayIso: DAY, startField: 'starts_at', axis: AXIS })
  assert.ok(timed[0].heightPct > 0)
})

test('an axis that ends before it starts falls back instead of drawing nothing', () => {
  assert.deepEqual(normalizeAxis({ startHour: 18, endHour: 9 }), { startHour: 7, endHour: 21, slotMinutes: 30 })
  assert.deepEqual(normalizeAxis(null), { startHour: 7, endHour: 21, slotMinutes: 30 })
  assert.equal(normalizeAxis({ slotMinutes: 7 }).slotMinutes, 30)
})

test('slots rule the window and only whole hours are labelled', () => {
  const slots = hourSlots({ startHour: 9, endHour: 11, slotMinutes: 30 })
  assert.equal(slots.length, 4)
  assert.deepEqual(slots.map(s => s.label), ['09:00', '', '10:00', ''])
})

// ---- all-day events are dates, not instants -------------------------------------------------------

test('an all-day record never reaches the axis', () => {
  const { timed, allDay } = lay([{ starts_at: '2026-09-02', ends_at: '2026-09-02' }, ev(10, 0, 11, 0)])
  assert.equal(allDay.length, 1)
  assert.equal(timed.length, 1)
})

test('the explicit all-day flag wins over a datetime value', () => {
  // Imported all-day events carry a midnight INSTANT; only the flag tells them apart from a
  // meeting that genuinely starts at midnight.
  assert.equal(isAllDay({ starts_at: at(0), is_all_day: true }, 'starts_at'), true)
  assert.equal(isAllDay({ starts_at: at(0) }, 'starts_at'), false)
})

test('unparseable values are skipped rather than thrown on', () => {
  const { timed } = lay([{ starts_at: 'not a date', ends_at: 'nor this' }, ev(10, 0, 11, 0)])
  assert.equal(timed.length, 1)
})

test('minutes are counted from local midnight of the day being drawn', () => {
  assert.equal(minutesInto(DAY, at(9, 30)), 570)
  assert.equal(minutesInto(DAY, at(0, 0)), 0)
  assert.equal(minutesInto('nonsense', at(9)), null)
})

// ---- the shared windowing gained a 'day' ------------------------------------------------------------

test('a day window is one bucket and steps one day at a time', () => {
  assert.equal(isoOf(rangeStart('day', DAY)), DAY)
  assert.equal(rangeBuckets('day', DAY).length, 1)
  assert.equal(shiftAnchor('day', DAY, 1), '2026-09-03')
  assert.equal(shiftAnchor('day', DAY, -1), '2026-09-01')
})

test('a day label names its weekday', () => {
  // Locale-independent: assert the label CONTAINS the weekday as this runtime spells it, rather
  // than hard-coding English. (The suite runs on a German machine; "Mittwoch" is just as right.)
  const weekday = new Date(2026, 8, 2).toLocaleDateString(undefined, { weekday: 'long' })
  assert.ok(rangeLabel('day', DAY).includes(weekday), `expected the weekday '${weekday}' in the label`)
})

test('an authored one-day axis opens at the day zoom', () => {
  assert.equal(inferRange({ count: 1, step: 'day' }), 'day')
  assert.equal(inferRange({ count: 14, step: 'day' }), 'month')
  assert.equal(inferRange({ range: 'day' }), 'day')
})

// ---- packColumns on its own ---------------------------------------------------------------------

test('packColumns leaves a disjoint set at one column each', () => {
  const items = [{ from: 0, to: 10 }, { from: 20, to: 30 }, { from: 40, to: 50 }]
  packColumns(items)
  assert.deepEqual(items.map(i => i.cols), [1, 1, 1])
})

test('packColumns reuses a column once its previous item has ended', () => {
  // A: 0–10, B: 5–15, C: 11–20 → C fits back in A's column, and the cluster is 2 wide.
  const items = [{ from: 0, to: 10 }, { from: 5, to: 15 }, { from: 11, to: 20 }]
  packColumns(items)
  assert.equal(items[2].col, 0)
  assert.deepEqual(items.map(i => i.cols), [2, 2, 2])
})

// ---- click-to-create geometry ---------------------------------------------------------------------
//
// The maths DayGrid runs on a click, lifted out so it can be asserted without a DOM. Snapping is not
// cosmetic: an appointment at 10:07 is one nobody asked for and everybody has to correct.

test('a click snaps DOWN to its slot, never to a ragged minute', () => {
  const axis = { startHour: 8, endHour: 18, slotMinutes: 30 }
  // Anywhere in the 10:00 band means 10:00.
  assert.equal(slotAt(axis, 0.2), 600)        // exactly 10:00
  assert.equal(slotAt(axis, 0.21), 600)       // 10:06 → still 10:00
  assert.equal(slotAt(axis, 0.26), 630)       // 10:36 → 10:30
})

test('a click is clamped inside the drawn hours', () => {
  const axis = { startHour: 8, endHour: 18, slotMinutes: 30 }
  assert.equal(slotAt(axis, -0.5), 8 * 60)              // above the top
  assert.equal(slotAt(axis, 1.5), 18 * 60 - 30)         // below the bottom: the LAST slot,
  assert.equal(slotAt(axis, 1), 18 * 60 - 30)           // never one starting at the edge
})

test('the slot ruling decides the snap, not a fixed half hour', () => {
  assert.equal(slotAt({ startHour: 9, endHour: 10, slotMinutes: 15 }, 0.3), 9 * 60 + 15)
  assert.equal(slotAt({ startHour: 9, endHour: 11, slotMinutes: 60 }, 0.7), 10 * 60)
})

// ---- the times a quick-add may offer ---------------------------------------------------------------
//
// The rule that matters here is an ASYMMETRY. Starts are bounded by the drawn axis, because a start
// outside it creates an appointment that is invisible on the very surface it was created from. Ends
// are not, because an end past the axis is an ordinary long meeting the grid already draws clipped.

test('start times span the axis and stop one slot before its end', () => {
  const opts = timeOptionsForAxis(AXIS)                      // 08:00–18:00, 30 min
  assert.equal(opts[0].label, '08:00')
  assert.equal(opts.at(-1).label, '17:30')
  assert.equal(opts.length, 20)
})

test('a start outside the drawn hours is never OFFERED, but a chosen one is kept', () => {
  const plain = timeOptionsForAxis(AXIS)
  assert.ok(!plain.some(o => o.minutes === 3 * 60), 'nothing should offer 03:00 on an 08–18 axis')

  const kept = timeOptionsForAxis(AXIS, { include: 3 * 60 })
  assert.equal(kept[0].label, '03:00', 'the time already chosen has to stay selectable, and in order')
  assert.equal(kept.length, plain.length + 1)
})

test('a clicked time that is already on the grid does not appear twice', () => {
  assert.equal(timeOptionsForAxis(AXIS, { include: 10 * 60 }).filter(o => o.minutes === 600).length, 1)
})

test('end times start one slot after the start and carry how long that makes it', () => {
  const ends = endOptionsFrom(AXIS, 12 * 60)
  assert.equal(ends[0].label, '12:30 (30 min)')
  assert.equal(ends[1].label, '13:00 (1 h)')
  assert.equal(ends[3].label, '14:00 (2 h)')
  assert.ok(ends.every(e => e.minutes > 12 * 60), 'an end at or before the start is not an end')
})

test('a mixed duration reads the way a person says it', () => {
  assert.equal(durationLabel(30), '30 min')
  assert.equal(durationLabel(60), '1 h')
  assert.equal(durationLabel(90), '1 h 30 min')
})

test('ends run past the drawn hours — a long meeting is clipped, not forbidden', () => {
  const ends = endOptionsFrom(AXIS, 17 * 60)               // axis ends 18:00
  assert.ok(ends.some(e => e.minutes === 20 * 60), 'a 17:00 start must be able to run to 20:00')
})

test('ends never cross midnight', () => {
  const ends = endOptionsFrom(AXIS, 23 * 60)
  assert.equal(ends.at(-1).minutes, 24 * 60)
  assert.equal(ends.at(-1).label, '24:00 (1 h)')
})

test('moving the start past a chosen end drops it rather than offering an end before the start', () => {
  const ends = endOptionsFrom(AXIS, 15 * 60, { include: 13 * 60 })
  assert.ok(!ends.some(e => e.minutes === 13 * 60))
})

test('an end that no longer sits on the grid stays selectable', () => {
  const ends = endOptionsFrom(AXIS, 12 * 60, { include: 12 * 60 + 37 })
  const odd = ends.find(e => e.minutes === 12 * 60 + 37)
  assert.equal(odd.label, '12:37 (37 min)')
  assert.ok(ends.findIndex(e => e === odd) === 1, 'and in its right place in the order')
})

test('midnight reads as 24:00 at the end of a day, not 00:00', () => {
  assert.equal(hhmm(0), '00:00')
  assert.equal(hhmm(24 * 60), '24:00')
  assert.equal(hhmm(9 * 60 + 5), '09:05')
})
