// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import matter from 'gray-matter';

const PREFIX_RE = /^(services|locations|prices)-(.+)$/;

/** @param {string} siteUrl */
function buildPostSeoData(siteUrl) {
	/** @type {Record<string, string>} */
	const lastmod = {};
	/** @type {Set<string>} */
	const noindex = new Set();
	const postsDir = join(process.cwd(), 'content', 'posts');
	if (!existsSync(postsDir)) return { lastmod, noindex };

	const base = siteUrl.replace(/\/$/, '');
	for (const file of readdirSync(postsDir)) {
		if (!file.endsWith('.md')) continue;
		try {
			const { data } = matter(readFileSync(join(postsDir, file), 'utf-8'));
			if (!data?.slug) continue;
			let slug = String(data.slug);
			try {
				slug = decodeURIComponent(slug);
			} catch {
				// Keep malformed legacy slugs unchanged.
			}
			const m = slug.match(PREFIX_RE);
			const path = m ? `/${m[1]}/${m[2]}` : `/${slug}`;
			const url = new URL(`${path}/`, `${base}/`).toString();
			// Imported bulk content is quarantined by default. A reviewed page must
			// explicitly opt in with `seo_index: true` before entering the sitemap.
			if (data.seo_index !== true) noindex.add(url);
			if (data.modified) lastmod[url] = String(data.modified);
		} catch {
			// ignore per-file failures
		}
	}
	return { lastmod, noindex };
}

const siteUrl = process.env.PUBLIC_SITE_URL ?? 'https://winnerit.in.th';
const postSeo = buildPostSeoData(siteUrl);
const corePages = new Set([
	'/', '/about', '/articles', '/contact', '/privacy', '/รับซื้อโน๊ตบุ๊ค', '/รับซื้อคอมพิวเตอร์',
	'/รับซื้อมือถือ', '/รับซื้อmacbook', '/รับซื้อiphone', '/รับซื้อipad', '/รับซื้อกล้อง',
]);
const normalizeUrl = (page) => {
	const url = new URL(page, siteUrl);
	if (url.pathname !== '/' && !url.pathname.endsWith('/')) url.pathname += '/';
	return url.toString();
};

// https://astro.build/config
export default defineConfig({
	output: 'static',
	site: siteUrl,
	integrations: [
		sitemap({
			filter: (page) => {
				let path = page.startsWith('http') ? new URL(page).pathname : page;
				try {
					path = decodeURI(path);
				} catch {
					// Keep malformed legacy paths unchanged.
				}
				const normalized = path.replace(/\/$/, '') || '/';
				if (corePages.has(normalized)) return true;
				if (/^\/(services|locations|prices)-[^/]+$/.test(normalized)) return false;
				if (/^\/articles\/page\/\d+$/.test(normalized)) return false;
				if (/^\/category\//.test(normalized)) return false;
				return !postSeo.noindex.has(normalizeUrl(page));
			},
			serialize(item) {
				const normalizedUrl = normalizeUrl(item.url);
				const modified = postSeo.lastmod[normalizedUrl];
				if (modified && !postSeo.noindex.has(normalizedUrl)) {
					const date = new Date(modified);
					if (!Number.isNaN(date.getTime())) item.lastmod = date.toISOString();
				}
				return item;
			},
		}),
	],
});
