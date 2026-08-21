<script setup>
// The one Vuetify data table for the generated-app renderer — built entirely on <v-data-table> (never a
// hand-rolled <table>), so column sizing, scrolling and spacing come from Vuetify and scale correctly.
// Client-side over the fetched rows: quick-search, sortable columns, per-column filters, column show/hide
// + reorder, density, CSV export, colored chips. Two behaviours:
//   • flat  — a list; click a row -> the host opens its detail/edit DIALOG. New rows via the host's button.
//   • tree  — an entity that nests via a self-reference (`parentField`). ONE table, so every depth shares
//             the same columns + config. Rows indent by depth with an expand caret; click a row -> dialog
//             (NEVER inline edit). Inline text is ONLY for ADDING: a placeholder add-row at the bottom for
//             the top level, and as the FIRST child of any expanded row for subtasks. Emits `add`.
// The config toolbar (search/filter/columns/…) is toggleable; nested rows never get their own.
import { ref, computed, watch, onMounted } from 'vue'
import UiChip from './UiChip.vue'
import PersonChip from './PersonChip.vue'
import RefStateBadge from './RefStateBadge.vue'
import RefLink from './RefLink.vue'
import UiFacetSelect from './UiFacetSelect.vue'
import UiOptionItem from './UiOptionItem.vue'
import { loadPeople, mediaUrl } from '../host.js'
import { isPersonField } from '../manifest.js'
import { hoistMe, isMe } from '../me.js'
import { fmtMoney, fmtNumber, recordStatus, recordSubtitle, fieldHref } from '../manifest.js'
import { useContentWidth } from '../responsive.js'
import { loadTableSettings, saveTableSettings } from '../host.js'
import { useSemanticDates } from '../tables/useSemanticDates.js'
import { useTableFiltering } from '../tables/useTableFiltering.js'
import { useTreeRows } from '../tables/useTreeRows.js'
import { useTableGrouping } from '../tables/useTableGrouping.js'
import { useSubtreeAggregates } from '../tables/useSubtreeAggregates.js'
import CellEditor from '../tables/CellEditor.vue'
import UiLink from './UiLink.vue'
import UiAvatar from './UiAvatar.vue'

const props = defineProps({
  columns: { type: Array, default: () => [] },      // [{ key, title, field }] — field = the manifest field def
  rows: { type: Array, default: () => [] },          // raw records
  refMaps: { type: Object, default: () => ({}) },    // { fieldKey: { recordId: displayLabel } }
  refTargets: { type: Object, default: () => ({}) }, // { fieldKey: { handle, entity, manifest, core } }
  refImages: { type: Object, default: () => ({}) },  // { fieldKey: { recordId: imageUrl } } — only when the target declares one
  refStates: { type: Object, default: () => ({}) },  // { fieldKey: { recordId: {kind,label} } } — non-live targets only
  loading: Boolean,
  entityLabel: { type: String, default: 'records' },
  toolbar: { type: Boolean, default: true },         // show the (toggleable) config toolbar at all
  showFooter: { type: Boolean, default: false },     // force the footer even when the rows fit one page
  // The server has more rows than were fetched. Without saying so, a table that holds the first N of
  // a much larger set reads as the whole set — and its filters and counts quietly lie.
  truncated: { type: Boolean, default: false },
  total: { type: Number, default: 0 },               // what the server actually has, when truncated
  canDelete: { type: Boolean, default: false },      // show the per-row delete action
  handle: { type: String, default: '' },             // app handle — with settingsKey, activates per-user persistence
  settingsKey: { type: String, default: '' },        // stable identity of this table in the app's settings blob
  // semantics: the entity's FULL declared field defs (not only the visible columns) — the status
  // field's option phases + role:'start'/'due' drive the done check and date colorization even
  // when those fields aren't shown. Omit to degrade gracefully to the column field defs.
  fields: { type: Array, default: null },
  // the authored $defs/filterBar shape ({ search:[keys], facets:[keys] }) — renders the
  // always-visible search + facet bar above the table. Null = no bar (Options toolbar only).
  filterBar: { type: Object, default: null },
  // row grouping ($defs/groupBy, resolved by the caller via tableGroups.resolveGroups):
  // groupField = the key on the rows; groups = ordered [{ id, label }]. Tree mode groups
  // TOP-LEVEL rows only — subtrees stay nested under their parent. Sorting is disabled
  // (and pagination off) while grouped, or the buckets would interleave.
  groupField: { type: String, default: null },
  groups: { type: Array, default: null },
  ungroupedLabel: { type: String, default: '' },
  showEmptyGroups: { type: Boolean, default: false },
  // manual row order: the numeric field rows sort by (empty last). Inline adds append after the
  // last sibling; the move menu (and later drag & drop) writes it. Null = automatic ordering.
  orderField: { type: String, default: null },
  // inline group management (Asana sections): the trailing "+ Add section" row, and the header
  // hover actions (rename/delete). The host owns the actual writes via the *-group emits.
  canAddGroup: { type: Boolean, default: false },
  canEditGroups: { type: Boolean, default: false },
  // inline cell editing: selects/dates/numbers/people change in place (cell-edit emit); a governed
  // status offers its LEGAL transitions via transitionsFor (command emit). First column never edits.
  inlineEdit: { type: Boolean, default: false },
  transitionsFor: { type: Function, default: null },  // record -> statusCellMoves() output
  // Commands placed on the ROW. `{ count, resolve(record) -> [command] }` — the count reserves the
  // column width up front (it cannot come from `resolve`, which answers per row and may hide a
  // guarded-out command), and resolving is the caller's job because deciding what may run needs the
  // manifest, the access map and the acting user, none of which a table should know about.
  rowCommands: { type: Object, default: null },
  // tree mode
  tree: { type: Boolean, default: false },
  parentField: { type: String, default: '' },        // the self-referential field the tree nests by
  rootParent: { default: null },                     // parent value that marks a root row (null = top level)
  maxDepth: { type: Number, default: 4 },
  addLabel: { type: String, default: '' },
  // DEFAULT FALSE, deliberately. An add row is only correct where creation is meaningful, and this
  // component is used for read-only lists and for tables over aggregate sources that have no records
  // to insert. Defaulting on would have grown an "Add …" row on every one of them the moment the
  // flat path learned to render adders. The AUTHORING default (`block.inlineCreate`) is true; the
  // component's is false, and each call site says which of its tables qualifies.
  canAdd: { type: Boolean, default: false },
  // The row entity's own visual identity. `imageField` opts the table into an always-present
  // rounded-square brand mark; missing/broken images use UiAvatar's stable initials fallback so
  // rows never jump between "logo layout" and "plain text layout".
  imageField: { type: String, default: '' },
  imageNameField: { type: String, default: '' },
})
const emit = defineEmits(['row-click', 'edit', 'delete', 'add', 'move', 'add-group', 'rename-group', 'delete-group', 'cell-edit', 'command'])

const search = ref('')
const showFilters = ref(false)
const density = ref('comfortable')
const filters = ref({})                              // { colKey: value | value[] }
const configOpen = ref(false)                        // toolbar controls collapsed until the user opens Options
const draft = ref({})                                // tree: add-row text, keyed by parentId (or '__root__')

// --- semantics (phase + start/due roles) + the always-visible filter bar ---
const semFields = computed(() => props.fields ?? props.columns.map(c => c.field).filter(Boolean))
const { statusField, isDone, dateUrgency, fmtDateCell } = useSemanticDates(semFields)
const { searchQ, facetSel, fbActive, fbRows, facetFields, facetItems } = useTableFiltering({
  rows: computed(() => props.rows), filterBar: computed(() => props.filterBar),
  fields: semFields, refMaps: computed(() => props.refMaps),
  tree: computed(() => props.tree), parentField: computed(() => props.parentField),
  // same identity the column/density settings use — one table, one remembered filter state
  handle: computed(() => props.handle), scopeKey: computed(() => props.settingsKey),
})
// The filter bar searches person references by NAME — warm the directory once when a bar exists.
watch(() => props.filterBar, fb => { if (fb) loadPeople().catch(() => { /* names just won't resolve */ }) }, { immediate: true })

// Manual order: rows sort by the orderField (numeric, empty last; stable, so load order breaks ties).
function orderNum(v) { const n = Number(v); return v == null || v === '' || isNaN(n) ? Infinity : n }
const orderedRows = computed(() => {
  if (!props.orderField) return fbRows.value
  const of = props.orderField
  return [...fbRows.value].sort((a, b) => {
    const an = orderNum(a[of]), bn = orderNum(b[of])
    return an === bn ? 0 : an - bn
  })
})

