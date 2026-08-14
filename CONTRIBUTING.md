# Contributing to the STRling website

The organization-wide
[contribution principles](https://github.com/strling-lang/.github/blob/main/CONTRIBUTING.md)
apply alongside this website-specific guide.

## Scope

This repository owns the public website, learning and reference content,
package and release presentation, accessibility, SEO/discoverability, browser
behavior, deployment configuration, and user-facing web functionality.
Compiler behavior, binding implementation, formal specifications, and
engineering governance belong in their owning repositories.

## Branch and deployment boundary

`main` is the only long-lived and deployable branch. Use a short-lived branch or
fork for review, then merge an approved change into `main` through the normal
repository workflow. A branch preview or local build does not establish public
release status or deployment authority.

Do not change Netlify access controls, environment variables, domain settings,
or other out-of-repository deployment state as part of a code contribution
unless that external change is explicitly authorized.

## Local development

Use Node.js 22 and npm 10 or later:

```bash
npm install
npm run dev
```

Before proposing a change, run the checks applicable to it:

```bash
npm run check
npm run lint
npm run format:check
npm run build
npm test
npm run test:e2e
```

Install the Playwright Chromium runtime once with
`npx playwright install chromium`. Document any check that could not run and
why.

## Content authority

Follow [`docs/CONTENT_SOURCES.md`](docs/CONTENT_SOURCES.md). Verify public claims
against the controlling public source or live package record. Do not turn plans,
branch-only work, package preparation, or research recommendations into release
guarantees.

Keep version, package, repository, URL, and Fourth Edition status in the
centralized data modules that own them. Update shared data before page-specific
copy, and preserve explicit provisional language where evidence is incomplete.

## Accessibility, browsers, and presentation

- Preserve semantic HTML, keyboard access, visible focus, meaningful labels,
  alt text, sufficient contrast, responsive layouts, and reduced-motion
  behavior.
- Exercise affected routes at representative mobile and desktop sizes.
- Run the relevant Playwright and axe checks for interactive, navigation, or
  layout changes.
- Include before/after screenshots for material visual changes and identify the
  tested viewport and browser.
- Do not make accessibility depend on client JavaScript when the static HTML can
  provide the required meaning.

## SEO and machine-readable content

Follow [`docs/SEO_STRATEGY.md`](docs/SEO_STRATEGY.md) and
[`docs/AI_DISCOVERABILITY.md`](docs/AI_DISCOVERABILITY.md). Preserve unique
titles and descriptions, canonical URLs, meaningful headings, structured data,
internal links, sitemap coverage, and factual `llms.txt` generation. Do not add
thin or duplicate pages merely to target keywords.

Generated `dist` output is not a source of truth and must not be committed.
Change the source content or centralized data that controls generated pages.

## Security and review

Do not commit credentials, deployment tokens, private analytics, unpublished
visitor data, or machine-local configuration. Report suspected vulnerabilities
privately under [`SECURITY.md`](SECURITY.md).

All participation follows the organization
[Code of Conduct](https://github.com/strling-lang/.github/blob/main/CODE_OF_CONDUCT.md).
Use the [support guide](https://github.com/strling-lang/.github/blob/main/SUPPORT.md)
for questions owned by another STRling repository.
