// SPDX-License-Identifier: Apache-2.0
// Copyright (c) Cordango and contributors.
// Part of Cordango Web Controls, the shared Vue controls for Cordango applications: https://github.com/cordango/web-controls
// Licensed under the Apache License, Version 2.0. See LICENSE in the repository root.
// Extracted from the Cordango platform at web/src/i18n/formatting.js. Until web/ consumes this
// package, that copy and this one are two files saying the same thing: check both.

// Dates, times and numbers, formatted in the language the app is actually rendering in.
//
// This file exists because of one specific bug the codebase had everywhere: ~30 calls to
// `toLocaleDateString(undefined, …)`. `undefined` means "the browser's locale", which is NOT the
// app's locale — someone running a US-English browser who picks German in Settings would get German
// labels above "8/8/2026" instead of "08.08.2026". The date is the part people misread silently.
//
// So: nothing in the app calls toLocale*() directly any more. It calls these, and these resolve
// against the live i18n locale.

import { currentLocale } from './locale.js'

// Intl formatters are expensive to construct and get used per table row, so they are memoized per
// (locale, shape). Cleared on a language switch, which is rare and cheap.
const cache = new Map()
let cachedFor = null

function formatter(kind, options) {
  const locale = currentLocale()
  if (cachedFor !== locale) { cache.clear(); cachedFor = locale }
  const key = `${kind}:${JSON.stringify(options ?? {})}`
  let f = cache.get(key)
  if (!f) {
    f = kind === 'number' ? new Intl.NumberFormat(locale, options) : new Intl.DateTimeFormat(locale, options)
    cache.set(key, f)
  }
  return f
}

/** A Date from whatever the data plane hands us: an ISO string, an epoch number, a Date. Null when
 *  it is not a usable instant — callers render an em dash rather than "Invalid Date". */
export function toDate(value) {
  if (value == null || value === '') return null
  const d = value instanceof Date ? value : new Date(value)
  return Number.isNaN(d.getTime()) ? null : d
}

/** 08.08.2026 / 8/8/2026 */
export const formatDate = (value, options) => {
  const d = toDate(value)
  return d ? formatter('date', options ?? { dateStyle: 'medium' }).format(d) : ''
}

/** 08.08.2026, 14:30 */
export const formatDateTime = (value, options) => {
  const d = toDate(value)
  return d ? formatter('date', options ?? { dateStyle: 'medium', timeStyle: 'short' }).format(d) : ''
}

/** 14:30 — a 12-hour locale gets 2:30 PM without the caller having to know. */
export const formatTime = (value, options) => {
  const d = toDate(value)
  return d ? formatter('date', options ?? { timeStyle: 'short' }).format(d) : ''
}

/** Weekday/month names for axes and calendar headers. */
export const formatDatePart = (value, options) => {
  const d = toDate(value)
  return d ? formatter('date', options).format(d) : ''
}

/** 1.234,56 / 1,234.56 */
export const formatNumber = (value, options) =>
  typeof value === 'number' && Number.isFinite(value) ? formatter('number', options).format(value) : ''

/** Currency. The CODE comes from the data, never from the locale: a German user looking at a USD
 *  invoice must see $, not €. The locale only decides where the symbol sits and which separators
 *  are used — which is exactly the split Intl already makes. */
export const formatCurrency = (value, currency = 'EUR', options) =>
  typeof value === 'number' && Number.isFinite(value)
    ? formatter('number', { style: 'currency', currency, ...(options ?? {}) }).format(value)
    : ''

/** 12,5 % / 12.5% — takes a RATIO (0.125), because that is what the calculation plane produces. */
export const formatPercent = (value, options) =>
  typeof value === 'number' && Number.isFinite(value)
    ? formatter('number', { style: 'percent', maximumFractionDigits: 1, ...(options ?? {}) }).format(value)
    : ''

/**
 * "3 days ago" / "vor 3 Tagen".
 *
 * Intl.RelativeTimeFormat rather than a hand-rolled ladder: German needs "vor 3 Tagen" (preposition
 * before, dative plural) where English needs "3 days ago" (postposition), and every hand-rolled
 * version of this ends up hardcoding the English word order and then translating the words inside it.
 */
export function formatRelative(value) {
  const d = toDate(value)
  if (!d) return ''
  const seconds = Math.round((d.getTime() - Date.now()) / 1000)
  const units = [
    ['year', 31536000], ['month', 2592000], ['week', 604800],
    ['day', 86400], ['hour', 3600], ['minute', 60],
  ]
  const rtf = new Intl.RelativeTimeFormat(currentLocale(), { numeric: 'auto' })
  for (const [unit, size] of units)
    if (Math.abs(seconds) >= size) return rtf.format(Math.round(seconds / size), unit)
  return rtf.format(seconds, 'second')
}

/** 'YYYY-MM-DD' for the WIRE — deliberately not localized. A date going into a query string or a
 *  date input is a machine value; formatting it for a human is what breaks the round trip. */
export const isoDate = (value) => {
  const d = toDate(value)
  if (!d) return ''
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
