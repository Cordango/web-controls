// SPDX-License-Identifier: Apache-2.0
// Copyright (c) Cordango and contributors.
// Part of Cordango Web Controls, the shared Vue controls for Cordango applications: https://github.com/cordango/web-controls
// Licensed under the Apache License, Version 2.0. See LICENSE in the repository root.
// Extracted from the Cordango platform at web/src/views/timezones.js. Until web/ consumes
// this package, that copy and this one are two files saying the same thing.

// The IANA time zones, as picker items.
//
// Why this is not a `select` with options in the definition: there are ~450 of them, they change
// (governments move the rules), and shipping them as schema options would mean a definition edit and
// a redeploy every time a country changes its mind. The browser already ships the current list.
//
// Why it matters at all: a booking page's zone decides what "09:00–17:00" means to a stranger on the
// other side of the link. A typo'd zone does not error — it silently falls back to UTC on the server
// (`AvailabilityService.ZoneOrUtc`), and the page then offers hours nobody meant. So it must not be
// typeable.
//
// No DOM, no data.js — tested under `node --test`.

/** The one everyone here means. A booking page with no zone would fall back to UTC on the server,
 *  which is an hour or two wrong in exactly the season people notice. */
export const DEFAULT_ZONE = 'Europe/Berlin'

/** Enough to keep a picker usable if `Intl.supportedValuesOf` is missing (older Safari). Not a
 *  world list — a short, honest fallback beats a broken control. */
const FALLBACK = [
  'Europe/Berlin', 'Europe/Vienna', 'Europe/Zurich', 'Europe/London', 'Europe/Paris',
  'Europe/Madrid', 'Europe/Rome', 'Europe/Amsterdam', 'Europe/Warsaw', 'Europe/Lisbon',
  'Europe/Stockholm', 'Europe/Helsinki', 'Europe/Athens', 'Europe/Istanbul', 'Europe/Kyiv',
  'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
  'America/Sao_Paulo', 'Asia/Dubai', 'Asia/Kolkata', 'Asia/Singapore', 'Asia/Tokyo',
  'Asia/Shanghai', 'Australia/Sydney', 'Pacific/Auckland', 'UTC',
]

/** Every zone this runtime knows, or the fallback. */
export function zoneNames () {
  try {
    const all = Intl.supportedValuesOf?.('timeZone')
    if (Array.isArray(all) && all.length) return all
  } catch { /* fall through */ }
  return FALLBACK
}

/** A zone's CURRENT offset, e.g. "GMT+2". Current rather than standard on purpose: someone choosing a
 *  zone in July is checking it against the clock on their wall, which is showing summer time. */
export function offsetLabel (zone, at = new Date()) {
  try {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone: zone, timeZoneName: 'shortOffset' })
      .formatToParts(at)
    return parts.find(p => p.type === 'timeZoneName')?.value || ''
  } catch { return '' }
}

/** Is this a zone this runtime can resolve? Used to keep a stored-but-unknown value selectable
 *  rather than blanking a field somebody only opened to read. */
export function isZone (zone) {
  if (!zone) return false
  try { new Intl.DateTimeFormat('en-US', { timeZone: zone }); return true } catch { return false }
}

/**
 * Picker items, `[{ value, title, subtitle }]`.
 *
 * `current` is always present even when this runtime does not know it — a page configured elsewhere
 * must not silently lose its zone because the reader's browser is older.
 */
export function zoneItems (current, at = new Date()) {
  const names = zoneNames()
  const all = current && !names.includes(current) ? [current, ...names] : names
  return all.map(z => ({ value: z, title: z.replace(/_/g, ' '), subtitle: offsetLabel(z, at) }))
}

/** The reader's own zone, when it is one we can offer. What a new page should start on: the person
 *  filling in the form is almost always in the zone they take meetings in. */
export function guessZone () {
  try {
    const z = Intl.DateTimeFormat().resolvedOptions().timeZone
    return isZone(z) ? z : DEFAULT_ZONE
  } catch { return DEFAULT_ZONE }
}
