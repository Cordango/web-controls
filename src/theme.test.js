// SPDX-License-Identifier: Apache-2.0
// Copyright (c) Cordango and contributors.
// Part of Cordango Web Controls, the shared Vue controls for Cordango applications: https://github.com/cordango/web-controls
// Licensed under the Apache License, Version 2.0. See LICENSE in the repository root.
// Extracted from the Cordango platform at web/src/theme.test.js. Until web/ consumes
// this package, that copy and this one are two files saying the same thing.

import test from 'node:test'
import assert from 'node:assert/strict'
import {
  PLATFORM_THEMES, MODES, BRAND_TOKENS, STRUCTURAL_TOKENS, HEX, isBrandColor,
  FONT_STACK, FONTS, fontStack, RADIUS_PX, RADII,
  mediaUrl, parseHex, contrastRatio, resolveColors, applyBranding, applyBrandVars, branding,
  claimBranding, resetBrandingClaim,
} from './theme.js'

// ---- the colour grammar --------------------------------------------------------------------------
// This matrix is duplicated case-for-case in backend/AppBuilder.Api.Tests/TenantBrandingTests.cs.
// The two gates MUST agree: the server decides what may be stored, this decides what may be
// rendered, and a value the server accepts but the client silently drops is a bug in one of them.

const VALID_COLORS = ['#abc', '#ABC', '#000', '#fff', '#0f766e', '#5EEAD4', '#AaBbCc']
const INVALID_COLORS = [
  'red',                              // named colours are a whole grammar we do not want
  'rgb(1,2,3)', 'rgba(1,2,3,.5)', 'hsl(1,2%,3%)',
  '#abcd', '#aabbccdd',               // 8-digit hex smuggles alpha past a token that has none
  '#ab', '#abcde', '#abcdeff',
  '#gggggg', '#12345g',
  '',
  ' #abc', '#abc ', '#a bc',
  'var(--x)',
  'red; background: url(https://evil.example/x)',   // the actual break-out
  '#fff; } body { background: red } .x {',
  'url(https://evil.example/x.png)',
  'image-set("https://evil.example/x.png")',
  'inherit', 'currentColor', 'transparent',
  '#abc\n', '#abc;',
  null, undefined, 123, {}, [],
]

for (const c of VALID_COLORS)
  test(`isBrandColor accepts ${JSON.stringify(c)}`, () => assert.equal(isBrandColor(c), true))

for (const c of INVALID_COLORS)
  test(`isBrandColor rejects ${JSON.stringify(c)}`, () => assert.equal(isBrandColor(c), false))

test('HEX is anchored at both ends — no prefix or suffix can smuggle anything in', () => {
  assert.equal(HEX.source.startsWith('^'), true)
  assert.equal(HEX.source.endsWith('$'), true)
  assert.equal(HEX.global, false)     // a global regex would carry lastIndex between .test() calls
})

// ---- the platform palette ------------------------------------------------------------------------

test('both modes define every brand token except appbar-text', () => {
  for (const mode of MODES) {
    const colors = PLATFORM_THEMES[mode].colors
    for (const token of BRAND_TOKENS) {
      if (token === 'appbar-text') continue
      assert.ok(token in colors, `${mode} is missing ${token}`)
    }
  }
})

test('appbar-text has NO default in either mode — that absence IS the CSS fallback to on-appbar', () => {
  for (const mode of MODES)
    assert.equal('appbar-text' in PLATFORM_THEMES[mode].colors, false)
})

test('every platform colour passes the same grammar a tenant colour must', () => {
  for (const mode of MODES)
    for (const [token, value] of Object.entries(PLATFORM_THEMES[mode].colors))
      assert.ok(isBrandColor(value), `${mode}.${token} = ${value}`)
})

test('appbar starts identical to surface, so adding the token changes nothing visually', () => {
  for (const mode of MODES)
    assert.equal(PLATFORM_THEMES[mode].colors.appbar, PLATFORM_THEMES[mode].colors.surface)
})

