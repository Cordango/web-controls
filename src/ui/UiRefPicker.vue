<script setup>
// Searchable reference picker (replaces the plain dropdown for reference fields): type-ahead over
// the target entity's records; platform-person references render as avatar chips in both the list
// and the selection. Items come from the caller's refMap (id -> display label). With `creatable`,
// the menu ends in a "+ New …" row that hands the current search text to the host — the host owns
// the actual create (a nested form) and selects the record it returns.
import { computed, ref, onMounted } from 'vue'
import PersonChip from './PersonChip.vue'
import { loadPeople } from '../host.js'
import { isPersonField } from '../manifest.js'
import { personState } from '../refState.js'
import { hoistMe, isMe } from '../me.js'

const props = defineProps({
  modelValue: { type: [String, Number], default: null },
  field: { type: Object, required: true },       // the manifest field def (reference)
  refMap: { type: Object, default: () => ({}) }, // id -> display label
  refStates: { type: Object, default: () => ({}) }, // id -> {kind,label} for LOCAL targets (person state is derived here)
  label: String,
  rules: { type: Array, default: () => [] },
  disabled: Boolean,
  // Why this picker is empty or disabled — a scoped picker ("people at the chosen company") is a
  // dead end without it. Shown persistently, because the reason has to be readable before you click.
  hint: String,
  creatable: Boolean,                            // offer "+ New …" (local references only)
  // The target list came back capped, so some records are genuinely NOT in this menu. Searching for
  // one of them finds nothing, and without saying so the picker reads as "that record doesn't exist"
  // rather than "I can't show you all of them yet".
  truncated: Boolean,
})
const emit = defineEmits(['update:modelValue', 'create-new'])

const search = ref('')
const person = computed(() => isPersonField(props.field))

// You may not ASSIGN work to a dead record — but the one already on this record has to stay visible,
// or opening the edit form on a project led by a deactivated person silently blanks the field.
const peopleStates = ref({})
onMounted(async () => {
  if (!person.value) return
  const { items } = await loadPeople()
  peopleStates.value = Object.fromEntries(items.map(p => [p.id, personState(p)]).filter(([, s]) => s))
})
const stateOf = id => (person.value ? peopleStates.value[id] : props.refStates[id]) || null

// Assigning something to yourself is the commonest pick there is, so I lead the list — and my row's
// title becomes "Me (Name)", which is also what the type-ahead searches, so typing "me" finds me.
const items = computed(() => {
  const list = Object.entries(props.refMap)
    .map(([value, title]) => ({ value, title, state: stateOf(value) }))
    .filter(i => !i.state || i.value === props.modelValue)
  return person.value ? hoistMe(list) : list
})
const createTitle = computed(() =>
  `New ${props.field.label?.toLowerCase() ?? 'entry'}${search.value ? ` “${search.value}”` : '…'}`)

// The caller's own reason for the picker's state wins — it is more specific than ours.
const shownHint = computed(() => props.hint
  || (props.truncated ? `Showing the first ${items.value.length}. If you can't find one, it may not be listed yet.` : ''))
</script>

<template>
  <v-autocomplete
    :model-value="modelValue" :items="items" :label="label || field.label" :rules="rules"
    :disabled="disabled" variant="outlined" density="comfortable" clearable auto-select-first
    :placeholder="`Search ${field.label?.toLowerCase() ?? ''}…`" class="mb-1"
    :hint="shownHint" :persistent-hint="!!shownHint"
    :item-props="i => ({ disabled: !!i.state, subtitle: i.state?.label })"
    v-model:search="search"
    @update:model-value="v => emit('update:modelValue', v)">
    <template v-if="person" #item="{ props: itemProps, item, index }">
      <v-list-item v-bind="itemProps" title="">
        <PersonChip :person-id="item.value" :size="24" role mark-me />
      </v-list-item>
      <v-divider v-if="index === 0 && isMe(item.value)" class="my-1" />
    </template>
    <template v-if="person" #selection="{ item }">
      <PersonChip :person-id="item.value" :size="20" />
    </template>
    <!-- mousedown.prevent keeps the autocomplete from blurring (and clearing the search) before click -->
    <template v-if="creatable" #append-item>
      <v-divider />
      <v-list-item class="text-primary" prepend-icon="mdi-plus" :title="createTitle"
        @mousedown.prevent @click="emit('create-new', search)" />
    </template>
    <template v-if="creatable" #no-data>
      <div class="d-none" />
    </template>
  </v-autocomplete>
</template>
