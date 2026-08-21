<!--
  SPDX-License-Identifier: Apache-2.0
  Copyright (c) Cordango and contributors.
  Part of Cordango Web Controls, the shared Vue controls for Cordango applications: https:  github.com/cordango/web-controls
  Licensed under the Apache License, Version 2.0. See LICENSE in the repository root.
  Extracted from the Cordango platform at web/src/ui/UiSlugField.vue. Until web/ consumes
  this package, that copy and this one are two files saying the same thing.
-->

<script setup>
// The part of an address somebody types, with the fixed part shown rather than imagined.
//
// A bare "Link" box asking for `a7f3…` tells you nothing about what it becomes. Showing
// `cordango.com/book/` in front of it turns the field into the sentence it is part of, and the
// sanitising means what you see is what the URL will be — no save that quietly turns "Intro Call"
// into "intro-call" after the fact.
import { computed } from 'vue'

const props = defineProps({
  modelValue: { type: String, default: '' },
  label: { type: String, default: '' },
  prefix: { type: String, default: '' },
  rules: { type: Array, default: () => [] },
  hint: { type: String, default: '' },
  disabled: Boolean,
})
const emit = defineEmits(['update:modelValue'])

/**
 * What may be in a URL path segment, applied AS YOU TYPE.
 *
 * Lowercase, letters/digits/dashes, spaces and underscores become dashes, runs collapse. Leading and
 * trailing dashes are left alone while typing — stripping the dash the moment it is typed makes
 * "intro-call" impossible to enter.
 */
function clean (raw) {
  return String(raw ?? '')
    .toLowerCase()
    .replace(/[\s_]+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-{2,}/g, '-')
    .slice(0, 60)
}

const full = computed(() => `${props.prefix}${props.modelValue || '…'}`)
</script>

<template>
  <div>
    <v-text-field
      :model-value="modelValue" :label="label" :rules="rules" :disabled="disabled"
      :prefix="prefix" variant="outlined" density="comfortable" hide-details="auto"
      :hint="hint" persistent-hint
      @update:model-value="v => emit('update:modelValue', clean(v))"
    />
    <!-- The whole address, once, under the field. The prefix inside the box is cramped enough to be
         read as decoration; this line is what somebody copies into a message. -->
    <div class="ui-slug-full">{{ full }}</div>
  </div>
</template>

<style scoped>
.ui-slug-full {
  margin-top: 4px;
  font-size: 12.5px;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  color: rgba(var(--v-theme-on-surface), .6);
  overflow-wrap: anywhere;
}
</style>
