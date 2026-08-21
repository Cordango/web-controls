<!--
  SPDX-License-Identifier: Apache-2.0
  Copyright (c) Cordango and contributors.
  Part of Cordango Web Controls, the shared Vue controls for Cordango applications: https:  github.com/cordango/web-controls
  Licensed under the Apache License, Version 2.0. See LICENSE in the repository root.
  Extracted from the Cordango platform at web/src/ui/UiValue.vue. Until web/ consumes
  this package, that copy and this one are two files saying the same thing.
-->

<script setup>
/**
 * A field's value, formatted — and a working link when the field holds an address.
 *
 * `fmtValue` returns a string, so every surface that called it rendered a URL as text you had to
 * select and copy. Fixing that per surface is how it stayed broken in nine of them: tables linked,
 * the peek panel beside them did not, and nothing said which was which. This is the one place that
 * decides, so a surface gets the behaviour by rendering values rather than by remembering to.
 *
 * `UiLink` owns the safety rules (http/https only, `target="_blank"` with `rel="noopener
 * noreferrer"`). A value that fails them renders as plain text — visible, inert, obviously not a link.
 *
 * The click is stopped, because most rows this appears in are click-to-open. Without it, following a
 * link would also open the record behind it, and the reader ends up somewhere they did not ask for.
 */
import { computed } from 'vue'
import UiLink from './UiLink.vue'
import { fmtValue, fieldHref } from '../manifest.js'

const props = defineProps({
  field: { type: Object, default: () => ({}) },
  value: { default: null },
  refMap: { type: Object, default: null },
})

const text = computed(() => fmtValue(props.field ?? {}, props.value, props.refMap))
// Only a DECLARED address — a `url` field, or a `slug` whose prefix says what it is the tail of.
// Sniffing text that merely looks like one would turn a note mentioning a domain into a link, and a
// normalized identity like `hetzner.com/legal` into a guess about which scheme it was fetched over.
const href = computed(() => fieldHref(props.field, props.value))
</script>

<template>
  <UiLink v-if="href" :href="href" @click.stop />
  <template v-else>{{ text }}</template>
</template>
