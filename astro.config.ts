import { unified } from '@astrojs/markdown-remark';
import { defineConfig } from 'astro/config';
import rehypeAccessibleTables from './src/utils/rehypeAccessibleTables';

const fallbackSite = 'https://strling-lang.netlify.app';

export default defineConfig({
  site: process.env.PUBLIC_SITE_URL ?? fallbackSite,
  output: 'static',
  trailingSlash: 'always',
  markdown: {
    processor: unified({ rehypePlugins: [rehypeAccessibleTables] }),
    shikiConfig: { theme: 'github-dark-default', wrap: false },
  },
});
