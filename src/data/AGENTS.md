# Shared-data agent guidance

`src/data/` centralizes public facts reused across pages and generated machine
surfaces. The live modules are:

- `bindings.ts`: binding, package, registry, version, install, and source state;
- `content-sources.ts`: public source catalog;
- `release.ts`: Fourth Edition status and provisional boundaries;
- `site.ts`: identity, origins, repository URLs, logo, and canonical URLs;
- `navigation.ts`: primary, Docs, and Learn navigation.

Read [../../docs/CONTENT_SOURCES.md](../../docs/CONTENT_SOURCES.md) before
changing factual data. Verify time-sensitive package and default-branch claims
against their live public source and record uncertainty. Update the owning data
module before page-specific copy; do not hardcode a second version, status,
origin, repository path, or navigation list.

Data changes can affect pages, sitemap, structured data, `llms.txt`, and
`llms-full.txt`. Run Astro check, build, unit/content and link tests; add e2e
only when routes, metadata, navigation, responsive behavior, or accessibility
may change.
