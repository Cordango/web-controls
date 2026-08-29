// SPDX-License-Identifier: Apache-2.0
// Copyright (c) Cordango and contributors.
// Part of Cordango Web Controls, the shared Vue controls for Cordango applications: https://github.com/cordango/web-controls
// Licensed under the Apache License, Version 2.0. See LICENSE in the repository root.
// Extracted from the Cordango platform at web/src/theme.js. Until web/ consumes
// this package, that copy and this one are two files saying the same thing.

import { reactive } from 'vue'

// The platform palette and the tenant-branding overlay on top of it.
//
// This is the ONE definition of what the product looks like. It used to live inline in main.js, but
// main.js has side effects and calls `.mount()`, so nothing could import it — which is why the theme
// swatches in SettingsPanel were a hand-copied duplicate. Everything that needs to know a colour
// (main.js, SettingsPanel, the branding admin page, AppRuntime's per-app accent) reads it from here.
//
// The palette deliberately stays in JS rather than moving to the server. The server owns which token
// NAMES are legal and whether a value is a safe colour; it has no business owning the palette that
// paints the first frame, because then nothing could paint before the first HTTP response.

// ---- the platform default ------------------------------------------------------------------------
// PLATFORM_SHELL S0 — one token set, two themes. Custom tokens (outline, surface-2, sidebar, appbar)
// exist so component CSS can use `rgb(var(--v-theme-…))` instead of hardcoded hex — the ONLY
// sanctioned way to colour custom markup.
// Vuetify's OWN structural tokens are listed here too, and they have to be. createVuetify() merges
// this palette over Vuetify's defaults, but applyBranding() then REPLACES `colors` wholesale — that
// is what makes Vuetify regenerate the derived on-* contrast colours — so anything absent here is
// absent from the stylesheet the moment branding is applied, which is every session.
//
// A missing token is not a fallback, it is a broken declaration: `rgb(var(--v-theme-surface-variant))`
// with the variable undefined is invalid CSS, and the browser drops the whole rule. That is why the
// switches went invisible — an inset switch is `surface-variant` track plus `surface-bright` thumb,
// and both had ceased to exist. Tooltips, snackbars, sliders and chips are painted from the same
// four. They are deliberately NOT in BRAND_TOKENS: they are how the components are built, not how a
// workspace looks.
const STRUCTURE = {
  light: {
    'surface-bright': '#ffffff',        // raised on surface: the switch thumb, picker heads
    'surface-light': '#eef1f6',         // muted fill, same value as our surface-2
    'surface-variant': '#475569',       // slate — inverted chrome: tooltip, snackbar, switch track
    'on-surface-variant': '#ffffff',
  },
  dark: {
    'surface-bright': '#cbd5e1',        // still the LIGHT side of the pair: a dark thumb on a dark
    'surface-light': '#343643',         // track would be a switch you cannot read
    'surface-variant': '#94a3b8',
    'on-surface-variant': '#16171d',
  },
}

export const PLATFORM_THEMES = {
  light: {
    dark: false,
    colors: {
      primary: '#4f46e5',       // indigo
      secondary: '#1e293b',     // slate
      background: '#f6f7fb',
      surface: '#ffffff',
      'surface-2': '#eef1f6',   // subtle fills (kanban columns, bar tracks, muted cells)
      outline: '#e2e8f0',       // hairline borders
      sidebar: '#fbfbfd',       // shell sidebar
      appbar: '#ffffff',        // top bar — same as `surface` today, so nothing moves by default
      error: '#ef4444',
      success: '#22c55e',
      warning: '#f59e0b',
      info: '#3b82f6',
      ...STRUCTURE.light,
    },
  },
  dark: {
    dark: true,
    colors: {
      primary: '#818cf8',       // indigo, lifted for contrast on dark
      secondary: '#cbd5e1',
      background: '#16171d',
      surface: '#1f2029',
      'surface-2': '#262834',
      outline: '#2e303a',
      sidebar: '#1a1b22',
      appbar: '#1f2029',
      error: '#f87171',
      success: '#4ade80',
      warning: '#fbbf24',
      info: '#60a5fa',
      ...STRUCTURE.dark,
    },
  },
}

