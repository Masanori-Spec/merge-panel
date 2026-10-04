# MergePanel

**Prepare grouped entries for a fixed-slot merge template, then trace every output slot back to its source record.**

MergePanel is a bounded local web app for designers preparing exhibition cards, speaker profiles or directory entries. It gathers exact groups, fills a chosen number of slots, and exports wide layout records with an inspectable placement map.

One output row is a **layout record**, not a promised page. The app does not edit INDD/IDML, predict pagination or overset, remove template frames, inspect images, or control a design application.

## What it does

- CSV, TSV and versioned project JSON input; up to 2,000 source records
- Up to 12 source columns, 10 selected output fields and 1–8 slots per layout record
- Optional exact grouping, in first-appearance order, with original order inside each group
- Optional unique nonempty item IDs; otherwise source-record ordinals preserve identity
- Explicit presence fields that distinguish a real blank record from padding
- Stable ASCII field tokens, original-header mappings and explicitly selected `@` image fields
- Generic exact-content CSV plus a disclosed conservative InDesign multiline policy
- Placement CSV/JSON, per-cell change receipts, field-binding HTML and a logical HTML proof
- English/Japanese interface, source-row inspection and responsive slot cards

There are no accounts, uploads, runtime dependencies, automatic storage or asset reads. Save project JSON to resume later. Examples are synthetic.

## Run and verify

Node.js 22+ is required. Model tests use Python 3 with only its standard library.

```sh
npm run build
npm run serve
```

Open `http://127.0.0.1:4173/`. The server binds only to loopback. Use the server rather than opening the HTML directly, because the app uses ES modules.

```sh
npm run check       # syntax/network guard, model/state/handler tests, static build
npm run package     # reproducible source/static ZIPs and SHA-256 manifest
```

The hosted browser suite uses the pinned Playwright development dependency: `npm ci --ignore-scripts`, `npx playwright install --with-deps chromium`, then `npm run test:browser` with the server running. Chromium's sandbox stays enabled. Do not bypass environment restrictions to run it.

## Workflow

1. Choose the workshop example or paste/upload a UTF-8 table
2. Choose **New table** to start a recipe, or **Update source** to retain the current recipe by matching exact header names
3. Read the source and select capacity, group, optional ID, fields and image-path kinds
4. Generate records and inspect each slot; select its source-record button to see the complete original row
5. Review regrouping, multiline blockers and any explicit replacements
6. Download the handoff packet and project JSON

Edits are staged. Until generation succeeds, the last applied result stays visible and downloads are locked. Revert discards the draft. Failed input retains its text for correction. A later edit, import action, format change, read, apply, revert or example invalidates an earlier asynchronous file read. A newer read/apply attempt invalidates it even when that attempt fails validation.

**Update source** retains the current draft title, settings, tokens and selected-field order when columns move. Recipe controls continue to refer to the currently staged table until source reading succeeds, so an invalid title or selection can be corrected before retrying the read. It requires every existing bound header to remain present and unique; new columns receive new disabled tokens. A missing/renamed header rejects with a remapping instruction. **New table** explicitly creates new bindings. Never replace columns by position and assume an old recipe still applies.

## Grouping and padding

Groups use exact strings: `A`, ` A`, `a` and normalization variants are distinct. A blank group label is a real group, separate from grouping being disabled. Noncontiguous equal groups are collected together, which can change the global order; the UI and placement receipt say when this happens.

For capacity 2, `Red/A1, Red/A2, Blue/B1, Blue/B2, Blue/B3` becomes:

| Layout record | Group | Slot 1 | Slot 2 |
| --- | --- | --- | --- |
| 1 | Red | A1 | A2 |
| 2 | Blue | B1 | B2 |
| 3 | Blue | B3 | padding |

Padding has `present=0`, empty source identity and empty values. An entirely blank but structurally valid source record still has `present=1` and a source ordinal. Blank merge values do not delete frames in a template.

## Files and field contract

| File | Content |
| --- | --- |
| `merge.csv` | Machine merge rows under the selected multiline policy |
| `merge-spreadsheet-review.csv` | Explicitly altered inspection copy; never use for native merge |
| `placement.csv` | One source-record-to-layout-record/slot entry for every real row |
| `placement.json` | Recipe, source headers, field map, groups, slots and full placement evidence |
| `changes.json` | Exact before/after text, line-break counts and blocked occurrences |
| `fields.html` | Generated-field mapping and consumer instructions |
| `proof.html` | Standalone logical placement proof; quoted literal values and distinct empty/unset badges; no external assets |
| `mergepanel-project.json` | Complete source table and recipe for exact reimport |

The two merge CSVs are unavailable while conservative-profile blockers remain; all evidence and project exports remain available after a successful generation.

Metadata fields are `mp_layout_record`, `mp_grouped`, `mp_group_index`, `mp_group_label`, `mp_group_chunk`, `mp_group_chunks` and `mp_slot_count`. Counters are one-based; slot count is the number of occupied slots.

