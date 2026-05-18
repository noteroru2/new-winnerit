/** Minimal frontmatter parser (no Node.js fs — safe for Cloudflare prerender). */

function unquote(value: string): string {
	const v = value.trim();
	if (
		(v.startsWith('"') && v.endsWith('"')) ||
		(v.startsWith("'") && v.endsWith("'"))
	) {
		return v
			.slice(1, -1)
			.replace(/\\"/g, '"')
			.replace(/\\'/g, "'")
			.replace(/\\\\/g, '\\');
	}
	return v;
}

function parseScalar(value: string): unknown {
	const v = value.trim();
	if (!v) return '';
	if (v.startsWith('[')) {
		const inner = v.slice(1, -1).trim();
		if (!inner) return [];
		return inner.split(',').map((part) => {
			const item = part.trim();
			const n = Number(item);
			return Number.isFinite(n) && String(n) === item ? n : unquote(item);
		});
	}
	if (v === 'true') return true;
	if (v === 'false') return false;
	if (/^-?\d+$/.test(v)) return Number(v);
	return unquote(v);
}

export function parseFrontmatter(source: string): {
	data: Record<string, unknown>;
	content: string;
} {
	if (!source.startsWith('---')) {
		return { data: {}, content: source };
	}

	const end = source.indexOf('\n---', 3);
	if (end === -1) {
		return { data: {}, content: source };
	}

	const fm = source.slice(4, end);
	let content = source.slice(end + 4);
	if (content.startsWith('\n')) content = content.slice(1);

	const data: Record<string, unknown> = {};
	for (const line of fm.split(/\r?\n/)) {
		const colon = line.indexOf(':');
		if (colon <= 0) continue;
		const key = line.slice(0, colon).trim();
		const value = line.slice(colon + 1).trim();
		if (key) data[key] = parseScalar(value);
	}

	return { data, content };
}
