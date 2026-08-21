// SPDX-License-Identifier: Apache-2.0
// Copyright (c) Cordango and contributors.
// Part of Cordango Web Controls, the shared Vue controls for Cordango applications: https://github.com/cordango/web-controls
// Licensed under the Apache License, Version 2.0. See LICENSE in the repository root.
// Extracted from the Cordango platform at web/src/views/companyGroup.test.js. Until web/ consumes this
// package, that copy and this one are two files saying the same thing: check both.

import test from 'node:test'
import assert from 'node:assert/strict'
import { buildGroup, withDescendants, nameKey, byName, exactByName, identityKey, looseKey }
  from './companyGroup.js'

const c = (legalName, relation, parentName = null) => ({ legalName, relation, parentName })

// The case that started this: searching "Porsche" returns two companies tagged `parent`, and they
// are not alternatives — one owns the other.
const PORSCHE = [
  c('Dr. Ing. h.c. F. Porsche AG', 'match', 'Volkswagen AG'),
  c('Porsche Automobil Holding SE', 'parent', null),
  c('Volkswagen AG', 'parent', 'Porsche Automobil Holding SE'),
  c('Porsche Financial Services GmbH', 'subsidiary', 'Dr. Ing. h.c. F. Porsche AG'),
]

const names = rows => rows.map(n => `${'  '.repeat(n.depth)}${n.c.legalName}`)

test('the chain upwards is a chain, not two peers', () => {
  const { rows } = buildGroup(PORSCHE)
  assert.deepEqual(names(rows), [
    'Porsche Automobil Holding SE',
    '  Volkswagen AG',
    '    Dr. Ing. h.c. F. Porsche AG',
    '      Porsche Financial Services GmbH',
  ])
})

test('the searched-for company is marked wherever it lands in the tree', () => {
  const { rows, matches } = buildGroup(PORSCHE)
  assert.equal(matches.length, 1)
  assert.equal(matches[0].c.legalName, 'Dr. Ing. h.c. F. Porsche AG')
  assert.equal(rows.find(n => n.match).depth, 2)
})

test('a legal form is not what distinguishes a company', () => {
  assert.equal(nameKey('Volkswagen AG'), nameKey('VOLKSWAGEN  AG'))
  assert.equal(nameKey('Volkswagen AG'), nameKey('Volkswagen'))
  assert.notEqual(nameKey('Porsche AG'), nameKey('Porsche SE'.replace('SE', 'Holding')))
})

test('byName finds an existing record however its legal form is written', () => {
  const rows = [{ id: '1', name: 'VOLKSWAGEN AG' }, { id: '2', name: 'Audi AG' }]
  assert.equal(byName(rows, 'Volkswagen Aktiengesellschaft')?.id, undefined) // a different name
  assert.equal(byName(rows, 'Volkswagen')?.id, '1')
  assert.equal(byName(rows, 'AUDI  ag')?.id, '2')
  assert.equal(byName(rows, ''), null)
})

test('a subsidiary whose owner is not in the list still hangs under the match', () => {
  // The model named a parent it did not return. Left alone this row would render as a peer of the
  // company it belongs to — the confusion the whole file exists to remove.
  const { rows } = buildGroup([
    c('AUDI Aktiengesellschaft', 'match', 'Volkswagen AG'),
    c('Automobili Lamborghini S.p.A.', 'subsidiary', 'Some Holding Nobody Returned'),
  ])
  assert.deepEqual(names(rows), [
    'AUDI Aktiengesellschaft',
    '  Automobili Lamborghini S.p.A.',
  ])
})

test('a parent nobody returned leaves the match at the top rather than orphaning it', () => {
  const { rows } = buildGroup([c('Kettenwerk GmbH', 'match', 'A Holding We Did Not Return')])
  assert.deepEqual(names(rows), ['Kettenwerk GmbH'])
})

