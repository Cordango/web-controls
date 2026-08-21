// SPDX-License-Identifier: Apache-2.0
// Copyright (c) Cordango and contributors.
// Part of Cordango Web Controls, the shared Vue controls for Cordango applications: https://github.com/cordango/web-controls
// Licensed under the Apache License, Version 2.0. See LICENSE in the repository root.

// Formatting follows the APPLICATION's language, never the browser's.
//
// This is the defect the platform copy still has: `toLocaleDateString(undefined, …)` reads as
// "use the default locale" and means "use the browser's". A German workspace then renders English
// dates for anyone whose laptop is set to English, and the reverse, and the report that comes back
// says the data is wrong rather than the locale is.
//
// It cannot be caught by reading the code, because the two spellings look the same and both
// produce a plausible date. It can only be caught by formatting the same value under two languages
// and noticing they came out identical.

import test from 'node:test'
import assert from 'node:assert/strict'

import { setLocaleSource } from './locale.js'
import { fmtDate, fmtDateTime, fmtMoney, fmtNumber } from './manifest.js'

const under = (tag, fn) => { setLocaleSource(() => tag); try { return fn() } finally { setLocaleSource(null) } }

test('a date renders differently in two languages', () => {
  const en = under('en', () => fmtDate('2026-08-21'))
  const de = under('de', () => fmtDate('2026-08-21'))

  assert.notEqual(en, de, `both languages produced "${en}" — formatting is ignoring the locale`)
})

test('a datetime renders differently in two languages', () => {
  const en = under('en', () => fmtDateTime('2026-08-21T14:30:00Z'))
  const de = under('de', () => fmtDateTime('2026-08-21T14:30:00Z'))

  assert.notEqual(en, de)
})

test('money follows the language, not the browser', () => {
  const field = { currency: 'EUR' }
  const en = under('en', () => fmtMoney(field, 1234.5))
  const de = under('de', () => fmtMoney(field, 1234.5))

  // German writes 1.234,50 € and English €1,234.50: same amount, different separators AND a
  // different symbol position, so this is a real difference rather than a spacing one.
  assert.notEqual(en, de)
})

test('grouped numbers follow the language', () => {
  const field = { type: 'decimal', scale: 2 }
  const en = under('en', () => fmtNumber(field, 1234567.5))
  const de = under('de', () => fmtNumber(field, 1234567.5))

  assert.notEqual(en, de)
})

test('with no host wired up the controls speak English rather than guessing', () => {
  setLocaleSource(null)

  // Deliberately NOT the browser's locale. A control that fell back to navigator.language would
  // pass every test on a machine set to English and fail on the reviewer's German laptop.
  assert.equal(fmtDate('2026-08-21'), under('en', () => fmtDate('2026-08-21')))
})
