// SPDX-License-Identifier: Apache-2.0
// Copyright (c) Cordango and contributors.
// Part of Cordango Web Controls, the shared Vue controls for Cordango applications: https://github.com/cordango/web-controls
// Licensed under the Apache License, Version 2.0. See LICENSE in the repository root.
// Extracted from the Cordango platform at web/src/filterMemory.js. Until web/ consumes this
// package, that copy and this one are two files saying the same thing: check both.

// Remembers what a filter bar is set to — its search text and facet selections — so a page comes back
// the way you left it instead of resetting to "everything" on every visit.
//
// DEVICE-local (localStorage), deliberately unlike column visibility/density, which roam per user
// through /api/me/settings: a filter changes on every keystroke and every tick (a PUT per change), and
// a filter set on a laptop silently applying on a phone reads as missing data rather than as a setting.
// Layout roams; working state stays on the machine it was typed on. One blob for everything:
//   cordango.filters.v1 -> { [handle]: { [scope]: { q, facets: { fieldOrStateKey: [values] }, at } } }
// `scope` is a surface's stable identity — the same string a table already uses as its settingsKey
// ('view:my_tasks', 'table:task:', 'child:project:task:project'), so two surfaces never collide.
//
// Every read and write is best-effort: localStorage can be disabled, full, or hold another app's
// garbage under our key, and none of that may break a page. A bad blob is treated as no memory.
const KEY = 'cordango.filters.v1'
const MAX_AGE_MS = 90 * 86400000   // a filter nobody has touched in three months isn't a preference
const timers = new Map()

function readAll() {
  try {
    const d = JSON.parse(localStorage.getItem(KEY) || '{}')
    return d && typeof d === 'object' && !Array.isArray(d) ? d : {}
  } catch { return {} }
}
function writeAll(all) { try { localStorage.setItem(KEY, JSON.stringify(all)) } catch { /* full or blocked */ } }

/** A selection is always a list ("any of"); a scalar from an older store reads as a one-element list. */
export function toList(v) { return Array.isArray(v) ? v : (v == null || v === '' ? [] : [v]) }

/** The remembered state for one surface, or null when there is nothing (or nothing recent) to restore. */
export function loadFilters(handle, scope) {
  if (!handle || !scope) return null
  const e = readAll()[handle]?.[scope]
  if (!e || typeof e !== 'object' || !(e.at > Date.now() - MAX_AGE_MS)) return null
  const facets = {}
  for (const [k, v] of Object.entries(e.facets ?? {})) if (toList(v).length) facets[k] = toList(v)
  const q = typeof e.q === 'string' ? e.q : ''
  return q || Object.keys(facets).length ? { q, facets } : null
}

/** Store one surface's filter state, debounced. A cleared bar DROPS its entry rather than storing an
 *  empty one — "no filters" is the default, and remembering it would keep the blob growing forever. */
export function saveFilters(handle, scope, { q = '', facets = {} } = {}) {
  if (!handle || !scope) return
  const id = `${handle}|${scope}`
  clearTimeout(timers.get(id))
  timers.set(id, setTimeout(() => {
    const all = readAll()
    const app = all[handle] ?? (all[handle] = {})
    const kept = {}
    for (const [k, v] of Object.entries(facets ?? {})) if (toList(v).length) kept[k] = toList(v)
    const text = typeof q === 'string' ? q.trim() : ''
    if (!text && !Object.keys(kept).length) delete app[scope]
    else app[scope] = { q: text, facets: kept, at: Date.now() }
    prune(all)
    writeAll(all)
  }, 300))
}

/** Drop stale/malformed entries (and apps left empty by that) on every write, so the blob stays small. */
function prune(all) {
  const cutoff = Date.now() - MAX_AGE_MS
  for (const [handle, scopes] of Object.entries(all)) {
    if (!scopes || typeof scopes !== 'object') { delete all[handle]; continue }
    for (const [scope, e] of Object.entries(scopes)) if (!(e?.at > cutoff)) delete scopes[scope]
    if (!Object.keys(scopes).length) delete all[handle]
  }
}
