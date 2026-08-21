<script setup>
// When somebody may book you: seven day rows, plus the dates that are different.
//
// This replaces a one-line text box holding raw JSON. That box is why the field read as meaningless —
// it is the setting that decides what a stranger is offered, and it was the one thing on the form
// that could not actually be filled in.
//
// All the deciding is in weeklyHours.js, which has no DOM and is tested against the exact shape
// AvailabilityService parses. The two must not drift: if they do, a public page silently offers hours
// nobody meant, to people nobody here is watching.
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import UiButton from '../ui/UiButton.vue'
import {
  DAY_KEYS, dayLabel, parseAvailability, serializeAvailability, defaultAvailability,
  isEmpty, nextWindow, overlapping, isClock,
} from './weeklyHours.js'

const { locale } = useI18n()

const props = defineProps({
  modelValue: { type: [Object, String], default: null },
  label: { type: String, default: '' },
  disabled: Boolean,
})
const emit = defineEmits(['update:modelValue'])

const state = ref(parseAvailability(props.modelValue))
// Re-read only when the value changes from OUTSIDE (a different record loaded). Comparing the
// serialized form stops our own emit from bouncing back and resetting a half-typed time.
watch(() => props.modelValue, (v) => {
  if (JSON.stringify(serializeAvailability(parseAvailability(v))) !== JSON.stringify(serializeAvailability(state.value)))
    state.value = parseAvailability(v)
})

function push () {
  state.value = { ...state.value }
  emit('update:modelValue', serializeAvailability(state.value))
}

const days = computed(() => DAY_KEYS.map(key => ({
  key,
  label: dayLabel(key, locale.value),
  windows: state.value.weekly[key] || [],
  bad: overlapping(state.value.weekly[key]),
})))

const empty = computed(() => isEmpty(state.value))

function setOpen (key, open) {
  state.value.weekly[key] = open ? [nextWindow([]) ] : []
  push()
}
function addWindow (key) {
  const next = nextWindow(state.value.weekly[key])
  if (next) { state.value.weekly[key] = [...(state.value.weekly[key] || []), next]; push() }
}
function removeWindow (key, i) {
  state.value.weekly[key] = state.value.weekly[key].filter((_, x) => x !== i)
  push()
}
function setTime (key, i, side, value) {
  if (!isClock(value)) return          // a half-typed "1" must not wipe the window
  const list = state.value.weekly[key].map(w => [...w])
  list[i][side] = value
  state.value.weekly[key] = list
  push()
}

/** Copy one day's hours onto every other day that is open. The commonest edit there is — set Monday,
 *  mean it for the week — and the alternative is typing the same two times ten more times. */
function copyToAll (key) {
  const src = (state.value.weekly[key] || []).map(w => [...w])
  for (const k of DAY_KEYS) if (k !== key && (state.value.weekly[k] || []).length) state.value.weekly[k] = src.map(w => [...w])
  push()
}