// Column state (visibility + order): defaults from the incoming columns, overlaid with the user's
// persisted per-table settings (loaded once per app via tableSettings.js). Saves are EXPLICIT calls
// from the mutation handlers — never a watcher — so hydration can't trigger a save-loop.
const colState = ref([])
const persisted = ref(null)                          // the saved { cols, density } entry, once loaded
function mergeCols(cols, saved) {
  if (!saved?.cols?.length) return cols.map(c => ({ ...c, visible: true }))
  const byKey = new Map(cols.map(c => [c.key, c]))
  const out = []
  for (const s of saved.cols) {
    const c = byKey.get(s.key)
    if (!c) continue                                 // stale key from an older definition — drop it
    byKey.delete(s.key)
    out.push({ ...c, visible: s.visible !== false })
  }
  for (const c of cols) if (byKey.has(c.key)) out.push({ ...c, visible: true })  // new fields: append visible
  if (!out.some(c => c.visible)) out.forEach(c => { c.visible = true })          // never an all-hidden table
  return out
}
watch(() => props.columns, cols => {
  colState.value = mergeCols(cols, persisted.value)
  filters.value = {}
}, { immediate: true })
watch(persisted, () => { colState.value = mergeCols(props.columns, persisted.value) })  // late hydration: keep filters

onMounted(async () => {
  if (!props.handle || !props.settingsKey) return
  const entry = await loadTableSettings(props.handle, props.settingsKey)
  if (!entry) return
  if (['compact', 'comfortable'].includes(entry.density)) density.value = entry.density
  if (Array.isArray(entry.collapsed)) collapsedKeys.value = new Set(entry.collapsed.map(String))
  persisted.value = entry
})
function saveSettings() {
  if (!props.handle || !props.settingsKey) return
  saveTableSettings(props.handle, props.settingsKey, {
    cols: colState.value.map(c => ({ key: c.key, visible: !!c.visible })),
    density: density.value,
    collapsed: [...collapsedKeys.value],
  })
}

const visibleCols = computed(() => colState.value.filter(c => c.visible))
const treeColKey = computed(() => visibleCols.value[0]?.key)     // first column carries the tree affordances
const headers = computed(() => [
  // Sorting is off in tree mode (structure is the order) AND while grouped (buckets would interleave).
  ...visibleCols.value.map(c => ({ title: c.title, key: c.key, sortable: !props.tree && !grouping.on.value })),
  // Actions cell: edit (+delete) + the tree move menu — width follows what's actually shown.
  { title: '', key: '_actions', sortable: false, align: 'end',
    width: (props.canDelete ? 96 : 56) + (props.tree ? 40 : 0) + 34 * (props.rowCommands?.count || 0) },
])
const chipKeys = computed(() =>
  new Set(visibleCols.value.filter(c => ['select', 'multiselect'].includes(c.field?.type) && c.key !== treeColKey.value).map(c => c.key)))
const personKeys = computed(() =>
  new Set(visibleCols.value.filter(c => isPersonField(c.field) && c.key !== treeColKey.value).map(c => c.key)))
// Money columns keep the RAW number in the item (numeric sort) and format only in the cell slot.
const moneyKeys = computed(() =>
  new Set(visibleCols.value.filter(c => c.field?.type === 'money' && c.key !== treeColKey.value).map(c => c.key)))
// Date columns likewise: raw ISO in the item (correct sort), formatted + urgency-colored in the slot.
const dateKeys = computed(() =>
  new Set(visibleCols.value.filter(c => ['date', 'datetime'].includes(c.field?.type) && c.key !== treeColKey.value).map(c => c.key)))
// Local reference columns take a template of their own for ONE reason: a reference to a cancelled
// record has to carry its badge. Person columns already get theirs from PersonChip.
const localRefKeys = computed(() =>
  new Set(visibleCols.value.filter(c => c.field?.type === 'reference' && !isPersonField(c.field)
    && c.key !== treeColKey.value).map(c => c.key)))
function fieldFor(key) { return colState.value.find(c => c.key === key)?.field }
function rowImage(rec) {
  const v = props.imageField ? rec?.[props.imageField] : null
  return typeof v === 'string' && /^(https?:\/\/|\/)/.test(v) ? mediaUrl(v) : null
}
function rowImageName(rec) {
  const key = props.imageNameField || treeColKey.value
  return String(rec?.[key] ?? '')
}
// A reference into ANOTHER app gets a link, because clicking the row opens the wrong record and there
// is no other way to reach the real one. Same-app references stay plain text: the row click already
// goes somewhere sensible, and turning every reference cell into a link is a change to every app.
// The gate is `core`, deliberately: it is the CROSS-APP case that has no other route. Kept as-is now
// that the click peeks rather than navigates — a same-app reference could usefully peek too, but
// flipping it changes every app's tables and belongs in its own change, not smuggled into this one.
function crossAppTarget(key) {
  const t = props.refTargets[key]
  return t?.core ? t : null
}
function refStateFor(key, item) { return props.refStates[key]?.[item._raw?.[key]] || null }
function dateClass(key, item) {
  const u = dateUrgency(fieldFor(key), item._raw)
  return u === 'over' ? 'ui-dt-date-over' : u === 'soon' ? 'ui-dt-date-soon' : ''
}
// A remaining set for inline editing only: plain text/number cells that have no read-only template
// of their own. Empty unless inlineEdit — so read-only tables keep the default cell rendering.
const plainEditKeys = computed(() => {
  if (!props.inlineEdit) return new Set()
  const covered = new Set([...chipKeys.value, ...personKeys.value, ...moneyKeys.value, ...dateKeys.value])
  return new Set(visibleCols.value
    .filter(c => ['text', 'email', 'url', 'phone', 'integer', 'decimal'].includes(c.field?.type)
      && c.key !== treeColKey.value && !covered.has(c.key))
    .map(c => c.key))
})
// Plain number columns that no other template covers: the item keeps the raw number (numeric sort,
// numeric filtering) and the cell prints the field's declared scale/unit — otherwise a computed
// ratio lands in the table as '0.7294117647058823'.
const numKeys = computed(() => {
  const covered = new Set([...moneyKeys.value, ...plainEditKeys.value, ...aggPlainKeys.value])
  return new Set(visibleCols.value
    .filter(c => ['integer', 'decimal'].includes(c.field?.type)
      && c.key !== treeColKey.value && !covered.has(c.key))
    .map(c => c.key))
})
// URL columns render as real links rather than dead text — the same treatment PrimLeaf and
// RecordFields give a url field, so a source URL is clickable wherever it appears. Skipped while
// inline editing owns the cell (plainEditKeys), since one slot name can only have one template.
// Also a `slug` field carrying a prefix: `/book/intro-call` is an address wherever it appears, and a
// booking page whose link is unclickable text in the one list that shows it is the whole record
// being unusable from its own screen. `fieldHref` is the single rule (see manifest.js).
const urlKeys = computed(() => new Set(visibleCols.value
  .filter(c => (c.field?.type === 'url' || (c.field?.input === 'slug' && c.field?.prefix))
    && c.key !== treeColKey.value && !plainEditKeys.value.has(c.key))
  .map(c => c.key)))
function cellTransitions(item) { return props.transitionsFor ? props.transitionsFor(item._raw) : null }
// Flagged numeric columns that no other template covers (inline editing off): they still need a
// template so the subtree-sum suffix can render.
const aggPlainKeys = computed(() => {
  const s = new Set()
  for (const k of aggFieldKeys.value) {
    if (k === treeColKey.value || moneyKeys.value.has(k) || plainEditKeys.value.has(k)) continue
    s.add(k)
  }
  return s
})
// May THIS cell edit in place? Never the first column (click = open), never runtime-owned or
// structural fields; a governed status only when it has legal moves; local references stay in
// the dialog (they scope trees/groups — an inline swap would silently restructure the list).
function canEditCell(key, item) {
  if (!props.inlineEdit || item._adder || item._group || item._addGroup) return false
  const f = fieldFor(key)
  if (!f || key === treeColKey.value) return false
  if (f.readOnly || f.system || f.auto || f.setByCommand || f.computed) return false
  if (['multiselect', 'boolean', 'longtext', 'attachment', 'json'].includes(f.type)) return false
  if (f.type === 'reference' && !isPersonField(f)) return false
  if (f.governedBy) return (cellTransitions(item)?.length ?? 0) > 0
  return true
}

// --- value formatting ---
function optColor(field, v) { return (field.options ?? []).find(o => o.value === v)?.color || '#64748b' }
function optLabel(field, v) { return (field.options ?? []).find(o => o.value === v)?.label ?? v }
function display(field, raw, key) {
  const v = raw[key]
  if (v === null || v === undefined || v === '') return ''
  if (field.type === 'reference') return props.refMaps[key]?.[v] ?? v
  if (field.type === 'boolean') return v ? 'Yes' : 'No'
  if (field.type === 'money') return fmtMoney(field, v)
  if (field.type === 'multiselect' && Array.isArray(v)) return v.map(x => optLabel(field, x)).join(', ')
  if (field.type === 'select') return optLabel(field, v)
  if (field.type === 'date' || field.type === 'datetime') return fmtDateCell(field, v)
  // A computed ratio arrives with every digit the arithmetic produced — the field's own scale/unit
  // are what make it read as '0.73x' or '40.7%'. Only the CELL is formatted; the row still sorts and
  // filters on the raw number (see sortValue).
  if (field.type === 'integer' || field.type === 'decimal') return fmtNumber(field, v)
  return v
}
// The value placed in the row for sort/search: labels for coded fields, raw for numbers/dates/text.
function sortValue(field, raw, key) {
  if (['reference', 'boolean', 'select', 'multiselect'].includes(field.type)) return display(field, raw, key)
  return raw[key] ?? ''
}