test('two companies reported as owning each other do not recurse', () => {
  const { rows } = buildGroup([
    c('Alpha GmbH', 'match', 'Beta GmbH'),
    c('Beta GmbH', 'parent', 'Alpha GmbH'),
  ])
  // One link survives, the one that would close the loop is dropped, and every candidate is shown.
  assert.equal(rows.length, 2)
  assert.equal(rows[0].c.legalName, 'Beta GmbH')
  assert.equal(rows[1].c.legalName, 'Alpha GmbH')
})

test('the same company returned twice is one row', () => {
  const { rows } = buildGroup([
    c('Volkswagen AG', 'match', null),
    c('VOLKSWAGEN AG', 'parent', null),
    c('Audi AG', 'subsidiary', 'Volkswagen AG'),
  ])
  // Collapsed: two rows a person cannot tell apart would split the children between them.
  assert.deepEqual(names(rows), ['Volkswagen AG', '  Audi AG'])
})

test('the branch with the match sorts above the ones without', () => {
  const { rows } = buildGroup([
    c('Group Holding SE', 'parent', null),
    c('Unrelated Sister GmbH', 'subsidiary', 'Group Holding SE'),
    c('The One You Searched GmbH', 'match', 'Group Holding SE'),
  ])
  assert.deepEqual(names(rows), [
    'Group Holding SE',
    '  The One You Searched GmbH',
    '  Unrelated Sister GmbH',
  ])
})

test('several readings of an ambiguous name stay separate trees', () => {
  const { roots } = buildGroup([
    c('Apple Inc.', 'match', null),
    c('Apfel Bäckerei GmbH', 'match', null),
  ])
  assert.equal(roots.length, 2)
})

test('add-all order is parents before children, so a child can link to a real id', () => {
  const { roots } = buildGroup(PORSCHE)
  assert.deepEqual(withDescendants(roots[0]).map(n => n.c.legalName), [
    'Porsche Automobil Holding SE',
    'Volkswagen AG',
    'Dr. Ing. h.c. F. Porsche AG',
    'Porsche Financial Services GmbH',
  ])
})

test('an empty answer is an empty tree, not a crash', () => {
  assert.deepEqual(buildGroup([]).rows, [])
  assert.deepEqual(buildGroup(undefined).roots, [])
})

// --- the property that was broken -----------------------------------------------------------------
//
// A group whose members share a brand and differ only by legal form — which is most groups. Reading
// the name without its legal form made DeepL SE, DeepL GmbH and DeepL Inc. one key, so whichever the
// model listed first collected every child and the real parent was left empty. Same five companies,
// three orderings, three different trees.

const DEEPL = [
  c('DeepL SE', 'match', null),
  c('DeepL GmbH', 'subsidiary', 'DeepL SE'),
  c('DeepL Inc.', 'subsidiary', 'DeepL SE'),
  c('DeepL UK Ltd', 'subsidiary', 'DeepL SE'),
  c('DeepL KK', 'subsidiary', 'DeepL SE'),
]

const permutations = (xs) => xs.length <= 1 ? [xs]
  : xs.flatMap((x, i) => permutations([...xs.slice(0, i), ...xs.slice(i + 1)]).map(p => [x, ...p]))

test('the tree does not depend on the order the model listed the companies in', () => {
  const expected = names(buildGroup(DEEPL).rows)
  assert.deepEqual(expected, [
    'DeepL SE',
    '  DeepL GmbH',
    '  DeepL Inc.',
    '  DeepL UK Ltd',
    '  DeepL KK',
  ])
  // All 120 orderings, not a sampled few: the bug only showed for the orderings where a particular
  // sibling happened to come first, which is precisely what a spot check misses.
  for (const order of permutations(DEEPL)) {
    const got = names(buildGroup(order).rows)
    assert.deepEqual(got.slice().sort(), expected.slice().sort(),
      `order starting ${order[0].legalName} produced a different tree`)
    assert.equal(got[0], 'DeepL SE', `order starting ${order[0].legalName} lost the real parent`)
  }
})

