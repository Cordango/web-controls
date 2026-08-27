# Security Policy

We take security seriously at Cordango, and we appreciate the effort it takes to find and report a
vulnerability responsibly.

## Reporting a Vulnerability

**Please do not report security vulnerabilities through public GitHub issues.**

Email **[hello@cordango.com](mailto:hello@cordango.com)** with the subject line `SECURITY`, or use
GitHub's [private vulnerability reporting](https://github.com/cordango/web-controls/security/advisories/new)
on this repository.

### What to include

1. **Description** — what the vulnerability is
2. **Impact** — what somebody could achieve by exploiting it
3. **Steps to reproduce** — enough for us to see it happen
4. **Affected versions** — which release, if you know
5. **Suggested fix** — optional, and welcome

### What to expect

- **Acknowledgement** within 48 hours
- **Updates** as we investigate
- **Resolution** — we aim to fix critical issues within 90 days, and to credit you in the advisory
  unless you would rather we did not

All reports are kept confidential. We will not share your details with anyone without your consent,
except where the law requires it.

## Supported versions

Alpha: only the latest release is supported. There are no backports, and the version you should be
running is the newest one.

## Scope

This policy covers this repository and the `@cordango/web-controls` package published from it.

These are presentational controls, so the reports that matter most here are the ones where a control
shows or accepts something the host did not intend:

- **Anything rendered as markup rather than as text.** A field value, a label, a tooltip or a chart
  series that reaches the DOM unescaped is the most serious kind of report we can get, because it is
  reproduced in every application using that component.
- **A control weakening a permission the host enforced.** An input that stays editable when its
  manifest says read-only, or a command button offering a transition its guard denies, is a
  vulnerability here even though the server is the thing that finally refuses it.
- **A seam leaking across hosts.** Cached table settings, a person directory or a media URL that
  survives where it should not.

### Out of scope

- **Authorization decided by the server.** This package has no HTTP client and no session. If a
  generated application or the platform lets a request through that it should have refused, that is a
  flaw in that host, not here — report it against
  [cordango/cordango](https://github.com/cordango/cordango/security/advisories/new) or to the address
  above.
- Vulnerabilities in Vue, Vuetify or another dependency, unless this project's use of them is what
  makes them exploitable. Report those upstream; tell us anyway if we should pin or patch.
- Anything requiring an attacker to already control the host application's code or the props it
  passes. A host is trusted like the code it is.

## Cordango Platform

The hosted product is not in this repository. For a vulnerability in Cordango Platform, email the
same address — say which one you mean, and we will route it.