test('the dark theme is marked dark and the light one is not', () => {
  assert.equal(PLATFORM_THEMES.dark.dark, true)
  assert.equal(PLATFORM_THEMES.light.dark, false)
})

// ---- resolveColors -------------------------------------------------------------------------------

test('resolveColors with no overrides is exactly the platform palette', () => {
  for (const mode of MODES) {
    assert.deepEqual(resolveColors(mode, undefined), PLATFORM_THEMES[mode].colors)
    assert.deepEqual(resolveColors(mode, {}), PLATFORM_THEMES[mode].colors)
    assert.deepEqual(resolveColors(mode, null), PLATFORM_THEMES[mode].colors)
  }
})

test('resolveColors applies a valid override', () => {
  assert.equal(resolveColors('light', { primary: '#0f766e' }).primary, '#0f766e')
})

test('resolveColors falls back to the DEFAULT for an invalid value, never renders it', () => {
  for (const bad of ['red', 'rgb(1,2,3)', 'red; background: url(x)', '', null, 42]) {
    const out = resolveColors('light', { primary: bad })
    assert.equal(out.primary, PLATFORM_THEMES.light.colors.primary, `bad value leaked: ${bad}`)
  }
})

test('resolveColors ignores a token nobody may set', () => {
  const out = resolveColors('light', { notAToken: '#abc', 'on-primary': '#abc' })
  assert.equal('notAToken' in out, false)
  assert.equal('on-primary' in out, false)
})

test('resolveColors lets a tenant set appbar-text, which has no default', () => {
  assert.equal('appbar-text' in resolveColors('light', {}), false)
  assert.equal(resolveColors('light', { 'appbar-text': '#123456' })['appbar-text'], '#123456')
})

test('resolveColors never mutates the platform palette', () => {
  const before = JSON.stringify(PLATFORM_THEMES)
  resolveColors('light', { primary: '#0f766e', surface: '#000' })
  assert.equal(JSON.stringify(PLATFORM_THEMES), before)
})

// applyBranding replaces `colors` wholesale, so resolveColors is the ONLY thing standing between
// Vuetify's component CSS and an undefined custom property. An undefined one is not a soft fallback:
// `rgb(var(--v-theme-surface-variant))` is an invalid declaration and the browser drops the rule, so
// the switch track, the switch thumb, the tooltip background and the snackbar simply stop being
// painted. That shipped, and it read as "the toggles look bad" rather than as a missing palette.
test('resolveColors keeps the structural tokens Vuetify components paint themselves from', () => {
  for (const mode of MODES) {
    const out = resolveColors(mode, { primary: '#0f766e' })
    for (const token of STRUCTURAL_TOKENS)
      assert.ok(isBrandColor(out[token]), `${mode}/${token} is not a colour: ${out[token]}`)
  }
})

test('a tenant cannot brand the structural tokens', () => {
  for (const token of STRUCTURAL_TOKENS) {
    assert.equal(BRAND_TOKENS.includes(token), false, `${token} is brandable`)
    assert.equal(resolveColors('light', { [token]: '#abc' })[token],
      PLATFORM_THEMES.light.colors[token])
  }
})

test('resolveColors survives an unknown mode', () => {
  assert.deepEqual(resolveColors('sepia', { primary: '#abc' }), { primary: '#abc' })
})

// ---- fonts ---------------------------------------------------------------------------------------

test('fontStack is a lookup, so an injected string can never reach CSS', () => {
  assert.equal(fontStack('Injected; } body { display: none } .x {'), '')
  assert.equal(fontStack('url(https://evil.example/f.woff2)'), '')
  assert.equal(fontStack(undefined), '')
  assert.equal(fontStack(null), '')
})

test('fontStack returns the shipped stack for an allowed face', () => {
  assert.equal(fontStack('Inter'), FONT_STACK.Inter)
  assert.equal(fontStack('system'), '')
})

test('no font stack contains a character that could terminate a declaration', () => {
  for (const stack of Object.values(FONT_STACK))
    assert.equal(/[;{}<>()]/.test(stack), false, stack)
})

