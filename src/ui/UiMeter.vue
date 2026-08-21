<!--
  SPDX-License-Identifier: Apache-2.0
  Copyright (c) Cordango and contributors.
  Part of Cordango Web Controls, the shared Vue controls for Cordango applications: https:  github.com/cordango/web-controls
  Licensed under the Apache License, Version 2.0. See LICENSE in the repository root.
  Extracted from the Cordango platform at web/src/ui/UiMeter.vue. Until web/ consumes
  this package, that copy and this one are two files saying the same thing.
-->

<script setup>
// The progress/share bar under a tile value, and — with `label` — the fat labelled bar a list row
// uses. Extracted from StatTiles so the tile row and a stat inside a repeat draw the SAME meter: a
// holding's share of the portfolio should not look different depending on which block rendered it.
defineProps({
  // 0-100; null renders nothing (no denominator, or a zero one).
  pct: { type: Number, default: null },
  // Printed INSIDE the bar (a percentage, usually). The labelled variant is taller and fills with a
  // wash rather than the solid gradient — text has to stay readable over both the filled part and
  // the empty track, and one translucent fill does that without a second clipped text layer.
  label: { type: String, default: null },
})
</script>

<template>
  <div v-if="pct !== null" class="ui-meter" :class="{ labelled: label != null }">
    <span :style="{ width: pct + '%' }" />
    <div v-if="label != null" class="ui-meter-label">{{ label }}</div>
  </div>
</template>

<style scoped>
.ui-meter { position: relative; width: 100%; height: 6px; border-radius: 999px;
  background: rgb(var(--v-theme-surface-2)); overflow: hidden; margin-top: 9px; }
.ui-meter > span { display: block; height: 100%; border-radius: 999px;
  background: linear-gradient(90deg, rgb(var(--v-theme-primary)), rgba(var(--v-theme-primary), .65)); }

.ui-meter.labelled { height: 22px; border-radius: 6px; margin-top: 0; }
.ui-meter.labelled > span { border-radius: 6px;
  background: linear-gradient(90deg, rgba(var(--v-theme-primary), .42), rgba(var(--v-theme-primary), .26)); }
.ui-meter-label { position: absolute; inset: 0; display: flex; align-items: center; padding: 0 8px;
  font-size: 12px; font-weight: 700; font-variant-numeric: tabular-nums;
  color: rgba(var(--v-theme-on-surface), .82); }
</style>
