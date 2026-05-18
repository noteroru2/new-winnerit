// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import matter from 'gray-matter';

const PREFIX_RE = /^(services|locations|prices)-(.+)$/;

/** @param {string} siteUrl */
function buildLastmodMapFromPosts(siteUrl) {
	/** @type {Record<string, string>} */
	const map = {};
	const postsDir = join(process.cwd(), 'content', 'posts');
	if (!existsSync(postsDir)) return map;

	const base = siteUrl.replace(/\/$/, '');
	for (const file of readdirSync(postsDir)) {
		if (!file.endsWith('.md')) continue;
		try {
			const { data } = matter(readFileSync(join(postsDir, file), 'utf-8'));
			if (!data?.slug || !data?.modified) continue;
			const slug = String(data.slug);
			const m = slug.match(PREFIX_RE);
			const path = m ? `/${m[1]}/${m[2]}` : `/${slug}`;
			map[`${base}${path}`] = String(data.modified);
		} catch {
			// ignore per-file failures
		}
	}
	return map;
}

function sitemapLastmodPlugin() {
	let outDir = '';
	let siteUrl = 'https://winnerit.in.th';
	return {
		name: 'sitemap-lastmod',
		hooks: {
			'astro:config:done'({ config }) {
				outDir = config.outDir?.pathname?.replace(/^\/([A-Z]:)/, '$1') ?? './dist';
				siteUrl = config.site?.toString() ?? siteUrl;
			},
			async 'astro:build:done'() {
				// Never fail the build if sitemap patching fails.
				try {
					const map = buildLastmodMapFromPosts(siteUrl);
					if (!Object.keys(map).length) return;

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
	output: 'static',
	site: process.env.PUBLIC_SITE_URL ?? 'https://winnerit.in.th',
	integrations: [
		sitemap({
			filter: (page) => {
				const path = page.startsWith('http') ? new URL(page).pathname : page;
				const normalized = path.replace(/\/$/, '') || '/';
				return !/^\/(services|locations|prices)-[^/]+$/.test(normalized);
			},
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
