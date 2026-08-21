// SPDX-License-Identifier: Apache-2.0
// Copyright (c) Cordango and contributors.
// Part of Cordango Web Controls, the shared Vue controls for Cordango applications: https://github.com/cordango/web-controls
// Licensed under the Apache License, Version 2.0. See LICENSE in the repository root.
// Extracted from the Cordango platform at web/src/tables/useTreeRows.js. Until web/ consumes this
// package, that copy and this one are two files saying the same thing: check both.

// Tree-mode row engine for UiDataTable, extracted verbatim so the table component stays a
// renderer: builds the flattened, indented row list from a self-referential parent field,
// owns the expand state, and injects the inline "add" placeholder rows (root adder at the
// bottom of the top level; child adder as the FIRST row of any expanded parent).
// `shape(row, depth)` is supplied by the caller — it decides what a rendered row carries.
import { ref, computed, unref, watch } from 'vue'

export function useTreeRows({ enabled, rows, parentField, rootParent, maxDepth, canAdd, shape, suppressAdders }) {
  const expandedIds = ref(new Set())

  const childrenMap = computed(() => {
    const m = new Map()
    if (!unref(enabled)) return m
    for (const r of unref(rows) || []) {
      const p = r[unref(parentField)] ?? null
      if (!m.has(p)) m.set(p, [])
      m.get(p).push(r)
    }
    return m
  })

  function adder(parentId, depth) {
    return { _raw: {}, id: 'adder:' + (parentId ?? '__root__'), _depth: depth, _adder: true, _parentId: parentId ?? null }
  }

  /** The natural top-level rows (children of rootParent) — what a grouped tree partitions. */
  const rootRows = computed(() => childrenMap.value.get(unref(rootParent) ?? null) ?? [])

  /** Flatten the given root rows (and their expanded subtrees) into rendered items. The caller
   *  owns the root list, so a grouped tree can walk each bucket's roots under its header row. */
  function buildItems(roots, depth = 0) {
    const out = []
    const suppress = unref(suppressAdders)
    const walk = (rs, d) => {
      for (const r of rs ?? []) {
        out.push(shape(r, d))
        if (d < unref(maxDepth) - 1 && expandedIds.value.has(r.id)) {
          if (!suppress) out.push(adder(r.id, d + 1))       // FIRST child = the add-a-subtask placeholder
          walk(childrenMap.value.get(r.id), d + 1)
        }
      }
    }
    walk(roots, depth)
    return out
  }

  const treeItems = computed(() => {
    const out = buildItems(rootRows.value, 0)
    if (unref(canAdd) && !unref(suppressAdders)) out.push(adder(null, 0)) // top level: add-row at the BOTTOM
    return out
  })

  // One-time: open existing parents so seeded nesting is visible without hunting for carets.
  let autoExpanded = false
  watch(() => unref(rows), rs => {
    if (!unref(enabled) || autoExpanded || !rs?.length) return
    const s = new Set()
    for (const r of rs) if ((childrenMap.value.get(r.id)?.length ?? 0) > 0) s.add(r.id)
    expandedIds.value = s
    autoExpanded = true
  }, { immediate: true })

  function canNest(depth) { return depth < unref(maxDepth) - 1 }
  function toggleExpand(id) { const s = new Set(expandedIds.value); s.has(id) ? s.delete(id) : s.add(id); expandedIds.value = s }
  /** Open every parent that has children in the CURRENT row set (used when a filter activates,
   *  so matching subtasks can't hide behind a collapsed parent). */
  function expandAll() {
    const s = new Set(expandedIds.value)
    for (const r of unref(rows) || []) if ((childrenMap.value.get(r.id)?.length ?? 0) > 0) s.add(r.id)
    expandedIds.value = s
  }

  return { childrenMap, rootRows, buildItems, makeAdder: adder, treeItems, expandedIds, canNest, toggleExpand, expandAll }
}