// --- per-column filtering (flat mode) ---
const filterableCols = computed(() => visibleCols.value.filter(c =>
  ['select', 'multiselect', 'text', 'longtext', 'email', 'url', 'phone', 'reference'].includes(c.field?.type)))
function selectFilterItems(col) {
  return (col.field.options ?? []).map(o => ({ value: o.value, title: o.label, color: o.color }))
}
function isSelectFilter(col) { return ['select', 'multiselect'].includes(col.field.type) }
// Reference filters (incl. platform people) offer the resolved targets as options instead of free text —
// but only when the refMap actually loaded; otherwise they degrade to the substring filter below.
function isRefFilter(col) { return col.field?.type === 'reference' && Object.keys(props.refMaps[col.key] ?? {}).length > 0 }
function refFilterItems(col) {
  const list = Object.entries(props.refMaps[col.key] ?? {}).map(([value, title]) => ({ value, title }))
  return isPersonField(col.field) ? hoistMe(list) : list      // me first, same as every other person list
}

const filteredRows = computed(() => orderedRows.value.filter(r => {
  for (const [key, val] of Object.entries(filters.value)) {
    if (val === null || val === undefined || val === '' || (Array.isArray(val) && !val.length)) continue
    const col = colState.value.find(c => c.key === key)
    if (!col) continue
    const cell = r[key]
    if (col.field.type === 'select') {
      if (Array.isArray(val) ? !val.includes(cell) : cell !== val) return false
    } else if (col.field.type === 'multiselect') {
      const arr = Array.isArray(cell) ? cell : (cell != null ? [cell] : [])
      if (!val.some(v => arr.includes(v))) return false
    } else if (col.field.type === 'reference' && Array.isArray(val)) {
      if (!val.includes(String(cell ?? ''))) return false   // refMap keys are strings — match raw ids
    } else {
      const dv = String(display(col.field, r, key) ?? '').toLowerCase()
      if (!dv.includes(String(val).toLowerCase())) return false
    }
  }
  return true
}))
const activeFilterCount = computed(() =>
  Object.values(filters.value).filter(v => v != null && v !== '' && !(Array.isArray(v) && !v.length)).length)

// --- collapsible sections ---------------------------------------------------------------------
// A group header collapses to hide its rows (and, in tree mode, its own add-row). The user's intent
// is per table and roams with the column settings. While ANY search/filter is active the collapsed
// set is overridden to empty — a collapsed section must never hide a match — and the intent comes
// back untouched when the filter clears, which is why the override is a view over the stored set
// rather than a write to it.
const collapsedKeys = ref(new Set())
const filterActive = computed(() => fbActive.value || !!search.value || activeFilterCount.value > 0)
function gkey(gid) { return String(gid ?? '__none__') }
function isCollapsed(gid) { return !filterActive.value && collapsedKeys.value.has(gkey(gid)) }
function setCollapsed(next) { collapsedKeys.value = next; saveSettings() }
function toggleGroup(gid) {
  const k = gkey(gid)
  const next = new Set(collapsedKeys.value)
  if (next.has(k)) next.delete(k)
  else next.add(k)
  setCollapsed(next)
}
/** Reveal a section a row was just moved into — a drop that lands out of sight reads as a loss. */
function expandGroup(gid) {
  const k = gkey(gid)
  if (!collapsedKeys.value.has(k)) return
  const next = new Set(collapsedKeys.value)
  next.delete(k)
  setCollapsed(next)
}
const allCollapsed = computed(() => buckets.value.length > 0 && buckets.value.every(b => isCollapsed(b.id)))
function toggleAllGroups() {
  setCollapsed(allCollapsed.value ? new Set() : new Set(buckets.value.map(b => gkey(b.id))))
}

// --- tree: the flattened, indented visible row list (engine in tables/useTreeRows.js) ---
function shaped(r, depth) {
  const o = { _raw: r, id: r.id, _depth: depth, _adder: false }
  for (const c of visibleCols.value) o[c.key] = sortValue(c.field, r, c.key)
  return o
}
const { childrenMap, rootRows, buildItems, makeAdder, treeItems, expandedIds, canNest, toggleExpand, expandAll } = useTreeRows({
  enabled: computed(() => props.tree), rows: orderedRows,
  parentField: computed(() => props.parentField), rootParent: computed(() => props.rootParent),
  maxDepth: computed(() => props.maxDepth), canAdd: computed(() => props.canAdd),
  shape: shaped, suppressAdders: fbActive,
})
// A filter must never hide its matches behind a collapsed parent — open everything when one activates.
watch(fbActive, active => { if (active && props.tree) expandAll() })

// --- subtree sums (field.treeAggregate): a parent renders `own (subtree total)` on flagged
// numeric columns — display-only; server rollups already count every row (rule A). ---
const aggFieldKeys = computed(() => props.tree
  ? visibleCols.value.filter(c => c.field?.treeAggregate === 'sum'
      && ['integer', 'decimal', 'money'].includes(c.field.type)).map(c => c.key)
  : [])
const { sums: subtreeSums } = useSubtreeAggregates({
  enabled: computed(() => props.tree && aggFieldKeys.value.length > 0),
  childrenMap, rows: orderedRows, aggFields: aggFieldKeys,
})
/** The formatted `(total)` suffix for this cell, or '' (leaf rows / no difference / not flagged). */
function aggSuffix(key, item) {
  if (!props.tree || !aggFieldKeys.value.includes(key)) return ''
  if (!(childrenMap.value.get(item.id)?.length)) return ''
  const s = subtreeSums.value.get(item.id)?.[key]
  if (s == null) return ''
  const own = Number(item._raw[key]) || 0
  if (s === own) return ''
  const f = fieldFor(key)
  return f?.type === 'money' ? fmtMoney(f, s) : String(Math.round(s * 100) / 100)
}

// --- grouping: partition rows into labeled buckets (engine in tables/useTableGrouping.js) ---
const grouping = useTableGrouping({
  groupField: computed(() => props.groupField), groups: computed(() => props.groups),
  ungroupedLabel: computed(() => props.ungroupedLabel), showEmpty: computed(() => props.showEmptyGroups),
})
const groupingOn = grouping.on
// The buckets this table currently shows: tree mode groups TOP-LEVEL rows (subtrees stay nested),
// flat mode groups the filtered rows. Empty when the table isn't grouped.
const buckets = computed(() => grouping.on.value
  ? grouping.partition(props.tree ? rootRows.value : filteredRows.value)
  : [])

const items = computed(() => {
  if (props.tree) {
    if (!grouping.on.value) return treeItems.value
    // Grouped tree: partition the TOP-LEVEL rows; each bucket renders its header, its roots with
    // their subtrees intact, then its OWN "Add task…" row (new rows land in that section). The
    // trailing "+ Add section" pseudo-row creates a new group inline. A collapsed bucket contributes
    // its header ONLY — its add-row goes with it, since adding into a section you can't see is a trap.
    const out = []
    for (const b of buckets.value) {
      out.push(grouping.groupRow(b))
      if (isCollapsed(b.id)) continue
      out.push(...buildItems(b.rows, 0))
      if (props.canAdd && !fbActive.value)
        out.push({ _raw: {}, id: 'adder:group:' + (b.id ?? '__none__'), _depth: 0, _adder: true, _parentId: null, _groupId: b.id })
    }
    if (props.canAddGroup && !fbActive.value) out.push({ _raw: {}, id: 'add-group', _addGroup: true })
    return out
  }
  const shapeFlat = r => {
    const o = { _raw: r, id: r.id }
    for (const c of visibleCols.value) o[c.key] = sortValue(c.field, r, c.key)
    return o
  }
  // FLAT and GROUPED tables get add rows too, not just trees. The adder machinery has always been
  // here; only the tree branch above ever produced the rows, so a page-level list — a Tasks tab, a
  // day planner — had no way to take a typed-in record and had to send you to a form. `canAdd` is
  // what the caller uses to say creation is meaningful here (a real entity, create permission, a
  // field to type into); pagination is suppressed for the same reason grouping suppresses it, since
  // an add row stranded on page 2 is worse than none.
  //
  // A filter bar being active hides it: the row you type would be judged against a filter it was
  // not given values for, so it would appear and vanish. Same rule the grouped tree already used.
  if (!grouping.on.value) {
    const flat = filteredRows.value.map(shapeFlat)
    if (props.canAdd && !fbActive.value)
      flat.push({ _raw: {}, id: 'adder:root', _depth: 0, _adder: true, _parentId: null, _groupId: null })
    return flat
  }
  const out = []
  for (const b of buckets.value) {
    out.push(grouping.groupRow(b))
    if (isCollapsed(b.id)) continue
    out.push(...b.rows.map(shapeFlat))
    if (props.canAdd && !fbActive.value)
      out.push({ _raw: {}, id: 'adder:group:' + (b.id ?? '__none__'), _depth: 0, _adder: true, _parentId: null, _groupId: b.id })
  }
  if (props.canAddGroup && !fbActive.value) out.push({ _raw: {}, id: 'add-group', _addGroup: true })
  return out
})

