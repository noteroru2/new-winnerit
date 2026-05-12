#!/usr/bin/env node
/**
 * Fetches WordPress post slugs and writes 301 rules to public/_redirects
 * for legacy flat paths (/services-foo → /services/foo).
 * Regenerates the block between # BEGIN_AUTO_PREFIX_REDIRECTS / # END_AUTO_PREFIX_REDIRECTS.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const redirectsPath = join(root, 'public', '_redirects');

const WP_BASE = process.env.WP_BASE_URL ?? 'https://wp.winnerit.in.th';
const PREFIX_RE = /^(services|locations|prices)-(.+)$/;

function decodeSlug(slug) {
	try {
		return decodeURIComponent(slug);
	} catch {
		return slug;
	}
}

async function fetchAllPosts() {
	const perPage = 100;
	let page = 1;
	const all = [];
	for (;;) {
		const url = new URL('/wp-json/wp/v2/posts', WP_BASE);
		url.searchParams.set('per_page', String(perPage));
		url.searchParams.set('page', String(page));
		url.searchParams.set('_fields', 'slug');

		const res = await fetch(url);
		if (!res.ok) {
			if (res.status === 400 || res.status === 404) break;
			throw new Error(`WP API error ${res.status} for posts page ${page}`);
		}
		const posts = await res.json();
		if (!posts.length) break;
		all.push(...posts);
		if (posts.length < perPage) break;
		page += 1;
	}
	return all;
}

function buildRedirectLines(posts) {
	const lines = [];
	const seen = new Set();
	for (const post of posts) {
		const raw = post.slug;
		if (!raw) continue;
		const slug = decodeSlug(raw);
		const m = slug.match(PREFIX_RE);
		if (!m) continue;
		const [, seg, rest] = m;
		const from = `/${slug}`;
		const to = `/${seg}/${rest}`;
		if (seen.has(from)) continue;
		seen.add(from);
		// Netlify _redirects: multiple spaces separate from/to/status
		lines.push(`${from}  ${to}  301`);
	}
	lines.sort();
	return lines;
}

const BEGIN = '# BEGIN_AUTO_PREFIX_REDIRECTS';
const END = '# END_AUTO_PREFIX_REDIRECTS';

function injectGenerated(src, generatedLines) {
	const block = [BEGIN, ...generatedLines, END].join('\n');
	if (!src.includes(BEGIN) || !src.includes(END)) {
		return `${src.trimEnd()}\n\n${block}\n`;
	}
	const re = new RegExp(`${BEGIN}[\\s\\S]*?${END}`, 'm');
	if (!re.test(src)) throw new Error('Redirect marker block malformed in public/_redirects');
	return src.replace(re, block);
}

const posts = await fetchAllPosts();
const lines = buildRedirectLines(posts);
const before = readFileSync(redirectsPath, 'utf-8');
const after = injectGenerated(before, lines);
writeFileSync(redirectsPath, after);
console.log(`write-redirects: wrote ${lines.length} prefix redirect rules to public/_redirects`);
