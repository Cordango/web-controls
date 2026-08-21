// SPDX-License-Identifier: Apache-2.0
// Copyright (c) Cordango and contributors.
// Part of Cordango Web Controls, the shared Vue controls for Cordango applications: https://github.com/cordango/web-controls
// Licensed under the Apache License, Version 2.0. See LICENSE in the repository root.
// Extracted from the Cordango platform at web/src/tables/useTableGrouping.js. Until web/ consumes this
// package, that copy and this one are two files saying the same thing: check both.

// Row-grouping engine for UiDataTable: partitions rows into the ordered, labeled buckets a
// grouped table renders (group header rows are synthetic `_group` items the cell templates
// guard for, exactly like `_adder` rows). Pure partitioning — WHO gets partitioned differs by
// mode (flat: all rows; tree: top-level rows only, subtrees stay nested) and stays the caller's
// call. Groups come pre-ordered from tableGroups.resolveGroups; leftover rows land in a trailing
// "(No section)" bucket.
import { computed, unref } from 'vue'

export function useTableGrouping({ groupField, groups, ungroupedLabel, showEmpty }) {
  const on = computed(() => !!unref(groupField) && Array.isArray(unref(groups)) && unref(groups).length > 0)

  /** Partition `rows` into ordered buckets: [{ id, label, rows }]. Empty groups are dropped
   *  unless `showEmpty`; rows with no (or an unknown) group value trail in the ungrouped bucket. */
  function partition(rows) {
    const gf = unref(groupField)
    const list = unref(groups) || []
    const byId = new Map(list.map(g => [g.id, []]))
    const rest = []
    for (const r of rows || []) {
      const v = r?.[gf]
      if (v != null && byId.has(v)) byId.get(v).push(r)
      else rest.push(r)
    }
    const out = []
    for (const g of list) {
      const rs = byId.get(g.id)
      if (rs.length || unref(showEmpty)) out.push({ id: g.id, label: g.label, rows: rs })
    }
    if (rest.length) out.push({ id: null, label: unref(ungroupedLabel) || '(No section)', rows: rest })
    return out
  }

  /** The synthetic header row a bucket renders as (`_gid` = the raw group id, null for ungrouped). */
  function groupRow(bucket) {
    return { _raw: {}, id: 'group:' + (bucket.id ?? '__none__'), _group: true, _gid: bucket.id, _label: bucket.label, _count: bucket.rows.length }
  }

  return { on, partition, groupRow }
}
