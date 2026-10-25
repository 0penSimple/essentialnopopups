/* Private image metadata engine. Public contracts are declared in tools-api.js. */
(function () {
  "use strict";
  const Tools = window.Tools = window.Tools || {};
  const MAX_FILE_BYTES = 100 * 1024 * 1024;
  const MAX_PIXELS = 100 * 1000 * 1000;
  const C2PA_VERSION = "0.14.3";
  let c2paPromise = null;

async function inspectBlob(blob, useOfficialC2pa) {
  const buffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  const format = detectFormat(bytes);
  if (!format) throw new Error('not a genuine JPEG, PNG, or WebP');
  const mime = format === 'jpeg' ? 'image/jpeg' : `image/${format}`;
  let findings = scanContainer(bytes, format);
  const warnings = [];
  if (typeof ExifReader !== 'undefined') {
    try { findings.push(...readRecognizedMetadata(buffer)); }
    catch (error) { warnings.push(`Metadata parser warning: ${messageOf(error)}`); }
  } else warnings.push('The recognized metadata parser did not load; structural inspection was still completed.');

  let c2pa = { checked:false, found:structuralC2pa(findings), status:'structural-only', summary:null };
  if (useOfficialC2pa) {
    try {
      c2pa = await inspectC2pa(blob, mime);
      if (c2pa.found) {
        const details = c2pa.details || [];
        if (details.length) findings.push(...details.map(x=>finding('credential','C2PA',x.key,x.value,x.source,false,false)));
        else findings.push(finding('credential','C2PA','Content Credential',c2pa.summary || 'Signed provenance manifest','Official C2PA verifier',false,true));
      }
    } catch (error) {
      warnings.push('Cryptographic C2PA verification was unavailable; structural C2PA detection was used.');
    }
  }
  findings = dedupe(findings);
  return { format, mime, byteLength:bytes.length, findings, warnings, c2pa };
}

function detectFormat(b) {
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'jpeg';
  if (b.length >= 8 && b[0] === 0x89 && textAt(b,1,3) === 'PNG' && b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a) return 'png';
  if (b.length >= 12 && textAt(b,0,4) === 'RIFF' && textAt(b,8,4) === 'WEBP') return 'webp';
  return null;
}

function scanContainer(bytes, format) {
  return format === 'jpeg' ? scanJpeg(bytes) : format === 'png' ? scanPng(bytes) : scanWebp(bytes);
}

function scanJpeg(b) {
  const out = []; let p = 2;
  while (p + 3 < b.length) {
    if (b[p] !== 0xff) { p++; continue; }
    while (p < b.length && b[p] === 0xff) p++;
    const marker = b[p++];
    if (marker === 0xda || marker === 0xd9) break;
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd8)) continue;
    if (p + 2 > b.length) break;
    const len = u16be(b,p); if (len < 2 || p + len > b.length) { out.push(container('JPEG','Malformed segment','unknown',0,true)); break; }
    const start = p + 2, size = len - 2, head = printable(b,start,Math.min(size,96)), lower = head.toLowerCase();
    if (marker >= 0xe0 && marker <= 0xef) {
      const app = marker - 0xe0; let key = `APP${app} optional segment`, category = 'container', sensitive = true;
      if (app === 0 && head.startsWith('JFIF')) { key='JFIF application segment'; category='rendering'; sensitive=false; }
      else if (app === 1 && head.startsWith('Exif')) { key='EXIF segment'; category='exif'; }
      else if (app === 1 && lower.includes('adobe.com/xap')) { key='XMP segment'; category='xmp'; }
      else if (app === 2 && head.startsWith('ICC_PROFILE')) { key='ICC color profile'; category='color'; sensitive=false; }
      else if (app === 2 && head.startsWith('MPF')) { key='Embedded-image / MPF index'; category='embedded'; }
      else if (app === 11 && (lower.includes('c2pa') || lower.includes('jumb') || head.includes('JP'))) { key='C2PA / JUMBF Content Credential'; category='credential'; sensitive=false; }
      else if (app === 13 && (head.startsWith('Photoshop') || lower.includes('iptc'))) { key='Photoshop / IPTC segment'; category='iptc'; }
      else if (app === 14 && head.startsWith('Adobe')) { key='Adobe application segment'; category='software'; }
      out.push(container('JPEG',key,category,size,sensitive));
    } else if (marker === 0xfe) out.push(finding('comment','JPEG','Comment segment',preview(b,start,size),'Container structure',true,true));
    p += len;
  }
  const eoi = lastPair(b,0xff,0xd9);
  if (eoi >= 0 && eoi + 2 < b.length) out.push(finding('trailing','JPEG','Trailing data',`${b.length-eoi-2} bytes after image end`,'Container structure',true,true));
  return out;
}

function scanPng(b) {
  const out = [], structural = new Set(['IHDR','PLTE','IDAT','IEND','tRNS','acTL','fcTL','fdAT']);
  const known = {eXIf:['EXIF chunk','exif',true],tEXt:['Text metadata','text',true],zTXt:['Compressed text metadata','text',true],iTXt:['International text / XMP','xmp',true],iCCP:['ICC color profile','color',false],tIME:['Modification time','time',true],pHYs:['Pixel density','rendering',false],caBX:['C2PA Content Credential','credential',false],gAMA:['Gamma information','rendering',false],cHRM:['Chromaticity information','rendering',false],sRGB:['sRGB rendering intent','rendering',false],cICP:['Color information','rendering',false],hIST:['Histogram','rendering',false],sPLT:['Suggested palette','rendering',false]};
  let p=8, ended=false;
  while (p+12<=b.length) {
    const len=u32be(b,p), type=textAt(b,p+4,4), end=p+12+len;
    if (end>b.length) { out.push(finding('unknown','PNG','Malformed chunk',type,'Container structure',true,true)); break; }
    if (known[type]) { const [key,cat,sens]=known[type]; out.push(finding(cat,'PNG',key,['tEXt','zTXt','iTXt'].includes(type)?preview(b,p+8,len):`${len} bytes`,'Container structure',sens,true)); }
    else if (!structural.has(type)) out.push(finding('unknown','PNG',`Unknown ${type[0]===type[0].toLowerCase()?'ancillary':'critical'} chunk`,`${type} · ${len} bytes`,'Container structure',true,true));
    p=end; if(type==='IEND'){ended=true;break;}
  }
  if(ended&&p<b.length) out.push(finding('trailing','PNG','Trailing data',`${b.length-p} bytes after IEND`,'Container structure',true,true));
  return out;
}

