import matter from 'gray-matter';
import categoriesJson from '../../data/wp/categories.json';
import mediaJson from '../../data/wp/media.json';
import type { WPCategory, WPMedia, WPPost } from './wp-types';

export type { WPCategory, WPMedia, WPPost } from './wp-types';

const postModules = import.meta.glob('/content/posts/*.md', {
	eager: true,
	query: '?raw',
	import: 'default',
}) as Record<string, string>;

const mediaManifest = mediaJson as Record<string, WPMedia>;
const categoriesData = categoriesJson as WPCategory[];

let _postsCache: WPPost[] | null = null;

function postFromRaw(raw: string): WPPost | null {
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

	const posts: WPPost[] = [];
	for (const raw of Object.values(postModules)) {
		const post = postFromRaw(raw);
		if (post) posts.push(post);
	}

	if (!posts.length) {
		throw new Error('No local content found in content/posts/.');
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

	const entry = mediaManifest[String(id)];
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
	return categoriesData;
}

export function decodeSlug(slug: string): string {
	try {
		return decodeURIComponent(slug);
	} catch {
		return slug;
	}
}
