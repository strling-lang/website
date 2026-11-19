import { fourthEdition, productRelease, productRepository } from './release.ts';

export type BindingStatus =
  'Registry published' | 'Git distribution' | 'Direct build';

export interface Binding {
  slug: string;
  language: string;
  distribution: string;
  status: BindingStatus;
  support: 'Supported' | 'Preview';
  package: { name: string; url: string; version: string };
  install?: string;
  installLanguage?: string;
  sourcePath: string;
  summary: string;
  requirements: string;
}

const repo = `${productRepository}/tree/${fourthEdition.productSource}/bindings`;

export const bindings: Binding[] = [
  {
    slug: 'c',
    language: 'C',
    distribution: 'Git source',
    status: 'Git distribution',
    support: 'Supported',
    package: {
      name: 'strling-c',
      url: `${productRepository}/tree/c-v4.0.3/bindings/c`,
      version: 'c-v4.0.3',
    },
    sourcePath: `${repo}/c`,
    summary:
      'Build from the tagged checkout using the binding’s CMake and local-prefix instructions.',
    requirements:
      'CMake 3.20+, C toolchain and Rust 1.75. Supported interop on Windows x86-64 and GNU Linux x86-64.',
    install:
      'git clone --branch c-v4.0.3 --single-branch https://github.com/strling-lang/strling.git',
  },
  {
    slug: 'cpp',
    language: 'C++',
    distribution: 'Direct CMake build',
    status: 'Direct build',
    support: 'Supported',
    package: { name: 'strling', url: productRelease, version: '4.0.3' },
    sourcePath: `${repo}/cpp`,
    summary:
      'Build the certified product source with CMake. ConanCenter admission is deferred.',
    requirements:
      'CMake 3.20+, C++ toolchain and Rust 1.75. Supported direct interop scope covers Windows x86-64 and GNU Linux x86-64.',
  },
  {
    slug: 'csharp',
    language: 'C#',
    distribution: 'NuGet',
    status: 'Registry published',
    support: 'Supported',
    package: {
      name: 'STRling',
      url: 'https://www.nuget.org/packages/STRling/4.0.3',
      version: '4.0.3',
    },
    sourcePath: `${repo}/csharp`,
    summary: 'Install the NuGet package with its Windows native assets.',
    requirements:
      '.NET 9, Windows x86-64 and Microsoft Visual C++ v14 x64 runtime.',
    install: 'dotnet add package STRling --version 4.0.3',
  },
  {
    slug: 'dart',
    language: 'Dart',
    distribution: 'Pub.dev',
    status: 'Registry published',
    support: 'Supported',
    package: {
      name: 'strling',
      url: 'https://pub.dev/packages/strling/versions/4.0.3',
      version: '4.0.3',
    },
    sourcePath: `${repo}/dart`,
    summary:
      'Provide an absolute path to the matching native library when loading the Dart adapter.',
    requirements: 'Dart 3 and GNU Linux x86-64.',
    install: 'dart pub add strling:4.0.3',
  },
  {
    slug: 'fsharp',
    language: 'F#',
    distribution: 'NuGet',
    status: 'Registry published',
    support: 'Supported',
    package: {
      name: 'STRling.FSharp',
      url: 'https://www.nuget.org/packages/STRling.FSharp/4.0.3',
      version: '4.0.3',
    },
    sourcePath: `${repo}/fsharp`,
    summary: 'Install the NuGet package with its Windows native assets.',
    requirements:
      '.NET 9, Windows x86-64 and Microsoft Visual C++ v14 x64 runtime.',
    install: 'dotnet add package STRling.FSharp --version 4.0.3',
  },
  {
    slug: 'go',
    language: 'Go',
    distribution: 'Go module from Git',
    status: 'Git distribution',
    support: 'Supported',
    package: {
      name: 'github.com/strling-lang/strling/bindings/go',
      url: 'https://proxy.golang.org/github.com/strling-lang/strling/bindings/go/@v/go-v4.0.3.info',
      version: 'go-v4.0.3',
    },
    sourcePath: `${repo}/go`,
    summary:
      'Go records the pseudo-version v0.0.0-20261118220028-d01ac3785736 for this product tag. Supply the matching native library.',
    requirements: 'Go 1.22+, cgo and GNU Linux x86-64.',
    install: 'go get github.com/strling-lang/strling/bindings/go@go-v4.0.3',
  },
  {
    slug: 'java',
    language: 'Java',
    distribution: 'Maven Central',
    status: 'Registry published',
    support: 'Supported',
    package: {
      name: 'io.github.strling-lang:strling',
      url: 'https://central.sonatype.com/artifact/io.github.strling-lang/strling/4.0.3',
      version: '4.0.3',
    },
    sourcePath: `${repo}/java`,
    summary:
      'The POM resolves the shared strling-jvm bridge. Add the coordinate to your project and supply the absolute path to the matching native library.',
    requirements:
      'Java 11 bytecode, verified with JDK 21 on Windows x86-64. Microsoft Visual C++ v14 x64 runtime.',
    install:
      'mvn dependency:get -Dartifact=io.github.strling-lang:strling:4.0.3',
  },
  {
    slug: 'kotlin',
    language: 'Kotlin',
    distribution: 'Maven Central',
    status: 'Registry published',
    support: 'Supported',
    package: {
      name: 'io.github.strling-lang:strling-kotlin',
      url: 'https://central.sonatype.com/artifact/io.github.strling-lang/strling-kotlin/4.0.3',
      version: '4.0.3',
    },
    sourcePath: `${repo}/kotlin`,
    summary:
      'Add the coordinate to your Gradle dependencies and supply the absolute path to the matching native library.',
    requirements:
      'Kotlin/JVM with Java 11 bytecode, verified with JDK 21 on Windows x86-64. Microsoft Visual C++ v14 x64 runtime.',
    install: 'implementation("io.github.strling-lang:strling-kotlin:4.0.3")',
    installLanguage: 'kotlin',
  },
  {
    slug: 'lua',
    language: 'Lua',
    distribution: 'LuaRocks',
    status: 'Registry published',
    support: 'Preview',
    package: {
      name: 'strling-lang/strling',
      url: 'https://luarocks.org/modules/strling-lang/strling/4.0.3-1',
      version: '4.0.3-1',
    },
    sourcePath: `${repo}/lua`,
    summary:
      'Install the published rock revision and provide the matching native library.',
    requirements: 'Lua 5.1 through 5.4 and GNU Linux x86-64 Preview scope.',
    install: 'luarocks install strling 4.0.3-1',
  },
  {
    slug: 'perl',
    language: 'Perl',
    distribution: 'CPAN',
    status: 'Registry published',
    support: 'Preview',
    package: {
      name: 'STRling',
      url: 'https://metacpan.org/release/STRLING/STRling-4.0.3',
      version: 'v4.0.3',
    },
    sourcePath: `${repo}/perl`,
    summary:
      'Install the CPAN distribution and provide the matching native library.',
    requirements: 'Perl 5.10+ and GNU Linux x86-64 Preview scope.',
    install: 'cpanm STRling@4.0.3',
  },
  {
    slug: 'php',
    language: 'PHP',
    distribution: 'Composer from Git',
    status: 'Git distribution',
    support: 'Preview',
    package: {
      name: 'strling/strling',
      url: `${productRepository}/tree/php-v4.0.3/bindings/php`,
      version: 'php-v4.0.3',
    },
    sourcePath: `${repo}/php`,
    summary:
      'Configure Composer to install the authenticated bindings/php subtree as a local path package. Supply the matching native library. The governed route is Git.',
    requirements: 'PHP 8.2+, enabled FFI, and GNU Linux x86-64 Preview scope.',
    install:
      'git clone --branch php-v4.0.3 --single-branch https://github.com/strling-lang/strling.git',
  },
  {
    slug: 'python',
    language: 'Python',
    distribution: 'PyPI',
    status: 'Registry published',
    support: 'Supported',
    package: {
      name: 'STRling',
      url: 'https://pypi.org/project/STRling/4.0.3/',
      version: '4.0.3',
    },
    sourcePath: `${repo}/python`,
    summary:
      'PyPI provides CPython 3.12 wheels for Windows x86-64 and manylinux 2.34 x86-64, plus a source archive.',
    requirements:
      'CPython 3.12. Windows x86-64 with Microsoft Visual C++ v14 x64 runtime or GNU Linux x86-64.',
    install: 'python -m pip install STRling==4.0.3',
  },
  {
    slug: 'r',
    language: 'R',
    distribution: 'Git source',
    status: 'Git distribution',
    support: 'Preview',
    package: {
      name: 'strling',
      url: `${productRepository}/tree/r-v4.0.3/bindings/r`,
      version: 'r-v4.0.3',
    },
    sourcePath: `${repo}/r`,
    summary:
      'Install bindings/r from the authenticated checkout and supply the matching native library.',
    requirements: 'R 4.3 through 4.x and GNU Linux x86-64 Preview scope.',
    install:
      'git clone --branch r-v4.0.3 --single-branch https://github.com/strling-lang/strling.git\nR CMD INSTALL strling/bindings/r',
  },
  {
    slug: 'ruby',
    language: 'Ruby',
    distribution: 'RubyGems',
    status: 'Registry published',
    support: 'Preview',
    package: {
      name: 'strling',
      url: 'https://rubygems.org/gems/strling/versions/4.0.3',
      version: '4.0.3',
    },
    sourcePath: `${repo}/ruby`,
    summary:
      'Install the published gem and provide the matching native library.',
    requirements: 'Ruby 3.x and GNU Linux x86-64 Preview scope.',
    install: 'gem install strling --version 4.0.3',
  },
  {
    slug: 'rust',
    language: 'Rust',
    distribution: 'crates.io',
    status: 'Registry published',
    support: 'Supported',
    package: {
      name: 'strling',
      url: 'https://crates.io/crates/strling/4.0.3',
      version: '4.0.3',
    },
    sourcePath: `${repo}/rust`,
    summary: 'Install the Rust reference kernel and facade from crates.io.',
    requirements:
      'Rust 1.75+. Supported reference implementation scope covers Windows and Linux x86-64.',
    install: 'cargo add strling@=4.0.3',
  },
  {
    slug: 'swift',
    language: 'Swift',
    distribution: 'SwiftPM from Git',
    status: 'Git distribution',
    support: 'Supported',
    package: {
      name: 'STRling',
      url: `${productRepository}/tree/swift-v4.0.3/bindings/swift`,
      version: 'swift-v4.0.3',
    },
    sourcePath: `${repo}/swift`,
    summary:
      'Build with swift build --package-path strling/bindings/swift or use that subtree as a local SwiftPM dependency. Supply the matching native library.',
    requirements: 'Swift tools 5.9+ and GNU Linux x86-64.',
    install:
      'git clone --branch swift-v4.0.3 --single-branch https://github.com/strling-lang/strling.git',
  },
  {
    slug: 'typescript',
    language: 'TypeScript',
    distribution: 'npm',
    status: 'Registry published',
    support: 'Preview',
    package: {
      name: '@strling-lang/strling',
      url: 'https://www.npmjs.com/package/@strling-lang/strling/v/4.0.3',
      version: '4.0.3',
    },
    sourcePath: `${repo}/typescript`,
    summary:
      'The ESM package includes the canonical WebAssembly compiler and provides an explicit Node loader.',
    requirements:
      'Node.js 22 for the Node API. Browser WASM integration is Preview and requires explicit loading.',
    install: 'npm install @strling-lang/strling@4.0.3',
  },
];

export const bindingBySlug = new Map(
  bindings.map((binding) => [binding.slug, binding]),
);