Each slot has `slot_N_present`, `slot_N_source_record`, `slot_N_source_id` and its selected fields. A stored token such as `f003` becomes `slot_1_f003` for text or `@slot_1_f003` for an explicitly declared image path. Tokens avoid collisions caused by sanitizing human-readable headers. The original header and token remain in the binding guide and JSON.

Image path strings are copied unchanged. No files are opened, fetched, resolved, rewritten, copied or packaged. Relative paths depend on the location of the exported data file. Check asset availability and native import separately.

## Multiline policy and consumer boundary

- **Generic / preserve:** all parsed string content, including quoted line breaks, is preserved
- **Conservative InDesign / block:** merge CSV is blocked if any exported selected value or group/ID metadata contains a line break
- **Conservative InDesign / space:** an explicit choice replaces each CRLF pair, lone CR/LF, or Unicode line/paragraph separator in selected ordinary text with one space, with a per-cell receipt

Image paths and group/ID identities are never rewritten, even if also selected as text. They remain blockers. Unselected nonidentity fields do not block export. The original table is never changed by a replacement policy.

Adobe's current [source-file page](https://helpx.adobe.com/indesign/desktop/automation-and-scripting/merge-data/data-source-files-overview.html) contains both a prohibition of in-field line breaks and a later statement supporting quoted multiline fields. Our conservative policy is deliberate; it is not a claim that InDesign universally rejects multiline data. No named InDesign version or native merge has been tested.

The [Adobe binding instructions](https://helpx.adobe.com/indesign/desktop/automation-and-scripting/merge-data/add-and-edit-data-fields.html) explain real field insertion through the Data Merge panel and image headers. A typed placeholder-looking string is not a substitute for an inserted field. This handoff does not establish template geometry or native compatibility.

## Exactness and input bounds

- 1–2,000 data records, 1–12 source columns, 1–10 enabled fields, 1–8 slots
- Every table field is a string of at most 240 UTF-16 code units; title is 1–120
- Headers must be nonempty and exactly unique; selected IDs must be nonempty and exactly unique
- No trimming, case folding, Unicode normalization, sorting, deduplication, numeric/date coercion or formula evaluation
- CSV/TSV use strict quoted-field parsing, doubled quotes, LF/CRLF record separators and quoted CR/LF content; bare unquoted CR and ragged records reject
- A UTF-8 transport BOM is accepted; a literal U+FEFF at the start of a field is quoted during regeneration to keep it distinct
- Files use fatal UTF-8 decoding; malformed bytes reject while legitimate U+FFFD remains valid
- Input byte cap is 32 MiB; JSON also bounds depth, values, strings and container growth before allocation
- Unsupported controls/bidi overrides, unpaired surrogates, duplicate JSON keys, unknown fields, sparse arrays and serialization hooks reject
- Exactness refers to parsed cell strings, not the lexical choice of quotes in the original CSV file

Machine CSV can contain formula-like strings. **Quoting does not neutralize spreadsheet formulas.** The review copy prefixes risky text with an apostrophe, including `@` image headers, so those values intentionally differ. Spreadsheet behavior varies. Placement CSV is also machine data; use JSON when you need typed exact evidence.

## Verification status

Complete HTML proofs have an 8 MiB UTF-8 output limit, including HTML escaping. Oversized proofs are refused with no partial file. Each download is generated independently, so other eligible downloads remain available under their existing policy restrictions. The `exportFile(project, key)` API is lazy per file; `exportsFor(project)` explicitly requests the full kit and rejects if its proof is too large.

Local `npm run check` passes **112 tests**. The independent Python oracle covers 9,850 model/export cases, including 8,736 exhaustive group/capacity combinations and 384 CSV inverse checks. All 12 deliberate corruptions are detected. See [verification](docs/verification.md).

Twenty-one sandboxed browser scenarios are authored but **have not run locally**. Pixel layouts, print PDFs, physical devices, assistive technology and native InDesign behavior remain unverified. No native integration claim is made.

## 日本語

MergePanel は、グループ別の項目を固定スロットの差し込みデータへ変換するローカルツールです。各配置から元の行を確認でき、空の実データと埋め合わせを区別します。出力の 1 行は「配置レコード」であり、ページ数や文字のあふれを保証するものではありません。

汎用 CSV では文字列と改行を保持します。InDesign 向けの保守的な設定では、改行がある場合に出力を止めるか、テキストの改行を空白に置換して変更を記録します。画像パスとグループ・ID は置換しません。画像ファイルにはアクセスしません。

入力更新は同じ列名に再割り当てし、新しい表の読み込みは設定を初期化します。再開にはプロジェクト JSON を保存してください。ネイティブの InDesign での動作確認は未実施です。

## Project context

[Existing tools and scope](docs/comparison.md) acknowledges EasyCatalog, MyDataMerge and native Data Merge. [Engineering notes](docs/engineering.md) describe the reversible model and an interview explanation. User demand and commercial viability have not been established. No license has been selected for this repository.
