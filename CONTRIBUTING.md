# Contributing to Cordango Web Controls

Thanks for being here. This document is what you need to get a change merged.

By taking part you agree to the [Code of Conduct](CODE_OF_CONDUCT.md).

## Table of Contents

- [Getting set up](#getting-set-up)
- [Running the tests](#running-the-tests)
- [What makes a good change here](#what-makes-a-good-change-here)
- [Adding a component](#adding-a-component)
- [Adding a seam](#adding-a-seam)
- [Commits and pull requests](#commits-and-pull-requests)
- [Reporting a bug](#reporting-a-bug)
- [Getting help](#getting-help)

## Getting set up

You need **Node 20 or newer**. Nothing else — no database, no containers, no browser.

```sh
git clone https://github.com/cordango/web-controls.git
cd web-controls
npm install
npm run build
npm test
```

To try a change against a real application before opening a pull request, point that application at
your checkout:

```json
{ "dependencies": { "@cordango/web-controls": "file:../web-controls" } }
```

## Running the tests

```sh
npm test
```

Plain `node --test` over the pure modules. No test framework, no build step, no headless DOM. The
composables, the formatting, the command model and the date-surface windowing are all ordinary
functions and are tested as such; the components are verified by the applications that consume them.

That is a deliberate line rather than a gap. A test that mounts a Vuetify component mostly asserts
what Vuetify does. If you find yourself wanting one, the usual sign is that logic has leaked into a
`.vue` file and wants pulling out into a module beside it — which is how `timeRange.js`,
`weeklyHours.js` and `dayGrid.js` all came to exist.

## What makes a good change here

This package is consumed by two hosts that must never be able to tell each other apart: the
multi-tenant Cordango platform, and the single-tenant applications the Cordango generator produces.
Everything below follows from that.

**A control never decides where data comes from.** No `axios`, no router, no global store, no import
that reaches outside this package. Everything a control needs from its host arrives through the
plugin options or through props. A component that reached for an HTTP client would work in exactly
one application, which is the state these modules were in before they were extracted.

**Ask what a thing MEANS, not where it currently sits.** `commands.js` looked like host code because
it sat next to `axios`, but thirteen of its nineteen exports only read a manifest and a record:
which transitions are available from the state a record is in, whether a guard allows a command.
What a command means is identical everywhere; only how one is sent differs. So the meaning came into
this package and the sending did not.

**Always Vuetify, never hand-rolled.** No raw `<input>`, `<select>`, `<button>` or `<table>`. Use
`v-sheet` for a composite clickable. A control that draws its own widget will not follow the host's
theme, and following the host's theme is most of the job.

**A new option must be optional.** Every seam falls back to something inert so a host can wire one
at a time and watch behaviour appear, rather than having to satisfy the whole interface before the
first component renders.

**Say why in a comment, not what.** The code says what it does. A comment earns its place by
recording the decision, the alternative that was rejected, or the bug that produced the line.

## Adding a component

Low-level building blocks that any business application needs and that carry no product opinion
belong here: data tables, form inputs, field renderers, pickers, boards, calendars, timelines,
charts, process steppers, command buttons, filter controls, layout primitives.

1. Put presentational primitives in `src/ui/`, data-bound components in `src/views/`, table
   machinery in `src/tables/`.
2. Pull anything that is not rendering into a plain `.js` module beside it, and test that.
3. Export it from `src/index.js` under its `Cordango*` name. The file keeps whatever name it has;
   a consumer only ever sees the exported one.
4. Carry the SPDX header every other file has.

**Two `export *` sources offering one name is ambiguous, and ES modules resolve that by dropping it
silently.** `mediaUrl` was missing from the package surface entirely and nothing said so. If you add
an export whose name already exists, name it explicitly in `src/index.js`.

## Adding a seam

A seam is something a control cannot work out for itself: who exists, where a stored file lives,
where a referenced record opens, one person's column preferences, how this host says something
happened.

Add it to the `setHost` call in `src/index.js`, give it an inert default in `src/host.js`, and
document it in the README table. Then check it against both hosts — a seam only one of them can
satisfy is a sign the thing behind it belongs in that host instead.

## Commits and pull requests

- Branch from `main`.
- One concern per pull request. A refactor and a fix in the same diff are two reviews pretending to
  be one.
- Say what changed and why in the description. If it fixes an issue, link it.
- Make sure `npm test` and `npm run build` both pass.
- If you change an exported name, a prop or a plugin option, say so. This package is alpha and the
  surface is allowed to move, but it should never move by accident.

## Reporting a bug

Use the [issue templates](https://github.com/cordango/web-controls/issues/new/choose).

The most useful thing you can attach is the props you passed and what rendered instead of what you
expected, plus which host you saw it in — the platform or a generated application.

Security vulnerabilities go to [SECURITY.md](SECURITY.md), not to the issue tracker.

## Getting help

- [docs.cordango.com](https://docs.cordango.com) — the platform, the language and the CLI
- [Issues](https://github.com/cordango/web-controls/issues) — bugs and feature requests
- [Discussions](https://github.com/cordango/cordango/discussions) — questions and ideas
- [hello@cordango.com](mailto:hello@cordango.com)

## License

Contributions are licensed under [Apache-2.0](LICENSE), the same as the project.
