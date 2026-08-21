<!--
  SPDX-License-Identifier: Apache-2.0
  Copyright (c) Cordango and contributors.
  Part of Cordango Web Controls, the shared Vue controls for Cordango applications: https:  github.com/cordango/web-controls
  Licensed under the Apache License, Version 2.0. See LICENSE in the repository root.
  Extracted from the Cordango platform at web/src/ui/UiTable.vue. Until web/ consumes
  this package, that copy and this one are two files saying the same thing.
-->

<script setup>
// Wraps v-data-table. Forwards all slots so callers can render custom cells (e.g. colored status
// chips) via #item.<key> and row actions via #item.actions. Emits row-click for the whole row.
defineProps({
  headers: { type: Array, default: () => [] },
  items: { type: Array, default: () => [] },
  loading: Boolean,
  itemValue: { type: String, default: 'id' },
})
defineEmits(['row-click'])
</script>

<template>
  <v-data-table :headers="headers" :items="items" :loading="loading" :item-value="itemValue"
    density="comfortable" hover class="ui-table" @click:row="(_, { item }) => $emit('row-click', item)">
    <template v-for="(_, name) in $slots" #[name]="slotProps">
      <slot :name="name" v-bind="slotProps ?? {}" />
    </template>
  </v-data-table>
</template>

<style scoped>
.ui-table :deep(tbody tr) { cursor: pointer; }
.ui-table :deep(thead th) {
  font-weight: 600 !important;
  color: rgba(var(--v-theme-on-surface), .72) !important;
  white-space: nowrap;
}
</style>
