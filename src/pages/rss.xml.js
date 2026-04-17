import rss from '@astrojs/rss';
import he from 'he';
import { parse } from 'node-html-parser';
import { getAllPosts, decodeSlug } from '../lib/wp';

function stripHtml(html) {
	return parse(html).text.replace(/\s+/g, ' ').trim();
}

const RSS_LIMIT = 50;

export async function GET(context) {
	const posts = (await getAllPosts())
		.sort((a, b) => (a.date < b.date ? 1 : -1))
		.slice(0, RSS_LIMIT);

	return rss({
		title: 'Winner IT — บทความ',
		description: 'บทความเกี่ยวกับการรับซื้ออุปกรณ์ IT มือสอง จาก Winner IT',
		site: context.site,
		items: posts.map((post) => ({
			link: `/${decodeSlug(post.slug)}`,
			title: he.decode(post.title.rendered),
			pubDate: new Date(post.date),
			description: stripHtml(post.excerpt.rendered).slice(0, 300),
		})),
	});
}
