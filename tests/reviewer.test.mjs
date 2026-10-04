import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createProject, compile, parseProject, parseDelimited, validateProject, rebindProject } from '../src/core.mjs';
import { exportsFor, proofHTML, projectJSON } from '../src/export.mjs';
import { Session, tableText } from '../src/state.mjs';
import { sample } from '../src/examples.mjs';
import { createDOM } from './dom-stub.mjs';

let serial = 0;
async function app() {
  const dom = createDOM();
  globalThis.document = dom.document;
  globalThis.window = dom.window;
  dom.window.confirm = () => true;
  await import(`../src/app.mjs?reviewer=${serial++}`);
  const get = id => dom.document.getElementById(id);
  return {
    ...dom, get,
    change: async (id, value, type = 'change') => {
      const el = get(id); el.value = value; await el.emit(type);
    },
    click: async selector => {
      const el = dom.document.querySelector(selector); assert.ok(el, selector);
      await el.emit('click'); await get('app').emit('click', { target: el });
    },
  };
}

// Independent reader: Python parses the delivered files, calculates each row's
// destination by its rank among equal keys, then verifies every exported cell.
// It imports no production code and no existing oracle helper.
const inverseOracle = String.raw`
import sys,json,csv,io,re,math
cases=json.load(sys.stdin)
for case in cases:
 p=case['project']; files={f['name']:f['content'] for f in case['files']}; s=p['settings']; rows=p['table']['rows']; fields=[f for f in s['fields'] if f['enabled']]; k=s['capacity']
 keys=[None if s['group'] is None else r[s['group']] for r in rows]
 distinct=list(dict.fromkeys(keys)); sizes=[keys.count(g) for g in distinct]
 starts=[sum(math.ceil(n/k) for n in sizes[:i]) for i in range(len(distinct))]
 expected=[]
 for row_index,row in enumerate(rows):
  g=distinct.index(keys[row_index]); rank=keys[:row_index].count(keys[row_index]); record=starts[g]+rank//k+1; slot=rank%k+1
  expected.append((record,slot,row_index+1,g+1,rank//k+1))
 expected.sort(); evidence=json.loads(files['placement.json']); changes=json.loads(files['changes.json'])
 assert json.loads(files['mergepanel-project.json'])==p
 assert evidence['settings']==s and evidence['sourceColumns']==p['table']['columns']
 assert [(v['record'],v['slot'],v['row'],int(v['groupId'][1:]),v['groupRecord']) for v in evidence['placements']]==expected
 assert evidence['regrouped']==([e[2] for e in expected]!=list(range(1,len(rows)+1)))
 line=re.compile(r'\r\n|[\r\n\u2028\u2029]'); wanted_changes=[]; wanted_blocked=[]
 for ri,row in enumerate(rows,1):
  if s['profile']=='indesign':
   for f in fields:
    value=row[f['column']]
    if not line.search(value): continue
    identity=f['column'] in (s['group'],s['id'])
    if identity or f['kind']=='image' or s['multiline']=='block': wanted_blocked.append((ri,f['column'],f['token'],'identity' if identity else f['kind'],value))
    else: wanted_changes.append((ri,f['column'],f['token'],value,line.sub(' ',value),len(line.findall(value))))
   for role in ['group','id']:
    col=s[role]
    if col is not None and line.search(row[col]): wanted_blocked.append((ri,col,role,'identity',row[col]))
 assert sorted((v['row'],v['column'],v['fieldId'],v['original'],v['replacement'],v['breaks']) for v in changes['changes'])==sorted(wanted_changes)
 assert sorted((v['row'],v['column'],v['fieldId'],v['kind'],v['value']) for v in changes['blocked'])==sorted(wanted_blocked)
 assert changes['mergeAllowed']==(not wanted_blocked)
 assert ('merge.csv' in files)==(not wanted_blocked)
 assert ('merge-spreadsheet-review.csv' in files)==(not wanted_blocked)
 placements=list(csv.reader(io.StringIO(files['placement.csv'],newline='')))
 assert len(placements)==len(rows)+1
 for data,(record,slot,ri,g,chunk) in zip(placements[1:],expected):
  row=rows[ri-1]; eid='' if s['id'] is None else row[s['id']]; group='' if s['group'] is None else keys[ri-1]
  assert data==[str(ri),eid,str(s['id'] is not None).lower(),str(record),str(slot),str(g),group,str(s['group'] is not None).lower(),str(chunk)]
 if wanted_blocked: continue
 data=list(csv.reader(io.StringIO(files['merge.csv'],newline=''))); review=list(csv.reader(io.StringIO(files['merge-spreadsheet-review.csv'],newline='')))
 head=['mp_layout_record','mp_grouped','mp_group_index','mp_group_label','mp_group_chunk','mp_group_chunks','mp_slot_count']
 for slot in range(1,k+1):
  head += [f'slot_{slot}_present',f'slot_{slot}_source_record',f'slot_{slot}_source_id']
  head += [('@' if f['kind']=='image' else '')+f'slot_{slot}_{f["token"]}' for f in fields]
 assert data[0]==head and len(set(head))==len(head)
 count=sum(math.ceil(n/k) for n in sizes); assert len(data)==count+1
 coordinates={(record,slot):ri for record,slot,ri,_,_ in expected}
 transforms={(ri,col):after for ri,col,_,_,after,_ in wanted_changes}
 for record,actual in enumerate(data[1:],1):
  g=max(i for i,start in enumerate(starts) if start<record); occupied=sum((record,slot) in coordinates for slot in range(1,k+1))
  want=[str(record),str(int(s['group'] is not None)),str(g+1),'' if distinct[g] is None else distinct[g],str(record-starts[g]),str(math.ceil(sizes[g]/k)),str(occupied)]
  for slot in range(1,k+1):
   ri=coordinates.get((record,slot))
   if ri is None: want += ['0','','']+['']*len(fields)
   else:
    row=rows[ri-1]; want += ['1',str(ri),'' if s['id'] is None else row[s['id']]]+[transforms.get((ri,f['column']),row[f['column']]) for f in fields]
  assert actual==want,(record,actual,want)
 for ri,(machine,safe) in enumerate(zip(data,review)):
  assert len(machine)==len(safe)
  for a,b in zip(machine,safe):
   risky=re.match(r'^[\s\ufeff]*[=+@-]',a) or re.match(r'^[\t\r\n]',a)
   assert b==("'"+a if risky else a)
 assert len(review)==len(data)
print(len(cases))
`;
function checkInverse(cases, pass = true) {
  const result = spawnSync('python3', ['-c', inverseOracle], {
    input: JSON.stringify(cases), encoding: 'utf8', maxBuffer: 16 * 1024 * 1024,
  });
  assert.equal(result.error, undefined);
  if (pass) { assert.equal(result.status, 0, result.stderr); assert.equal(Number(result.stdout), cases.length); }
  else assert.notEqual(result.status, 0, 'the independent oracle must reject deliberate corruption');
}
function fixture(capacity, policy, grouping, ids) {
  const groups = ['A', '', 'A', ' A', '', 'é', 'e\u0301', 'é', '__proto__'];
  const p = createProject({
    columns: ['Key', 'Group', 'Text', '@Image', 'Blank', 'Unselected'],
    rows: groups.map((g, i) => [`00${i}`, g, ['=SUM(1,2)', ' x\r\ny\rz\n\u2028\u2029 ', '"quoted"'][i % 3], `../画像/${i}, "x".png`, i % 2 ? '(empty string)' : '', 'hidden\r\nline']),
  });
  p.settings.capacity = capacity; p.settings.group = grouping ? 1 : null; p.settings.id = ids ? 0 : null;
  p.settings.fields.reverse();
  p.settings.fields.forEach((f, i) => { f.token = `f${900 + i}`; f.enabled = f.column !== 5; f.kind = f.column === 3 ? 'image' : 'text'; });
  p.settings.profile = policy === 'generic' ? 'generic' : 'indesign';
  p.settings.multiline = policy === 'generic' ? 'preserve' : policy;
  return p;
}

