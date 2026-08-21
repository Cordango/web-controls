<script setup>
// One facet dropdown, shared by every filter bar (the table `filterBar`, the repeat card grid's bar,
// and the page-level `filterbar` block) so they can't drift apart.
//
// ALWAYS multi-select, with checkboxes. A single-value status facet can only ask "show me exactly
// To do", never "show me everything except Done" — which is the question people actually put to a
// status column. The selection is therefore an ARRAY of values and every surface reads it as "any of";
// empty = no filtering at all. A scalar model value is tolerated (and read as a one-element list) so a
// caller that still holds an older single selection keeps working.
import { computed } from 'vue'
import PersonChip from './PersonChip.vue'
import UiOptionItem from './UiOptionItem.vue'
import { hoistMe, isMe } from '../me.js'

const props = defineProps({
  modelValue: { type: [Array, String, Number, Boolean], default: () => [] },
  items: { type: Array, default: () => [] },   // [{ value, title, color? }]
  label: String,
  person: Boolean,                             // options are platform people -> chips, not plain titles
})
const emit = defineEmits(['update:modelValue'])

const sel = computed(() => toList(props.modelValue))
function toList(v) { return Array.isArray(v) ? v : (v == null || v === '' ? [] : [v]) }
// "Mine" is the first thing anyone asks a person facet, so I go to the top of it. Only when I am
// ALREADY an option: these lists are built from the values the rows actually carry.
const rows = computed(() => (props.person ? hoistMe(props.items) : props.items))
// The menu row: v-bind carries Vuetify's item props; a person row drops the title and shows the chip.
function rowProps(itemProps) { return props.person ? { ...itemProps, title: '' } : itemProps }
</script>

<template>
  <v-select :model-value="sel" :items="rows" :label="label" multiple density="compact" variant="outlined"
    hide-details clearable class="ui-facet" @update:model-value="emit('update:modelValue', $event)">
    <!-- Vuetify only renders the multi-select checkbox from its OWN item slot, so overriding the slot
         means rendering the checkbox ourselves — otherwise the facet silently loses its ticks. -->
    <template #item="{ props: itemProps, item, index }">
      <UiOptionItem :item-props="rowProps(itemProps)" :item="item" multiple>
        <PersonChip v-if="person" :person-id="item.value" :size="24" role mark-me />
      </UiOptionItem>
      <!-- A rule under my own row, so "me" reads as the shortcut it is rather than as someone who
           sorts oddly. Only where it IS the top row — the list filters and reorders under a search. -->
      <v-divider v-if="person && index === 0 && isMe(item.value)" class="my-1" />
    </template>
    <!-- The field is ~180px wide: show the first selection and count the rest, never a wrapping list. -->
    <template #selection="{ item, index }">
      <PersonChip v-if="person && index === 0" :person-id="item.value" :size="18" />
      <span v-else-if="index === 0" class="ui-facet-first">{{ item.title }}</span>
      <span v-else-if="index === 1" class="ui-facet-more text-medium-emphasis">+{{ sel.length - 1 }}</span>
    </template>
  </v-select>
</template>

<style scoped>
.ui-facet-first { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ui-facet-more { font-size: 12px; margin-left: 4px; }
</style>