/** The tokens Vuetify's own component CSS reads and no tenant may set. Exported for the test that
 *  keeps them present through branding — the failure they cause is silent and looks like a component
 *  bug, so it is worth pinning by name rather than by "the palette did not shrink". */
export const STRUCTURAL_TOKENS = Object.keys(STRUCTURE.light)

/**
 * Every Vuetify theme token THIS PACKAGE's own component CSS reads — the contract a host theme has
 * to satisfy before a control from here will render.
 *
 * Vuetify emits `--v-theme-X` only for a key that is PRESENT in the theme's `colors`. A declaration
 * naming a variable that was never defined is invalid CSS, so the browser drops the whole
 * declaration and reports nothing: the symptom is a meter with no track, a kanban column with no
 * background, a data table with no border. It reads as a broken component rather than as a missing
 * palette entry, which is why this is a list somebody can check rather than a thing to notice.
 *
 * `surface-2` and `outline` are the two that are NOT in Vuetify's default palette. Every other
 * entry here comes free with any theme; those two a host has to add on purpose.
 */
export const HOST_THEME_TOKENS = [
  'error',
  'on-surface',
  'outline',
  'primary',
  'surface',
  'surface-2',
  'warning',
]

export const MODES = ['light', 'dark']

// Every token a tenant may override. `appbar-text` is in the list but has NO platform default, on
// purpose: while it is unset the variable is undefined and CSS falls through to Vuetify's
// contrast-derived `on-appbar`. That fallback is only possible because "unset" means the key is
// ABSENT rather than null — see the blob contract in TenantBrandingSettings.cs.
export const BRAND_TOKENS = [
  'primary', 'secondary', 'background', 'surface', 'surface-2', 'outline',
  'sidebar', 'appbar', 'appbar-text', 'error', 'success', 'warning', 'info',
]

// ---- the colour grammar --------------------------------------------------------------------------
// 3- or 6-digit hex, and NOTHING else. Not rgb(), not hsl(), not a named colour, not 8-digit hex.
//
// This is not fussiness. These strings are written into `theme.themes.value[mode].colors`, and
// Vuetify renders them into a real <style> element as `--v-theme-primary: <value>`. A CSS custom
// property value is NOT escaped by the browser, so `red; } body { background: url(https://evil/x) } .x {`
// breaks out of the rule it was meant to fill. Even without breaking out, a looser grammar admits
// `url()` and `image-set()` — an unauthenticated request to a third party, which on the LOGIN page
// happens before the visitor has consented to anything.
//
// A bare hex triple has no delimiters, no functions, no whitespace, no parentheses and no
// semicolons: it is closed under "cannot express anything but a colour". Alpha is excluded because
// Vuetify decomposes each token into an R,G,B triple for `rgb(var(--v-theme-x))` — an alpha channel
// would be honoured in a few places and silently dropped in the other 350.
//
// The server's TenantBrandingSettings.Validate holds the identical grammar. Both gates exist because
// a blob can predate the validator or arrive from a path that skipped it.
export const HEX = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/

export const isBrandColor = (v) => typeof v === 'string' && HEX.test(v)

// ---- font + shape --------------------------------------------------------------------------------
// The tenant's font choice is a KEY into this map, never a string concatenated into CSS. That makes
// the injection surface zero by construction rather than by escaping — and the allowlist is also,
// necessarily, the list of faces we actually ship, since a Google-hosted webfont on the login page
// would be a third-party request before consent.
export const FONT_STACK = {
  system: '',
  Inter: '"Inter", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
  'Space Grotesk': '"Space Grotesk", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
}
export const FONTS = Object.keys(FONT_STACK)

/** The CSS font-family for a tenant's choice — '' for the system stack or anything unrecognised. */
export function fontStack(name) {
  return FONT_STACK[name] ?? ''
}

// Same vocabulary AppRuntime.vue uses for a per-app radius, shared rather than forked.
export const RADIUS_PX = { none: '0px', small: '8px', medium: '14px', large: '22px' }
export const RADII = Object.keys(RADIUS_PX)

// ---- media paths ---------------------------------------------------------------------------------
// A logo is only ever a path WE minted. Accepting an arbitrary URL would let a tenant admin point
// every visitor's login page at a third-party host — an unauthenticated tracking pixel on an
// unauthenticated page, plus a mixed-content problem on any http origin.
const MEDIA_PATH = /^\/api\/media\/[0-9a-f]{8,64}$/

