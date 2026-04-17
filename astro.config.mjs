// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// https://astro.build/config
export default defineConfig({
	site: 'https://winnerit.in.th',
	integrations: [
		sitemap({
			serialize(item) {
				item.lastmod = new Date().toISOString();
				return item;
			},
		}),
	],
});
