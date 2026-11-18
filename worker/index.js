const CANONICAL_HOST = 'winnerit.in.th';

const LEGACY_PATHS = new Map([
	['/buy-laptop', '/รับซื้อโน๊ตบุ๊ค/'],
	['/buy-computer', '/รับซื้อคอมพิวเตอร์/'],
	['/buy-macbook', '/รับซื้อmacbook/'],
	['/buy-iphone', '/รับซื้อiphone/'],
	['/buy-ipad', '/รับซื้อipad/'],
	['/buy-camera', '/รับซื้อกล้อง/'],
	['/buy-phone', '/รับซื้อมือถือ/'],
]);

function canonicalPath(pathname) {
	const trimmed = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
	if (LEGACY_PATHS.has(trimmed)) return LEGACY_PATHS.get(trimmed);
	const flatLegacy = trimmed.match(/^\/(services|locations|prices)-(.+)$/);
	if (flatLegacy) return `/${flatLegacy[1]}/${flatLegacy[2]}/`;
	const finalSegment = trimmed.split('/').pop() ?? '';
	const isFile = finalSegment.includes('.') || trimmed.startsWith('/.well-known/');
	if (trimmed !== '/' && !isFile) return `${trimmed}/`;
	return trimmed || '/';
}

export default {
	async fetch(request, env) {
		const incoming = new URL(request.url);
		const target = new URL(incoming);
		target.protocol = 'https:';
		target.hostname = CANONICAL_HOST;
		target.port = '';
		target.pathname = canonicalPath(incoming.pathname);
		if (target.toString() !== incoming.toString()) return Response.redirect(target.toString(), 308);
		const response = await env.ASSETS.fetch(request);
		const headers = new Headers(response.headers);
		headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
		headers.set('X-Content-Type-Options', 'nosniff');
		return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
	},
};
