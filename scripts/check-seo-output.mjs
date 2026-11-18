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
// Permanent canonical URLs in global navigation must avoid a redirect hop.
for (const link of index.querySelectorAll('.header a[href], .footer a[href]')) {
  const href = link.getAttribute('href');
  if (href?.startsWith('/') && href !== '/' && !href.endsWith('/') && !href.includes('.')) {
    fail('Global navigation links to a redirecting path: ' + href);
  }
}
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
const coreRoutes = new Set([
  '/', '/about/', '/articles/', '/contact/', '/รับซื้อโน๊ตบุ๊ค/',
  '/รับซื้อคอมพิวเตอร์/', '/รับซื้อมือถือ/', '/รับซื้อmacbook/',
  '/รับซื้อiphone/', '/รับซื้อipad/', '/รับซื้อกล้อง/',
]);
// Imported posts that share a slug with a dedicated service page do not own
// that URL; the real service page is intentionally indexable.
const sitemapUrls = new Set();
for (const file of sitemapParts) {
  const xml = read(join(dist, file));
  for (const match of xml.matchAll(/<loc>([^<]+)<\/loc>/g)) sitemapUrls.add(localPath(match[1].replaceAll('&amp;', '&')));
}
for (const path of quarantined) {
  if (!coreRoutes.has(path) && !approved.has(path) && sitemapUrls.has(path)) fail('Noindex post leaked into sitemap: ' + path);
}
for (const path of approved) {
  if (!coreRoutes.has(path) && !sitemapUrls.has(path)) fail('Approved article missing from sitemap: ' + path);
}

const coreServiceSlugs = [
  'รับซื้อโน๊ตบุ๊ค', 'รับซื้อคอมพิวเตอร์', 'รับซื้อมือถือ',
  'รับซื้อmacbook', 'รับซื้อiphone', 'รับซื้อipad', 'รับซื้อกล้อง'
];
const coreAudit = [];
for (const slug of coreServiceSlugs) {
  const pathname = '/' + slug + '/';
  const document = parse(read(join(dist, slug, 'index.html')));
  const h1 = document.querySelectorAll('main h1');
  if (h1.length !== 1) fail('Expected one main H1 on ' + pathname + ', got ' + h1.length);
  if (!document.querySelector('meta[name="description"]')?.getAttribute('content')?.trim()) {
    fail('Missing meta description on ' + pathname);
  }
  if (document.querySelector('meta[name="robots"]')?.getAttribute('content')?.includes('noindex')) {
    fail('Main service page accidentally noindexed: ' + pathname);
  }
  expectedCanonical(document, pathname);
  const main = document.querySelector('main');
  if (!main?.querySelector('a[href*="line.me/R/ti/p/@webuy"]')) {
    fail('Missing contact LINE action on ' + pathname);
  }
  // Primary service photos must be genuine owned/licensed assets, not stock
  // photos passed off as documented buyback cases.
  for (const image of main.querySelectorAll('img[src]')) {
    const src = image.getAttribute('src') || '';
    if (src.includes('images.unsplash.com') || src.includes('source.unsplash.com')) {
      fail('Stock image on core service ' + pathname + ': ' + src);
    }
    if (!image.getAttribute('alt')?.trim()) fail('Service image without meaningful alt: ' + pathname);
  }
  for (const schema of document.querySelectorAll('script[type="application/ld+json"]')) {
    try { JSON.parse(schema.text); } catch { fail('Malformed JSON-LD: ' + pathname); }
  }
  const text = main.text.toLowerCase();
  const forbidden = [
    'ราคาสูงกว่าตลาด', 'มากกว่า 10 ปี', 'รับซื้อถึงที่ทุกจังหวัด',
    'ลบข้อมูลจนไม่สามารถกู้คืนได้'
  ];
  for (const claim of forbidden) {
    if (text.includes(claim.toLowerCase())) fail('Unverified marketing claim on ' + pathname + ': ' + claim);
  }
  coreAudit.push({pathname, h1:1, canonical:'ok', description:'ok', noindex:false, stockImages:0});
}
const contactDocument = parse(read(join(dist,'contact','index.html')));
expectedCanonical(contactDocument,'/contact/');
if (!contactDocument.querySelector('a[href*="line.me/R/ti/p/@webuy"]')) {
  fail('Contact page missing usable LINE fallback');
}
if (!contactDocument.querySelector('#form-offline')) {
  fail('Contact form must visibly fail closed until Worker secrets are configured');
}
if (!existsSync(join(dist,'privacy','index.html'))) fail('Privacy notice required for contact form');

const robots = read(join(dist, 'robots.txt'));
if (!robots.includes('https://winnerit.in.th/sitemap-index.xml')) fail('robots.txt sitemap reference missing');
console.log(JSON.stringify({
  result: 'passed', approvedPosts: approved.size, quarantinedPosts: quarantined.size,
  sitemapUrls: sitemapUrls.size, sitemapParts: sitemapParts.length, coreAudit
}, null, 2));
