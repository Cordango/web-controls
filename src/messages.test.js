// SPDX-License-Identifier: Apache-2.0
// Copyright (c) Cordango and contributors.
// Part of Cordango Web Controls, the shared Vue controls for Cordango applications: https://github.com/cordango/web-controls
// Licensed under the Apache License, Version 2.0. See LICENSE in the repository root.

// Every key a component says is a key this package ships.
//
// A MISSING KEY IS NOT AN ERROR, which is the only reason this test is worth its cost. vue-i18n
// renders the key PATH when it cannot resolve one, so the failure arrives on screen as a toolbar
// button labelled `table.expandAll` — which reads as a typo, not as a missing dependency, and which
// nothing on the host side would think to assert.
//
// It has already happened once. `table.parentTask` was added to `UiDataTable` after this package
// was forked out of the platform, and it exists in NEITHER catalog there — so the subtask picker
// has been labelled with its own key path for as long as it has existed, unnoticed because nothing
// consumes the package yet.
//
// German is checked as strictly as English. A package that shipped `en` alone would still pass an
// English reviewer's eye and give a German application English table chrome.

import test from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

import { messages } from './messages.js'

const root = dirname(fileURLToPath(import.meta.url))

function vueFiles(directory) {
  const found = []
  for (const entry of readdirSync(directory)) {
    const path = join(directory, entry)
    if (statSync(path).isDirectory()) found.push(...vueFiles(path))
    else if (entry.endsWith('.vue')) found.push(path)
  }
  return found
}

// `$t('x.y')` in a template and `t('x.y')` in a setup block are the same call. A key is DOTTED by
// convention, which is what separates a real one from `emit('add')` or `closest('tr')` — those are
// the false positives a bare `t\(` would otherwise drown this in.
const CALL = /(?:\$t|\bt)\(\s*'([a-z][a-zA-Z0-9]*(?:\.[a-zA-Z0-9]+)+)'/g

function keysIn(source) {
  return [...source.matchAll(CALL)].map((m) => m[1])
}

function resolve(catalog, key) {
  let node = catalog
  for (const part of key.split('.')) {
    if (node === null || typeof node !== 'object' || !(part in node)) return undefined
    node = node[part]
  }
  return typeof node === 'string' ? node : undefined
}

const spoken = new Map()
for (const file of vueFiles(root)) {
  for (const key of keysIn(readFileSync(file, 'utf8'))) {
    if (!spoken.has(key)) spoken.set(key, file.slice(root.length + 1))
  }
}

test('the components say something', () => {
  // Guards the extraction itself: a regex that silently stopped matching would make every
  // assertion below vacuously true, which is the failure mode this whole file exists to prevent.
  assert.ok(spoken.size >= 20, `only found ${spoken.size} translated strings — the scan is broken`)
})

for (const language of Object.keys(messages)) {
  test(`every key a component says is in ${language}`, () => {
    const missing = [...spoken].filter(([key]) => resolve(messages[language], key) === undefined)

    assert.deepEqual(
      missing.map(([key, file]) => `${key} (${file})`),
      [],
      `these render as their own key path in ${language}`,
    )
  })
}

test('the languages carry the same keys', () => {
  // A key present in one language and absent in the other is the same on-screen failure, reached by
  // a route this file's other tests cannot see: nobody adds a key to `de` alone, but plenty of
  // people add one to `en` and mean to come back.
  const flatten = (node, prefix = '') =>
    Object.entries(node).flatMap(([key, value]) =>
      typeof value === 'string' ? [prefix + key] : flatten(value, `${prefix}${key}.`))

  const [first, ...rest] = Object.keys(messages)
  for (const language of rest) {
    assert.deepEqual(
      flatten(messages[language]).sort(),
      flatten(messages[first]).sort(),
      `${language} and ${first} do not carry the same keys`,
    )
  }
})
