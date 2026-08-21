<!--
  SPDX-License-Identifier: Apache-2.0
  Copyright (c) Cordango and contributors.
  Part of Cordango Web Controls, the shared Vue controls for Cordango applications: https:  github.com/cordango/web-controls
  Licensed under the Apache License, Version 2.0. See LICENSE in the repository root.
  Extracted from the Cordango platform at web/src/ui/UiOptionItem.vue. Until web/ consumes
  this package, that copy and this one are two files saying the same thing.
-->

<script setup>
// Shared menu row for select-like controls. Colored enum/state values get a quiet accent above the
// row; values without a declared color remain ordinary list items.
import { computed } from 'vue'
import { optionAccent, optionAccentStyle } from './optionAccent.js'

const props = defineProps({
  itemProps: { type: Object, required: true },
  item: { type: Object, required: true },
  multiple: Boolean,
})

const colored = computed(() => !!optionAccent(props.item))
const accentStyle = computed(() => optionAccentStyle(props.item))
</script>

<template>
  <v-list-item v-bind="itemProps" class="ui-option-item"
    :class="{ 'ui-option-item--colored': colored }" :style="accentStyle">
    <!-- Vuetify's checkbox is part of its own item slot. Once a caller customizes that slot we must
         render it explicitly, or a multiple-select loses the visible selection affordance. -->
    <template v-if="multiple" #prepend="{ isSelected }">
      <v-checkbox-btn :model-value="isSelected" :ripple="false" tabindex="-1" aria-hidden="true"
        @click.prevent />
    </template>
    <slot />
  </v-list-item>
</template>

<style scoped>
.ui-option-item { position: relative; }
.ui-option-item--colored::before {
  content: '';
  position: absolute;
  z-index: 1;
  top: 2px;
  left: 16px;
  right: 16px;
  height: 2px;
  border-radius: 999px;
  background: var(--ui-option-accent);
  opacity: .42;
  pointer-events: none;
}
</style>
