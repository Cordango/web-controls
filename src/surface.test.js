// SPDX-License-Identifier: Apache-2.0
// Copyright (c) Cordango and contributors.
// Part of Cordango Web Controls, the shared Vue controls for Cordango applications: https://github.com/cordango/web-controls
// Licensed under the Apache License, Version 2.0. See LICENSE in the repository root.

// The package surface is what consumers get, so it is worth asserting rather than assuming.
//
// The bug that produced this file: `mediaUrl` was exported by both theme.js and host.js, and two
// `export *` sources offering one name is ambiguous. ES modules do not warn about that, they drop
// the name. So the package silently shipped without `mediaUrl` and the only symptom was a consumer
// getting `undefined is not a function` at run time, in a build that had reported success.

import test from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) return walk(p)
    return p.endsWith('.js') && !p.endsWith('.test.js') ? [p] : []
  })
}

/** Every name a module exports, however it spells the export. */
function exportsOf(file) {
  const text = readFileSync(file, 'utf8')
  const names = []
  for (const m of text.matchAll(/^export (?:async )?(?:function|const|let|class) (\w+)/gm)) names.push(m[1])
  for (const m of text.matchAll(/^export \{([^}]*)\}(?!\s*from)/gm)) {
    for (const part of m[1].split(',')) {
      const n = part.trim().split(/\s+as\s+/).pop()?.trim()
      if (n) names.push(n)
    }
  }
  return names
}

test('no two star-exported modules offer the same name', () => {
  const index = readFileSync(join(here, 'index.js'), 'utf8')
  const starred = [...index.matchAll(/export \* from '\.\/([\w./-]+)'/g)].map((m) => m[1])
  assert.ok(starred.length > 5, 'expected the index to star-export the module layer')

  // Names the index re-exports explicitly are deliberate winners, not collisions.
  const explicit = new Set(
    [...index.matchAll(/export \{([^}]*)\} from/g)]
      .flatMap((m) => m[1].split(',').map((p) => p.trim().split(/\s+as\s+/)[0].trim()))
      .filter(Boolean),
  )

  const owners = new Map()
  for (const rel of starred) {
    for (const name of exportsOf(join(here, rel))) {
      if (explicit.has(name)) continue
      owners.set(name, [...(owners.get(name) ?? []), rel])
    }
  }

  const ambiguous = [...owners.entries()].filter(([, mods]) => mods.length > 1)
  assert.deepEqual(
    ambiguous.map(([n, m]) => `${n} (${m.join(' + ')})`),
    [],
    'these names come from more than one star-exported module and will be dropped silently',
  )
})

test('every module in src is reachable from the index', () => {
  const index = readFileSync(join(here, 'index.js'), 'utf8')
  const missing = walk(here)
    .map((p) => p.slice(here.length + 1).split(String.fromCharCode(92)).join('/'))
    .filter((rel) => rel !== 'index.js')
    // Components are exported by name rather than by star, so match on the path either way.
    .filter((rel) => !index.includes(`'./${rel}'`))

  assert.deepEqual(missing, [], 'these modules are in the package but nothing exports them')
})
