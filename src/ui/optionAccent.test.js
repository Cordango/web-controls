// SPDX-License-Identifier: Apache-2.0
// Copyright (c) Cordango and contributors.
// Part of Cordango Web Controls, the shared Vue controls for Cordango applications: https://github.com/cordango/web-controls
// Licensed under the Apache License, Version 2.0. See LICENSE in the repository root.
// Extracted from the Cordango platform at web/src/ui/optionAccent.test.js. Until web/ consumes
// this package, that copy and this one are two files saying the same thing.

import test from 'node:test'
import assert from 'node:assert/strict'
import { optionAccent, optionAccentStyle } from './optionAccent.js'

test('reads a manifest option color from a Vuetify item', () => {
  const item = { raw: { value: 'hybrid', title: 'Hybrid', color: '#3b82f6' } }
  assert.equal(optionAccent(item), '#3b82f6')
  assert.deepEqual(optionAccentStyle(item), { '--ui-option-accent': '#3b82f6' })
})

test('accepts an unwrapped option and ignores missing colors', () => {
  assert.equal(optionAccent({ color: '#A855F7' }), '#A855F7')
  assert.equal(optionAccent({ value: 'office' }), null)
  assert.equal(optionAccentStyle({ value: 'office' }), undefined)
})

test('does not pass arbitrary manifest strings into CSS', () => {
  assert.equal(optionAccent({ color: 'primary' }), null)
  assert.equal(optionAccent({ color: 'red; display: none' }), null)
  assert.equal(optionAccent({ color: 'var(--primary)' }), null)
})
