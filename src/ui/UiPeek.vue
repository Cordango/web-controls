<!--
  SPDX-License-Identifier: Apache-2.0
  Copyright (c) Cordango and contributors.
  Part of Cordango Web Controls, the shared Vue controls for Cordango applications: https:  github.com/cordango/web-controls
  Licensed under the Apache License, Version 2.0. See LICENSE in the repository root.
  Extracted from the Cordango platform at web/src/ui/UiPeek.vue. Until web/ consumes
  this package, that copy and this one are two files saying the same thing.
-->

<script setup>
// A floating "peek" popover — the in-context detail bubble (Outlook/Calendar style): click an entry
// and its detail opens as a small card anchored NEXT TO the click, not a full side sheet. It's the
// lightweight counterpart to UiSheet; the same composed detail renders in either. Generic: any record
// peek, not calendar-specific.
//
// Positioning: anchor to the click point, then clamp to the viewport (flip left/up when it would spill
// off the right/bottom edge) so the card is always fully visible. A transparent scrim catches an
// outside click to dismiss; Esc dismisses too.
import { ref, computed, watch, onBeforeUnmount } from 'vue'

const props = defineProps({
  modelValue: Boolean,
  anchor: { type: Object, default: null },   // { x, y } client coords of the originating click
  title: String,
  width: { type: Number, default: 380 },
})
const emit = defineEmits(['update:modelValue'])

const MARGIN = 12          // keep this far from any viewport edge
const EST_H = 420          // assumed max card height for the flip decision (card scrolls past it)

const pos = computed(() => {
  const a = props.anchor
  if (!a) return { left: '50%', top: '80px', transform: 'translateX(-50%)' }
  const vw = window.innerWidth, vh = window.innerHeight
  const w = Math.min(props.width, vw - MARGIN * 2)
  // Prefer opening to the right of and just below the click; flip when it would overflow.
  let left = a.x + 14
  if (left + w > vw - MARGIN) left = Math.max(MARGIN, a.x - w - 14)
  left = Math.max(MARGIN, Math.min(left, vw - w - MARGIN))
  let top = a.y - 8
  if (top + EST_H > vh - MARGIN) top = Math.max(MARGIN, vh - EST_H - MARGIN)
  top = Math.max(MARGIN, top)
  return { left: left + 'px', top: top + 'px', width: w + 'px' }
})

function close() { emit('update:modelValue', false) }
function onKey(e) { if (e.key === 'Escape') close() }
watch(() => props.modelValue, (open) => {
  if (open) window.addEventListener('keydown', onKey)
  else window.removeEventListener('keydown', onKey)
})
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <teleport to="body">
    <div v-if="modelValue" class="peek-scrim" @click="close">
      <div class="peek-card" :style="pos" @click.stop>
        <div class="peek-hdr">
          <span class="peek-title">{{ title }}</span>
          <span class="peek-actions"><slot name="actions" /></span>
          <v-btn class="peek-x" icon="mdi-close" title="Close" variant="text" size="small" density="comfortable" @click="close" />
        </div>
        <div class="peek-body"><slot /></div>
      </div>
    </div>
  </teleport>
</template>

<style scoped>
/* below Vuetify's v-dialog stack (~2400) so command confirm dialogs sit above the peek */
.peek-scrim { position: fixed; inset: 0; z-index: 2000; background: transparent; }
.peek-card {
  position: fixed; display: flex; flex-direction: column; max-height: min(78vh, 560px);
  background: rgb(var(--v-theme-surface)); color: rgb(var(--v-theme-on-surface));
  border: 1px solid rgba(var(--v-theme-on-surface), .12); border-radius: 12px;
  box-shadow: 0 12px 40px rgba(0, 0, 0, .38); overflow: hidden;
  animation: peek-in .12s ease-out;
}
@keyframes peek-in { from { opacity: 0; transform: translateY(-4px) scale(.98); } to { opacity: 1; transform: none; } }
.peek-hdr { display: flex; align-items: center; gap: 8px; padding: 10px 8px 10px 14px;
  border-bottom: 1px solid rgba(var(--v-theme-on-surface), .08); }
.peek-title { font-size: 14px; font-weight: 700; flex: 1 1 auto; min-width: 0;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.peek-actions { display: flex; align-items: center; gap: 2px; flex: 0 0 auto; }
.peek-x { flex: 0 0 auto; }
.peek-body { padding: 10px 12px; overflow-x: hidden; overflow-y: auto; flex: 1 1 auto; }
</style>
