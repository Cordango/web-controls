// SPDX-License-Identifier: Apache-2.0
// Copyright (c) Cordango and contributors.
// Part of Cordango Web Controls, the shared Vue controls for Cordango applications: https://github.com/cordango/web-controls
// Licensed under the Apache License, Version 2.0. See LICENSE in the repository root.
// Extracted from the Cordango platform at web/src/views/timeRange.js. Until web/ consumes this
// package, that copy and this one are two files saying the same thing: check both.

// Week / month / year windowing for the DATE surfaces (the timeline lanes, the calendar grid).
//
// Every date surface used to hard-code its own window: the calendar was a month grid and nothing
// else, the timeline showed whatever fixed `count` of days the author wrote. A schedule is read at
// more than one zoom — this week, this month, the year — so the window is a user choice now, and it
// lives here rather than in either component so both zoom the same way and the maths is testable
// without a DOM.
//
// A window is a list of BUCKETS: contiguous, disjoint, half-open [date, next). Week and month
// windows bucket by DAY, a year buckets by MONTH — which is why a bar's position is a FRACTIONAL
// bucket index (`spanIn`) rather than a column count: a 3-day absence inside a year's August is
// a tenth of that column, not a whole one.
//
// All maths is on whole calendar days. Buckets are built from LOCAL dates (the user's month is the
// one on their wall) but compared as UTC day ordinals, so a DST boundary can never make a day 23 or
// 25 hours long and shift a bar by a fraction of a column.

export const RANGES = ['day', 'week', 'month', 'year']
export const RANGE_LABELS = { day: 'Day', week: 'Week', month: 'Month', year: 'Year' }

const DAY_MS = 86400000
const pad = n => String(n).padStart(2, '0')

