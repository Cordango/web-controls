<!--
  SPDX-License-Identifier: Apache-2.0
  Copyright (c) Cordango and contributors.
  Part of Cordango Web Controls, the shared Vue controls for Cordango applications: https:  github.com/cordango/web-controls
  Licensed under the Apache License, Version 2.0. See LICENSE in the repository root.
  Extracted from the Cordango platform at web/src/ui/ChartCard.vue. Until web/ consumes
  this package, that copy and this one are two files saying the same thing.
-->

<script setup>
// Real charts (Chart.js) for the widget contract's chartTypes: bar | line | pie | donut | area.
// Data arrives pre-aggregated ({labels, values, colors}); this component only draws. Colors follow
// the theme via resolved CSS vars (canvas can't read var() itself). Bars render horizontal — they
// replace the old CSS bar rows and share their reading direction.
import { ref, onMounted, onBeforeUnmount, watch } from 'vue'
import Chart from 'chart.js/auto'

const props = defineProps({
  kind: { type: String, default: 'bar' },          // bar | line | pie | donut | area
  labels: { type: Array, default: () => [] },
  values: { type: Array, default: () => [] },
  colors: { type: Array, default: () => [] },
  height: { type: Number, default: 220 },
  // Multi-series (Home widgets comparing apps): [{ label, values, color }]. Null keeps the original
  // single-dataset behavior byte-identical for every existing caller. Circular kinds can't stack
  // series — callers send one dataset there (the widget editor forbids more).
  datasets: { type: Array, default: null },
  // Deep-linkable charts: segment clicks emit 'select' with the bucket index (pointer cursor on hover).
  clickable: { type: Boolean, default: false },
})
const emit = defineEmits(['select'])

const canvas = ref(null)
let chart = null

function themeRgb(name, alpha) {
  const v = getComputedStyle(document.documentElement).getPropertyValue(`--v-theme-${name}`).trim()
  return v ? `rgba(${v}, ${alpha})` : `rgba(128,128,128,${alpha})`
}

function build() {
  if (!canvas.value) return
  chart?.destroy()
  const text = themeRgb('on-surface', 0.65)
  const grid = themeRgb('on-surface', 0.08)
  const accent = props.colors[0] || themeRgb('primary', 1)
  const circular = props.kind === 'pie' || props.kind === 'donut'
  const type = circular ? (props.kind === 'donut' ? 'doughnut' : 'pie')
    : props.kind === 'area' ? 'line' : props.kind
  const horizontalBar = props.kind === 'bar'

  const multi = props.datasets?.length
    ? props.datasets.slice(0, circular ? 1 : props.datasets.length).map(d => ({
        label: d.label,
        data: d.values,
        backgroundColor: circular ? props.colors : d.color,
        borderColor: circular ? themeRgb('surface', 1) : d.color,
        borderWidth: 2,
        fill: props.kind === 'area',
        tension: 0.3,
        pointRadius: (d.values?.length ?? 0) > 20 ? 0 : 3,
        borderRadius: props.kind === 'bar' ? 4 : 0,
      }))
    : null

  chart = new Chart(canvas.value, {
    type,
    data: {
      labels: props.labels,
      datasets: multi ?? [{
        data: props.values,
        backgroundColor: circular || props.kind === 'bar' ? props.colors : (accent + ''),
        borderColor: circular ? themeRgb('surface', 1) : accent,
        borderWidth: circular ? 2 : 2,
        fill: props.kind === 'area',
        tension: 0.3,
        pointRadius: props.values.length > 20 ? 0 : 3,
        borderRadius: props.kind === 'bar' ? 4 : 0,
      }],
    },
    options: {
      indexAxis: horizontalBar ? 'y' : 'x',
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 250 },
      onClick: (_, els) => { if (props.clickable && els?.length) emit('select', els[0].index) },
      onHover: (e, els) => {
        if (props.clickable && e?.native?.target) e.native.target.style.cursor = els?.length ? 'pointer' : 'default'
      },
      plugins: {
        legend: circular
          ? { position: 'right', labels: { color: text, boxWidth: 12, font: { size: 12 } } }
          : multi && multi.length > 1
            ? { position: 'bottom', labels: { color: text, boxWidth: 12, font: { size: 12 } } }
            : { display: false },
        tooltip: { intersect: false },
      },
      scales: circular ? {} : {
        x: { ticks: { color: text, font: { size: 11 } }, grid: { color: horizontalBar ? grid : 'transparent' } },
        y: { ticks: { color: text, font: { size: 11 } }, grid: { color: horizontalBar ? 'transparent' : grid } },
      },
    },
  })
}

watch(() => [props.kind, props.labels, props.values, props.colors, props.datasets], build, { deep: true })
onMounted(build)
onBeforeUnmount(() => chart?.destroy())
</script>

<template>
  <div class="chart-card" :style="{ height: height + 'px' }">
    <canvas ref="canvas" />
  </div>
</template>

<style scoped>
.chart-card { position: relative; width: 100%; }
</style>
