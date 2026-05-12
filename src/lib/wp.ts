export type WPPost = {
	id: number;
	slug: string;
	date: string;
	modified: string;
	link: string;
	title: { rendered: string };
	excerpt: { rendered: string; protected: boolean };
	content: { rendered: string; protected: boolean };
	featured_media?: number;
	categories?: number[];
};

export type WPMedia = {
	id: number;
	source_url: string;
	alt_text?: string;
	title?: { rendered: string };
	media_details?: {
		width?: number;
		height?: number;
		sizes?: Record<
			string,
			{
				source_url?: string;
				width?: number;
				height?: number;
			}
		>;
	};
};

export type WPCategory = {
	id: number;
	name: string;
	slug: string;
	count?: number;
};

const env = (import.meta.env ?? {}) as any;
export const WP_BASE = String(env.WP_BASE_URL ?? 'https://wp.winnerit.in.th');

function envNumber(key: string, fallback: number) {
	const raw = env?.[key];
	const n = typeof raw === 'string' || typeof raw === 'number' ? Number(raw) : NaN;
	return Number.isFinite(n) && n >= 0 ? n : fallback;
}

const WP_FETCH_TIMEOUT_MS = envNumber('WP_FETCH_TIMEOUT_MS', 30_000);
const WP_FETCH_RETRIES = envNumber('WP_FETCH_RETRIES', 3);
const WP_FETCH_RETRY_DELAY_MS = envNumber('WP_FETCH_RETRY_DELAY_MS', 750);

function wpUrl(path: string) {
	return new URL(path, WP_BASE).toString();
}

function sleep(ms: number) {
	return new Promise((r) => setTimeout(r, ms));
}

async function fetchWithRetry(url: string, init?: RequestInit) {
	let lastErr: unknown = null;

	for (let attempt = 0; attempt <= WP_FETCH_RETRIES; attempt++) {
		try {
			const timeoutMs = envNumber('WP_FETCH_TIMEOUT_MS', WP_FETCH_TIMEOUT_MS);
			const controller = new AbortController();
			const timer = setTimeout(() => controller.abort(), timeoutMs);

			try {
				return await fetch(url, {
					...init,
					signal: controller.signal,
				});
			} finally {
				clearTimeout(timer);
			}
		} catch (err) {
			lastErr = err;
			if (attempt >= WP_FETCH_RETRIES) break;

			// Basic exponential backoff with a small base delay.
			const delay = WP_FETCH_RETRY_DELAY_MS * Math.pow(2, attempt);
			await sleep(delay);
		}
	}

	throw lastErr instanceof Error ? lastErr : new Error(`WP fetch failed for ${url}`);
}

async function wpFetch<T>(path: string, init?: RequestInit): Promise<T> {
	const res = await fetchWithRetry(wpUrl(path), {
		...init,
		headers: {
			Accept: 'application/json',
			...(init?.headers ?? {}),
		},
	});
	if (!res.ok) {
		throw new Error(`WP API error ${res.status} for ${path}`);
	}
	return (await res.json()) as T;
}

let _postsCache: WPPost[] | null = null;

export async function getAllPosts(): Promise<WPPost[]> {
	if (_postsCache) return _postsCache;

	const perPage = 100;
	let page = 1;
	const all: WPPost[] = [];

	for (;;) {
		const res = await fetchWithRetry(
			wpUrl(
				`/wp-json/wp/v2/posts?per_page=${perPage}&page=${page}&_fields=id,slug,date,modified,link,title,excerpt,content,featured_media,categories`
			),
			{ headers: { Accept: 'application/json' } }
		);

		if (!res.ok) {
			// If WordPress returns an error for a page beyond the last one, stop.
			if (res.status === 400 || res.status === 404) break;
			throw new Error(`WP API error ${res.status} for posts page ${page}`);
		}

		const posts = (await res.json()) as WPPost[];
		if (!posts.length) break;
		all.push(...posts);
		if (posts.length < perPage) break;
		page += 1;
	}

	_postsCache = all;
	return all;
}

export async function getPostBySlug(slug: string): Promise<WPPost | null> {
	const posts = await wpFetch<WPPost[]>(
		`/wp-json/wp/v2/posts?slug=${encodeURIComponent(slug)}&_fields=id,slug,date,modified,link,title,excerpt,content,featured_media,categories`
	);
	return posts[0] ?? null;
}

const mediaCache = new Map<number, WPMedia | null>();

export async function getMediaById(id: number): Promise<WPMedia | null> {
	if (mediaCache.has(id)) return mediaCache.get(id) ?? null;
	try {
		const media = await wpFetch<WPMedia>(
			`/wp-json/wp/v2/media/${id}?_fields=id,source_url,alt_text,title,media_details`
		);
		mediaCache.set(id, media);
		return media;
	} catch {
		mediaCache.set(id, null);
		return null;
	}
}

export function pickMediaUrl(media: WPMedia, preferred: string[] = ['large', 'medium_large', 'medium', 'thumbnail']) {
	const sizes = media.media_details?.sizes ?? {};
	for (const key of preferred) {
		const url = sizes[key]?.source_url;
		if (url) return url;
	}
	return media.source_url;
}

export function buildMediaSrcset(media: WPMedia, preferred: string[] = ['thumbnail', 'medium', 'medium_large', 'large']) {
	const sizes = media.media_details?.sizes ?? {};
	const parts: string[] = [];
	for (const key of preferred) {
		const s = sizes[key];
		if (!s?.source_url || !s?.width) continue;
		parts.push(`${s.source_url} ${s.width}w`);
	}
	return parts.length ? parts.join(', ') : '';
}

const categoryCache = new Map<number, WPCategory | null>();

export async function getCategoryById(id: number): Promise<WPCategory | null> {
	if (categoryCache.has(id)) return categoryCache.get(id) ?? null;
	try {
		const cat = await wpFetch<WPCategory>(`/wp-json/wp/v2/categories/${id}?_fields=id,name,slug,count`);
		categoryCache.set(id, cat);
		return cat;
	} catch {
		categoryCache.set(id, null);
		return null;
	}
}

export async function getCategoriesByIds(ids: number[]): Promise<WPCategory[]> {
	const unique = [...new Set(ids)].filter((n) => Number.isFinite(n) && n > 0);
	const cats = await Promise.all(unique.map((id) => getCategoryById(id)));
	return cats.filter((c): c is WPCategory => Boolean(c));
}

let _allCategoriesCache: WPCategory[] | null = null;

export async function getAllCategories(): Promise<WPCategory[]> {
	if (_allCategoriesCache) return _allCategoriesCache;

	const perPage = 100;
	let page = 1;
	const all: WPCategory[] = [];

	for (;;) {
		const cats = await wpFetch<WPCategory[]>(
			`/wp-json/wp/v2/categories?per_page=${perPage}&page=${page}&_fields=id,name,slug,count`
		);
		if (!cats.length) break;
		all.push(...cats);
		if (cats.length < perPage) break;
		page += 1;
	}

	_allCategoriesCache = all.filter((c) => c.slug !== 'uncategorized' && (c.count ?? 0) > 0);
	return _allCategoriesCache;
}

export function decodeSlug(slug: string): string {
	try {
		return decodeURIComponent(slug);
	} catch {
		return slug;
	}
}
