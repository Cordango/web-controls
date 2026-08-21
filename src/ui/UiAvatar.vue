<!--
  SPDX-License-Identifier: Apache-2.0
  Copyright (c) Cordango and contributors.
  Part of Cordango Web Controls, the shared Vue controls for Cordango applications: https:  github.com/cordango/web-controls
  Licensed under the Apache License, Version 2.0. See LICENSE in the repository root.
  Extracted from the Cordango platform at web/src/ui/UiAvatar.vue. Until web/ consumes
  this package, that copy and this one are two files saying the same thing.
-->

<script setup>
// The one avatar circle in the product: a picture if there is one, initials on a stable colour if
// there is not.
//
// Extracted from PersonAvatar because a company now needs exactly the same thing, and so will a
// product, a venue or anything else that has a face. The name is deliberately not `Person`-anything:
// it knows about an image URL and a label, and nothing about who or what it is drawing.
//
// **The fallback matters more than the picture.** A list where six rows carry a logo and twenty-one
// carry a coloured circle looks broken unless the two are identical in shape, size and weight — so
// the geometry lives here once, and there is no branch where an absent image changes the layout.
import { ref, computed, watch } from 'vue'

const props = defineProps({
  src: { type: String, default: null },       // an image URL, or null for the initials fallback
  name: { type: String, default: '' },        // what the record is called — initials and colour come from it
  color: { type: String, default: null },     // an explicit colour (the People directory stores one)
  size: { type: Number, default: 40 },
  square: { type: Boolean, default: false },  // a logo is not a face: rounded-square reads as a brand mark
  // Non-live target (a deactivated person, an archived company): desaturated and ringed, everywhere.
  state: { type: Object, default: null },
  title: { type: String, default: null },
})

// A failed image falls back rather than leaving a hole — the src may be a third party's, a stale
// path, or simply offline, and none of those should render as a broken-image glyph.
const failed = ref(false)
watch(() => props.src, () => { failed.value = false })

const photo = computed(() => (!failed.value && props.src) || null)
const initials = computed(() => (props.name || '')
  .split(/\s+/).filter(Boolean).map(w => w[0]).slice(0, 2).join('').toUpperCase() || '•')
// A stable colour per name, so the same company is the same colour on every screen and in every app.
// This hash was duplicated in ChildBlock and HubHeader with two different lightness curves; one copy
// now, so two surfaces can no longer disagree about what colour a record is.
const hashed = computed(() => {
  let h = 0
  for (let i = 0; i < (props.name || '').length; i++) h = (h * 31 + props.name.charCodeAt(i)) % 360
  return `hsl(${h}, 55%, 46%)`
})
const bg = computed(() => photo.value ? 'transparent' : (props.color || hashed.value))
</script>

<template>
  <span class="av" :class="{ 'av-inactive': state, 'av-square': square }" :title="title"
    :style="{ width: size + 'px', height: size + 'px', fontSize: (size * 0.4) + 'px', background: bg }">
    <img v-if="photo" :src="photo" class="av-img" alt="" @error="failed = true" />
    <template v-else>{{ initials }}</template>
  </span>
</template>

<style scoped>
.av { border-radius: 50%; display: inline-grid; place-items: center; color: #fff; font-weight: 650;
  flex: none; line-height: 1; letter-spacing: -0.02em; overflow: hidden; }
.av-img { width: 100%; height: 100%; object-fit: cover; border-radius: inherit; }
/* A brand mark is usually square with its own padding — cropping it to a circle cuts the wordmark.
   `contain` rather than `cover` for the same reason: show the whole logo, not a zoomed corner. */
.av-square { border-radius: 22%; }
.av-square .av-img { object-fit: contain; background: #fff; }
.av-inactive { filter: grayscale(1); opacity: .75;
  box-shadow: 0 0 0 2px rgb(var(--v-theme-error)), 0 0 0 3px rgb(var(--v-theme-surface)); }
</style>
