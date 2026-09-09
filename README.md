# DTBP Catalog Review

Standalone, mobile-friendly owner review of the remaining catalog issues. This repository contains application code only, not the private product review dataset.

## Use

Open the hosted dashboard and sign in with the owner ChatGPT account. The public sign-in page does not expose the review queue. Only the configured owner can read records, save decisions or download history.

- Website items to check and other items not on the website are separate queues.
- Search by SKU, title, brand or issue.
- Choose OK, No, Needs changes, or Save for later.
- Save for later moves the item out of both main queues and onto its own page at `/review?view=later`, with all entered values and notes saved.
- Earlier Save for later choices appear there automatically. Approving, declining or requesting changes removes an item from that page; its saved decision and history remain available.
- Decisions persist in this site's isolated D1 database, including an audit history.
- Stale tabs cannot overwrite newer decisions.
- Download an export for a later, separately reviewed integration into the website.

Nothing here publishes products, alters prices/stock, changes inFlow, approves image rights or deploys the DTBP storefront. This is not a store or a public product catalog.

## Security and data separation

The public repository contains no catalog snapshots, private notes, customer data, prices, quantities or credentials. Private generated imports are ignored under `private/`; never add them to Git.

ChatGPT authentication is handled by the hosting platform. Every data endpoint checks the configured owner invitation email and, after the first save, the enrolled stable site user ID. Identity headers must be supplied by trusted Sites dispatch; do not expose a raw Worker origin that accepts client-supplied identity headers.

The initial import uses a high-entropy server secret and becomes permanently sealed after count and content-hash verification. Remove the import secret after the initial load. No runtime schema creation or remote business-system integrations exist.

## Development

Node 22.13+ and the locked npm dependencies are required.

```sh
npm run install:ci
npm run dev
node --test tests/*.test.mjs
npx tsc --noEmit
npm run build
```

Generate schema migrations with `npm run db:generate`. Apply generated migrations to the local preview database before running the local runtime test. `tests/runtime-local.mjs` uses only an invented fixture on loopback port 5540 and assumes a fresh local database with the documented test-only identity.

Hosted values are managed through Sites, not committed files: `REVIEW_OWNER_EMAIL` and the one-time `REVIEW_IMPORT_KEY`. Use the bundled dispatch-owned sign-in helpers. The local preview identity is not a hosted authentication bypass.

## Data portability

`scripts/prepare-private-import.mjs` reads an existing owner reviewer without changing it. It selects only held/outside rows, preserves original identifiers and fingerprints, and emits ignored private files. It never imports or publishes automatically. A secured, complete import is verified by content hash before enabling the review.

Existing local approvals remain in the original project. Remote decisions form a separate history; reconcile exact identifiers and fingerprints before applying any future website changes.

Saved for later is a display-only classification of a matching saved `pending` decision. Unreviewed items have no matching saved decision. This distinction requires no migration, reimport or rewriting existing choices, and keeps older open tabs and exports compatible. Stale fingerprints still require review; a deferred decision is not approval.

## Slow-selling item folders

The separate owner-only `/review/sales` report groups active stocked inFlow products into non-overlapping 6–11, 12–17 and 18+ calendar-month folders. Each row shows the latest recorded sales activity date and a point-in-time stock status, never a price or stock quantity. Missing/future-dated qualifying history is separated for checking. If no sale is found in available history, the date stays null; the folder uses the product record's age and says so. It does not prove no lifetime sales or how long stock was unavailable.

`scripts/prepare-sales-folders.mjs <source-directory> <private-output-directory>` prepares the owner-upload JSON and three printable local folders from complete read-only identity/stock and full sales-history extracts. Generated data stays under ignored `private/`, never in public assets, migrations or Git. Titles and brands are the recorded inFlow values, not auto-approved replacements.

Migration `0001_parallel_prodigy.sql` only creates the independent `review_sales_snapshots` table. The owner may load the prepared JSON on the sales page; `/api/sales-review` verifies owner access, readiness, origin, bounded input and a safe field projection. Evidence snapshots are append-only with stale-tab conflict protection. They never write `review_items`, `review_decisions`, `review_history` or `review_state`; the sealed initial importer stays sealed. Existing choices do not disappear from the original queues.

`tests/sales-folders.test.mjs` checks calendar boundaries, missing dates, safe data projection and SQLite preservation. `tests/sales-client.test.mjs` exercises real client handlers with invented data, including printing all filtered items and retaining the previous report after failed uploads. `tests/runtime-sales-local.mjs` imports the prepared private report on loopback port 5540 only and confirms the existing local decision/history export is unchanged. It must never target the hosted service. No browser visual QA is implied by these checks.
