import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'node-html-parser';
import matter from 'gray-matter';

const root = process.cwd();
const dist = join(root, 'dist');
const fail = (message) => { throw new Error('[SEO QA] ' + message); };
const read = (file) => {
  if (!existsSync(file)) fail('Missing build artifact: ' + file);
  return readFileSync(file, 'utf8');
};
const normalize = (path) => {
  let urlPath = path || '/';
  try { urlPath = decodeURIComponent(urlPath); } catch { /* malformed legacy URL */ }
  urlPath = urlPath.replace(/\/+$/, '') || '/';
  return urlPath === '/' ? '/' : urlPath + '/';
};
const localPath = (value) => normalize(new URL(value, 'https://winnerit.in.th').pathname);
const articlePath = (rawSlug) => {
  let slug = String(rawSlug);
  try { slug = decodeURIComponent(slug); } catch { /* preserve legacy value */ }
  const match = slug.match(/^(services|locations|prices)-(.+)$/);
  return normalize(match ? '/' + match[1] + '/' + match[2] : '/' + slug);
};
const postsDir = join(root, 'content', 'posts');
const approved = new Set();
const quarantined = new Set();
for (const file of readdirSync(postsDir)) {
  if (!file.endsWith('.md')) continue;
  const fm = matter(readFileSync(join(postsDir, file), 'utf8')).data;
  if (!fm.slug) continue;
  const path = articlePath(fm.slug);
  if (fm.seo_index === true) approved.add(path);
  else quarantined.add(path);
}
const index = parse(read(join(dist, 'index.html')));
const articles = parse(read(join(dist, 'articles', 'index.html')));
const expectedCanonical = (document, expected) => {
  const canonical = document.querySelector('link[rel="canonical"]')?.getAttribute('href');
  if (!canonical || localPath(canonical) !== expected || !canonical.startsWith('https://winnerit.in.th/')) {
    fail('Unexpected canonical for ' + expected + ': ' + canonical);
  }
};
expectedCanonical(index, '/');
expectedCanonical(articles, '/articles/');
if (!index.querySelector('h1')) fail('Homepage H1 missing');
if (!index.text.includes('รับซื้อสินค้าไอทีมือสอง ประเมินจากอะไรบ้าง')) fail('Assessment guide missing on homepage');
for (const document of [index, articles]) {
  for (const link of document.querySelectorAll('.posts-sec .card h3 a, .list .card h3 a')) {
    const href = link.getAttribute('href');
    if (href && !approved.has(localPath(href))) fail('Unapproved post linked from main listing: ' + href);
  }
}
const rss = read(join(dist, 'rss.xml'));
for (const item of rss.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
  const href = item[1].match(/<link>([^<]+)<\/link>/)?.[1];
  if (href && !approved.has(localPath(href.replaceAll('&amp;', '&')))) {
    fail('RSS contains unapproved post: ' + href);
  }
}
const sitemapIndex = read(join(dist, 'sitemap-index.xml'));
if (!sitemapIndex.includes('sitemap-')) fail('Sitemap index missing child sitemaps');
const sitemapParts = readdirSync(dist).filter((name) => /^sitemap-\d+\.xml$/.test(name));
if (!sitemapParts.length) fail('No generated XML sitemap parts');
const sitemapUrls = new Set();
for (const file of sitemapParts) {
  const xml = read(join(dist, file));
  for (const match of xml.matchAll(/<loc>([^<]+)<\/loc>/g)) sitemapUrls.add(localPath(match[1].replaceAll('&amp;', '&')));
}
for (const path of quarantined) {
  if (!approved.has(path) && sitemapUrls.has(path)) fail('Noindex post leaked into sitemap: ' + path);
}
for (const path of approved) {
  if (!sitemapUrls.has(path)) fail('Approved article missing from sitemap: ' + path);
}
const robots = read(join(dist, 'robots.txt'));
if (!robots.includes('https://winnerit.in.th/sitemap-index.xml')) fail('robots.txt sitemap reference missing');
console.log(JSON.stringify({
  result: 'passed', approvedPosts: approved.size, quarantinedPosts: quarantined.size,
  sitemapUrls: sitemapUrls.size, sitemapParts: sitemapParts.length
}, null, 2));
