// SPDX-License-Identifier: Apache-2.0
// Copyright (c) Cordango and contributors.
// Part of Cordango Web Controls, the shared Vue controls for Cordango applications: https://github.com/cordango/web-controls
// Licensed under the Apache License, Version 2.0. See LICENSE in the repository root.
// Extracted from the Cordango platform at web/src/views/timezones.test.js. Until web/ consumes
// this package, that copy and this one are two files saying the same thing.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { zoneNames, zoneItems, offsetLabel, isZone, guessZone, DEFAULT_ZONE } from './timezones.js'

const JULY = new Date('2026-07-15T12:00:00Z')
const JANUARY = new Date('2026-01-15T12:00:00Z')

test('the list is the runtime\'s, not a hand-kept one', () => {
  const names = zoneNames()
  assert.ok(names.length > 50, `expected a real zone list, got ${names.length}`)
  assert.ok(names.includes('Europe/Berlin'))
  assert.ok(names.includes('America/New_York'))
})

// The offset is what makes a zone checkable against the clock on your wall. Summer, because a page
// configured in July and read as +1 would be an hour wrong for half the year.
test('the offset is the one in force on the day, not the standard one', () => {
  assert.equal(offsetLabel('Europe/Berlin', JULY), 'GMT+2')
  assert.equal(offsetLabel('Europe/Berlin', JANUARY), 'GMT+1')
  assert.equal(offsetLabel('UTC', JULY), 'GMT')
})

test('an unknown zone yields no offset rather than throwing', () => {
  assert.equal(offsetLabel('Mars/Olympus', JULY), '')
})

test('isZone tells a real zone from a typo', () => {
  assert.equal(isZone('Europe/Berlin'), true)
  assert.equal(isZone('Europe/Berlim'), false)
  assert.equal(isZone(''), false)
  assert.equal(isZone(null), false)
})

test('items carry the zone as the value and read with an underscore-free name', () => {
  const item = zoneItems(null, JULY).find(i => i.value === 'America/New_York')
  assert.equal(item.title, 'America/New York')
  assert.equal(item.subtitle, 'GMT-4')
})

// A page configured on someone else's machine must not lose its zone because this browser is older
// or the zone was renamed.
test('a stored zone this runtime does not know stays selectable, at the top', () => {
  const items = zoneItems('Mars/Olympus', JULY)
  assert.equal(items[0].value, 'Mars/Olympus')
  assert.equal(items.filter(i => i.value === 'Mars/Olympus').length, 1)
})

test('a stored zone the runtime DOES know is not duplicated', () => {
  assert.equal(zoneItems('Europe/Berlin', JULY).filter(i => i.value === 'Europe/Berlin').length, 1)
})

test('the guess is a real zone, and Berlin is the fallback', () => {
  assert.equal(isZone(guessZone()), true)
  assert.equal(isZone(DEFAULT_ZONE), true)
})
