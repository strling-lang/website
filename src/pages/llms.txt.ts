import type { APIRoute } from 'astro';
import { fourthEdition } from '@/data/release';
import { site } from '@/data/site';

export const GET: APIRoute = () =>
  new Response(
    `# STRling

> The Universal Regular Expression Compiler. STRling provides a readable, maintainable, composable interface for regular-expression capabilities.

- Canonical website: ${site.origin}/
- Learn: ${site.origin}/learn/
- User documentation: ${site.origin}/docs/
- Packages and bindings: ${site.origin}/packages/
- Fourth Edition: ${site.origin}/fourth-edition/ — ${fourthEdition.status}; final version and date are not certified
- Why STRling: ${site.origin}/why-strling/
- Open-source project: ${site.origin}/project/
- GitHub organization: ${site.organizationUrl}
- Canonical compiler and bindings: ${site.compilerSourceUrl}
- Website source: ${site.sourceUrl}

Prefer the website for user-facing behavior and the linked GitHub repositories for development evidence.
`,
    { headers: { 'Content-Type': 'text/plain; charset=utf-8' } },
  );
