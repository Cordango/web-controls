// SPDX-License-Identifier: Apache-2.0
// Copyright (c) Cordango and contributors.
// Part of Cordango Web Controls, the shared Vue controls for Cordango applications: https://github.com/cordango/web-controls
// Licensed under the Apache License, Version 2.0. See LICENSE in the repository root.
// Extracted from the Cordango platform at web/src/tables/useSemanticDates.js. Until web/ consumes this
// package, that copy and this one are two files saying the same thing: check both.

// Semantic date + status-phase helpers for row surfaces (tables, and later boards/gantt).
//
// Reads TWO explicit schema semantics — never guesses from field types or defaults:
//   • options[].phase on the entity's role:'status' select ('not_started' | 'active' | 'done' |
//     'cancelled') — for a process-governed field the compiler copies each state's phase onto its
//     option, so the options array is the one transport either way.
//   • field.role 'start' / 'due' on date/datetime fields — the entity's semantic dates.
//
// From those it derives the row affordances: the done check, and date-cell urgency
// (overdue / due-soon / late-start). No phase declared → no affordance, by design.
import { computed, unref } from 'vue'
import { fmtDate, fmtDateTime } from '../manifest.js'

const DAY_MS = 86400000
const SOON_DAYS = 10

export function useSemanticDates(fields) {
  const statusField = computed(() => (unref(fields) || []).find(f => f?.role === 'status') || null)
  const phaseByValue = computed(() => {
    const m = {}
    for (const o of statusField.value?.options || []) if (o.phase) m[o.value] = o.phase
    return m
  })
  function phaseOf(row) {
    const f = statusField.value
    return f ? (phaseByValue.value[row?.[f.key]] ?? null) : null
  }
  const isDone = row => phaseOf(row) === 'done'
  // done AND cancelled stop the due-date warnings — closed work has no deadline pressure.
  const isClosed = row => { const p = phaseOf(row); return p === 'done' || p === 'cancelled' }
  const isNotStarted = row => phaseOf(row) === 'not_started'

  function startOfToday() { const d = new Date(); d.setHours(0, 0, 0, 0) ; return d.getTime() }

  /** '' | 'over' | 'soon' — the urgency of this date cell for this row.
   *  due-role & row not closed: past = 'over', within 10 days = 'soon'.
   *  start-role & row not started: past = 'over' (should have begun already). */
  function dateUrgency(field, row) {
    if (!field?.role || !row) return ''
    const v = row[field.key]
    if (v == null || v === '') return ''
    const t = new Date(v).getTime()
    if (isNaN(t)) return ''
    const today = startOfToday()
    if (field.role === 'due' && !isClosed(row)) {
      if (t < today) return 'over'
      if (t <= today + SOON_DAYS * DAY_MS) return 'soon'
    }
    if (field.role === 'start' && isNotStarted(row) && t < today) return 'over'
    return ''
  }

  function fmtDateCell(field, v) { return field?.type === 'datetime' ? fmtDateTime(v) : fmtDate(v) }

  return { statusField, phaseOf, isDone, isClosed, isNotStarted, dateUrgency, fmtDateCell }
}
