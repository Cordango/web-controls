// SPDX-License-Identifier: Apache-2.0
// Copyright (c) Cordango and contributors.
// Part of Cordango Web Controls, the shared Vue controls for Cordango applications: https://github.com/cordango/web-controls
// Licensed under the Apache License, Version 2.0. See LICENSE in the repository root.
// Extracted from the Cordango platform at web/src/responsive.test.js. Until web/ consumes this
// package, that copy and this one are two files saying the same thing: check both.

import test from 'node:test'
import assert from 'node:assert/strict'
import { BANDS, modeForWidth, projectCols } from './responsive.js'

test('modeForWidth picks the band, boundaries inclusive', () => {
  assert.equal(modeForWidth(390), 'phone')
  assert.equal(modeForWidth(640), 'phone')
  assert.equal(modeForWidth(641), 'tablet')
  assert.equal(modeForWidth(820), 'tablet')
  assert.equal(modeForWidth(1000), 'tablet')
  assert.equal(modeForWidth(1001), 'desktop')
  assert.equal(modeForWidth(1920), 'desktop')
})

test('an unmeasured width assumes room rather than collapsing', () => {
  // The ResizeObserver has not fired yet, or the element is display:none. Guessing "phone" here
  // would collapse a desktop layout for a frame on every page load.
  for (const bad of [0, -1, NaN, undefined, null, 'wide'])
    assert.equal(modeForWidth(bad), 'desktop')
})

test('the permanent drawer and the content box agree about the band', () => {
  // A 1000px viewport minus the 268px permanent sidebar is 732px of content. Both readings land in
  // `tablet`, which is the property that lets the shell and the blocks share one band table.
  assert.equal(modeForWidth(1000), 'tablet')
  assert.equal(modeForWidth(1000 - 268), 'tablet')
})

test('projectCols never widens what the author asked for', () => {
  for (const px of [390, 820, 1440])
    for (const authored of [1, 2, 3, 4, 6])
      assert.ok(projectCols(authored, px) <= authored)
})

test('projectCols collapses to one column on a phone and caps at two on a tablet', () => {
  assert.equal(projectCols(3, 390), 1)
  assert.equal(projectCols(6, 390), 1)
  assert.equal(projectCols(3, 820), 2)
  assert.equal(projectCols(2, 820), 2)
  assert.equal(projectCols(1, 820), 1)
  assert.equal(projectCols(3, 1440), 3)
  assert.equal(projectCols(6, 1440), 6)
})

test('projectCols survives junk authored values', () => {
  // `cols` comes out of a generated App Definition, so it is input, not state.
  for (const junk of [0, -3, null, undefined, 'three', NaN, 2.7])
    assert.ok(projectCols(junk, 1440) >= 1)
  assert.equal(projectCols(2.7, 1440), 2)
})

test('the bands are ordered widest-last and end open', () => {
  // modeForWidth relies on find() hitting the narrowest matching band first.
  const maxes = BANDS.map(b => b.maxPx)
  assert.deepEqual(maxes, [...maxes].sort((a, b) => a - b))
  assert.equal(BANDS.at(-1).maxPx, Infinity)
})