function scanWebp(b) {
  const out=[], pixel=new Set(['VP8 ','VP8L','VP8X','ALPH','ANIM','ANMF']);
  const known={EXIF:['EXIF chunk','exif',true],'XMP ':['XMP chunk','xmp',true],ICCP:['ICC color profile','color',false],C2PA:['C2PA Content Credential','credential',false],META:['Generic metadata','container',true]};
  const declared=Math.min(b.length,u32le(b,4)+8); let p=12;
  while(p+8<=declared){const type=textAt(b,p,4),len=u32le(b,p+4),end=p+8+len+(len&1);if(end>declared){out.push(finding('unknown','WebP','Malformed chunk',type,'Container structure',true,true));break;}if(known[type]){const [key,cat,sens]=known[type];out.push(finding(cat,'WebP',key,`${len} bytes`,'Container structure',sens,true));}else if(!pixel.has(type))out.push(finding('unknown','WebP','Unknown RIFF chunk',`${type} · ${len} bytes`,'Container structure',true,true));p=end;}
  if(declared<b.length)out.push(finding('trailing','WebP','Trailing data',`${b.length-declared} bytes after RIFF container`,'Container structure',true,true));
  return out;
}

function container(group,key,category,size,sensitive){return finding(category,group,key,`${size} bytes`,'Container structure',sensitive,true);}
function finding(category,group,key,value,source,sensitive,isContainer){return{category,group,key,value:String(value),source,sensitive:Boolean(sensitive),container:Boolean(isContainer)};}

function readRecognizedMetadata(buffer) {
  const tags=ExifReader.load(buffer,{expanded:true}),out=[];
  const walk=(node,path)=>{if(!node||typeof node!=='object'||ArrayBuffer.isView(node)||node instanceof ArrayBuffer)return;for(const[key,val]of Object.entries(node)){if(['base64','image'].includes(key))continue;const next=[...path,key];if(val&&typeof val==='object'&&('description'in val||'value'in val)){const value=tagValue(val.description??val.value);if(!value)continue;const category=categorize(next.join(' '));if(category==='technical')continue;out.push(finding(category,path[0]||'Metadata',key,value,recognizedMetadataSource(category),isSensitive(category,key),false));}else if(val&&typeof val==='object'&&next.length<5)walk(val,next);}};
  walk(tags,[]); return out;
}

function categorize(text){const s=text.toLowerCase();if(/gps|latitude|longitude|altitude|geotag|location/.test(s))return'location';if(/serial|owner|artist|author|creator|by-line|credit|contact|email|person/.test(s))return'identity';if(/c2pa|content credential|jumbf|provenance/.test(s))return'credential';if(/file\s*type|bit depth|bits per|color type|color components?|filter$|interlace|jfif version|resolution|thumbnail (width|height)|image (width|height)|compression|mime|encoding|subsampling|samples per pixel/.test(s))return'technical';if(/date|time|timestamp/.test(s))return'time';if(/make|model|lens|camera|device|body|firmware/.test(s))return'device';if(/thumbnail|preview|mpf|embedded/.test(s))return'embedded';if(/comment|description|caption|keyword|subject|title|headline|copyright/.test(s))return'text';if(/software|application|producer|creator tool/.test(s))return'software';if(/icc|color|gamma|chromatic/.test(s))return'color';if(/xmp/.test(s))return'xmp';if(/iptc/.test(s))return'iptc';return'metadata';}
function recognizedMetadataSource(category){const sources={software:'EXIF/XMP software field · application named by file',device:'EXIF device field · capture hardware named by file',identity:'EXIF/IPTC/XMP identity field · creator or owner claimed by file',location:'EXIF GPS field · location recorded by file',time:'EXIF/XMP time field · timestamp recorded by file'};return sources[category]||'Recognized metadata';}
function isSensitive(cat,key){return['location','identity','time','device','text','embedded','unknown','trailing'].includes(cat)||/serial|owner|author|artist|comment/i.test(key);}
function tagValue(v){if(v==null)return'';if(ArrayBuffer.isView(v)||v instanceof ArrayBuffer)return`[binary data: ${v.byteLength} bytes]`;if(Array.isArray(v))return v.slice(0,20).map(tagValue).join(', ');if(typeof v==='object'){try{return JSON.stringify(v).slice(0,500);}catch{return'[structured data]';}}const s=String(v).replace(/[\u0000-\u001f]/g,' ').trim();return s.length>500?`${s.slice(0,497)}…`:s;}
function dedupe(items){const seen=new Set();return items.filter(x=>{const k=x.source==='Recognized metadata'?`${x.source}|${x.key}|${x.value}`:`${x.source}|${x.group}|${x.key}|${x.value}`;if(seen.has(k))return false;seen.add(k);return true;});}
function structuralC2pa(items){return items.some(x=>x.category==='credential'||/c2pa|jumbf|content credential/i.test(`${x.key} ${x.value}`));}

async function getC2pa(){if(!c2paPromise)c2paPromise=import(`https://cdn.jsdelivr.net/npm/@contentauth/c2pa-web@${C2PA_VERSION}/+esm`).then(m=>m.createC2pa({wasmSrc:`https://cdn.jsdelivr.net/npm/@contentauth/c2pa-web@${C2PA_VERSION}/dist/resources/c2pa_bg.wasm`}));return c2paPromise;}
async function inspectC2pa(blob,mime){const sdk=await getC2pa(),reader=await sdk.reader.fromBlob(mime,blob);if(!reader)return{checked:true,found:false,status:'not-found',summary:null,details:[]};try{const[label,manifest,store]=await Promise.all([reader.activeLabel(),reader.activeManifest(),reader.manifestStore()]);const details=extractC2paDetails(manifest||{},label,store||{});const generator=details.find(x=>x.key==='Credential generator');return{checked:true,found:true,status:'found',summary:generator?.value||manifest?.title||label||'Signed provenance manifest',details};}finally{await reader.free();}}

