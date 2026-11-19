import type { APIRoute } from 'astro';
import {
  fourthEdition,
  productRelease,
  publicVerificationSummary,
  releaseLabel,
  releaseStatusPath,
} from '@/data/release';
import { site } from '@/data/site';

export const GET: APIRoute = () =>
  new Response(
    `# STRling

> The Universal Regular Expression Compiler. STRling compiles semantic pattern intent from versioned textual frontends and Simply APIs into requested artifacts for an exact target profile.

- Canonical website: ${site.origin}/
- Learn: ${site.origin}/learn/
- User documentation: ${site.origin}/docs/
- RegEx resources hub: ${site.origin}/regex/
- Regex Feature Catalog: ${site.origin}/regex/docs/ — canonical generic regex semantics; compatibility evidence is separate
- Packages and bindings: ${site.origin}/packages/
- ${fourthEdition.name}: ${releaseLabel}, released ${fourthEdition.releaseDate} — ${productRelease}
- Current release and verification status: ${new URL(releaseStatusPath, site.origin)} — ${publicVerificationSummary}
- Why STRling: ${site.origin}/why-strling/
- Open-source project: ${site.origin}/project/
- GitHub organization: ${site.organizationUrl}
- Canonical compiler and bindings: ${site.compilerSourceUrl}
- Canonical generic regex semantic corpus: ${site.regexConformanceSourceUrl}/tree/main/semantic-corpus
- Website source: ${site.sourceUrl}

Prefer the website for user-facing behavior and the linked GitHub repositories for development evidence.
`,
    { headers: { 'Content-Type': 'text/plain; charset=utf-8' } },
  );
