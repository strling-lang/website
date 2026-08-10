import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { bindings } from '@/data/bindings';
import { canonicalUrl } from '@/data/site';

const fixed = [
  '/',
  '/why-strling/',
  '/packages/',
  '/docs/',
  '/learn/',
  '/fourth-edition/',
  '/project/',
];

export const GET: APIRoute = async () => {
  const docs = await getCollection('docs');
  const learn = await getCollection('learn');
  const paths = [
    ...fixed,
    ...bindings.map((binding) => `/packages/${binding.slug}/`),
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
