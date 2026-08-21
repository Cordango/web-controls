<script setup>
// Renders a platform person (a targetApp="platform" reference to `person`) as an avatar + name —
// the canonical way a person appears anywhere in a generated app, instead of a raw id or blank.
// Resolves the id against the cached People directory; pass a pre-resolved `person` to skip the lookup.
// `avatar:false` renders name (+role) only — for a card that already shows a big avatar beside it.
import { ref, computed, watch, onMounted } from 'vue'
import PersonAvatar from './PersonAvatar.vue'
import { loadPeople } from '../host.js'
import { personState } from '../refState.js'
import { isMe, meLabel } from '../me.js'

const props = defineProps({
  personId: { type: String, default: null },
  person: { type: Object, default: null },   // pre-resolved record, skips the directory lookup
  size: { type: Number, default: 26 },
  role: { type: Boolean, default: false },    // show job title under the name
  avatar: { type: Boolean, default: true },   // false = name (+role) only, no circle
  markMe: { type: Boolean, default: false },  // in a PICKER: my own row reads "Me (Name)" (see me.js)
})

const resolved = ref(props.person)
async function resolve() {
  if (props.person) { resolved.value = props.person; return }
  if (!props.personId) { resolved.value = null; return }
  resolved.value = (await loadPeople()).byId[props.personId] || null
}
watch(() => [props.personId, props.person], resolve)
onMounted(resolve)

// Deactivated people stay in the directory now, so they resolve to a NAME and get flagged instead of
// vanishing. The second line takes the state when there is one — that a person is gone matters more
// than their job title.
const state = computed(() => personState(resolved.value))
// Opt-in, and only in a list of OPTIONS: everywhere a person is being reported rather than chosen
// ("Owner: Mara Winter") their name is the fact, and re-narrating it as "Me" helps nobody.
const name = computed(() => {
  const n = resolved.value?.full_name
  return props.markMe && isMe(resolved.value?.id) ? meLabel(n) : n
})
</script>

<template>
  <span v-if="resolved" class="person-chip">
    <PersonAvatar v-if="avatar" :person="resolved" :size="size" />
    <span class="pc-txt">
      <span class="pc-name" :class="{ 'pc-dim': state }">{{ name }}</span>
      <span v-if="state" class="pc-role pc-state">{{ state.label }}</span>
      <span v-else-if="role && resolved.job_title" class="pc-role">{{ resolved.job_title }}</span>
    </span>
  </span>
  <!-- An id the directory can't resolve at all (removed, or another tenant's). Say so — never print the raw id. -->
  <span v-else-if="personId" class="pc-fallback" :title="personId">Unknown</span>
  <span v-else class="pc-empty">—</span>
</template>

<style scoped>
.person-chip { display: inline-flex; align-items: center; gap: 8px; min-width: 0; vertical-align: middle; }
.pc-txt { display: flex; flex-direction: column; min-width: 0; }
.pc-name { line-height: 1.25; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.pc-dim { color: rgba(var(--v-theme-on-surface), .6); }
.pc-role { font-size: 11px; line-height: 1.2; color: rgba(var(--v-theme-on-surface), .55); }
.pc-state { color: rgb(var(--v-theme-error)); font-weight: 600; }
.pc-empty, .pc-fallback { color: rgba(var(--v-theme-on-surface), .5); }
</style>
