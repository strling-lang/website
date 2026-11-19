---
title: 'Versioned API routes'
description: 'Build exact API path matchers from reusable STRling factories and a typed route catalog, then test method dispatch and named fields.'
summary: 'Create a family of maintainable API route patterns from shared path segments, version rules, resource identifiers, and typed route definitions.'
order: 5
time: '35 minutes'
difficulty: advanced
keywords:
  [
    'API route matching',
    'reusable regex patterns',
    'versioned routes',
    'regex pattern factories',
    'STRling TypeScript',
  ]
related:
  [
    '/learn/production-event-logs/',
    '/docs/anchors-and-boundaries/',
    '/learn/policy-driven-import-records/',
  ]
---

## 1. Define the router's input

An API has project and event endpoints. The router receives the method and a
pathname as separate values. In this lesson the path is case sensitive, and
the input contract excludes query strings, percent-encoded text, and trailing
slashes. The router accepts `v2` and `v3` explicitly. A version with a leading
zero or a different number is outside the catalog's policy.

```text
GET  /api/v2/orgs/acme/projects/PRJ-0042
GET  /api/v2/orgs/acme/projects/PRJ-0042/events
POST /api/v2/orgs/acme/projects/PRJ-0042/events
GET  /api/v2/orgs/acme/projects/PRJ-0042/events/EVT-1907
```

The spaces above separate columns in a listing. Each matcher receives only the
path, and the catalog holds the method. One conventional ECMAScript matcher
for the collection path, with multiline mode off, is this expression.

```regex
^/api/v(?<version>[23])/orgs/(?<organization>[a-z][a-z0-9-]{0,30})/projects/(?<project>PRJ-[0-9]{4})/events(?![\s\S])
```

This is pattern text for `new RegExp`, so slashes are ordinary characters. A
regex literal would escape those slashes. A detail matcher needs the same
version, slug, and project ID before its own suffix. Copying the prefix into
each matcher makes updates easy to apply inconsistently. This lesson moves
the common requirement into a factory and builds each complete route from it.

## 2. Encode the shared path vocabulary

Reuse the ASCII range factories from [Production event logs](/learn/production-event-logs/).
An organization slug starts with a lowercase ASCII letter, has 1–31 characters
total, and permits lowercase letters, digits, and hyphens in the rest. A
trailing hyphen is allowed by this particular policy. Project and event IDs
each have an exact uppercase prefix and four ASCII digits.

```typescript
import * as s from '@strling-lang/strling/simply';
import { asciiDigit, asciiLower, fixedDigits } from './lexical.ts';

const slash = '/';
const version = () => s.group('version', s.inChars('2', '3'));
const organizationSlug = () =>
  s.merge(asciiLower(), s.inChars(asciiLower(), asciiDigit(), '-').rep(0, 30));
const projectId = () => s.merge('PRJ-', fixedDigits(4));
const eventId = () => s.merge('EVT-', fixedDigits(4));
```

The ID factories contain no capture names. A caller decides whether a value
identifies a project, an event, or something else in that route. The version
factory includes its capture because every route uses it for the same purpose.

## 3. Reuse prefixes and anchor completed routes

Keep the prefix composable so one caller can end immediately after the project
ID and another can append resource segments. The `exactPath` helper is the one
place that adds the input boundaries to completed paths.

```typescript
function buildProjectPrefix(): s.Pattern {
  return s.merge(
    '/api/v',
    version(),
    '/orgs/',
    s.group('organization', organizationSlug()),
    '/projects/',
    s.group('project', projectId()),
  );
}

function buildEventsPrefix(): s.Pattern {
  return s.merge(buildProjectPrefix(), slash, 'events');
}

function exactPath(path: s.Pattern): s.Pattern {
  return s.merge(s.start(), path, s.end());
}

const buildProjectRoute = () => exactPath(buildProjectPrefix());
const buildProjectEventsRoute = () => exactPath(buildEventsPrefix());
```

Each `Pattern` records its operations when compiled. Separate final patterns
can all have a `project` capture. Within one final pattern give any second
project capture its own name, for example `destinationProject`, so consumers
can distinguish the two fields.

## 4. Put methods and patterns in a catalog

An ordinary TypeScript object carries the route name and method alongside its
`Pattern`. The GET and POST definitions for the events collection reuse the
same path value. Their handlers can still have separate names and policies.

```typescript
interface RouteDefinition {
  readonly name: string;
  readonly method: 'GET' | 'POST';
  readonly pattern: s.Pattern;
}

const eventsPath = buildProjectEventsRoute();
const baseRoutes = [
  { name: 'getProject', method: 'GET', pattern: buildProjectRoute() },
  { name: 'listEvents', method: 'GET', pattern: eventsPath },
  { name: 'createEvent', method: 'POST', pattern: eventsPath },
] as const satisfies readonly RouteDefinition[];
```

