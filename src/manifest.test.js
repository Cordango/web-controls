// SPDX-License-Identifier: Apache-2.0
// Copyright (c) Cordango and contributors.
// Part of Cordango Web Controls, the shared Vue controls for Cordango applications: https://github.com/cordango/web-controls
// Licensed under the Apache License, Version 2.0. See LICENSE in the repository root.
// Extracted from the Cordango platform at web/src/manifest.test.js. Until web/ consumes this
// package, that copy and this one are two files saying the same thing: check both.

import test from 'node:test'
import assert from 'node:assert/strict'
import { dateAxis, matchFilter, recordStatus, recordSubtitle, fieldHref, deepLinkFor } from './manifest.js'

// Run with `npm test` in web/ (node --test, no test framework dependency — manifest.js is pure
// ESM with no imports, so the runtime needs nothing a browser build would provide).

test('a day axis carries the start of the next bucket', () => {
  const days = dateAxis({ from: '2026-08-03', step: 'day', count: 3 })
  assert.deepEqual(days.map(d => d.date), ['2026-08-03', '2026-08-04', '2026-08-05'])
  assert.deepEqual(days.map(d => d.next), ['2026-08-04', '2026-08-05', '2026-08-06'])
})

test('buckets are contiguous and disjoint on every step', () => {
  // The load-bearing property: each bucket's `next` IS the following bucket's `date`, so a
  // half-open filter puts every record in exactly one bucket — no gaps, no double counting.
  for (const step of ['day', 'week', 'month']) {
    const buckets = dateAxis({ from: '2026-01-15', step, count: 6 })
    for (let i = 0; i < buckets.length - 1; i++)
      assert.equal(buckets[i].next, buckets[i + 1].date, `${step} bucket ${i} does not meet the next`)
  }
})

test('a month axis does not skip February from the 31st', () => {
  // Plain setMonth(+1) on Jan 31 yields Mar 3 — the month axis would silently omit February.
  const months = dateAxis({ from: '2026-01-31', step: 'month', count: 4 })
  assert.deepEqual(months.map(m => m.date.slice(0, 7)), ['2026-01', '2026-02', '2026-03', '2026-04'])
})

test('a leap February is clamped correctly', () => {
  const months = dateAxis({ from: '2028-01-31', step: 'month', count: 2 })
  assert.equal(months[1].date, '2028-02-29')
})

test('the day-bucket filter pair selects exactly one day of a datetime field', () => {
  const [day] = dateAxis({ from: '2026-08-03', step: 'day', count: 1 })
  const inBucket = v =>
    matchFilter(v, 'gte', day.date) && matchFilter(v, 'lt', day.next)

  assert.equal(inBucket('2026-08-03T09:00:00Z'), true)
  assert.equal(inBucket('2026-08-03T00:00:00Z'), true)   // the lower edge is inclusive
  assert.equal(inBucket('2026-08-04T00:00:00Z'), false)  // the upper edge is exclusive
  assert.equal(inBucket('2026-08-02T23:59:59Z'), false)
})

test('the old two-filters-against-one-value form matches nothing', () => {
  // What the 2026-08-02 MeetingPrep grid actually authored, because `next` did not exist. Pinned
  // so it stays visibly impossible rather than quietly plausible.
  const [day] = dateAxis({ from: '2026-08-03', step: 'day', count: 1 })
  const bothAgainstDate = v =>
    matchFilter(v, 'gte', day.date) && matchFilter(v, 'lt', day.date)

  for (const v of ['2026-08-03T09:00:00Z', '2026-08-03T00:00:00Z', '2026-08-03'])
    assert.equal(bothAgainstDate(v), false)
})

test('an axis with no end and no count is a single bucket, not an infinite one', () => {
  assert.equal(dateAxis({ from: '2026-08-03', step: 'day' }).length, 1)
})

// --- summarising a record into one line ---------------------------------------------------------
// These back two surfaces that must agree: the related-record rows on a detail screen, and a table
// row drawn as a card on a narrow screen.

const FIELDS = [
  { key: 'name', type: 'text', label: 'Name' },
  { key: 'city', type: 'text', label: 'City' },
  { key: 'country', type: 'text', label: 'Country' },
  { key: 'status', type: 'select', label: 'Status',
    options: [{ value: 'active', label: 'Active', color: '#22c55e' }] },
  { key: 'tier', type: 'select', label: 'Tier', options: [{ value: 'gold', label: 'Gold' }] },
]
const ROW = { name: 'Atelier Blau', city: 'Berlin', country: 'Germany', status: 'active', tier: 'gold' }

test('recordStatus takes the first select that HAS a value, not simply the first select', () => {
  assert.equal(recordStatus(ROW, FIELDS).label, 'Active')
  // An empty status is no status: a chip reading nothing is worse than no chip.
  assert.equal(recordStatus({ ...ROW, status: '' }, FIELDS).label, 'Gold')
  assert.equal(recordStatus({ name: 'x' }, FIELDS), null)
  assert.equal(recordStatus(ROW, []), null)
})

test('recordStatus reads the first entry of a multiselect', () => {
  const fields = [{ key: 'tags', type: 'multiselect', options: [{ value: 'vip', label: 'VIP' }] }]
  assert.equal(recordStatus({ tags: ['vip'] }, fields).label, 'VIP')
  assert.equal(recordStatus({ tags: [] }, fields), null)
})

