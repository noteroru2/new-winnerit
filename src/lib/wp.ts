import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import matter from 'gray-matter';
import type { WPCategory, WPMedia, WPPost } from './wp-types';

export type { WPCategory, WPMedia, WPPost } from './wp-types';

const root = process.cwd();
const postsDir = join(root, 'content', 'posts');
const dataDir = join(root, 'data', 'wp');

let _postsCache: WPPost[] | null = null;
let _categoriesCache: WPCategory[] | null = null;
/** @type {Record<string, WPMedia> | null} */
let _mediaManifest: Record<string, WPMedia> | null = null;

function loadMediaManifest(): Record<string, WPMedia> {
	if (_mediaManifest) return _mediaManifest;
	const path = join(dataDir, 'media.json');
	if (!existsSync(path)) {
		_mediaManifest = {};
		return _mediaManifest;
	}
	const raw = JSON.parse(readFileSync(path, 'utf-8')) as Record<string, WPMedia>;
	_mediaManifest = raw;
	return raw;
}

function postFromFile(filePath: string): WPPost | null {
	const raw = readFileSync(filePath, 'utf-8');
	const { data, content } = matter(raw);
	if (!data?.id || !data?.slug) return null;

	const title = String(data.title ?? '');
	const excerpt = String(data.excerpt ?? '');

	return {
		id: Number(data.id),
		slug: String(data.slug),
		date: String(data.date ?? ''),
		modified: String(data.modified ?? data.date ?? ''),
		link: String(data.link ?? ''),
		title: { rendered: title },
		excerpt: { rendered: excerpt, protected: false },
		content: { markdown: content.trim(), protected: false },
		featured_media: data.featured_media ? Number(data.featured_media) : undefined,
		categories: Array.isArray(data.categories) ? data.categories.map(Number) : [],
	};
}

export async function getAllPosts(): Promise<WPPost[]> {
	if (_postsCache) return _postsCache;
	if (!existsSync(postsDir)) {
		throw new Error('No local content found in content/posts/.');
	}

	const files = readdirSync(postsDir).filter((f) => f.endsWith('.md'));
	const posts: WPPost[] = [];
	for (const file of files) {
		const post = postFromFile(join(postsDir, file));
		if (post) posts.push(post);
	}

	_postsCache = posts;
	return posts;
}

export async function getPostBySlug(slug: string): Promise<WPPost | null> {
	const posts = await getAllPosts();
	return posts.find((p) => p.slug === slug) ?? null;
}

const mediaCache = new Map<number, WPMedia | null>();

export async function getMediaById(id: number): Promise<WPMedia | null> {
	if (mediaCache.has(id)) return mediaCache.get(id) ?? null;

	const manifest = loadMediaManifest();
	const entry = manifest[String(id)];
	if (!entry) {
		mediaCache.set(id, null);
		return null;
	}

	const media: WPMedia = {
		id: entry.id ?? id,
		source_url: entry.local_url ?? entry.source_url ?? '',
		alt_text: entry.alt_text,
		title: entry.title ? { rendered: String(entry.title) } : undefined,
		local_url: entry.local_url,
		media_details: {
			width: entry.width ?? undefined,
			height: entry.height ?? undefined,
		},
	};
	mediaCache.set(id, media);
	return media;
}

export function pickMediaUrl(
	media: WPMedia,
	_preferred: string[] = ['large', 'medium_large', 'medium', 'thumbnail']
) {
	if (media.local_url) return media.local_url;
	return media.source_url;
}

export function buildMediaSrcset(
	media: WPMedia,
	_preferred: string[] = ['thumbnail', 'medium', 'medium_large', 'large']
) {
	const url = pickMediaUrl(media);
	const w = media.media_details?.width;
	if (!url || !w) return '';
	return `${url} ${w}w`;
}

const categoryCache = new Map<number, WPCategory | null>();

export async function getCategoryById(id: number): Promise<WPCategory | null> {
	if (categoryCache.has(id)) return categoryCache.get(id) ?? null;
	const cats = await getAllCategories();
	const cat = cats.find((c) => c.id === id) ?? null;
	categoryCache.set(id, cat);
	return cat;
}

export async function getCategoriesByIds(ids: number[]): Promise<WPCategory[]> {
	const unique = [...new Set(ids)].filter((n) => Number.isFinite(n) && n > 0);
	const cats = await Promise.all(unique.map((id) => getCategoryById(id)));
	return cats.filter((c): c is WPCategory => Boolean(c));
}

export async function getAllCategories(): Promise<WPCategory[]> {
	if (_categoriesCache) return _categoriesCache;

	const path = join(dataDir, 'categories.json');
	if (!existsSync(path)) {
		throw new Error('Missing data/wp/categories.json');
	}

	_categoriesCache = JSON.parse(readFileSync(path, 'utf-8')) as WPCategory[];
	return _categoriesCache;
}

export function decodeSlug(slug: string): string {
	try {
		return decodeURIComponent(slug);
	} catch {
		return slug;
	}
}