function extractC2paDetails(manifest,label,store){
  const out=[],add=(key,value,source)=>{const clean=tagValue(value);if(clean)out.push({key,value:clean,source});};
  const infos=asArray(manifest.claim_generator_info??manifest.claimGeneratorInfo);
  for(const info of infos){const agent=formatC2paAgent(info);if(agent)add('Credential generator',agent,'C2PA claim · software or system that wrote the credential');}
  const legacy=manifest.claim_generator??manifest.claimGenerator;
  if(legacy&&!out.some(x=>x.key==='Credential generator'&&x.value===String(legacy)))add('Credential generator',legacy,'C2PA claim · software or system that wrote the credential');
  add('Credential vendor namespace',manifest.vendor,'C2PA claim · vendor identifier, not proof of authorship');

  const sig=manifest.signature_info??manifest.signatureInfo??{};
  add('Certificate subject',sig.common_name??sig.commonName,'Signing certificate · signer name claimed by certificate');
  add('Certificate issuer',sig.issuer,'Signing certificate · certificate authority, not necessarily the creator');
  add('Signed at',sig.time,'C2PA signature');

  for(const assertion of asArray(manifest.assertions)){
    if(!/c2pa\.actions/i.test(String(assertion?.label||'')))continue;
    const data=assertion?.data&&typeof assertion.data==='object'?assertion.data:{};
    const agents=asArray(data.softwareAgents??data.software_agents);
    for(const action of asArray(data.actions??data)){
      if(!action||typeof action!=='object')continue;
      const indexed=Number.isInteger(action.softwareAgentIndex)?agents[action.softwareAgentIndex]:Number.isInteger(action.software_agent_index)?agents[action.software_agent_index]:null;
      const agent=formatC2paAgent(action.softwareAgent??action.software_agent??indexed);
      const sourceType=action.digitalSourceType??action.digital_source_type;
      if(!action.action&&!agent&&!sourceType)continue;
      const name=friendlyC2paAction(action.action);
      const when=action.when?` · ${action.when}`:'';
      add('Recorded action',`${name}${agent?` · via ${agent}`:''}${when}`,'C2PA action history · declared by credential');
      if(sourceType)add('Declared digital source',friendlyDigitalSource(sourceType),'C2PA action · declaration, not independent proof');
    }
  }

  const validation=store.validation_state??store.validationState;
  if(validation)add('Credential validation',validation,'Official C2PA verifier');
  const failures=asArray(store.validation_results?.activeManifest?.failure??store.validation_results?.active_manifest?.failure??store.validation_status).filter(x=>x&&(/fail|invalid|mismatch|missing|untrusted|expired|revoked/i.test(String(x.code??x.status??''))));
  if(failures.length)add('Validation warnings',failures.slice(0,3).map(x=>x.code??x.status??x.explanation).filter(Boolean).join(', '),'Official C2PA verifier');
  add('Credential title',manifest.title,'C2PA manifest · usually the source filename');
  add('Credential ID',label??manifest.label,'C2PA manifest identifier');
  return dedupeC2paDetails(out);
}
function asArray(value){return value==null?[]:Array.isArray(value)?value:[value];}
function formatC2paAgent(agent){if(!agent)return'';if(typeof agent==='string')return agent;const name=agent.name??agent.product_name??agent.productName??agent['@id'];const version=agent.version??agent.product_version??agent.productVersion;const os=agent.operating_system??agent.operatingSystem;return[name,version&&name?`v${version}`:version,os&&`on ${os}`].filter(Boolean).join(' ');}
function friendlyC2paAction(value){const raw=String(value||'Unspecified action'),tail=raw.split(/[\/#]/).pop().replace(/^c2pa\./i,'');return tail.replace(/([a-z])([A-Z])/g,'$1 $2').replace(/[._-]+/g,' ').replace(/^./,c=>c.toUpperCase());}
function friendlyDigitalSource(value){const raw=String(value),key=raw.split(/[\/#]/).pop();const known={digitalCapture:'Camera or scanner capture',computationalCapture:'Computational capture',negativeFilm:'Scanned negative film',positiveFilm:'Scanned positive film',print:'Scanned physical print',minorHumanEdits:'Minor human edits',humanEdits:'Human-edited media',compositeWithTrainedAlgorithmicMedia:'Composite containing AI-generated media',algorithmicallyEnhanced:'Algorithmically enhanced media',softwareImage:'Software-created image',digitalArt:'Digital art',digitalCreation:'Digital creation',dataDrivenMedia:'Data-driven media',trainedAlgorithmicMedia:'AI-generated media (trained algorithm)',trainedAlgorithmicData:'AI-generated data (trained algorithm)',algorithmicMedia:'Algorithmically generated media',screenCapture:'Screen capture',virtualRecording:'Virtual recording',composite:'Composite media',compositeCapture:'Composite capture',compositeSynthetic:'Synthetic composite'};return known[key]||key.replace(/([a-z])([A-Z])/g,'$1 $2').replace(/[._-]+/g,' ').replace(/^./,c=>c.toUpperCase());}
function dedupeC2paDetails(items){const seen=new Set();return items.filter(x=>{const key=`${x.key}|${x.value}`;if(seen.has(key))return false;seen.add(key);return true;});}

async function rebuildPixels(file,format){const bitmap=await createImageBitmap(file,{imageOrientation:'from-image',premultiplyAlpha:'default',colorSpaceConversion:'default'});try{if(!bitmap.width||!bitmap.height)throw new Error('invalid dimensions');if(bitmap.width*bitmap.height>MAX_PIXELS)throw new Error('exceeds 100 megapixels');let canvas;if(typeof OffscreenCanvas!=='undefined')canvas=new OffscreenCanvas(bitmap.width,bitmap.height);else{canvas=document.createElement('canvas');canvas.width=bitmap.width;canvas.height=bitmap.height;}const ctx=canvas.getContext('2d',{alpha:format!=='jpeg',colorSpace:'srgb'});if(!ctx)throw new Error('browser could not create a canvas');if(format==='jpeg'){ctx.fillStyle='#fff';ctx.fillRect(0,0,bitmap.width,bitmap.height);}ctx.drawImage(bitmap,0,0);const mime=format==='jpeg'?'image/jpeg':`image/${format}`,quality=format==='png'?undefined:.95;const blob=canvas.convertToBlob?await canvas.convertToBlob({type:mime,quality}):await new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('image export failed')),mime,quality));if(blob.type!==mime)throw new Error(`browser cannot export ${mime}`);return blob;}finally{bitmap.close();}}

async function cleanEncodedBlob(blob,format){const bytes=new Uint8Array(await blob.arrayBuffer());const cleaned=format==='jpeg'?cleanJpeg(bytes):format==='png'?cleanPng(bytes):cleanWebp(bytes);return new Blob([cleaned],{type:blob.type});}
function cleanJpeg(b){const parts=[b.slice(0,2)];let p=2;while(p+1<b.length){const start=p;if(b[p]!==0xff)throw new Error('unexpected JPEG structure');while(p<b.length&&b[p]===0xff)p++;const marker=b[p++];if(marker===0xda){const eoi=lastPair(b,0xff,0xd9);if(eoi<start)throw new Error('JPEG end marker missing');parts.push(b.slice(start,eoi+2));return joinBytes(parts);}if(marker===0xd9){parts.push(b.slice(start,p));return joinBytes(parts);}if(marker===0x01||(marker>=0xd0&&marker<=0xd8)){parts.push(b.slice(start,p));continue;}if(p+2>b.length)throw new Error('truncated JPEG');const len=u16be(b,p),end=p+len;if(len<2||end>b.length)throw new Error('invalid JPEG segment');if(!((marker>=0xe0&&marker<=0xef)||marker===0xfe))parts.push(b.slice(start,end));p=end;}throw new Error('JPEG cleaning failed');}
function cleanPng(b){const keep=new Set(['IHDR','PLTE','IDAT','IEND','tRNS','acTL','fcTL','fdAT']),parts=[b.slice(0,8)];let p=8;while(p+12<=b.length){const len=u32be(b,p),type=textAt(b,p+4,4),end=p+12+len;if(end>b.length)throw new Error('invalid PNG chunk');if(keep.has(type))parts.push(b.slice(p,end));p=end;if(type==='IEND')return joinBytes(parts);}throw new Error('PNG end chunk missing');}
function cleanWebp(b){const keep=new Set(['VP8 ','VP8L','VP8X','ALPH','ANIM','ANMF']),chunks=[];const declared=Math.min(b.length,u32le(b,4)+8);let p=12;while(p+8<=declared){const type=textAt(b,p,4),len=u32le(b,p+4),end=p+8+len+(len&1);if(end>declared)throw new Error('invalid WebP chunk');if(keep.has(type)){const c=b.slice(p,end);if(type==='VP8X'&&len>=10)c[8]&=~0x2c;chunks.push(c);}p=end;}const payload=4+chunks.reduce((s,c)=>s+c.length,0),out=new Uint8Array(payload+8);writeText(out,0,'RIFF');writeU32le(out,4,payload);writeText(out,8,'WEBP');let o=12;for(const c of chunks){out.set(c,o);o+=c.length;}return out;}
function removable(x){return !['technical','rendering'].includes(x.category);}

function messageOf(e){return e instanceof Error?e.message:String(e);}
function textAt(b,p,n){let s='';for(let i=0;i<n&&p+i<b.length;i++)s+=String.fromCharCode(b[p+i]);return s;}
function printable(b,p,n){return textAt(b,p,n).replace(/[^\x20-\x7e]/g,'.');}
function preview(b,p,n){const s=printable(b,p,Math.min(n,160)).replace(/\.+/g,' ').trim();return s||`${n} bytes`;}
function u16be(b,p){return(b[p]<<8)|b[p+1];}
function u32be(b,p){return b[p]*0x1000000+((b[p+1]<<16)|(b[p+2]<<8)|b[p+3]);}
function u32le(b,p){return(b[p]|(b[p+1]<<8)|(b[p+2]<<16)|(b[p+3]<<24))>>>0;}
function writeU32le(b,p,v){b[p]=v&255;b[p+1]=(v>>>8)&255;b[p+2]=(v>>>16)&255;b[p+3]=(v>>>24)&255;}
function writeText(b,p,s){for(let i=0;i<s.length;i++)b[p+i]=s.charCodeAt(i);}
function lastPair(b,a,c){for(let i=b.length-2;i>=0;i--)if(b[i]===a&&b[i+1]===c)return i;return-1;}
function joinBytes(parts){const n=parts.reduce((s,x)=>s+x.length,0),out=new Uint8Array(n);let p=0;for(const x of parts){out.set(x,p);p+=x.length;}return out;}

  Tools.inspectImageMetadata = async function (file, { verifyC2pa = true } = {}) {
    if (!(file instanceof Blob)) throw new TypeError("inspectImageMetadata expects an image Blob or File.");
    if (file.size > MAX_FILE_BYTES) throw new RangeError("Image exceeds 100 MB.");
    return inspectBlob(file, verifyC2pa);
  };

  Tools.explainImageMetadata = async function (inspection) {
    if (!inspection || !Array.isArray(inspection.findings)) {
      throw new TypeError("explainImageMetadata expects an inspection result.");
    }
    const findings = inspection.findings;
    const useful = findings.filter(item => !item.container && item.value && !["technical", "rendering", "color"].includes(item.category));
    const clean = value => String(value).replace(/[\u0000-\u001f]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 220);
    const byCategory = category => useful.filter(item => item.category === category);
    const find = (category, pattern) => byCategory(category).find(item => pattern.test(item.key));
    const values = (category, pattern = /.*/) => [...new Set(byCategory(category).filter(item => pattern.test(item.key)).map(item => clean(item.value)).filter(Boolean))];
    const formatList = list => list.length < 2 ? (list[0] || "") : list.length === 2 ? `${list[0]} and ${list[1]}`
      : `${list.slice(0, -1).join(", ")}, and ${list.at(-1)}`;
    const formatRecordedDate = value => {
      const text = clean(value);
      const match = text.match(/^(\d{4})[:-](\d{2})[:-](\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?/);
      if (!match) return text;
      const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
      const date = `${months[Number(match[2]) - 1] || match[2]} ${Number(match[3])}, ${match[1]}`;
      return match[4] ? `${date} at ${match[4]}:${match[5]}${match[6] && match[6] !== "00" ? `:${match[6]}` : ""}` : date;
    };
    const sentences = [], evidence = [], disclosures = [];
    const remember = (sentence, items, disclosure) => {
      if (!sentence) return;
      sentences.push(sentence);
      evidence.push(...items.map(item => item.key));
      if (disclosure) disclosures.push(disclosure);
    };

    const make = find("device", /^(make|camera make|manufacturer)$/i);
    const model = find("device", /model/i);
    const lens = find("device", /lens( model| type)?$/i);
    const deviceParts = [];
    if (model) deviceParts.push(clean(model.value));
    if (make && !deviceParts.some(value => value.toLowerCase().includes(clean(make.value).toLowerCase()))) deviceParts.push(`${deviceParts.length ? "made by " : ""}${clean(make.value)}`);
    if (lens) deviceParts.push(`a ${clean(lens.value)} lens`);
    const captureDate = find("time", /(date.?time.?original|capture date|created date|date created)/i);
    const generalDate = captureDate || find("time", /date.?time|timestamp/i);
    if (deviceParts.length || generalDate) {
      const when = generalDate ? ` on ${formatRecordedDate(generalDate.value)}` : "";
      const withDevice = deviceParts.length ? ` using ${deviceParts.join(", ")}` : "";
      remember(`The file says the image was captured${when}${withDevice}.`, [generalDate, make, model, lens].filter(Boolean), "when and how the image was captured");
    }

    const latitude = find("location", /latitude(?! ref)/i), longitude = find("location", /longitude(?! ref)/i);
    const altitude = find("location", /altitude/i);
    const locationItems = byCategory("location");
    if (latitude && longitude) {
      const altitudeText = altitude ? `, with an altitude recorded as ${clean(altitude.value)}` : "";
      remember(`It records a capture location at ${clean(latitude.value)}, ${clean(longitude.value)}${altitudeText}.`, [latitude, longitude, altitude].filter(Boolean), "the recorded capture location");
    } else if (locationItems.length) {
      remember(`It contains location information recorded as ${formatList(locationItems.slice(0, 3).map(item => clean(item.value)))}.`, locationItems, "location information");
    }

    const identityItems = byCategory("identity");
    if (identityItems.length) {
      const named = identityItems.slice(0, 3).map(item => {
        const role = /artist/i.test(item.key) ? "the artist" : /author/i.test(item.key) ? "the author"
          : /creator/i.test(item.key) ? "the creator" : /owner/i.test(item.key) ? "the owner"
          : /copyright/i.test(item.key) ? "the copyright notice" : item.key.toLowerCase();
        return `“${clean(item.value)}” as ${role}`;
      });
      remember(`It identifies ${formatList(named)}.`, identityItems, "a named creator, owner, or rights holder");
    }

    const softwareItems = byCategory("software");
    const softwareNames = values("software");
    const modified = find("time", /(modify|metadata date|update)/i);
    if (softwareNames.length) {
      remember(`The file says it was processed or exported with ${formatList(softwareNames.slice(0, 3))}${modified ? ` on ${formatRecordedDate(modified.value)}` : ""}.`,
        [...softwareItems, modified].filter(Boolean), "its editing or export history");
    } else if (modified && modified !== generalDate) {
      remember(`The file records a later modification on ${formatRecordedDate(modified.value)}.`, [modified], "when the file was modified");
    }

    const credentialItems = byCategory("credential");
    if (credentialItems.length) {
      const generator = credentialItems.find(item => /generator/i.test(item.key));
      const source = credentialItems.find(item => /digital source/i.test(item.key));
      const actions = credentialItems.filter(item => /action/i.test(item.key)).slice(0, 2);
      const claims = [];
      if (generator) claims.push(`names ${clean(generator.value)} as the credential generator`);
      if (source) claims.push(`declares the source as ${clean(source.value)}`);
      if (actions.length) claims.push(`records ${formatList(actions.map(item => clean(item.value)))}`);
      remember(`A Content Credential ${claims.length ? claims.join(", and ") : "is attached to the file"}.`, credentialItems,
        "provenance and editing claims stored in its Content Credential");
    }

    const descriptive = byCategory("text");
    if (descriptive.length) {
      remember(`The file carries descriptive text: ${formatList(descriptive.slice(0, 3).map(item => `${item.key} “${clean(item.value)}”`))}.`,
        descriptive, "descriptions, comments, or labels");
    }
    const embedded = byCategory("embedded");
    if (embedded.length) remember("The file contains an embedded thumbnail or alternate preview.", embedded, "an embedded preview");

    const removableFindings = findings.filter(removable);
    const uniqueDisclosures = [...new Set(disclosures)];
    const narrative = sentences.length ? sentences.join(" ")
      : removableFindings.length ? "The file contains removable metadata, but its readable fields do not support a more specific conclusion about the image."
      : "The readable metadata does not reveal a specific location, identity, device, date, software history, or provenance claim.";
    let privacyImpact;
    if (uniqueDisclosures.length) privacyImpact = `Someone receiving the original file could learn ${formatList(uniqueDisclosures)}.`;
    else if (removableFindings.length) privacyImpact = "The optional metadata increases the amount of information attached to the image, although no specific personal detail could be interpreted.";
    else privacyImpact = "No clear personal disclosure was identified in the supported metadata fields.";
    const removalSummary = removableFindings.length
      ? `Cleaning will remove ${removableFindings.length} metadata item${removableFindings.length === 1 ? "" : "s"}${uniqueDisclosures.length ? ` that expose ${formatList(uniqueDisclosures)}` : ""}, then inspect the rebuilt image again.`
      : "No removable metadata was detected, but the image will still be rebuilt and inspected again.";
    const certaintyNote = credentialItems.length
      ? "These statements summarize values recorded inside the file. Metadata can be changed or forged, and Content Credentials are described as claims unless their validation status independently confirms more."
      : "These statements summarize values recorded inside the file. Metadata can be missing, changed, or forged, so it is evidence about the file rather than proof of what happened.";
    return { narrative, privacyImpact, removalSummary, certaintyNote,
      evidence: [...new Set(evidence)], removableCount: removableFindings.length };
  };

  Tools.stripImageMetadata = async function (file, { inspection, verify = true } = {}) {
    if (!(file instanceof Blob)) throw new TypeError("stripImageMetadata expects an image Blob or File.");
    if (file.size > MAX_FILE_BYTES) throw new RangeError("Image exceeds 100 MB.");
    const before = inspection || await inspectBlob(file, true);
    const rebuilt = await rebuildPixels(file, before.format);
    const blob = await cleanEncodedBlob(rebuilt, before.format);
    const after = await inspectBlob(blob, verify);
    const remaining = after.findings.filter(removable);
    if (remaining.length) {
      throw new Error(`Verification failed: ${remaining.length} metadata item${remaining.length === 1 ? "" : "s"} remained.`);
    }
    const removed = before.findings.filter(removable);
    return {
      blob, before, after,
      report: {
        originalBytes: file.size,
        outputBytes: blob.size,
        detectedCount: before.findings.length,
        removedCount: removed.length,
        removedCategories: [...new Set(removed.map(item => item.category))],
        sensitiveCount: removed.filter(item => item.sensitive).length,
        c2paRemoved: (before.c2pa.found || structuralC2pa(before.findings)) &&
          !(after.c2pa.found || structuralC2pa(after.findings)),
        verificationPassed: true,
        remainingCount: 0
      }
    };
  };
})();

/* Audio/video metadata engine. Kept in this domain so tool pages share one
   inspection, explanation, remux, and verification contract. */
(function () {
  "use strict";
  const Tools = window.Tools = window.Tools || {};
  const MAX_BYTES = 250 * 1024 * 1024;
  const AUDIO = new Set(["mp3","m4a","aac","flac","wav","ogg","opus"]);
  const VIDEO = new Set(["mp4","m4v","mov","webm","mkv","avi"]);
  const C2PA_EXTS = new Set(["mp4","m4v","mov"]);
  const MEDIAINFO_VERSION = "0.3.7", C2PA_VERSION = "0.14.3";
  const FFMPEG_VERSION = "0.12.15", FFMPEG_UTIL_VERSION = "0.12.2", FFMPEG_CORE_VERSION = "0.12.10";
  let mediaInfoPromise, c2paPromise, ffmpegPromise, progressListener;

  const array = value => value == null ? [] : Array.isArray(value) ? value : [value];
  const extension = file => (file?.name?.match(/\.([^.]+)$/)?.[1] || "").toLowerCase();
  const short = value => String(value ?? "").replace(/[\u0000-\u001f]/g, " ").trim().slice(0, 600);
  const human = key => String(key).replace(/^@/,"").replace(/_/g," ").replace(/([a-z])([A-Z])/g,"$1 $2").replace(/\b\w/g,c=>c.toUpperCase());
  const entry = (key,value,category,source,sensitive=true) => ({ key, value:short(value), category, source, sensitive:Boolean(sensitive), container:category !== "required" });
  const removableMedia = item => item.category !== "required";
  const unique = items => { const seen=new Set(); return items.filter(item=>{const key=`${item.key}|${item.value}|${item.source}`; if(!item.value||seen.has(key))return false; seen.add(key); return true;}); };
  const mimeFor = (ext,fallback) => ({mp4:"video/mp4",m4v:"video/mp4",mov:"video/quicktime",webm:"video/webm",mkv:"video/x-matroska",avi:"video/x-msvideo",mp3:"audio/mpeg",m4a:"audio/mp4",aac:"audio/aac",flac:"audio/flac",wav:"audio/wav",ogg:"audio/ogg",opus:"audio/ogg"}[ext] || fallback || "application/octet-stream");
  const textAt=(bytes,offset,length)=>{let out="";for(let i=0;i<length&&offset+i<bytes.length;i++)out+=String.fromCharCode(bytes[offset+i]);return out;};
  const u32le=(b,p)=>(b[p]|(b[p+1]<<8)|(b[p+2]<<16)|(b[p+3]<<24))>>>0;
  const ascii=bytes=>{let out="";for(const c of bytes)out+=c>=32&&c<=126?String.fromCharCode(c):" ";return out;};

  async function mediaInfo(){
    if(!mediaInfoPromise) mediaInfoPromise=import(`https://cdn.jsdelivr.net/npm/mediainfo.js@${MEDIAINFO_VERSION}/+esm`).then(async module=>{
      const factory=module.default||module.mediaInfoFactory;
      if(typeof factory!=="function")throw new Error("The metadata inspector did not expose its factory.");
      return factory({format:"object",full:true,locateFile:path=>path.endsWith(".wasm")?`https://cdn.jsdelivr.net/npm/mediainfo.js@${MEDIAINFO_VERSION}/dist/MediaInfoModule.wasm`:path});
    });
    return mediaInfoPromise;
  }
  function categoryFor(key){const s=key.toLowerCase();if(/latitude|longitude|altitude|gps|location|country|city/.test(s))return"location";if(/artist|performer|composer|author|director|producer|publisher|owner|encoded_by|creator|written_by|screenplay|lyricist|conductor|person/.test(s))return"identity";if(/recorded_date|encoded_date|tagged_date|mastered_date|file_created|file_modified|creation_time|timestamp/.test(s))return"time";if(/encoded_application|encoded_library|writing_application|writing_library|encoder|encoding_settings|producer_reference/.test(s))return"software";if(/make|model|manufacturer|device|firmware|camera|recorder|serial/.test(s))return"device";if(/title|album|track_name|collection|genre|comment|description|synopsis|keywords|copyright|terms|label|grouping|lyrics|law_rating|content_type/.test(s))return"text";if(/cover|poster|thumbnail|attachment/.test(s))return"embedded";return null;}
  function retainedReason(key,ext,type){if(/^(encoded_library|encoded_library_settings)$/i.test(key)&&/^(Audio|Video)$/i.test(type))return"Codec signature inside the encoded stream; removing it requires quality-changing re-encoding.";if(/^(muxing_application|writing_application|encoded_library)$/i.test(key)&&["mkv","webm","ogg","opus"].includes(ext))return"Container-required technical identifier; cleaning replaces it with a neutral muxer value.";return"";}
  function extractFindings(info,kind,ext){const out=[];for(const track of array(info?.media?.track)){const type=String(track?.["@type"]||"General");const description=[track.Format_String||track.Format,track.Width&&track.Height?`${track.Width}×${track.Height}`:null,track.Duration_String].filter(Boolean).join(" · ")||type;if(type==="Image")out.push(entry(kind==="audio"?"Embedded cover artwork":"Embedded poster or thumbnail",description,"embedded","MediaInfo image track"));if(type==="Menu")out.push(entry("Chapters or menu",description,"chapter","MediaInfo menu track"));if(type==="Other"&&/time.?code|data/i.test(String(track.Format||track.Type||"")))out.push(entry("Data or timecode track",description,"embedded","MediaInfo auxiliary track"));for(const [key,value] of Object.entries(track||{})){if(key.startsWith("@")||value==null||value===""||typeof value==="object")continue;const category=categoryFor(key);if(!category)continue;const retained=retainedReason(key,ext,type);out.push(entry(human(key),value,retained?"required":category,retained||`${type} metadata recorded by the file`,!retained));}}return out;}
  async function structural(file,ext){const out=[],head=new Uint8Array(await file.slice(0,Math.min(file.size,2*1024*1024)).arrayBuffer()),tail=new Uint8Array(await file.slice(Math.max(0,file.size-2*1024*1024)).arrayBuffer());if(ext==="mp3"||ext==="aac"){if(textAt(head,0,3)==="ID3")out.push(entry("ID3v2 tag","Header metadata block","tag","Container structure"));if(tail.length>=128&&textAt(tail,tail.length-128,3)==="TAG")out.push(entry("ID3v1 tag","128-byte footer tag","tag","Container structure"));if(ascii(tail).includes("APETAGEX"))out.push(entry("APEv2 tag","Footer metadata block","tag","Container structure"));}if(ext==="flac"&&textAt(head,0,4)==="fLaC"){let p=4,last=false;while(!last&&p+4<=head.length){const first=head[p],type=first&127,len=(head[p+1]<<16)|(head[p+2]<<8)|head[p+3];last=Boolean(first&128);if(type===2)out.push(entry("FLAC application block",`${len} bytes`,"embedded","Container structure"));if(type===4)out.push(entry("Vorbis comments",`${len} bytes`,"tag","Container structure"));if(type===6)out.push(entry("Embedded picture",`${len} bytes`,"embedded","Container structure"));p+=4+len;}}if(ext==="wav"&&textAt(head,0,4)==="RIFF"&&textAt(head,8,4)==="WAVE"){const names={LIST:"RIFF INFO/list metadata",bext:"Broadcast Wave metadata",iXML:"iXML production metadata",axml:"AXML metadata",ID3:"Embedded ID3 tag","id3 ":"Embedded ID3 tag",cart:"Cart metadata",DISP:"Display metadata",C2PA:"C2PA Content Credential"};let p=12;while(p+8<=head.length){const type=textAt(head,p,4),len=u32le(head,p+4);if(names[type])out.push(entry(names[type],`${len} bytes`,type==="C2PA"?"credential":"tag","Container structure"));if(type==="data")break;p+=8+len+(len&1);}}const joined=`${ascii(head)} ${ascii(tail)}`.toLowerCase();if(joined.includes("c2pa")&&(joined.includes("jumb")||joined.includes("content credentials")))out.push(entry("C2PA or JUMBF marker","Provenance structure near a container boundary","credential","Structural marker scan"));return out;}
  async function inspectC2paMedia(blob,mime){if(!c2paPromise)c2paPromise=import(`https://cdn.jsdelivr.net/npm/@contentauth/c2pa-web@${C2PA_VERSION}/+esm`).then(m=>m.createC2pa({wasmSrc:`https://cdn.jsdelivr.net/npm/@contentauth/c2pa-web@${C2PA_VERSION}/dist/resources/c2pa_bg.wasm`}));const sdk=await c2paPromise,reader=await sdk.reader.fromBlob(mime,blob);if(!reader)return{checked:true,found:false,details:[]};try{const manifest=await reader.activeManifest(),details=[];if(manifest?.claim_generator)details.push(entry("Credential generator",manifest.claim_generator,"credential","C2PA claim",false));if(manifest?.title)details.push(entry("Credential title",manifest.title,"credential","C2PA manifest",false));return{checked:true,found:true,details};}finally{await reader.free();}}

  Tools.inspectMediaMetadata=async function(file,{kind,verifyC2pa=true}={}){if(!(file instanceof Blob))throw new TypeError("inspectMediaMetadata expects a media Blob or File.");if(file.size>MAX_BYTES)throw new RangeError("Media exceeds the 250 MB browser-processing limit.");const ext=extension(file),resolved=kind||(AUDIO.has(ext)?"audio":VIDEO.has(ext)?"video":null);if(!resolved||!(resolved==="audio"?AUDIO:VIDEO).has(ext))throw new Error(`Unsupported ${kind||"media"} format: .${ext||"unknown"}.`);const inspector=await mediaInfo(),info=await inspector.analyzeData(file.size,async(size,offset)=>new Uint8Array(await file.slice(offset,offset+size).arrayBuffer()));let findings=extractFindings(info,resolved,ext);findings.push(...await structural(file,ext));const warnings=[];let c2pa={checked:false,found:findings.some(x=>x.category==="credential"),details:[]};if(verifyC2pa&&C2PA_EXTS.has(ext)){try{c2pa=await inspectC2paMedia(file,mimeFor(ext,file.type));findings.push(...c2pa.details);}catch{warnings.push("Cryptographic Content Credential inspection was unavailable; structural and MediaInfo checks still ran.");}}const general=array(info?.media?.track).find(x=>x["@type"]==="General")||{};return{kind:resolved,extension:ext,formatLabel:general.Format_String||general.Format||ext.toUpperCase(),findings:unique(findings),warnings,c2pa};};

  Tools.explainMediaMetadata=async function(inspection){const findings=inspection?.findings||[],usable=findings.filter(removableMedia),by=category=>usable.filter(x=>x.category===category),sentences=[],evidence=[];const add=(text,items)=>{if(!items.length)return;sentences.push(text);evidence.push(...items.map(x=>x.key));};const identities=by("identity"),dates=by("time"),locations=by("location"),software=by("software"),descriptions=by("text"),embedded=by("embedded"),credentials=by("credential");add(`The file identifies ${identities.slice(0,3).map(x=>`${x.key.toLowerCase()} as “${x.value}”`).join(", ")}.`,identities);add(`It records ${dates.slice(0,3).map(x=>`${x.key.toLowerCase()} as ${x.value}`).join(", ")}.`,dates);add(`It contains location information: ${locations.slice(0,3).map(x=>x.value).join(", ")}.`,locations);add(`The file names ${software.slice(0,3).map(x=>x.value).join(", ")} in its encoding or software history.`,software);add(`It carries descriptive information: ${descriptions.slice(0,3).map(x=>`${x.key} “${x.value}”`).join(", ")}.`,descriptions);add(`It includes ${embedded.map(x=>x.key.toLowerCase()).slice(0,3).join(", ")}.`,embedded);add("A Content Credential or provenance marker is attached to the file.",credentials);const narrative=sentences.join(" ")||(usable.length?"The file contains removable metadata, but its readable fields do not support a more specific conclusion.":"The readable metadata does not reveal a specific identity, location, date, software history, description, or provenance claim.");const disclosures=[];if(identities.length)disclosures.push("a creator or owner identity");if(dates.length)disclosures.push("recorded dates");if(locations.length)disclosures.push("location information");if(software.length)disclosures.push("software or encoding history");if(descriptions.length)disclosures.push("titles, comments, or descriptions");if(credentials.length)disclosures.push("provenance claims");return{narrative,privacyImpact:disclosures.length?`Someone receiving the original could learn ${disclosures.join(", ")}.`:usable.length?"The optional metadata adds information to the media file, although no specific personal detail could be interpreted.":"No clear personal disclosure was identified in the supported metadata fields.",removalSummary:usable.length?`Cleaning will remove ${usable.length} optional metadata item${usable.length===1?"":"s"}, preserve the encoded ${inspection.kind} streams, and inspect the rebuilt file again.`:`No removable metadata was detected. The container can still be rebuilt and verified.`,certaintyNote:"These statements summarize values recorded inside the file. Metadata can be missing, changed, or forged, so it is evidence about the file rather than proof of what happened.",evidence:[...new Set(evidence)],removableCount:usable.length};};

  async function ffmpeg(onProgress){progressListener=onProgress;if(!ffmpegPromise)ffmpegPromise=(async()=>{const[{FFmpeg},util]=await Promise.all([import(`https://cdn.jsdelivr.net/npm/@ffmpeg/ffmpeg@${FFMPEG_VERSION}/+esm`),import(`https://cdn.jsdelivr.net/npm/@ffmpeg/util@${FFMPEG_UTIL_VERSION}/+esm`)]),engine=new FFmpeg();engine.on("progress",({progress})=>progressListener?.(Math.max(25,Math.min(78,25+progress*53)),"Rebuilding the container without metadata…"));const base=`https://cdn.jsdelivr.net/npm/@ffmpeg/core@${FFMPEG_CORE_VERSION}/dist/umd`;await engine.load({coreURL:await util.toBlobURL(`${base}/ffmpeg-core.js`,"text/javascript"),wasmURL:await util.toBlobURL(`${base}/ffmpeg-core.wasm`,"application/wasm")});return engine;})();return ffmpegPromise;}
  function args(input,output,kind,ext){const common=["-map_metadata","-1","-map_metadata:s","-1","-map_chapters","-1","-c","copy","-metadata","encoder=","-fflags","+bitexact"];const result=kind==="audio"?["-y","-i",input,"-map","0:a?","-vn","-sn","-dn",...common]:["-y","-i",input,"-map","0:V?","-map","0:a?","-map","0:s?","-dn",...common];if(ext==="mp3")result.push("-write_id3v1","0","-id3v2_version","0");if(ext==="wav")result.push("-write_bext","0");result.push(output);return result;}
  Tools.stripMediaMetadata=async function(file,{kind,inspection,verify=true,onProgress}={}){const before=inspection||await Tools.inspectMediaMetadata(file,{kind,verifyC2pa:true}),ext=before.extension,resolved=before.kind,engine=await ffmpeg(onProgress),stamp=`${Date.now()}_${Math.random().toString(36).slice(2)}`,input=`input_${stamp}.${ext}`,output=`clean_${stamp}.${ext}`;try{onProgress?.(15,"Reading the media file…");await engine.writeFile(input,new Uint8Array(await file.arrayBuffer()));onProgress?.(25,"Rebuilding the container without metadata…");const code=await engine.exec(args(input,output,resolved,ext));if(code!==0)throw new Error(`Media engine exited with code ${code}.`);onProgress?.(80,"Inspecting the cleaned output…");const data=await engine.readFile(output),blob=new Blob([data.buffer],{type:mimeFor(ext,file.type)}),cleanFile=new File([blob],`clean.${ext}`,{type:blob.type}),after=await Tools.inspectMediaMetadata(cleanFile,{kind:resolved,verifyC2pa:verify}),remaining=after.findings.filter(removableMedia);if(remaining.length)throw new Error(`Verification found ${remaining.length} removable metadata item${remaining.length===1?"":"s"} still present.`);const removed=before.findings.filter(removableMedia);onProgress?.(100,"Verified and ready to download.");return{blob,before,after,report:{originalBytes:file.size,outputBytes:blob.size,detectedCount:before.findings.length,removedCount:removed.length,removedCategories:[...new Set(removed.map(x=>x.category))],sensitiveCount:removed.filter(x=>x.sensitive).length,c2paRemoved:Boolean(before.c2pa?.found&&!after.c2pa?.found),verificationPassed:true,remainingCount:0}};}finally{progressListener=null;try{await engine.deleteFile(input);}catch{}try{await engine.deleteFile(output);}catch{}}};
})();
