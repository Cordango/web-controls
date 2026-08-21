<!--
  SPDX-License-Identifier: Apache-2.0
  Copyright (c) Cordango and contributors.
  Part of Cordango Web Controls, the shared Vue controls for Cordango applications: https:  github.com/cordango/web-controls
  Licensed under the Apache License, Version 2.0. See LICENSE in the repository root.
  Extracted from the Cordango platform at web/src/ui/RefStateBadge.vue. Until web/ consumes
  this package, that copy and this one are two files saying the same thing.
-->

<script setup>
// The badge on a reference whose target is no longer live ("Disabled" for a deactivated person,
// the option's own label for a cancelled record). One definition of the treatment, so a table cell,
// a detail field and a card all say it the same way. Renders nothing when the target is fine.
defineProps({ state: { type: Object, default: null } })
</script>

<template>
  <span v-if="state" class="rsb">{{ state.label }}</span>
</template>

<style scoped>
.rsb { margin-left: 6px; padding: 0 5px; border-radius: 4px; font-size: 10px; font-weight: 700;
  line-height: 16px; letter-spacing: .02em; white-space: nowrap; vertical-align: middle;
  color: rgb(var(--v-theme-error)); background: rgba(var(--v-theme-error), .12); }
</style>
