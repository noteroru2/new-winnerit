import rss from '@astrojs/rss';
import he from 'he';
import { parse } from 'node-html-parser';
import { getEditorialPosts } from '../lib/wp';
import { postPublicPath } from '../lib/postPaths';

function stripHtml(html) {
	return parse(html).text.replace(/\s+/g, ' ').trim();
}

const RSS_LIMIT = 50;

export async function GET(context) {
	const posts = (await getEditorialPosts()).slice(0, RSS_LIMIT);

	const siteBase = context.site
		? typeof context.site === 'string'
			? context.site.replace(/\/$/, '')
			: context.site.href.replace(/\/$/, '')
		: 'https://winnerit.in.th';

	return rss({
		title: 'Winner IT — บทความ',
		description: 'บทความเกี่ยวกับการรับซื้ออุปกรณ์ IT มือสอง จาก Winner IT',
		site: context.site,
		items: posts.map((post) => ({
			link: `${siteBase}${postPublicPath(post)}`,
			title: he.decode(post.title.rendered),
			pubDate: new Date(post.date),
			description: stripHtml(post.excerpt.rendered).slice(0, 300),
		})),
	});
}
