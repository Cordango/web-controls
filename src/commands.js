// SPDX-License-Identifier: Apache-2.0
// Copyright (c) Cordango and contributors.
// Part of Cordango Web Controls, the shared Vue controls for Cordango applications: https://github.com/cordango/web-controls
// Licensed under the Apache License, Version 2.0. See LICENSE in the repository root.
// Extracted from the Cordango platform at web/src/commands.js (the pure half). Until web/ consumes
// this package, that copy and this one are two files saying the same thing.

// What a command MEANS, with nothing about how one is sent.
//
// The index of an entity's commands by placement, which transitions a record may take from the
// state it is in, and whether a guard currently allows a command. All of it reads the manifest, a
// record and the caller's access map, and all of it is a UX hint: the server decides.
//
// THE TRANSPORT HALF STAYED IN THE HOST. `invokeCommand`, the access-map fetch and the toast bus
// live in the application, because how a request is made and where it goes is the one thing a
// generated standalone application and the hosted platform genuinely do differently. What a
// command means is identical in both, which is why it is here: this is manifest interpretation, the
// same family as manifest.js, and it was only sitting next to axios by accident of file layout.
import { matchFilter, resolveExpr } from './manifest.js'

// A command press in flight, identified by (entity, record, command). Not by command alone: the
// same command is offered on every row of a table, and a per-command flag would spin all of them
// because somebody pressed one.
export function commandKey(entityKey, recordId, key) {
  return `${entityKey}|${recordId}|${key}`
}

// --- command index ---
export function commandsForEntity(manifest, entityKey) {
  return (manifest?.commands || []).filter(c => c.entity === entityKey)
}
export function commandByKey(manifest, entityKey, key) {
  return commandsForEntity(manifest, entityKey).find(c => c.key === key)
}
export function commandsForPlacement(manifest, entityKey, placement) {
  return commandsForEntity(manifest, entityKey)
    .filter(c => (c.placements || ['recordHeader']).includes(placement))
}
// Resolve a hub `actions` entry to { kind:'edit'|'delete' } or { kind:'command', command }.
export function resolveActions(manifest, entityKey, actions) {
  return (actions || ['edit', 'delete']).map(a => {
    if (a === 'edit' || a === 'delete') return { kind: a, key: a }
    const command = commandByKey(manifest, entityKey, a)
    return command ? { kind: 'command', key: a, command } : null
  }).filter(Boolean)
}

// --- guards (client-side hint) ---
// The client's optimistic copy of the server guard — it only decides whether to OFFER a command; the
// engine re-evaluates authoritatively. Values go through the same resolver the renderer uses, so
// {{today+7}} and either spelling of the actor behave here exactly as they do in a filter.
// A `path` leaf (a guard on the referenced record) can't be resolved without loading that record, so
// it stays offered and the server decides — an over-offered command is a clear error message; an
// under-offered one is an invisible feature.
export function evalCondition(cond, record, userId) {
  if (!cond) return true
  if (Array.isArray(cond.all)) return cond.all.every(c => evalCondition(c, record, userId))
  if (Array.isArray(cond.any)) return cond.any.some(c => evalCondition(c, record, userId))
  if (cond.path) return true
  const scopes = { actor: { id: userId } }
  const val = Array.isArray(cond.value)
    ? cond.value.map(x => resolveExpr(x, scopes))
    : resolveExpr(cond.value, scopes)
  return matchFilter(record?.[cond.field], cond.operator, val, record, cond)
}
export function canRunCommand(command, access, entityKey) {
  const cmds = access?.[entityKey]?.commands || []
  return cmds.includes('*') || cmds.includes(command.key)
}

// Is this command reachable from where the record currently IS?
//
// A command bound to a transition can only run from that transition's `from` states — the server
// says so (CommandExecutor refuses with command.wrong_state before running anything), and until this
// existed only ProcessBlock knew it. Every other surface offered every command on the entity at
// once, so a claim sitting with finance showed "Submit for Approval" beside "Mark Paid" and pressing
// it produced an error that read like a bug.
//
// Two different questions, and conflating them is what left this open for so long: `when` asks WHO
// may press this and on which record, `from` asks WHERE IN ITS LIFE the record is. A guard cannot
// answer the second — it does not know the process exists.
//
// Standalone actions are unconstrained: they are not a move, so there is nowhere they cannot happen.
export function transitionAllows(manifest, entityKey, command, record) {
  const process = processForEntity(manifest, entityKey)
  if (!process) return true
  const bound = (process.transitions || []).find(t => t.command === command.key)
  if (!bound) return true
  return (bound.from || []).includes(record?.[process.stateField])
}

export function commandEnabled(command, record, access, entityKey, userId, manifest) {
  return canRunCommand(command, access, entityKey)
    && evalCondition(command.when, record, userId)
    // Optional so a caller that has already filtered by state — availableTransitions — is not made
    // to pass a manifest it would only use to reach the same answer twice.
    && (!manifest || transitionAllows(manifest, entityKey, command, record))
}

// Is this command's work already in progress on this record?
//
// Distinct from `when`, which decides whether to OFFER the command at all and removes the button
// when it fails. A control that vanishes on click is worse than one that does nothing: `busy` keeps
// it in place, disabled, reading what it is doing. And because the condition reads the RECORD, it
// survives a reload — the button stays "Researching…" until the work actually finishes, rather than
// until the request that started it returns.
export function commandBusy(command, record, userId) {
  return !!command?.busy && evalCondition(command.busy.when, record, userId)
}

// --- processes ---
export function processForEntity(manifest, entityKey) {
  return (manifest?.processes || []).find(p => p.entity === entityKey)
}
// Transitions leaving the record's current state, each paired with its (bound) command, filtered to
// what the caller may run. Returns [{ transition, command }].
export function availableTransitions(process, manifest, record, access, userId) {
  const cur = record?.[process.stateField]
  return (process.transitions || [])
    .filter(t => (t.from || []).includes(cur))
    .map(t => ({ transition: t, command: t.command ? commandByKey(manifest, process.entity, t.command) : null }))
    .filter(x => !x.command || commandEnabled(x.command, record, access, process.entity, userId))
}

// The inline status-cell menu: the transitions leaving the record's current state, shaped for a
// picker. Command-bound moves run the command (confirm/input flow via the host); free transitions
// patch the state field directly — the server's ProcessGuard allows exactly that split.
export function statusCellMoves(manifest, entityKey, record, access, userId) {
  const p = processForEntity(manifest, entityKey)
  if (!p) return null
  const states = Object.fromEntries((p.states || []).map(s => [s.key, s]))
  return availableTransitions(p, manifest, record, access, userId).map(({ transition, command }) => ({
    label: transition.label || states[transition.to]?.label || transition.to,
    to: transition.to,
    color: states[transition.to]?.color,
    run: command ? 'command' : 'patch',
    command,
    field: p.stateField,
  }))
}
