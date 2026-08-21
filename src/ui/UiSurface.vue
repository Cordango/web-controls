<!--
  SPDX-License-Identifier: Apache-2.0
  Copyright (c) Cordango and contributors.
  Part of Cordango Web Controls, the shared Vue controls for Cordango applications: https:  github.com/cordango/web-controls
  Licensed under the Apache License, Version 2.0. See LICENSE in the repository root.
  Extracted from the Cordango platform at web/src/ui/UiSurface.vue. Until web/ consumes
  this package, that copy and this one are two files saying the same thing.
-->

<script setup>
// A card/panel surface. THIS is the natural first Paper adoption point: swap the internals for
// Vuetify0's `<V0Paper>` when we're ready, without touching any caller.
defineProps({ elevation: { type: [Number, String], default: 0 }, padded: { type: Boolean, default: false } })
</script>

<template>
  <v-card rounded="lg" border :elevation="elevation" :class="{ 'pa-4': padded }">
    <slot />
  </v-card>
</template>
