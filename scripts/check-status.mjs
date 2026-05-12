#!/usr/bin/env node
/**
 * Fetch URLs and report HTTP status (and Location for redirects).
 * Usage:
 *   node scripts/check-status.mjs
 *   node scripts/check-status.mjs --sitemap https://winnerit.in.th/sitemap-0.xml
 *   node scripts/check-status.mjs --urls "https://a.com/x,https://a.com/y"
 * Env:
 *   CHECK_SITE=https://winnerit.in.th  (default)
 *   CHECK_URLS=comma-separated absolute URLs (optional; skips sitemap when set)
 */
import { readFileSync, existsSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

function parseArgs(argv) {
	const out = { sitemap: '', urls: '' };
	for (let i = 2; i < argv.length; i++) {
		const a = argv[i];
		if (a === '--sitemap' && argv[i + 1]) {
			out.sitemap = argv[++i];
		} else if (a === '--urls' && argv[i + 1]) {
			out.urls = argv[++i];
		}
	}
	return out;
}

function extractLocs(xml) {
	const locs = [];
	const re = /<loc>\s*([^<\s]+)\s*<\/loc>/g;
	let m;
	while ((m = re.exec(xml)) !== null) {
		locs.push(m[1].trim());
	}
	return locs;
}

async function fetchText(url) {
	const res = await fetch(url, {
		headers: { Accept: 'application/xml,text/xml,*/*' },
		redirect: 'follow',
	});
	if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);
	return await res.text();
}

async function checkOne(url) {
	try {
		const res = await fetch(url, { method: 'HEAD', redirect: 'manual' });
		let status = res.status;
		let loc = res.headers.get('location') || '';
		if (status === 405 || status === 501) {
			const r2 = await fetch(url, { method: 'GET', redirect: 'manual', headers: { Range: 'bytes=0-0' } });
			status = r2.status;
			loc = r2.headers.get('location') || '';
		}
		return { url, status, loc };
	} catch (e) {
		return { url, status: 'ERR', loc: String(e?.message ?? e) };
	}
}

const defaultSite = (process.env.CHECK_SITE ?? 'https://winnerit.in.th').replace(/\/$/, '');
const args = parseArgs(process.argv);

let urls = [];

if (process.env.CHECK_URLS?.trim()) {
	urls = process.env.CHECK_URLS.split(',').map((s) => s.trim()).filter(Boolean);
} else if (args.urls) {
	urls = args.urls.split(',').map((s) => s.trim()).filter(Boolean);
}

if (!urls.length) {
	const localFirst = join(root, 'dist', 'sitemap-0.xml');
	const localIndex = join(root, 'dist', 'sitemap-index.xml');

	if (args.sitemap) {
		const xml = args.sitemap.startsWith('http') ? await fetchText(args.sitemap) : readFileSync(args.sitemap, 'utf-8');
		urls = extractLocs(xml);
		console.log(`check-status: sitemap ${args.sitemap} (${urls.length} URLs)\n`);
	} else if (existsSync(localFirst)) {
		const xml = readFileSync(localFirst, 'utf-8');
		urls = extractLocs(xml);
		console.log(`check-status: using local dist/sitemap-0.xml (${urls.length} URLs)\n`);
	} else if (existsSync(localIndex)) {
		const idx = readFileSync(localIndex, 'utf-8');
		const submaps = extractLocs(idx);
		for (const smUrl of submaps) {
			let body;
			if (smUrl.startsWith('http')) {
				body = await fetchText(smUrl);
			} else {
				const name = basename(new URL(smUrl, 'https://x/').pathname);
				const p = join(root, 'dist', name || 'sitemap-0.xml');
				body = readFileSync(p, 'utf-8');
			}
			urls.push(...extractLocs(body));
		}
		console.log(`check-status: using local sitemap index (${urls.length} URLs)\n`);
	} else {
		const indexUrl = `${defaultSite}/sitemap-index.xml`;
		console.log(`check-status: fetching ${indexUrl}\n`);
		const idxXml = await fetchText(indexUrl);
		const submaps = extractLocs(idxXml);
		for (const u of submaps) {
			const body = await fetchText(u);
			urls.push(...extractLocs(body));
		}
	}
}

const extra = [
	`${defaultSite}/services/buy-macbook-m1`,
	`${defaultSite}/services/sell-used-notebook-phuket`,
	`${defaultSite}/services-buy-macbook-m1`,
	`${defaultSite}/services-sell-used-notebook-phuket`,
];
for (const u of extra) {
	if (!urls.includes(u)) urls.push(u);
}

const results = [];
for (const u of urls) {
	results.push(await checkOne(u));
	await new Promise((r) => setTimeout(r, 80));
}

const by = { ok: [], redirect: [], clientErr: [], serverErr: [], other: [] };
for (const r of results) {
	const n = Number(r.status);
	if (n === 200) by.ok.push(r);
	else if (n >= 300 && n < 400) by.redirect.push(r);
	else if (n >= 400 && n < 500) by.clientErr.push(r);
	else if (n >= 500) by.serverErr.push(r);
	else by.other.push(r);
}

function printGroup(title, arr) {
	if (!arr.length) return;
	console.log(`\n${title} (${arr.length})`);
	for (const r of arr) {
		const loc = r.loc ? ` → ${r.loc}` : '';
		console.log(`  ${r.status}  ${r.url}${loc}`);
	}
}

console.log('--- HTTP status report ---');
printGroup('200 OK', by.ok);
printGroup('3xx redirect', by.redirect);
printGroup('4xx', by.clientErr);
printGroup('5xx', by.serverErr);
printGroup('Other / errors', by.other);

const bad = by.clientErr.length + by.serverErr.length + by.other.length;
process.exitCode = bad > 0 ? 1 : 0;
