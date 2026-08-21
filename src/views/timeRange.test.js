// SPDX-License-Identifier: Apache-2.0
// Copyright (c) Cordango and contributors.
// Part of Cordango Web Controls, the shared Vue controls for Cordango applications: https://github.com/cordango/web-controls
// Licensed under the Apache License, Version 2.0. See LICENSE in the repository root.
// Extracted from the Cordango platform at web/src/views/timeRange.test.js. Until web/ consumes this
// package, that copy and this one are two files saying the same thing: check both.

import test from 'node:test'
import assert from 'node:assert/strict'
import { rangeStart, rangeBuckets, shiftAnchor, inferRange, spanIn, packRows, isoOf, dayNum } from './timeRange.js'

// Run with `npm test` in web/ (node --test). timeRange.js is pure date maths with no imports, which
// is the reason the window logic lives outside the components at all.

test('a week window is Monday..Sunday around the anchor', () => {
  // 2026-08-06 is a Thursday.
  const b = rangeBuckets('week', '2026-08-06', '2026-08-06')
  assert.equal(b.length, 7)
  assert.equal(b[0].date, '2026-08-03')
  assert.equal(b[6].date, '2026-08-09')
  assert.deepEqual(b.filter(x => x.isWeekend).map(x => x.date), ['2026-08-08', '2026-08-09'])
  assert.deepEqual(b.filter(x => x.isToday).map(x => x.date), ['2026-08-06'])
})

test('a Sunday anchor stays in the week it ends, not the one it starts', () => {
  assert.equal(isoOf(rangeStart('week', '2026-08-09')), '2026-08-03')
})

test('a month window is that calendar month, February included', () => {
  assert.equal(rangeBuckets('month', '2026-02-17').length, 28)
  assert.equal(rangeBuckets('month', '2028-02-17').length, 29)   // leap
  const aug = rangeBuckets('month', '2026-08-06')
  assert.equal(aug.length, 31)
  assert.equal(aug[0].date, '2026-08-01')
  assert.equal(aug[30].next, '2026-09-01')
})

test('a year window is 12 month buckets', () => {
  const b = rangeBuckets('year', '2026-08-06', '2026-08-06')
  assert.equal(b.length, 12)
  assert.equal(b[0].date, '2026-01-01')
  assert.equal(b[11].next, '2027-01-01')
  assert.deepEqual(b.filter(x => x.isCurrent).map(x => x.date), ['2026-08-01'])
  assert.equal(b.some(x => x.isToday), false)   // no single day of a month bucket is "today"
})

test('buckets are contiguous and disjoint in every range', () => {
  for (const range of ['week', 'month', 'year']) {
    const b = rangeBuckets(range, '2026-01-31')
    for (let i = 0; i < b.length - 1; i++)
      assert.equal(b[i].next, b[i + 1].date, `${range} bucket ${i} does not meet the next`)
  }
})

test('stepping moves exactly one whole window and stays snapped', () => {
  assert.equal(shiftAnchor('week', '2026-08-06', 1), '2026-08-10')
  assert.equal(shiftAnchor('week', '2026-08-06', -1), '2026-07-27')
  assert.equal(shiftAnchor('month', '2026-08-06', 1), '2026-09-01')
  assert.equal(shiftAnchor('month', '2026-01-31', 1), '2026-02-01')   // no Jan 31 → Mar 3 overflow
  assert.equal(shiftAnchor('month', '2026-01-15', -1), '2025-12-01')
  assert.equal(shiftAnchor('year', '2026-08-06', 1), '2027-01-01')
})

test('the opening range is read off the authored axis', () => {
  assert.equal(inferRange({ range: 'year', count: 7 }), 'year')     // explicit wins
  assert.equal(inferRange({ count: 7, step: 'day' }), 'week')
  assert.equal(inferRange({ count: 14, step: 'day' }), 'month')
  assert.equal(inferRange({ count: 90, step: 'day' }), 'year')
  assert.equal(inferRange({ count: 12, step: 'month' }), 'year')
  assert.equal(inferRange(undefined), 'month')
})

