// Is the record this reference points at still LIVE? — the one definition of that vocabulary.
//
// Two sources, both already explicit in the schema; the renderer never infers state from a type or
// a default:
//   • a platform person is inactive when the tenant user's `status` is not "active" (the control
//     plane writes it: deactivate → "inactive").
//   • a local record is inactive when its role:"status" field's selected option carries
//     phase:"cancelled" — the same options[].phase transport useSemanticDates reads (for a
//     process-governed field the compiler copies each state's phase onto its option).
//
// phase:"done" deliberately produces NO badge. A completed project is a perfectly good thing to
// point at; only "cancelled" means "this is dead, stop pointing at it".

/** @returns {{kind:'inactive', label:string}|null} */
export function personState(person) {
  if (!person) return null
  const s = person.status ?? person.employment_status
  return s && s !== 'active' ? { kind: 'inactive', label: 'Disabled' } : null
}

/** @returns {{kind:'inactive', label:string}|null} */
export function recordState(entityDef, row) {
  if (!entityDef || !row) return null
  const f = (entityDef.fields || []).find(x => x?.role === 'status')
  if (!f) return null
  const o = (f.options || []).find(x => x.value === row[f.key])
  return o?.phase === 'cancelled' ? { kind: 'inactive', label: o.label || 'Cancelled' } : null
}

/** `refState(person)` for a platform person, `refState(entityDef, row)` for a local record. */
export function refState(a, b) {
  return b === undefined ? personState(a) : recordState(a, b)
}
