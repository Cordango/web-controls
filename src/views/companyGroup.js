// SPDX-License-Identifier: Apache-2.0
// Copyright (c) Cordango and contributors.
// Part of Cordango Web Controls, the shared Vue controls for Cordango applications: https://github.com/cordango/web-controls
// Licensed under the Apache License, Version 2.0. See LICENSE in the repository root.
// Extracted from the Cordango platform at web/src/views/companyGroup.js. Until web/ consumes this
// package, that copy and this one are two files saying the same thing: check both.

// A corporate group is a TREE, and the lookup answers with a flat list.
//
// The list carries the shape already — every candidate names its owner in `parentName` — but reading
// it as three buckets (match / parent / subsidiary) throws that away. Looking up "Porsche" returns
// Volkswagen AG and Porsche Automobil Holding SE both tagged `parent`, and a flat list renders them
// side by side as if they were alternatives. They are not: one owns the company you searched for, and
// the other owns THAT. Which is which decides who you are actually doing business with, so it is the
// one thing the screen has to get right.
//
// So this is the reader. It links each candidate to the entry that owns it, and hands back roots and
// depths — no Vue, no fetching, no rendering, which is what makes the interesting part (whose parent
// is whom, and what happens when the model contradicts itself) testable without a browser.

const LEGAL_FORMS = new Set([
  'gmbh', 'ag', 'se', 'kg', 'ohg', 'ug', 'mbh', 'co', 'kgaa', 'gbr', 'eg', 'ev',
  'ltd', 'limited', 'plc', 'llp', 'inc', 'corp', 'corporation', 'llc', 'lp',
  'sa', 'sas', 'sarl', 'bv', 'nv', 'ab', 'as', 'oy', 'aps', 'spa', 'srl',
])

/**
 * One spelling of a company name, whoever typed it.
 *
 * People write the same company several ways and all of them have to land on one string: `Müller
 * GmbH`, `MÜLLER GmbH` and `mueller gmbh` are one company. So: case folded, accents decomposed,
 * the German transliterations applied by hand (ü→ue, not ü→u — `Muller` is a different name from
 * `Mueller` to a German reader, and `ue` is what people actually type), punctuation dropped.
 *
 * What this does NOT do is repair typos. `mueller gmh` will not reach `muellergmbh`, and it should
 * not: silently equating two nearly-identical strings is how one company's records end up filed
 * under another's. Near-misses are a question to ask a person, not an answer to assume.
 */
