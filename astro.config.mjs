// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

function sitemapLastmodPlugin() {
	let outDir = '';
	return {
		name: 'sitemap-lastmod',
		hooks: {
			'astro:config:done'({ config }) {
				outDir = config.outDir?.pathname?.replace(/^\/([A-Z]:)/, '$1') ?? './dist';
			},
			async 'astro:build:done'() {
				// Never fail the build if sitemap patching fails.
				try {
					const mapPath = join(outDir, '_lastmod-map.json');
					if (!existsSync(mapPath)) return;
					const raw = readFileSync(mapPath, 'utf-8').trim();
					if (!raw) return;
					const map = JSON.parse(raw);

					for (const name of ['sitemap-0.xml', 'sitemap.xml']) {
						const sitemapPath = join(outDir, name);
						if (!existsSync(sitemapPath)) continue;
						let xml = readFileSync(sitemapPath, 'utf-8');
						for (const [url, mod] of Object.entries(map)) {
							try {
								const locTag = `<loc>${url}</loc>`;
								if (!xml.includes(locTag)) continue;
								const dateStr = new Date(/** @type {string} */ (mod)).toISOString();
								const escapedLoc = locTag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
								xml = xml.replace(
									new RegExp(`${escapedLoc}\\s*<lastmod>[^<]+</lastmod>`),
									`${locTag}<lastmod>${dateStr}</lastmod>`
								);
							} catch {
								// ignore per-entry failures
							}
						}
						writeFileSync(sitemapPath, xml);
					}
				} catch {
					// ignore
				}
			},
		},
	};
}

// https://astro.build/config
export default defineConfig({
	site: process.env.PUBLIC_SITE_URL ?? 'https://winnerit.in.th',
	integrations: [
		sitemap({
			serialize(item) {
				if (!item.lastmod) {
					item.lastmod = new Date().toISOString();
				}
				return item;
			},
		}),
		sitemapLastmodPlugin(),
	],
});