// --- exceptions -----------------------------------------------------------------------------------
const newDate = ref('')
function addException () {
  const d = newDate.value
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d) || state.value.exceptions.some(e => e.date === d)) return
  state.value.exceptions = [...state.value.exceptions, { date: d, windows: [] }]
  newDate.value = ''
  push()
}
function removeException (date) {
  state.value.exceptions = state.value.exceptions.filter(e => e.date !== date)
  push()
}
function setExceptionOpen (date, open) {
  state.value.exceptions = state.value.exceptions.map(e =>
    e.date === date ? { ...e, windows: open ? [nextWindow([])] : [] } : e)
  push()
}
function setExceptionTime (date, i, side, value) {
  if (!isClock(value)) return
  state.value.exceptions = state.value.exceptions.map(e => {
    if (e.date !== date) return e
    const windows = e.windows.map(w => [...w])
    windows[i][side] = value
    return { ...e, windows }
  })
  push()
}
const dateLabel = (d) => new Date(`${d}T00:00:00`)
  .toLocaleDateString(locale.value, { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' })

function useDefault () { state.value = defaultAvailability(); push() }
</script>

<template>
  <div class="wh">
    <div class="wh-head">
      <span class="wh-label">{{ label || $t('runtime.hours.label') }}</span>
      <v-spacer />
      <UiButton v-if="empty && !disabled" size="small" variant="text" @click="useDefault">
        {{ $t('runtime.hours.useDefault') }}
      </UiButton>
    </div>

    <!-- Empty is not "closed": the server falls back to Mon–Fri 09:00–17:00 rather than offering
         nothing, because a page with no rules would read as broken. So this says what will actually
         happen — a warning claiming nobody can book would be a second, quieter kind of wrong. -->
    <v-alert v-if="empty" type="warning" variant="tonal" density="compact" class="mb-3">
      {{ $t('runtime.hours.emptyWarning') }}
    </v-alert>

    <div v-for="d in days" :key="d.key" class="wh-day">
      <v-checkbox-btn :model-value="d.windows.length > 0" :disabled="disabled" density="compact"
        hide-details class="wh-check" @update:model-value="v => setOpen(d.key, v)" />
      <div class="wh-name">{{ d.label }}</div>

      <div class="wh-windows">
        <div v-if="!d.windows.length" class="wh-closed">{{ $t('runtime.hours.closed') }}</div>
        <div v-for="(w, i) in d.windows" :key="i" class="wh-window">
          <input class="wh-time" :class="{ 'wh-time--bad': d.bad.has(i) }" type="time" :value="w[0]"
            :disabled="disabled" @change="e => setTime(d.key, i, 0, e.target.value)">
          <span class="wh-dash">–</span>
          <input class="wh-time" :class="{ 'wh-time--bad': d.bad.has(i) }" type="time" :value="w[1]"
            :disabled="disabled" @change="e => setTime(d.key, i, 1, e.target.value)">
          <v-btn v-if="!disabled" icon="mdi-close" size="x-small" variant="text" class="wh-x"
            @click="removeWindow(d.key, i)" />
        </div>
      </div>

      <div class="wh-tools">
        <v-btn v-if="d.windows.length && !disabled" icon="mdi-plus" size="x-small" variant="text"
          :title="$t('runtime.hours.addWindow')" @click="addWindow(d.key)" />
        <v-btn v-if="d.windows.length && !disabled" icon="mdi-content-copy" size="x-small" variant="text"
          :title="$t('runtime.hours.copyToAll')" @click="copyToAll(d.key)" />
      </div>
    </div>

    <!-- EXCEPTIONS. A date with no hours is the point: "closed on the 24th" is a different statement
         from "nothing recorded", and only one of them stops the page offering that day. -->
    <div class="wh-exceptions">
      <div class="wh-label mb-2">{{ $t('runtime.hours.exceptions') }}</div>
      <div v-for="e in state.exceptions" :key="e.date" class="wh-day">
        <v-checkbox-btn :model-value="e.windows.length > 0" :disabled="disabled" density="compact"
          hide-details class="wh-check" @update:model-value="v => setExceptionOpen(e.date, v)" />
        <div class="wh-name wh-name--date">{{ dateLabel(e.date) }}</div>
        <div class="wh-windows">
          <div v-if="!e.windows.length" class="wh-closed">{{ $t('runtime.hours.closedAllDay') }}</div>
          <div v-for="(w, i) in e.windows" :key="i" class="wh-window">
            <input class="wh-time" type="time" :value="w[0]" :disabled="disabled"
              @change="ev => setExceptionTime(e.date, i, 0, ev.target.value)">
            <span class="wh-dash">–</span>
            <input class="wh-time" type="time" :value="w[1]" :disabled="disabled"
              @change="ev => setExceptionTime(e.date, i, 1, ev.target.value)">
          </div>
        </div>
        <div class="wh-tools">
          <v-btn v-if="!disabled" icon="mdi-close" size="x-small" variant="text" @click="removeException(e.date)" />
        </div>
      </div>

      <div v-if="!disabled" class="wh-add-date">
        <input v-model="newDate" type="date" class="wh-time wh-time--date" @keyup.enter="addException">
        <UiButton size="small" variant="text" :disabled="!newDate" @click="addException">
          {{ $t('runtime.hours.addDate') }}
        </UiButton>
      </div>
    </div>
  </div>
</template>

<style scoped>
.wh { border: 1px solid rgba(var(--v-theme-on-surface), .16); border-radius: 8px; padding: 12px 14px; }
.wh-head { display: flex; align-items: center; margin-bottom: 8px; }
.wh-label { font-size: 12.5px; font-weight: 600; opacity: .7; }
.wh-day { display: flex; align-items: flex-start; gap: 8px; padding: 5px 0; min-height: 40px; }
.wh-check { flex: 0 0 auto; margin-top: 4px; }
.wh-name { flex: 0 0 96px; font-size: 13.5px; padding-top: 8px; }
.wh-name--date { flex-basis: 165px; }
.wh-windows { flex: 1 1 auto; min-width: 0; }
.wh-window { display: flex; align-items: center; gap: 4px; margin-bottom: 4px; }
.wh-closed { font-size: 13px; opacity: .5; padding-top: 8px; }
.wh-dash { opacity: .5; }
.wh-tools { flex: 0 0 auto; padding-top: 2px; }
.wh-x { opacity: .55; }
/* A native time input rather than a Vuetify select: seven rows of dropdowns is a wall, and the
   browser's own control is keyboardable and already localised (12h where that is the convention). */
.wh-time {
  border: 1px solid rgba(var(--v-theme-on-surface), .22);
  border-radius: 6px; padding: 5px 7px; font-size: 13.5px;
  background: transparent; color: rgb(var(--v-theme-on-surface));
  color-scheme: light dark;
}
.wh-time--date { min-width: 150px; }
.wh-time--bad { border-color: rgb(var(--v-theme-warning)); }
.wh-exceptions { margin-top: 10px; padding-top: 10px; border-top: 1px solid rgba(var(--v-theme-on-surface), .12); }
.wh-add-date { display: flex; align-items: center; gap: 8px; margin-top: 6px; }
</style>
