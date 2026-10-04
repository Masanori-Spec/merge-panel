# Verification record

Verified publication stage, 2026-10-04. Local model, hosted browser and actual downloaded artifacts are distinguished below.

## Executed locally

`npm run check` passes syntax validation, the runtime no-network-call guard, **112 tests** and the static build.

- **66 independent model/input/export tests**, using Python structured grouping and the standard CSV reader
- **9,850 valid oracle cases**, including 8,736 exhaustive group-pattern/capacity combinations, seeded policy cases and 384 CSV inversions
- Every source row appears once, group order and within-group order agree, record counts follow ceil(n/k), and real blanks differ from padding
- CSV inverse checks reconstruct selected values using placement JSON and restore explicit transformations from change receipts
- Stable field tokens, image markers, exact header rebinding, all capacities, 2,000-row/10-selected-field bounds and no path rewriting
- **12 deliberate corruptions** are detected across model, receipt and CSV output
- **22 state/boundary tests** cover draft/commit/revert, reimport, asynchronous reads, valid/invalid UTF-8, literal BOM headers, HTML escaping, maximum Unicode projects and low-heap malformed JSON
- **9 actual handler tests** exercise the app with a small DOM double: settings, group filters, source tracing, policy locks, checkbox fields, languages, source updates, repeated file reads and cancellation

- **15 final-review tests** include a separate Python reader for 96 handoff cases (64 machine CSV inversions and 32 blocked-policy packets), six corruption rejections, draft retention/correction, exact marker displays, failed-action cancellation and proof limits under a 128 MiB heap

The DOM double does not establish real browser behavior, pixels, accessibility-tree behavior, PDF layout or downloads.

## Executed on hosted CI

GitHub Actions defines four model jobs (Node 22/24 × UTC/Tokyo) and an Ubuntu 22.04 Chromium job with `chromiumSandbox: true`. [Run 37189619717](https://github.com/Masanori-Spec/merge-panel/actions/runs/37189619717) passed all five jobs at commit `722fe489b2c10c0f55a97f3f9eea6e23a4849143`. Each model job passed 112 tests with zero failures/skips. Twenty-one passing browser scenarios cover:

1. Sample counts, exact row placement and unique IDs
2. Keyboard source tracing and Japanese language
3. Draft locks, capacity regeneration and grouping changes
4. Group filters, navigation and padding
5. All eight downloads and project reimport
6. Formula text, image headers and explicit review-copy changes
7. Multiline blocking, explicit replacement and receipts
8. Unmodified image-path blockers
9. Header reordering and missing-binding rejection
10. Invalid CSV/IDs, language preservation and reset
11. Sample replacement cancellation/confirmation
12. Repeated files, malformed UTF-8 and literal U+FFFD
13. Held asynchronous read after a newer sample
14. Maximum input and full placement export
15. Hostile/wide text plus 768/390/320 responsive layouts
16. Standalone field/proof HTML, print PDFs and screen-print warning
17. Unapplied recipe retention and invalid-title correction during source update
18. Literal marker-like data versus empty, unset and padding states
19. Failed newer read/generation attempts cancel pending reads
20. Oversized complete proof refusal with successful machine/project downloads
21. External-request and uncaught-error checks

The suite saved 23 actual downloads, desktop English/Japanese captures, responsive English/Japanese captures at 320/390/768 pixels, standalone HTML print views and five PDF pages. [Browser results](evidence/results.json) retain all scenario outcomes and download diagnostics. [CI summary](evidence/ci-summary.json) identifies the exact capture commit and artifact. No local browser launch or sandbox workaround was used.

The first hosted attempt completed the eight-file sample kit, then timed out on the eleventh rapid download. Chromium source documents a ten-download burst window; the harness now spaces download requests by at least 200 ms and checks actual download completion. All 23 requested files succeeded on the rerun. Application export logic and every content assertion remained unchanged.

## Actual artifact inspection

- The real eight-file sample kit was independently parsed using Python CSV/JSON readers and the source-derived oracle: all seven source rows occur exactly once across three layout records, with two distinct padding slots and exact image paths. CSV inverse reconstruction recovers every selected source string.
- The field guide contains all nine generated text/image bindings. The logical proof includes all original selected values, distinct empty badges and source identities, with no image/script embeds or external assets.
- The 2,000-row maximum fixture has 250 eight-slot records and exactly one placement per source row. The oversized-proof fixture refuses a complete proof without creating a partial download, while its project JSON and 2,000-row machine CSV remain exact.
- The downloaded multiline replacement receipt matches a separate Python derivation from unchanged project source. [Download verification](evidence/download-verification.json) records these checks.
- Actual screenshots were inspected for desktop English/Japanese, long ASCII/CJK/hostile strings and responsive controls. No document-width overflow or clipped language controls was found in the tested viewports.
- The field guide PDF has two pages; the logical proof PDF has three. All five pages were rendered and inspected. PDF text contains all seven source identities once, all seven unchanged image paths, two padding slots and all nine field bindings. These are the tested sample documents, not a promise about native document pagination.

The independent review report records the earlier local review stage. Its pending-hosted note is superseded by the hosted evidence above; its native-consumer limitations still apply.

## Remaining checks and limits

Actual native InDesign merge behavior and physical-device/assistive-technology tests remain pending. No native integration, rendered layout, page count, font/overset, image availability, WCAG or legal guarantee is made.

The first-party documentation review supports the field and policy descriptions, not consumer compatibility. Adobe's current multiline statements conflict; the conservative policy is explicitly ours. EasyCatalog and MyDataMerge already address broader grouped publishing tasks. Market demand has not been established.