// Pagination adds nothing when everything fits one page — hide the footer unless forced via showFooter.
// Grouped tables never paginate (a page break through a bucket reads as missing rows).
const PAGE_SIZE = 10
const pageSize = computed(() => (props.tree || grouping.on.value || props.canAdd) ? -1 : PAGE_SIZE)
const hideFooter = computed(() => props.tree || grouping.on.value || props.canAdd || (!props.showFooter && items.value.length <= PAGE_SIZE))
// Adder rows key their draft by parent (subtask adders), group (per-section adders) or root.
function draftKey(item) {
  return item._parentId != null ? item._parentId : (item._groupId != null ? 'group:' + item._groupId : '__root__')
}
function maxOrder(rows) {
  let m = 0
  for (const r of rows ?? []) { const n = Number(r[props.orderField]); if (!isNaN(n) && n > m) m = n }
  return m
}
/** The order value a row appended to this adder's container should get (null without orderField). */
function nextOrderFor(item) {
  if (!props.orderField) return null
  if (item._parentId != null) return maxOrder(childrenMap.value.get(item._parentId)) + 10
  if (grouping.on.value) {
    const b = grouping.partition(rootRows.value).find(x => x.id === (item._groupId ?? null))
    return maxOrder(b?.rows) + 10
  }
  return maxOrder(rootRows.value) + 10
}
function submitAdd(item) {
  const key = draftKey(item)
  const title = (draft.value[key] || '').trim()
  if (!title) return
  emit('add', { title, parentId: item._parentId ?? null, groupId: item._groupId ?? null, order: nextOrderFor(item) })
  draft.value[key] = ''
}
function onRowClick(item) {
  if (item._group) { toggleGroup(item._gid); return }   // the whole header row is the collapse target
  if (!item._adder && !item._addGroup) emit('row-click', item._raw)
}

// --- drag & drop (tree mode): reorder / move across sections / drop-onto = nest --------------
// Native HTML5 DnD off a per-row HANDLE (an input inside a draggable <tr> would fight text
// selection — the handle sidesteps it, Asana-style). Rows are drop targets via row-props.
// Zones per row rect: top/bottom 30% = insert before/after (join the target's container),
// middle 40% = nest under the target. Group headers + section adders = append to that section.
// Every drop emits the SAME move(record, patch) the menu path uses — one write path.
const dragId = ref(null)
const dropTarget = ref(null)               // { id, zone: 'before' | 'after' | 'into' | 'group' }

function canDrag(item) { return props.tree && !item._adder && !item._group && !item._addGroup }
function canJoin(dragged, parentId) {
  if (parentId == null) return true
  if (parentId === dragged.id || descendantIds(dragged.id).has(parentId)) return false
  const p = rowById.value.get(parentId)
  if (!p) return false
  return depthOf(p) + 1 + subtreeHeight(dragged.id) <= props.maxDepth - 1
}
function containerSiblings(parentId, gid) {
  if (parentId != null) return childrenMap.value.get(parentId) ?? []
  if (grouping.on.value) return grouping.partition(rootRows.value).find(b => b.id === (gid ?? null))?.rows ?? []
  return rootRows.value
}
function onDragStart(e, item) {
  dragId.value = item.id
  e.dataTransfer.effectAllowed = 'move'
  try { e.dataTransfer.setData('text/plain', String(item.id)) } catch { /* IE-era quirk guard */ }
  const tr = e.target.closest('tr')
  if (tr) e.dataTransfer.setDragImage(tr, 16, 16)
}
function onDragEnd() { dragId.value = null; dropTarget.value = null }
function onDragOver(e, item) {
  const dragged = dragId.value != null ? rowById.value.get(dragId.value) : null
  if (!dragged) return
  let zone = null
  if (item._group || '_groupId' in item) {
    zone = 'group'                                        // header / section adder: append to the section
  } else if (!item._adder && !item._addGroup && item.id !== dragged.id) {
    const t = item._raw
    const rect = e.currentTarget.getBoundingClientRect()
    const y = (e.clientY - rect.top) / rect.height
    const intoOk = canJoin(dragged, t.id)
    const joinOk = canJoin(dragged, t[props.parentField] ?? null)
    if (intoOk && y >= 0.3 && y <= 0.7) zone = 'into'
    else if (joinOk) zone = y < 0.5 ? 'before' : 'after'
    else if (intoOk) zone = 'into'
  }
  if (!zone) { if (dropTarget.value?.id === item.id) dropTarget.value = null; return }
  e.preventDefault()
  e.dataTransfer.dropEffect = 'move'
  const cur = dropTarget.value
  if (!cur || cur.id !== item.id || cur.zone !== zone) dropTarget.value = { id: item.id, zone }
}
function onDragLeave(e, item) {
  if (e.currentTarget.contains(e.relatedTarget)) return   // still inside this row's cells
  if (dropTarget.value?.id === item.id) dropTarget.value = null
}
function num(v) { const n = Number(v); return v == null || v === '' || isNaN(n) ? null : n }
function onDrop(e, item) {
  e.preventDefault()
  const zone = dropTarget.value?.id === item.id ? dropTarget.value.zone : null
  const dragged = dragId.value != null ? rowById.value.get(dragId.value) : null
  dragId.value = null; dropTarget.value = null
  if (!dragged || !zone) return

  if (zone === 'group') {
    const gid = item._group ? (item._gid ?? null) : (item._groupId ?? null)
    dropMove(dragged, null, gid, maxOrder(containerSiblings(null, gid).filter(r => r.id !== dragged.id)) + 10)
    expandGroup(gid)                                            // show where it landed
    return
  }
  const t = item._raw
  if (zone === 'into') {
    dropMove(dragged, t.id, undefined, maxOrder((childrenMap.value.get(t.id) ?? []).filter(r => r.id !== dragged.id)) + 10)
    expandedIds.value = new Set([...expandedIds.value, t.id])   // show where it landed
    return
  }
  // before/after: join the target's container at the midpoint between its neighbors
  const parentId = t[props.parentField] ?? null
  const gid = parentId == null ? (t[props.groupField] ?? null) : undefined
  const sibs = containerSiblings(parentId, gid).filter(r => r.id !== dragged.id)
  const idx = sibs.findIndex(r => r.id === t.id)
  const pos = zone === 'before' ? idx : idx + 1
  let order = null
  if (props.orderField) {
    const prevO = pos > 0 ? num(sibs[pos - 1]?.[props.orderField]) : null
    const nextO = pos < sibs.length ? num(sibs[pos]?.[props.orderField]) : null
    if (prevO != null && nextO != null) {
      if (nextO - prevO < 1e-9) { renumberInto(sibs, dragged, pos, parentId, gid); return }
      order = (prevO + nextO) / 2
    } else if (nextO != null) order = nextO - 10
    else if (prevO != null) order = prevO + 10
    else order = 10
  }
  dropMove(dragged, parentId, gid, order)
}
/** One move emit: parent change, section change (top level only), order — only what differs. */
function dropMove(dragged, parentId, gid, order) {
  const patch = {}
  if ((dragged[props.parentField] ?? null) !== parentId) patch[props.parentField] = parentId
  if (gid !== undefined && props.groupField && (dragged[props.groupField] ?? null) !== gid) patch[props.groupField] = gid
  if (props.orderField && order != null) patch[props.orderField] = order
  if (Object.keys(patch).length) emit('move', dragged, patch)
}
/** Midpoint gap exhausted (rare): renumber the whole container by 10s with the dragged row at pos. */
function renumberInto(sibs, dragged, pos, parentId, gid) {
  const final = [...sibs]
  final.splice(pos, 0, dragged)
  for (let i = 0; i < final.length; i++) {
    const r = final[i]
    if (r.id === dragged.id) dropMove(dragged, parentId, gid, (i + 1) * 10)
    else emit('move', r, { [props.orderField]: (i + 1) * 10 })
  }
}

function rowProps({ item }) {
  const cls = []
  if (item._group) cls.push('ui-dt-group-row')
  if (dragId.value != null && item.id === dragId.value) cls.push('ui-dt-dragging')
  if (dropTarget.value?.id === item.id) cls.push('ui-dt-drop-' + dropTarget.value.zone)
  const base = cls.length ? { class: cls.join(' ') } : {}
  if (props.tree) {
    base.onDragover = e => onDragOver(e, item)
    base.onDrop = e => onDrop(e, item)
    base.onDragleave = e => onDragLeave(e, item)
  }
  return base
}

// --- inline group management (Asana sections): add / rename / delete ---
const addGroupDraft = ref('')
function submitAddGroup() {
  const name = addGroupDraft.value.trim()
  if (!name) return
  emit('add-group', name)
  addGroupDraft.value = ''
}
const renameGroupId = ref(null)
const renameDraft = ref('')
function startRename(item) { renameGroupId.value = item.id; renameDraft.value = item._label }
function submitRename(item) {
  if (renameGroupId.value !== item.id) return           // blur after enter must not double-fire
  renameGroupId.value = null
  const name = renameDraft.value.trim()
  if (name && name !== item._label) emit('rename-group', item._gid, name)
}

