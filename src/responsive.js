// SPDX-License-Identifier: Apache-2.0
// Copyright (c) Cordango and contributors.
// Part of Cordango Web Controls, the shared Vue controls for Cordango applications: https://github.com/cordango/web-controls
// Licensed under the Apache License, Version 2.0. See LICENSE in the repository root.
// Extracted from the Cordango platform at web/src/responsive.js. Until web/ consumes this
// package, that copy and this one are two files saying the same thing: check both.

// One definition of "how much room is there" for the whole shell and runtime.
//
// TWO MEASUREMENTS, deliberately. `home/layout.js` already learned this the hard way and says so:
// "the shell owns a 268px sidebar, so the window is a lie". While the drawer is permanent the
// viewport overstates the content box by 268px, and a block that sizes itself off `window` will
// over-pack every time. So:
//
//   • SHELL decisions (drawer mode, app bar, flyout width, fullscreen dialogs) read the VIEWPORT —
//     they are deciding about the window itself, so the window is the right question.
//   • BLOCK decisions (how many columns, table-vs-cards, label widths) read the CONTENT WIDTH,
//     provided once by the runtime host and injected wherever it is needed.
//
// The bands are shared between the two, so "tablet" means the same amount of room either way: at a
// 1000px viewport the permanent drawer leaves 732px of content, which lands in the tablet band from
// both directions.
//
// Kept separate from home/layout.js on purpose. That module solves a different problem (projecting a
// STORED 12-column arrangement onto fewer columns, losslessly enough to render but not to edit) and
// its tests pin its numbers. This one is about authored intent, which has no stored coordinates.
import { computed, inject, onBeforeUnmount, onMounted, provide, readonly, ref, shallowRef } from 'vue'
import { useDisplay } from 'vuetify'

/** Width bands, widest-last. `maxPx` is inclusive. */
export const BANDS = [
  { maxPx: 640, mode: 'phone' },
  { maxPx: 1000, mode: 'tablet' },
  { maxPx: Infinity, mode: 'desktop' },
]

/** The band a given pixel width falls in. Pure, so it can be tested without a DOM. */
export function modeForWidth(px) {
  const w = Number(px)
  if (!Number.isFinite(w) || w <= 0) return 'desktop'   // unmeasured → assume room, never mis-collapse
  return (BANDS.find(b => w <= b.maxPx) ?? BANDS[BANDS.length - 1]).mode
}

/**
 * How many columns to actually render, given what the author asked for.
 *
 * THE GOVERNING RULE of this whole layer: the authored layout is the WIDEST layout. An App
 * Definition saying `cols: 3` means "three across when there is room", not "three across always".
 * That is what lets the entire mobile pass happen with no schema change and no generator change.
 */
export function projectCols(authored, px) {
  const n = Math.max(1, Math.floor(Number(authored) || 1))
  const mode = modeForWidth(px)
  if (mode === 'phone') return 1
  if (mode === 'tablet') return Math.min(n, 2)
  return n
}

function bandRefs(width) {
  const mode = computed(() => modeForWidth(width.value))
  return {
    width: readonly(width),
    mode,
    phone: computed(() => mode.value === 'phone'),
    tablet: computed(() => mode.value === 'tablet'),
    desktop: computed(() => mode.value === 'desktop'),
  }
}

/**
 * Viewport bands — for the shell only.
 *
 * `desktop` is also the answer to "may the navigation drawer stay permanent": below it the drawer
 * has to become temporary, because 268px of a narrow window is most of the window.
 */
export function useViewport() {
  const display = useDisplay()
  return bandRefs(computed(() => display.width.value))
}

/**
 * Width for a right-hand flyout drawer: what it asks for, or the whole screen if that is narrower.
 *
 * Three panels want this (notifications 400, settings 360, assistant 440) and all three were fixed
 * numbers wider than a phone, so each overhung the viewport by its own amount. One rule, one place.
 */
export function useFlyoutWidth(preferred) {
  const display = useDisplay()
  return computed(() => Math.min(preferred, display.width.value))
}

const CONTENT_WIDTH = Symbol('cordango:contentWidth')

/**
 * Publish the measured width of the content box. Called once, by the host that owns the scroll
 * container; every block below it injects the result.
 *
 * provide/inject rather than props or an emit chain for the same reason `openRefPeek` is provided
 * (AppRuntime.vue): the consumers are a dozen blocks deep and nothing in between cares.
 *
 * Returns the template ref to attach to the element that should be measured.
 */
export function provideContentWidth() {
  const el = shallowRef(null)
  const width = ref(0)
  let ro = null
  onMounted(() => {
    if (!el.value || typeof ResizeObserver === 'undefined') return
    ro = new ResizeObserver((entries) => {
      // contentRect excludes the element's own padding, which is exactly the number a block needs:
      // it is the width the block will actually get, not the width of the box around it.
      const w = entries[0]?.contentRect?.width
      if (w) width.value = w
    })
    ro.observe(el.value)
    width.value = el.value.clientWidth
  })
  onBeforeUnmount(() => { ro?.disconnect(); ro = null })
  provide(CONTENT_WIDTH, readonly(width))
  return el
}

/**
 * How much room THIS block has.
 *
 * Falls back to the viewport when nothing provided a width — a block can render outside the runtime
 * host (the Studio preview, the editor iframe, a widget on Home), and guessing "narrow" there would
 * collapse a perfectly wide layout.
 */
export function useContentWidth() {
  const provided = inject(CONTENT_WIDTH, null)
  const display = useDisplay()
  // `provided` starts at 0 until the ResizeObserver fires, which is one frame after mount. Falling
  // through to the viewport for that frame avoids a visible collapse-then-expand on every page load.
  return bandRefs(computed(() => provided?.value || display.width.value))
}
