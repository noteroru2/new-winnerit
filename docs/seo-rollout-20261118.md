# Winner IT SEO release — 2026-11-18

## Scope
- Homepage, article index, category lists, RSS, and article prev/next now promote **only** posts with explicit frontmatter `seo_index: true`.
- Imported article routes remain generated with their prior `noindex, follow` status unless approved; this release does not delete legacy URLs or bulk-index imported pages.
- Homepage contains a new service evaluation guide and B2B office-lot intake explanation. Claims and prices must be reviewed against real business processes before deploying.
- Internal article links and article structured-data URLs use trailing slashes to match the canonical Worker redirects.
- Invalid dates cannot crash Sitemap serialization.

## QA gates (before merging)
1. `npm ci`; `npm run build`; `npm run seo:audit-content`.
2. Inspect `dist/index.html`, `dist/articles/index.html`, `dist/rss.xml`, `dist/sitemap-index.xml`, generated sitemap parts, and several article HTML files.
3. Confirm noindex article URLs are absent from XML sitemaps, and no indexable homepage/list/RSS link advertises a quarantined post.
4. Check `/รับซื้อโน๊ตบุ๊ค/`, `/รับซื้อคอมพิวเตอร์/`, `/รับซื้อmacbook/`, `/articles/`, `/contact/` and legacy 308 redirects.
5. Compare production deploy SHA with this merged commit. The live site may still reflect an earlier build; do not assume production was updated by this PR.
6. Only promote individual articles after editorial/traffic review, internal duplication check, and service evidence. Setting `seo_index: true` should be a separate, reviewed change.
7. Monitor GSC indexing, queries, 7/14/28-day performance and LINE inquiry conversion.

## Constraints
- No new province doorway pages or fabricated quotes, prices, reviews, branch locations, or turnaround guarantees.
- Do not auto-merge or deploy to production from this branch.
