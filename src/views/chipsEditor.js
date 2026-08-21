// SPDX-License-Identifier: Apache-2.0
// Copyright (c) Cordango and contributors.
// Part of Cordango Web Controls, the shared Vue controls for Cordango applications: https://github.com/cordango/web-controls
// Licensed under the Apache License, Version 2.0. See LICENSE in the repository root.
// Extracted from the Cordango platform at web/src/views/chipsEditor.js. Until web/ consumes this
// package, that copy and this one are two files saying the same thing: check both.

// Turning "who is coming" into child records — the pure half of the `chips` childType.
//
// WHY A CHILD ENTITY AT ALL. There is no multi-reference field type, and a `multiselect` may only
// hold values from a closed option list the server enforces. So "several people on one record" has
// exactly one available shape: a child entity with a reference back. That is also the shape Outlook
// and Google hand back, so an imported attendee and an invited colleague land in the same place
// instead of in two that disagree.
//
// WHY THE ROLES ARE DERIVED, NOT NAMED. The block says `childType: "chips"` and nothing else. Which
// field is the address, which is the person, which is the display name all come from FIELD SHAPE —
// the rule ChildBlock already states for `cards`, so this works for the reviewers on a document or
// the recipients of a notice without anyone extending a list of field names.
//
// No DOM and no data.js in here, which is what lets it be tested under `node --test`.

import { declaredFields } from '../manifest.js'

/** The same rule the record form validates addresses with. One spelling of "is this an email". */
export const EMAIL_RE = /^\S+@\S+\.\S+$/

/**
 * Which field plays which part.
 *
 * `email` is the identity — it is what makes one guest one guest, so a child entity with no required
 * email field cannot be a chips child and returns null rather than half-working.
 */
export function chipShape (entity, viaKey) {
  const fs = declaredFields(entity).filter(f => f.key !== viaKey)
  const email = fs.find(f => f.type === 'email' && f.required) || fs.find(f => f.type === 'email')
  if (!email) return null
  return {
    email: email.key,
    // A colleague draws with their face; an outside guest has no person and must not be given one.
    person: fs.find(f => f.type === 'reference' && f.targetApp === 'platform' && f.targetEntity === 'person')?.key || null,
    name: fs.find(f => f.type === 'text')?.key || null,
  }
}

/** What a chip reads as. The name when there is one, else the address — never a record id. */
export function chipTitle (row, shape) {
  if (!row || !shape) return ''
  return (shape.name && row[shape.name]) || row[shape.email] || ''
}

export const emailOf = (row, shape) => String((shape && row?.[shape.email]) || '').trim().toLowerCase()

/**
 * A combobox selection → a child record's fields, or null if it is not usable.
 *
 * `entry` is either a typed string (an outside guest) or a picked person object. Those are the only
 * two, and `typeof` separates them — which is the whole reason the picker returns objects rather
 * than values: with bare values, "picked person p_123" and "typed the literal text p_123" are the
 * same string and there is no way back.
 */
export function entryFrom (entry, shape) {
  if (!shape || entry == null) return null

  if (typeof entry === 'string') {
    const email = entry.trim()
    return EMAIL_RE.test(email) ? withName({ [shape.email]: email }, shape, '') : null
  }
  const email = String(entry.email ?? '').trim()
  // A colleague with no address on file cannot be invited — `email` is required. Caught here rather
  // than as a 400 after the appointment has already been written.
  if (!EMAIL_RE.test(email)) return null

  const out = { [shape.email]: email }
  if (shape.person && entry.value) out[shape.person] = entry.value
  return withName(out, shape, entry.title || '')
}

function withName (out, shape, name) {
  if (shape.name && name) out[shape.name] = name
  return out
}

/** Is this address already on the list? Case-insensitive, because `Anna@x.test` and `anna@x.test`
 *  are one guest — and the database's composite unique reports the collision with a message that
 *  names neither the field nor the value, so it must never be the thing that catches it. */
export function isDuplicate (rows, email, shape) {
  const want = String(email || '').trim().toLowerCase()
  return !!want && (rows || []).some(r => emailOf(r, shape) === want)
}

/** People who can actually be invited, as picker items. Anyone without an address is left out for
 *  the reason above. `me` is hoisted, because inviting yourself is the commonest pick there is. */
export function peopleItems (people, meIdValue) {
  const items = (people || [])
    .filter(p => EMAIL_RE.test(String(p?.email || '').trim()))
    .map(p => ({ value: p.id, title: p.full_name || p.email, email: String(p.email).trim() }))
  const i = items.findIndex(p => p.value && p.value === meIdValue)
  return i < 0 ? items : [items[i], ...items.slice(0, i), ...items.slice(i + 1)]
}
