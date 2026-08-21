<!--
  SPDX-License-Identifier: Apache-2.0
  Copyright (c) Cordango and contributors.
  Part of Cordango Web Controls, the shared Vue controls for Cordango applications: https:  github.com/cordango/web-controls
  Licensed under the Apache License, Version 2.0. See LICENSE in the repository root.
  Extracted from the Cordango platform at web/src/ui/UiChip.vue. Until web/ consumes
  this package, that copy and this one are two files saying the same thing.
-->

<script setup>
import { computed } from 'vue'

// A colored status pill. Takes any hex color and picks a readable text color automatically,
// so status/select colors from the manifest render correctly regardless of the palette.
const props = defineProps({
  color: { type: String, default: '#64748b' },
})

const fg = computed(() => {
  const hex = (props.color || '').replace('#', '')
  if (hex.length !== 6) return '#ffffff'
  const r = parseInt(hex.slice(0, 2), 16), g = parseInt(hex.slice(2, 4), 16), b = parseInt(hex.slice(4, 6), 16)
  // relative luminance → dark text on light bg, white on dark
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return lum > 0.6 ? '#1e293b' : '#ffffff'
})
</script>

<template>
  <span class="ui-chip" :style="{ backgroundColor: color, color: fg }"><slot /></span>
</template>

<style scoped>
.ui-chip {
  display: inline-flex;
  align-items: center;
  padding: 2px 10px;
  border-radius: 9999px;
  font-size: 12px;
  font-weight: 600;
  line-height: 1.7;
  white-space: nowrap;
}
</style>
