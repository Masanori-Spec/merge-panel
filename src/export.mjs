import {compile,validateProject,ValidationError} from './core.mjs';
export const escapeHTML=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
// Quotation marks identify literal data; unquoted badges identify synthetic states.
// The inner span retains the exact string, including line breaks, for inspection.
export const valueHTML=(value,{empty='Empty string',absent='Not set'}={})=>value===null||value===''?`<span class="value-marker">${escapeHTML(value===null?absent:empty)}</span>`:`<span class="literal-value">“<span class="literal-text">${escapeHTML(value)}</span>”</span>`;
const json=x=>JSON.stringify(x,null,2)+'\n';
export function csv(rows,review=false){return rows.map(row=>row.map(value=>{let s=String(value??'');if(review&&typeof value==='string'&&(/^[\s\ufeff]*[=+@-]/u.test(s)||/^[\t\r\n]/u.test(s)))s="'"+s;return /[",\r\n]/.test(s)||s.startsWith('\ufeff')?'"'+s.replaceAll('"','""')+'"':s;}).join(',')).join('\r\n')+'\r\n';}
export const projectJSON=p=>json(validateProject(p));
export const slotField=(slot,field)=>`${field.kind==='image'?'@':''}slot_${slot}_${field.id}`;
export function mergeRows(r){
  const headers=['mp_layout_record','mp_grouped','mp_group_index','mp_group_label','mp_group_chunk','mp_group_chunks','mp_slot_count'];
  for(let slot=1;slot<=r.capacity;slot++)headers.push(`slot_${slot}_present`,`slot_${slot}_source_record`,`slot_${slot}_source_id`,...r.fieldMap.map(f=>slotField(slot,f)));
  return [headers,...r.records.map(record=>[record.ordinal,r.groups[0].value===null?0:1,Number(record.groupId.slice(1)),record.groupValue??'',record.groupRecord,record.groupRecords,record.occupied,...record.slots.flatMap(slot=>[slot.present?1:0,slot.row??'',slot.itemId??'',...slot.values])])];
}
export function mergeCSV(p,review=false){const r=compile(p);if(!r.mergeAllowed)throw new ValidationError(`Merge export blocked: ${r.blocked.length} multiline field/identity occurrences. Review the policy report.`);return csv(mergeRows(r),review);}
const css='body{font:14px/1.55 system-ui,sans-serif;color:#28343d;max-width:1100px;margin:32px auto;padding:0 24px}h1{font-size:30px}h2{font-size:20px;margin-top:28px}h3{font-size:15px}p{overflow-wrap:anywhere}table{border-collapse:collapse;width:100%;table-layout:fixed}th,td{border:1px solid #cfd9df;padding:8px;text-align:left;overflow-wrap:anywhere;white-space:pre-wrap}th{background:#eff3f5}small{color:#566e7a}.note{background:#fff4dd;border-left:4px solid #b28a35;padding:12px 16px}.record{border:1px solid #c7d4dc;border-radius:10px;margin:20px 0;padding:16px}.slots{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.slot{border:1px solid #d9e1e6;padding:12px;border-radius:6px;min-width:0}.padding{background:#f3f5f7;border-style:dashed}.value{white-space:pre-wrap;overflow-wrap:anywhere}.value-marker{display:inline-block;border:1px dashed #647b89;border-radius:4px;padding:1px 6px;font-size:12px;color:#455c68;background:#f1f5f7}.literal-value{white-space:pre-wrap}.field{margin:9px 0}.field b{display:block;font-size:10px;color:#607a87}code{overflow-wrap:anywhere}a{color:#245f83}@media(max-width:600px){.slots{grid-template-columns:1fr}body{padding:0 15px}}@media print{body{font-size:10px;margin:0}h2,h3{break-after:avoid}thead{display:table-header-group}tr,.slot{break-inside:avoid}.record{break-inside:auto}.slots{display:block}.slot{margin-bottom:10px}}';
const documentStart=title=>`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHTML(title)}</title><style>${css}</style></head><body>`;
const documentEnd='</body></html>';
function document(title,body){return documentStart(title)+body+documentEnd;}
export function fieldsHTML(p,r=compile(p)){
  const e=escapeHTML;
  return document(`${p.title} · Field bindings`,`<p>MERGEPANEL / FIELD BINDINGS / v0.1.0</p><h1>${e(p.title)}</h1><p>${r.capacity} slots per layout record · ${r.records.length} layout records · ${r.inputRows} source records · ${r.padding} padding slots</p><div class="note">A layout record is one output data row, not a page. This tool does not predict pagination, frame removal, text overset, typography or image availability. A blank merge field does not remove its template frame.</div><h2>Use a fixed-slot template</h2><p>Bind one output record to your existing template's repeated slot frames. Insert real fields using the application's Data Merge panel. Do not type bracketed field names and assume they are placeholders. The field tokens below persist within the saved recipe; exact original headers identify source columns during an Update source operation.</p><h2>Binding map</h2><table><thead><tr><th>Generated field</th><th>Source column</th><th>Exact original header</th><th>Kind</th></tr></thead><tbody>${Array.from({length:r.capacity},(_,i)=>r.fieldMap.map(f=>`<tr><td>${slotField(i+1,f)}</td><td>${f.column+1}</td><td>${e(f.header)}</td><td>${f.kind}</td></tr>`).join('')).join('')}</tbody></table><h2>Metadata fields</h2><p>mp_layout_record, mp_group_index and group chunk counters are one-based. mp_grouped distinguishes disabled grouping from an exact blank group label. mp_slot_count is occupied slots in that record. Each slot has present (1 or 0), source_record (data ordinal after the header, not physical line number) and source_id (exact selected ID, or empty). Padding has present=0 and empty source/value fields. Real blank source records have present=1.</p><h2>Grouping and order</h2><p>Group order follows first appearance; source order is retained inside each group. Equal noncontiguous groups are collected together. Global source order ${r.regrouped?'has changed':'has not changed'}. placement.csv / placement.json records every source row's destination; project JSON retains the complete original table, including unselected columns.</p><h2>Image fields</h2><p>The @ prefix is the first character of each explicitly selected image-path field. Paths are copied unchanged. MergePanel never opens, fetches, resolves, rewrites or packages images. Relative paths depend on the exported data file's location. Asset existence, permissions and native import must be checked separately.</p><h2>Multiline policy</h2><p>Profile: ${e(r.profile)}; policy: ${e(r.multiline)}. Generic mode preserves quoted line breaks. The conservative InDesign mode blocks multiline values by default; explicit space mode replaces each CRLF pair, lone CR/LF or Unicode line/paragraph separator in selected text with one space and records every changed cell. Image paths and group/ID identities are always blocked if multiline in that profile. Adobe's current source-file page contains both a prohibition and a quoted-multiline support statement; this is our conservative policy, not a claim that InDesign cannot support multiline.</p><p>Merge export ${r.mergeAllowed?'is allowed under the selected policy':'is blocked under the selected policy'}. Changed cells: ${r.changes.length}. Blocked occurrences: ${r.blocked.length}. Keep changes.json with any transformed output. No named InDesign version has been tested.</p><h2>CSV handling</h2><p>Machine merge.csv preserves the selected policy's values and image headers. Quoting does not neutralize spreadsheet formulas. The separate review CSV prefixes formula-like text with an apostrophe, including @ image headers, and must not be used for native merge or exact round trips. Spreadsheet handling varies.</p><h2>Primary sources</h2><p><a href="https://helpx.adobe.com/indesign/desktop/automation-and-scripting/merge-data/data-source-files-overview.html">Adobe source-file requirements</a> · <a href="https://helpx.adobe.com/indesign/desktop/automation-and-scripting/merge-data/add-and-edit-data-fields.html">Adobe field and image binding</a></p>`);
}
export const MAX_PROOF_BYTES=8*1024*1024;
export function proofHTML(p,r=compile(p)){
  const e=escapeHTML,parts=[],encoder=new TextEncoder();let bytes=0;
  const add=part=>{
    bytes+=encoder.encode(part).byteLength;
    if(bytes>MAX_PROOF_BYTES)throw new ValidationError('Complete proof exceeds 8 MiB. No partial proof was exported. Other eligible downloads remain available.');
    parts.push(part);
  };
  add(documentStart(`${p.title} · Slot proof`));
  add(`<p>MERGEPANEL / LOGICAL SLOT PROOF / v0.1.0</p><h1>${e(p.title)}</h1><p>${r.inputRows} source records → ${r.records.length} layout records · ${r.padding} padding slots</p><div class="note">Logical placement proof only. These are layout records, not predicted pages or native document geometry. ${r.regrouped?'Grouping changed the global source order.':'Global source order is unchanged.'} Profile ${r.profile}, multiline ${r.multiline}. ${r.mergeAllowed?'Merge export is allowed.':'Merge export is blocked.'} ${r.changes.length} changed cells; ${r.blocked.length} blocked occurrences. Image paths are text references only. Quoted values are literal data; unquoted badges identify empty values or unset roles.</div>`);
  // Every record is independently bounded by capacity, field and string limits.
  // Account for each record before retaining it; never build the whole oversized body.
  for(const record of r.records){
    add(`<section class="record"><h2>Layout record ${record.ordinal} · ${record.groupId} · chunk ${record.groupRecord}/${record.groupRecords}</h2><p class="value">Group: ${valueHTML(record.groupValue,{empty:'Blank exact group',absent:'Grouping disabled'})}</p><div class="slots">${record.slots.map(slot=>`<article class="slot${slot.present?'':' padding'}"><h3>Layout record ${record.ordinal} · Slot ${slot.slot} · ${slot.present?`source record ${slot.row}`:'padding'}</h3>${slot.present?`<p class="value">ID: ${valueHTML(slot.itemId,{absent:'Ordinal identity'})}</p>${r.fieldMap.map((f,i)=>`<div class="field"><b>${e(f.header)} · ${slotField(slot.slot,f)}</b><div class="value">${valueHTML(slot.values[i])}</div>${slot.values[i]!==slot.originalValues[i]?`<small class="value">Original: ${valueHTML(slot.originalValues[i])}</small>`:''}</div>`).join('')}`:'<p>present=0 · source and value fields are empty</p>'}</article>`).join('')}</div></section>`);
  }
  add(documentEnd);return parts.join('');
}
const file=(key,name,mime,content)=>({key,name,mime,content});
function buildExport(p,r,key){
  if(key==='project')return file(key,'mergepanel-project.json','application/json',projectJSON(p));
  if(key==='merge'||key==='review'){
    if(!r.mergeAllowed)throw new ValidationError(`Merge export blocked: ${r.blocked.length} multiline field/identity occurrences. Review the policy report.`);
    return file(key,key==='merge'?'merge.csv':'merge-spreadsheet-review.csv','text/csv',csv(mergeRows(r),key==='review'));
  }
  if(key==='placements')return file(key,'placement.csv','text/csv',csv([['source_record','source_id','id_present','layout_record','slot','group_index','group_value','grouping_enabled','group_chunk'],...r.placements.map(x=>[x.row,x.itemId??'',x.itemId!==null,x.record,x.slot,Number(x.groupId.slice(1)),x.groupValue??'',x.groupValue!==null,x.groupRecord])]));
  if(key==='placement-json')return file(key,'placement.json','application/json',json({schema:'mergepanel.placement.v1',title:p.title,settings:p.settings,sourceColumns:p.table.columns,fieldMap:r.fieldMap,groups:r.groups,regrouped:r.regrouped,records:r.records,placements:r.placements}));
  if(key==='changes')return file(key,'changes.json','application/json',json({schema:'mergepanel.changes.v1',profile:r.profile,multiline:r.multiline,mergeAllowed:r.mergeAllowed,changes:r.changes,blocked:r.blocked}));
  if(key==='fields')return file(key,'fields.html','text/html',fieldsHTML(p,r));
  if(key==='proof')return file(key,'proof.html','text/html',proofHTML(p,r));
  throw new ValidationError('Unknown export type');
}
/** Generate one requested file: a refused proof never blocks other downloads. */
export function exportFile(p,key){
  if(key==='project')return buildExport(validateProject(p),null,key);
  return buildExport(p,compile(p),key);
}
/** Explicit full-kit batch helper; rejects if any requested complete file is too large. */
export function exportsFor(p){
  const r=compile(p);
  return [...(r.mergeAllowed?['merge','review']:[]),'placements','placement-json','changes','fields','proof','project'].map(key=>buildExport(p,r,key));
}
