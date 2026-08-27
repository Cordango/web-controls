# @cordango/web-controls

[![npm](https://img.shields.io/badge/npm-%40cordango%2Fweb--controls-cb3837?logo=npm)](https://www.npmjs.com/package/@cordango/web-controls)
[![Docs](https://img.shields.io/badge/docs-docs.cordango.com-0f766e)](https://docs.cordango.com)
[![License](https://img.shields.io/badge/license-Apache--2.0-blue)](LICENSE)

**Generic Vue 3 and Vuetify controls shared by Cordango Platform and by the standalone applications
the Cordango generator produces.** One data table, one field renderer, one kanban board, used by a
multi-tenant hosted product and by a single-tenant application you own, with neither of them knowing
which one it is in.

> **Status: alpha, and actively being worked on.** This package is extracted from a running product
> a piece at a time. The export surface, the component names and the plugin options all still move
> without notice, and a version bump can break you. Nothing is published to npm yet, so
> [the package page](https://www.npmjs.com/package/@cordango/web-controls) is empty until the first
> release lands. Read it, borrow from it, but don't build on it expecting it to hold still.

Part of [Cordango](https://github.com/cordango/cordango), the open foundation of the Cordango
application platform.

## Table of Contents

- [What is in it today](#what-is-in-it-today)
- [What belongs here](#what-belongs-here)
- [Installing](#installing)
- [Using it](#using-it)
- [The seams](#the-seams)
- [Development](#development)
- [Contributing](#contributing)
- [Security](#security)
- [Getting help](#getting-help)
- [License](#license)

## What is in it today

| | |
| --- | --- |
| **The model layer** | Manifest reading and field formatting, the command model (which transitions a record may take, whether a guard allows a command), theming, filter memory, responsive breakpoints, the date-surface windowing behind timelines and calendars |
| **The table composables** | Filtering, grouping, tree rows, subtree aggregates, semantic dates |
| **31 components** | The presentational primitives (buttons, chips, links, avatars, sheets, tables, text and select inputs, meters, peeks, timezone and slug fields), the chart, the process stepper, and the data-bound half: the data table, field renderer, kanban board, reference and person pickers, facet select, weekly hours and cell editor |

237 tests, all passing, all over the pure modules.

## What belongs here

Low-level building blocks that any business application needs and that carry no product opinion:

data table, form inputs, field renderer, reference picker, person picker, organization picker, board,
calendar, timeline, chart, process stepper, command button, money and date inputs, filter controls,
layout primitives.

Deliberately absent: the REST client, the router, and any global store. A control never decides where
data comes from. Everything a control needs from its host arrives through the plugin options or
through props, which is what lets the same component serve a multi-tenant platform and a
single-tenant generated app without knowing which one it is in.

## Installing

```sh
npm install @cordango/web-controls
```

**That does not work yet.** The package is not on npm, and
[npmjs.com/package/@cordango/web-controls](https://www.npmjs.com/package/@cordango/web-controls)
will 404 until the first release. Until then, clone the repository and point at it directly:

```sh
git clone https://github.com/cordango/web-controls.git
cd web-controls && npm install && npm run build
```

```json
{ "dependencies": { "@cordango/web-controls": "file:../web-controls" } }
```

Vue, Vuetify and vue-i18n are peer dependencies. The host owns those versions.

| Peer | Version |
| --- | --- |
| `vue` | `^3.5.0` |
| `vuetify` | `^4.1.0` |
| `vue-i18n` | `^11.0.0` |

## Using it

```js
import { createApp } from 'vue'
import { CordangoControls } from '@cordango/web-controls'
import '@cordango/web-controls/styles'

createApp(App).use(CordangoControls, {
  locale: () => i18n.global.locale.value,   // which language to format in

  people: () => api.get('/platform/person'),      // the person directory
  media: (ref) => `${API}${ref}`,                 // where a stored file lives
  route: (target, id) => `/app/${target.entity}/${id}`,  // where a referenced record opens
  loadTableSettings: (handle, table) => api.get(...),    // one person's column preferences
  saveTableSettings: (handle, table, s) => api.put(...),
  toast: (message, color) => snackbar.show(message, color),
})
```

## The seams

Those six options are the things a control cannot work out for itself. Every one is optional and
falls back to something inert, so a host can wire one at a time and watch behaviour appear rather
than having to satisfy the whole interface before the first component renders.

| Option | What it answers |
| --- | --- |
| `people` | Who exists, for the person chip, avatar and picker |
| `media` | Where a stored file lives, given a reference |
| `route` | Where a referenced record opens, given a target and an id |
| `loadTableSettings` / `saveTableSettings` | One person's column preferences for one table |
| `toast` | How this host says something happened |

## Development

```sh
npm install
npm run build
npm test
```

Tests are plain `node --test` over the pure modules, no test framework and no build step. Components
are verified by the applications that consume them rather than by a headless DOM here.

## Contributing

Pull requests are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md) for how to get set up, what the
bar is for a change here, and how to add a component or a seam.

By taking part you agree to the [Code of Conduct](CODE_OF_CONDUCT.md).

## Security

Please report vulnerabilities privately, see [SECURITY.md](SECURITY.md). A control that renders a
field value as markup rather than as text, or that stays editable when its manifest says read-only,
is reproduced in every application using it.

## Getting help

- [Documentation](https://docs.cordango.com), for the platform and the language these controls render
- [Issues](https://github.com/cordango/web-controls/issues) for bugs and feature requests
- [Discussions](https://github.com/cordango/cordango/discussions) for questions and ideas
- [hello@cordango.com](mailto:hello@cordango.com)

## License

Apache-2.0. See [LICENSE](LICENSE).

CORDANGO is a trademark. The licence covers the software, not the name.
