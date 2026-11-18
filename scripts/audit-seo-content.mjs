import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import matter from 'gray-matter';

const postsDir = join(process.cwd(), 'content', 'posts');
const files = readdirSync(postsDir).filter((file) => file.endsWith('.md'));
const posts = files.map((file) => {
	const { data, content } = matter(readFileSync(join(postsDir, file), 'utf8'));
	const plain = content.replace(/<[^>]+>/g, ' ').replace(/[#*_`>\[\]()!-]/g, ' ').replace(/\s+/g, ' ').trim();
	return {
		file,
		slug: String(data.slug ?? ''),
		title: String(data.title ?? '').trim(),
		date: String(data.date ?? '').slice(0, 10),
		modified: String(data.modified ?? '').slice(0, 10),
		words: plain ? plain.split(/\s+/).length : 0,
		indexable: data.seo_index === true,
	};
});

const groupBy = (key) => {
	const groups = new Map();
	for (const post of posts) {
		const value = post[key];
		if (!value) continue;
		groups.set(value, [...(groups.get(value) ?? []), post]);
	}
	return [...groups.entries()].filter(([, group]) => group.length > 1).sort((a, b) => b[1].length - a[1].length);
};

const dates = groupBy('date').slice(0, 15).map(([date, group]) => ({ date, posts: group.length }));
const duplicateTitles = groupBy('title').slice(0, 50).map(([title, group]) => ({ title, count: group.length, files: group.map((post) => post.file) }));
const thin = posts.filter((post) => post.words < 250).sort((a, b) => a.words - b.words);
const missingModified = posts.filter((post) => !post.modified);
const noindex = posts.filter((post) => !post.indexable);

console.log(JSON.stringify({
	generatedAt: new Date().toISOString(),
	summary: {
		totalPosts: posts.length,
		indexablePosts: posts.length - noindex.length,
		noindexPosts: noindex.length,
		thinPostsUnder250Words: thin.length,
		duplicateTitleGroups: duplicateTitles.length,
		missingModified: missingModified.length,
	},
	publicationBursts: dates,
	duplicateTitles,
	thinPosts: thin.slice(0, 100),
	nextStep: 'Bulk posts are quarantined by default. Export GSC clicks, impressions, queries and backlinks; merge or improve pages with demand, then set seo_index: true only after editorial review.',
}, null, 2));
