import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { compile, createProject, validateProject, validateTable, parseProject, parseDelimited, rebindProject } from '../src/core.mjs';
import { sample, multiline } from '../src/examples.mjs';
import { exportsFor, mergeCSV, projectJSON } from '../src/export.mjs';
const clone = value => structuredClone(value);
function runOracle(cases, shouldPass = true) {
  const run = spawnSync('python3', [fileURLToPath(new URL('./merge_oracle.py', import.meta.url))], { input: JSON.stringify(cases), encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  assert.equal(run.error, undefined, run.error?.message); assert.equal(run.stderr, '', run.stderr);
  const result = JSON.parse(run.stdout);
  if (shouldPass) { const bad = result.filter(item => item.errors.length); assert.equal(bad.length, 0, JSON.stringify(bad.slice(0, 5), null, 2)); assert.equal(run.status, 0); }
  else { assert.equal(run.status, 1); assert.ok(result.every(item => item.errors.length), 'every intentional corruption must fail'); }
  return result;
}
function fixture(rows = [['Red', 'A1'], ['Red', 'A2'], ['Blue', 'B1'], ['Blue', 'B2'], ['Blue', 'B3']], capacity = 2) {
  const p = createProject({ columns: ['Group', 'Name'], rows }); p.title = 'Independent placement oracle'; p.settings.capacity = capacity; p.settings.group = 0; return p;
}
function caseFor(project, name, includeExports = false) { return { name, project, actual: compile(project), ...(includeExports ? { files: exportsFor(project) } : {}) }; }
function random(seed) { let x = seed >>> 0; return n => { x ^= x << 13; x ^= x >>> 17; x ^= x << 5; return (x >>> 0) % n; }; }
function* words(alphabet, length, prefix = []) { if (!length) { yield prefix; return; } for (const value of alphabet) yield* words(alphabet, length - 1, [...prefix, value]); }

test('golden Red/A1 Red/A2 Blue/B1 Blue/B2 Blue/B3 makes three capacity-two records', () => {
  const project = fixture(), output = compile(project);
  assert.deepEqual(output.records.map(r => [r.groupValue, r.occupied]), [['Red', 2], ['Blue', 2], ['Blue', 1]]);
  assert.deepEqual(output.records.map(r => r.slots.map(s => s.row)), [[1, 2], [3, 4], [5, null]]);
  assert.equal(output.padding, 1); assert.equal(output.regrouped, false);
  runOracle([caseFor(project, 'golden'), caseFor(sample, 'sample'), caseFor(multiline, 'multiline block')]);
});

test('noncontiguous groups keep first-appearance group order and source order within each group', () => {
  const project = fixture([['Red', 'A1'], ['Blue', 'B1'], ['Red', 'A2'], ['Blue', 'B2'], ['Blue', 'B3']]);
  assert.deepEqual(compile(project).placements.map(p => p.row), [1, 3, 2, 4, 5]);
  assert.equal(compile(project).regrouped, true);
  runOracle([caseFor(project, 'interleaved groups')]);
});

test('exhaustive small group patterns across every capacity preserve every row exactly once', () => {
  const cases = [];
  for (let n = 1; n <= 6; n++) for (const groups of words(['', 'A', ' A'], n)) for (const capacity of [1, 2, 3, 4, 5, 6, 7, 8]) {
    const project = fixture(groups.map((group, i) => [group, `row-${i}`]), capacity);
    cases.push(caseFor(project, `groups-${n}-${cases.length}`));
  }
  assert.equal(cases.length, 8736);
  // Batches keep the interchange bounded while covering every generated case.
  for (let start = 0; start < cases.length; start += 1000) runOracle(cases.slice(start, start + 1000));
});

test('all-blank real rows remain present and distinct from empty padding slots', () => {
  const p = createProject({ columns: ['Only'], rows: [[''], [''], ['']] }); p.settings.capacity = 2;
  const output = compile(p);
  assert.equal(output.records[1].slots[0].present, true); assert.deepEqual(output.records[1].slots[0].originalValues, ['']);
  assert.equal(output.records[1].slots[1].present, false); assert.deepEqual(output.records[1].slots[1].originalValues, [null]);
  runOracle([caseFor(p, 'all blank rows')]);
});

test('seeded projects cover field permutation, enabled tokens, grouping, IDs, image kinds and policies', () => {
  const draw = random(0x4D455247), cases = [];
  const labels = ['', 'A', ' A', 'A ', '(none)', 'null', '__proto__', 'x,y', 'x"y', 'x\ny', 'x\r\ny', 'x\ry', 'x\u2028y', 'x\u2029y', '日本語🔌', '=SUM(1,2)', '@images/pic.jpg', 'C:\\images\\pic.jpg'];
  for (let index = 0; index < 240; index++) {
    const columns = 2 + draw(11), rows = 1 + draw(30);
    const table = { columns: Array.from({ length: columns }, (_, i) => `Field ${i}`), rows: Array.from({ length: rows }, (_, r) => Array.from({ length: columns }, (_, c) => c === 0 ? `id-${r}` : labels[draw(labels.length)])) };
    const project = createProject(table); project.settings.capacity = 1 + draw(8); project.settings.group = index % 3 ? 1 : null; project.settings.id = index % 2 ? 0 : null;
    for (let i = project.settings.fields.length - 1; i > 0; i--) { const j = draw(i + 1); [project.settings.fields[i], project.settings.fields[j]] = [project.settings.fields[j], project.settings.fields[i]]; }
    const enabled = 1 + draw(Math.min(10, columns));
    project.settings.fields.forEach((field, i) => { field.enabled = i < enabled; field.kind = draw(3) === 0 ? 'image' : 'text'; field.token = `f${String(999 - i).padStart(3, '0')}`; });
    for (const policy of ['generic', 'block', 'space']) {
      const p = clone(project); p.settings.profile = policy === 'generic' ? 'generic' : 'indesign'; p.settings.multiline = policy === 'generic' ? 'preserve' : policy;
      cases.push(caseFor(p, `seed-${index}-${policy}`));
    }
  }
  runOracle(cases);
});

test('space receipts count CRLF once and every supported separator independently', () => {
  const p = createProject({ columns: ['Text'], rows: [['a\r\nb\rc\nd\u2028e\u2029f'], ['\r\n\n\r\u2028\u2029']] });
  p.settings.profile = 'indesign'; p.settings.multiline = 'space';
  const output = compile(p);
  assert.deepEqual(output.records[0].slots.slice(0, 2).map(slot => slot.values[0]), ['a b c d e f', '     ']);
  assert.deepEqual(output.changes.map(c => c.breaks), [5, 5]);
  assert.equal(output.mergeAllowed, true);
  runOracle([caseFor(p, 'all line separators')]);
});

test('image line breaks are blocked and never rewritten, while ordinary image paths remain exact', () => {
  const p = createProject({ columns: ['Text', 'Image'], rows: [['a\nb', 'images/a\nb.png'], ['safe', 'C:\\dir\\a,b "quoted".png']] });
  p.settings.fields[1].kind = 'image'; p.settings.profile = 'indesign'; p.settings.multiline = 'space';
  const output = compile(p);
  assert.equal(output.mergeAllowed, false);
  assert.equal(output.records[0].slots[0].values[1], 'images/a\nb.png');
  assert.ok(output.changes.every(change => change.column !== 1));
  runOracle([caseFor(p, 'image paths')]);
});

test('group and ID identity are exact and multiline identities block conservative export', () => {
  const p = createProject({ columns: ['ID', 'Group', 'Text'], rows: [['id\n1', 'A\r\nB', 'x\ny'], ['id 2', 'A\r\nB', 'z']] });
  p.settings.group = 1; p.settings.id = 0; p.settings.profile = 'indesign'; p.settings.multiline = 'space';
  p.settings.fields[0].enabled = false; p.settings.fields[1].enabled = false;
  const output = compile(p);
  assert.equal(output.mergeAllowed, false); assert.equal(output.groups[0].value, 'A\r\nB');
  assert.equal(output.placements[0].itemId, 'id\n1');
  assert.deepEqual(output.blocked.map(b => b.fieldId), ['group', 'id', 'group']);
  runOracle([caseFor(p, 'identity preservation')]);
});

test('header reordering rebinds selected fields and roles by exact header without changing tokens', () => {
  const p = clone(sample), permutation = [4, 2, 0, 3, 1];
  const table = { columns: permutation.map(i => p.table.columns[i]), rows: p.table.rows.map(row => permutation.map(i => row[i])) };
  const rebound = rebindProject(p, table), before = compile(p), after = compile(rebound);
  assert.equal(rebound.table.columns[rebound.settings.group], 'Track'); assert.equal(rebound.table.columns[rebound.settings.id], 'ID');
  assert.deepEqual(after.fieldMap.map(f => [f.id, f.header, f.kind]), before.fieldMap.map(f => [f.id, f.header, f.kind]));
  assert.deepEqual(after.records, before.records);
  assert.deepEqual(JSON.parse(JSON.stringify(parseProject(JSON.stringify(rebound)))), rebound);
  assert.deepEqual(rebindProject(rebound, p.table), p);
  runOracle([caseFor(rebound, 'reordered headers')]);
});

test('new source columns get new disabled tokens; missing or renamed headers never silently rebind', () => {
  const p = clone(sample), original = clone(p);
  const table = { columns: ['New column', ...p.table.columns], rows: p.table.rows.map(row => ['new', ...row]) };
  const rebound = rebindProject(p, table);
  assert.deepEqual(rebound.settings.fields.at(-1), { token: 'f006', column: 0, kind: 'text', enabled: false });
  assert.deepEqual(compile(rebound).records, compile(p).records); assert.deepEqual(p, original);
  const missing = clone(table); missing.columns[2] = 'track'; assert.throws(() => rebindProject(p, missing));
  const exhausted = clone(p); exhausted.settings.fields[0].token = 'f999'; assert.throws(() => rebindProject(exhausted, table));
});

test('boundary maximums support 2000 rows, 12 columns, 10 selected fields and capacity eight', () => {
  const table = { columns: Array.from({ length: 12 }, (_, i) => `C${i}`), rows: Array.from({ length: 2000 }, (_, r) => Array.from({ length: 12 }, (_, c) => `r${r}c${c}`)) };
  const p = createProject(table); p.settings.capacity = 8;
  assert.equal(compile(p).records.length, 250); assert.equal(compile(p).padding, 0);
  runOracle([caseFor(p, 'all maximums')]);
});

const invalidCases = [
  ['unknown schema', p => { p.schema = 'wrong'; }], ['unknown root field', p => { p.extra = true; }], ['missing settings', p => { delete p.settings; }],
  ['empty title', p => { p.title = ''; }], ['long title', p => { p.title = 'x'.repeat(121); }],
  ['zero columns', p => { p.table.columns = []; p.table.rows = [[]]; }], ['13 columns', p => { p.table.columns = Array.from({ length: 13 }, (_, i) => `C${i}`); p.table.rows = [Array(13).fill('x')]; }],
  ['duplicate headers', p => { p.table.columns[1] = p.table.columns[0]; }], ['empty header', p => { p.table.columns[0] = ''; }], ['long header', p => { p.table.columns[0] = 'x'.repeat(241); }],
  ['zero rows', p => { p.table.rows = []; }], ['2001 rows', p => { p.table.rows = Array.from({ length: 2001 }, () => [...p.table.rows[0]]); }], ['ragged row', p => { p.table.rows[0].pop(); }],
  ['non-string value', p => { p.table.rows[0][0] = null; }], ['long value', p => { p.table.rows[0][0] = 'x'.repeat(241); }], ['NUL value', p => { p.table.rows[0][0] = '\0'; }], ['unpaired surrogate', p => { p.table.rows[0][0] = '\ud800'; }],
  ['sparse rows', p => { delete p.table.rows[0]; }], ['array extra property', p => { p.table.rows.extra = true; }], ['array serialization hook', p => { p.table.rows.toJSON = () => []; }],
  ['capacity zero', p => { p.settings.capacity = 0; }], ['capacity nine', p => { p.settings.capacity = 9; }], ['fractional capacity', p => { p.settings.capacity = 1.5; }], ['string capacity', p => { p.settings.capacity = '2'; }],
  ['negative zero group', p => { p.settings.group = -0; }], ['bad group index', p => { p.settings.group = 99; }], ['bad ID index', p => { p.settings.id = '0'; }],
  ['missing field binding', p => { p.settings.fields.pop(); }], ['duplicate field column', p => { p.settings.fields[1].column = p.settings.fields[0].column; }],
  ['duplicate token', p => { p.settings.fields[1].token = p.settings.fields[0].token; }], ['zero token', p => { p.settings.fields[0].token = 'f000'; }], ['long token', p => { p.settings.fields[0].token = 'f1000'; }], ['short token', p => { p.settings.fields[0].token = 'f01'; }],
  ['nonboolean enabled', p => { p.settings.fields[0].enabled = 1; }], ['zero enabled fields', p => { p.settings.fields.forEach(f => { f.enabled = false; }); }], ['bad field kind', p => { p.settings.fields[0].kind = 'html'; }],
  ['bad profile', p => { p.settings.profile = 'other'; }], ['bad multiline policy', p => { p.settings.multiline = 'other'; }], ['generic space policy', p => { p.settings.multiline = 'space'; }], ['InDesign preserve policy', p => { p.settings.profile = 'indesign'; }],
  ['duplicate IDs', p => { p.settings.id = 0; }], ['empty ID', p => { p.settings.id = 1; p.table.rows[0][1] = ''; }],
];
for (const [name, mutate] of invalidCases) test(`strict input: rejects ${name}`, () => { const p = fixture(); mutate(p); assert.throws(() => validateProject(p)); assert.throws(() => compile(p)); });

test('Python CSV inverse recovers exact selected values via placement and change receipts', () => {
  const cases = [caseFor(sample, 'sample export', true), caseFor(multiline, 'blocked export', true)];
  const transformed = clone(multiline); transformed.settings.multiline = 'space'; cases.push(caseFor(transformed, 'space export', true));
  for (const capacity of [1, 2, 3, 4, 5, 6, 7, 8]) {
    cases.push(caseFor(fixture(undefined, capacity), `golden capacity ${capacity}`, true));
    const blank = createProject({ columns: ['Only'], rows: [[''], [''], ['']] }); blank.settings.capacity = capacity;
    cases.push(caseFor(blank, `real blank capacity ${capacity}`, true));
  }
  runOracle(cases);
});

test('seeded exported CSV inversions cover grouped order, wide records, policies and source header permutations', () => {
  const draw = random(0x1A2B3C4D), cases = [];
  const values = ['', 'plain', '  text  ', 'a,b', 'a"b', 'line\nline', 'CR\rvalue', 'CRLF\r\nvalue', 'sep\u2028value', 'para\u2029value', '=SUM(1,2)', '+formula', '-text', '@image.png', '\tleading', '\ufeffleading', '日本語🔌', 'e\u0301'];
  for (let index = 0; index < 120; index++) {
    const count = 3 + draw(10), source = { columns: Array.from({ length: count }, (_, i) => `Source ${i}`), rows: Array.from({ length: 1 + draw(14) }, (_, r) => Array.from({ length: count }, (_, c) => c === 0 ? `id-${r}` : c === 1 ? ['Red', 'Blue', '', ' Red'][draw(4)] : values[draw(values.length)])) };
    const p = createProject(source); p.settings.id = 0; p.settings.group = index % 3 ? 1 : null; p.settings.capacity = 1 + draw(8);
    p.settings.fields.forEach((f, i) => { f.enabled = i >= 2; f.kind = i % 4 === 0 ? 'image' : 'text'; });
    if (index % 2) {
      const permutation = source.columns.map((_, i) => i).reverse();
      const rebound = rebindProject(p, { columns: permutation.map(i => source.columns[i]), rows: source.rows.map(row => permutation.map(i => row[i])) });
      for (const policy of ['generic', 'block', 'space']) {
        const item = clone(rebound); item.settings.profile = policy === 'generic' ? 'generic' : 'indesign'; item.settings.multiline = policy === 'generic' ? 'preserve' : policy;
        cases.push(caseFor(item, `rebound inverse ${index} ${policy}`, true));
      }
    } else {
      for (const policy of ['generic', 'block', 'space']) {
        const item = clone(p); item.settings.profile = policy === 'generic' ? 'generic' : 'indesign'; item.settings.multiline = policy === 'generic' ? 'preserve' : policy;
        cases.push(caseFor(item, `inverse ${index} ${policy}`, true));
      }
    }
  }
  for (let start = 0; start < cases.length; start += 100) runOracle(cases.slice(start, start + 100));
});

test('adversarial original headers cannot collide with metadata, slot fields, or image indicators', () => {
  const p = createProject({ columns: ['mp_layout_record', 'slot_1_present', 'slot_1_f001', '@slot_1_f001', 'Header,"quotes"', 'line\nheader'], rows: [['1', '0', '=FORMULA()', 'images/x.png', '<script>x</script>', 'tab\tvalue'], ['', '', '', '', '', '']] });
  p.settings.capacity = 3; p.settings.fields[3].kind = 'image';
  runOracle([caseFor(p, 'header collision and quoting', true)]);
});

test('selected group/ID copies preserve raw identity rather than generating replacement receipts', () => {
  const p = createProject({ columns: ['ID', 'Group', 'Text'], rows: [['id\n1', 'A\r\nB', 'x\ny']] });
  p.settings.id = 0; p.settings.group = 1; p.settings.profile = 'indesign'; p.settings.multiline = 'space';
  const output = compile(p);
  assert.deepEqual(output.records[0].slots[0].values, ['id\n1', 'A\r\nB', 'x y']);
  assert.deepEqual(output.changes.map(change => change.column), [2]);
  assert.equal(output.blocked.filter(item => item.kind === 'identity').length, 4);
  assert.throws(() => mergeCSV(p));
  runOracle([caseFor(p, 'selected identities', true)]);
});

test('disabled multiline nonidentity fields do not block conservative merge exports', () => {
  const p = createProject({ columns: ['Selected', 'Disabled'], rows: [['plain', 'x\ny']] });
  p.settings.fields[1].enabled = false; p.settings.profile = 'indesign'; p.settings.multiline = 'block';
  assert.equal(compile(p).mergeAllowed, true);
  runOracle([caseFor(p, 'disabled multiline', true)]);
});

test('source rebind returns a staged candidate whose new ID conflicts cannot compile or export', () => {
  const source = clone(sample.table); source.rows[1][0] = source.rows[0][0];
  const candidate = rebindProject(sample, source);
  assert.throws(() => compile(candidate)); assert.throws(() => mergeCSV(candidate)); assert.throws(() => exportsFor(candidate));
});

test('exports and project JSON are deterministic and exact through reorder/reimport', () => {
  const p = clone(sample); p.table.rows[0][2] = 'a,"b"\r\n日本語';
  const before = clone(p), first = exportsFor(p);
  assert.deepEqual(exportsFor(clone(p)), first);
  assert.deepEqual(parseProject(projectJSON(p)), p);
  assert.deepEqual(parseProject('\ufeff' + projectJSON(p)), p);
  assert.deepEqual(exportsFor(parseProject(projectJSON(p))), first);
  assert.deepEqual(p, before);
});

test('largest supported wide export inverts all 2000 records and ten selected fields', () => {
  const p = createProject({ columns: Array.from({ length: 12 }, (_, i) => `Header ${i}`), rows: Array.from({ length: 2000 }, (_, r) => Array.from({ length: 12 }, (_, c) => `row ${r}, column "${c}"`)) });
  p.settings.capacity = 8;
  runOracle([caseFor(p, 'maximum CSV inverse', true)]);
});

test('oracle mutation self-check detects missing rows, wrong groups, padding confusion, receipts and CSV corruption', () => {
  const base = fixture([['Red', 'A1'], ['Blue', 'B1'], ['Red', 'A2'], ['Blue', 'B2'], ['Blue', 'B3']]);
  const mutations = [
    ['missing placement', item => { item.actual.placements.pop(); }],
    ['duplicate source placement', item => { item.actual.placements[1].row = item.actual.placements[0].row; }],
    ['real row changed to padding', item => { item.actual.records[0].slots[0].present = false; }],
    ['padding gets a row ID', item => { item.actual.records.at(-1).slots.at(-1).row = 99; }],
    ['wrong group order', item => { item.actual.groups.reverse(); }],
    ['wrong group chunk count', item => { item.actual.records[1].groupRecords++; }],
    ['wrong source value', item => { item.actual.records[0].slots[0].values[1] = 'CORRUPTED'; }],
    ['wrong padding count', item => { item.actual.padding++; }],
    ['wrong field header', item => { item.actual.fieldMap[0].header = 'wrong'; }],
    ['machine CSV corruption', item => { item.files.find(file => file.key === 'merge').content = item.files.find(file => file.key === 'merge').content.replace('A1', 'CORRUPTED'); }],
    ['placement JSON corruption', item => { const file = item.files.find(file => file.key === 'placement-json'); const data = JSON.parse(file.content); data.placements[0].slot = 2; file.content = JSON.stringify(data); }],
  ];
  runOracle(mutations.map(([name, mutate]) => { const item = caseFor(base, name, true); mutate(item); return item; }), false);
  const transformed = clone(multiline); transformed.settings.multiline = 'space';
  const wrongReceipt = caseFor(transformed, 'wrong replacement receipt', true);
  const file = wrongReceipt.files.find(file => file.key === 'changes'); const data = JSON.parse(file.content); data.changes[0].replacement = 'WRONG'; file.content = JSON.stringify(data);
  runOracle([wrongReceipt], false);
});

function quoted(table, delimiter = ',') { return [table.columns, ...table.rows].map(row => row.map(value => '"' + value.replaceAll('"', '""') + '"').join(delimiter)).join('\r\n') + '\r\n'; }

test('CSV/TSV source round-trips exact delimiters, line breaks, quotes, formulas, image paths and BOM values', () => {
  const table = { columns: ['@Images', 'Text,"header"', 'Group'], rows: [['C:\\images\\a,b "quote".png', 'x\r\ny\u2028z', ''], ['=SUM(1,2)', '\ufeffvalue', ' '], ['', '', '']] };
  for (const delimiter of [',', '\t']) {
    assert.deepEqual(parseDelimited(quoted(table, delimiter), delimiter), table);
    assert.deepEqual(parseDelimited('\ufeff' + quoted(table, delimiter), delimiter), table);
  }
  const p = createProject(table); p.settings.fields[0].kind = 'image';
  runOracle([caseFor(p, 'quoted source and inverse', true)]);
});

test('strict delimited grammar and duplicate-key JSON cannot silently change source records', () => {
  const invalid = ['', 'Header', 'A,A\nx,y', 'A,B\nx', 'A,B\nx,y,z', 'A,B\n"x,y', 'A,B\nx"x,y', 'A,B\n"x"bad,y', 'A,B\rvalue,value', 'A,B\nx,y\n\n'];
  for (const raw of invalid) assert.throws(() => parseDelimited(raw));
  const source = projectJSON(sample);
  assert.throws(() => parseProject(source.replace('"title":', '"schema":"duplicate","title":')));
  assert.throws(() => parseProject(source.replace('"title":', '"\\u0073chema":"duplicate","title":')));
  assert.throws(() => parseProject(source + '{}'));
});

test('the selected-field cap rejects eleven enabled fields while permitting ten', () => {
  const p = createProject({ columns: Array.from({ length: 12 }, (_, i) => `C${i}`), rows: [Array(12).fill('value')] });
  assert.equal(compile(p).fieldMap.length, 10);
  p.settings.fields[10].enabled = true;
  assert.throws(() => validateProject(p)); assert.throws(() => mergeCSV(p));
});

test('maximum-length Unicode cells preserve exact text and longer cells fail', () => {
  const p = createProject({ columns: ['Text'], rows: [['日'.repeat(240)], ['🔌'.repeat(120)]] });
  assert.deepEqual(parseProject(projectJSON(p)), p);
  assert.equal(compile(p).records[0].slots[1].values[0], '🔌'.repeat(120));
  p.table.rows[1][0] += '🔌'; assert.throws(() => validateProject(p));
});
