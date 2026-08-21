# @cordango/web-controls

Generic Vue 3 and Vuetify controls shared by Cordango Platform and by the standalone applications the
Cordango generator produces.

> Status: pre-alpha. Nothing here is published to npm yet and the surface changes without notice.

## What is in it today

**The model layer.** Manifest reading and field formatting, the command model (which transitions a
record may take, whether a guard allows a command), theming, filter memory, responsive breakpoints,
the date-surface windowing behind timelines and calendars, and the table composables: filtering,
grouping, tree rows, subtree aggregates, semantic dates.

**Thirty-one components.** The presentational primitives (buttons, chips, links, avatars, sheets,
tables, text and select inputs, meters, peeks, timezone and slug fields), the chart, the process
stepper, and the data-bound half: the data table, field renderer, kanban board, reference and person
pickers, facet select, weekly hours and cell editor.

237 tests.

## What belongs here

Low-level building blocks that any business application needs and that carry no product opinion:

data table, form inputs, field renderer, reference picker, person picker, organization picker, board,
calendar, timeline, chart, process stepper, command button, money and date inputs, filter controls,
layout primitives.

## What does not belong here

Anything that only makes sense inside the commercial platform: audit center, AI assistant,
marketplace administration, governance, cross-app explorer, platform administration, platform search.
Those live in the product, not in a generic controls package.

Also deliberately absent: the REST client, the router, and any global store. A control never decides
where data comes from. Everything a control needs from its host arrives through the plugin options
or through props, which is what lets the same component serve a multi-tenant platform and a
single-tenant generated app without knowing which one it is in.

That line moved once during the extraction and it is worth knowing why. `commands.js` looked like
host code because it sat next to `axios`, but thirteen of its nineteen exports only read a manifest
and a record: which transitions are available from the state a record is in, whether a guard allows
a command. What a command MEANS is identical everywhere; only how one is sent differs. So the
meaning is in this package and the sending is not.

## Using it

```js
import { createApp } from 'vue'
import { CordangoControls } from '@cordango/web-controls'
import '@cordango/web-controls/styles'

createApp(App).use(CordangoControls, {
  locale: () => i18n.global.locale.value,   // which language to format in

  // The five things a control cannot work out for itself. Every one is optional and falls back to
  // something inert, so you can wire one at a time and watch behaviour appear.
  people: () => api.get('/platform/person'),      // the person directory
  media: (ref) => `${API}${ref}`,                 // where a stored file lives
  route: (target, id) => `/app/${target.entity}/${id}`,  // where a referenced record opens
  loadTableSettings: (handle, table) => api.get(...),    // one person's column preferences
  saveTableSettings: (handle, table, s) => api.put(...),
  toast: (message, color) => snackbar.show(message, color),
})
```

Vue, Vuetify and vue-i18n are peer dependencies. The host owns those versions.

## Development

```
npm install
npm run build
npm test
```

Tests are plain `node --test` over the pure modules. Components are verified by the applications that
consume them rather than by a headless DOM here.

## License

Apache-2.0. See [LICENSE](LICENSE).
