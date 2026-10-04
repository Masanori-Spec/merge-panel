# Verification record

Local implementation stage, 2026-10-04. Executed and authored checks are distinguished below.

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

## Authored, not run locally

GitHub Actions defines four model jobs (Node 22/24 × UTC/Tokyo) and an Ubuntu 22.04 Chromium job with `chromiumSandbox: true`. Twenty-one browser scenarios cover:

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

The suite saves actual screenshots, downloaded files, PDFs and a results.json when executed. They do not exist at this stage. No local browser launch or sandbox workaround was used.

## Remaining checks and limits

Hosted browser execution, screenshot/PDF inspection, actual native InDesign merge behavior and physical-device/assistive-technology tests remain pending. No native integration, rendered layout, page count, font/overset, image availability, WCAG or legal guarantee is made.

The first-party documentation review supports the field and policy descriptions, not consumer compatibility. Adobe's current multiline statements conflict; the conservative policy is explicitly ours. EasyCatalog and MyDataMerge already address broader grouped publishing tasks. Market demand has not been established.
