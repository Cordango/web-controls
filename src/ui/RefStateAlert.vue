<!--
  SPDX-License-Identifier: Apache-2.0
  Copyright (c) Cordango and contributors.
  Part of Cordango Web Controls, the shared Vue controls for Cordango applications: https:  github.com/cordango/web-controls
  Licensed under the Apache License, Version 2.0. See LICENSE in the repository root.
  Extracted from the Cordango platform at web/src/ui/RefStateAlert.vue. Until web/ consumes
  this package, that copy and this one are two files saying the same thing.
-->

<script setup>
// "The thing this record points at is gone, and here is how to fix it."
//
// A badge tells you a reference is dead; it does not tell you that YOU have to do something about
// it. This is the sentence, on the record, with the action beside it. One line per reference field
// whose target is no longer live.
//
// The wording is derived from the field's OWN label and the target's own state, so it reads
// correctly in every app without anyone authoring copy for it.
import { computed } from 'vue'
import UiButton from './UiButton.vue'
import { declaredFields } from '../manifest.js'

const props = defineProps({
  entity: { type: Object, default: null },          // the manifest entity def
  record: { type: Object, default: null },
  refMaps: { type: Object, default: () => ({}) },   // { fieldKey: { id: label } }
  refStates: { type: Object, default: () => ({}) }, // { fieldKey: { id: {kind,label} } }
  canEdit: { type: Boolean, default: false },       // may this caller change the record at all?
})
const emit = defineEmits(['change'])

// A field the runtime owns (computed, command-set, system) still gets the sentence — the user needs
// to know — but never the button, because they cannot act on it here.
const fixable = f => !f.readOnly && !f.system && !f.auto && !f.setByCommand && !f.computed

const issues = computed(() => {
  if (!props.entity || !props.record) return []
  return declaredFields(props.entity)
    .filter(f => f.type === 'reference')
    .map(f => {
      const id = props.record[f.key]
      const state = id ? props.refStates[f.key]?.[id] : null
      return state ? { field: f, state, label: props.refMaps[f.key]?.[id] ?? id } : null
    })
    .filter(Boolean)
})
</script>

<template>
  <div v-if="issues.length" class="rsa">
    <v-alert v-for="i in issues" :key="i.field.key" type="warning" variant="tonal" density="compact">
      <div class="rsa-row">
        <span class="rsa-txt">
          <strong>{{ i.field.label }}</strong> {{ i.label }} is {{ i.state.label.toLowerCase() }}.
          Pick a replacement.
        </span>
        <UiButton v-if="canEdit && fixable(i.field)" size="small" variant="tonal"
          @click="emit('change', i.field)">Change</UiButton>
      </div>
    </v-alert>
  </div>
</template>

<style scoped>
.rsa { display: flex; flex-direction: column; gap: 6px; margin-bottom: 4px; }
.rsa-row { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
.rsa-txt { flex: 1; min-width: 0; }
</style>
