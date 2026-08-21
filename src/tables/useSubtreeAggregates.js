// SPDX-License-Identifier: Apache-2.0
// Copyright (c) Cordango and contributors.
// Part of Cordango Web Controls, the shared Vue controls for Cordango applications: https://github.com/cordango/web-controls
// Licensed under the Apache License, Version 2.0. See LICENSE in the repository root.
// Extracted from the Cordango platform at web/src/tables/useSubtreeAggregates.js. Until web/ consumes this
// package, that copy and this one are two files saying the same thing: check both.

// Subtree sums for tree tables — the display half of `field.treeAggregate: "sum"`.
// Post-order walk over the children map: every row gets, per flagged field, the sum of its OWN
// value plus its whole subtree. The table renders a parent as `own (total)` — 'Estimated 14 (40)'.
// Display-only by design: server rollups already count every row (rule A — a parent's own value
// covers only its own direct work), so this never writes anything.
import { computed, unref } from 'vue'

export function useSubtreeAggregates({ enabled, childrenMap, rows, aggFields }) {
  const sums = computed(() => {
    const m = new Map()
    if (!unref(enabled)) return m
    const fields = unref(aggFields) || []
    if (!fields.length) return m
    const cm = unref(childrenMap)
    const walk = r => {
      if (m.has(r.id)) return m.get(r.id)
      const acc = {}
      for (const f of fields) acc[f] = Number(r[f]) || 0
      for (const c of cm.get(r.id) ?? []) {
        const child = walk(c)
        for (const f of fields) acc[f] += child[f]
      }
      m.set(r.id, acc)
      return acc
    }
    for (const r of unref(rows) ?? []) walk(r)
    return m
  })
  return { sums }
}
