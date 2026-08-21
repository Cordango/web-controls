<!--
  SPDX-License-Identifier: Apache-2.0
  Copyright (c) Cordango and contributors.
  Part of Cordango Web Controls, the shared Vue controls for Cordango applications: https:  github.com/cordango/web-controls
  Licensed under the Apache License, Version 2.0. See LICENSE in the repository root.
  Extracted from the Cordango platform at web/src/ui/UiTextField.vue. Until web/ consumes
  this package, that copy and this one are two files saying the same thing.
-->

<script setup>
defineProps({
  modelValue: { type: [String, Number], default: '' },
  label: String,
  type: { type: String, default: 'text' },
  rules: { type: Array, default: () => [] },
  hint: String,
  placeholder: String,
  disabled: Boolean,
})
defineEmits(['update:modelValue'])
</script>

<template>
  <v-text-field :model-value="modelValue" :label="label" :type="type" :rules="rules"
    :hint="hint" :placeholder="placeholder" :disabled="disabled" persistent-hint
    @update:model-value="$emit('update:modelValue', $event)" />
</template>
