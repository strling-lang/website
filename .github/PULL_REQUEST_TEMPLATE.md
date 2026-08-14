## Website outcome

Describe the user-visible or developer-facing result and link the related issue.

## Evidence and source authority

Identify the public source, live package record, or repository data that
supports changed product, release, compatibility, or package claims.

## Verification

- [ ] `npm run check`
- [ ] `npm run lint`
- [ ] `npm run format:check`
- [ ] `npm run build`
- [ ] `npm test`
- [ ] Relevant Playwright/axe checks pass for affected routes and viewports.
- [ ] Changed internal links, metadata, structured data, and generated
      machine-readable indexes are correct.

Document skipped checks and the reason.

## Accessibility and presentation

- [ ] Keyboard, focus, labels, semantic structure, contrast, responsive layout,
      and reduced motion were considered where applicable.
- [ ] Material visual changes include representative before/after screenshots.

## Deployment and security

- [ ] The change does not expose credentials, private deployment state,
      unpublished content, or unintended generated `dist` output.
- [ ] Netlify, header, redirect, dependency, and supply-chain implications were
      reviewed where applicable.
- [ ] The branch or preview is not represented as deployment or release
      authority.