test('reviewer: 96 independent Python handoff checks preserve identities, policies, padding and tokens', () => {
  const cases = [];
  for (let capacity = 1; capacity <= 8; capacity++) for (const policy of ['generic', 'block', 'space']) for (const grouping of [false, true]) for (const ids of [false, true]) {
    const p = fixture(capacity, policy, grouping, ids); const before = structuredClone(p);
    const files = exportsFor(p); assert.deepEqual(p, before);
    cases.push({ project: p, files });
  }
  assert.equal(cases.length, 96); checkInverse(cases);
});

test('reviewer: independent inverse rejects six plausible corruptions', () => {
  const p = fixture(2, 'space', true, true);
  const original = { project: p, files: exportsFor(p) };
  const mutations = [
    c => { const f = c.files.find(f => f.name === 'merge.csv'); f.content = f.content.replace('@slot_1_', 'slot_1_'); },
    c => { const f = c.files.find(f => f.name === 'merge.csv'); f.content = f.content.replace('"=SUM(1,2)"', '"=SUM(1,3)"'); },
    c => { const f = c.files.find(f => f.name === 'placement.json'); const v = JSON.parse(f.content); v.placements.reverse(); f.content = JSON.stringify(v); },
    c => { const f = c.files.find(f => f.name === 'changes.json'); const v = JSON.parse(f.content); v.changes.pop(); f.content = JSON.stringify(v); },
    c => { c.files.find(f => f.name === 'merge-spreadsheet-review.csv').content = c.files.find(f => f.name === 'merge.csv').content; },
    c => { const f = c.files.find(f => f.name === 'placement.csv'); f.content = f.content.replace('true', 'false'); },
  ];
  for (const mutate of mutations) { const c = structuredClone(original); mutate(c); checkInverse([c], false); }
});

