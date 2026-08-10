export const fallbackSiteOrigin = 'https://strling-lang.netlify.app';
export const siteOrigin = (
  import.meta.env.PUBLIC_SITE_URL ?? fallbackSiteOrigin
).replace(/\/$/, '');

export const site = {
  name: 'STRling',
  title: 'STRling — The Universal Regular Expression Compiler',
  tagline: 'Readable. Composable. Universal.',
  description:
    'STRling is a readable, maintainable, composable interface for regular-expression capabilities across programming languages.',
  origin: siteOrigin,
  organizationUrl: 'https://github.com/strling-lang',
  sourceUrl: 'https://github.com/strling-lang/website',
  compilerSourceUrl: 'https://github.com/strling-lang/strling',
  logoUrl:
    'https://raw.githubusercontent.com/strling-lang/.github/refs/heads/main/strling_silver_bell.png',
  licenseUrl: 'https://github.com/strling-lang/website/blob/main/LICENSE',
} as const;

export function canonicalUrl(pathname: string): string {
  const normalized =
    pathname === '/' ? '/' : `/${pathname.replace(/^\/+|\/+$/g, '')}/`;
  return new URL(normalized, `${site.origin}/`).toString();
}
