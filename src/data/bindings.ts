export type BindingStatus =
  'Published' | 'Source available' | 'Publication prepared';

export interface Binding {
  slug: string;
  language: string;
  distribution: string;
  status: BindingStatus;
  registry?: { name: string; url: string; version?: string };
  install?: string;
  sourcePath: string;
  summary: string;
  requirements?: string;
  editionNote: string;
}

const repo = 'https://github.com/strling-lang/strling/tree/main/bindings';

export const bindings: Binding[] = [
  {
    slug: 'c',
    language: 'C',
    distribution: 'Source integration',
    status: 'Source available',
    sourcePath: `${repo}/c`,
    summary:
      'C headers, sources, Makefile, tests, and binding documentation live in the canonical compiler repository.',
    editionNote: 'Fourth Edition package certification is pending.',
  },
  {
    slug: 'cpp',
    language: 'C++',
    distribution: 'CMake source integration',
    status: 'Source available',
    sourcePath: `${repo}/cpp`,
    summary:
      'The C++ binding documents CMake FetchContent and a local Conan recipe; no public Conan release is asserted.',
    requirements: 'CMake and a C++ toolchain',
    editionNote: 'Fourth Edition package certification is pending.',
  },
  {
    slug: 'csharp',
    language: 'C#',
    distribution: 'NuGet and source',
    status: 'Published',
    registry: {
      name: 'NuGet · STRling',
      url: 'https://www.nuget.org/packages/STRling',
      version: '3.0.0',
    },
    sourcePath: `${repo}/csharp`,
    summary:
      'The C# binding provides the Simply API for .NET and a verified NuGet package.',
    requirements: '.NET',
    editionNote:
      'Published package verified; Fourth Edition certification remains provisional.',
  },
  {
    slug: 'dart',
    language: 'Dart',
    distribution: 'Pub.dev and source',
    status: 'Published',
    registry: {
      name: 'Pub.dev · strling',
      url: 'https://pub.dev/packages/strling',
      version: '3.0.0',
    },
    sourcePath: `${repo}/dart`,
    summary:
      'The Dart binding is available on Pub.dev and in the canonical source tree.',
    requirements: 'Dart 3',
    editionNote:
      'Published package verified; Fourth Edition certification remains provisional.',
  },
  {
    slug: 'fsharp',
    language: 'F#',
    distribution: 'NuGet and source',
    status: 'Published',
    registry: {
      name: 'NuGet · STRling.FSharp',
      url: 'https://www.nuget.org/packages/STRling.FSharp',
      version: '3.0.0',
    },
    sourcePath: `${repo}/fsharp`,
    summary:
      'The F# binding provides .NET-native STRling concepts and a verified NuGet package.',
    requirements: '.NET',
    editionNote:
      'Published package verified; Fourth Edition certification remains provisional.',
  },
  {
    slug: 'go',
    language: 'Go',
    distribution: 'Go module from Git source',
    status: 'Source available',
    sourcePath: `${repo}/go`,
    summary:
      'The canonical repository declares the module path github.com/strling-lang/strling/bindings/go.',
    requirements: 'Go 1.22',
    editionNote: 'Fourth Edition module/tag certification is pending.',
  },
  {
    slug: 'java',
    language: 'Java',
    distribution: 'Maven project source',
    status: 'Publication prepared',
    sourcePath: `${repo}/java`,
    summary:
      'A Maven project and Java binding are present in source; a Maven Central release is not asserted.',
    requirements: 'Java 11 and Maven',
    editionNote:
      'Registry publication and Fourth Edition certification are pending.',
  },
  {
    slug: 'kotlin',
    language: 'Kotlin',
    distribution: 'Gradle project source',
    status: 'Publication prepared',
    sourcePath: `${repo}/kotlin`,
    summary:
      'A Kotlin/JVM Gradle project is present in source; a public Maven registry release is not asserted.',
    requirements: 'JVM toolchain',
    editionNote:
      'Registry publication and Fourth Edition certification are pending.',
  },
  {
    slug: 'lua',
    language: 'Lua',
    distribution: 'LuaRocks manifest and source',
    status: 'Publication prepared',
    sourcePath: `${repo}/lua`,
    summary:
      'The repository contains a Lua binding and a release-templated rockspec; no live LuaRocks package is asserted.',
    requirements: 'Lua 5.1 or later',
    editionNote:
      'Registry publication and Fourth Edition certification are pending.',
  },
  {
    slug: 'perl',
    language: 'Perl',
    distribution: 'CPAN metadata and source',
    status: 'Publication prepared',
    sourcePath: `${repo}/perl`,
    summary:
      'Perl source and distribution metadata are present; no verified MetaCPAN release is asserted.',
    requirements: 'Perl 5.10 or later',
    editionNote:
      'Registry publication and Fourth Edition certification are pending.',
  },
  {
    slug: 'php',
    language: 'PHP',
    distribution: 'Composer project source',
    status: 'Publication prepared',
    sourcePath: `${repo}/php`,
    summary:
      'Composer metadata and PHP source are present; the package is not represented as published on Packagist.',
    requirements: 'PHP 8.2 or later',
    editionNote:
      'Registry publication and Fourth Edition certification are pending.',
  },
  {
    slug: 'python',
    language: 'Python',
    distribution: 'PyPI',
    status: 'Published',
    registry: {
      name: 'PyPI · STRling',
      url: 'https://pypi.org/project/STRling/',
      version: '2.5.9',
    },
    install: 'pip install strling',
    sourcePath: `${repo}/python`,
    summary:
      'The established Python package is on PyPI. The canonical source manifest is ahead of that public package line.',
    requirements: 'Python 3.8 or later',
    editionNote:
      'Use the published package as the current public line; Fourth Edition synchronization and migration guidance are pending.',
  },
  {
    slug: 'r',
    language: 'R',
    distribution: 'R package source',
    status: 'Source available',
    sourcePath: `${repo}/r`,
    summary:
      'An R package structure is present in source; no CRAN release is asserted.',
    editionNote:
      'Registry publication and Fourth Edition certification are pending.',
  },
  {
    slug: 'ruby',
    language: 'Ruby',
    distribution: 'RubyGems and source',
    status: 'Published',
    registry: {
      name: 'RubyGems · strling',
      url: 'https://rubygems.org/gems/strling',
      version: '3.0.0',
    },
    sourcePath: `${repo}/ruby`,
    summary:
      'The Ruby binding has a verified RubyGems release and canonical source.',
    requirements: 'Ruby 3.0 or later',
    editionNote:
      'Published package verified; Fourth Edition certification remains provisional.',
  },
  {
    slug: 'rust',
    language: 'Rust',
    distribution: 'Cargo project source',
    status: 'Source available',
    sourcePath: `${repo}/rust`,
    summary:
      'A Cargo package and Rust binding are present in source; this site does not assert a crates.io release.',
    requirements: 'Rust 1.70 or later',
    editionNote:
      'Registry publication and Fourth Edition certification are pending.',
  },
  {
    slug: 'swift',
    language: 'Swift',
    distribution: 'Swift Package source',
    status: 'Source available',
    sourcePath: `${repo}/swift`,
    summary:
      'The source tree includes a Swift Package with library and test targets.',
    requirements: 'Swift 5.9 or later',
    editionNote: 'Fourth Edition package certification is pending.',
  },
  {
    slug: 'typescript',
    language: 'TypeScript',
    distribution: 'npm',
    status: 'Published',
    registry: {
      name: 'npm · @strling-lang/strling',
      url: 'https://www.npmjs.com/package/@strling-lang/strling',
      version: '3.0.0',
    },
    install: 'npm install @strling-lang/strling',
    sourcePath: `${repo}/typescript`,
    summary:
      'The TypeScript binding is published on npm and provides the reference Simply API.',
    requirements: 'Modern Node.js/TypeScript toolchain',
    editionNote:
      'Published package verified; Fourth Edition certification remains provisional.',
  },
];

export const bindingBySlug = new Map(
  bindings.map((binding) => [binding.slug, binding]),
);
