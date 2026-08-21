// SPDX-License-Identifier: Apache-2.0
// Copyright (c) Cordango and contributors.
// Part of Cordango Web Controls, the shared Vue controls for Cordango applications: https://github.com/cordango/web-controls
// Licensed under the Apache License, Version 2.0. See LICENSE in the repository root.
// Extracted from the Cordango platform at web/src/views/inlineCreate.test.js. Until web/ consumes this
// package, that copy and this one are two files saying the same thing: check both.

import test from 'node:test'
import assert from 'node:assert/strict'
import { newRowDefaults, newRowWouldSurvive } from './inlineCreate.js'

// The four screens that prompted this, as they are actually filtered.
const MY_DAY = [{ field: 'my_day', operator: 'eq', value: true }]
const IMPORTANT = [{ field: 'important', operator: 'eq', value: true }]
const TODAY = [{ field: 'due_on', operator: 'lte', value: '{{today}}' }]
const UPCOMING = [{ field: 'due_on', operator: 'gt', value: '{{today}}' }]

test('an eq filter becomes a default, the way `via` gives a child its parent', () => {
  assert.deepEqual(newRowDefaults(MY_DAY, null, {}), { my_day: true })
  assert.deepEqual(newRowDefaults(IMPORTANT, null, {}), { important: true })
})

test('a comparison implies nothing — it says which rows to show, not what a new one should be', () => {
  assert.deepEqual(newRowDefaults(TODAY, null, {}), {})
  assert.deepEqual(newRowDefaults(UPCOMING, null, {}), {})
})

test('authored defaults cover what a filter cannot imply, and win over inference', () => {
  // A Today list: the `lte` filter cannot produce a value, so the author states one.
  const today = newRowDefaults(TODAY, { due_on: '{{today}}' }, {})
  assert.equal(typeof today.due_on, 'string')
  assert.match(today.due_on, /^\d{4}-\d{2}-\d{2}$/)

  // Explicit beats inferred where both speak.
  assert.deepEqual(newRowDefaults(MY_DAY, { my_day: false }, {}), { my_day: false })
})

test('a filter through a reference is skipped — setting it would mean creating another record', () => {
  const filters = [{ path: 'list.owner', operator: 'eq', value: 'u1' }]
  assert.deepEqual(newRowDefaults(filters, null, {}), {})
})

// --- the property that makes the affordance honest -----------------------------------------------

test('a row that would match its own filters is allowed', () => {
  const defaults = newRowDefaults(MY_DAY, null, {})
  assert.equal(newRowWouldSurvive(defaults, MY_DAY, 'title', {}), true)
})

test('a row that would VANISH is refused, so the add row hides instead of lying', () => {
  // Today, with nothing authored: the row gets no due date, so the `lte` filter drops it the moment
  // the table reloads. Showing an add row here is worse than showing none.
  assert.equal(newRowWouldSurvive(newRowDefaults(TODAY, null, {}), TODAY, 'title', {}), false)

  // ...and authoring the default rescues it.
  const rescued = newRowDefaults(TODAY, { due_on: '{{today}}' }, {})
  assert.equal(newRowWouldSurvive(rescued, TODAY, 'title', {}), true)
})

test('Upcoming stays refused even with a today default, because tomorrow is the filter', () => {
  const defaults = newRowDefaults(UPCOMING, { due_on: '{{today}}' }, {})
  assert.equal(newRowWouldSurvive(defaults, UPCOMING, 'title', {}), false)
})

test('an unfiltered table always allows one — there is nothing to fall out of', () => {
  assert.equal(newRowWouldSurvive({}, [], 'title', {}), true)
  assert.equal(newRowWouldSurvive({}, null, 'title', {}), true)
})

test('the probe carries a title, so a list filtering on one being present is not refused wrongly', () => {
  const filters = [{ field: 'title', operator: 'isNotEmpty' }]
  assert.equal(newRowWouldSurvive({}, filters, 'title', {}), true)
})
