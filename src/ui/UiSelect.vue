<!--
  SPDX-License-Identifier: Apache-2.0
  Copyright (c) Cordango and contributors.
  Part of Cordango Web Controls, the shared Vue controls for Cordango applications: https:  github.com/cordango/web-controls
  Licensed under the Apache License, Version 2.0. See LICENSE in the repository root.
  Extracted from the Cordango platform at web/src/ui/UiSelect.vue. Until web/ consumes
  this package, that copy and this one are two files saying the same thing.
-->

<script setup>
// items: [{ value, title, color? }]
import UiOptionItem from './UiOptionItem.vue'

defineProps({
  modelValue: { type: [String, Number, Array], default: null },
  items: { type: Array, default: () => [] },
  label: String,
  multiple: Boolean,
  rules: { type: Array, default: () => [] },
  disabled: Boolean,
  clearable: { type: Boolean, default: true },
})
defineEmits(['update:modelValue'])
</script>

<template>
  <v-select :model-value="modelValue" :items="items" item-title="title" item-value="value"
    :label="label" :multiple="multiple" :chips="multiple" :rules="rules" :disabled="disabled"
    :clearable="clearable" @update:model-value="$emit('update:modelValue', $event)">
    <template #item="{ props: itemProps, item }">
      <UiOptionItem :item-props="itemProps" :item="item" :multiple="multiple" />
    </template>
  </v-select>
</template>
