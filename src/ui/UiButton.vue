<!--
  SPDX-License-Identifier: Apache-2.0
  Copyright (c) Cordango and contributors.
  Part of Cordango Web Controls, the shared Vue controls for Cordango applications: https:  github.com/cordango/web-controls
  Licensed under the Apache License, Version 2.0. See LICENSE in the repository root.
  Extracted from the Cordango platform at web/src/ui/UiButton.vue. Until web/ consumes
  this package, that copy and this one are two files saying the same thing.
-->

<script setup>
defineProps({
  color: { type: String, default: undefined },
  variant: { type: String, default: 'flat' },
  prependIcon: { type: String, default: undefined },
  appendIcon: { type: String, default: undefined },
  // An icon-only button: no label, square, and REQUIRES a title — a control with no text has to say
  // what it does somewhere, and a tooltip nobody can reach on a touch screen is not somewhere.
  icon: { type: String, default: undefined },
  title: { type: String, default: undefined },
  loading: Boolean,
  disabled: Boolean,
  size: { type: String, default: 'default' },
  block: Boolean,
})
defineEmits(['click'])
</script>

<template>
  <v-btn :color="color" :variant="variant" :prepend-icon="prependIcon" :append-icon="appendIcon"
    :icon="icon" :title="title" :aria-label="icon ? title : undefined"
    :loading="loading" :disabled="disabled" :size="size" :block="block" @click="$emit('click', $event)">
    <!-- The icon is drawn HERE rather than left to v-btn's `icon` prop. This wrapper always passes a
         default slot, and v-btn renders that slot INSTEAD of the prop's glyph — so an icon-only
         button came out as a correctly-shaped, completely empty circle. The prop is still set,
         because it is what makes the button round and square-sized. -->
    <v-icon v-if="icon" :icon="icon" />
    <slot v-else />
  </v-btn>
</template>