export function normalise(s) {
  return (s || '')
    .toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    // Anything else accented decomposes and loses its marks — é→e, å→a. After the German pairs
    // above, so those are not flattened to a bare vowel on the way past.
    .normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

/**
 * The company, INCLUDING its legal form — the key that actually identifies an entity.
 *
 * `DeepL SE`, `DeepL GmbH` and `DeepL Inc.` are three different companies that happen to share a
 * brand, and a group is full of exactly that. This is the key to match on.
 */
export function identityKey(s) {
  return normalise(s).split(' ').filter(Boolean).join('')
}

/**
 * The company WITHOUT its legal form — a looser reading, for when the two sides wrote it
 * differently: "Volkswagen AG", "VOLKSWAGEN AG" and "Volkswagen" are one company. Matches the
 * backend's own NameKey rule (EnrichmentWriter.NameKey).
 *
 * <b>Only ever used as a fallback, and only when it is unambiguous.</b> On its own it says DeepL SE
 * and DeepL GmbH are the same company, which is how a group came out with the wrong parent: whoever
 * the model listed first won the key, everything claiming "DeepL SE" as its owner was filed under
 * that node, and the real DeepL SE was left childless. The same five companies in a different order
 * produced a different tree.
 */
export function looseKey(s) {
  return normalise(s).split(' ').filter(w => w && !LEGAL_FORMS.has(w)).join('')
}

/** Kept as the old name so nothing that imported it breaks; it is the loose reading. */
export const nameKey = looseKey

/**
 * Resolve a name against a set of things, exactly first and loosely second.
 *
 * `keyOf` reads the key off one item. Returns null rather than guessing when the loose reading is
 * ambiguous — the same rule the backend's `LinkGroup` holds when it gives up on `matches.Count != 1`.
 * Refusing to answer is the correct answer: the cost of a wrong link is a company filed under
 * somebody else's parent, and the cost of no link is a flat row.
 */
export function resolveByName(items, name, keyOf = (x) => x?.name) {
  if (!name) return null
  const exact = identityKey(name)
  if (!exact) return null

  const hit = (items || []).find(x => identityKey(keyOf(x)) === exact)
  if (hit) return hit

  const loose = looseKey(name)
  if (!loose) return null
  const near = (items || []).filter(x => looseKey(keyOf(x)) === loose)
  return near.length === 1 ? near[0] : null
}

/** The record in `rows` that is this company. Used to link a new record to organizations that
 *  already exist, so it takes plain rows rather than nodes. */
export function byName(rows, name) {
  return resolveByName(rows, name)
}

/**
 * The item that is this company and unmistakably this one — full name, legal form included, no
 * loose fallback at all.
 *
 * <b>Why this is stricter than resolveByName, deliberately.</b> The loose reading is a repair for a
 * model that wrote the same company two ways within one answer, and there the cost of being wrong is
 * a row in the wrong place. Here it answers "do you already have this?", and the cost of a false yes
 * is that somebody CANNOT ADD A COMPANY THEY DO NOT HAVE — the add button is replaced by a link to
 * the wrong record. A workspace holding one "DeepL SE" made every DeepL in the group resolve to it,
 * because with a single candidate the loose reading is unambiguous and confidently wrong.
 *
 * A missed chip costs a duplicate somebody can merge. A false chip costs a company they cannot add.
 */
export function exactByName(items, name, keyOf = (x) => x?.name) {
  const key = identityKey(name)
  return key ? (items || []).find(x => identityKey(keyOf(x)) === key) || null : null
}

/**
 * The flat candidate list as the ownership tree it describes.
 *
 * Returns `{ roots, rows, matches }`, where `rows` is the tree flattened in reading order with a
 * `depth` on each — the shape a template can `v-for` over without recursive components.
 */
export function buildGroup(candidates) {
  const all = (candidates || []).map((c, i) => ({
    c,
    i,
    key: identityKey(c.legalName),
    parent: null,
    children: [],
    depth: 0,
    match: c.relation === 'match',
  }))

  // Same name AND same legal form is the same company, however it was capitalised. Collapsed rather
  // than shown twice: two identical rows are a model slip, and keeping both would leave the children
  // split across a pair of nodes a person cannot tell apart. The MATCH wins when a duplicate pair
  // disagrees about what it is, since that is the row the whole dialog is answering about.
  const nodes = []
  const byKey = new Map()
  for (const n of all) {
    const seen = n.key ? byKey.get(n.key) : null
    if (!seen) {
      if (n.key) byKey.set(n.key, n)
      nodes.push(n)
    } else if (n.match && !seen.match) {
      seen.match = true
      seen.c = n.c
    }
  }

  const primary = nodes.find(n => n.match) || null

  for (const n of nodes) {
    // Exact first, loose only when it is unambiguous. Resolving against the OTHER nodes (never
    // against itself) so a company cannot become its own parent through a spelling variant.
    let p = resolveByName(nodes.filter(x => x !== n), n.c.parentName, x => x.c.legalName)

    // An entry that names an owner we did not return still belongs INSIDE the group — naming one is
    // the model saying "this is not standalone", and that is true whether it was tagged subsidiary
    // or parent. Left as a root it opens a second group card beside the real one, which is exactly
    // how a lookup for "deepl" came back showing DeepL UK Ltd as a group of its own.
    //
    // Only an entry with NO parent at all stays a root, because that is the one claim that means
    // "nothing owns this".
    if (!p && n.c.parentName && !n.match && primary && n !== primary) p = primary

    if (p && p !== n && !descendsFrom(p, n)) {
      n.parent = p
      p.children.push(n)
    }
  }

  const roots = nodes.filter(n => !n.parent)
  for (const r of roots) order(r, 0)
  // The branch holding what somebody searched for goes first: they typed a name, and the answer to
  // it should not be below two holding companies they have never heard of.
  roots.sort((a, b) => rank(a) - rank(b) || a.i - b.i)

  const rows = []
  for (const r of roots) flatten(r, rows)
  return { roots, rows, matches: nodes.filter(n => n.match) }
}

/** This node and everything under it, parents before children — the order they must be CREATED in,
 *  because a child can only be linked to a parent that already has an id. */
export function withDescendants(node) {
  const out = []
  const walk = (n) => { out.push(n); n.children.forEach(walk) }
  walk(node)
  return out
}

/** Would making `p` the parent of `n` close a loop? The model occasionally reports two companies as
 *  owning each other; the link is dropped rather than followed, because the alternative is a template
 *  that recurses until the tab dies. */
function descendsFrom(p, n) {
  for (let at = p, guard = 0; at && guard < 64; at = at.parent, guard++)
    if (at === n) return true
  return false
}

function order(node, depth) {
  node.depth = depth
  node.children.sort((a, b) => rank(a) - rank(b) || a.i - b.i)
  node.children.forEach(c => order(c, depth + 1))
}

/** 0 when the match is in this subtree. Sorting on it is what puts the chain down to the searched-for
 *  company above its aunts and uncles. */
function rank(node) {
  return hasMatch(node) ? 0 : 1
}

function hasMatch(node) {
  return node.match || node.children.some(hasMatch)
}

function flatten(node, out) {
  out.push(node)
  node.children.forEach(c => flatten(c, out))
}