test('reviewer: source update retains current draft recipe and exact tokens', () => {
  const s = new Session(sample);
  s.edit(p => { p.title = 'Pending recipe'; p.settings.capacity = 1; p.settings.fields[2].kind = 'image'; });
  const recipe = structuredClone(s.draft.settings), order = [4, 2, 0, 3, 1];
  const table = { columns: order.map(i => sample.table.columns[i]), rows: sample.table.rows.map(row => order.map(i => row[i])) };
  s.setSourceAction('update'); s.changeSource(tableText({ table }, 'csv')); s.stage();
  assert.equal(s.draft.title, 'Pending recipe'); assert.equal(s.draft.settings.capacity, 1);
  for (const old of recipe.fields) {
    const now = s.draft.settings.fields.find(f => f.token === old.token);
    assert.equal(now.column, order.indexOf(old.column)); assert.equal(now.kind, old.kind); assert.equal(now.enabled, old.enabled);
  }
  assert.equal(s.result.capacity, sample.settings.capacity); s.apply(); assert.equal(s.result.capacity, 1);
});

test('reviewer: current draft survives actual-handler source update', async () => {
  const a = await app(); await a.change('title', 'Visible pending recipe', 'input'); await a.change('capacity', '1');
  await a.change('source-action', 'update'); await a.change('source', tableText(sample, 'csv'), 'input'); await a.click('#read');
  assert.equal(a.get('title').value, 'Visible pending recipe'); assert.equal(a.get('capacity').value, '1');
  assert.equal(a.document.querySelector('[data-export="project"]').disabled, true);
  await a.click('#apply'); assert.equal(a.get('record-count').textContent, '7');
});

test('reviewer: proof distinguishes empty data from a literal marker string', () => {
  const p = createProject({ columns: ['Value'], rows: [['']] });
  const q = structuredClone(p); q.table.rows[0][0] = '(empty string)';
  const parse = html => { const { document } = createDOM(); const host = document.getElementById('app'); host.innerHTML = html; return host.textContent; };
  assert.notEqual(proofHTML(p), proofHTML(q));
  assert.notEqual(parse(proofHTML(p)), parse(proofHTML(q)), 'visible report text must distinguish source values');
});

test('reviewer: validators reject getters and unusual arrays before serialization', () => {
  let calls = 0;
  for (const mutate of [
    p => Object.defineProperty(p, 'settings', { enumerable: true, get() { calls++; return {}; } }),
    p => Object.defineProperty(p.table.rows[0], '0', { enumerable: true, get() { calls++; return 'x'; } }),
    p => Object.setPrototypeOf(p.table.rows, Object.create(Array.prototype)),
    p => Object.defineProperty(p.settings.fields[0], 'kind', { enumerable: false, value: 'text' }),
  ]) {
    const p = structuredClone(sample); mutate(p); assert.throws(() => validateProject(p)); assert.throws(() => exportsFor(p));
  }
  assert.equal(calls, 0);
});

