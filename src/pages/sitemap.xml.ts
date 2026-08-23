import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { bindings } from '@/data/bindings';
import { regexCategories, regexFeatures } from '@/data/regexDocs';
import { canonicalUrl } from '@/data/site';
import { regexSurfaces, strlingSurfaces } from '@/data/surfaces';

const fixed = [
  '/',
  '/why-strling/',
  '/packages/',
  '/learn/',
  '/regex/',
  '/fourth-edition/',
  '/project/',
];

const availableSurfaceRoutes = [...strlingSurfaces, ...regexSurfaces]
  .filter((surface) => surface.status === 'available')
  .map((surface) => surface.route);

export const GET: APIRoute = async () => {
  const docs = await getCollection('docs');
  const learn = await getCollection('learn');
  const paths = [
    ...fixed,
    ...availableSurfaceRoutes,
    ...bindings.map((binding) => `/packages/${binding.slug}/`),
    ...regexCategories.map((category) => category.route),
    ...regexFeatures.map((feature) => feature.route),
    ...docs.map((entry) => `/docs/${entry.id.replace(/\.(md|mdx)$/i, '')}/`),
    ...learn.map((entry) => `/learn/${entry.id.replace(/\.(md|mdx)$/i, '')}/`),
  ];
  const body = paths
    .map((path) => `<url><loc>${canonicalUrl(path)}</loc></url>`)
    .join('');
  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${body}</urlset>`,
    { headers: { 'Content-Type': 'application/xml; charset=utf-8' } },
  );
};