// --- the row "move" menu: move to section / make subtask of… / promote to top level ---
const subtaskDialog = ref(false)
const subtaskSource = ref(null)
const subtaskTarget = ref(null)
function descendantIds(id) {
  const out = new Set()
  const walk = pid => { for (const r of childrenMap.value.get(pid) ?? []) { out.add(r.id); walk(r.id) } }
  walk(id)
  return out
}
const rowById = computed(() => new Map(props.rows.map(r => [r.id, r])))
function depthOf(row) {
  let d = 0, cur = row
  while (cur && cur[props.parentField] != null && rowById.value.has(cur[props.parentField])) { d++; cur = rowById.value.get(cur[props.parentField]) }
  return d
}
function subtreeHeight(id) {
  let h = 0
  for (const r of childrenMap.value.get(id) ?? []) h = Math.max(h, 1 + subtreeHeight(r.id))
  return h
}
function isCurrentSection(item, gid) {
  return item._raw[props.parentField] == null && (item._raw[props.groupField] ?? null) === gid
}
function moveToSection(item, gid) {
  const patch = { [props.groupField]: gid }
  if (item._raw[props.parentField] != null) patch[props.parentField] = null   // moving into a section promotes
  if (props.orderField) {
    const b = grouping.partition(rootRows.value).find(x => x.id === gid)
    patch[props.orderField] = maxOrder(b?.rows) + 10
  }
  emit('move', item._raw, patch)
  expandGroup(gid)                                              // show where it landed
}
function openSubtaskDialog(item) { subtaskSource.value = item._raw; subtaskTarget.value = null; subtaskDialog.value = true }
const subtaskCandidates = computed(() => {
  const src = subtaskSource.value
  if (!src) return []
  const excluded = descendantIds(src.id)
  excluded.add(src.id)
  const h = subtreeHeight(src.id)
  return props.rows
    .filter(r => !excluded.has(r.id) && depthOf(r) + 1 + h <= props.maxDepth - 1)
    .map(r => ({ value: r.id, title: String(r[treeColKey.value] ?? r.id) }))
})
function submitSubtask() {
  if (!subtaskSource.value || !subtaskTarget.value) return
  const patch = { [props.parentField]: subtaskTarget.value }
  if (props.orderField) patch[props.orderField] = maxOrder(childrenMap.value.get(subtaskTarget.value)) + 10
  emit('move', subtaskSource.value, patch)
  subtaskDialog.value = false
}
function promote(item) {
  const parent = rowById.value.get(item._raw[props.parentField])
  const patch = { [props.parentField]: null }
  if (props.groupField && parent) patch[props.groupField] = parent[props.groupField] ?? null
  if (props.orderField) {
    const gid = props.groupField ? (patch[props.groupField] ?? null) : null
    const sibs = grouping.on.value ? grouping.partition(rootRows.value).find(b => b.id === gid)?.rows : rootRows.value
    patch[props.orderField] = maxOrder(sibs) + 10
  }
  emit('move', item._raw, patch)
}

// --- column show/hide + reorder ---
function moveCol(i, dir) {
  const j = i + dir
  if (j < 0 || j >= colState.value.length) return
  const arr = colState.value.slice()
  ;[arr[i], arr[j]] = [arr[j], arr[i]]
  colState.value = arr
  saveSettings()
}

// --- CSV export (visible columns, filtered rows) ---
function csv(v) {
  let s = String(v ?? '')
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}` // formula-injection guard: Excel executes cells starting with = + - @
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}
function exportCsv() {
  const cols = visibleCols.value
  const head = cols.map(c => csv(c.title)).join(',')
  const src = props.tree ? fbRows.value : filteredRows.value
  const lines = src.map(r => cols.map(c => csv(display(c.field, r, c.key))).join(','))
  const blob = new Blob([[head, ...lines].join('\r\n')], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${(props.entityLabel || 'export').toLowerCase().replace(/\s+/g, '_')}.csv`
  a.click()
  URL.revokeObjectURL(url)
}
function clearAll() { filters.value = {}; search.value = '' }

// --- narrow: the same rows as CARDS -------------------------------------------------------------
// A twelve-column table on a 366px canvas is a horizontal scroll with three characters of each
// column showing. What a person needs there is not the table compressed — it is the record
// summarised: who it is, what state it is in, and one line of context.
//
// This renders `items` — the SAME array the table renders — so grouping, tree flattening, the
// per-section adders and the collapsed-section logic all arrive already done. There is one row
// pipeline, and this is a second way of drawing its output.
const { phone: cardMode } = useContentWidth()

// The fields a card may draw on: the columns the reader has left visible, in their order, title
// first. A column they hid must not reappear here just because the screen got narrower.
const cardFields = computed(() => visibleCols.value.map(c => c.field).filter(Boolean))
function cardTitle(item) {
  // Tree rows carry the raw value (the table prints it unformatted too); flat rows carry the shaped
  // display string. Same split as the first-column template.
  return (props.tree ? item._raw?.[treeColKey.value] : item[treeColKey.value]) ?? ''
}
function cardStatus(item) { return recordStatus(item._raw, cardFields.value) }
function cardSubtitle(item) { return recordSubtitle(item._raw, cardFields.value, props.refMaps) }
</script>