test('companies that differ only by legal form are different companies', () => {
  assert.notEqual(identityKey('DeepL SE'), identityKey('DeepL GmbH'))
  assert.notEqual(identityKey('DeepL SE'), identityKey('DeepL Inc.'))
  // ...but the loose reading still says they are the same, which is why it may only ever be a
  // fallback and only when it resolves to exactly one company.
  assert.equal(looseKey('DeepL SE'), looseKey('DeepL GmbH'))
})

test('one company written several ways is one company', () => {
  // The three spellings a German company name actually arrives in.
  assert.equal(identityKey('Müller GmbH'), identityKey('mueller gmbh'))
  assert.equal(identityKey('Müller GmbH'), identityKey('MÜLLER  GmbH'))
  assert.equal(identityKey('Müller GmbH'), identityKey('Müller, GmbH'))
  // Other accents lose their marks rather than becoming a two-letter pair.
  assert.equal(identityKey('Société Générale SA'), identityKey('Societe Generale SA'))
  // A typo is NOT a spelling variant. Repairing it here would file one company under another.
  assert.notEqual(identityKey('Müller GmbH'), identityKey('Müller GmH'))
})

test('an ambiguous loose match links nothing rather than guessing', () => {
  // "DeepL" alone could mean any of the three. Refusing is the honest answer.
  const { rows } = buildGroup([
    c('DeepL SE', 'parent', null),
    c('DeepL GmbH', 'parent', null),
    c('DeepL Standalone Oy', 'match', 'DeepL'),
  ])
  const orphan = rows.find(n => n.c.legalName === 'DeepL Standalone Oy')
  assert.equal(orphan.parent, null)
})

test('byName will not hand back a sibling that merely shares the brand', () => {
  // The write this protects: linking a new DeepL GmbH to the existing DeepL SE record would file
  // one real company as another.
  const rows = [{ id: '1', name: 'DeepL SE' }, { id: '2', name: 'DeepL GmbH' }]
  assert.equal(byName(rows, 'DeepL GmbH')?.id, '2')
  assert.equal(byName(rows, 'DeepL SE')?.id, '1')
  assert.equal(byName(rows, 'DeepL'), null)          // ambiguous — no claim
  assert.equal(byName(rows, 'DeepL Inc.'), null)     // not there at all
})

test('"do you already have this?" is answered exactly, never loosely', () => {
  // The real workspace state that exposed this: ONE DeepL record. Under the loose fallback every
  // other DeepL in the group resolved to it — unambiguous, because there was only one — so four
  // companies the workspace did not have were marked as already added and could not be added.
  const rows = [{ id: '1', name: 'DeepL SE' }]
  assert.equal(exactByName(rows, 'DeepL SE')?.id, '1')
  assert.equal(exactByName(rows, 'deepl  se')?.id, '1')     // still one company, written loosely
  assert.equal(exactByName(rows, 'DeepL GmbH'), null)
  assert.equal(exactByName(rows, 'DeepL Inc.'), null)
  assert.equal(exactByName(rows, 'DeepL'), null)
  // The looser rule is still the right one for LINKING, where being wrong costs a misplaced row
  // rather than an unaddable company — so the two must not be collapsed into one helper.
  assert.equal(byName(rows, 'DeepL')?.id, '1')
})

test('an entry naming an owner we did not return joins the group, whatever it was tagged', () => {
  // A `parent` the model failed to link used to open a second group card beside the real one.
  const { roots, rows } = buildGroup([
    c('DeepL SE', 'match', null),
    c('DeepL UK Ltd.', 'parent', 'Some Holding Nobody Returned'),
  ])
  assert.equal(roots.length, 1)
  assert.deepEqual(names(rows), ['DeepL SE', '  DeepL UK Ltd.'])
})
