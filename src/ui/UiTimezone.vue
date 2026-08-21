<!--
  SPDX-License-Identifier: Apache-2.0
  Copyright (c) Cordango and contributors.
  Part of Cordango Web Controls, the shared Vue controls for Cordango applications: https:  github.com/cordango/web-controls
  Licensed under the Apache License, Version 2.0. See LICENSE in the repository root.
  Extracted from the Cordango platform at web/src/ui/UiTimezone.vue. Until web/ consumes
  this package, that copy and this one are two files saying the same thing.
-->

<script setup>
// A searchable list of IANA time zones, each showing the offset it is on TODAY.
//
// The offset is the point. "Europe/Berlin" is a string somebody either recognises or does not;
// "Europe/Berlin  GMT+2" can be checked against the clock on the wall, which is the only way a person
// catches having picked Europe/Bucharest by scrolling one row too far.
import { computed } from 'vue'
import { zoneItems } from '../views/timezones.js'

const props = defineProps({
  modelValue: { type: String, default: '' },
  label: { type: String, default: '' },
  rules: { type: Array, default: () => [] },
  disabled: Boolean,
})
const emit = defineEmits(['update:modelValue'])

// Computed against the CURRENT value so a zone this browser cannot resolve is still offered — a page
// configured elsewhere must not lose its setting to a blank field.
const items = computed(() => zoneItems(props.modelValue))
</script>

<template>
  <v-autocomplete
    :model-value="modelValue" :items="items" :label="label" :rules="rules" :disabled="disabled"
    item-title="title" item-value="value"
    variant="outlined" density="comfortable" auto-select-first
    :item-props="i => ({ subtitle: i.subtitle })"
    prepend-inner-icon="mdi-earth"
    @update:model-value="v => emit('update:modelValue', v)"
  >
    <!-- The offset rides along in the closed field too, not just the open list: a form you come back
         to has to be checkable without opening the control again. -->
    <template #selection="{ item }">
      <span>{{ item.title }}</span>
      <span v-if="item.raw?.subtitle" class="ui-tz-off">{{ item.raw.subtitle }}</span>
    </template>
  </v-autocomplete>
</template>

<style scoped>
.ui-tz-off { margin-left: 8px; font-size: 12.5px; opacity: .6; }
</style>
