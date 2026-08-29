// SPDX-License-Identifier: Apache-2.0
// Copyright (c) Cordango and contributors.
// Part of Cordango Web Controls, the shared Vue controls for Cordango applications: https://github.com/cordango/web-controls
// Licensed under the Apache License, Version 2.0. See LICENSE in the repository root.

// The package surface, and the one place a host tells the controls about itself.
//
// EVERYTHING A CONTROL NEEDS FROM ITS HOST ARRIVES THROUGH HERE. That is what lets the same
// component serve the multi-tenant platform and a single-tenant generated application without
// knowing which one it is in: it never imports a store, a router or an HTTP client, so there is
// nothing for it to be wrong about. A control that reached for `axios` would work in exactly one
// application, which is the state these modules were in before they were extracted.

import { setHost } from './host.js'
import { setLocaleSource } from './locale.js'
import { setPeopleDirectory } from './manifest.js'

export * from './manifest.js'
export * from './filterMemory.js'
export * from './formatting.js'
export * from './locale.js'
export * from './messages.js'
export * from './responsive.js'
export * from './theme.js'
export * from './host.js'

// `mediaUrl` is exported by BOTH theme.js (a brand asset from an explicit API base) and host.js
// (the attachment seam). Two `export *` sources offering one name is AMBIGUOUS, and ES modules
// resolve that by dropping it silently: the package surface was missing `mediaUrl` entirely and
// nothing said so. Named explicitly, which shadows the star exports. The seam keeps the plain name
// because that is what the components call; the theme one gets the name it should always have had.
export { mediaUrl } from './host.js'
export { mediaUrl as brandAssetUrl } from './theme.js'
export * from './me.js'
export * from './refState.js'
export * from './commands.js'

export * from './views/timeRange.js'
export * from './views/dayGrid.js'
export * from './views/weeklyHours.js'
export * from './views/chipsEditor.js'
export * from './views/companyGroup.js'
export * from './views/inlineCreate.js'

export * from './tables/useSemanticDates.js'
export * from './tables/useSubtreeAggregates.js'
export * from './tables/useTableFiltering.js'
export * from './tables/useTableGrouping.js'
export * from './tables/useTreeRows.js'

/**
 * Install the controls and hand them the seams.
 *
 * Every option is optional and has a boring default, so a host can adopt one seam at a time rather
 * than having to satisfy the whole interface before anything renders.
 *
 * @param {object} app the Vue application
 * @param {object} [options]
 * @param {() => string} [options.locale] the current BCP 47 tag, e.g. () => i18n.global.locale.value
 * @param {Record<string, object>} [options.peopleDirectory] person id → { name, avatar, ... }
 */
export const CordangoControls = {
  install(app, options = {}) {
    if (options.locale) setLocaleSource(options.locale)
    if (options.peopleDirectory) setPeopleDirectory(options.peopleDirectory)

    // The five things a control cannot work out for itself. Partial by design: anything omitted
    // keeps an inert default, so a host can adopt one seam at a time and watch behaviour appear
    // rather than having to satisfy the whole interface before the first component renders.
    setHost({
      people: options.people,
      media: options.media,
      route: options.route,
      loadTableSettings: options.loadTableSettings,
      saveTableSettings: options.saveTableSettings,
      toast: options.toast,
    })

    app.provide('cordango.controls', Object.freeze({ ...options }))
  },
}

// ---- components -------------------------------------------------------------------------------
//
// Exported under the package's own names. The files keep the names they had in the platform so that
// their imports of each other did not all have to change on the way out; a consumer never sees
// either name, only these.

export { default as CordangoChart } from './ui/ChartCard.vue'
export { default as CordangoAvatar } from './ui/UiAvatar.vue'
export { default as CordangoButton } from './ui/UiButton.vue'
export { default as CordangoChip } from './ui/UiChip.vue'
export { default as CordangoLink } from './ui/UiLink.vue'
export { default as CordangoMeter } from './ui/UiMeter.vue'
export { default as CordangoOptionItem } from './ui/UiOptionItem.vue'
export { default as CordangoPeek } from './ui/UiPeek.vue'
export { default as CordangoSelect } from './ui/UiSelect.vue'
export { default as CordangoSheet } from './ui/UiSheet.vue'
export { default as CordangoSlugField } from './ui/UiSlugField.vue'
export { default as CordangoSurface } from './ui/UiSurface.vue'
export { default as CordangoSwitch } from './ui/UiSwitch.vue'
export { default as CordangoTable } from './ui/UiTable.vue'
export { default as CordangoTextarea } from './ui/UiTextarea.vue'
export { default as CordangoTextField } from './ui/UiTextField.vue'
export { default as CordangoTimezone } from './ui/UiTimezone.vue'
export { default as CordangoValue } from './ui/UiValue.vue'
export { default as CordangoRefStateAlert } from './ui/RefStateAlert.vue'
export { default as CordangoRefStateBadge } from './ui/RefStateBadge.vue'
export { default as CordangoProcess } from './views/ProcessBlock.vue'

// The data-bound half. These are the components that needed a seam cut before they could travel,
// which is why they arrived after the primitives rather than with them.
export { default as CordangoDataTable } from './ui/UiDataTable.vue'
export { default as CordangoFieldInput } from './views/FieldInput.vue'
export { default as CordangoKanban } from './views/KanbanCore.vue'
export { default as CordangoRefPicker } from './ui/UiRefPicker.vue'
export { default as CordangoPersonChip } from './ui/PersonChip.vue'
export { default as CordangoPersonAvatar } from './ui/PersonAvatar.vue'
export { default as CordangoRefLink } from './ui/RefLink.vue'
export { default as CordangoFacetSelect } from './ui/UiFacetSelect.vue'
export { default as CordangoWeeklyHours } from './views/WeeklyHours.vue'
export { default as CordangoCellEditor } from './tables/CellEditor.vue'

export * from './ui/optionAccent.js'
export * from './views/timezones.js'
