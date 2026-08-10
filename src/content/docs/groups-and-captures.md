---
title: 'Groups and captures'
description: 'Use numbered captures, named capture groups, and non-capturing structure with STRling while avoiding duplicate names and portability mistakes.'
summary: 'Captures extract matched text. STRling makes the choice between numbered and named groups visible through capture and group constructors.'
order: 6
category: 'Pattern structure'
keywords:
  [
    'regex capture groups',
    'named regex groups',
    'STRling capture',
    'regex group',
  ]
related: ['/docs/composition/', '/docs/lookarounds/', '/learn/from-regex/']
---

## Summary

`capture` creates a numbered capture group. `group(name, ...)` creates a named capture group. Use captures when application code needs matched subtext; use plain composition when you only need matching structure.

## When to use it

Capture a field when later code needs to read it: an area code, protocol, identifier, or date component. Prefer a name when the capture has stable domain meaning and will not be repeated.

## Numbered captures

```typescript
const date = s.merge(
  s.capture(s.digit(4)),
  '-',
  s.capture(s.digit(2)),
  '-',
  s.capture(s.digit(2)),
);

const match = new RegExp(String(date)).exec('2026-08-09');
console.assert(match?.[1] === '2026');
```

Capture index zero is the full match in common RegEx runtimes; numbered groups begin at one.

## Named captures

```python
date = s.merge(
    s.group("year", s.digit(4)),
    "-",
    s.group("month", s.digit(2)),
    "-",
    s.group("day", s.digit(2)),
)

match = re.search(str(date), "2026-08-09")
assert match.group("year") == "2026"
```

The target emitter chooses the named-group syntax appropriate for the runtime. Python commonly uses `(?P<name>...)`; ECMAScript uses `(?<name>...)`.

## Structure without extraction

`merge` combines pieces without adding a capture. Generated output can add non-capturing grouping when precedence requires it. Do not capture a piece merely to make composition work.

Fewer incidental captures make downstream indices more stable and keep match objects focused on application data.

## Interactions with repetition

A numbered capture may be repeated with `rep`. Runtime semantics determine which repeated capture value is exposed. If you need every repetition, repeated matching or a second parsing step is often clearer.

Named groups must be unique throughout a composed Pattern. The public implementations check for duplicates in composition constructors. Repeating a named group would create the same name more than once and is rejected by the Simply model.

## Captures inside alternatives

A capture in an alternative may not participate in every match. A later backreference to a group that did not participate normally fails. Keep capture layouts consistent when application code expects stable indices.

```typescript
const pet = s.group('pet', s.anyOf('cat', 'dog'));
```

Putting one named group around the choice is safer than giving both branches the same name.

## Edge cases and errors

Group names must be valid identifiers for the public API and target. Duplicate names are invalid. Forward references are disallowed by the canonical semantics even where a RegEx engine might defer them.

Capturing empty or optional content is legal in many engines but can produce `undefined`, `None`, or an empty string depending on whether the group participated. Test the exact target-runtime result your application consumes.

## Portability considerations

Basic numbered captures are broadly portable. Named-group and named-backreference syntax differs by target, so let the emitter choose syntax. Recursion and self-references are not part of the current canonical semantics. Capture behavior under repeated alternatives can also vary in detail among runtime APIs.
