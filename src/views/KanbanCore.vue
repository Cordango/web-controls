<script setup>
// The board engine — the columns + cards + drag logic shared by the named-view board (KanbanView)
// and the composed `board` block (PrimBoard). It is PURE PRESENTATION over already-resolved data:
// the host loads rows/refMaps/columns and passes them in; the core groups cards, renders them, and
// turns a drag into the right intent. When a PROCESS governs the group field a drag is a TRANSITION
// (emit `command`, so the host's confirm/input flow runs); otherwise it is a plain reassignment
// (emit `move` with the field patch, which the host PUTs).
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import UiChip from '../ui/UiChip.vue'
import UiValue from '../ui/UiValue.vue'
import PersonChip from '../ui/PersonChip.vue'
import { declaredFields, fieldMap, optionColor, optionLabel, displayTitle, personName, fmtValue } from '../manifest.js'
import { processForEntity, commandByKey, commandsForPlacement, commandEnabled, statusCellMoves } from '../commands.js'
import { toast } from '../host.js'

const { t } = useI18n()

const props = defineProps({
  handle: String, manifest: Object,
  entity: { type: Object, required: true },
  rows: { type: Array, default: () => [] },          // already filtered by the host
  refMaps: { type: Object, default: () => ({}) },
  columns: { type: Array, default: () => [] },        // [{ value, label, color }]
  groupField: { type: Object, default: null },        // the resolved field object
  cardFields: { type: Array, default: null },         // resolved field objects, or null → auto
  interactive: { type: Boolean, default: true },
  sumField: { type: String, default: null },          // a money field summed per column in the header
  access: { type: Object, default: () => ({}) },
  userId: { type: String, default: '' },
})
const emit = defineEmits(['open', 'command', 'move'])

const groupKey = computed(() => props.groupField?.key)
function cardsFor(val) { return props.rows.filter(r => r[groupKey.value] === val) }

// Card fields: the host may name them; otherwise the first two plain declared fields (not the group
// field, not longtext/reference).
const shownFields = computed(() => {
  if (Array.isArray(props.cardFields) && props.cardFields.length) return props.cardFields
  return declaredFields(props.entity)
    .filter(f => f.key !== groupKey.value && !['longtext', 'reference'].includes(f.type)).slice(0, 2)
})
// Bucket the card fields by role so the card reads like a Pipedrive card (title, quiet secondary
// lines, an emphasized value, and avatar/date in a footer) instead of a stack of "Label: value".
const buckets = computed(() => {
  const chips = [], persons = [], lines = []
  let money = null, date = null
  for (const f of shownFields.value) {
    if (['select', 'multiselect'].includes(f.type)) chips.push(f)
    else if (f.type === 'money' && !money) money = f
    else if (f.type === 'reference' && f.targetApp === 'platform' && f.targetEntity === 'person') persons.push(f)
    else if ((f.type === 'date' || f.type === 'datetime') && !date) date = f
    else lines.push(f)
  }
  return { chips, persons, lines, money, date }
})
// A card field's human text: a person reference → the person's name, a local reference → its
// resolved label, else the formatted value (without this a reference prints a raw GUID).
function cardText(f, rec) {
  const v = rec[f.key]
  if (v == null || v === '') return ''
  if (f.type === 'reference' && f.targetApp === 'platform' && f.targetEntity === 'person') return personName(v) || v
  if (f.type === 'reference') return props.refMaps[f.key]?.[v] ?? v
  return fmtValue(f, v, props.refMaps[f.key])
}

// Per-column value total (Pipedrive column header: "Σ value · N deals"), from the already-filtered
// cards, so it honors whatever search/facets the host applied. Dormant until a host names sumField.
const sumFieldDef = computed(() => (props.sumField ? fieldMap(props.entity)[props.sumField] : null))
function colSum(val) {
  return cardsFor(val).reduce((s, r) => s + (Number(r[props.sumField]) || 0), 0)
}

