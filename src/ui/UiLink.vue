<!--
  SPDX-License-Identifier: Apache-2.0
  Copyright (c) Cordango and contributors.
  Part of Cordango Web Controls, the shared Vue controls for Cordango applications: https:  github.com/cordango/web-controls
  Licensed under the Apache License, Version 2.0. See LICENSE in the repository root.
  Extracted from the Cordango platform at web/src/ui/UiLink.vue. Until web/ consumes
  this package, that copy and this one are two files saying the same thing.
-->

<script setup>
/**
 * An external link, with the safety rules in ONE place.
 *
 * Until now `url` fields rendered as plain text everywhere (`fmtValue` returns them verbatim and no
 * renderer wrapped them), so a stored address was something you selected and copied. Research fills
 * records with sources whose entire value is being one click away, so this exists.
 *
 * Two rules it enforces so no caller has to remember them:
 *  - `http`/`https` only. A stored `javascript:` value is attacker-controlled script the moment
 *    someone clicks it, and enrichment writes URLs that came off the public web.
 *  - `rel="noopener noreferrer"` with `target="_blank"`, so the opened page cannot reach back
 *    through `window.opener`.
 *
 * A value that fails the scheme check renders as text — visible, inert, and obviously not a link.
 */
import { computed } from 'vue'

const props = defineProps({
  href: { type: [String, null], default: null },
  /** Shown instead of the raw URL. Defaults to the URL itself. */
  label: { type: [String, null], default: null },
})

const safe = computed(() => {
  const raw = (props.href ?? '').trim()
  if (!raw) return null
  try {
    // Resolved against the document base so a relative value is judged as it would actually resolve.
    const u = new URL(raw, window.location.origin)
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.href : null
  } catch {
    return null
  }
})

const text = computed(() => props.label || props.href || '—')
</script>

<template>
  <a v-if="safe" class="ui-link" :href="safe" target="_blank" rel="noopener noreferrer">{{ text }}</a>
  <span v-else class="ui-link-plain">{{ text }}</span>
</template>

<style scoped>
.ui-link {
  color: rgb(var(--v-theme-primary));
  text-decoration: none;
  word-break: break-word;
}
.ui-link:hover { text-decoration: underline; }
.ui-link-plain { word-break: break-word; }
</style>
