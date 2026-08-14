---
description: 'Validate website claims against public canonical sources and live records'
argument-hint: '<page, proposed claim, or changed content paths>'
---

# Validate content authority

Treat the invocation arguments as the proposed claims or content scope. Read
`/AGENTS.md`, `docs/CONTENT_SOURCES.md`, the owning `src/data` modules, and the
appropriate public/default-branch repository sources or live package records.
Do not treat local branch-only work, private plans, or research recommendations
as published facts.

Return:

1. a claim → controlling source table;
2. provenance, version/commit/registry identity, and review date where material;
3. public availability and default-branch status;
4. freshness, conflicts, uncertainty, and unsupported or premature claims;
5. a disposition for each claim: retain, narrow, mark provisional, remove, or
   update after source verification;
6. affected central data, page copy, metadata, structured data, and
   `llms.txt`/`llms-full.txt` surfaces;
7. the smallest validation required.

Do not edit content, update live deployment state, deploy, stage, commit, or
publish unless separately authorized.
