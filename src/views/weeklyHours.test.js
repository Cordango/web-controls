// SPDX-License-Identifier: Apache-2.0
// Copyright (c) Cordango and contributors.
// Part of Cordango Web Controls, the shared Vue controls for Cordango applications: https://github.com/cordango/web-controls
// Licensed under the Apache License, Version 2.0. See LICENSE in the repository root.
// Extracted from the Cordango platform at web/src/views/weeklyHours.test.js. Until web/ consumes this
// package, that copy and this one are two files saying the same thing: check both.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  DAY_KEYS, dayLabel, parseAvailability, serializeAvailability, defaultAvailability,
  isEmpty, nextWindow, overlapping, isClock, toMinutes, fromMinutes,
} from './weeklyHours.js'

const STORED = {
  weekly: { mon: [['09:00', '12:00'], ['13:00', '17:00']], fri: [['09:00', '13:00']] },
  exceptions: [{ date: '2026-12-24', windows: [] }],
}

// ---- the round trip ------------------------------------------------------------------------------
//
// This is the contract with AvailabilityService.Parse. If the two ever disagree, a page silently
// offers the wrong hours — and it offers them to strangers, on a public link nobody here is watching.

test('what is stored round-trips unchanged', () => {
  assert.deepEqual(serializeAvailability(parseAvailability(STORED)), STORED)
})

test('a JSON string parses the same as an object — the old text box wrote strings', () => {
  assert.deepEqual(parseAvailability(JSON.stringify(STORED)), parseAvailability(STORED))
})

test('nothing, junk and the wrong shape all open as an empty week rather than throwing', () => {
  for (const junk of [null, undefined, '', 'not json', '[]', 42, [], { weekly: 'nope' }]) {
    const s = parseAvailability(junk)
    assert.deepEqual(Object.keys(s.weekly), DAY_KEYS)
    assert.equal(isEmpty(s), true)
    assert.deepEqual(s.exceptions, [])
  }
})

test('every weekday has a key after parsing, so the editor draws seven rows', () => {
  assert.deepEqual(Object.keys(parseAvailability({ weekly: { mon: [['09:00', '17:00']] } }).weekly), DAY_KEYS)
})

// ---- what counts as a window ---------------------------------------------------------------------

test('a window that ends before it starts is dropped, not stored as a rule that never matches', () => {
  const s = parseAvailability({ weekly: { mon: [['17:00', '09:00']] } })
  assert.deepEqual(s.weekly.mon, [])
})

test('a zero-length window is not a window', () => {
  assert.deepEqual(parseAvailability({ weekly: { mon: [['09:00', '09:00']] } }).weekly.mon, [])
})

test('malformed clock strings are dropped', () => {
  const s = parseAvailability({ weekly: { mon: [['9:00', '17:00'], ['25:00', '26:00'], ['09:00', '17:00']] } })
  assert.deepEqual(s.weekly.mon, [['09:00', '17:00']])
})

test('a clock is two digits, both halves, 24-hour', () => {
  for (const ok of ['00:00', '09:05', '23:59']) assert.equal(isClock(ok), true, ok)
  for (const no of ['9:00', '24:00', '23:60', '', '0900', null]) assert.equal(isClock(no), false, String(no))
})

test('minutes convert both ways', () => {
  assert.equal(toMinutes('09:30'), 570)
  assert.equal(fromMinutes(570), '09:30')
  assert.equal(fromMinutes(0), '00:00')
  assert.equal(fromMinutes(24 * 60), '23:59', 'clamped inside the day rather than rolling over')
})

// ---- exceptions ----------------------------------------------------------------------------------

test('an exception with NO windows survives — that is what "closed" is', () => {
  const s = serializeAvailability(parseAvailability({ exceptions: [{ date: '2026-12-24', windows: [] }] }))
  assert.deepEqual(s.exceptions, [{ date: '2026-12-24', windows: [] }])
})

test('a weekday with no windows is omitted — for a DAY, absent and empty mean the same thing', () => {
  const s = serializeAvailability({ weekly: { mon: [], tue: [['09:00', '17:00']] }, exceptions: [] })
  assert.deepEqual(Object.keys(s.weekly), ['tue'])
})

test('an exception without a real date is dropped', () => {
  for (const date of ['24.12.2026', 'soon', '', null])
    assert.deepEqual(parseAvailability({ exceptions: [{ date, windows: [] }] }).exceptions, [])
})

test('exceptions come back in date order however they were entered', () => {
  const s = serializeAvailability({
    weekly: {},
    exceptions: [{ date: '2026-12-31', windows: [] }, { date: '2026-01-02', windows: [] }],
  })
  assert.deepEqual(s.exceptions.map(e => e.date), ['2026-01-02', '2026-12-31'])
})

// ---- the affordances -----------------------------------------------------------------------------

test('the default is a working week, because a page that offers nothing reads as broken', () => {
  const d = defaultAvailability()
  assert.deepEqual(d.weekly.mon, [['09:00', '17:00']])
  assert.deepEqual(d.weekly.sat, [])
  assert.equal(isEmpty(d), false)
})

test('a week with no hours anywhere is reported empty so it can be warned about', () => {
  assert.equal(isEmpty(parseAvailability(null)), true)
  assert.equal(isEmpty({ weekly: { mon: [['09:00', '17:00']] } }), false)
})

test('Add on an empty day offers a working day, not 00:00–00:00', () => {
  assert.deepEqual(nextWindow([]), ['09:00', '17:00'])
})

test('Add after an existing window leaves an hour and does not collide', () => {
  assert.deepEqual(nextWindow([['09:00', '12:00']]), ['13:00', '14:00'])
})

test('Add returns nothing when the day has no room left', () => {
  assert.equal(nextWindow([['09:00', '23:30']]), null)
})

test('overlapping windows are flagged, both of them, and never silently merged', () => {
  // Silently merging would rewrite what somebody is still typing.
  assert.deepEqual([...overlapping([['09:00', '12:00'], ['11:00', '13:00']])], [0, 1])
  assert.deepEqual([...overlapping([['09:00', '12:00'], ['12:00', '13:00']])], [], 'touching is not overlapping')
  assert.deepEqual([...overlapping([['09:00', '12:00'], ['13:00', '14:00']])], [])
})

// ---- labels --------------------------------------------------------------------------------------

test('weekday names come from the reader locale, never a hard-coded English list', () => {
  assert.equal(dayLabel('mon', 'en-GB'), 'Monday')
  assert.equal(dayLabel('mon', 'de-DE'), 'Montag')
  assert.equal(dayLabel('sun', 'de-DE'), 'Sonntag')
})

test('the week starts on Monday', () => {
  assert.equal(DAY_KEYS[0], 'mon')
  assert.equal(DAY_KEYS.at(-1), 'sun')
})