/** A local Date → 'YYYY-MM-DD' (never via toISOString, which would shift the day by the offset). */
export function isoOf (d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` }

/** 'YYYY-MM-DD' (or an ISO datetime, or a Date) → a local midnight Date, or null if unparseable. */
export function parseDay (v) {
  if (v instanceof Date) return isNaN(v.getTime()) ? null : new Date(v.getFullYear(), v.getMonth(), v.getDate())
  const s = String(v ?? '').slice(0, 10)
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s)
  if (m) return new Date(+m[1], +m[2] - 1, +m[3])
  const d = new Date(v)
  return isNaN(d.getTime()) ? null : new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

/** Whole-day ordinal — the unit all window maths counts in. */
export function dayNum (v) {
  const d = parseDay(v)
  return d == null ? null : Math.round(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / DAY_MS)
}

/** The first day of the window `range` that CONTAINS `anchor` (Monday-start weeks). */
export function rangeStart (range, anchor) {
  const d = parseDay(anchor) ?? new Date()
  if (range === 'year') return new Date(d.getFullYear(), 0, 1)
  if (range === 'month') return new Date(d.getFullYear(), d.getMonth(), 1)
  // A day window starts on the anchor itself — it is already the whole window, so there is nothing
  // to snap back to.
  if (range === 'day') return new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const s = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  s.setDate(s.getDate() - ((s.getDay() + 6) % 7))   // getDay: 0=Sun → Monday-start
  return s
}

function bucket (start, next, unit, todayIso) {
  const id = isoOf(start)
  const dow = start.getDay()
  return {
    id, date: id, next: isoOf(next), unit,
    day: start.getDate(),
    month: start.getMonth(),
    weekday: start.toLocaleDateString(undefined, { weekday: 'short' }),
    label: unit === 'month'
      ? start.toLocaleDateString(undefined, { month: 'short' })
      : String(start.getDate()),
    isWeekend: unit === 'day' && (dow === 0 || dow === 6),
    isToday: unit === 'day' && id === todayIso,
    // The bucket the clock is in — for a month bucket that is the current month, which is what a
    // year window should highlight (no day of it is "today").
    isCurrent: todayIso >= id && todayIso < isoOf(next),
  }
}

/**
 * The window's buckets: 7 days for a week, that calendar month's days for a month, 12 months for a
 * year. `today` is injectable so the tests are not a function of the clock.
 */
export function rangeBuckets (range, anchor, today = isoOf(new Date())) {
  const start = rangeStart(range, anchor)
  const out = []
  if (range === 'year') {
    for (let i = 0; i < 12; i++) {
      out.push(bucket(new Date(start.getFullYear(), i, 1), new Date(start.getFullYear(), i + 1, 1), 'month', today))
    }
    return out
  }
  const n = range === 'day' ? 1
    : range === 'week' ? 7
      : new Date(start.getFullYear(), start.getMonth() + 1, 0).getDate()
  for (let i = 0; i < n; i++) {
    const s = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i)
    const e = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i + 1)
    out.push(bucket(s, e, 'day', today))
  }
  return out
}

/** Move the anchor one whole window forward (dir 1) or back (dir -1), snapped to the window edge. */
export function shiftAnchor (range, anchor, dir) {
  const s = rangeStart(range, anchor)
  if (range === 'year') return isoOf(new Date(s.getFullYear() + dir, 0, 1))
  if (range === 'month') return isoOf(new Date(s.getFullYear(), s.getMonth() + dir, 1))
  if (range === 'day') return isoOf(new Date(s.getFullYear(), s.getMonth(), s.getDate() + dir))
  return isoOf(new Date(s.getFullYear(), s.getMonth(), s.getDate() + dir * 7))
}

/** What the nav reads out: '4 – 10 Aug 2026' · 'August 2026' · '2026'. */
export function rangeLabel (range, anchor) {
  const s = rangeStart(range, anchor)
  if (range === 'year') return String(s.getFullYear())
  if (range === 'month') return s.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
  // A single day names its weekday: reading "Wednesday" is what tells you where you are in a
  // schedule, and the date alone does not.
  if (range === 'day') return s.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  const e = new Date(s.getFullYear(), s.getMonth(), s.getDate() + 6)
  const from = s.toLocaleDateString(undefined, s.getMonth() === e.getMonth() ? { day: 'numeric' } : { day: 'numeric', month: 'short' })
  return `${from} – ${e.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}`
}

/**
 * The range a surface OPENS at. An explicit `range` wins; otherwise the authored axis is read as
 * intent — a fortnight of days is a month's worth of zoom, a month-stepped axis is a year.
 */
export function inferRange (axis) {
  if (!axis) return 'month'
  if (RANGES.includes(axis.range)) return axis.range
  if (axis.step === 'month') return 'year'
  const n = Number(axis.count) || 0
  if (axis.step === 'week') return n > 6 ? 'year' : 'month'
  if (!n) return 'month'
  if (n === 1) return 'day'
  if (n <= 7) return 'week'
  if (n <= 62) return 'month'
  return 'year'
}

/**
 * Stack overlapping bars into sub-rows within one lane (greedy interval packing): each bar gets the
 * first row whose last bar ends before it starts. Two absences on the same person used to draw ON
 * TOP of each other; zoomed out to a year that is the normal case, not the exception. Mutates each
 * bar with `row` and returns how many rows the lane needs.
 */
export function packRows (bars) {
  const ends = []
  for (const b of [...bars].sort((x, y) => x.leftPct - y.leftPct)) {
    const end = b.leftPct + b.widthPct
    let row = ends.findIndex(e => e <= b.leftPct + 1e-9)
    if (row === -1) { row = ends.length; ends.push(end) } else ends[row] = end
    b.row = row
  }
  return Math.max(1, ends.length)
}

/**
 * Lay overlapping items SIDE BY SIDE (greedy interval packing over a numeric [from, to)).
 *
 * The same algorithm as `packRows`, and deliberately in the same file — but the output is `col` of
 * `cols` rather than `row`, because a day column and a timeline lane want opposite things from an
 * overlap. A lane stacks two absences vertically, one above the other, and that reads correctly.
 * A schedule must NOT: two meetings at ten o'clock are both an hour tall, and stacking them would
 * make one of them look like a fifteen-minute meeting at half past.
 *
 * `cols` is per CLUSTER, not per day: three meetings in the morning must not squeeze the afternoon's
 * single meeting into a third of the width. Items are mutated with `col`/`cols`.
 */
export function packColumns (items) {
  const sorted = [...items].sort((a, b) => a.from - b.from || a.to - b.to)
  let cluster = []
  let clusterEnd = -Infinity
  const ends = []                                    // per-column end, reset with each cluster

  const close = () => {
    const cols = Math.max(1, ends.length)
    for (const it of cluster) it.cols = cols
    cluster = []
    ends.length = 0
  }

  for (const it of sorted) {
    // A gap with nothing running through it ends the cluster — everything after it is independent.
    if (it.from >= clusterEnd && cluster.length) close()
    let col = ends.findIndex(e => e <= it.from + 1e-9)
    if (col === -1) { col = ends.length; ends.push(it.to) } else ends[col] = it.to
    it.col = col
    cluster.push(it)
    clusterEnd = Math.max(clusterEnd, it.to)
  }
  if (cluster.length) close()
  return sorted
}

/**
 * Where a record's bar lands in the window, as percentages of the whole track — or null when it
 * falls entirely outside it. `end` is INCLUSIVE (a one-day record is start..start), so the bar's
 * right edge is the start of the day AFTER it. `clipL`/`clipR` say the record continues past the
 * window, which the surface draws as a flat edge.
 */
export function spanIn (buckets, start, end) {
  if (!buckets.length) return null
  const s = dayNum(start)
  if (s == null) return null
  const e = dayNum(end) ?? s
  const endEx = Math.max(s, e) + 1                        // half-open: the bar ends where the next day starts
  const lo = dayNum(buckets[0].date)
  const hi = dayNum(buckets[buckets.length - 1].next)
  if (endEx <= lo || s >= hi) return null
  const cols = buckets.length
  const pos = n => {
    if (n <= lo) return 0
    if (n >= hi) return cols
    for (let i = 0; i < cols; i++) {
      const a = dayNum(buckets[i].date), b = dayNum(buckets[i].next)
      if (n < b) return i + (n - a) / (b - a)             // fractional: a day inside a MONTH bucket
    }
    return cols
  }
  const a = pos(s), b = pos(endEx)
  return {
    leftPct: (a / cols) * 100,
    widthPct: ((b - a) / cols) * 100,
    clipL: s < lo,
    clipR: endEx > hi,
  }
}