/** Absolute URL for a stored media path, or null if it is not one of ours. */
export function mediaUrl(path, apiBase = '') {
  return typeof path === 'string' && MEDIA_PATH.test(path) ? `${apiBase}${path}` : null
}

// ---- contrast ------------------------------------------------------------------------------------
// Used by the admin page to WARN, never to block. "Our brand is this colour" is a legitimate
// override, and refusing it turns a branding page into an argument.
function channel(c) {
  const v = c / 255
  return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
}

export function parseHex(hex) {
  if (!isBrandColor(hex)) return null
  let h = hex.slice(1)
  if (h.length === 3) h = h.split('').map(c => c + c).join('')
  const n = parseInt(h, 16)
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 }
}

export function relativeLuminance(hex) {
  const c = parseHex(hex)
  if (!c) return null
  return 0.2126 * channel(c.r) + 0.7152 * channel(c.g) + 0.0722 * channel(c.b)
}

/** WCAG contrast ratio, 1–21. Null if either colour is not a hex triple. */
export function contrastRatio(a, b) {
  const la = relativeLuminance(a)
  const lb = relativeLuminance(b)
  if (la == null || lb == null) return null
  const [hi, lo] = la > lb ? [la, lb] : [lb, la]
  return (hi + 0.05) / (lo + 0.05)
}

// ---- resolution ----------------------------------------------------------------------------------

/** The colours a mode should actually render with: the platform defaults, overridden by whatever the
 *  tenant set that is BOTH a known token AND a valid colour. An override that fails either test is
 *  dropped in favour of the default — never rendered, never half-applied. This is the tested unit. */
export function resolveColors(mode, overrides) {
  const colors = { ...(PLATFORM_THEMES[mode]?.colors ?? {}) }
  for (const [token, value] of Object.entries(overrides ?? {}))
    if (BRAND_TOKENS.includes(token) && isBrandColor(value)) colors[token] = value
  return colors
}

// The live branding, for the components that RENDER it (the mark, the wordmark). Reactive, because
// the colours repaint through Vuetify's own reactive theme but the wordmark is ordinary template
// text — a plain object here means the palette changes and the name does not.
//
// Deliberately not on `shell`: LoginPage renders before bootShell() has run and must not depend on
// the signed-in shell at all.
export const branding = reactive({
  wordmark: null, logo: null, favicon: null, typography: null, shape: null, chrome: null,
})

// ---- who gets to paint ---------------------------------------------------------------------------
// The palette reaches the client from more than one place, and they do NOT arrive in a fixed order:
// the localStorage cache paints synchronously at boot, the anonymous /api/branding answers by
// HOSTNAME, and /api/me answers by the signed-in TENANT. The last two race — bootShell makes three
// calls before the shell applies its palette, and the anonymous fetch has a 1.5s budget it can spend
// — so whichever lands last wins.
//
// That is fine while both answer the same thing, and it is a visible bug the moment they do not: on
// an origin that is not a registered tenant domain (plain `localhost` in dev, before anybody adds a
// row to tenant_domains) the anonymous answer is EMPTY, so a late one repaints the platform default
// over the colours /api/me already delivered. The top bar flashes the brand colour and then goes
// white, and it looks like the branding broke rather than like two writers disagreeing.
//
// So arrival order decides nothing and PRECEDENCE decides everything: a hostname answer may never
// overwrite a tenant answer, and nothing may overwrite an admin's live preview. Equal ranks always
// apply, so the branding page still repaints on every save and a second /api/me still lands.
const RANK = { cache: 1, host: 2, session: 3, preview: 4 }
let painted = 0

/** True if `source` may paint now, false if something more authoritative already did — and claiming
 *  is what records the rank, so a caller that asks must then apply.
 *
 *  Kept OUT of applyBranding: that function is deliberately pure and idempotent ("safe to call
 *  repeatedly"), and burying a one-way ratchet inside it would quietly break that promise for the
 *  admin page. One named decision, tested on its own. */
export function claimBranding(source) {
  const rank = RANK[source] ?? 0
  if (rank < painted) return false
  painted = rank
  return true
}

/** Forget who painted. A page load is the real reset; this exists so tests are not order-dependent. */
export function resetBrandingClaim() { painted = 0 }

