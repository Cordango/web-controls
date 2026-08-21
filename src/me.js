// The signed-in user AS A PERSON.
//
// The platform `person` directory IS the tenant's user list (PlatformDirectory.Person), so a person
// REFERENCE and the ACTING USER carry the same id — which is what makes "who am I" answerable in a
// picker at all. Every dropdown over people therefore puts you at the top of its list, labelled
// "Me (Your Name)": the person you assign, filter or pick most often is yourself, and hunting for
// your own name in an alphabetical list of forty colleagues is the one lookup nobody should have to do.
//
// Pure and injected (the manifest.js pattern): the id is pushed in by whoever learns it — the shell
// from /api/me, the app runtime from the JWT subject — so the ui/ components that read it don't have
// to import the shell. Empty until then, and an unknown id hoists NOTHING: guessing who you are is
// worse than a plain alphabetical list.
import { ref } from 'vue'

const _meId = ref('')
export function setMeId(id) { _meId.value = id || '' }

/** The acting user's person id, or '' in a host that never learned it. */
export const meId = _meId

export function isMe(id) { return !!id && id === _meId.value }

/** How the signed-in person reads as an OPTION. The name stays: "Me" alone would leave you unable to
 *  tell which of two accounts you are signed in as, and the row still has to be findable by name. */
export function meLabel(name) { return name ? `Me (${name})` : 'Me' }

/** `items` ([{ value, title }]) with my own row moved to the FRONT and relabelled. Everything else
 *  keeps the order it came in with, and a list I'm not in comes back untouched — a facet built from
 *  the values actually present must not grow a row that matches no record. */
export function hoistMe(items) {
  const list = items || []
  const i = list.findIndex(x => isMe(x?.value))
  if (i < 0) return list
  return [{ ...list[i], title: meLabel(list[i].title) }, ...list.slice(0, i), ...list.slice(i + 1)]
}
