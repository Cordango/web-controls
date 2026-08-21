<!--
  SPDX-License-Identifier: Apache-2.0
  Copyright (c) Cordango and contributors.
  Part of Cordango Web Controls, the shared Vue controls for Cordango applications: https:  github.com/cordango/web-controls
  Licensed under the Apache License, Version 2.0. See LICENSE in the repository root.
  Extracted from the Cordango platform at web/src/ui/UiSheet.vue. Until web/ consumes
  this package, that copy and this one are two files saying the same thing.
-->

<script setup>
// A modern right-anchored side sheet (replaces the cramped modal). Roomy, full-height, slides in.
//
// On a phone it goes full-bleed instead. This is the highest-traffic overlay in the product — it is
// both the create/edit form and the pinned record panel — and 94vw left a 20px strip of dimmed page
// down one side that reads as "this is a card you can dismiss by tapping past it", on the exact
// surface where a mis-tap loses a half-filled form.
//
// Driven by our own class rather than Vuetify's `fullscreen` prop: the positioning below is already
// hand-written (`position: fixed` + right-anchored), so `fullscreen` would be a second set of rules
// fighting the first. One switch, one place.
import { useViewport } from '../responsive.js'

defineProps({
  modelValue: Boolean,
  title: String,
  width: { type: [String, Number], default: 520 },
})
defineEmits(['update:modelValue'])

// The VIEWPORT, not the content width: this is a decision about the window itself.
const { phone } = useViewport()
</script>

<template>
  <v-dialog :model-value="modelValue" :max-width="width" scrim transition="slide-x-reverse-transition"
    :content-class="phone ? 'ui-sheet ui-sheet--full' : 'ui-sheet'"
    @update:model-value="$emit('update:modelValue', $event)">
    <v-card class="d-flex flex-column ui-sheet-card">
      <v-card-title class="d-flex align-center py-3">
        <span class="text-h6 ui-sheet-title">{{ title }}</span>
        <v-spacer />
        <v-btn icon="mdi-close" variant="text" size="small" @click="$emit('update:modelValue', false)" />
      </v-card-title>
      <v-divider />
      <v-card-text class="py-4" style="flex: 1; overflow-y: auto">
        <slot />
      </v-card-text>
      <v-divider />
      <v-card-actions class="pa-3 ui-sheet-actions">
        <v-spacer />
        <slot name="actions" />
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<!-- not scoped: content-class is teleported outside this component -->
<style>
.ui-sheet {
  position: fixed !important;
  top: 0 !important;
  right: 0 !important;
  margin: 0 !important;
  /* dvh, not vh: mobile Safari's `100vh` is the URL-bar-collapsed height, so the sheet would run
     under the browser chrome and its action buttons would sit off-screen. */
  height: 100dvh !important;
  max-height: 100dvh !important;
  width: 520px;
  max-width: 94vw;
}
.ui-sheet-card { height: 100%; border-radius: 0; }
/* A long entity label has nowhere to go in a 390px header, and wrapping it would push the close
   button off the row it belongs on. */
.ui-sheet-title { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

/* Phone: edge to edge, and keep the action row clear of the home indicator. */
.ui-sheet--full {
  width: 100vw !important;
  max-width: 100vw !important;
  left: 0 !important;
}
.ui-sheet--full .ui-sheet-actions {
  padding-bottom: calc(12px + env(safe-area-inset-bottom)) !important;
}
</style>