/** Point Vuetify's two themes at the tenant's palette and set the non-Vuetify custom properties.
 *  Safe to call repeatedly — it always resolves from PLATFORM_THEMES, never from the last result.
 *
 *  `theme` is a Vuetify theme instance: `vuetify.theme` before mount, or `useTheme()` inside a
 *  component. Both expose the same writable `themes` ref, so there is one code path. */
export function applyBranding(theme, b, apiBase = '') {
  const themes = theme?.themes?.value
  if (themes) {
    for (const mode of MODES) {
      // Assign a whole new theme object rather than poking individual colours: that is what makes
      // Vuetify recompute its stylesheet, which regenerates every --v-theme-* INCLUDING the derived
      // on-* contrast colours. Hand-writing --v-theme-primary would leave on-primary stale.
      themes[mode] = { ...themes[mode], colors: resolveColors(mode, b?.colors?.[mode]) }
    }
  }
  Object.assign(branding, {
    wordmark: b?.wordmark ?? null,
    logo: b?.logo ?? null,
    favicon: b?.favicon ?? null,
    typography: b?.typography ?? null,
    shape: b?.shape ?? null,
    chrome: b?.chrome ?? null,
  })
  applyBrandVars(b)
  applyBrandDocument(b, apiBase)
}

/** Tab title and favicon. Both are documents-level, so they are set from JS rather than markup —
 *  index.html is static and cannot know whose workspace this is. */
export function applyBrandDocument(b, apiBase = '', doc = globalThis.document) {
  if (!doc) return
  if (b?.wordmark) doc.title = b.wordmark
  const href = mediaUrl(b?.favicon ?? b?.logo?.light, apiBase)
  if (!href) return
  let link = doc.querySelector('link[rel="icon"]')
  if (!link) {
    link = doc.createElement('link')
    link.rel = 'icon'
    doc.head.appendChild(link)
  }
  // index.html declares type="image/svg+xml" for the default mark. A browser REFUSES a PNG under
  // that type, so the type has to be cleared rather than merely having the href replaced.
  link.type = ''
  link.href = href
}

// ---- the local cache -----------------------------------------------------------------------------
// A repeat visitor should never see the platform indigo flash past on the way to their own colours.
// The cache is keyed by ORIGIN: branding is resolved by hostname, so a cache entry written on one
// origin says nothing about another, and using it there would paint the wrong company's colours.
const CACHE_KEY = 'ab-branding'

export function readCachedBranding(origin = globalThis.location?.origin) {
  try {
    const raw = globalThis.localStorage?.getItem(CACHE_KEY)
    if (!raw) return null
    const cached = JSON.parse(raw)
    return cached?.origin === origin ? cached.data : null
  } catch { return null }
}

export function cacheBranding(data, origin = globalThis.location?.origin) {
  try { globalThis.localStorage?.setItem(CACHE_KEY, JSON.stringify({ origin, data })) } catch { /* private mode */ }
}

/** Fetch the anonymous branding, bounded. NEVER throws and never hangs the boot: a cold or missing
 *  API resolves to null after the timeout and the app mounts on the platform default. */
export async function fetchBranding(apiBase = '', timeoutMs = 1500) {
  try {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), timeoutMs)
    const res = await fetch(`${apiBase}/api/branding`, { signal: ctrl.signal, credentials: 'omit' })
    clearTimeout(timer)
    return res.ok ? await res.json() : null
  } catch { return null }
}

/** The bits Vuetify's palette cannot carry: the font, the corner radius, and how strongly the app
 *  bar's blueprint texture shows. Custom properties on <html> so plain CSS can read them. */
export function applyBrandVars(b, root = globalThis.document?.documentElement) {
  if (!root) return
  const s = root.style
  const font = fontStack(b?.typography?.font)
  font ? s.setProperty('--brand-font', font) : s.removeProperty('--brand-font')
  const radius = RADIUS_PX[b?.shape?.radius]
  radius ? s.setProperty('--brand-radius', radius) : s.removeProperty('--brand-radius')
  // A number rather than a boolean, so "subtle vs strong" is a later one-line change.
  s.setProperty('--brand-texture-opacity', b?.chrome?.texture === false ? '0' : '.05')
}
