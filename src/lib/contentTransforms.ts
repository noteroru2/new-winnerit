import { parse } from 'node-html-parser';
import he from 'he';
import keywordLinks from '../config/keyword-links.json';
import { getMediaById, WP_BASE } from './wp';

type KeywordMap = Record<string, string>;

function escapeRegExp(s: string) {
	return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function stripHtmlToText(html: string) {
	const root = parse(html);
	return root.text.trim().replace(/\s+/g, ' ');
}

function firstSentence(text: string) {
	// Keep it simple: split by Thai/English sentence terminators.
	const parts = text
		.split(/(?<=[\.\!\?\u0E2F\u0964\u0965])\s+/)
		.map((s) => s.trim())
		.filter(Boolean);
	return parts[0] ?? '';
}

function titleCaseFromFilename(name: string) {
	const base = name
		.replace(/\.[a-z0-9]+$/i, '')
		.replace(/[-_]+/g, ' ')
		.replace(/\s+/g, ' ')
		.trim();
	if (!base) return '';
	return base.charAt(0).toUpperCase() + base.slice(1);
}

function getFilenameFromUrl(url: string) {
	try {
		const u = new URL(url);
		const last = u.pathname.split('/').pop() ?? '';
		return decodeURIComponent(last);
	} catch {
		const last = url.split('/').pop() ?? '';
		return last;
	}
}

function getMediaIdFromImgClass(classAttr: string | undefined) {
	if (!classAttr) return null;
	// Common WP pattern: class="... wp-image-123 ..."
	const m = classAttr.match(/\bwp-image-(\d+)\b/);
	return m ? Number(m[1]) : null;
}

function isInsideLink(node: any) {
	let cur = node;
	while (cur) {
		if (cur.tagName && String(cur.tagName).toLowerCase() === 'a') return true;
		cur = cur.parentNode;
	}
	return false;
}

function normalizeWpAssetUrl(raw: string) {
	const s = String(raw ?? '').trim();
	if (!s) return s;

	// Keep non-network schemes as-is
	if (s.startsWith('data:') || s.startsWith('blob:') || s.startsWith('mailto:') || s.startsWith('tel:')) return s;

	// Protocol-relative URLs: //example.com/img.jpg
	if (s.startsWith('//')) return `https:${s}`;

	// Already absolute
	if (/^https?:\/\//i.test(s)) return s;

	// Common WP relative paths
	if (s.startsWith('/')) return new URL(s, WP_BASE).toString();

	// Some editors output "wp-content/..." without a leading slash
	if (s.startsWith('wp-content/') || s.startsWith('./wp-content/')) return new URL(`/${s.replace(/^\.\//, '')}`, WP_BASE).toString();

	return s;
}

function normalizeSrcset(raw: string) {
	const s = String(raw ?? '').trim();
	if (!s) return s;

	// srcset format: "url1 300w, url2 1024w"
	return s
		.split(',')
		.map((part) => part.trim())
		.filter(Boolean)
		.map((part) => {
			const pieces = part.split(/\s+/);
			const url = pieces[0] ?? '';
			const rest = pieces.slice(1).join(' ');
			const norm = normalizeWpAssetUrl(url);
			return rest ? `${norm} ${rest}` : norm;
		})
		.join(', ');
}

function normalizeWpHtmlAssets(html: string) {
	const root = parse(html, { comment: false });

	// Normalize <img> URLs (src, srcset + common lazy-load attrs)
	for (const img of root.querySelectorAll('img')) {
		for (const attr of ['src', 'data-src', 'data-lazy-src'] as const) {
			const v = img.getAttribute(attr);
			if (v) img.setAttribute(attr, normalizeWpAssetUrl(v));
		}

		const srcset = img.getAttribute('srcset');
		if (srcset) img.setAttribute('srcset', normalizeSrcset(srcset));

		const dataSrcset = img.getAttribute('data-srcset');
		if (dataSrcset) img.setAttribute('data-srcset', normalizeSrcset(dataSrcset));
	}

	// Normalize <a href> that points to WP media/attachments so clicking images works
	for (const a of root.querySelectorAll('a')) {
		const href = a.getAttribute('href');
		if (!href) continue;
		a.setAttribute('href', normalizeWpAssetUrl(href));
	}

	return root.toString();
}

export function autoLinkKeywords(html: string, map: KeywordMap = keywordLinks as KeywordMap) {
	const root = parse(html, { comment: false });

	// Build a single regex from all keywords (longest first to avoid partial overlaps).
	const keywords = Object.keys(map).sort((a, b) => b.length - a.length);
	if (!keywords.length) return html;

	const re = new RegExp(`(${keywords.map(escapeRegExp).join('|')})`, 'g');
	const perKeywordLimit = 2;
	const totalLimit = 20;
	const counts = new Map<string, number>();
	let total = 0;

	root.querySelectorAll('*').forEach((el) => {
		const tag = String(el.tagName || '').toLowerCase();
		if (tag === 'a' || tag === 'script' || tag === 'style') return;

		// Replace only in direct text nodes for safety.
		for (const child of [...el.childNodes]) {
			if (total >= totalLimit) return;
			if (child.nodeType !== 3) continue; // TEXT_NODE
			if (isInsideLink(child)) continue;

			const original = String(child.rawText ?? child.text ?? '');
			if (!re.test(original)) continue;

			// Reset regex state (because we used .test with /g).
			re.lastIndex = 0;

			let replaced = false;
			const parts = original.split(re);
			if (parts.length <= 1) continue;

			const newHtml = parts
				.map((part) => {
					const dest = map[part];
					if (!dest) return he.escape(part);
					if (total >= totalLimit) return he.escape(part);
					const c = counts.get(part) ?? 0;
					if (c >= perKeywordLimit) return he.escape(part);

					counts.set(part, c + 1);
					total += 1;
					replaced = true;

				const isExternal = dest.startsWith('http://') || dest.startsWith('https://');
				const title = `ดูข้อมูลเกี่ยวกับ ${part}`;
				const attrs = isExternal
					? `href="${he.escape(dest)}" target="_blank" rel="noopener noreferrer" title="${he.escape(title)}"`
					: `href="${he.escape(dest)}" rel="noopener" title="${he.escape(title)}"`;
				return `<a ${attrs}>${he.escape(part)}</a>`;
				})
				.join('');

			if (replaced) {
				const wrapper = parse(`<span style="display:contents">${newHtml}</span>`).firstChild;
				el.exchangeChild(child, wrapper);
			}
		}
	});

	return root.toString();
}

export async function autoGenerateImageAlts(html: string, postTitle: string) {
	const root = parse(html, { comment: false });

	const text = stripHtmlToText(html);
	const fallbackSentence = firstSentence(text);

	const imgs = root.querySelectorAll('img');
	for (const img of imgs) {
		const existingAlt = img.getAttribute('alt');
		if (existingAlt && existingAlt.trim().length > 0) continue;

		const classAttr = img.getAttribute('class') ?? undefined;
		const mediaId = getMediaIdFromImgClass(classAttr);

		// (1) Use WP media alt_text if we can resolve an ID.
		if (mediaId) {
			const media = await getMediaById(mediaId);
			const altText = (media?.alt_text ?? '').trim();
			if (altText) {
				img.setAttribute('alt', altText);
				continue;
			}
		}

		// (2) Filename + post title
		const src = img.getAttribute('src') ?? '';
		const filename = getFilenameFromUrl(src);
		const label = titleCaseFromFilename(filename);
		if (label) {
			img.setAttribute('alt', `${label} from post "${he.decode(postTitle)}"`);
			continue;
		}

		// (3) First sentence of content
		if (fallbackSentence) {
			img.setAttribute('alt', fallbackSentence);
			continue;
		}

		// Final fallback
		img.setAttribute('alt', he.decode(postTitle));
	}

	// Also enforce good defaults for performance/UX.
	for (const img of imgs) {
		if (!img.getAttribute('loading')) img.setAttribute('loading', 'lazy');
		if (!img.getAttribute('decoding')) img.setAttribute('decoding', 'async');
	}

	return root.toString();
}

export async function transformPostHtml(html: string, postTitle: string) {
	const normalizedAssets = normalizeWpHtmlAssets(html);
	const withLinks = autoLinkKeywords(normalizedAssets);
	const withAlts = await autoGenerateImageAlts(withLinks, postTitle);
	return withAlts;
}

