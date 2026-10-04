# Engineering decisions

## A reversible row transformation

Rows are grouped in first-appearance order with exact string keys. Disabled grouping uses null, which cannot collide with a real blank string. Each group retains original source order, then divides into chunks of capacity k. The number of layout records for a group of n rows is ceil(n/k); padding is that count times k minus n.

Every source record receives exactly one placement. Real slots carry the one-based source ordinal and optional exact ID; padding slots carry a false presence flag, null source identities and empty exported cells. This preserves the difference between a genuinely blank record and no record at all.

All field values remain strings. The optional ID must be unique and nonempty, but identity never comes from a value guessed to be a number or date. Parsed content is preserved; the original CSV's quoting style is not part of the data model.

## Stable field bindings

Every source column has a stored token, kind and enabled flag. Tokens are ASCII f001–f999, unique within the recipe and independent of human-readable headers. Selected-field order comes from the saved recipe. A text field emits slot_N_fNNN; an image field adds @ as the first character.

Update source uses unique exact original headers to rebind columns and group/ID roles, preserving tokens. New columns get fresh disabled tokens. Missing old headers reject and require an explicit New table/remap choice. New table starts a fresh recipe. Regeneration never silently applies a saved positional mapping to reordered columns.

Rebinding returns a staged candidate: new ID conflicts can be corrected by changing the ID role before apply. Compile validates the entire recipe and identity constraints atomically before replacing the last successful result.

## Consumer policy separated from source

Generic mode passes selected strings through exactly. Conservative InDesign mode either blocks multiline values or replaces text line separators under an explicit space policy. CRLF counts as one break; lone CR, LF, U+2028 and U+2029 count separately. Every replacement records source ordinal, column, token, before/after string and break count.

Image paths and group/ID values never use replacement, even when a metadata column is also selected as an output text field. They remain blockers. One multiline source cell can produce multiple blocked occurrences when it appears both as a selected field and as metadata; the UI reports occurrences, not distinct-cell count.

The source table is immutable across policy changes. Placement JSON carries original selected strings alongside output values, and project JSON retains all original columns. Literal strings in proof and inspection are quoted, while empty/unset states are unquoted badges, so marker-like source strings cannot masquerade as synthetic states. The proof is a logical report, not a reproduction of a designer's frames, fonts or pages.

## Input/output boundaries

CSV/TSV are parsed by a bounded quoted-field state machine, preserving quoted newlines and exact whitespace. Strict JSON parsing catches duplicate keys and bounds nesting, value count, string decoding and container growth before large allocations. The complete proof is assembled in bounded record chunks with an 8 MiB UTF-8 byte budget including HTML escaping; it refuses oversize output without truncation. Individual download generation avoids building a proof when exporting CSV, placement or project files. Maximum valid Unicode projects remain within the input limits; malformed container explosions reject in a 128 MiB Node subprocess.

File reads decode UTF-8 fatally. Invalid bytes cannot silently turn into replacement characters. A literal leading U+FEFF in regenerated fields is quoted so the input parser does not confuse it with a transport BOM. Direct JavaScript callers are subject to descriptor-first plain-object/array checks before cloning, preventing accessor or toJSON surprises.

HTML output escapes all source text. Image references remain text, never an image element, fetch or filesystem operation. Runtime code has no network calls, and the app CSP forbids network connections, embedded objects and form submission.

CSV quoting is syntax preservation, not formula protection. Machine merge and placement CSV preserve their documented values. A separate review CSV prefixes detected risky strings, including @ headers, and explicitly cannot be used for merge or exact round trips. JSON carries typed exact evidence.

## State and interrupted flows

Source text and recipe edits are drafts. Source updates rebind the current draft by exact headers, including edits made since the last generation. Recipe controls remain available against the currently staged table so validation errors can be corrected before retrying a read. Successful generation commits atomically; a policy-blocked result is still a valid committed proof, but its machine/review CSV buttons stay disabled. Evidence and project downloads remain available. Unapplied drafts lock all downloads.

A generation token invalidates pending file reads after newer typing, mapping changes, format/import-action changes, read/apply attempts (including failures), revert or sample replacement. Both stale resolutions and stale failures are ignored. Language switching preserves current drafts, repeated files can be selected again, and leaving unsaved work or replacing it with a sample has explicit protection.

## Independent verification

Python independently groups and chunks source rows, reconstructs expected slots and reverses machine CSV through placement/change evidence. It does not import production JavaScript. Exhaustive small cases, seeded adversarial fixtures, maximum bounds and intentional corruptions test the invariants independently. Actual DOM handlers are exercised separately by a small non-rendering test double; hosted browser checks are authored for real rendering, downloads, responsive layouts and print output.

## Interview explanation

“I built MergePanel for the preparation step before a designer imports data into a repeated-slot template. The challenging part was preserving identity while grouping rows and padding incomplete groups. I stored exact field bindings, separated real blanks from padding, and made every slot traceable to a source record. I also treated multiline handling as an explicit consumer policy with a change receipt, because the current vendor documentation is internally inconsistent. An independent Python reader reverses the generated CSV and verifies every selected value and placement. The project makes a narrow claim: reliable data preparation, not page layout or native integration.”

The code uses no runtime packages. Playwright is a test-only development dependency. Static builds copy local modules/assets, and source/static archives use fixed timestamps with a SHA-256 manifest. Existing publishing products and unvalidated market demand are acknowledged.
