# STRling website

The canonical public website, user documentation, learning hub, package directory, and pre-release center for [STRling](https://github.com/strling-lang)—The Universal Regular Expression Compiler.

This repository is the **user surface**. Website implementation, content,
accessibility, SEO/discoverability, browser behavior, deployment, and
user-facing site defects belong here. Compiler implementation, binding
development, formal specifications, and engineering governance belong in
[`strling-lang/strling`](https://github.com/strling-lang/strling).

The site is actively developed and may describe pre-release STRling work only
with the explicit status and evidence boundaries defined below.

## Branch and deployment policy

`main` is the only long-lived and deployable website branch. Short-lived
contributor branches and forks are welcome for review; they must not be treated
as deployment or release authority. Do not create long-lived phase, release, or
architecture branches for website work. Netlify builds and deploys pushes to
`main`.

## Prerequisites

- Node.js 22 (see `.nvmrc`)
- npm 10 or later

## Install and run

```bash
npm install
npm run dev
```

Astro prints the local development URL. The production origin uses `PUBLIC_SITE_URL` when set and otherwise falls back to `https://strling-lang.netlify.app`.

## Quality commands

```bash
npm run check          # Astro and TypeScript
npm run lint           # ESLint
npm run format:check   # Prettier verification
npm run build          # static production build
npm test               # build, content tests, and internal-link integrity
npm run test:e2e       # Playwright routes, responsive behavior, metadata, and axe
```

Install the Playwright Chromium runtime once on a new machine with `npx playwright install chromium`.

## Structure

```text
src/
  components/       shared shell, code, package, status, and docs UI
  content/docs/     canonical user reference topics
  content/learn/    guided learning material
  data/             site, release, navigation, binding, and source facts
  layouts/          global, documentation, and learning layouts
  pages/            static hubs, dynamic content/package routes, SEO/AI endpoints
  styles/           centralized semantic tokens and global CSS
docs/               editorial source, SEO, and AI discoverability policies
scripts/            build-output integrity checks
tests/              Node content gates and Playwright browser tests
```

## Content source-of-truth policy

User-facing claims must be supported by public STRling source or live package records. Start with:

- [`strling-lang/strling`](https://github.com/strling-lang/strling) for current binding source, Simply APIs, manifests, grammar, semantics, fixtures, and the Apache License 2.0;
- [`strling-lang/.github`](https://github.com/strling-lang/.github) for organization identity and the shared remote logo;
- package registries for current public availability.

Do not infer install commands, registry publication, compatibility guarantees, release dates, versions, or user-visible behavior from plans. See [`docs/CONTENT_SOURCES.md`](docs/CONTENT_SOURCES.md).

## Fourth Edition content rules

Fourth Edition status is centralized in `src/data/release.ts`. Until certification:

- label the edition pre-release;
- publish no final version or date;
- distinguish current registry records from edition certification;
- mark migration guidance and binding-by-binding guarantees provisional;
- update shared data before changing page-specific copy.

## Logo policy

Do not commit or re-host the silver bell logo. `src/data/site.ts` references the organization-owned image directly from `strling-lang/.github` with explicit dimensions and meaningful alt text at each use.

## Netlify

`netlify.toml` runs `npm run build`, publishes `dist`, applies security headers, and caches hashed Astro assets. There are no SPA rewrites, functions, authentication, analytics, or backend services. Pre-launch visitor access is controlled in Netlify, outside the application.

## Contributing, security, and support

- Read [`CONTRIBUTING.md`](CONTRIBUTING.md) for website development, content,
  accessibility, browser, SEO, and review requirements.
- Report suspected vulnerabilities privately according to
  [`SECURITY.md`](SECURITY.md).
- Follow the organization
  [Code of Conduct](https://github.com/strling-lang/.github/blob/main/CODE_OF_CONDUCT.md).
- Use the organization [support and issue-routing guide](https://github.com/strling-lang/.github/blob/main/SUPPORT.md)
  for compiler, conformance, research, and general organization questions.

Website source and content are licensed under the
[Apache License 2.0](LICENSE). Copyright 2026 STRling Team.
