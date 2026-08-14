# STRling website security policy

## Reporting a vulnerability

Do not open a public issue for a suspected vulnerability, exposed secret,
private deployment detail, or incident that could put visitors or
infrastructure at risk. Use a private
[GitHub Security Advisory](https://github.com/strling-lang/website/security/advisories/new)
or email [strlinglang@gmail.com](mailto:strlinglang@gmail.com) if private
reporting is unavailable.

Include the affected revision and route, browser or client, reproduction
conditions, expected boundary, observed impact, and any known mitigation. Do
not send live credentials or unnecessarily sensitive personal data.

## Supported state

Security fixes target the current deployed site and maintained default branch.
The repository currently builds a static Astro site deployed through Netlify;
it has no application authentication, serverless functions, analytics, or
backend data service. Reassess this policy if that architecture changes.

## Website threat boundaries

Security-relevant reports include:

- script, markup, URL, or structured-data injection;
- dependency, lockfile, build, or supply-chain compromise;
- exposed credentials, environment values, source maps, private content, or
  deployment metadata;
- incorrect security headers, redirects, canonical origins, or hosting rules;
- unsafe third-party resources, links, package data, or remote assets; and
- vulnerabilities in browser-facing functionality or deployment
  configuration.

Pre-launch visitor access is controlled in Netlify outside this repository.
Never disclose access credentials or attempt to bypass that control in a public
report. Website content corrections without a security impact should use the
normal issue templates.
