# DTBP Catalog Review

Standalone, mobile-friendly owner review of the remaining catalog issues. This repository contains application code only, not the private product review dataset.

## Use

Open the hosted dashboard and sign in with the owner ChatGPT account. The public sign-in page does not expose the review queue. Only the configured owner can read records, save decisions or download history.

- Website items to check and other items not on the website are separate queues.
- Search by SKU, title, brand or issue.
- Choose OK, No, Needs changes, or Save for later.
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
node --test tests/review-core.test.mjs
npx tsc --noEmit
npm run build
```

Generate schema migrations with `npm run db:generate`. Apply generated migrations to the local preview database before running the local runtime test. `tests/runtime-local.mjs` uses only an invented fixture on loopback port 5540 and assumes a fresh local database with the documented test-only identity.

Hosted values are managed through Sites, not committed files: `REVIEW_OWNER_EMAIL` and the one-time `REVIEW_IMPORT_KEY`. Use the bundled dispatch-owned sign-in helpers. The local preview identity is not a hosted authentication bypass.

## Data portability

`scripts/prepare-private-import.mjs` reads an existing owner reviewer without changing it. It selects only held/outside rows, preserves original identifiers and fingerprints, and emits ignored private files. It never imports or publishes automatically. A secured, complete import is verified by content hash before enabling the review.

Existing local approvals remain in the original project. Remote decisions form a separate history; reconcile exact identifiers and fingerprints before applying any future website changes.
