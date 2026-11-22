# GSC-backed SEO review queue — winnerit.in.th

Evidence: actual Google Search Console API, final data for 2026-10-18–2026-11-14, site hostname filter. GSC page rows are sampled/filtered; zero click or omitted rows do **not** mean a URL was never indexed.

## Prioritize before releasing large batches

| URL | Clicks | Impressions | Next action |
| --- | ---: | ---: | --- |
| `/` | 5 | 26 | Maintain main service clarity and conversion |
| `/services/sell-used-pc-phuket/` | 1 | 1 | Verify service logistics and unique local details, check search intent before considering index |
| `/locations/yala/` | 0 | 10 | Verify province operations and genuine non-templated local details |
| `/รับซื้อmacbook/` | 0 | 12 | Core page has been rewritten; preserve URL and monitor |
| `/รับซื้อคอมพิวเตอร์/` | 0 | 6 | Ensure unique PC/component/B2B checklists and accurate claims |
| `/รับซื้อiphone/` | 0 | 5 | Validate Apple lock, battery, repair and real service scope |
| `/articles/` | 0 | 5 | Show only editorially approved posts, not all imported content |

Other traffic-bearing URLs in the GSC page report include Thai provincial slug variants (some names were truncated in exported previews). Do not infer complete URLs from truncated display strings; requery each canonical page URL before changes.

The presence of a URL in a performance report does not establish index status today, nor indicate that `noindex` should be removed automatically. Keep previously live URLs intact and verify indexing and redirect impact with URL Inspection when possible.

To publish an imported article:
1. Confirm the actual canonical URL and whether Google already knows it.
2. Compare its content with similar service/province pages using `npm run seo:review-inventory` output.
3. Add first-hand service/check details supported by real data; request permission before publishing transaction photos.
4. Verify service geography and fulfillment method, not invented province storefronts.
5. Set `seo_index: true` only with the four review-evidence frontmatter fields in docs/seo-editorial-conversion-20261118.md.
6. Run CI, promote a small batch, compare Search Console 7/14/28 days.
