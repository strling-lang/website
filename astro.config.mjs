import { unified } from '@astrojs/markdown-remark';
import { defineConfig } from 'astro/config';
import { fileURLToPath } from 'node:url';
import rehypeAccessibleTables from './src/utils/rehypeAccessibleTables.ts';

const fallbackSite = 'https://strling-lang.netlify.app';

export default defineConfig({
  site: process.env.PUBLIC_SITE_URL ?? fallbackSite,
  output: 'static',
  trailingSlash: 'always',
  markdown: {
    processor: unified({ rehypePlugins: [rehypeAccessibleTables] }),
    shikiConfig: { theme: 'github-dark-default', wrap: false },
  },
  vite: {
    resolve: {
      alias: {
        picomatch: fileURLToPath(
          new URL('./scripts/picomatch-esm-bridge.mjs', import.meta.url),
        ),
      },
    },
  },
});
