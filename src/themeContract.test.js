// SPDX-License-Identifier: Apache-2.0
// Copyright (c) Cordango and contributors.
// Part of Cordango Web Controls, the shared Vue controls for Cordango applications: https://github.com/cordango/web-controls
// Licensed under the Apache License, Version 2.0. See LICENSE in the repository root.

// What this package needs from a host's theme, kept honest against what it actually reads.
//
// AN UNDEFINED THEME TOKEN FAILS SILENTLY. Vuetify emits `--v-theme-X` only for a key present in
// the theme's `colors`, and a CSS declaration naming a variable that was never defined is invalid —
// so the browser drops that declaration and logs nothing at all. A control then renders with no
// background or no border, which reads as a bug in the control rather than as a gap in the palette.
//
// `HOST_THEME_TOKENS` is the contract a host satisfies. This test is what stops it becoming a
// comment: add `rgb(var(--v-theme-sidebar))` to a component and the list has to say so, which is
// the moment somebody decides whether every host can really be expected to define it.

import test from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

import { HOST_THEME_TOKENS } from './theme.js'

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

const REFERENCE = /--v-theme-([a-z][a-z0-9-]*)/g

const read = new Map()
for (const file of vueFiles(root)) {
  for (const match of readFileSync(file, 'utf8').matchAll(REFERENCE)) {
    if (!read.has(match[1])) read.set(match[1], file.slice(root.length + 1))
  }
}

test('the scan finds theme tokens at all', () => {
  // Without this, a regex that stopped matching would turn the assertions below into two empty
  // lists compared against each other, and the contract would pass by describing nothing.
  assert.ok(read.size >= 5, `only found ${read.size} theme tokens — the scan is broken`)
})

test('every token a component reads is declared', () => {
  const undeclared = [...read]
    .filter(([token]) => !HOST_THEME_TOKENS.includes(token))
    .map(([token, file]) => `${token} (${file})`)

  assert.deepEqual(undeclared, [],
    'these are read by component CSS but not in HOST_THEME_TOKENS, so a host has no way to know it '
    + 'must define them')
})

test('every declared token is actually read', () => {
  // The other direction, because a contract that over-states is its own kind of wrong: it asks
  // hosts for palette entries nothing needs, and the next person cannot tell which entries are
  // load-bearing.
  const unread = HOST_THEME_TOKENS.filter((token) => !read.has(token))

  assert.deepEqual(unread, [],
    'these are declared as required but no component CSS reads them any more')
})
