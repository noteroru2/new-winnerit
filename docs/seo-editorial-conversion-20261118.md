# Winner IT SEO editorial and lead conversion release — 18 November 2026

## Confirmed context
- Live GSC final data 2026-10-18 to 2026-11-14: 9 clicks and 109 impressions for winnerit.in.th.
- Imported article inventory is ~4,031 posts, not assumed to be approved. No mass indexing. Existing URLs remain available as noindex.
- Browser-facing content avoids unsupported claims about highest prices, 10+ years, unconditional Bangkok pickup, fixed minutes or irreversible data deletion.
- Hero and trust photos use the company's public storefront and evaluation-area images; demonstration scenarios are **fictional examples**, labeled explicitly, never fabricated transactions.

## Editorial publication contract
For each imported post with `seo_index: true`, add to frontmatter:
```yaml
seo_reviewed_by: "owner or editorial reviewer"
seo_reviewed_at: "2026-11-18"
seo_evidence: "Specific source of service proof, transaction evidence or technical inspection data, with permission."
seo_service_verified: "Precise geographic fulfillment method and scope, verified for this URL."
```
These fields gate CI. Reviewer must also check title/near-duplicate inventory, GSC URL clicks, internal links, image rights, product pricing, and prior public URL. A review note is *not* independent proof by itself.

Run `npm run seo:review-inventory` to obtain heuristic similarity queues. A high similarity score is not a Google penalty; manually review first. Do not create virtual branch claims for provinces. For `/locations/` pages, evidence must describe actual logistics, not a fictional storefront. Promote small reviewed batches; compare 7/14/28-day Search Console impressions, indexing and contacts.

## Lead form deployment gates
Contact form is fail-closed: if the Worker is missing any configuration, the site displays a clear LINE fallback instead of pretending to deliver submissions.

Configure Cloudflare Worker bindings/secrets (do **not** commit values):
- `CONTACT_WEBHOOK_URL`: verified HTTPS recipient (e.g. the business's authorized n8n workflow URL).
- `CONTACT_WEBHOOK_BEARER_TOKEN`: secret token accepted by that receiver.
- `TURNSTILE_SITE_KEY`: public Turnstile key for winnerit.in.th.
- `TURNSTILE_SECRET_KEY`: Turnstile secret verified server-side.
- `SEO_EVENTS`: Analytics Engine binding declared in wrangler.jsonc, dataset `winnerit_seo_events`.

Test successful and failed form submissions; receiver must reject requests without matching token, notify staff, and create a lead ID record for future reconciliation in AMPHON System. Never store personal data in Analytics Engine or analytics events. DataLayer event names: `winnerit_line_click`, `winnerit_phone_click`, `winnerit_form_success` if GTM is configured; Analytics Engine server writes `line_click`, `phone_click`, `contact_form_success` counts and paths.

**LINE click analytics is not the same as closed-deal attribution.** To reconcile actual bought units and realized profit, the operational backend must store the same lead ID / an agreed campaign label when a deal is opened. No such integration is claimed here.

## Regression QA
1. `npm ci && npm run test:worker && npm run seo:publish-guard && npm run build && npm run seo:check-output`
2. Review all seven service URL headings/meta/canonical; look for stale absolute URLs and noindex collisions.
3. Test responsive cards, keyboard, LINE CTAs, image alt, phone, Turnstile, invalid input, successful n8n receiver, no webhook credentials in source.
4. Verify Cloudflare worker redirect rules, site analytics dataset creation and web-form config.
5. Compare Production SHA and previous URL index coverage before merging and deploying. No automatic merge or deployment.