test('reviewer: Unicode identities stay exact through repeated header permutation and JSON reimport', () => {
  let p = fixture(3, 'space', true, true);
  p.table.columns[4] = '\ufeffliteral BOM';
  const before = compile(p), bindings = p.settings.fields.map(f => [f.token, p.table.columns[f.column], f.kind]);
  for (let step = 0; step < 60; step++) {
    const order = step % 2 ? [5, 4, 3, 2, 1, 0] : [2, 3, 4, 5, 0, 1];
    p = rebindProject(p, { columns: order.map(i => p.table.columns[i]), rows: p.table.rows.map(row => order.map(i => row[i])) });
    p = parseProject(projectJSON(p));
    assert.deepEqual(p.settings.fields.map(f => [f.token, p.table.columns[f.column], f.kind]), bindings);
    assert.deepEqual(compile(p).records, before.records);
    for (const format of ['csv', 'tsv']) assert.deepEqual(parseDelimited(tableText(p, format), format === 'csv' ? ',' : '\t'), p.table);
  }
});

test('reviewer: oversized replacement invalidates old pending read without altering a successful recipe', async () => {
  const s = new Session(sample); let release;
  const pending = s.readFile({ size: 10, arrayBuffer: () => new Promise(resolve => { release = resolve; }) });
  const before = structuredClone(s.project), source = s.source;
  await assert.rejects(s.readFile({ size: 33_554_433, arrayBuffer() { throw new Error('must not read'); } }), /32 MiB/);
  release(new TextEncoder().encode('Old\nfile').buffer); assert.equal(await pending, false);
  assert.equal(s.source, source); assert.deepEqual(s.project, before); assert.equal(s.dirty, false);
});

test('reviewer: failed newer stage and apply invalidate pending reads', async () => {
  for (const action of ['stage', 'apply']) {
    const s = new Session(sample);
    if (action === 'stage') s.changeSource('A,B\nragged');
    else s.edit(p => { p.settings.capacity = 9; });
    let release;
    const pending = s.readFile({ size: 10, arrayBuffer: () => new Promise(resolve => { release = resolve; }) });
    const source = s.source, draft = structuredClone(s.draft);
    assert.throws(() => s[action]());
    release(new TextEncoder().encode('Late\nfile').buffer);
    assert.equal(await pending, false, `${action} must invalidate reads even on rejection`);
    assert.equal(s.source, source); assert.deepEqual(s.draft, draft); assert.deepEqual(s.project, sample);
  }
});

test('reviewer: source and slot inspectors distinguish empty values from literal markers', async () => {
  const a = await app(), seen = [];
  for (const value of ['', '(empty string)']) {
    const p = createProject({ columns: ['Value'], rows: [[value]] });
    await a.change('format', 'project'); await a.change('source', projectJSON(p), 'input'); await a.click('#read'); await a.click('#apply');
    await a.click('[data-row="1"]');
    seen.push({ slot: a.get('slots').textContent, source: a.get('source-detail').textContent });
  }
  assert.notEqual(seen[0].slot, seen[1].slot);
  assert.notEqual(seen[0].source, seen[1].source);
});

test('reviewer: an invalid recipe can still be corrected after source-update staging', async () => {
  const a = await app();
  await a.change('title', '', 'input'); await a.change('source-action', 'update');
  const p = structuredClone(sample); p.table.rows[0][2] = 'Changed source content';
  await a.change('source', tableText(p, 'csv'), 'input'); await a.click('#read');
  assert.equal(a.get('recipe').disabled, false, 'a failed recipe validation must not make its correction controls inaccessible');
  await a.change('title', 'Corrected draft', 'input');
  if (a.get('apply').disabled) await a.click('#read');
  await a.click('#apply');
  assert.equal(a.get('title').value, 'Corrected draft');
  assert.ok(a.get('slots').textContent.includes('Changed source content'));
});

test('reviewer: source updates bind to a newly staged table before its first apply', () => {
  const s = new Session(sample);
  s.changeSource('New,Other\nvalue,other'); s.stage();
  s.edit(p => { p.title = 'New draft'; p.settings.capacity = 2; p.settings.fields[1].kind = 'image'; });
  s.setSourceAction('update'); s.changeSource('Other,New\nnew-image,new-value');
  s.stage(); s.apply();
  assert.equal(s.project.title, 'New draft'); assert.equal(s.result.capacity, 2);
  assert.deepEqual(s.result.fieldMap.map(f => [f.id, f.header, f.kind]), [['f001', 'New', 'text'], ['f002', 'Other', 'image']]);
  assert.deepEqual(s.result.records[0].slots[0].values, ['new-value', 'new-image']);
});

