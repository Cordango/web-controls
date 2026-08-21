<script setup>
// A person's avatar: their directory photo if one is set, else initials on their stable colour.
//
// A thin wrapper over UiAvatar now — the drawing moved there when a company needed the same circle.
// What stays here is the part that is actually about PEOPLE: resolving an id against the directory,
// and the deactivated-person treatment. Every call site is unchanged.
import { ref, computed, watch, onMounted } from 'vue'
import UiAvatar from './UiAvatar.vue'
import { loadPeople } from '../host.js'
import { personState } from '../refState.js'

const props = defineProps({
  personId: { type: String, default: null },
  person: { type: Object, default: null },   // pre-resolved record, skips the directory lookup
  size: { type: Number, default: 40 },
})

const resolved = ref(props.person)
async function resolve() {
  if (props.person) { resolved.value = props.person; return }
  if (!props.personId) { resolved.value = null; return }
  resolved.value = (await loadPeople()).byId[props.personId] || null
}
watch(() => [props.personId, props.person], resolve)
onMounted(resolve)

// A deactivated person reads as desaturated + red-ringed wherever an avatar is drawn.
const state = computed(() => personState(resolved.value))
</script>

<template>
  <UiAvatar :src="resolved?.avatar_url || null" :name="resolved?.full_name || ''"
    :color="resolved?.avatar_color || '#6d6ff5'" :size="size" :state="state"
    :title="state ? `${resolved.full_name} — ${state.label}` : null" />
</template>
