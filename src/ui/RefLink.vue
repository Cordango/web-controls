<script setup>
// One reference, rendered as a link that behaves like a link.
//
// Every surface that shows a reference used to decide for itself whether it was clickable, and they
// disagreed: RecordFields linked everything, UiDataTable linked only cross-app ones, HubHeader and
// every Prim* leaf linked nothing at all. This is the one place that answers it, so the answer stops
// forking.
//
// **It stays a real `<a href>`.** The peek is a convenience for the common case, not a replacement
// for a link: cmd-click, middle-click, "open in new tab" and "copy link address" all still reach the
// full record, because the href is genuinely there and the browser handles them natively. A div with
// a click handler would take all of that away in exchange for nothing.
import { computed, inject } from 'vue'
import { refRoute } from '../host.js'
import RefStateBadge from './RefStateBadge.vue'
import UiAvatar from './UiAvatar.vue'

const props = defineProps({
  // The resolved `{ handle, entity, manifest, core }` from fetchRefData — never a raw field.
  target: { type: Object, default: null },
  id: { type: [String, Number], default: null },
  label: { type: String, default: '' },
  state: { type: String, default: null },
  // The target record's picture, when its entity declares an imageField. A company reads as itself
  // at a glance instead of as one more blue phrase in a column of blue phrases.
  image: { type: String, default: null },
  imageSize: { type: Number, default: 18 },
})

// Provided by AppRuntime. Absent when these are mounted standalone — the editor preview does exactly
// that — in which case a click is an ordinary navigation and nothing has to know why. Same defaulted
// shape as HubHeader's `runningCommands` inject.
const openRefPeek = inject('openRefPeek', null)

const route = computed(() => refRoute(props.target, props.id))
const text = computed(() => props.label || props.id || '')

// No label for a real id means the target's row was not among the ones we loaded — the list came
// back capped, or the target is unreachable. Showing a bare GUID with no explanation reads as a data
// bug; a tooltip at least tells the truth about why.
const unresolved = computed(() => !props.label && props.id != null && props.id !== '')
const title = computed(() => (unresolved.value ? 'This record’s name could not be loaded.' : null))

function onClick(e) {
  // Let the browser do what the user asked for. Anything but a plain left click is an explicit
  // "somewhere else, please" and the peek would be hijacking it.
  if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0 || e.defaultPrevented) return
  if (!openRefPeek || !props.target || props.id == null) return   // no panel available: navigate
  e.preventDefault()
  openRefPeek(props.target, props.id, e)
}
</script>

<template>
  <!-- `custom` so the rendered node is a genuine anchor we own the click of, rather than
       router-link's own element which swallows the event first. -->
  <router-link v-if="route" :to="route" custom v-slot="{ href }">
    <!-- .stop, or a RefLink inside a clickable row opens the ROW as well as the reference — the row
         handler is what PrimRepeat and UiDataTable already bind. -->
    <a :href="href" class="rl" :class="{ 'rl-unresolved': unresolved }" :title="title"
      @click.stop="onClick"><UiAvatar v-if="image" :src="image" :name="text"
      :size="imageSize" square class="rl-img" />{{ text }}<RefStateBadge :state="state" /></a>
  </router-link>
  <!-- Unreachable target (an app this user cannot open) degrades to the label. Not an error: the
       record exists, they just have nowhere to go. -->
  <span v-else class="rl-plain" :class="{ 'rl-unresolved': unresolved }" :title="title"><UiAvatar
    v-if="image" :src="image" :name="text" :size="imageSize"
    square class="rl-img" />{{ text }}<RefStateBadge :state="state" /></span>
</template>

<style scoped>
.rl { color: rgb(var(--v-theme-primary)); text-decoration: none; }
.rl-img { vertical-align: -4px; margin-right: 5px; }
.rl:hover { text-decoration: underline; }
.rl-plain { color: inherit; }
/* A raw id is not a name. Make it read as a placeholder rather than as content. */
.rl-unresolved { font-family: monospace; font-size: .85em; opacity: .65; }
</style>