To add the event detail endpoint, extend the events prefix with one segment.
Append a catalog row with the method and handler name. The version and ID
policies still come from the same factories.

```typescript
const buildProjectEventDetailRoute = () =>
  exactPath(s.merge(buildEventsPrefix(), slash, s.group('event', eventId())));

const routes = [
  ...baseRoutes,
  { name: 'getEvent', method: 'GET', pattern: buildProjectEventDetailRoute() },
] as const satisfies readonly RouteDefinition[];
```

## 5. Compile independently and select a route

Download the <a href="/examples/pattern-engineering/versioned-api-routes.ts" download>complete route source</a>
and use the same `compiler.ts`, `lexical.ts`, and profile file from
[the event-log setup](/learn/production-event-logs/#5-compile-for-ecmascript-and-run-in-node).
Save the following as `example.ts` and run it with the same Node command.

```typescript
import { loadPatternCompiler } from './compiler.ts';
import { compileRoutes, routes, selectRoute } from './versioned-api-routes.ts';

const catalog = compileRoutes(routes, await loadPatternCompiler());
const path = '/api/v2/orgs/acme/projects/PRJ-0042/events/EVT-1907';
const match = selectRoute(catalog, 'GET', path);
console.log(match?.name, match?.fields?.project, match?.fields?.event);
```

This prints `getEvent PRJ-0042 EVT-1907`. The catalog compiles each definition
at initialization for ECMAScript 2024 profile 1.3.0. `selectRoute` considers
only entries with the requested method and evaluates their compiled RegEx
against the pathname. Zero matches return `null`. Multiple matches for the
same method throw an ambiguity error, so array order cannot silently change
which handler runs. If your router intentionally supports overlaps, define and
test a precedence rule before adding them.

To target another engine, select its exact profile, inspect the compilation
diagnostics and emitted artifact, then run the same path and capture fixtures
in that engine's runtime. The Node results here verify the ECMAScript target.

## 6. Test path recognition and dispatch separately

Let `P` stand for `/api/v2/orgs/acme/projects/PRJ-0042`. First run the collection
regex against `P/events` and assert the version, organization, and project
captures. Then run the catalog with both methods. Both tests exercise the
same path grammar, while the second checks which handler name is selected.

| Method | Path or modification                                           | Expected selection                             |
| ------ | -------------------------------------------------------------- | ---------------------------------------------- |
| GET    | `P`                                                            | `getProject`                                   |
| GET    | `P/events`                                                     | `listEvents`                                   |
| POST   | `P/events`                                                     | `createEvent`                                  |
| GET    | `P/events/EVT-1907`                                            | `getEvent`, with `event` equal to `'EVT-1907'` |
| GET    | `P` with `v3`                                                  | `getProject`, with `version` equal to `'3'`    |
| GET    | `P` with `v1` or `v02`                                         | No route                                       |
| GET    | `P` with an empty organization or a slug starting with a digit | No route                                       |
| GET    | `P` with project `PROJ-0042`                                   | No route                                       |
| GET    | `P/events/EVT-19` or `P/events/evt-1907`                       | No route                                       |
| GET    | `P/events/EVT-1907/extra`, `P/events/`, or `P/events?limit=10` | No route                                       |
| POST   | `P`                                                            | No route even though the GET path is valid     |
| GET    | `P/events` with a duplicate GET collection entry               | Ambiguity error                                |

Repeat the detail case against the original `baseRoutes`. It returns `null`
until the new row arrives. Re-run the original collection and project cases
after adding the row to verify that their handler names still resolve.

## 7. Apply URL and authorization policy in the application

Use your HTTP framework to separate the pathname from the query, and define
how decoding and normalization occur before recognition. Apply one policy for
percent encoding, encoded separators, and dot segments across the router and
authorization layer. The example accepts only the declared pathname grammar.
If a framework changes the input path first, test what it actually hands to
the matcher. Keep API retirement rules explicit in the version factory and
method rules explicit in the catalog.

A request can match `getProject` and capture `acme` and `PRJ-0042` while the
caller belongs to `globex`. Resolve the project in the captured organization's
scope and check the principal's permission for that operation and project
before calling the handler. A match identifies the requested resource and
action. The authorization check decides whether the caller can access it.

The second lesson organized a family of paths around shared factories. In
[Policy-driven import records](/learn/policy-driven-import-records/), a typed
configuration supplies the differences between formats.
