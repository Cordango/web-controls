<!--
  SPDX-License-Identifier: Apache-2.0
  Copyright (c) Cordango and contributors.
  Part of Cordango Web Controls, the shared Vue controls for Cordango applications: https:  github.com/cordango/web-controls
  Licensed under the Apache License, Version 2.0. See LICENSE in the repository root.
  Extracted from the Cordango platform at web/src/views/ProcessBlock.vue. Until web/ consumes
  this package, that copy and this one are two files saying the same thing.
-->

<script setup>
// The record's process stepper: the states as a progress rail with the current one highlighted,
// plus a button per available transition (its bound command, guarded by state + access + when).
// Emits a 'command' intent the host (AppRuntime) runs through the same dialog/invoke path as the hub.
import { computed } from 'vue'
import UiButton from '../ui/UiButton.vue'
import { processForEntity, availableTransitions } from '../commands.js'

const props = defineProps({
  handle: String, manifest: Object,
  entityKey: String, record: Object,
  access: { type: Object, default: () => ({}) },
  userId: { type: String, default: '' },
  dense: { type: Boolean, default: false },   // compact layout for the detail peek/side panel
})
const emit = defineEmits(['command'])

const process = computed(() => processForEntity(props.manifest, props.entityKey))
const stateField = computed(() => process.value?.stateField)
const states = computed(() => process.value?.states || [])
const currentIdx = computed(() => states.value.findIndex(s => s.key === props.record?.[stateField.value]))
const transitions = computed(() =>
  process.value ? availableTransitions(process.value, props.manifest, props.record, props.access, props.userId) : [])

// Transitions are the record's "next steps" — keep them inline (usually 1-3). Only when a state has
// many do we inline the first two and fold the rest into an overflow menu, so the rail stays clean.
const inlineTransitions = computed(() =>
  transitions.value.slice(0, transitions.value.length > 3 ? 2 : transitions.value.length))
const moreTransitions = computed(() => transitions.value.slice(inlineTransitions.value.length))

function run(t) {
  if (t.command) emit('command', t.command)
}
</script>

<template>
  <div v-if="process" class="pb" :class="{ 'pb--dense': dense }">
    <div class="pb-rail">
      <template v-for="(s, i) in states" :key="s.key">
        <div class="pb-node" :class="{ 'pb-node--done': i < currentIdx, 'pb-node--current': i === currentIdx }">
          <span class="pb-dot" :style="i <= currentIdx && s.color ? { background: s.color, borderColor: s.color } : {}" />
          <span class="pb-label">{{ s.label }}</span>
        </div>
        <span v-if="i < states.length - 1" class="pb-sep" :class="{ 'pb-sep--done': i < currentIdx }" />
      </template>
    </div>
    <div v-if="transitions.length" class="pb-actions">
      <UiButton v-for="t in inlineTransitions" :key="t.transition.key"
        :color="t.command?.style === 'danger' ? 'error' : 'primary'"
        :variant="t.command?.style === 'primary' ? 'flat' : 'tonal'" :size="dense ? 'small' : undefined"
        :prepend-icon="t.command?.icon ? 'mdi-' + t.command.icon : undefined"
        @click="run(t)">
        {{ t.command?.label || t.transition.label || t.transition.key }}
      </UiButton>
      <v-menu v-if="moreTransitions.length" location="bottom end">
        <template #activator="{ props: mp }">
          <v-btn v-bind="mp" variant="tonal" class="text-none" :size="dense ? 'small' : undefined" append-icon="mdi-chevron-down">More</v-btn>
        </template>
        <v-list density="compact" min-width="200">
          <v-list-item v-for="t in moreTransitions" :key="t.transition.key"
            :prepend-icon="t.command?.icon ? 'mdi-' + t.command.icon : undefined"
            :title="t.command?.label || t.transition.label || t.transition.key"
            :class="{ 'text-error': t.command?.style === 'danger' }"
            @click="run(t)" />
        </v-list>
      </v-menu>
    </div>
  </div>
</template>

<style scoped>
.pb { background: rgb(var(--v-theme-surface)); border: 1px solid rgb(var(--v-theme-outline));
  border-radius: 14px; padding: 16px 20px; margin-bottom: 4px;
  display: flex; align-items: center; justify-content: space-between; gap: 20px; flex-wrap: wrap; }
.pb-rail { display: flex; align-items: center; min-width: 0; flex-wrap: wrap; }
.pb-node { display: inline-flex; align-items: center; gap: 8px; }
.pb-dot { width: 13px; height: 13px; border-radius: 50%; border: 2px solid rgba(var(--v-theme-on-surface), .3);
  background: transparent; flex: none; }
.pb-node--current .pb-dot { border-color: rgb(var(--v-theme-primary)); background: rgb(var(--v-theme-primary)); box-shadow: 0 0 0 4px rgba(var(--v-theme-primary), .16); }
.pb-label { font-size: 13px; font-weight: 600; color: rgba(var(--v-theme-on-surface), .5); }
.pb-node--current .pb-label { color: rgb(var(--v-theme-on-surface)); }
.pb-node--done .pb-label { color: rgba(var(--v-theme-on-surface), .72); }
.pb-sep { width: 34px; height: 2px; margin: 0 8px; background: rgba(var(--v-theme-on-surface), .18); }
.pb-sep--done { background: rgb(var(--v-theme-primary)); }
.pb-actions { display: flex; gap: 8px; flex: none; flex-wrap: wrap; }

/* Compact process block for the detail peek / side panel. */
.pb--dense { padding: 10px 14px; gap: 10px 14px; }
.pb--dense .pb-sep { width: 18px; margin: 0 5px; }
.pb--dense .pb-label { font-size: 12px; }
.pb--dense .pb-dot { width: 11px; height: 11px; }
</style>