test('a bar spans whole day columns in a day-bucketed window', () => {
  const week = rangeBuckets('week', '2026-08-06')       // Mon 2026-08-03 .. Sun 2026-08-09
  const s = spanIn(week, '2026-08-05', '2026-08-06')
  assert.equal(s.leftPct, (2 / 7) * 100)
  assert.equal(s.widthPct, (2 / 7) * 100)               // inclusive end → two whole days
  assert.equal(s.clipL, false)
  assert.equal(s.clipR, false)
})

test('a single-day record still gets one column of width', () => {
  const week = rangeBuckets('week', '2026-08-06')
  assert.equal(spanIn(week, '2026-08-03', null).widthPct, (1 / 7) * 100)
  assert.equal(spanIn(week, '2026-08-03').widthPct, (1 / 7) * 100)
})

test('a record reaching past the window is clipped, not dropped', () => {
  const week = rangeBuckets('week', '2026-08-06')
  const s = spanIn(week, '2026-07-30', '2026-08-20')
  assert.equal(s.leftPct, 0)
  assert.equal(s.widthPct, 100)
  assert.equal(s.clipL, true)
  assert.equal(s.clipR, true)
})

test('a record entirely outside the window is dropped', () => {
  const week = rangeBuckets('week', '2026-08-06')
  assert.equal(spanIn(week, '2026-07-01', '2026-07-02'), null)
  assert.equal(spanIn(week, '2026-09-01', '2026-09-02'), null)
  assert.equal(spanIn(week, null, null), null)
})

test('a bar inside a MONTH bucket is a fraction of that column', () => {
  // The year window is why spanIn works in fractional bucket indices: 3 days of August is a tenth
  // of the August column, not the whole of it.
  const year = rangeBuckets('year', '2026-08-06')
  const s = spanIn(year, '2026-08-01', '2026-08-03')
  assert.equal(s.leftPct, (7 / 12) * 100)                       // August is the 8th column
  assert.ok(Math.abs(s.widthPct - (3 / 31 / 12) * 100) < 1e-9)  // 3 of August's 31 days
})

test('a bar crossing month buckets keeps its proportions', () => {
  const year = rangeBuckets('year', '2026-01-01')
  const s = spanIn(year, '2026-01-16', '2026-02-15')
  const expectLeft = (0 + 15 / 31) / 12 * 100
  const expectRight = (1 + 15 / 28) / 12 * 100
  assert.ok(Math.abs(s.leftPct - expectLeft) < 1e-9)
  assert.ok(Math.abs(s.leftPct + s.widthPct - expectRight) < 1e-9)
})

test('overlapping bars stack, touching bars share a row', () => {
  const bars = [
    { leftPct: 0, widthPct: 20 },
    { leftPct: 10, widthPct: 20 },   // overlaps the first → row 1
    { leftPct: 20, widthPct: 10 },   // starts where the first ended → back on row 0
    { leftPct: 40, widthPct: 10 },
  ]
  assert.equal(packRows(bars), 2)
  assert.deepEqual(bars.map(b => b.row), [0, 1, 0, 0])
})

test('packing is order-independent and never returns zero rows', () => {
  const bars = [{ leftPct: 50, widthPct: 10 }, { leftPct: 0, widthPct: 10 }]
  assert.equal(packRows(bars), 1)
  assert.deepEqual(bars.map(b => b.row), [0, 0])
  assert.equal(packRows([]), 1)
})

test('day ordinals are DST-proof', () => {
  // A local-midnight subtraction across a DST boundary yields 23 or 25 hours and would shift a bar
  // by a fraction of a column; the ordinals must differ by exactly the number of calendar days.
  assert.equal(dayNum('2026-03-30') - dayNum('2026-03-28'), 2)
  assert.equal(dayNum('2026-10-26') - dayNum('2026-10-24'), 2)
})

test('a datetime value is placed on its calendar day', () => {
  const week = rangeBuckets('week', '2026-08-06')
  assert.deepEqual(spanIn(week, '2026-08-05T13:45:00Z'), spanIn(week, '2026-08-05'))
})
