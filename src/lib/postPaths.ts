import { decodeSlug, type WPPost } from './wp';

const PREFIX_RE = /^(services|locations|prices)-(.+)$/;

export type PrefixedSegment = 'services' | 'locations' | 'prices';

export function parsePrefixedWpSlug(rawSlug: string): { segment: PrefixedSegment; rest: string } | null {
	const slug = decodeSlug(rawSlug);
	const m = slug.match(PREFIX_RE);
	if (!m) return null;
	const segment = m[1] as PrefixedSegment;
	const rest = m[2] ?? '';
	if (!rest) return null;
	return { segment, rest };
}

/** Canonical on-site path for a post (e.g. /services/buy-macbook-m1). */
export function postPublicPath(post: WPPost): string {
	const p = parsePrefixedWpSlug(post.slug);
	if (p) return `/${p.segment}/${p.rest}`;
	return `/${decodeSlug(post.slug)}`;
}
