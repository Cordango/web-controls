<template>
  <!-- not editable: the plain cell content, untouched -->
  <slot v-if="!editable" />

  <!-- text / number: swap an input in place (PrimCell pattern: enter/blur commits, Esc cancels) -->
  <template v-else-if="kind === 'text' || kind === 'number'">
    <v-text-field v-if="editing" v-model="draft" :type="kind === 'number' ? 'number' : 'text'"
      variant="plain" density="compact" hide-details single-line autofocus class="ce-input"
      @keyup.enter="commitText" @keydown.esc.stop="editing = false" @blur="commitText" @click.stop />
    <div v-else class="ce-display" @click.stop="beginText"><slot /></div>
  </template>

  <!-- menu-based editors: transitions / select options / person / date -->
  <v-menu v-else v-model="menu" :close-on-content-click="false" location="bottom start">
    <template #activator="{ props: act }">
      <div v-bind="act" class="ce-display" @click.stop><slot /></div>
    </template>

    <v-list v-if="kind === 'transitions'" density="compact">
      <v-list-item v-for="t in transitions" :key="t.label + t.to" @click="runTransition(t)">
        <UiChip :color="t.color || '#64748b'">{{ t.label }}</UiChip>
      </v-list-item>
    </v-list>

    <v-list v-else-if="kind === 'select'" density="compact">
      <v-list-item v-for="o in optionsOf(field)" :key="o.value" @click="pick(o.value)">
        <template #prepend>
          <v-icon :icon="record?.[field.key] === o.value ? 'mdi-check' : 'mdi-blank'" size="16" class="mr-1" />
        </template>
        <UiChip :color="o.color || '#64748b'">{{ o.label }}</UiChip>
      </v-list-item>
    </v-list>

    <v-card v-else-if="kind === 'reference'" min-width="280" class="pa-2">
      <UiRefPicker :model-value="record?.[field.key] ?? null" :field="field" :ref-map="refMap || {}"
        @update:model-value="pick" />
    </v-card>

    <v-card v-else-if="kind === 'date'" class="pa-2">
      <v-text-field v-model="draft" :type="field.type === 'datetime' ? 'datetime-local' : 'date'"
        variant="outlined" density="compact" hide-details autofocus style="min-width: 200px"
        @keyup.enter="commitDate" @change="commitDate" />
    </v-card>
  </v-menu>
</template>

<script setup>
// One inline cell editor for UiDataTable: shows the read-only cell content (default slot) and,
// on click, the right lightweight editor for the field type. It only COLLECTS the value — the
// host owns the write: `save(patch)` for plain fields, `command(cmd)` for a governed status
// (whose menu lists the record's LEGAL transitions; free transitions patch directly).
import { ref, computed, watch } from 'vue'
import UiChip from '../ui/UiChip.vue'
import UiRefPicker from '../ui/UiRefPicker.vue'
import { optionsOf } from '../manifest.js'

const props = defineProps({
  editable: { type: Boolean, default: false },
  field: { type: Object, default: null },
  record: { type: Object, default: null },
  refMap: { type: Object, default: null },          // for reference fields (id -> label)
  transitions: { type: Array, default: null },       // governed status: statusCellMoves() output
})
const emit = defineEmits(['save', 'command'])

const kind = computed(() => {
  if (props.transitions) return 'transitions'
  const t = props.field?.type
  if (t === 'select') return 'select'
  if (t === 'reference') return 'reference'
  if (t === 'date' || t === 'datetime') return 'date'
  if (['integer', 'decimal', 'money'].includes(t)) return 'number'
  return 'text'
})

const menu = ref(false)
const editing = ref(false)
const draft = ref('')

watch(menu, open => {
  if (open && kind.value === 'date') {
    const v = String(props.record?.[props.field.key] ?? '')
    draft.value = v.slice(0, props.field.type === 'datetime' ? 16 : 10)
  }
})

function beginText() { draft.value = props.record?.[props.field.key] ?? ''; editing.value = true }
function commitText() {
  if (!editing.value) return                        // blur after enter must not double-fire
  editing.value = false
  const raw = draft.value
  const v = kind.value === 'number'
    ? (raw === '' || raw == null || isNaN(Number(raw)) ? null : Number(raw))
    : (raw === '' ? null : raw)
  if (v !== (props.record?.[props.field.key] ?? null)) emit('save', { [props.field.key]: v })
}
function commitDate() {
  menu.value = false
  const v = draft.value || null
  if (v !== (props.record?.[props.field.key] ?? null)) emit('save', { [props.field.key]: v })
}
function pick(v) {
  menu.value = false
  if ((v ?? null) !== (props.record?.[props.field.key] ?? null)) emit('save', { [props.field.key]: v ?? null })
}
function runTransition(t) {
  menu.value = false
  if (t.run === 'command' && t.command) emit('command', t.command)
  else emit('save', { [t.field]: t.to })
}
</script>

<style scoped>
.ce-display { cursor: pointer; border-radius: 6px; margin: -2px -6px; padding: 2px 6px; min-height: 22px; }
.ce-display:hover { background: rgba(var(--v-theme-primary), .08); }
.ce-input { max-width: 180px; }
.ce-input :deep(input) { font-size: 14px; }
</style>