// A process governs this board when it exists for the entity AND drives the group field.
const process = computed(() => {
  const p = processForEntity(props.manifest, props.entity?.key)
  return p && p.stateField === groupKey.value ? p : null
})
function cardCommands(rec) {
  return commandsForPlacement(props.manifest, props.entity?.key, 'kanbanCard')
    .filter(c => commandEnabled(c, rec, props.access, props.entity?.key, props.userId, props.manifest))
}
// The card kebab: when the entity has a process, its LEGAL transitions from this card's state (open →
// Won/Lost, won/lost → Reopen) — so Reopen never shows on an open deal. Otherwise, placement commands.
function cardActions(rec) {
  const moves = statusCellMoves(props.manifest, props.entity?.key, rec, props.access, props.userId)
  if (moves) return moves.map(m => ({
    key: 'move:' + m.to, label: m.label, color: m.color,
    run: () => {
      if (m.run === 'command' && m.command) emit('command', m.command, rec, props.entity.key)
      else emit('move', rec, { [m.field]: m.to })
    },
  }))
  return cardCommands(rec).map(c => ({
    key: c.key, label: c.label, icon: c.icon,
    color: c.style === 'danger' ? 'error' : undefined,
    run: () => emit('command', c, rec, props.entity.key),
  }))
}
function transitionTo(rec, targetVal) {
  if (!process.value) return null
  const cur = rec[groupKey.value]
  return (process.value.transitions || []).find(t => (t.from || []).includes(cur) && t.to === targetVal) || null
}

let dragId = null
function onDragStart(id) { if (props.interactive) dragId = id }
function onDrop(val) {
  const id = dragId; dragId = null
  if (!props.interactive) return
  const rec = props.rows.find(r => r.id === id)
  if (!rec || rec[groupKey.value] === val) return

  // Process board: a drag must be a LEGAL transition. A command-bound transition runs its command
  // (via the host, so confirm/input show); a FREE transition (no command) is a plain field PUT — the
  // server's ProcessGuard rejects an illegal raw status change but allows a legal free one, so this
  // matches the inline status cell (statusCellMoves) exactly.
  if (process.value) {
    const t = transitionTo(rec, val)
    if (!t) { toast(`That move isn't allowed for this ${props.entity.label?.toLowerCase() || 'record'}.`, 'warning'); return }
    if (t.command) {
      const command = commandByKey(props.manifest, props.entity.key, t.command)
      if (command) emit('command', command, rec, props.entity.key)
      else toast(t('runtime.board.moveNeedsAction'), 'warning')
    } else {
      emit('move', rec, { [groupKey.value]: val })
    }
    return
  }
  // Plain board (no process): the host PUTs the field patch.
  emit('move', rec, { [groupKey.value]: val })
}
</script>

<template>
  <div v-if="!groupField" class="text-medium-emphasis pa-4">{{ $t('runtime.board.needsGroup') }}</div>
  <div v-else class="kanban">
    <div v-for="col in columns" :key="col.value" class="kanban-col" @dragover.prevent @drop="onDrop(col.value)">
      <div class="kanban-col-head">
        <span class="dot" :style="{ background: col.color }" />
        <span class="kanban-col-name">{{ col.label }}</span>
        <span class="count">{{ cardsFor(col.value).length }}</span>
      </div>
      <div v-if="sumFieldDef" class="kanban-col-sum">
        {{ fmtValue(sumFieldDef, colSum(col.value)) }} · {{ cardsFor(col.value).length }}
      </div>
      <div v-for="rec in cardsFor(col.value)" :key="rec.id" class="kanban-card" :draggable="interactive"
        @dragstart="onDragStart(rec.id)" @click="emit('open', rec)">
        <div class="kanban-card-top">
          <div class="kanban-card-title">{{ displayTitle(entity, rec, refMaps) }}</div>
          <v-menu v-if="cardActions(rec).length" location="bottom end">
            <template #activator="{ props: menu }">
              <v-btn v-bind="menu" icon="mdi-dots-vertical" size="x-small" variant="text" density="comfortable"
                class="kanban-card-kebab" @click.stop />
            </template>
            <v-list density="compact" min-width="160">
              <v-list-item v-for="a in cardActions(rec)" :key="a.key" @click.stop="a.run()">
                <template v-if="a.icon" #prepend>
                  <v-icon :icon="'mdi-' + a.icon" :color="a.color" size="18" />
                </template>
                <v-list-item-title :class="a.color === 'error' ? 'text-error' : ''">{{ a.label }}</v-list-item-title>
              </v-list-item>
            </v-list>
          </v-menu>
        </div>
        <div v-if="buckets.chips.length" class="kanban-card-chips">
          <template v-for="f in buckets.chips" :key="f.key">
            <UiChip v-if="rec[f.key]" :color="optionColor(f, Array.isArray(rec[f.key]) ? rec[f.key][0] : rec[f.key])">
              {{ optionLabel(f, Array.isArray(rec[f.key]) ? rec[f.key][0] : rec[f.key]) }}
            </UiChip>
          </template>
        </div>
        <div v-for="f in buckets.lines" :key="f.key" class="kanban-card-line">
          <UiValue v-if="cardText(f, rec)" :field="f" :value="rec[f.key]" :ref-map="refMaps[f.key]" />
        </div>
        <div v-if="buckets.money || buckets.date || buckets.persons.length" class="kanban-card-foot">
          <span v-if="buckets.money && cardText(buckets.money, rec)" class="kanban-card-value">{{ cardText(buckets.money, rec) }}</span>
          <span class="kanban-card-spacer" />
          <span v-if="buckets.date && rec[buckets.date.key]" class="kanban-card-date">{{ cardText(buckets.date, rec) }}</span>
          <template v-for="f in buckets.persons" :key="f.key">
            <PersonChip v-if="rec[f.key]" :person-id="rec[f.key]" :size="22" />
          </template>
        </div>
      </div>
      <div v-if="!cardsFor(col.value).length" class="kanban-empty">—</div>
    </div>
  </div>
