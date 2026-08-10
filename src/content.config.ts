import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const sharedSchema = z.object({
  title: z.string(),
  description: z.string(),
  summary: z.string(),
  order: z.number(),
  keywords: z.array(z.string()).default([]),
  related: z.array(z.string()).default([]),
});

const docs = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/docs' }),
  schema: sharedSchema.extend({ category: z.string().default('Reference') }),
});

const learn = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/learn' }),
  schema: sharedSchema.extend({ time: z.string() }),
});

export const collections = { docs, learn };
