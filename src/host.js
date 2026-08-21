// SPDX-License-Identifier: Apache-2.0
// Copyright (c) Cordango and contributors.
// Part of Cordango Web Controls, the shared Vue controls for Cordango applications: https://github.com/cordango/web-controls
// Licensed under the Apache License, Version 2.0. See LICENSE in the repository root.

// The five things a control cannot work out for itself.
//
// EVERYTHING ELSE MOVED. What a command means, what a field is, how a date reads, which transitions
// a record may take: all of that is interpretation of a manifest, identical wherever the application
// runs, and it lives in this package. What is left here is the short list of things that genuinely
// differ between the hosted platform and an application somebody generated and deployed themselves:
// where records come from, where a file lives, what a link points at, where a person's table
// preferences are kept, and how a message reaches the screen.
//
// EVERY DEFAULT IS INERT RATHER THAN CLEVER. An unwired `people()` answers an empty directory, so a
// chip renders the raw id instead of throwing; an unwired `route()` answers null, so a link renders
// as text instead of navigating somewhere wrong. A host can therefore adopt one seam at a time and
// see partial behaviour, rather than having to satisfy the whole interface before anything appears.
// The one thing no default can fake is data, and pretending otherwise is how a component ends up
// showing convincing placeholder rows nobody notices are fictional.

const inert = {
  /** Load the platform person directory. @returns {Promise<{items: object[], byId: Record<string, object>}>} */
  people: async () => ({ items: [], byId: {} }),

  /** Absolute URL for a stored file reference. @returns {string} */
  media: (value) => value,

  /** Where a referenced record opens, or null when it cannot be reached. @returns {string|null} */
  route: () => null,

  /** One person's per-table column preferences. @returns {Promise<object|null>} */
  loadTableSettings: async () => null,

  /** Persist them. Fire and forget: a failed preference save must never block a render. */
  saveTableSettings: () => {},

  /** Say something to the person. The host owns whether that is a snackbar, a banner or a log. */
  toast: () => {},
}

let host = { ...inert }

/**
 * Wire the controls to their host. Partial: anything omitted keeps its inert default.
 * @param {Partial<typeof inert>} seams
 */
export function setHost(seams = {}) {
  host = { ...inert, ...Object.fromEntries(Object.entries(seams).filter(([, v]) => typeof v === 'function')) }
}

/** Put every seam back, which is what a test wants between cases. */
export function resetHost() { host = { ...inert } }

export const loadPeople = (...a) => host.people(...a)
export const mediaUrl = (...a) => host.media(...a)
export const refRoute = (...a) => host.route(...a)
export const loadTableSettings = (...a) => host.loadTableSettings(...a)
export const saveTableSettings = (...a) => host.saveTableSettings(...a)
export const toast = (...a) => host.toast(...a)