</template>

<style scoped>
.kanban { display: flex; gap: 16px; overflow-x: auto; padding-bottom: 8px; align-items: flex-start; }
.kanban-col { min-width: 264px; width: 264px; background: rgb(var(--v-theme-surface-2)); border-radius: 12px; padding: 10px; }
/* On a touch screen the board is swiped rather than scrolled, and a free scroll leaves you looking
   at two half-columns. Snapping means one column at a time, which is what a board IS on a phone —
   the columns keep their width, so nothing is squashed to make it fit. */
@media (pointer: coarse) {
  .kanban { scroll-snap-type: x mandatory; }
  .kanban-col { scroll-snap-align: start; }
}
.kanban-col-head { display: flex; align-items: center; font-weight: 600; font-size: 13px; margin-bottom: 8px; }
.kanban-col-head .dot { width: 10px; height: 10px; border-radius: 50%; margin-right: 8px; flex: 0 0 auto; }
.kanban-col-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.kanban-col-head .count { margin-left: auto; color: rgba(var(--v-theme-on-surface), .6); padding-left: 8px; }
.kanban-col-sum { font-size: 12px; color: rgba(var(--v-theme-on-surface), .55); margin: -6px 0 8px 18px; }
.kanban-card { background: rgb(var(--v-theme-surface)); border: 1px solid rgb(var(--v-theme-outline)); border-radius: 10px; padding: 10px 12px; margin-bottom: 8px; cursor: pointer; box-shadow: 0 1px 2px rgba(0, 0, 0, .04); }
.kanban-card:hover { border-color: rgba(var(--v-theme-primary), .5); }
.kanban-card-top { display: flex; align-items: flex-start; gap: 4px; }
.kanban-card-title { font-weight: 600; font-size: 14px; line-height: 1.3; flex: 1 1 auto; min-width: 0; }
.kanban-card-kebab { flex: 0 0 auto; margin: -4px -6px 0 0; opacity: 0; transition: opacity .12s; }
/* No hover on touch, and this menu is how a card is moved between columns without dragging it —
   which is the accessible path and, on a phone, very often the only practical one. */
@media (pointer: coarse) { .kanban-card-kebab { opacity: 1; } }
.kanban-card:hover .kanban-card-kebab, .kanban-card-kebab:focus-visible { opacity: 1; }
.kanban-card-chips { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 6px; }
.kanban-card-line { font-size: 12.5px; color: rgba(var(--v-theme-on-surface), .6); margin-top: 3px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.kanban-card-foot { display: flex; align-items: center; flex-wrap: wrap; gap: 6px 8px; margin-top: 8px; }
.kanban-card-value { font-weight: 700; font-size: 14px; }
.kanban-card-spacer { flex: 1 1 auto; }
.kanban-card-date { font-size: 12px; color: rgba(var(--v-theme-on-surface), .55); }
.kanban-empty { text-align: center; color: rgba(var(--v-theme-on-surface), .45); padding: 8px; }
</style>
