// SPDX-License-Identifier: Apache-2.0
// Copyright (c) Cordango and contributors.
// Part of Cordango Web Controls, the shared Vue controls for Cordango applications: https://github.com/cordango/web-controls
// Licensed under the Apache License, Version 2.0. See LICENSE in the repository root.

// Which language the host is showing, as a seam rather than a dependency.
//
// Formatting a date, a number or a relative time needs a locale, and the host is the only thing that
// knows which one. Importing the host's vue-i18n instance would work in the application these
// modules came from and nowhere else, so the controls ask instead of reaching: the plugin sets this
// once, and everything that formats reads through it.
//
// Defaults to English rather than to the browser's locale. A control that silently picked up
// `navigator.language` would render German dates inside an English application whenever the person
// happened to have a German machine, and that bug reads as a data problem rather than a config one.

let read = () => 'en'

/**
 * Tell the controls where to find the current language.
 * @param {() => string} fn returns a BCP 47 tag, e.g. 'en' or 'de'
 */
export function setLocaleSource(fn) {
  read = typeof fn === 'function' ? fn : () => 'en'
}

export const currentLocale = () => read() || 'en'
