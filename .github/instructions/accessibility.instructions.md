---
applyTo: 'src/components/**/*.astro,src/layouts/**/*.astro,src/pages/**/*.astro,src/styles/**/*.css,tests/e2e/**'
---

# Accessibility guidance

Preserve semantic HTML, logical heading and landmark structure, keyboard
operation, visible focus, meaningful labels and alternative text, contrast,
responsive reflow, reduced motion, and useful static HTML. Prefer native
elements before adding ARIA, and do not make accessibility depend on client
JavaScript when the server-rendered document can carry the meaning.

Run Astro check and the affected build/tests first. Escalate to representative
mobile and desktop Playwright plus axe checks for interaction, navigation,
focus, layout, or rendered accessibility changes. Do not run the full browser
suite for unrelated text-only edits.
