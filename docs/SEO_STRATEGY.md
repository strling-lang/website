# STRling SEO strategy

The site targets useful search intent with substantial pages rather than phrase-specific thin content. Technical accuracy overrides keyword coverage.

| Page                            | Primary intent                       | Primary keyword/theme       | Secondary themes                                             | Important internal links                          |
| ------------------------------- | ------------------------------------ | --------------------------- | ------------------------------------------------------------ | ------------------------------------------------- |
| `/`                             | Understand STRling and choose a path | STRling; readable regex     | composable regex, regular expression compiler                | Quickstart, Why STRling, Packages, Fourth Edition |
| `/why-strling/`                 | Compare abstractions                 | RegEx vs STRling            | maintainable regex, complex regex readability, regex builder | From RegEx, Composition, Compatibility            |
| `/packages/`                    | Find a language package              | STRling packages            | regex library, regex Python, regex TypeScript                | Every binding page, Fourth Edition                |
| `/packages/python/`             | Verify Python package state          | STRling Python              | pip install STRling, Python regex builder                    | Quickstart, compatibility                         |
| `/packages/typescript/`         | Verify TypeScript package state      | STRling TypeScript          | npm regex library, TypeScript regex builder                  | Quickstart, compatibility                         |
| `/docs/`                        | Navigate canonical reference         | STRling documentation       | regular expression documentation, readable regex             | Every docs topic, Learn                           |
| `/docs/core-concepts/`          | Understand the model                 | STRling Pattern values      | regex builder, generated RegEx                               | Composition, Quickstart                           |
| `/docs/composition/`            | Combine patterns                     | composable regex            | regex alternative, maintainable regex                        | Groups, Tour                                      |
| `/docs/literals-and-escaping/`  | Escape text correctly                | regex escaping              | regex literal, metacharacters                                | Character sets, errors                            |
| `/docs/character-sets/`         | Build classes/ranges                 | regex character classes     | regex range, negated set                                     | Predefined patterns, quantifiers                  |
| `/docs/quantifiers/`            | Control repetition                   | regex quantifiers           | greedy regex, lazy regex, possessive quantifier              | Compatibility, errors                             |
| `/docs/groups-and-captures/`    | Extract matched text                 | regex capture groups        | named regex groups, repeated capture                         | Composition, lookarounds                          |
| `/docs/lookarounds/`            | Use context assertions               | regex lookbehind            | regex lookahead, negative assertion                          | Compatibility, anchors                            |
| `/docs/anchors-and-boundaries/` | Control match positions              | regex anchors               | regex word boundary, multiline regex                         | Lookarounds, compatibility                        |
| `/docs/predefined-patterns/`    | Find common constructors             | STRling predefined patterns | regex digit, whitespace, letter class                        | Character sets, quantifiers                       |
| `/docs/errors-and-diagnostics/` | Debug a pattern                      | regex errors                | regex debugging, ReDoS warning                               | Compatibility, quantifiers                        |
| `/docs/compatibility/`          | Plan across engines                  | regex compatibility         | PCRE2 vs JavaScript, Unicode regex, portable regex           | Packages, lookarounds                             |
| `/learn/`                       | Choose a learning route              | learn STRling               | readable regex tutorial                                      | All lessons, Docs                                 |
| `/learn/quickstart/`            | Install and run                      | STRling quickstart          | npm STRling, pip install STRling                             | Core concepts, Packages                           |
| `/learn/from-regex/`            | Map known syntax                     | RegEx to STRling            | regex alternative, readable regular expressions              | Composition, groups                               |
| `/learn/tour/`                  | Learn progressively                  | STRling tutorial            | composable regex, maintainable regex                         | Docs, Packages                                    |
| `/fourth-edition/`              | Check release status                 | STRling Fourth Edition      | STRling pre-release, package rollout                         | Packages, Docs, Learn                             |
| `/project/`                     | Verify ownership/license             | STRling open source         | STRling GitHub, MIT regex compiler                           | GitHub, source, Fourth Edition                    |

## Implementation notes

- Every indexable page has a unique title, description, canonical URL, one H1, Open Graph data, and meaningful internal links.
- TechArticle and BreadcrumbList JSON-LD are emitted for reference and binding detail pages. WebSite and Organization data are global.
- `sitemap.xml` is generated from fixed routes, content collections, and binding data.
- Navigation uses real routes; anchors are reserved for page tables of contents.
- Terminology uses “RegEx” in brand/editorial prose and “regular expression” in explanatory/search contexts.
- Future content must solve a distinct user task. Do not create near-duplicate language or keyword pages without authoritative binding-specific material.