test('every radius is a plain CSS length', () => {
  for (const v of Object.values(RADIUS_PX)) assert.match(v, /^\d+px$/)
  assert.deepEqual(RADII, ['none', 'small', 'medium', 'large'])
  assert.ok(FONTS.includes('system'))
})

// ---- media paths ---------------------------------------------------------------------------------

test('mediaUrl accepts a path we minted and prefixes the API origin', () => {
  assert.equal(mediaUrl('/api/media/abc123ef'), '/api/media/abc123ef')
  assert.equal(mediaUrl('/api/media/abc123ef', 'https://api.example.com'), 'https://api.example.com/api/media/abc123ef')
  assert.equal(mediaUrl('/api/media/' + 'a'.repeat(32)), '/api/media/' + 'a'.repeat(32))
})

test('mediaUrl rejects anything that is not one of our paths', () => {
  for (const bad of [
    'https://evil.example/x.png',
    '//evil.example/x.png',
    'http://evil.example/x.png',
    '/api/media/../../etc/passwd',
    '/api/media/ZZZZZZZZ',              // uppercase is not our hex alphabet
    '/api/media/abc',                    // too short
    '/api/media/' + 'a'.repeat(65),      // too long
    '/api/media/abc123ef?x=1',
    '/api/media/abc123ef/../../x',
    'javascript:alert(1)',
    'data:image/png;base64,AAAA',
    '', null, undefined, 42,
  ]) assert.equal(mediaUrl(bad), null, `leaked: ${bad}`)
})

// ---- contrast ------------------------------------------------------------------------------------

test('parseHex expands the 3-digit form', () => {
  assert.deepEqual(parseHex('#fff'), { r: 255, g: 255, b: 255 })
  assert.deepEqual(parseHex('#abc'), parseHex('#aabbcc'))
  assert.equal(parseHex('red'), null)
})

test('contrastRatio hits the known endpoints', () => {
  assert.equal(Math.round(contrastRatio('#000', '#fff')), 21)
  assert.equal(contrastRatio('#fff', '#fff'), 1)
  assert.equal(contrastRatio('#000', '#fff'), contrastRatio('#fff', '#000'))   // symmetric
  assert.ok(Math.abs(contrastRatio('#777', '#fff') - 4.48) < 0.05)
  assert.equal(contrastRatio('red', '#fff'), null)
})

test('the platform palette itself passes the contrast bar it will warn about', () => {
  for (const mode of MODES) {
    const c = PLATFORM_THEMES[mode].colors
    assert.ok(contrastRatio(c.primary, c.surface) >= 3, `${mode} primary on surface`)
  }
})

// ---- applying ------------------------------------------------------------------------------------
// applyBranding touches a Vuetify theme and <html>. Both are injectable, so the DECISIONS stay
// testable without a DOM harness — the project has none and adding jsdom would be a first.

const fakeTheme = () => ({ themes: { value: { light: { dark: false, colors: {} }, dark: { dark: true, colors: {} } } } })
const fakeRoot = () => {
  const props = {}
  return { props, style: { setProperty: (k, v) => { props[k] = v }, removeProperty: (k) => { delete props[k] } } }
}

test('applyBranding writes a resolved palette into both themes', () => {
  const theme = fakeTheme()
  applyBranding(theme, { colors: { light: { primary: '#0f766e' }, dark: { primary: '#5eead4' } } })
  assert.equal(theme.themes.value.light.colors.primary, '#0f766e')
  assert.equal(theme.themes.value.dark.colors.primary, '#5eead4')
  // untouched tokens still come from the platform
  assert.equal(theme.themes.value.light.colors.surface, PLATFORM_THEMES.light.colors.surface)
})

test('applyBranding replaces the theme OBJECT, which is what makes Vuetify recompute on-* colours', () => {
  const theme = fakeTheme()
  const before = theme.themes.value.light
  applyBranding(theme, { colors: { light: { primary: '#0f766e' } } })
  assert.notEqual(theme.themes.value.light, before)
  assert.equal(theme.themes.value.light.dark, false)   // ...while preserving the mode flag
})