test('recordSubtitle drops the title and the selects, and joins what is left', () => {
  // `name` is the title (fields[0]) and both selects were spent on the chip.
  assert.equal(recordSubtitle(ROW, FIELDS), 'Berlin · Germany')
})

test('recordSubtitle keeps the first real field when the title field is a select', () => {
  // The old copy filtered selects and THEN skipped one, so a select-titled entity silently lost its
  // first real field. Dropping the title by key instead is exact.
  const fields = [FIELDS[3], FIELDS[1], FIELDS[2]]
  assert.equal(recordSubtitle(ROW, fields), 'Berlin · Germany')
})

test('recordSubtitle drops empty values rather than emitting bare separators', () => {
  assert.equal(recordSubtitle({ name: 'x', city: '', country: 'Germany' }, FIELDS), 'Germany')
  assert.equal(recordSubtitle({ name: 'x' }, FIELDS), '')
})

test('recordSubtitle honours max and resolves references through refMaps', () => {
  const fields = [
    { key: 'name', type: 'text' },
    { key: 'owner', type: 'reference', targetEntity: 'person' },
    { key: 'city', type: 'text' },
    { key: 'country', type: 'text' },
  ]
  const row = { name: 'x', owner: 'p1', city: 'Berlin', country: 'Germany' }
  assert.equal(recordSubtitle(row, fields, { owner: { p1: 'Julia Nagy' } }), 'Julia Nagy · Berlin')
  // Without a refMap a reference is still its raw id — which is exactly why the card path passes one.
  assert.equal(recordSubtitle(row, fields, null, 1), 'p1')
  assert.equal(recordSubtitle(row, fields, { owner: { p1: 'Julia Nagy' } }, 1), 'Julia Nagy')
})

test('both helpers survive a missing record and a missing field list', () => {
  // They are handed generated definitions and server rows, so neither is guaranteed.
  assert.equal(recordStatus(null, FIELDS), null)
  assert.equal(recordStatus(ROW, undefined), null)
  assert.equal(recordSubtitle(null, FIELDS), '')
  assert.equal(recordSubtitle(ROW, undefined), '')
})

// --- fieldHref: what a value points at ---------------------------------------------------------
//
// One rule, because a table cell and a record panel rendering the same field as different things is
// how somebody concludes the link "only works in the list".

test('a url field is its own address', () => {
  assert.equal(fieldHref({ type: 'url' }, 'https://x.test/a'), 'https://x.test/a')
})

test('a slug with a prefix IS an address, relative to wherever the reader is', () => {
  // The workspace's own host. A booking page stores `intro-call` and lives at /book/intro-call;
  // without this the one thing the record exists to hand out is text you assemble in your head.
  assert.equal(fieldHref({ input: 'slug', prefix: '/book/' }, 'intro-call'), '/book/intro-call')
})

test('a slug with no prefix points nowhere — nothing says what it is the tail of', () => {
  assert.equal(fieldHref({ input: 'slug' }, 'intro-call'), null)
})

test('an empty value is not an address, whatever the field says', () => {
  for (const v of [null, undefined, '']) {
    assert.equal(fieldHref({ type: 'url' }, v), null)
    assert.equal(fieldHref({ input: 'slug', prefix: '/book/' }, v), null)
  }
})

test('ordinary text is never sniffed into a link', () => {
  // A note mentioning a domain must stay a note, and `hetzner.com/legal` must not become a guess
  // about which scheme it was fetched over.
  assert.equal(fieldHref({ type: 'text' }, 'hetzner.com/legal'), null)
  assert.equal(fieldHref({}, 'https://x.test'), null)
  assert.equal(fieldHref(null, 'https://x.test'), null)
})

// --- deep links into the app that owns the record ------------------------------------------------
const ORGS = { pages: [
  { key: 'settings', entity: 'organization', group: 'config' },
  { key: 'companies', entity: 'organization' },
  { key: 'contacts', entity: 'contact' },
] }

test('a record deep link lands on the page about ITS entity, not the first page', () => {
  assert.equal(deepLinkFor(ORGS, 'orgs', 'contact', 'c1'), '/a/orgs/contacts/c1')
  assert.equal(deepLinkFor(ORGS, 'orgs', 'organization', 'o1'), '/a/orgs/companies/o1')
})

test('a config page is never the landing place', () => {
  assert.equal(deepLinkFor(ORGS, 'orgs', 'organization'), '/a/orgs/companies')
})

test('falling back to a foreign page carries the entity, or the runtime fetches the wrong one', () => {
  // No page is about `note`, so the link lands on the app's first page — whose entity is
  // `organization`. Without ?e= the runtime asks for an organization with the note's id, gets a
  // 404, and treats the deep link as dead: the reported bug, the list instead of the record.
  assert.equal(deepLinkFor(ORGS, 'orgs', 'note', 'n1'), '/a/orgs/companies/n1?e=note')
})

test('an app with no reachable page yields the app root, never a record route', () => {
  assert.equal(deepLinkFor({ pages: [{ key: 'settings', group: 'config' }] }, 'orgs', 'organization', 'o1'), '/a/orgs')
  assert.equal(deepLinkFor(null, 'orgs', 'organization', 'o1'), '/a/orgs')
})
