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
};

export type WPCategory = {
	id: number;
	name: string;
	slug: string;
	count?: number;
};

const env = (import.meta.env ?? {}) as any;
export const WP_BASE = String(env.WP_BASE_URL ?? 'https://wp.winnerit.in.th');

function wpUrl(path: string) {
	return new URL(path, WP_BASE).toString();
}

async function wpFetch<T>(path: string, init?: RequestInit): Promise<T> {
	const res = await fetch(wpUrl(path), {
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
		const res = await fetch(wpUrl(`/wp-json/wp/v2/posts?per_page=${perPage}&page=${page}&_fields=id,slug,date,modified,link,title,excerpt,content,featured_media,categories`), {
			headers: { Accept: 'application/json' },
		});

		if (!res.ok) break;

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
		const media = await wpFetch<WPMedia>(`/wp-json/wp/v2/media/${id}?_fields=id,source_url,alt_text,title`);
		mediaCache.set(id, media);
		return media;
	} catch {
		mediaCache.set(id, null);
		return null;
	}
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
