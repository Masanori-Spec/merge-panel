# Independent review: MergePanel

Reviewed 2026-10-04. The repaired implementation is ready for hosted CI within its documented local data-preparation scope. The final independent aggregate passed **112 tests, zero failures and zero skips**, plus syntax validation, the runtime network-call guard and static build. No browser, publication or native InDesign operation was performed in this review.

## Findings corrected before the review freeze

1. **Source update discarded unapplied recipe changes.** Editing the title and capacity, then reading an updated table, restored the last applied recipe because staging rebound `session.project`. Staging now rebinds the current draft by exact header identity. Tests cover reordered headers, tokens and field kinds, plus updating a newly staged table before its first apply. Recipe controls remain available while source text is pending, so an invalid title or field selection can be corrected; generation and downloads remain locked until the input is read and applied.

2. **Visible value markers collided with literal source content.** A real empty cell and the literal string `(empty string)` produced byte-identical standalone proofs and identical inspection text. Literal values are now quoted, with their exact inner text available separately; empty or unset states use unquoted badges. This applies to slot values, source inspection, groups and IDs. Machine data and presence flags remain exact.

3. **Rejected actions left older reads active.** With an invalid table or recipe, a newer Read source or Generate attempt failed before advancing its generation. An older pending file then overwrote the rejected draft. Both actions now invalidate earlier reads at entry, including validation failures. Independent tests release the old promise after rejection and confirm it cannot commit. An oversized replacement file likewise invalidates an earlier read without replacing the current successful project.

4. **Accepted inputs could produce impractically large HTML, including during unrelated downloads.** Before repair, a 2,000-group, eight-slot, ten-selected-field fixture produced a 54,069,476-byte proof when maximum-length text required HTML escaping. The UI eagerly generated every export even for Save project. Complete proof output now has a hard **8 MiB UTF-8 limit**, charged per bounded record chunk before retaining it. Overflow returns a clear refusal and no partial document. The UI calls `exportFile(project, key)` to generate only the requested file. Other eligible downloads retain their existing policy rules. The explicit full-kit helper `exportsFor` may reject if its requested complete proof is too large.

The proof cap was verified with both multibyte Unicode and escaping amplification. A maximum grouped fixture refuses proof normally in a Node process restricted to a 128 MiB heap; separate machine CSV, placement CSV and project JSON still succeed. Actual-handler tests confirm no download is created for the refused proof and subsequent machine/project downloads work.

## Independent evidence

The reviewer-owned `tests/reviewer.test.mjs` adds **15 tests**. Its embedded Python reader imports neither production JavaScript nor the existing oracle. It checks **96 handoff cases**: all eight capacities, three policies, grouping on/off and IDs on/off. This includes **64 machine CSV inversions** and 32 deliberately blocked-policy packets.

The reader computes each source row's destination from its rank among equal keys, reads delivered CSV with Python's standard CSV parser, and verifies source identity, global regrouping, within-group order, occupancy, padding, stable field tokens, image-header markers, unchanged paths, metadata and exact values. It independently derives the replacement and blocker receipts, checks the altered spreadsheet-review copy, and compares the saved project to the original input. All six deliberate corruptions are rejected: image-marker removal, changed cell content, reordered placement evidence, missing transformation receipt, unaltered review CSV and incorrect identity-presence metadata.

Additional checks cover 60 successive exact-header permutations and project reimports, BOM-valued headers, CSV/TSV regeneration, Unicode normalization distinctions, descriptor-first rejection without getter execution, unusual array prototypes, source nonmutation, dirty-state export locks and the corrected UI/report boundaries. The actual-handler harness is a non-rendering DOM double and is not browser evidence.

The aggregate also executes the existing Python oracle suite: 9,850 cases, including 8,736 exhaustive group/capacity cases and 384 CSV reverse checks, with all 12 existing corruptions detected. Built source modules were independently compared byte-for-byte to their source files, then imported; full-kit and per-file sample exports match the source implementation.

## Consumer semantics and limits

The reviewed contract is parsed-string preservation, rather than preservation of source CSV quoting bytes. Group strings and selected IDs remain exact; empty real records and padding have different presence and source-identity fields. Capacity, row and field bounds keep all generated counters within exact integer range. Image paths remain strings and are not resolved or fetched. The conservative space policy changes only eligible selected text and records every replacement; multiline image paths and group/ID metadata remain blockers. Machine CSV is formula-capable data; the disclosed spreadsheet-review copy intentionally changes risky strings and image headers.

Adobe's current [data-source documentation](https://helpx.adobe.com/indesign/desktop/automation-and-scripting/merge-data/data-source-files-overview.html) contains both a prohibition on in-field line breaks and later support for quoted multiline fields. Therefore the app correctly describes its blocking/replacement profile as its own conservative policy. Adobe's [field-binding instructions](https://helpx.adobe.com/indesign/desktop/automation-and-scripting/merge-data/add-and-edit-data-fields.html) support the leading `@` image-header convention and insertion of actual merge fields. These sources do not prove compatibility with a particular installed version.

## Remaining release gates

Twenty-one sandboxed browser scenarios are authored and were reviewed as source, but remain unrun at this local review stage. A maximum-header fixture error in the new proof-limit scenario was caught during review and corrected before handoff. Hosted browser execution, screenshot/PDF inspection, real downloads and responsive layout checks remain required before claiming those checks passed.

The HTML limit bounds generated proof size; it does not guarantee a particular browser's memory use or print pagination. Native InDesign import, typography, pagination, overset, image availability, physical devices and assistive technology remain unverified. No native integration, page-count or accessibility-conformance claim is established by this review.
