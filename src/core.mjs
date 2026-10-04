import {ValidationError,parseStrictJSON,MAX_INPUT_BYTES} from './json.mjs';
export {ValidationError,MAX_INPUT_BYTES};
const fail=m=>{throw new ValidationError(m);};
const exact=(x,keys,where)=>{if(!x||typeof x!=='object'||Array.isArray(x)||![Object.prototype,null].includes(Object.getPrototypeOf(x))||Reflect.ownKeys(x).length!==keys.length||Object.keys(x).sort().join('|')!==[...keys].sort().join('|'))fail(`${where}: unexpected or missing fields`);for(const k of keys)if(!Object.hasOwn(Object.getOwnPropertyDescriptor(x,k),'value'))fail(`${where}: accessor properties are not accepted`);};
const array=(x,min,max,where)=>{if(!Array.isArray(x)||Object.getPrototypeOf(x)!==Array.prototype||x.length<min||x.length>max)fail(`${where}: expected ${min}–${max} entries`);for(let i=0;i<x.length;i++)if(!Object.hasOwn(x,i))fail(`${where}: sparse arrays are not accepted`);else if(!Object.hasOwn(Object.getOwnPropertyDescriptor(x,String(i)),'value'))fail(`${where}: accessor entries are not accepted`);if(Reflect.ownKeys(x).length!==x.length+1)fail(`${where}: extra array properties are not accepted`);};
export function text(x,where,max=240,empty=true){
  if(typeof x!=='string'||x.length>max||(!empty&&x.length===0))fail(`${where}: expected ${empty?'0':'1'}–${max} characters`);
  if(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069\ufffe\uffff]/u.test(x))fail(`${where}: unsupported control character`);
  for(let i=0;i<x.length;i++){const c=x.charCodeAt(i);if(c>=0xd800&&c<=0xdbff){const d=x.charCodeAt(++i);if(!(d>=0xdc00&&d<=0xdfff))fail(`${where}: unpaired surrogate`);}else if(c>=0xdc00&&c<=0xdfff)fail(`${where}: unpaired surrogate`);}
  return x;
}
/** Strict, bounded CSV/TSV; quoted newlines are data, never record boundaries. */
export function parseDelimited(input,delimiter=','){
  if(typeof input!=='string'||new TextEncoder().encode(input).length>MAX_INPUT_BYTES)fail('Input exceeds 32 MiB');
  if(![',','\t'].includes(delimiter))fail('Delimiter must be comma or tab');
  if(input.startsWith('\ufeff'))input=input.slice(1);
  if(input==='')fail('Input is empty');
  const records=[];let row=[],field='',state='start',ended=false;
  const cell=()=>{text(field,`Record ${records.length+1}, column ${row.length+1}`);row.push(field);if(row.length>12)fail('At most 12 columns are supported');field='';state='start';};
  const record=()=>{cell();records.push(row);row=[];if(records.length>2001)fail('At most 2,000 data rows are supported');ended=true;};
  for(let i=0;i<input.length;i++){
    const c=input[i];ended=false;
    if(state==='quoted'){if(c==='"'){if(input[i+1]==='"'){field+='"';i++;}else state='closed';}else field+=c;}
    else if(c===delimiter){cell();}
    else if(c==='\n'||c==='\r'){if(c==='\r'){if(input[i+1]!=='\n')fail('Bare CR outside a quoted field is not accepted');i++;}record();}
    else if(state==='closed')fail('Unexpected character after a closing quote');
    else if(c==='"'){if(state!=='start')fail('Quote inside an unquoted field');state='quoted';}
    else{field+=c;state='plain';}
    if(field.length>240)fail('A field exceeds 240 characters');
  }
  if(state==='quoted')fail('Unclosed quoted field');
  if(!ended)record();
  const [columns,...rows]=records;validateTable({columns,rows});return {columns,rows};
}
export function validateTable(table){
  exact(table,['columns','rows'],'Table');array(table.columns,1,12,'Columns');
  table.columns.forEach((s,i)=>text(s,`Column ${i+1}`,240,false));
  if(new Set(table.columns).size!==table.columns.length)fail('Column names must be distinct (exact text)');
  array(table.rows,1,2000,'Rows');table.rows.forEach((row,i)=>{array(row,table.columns.length,table.columns.length,`Row ${i+1}`);row.forEach((v,j)=>text(v,`Row ${i+1}, column ${j+1}`));});return table;
}
export function validateProject(p){
  exact(p,['schema','title','table','settings'],'Project');if(p.schema!=='mergepanel.project.v1')fail('Unsupported project schema');text(p.title,'Title',120,false);validateTable(p.table);
  exact(p.settings,['capacity','group','id','fields','profile','multiline'],'Settings');
  const s=p.settings,index=i=>Number.isInteger(i)&&!Object.is(i,-0)&&i>=0&&i<p.table.columns.length;
  if(!Number.isInteger(s.capacity)||s.capacity<1||s.capacity>8)fail('Capacity must be an integer from 1 to 8');
  for(const role of ['group','id'])if(s[role]!==null&&!index(s[role]))fail(`${role}: invalid column index`);
  array(s.fields,p.table.columns.length,p.table.columns.length,'Field bindings');const seen=new Set(),tokens=new Set();let selected=0;
  for(const f of s.fields){exact(f,['token','column','kind','enabled'],'Field');if(typeof f.token!=='string'||!/^f[0-9]{3}$/.test(f.token)||f.token==='f000'||tokens.has(f.token))fail('Field tokens must be distinct f001–f999 strings');tokens.add(f.token);if(typeof f.enabled!=='boolean')fail('Field enabled must be a boolean');if(f.enabled)selected++;if(!index(f.column)||seen.has(f.column))fail('Fields must reference distinct source columns');seen.add(f.column);if(!['text','image'].includes(f.kind))fail('Unknown field kind');}
  if(selected<1||selected>10)fail('Select 1–10 output fields');
  if(!['generic','indesign'].includes(s.profile))fail('Unknown output profile');
  if(!['preserve','block','space'].includes(s.multiline))fail('Unknown multiline policy');
  if(s.profile==='generic'&&s.multiline!=='preserve')fail('Generic profile must preserve multiline values');
  if(s.profile==='indesign'&&s.multiline==='preserve')fail('Conservative InDesign profile requires block or explicit space replacement');
  if(s.id!==null){const ids=new Set();p.table.rows.forEach((row,i)=>{const id=row[s.id];if(id===''||ids.has(id))fail(`Row ${i+1}: item IDs must be nonempty and exactly unique`);ids.add(id);});}
  return p;
}
export function parseProject(input){return structuredClone(validateProject(parseStrictJSON(typeof input==='string'&&input.startsWith('\ufeff')?input.slice(1):input)));}
export function createProject(table){validateTable(table);return {schema:'mergepanel.project.v1',title:'Untitled layout records',table:structuredClone(table),settings:{capacity:3,group:null,id:null,fields:table.columns.map((_,column)=>({token:`f${String(column+1).padStart(3,'0')}`,column,kind:'text',enabled:column<10})),profile:'generic',multiline:'preserve'}};}
/** Updating a recipe binds by exact header identity, never by a stale column position. */
export function rebindProject(project,table){
  validateProject(project);validateTable(table);const p=structuredClone(project),lookup=new Map(table.columns.map((h,i)=>[h,i]));
  const column=old=>{const header=p.table.columns[old];if(!lookup.has(header))fail(`Updated source is missing column "${header}"; choose New table to remap`);return lookup.get(header);};
  for(const role of ['group','id'])if(p.settings[role]!==null)p.settings[role]=column(p.settings[role]);
  const used=new Set();p.settings.fields=p.settings.fields.map(f=>({...f,column:column(f.column)}));p.settings.fields.forEach(f=>used.add(f.column));
  let next=Math.max(...p.settings.fields.map(f=>Number(f.token.slice(1))))+1;
  for(let i=0;i<table.columns.length;i++)if(!used.has(i)){if(next>999)fail('Field token range exhausted; start a new table');p.settings.fields.push({token:`f${String(next++).padStart(3,'0')}`,column:i,kind:'text',enabled:false});}
  p.table=structuredClone(table);return p;
}
const lineBreak=/\r\n|[\r\n\u2028\u2029]/g;
export const hasLineBreak=value=>/[\r\n\u2028\u2029]/.test(value);
export function compile(input){
  const p=validateProject(input),s=p.settings,groups=new Map(),changes=[],blocked=[];
  p.table.rows.forEach((row,i)=>{const key=s.group===null?null:row[s.group];if(!groups.has(key))groups.set(key,{id:`g${groups.size+1}`,value:key,rows:[]});groups.get(key).rows.push(i+1);});
  const fieldMap=s.fields.filter(f=>f.enabled).map(f=>({id:f.token,column:f.column,header:p.table.columns[f.column],kind:f.kind}));
  const records=[],placements=[];
  for(const group of groups.values())for(let start=0;start<group.rows.length;start+=s.capacity){
    const record={id:`r${String(records.length+1).padStart(4,'0')}`,ordinal:records.length+1,groupId:group.id,groupValue:group.value,groupRecord:Math.floor(start/s.capacity)+1,groupRecords:Math.ceil(group.rows.length/s.capacity),occupied:Math.min(s.capacity,group.rows.length-start),slots:[]};
    for(let slot=1;slot<=s.capacity;slot++){
      const rowNumber=group.rows[start+slot-1];
      if(rowNumber===undefined){record.slots.push({slot,present:false,row:null,itemId:null,values:fieldMap.map(()=>''),originalValues:fieldMap.map(()=>null)});continue;}
      const raw=p.table.rows[rowNumber-1],values=fieldMap.map(f=>{
        const value=raw[f.column];if(s.profile==='generic'||!hasLineBreak(value))return value;
        if(s.multiline==='block'||f.kind==='image'||f.column===s.group||f.column===s.id){blocked.push({row:rowNumber,column:f.column,fieldId:f.id,kind:f.column===s.group||f.column===s.id?'identity':f.kind,value});return value;}
        const replacement=value.replace(lineBreak,' ');changes.push({row:rowNumber,column:f.column,fieldId:f.id,original:value,replacement,breaks:(value.match(lineBreak)??[]).length});return replacement;
      });
      const itemId=s.id===null?null:raw[s.id];record.slots.push({slot,present:true,row:rowNumber,itemId,values,originalValues:fieldMap.map(f=>raw[f.column])});placements.push({row:rowNumber,itemId,recordId:record.id,record:record.ordinal,slot,groupId:group.id,groupValue:group.value,groupRecord:record.groupRecord});
    }
    records.push(record);
  }
  // Group and ID metadata in the merge CSV must also remain exact. They cannot
  // use a replacement policy because that would change their identity.
  if(s.profile==='indesign')p.table.rows.forEach((row,i)=>{for(const role of ['group','id'])if(s[role]!==null&&hasLineBreak(row[s[role]]))blocked.push({row:i+1,column:s[role],fieldId:role,kind:'identity',value:row[s[role]]});});
  const order=placements.map(p=>p.row),regrouped=order.some((row,i)=>row!==i+1),padding=records.length*s.capacity-p.table.rows.length;
  return {schema:'mergepanel.compiled.v1',title:p.title,capacity:s.capacity,profile:s.profile,multiline:s.multiline,inputRows:p.table.rows.length,fieldMap,groups:[...groups.values()],records,placements,changes,blocked,mergeAllowed:blocked.length===0,regrouped,padding};
}
