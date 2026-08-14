---
applyTo: 'astro.config.*,netlify.toml,package.json,package-lock.json,.github/workflows/**'
---

# Build and deployment guidance

Preserve the Node/npm constraints, locked dependencies, static Astro build,
`dist` output boundary, Netlify publish path, security headers, canonical
origin behavior, and least privilege. Review supply-chain and browser-security
impact for configuration or dependency changes.

Run the smallest applicable check, then check/lint, build, unit/link tests, and
e2e only when runtime or browser behavior changes. A successful build or commit
does not authorize deployment. Never change Netlify access controls,
environment variables, domains, tokens, or other external deployment state
without explicit authorization.
