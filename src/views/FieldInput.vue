<script setup>
// One field control, factored out so the command dialog renders inputs identically to RecordForm.
// v-model'd; validation rules mirror RecordForm's rulesFor.
//
// It is also the ONE home of the `input` controls (timezone / slug / weeklyHours). RecordForm keeps
// its own chain for the ordinary types — it has ref-picker narrowing this does not — but delegates
// here whenever a field declares an `input`, so a richer control exists once rather than in each of
// the five places that map a type to a component.
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import UiTextField from '../ui/UiTextField.vue'
import UiTextarea from '../ui/UiTextarea.vue'
import UiSelect from '../ui/UiSelect.vue'
import UiSwitch from '../ui/UiSwitch.vue'
import UiRefPicker from '../ui/UiRefPicker.vue'
import UiTimezone from '../ui/UiTimezone.vue'
import UiSlugField from '../ui/UiSlugField.vue'
import WeeklyHours from './WeeklyHours.vue'
import { optionsOf } from '../manifest.js'

const { t } = useI18n()

const props = defineProps({
  field: { type: Object, required: true },
  modelValue: { default: null },
  refMap: { type: Object, default: () => ({}) },
})
const emit = defineEmits(['update:modelValue'])
const value = computed({ get: () => props.modelValue, set: v => emit('update:modelValue', v) })

function selectItems(f) { return optionsOf(f).map(o => ({ value: o.value, title: o.label, color: o.color })) }
function inputType(f) { return { integer: 'number', decimal: 'number', money: 'number', email: 'email', date: 'date', datetime: 'datetime-local' }[f.type] || 'text' }
function rulesFor(f) {
  const r = []
  if (f.required) r.push(v => (v !== null && v !== undefined && v !== '' && !(Array.isArray(v) && !v.length)) || `${f.label} is required`)
  if (f.type === 'email') r.push(v => !v || /^\S+@\S+\.\S+$/.test(v) || t('runtime.validation.email'))
  if (f.type === 'url') r.push(v => !v || /^https?:\/\/.+/.test(v) || t('runtime.validation.url'))
  if (f.type === 'integer') r.push(v => v === '' || v == null || Number.isInteger(Number(v)) || t('runtime.validation.integer'))
  if (['decimal', 'money'].includes(f.type)) r.push(v => v === '' || v == null || !isNaN(Number(v)) || t('runtime.validation.number'))
  return r
}
</script>

<template>
  <!-- A declared `input` wins over the type's default control. The Gate has already checked the two
       agree, so this cannot silently render a timezone picker over a number. -->
  <UiTimezone v-if="field.input === 'timezone'" v-model="value" :label="field.label" :rules="rulesFor(field)" />
  <UiSlugField v-else-if="field.input === 'slug'" v-model="value" :label="field.label"
    :prefix="field.prefix || ''" :rules="rulesFor(field)" :hint="field.help || ''" />
  <WeeklyHours v-else-if="field.input === 'weeklyHours'" v-model="value" :label="field.label" />

  <UiTextarea v-else-if="field.type === 'longtext'" v-model="value" :label="field.label" :rules="rulesFor(field)" />
  <UiSwitch v-else-if="field.type === 'boolean'" v-model="value" :label="field.label" />
  <UiSelect v-else-if="field.type === 'select'" v-model="value" :items="selectItems(field)" :label="field.label" :rules="rulesFor(field)" />
  <UiSelect v-else-if="field.type === 'multiselect'" v-model="value" :items="selectItems(field)" :label="field.label" multiple :rules="rulesFor(field)" />
  <UiRefPicker v-else-if="field.type === 'reference'" v-model="value" :field="field" :ref-map="refMap" :rules="rulesFor(field)" />
  <UiTextField v-else v-model="value" :label="field.label" :type="inputType(field)" :rules="rulesFor(field)" />
</template>
