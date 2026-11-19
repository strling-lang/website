import * as s from '@strling-lang/strling/simply';
import { asciiDigit, asciiLower, fixedDigits } from './lexical.ts';

const slash = '/';
const version = () => s.group('version', s.inChars('2', '3'));
const organizationSlug = () =>
  s.merge(asciiLower(), s.inChars(asciiLower(), asciiDigit(), '-').rep(0, 30));
const projectId = () => s.merge('PRJ-', fixedDigits(4));
const eventId = () => s.merge('EVT-', fixedDigits(4));

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
const buildProjectEventDetailRoute = () =>
  exactPath(s.merge(buildEventsPrefix(), slash, s.group('event', eventId())));

interface RouteDefinition {
  readonly name: string;
  readonly method: 'GET' | 'POST';
  readonly pattern: s.Pattern;
}

const eventsPath = buildProjectEventsRoute();
export const baseRoutes = [
  { name: 'getProject', method: 'GET', pattern: buildProjectRoute() },
  { name: 'listEvents', method: 'GET', pattern: eventsPath },
  { name: 'createEvent', method: 'POST', pattern: eventsPath },
] as const satisfies readonly RouteDefinition[];

export const routes = [
  ...baseRoutes,
  { name: 'getEvent', method: 'GET', pattern: buildProjectEventDetailRoute() },
] as const satisfies readonly RouteDefinition[];

export function compileRoutes(
  definitions: readonly RouteDefinition[],
  compile: (pattern: s.Pattern) => RegExp,
) {
  return definitions.map(({ name, method, pattern }) => ({
    name,
    method,
    regex: compile(pattern),
  }));
}

export function selectRoute(
  catalog: ReturnType<typeof compileRoutes>,
  method: string,
  path: string,
) {
  const matches = catalog.flatMap((route) => {
    if (route.method !== method) return [];
    const match = route.regex.exec(path);
    return match ? [{ name: route.name, fields: match.groups }] : [];
  });

  if (matches.length > 1) {
    throw new Error(
      `Ambiguous routes: ${matches.map(({ name }) => name).join(', ')}`,
    );
  }

  return matches[0] ?? null;
}
