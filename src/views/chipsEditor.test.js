// SPDX-License-Identifier: Apache-2.0
// Copyright (c) Cordango and contributors.
// Part of Cordango Web Controls, the shared Vue controls for Cordango applications: https://github.com/cordango/web-controls
// Licensed under the Apache License, Version 2.0. See LICENSE in the repository root.
// Extracted from the Cordango platform at web/src/views/chipsEditor.test.js. Until web/ consumes this
// package, that copy and this one are two files saying the same thing: check both.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { chipShape, chipTitle, entryFrom, isDuplicate, peopleItems, emailOf } from './chipsEditor.js'

// The core-app guest entity, as the manifest hands it over.
const GUEST = {
  key: 'event_guest',
  fields: [
    { key: 'event', type: 'reference', targetEntity: 'calendar_event', required: true },
    { key: 'email', type: 'email', required: true },
    { key: 'name', type: 'text' },
    { key: 'person', type: 'reference', targetApp: 'platform', targetEntity: 'person' },
    { key: 'response', type: 'select' },
  ],
}
const SHAPE = chipShape(GUEST, 'event')

test('the roles come from field shape, and the parent link is never one of them', () => {
  assert.deepEqual(SHAPE, { email: 'email', person: 'person', name: 'name' })
})

test('an entity with no email field cannot be a chips child', () => {
  // Better to render nothing than to guess which text field is an address.
  assert.equal(chipShape({ fields: [{ key: 'x', type: 'text' }] }, 'x'), null)
})

test('a person reference to something other than the directory is not the identity', () => {
  const s = chipShape({
    fields: [
      { key: 'email', type: 'email', required: true },
      { key: 'account', type: 'reference', targetEntity: 'organization' },
    ],
  }, 'parent')
  assert.equal(s.person, null)
})

// ---- what a typed address becomes --------------------------------------------------------------

test('a typed address becomes a guest', () => {
  assert.deepEqual(entryFrom('sead@wearedevelopers.test', SHAPE), { email: 'sead@wearedevelopers.test' })
})

test('surrounding whitespace is not part of an address', () => {
  assert.deepEqual(entryFrom('  a@b.test  ', SHAPE), { email: 'a@b.test' })
})

test('text that is not an address is refused rather than saved as one', () => {
  for (const junk of ['Sead', 'a@b', '@b.test', 'a b@c.test', ''])
    assert.equal(entryFrom(junk, SHAPE), null, `expected '${junk}' to be refused`)
})

// ---- what a picked colleague becomes -----------------------------------------------------------

test('a picked colleague carries their id AND their address', () => {
  const e = entryFrom({ value: 'p_mara', title: 'Mara Winter', email: 'mara@cordango.test' }, SHAPE)
  assert.deepEqual(e, { email: 'mara@cordango.test', person: 'p_mara', name: 'Mara Winter' })
})

// This is the case bare values cannot express: with `return-object: false` a picked person and the
// literal text of their id are the same string, and there is no way back to which one happened.
test('a picked person and typed text are told apart by their type, not by their content', () => {
  assert.equal(entryFrom('p_mara', SHAPE), null)                       // text: not an address
  assert.ok(entryFrom({ value: 'p_mara', email: 'm@x.test' }, SHAPE))   // an actual pick
})

test('a colleague with no address on file cannot be invited', () => {
  // `email` is required on the child, so this would be a 400 AFTER the appointment was written.
  assert.equal(entryFrom({ value: 'p_ghost', title: 'No Mail', email: '' }, SHAPE), null)
})

test('an entity without a name or person field just stores the address', () => {
  const bare = chipShape({ fields: [{ key: 'email', type: 'email', required: true }] }, 'parent')
  assert.deepEqual(entryFrom({ value: 'p1', title: 'Mara', email: 'm@x.test' }, bare), { email: 'm@x.test' })
})

// ---- duplicates --------------------------------------------------------------------------------

test('the same address twice is one guest, whatever the casing', () => {
  const rows = [{ email: 'Anna@X.test' }]
  assert.equal(isDuplicate(rows, 'anna@x.test', SHAPE), true)
  assert.equal(isDuplicate(rows, '  ANNA@x.test ', SHAPE), true)
  assert.equal(isDuplicate(rows, 'bob@x.test', SHAPE), false)
})

test('an empty address never counts as a duplicate of an empty row', () => {
  assert.equal(isDuplicate([{ email: '' }], '', SHAPE), false)
})

// ---- labels ------------------------------------------------------------------------------------

test('a chip reads as the name when there is one, the address when there is not, never an id', () => {
  assert.equal(chipTitle({ id: 'r1', name: 'Mara Winter', email: 'm@x.test' }, SHAPE), 'Mara Winter')
  assert.equal(chipTitle({ id: 'r1', email: 'm@x.test' }, SHAPE), 'm@x.test')
  assert.equal(chipTitle(null, SHAPE), '')
})

test('emailOf normalises for comparison and tolerates a missing shape', () => {
  assert.equal(emailOf({ email: ' A@B.test ' }, SHAPE), 'a@b.test')
  assert.equal(emailOf({ email: 'a@b.test' }, null), '')
})

// ---- the picker's own list ---------------------------------------------------------------------

test('people with no address are left out of the picker, not offered and then refused', () => {
  const items = peopleItems([
    { id: 'p1', full_name: 'Mara Winter', email: 'mara@x.test' },
    { id: 'p2', full_name: 'No Mail' },
    { id: 'p3', full_name: 'Bad Mail', email: 'nope' },
  ])
  assert.deepEqual(items.map(i => i.value), ['p1'])
})

test('I am first in my own picker', () => {
  const items = peopleItems([
    { id: 'p1', full_name: 'Anna', email: 'a@x.test' },
    { id: 'p2', full_name: 'Mara', email: 'm@x.test' },
    { id: 'p3', full_name: 'Zoe', email: 'z@x.test' },
  ], 'p2')
  assert.deepEqual(items.map(i => i.value), ['p2', 'p1', 'p3'])
})

test('an unknown acting user reorders nothing rather than guessing', () => {
  const people = [{ id: 'p1', full_name: 'Anna', email: 'a@x.test' }]
  assert.deepEqual(peopleItems(people, '').map(i => i.value), ['p1'])
  assert.deepEqual(peopleItems(people).map(i => i.value), ['p1'])
})

test('someone falls back to their address when they have no name', () => {
  assert.equal(peopleItems([{ id: 'p1', email: 'a@x.test' }])[0].title, 'a@x.test')
})