<template>
  <div class="ui-dt" :class="{ 'ui-dt--narrow': cardMode }">
    <!-- always-visible filter bar (authored $defs/filterBar) — separate chrome from the Options toolbar -->
    <div v-if="filterBar" class="ui-dt-fbar">
      <v-text-field v-if="filterBar.search" v-model="searchQ" placeholder="Search…" prepend-inner-icon="mdi-magnify"
        density="compact" variant="outlined" hide-details clearable single-line class="ui-dt-fbar-search" />
      <UiFacetSelect v-for="f in facetFields" :key="f.key" v-model="facetSel[f.key]" :items="facetItems(f)"
        :label="f.label" :person="isPersonField(f)" class="ui-dt-fbar-facet" />
    </div>

    <!-- toggle: the whole config toolbar is opt-in (nested rows never show it) -->
    <div v-if="toolbar" class="ui-dt-bar">
      <v-spacer />
      <v-btn :color="configOpen ? 'primary' : undefined" variant="text" size="small"
        prepend-icon="mdi-tune-variant" @click="configOpen = !configOpen">Options</v-btn>
    </div>

    <v-expand-transition>
      <div v-if="toolbar && configOpen">
        <div class="ui-dt-toolbar">
          <v-text-field v-model="search" placeholder="Search…" prepend-inner-icon="mdi-magnify"
            density="compact" variant="solo-filled" flat hide-details single-line class="ui-dt-search" clearable />
          <v-spacer />
          <v-btn v-if="!tree" :color="showFilters || activeFilterCount ? 'primary' : undefined" variant="text" size="small"
            prepend-icon="mdi-filter-variant" @click="showFilters = !showFilters">
            Filters<span v-if="activeFilterCount"> · {{ activeFilterCount }}</span>
          </v-btn>
          <v-menu :close-on-content-click="false">
            <template #activator="{ props: menu }">
              <v-btn v-bind="menu" variant="text" size="small" prepend-icon="mdi-view-column-outline">Columns</v-btn>
            </template>
            <v-list density="compact" class="ui-dt-colmenu">
              <v-list-subheader>Show &amp; reorder columns</v-list-subheader>
              <v-list-item v-for="(c, i) in colState" :key="c.key" :title="c.title">
                <template #prepend>
                  <v-checkbox-btn :model-value="c.visible" density="compact" @update:model-value="c.visible = $event; saveSettings()" />
                </template>
                <template #append>
                  <v-btn icon="mdi-chevron-up" size="x-small" variant="text" :disabled="i === 0" @click.stop="moveCol(i, -1)" />
                  <v-btn icon="mdi-chevron-down" size="x-small" variant="text" :disabled="i === colState.length - 1" @click.stop="moveCol(i, 1)" />
                </template>
              </v-list-item>
            </v-list>
          </v-menu>
          <v-btn v-if="groupingOn && !filterActive" variant="text" size="small"
            :prepend-icon="allCollapsed ? 'mdi-unfold-more-horizontal' : 'mdi-unfold-less-horizontal'"
            @click="toggleAllGroups">{{ allCollapsed ? $t('table.expandAll') : $t('table.collapseAll') }}</v-btn>
          <v-btn variant="text" size="small"
            :prepend-icon="density === 'compact' ? 'mdi-arrow-expand-vertical' : 'mdi-arrow-collapse-vertical'"
            @click="density = density === 'compact' ? 'comfortable' : 'compact'; saveSettings()">
            {{ density === 'compact' ? $t('table.comfortable') : $t('table.compact') }}
          </v-btn>
          <v-btn variant="text" size="small" prepend-icon="mdi-download-outline" @click="exportCsv">Export</v-btn>
        </div>
        <v-expand-transition>
          <div v-if="showFilters && !tree" class="ui-dt-filters">
            <template v-for="col in filterableCols" :key="col.key">
              <v-select v-if="isSelectFilter(col)" v-model="filters[col.key]" :items="selectFilterItems(col)"
                :label="col.title" density="compact" variant="outlined" hide-details multiple chips closable-chips
                class="ui-dt-filter" clearable>
                <template #item="{ props: itemProps, item }">
                  <UiOptionItem :item-props="itemProps" :item="item" multiple />
                </template>
              </v-select>
              <v-autocomplete v-else-if="isRefFilter(col)" v-model="filters[col.key]" :items="refFilterItems(col)"
                :label="col.title" density="compact" variant="outlined" hide-details multiple chips closable-chips
                class="ui-dt-filter" clearable>
                <template v-if="isPersonField(col.field)" #item="{ props: itemProps, item, index }">
                  <v-list-item v-bind="itemProps" title="">
                    <PersonChip :person-id="item.value" :size="24" role mark-me />
                  </v-list-item>
                  <v-divider v-if="index === 0 && isMe(item.value)" class="my-1" />
                </template>
                <template v-if="isPersonField(col.field)" #chip="{ props: chipProps, item }">
                  <v-chip v-bind="chipProps"><PersonChip :person-id="item.value" :size="18" /></v-chip>
                </template>
              </v-autocomplete>
              <v-text-field v-else v-model="filters[col.key]" :label="col.title" density="compact" variant="outlined"
                hide-details class="ui-dt-filter" clearable />
            </template>
            <v-btn v-if="activeFilterCount || search" variant="text" size="small" color="primary" @click="clearAll">{{ $t('table.clearAll') }}</v-btn>
          </div>
        </v-expand-transition>
      </div>
    </v-expand-transition>

    <!-- NARROW: the same rows, drawn as cards. See the card helpers in the script for why this is a
         second rendering of `items` rather than a second source of rows. -->
    <div v-if="cardMode" class="ui-dt-cards">
      <template v-for="item in items" :key="item.id">
        <!-- section header: the same collapse target the table row is -->
        <div v-if="item._group" class="ui-dt-card-group" role="button" tabindex="0"
          @click="toggleGroup(item._gid)" @keydown.enter="toggleGroup(item._gid)">
          <v-icon :icon="isCollapsed(item._gid) ? 'mdi-menu-right' : 'mdi-menu-down'" size="18" />
          <span class="ui-dt-group-label">{{ item._label }}</span>
          <span class="ui-dt-group-count">{{ item._count }}</span>
        </div>
        <div v-else-if="item._addGroup" class="ui-dt-card-add">
          <v-icon icon="mdi-plus" size="16" class="ui-dt-add-icon" />
          <v-text-field v-model="addGroupDraft" :placeholder="$t('table.addSection')" variant="plain"
            density="compact" hide-details single-line @keyup.enter="submitAddGroup" />
        </div>
        <div v-else-if="item._adder" class="ui-dt-card-add" :style="{ paddingLeft: (12 + item._depth * 16) + 'px' }">
          <v-icon icon="mdi-plus" size="16" class="ui-dt-add-icon" />
          <v-text-field v-model="draft[draftKey(item)]" :placeholder="addLabel || `Add ${entityLabel}…`"
            variant="plain" density="compact" hide-details single-line @keyup.enter="submitAdd(item)" />
        </div>
        <div v-else class="ui-dt-card" role="button" tabindex="0"
          :style="tree ? { marginLeft: (item._depth * 16) + 'px' } : null"
          @click="onRowClick(item)" @keydown.enter="onRowClick(item)">
          <!-- a tree row keeps its caret: the hierarchy is the point of the view -->
          <v-btn v-if="tree && canNest(item._depth)" variant="text" size="x-small" density="comfortable"
            class="ui-dt-card-caret" :icon="expandedIds.has(item.id) ? 'mdi-menu-down' : 'mdi-menu-right'"
            @click.stop="toggleExpand(item.id)" />
          <UiAvatar v-if="imageField" :src="rowImage(item._raw)" :name="rowImageName(item._raw)"
            :size="34" square class="ui-dt-card-av" />
          <div class="ui-dt-card-main">
            <div class="ui-dt-card-top">
              <v-icon v-if="isDone(item._raw)" icon="mdi-check-circle" size="15" color="success" class="mr-1" />
              <span class="ui-dt-card-title" :class="{ 'ui-dt-done-text': isDone(item._raw) }">{{ cardTitle(item) }}</span>
              <UiChip v-if="cardStatus(item)" :color="cardStatus(item).color" class="ui-dt-card-chip">
                {{ cardStatus(item).label }}
              </UiChip>
            </div>
            <div v-if="cardSubtitle(item)" class="ui-dt-card-sub">{{ cardSubtitle(item) }}</div>
          </div>
          <!-- row actions, out of the way until asked for. Inline cell editing is deliberately NOT
               offered here: a card has no cells, and tapping it opens the record, which is the same
               write path through the same validation. -->
          <v-menu location="bottom end">
            <template #activator="{ props: rowMenu }">
              <v-btn v-bind="rowMenu" icon="mdi-dots-vertical" size="x-small" variant="text"
                class="ui-dt-card-kebab" :aria-label="$t('common.actions')" @click.stop />
            </template>
            <v-list density="compact" min-width="180">
              <v-list-item prepend-icon="mdi-pencil-outline" :title="$t('common.edit')"
                @click="emit('edit', item._raw)" />
              <v-list-item v-if="tree && item._raw[parentField] != null" prepend-icon="mdi-arrow-top-left"
                :title="$t('table.convertToTopLevel')" @click="promote(item)" />
              <v-list-item v-if="canDelete" prepend-icon="mdi-delete-outline" :title="$t('common.delete')"
                @click="emit('delete', item._raw)" />
            </v-list>
          </v-menu>
        </div>
      </template>
      <div v-if="!items.length" class="text-medium-emphasis pa-6 text-center">
        No {{ entityLabel }}{{ activeFilterCount || search || fbActive ? ' match the current filters' : ' yet — add one' }}.
      </div>
    </div>

    <!-- `:mobile="false"` is load-bearing. Vuetify's own narrow mode restacks each row into
         label/value pairs, which mangles every custom template above — a group header comes out as
         "Name: Active 12" and the tree indent is lost. We own the narrow rendering (the cards
         above), so the table is always a table. -->
    <v-data-table v-else :headers="headers" :items="items" :search="search" :loading="loading"
      :mobile="false"
      :density="density" item-value="id" hover class="ui-dt-table" :row-props="rowProps"
      :items-per-page="pageSize" :hide-default-footer="hideFooter"
      @click:row="(_, { item }) => onRowClick(item)">

      <!-- FIRST column: group header / tree indentation + caret / the inline add-a-row / the flat
           title cell. Both modes carry the done affordance: green check + struck text (phase 'done'). -->
      <template #[`item.${treeColKey}`]="{ item }">
        <div v-if="item._group" class="ui-dt-group">
          <v-btn variant="text" size="x-small" density="comfortable" class="ui-dt-group-caret"
            :icon="isCollapsed(item._gid) ? 'mdi-menu-right' : 'mdi-menu-down'"
            :title="$t(isCollapsed(item._gid) ? 'table.expandSection' : 'table.collapseSection')"
            @click.stop="toggleGroup(item._gid)" />
          <v-text-field v-if="renameGroupId === item.id" v-model="renameDraft" variant="plain" density="compact"
            hide-details single-line autofocus class="ui-dt-group-rename"
            @keyup.enter="submitRename(item)" @keyup.esc="renameGroupId = null" @blur="submitRename(item)" @click.stop />
          <template v-else>
            <span class="ui-dt-group-label">{{ item._label }}</span>
            <span class="ui-dt-group-count">{{ item._count }}</span>
            <template v-if="canEditGroups && item._gid != null">
              <v-btn icon="mdi-pencil-outline" size="x-small" variant="text" class="ui-dt-group-act" @click.stop="startRename(item)" />
              <v-btn icon="mdi-delete-outline" size="x-small" variant="text" class="ui-dt-group-act" @click.stop="emit('delete-group', item._gid)" />
            </template>
          </template>
        </div>
        <div v-else-if="item._addGroup" class="ui-dt-add ui-dt-addgroup">
          <v-icon icon="mdi-plus" size="16" class="ui-dt-add-icon" />
          <v-text-field v-model="addGroupDraft" :placeholder="$t('table.addSection')" variant="plain" density="compact"
            hide-details single-line class="ui-dt-add-input" @keyup.enter="submitAddGroup" @click.stop />
        </div>
        <div v-else-if="item._adder" class="ui-dt-add" :style="{ paddingLeft: (item._depth * 24) + 'px' }">
          <v-icon icon="mdi-plus" size="16" class="ui-dt-add-icon" />
          <v-text-field v-model="draft[draftKey(item)]"
            :placeholder="addLabel || `Add ${entityLabel}…`" variant="plain" density="compact" hide-details single-line
            class="ui-dt-add-input" @keyup.enter="submitAdd(item)" @click.stop />
        </div>
        <div v-else-if="tree" class="ui-dt-tree" :style="{ paddingLeft: (item._depth * 24) + 'px' }">
          <span v-if="canDrag(item)" class="ui-dt-handle" draggable="true" :title="$t('table.dragToMove')"
            @dragstart="onDragStart($event, item)" @dragend="onDragEnd" @click.stop>
            <v-icon icon="mdi-drag-vertical" size="16" />
          </span>
          <v-btn v-if="canNest(item._depth)" variant="text" size="x-small" density="comfortable" class="ui-dt-caret"
            :icon="expandedIds.has(item.id) ? 'mdi-menu-down' : 'mdi-menu-right'" @click.stop="toggleExpand(item.id)" />
          <span v-else class="ui-dt-caret-gap" />
          <v-icon v-if="isDone(item._raw)" icon="mdi-check-circle" size="16" color="success" class="ui-dt-done-ic" />
          <span class="ui-dt-tree-text" :class="{ 'ui-dt-done-text': isDone(item._raw) }">{{ item._raw[treeColKey] ?? '' }}</span>
        </div>
        <div v-else class="ui-dt-first">
          <UiAvatar v-if="imageField" :src="rowImage(item._raw)" :name="rowImageName(item._raw)"
            :size="30" square class="ui-dt-row-avatar" />
          <v-icon v-if="isDone(item._raw)" icon="mdi-check-circle" size="16" color="success" class="ui-dt-done-ic" />
          <span :class="{ 'ui-dt-done-text': isDone(item._raw) }">{{ item[treeColKey] }}</span>
        </div>
      </template>

      <template v-for="key in chipKeys" :key="key" #[`item.${key}`]="{ item }">
        <template v-if="!item._adder && !item._group && !item._addGroup">
          <template v-for="col in [colState.find(c => c.key === key)]" :key="col.key">
            <template v-if="col.field.type === 'multiselect' && Array.isArray(item._raw[key])">
              <UiChip v-for="val in item._raw[key]" :key="val" :color="optColor(col.field, val)" class="mr-1">
                {{ optLabel(col.field, val) }}
              </UiChip>
            </template>
            <CellEditor v-else :editable="canEditCell(key, item)" :field="col.field" :record="item._raw"
              :transitions="col.field.governedBy ? cellTransitions(item) : null"
              @save="p => emit('cell-edit', item._raw, p)" @command="c => emit('command', c, item._raw)">
              <UiChip v-if="item._raw[key] != null && item._raw[key] !== ''" :color="optColor(col.field, item._raw[key])">
                {{ optLabel(col.field, item._raw[key]) }}
              </UiChip>
              <span v-else-if="canEditCell(key, item)" class="ce-empty">—</span>
            </CellEditor>
          </template>
        </template>
      </template>

      <template v-for="key in personKeys" :key="'person-' + key" #[`item.${key}`]="{ item }">
        <CellEditor v-if="!item._adder && !item._group && !item._addGroup" :editable="canEditCell(key, item)"
          :field="fieldFor(key)" :record="item._raw" :ref-map="refMaps[key] || null"
          @save="p => emit('cell-edit', item._raw, p)">
          <PersonChip v-if="item._raw[key]" :person-id="item._raw[key]" :size="24" />
          <span v-else-if="canEditCell(key, item)" class="ce-empty">—</span>
        </CellEditor>
      </template>

      <template v-for="key in localRefKeys" :key="'ref-' + key" #[`item.${key}`]="{ item }">
        <template v-if="!item._adder && !item._group && !item._addGroup">
          <RefLink v-if="crossAppTarget(key)" :target="crossAppTarget(key)" :id="item._raw?.[key]"
            :label="display(fieldFor(key), item._raw, key)" :state="refStateFor(key, item)"
            :image="refImages[key]?.[item._raw?.[key]]" />
          <template v-else>{{ display(fieldFor(key), item._raw, key) }}<RefStateBadge :state="refStateFor(key, item)" /></template>
        </template>
      </template>

      <template v-for="key in moneyKeys" :key="'money-' + key" #[`item.${key}`]="{ item }">
        <CellEditor v-if="!item._adder && !item._group && !item._addGroup" :editable="canEditCell(key, item)"
          :field="fieldFor(key)" :record="item._raw"
          @save="p => emit('cell-edit', item._raw, p)">
          {{ display(colState.find(c => c.key === key)?.field, item._raw, key) }}
          <span v-if="aggSuffix(key, item)" class="ui-dt-subtotal">({{ aggSuffix(key, item) }})</span>
        </CellEditor>
      </template>

      <!-- date cells: human format + urgency color (overdue red / due-soon amber / late start red) -->
      <template v-for="key in dateKeys" :key="'date-' + key" #[`item.${key}`]="{ item }">
        <CellEditor v-if="!item._adder && !item._group && !item._addGroup" :editable="canEditCell(key, item)"
          :field="fieldFor(key)" :record="item._raw"
          @save="p => emit('cell-edit', item._raw, p)">
          <span v-if="item._raw[key]" :class="dateClass(key, item)">
            {{ fmtDateCell(fieldFor(key), item._raw[key]) }}
          </span>
          <span v-else-if="canEditCell(key, item)" class="ce-empty">—</span>
        </CellEditor>
      </template>

      <!-- plain text/number cells: only templated while inline editing (else the default cell) -->
      <template v-for="key in plainEditKeys" :key="'plain-' + key" #[`item.${key}`]="{ item }">
        <CellEditor v-if="!item._adder && !item._group && !item._addGroup" :editable="canEditCell(key, item)"
          :field="fieldFor(key)" :record="item._raw"
          @save="p => emit('cell-edit', item._raw, p)">
          <template v-if="item._raw[key] != null && item._raw[key] !== ''">{{ display(fieldFor(key), item._raw, key) }}</template>
          <span v-else-if="canEditCell(key, item)" class="ce-empty">—</span>
          <span v-if="aggSuffix(key, item)" class="ui-dt-subtotal">({{ aggSuffix(key, item) }})</span>
        </CellEditor>
      </template>

      <!-- address cells: a working link (http/https only, via UiLink) instead of unclickable text -->
      <template v-for="key in urlKeys" :key="'url-' + key" #[`item.${key}`]="{ item }">
        <template v-if="!item._adder && !item._group && !item._addGroup">
          <UiLink v-if="fieldHref(fieldFor(key), item._raw[key])"
            :href="fieldHref(fieldFor(key), item._raw[key])" @click.stop />
        </template>
      </template>

      <!-- plain number cells: the field's own scale/unit, so a multiple reads '3.25x' not '3.25' -->
      <template v-for="key in numKeys" :key="'num-' + key" #[`item.${key}`]="{ item }">
        <template v-if="!item._adder && !item._group && !item._addGroup">
          {{ display(fieldFor(key), item._raw, key) }}
        </template>
      </template>

      <!-- flagged numeric cells with no other template (inline editing off): subtree-sum suffix -->
      <template v-for="key in aggPlainKeys" :key="'agg-' + key" #[`item.${key}`]="{ item }">
        <template v-if="!item._adder && !item._group && !item._addGroup">
          {{ display(fieldFor(key), item._raw, key) }}
          <span v-if="aggSuffix(key, item)" class="ui-dt-subtotal">({{ aggSuffix(key, item) }})</span>
        </template>
      </template>

      <template #item._actions="{ item }">
        <template v-if="!item._adder && !item._group && !item._addGroup">
          <v-menu v-if="tree" location="bottom end">
            <template #activator="{ props: menuProps }">
              <v-btn v-bind="menuProps" icon="mdi-swap-vertical" size="x-small" variant="text" title="Move…" @click.stop />
            </template>
            <v-list density="compact" class="ui-dt-move-menu">
              <template v-if="groupingOn && groups">
                <v-list-subheader>{{ $t('table.moveToSection') }}</v-list-subheader>
                <v-list-item v-for="g in groups" :key="g.id" :title="g.label" :disabled="isCurrentSection(item, g.id)"
                  @click="moveToSection(item, g.id)">
                  <template #prepend>
                    <v-icon :icon="isCurrentSection(item, g.id) ? 'mdi-check' : 'mdi-blank'" size="16" />
                  </template>
                </v-list-item>
                <v-divider class="my-1" />
              </template>
              <v-list-item title="Make subtask of…" prepend-icon="mdi-subdirectory-arrow-right" @click="openSubtaskDialog(item)" />
              <v-list-item v-if="item._raw[parentField] != null" :title="$t('table.convertToTopLevel')"
                prepend-icon="mdi-arrow-top-left" @click="promote(item)" />
            </v-list>
          </v-menu>
          <!-- Row commands, before edit: a domain action ("Publish") is the reason somebody came to
               this row, and it should not sit behind opening the record first. A command whose guard
               does not hold is HIDDEN rather than greyed, matching the record header — the button
               offered is always one that would change something. -->
          <v-btn v-for="c in (rowCommands?.resolve(item._raw) || [])" :key="c.key"
            :icon="c.icon ? `mdi-${c.icon}` : 'mdi-play-circle-outline'" size="x-small" variant="text"
            :color="c.style === 'danger' ? 'error' : c.style === 'primary' ? 'primary' : undefined"
            :title="c.label" @click.stop="emit('command', c, item._raw)" />
          <v-btn icon="mdi-pencil-outline" size="x-small" variant="text" @click.stop="emit('edit', item._raw)" />
          <v-btn v-if="canDelete" icon="mdi-delete-outline" size="x-small" variant="text" @click.stop="emit('delete', item._raw)" />
        </template>
      </template>

      <template #no-data>
        <div class="text-medium-emphasis pa-6 text-center">
          No {{ entityLabel }}{{ activeFilterCount || search || fbActive ? ' match the current filters' : ' yet — add one' }}.
        </div>
      </template>
    </v-data-table>

    <div v-if="truncated" class="text-caption text-medium-emphasis pa-2 text-center">
      Showing {{ rows.length.toLocaleString() }} of {{ total.toLocaleString() }} {{ entityLabel }}.
      Filters and totals below apply to what is loaded.
    </div>

    <!-- "Make subtask of…" target picker (move menu) -->
    <v-dialog v-model="subtaskDialog" max-width="420">
      <v-card>
        <v-card-title class="text-subtitle-1">Make subtask of…</v-card-title>
        <v-card-text>
          <v-autocomplete v-model="subtaskTarget" :items="subtaskCandidates" :label="$t('table.parentTask')"
            density="comfortable" variant="outlined" hide-details autofocus />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="subtaskDialog = false">{{ $t('common.cancel') }}</v-btn>
          <v-btn color="primary" :disabled="!subtaskTarget" @click="submitSubtask">{{ $t('table.move') }}</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<style scoped>
