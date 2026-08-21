// SPDX-License-Identifier: Apache-2.0
// Copyright (c) Cordango and contributors.
// Part of Cordango Web Controls, the shared Vue controls for Cordango applications: https://github.com/cordango/web-controls
// Licensed under the Apache License, Version 2.0. See LICENSE in the repository root.
// Extracted from the Cordango platform at web/src/ui/optionAccent.js. Until web/ consumes
// this package, that copy and this one are two files saying the same thing.

// Option colors originate in app manifests and are used as CSS values here. Keep the accepted
// shape deliberately narrow: field options and process states use six-digit hex colors, and a
// malformed/custom value should simply render like an ordinary option rather than reach CSS.
import { isBrandColor } from '../theme.js'

export function optionAccent(item) {
  const color = item?.raw?.color ?? item?.color
  return isBrandColor(color) ? color : null
}

export function optionAccentStyle(item) {
  const color = optionAccent(item)
  return color ? { '--ui-option-accent': color } : undefined
}
