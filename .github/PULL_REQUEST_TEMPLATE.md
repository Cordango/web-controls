## What this changes

<!-- And why. If it fixes an issue, link it: Fixes #123 -->

## Does it change the package surface?

<!--
Delete this section if not. If it changes an exported name, a prop or a plugin option, say so and
say whether it is intentional. Alpha means the surface may move; it should never move by accident.
-->

## Checklist

- [ ] `npm test` passes
- [ ] `npm run build` passes
- [ ] No import reaches outside this package: no HTTP client, no router, no global store
- [ ] Vuetify components rather than raw `input`, `select`, `button` or `table`
- [ ] Logic that is not rendering lives in a `.js` module beside the component, and is tested there
- [ ] A new plugin option is optional and falls back to something inert
- [ ] Comments say *why*, where the reason is not obvious from the code