.ui-dt { display: flex; flex-direction: column; }
.ui-dt-fbar { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; padding: 8px 10px 4px; }
.ui-dt-fbar-search { flex: 1 1 240px; max-width: 340px; }
.ui-dt-fbar-facet { flex: 0 1 190px; }

/* --- narrow: rows as cards -------------------------------------------------------------------
   Full width, one per line, tap anywhere to open. The kebab is always visible: there is no hover on
   the devices this layout exists for. */
.ui-dt-cards { display: flex; flex-direction: column; gap: 8px; padding: 4px 2px 8px; }
.ui-dt-card {
  display: flex; align-items: flex-start; gap: 10px; padding: 10px 8px 10px 12px; cursor: pointer;
  background: rgb(var(--v-theme-surface)); border: 1px solid rgb(var(--v-theme-outline));
  border-radius: 12px; min-width: 0;
}
.ui-dt-card:active { background: rgba(var(--v-theme-on-surface), .04); }
.ui-dt-card-av { flex: none; }
.ui-dt-card-caret { flex: none; margin: -2px 0 0 -6px; }
.ui-dt-card-main { flex: 1 1 auto; min-width: 0; }
.ui-dt-card-top { display: flex; align-items: center; gap: 6px; min-width: 0; }
/* The title wraps to a second line rather than ellipsing at 20 characters — on a phone the name is
   most of what distinguishes one row from the next. */
