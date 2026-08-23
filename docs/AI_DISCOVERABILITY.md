# AI and LLM discoverability

## `llms.txt` design

`/llms.txt` is a concise, plain-text orientation file. It defines STRling, names the canonical website and GitHub sources, links Learn, Docs, Packages, Fourth Edition, Why STRling, and Project, and states the pre-release qualifier.

## `llms-full.txt` generation

`/llms-full.txt` is generated at build time from:

- Docs and Learn content-collection metadata;
- `src/data/bindings.ts` package state;
- `src/data/release.ts` Fourth Edition state;
- `src/data/site.ts` canonical URLs and repositories.
- the reviewed Regex Conformance documentation projection in
  `src/data/regex-docs/`, including all canonical categories, feature IDs,
  definitions, routes, and semantic digest.

It summarizes public user material rather than dumping source Markdown or internal engineering documents. Updating collection frontmatter or centralized data updates the machine-readable index in the same build.

## Structured data

All pages emit factual WebSite and Organization JSON-LD. Documentation, learning, and binding detail pages add TechArticle. Pages with breadcrumbs add BreadcrumbList. The organization mark points to the shared remote asset; no ratings, downloads, dates, awards, or reviews are fabricated.

## Canonical terminology

Use these terms consistently:

- **STRling** — product/project name;
- **The Universal Regular Expression Compiler** — established identity;
- **Simply API** — high-level public Pattern-building interface;
- **Pattern** — a composable value representing matching intent;
- **generated RegEx** — target expression produced from a Pattern;
- **binding** — host-language implementation;
- **target engine** — RegEx runtime that executes output;
- **Fourth Edition** — explicitly pre-release until centralized status changes.

Avoid conflating a binding package with the entire edition. Avoid “type-safe” as a universal claim; compile-time help depends on the host language and specific API path.

## Machine-readable content rules

Future public content should:

1. lead with an explicit textual summary;
2. use descriptive headings and stable URLs;
3. place explanatory text next to code;
4. label exact output separately from conceptual output shapes;
5. distinguish published, source-available, and publication-prepared packages;
6. state target-engine assumptions;
7. keep dates, versions, package state, and release qualifiers in shared data;
8. link user concepts to deeper canonical pages;
9. omit internal task IDs, architecture plans, and contributor-only mechanics;
10. remain meaningful in static HTML without client JavaScript.

## Regex semantic discovery

`/regex/docs/` exposes the complete canonical semantic universe in static HTML.
Category and feature routes participate in `sitemap.xml`; `llms-full.txt` lists
every canonical feature with its semantic ID and definition. Feature pages emit
`DefinedTerm` structured data and bind visibly to the reviewed semantic digest.
Syntax manifestations remain source-specific, and missing compatibility
evidence is never converted to an unsupported claim.

## Source-of-truth policy

Public implementation, the Regex Conformance semantic corpus, certified
empirical evidence, formal specifications, tests, and live registries each
support claims in their own authority domain. Plans support only provisional
statements. If evidence conflicts, narrow the claim or omit it. See
`docs/CONTENT_SOURCES.md` for the full authority map.
