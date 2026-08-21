// SPDX-License-Identifier: Apache-2.0
// Copyright (c) Cordango and contributors.
// Part of Cordango Web Controls, the shared Vue controls for Cordango applications: https://github.com/cordango/web-controls
// Licensed under the Apache License, Version 2.0. See LICENSE in the repository root.
// Extracted from the Cordango platform at web/src/views/inlineCreate.js. Until web/ consumes this
// package, that copy and this one are two files saying the same thing: check both.

import { applyFilters, resolveExpr, resolveFilters } from '../manifest.js'

/**
 * What a row typed into an inline add row starts with.
 *
 * Two contributions, explicit winning:
 *
 * - INFERRED — every `eq` filter on the table's source. A list filtered to `my_day eq true` gives a
 *   new row `my_day: true` without being told, which is the direct analogue of a child record
 *   getting its parent from `via`. Only `eq`: a comparison says which rows to SHOW, not what a new
 *   one should BE, so `due_on lte {{today}}` implies no default at all.
 * - AUTHORED — `block.newDefaults`, for exactly what a filter cannot imply. A Today list needs
 *   `{ due_on: "{{today}}" }`, which no `lte` filter can produce.
 *
 * A filter with a `path` is skipped: it constrains a REFERENCED record's field, and setting that
 * would mean creating or picking the other record too.
 */
export function newRowDefaults(filters, authored, scopes) {
  const out = {}
  for (const f of resolveFilters(filters ?? [], scopes)) {
    if (f.operator !== 'eq' || f.path || f.field == null) continue
    if (f.value === undefined || f.value === null) continue
    out[f.field] = f.value
  }
  for (const [key, value] of Object.entries(authored ?? {})) out[key] = resolveExpr(value, scopes)
  return out
}

/**
 * Whether a row built from those defaults would survive the table's own filters.
 *
 * **The property that makes an inline add row honest.** Without it, a filtered list shows an add
 * row, accepts what you type, and the record vanishes on the next load — an affordance that looks
 * like it works and does not. Answered by running the REAL `applyFilters` over a prospective row,
 * so the check and the display cannot disagree about what the filter means.
 *
 * An unfiltered table always passes; there is nothing for the row to fall out of.
 */
export function newRowWouldSurvive(defaults, filters, titleKey, scopes) {
  const resolved = resolveFilters(filters ?? [], scopes)
  if (!resolved.length) return true

  const probe = { ...defaults }
  // A title the author will type — some lists filter on it being non-empty, and a probe with none
  // would fail a check the real row passes.
  if (titleKey && probe[titleKey] === undefined) probe[titleKey] = 'x'

  return applyFilters([probe], resolved).length === 1
}