.ui-dt-card-title { font-size: 14px; font-weight: 600; line-height: 1.25; min-width: 0;
  overflow-wrap: anywhere; }
.ui-dt-card-chip { flex: none; margin-left: auto; }
.ui-dt-card-sub { margin-top: 2px; font-size: 12.5px; line-height: 1.35;
  color: rgba(var(--v-theme-on-surface), .62); overflow-wrap: anywhere; }
.ui-dt-card-kebab { flex: none; margin: -2px -4px 0 0; }
.ui-dt-card-group {
  display: flex; align-items: center; gap: 6px; padding: 10px 4px 2px; cursor: pointer;
}
.ui-dt-card-add { display: flex; align-items: center; gap: 6px; padding: 2px 8px; }
/* The filter bar's search and facets each claimed a share of a row that is not wide enough to
   share. One control per line reads better than three clipped ones. */
.ui-dt--narrow .ui-dt-fbar-search { flex: 1 1 100%; max-width: none; }
/* Grow from a small basis so two facets share a line, rather than one 190px control per row with
   the other half of the row empty (the same fix PrimFilterBar's facets needed). */
.ui-dt--narrow .ui-dt-fbar-facet { flex: 1 1 140px; }
.ui-dt--narrow .ui-dt-filter { min-width: 0; max-width: none; flex: 1 1 100%; }
.ui-dt--narrow .ui-dt-search { max-width: none; flex: 1 1 100%; }
.ui-dt-done-ic { flex: 0 0 auto; margin-right: 6px; }
.ui-dt-done-text { opacity: .55; text-decoration: line-through; }
.ui-dt-date-over { color: rgb(var(--v-theme-error)); font-weight: 600; }
.ui-dt-date-soon { color: #b45309; font-weight: 600; }
.ui-dt-first { display: flex; align-items: center; min-width: 0; }
.ui-dt-row-avatar { margin-right: 10px; box-shadow: 0 0 0 1px rgba(var(--v-theme-on-surface), .10); }
.ce-empty { color: rgba(var(--v-theme-on-surface), .3); }
.ui-dt-subtotal { color: rgba(var(--v-theme-on-surface), .45); font-size: 12.5px; margin-left: 3px; }
.ui-dt-group { display: flex; align-items: center; gap: 8px; }
.ui-dt-group-caret { margin-left: -8px; margin-right: -4px; color: rgba(var(--v-theme-on-surface), .6); }
.ui-dt-group-label { font-size: 13px; font-weight: 700; color: rgba(var(--v-theme-on-surface), .78); }
.ui-dt-group-count { font-size: 11.5px; font-weight: 600; color: rgba(var(--v-theme-on-surface), .5);
  background: rgba(var(--v-theme-on-surface), .06); border-radius: 10px; padding: 1px 8px; }
.ui-dt-group-act { opacity: 0; transition: opacity .12s; }
.ui-dt-table :deep(tr.ui-dt-group-row:hover) .ui-dt-group-act { opacity: 1; }
.ui-dt-group-rename { max-width: 260px; }
.ui-dt-group-rename :deep(input) { font-size: 13px; font-weight: 700; }
.ui-dt-addgroup { padding: 2px 0; }
.ui-dt-addgroup :deep(input) { font-weight: 600; }
.ui-dt-table :deep(tr.ui-dt-group-row) { background: rgba(var(--v-theme-on-surface), .03); cursor: pointer; }
.ui-dt-table :deep(tr.ui-dt-group-row:hover > td) { background: transparent !important; }
.ui-dt-bar { display: flex; align-items: center; padding: 2px 4px; }
/* Search, a spacer and up to five buttons. It never wrapped, so on anything short of a wide table
   the last of them ran off the edge. */
.ui-dt-toolbar { display: flex; align-items: center; flex-wrap: wrap; gap: 4px; padding: 6px 8px; }
.ui-dt-search { max-width: 280px; }
.ui-dt-colmenu { max-height: 60vh; overflow-y: auto; min-width: 260px; }
.ui-dt-filters { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; padding: 8px 10px 12px; }
.ui-dt-filter { min-width: 180px; max-width: 240px; }
.ui-dt-table :deep(thead th) { font-weight: 600 !important; color: rgba(var(--v-theme-on-surface), .72) !important; white-space: nowrap; }
/* Never let a cell wrap to multiple lines (dates did): the table scrolls horizontally in its own wrapper. */
.ui-dt-table :deep(tbody td) { white-space: nowrap; }
.ui-dt-table :deep(tbody tr) { cursor: pointer; }
.ui-dt-tree { display: flex; align-items: center; min-width: 0; }
/* drag & drop: handle appears on row hover; indicators paint the active drop zone */
.ui-dt-handle { display: inline-flex; align-items: center; opacity: 0; cursor: grab; margin: 0 2px 0 -8px;
  color: rgba(var(--v-theme-on-surface), .45); transition: opacity .12s; }
.ui-dt-table :deep(tbody tr:hover) .ui-dt-handle { opacity: 1; }
/* There is no hover on a touch device, so reveal-on-hover means never. Renaming or reordering a
   group, and dragging a row, were both simply unavailable on a phone or tablet. */
@media (pointer: coarse) {
  .ui-dt-group-act, .ui-dt-handle { opacity: 1; }
}
.ui-dt-table :deep(tr.ui-dt-dragging) { opacity: .35; }
.ui-dt-table :deep(tr.ui-dt-drop-before > td) { box-shadow: inset 0 2px 0 rgb(var(--v-theme-primary)); }
.ui-dt-table :deep(tr.ui-dt-drop-after > td) { box-shadow: inset 0 -2px 0 rgb(var(--v-theme-primary)); }
.ui-dt-table :deep(tr.ui-dt-drop-into > td) { background: rgba(var(--v-theme-primary), .1) !important; }
.ui-dt-table :deep(tr.ui-dt-drop-group > td) { background: rgba(var(--v-theme-primary), .1) !important; }
.ui-dt-caret { margin-left: -6px; }
.ui-dt-caret-gap { display: inline-block; width: 22px; flex: 0 0 22px; }
.ui-dt-tree-text { overflow: hidden; text-overflow: ellipsis; }
.ui-dt-add { display: flex; align-items: center; }
.ui-dt-add-icon { color: rgba(var(--v-theme-on-surface), .4); margin-right: 6px; }
.ui-dt-add-input :deep(input) { font-size: 14px; }
</style>
