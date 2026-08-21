// SPDX-License-Identifier: Apache-2.0
// Copyright (c) Cordango and contributors.
// Part of Cordango Web Controls, the shared Vue controls for Cordango applications: https://github.com/cordango/web-controls
// Licensed under the Apache License, Version 2.0. See LICENSE in the repository root.
// Extracted from the Cordango platform at web/src/tables/useTableFiltering.js. Until web/ consumes this
// package, that copy and this one are two files saying the same thing: check both.

// The always-visible filterBar (search + facet dropdowns) shared by table surfaces — the same
// authored shape ($defs/filterBar) PrimRepeat renders over card grids, applied to table rows.
// Client-side: search matches RESOLVED text (a person reference matches the person's name),
// facets are MULTI-value dropdowns over select options / distinct resolved reference values — a
// selection is a list read as "any of", and an empty list doesn't filter (see UiFacetSelect).
// Tree mode keeps the ANCESTORS of matching rows so a matching subtask stays reachable under
// its parent chain (the parents render as context, not as matches).
// With `handle` + `scopeKey` the bar REMEMBERS its state per device (see filterMemory) — the surface's
// settingsKey is its identity there, so the filters and the columns of one table stay in step.
import { ref, computed, unref, watch } from 'vue'
import { optionsOf, optionLabel, personName } from '../manifest.js'
import { loadFilters, saveFilters, toList } from '../filterMemory.js'

export function useTableFiltering({ rows, filterBar, fields, refMaps, tree, parentField, handle, scopeKey }) {
  const searchQ = ref('')
  const facetSel = ref({})            // fieldKey -> selected values (empty/absent = all)

  const fmap = computed(() => Object.fromEntries((unref(fields) || []).map(f => [f.key, f])))
  const fb = computed(() => unref(filterBar) || null)

  function resolvedText(row, key) {
    const f = fmap.value[key]
    const v = row?.[key]
    if (v == null || v === '') return ''
    if (f?.type === 'reference' && f?.targetApp === 'platform' && f?.targetEntity === 'person') return personName(v) || String(v)
    if (f?.type === 'reference') return String(unref(refMaps)?.[key]?.[v] ?? v)
    if (f?.type === 'select') return optionLabel(f, v) || String(v)
    return String(v)
  }

  const facetFields = computed(() => (fb.value?.facets || []).map(k => fmap.value[k]).filter(Boolean))
  function facetItems(f) {
    if (['select', 'multiselect'].includes(f.type))
      return optionsOf(f).map(o => ({ value: o.value, title: o.label, color: o.color }))
    const seen = new Map()              // reference facet: distinct resolved values from the loaded rows
    for (const r of unref(rows) || []) {
      const v = r[f.key]
      if (v != null && v !== '' && !seen.has(v)) seen.set(v, resolvedText(r, f.key))
    }
    return [...seen].map(([value, title]) => ({ value, title })).sort((a, b) => String(a.title).localeCompare(String(b.title)))
  }

  // A facet selection is a LIST of values ("any of"); a scalar is tolerated as a one-element list.
  const selOf = k => toList(facetSel.value[k])

  // --- remembered state -----------------------------------------------------------------------
  // Restore when the surface's identity appears/changes (a table swapping views is a different bar),
  // then write every change back. A remembered facet whose field is gone is simply never read: the
  // matcher only walks the CURRENT filterBar's facets.
  const memoKey = computed(() => (unref(handle) && fb.value) ? (unref(scopeKey) || '') : '')
  watch(memoKey, k => {
    const saved = k ? loadFilters(unref(handle), k) : null
    searchQ.value = saved?.q ?? ''
    facetSel.value = saved?.facets ?? {}
  }, { immediate: true })
  watch([searchQ, facetSel], () => {
    if (memoKey.value) saveFilters(unref(handle), memoKey.value, { q: searchQ.value, facets: facetSel.value })
  }, { deep: true })

  const fbActive = computed(() => !!fb.value
    && (!!searchQ.value?.trim() || Object.keys(facetSel.value).some(k => selOf(k).length)))

  function matches(r) {
    const q = searchQ.value?.trim().toLowerCase() || ''
    const sfields = fb.value?.search || []
    if (q && sfields.length && !sfields.some(k => resolvedText(r, k).toLowerCase().includes(q))) return false
    for (const k of fb.value?.facets || []) {
      const sel = selOf(k)
      if (!sel.length) continue
      const v = r[k]                    // a multiselect cell matches when it holds ANY selected value
      if (!sel.some(s => Array.isArray(v) ? v.includes(s) : v === s)) return false
    }
    return true
  }

  const fbRows = computed(() => {
    const src = unref(rows) || []
    if (!fbActive.value) return src
    const keep = new Set()
    for (const r of src) if (matches(r)) keep.add(r.id)
    if (unref(tree)) {
      const byId = new Map(src.map(r => [r.id, r]))
      const pf = unref(parentField)
      for (const r of src) {
        if (!keep.has(r.id)) continue
        let p = r[pf]
        while (p != null && byId.has(p) && !keep.has(p)) { keep.add(p); p = byId.get(p)[pf] }
      }
    }
    return src.filter(r => keep.has(r.id))
  })

  function clear() { searchQ.value = ''; facetSel.value = {} }

  return { searchQ, facetSel, fb, fbActive, fbRows, facetFields, facetItems, clear }
}