test('applyBranding is idempotent and resets cleanly — never compounds off its own output', () => {
  const theme = fakeTheme()
  applyBranding(theme, { colors: { light: { primary: '#0f766e' } } })
  applyBranding(theme, { colors: { light: { primary: '#b91c1c' } } })
  assert.equal(theme.themes.value.light.colors.primary, '#b91c1c')
  applyBranding(theme, null)
  assert.equal(theme.themes.value.light.colors.primary, PLATFORM_THEMES.light.colors.primary)
})

test('applyBranding survives a missing theme instance', () => {
  applyBranding(null, { colors: { light: { primary: '#0f766e' } } })
  applyBranding(undefined, null)
})

test('applyBranding publishes the non-colour branding for the mark and wordmark', () => {
  applyBranding(fakeTheme(), { wordmark: 'Acme Works', logo: { light: '/api/media/abc123ef' } })
  assert.equal(branding.wordmark, 'Acme Works')
  assert.deepEqual(branding.logo, { light: '/api/media/abc123ef' })
  applyBranding(fakeTheme(), null)
  assert.equal(branding.wordmark, null)
})

// ---- precedence ----------------------------------------------------------------------------------
// The bug this exists for: the anonymous palette (resolved by HOSTNAME) and the signed-in one
// (resolved by TENANT) race, and on an origin with no tenant-domain row the anonymous one is EMPTY.
// Whichever landed last used to win, so a slow anonymous response repainted the platform default
// over the tenant's colours — the top bar flashing the brand colour and then going white.

test('a hostname answer may not overwrite the tenant answer, however late it lands', () => {
  resetBrandingClaim()
  assert.equal(claimBranding('cache'), true)
  assert.equal(claimBranding('session'), true)
  assert.equal(claimBranding('host'), false)   // the late anonymous response — the actual bug
  assert.equal(claimBranding('cache'), false)
})

test('the ordinary order still paints every step', () => {
  resetBrandingClaim()
  assert.equal(claimBranding('cache'), true)
  assert.equal(claimBranding('host'), true)
  assert.equal(claimBranding('session'), true)
})

test('an equal rank always paints, so repeated saves and a second /api/me still land', () => {
  resetBrandingClaim()
  assert.equal(claimBranding('preview'), true)
  assert.equal(claimBranding('preview'), true)
  assert.equal(claimBranding('session'), false)   // nothing outranks what an admin just saved
})

test('an unknown source never paints over a known one', () => {
  resetBrandingClaim()
  assert.equal(claimBranding('cache'), true)
  assert.equal(claimBranding('nonsense'), false)
})

test('applyBrandVars sets font and radius, and removes them when unset', () => {
  const root = fakeRoot()
  applyBrandVars({ typography: { font: 'Inter' }, shape: { radius: 'large' } }, root)
  assert.equal(root.props['--brand-font'], FONT_STACK.Inter)
  assert.equal(root.props['--brand-radius'], '22px')
  applyBrandVars({}, root)
  assert.equal('--brand-font' in root.props, false)
  assert.equal('--brand-radius' in root.props, false)
})

test('applyBrandVars never writes an unrecognised font or radius', () => {
  const root = fakeRoot()
  applyBrandVars({ typography: { font: 'Evil; }' }, shape: { radius: '999px' } }, root)
  assert.equal('--brand-font' in root.props, false)
  assert.equal('--brand-radius' in root.props, false)
})

test('texture is a number, and only an explicit false turns it off', () => {
  const root = fakeRoot()
  applyBrandVars({ chrome: { texture: false } }, root)
  assert.equal(root.props['--brand-texture-opacity'], '0')
  applyBrandVars({ chrome: { texture: true } }, root)
  assert.equal(root.props['--brand-texture-opacity'], '.05')
  applyBrandVars({}, root)
  assert.equal(root.props['--brand-texture-opacity'], '.05')
})