test('reviewer: oversized proof is refused within 128 MiB while separate machine/project exports remain usable', () => {
  const result = spawnSync(process.execPath, ['--max-old-space-size=128', '--input-type=module', '-e', `
    import assert from 'node:assert/strict';
    import {createProject,parseProject} from './src/core.mjs';
    import {proofHTML,exportFile,MAX_PROOF_BYTES} from './src/export.mjs';
    const p=createProject({columns:Array.from({length:12},(_,i)=>String(i)+'&'.repeat(238)),rows:Array.from({length:2000},(_,r)=>Array.from({length:12},(_,c)=>c===0?String(r)+'&'.repeat(235):'&'.repeat(240)))});
    p.settings.group=0;p.settings.capacity=8;
    assert.equal(MAX_PROOF_BYTES,8*1024*1024);
    assert.throws(()=>proofHTML(p),error=>error.name==='ValidationError'&&/proof/i.test(error.message)&&/8 MiB|8388608|8,388,608/.test(error.message));
    const machine=exportFile(p,'merge');assert.equal(machine.name,'merge.csv');assert.ok(machine.content.includes('slot_8_f010'));
    const placement=exportFile(p,'placements');assert.equal(placement.content.split('\\r\\n').length,2002);
    const saved=exportFile(p,'project');assert.equal(parseProject(saved.content).table.rows.length,2000);
    console.log('bounded proof; machine, placement, and project available');
  `], { encoding: 'utf8', maxBuffer: 1024 * 1024, cwd: new URL('..', import.meta.url), timeout: 30_000 });
  assert.equal(result.error, undefined, result.error?.message);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /bounded proof/);
});

test('reviewer: proof budget accounts for UTF-8 and HTML expansion', async () => {
  const { MAX_PROOF_BYTES } = await import('../src/export.mjs');
  for (const value of ['界', '&']) {
    const p = createProject({
      columns: Array.from({ length: 10 }, (_, i) => String(i) + value.repeat(238)),
      rows: Array.from({ length: 600 }, () => Array(10).fill(value.repeat(240))),
    });
    p.settings.capacity = 1;
    assert.ok(Buffer.byteLength(projectJSON(p)) < MAX_PROOF_BYTES, 'small project can expand into an oversized report');
    assert.throws(() => proofHTML(p), /proof/i);
    p.table.rows = p.table.rows.slice(0, 10);
    const html = proofHTML(p);
    assert.ok(Buffer.byteLength(html) <= MAX_PROOF_BYTES); assert.ok(html.endsWith('</body></html>'));
  }
});

test('reviewer: actual export handler preserves other downloads after oversized proof refusal', async () => {
  const a = await app();
  const p = createProject({
    columns: Array.from({ length: 10 }, (_, i) => String(i) + '界'.repeat(238)),
    rows: Array.from({ length: 600 }, () => Array(10).fill('界'.repeat(240))),
  });
  p.settings.capacity = 1;
  await a.change('format', 'project'); await a.change('source', projectJSON(p), 'input'); await a.click('#read'); await a.click('#apply');
  const originalCreate = URL.createObjectURL, originalRevoke = URL.revokeObjectURL, downloads = [];
  URL.createObjectURL = blob => { downloads.push(blob); return 'blob:reviewer'; };
  URL.revokeObjectURL = () => {};
  try {
    await a.click('[data-export="proof"]'); assert.equal(downloads.length, 0); assert.match(a.get('notice').textContent, /proof/i);
    await a.click('[data-export="merge"]'); assert.equal(downloads.length, 1);
    await a.click('[data-export="project"]'); assert.equal(downloads.length, 2);
    assert.equal(parseProject(await downloads[1].text()).table.rows.length, 600);
    assert.equal(a.get('record-count').textContent, '600'); assert.equal(a.get('dirty').hidden, true);
  } finally { URL.createObjectURL = originalCreate; URL.revokeObjectURL = originalRevoke; }
});
