/* ensaYOnesa — export.js
 * Todo lo relativo a la pestaña 4 (Exportar):
 * - Bind de UI del panel 4
 * - Guardar/cargar proyecto (JSON)
 * - Plantillas de estilos
 * - Demo
 * - Exportación a PDF (HTML + print)
 */

/* ===== Storage ===== */
const LS_PLT = 'ensaYOnesa:plantillas';

/* ===== Assets (solo imágenes) =====
   - En el contenido, las imágenes se insertan como un marcador de bloque:
       [img:<id>]
   - Los blobs (y metadatos) viven en IndexedDB para no inflar el JSON:
       DB: ensaYOnesaAssets
       Store: images
*/
const EF_ASSET_DB_NAME = 'ensaYOnesaAssets';
const EF_ASSET_DB_VERSION = 1;
const EF_ASSET_STORE_IMAGES = 'images';

// marcador de bloque (línea/paragraph completa)
const EF_RE_IMG_BLOCK = /^\[img:([a-zA-Z0-9_-]+)\]$/;

// cache DB
let _efAssetDbPromise = null;

function efOpenAssetDB(){
  if(_efAssetDbPromise) return _efAssetDbPromise;

  _efAssetDbPromise = new Promise((resolve, reject)=>{
    try{
      if(!('indexedDB' in window)){
        reject(new Error('indexedDB not supported'));
        return;
      }

      const req = indexedDB.open(EF_ASSET_DB_NAME, EF_ASSET_DB_VERSION);

      req.onupgradeneeded = () => {
        const db = req.result;
        if(!db.objectStoreNames.contains(EF_ASSET_STORE_IMAGES)){
          db.createObjectStore(EF_ASSET_STORE_IMAGES, { keyPath: 'id' });
        }
      };

      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error || new Error('IDB open error'));
    }catch(err){
      reject(err);
    }
  });

  return _efAssetDbPromise;
}

async function efGetImageAsset(id){
  const db = await efOpenAssetDB();
  return new Promise((resolve, reject)=>{
    try{
      const tx = db.transaction(EF_ASSET_STORE_IMAGES, 'readonly');
      const store = tx.objectStore(EF_ASSET_STORE_IMAGES);
      const req = store.get(id);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error || new Error('IDB get error'));
    }catch(err){
      reject(err);
    }
  });
}

async function efMeasureImageBlob(blob){
  if(!blob) return { w:0, h:0 };

  // createImageBitmap suele ser lo más rápido
  try{
    if(typeof createImageBitmap === 'function'){
      const bmp = await createImageBitmap(blob);
      const w = Number(bmp.width || 0);
      const h = Number(bmp.height || 0);
      try{ if(bmp && typeof bmp.close === 'function') bmp.close(); }catch{}
      if(w>0 && h>0) return { w, h };
    }
  }catch{ /* ignore */ }

  // Fallback con Image()
  return await new Promise((resolve)=>{
    try{
      const url = URL.createObjectURL(blob);
      const img = new Image();
      img.onload = ()=>{
        const w = Number(img.naturalWidth || 0);
        const h = Number(img.naturalHeight || 0);
        try{ URL.revokeObjectURL(url); }catch{}
        resolve({ w, h });
      };
      img.onerror = ()=>{
        try{ URL.revokeObjectURL(url); }catch{}
        resolve({ w:0, h:0 });
      };
      img.src = url;
    }catch{
      resolve({ w:0, h:0 });
    }
  });
}

function efGetImgUrlCache(){
  if(!window.__efImgObjectUrlCache){
    // Map<id, objectURL>
    window.__efImgObjectUrlCache = new Map();
  }
  return window.__efImgObjectUrlCache;
}

function efGetOrCreateObjectURL(id, blob){
  const cache = efGetImgUrlCache();
  if(cache.has(id)) return cache.get(id);
  const url = URL.createObjectURL(blob);
  cache.set(id, url);
  return url;
}

async function efLoadImageInfo(id){
  const safeId = String(id || '').trim();
  if(!safeId) return { id: safeId, missing:true, url:'', name:'', w:0, h:0 };

  let rec = null;
  try{
    rec = await efGetImageAsset(safeId);
  }catch(err){
    console.warn(err);
    rec = null;
  }

  if(!rec || !rec.blob){
    return { id: safeId, missing:true, url:'', name:'', w:0, h:0 };
  }

  // dimensiones: si preview.js las guardó, mejor; si no, medir
  let w = Number(rec.width || rec.w || 0);
  let h = Number(rec.height || rec.h || 0);

  if(!(w>0 && h>0)){
    try{
      const m = await efMeasureImageBlob(rec.blob);
      w = Number(m.w || 0);
      h = Number(m.h || 0);
    }catch{ /* ignore */ }
  }

  let url = '';
  try{
    url = efGetOrCreateObjectURL(safeId, rec.blob);
  }catch(err){
    console.warn(err);
    url = '';
  }

  return {
    id: safeId,
    missing: !url,
    url,
    name: String(rec.name || ''),
    type: String(rec.type || ''),
    w: (w>0 ? w : 0),
    h: (h>0 ? h : 0),
    blob: rec.blob
  };
}

async function efCollectImageAssetsFromState(S){
  const ids = new Set();

  const chapters = (S && S.content && Array.isArray(S.content.chapters)) ? S.content.chapters : [];
  const reAll = /\[img:([a-zA-Z0-9_-]+)\]/g;

  for(const cap of chapters){
    const subs = (cap && Array.isArray(cap.subsections)) ? cap.subsections : [];
    for(const sub of subs){
      const body = String(sub && sub.body || '');
      if(!body || body.indexOf('[img:') === -1) continue;
      for(const m of body.matchAll(reAll)){
        const id = String(m[1] || '').trim();
        if(id) ids.add(id);
      }
    }
  }

  const out = new Map();
  if(ids.size === 0) return out;

  // cargar en paralelo (con límite suave)
  const all = Array.from(ids);
  const CONC = 6;
  for(let i=0; i<all.length; i+=CONC){
    const batch = all.slice(i, i+CONC);
    const results = await Promise.all(batch.map(async (id)=>{
      const info = await efLoadImageInfo(id);
      return [id, info];
    }));
    for(const [id, info] of results){
      out.set(id, info);
    }
  }

  return out;
}

/* ===== Helpers (solo export) ===== */
const pxPerMm = 96 / 25.4; // píxeles por milímetro (~3.7795)
const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
const rgba = (hex, alpha=1) => {
  const v = (hex || '#000000').replace('#','');
  const r = parseInt(v.slice(0,2),16)||0, g = parseInt(v.slice(2,4),16)||0, b = parseInt(v.slice(4,6),16)||0;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};
const todayISO = () => new Date().toISOString().slice(0,10);
const lineHeightFor = (size, leading=1.4) => Math.round(size * (leading || 1.4));
const fontStack = (f) => {
  if(f==='monospace') return 'ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace';
  if(f==='sans-serif') return 'system-ui, -apple-system, "Segoe UI", Roboto, Ubuntu, Cantarell, Arial, "Noto Sans", "Helvetica Neue", sans-serif';
  return 'Georgia, "Times New Roman", Times, serif';
};
const countGaps = (text) => {
  const m = (text || '').trim().match(/\s+/g);
  return m ? m.length : 0;
};

// ✅ Sangría automática en contenido: AHORA 8 espacios (doble que antes)
const DEFAULT_CONTENT_INDENT_SPACES = 8;

/* ===== Inline formatting (BBCode-like) =====
   Soporta:
   - [b]...[/b] (negrita)
   - [i]...[/i] (cursiva)
   - [u]...[/u] (subrayado)

   En el contenido, también soporta marcadores de cita ^(N),
   que se renderizan como superíndice (N).
*/
function mergeInlineRuns(runs){
  // ✅ FIX: NO fusionar runs que sean whitespace (si los fusionas, el wrapper no puede romper por palabras)
  const out = [];
  const isWhitespaceRun = (x)=> !!(x && x.cite == null && /^\s+$/.test(String(x.text)));

  for(const r0 of (runs||[])){
    if(!r0 || r0.text == null) continue;

    const r = { ...r0, text: String(r0.text) };
    if(r.text.length === 0) continue;

    const last = out[out.length-1];

    const canMerge = last
      && last.cite == null
      && r.cite == null
      && last.b === r.b
      && last.i === r.i
      && last.u === r.u
      && !isWhitespaceRun(last)
      && !isWhitespaceRun(r)
      // seguridad extra: no pegar cruzando límites de whitespace
      && !/\s$/.test(String(last.text))
      && !/^\s/.test(String(r.text));

    if(canMerge){
      last.text += r.text;
    }else{
      out.push(r);
    }
  }
  return out;
}
function mergeInlineRunsForRender(runs){
  // Fusiona runs consecutivos con el mismo estilo.
  // IMPORTANTE: aquí SÍ fusionamos espacios para reducir DOM al renderizar.
  const out = [];
  for(const r0 of (runs||[])){
    if(!r0 || r0.text == null) continue;
    const r = { ...r0, text: String(r0.text) };
    if(r.text.length === 0) continue;

    const last = out[out.length-1];
    const canMerge = last
      && last.cite === r.cite
      && last.b === r.b
      && last.i === r.i
      && last.u === r.u;

    if(canMerge){
      last.text += r.text;
    }else{
      out.push(r);
    }
  }
  return out;
}
function parseInlineMarkupToRuns(text, opts={}) {
  const allowCites = (opts.allowCites !== false);
  const s = String(text || '');
  let i = 0;

  let bCount = 0, iCount = 0, uCount = 0;

  const runs = [];
  const citeNums = [];

  const pushText = (txt)=>{
    if(!txt) return;
    runs.push({
      text: txt,
      b: bCount > 0,
      i: iCount > 0,
      u: uCount > 0,
      cite: null
    });
  };

  while(i < s.length){
    // =========================
    // Citas: ^(123)
    // =========================
    if(allowCites && s[i] === '^' && s[i+1] === '('){
      // ✅ SOLO es cita si el tercer char es dígito: ^(1...
      const c2 = s[i+2] || '';
      if(/\d/.test(c2)){
        const m = s.slice(i).match(/^\^\((\d+)\)/);
        if(m){
          const n = Number(m[1]);
          if(Number.isFinite(n) && n > 0) citeNums.push(n);
          runs.push({
            text: `(${m[1]})`,
            b: bCount > 0,
            i: iCount > 0,
            u: uCount > 0,
            cite: (Number.isFinite(n) ? n : null)
          });
          i += m[0].length;
          continue;
        }
      }

      // ✅ No era una cita (ej: e^(−r)) → tratar '^' como literal y AVANZAR
      pushText('^');
      i += 1;
      continue;
    }

    // =========================
    // Tags: [b], [/b], [i], [/i], [u], [/u]
    // =========================
    if(s[i] === '['){
      const m = s.slice(i).match(/^\[(\/?)(b|i|u)\]/i);
      if(m){
        const closing = !!m[1];
        const tag = String(m[2]||'').toLowerCase();
        if(tag === 'b') bCount += (closing ? -1 : 1);
        if(tag === 'i') iCount += (closing ? -1 : 1);
        if(tag === 'u') uCount += (closing ? -1 : 1);
        bCount = Math.max(0, bCount);
        iCount = Math.max(0, iCount);
        uCount = Math.max(0, uCount);
        i += m[0].length;
        continue;
      }
      // si no es tag reconocido, tratar '[' como literal
      pushText('[');
      i += 1;
      continue;
    }

    // =========================
    // Texto normal: acumular hasta el próximo símbolo especial
    // =========================
    let j = i;
    while(j < s.length){
      const ch = s[j];

      // ✅ IMPORTANTE: solo paramos si es ^(DIGITO, no con e^(−r)
      if(
        allowCites &&
        ch === '^' &&
        s[j+1] === '(' &&
        /\d/.test(s[j+2] || '')
      ) break;

      if(ch === '[') break;
      j++;
    }

    pushText(s.slice(i, j));
    i = j;
  }

  // unique citeNums
  const seen = new Set();
  const uniqueCites = [];
  for(const n of citeNums){
    if(!seen.has(n)){
      seen.add(n);
      uniqueCites.push(n);
    }
  }

  return { runs: mergeInlineRuns(runs), citeNums: uniqueCites };
}
function normalizeInlineRunsWhitespace(runs){
  const out = [];
  let prevWasSpace = false;

  for(const r0 of (runs||[])){
    if(!r0 || !r0.text) continue;

    // las citas nunca deberían llevar espacios internos, pero por seguridad:
    if(r0.cite != null){
      if(out.length === 0) prevWasSpace = false;
      out.push({...r0});
      prevWasSpace = false;
      continue;
    }

    let txt = String(r0.text).replace(/\r/g,'').replace(/\n/g,' ');
    if(!txt) continue;

    // dividir en segmentos (espacio / no-espacio)
    const parts = txt.split(/(\s+)/);
    for(const seg of parts){
      if(!seg) continue;
      if(/^\s+$/.test(seg)){
        if(out.length === 0) continue;          // trim start
        if(prevWasSpace) continue;              // collapse
        out.push({ text:' ', b:r0.b, i:r0.i, u:r0.u, cite:null });
        prevWasSpace = true;
      }else{
        out.push({ text:seg, b:r0.b, i:r0.i, u:r0.u, cite:null });
        prevWasSpace = false;
      }
    }
  }

  // trim end
  while(out.length && out[out.length-1].cite == null && out[out.length-1].text === ' '){
    out.pop();
  }

  // ✅ con el mergeInlineRuns “fixeado”, ya NO se recomen los espacios
  return mergeInlineRuns(out);
}

function fontForInlineRun(fmt, run, sizePx){
  const parts = [];
  if(run?.i) parts.push('italic');
  if(run?.b) parts.push('bold');
  parts.push(`${sizePx}px`);
  parts.push(fontStack(fmt.font));
  return parts.join(' ');
}

function inlineRunMeasureSize(fmt, run, mode){
  // mode:
  // - 'wrap'   => conservador (citas al tamaño normal)
  // - 'render' => más realista (citas como superíndice)
  if(run && run.cite != null && mode === 'render'){
    return Math.max(8, Math.round((fmt.size || 12) * 0.7));
  }
  return (fmt.size || 12);
}

function measureInlineRunsWidth(runs, fmt, ctx, mode='wrap'){
  let w = 0;
  for(const r of (runs||[])){
    if(!r || !r.text) continue;
    const sz = inlineRunMeasureSize(fmt, r, mode);
    ctx.font = fontForInlineRun(fmt, r, sz);
    w += ctx.measureText(r.text).width;
  }
  return w;
}

function splitInlineRunsIntoPieces(runs){
  // ✅ FIX: aunque algún run traiga espacios dentro (por merges previos),
  // lo partimos en piezas word/space para que el wrapper funcione SIEMPRE.
  const pieces = [];
  let wordRuns = [];

  const flushWord = ()=>{
    if(wordRuns.length){
      pieces.push({ type:'word', runs: mergeInlineRuns(wordRuns) });
      wordRuns = [];
    }
  };

  for(const r0 of (runs||[])){
    if(!r0 || r0.text == null) continue;
    const txt = String(r0.text);
    if(!txt) continue;

    // citas: no rompen palabra
    if(r0.cite != null){
      wordRuns.push({ ...r0, text: txt });
      continue;
    }

    // dividir por whitespace (robusto)
    const parts = txt.split(/(\s+)/);
    for(const seg of parts){
      if(!seg) continue;

      if(/^\s+$/.test(seg)){
        flushWord();
        // colapsar a un único espacio
        pieces.push({
          type:'space',
          runs: [{
            text:' ',
            b: !!r0.b,
            i: !!r0.i,
            u: !!r0.u,
            cite: null
          }]
        });
      }else{
        wordRuns.push({ ...r0, text: seg });
      }
    }
  }

  flushWord();
  return pieces;
}

function wrapRunsToLines(runs, fmt, maxWidthPx, ctx, options={}){
  const firstLineIndentPx = Number.isFinite(options.firstLineIndentPx) ? options.firstLineIndentPx : 0;
  const mode = options.mode || 'wrap';

  const pieces = splitInlineRunsIntoPieces(runs);

  const lines = [];
  let curPieces = [];
  let curW = 0;

  const finalizeLine = ()=>{
    // quitar espacios finales
    while(curPieces.length && curPieces[curPieces.length-1].type === 'space'){
      const sp = curPieces.pop();
      curW -= measureInlineRunsWidth(sp.runs, fmt, ctx, mode);
    }

    if(curPieces.length === 0){
      curW = 0;
      return;
    }

    // construir runs + texto + citeNums
    const lineRuns = [];
    for(const p of curPieces){
      for(const rr of (p.runs||[])){
        lineRuns.push(rr);
      }
    }

    // 1) merge "para wrap" (no fusiona whitespace)
    const merged = mergeInlineRuns(lineRuns);

    // 2) merge "para render" (sí fusiona whitespace)
    const mergedRender = mergeInlineRunsForRender(merged);

    const citeSet = new Set();
    for(const rr of mergedRender){
      if(rr.cite != null && Number.isFinite(rr.cite) && rr.cite > 0){
        citeSet.add(rr.cite);
      }
    }
    const citeNums = Array.from(citeSet);

    const text = mergedRender.map(rr=>rr.text).join('');

    const lineW = Math.max(0, curW);

    lines.push({
      runs: mergedRender,
      text,
      citeNums,
      widthPx: lineW
    });

    curPieces = [];
    curW = 0;
  };

  for(let idx=0; idx<pieces.length; idx++){
    const p = pieces[idx];
    const lineLimit = maxWidthPx - (lines.length === 0 ? firstLineIndentPx : 0);

    // no iniciar línea con espacio
    if(curPieces.length === 0 && p.type === 'space') continue;

    const pW = measureInlineRunsWidth(p.runs, fmt, ctx, mode);

    if(curPieces.length === 0){
      // primera pieza: aunque sea más larga que el límite, la metemos
      curPieces.push(p);
      curW = pW;
      continue;
    }

    if(curW + pW <= lineLimit){
      curPieces.push(p);
      curW += pW;
    }else{
      finalizeLine();

      // saltar espacios al inicio de nueva línea
      if(p.type === 'space') continue;

      // en nueva línea, meterla aunque sea larga
      curPieces.push(p);
      curW = pW;
    }
  }

  finalizeLine();
  return lines;
}

/* ===== Word-wrap por párrafos con sangría (manual y/o automática) ===== */
function wrapParagraphs(text, fmt, maxWidthPx, ctx, opts={}){
  ctx.font = `${fmt.size}px ${fontStack(fmt.font)}`;

  const rawParas = (text||'').replace(/\r/g,'').split(/\n{2,}/); // párrafos separados por líneas en blanco
  const out = [];

  const autoIndent = !!opts.autoIndent;
  const indentSpaces = Number.isFinite(opts.indentSpaces) ? opts.indentSpaces : 0;
  const noIndentFirstParagraph = !!opts.noIndentFirstParagraph;

  const spaceW = ctx.measureText(' ').width;

  let pIndex = 0;
  for(const raw of rawParas){
    // contar espacios iniciales (sangría manual)
    const m = raw.match(/^\s+/);
    const leadingSpaces = m ? m[0].length : 0;
    const manualIndentPx = leadingSpaces * spaceW;

    const autoIndentPx = (autoIndent && !manualIndentPx && !(noIndentFirstParagraph && pIndex===0))
      ? (Math.max(0, indentSpaces) * spaceW)
      : 0;

    const indentPx = manualIndentPx || autoIndentPx;

    const s = raw.replace(/^\s+/,'').replace(/\n+/g,' ').replace(/\s+/g,' ').trim();
    if(!s){ out.push({lines:[], indentPx}); pIndex++; continue; }

    const words = s.split(' ');
    const lines = [];
    let current = '';
    for(const w of words){
      const test = current ? current + ' ' + w : w;
      const limit = maxWidthPx - (lines.length===0 ? indentPx : 0);
      if(ctx.measureText(test).width <= limit){
        current = test;
      }else{
        if(current) lines.push(current);
        current = w;
      }
    }
    if(current) lines.push(current);

    out.push({lines, indentPx});
    pIndex++;
  }
  return out;
}

/* ===== NUEVO: wrap para contenido con formato inline ===== */
function wrapParagraphsRich(text, fmt, maxWidthPx, ctx, opts={}){
  // base (para ancho del espacio)
  ctx.font = `${fmt.size}px ${fontStack(fmt.font)}`;

  const rawParas = (text||'').replace(/\r/g,'').split(/\n{2,}/);
  const out = [];

  const autoIndent = !!opts.autoIndent;
  const indentSpaces = Number.isFinite(opts.indentSpaces) ? opts.indentSpaces : 0;
  const noIndentFirstParagraph = !!opts.noIndentFirstParagraph;

  const spaceW = ctx.measureText(' ').width;

  let pIndex = 0;
  for(const raw0 of rawParas){
    // sangría manual (espacios al inicio)
    const m = raw0.match(/^\s+/);
    const leadingSpaces = m ? m[0].length : 0;
    const manualIndentPx = leadingSpaces * spaceW;

    const autoIndentPx = (autoIndent && !manualIndentPx && !(noIndentFirstParagraph && pIndex===0))
      ? (Math.max(0, indentSpaces) * spaceW)
      : 0;

    const indentPx = manualIndentPx || autoIndentPx;

    const raw = raw0.replace(/^\s+/, '');

    // parse + normalize
    const parsed = parseInlineMarkupToRuns(raw, { allowCites:true });
    const normRuns = normalizeInlineRunsWhitespace(parsed.runs);

    if(!normRuns || normRuns.length===0){
      out.push({ lines:[], indentPx });
      pIndex++;
      continue;
    }

    // wrap
    const lines = wrapRunsToLines(normRuns, fmt, maxWidthPx, ctx, {
      firstLineIndentPx: indentPx,
      mode: 'wrap'
    });

    out.push({ lines, indentPx });
    pIndex++;
  }

  return out;
}

/* ===== Hidratar panel 4 desde state ===== */
function hydratePanel4FromState(){
  if(typeof state === 'undefined') return;

  // export
  const tam = document.getElementById('tamPagina');
  if(tam) tam.value = state.export.pageSize;

  const ms = document.getElementById('margenSup');
  const mi = document.getElementById('margenInf');
  const miz = document.getElementById('margenIzq');
  const mde = document.getElementById('margenDer');
  if(ms) ms.value = state.export.margins.top;
  if(mi) mi.value = state.export.margins.bottom;
  if(miz) miz.value = state.export.margins.left;
  if(mde) mde.value = state.export.margins.right;

  const gap = document.getElementById('gapCabTexto');
  if(gap) gap.value = state.export.headerGapMm ?? 6;

  const br = document.getElementById('breakOnChapter');
  if(br) br.checked = !!state.export.breakOnChapter;

  // ✅ NUEVO: apéndices finales (Citas / Bibliografía)
  const endCites = document.getElementById('endCitesEnabled');
  if(endCites) endCites.checked = (state.export.citationsPageEnabled !== false);

  const endBib = document.getElementById('endBibliographyEnabled');
  if(endBib) endBib.checked = !!state.export.bibliographyEnabled;

  const nf = document.getElementById('nombreArchivo');
  if(nf) nf.value = state.export.fileName;

  // plantillas
  refreshPlantillasSelect();
}

/* ===== Panel 4: Exportar / Plantillas / Guardar / Cargar ===== */
function bindPanel4(){
  const elTam = document.getElementById('tamPagina');
  if(elTam) elTam.addEventListener('change', e=>{ state.export.pageSize = e.target.value; saveState(); });

  ['Sup','Inf','Izq','Der'].forEach(sfx=>{
    const inp = document.getElementById(`margen${sfx}`);
    if(!inp) return;
    inp.addEventListener('input', e=>{
      const val = Number(e.target.value);
      if(Number.isFinite(val)){
        state.export.margins = {
          top: Number(document.getElementById('margenSup').value),
          bottom: Number(document.getElementById('margenInf').value),
          left: Number(document.getElementById('margenIzq').value),
          right: Number(document.getElementById('margenDer').value)
        };
        saveState();
      }
    });
  });

  const gap = document.getElementById('gapCabTexto');
  if(gap) gap.addEventListener('input', e=>{
    state.export.headerGapMm = Number(e.target.value)||0; saveState();
  });

  // salto de página por capítulo
  const br = document.getElementById('breakOnChapter');
  if(br){
    br.addEventListener('change', e=>{
      state.export.breakOnChapter = !!e.target.checked;
      saveState();
    });
  }

  // ✅ NUEVO: apéndices finales (Citas / Bibliografía)
  const endCites = document.getElementById('endCitesEnabled');
  if(endCites){
    endCites.addEventListener('change', e=>{
      state.export.citationsPageEnabled = !!e.target.checked;
      saveState();
    });
  }

  const endBib = document.getElementById('endBibliographyEnabled');
  if(endBib){
    endBib.addEventListener('change', e=>{
      state.export.bibliographyEnabled = !!e.target.checked;
      saveState();
    });
  }

  const nf = document.getElementById('nombreArchivo');
  if(nf){
    // ✅ i18n: si se borra el input, usar el nombre por defecto localizado
    const defaultPdfName = t('panel4.defaultPdfFileName', 'ensayo.pdf');
    nf.addEventListener('input', e=>{
      state.export.fileName = e.target.value || defaultPdfName;
      saveState();
    });
  }

  const btnGuardar = document.getElementById('btnGuardar');
  if(btnGuardar) btnGuardar.addEventListener('click', ()=>{
    const filename = t('panel4.defaultProjectFileName', 'ensayo.json');
    downloadJSON(filename, state);
  });

  // Cargar proyecto completo (.json)
  const btnCargar = document.getElementById('btnCargar');
  if(btnCargar) btnCargar.addEventListener('click', ()=>{
    pickJSONFile((data)=>{
      try{
        const obj = JSON.parse(data);
        // merge con defaultState para compatibilidad
        const merged = structuredClone(defaultState);
        Object.assign(merged.meta, obj.meta||{});
        deepMergeStyles(merged.styles, obj.styles||{});
        merged.toc     = {...merged.toc, ...(obj.toc||{})};
        merged.content = obj.content || merged.content;
        merged.export  = {...merged.export, ...(obj.export||{})};
        // citas (compatibilidad)
        merged.citations = structuredClone(defaultState.citations);
        if(obj.citations && typeof obj.citations === 'object'){
          if(Array.isArray(obj.citations.items)){
            merged.citations.items = obj.citations.items;
          }else if(Array.isArray(obj.citations)){
            merged.citations.items = obj.citations;
          }
        }
        normalizeLayoutToStandard(merged);
        state = merged;
        saveState();
        hydrateUIFromState();
        alert(t('panel4.alerts.projectLoaded', 'Proyecto cargado.'));
      }catch(e){
        alert(t('panel4.alerts.invalidProjectJson', 'El JSON no es válido.'));
      }
    });
  });

  const btnLimpiar = document.getElementById('btnLimpiar');
  if(btnLimpiar) btnLimpiar.addEventListener('click', ()=>{
    const msg = t(
      'panel4.alerts.confirmClearAll',
      '¿Seguro que quieres limpiar todos los campos y vaciar la base de datos local?'
    );
    if(!confirm(msg)) return;
    localStorage.removeItem('ensaYOnesa:data');
    state = structuredClone(defaultState);
    normalizeLayoutToStandard(state);
    hydrateUIFromState();
    saveState();
  });

  // cargar demo completa
  const btnDemo = document.getElementById('btnDemo');
  if(btnDemo) btnDemo.addEventListener('click', ()=>{
    const msg = t(
      'panel4.alerts.demoConfirm',
      'Esto reemplazará el contenido actual por un ensayo de demostración. ¿Continuar?'
    );
    if(!confirm(msg)) return;
    loadDemoProject();
  });

  const btnGuardarPlantilla = document.getElementById('btnGuardarPlantilla');
  if(btnGuardarPlantilla) btnGuardarPlantilla.addEventListener('click', ()=>{
    const promptMsg = t(
      'panel4.prompts.templateName',
      'Nombre de la plantilla de estilos (no incluye títulos ni contenidos):'
    );
    const nowStr = new Date().toLocaleString();
    const defaultTplName = t(
      'panel4.defaultTemplateNameWithDate',
      `Plantilla ${nowStr}`,
      { datetime: nowStr }
    );
    const nombre = prompt(promptMsg, defaultTplName);
    if(!nombre) return;
    const plt = { name: nombre, styles: structuredClone(state.styles), export: structuredClone(state.export) };
    const all = loadPlantillas();
    all.push(plt);
    localStorage.setItem(LS_PLT, JSON.stringify(all));
    refreshPlantillasSelect();
    alert(t('panel4.alerts.templateSaved', 'Plantilla guardada.'));
  });

  // Cargar plantilla .json (solo styles + export)
  const btnCargarPlantilla = document.getElementById('btnCargarPlantilla');
  if(btnCargarPlantilla) btnCargarPlantilla.addEventListener('click', ()=>{
    pickJSONFile((data)=>{
      try{
        const plt = JSON.parse(data);
        if(!plt.styles && !plt.export){
          alert(t('panel4.alerts.templateNotDetected', 'Este JSON no parece una plantilla.'));
          return;
        }
        deepMergeStyles(state.styles, plt.styles||{});
        state.export = {...state.export, ...(plt.export||{})};
        normalizeLayoutToStandard(state);
        saveState();
        hydrateUIFromState();
        alert(t('panel4.alerts.templateApplied', 'Plantilla aplicada.'));
      }catch(e){
        alert(t('panel4.alerts.invalidTemplateJson', 'El JSON de plantilla no es válido.'));
      }
    });
  });

  const btnExportarPlantilla = document.getElementById('btnExportarPlantilla');
  if(btnExportarPlantilla) btnExportarPlantilla.addEventListener('click', ()=>{
    const sel = document.getElementById('selPlantillas'); const idx = Number(sel.value);
    const all = loadPlantillas();
    if(idx<0 || idx>=all.length){
      alert(t('panel4.alerts.selectTemplate', 'Selecciona una plantilla.'));
      return;
    }
    const plt = all[idx];
    const baseName = (plt.name || t('panel4.defaultTemplateBaseFileName', 'plantilla')).replace(/\s+/g,'_');
    downloadJSON(`${baseName}.json`, plt);
  });

  const btnExportar = document.getElementById('btnExportar');
  if(btnExportar) btnExportar.addEventListener('click', ()=>exportToPrintPDF(state));
}


function pickJSONFile(cb){
  const inp = document.createElement('input');
  inp.type = 'file'; inp.accept = 'application/json';
  inp.onchange = () => {
    const file = inp.files?.[0]; if(!file) return;
    const fr = new FileReader();
    fr.onload = () => cb(String(fr.result||''));
    fr.readAsText(file);
  };
  inp.click();
}

function loadPlantillas(){
  try{
    const raw = localStorage.getItem(LS_PLT);
    return raw? JSON.parse(raw): [];
  }catch{ return []; }
}
function refreshPlantillasSelect(){
  const sel = document.getElementById('selPlantillas');
  if(!sel) return;
  const all = loadPlantillas();
  sel.innerHTML='';
  if(all.length===0){
    const o=document.createElement('option');
    o.value=-1;
    o.textContent = t('panel4.noTemplatesOption', '— Sin plantillas guardadas —');
    sel.appendChild(o);
    return;
  }
  all.forEach((p,i)=>{
    const o=document.createElement('option');
    const fallbackName = t(
      'panel4.defaultTemplateNameShort',
      `Plantilla ${i+1}`,
      { index: i + 1 }
    );
    o.value=i;
    o.textContent=p.name || fallbackName;
    sel.appendChild(o);
  });
}

function downloadJSON(filename, data){
  const blob = new Blob([JSON.stringify(data, null, 2)], {type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href=url; a.download=filename;
  document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
}

/* ===== Ensayo demo integrado ===== */
function loadDemoProject(){
  const demo = structuredClone(defaultState);

  // ✅ Respetar preferencia actual (romanos/ar) al cargar la demo
  const currentStyle = (typeof state !== 'undefined' && state && state.toc && state.toc.numberingStyle)
    ? state.toc.numberingStyle
    : (demo.toc.numberingStyle || 'roman');
  demo.toc.numberingStyle = (currentStyle === 'arabic') ? 'arabic' : 'roman';

  // Textos localizados para la demo
  const demoMetaTitle = t(
    'demo.meta.title',
    'Ensayo demo: Coherencia y forma'
  );
  const demoMetaSubtitle = t(
    'demo.meta.subtitle',
    'Plantilla estándar de ensaYOnesa'
  );
  const demoMetaAuthor = t(
    'demo.meta.author',
    'OptimeFlow(s) · Ejemplo'
  );
  const demoMetaLicense = t(
    'demo.meta.license',
    'CC BY-NC-SA 4.0 (ejemplo)'
  );
  const demoMetaEmail = t(
    'demo.meta.email',
    'autor@ejemplo.com'
  );
  const demoMetaNote = t(
    'demo.meta.note',
    'Este es un ensayo de demostración generado por la plantilla interna de ensaYOnesa. Puedes escribir encima sin miedo: todo el contenido es ficticio y está pensado solo para probar el formato.'
  );
  const demoMetaSummary = t(
    'demo.meta.summary',
    'El objetivo de este ensayo de demostración es mostrar cómo se ve el formato estándar de ensaYOnesa: portada, índice, capítulos, subsecciones y texto justificado. Puedes modificar títulos, textos y estilos sin tocar el código.'
  );
  const demoMetaKeywords = t(
    'demo.meta.keywords',
    'demo; plantilla; coherencia; ejemplo'
  );
  const demoFooterText = t(
    'demo.footer.text',
    'ensaYOnesa · optimeflow.com · Plantilla de demostración'
  );

  // ✅ Valores demo también i18n (aparecen en portada/metadatos/archivo)
  const demoMetaSafeCreativeId = t(
    'demo.meta.safeCreativeId',
    'SC-DEMO-000000'
  );
  const demoMetaDoi = t(
    'demo.meta.doi',
    '10.0000/demo.ensayonesa'
  );
  const demoExportFileName = t(
    'demo.export.fileName',
    'ensayo-demo.pdf'
  );

  const ch1Title = t('demo.ch1.title', 'I. Punto de partida');
  const ch1s0Title = t('demo.ch1.s0.title', 'I. Punto de partida');
  const ch1s0Body = t(
    'demo.ch1.s0.body',
    'Este primer capítulo de demostración resume la idea de un ensayo sencillo y legible. La portada, el índice y el cuerpo del texto están pensados para trabajar juntos, sin que tengas que preocuparte por el maquetado.\n\nPuedes usar este capítulo como borrador: cambia los títulos, añade tus propios párrafos y comprueba cómo la plantilla mantiene el formato estándar.'
  );
  const ch1s1Title = t('demo.ch1.s1.title', 'I.1. Pregunta inicial');
  const ch1s1Body = t(
    'demo.ch1.s1.body',
    'Aquí iría la primera subsección real del capítulo. Un buen comienzo suele responder a tres preguntas: qué quiero contar, para quién lo escribo y qué forma necesito para que se entienda con calma.\n\nEn este ejemplo, el foco está en mostrarte el flujo: portada → índice → capítulo → subsecciones. A partir de aquí, todo lo que escribas será ya tu propio ensayo.'
  );
  const ch1s2Title = t('demo.ch1.s2.title', 'I.2. Contexto y nota metodológica');
  const ch1s2Body = t(
    'demo.ch1.s2.body',
    'Esta segunda subsección de ejemplo muestra cómo se distribuye el texto cuando los párrafos se extienden durante varias líneas. El interlineado y la justificación están pensados para lectura en pantalla y en papel, sin que tengas que ajustar nada.\n\nSi quieres, puedes usar esta subsección para explicar el contexto de tu ensayo: de dónde nace la idea, qué fuentes tienes presentes y qué no pretende hacer tu texto.'
  );

  const ch2Title = t('demo.ch2.title', 'II. Cuerpo del ensayo');
  const ch2s0Title = t('demo.ch2.s0.title', 'II. Cuerpo del ensayo');
  const ch2s0Body = t(
    'demo.ch2.s0.body',
    'Este capítulo de ejemplo representa el corazón del texto: el lugar donde desarrollas tu argumento, tus escenas o tus datos. Puedes dividirlo en tantas subsecciones como necesites; aquí te mostramos dos para que veas el comportamiento básico.'
  );
  const ch2s1Title = t('demo.ch2.s1.title', 'II.1. Desarrollo principal');
  const ch2s1Body = t(
    'demo.ch2.s1.body',
    'La primera subsección del cuerpo del ensayo suele acoger la parte más fuerte del argumento: aquello que quieres que la lectora recuerde incluso si solo hojea el texto.\n\nEn este espacio puedes combinar párrafos más largos con otros breves. La plantilla se encarga de conservar márgenes, tipografía y justificación.'
  );
  const ch2s2Title = t('demo.ch2.s2.title', 'II.2. Matices y ejemplos');
  const ch2s2Body = t(
    'demo.ch2.s2.body',
    'Aquí podrías añadir ejemplos concretos, pequeñas escenas, datos o referencias. Cuando los párrafos se conectan con calma, la sensación de lectura es de hilo continuo, no de lista de ideas sueltas.\n\nPuedes borrar este texto y escribir directamente encima: la estructura del capítulo y de las subsecciones seguirá funcionando igual.'
  );

  const ch3Title = t('demo.ch3.title', 'III. Cierre y siguientes pasos');
  const ch3s0Title = t('demo.ch3.s0.title', 'III. Cierre y siguientes pasos');
  const ch3s0Body = t(
    'demo.ch3.s0.body',
    'El último capítulo de este ejemplo está pensado para tu conclusión: qué te llevas del proceso, qué ofreces a quien lee y qué caminos se abren después del texto.\n\nUn cierre claro ayuda a que el ensayo no se quede solo en una serie de ideas interesantes, sino en una forma que puede volver a visitarse y compartirse.'
  );
  const ch3s1Title = t('demo.ch3.s1.title', 'III.1. Síntesis');
  const ch3s1Body = t(
    'demo.ch3.s1.body',
    'En la síntesis puedes recoger las líneas principales del ensayo en un par de párrafos: cuál era la pregunta de partida, qué has descubierto y qué queda abierto.\n\nLa idea es que alguien que llegue directamente aquí pueda entender, en pocas líneas, el esqueleto del texto.'
  );
  const ch3s2Title = t('demo.ch3.s2.title', 'III.2. Invitación al lector');
  const ch3s2Body = t(
    'demo.ch3.s2.body',
    'Por último, este espacio puede servir como invitación: qué puede hacer ahora la persona que ha leído el ensayo, qué gesto pequeño puede probar o qué conversación podría abrir.\n\nUna buena conclusión no cierra todo, pero sí señala un siguiente paso posible.'
  );

  // === Demo: añadir citaciones de prueba (una por subsección) ===
  const addDemoCite = (body, n)=>{
    const s = String(body || '');
    const parts = s.split(/\n\n+/);
    if(parts.length>0 && parts[0].trim()){
      parts[0] = parts[0] + `^(${n})`;
      return parts.join('\n\n');
    }
    return s + `^(${n})`;
  };

  // Insertar marcadores en el texto demo
  const demoBodies = [ch1s0Body, ch1s1Body, ch1s2Body, ch2s0Body, ch2s1Body, ch2s2Body, ch3s0Body, ch3s1Body, ch3s2Body];
  const demoBodiesWithCites = demoBodies.map((b,i)=>addDemoCite(b, i+1));
  const [ch1s0BodyC, ch1s1BodyC, ch1s2BodyC, ch2s0BodyC, ch2s1BodyC, ch2s2BodyC, ch3s0BodyC, ch3s1BodyC, ch3s2BodyC] = demoBodiesWithCites;

  // Definir contenido de las citaciones (✅ i18n)
  const demoCiteWordPrefix = t('demo.citations.wordPrefix', 'demo-');
  const demoCiteTexts = [
    t('demo.citations.c1', 'Cita demo 1: referencia breve para probar el pie de página.'),
    t('demo.citations.c2', 'Cita demo 2: referencia algo más larga para forzar el salto de línea en el pie de página y comprobar márgenes.'),
    t('demo.citations.c3', 'Cita demo 3: otra referencia para ver varias citas apiladas en una misma página.'),
    t('demo.citations.c4', 'Cita demo 4: ejemplo de cita con texto medio (sirve para testear el apéndice final de citaciones).'),
    t('demo.citations.c5', 'Cita demo 5: cita de prueba.'),
    t('demo.citations.c6', 'Cita demo 6: cita de prueba con algo más de longitud para comprobar el word-wrap.'),
    t('demo.citations.c7', 'Cita demo 7: cita de prueba.'),
    t('demo.citations.c8', 'Cita demo 8: cita de prueba.'),
    t('demo.citations.c9', 'Cita demo 9: cita de prueba.')
  ];

  demo.citations = structuredClone(defaultState.citations);
  demo.citations.items = Array.from({length:9}, (_,i)=>({
    word: `${demoCiteWordPrefix}${i+1}`,
    text: demoCiteTexts[i] || t(
      'demo.citations.defaultText',
      'Cita demo {{number}}: cita de prueba.',
      { number: i + 1 }
    ),
    capIdx: Math.floor(i/3),
    type: 'bibliographic',
    includeInCitationsPage: true,
    subIdx: (i%3),
    createdAt: new Date().toISOString()
  }));

  demo.meta = {
    ...demo.meta,
    titulo: demoMetaTitle,
    subtitulo: demoMetaSubtitle,
    autor: demoMetaAuthor,
    licencia: demoMetaLicense,
    email: demoMetaEmail,
    safeCreativeId: demoMetaSafeCreativeId,
    doi: demoMetaDoi,
    nota: demoMetaNote,
    resumen: demoMetaSummary,
    palabrasClave: demoMetaKeywords,
    fechaPublicacion: todayISO()
  };

  // Estilos básicos del modelo estándar
  demo.styles.header.enabled = true;
  demo.styles.header.line = 'solid';
  demo.styles.header.align = 'justify';

  demo.styles.footer.enabled = true;
  demo.styles.footer.line = 'solid';
  demo.styles.footer.align = 'center';
  demo.styles.footer.text = demoFooterText;

  // por defecto: mostrar citaciones en el pie si el pie está activado
  demo.styles.footer.citationsEnabled = true;

  demo.styles.pageNumbers.enabled = true;
  demo.styles.pageNumbers.position = 'bottom-right';

  // Índice (solo títulos; páginas se calculan al exportar)
  demo.toc.enabled = true;
  demo.toc.count = 3;
  demo.toc.items = [
    { title: ch1Title },
    { title: ch2Title },
    { title: ch3Title }
  ];

  // Área de contenido
  const capFmt = {
    font:'serif', size:22, color:'#111111', alpha:1, align:'center', leading:1.6
  };
  const subFmt = {
    font:'serif', size:16, color:'#111111', alpha:1, align:'left',
    // ✅ 1) interlineado demo de “Título de subsección” = 1.8
    leading:1.8
  };
  const contFmt = {
    font:'serif', size:13, color:'#111111', alpha:1, align:'justify', leading:1.45
  };

  demo.content = { chapters: [] };

  demo.content.chapters.push({
    title: ch1Title,
    subsections: [
      { title: ch1s0Title, body: ch1s0BodyC, fmt:{ cap: structuredClone(capFmt), sub: structuredClone(subFmt), cont: structuredClone(contFmt) } },
      { title: ch1s1Title, body: ch1s1BodyC, fmt:{ cap: structuredClone(capFmt), sub: structuredClone(subFmt), cont: structuredClone(contFmt) } },
      { title: ch1s2Title, body: ch1s2BodyC, fmt:{ cap: structuredClone(capFmt), sub: structuredClone(subFmt), cont: structuredClone(contFmt) } }
    ]
  });

  demo.content.chapters.push({
    title: ch2Title,
    subsections: [
      { title: ch2s0Title, body: ch2s0BodyC, fmt:{ cap: structuredClone(capFmt), sub: structuredClone(subFmt), cont: structuredClone(contFmt) } },
      { title: ch2s1Title, body: ch2s1BodyC, fmt:{ cap: structuredClone(capFmt), sub: structuredClone(subFmt), cont: structuredClone(contFmt) } },
      { title: ch2s2Title, body: ch2s2BodyC, fmt:{ cap: structuredClone(capFmt), sub: structuredClone(subFmt), cont: structuredClone(contFmt) } }
    ]
  });

  demo.content.chapters.push({
    title: ch3Title,
    subsections: [
      { title: ch3s0Title, body: ch3s0BodyC, fmt:{ cap: structuredClone(capFmt), sub: structuredClone(subFmt), cont: structuredClone(contFmt) } },
      { title: ch3s1Title, body: ch3s1BodyC, fmt:{ cap: structuredClone(capFmt), sub: structuredClone(subFmt), cont: structuredClone(contFmt) } },
      { title: ch3s2Title, body: ch3s2BodyC, fmt:{ cap: structuredClone(capFmt), sub: structuredClone(subFmt), cont: structuredClone(contFmt) } }
    ]
  });

  // Exportación
  demo.export.pageSize = 'A4';
  demo.export.margins = { top:25, bottom:25, left:25, right:20 };
  demo.export.headerGapMm = 6;
  demo.export.breakOnChapter = false; // NUEVO
  demo.export.fileName = demoExportFileName;
  demo.export.citationsPageEnabled = true;
  demo.export.bibliographyEnabled = false;

  // ✅ 2) Aplicar estilo de numeración a la demo (si existe el helper global)
  if(typeof applyChapterNumberingStyleToState === 'function'){
    applyChapterNumberingStyleToState(demo, demo.toc.numberingStyle);
  }

  normalizeLayoutToStandard(demo);
  state = demo;
  saveState();
  hydrateUIFromState();

  const newTitle = t(
    'app.windowTitleTemplate',
    `${state.meta.titulo} — ensaYOnesa`,
    { title: state.meta.titulo || '' }
  );
  document.title = newTitle;

  alert(t('panel4.alerts.demoLoaded', 'Ensayo de demostración cargado.'));
}


/* ===== Exportar a PDF (HTML + print) ===== */
async function exportToPrintPDF(S, opts){
  opts = opts || {};
  const mode = (opts.mode === "preview") ? "preview" : "print";
  const targetWindow = opts.targetWindow || opts.target || null;
  const silent = !!opts.silent;

  // ✅ Abrir ventana ANTES de cualquier await (evita bloqueos del popup)
  const w = targetWindow || window.open('', '_blank');
  if(!w){
    if(!silent){
      alert(t('export.errors.popupBlocked', 'Permite ventanas emergentes para exportar.'));
    }
    return;
  }

  // ✅ "ready" para previsualización / compat (si alguien no hace await al async)
  let __efReadyResolve = null;
  const __efReadyPromise = new Promise((r)=>{ __efReadyResolve = r; });
  try{ w.__efExportReady = __efReadyPromise; }catch{ /* ignore */ }

  try{
    const pageMM = (()=>{
      if(S.export.pageSize==='A4') return {w:210, h:297};
      if(S.export.pageSize==='A5') return {w:148, h:210};
      return {w:152.4, h:228.6};
    })(); // KDP 6x9
    const pagePx = { w: Math.round(pageMM.w*pxPerMm), h: Math.round(pageMM.h*pxPerMm) };

    // SIEMPRE mm → px (no cm)
    const margins = {
      top:    Math.round(clamp(S.export.margins.top,    5, 60)*pxPerMm),
      bottom: Math.round(clamp(S.export.margins.bottom, 5, 60)*pxPerMm),
      left:   Math.round(clamp(S.export.margins.left,   5, 60)*pxPerMm),
      right:  Math.round(clamp(S.export.margins.right,  5, 60)*pxPerMm)
    };
    const headerGapPx = Math.round(clamp(S.export.headerGapMm ?? 0, 0, 60)*pxPerMm);

    const ctx = document.createElement('canvas').getContext('2d');

    // Ancho estándar utilizable
    const coverMaxW = pagePx.w - (margins.left + margins.right);

    // === FIX: alturas/padding reales (coincide con PRINT_CSS: padding 8px 0) ===
    const headerPadY = 8;

    const headerBoxH = S.styles.header.enabled
      ? (lineHeightFor(S.styles.header.size, S.styles.header.leading) + headerPadY*2)
      : 0;

    const headerLineH = (S.styles.header.enabled && S.styles.header.line !== 'none') ? 1 : 0;
    const footerLineH = (S.styles.footer.enabled && S.styles.footer.line !== 'none') ? 1 : 0;

    // Cabecero/pie dentro de márgenes top/bottom
    const contentAreaTop = ()=> margins.top + (S.styles.header.enabled ? (headerBoxH + headerLineH + headerGapPx) : 0);

    // === Helpers de número de página (también usados para calcular reserva en el pie) ===
    function getPNOffsets(position){
      const pos = position || 'bottom-right';
      const safePad = 8;
      if(pos.startsWith('top')){
        return {
          topDist: Math.max(safePad, Math.round(margins.top * 0.25)),
          bottomDist: null
        };
      }
      return {
        topDist: null,
        bottomDist: Math.max(safePad, Math.round(margins.bottom * 0.25))
      };
    }

    // === Citaciones en pie: activas si el pie está activado y no se han desactivado ===
    const FOOTER_CITES_ACTIVE = !!(S.styles.footer.enabled && (S.styles.footer.citationsEnabled !== false));

    // Constantes de maquetación del bloque de citas en el pie (coherentes con render)
    const footerCiteTopPad = 6;

    // reservar zona inferior (texto pie + evitar solape con número de página)
    const footAlign = (S.styles.footer.align || 'center');
    const hasFooterText = !!(S.styles.footer.text && String(S.styles.footer.text).trim());
    const textLH = lineHeightFor(S.styles.footer.size, S.styles.footer.leading);
    const reserveTextH = hasFooterText ? textLH : 0;

    const pnEnabled = !!S.styles.pageNumbers.enabled;
    const pnPos = (S.styles.pageNumbers.position || 'bottom-right');

    let bottomForText = 8;
    if(pnEnabled && pnPos.startsWith('bottom')){
      const off = getPNOffsets(pnPos);
      const pnFmt = S.styles.footer; // abajo hereda pie
      const pnH = lineHeightFor(pnFmt.size, pnFmt.leading);
      bottomForText = (off.bottomDist || 8) + pnH + 6;
    }

    // Mantener el texto del pie dentro del margen inferior original
    const maxBottom = Math.max(0, margins.bottom - reserveTextH - 2);
    bottomForText = clamp(bottomForText, 0, maxBottom);

    // La zona de citas termina por encima del “bloque inferior” (texto + seguridad)
    const footerCiteBottomPad = clamp(
      bottomForText + reserveTextH + 4,
      0,
      Math.max(0, margins.bottom - 2)
    );

    const footerLineSafetyGap = (S.styles.footer.enabled && footerLineH) ? 2 : 0;

    // Métrica tipográfica del bloque de citas del pie (igual que el render)
    const citeSize = Math.max(8, Math.round(S.styles.footer.size * 0.78));
    const citeLH = Math.max(10, Math.round(lineHeightFor(citeSize, 1.15)));
    const citeGapY = Math.max(1, Math.round(citeLH * 0.15));
    const footerW = pagePx.w - margins.left - margins.right;

    // Cache para calcular “cuánto ocupa” cada cita en el pie (según wrapping estimado)
    const citeFootCache = new Map(); // n -> neededH(px)

    const mctxFooter = document.createElement('canvas').getContext('2d');
    mctxFooter.font = `${citeSize}px ${fontStack(S.styles.footer.font)}`;

    const citeItems = (S.citations && Array.isArray(S.citations.items)) ? S.citations.items : [];

    function citeFooterNeededHeight(n){
      const num = Number(n);
      if(!Number.isFinite(num) || num <= 0) return 0;
      if(citeFootCache.has(num)) return citeFootCache.get(num);

      const prefix = `(${num}) `;
      const prefixW = mctxFooter.measureText(prefix).width;
      const maxBodyW = Math.max(40, footerW - prefixW);

      const rawText = (citeItems[num-1] && typeof citeItems[num-1].text === 'string') ? citeItems[num-1].text : '';
      const bodyRaw = String(rawText || '').trim() || t('export.citations.missingText', '—');

      // ✅ Soportar [b]/[i]/[u] en el texto de la cita
      const parsed = parseInlineMarkupToRuns(bodyRaw, { allowCites:false });
      const normRuns = normalizeInlineRunsWhitespace(parsed.runs);

      const citeFmt = { font: S.styles.footer.font, size: citeSize };
      const lines = wrapRunsToLines(normRuns, citeFmt, maxBodyW, mctxFooter, { firstLineIndentPx: 0, mode:'wrap' });

      const neededH = (lines.length * citeLH) + citeGapY;

      citeFootCache.set(num, neededH);
      return neededH;
    }

    function footerHeightForCitesH(citesH, hasAny){
  if(!FOOTER_CITES_ACTIVE || !hasAny) return margins.bottom;

  // ✅ extra de seguridad para evitar descuadres por diferencias de métricas
  const safety = 12;

  const required = footerCiteTopPad + footerCiteBottomPad + citesH + safety;

  // ✅ CLAMP: nunca dejamos que el pie se coma toda la página
  return clamp(Math.ceil(required), margins.bottom, MAX_FOOTER_H);
}

    function contentAreaBottomForFooterH(footerH){
      return pagePx.h - footerH - footerLineSafetyGap;
    }

    // ✅ altura máxima disponible para contenido (sin crecer el pie)
    const baseContentMaxH = Math.max(40, contentAreaBottomForFooterH(margins.bottom) - contentAreaTop());
// ===============================
// SAFETY: límite de crecimiento del pie por citas
// ===============================
// Si el pie crece demasiado, puede no quedar espacio para contenido,
// y ensureSpace() puede entrar en bucle creando páginas infinitas.
const MIN_CONTENT_MM = 28; // ~3cm mínimos de contenido por página
const MIN_CONTENT_PX = Math.round(MIN_CONTENT_MM * pxPerMm);
const MAX_FOOTER_H = Math.max(
  margins.bottom,
  pagePx.h - contentAreaTop() - MIN_CONTENT_PX
);
    // Extractor de números de cita por texto (^(N))
    function extractCiteNumsFromText(text){
      const s = String(text || '');
      const out = [];
      const seen = new Set();
      for(const m of s.matchAll(/\^\((\d+)\)/g)){
        const num = Number(m[1]);
        if(Number.isFinite(num) && num > 0 && !seen.has(num)){
          seen.add(num);
          out.push(num);
        }
      }
      return out;
    }

    const pages = [];
    let logicalContentPage = 0;

    function newSpecialPage(kind){
      return { lines:[], header:false, footer:false, pn:false, y: margins.top, kind, logicalPage: null, cites: null, footerH: margins.bottom, citesH: 0 };
    }

    function newContentPage(){
      logicalContentPage += 1;
      return {
        lines:[],
        header:true,
        footer:true,
        pn:true,
        y: contentAreaTop(),
        kind:'content',
        logicalPage: logicalContentPage,
        cites: new Set(),
        citesH: 0,
        footerH: margins.bottom
      };
    }

    // Estilos
    const titFmt = S.styles.title, subFmt = S.styles.subtitle, autFmt = S.styles.author, metaFmt = S.styles.metaBlock;

    // ✅ Cargar assets de imágenes antes de maquetar contenido (para reservar altura real)
    let imgAssets = new Map();
    try{
      imgAssets = await efCollectImageAssetsFromState(S);
    }catch(err){
      console.warn('[ensaYOnesa] No se pudieron cargar imágenes de IndexedDB', err);
      imgAssets = new Map();
    }

    const imgMissingText = t('export.images.missing', 'Imagen no encontrada');

    // Helper: empujar texto envuelto (wrap) como líneas sueltas
    function pushWrappedText(pageObj, text, x, y0, fmt, align, maxW, extraAfter=0){
      ctx.font = `${fmt.size}px ${fontStack(fmt.font)}`;
      const paras = wrapParagraphs(text||'', fmt, maxW, ctx, { autoIndent:false });
      const lh = lineHeightFor(fmt.size, fmt.leading);
      let y = y0;
      for(const p of paras){
        for(const ln of p.lines){
          pageObj.lines.push({
            type:'text',
            text: ln,
            x,
            y,
            fmt,
            align,
            maxWidth: maxW,
            paragraph:false
          });
          y += lh;
        }
        // separación suave entre párrafos en portada
        y += Math.round(lh * 0.35);
      }
      y += extraAfter;
      return y;
    }

    /* ---------- 1) Portada (y opcionalmente páginas de licencias si no cabe) ---------- */
    const cover = newSpecialPage('cover');
    let y = cover.y;

    // Título (wrap robusto)
    y = pushWrappedText(cover, S.meta.titulo||'', margins.left, y, titFmt, 'center', coverMaxW, 0);
    y += Math.round(lineHeightFor(titFmt.size, titFmt.leading) * 0.20);

    if(S.meta.subtitulo){
      y = pushWrappedText(cover, S.meta.subtitulo, margins.left, y, subFmt, 'center', coverMaxW, 0);
    }

    y += Math.round(lineHeightFor(subFmt.size||titFmt.size, (subFmt.leading||titFmt.leading)) * 0.35);
    cover.lines.push({type:'hr', x:margins.left, w:coverMaxW, y});
    y += Math.round(10 * (pxPerMm/3.78)); // ~10px “estable”

    if(S.meta.autor){
      y = pushWrappedText(cover, S.meta.autor, margins.left, y, autFmt, 'center', coverMaxW, 0);
    }

    // === Pie de portada (bloque inferior, ahora también con wrap) ===
    const fechaPub = S.meta.fechaPublicacion || todayISO();
    const year = (fechaPub||todayISO()).slice(0,4);
    const footSmall = {
      ...metaFmt,
      size: Math.max(9, Math.round((metaFmt.size||11)*0.9)),
      alpha: 0.85*(metaFmt.alpha||1)
    };
    const footerLabelLicense = t('export.footer.licenseLabel', 'Licencia:');
    const footerLabelPublication = t('export.footer.publicationDateLabel', 'Fecha de publicación');
    const licText = S.meta.licencia
      ? `${footerLabelLicense} ${S.meta.licencia}`
      : footerLabelLicense;

    const line1 = fechaPub
      ? `${S.meta.titulo||''} — ${footerLabelPublication} ${fechaPub}`
      : `${S.meta.titulo||''} — ${footerLabelPublication}`;
    const line2 = `© ${year}  ${S.meta.autor||''} — ${licText}`;

    ctx.font = `${footSmall.size}px ${fontStack(footSmall.font)}`;
    const l1 = wrapParagraphs(line1, footSmall, coverMaxW, ctx, { autoIndent:false });
    const l2 = wrapParagraphs(line2, footSmall, coverMaxW, ctx, { autoIndent:false });

    const footLH = lineHeightFor(footSmall.size, footSmall.leading);
    const footLines = [
      ...(l1[0]?.lines || []),
      ...(l2[0]?.lines || [])
    ].filter(Boolean);

    const footBlockH = Math.max(0, footLines.length * footLH);
    const footStartY = pagePx.h - margins.bottom - footBlockH - 6;

    // Metadatos (licencias / etc.)
    const metaPairs = [
      [ t('export.meta.license', 'Licencia'), S.meta.licencia ],
      [ t('export.meta.email', 'Email'), S.meta.email ],
      [ t('export.meta.note', 'Nota'), S.meta.nota ],
      [ t('export.meta.summary', 'Resumen'), S.meta.resumen ],
      [ t('export.meta.keywords', 'Palabras clave'), S.meta.palabrasClave ],
      [ t('export.meta.safeCreativeId', 'Safe Creative ID'), S.meta.safeCreativeId ],
      [ t('export.meta.doi', 'DOI (Zenodo)'), S.meta.doi ]
    ].filter(([,v])=> (v && String(v).trim().length>0));

    const metaLabelFmt = {...metaFmt, size: Math.max(10, metaFmt.size-1)};

    function measureMetaPairsHeight(pairs, maxW){
      let h = 0;
      const lhLabel = lineHeightFor(metaLabelFmt.size, metaLabelFmt.leading);
      const lhMeta  = lineHeightFor(metaFmt.size, metaFmt.leading);

      for(const [,val] of pairs){
        // etiqueta
        h += Math.round(lhLabel * 0.9);

        ctx.font = `${metaFmt.size}px ${fontStack(metaFmt.font)}`;
        const paras = wrapParagraphs(val, metaFmt, maxW, ctx, { autoIndent:false });

        for(const p of paras){
          h += (p.lines.length * lhMeta);
          h += Math.round(lhMeta * 0.4);
        }
      }
      return h;
    }

    // límite inferior “usable” para el bloque meta en portada (antes del pie)
    const metaBottomLimit = footStartY - 10;
    const metaMinStartY = y + 18;
    const metaTargetY = Math.max(metaMinStartY, Math.floor(pagePx.h * 0.52));

    const metaTotalH = measureMetaPairsHeight(metaPairs, coverMaxW);
    const metaMaxStartY = metaBottomLimit - metaTotalH;

    const licensePages = [];

    const metaFitsOnCover = (metaPairs.length === 0) || (metaMaxStartY >= metaMinStartY);

    if(metaPairs.length > 0 && metaFitsOnCover){
      // ✅ Cabe: meter todo en portada, pero ajustando el inicio para que NO se coma el pie
      const metaStartY = clamp(metaTargetY, metaMinStartY, metaMaxStartY);
      y = metaStartY;

      metaPairs.forEach(([label,val])=>{
        cover.lines.push({
          type:'text',
          text: label+':',
          x:margins.left,
          y,
          fmt:metaLabelFmt,
          align:'left',
          maxWidth:coverMaxW,
          paragraph:false
        });
        y += Math.round(lineHeightFor(metaLabelFmt.size, metaLabelFmt.leading)*0.9);

        ctx.font = `${metaFmt.size}px ${fontStack(metaFmt.font)}`;
        const paras = wrapParagraphs(val, metaFmt, coverMaxW, ctx, { autoIndent:false });
        paras.forEach((p)=>{
          p.lines.forEach((ln, il)=>{
            cover.lines.push({
              type:'text',
              text:ln,
              x:margins.left + (il===0?p.indentPx:0),
              y,
              fmt:metaFmt,
              align:'justify',
              maxWidth: coverMaxW - (il===0?p.indentPx:0),
              paragraph:true,
              isLastInParagraph: il === p.lines.length-1
            });
            y += lineHeightFor(metaFmt.size, metaFmt.leading);
          });
          y += Math.round(lineHeightFor(metaFmt.size, metaFmt.leading)*0.4);
        });
      });
    }else if(metaPairs.length > 0){
      // ✅ NO cabe: crear una o más páginas de “Licencias” antes del índice
      const licenseHeading = t('export.license.heading', 'Licencias');
      const headFmt = { ...metaFmt, size: Math.max(14, (metaFmt.size||11) + 3), alpha: metaFmt.alpha ?? 1 };

      function newLicensePage(withHeading){
        const p = newSpecialPage('license');
        let yy = margins.top;

        // título arriba (más compacto que la portada)
        const smallTitleFmt = {
          ...metaFmt,
          size: Math.max(11, Math.round((metaFmt.size||11) * 1.05)),
          alpha: metaFmt.alpha ?? 1
        };
        yy = pushWrappedText(p, (S.meta.titulo||''), margins.left, yy, smallTitleFmt, 'center', coverMaxW, 0);

        if(withHeading){
          p.lines.push({
            type:'text',
            text: licenseHeading,
            x:margins.left,
            y: yy,
            fmt: headFmt,
            align:'center',
            maxWidth: coverMaxW,
            paragraph:false
          });
          yy += lineHeightFor(headFmt.size, headFmt.leading) * 1.1;
          yy += 6;
          p.lines.push({type:'hr', x:margins.left, w:coverMaxW, y: yy});
          yy += 12;
        }else{
          // separador suave
          yy += 6;
        }

        return { p, y: yy };
      }

      let pack = newLicensePage(true);
      let lp = pack.p;
      let ly = pack.y;
      licensePages.push(lp);

      const licBottom = pagePx.h - margins.bottom - 8;
      const lhLabel = lineHeightFor(metaLabelFmt.size, metaLabelFmt.leading);
      const lhMeta  = lineHeightFor(metaFmt.size, metaFmt.leading);

      function ensureLicSpace(h){
        if(ly + h <= licBottom) return;
        pack = newLicensePage(false);
        lp = pack.p;
        ly = pack.y;
        licensePages.push(lp);
      }

      metaPairs.forEach(([label,val])=>{
        ensureLicSpace(Math.round(lhLabel*0.9));
        lp.lines.push({
          type:'text',
          text: label+':',
          x:margins.left,
          y: ly,
          fmt: metaLabelFmt,
          align:'left',
          maxWidth: coverMaxW,
          paragraph:false
        });
        ly += Math.round(lhLabel * 0.9);

        ctx.font = `${metaFmt.size}px ${fontStack(metaFmt.font)}`;
        const paras = wrapParagraphs(val, metaFmt, coverMaxW, ctx, { autoIndent:false });

        paras.forEach((p)=>{
          p.lines.forEach((ln, il)=>{
            ensureLicSpace(lhMeta);
            lp.lines.push({
              type:'text',
              text: ln,
              x: margins.left + (il===0?p.indentPx:0),
              y: ly,
              fmt: metaFmt,
              align: 'justify',
              maxWidth: coverMaxW - (il===0?p.indentPx:0),
              paragraph:true,
              isLastInParagraph: il === p.lines.length-1
            });
            ly += lhMeta;
          });
          ensureLicSpace(Math.round(lhMeta*0.4));
          ly += Math.round(lhMeta * 0.4);
        });
      });
    }

    // Añadir pie de portada (siempre, centrado)
    let fy = footStartY;
    for(const ln of footLines){
      cover.lines.push({
        type:'text',
        text: ln,
        x:margins.left,
        y: fy,
        fmt: footSmall,
        align:'center',
        maxWidth: coverMaxW,
        paragraph:false
      });
      fy += footLH;
    }

    pages.push(cover);

    // ✅ Insertar páginas de licencias (si existen) justo después de portada
    if(licensePages.length>0){
      pages.push(...licensePages);
    }

    // posición donde irá el índice (después de portada + licencias)
    const frontMatterCount = pages.length;

    /* ---------- 2) Contenido (maquetado dinámico por pie de página) ---------- */
    const tocEntries = []; // { level:0|1, title, page }
    const contentWidth = pagePx.w - (margins.left + margins.right);

    let page = newContentPage();
    pages.push(page);

    function predictFooterHForPageWithExtraCites(pageObj, extraCites){
      if(!FOOTER_CITES_ACTIVE) return margins.bottom;

      const arr = Array.isArray(extraCites) ? extraCites : [];
      let deltaH = 0;
      let newCount = 0;

      for(const n of arr){
        const num = Number(n);
        if(!Number.isFinite(num) || num <= 0) continue;
        if(pageObj.cites.has(num)) continue;
        deltaH += citeFooterNeededHeight(num);
        newCount += 1;
      }

      const predictedCitesH = (pageObj.citesH || 0) + deltaH;
      const predictedHasAny = (pageObj.cites.size + newCount) > 0;

      return footerHeightForCitesH(predictedCitesH, predictedHasAny);
    }

   function ensureSpace(h, extraCites){
  const arr = Array.isArray(extraCites) ? extraCites : null;
  let guard = 0;

  while(true){
    const predictedFooterH = predictFooterHForPageWithExtraCites(page, arr);
    const bottom = contentAreaBottomForFooterH(predictedFooterH);
    const topY = contentAreaTop();

    // ✅ SAFETY: si ni siquiera cabe en una página "vacía", NO bucleamos
    if(topY + h > bottom){
      if(page.y !== topY){
        page = newContentPage();
        pages.push(page);
      }
      page.footerH = predictFooterHForPageWithExtraCites(page, arr);
      return;
    }

    if(page.y + h <= bottom){
      page.footerH = predictedFooterH;
      return;
    }

    page = newContentPage();
    pages.push(page);

    guard++;
    if(guard > 5000){
      console.warn('[ensaYOnesa] ensureSpace bailout: bloque demasiado grande (evito cuelgue).');
      page.footerH = predictedFooterH;
      return;
    }
  }
}

    function commitCites(pageObj, citeNums){
      if(!pageObj || !pageObj.cites || !citeNums || citeNums.length===0) return;

      for(const n of citeNums){
        const num = Number(n);
        if(!Number.isFinite(num) || num <= 0) continue;
        if(pageObj.cites.has(num)) continue;

        pageObj.cites.add(num);

        if(FOOTER_CITES_ACTIVE){
          pageObj.citesH = (pageObj.citesH || 0) + citeFooterNeededHeight(num);
        }
      }

      if(FOOTER_CITES_ACTIVE){
        pageObj.footerH = footerHeightForCitesH(pageObj.citesH || 0, pageObj.cites.size > 0);
      }else{
        pageObj.footerH = margins.bottom;
      }
    }

    // ✅ Helper: insertar un bloque de imagen reservando altura real (sin reflow posterior)
    function pushImageBlock(imgId, lh){
      const id = String(imgId || '').trim();
      if(!id) return;

      const info = imgAssets.get(id) || null;

      const gapTop = Math.max(6, Math.round(lh * 0.25));
      const gapBottom = Math.max(8, Math.round(lh * 0.35));

      // limite por página (aprox. una página “vacía” de contenido)
      const maxImgH = Math.max(40, baseContentMaxH - gapTop - gapBottom);

      let wImg = contentWidth;
      let hImg = Math.min(maxImgH, Math.max(40, Math.round(contentWidth * 0.56))); // fallback ~16:9

      if(info && !info.missing && info.w>0 && info.h>0){
        // no upscaling (evita pixelar)
        wImg = Math.min(contentWidth, info.w);
        hImg = Math.round(wImg * (info.h / info.w));
      }else{
        // missing (o sin dims): placeholder más comedido
        wImg = contentWidth;
        hImg = Math.min(maxImgH, Math.max(40, Math.round(lh * 3)));
      }

      // ajustar si excede el alto máximo
      if(hImg > maxImgH && hImg > 0){
        const scale = maxImgH / hImg;
        hImg = Math.max(1, Math.floor(hImg * scale));
        wImg = Math.max(1, Math.floor(wImg * scale));
      }

      const needed = gapTop + hImg + gapBottom;
      ensureSpace(needed);

      const x = margins.left + Math.round((contentWidth - wImg) / 2);
      const yImg = page.y + gapTop;

      if(info && !info.missing && info.url){
        pages[pages.length-1].lines.push({
          type:'img',
          src: info.url,
          alt: info.name || '',
          x,
          y: yImg,
          w: wImg,
          h: hImg
        });
      }else{
        pages[pages.length-1].lines.push({
          type:'img-missing',
          text: `${imgMissingText}${id ? ' ('+id+')' : ''}`,
          x,
          y: yImg,
          w: wImg,
          h: hImg
        });
      }

      page.y += needed;
    }

    // Por cada capítulo
    S.content.chapters.forEach((cap, iCap)=>{
      if(!cap || !cap.subsections || cap.subsections.length===0) return;

      // salto de página al iniciar cada capítulo (excepto el primero)
      if(S.export.breakOnChapter && iCap > 0){
        page = newContentPage();
        pages.push(page);
      }

      const fmtCap = cap.subsections[0].fmt.cap;
      const fallbackCapTitle = t(
        'panel3.chapterDefaultTitle',
        `Capítulo ${iCap+1}`,
        { index: iCap + 1 }
      );
      const titleText = cap.title || fallbackCapTitle;

      // ===== ✅ FIX: Título de capítulo con WRAP real (respeta márgenes) =====
      const capCites = extractCiteNumsFromText(titleText);

      // wrap (rich) a líneas dentro del contentWidth
      const capParas = wrapParagraphsRich(titleText, fmtCap, contentWidth, ctx, { autoIndent:false });
      const capLH = lineHeightFor(fmtCap.size, fmtCap.leading);
      const capLineCount = Math.max(
        1,
        capParas.reduce((acc,p)=> acc + ((p && Array.isArray(p.lines)) ? p.lines.length : 0), 0)
      );

      // reservar altura real + holgura (antes era 1.8 líneas)
      const capReserveH = (capLineCount * capLH) + Math.round(capLH * 0.8);
      ensureSpace(capReserveH, capCites);

      // ✅ TOC: página real del capítulo (antes de dibujar)
      tocEntries.push({
        level: 0,
        title: titleText,
        page: page.logicalPage
      });

      // pintar líneas centradas
      let yCap = page.y;
      capParas.forEach((p, pi)=>{
        if(pi>0) yCap += Math.round(capLH * 0.35);
        (p.lines||[]).forEach((lnObj)=>{
          pages[pages.length-1].lines.push({
            type:'text',
            text: lnObj?.text || '',
            runs: lnObj?.runs || null,
            x:margins.left,
            y:yCap,
            fmt:fmtCap,
            align:'center',
            maxWidth:contentWidth,
            paragraph:false
          });
          yCap += capLH;
        });
      });

      commitCites(page, capCites);

      // separación después del título (antes era *1.6)
      page.y = yCap + Math.round(capLH * 0.6);

      // subsecciones
      cap.subsections.forEach((sub, iSub)=>{
        if(iSub>0){
          const fs = sub.fmt.sub;
          const fallbackSubTitle = t(
            'panel3.sectionDefaultTitle',
            `Sección ${iSub}`,
            { index: iSub }
          );
          const subTitle = sub.title||fallbackSubTitle;

          // ===== ✅ FIX: Título de subsección con WRAP real =====
          const subCites = extractCiteNumsFromText(subTitle);

          const subParas = wrapParagraphsRich(subTitle, fs, contentWidth, ctx, { autoIndent:false });
          const subLH = lineHeightFor(fs.size, fs.leading);
          const subLineCount = Math.max(
            1,
            subParas.reduce((acc,p)=> acc + ((p && Array.isArray(p.lines)) ? p.lines.length : 0), 0)
          );

          // reservar altura real + holgura (antes era 1.2 líneas)
          const subReserveH = (subLineCount * subLH) + Math.round(subLH * 0.2);
          ensureSpace(subReserveH, subCites);

          // ✅ TOC: página real de la subsección (antes de dibujar)
          tocEntries.push({
            level: 1,
            title: subTitle,
            page: page.logicalPage
          });

          // pintar líneas alineadas a la izquierda
          let ySub = page.y;
          subParas.forEach((p, pi)=>{
            if(pi>0) ySub += Math.round(subLH * 0.25);
            (p.lines||[]).forEach((lnObj)=>{
              pages[pages.length-1].lines.push({
                type:'text',
                text: lnObj?.text || '',
                runs: lnObj?.runs || null,
                x:margins.left,
                y:ySub,
                fmt:fs,
                align:'left',
                maxWidth:contentWidth,
                paragraph:false
              });
              ySub += subLH;
            });
          });

          commitCites(page, subCites);

          // antes era +1.0 línea; ahora son N líneas exactas
          page.y = ySub;
        }

        // Contenido
        const fc = sub.fmt.cont;
        ctx.font = `${fc.size}px ${fontStack(fc.font)}`;

        const lh = lineHeightFor(fc.size, fc.leading);
        const paraGap = Math.round(lh*0.75);

        // ✅ NUEVO: procesar por párrafos para detectar [img:<id>] como BLOQUE
        const rawBody = String(sub.body || '').replace(/\r/g,'');
        const rawParas = rawBody.split(/\n{2,}/);

        rawParas.forEach((rawPara)=>{
          const trimmed = String(rawPara || '').trim();

          // 1) Imagen como párrafo completo
          const mImg = trimmed.match(EF_RE_IMG_BLOCK);
          if(mImg){
            const id = mImg[1];
            pushImageBlock(id, lh);
            // separación entre “párrafos”
            page.y += paraGap;
            return;
          }

          // 2) Párrafo normal con formato inline
          const ps = wrapParagraphsRich(
            rawPara,
            fc,
            contentWidth,
            ctx,
            { autoIndent:true, indentSpaces: DEFAULT_CONTENT_INDENT_SPACES }
          );

          ps.forEach(p=>{
            p.lines.forEach((lnObj, il)=>{
              const lnCites = lnObj?.citeNums || [];
              ensureSpace(lh, lnCites);

              pages[pages.length-1].lines.push({
  type:'text',
  text: lnObj?.text || '',
  runs: lnObj?.runs || null, // ✅ runs para render con formato
  x: margins.left + (il===0 ? p.indentPx : 0),
  y: page.y,
  fmt: fc,
  align: 'justify',
  maxWidth: contentWidth - (il===0 ? p.indentPx : 0),
  measuredWidthPx: (lnObj && Number.isFinite(lnObj.widthPx) ? lnObj.widthPx : null),
  paragraph: true,
  isLastInParagraph: il === p.lines.length-1
});

              commitCites(page, lnCites);

              page.y += lh;
            });

            // separación entre párrafos (internos, por si wrapParagraphsRich devolviera varios)
            page.y += paraGap;
          });
        });
      });
    });

    /* ---------- 2.5) Citas / Bibliografía (apéndices al final) ---------- */
  const citePageMap = new Map(); // n -> Set(páginas lógicas)
  pages.forEach(pp=>{
    if(!pp || pp.logicalPage == null || !pp.cites) return;
    if(!(pp.cites instanceof Set) || pp.cites.size===0) return;
    for(const n of pp.cites){
      const num = Number(n);
      if(!Number.isFinite(num) || num<=0) continue;
      if(!citePageMap.has(num)) citePageMap.set(num, new Set());
      citePageMap.get(num).add(pp.logicalPage);
    }
  });

  // ✅ switches de export
  const END_CITES_PAGE_ENABLED = (S.export && (S.export.citationsPageEnabled !== false));
  const END_BIBLIO_PAGE_ENABLED = !!(S.export && S.export.bibliographyEnabled);

  // i18n
  const citationsHeading = t('export.citations.heading', 'Citas');
  const bibliographyHeading = t('export.bibliography.heading', 'Bibliografía');
  const citePageLabel = t('export.citations.pageLabel', 'pág.');
  const citeEmpty = t('export.citations.empty', '(Sin citas)');
  const bibEmpty  = t('export.bibliography.empty', '(Sin bibliografía)');

  const citeItemsAll = (S.citations && Array.isArray(S.citations.items)) ? S.citations.items : [];

  // Conjunto total de números (incluye citas encontradas aunque no existan en items)
  const allNumsSet = new Set();
  for(let i=1;i<=citeItemsAll.length;i++) allNumsSet.add(i);
  for(const n of citePageMap.keys()) allNumsSet.add(n);
  const allNums = Array.from(allNumsSet).sort((a,b)=>a-b);

  // ✅ Qué tipos cuentan como “bibliográficos” (varios tipos, como pediste)
  const BIB_TYPES = new Set([
    'bibliographic', // 1) Nota bibliográfica
    'mixed',         // 3) Mixta
    'remission',     // 4) Remisión (véase/cf.)
    'secondary',     // 5) Fuente secundaria
    'legal'          // 8) Legal / normativa
  ]);

  // ✅ Filtrado para la página de Citas: SOLO las marcadas con check por-cita
  const numsForCitesPage = allNums.filter(n=>{
    const it = citeItemsAll[n-1];
    if(!it) return true; // si hay marcador pero no item, lo mostramos como “—”
    return it.includeInCitationsPage !== false; // default true (compatibilidad)
  });

  // ✅ Filtrado para Bibliografía: SOLO las que sean de tipo bibliográfico (varios)
  const numsForBibliography = allNums.filter(n=>{
    const it = citeItemsAll[n-1];
    if(!it) return false; // si no sabemos el tipo, no entra en bibliografía
    const tp = String(it.type || '').trim();
    return BIB_TYPES.has(tp);
  });

  function renderAppendixList(headingText, emptyText, nums){
    // arrancar en página nueva
    page = newContentPage();
    pages.push(page);

    const headFmt = { ...metaFmt, size: Math.max(14, (metaFmt.size||11) + 3), alpha: metaFmt.alpha ?? 1 };
    const itemFmt = { ...metaFmt, size: Math.max(10, (metaFmt.size||11)), alpha: metaFmt.alpha ?? 1, leading: Math.max(1.2, metaFmt.leading||1.4) };

    // Título
    ensureSpace(lineHeightFor(headFmt.size, headFmt.leading) * 1.2);
    pages[pages.length-1].lines.push({
      type:'text',
      text: headingText,
      x:margins.left,
      y:page.y,
      fmt:headFmt,
      align:'center',
      maxWidth:contentWidth,
      paragraph:false
    });
    page.y += lineHeightFor(headFmt.size, headFmt.leading) * 1.3;
    page.y += Math.round(lineHeightFor(itemFmt.size, itemFmt.leading) * 0.6);

    const mctx2 = document.createElement('canvas').getContext('2d');
    mctx2.font = `${itemFmt.size}px ${fontStack(itemFmt.font)}`;
    const gapY = Math.max(2, Math.round(lineHeightFor(itemFmt.size, itemFmt.leading) * 0.35));
    const itemLH = lineHeightFor(itemFmt.size, itemFmt.leading);

    const listFmt = { font: itemFmt.font, size: itemFmt.size };

    if(!nums || nums.length === 0){
      pages[pages.length-1].lines.push({
        type:'text',
        text: emptyText,
        x:margins.left,
        y:page.y,
        fmt:itemFmt,
        align:'center',
        maxWidth:contentWidth,
        paragraph:false
      });
      page.y += itemLH;
      return;
    }

    nums.forEach((n)=>{
      const prefix = `(${n}) `;
      const prefixW = mctx2.measureText(prefix).width;

      const rawText = (citeItemsAll[n-1] && typeof citeItemsAll[n-1].text === 'string') ? citeItemsAll[n-1].text : '';
      const bodyText = String(rawText || '').trim() || t('export.citations.missingText', '—');

      const pagesSet = citePageMap.get(n);
      const pagesStr = pagesSet
        ? Array.from(pagesSet).sort((a,b)=>a-b).join(', ')
        : t('export.citations.pageUnknown', '—');

      const tail = ` — ${citePageLabel} ${pagesStr}`;
      const fullBody = bodyText + tail;

      // ✅ wrap con formato inline [b]/[i]/[u]
      const parsed = parseInlineMarkupToRuns(fullBody, { allowCites:false });
      const normRuns = normalizeInlineRunsWhitespace(parsed.runs);
      const maxBodyW = Math.max(40, contentWidth - prefixW);
      const lines = wrapRunsToLines(normRuns, listFmt, maxBodyW, mctx2, { firstLineIndentPx:0, mode:'wrap' });

      // primera línea: con prefijo
      ensureSpace(itemLH);
      const firstRuns = [
        { text: prefix, b:false, i:false, u:false, cite:null },
        ...(lines[0]?.runs || [])
      ];
      const firstText = firstRuns.map(r=>r.text).join('');

      pages[pages.length-1].lines.push({
        type:'text',
        text: firstText,
        runs: firstRuns,
        x:margins.left,
        y:page.y,
        fmt:itemFmt,
        align:'left',
        maxWidth:contentWidth,
        paragraph:false
      });
      page.y += itemLH;

      // resto líneas: indentadas
      for(let i=1;i<lines.length;i++){
        ensureSpace(itemLH);
        pages[pages.length-1].lines.push({
          type:'text',
          text: lines[i]?.text || '',
          runs: lines[i]?.runs || null,
          x:margins.left + prefixW,
          y:page.y,
          fmt:itemFmt,
          align:'left',
          maxWidth: contentWidth - prefixW,
          paragraph:false
        });
        page.y += itemLH;
      }

      page.y += gapY;
    });
  }

  // ✅ NUEVO: Página final “Nota editorial y declaraciones” (si hay contenido)
  function getEndMatterSections(meta){
    const m = (meta && typeof meta === 'object') ? meta : {};
    const clean = (v)=> String(v == null ? '' : v).replace(/\r/g,'').trim();

    // Normaliza claves: soporta nota_editorial, NotaEditorial, editorial-note, etc.
    const normKey = (k)=>{
      try{
        return String(k || '')
          .normalize('NFD').replace(/[\u0300-\u036f]/g,'') // quita tildes
          .replace(/[^a-zA-Z0-9]/g,'')                    // quita _ - espacios
          .toLowerCase();
      }catch{
        return String(k || '').replace(/[^a-zA-Z0-9]/g,'').toLowerCase();
      }
    };

    // Mapa normalizado (incluye 1 nivel de anidado por si guardas meta.endMatter.{...})
    const normMap = new Map();
    try{
      for(const [k,v] of Object.entries(m)){
        normMap.set(normKey(k), v);
        if(v && typeof v === 'object' && !Array.isArray(v)){
          for(const [k2,v2] of Object.entries(v)){
            const nk2 = normKey(k2);
            if(!normMap.has(nk2)) normMap.set(nk2, v2);
          }
        }
      }
    }catch{ /* ignore */ }

    const readDomValueById = (id)=>{
      try{
        const el = document.getElementById(String(id||''));
        if(!el) return '';
        if('value' in el) return clean(el.value);
      }catch{ /* ignore */ }
      return '';
    };

    // Lee el valor localizando el label por i18n key y buscando su textarea/input cercano.
    const readDomValueByLabelKey = (labelKey)=>{
      const key = String(labelKey || '').trim();
      if(!key) return '';
      try{
        const lab =
          document.querySelector(`[data-i18n="${key}"]`) ||
          document.querySelector(`[data-i18n-key="${key}"]`);
        if(!lab) return '';

        const forId = (lab.getAttribute && lab.getAttribute('for')) ? lab.getAttribute('for') : '';
        if(forId){
          const v = readDomValueById(forId);
          if(v) return v;
        }

        const wrap =
          lab.closest('.field') ||
          lab.closest('.form-row') ||
          lab.closest('.form-group') ||
          lab.closest('.input-group') ||
          lab.parentElement;

        if(wrap){
          const inp = wrap.querySelector('textarea, input, select');
          if(inp && ('value' in inp)){
            const v = clean(inp.value);
            if(v) return v;
          }
        }
      }catch{ /* ignore */ }
      return '';
    };

    // Devuelve el primer valor no vacío, intentando:
    // 1) meta directo
    // 2) meta anidado (1 nivel)
    // 3) meta por clave normalizada
    // 4) DOM por id
    // 5) DOM por labelKey (i18n)
    const pick = (keys, domIds, labelKey)=>{
      const klist = Array.isArray(keys) ? keys : [];

      // 1) directo
      for(const k of klist){
        const v = clean(m[k]);
        if(v) return v;
      }

      // 2) anidado (1 nivel)
      try{
        for(const v0 of Object.values(m)){
          if(!v0 || typeof v0 !== 'object' || Array.isArray(v0)) continue;
          for(const k of klist){
            const v = clean(v0[k]);
            if(v) return v;
          }
        }
      }catch{ /* ignore */ }

      // 3) normalizado
      for(const k of klist){
        const v = clean(normMap.get(normKey(k)));
        if(v) return v;
      }

      // 4) DOM por id
      const ids = Array.isArray(domIds) ? domIds : klist;
      for(const id of ids){
        const v = readDomValueById(id);
        if(v) return v;
      }

      // 5) DOM por label (i18n)
      const v2 = readDomValueByLabelKey(labelKey);
      if(v2) return v2;

      return '';
    };

    const sections = [];
    const add = (label, value)=>{
      const txt = clean(value);
      if(!txt) return;
      sections.push({ label, text: txt });
    };

    add(
      t('export.endMatter.editorialNote', 'Nota editorial'),
      pick(
        ['notaEditorial','editorialNote','nota_editorial','editorial_note'],
        ['notaEditorial','editorialNote','metaNotaEditorial','metaEditorialNote'],
        'panel1.editorialNoteLabel'
      )
    );

    add(
      t('export.endMatter.acknowledgments', 'Agradecimientos'),
      pick(
        ['agradecimientos','acknowledgments','acknowledgements'],
        ['agradecimientos','acknowledgments','acknowledgements','metaAgradecimientos','metaAcknowledgments'],
        'panel1.acknowledgmentsLabel'
      )
    );

    add(
      t('export.endMatter.funding', 'Financiación'),
      pick(
        ['financiacion','financiación','funding','fundingInfo','funding_info'],
        ['financiacion','funding','metaFinanciacion','metaFunding'],
        'panel1.fundingLabel'
      )
    );

    add(
      t('export.endMatter.conflicts', 'Conflictos de interés'),
      pick(
        ['conflictosInteres','conflictosDeInteres','conflictsOfInterest','conflicts_of_interest','conflictsofinterest'],
        ['conflictosInteres','conflictosDeInteres','conflictsOfInterest','metaConflictosInteres','metaConflictsOfInterest'],
        'panel1.conflictsLabel'
      )
    );

    add(
      t('export.endMatter.howToCite', 'Cómo citar'),
      pick(
        ['comoCitar','howToCite','como_citar','how_to_cite'],
        ['comoCitar','howToCite','metaComoCitar','metaHowToCite'],
        'panel1.howToCiteLabel'
      )
    );

    return sections;
  }

    // ✅ NUEVO: Página final “Nota editorial y declaraciones” (si hay contenido)
  function renderEndMatterPage(){
    const sections = getEndMatterSections(S.meta);
    if(!sections || sections.length === 0) return;

    const headingText = t('export.endMatter.heading', 'Nota editorial y declaraciones');

    // arrancar en página nueva (como Citas/Bibliografía)
    page = newContentPage();
    pages.push(page);

    // ✅ USAR estilos específicos (plantillables) en vez de metaFmt
    const headFmt  = { ...(S.styles?.endMatterHeading || metaFmt) };
    const labelFmt = { ...(S.styles?.endMatterLabel   || metaFmt) };
    const bodyFmt  = { ...(S.styles?.endMatterBody    || metaFmt) };

    // defaults defensivos (por si abres un JSON viejo)
    headFmt.alpha  = (headFmt.alpha  ?? 1);
    labelFmt.alpha = (labelFmt.alpha ?? 1);
    bodyFmt.alpha  = (bodyFmt.alpha  ?? 1);

    headFmt.leading  = (headFmt.leading  ?? 1.35);
    labelFmt.leading = (labelFmt.leading ?? 1.35);
    bodyFmt.leading  = (bodyFmt.leading  ?? 1.45);

    // Alineaciones esperadas (tu normalizeLayoutToStandard ya las fija, esto es sólo “cinturón y tirantes”)
    headFmt.align  = headFmt.align  || 'center';
    labelFmt.align = labelFmt.align || 'left';
    bodyFmt.align  = bodyFmt.align  || 'justify';

    const headLH  = lineHeightFor(headFmt.size, headFmt.leading);
    const labelLH = lineHeightFor(labelFmt.size, labelFmt.leading);
    const bodyLH  = lineHeightFor(bodyFmt.size, bodyFmt.leading);

    const mctx2 = document.createElement('canvas').getContext('2d');

    // ===== TÍTULO (wrap real para i18n) =====
    const headMeasureFmt = { font: headFmt.font, size: headFmt.size };
    const headRuns = [
      { text: String(headingText || ''), b:false, i:false, u:false, cite:null }
    ];
    const headLines = wrapRunsToLines(headRuns, headMeasureFmt, contentWidth, mctx2, {
      firstLineIndentPx: 0,
      mode: 'wrap'
    });

    const safeHeadLines = (headLines && headLines.length) ? headLines : [{
      text: String(headingText || ''),
      runs: headRuns,
      widthPx: 0,
      citeNums: []
    }];

    const headReserveH = Math.ceil((safeHeadLines.length * headLH) + Math.round(bodyLH * 0.35));
    ensureSpace(headReserveH);

    for(const ln of safeHeadLines){
      pages[pages.length-1].lines.push({
        type:'text',
        text: ln?.text || '',
        runs: ln?.runs || null, // ✅ no parse de ^(N) aquí
        x: margins.left,
        y: page.y,
        fmt: headFmt,
        align: headFmt.align,
        maxWidth: contentWidth,
        paragraph:false
      });
      page.y += headLH;
    }
    page.y += Math.round(bodyLH * 0.35);

    // ===== Medidas / gaps =====
    const labelMeasureFmt = { font: labelFmt.font, size: labelFmt.size };
    const bodyMeasureFmt  = { font: bodyFmt.font,  size: bodyFmt.size  };

    const paraGap    = Math.round(bodyLH * 0.65);
    const sectionGap = Math.round(bodyLH * 0.9);

    for(const sec of sections){
      const labelText = String(sec.label || '').trim();

      // ===== LABEL (wrap + bold, con endMatterLabel) =====
      if(labelText){
        const labelRuns = [
          { text: labelText, b:true, i:false, u:false, cite:null }
        ];
        const labelLines = wrapRunsToLines(labelRuns, labelMeasureFmt, contentWidth, mctx2, {
          firstLineIndentPx: 0,
          mode: 'wrap'
        });

        const safeLabelLines = (labelLines && labelLines.length) ? labelLines : [{
          text: labelText,
          runs: labelRuns,
          widthPx: 0,
          citeNums: []
        }];

        // ✅ mantener label + (al menos) 1 línea de body juntos si hay body
        const hasBody = !!String(sec.text || '').replace(/\r/g,'').trim();
        const minAfterLabel = hasBody ? bodyLH : 0;

        const labelReserveH = Math.ceil(
          (safeLabelLines.length * labelLH) +
          Math.round(bodyLH * 0.2) +
          minAfterLabel
        );
        ensureSpace(labelReserveH);

        for(const ln of safeLabelLines){
          pages[pages.length-1].lines.push({
            type:'text',
            text: ln?.text || '',
            runs: ln?.runs || null, // ✅ bold ya viene en runs
            x: margins.left,
            y: page.y,
            fmt: labelFmt,
            align: labelFmt.align,
            maxWidth: contentWidth,
            paragraph:false
          });
          page.y += labelLH;
        }

        page.y += Math.round(bodyLH * 0.2);
      }

      // ===== BODY (endMatterBody, con [b]/[i]/[u], sin ^(N)) =====
      const paras = String(sec.text || '').replace(/\r/g,'').split(/\n{2,}/);
      for(const para of paras){
        const raw = String(para || '').trim();
        if(!raw) continue;

        const parsed = parseInlineMarkupToRuns(raw, { allowCites:false });
        const normRuns = normalizeInlineRunsWhitespace(parsed.runs);
        if(!normRuns || normRuns.length === 0) continue;

        const lines = wrapRunsToLines(normRuns, bodyMeasureFmt, contentWidth, mctx2, {
          firstLineIndentPx: 0,
          mode: 'wrap'
        });

        for(let i=0; i<lines.length; i++){
          ensureSpace(bodyLH);

          pages[pages.length-1].lines.push({
            type:'text',
            text: lines[i]?.text || '',
            runs: lines[i]?.runs || null,
            x: margins.left,
            y: page.y,
            fmt: bodyFmt,
            align: bodyFmt.align,
            maxWidth: contentWidth,
            measuredWidthPx: (lines[i] && Number.isFinite(lines[i].widthPx) ? lines[i].widthPx : null),
            paragraph: true,
            isLastInParagraph: i === lines.length - 1
          });

          page.y += bodyLH;
        }

        page.y += paraGap;
      }

      page.y += sectionGap;
    }
  }

  // ✅ Página final de “Citas” (solo marcadas por check)
  if(END_CITES_PAGE_ENABLED){
    renderAppendixList(citationsHeading, citeEmpty, numsForCitesPage);
  }

  // ✅ Página final de “Bibliografía” (solo tipos bibliográficos)
  // (se añade después de Citas si Citas está activado)
  if(END_BIBLIO_PAGE_ENABLED){
    renderAppendixList(bibliographyHeading, bibEmpty, numsForBibliography);
  }

  // ✅ NUEVO: Página final de “Nota editorial y declaraciones” (si hay contenido)
  renderEndMatterPage();
    /* ---------- 3) Índice (si procede) — ahora con páginas reales ---------- */
    if(S.toc.enabled){
      const indexPages = [];

      // Helpers de índice
      const idxBottom = pagePx.h - margins.bottom;
      const tocIndentStep = Math.round(6 * pxPerMm); // 6mm de sangría por nivel

      // ✅ Índice centrado como bloque (no “pegado” a la izquierda)
      const tocWidth = Math.round(coverMaxW * 0.82);
      const tocStartX = margins.left + Math.round((coverMaxW - tocWidth) / 2);

      const tocHeading = t('export.index.heading', 'Índice');

      // ===== ✅ FIX: TOC entries con wrap real + dots + número de página =====
      function wrapRunsToLinesWithLastLineLimit(runs, fmt, maxW, lastW, ctx){
        const mode = 'wrap';
        const pieces = splitInlineRunsIntoPieces(runs);

        let idx = 0;
        while(idx < pieces.length && pieces[idx].type === 'space') idx++;

        const lines = [];

        const buildLineFromPieces = (pcs)=>{
          // quitar espacios finales
          let end = pcs.length;
          while(end > 0 && pcs[end-1].type === 'space') end--;
          const pcs2 = pcs.slice(0, end);
          if(pcs2.length === 0) return null;

          const lineRuns = [];
          for(const p of pcs2){
            for(const rr of (p.runs||[])) lineRuns.push(rr);
          }
          const merged = mergeInlineRuns(lineRuns);

          const citeSet = new Set();
          for(const rr of merged){
            if(rr.cite != null && Number.isFinite(rr.cite) && rr.cite > 0){
              citeSet.add(rr.cite);
            }
          }
          const citeNums = Array.from(citeSet);
          const text = merged.map(rr=>rr.text).join('');

          return { runs: merged, text, citeNums };
        };

        const remainingFitsInOneLastLine = ()=>{
          const remRuns = [];
          for(let j=idx; j<pieces.length; j++){
            for(const rr of (pieces[j].runs||[])) remRuns.push(rr);
          }
          const merged = mergeInlineRuns(remRuns);
          const wrapped = wrapRunsToLines(merged, fmt, lastW, ctx, { firstLineIndentPx:0, mode });
          return wrapped.length <= 1;
        };

        while(idx < pieces.length){
          while(idx < pieces.length && pieces[idx].type === 'space') idx++;
          if(idx >= pieces.length) break;

          if(remainingFitsInOneLastLine()){
            const remRuns = [];
            for(let j=idx; j<pieces.length; j++){
              for(const rr of (pieces[j].runs||[])) remRuns.push(rr);
            }
            const merged = mergeInlineRuns(remRuns);
            const wrapped = wrapRunsToLines(merged, fmt, lastW, ctx, { firstLineIndentPx:0, mode });
            if(wrapped.length) lines.push(wrapped[0]);
            break;
          }

          let curPieces = [];
          let curW = 0;

          while(idx < pieces.length){
            const p = pieces[idx];
            if(curPieces.length === 0 && p.type === 'space'){ idx++; continue; }

            const pW = measureInlineRunsWidth(p.runs, fmt, ctx, mode);

            if(curPieces.length === 0){
              curPieces.push(p);
              curW = pW;
              idx++;
              continue;
            }

            if(curW + pW <= maxW){
              curPieces.push(p);
              curW += pW;
              idx++;
            }else{
              break;
            }
          }

          const lineObj = buildLineFromPieces(curPieces);
          if(lineObj) lines.push(lineObj);
        }

        return lines;
      }

      function makeTocLeaderRuns(titleRuns, pageStr, maxW, fmt){
        const safePage = (pageStr != null && pageStr !== '') ? String(pageStr) : t('export.index.defaultPagePlaceholder', '—');
        ctx.font = `${fmt.size}px ${fontStack(fmt.font)}`;

        const tW = measureInlineRunsWidth(titleRuns || [], fmt, ctx, 'wrap');
        const pW = ctx.measureText(safePage).width;

        const dotChar = '.';
        const dotW = Math.max(1, ctx.measureText(dotChar).width);
        const minGapW = ctx.measureText('  ').width;

        const avail = Math.max(0, maxW - tW - pW - minGapW);
        const nDots = Math.floor(avail / dotW);

        const runs = [];
        for(const r of (titleRuns||[])) runs.push(r);

        if(nDots <= 0){
          runs.push({ text:' ', b:false, i:false, u:false, cite:null });
          runs.push({ text: safePage, b:false, i:false, u:false, cite:null });
        }else{
          runs.push({ text:' ', b:false, i:false, u:false, cite:null });
          runs.push({ text: dotChar.repeat(nDots), b:false, i:false, u:false, cite:null });
          runs.push({ text:' ', b:false, i:false, u:false, cite:null });
          runs.push({ text: safePage, b:false, i:false, u:false, cite:null });
        }

        const merged = mergeInlineRuns(runs);
        const text = merged.map(r=>r.text).join('');
        const fits = measureInlineRunsWidth(merged, fmt, ctx, 'wrap') <= (maxW + 1);

        return { runs: merged, text, fits };
      }

      function buildTocEntryLines(entryTitle, pageNum, maxW, fmt){
        const pageStr = (pageNum != null && pageNum !== '') ? String(pageNum) : t('export.index.defaultPagePlaceholder', '—');
        const safeTitle = String(entryTitle || '').trim();

        const parsed = parseInlineMarkupToRuns(safeTitle, { allowCites:true });
        const normRuns = normalizeInlineRunsWhitespace(parsed.runs);

        if(!normRuns || normRuns.length===0){
          const lr = makeTocLeaderRuns([], pageStr, maxW, fmt);
          return [{ text: lr.text, runs: lr.runs }];
        }

        ctx.font = `${fmt.size}px ${fontStack(fmt.font)}`;
        const pW = ctx.measureText(pageStr).width;
        const minGapW = ctx.measureText('  ').width;
        const lastW = Math.max(60, maxW - pW - minGapW);

        // intentar una sola línea (título dentro de lastW, luego dots+page)
        const oneTitle = wrapRunsToLines(normRuns, fmt, lastW, ctx, { firstLineIndentPx:0, mode:'wrap' });
        if(oneTitle.length === 1){
          const lr = makeTocLeaderRuns(oneTitle[0].runs, pageStr, maxW, fmt);
          if(lr.fits){
            return [{ text: lr.text, runs: lr.runs }];
          }
        }

        // multi-línea: envolver normal, pero garantizando que la última línea cabe en lastW
        const titleLines = wrapRunsToLinesWithLastLineLimit(normRuns, fmt, maxW, lastW, ctx);

        if(!titleLines || titleLines.length===0){
          const lr = makeTocLeaderRuns([], pageStr, maxW, fmt);
          return [{ text: lr.text, runs: lr.runs }];
        }

        const out = [];
        for(let i=0; i<titleLines.length; i++){
          if(i < titleLines.length-1){
            out.push({ text: titleLines[i].text, runs: titleLines[i].runs });
          }else{
            const lr = makeTocLeaderRuns(titleLines[i].runs, pageStr, maxW, fmt);
            out.push({ text: lr.text, runs: lr.runs });
          }
        }
        return out;
      }

      function newIndexPage(withMainTitle){
        const p = newSpecialPage('index');
        let yy = p.y;

        if(withMainTitle){
          // ✅ FIX A5/Kindle:
          // Si el título se parte en 2+ líneas, lo maquetamos como líneas reales (no dejamos que el DOM lo envuelva “a su aire”)
          yy = pushWrappedText(p, (S.meta.titulo||''), margins.left, yy, titFmt, 'center', coverMaxW, 0);

          // gap defensivo (canvas vs DOM)
          yy += Math.max(6, Math.round(lineHeightFor(titFmt.size, titFmt.leading) * 0.15));
        }

        const headFmt = {...metaFmt, size: Math.max(12, metaFmt.size+1), alpha: metaFmt.alpha ?? 1};
        p.lines.push({
          type:'text',
          text: tocHeading,
          x:margins.left,
          y:yy,
          fmt: headFmt,
          align:'center',
          maxWidth:coverMaxW,
          paragraph:false
        });
        yy += lineHeightFor(headFmt.size, headFmt.leading) * 1.1;

        yy += Math.round(lineHeightFor(metaFmt.size, metaFmt.leading)*0.35);
        return { p, y: yy };
      }

      const lh = lineHeightFor(metaFmt.size, metaFmt.leading);
      const sep = Math.round(lh * 0.35);

      // Primera página de índice
      let pack = newIndexPage(true);
      let idxPage = pack.p;
      let y2 = pack.y;
      indexPages.push(idxPage);

      function ensureIndexSpace(h){
        if(y2 + h <= idxBottom) return;
        pack = newIndexPage(false);
        idxPage = pack.p;
        y2 = pack.y;
        indexPages.push(idxPage);
      }

      if(tocEntries.length === 0){
        idxPage.lines.push({
          type:'text',
          text: t('export.index.empty', '(Sin capítulos)'),
          x:margins.left,
          y:y2,
          fmt: metaFmt,
          align:'center',
          maxWidth:coverMaxW,
          paragraph:false
        });
      }else{
        tocEntries.forEach(entry=>{
          const indent = (entry.level || 0) * tocIndentStep;
          const x = tocStartX + indent;
          const maxW = Math.max(120, tocWidth - indent);

          const entryLines = buildTocEntryLines(entry.title, entry.page, maxW, metaFmt);
          const needH = (entryLines.length * lh) + sep;

          ensureIndexSpace(needH);

          entryLines.forEach((ln)=>{
            idxPage.lines.push({
              type:'text',
              text: ln.text || '',
              runs: ln.runs || null,
              x,
              y:y2,
              fmt: metaFmt,
              align:'left',
              maxWidth: maxW,
              paragraph:false
            });
            y2 += lh;
          });

          y2 += sep;
        });
      }

      // ✅ Insertar índice justo después de portada + licencias
      pages.splice(frontMatterCount, 0, ...indexPages);
    }

    /* ---------- Render (ventana de impresión) ---------- */
    const defaultPdfName = t('panel4.defaultPdfFileName', 'ensayo.pdf');
    const pdfName = (S.export.fileName || defaultPdfName);
    w.document.title = pdfName.replace(/\.pdf$/i,'');

    // CSS de impresión incrustado
    const PRINT_CSS = `
      @page { size: ${pageMM.w}mm ${pageMM.h}mm; margin: 0; }
      *{ box-sizing:border-box; }
      body.print-root { background:#fff; color:#111; margin:0; padding:0; }
      .print-page { position:relative; width:${pagePx.w}px; height:${pagePx.h}px; overflow:hidden; page-break-after:always; break-after:page; }
      .print-content { position:absolute; }
      .print-header, .print-footer { position:absolute; padding:8px 0; border-left-width:0 !important; border-right-width:0 !important; border-top-width:0; border-bottom-width:0; background:transparent; }
      .print-header{ top:0;    border-bottom:1px solid transparent; }
      .print-footer{ bottom:0; border-top:1px solid transparent; padding:0; }
      .line-none{  border-color:transparent }
      .line-solid{ border-color:currentColor; border-style:solid }
      .line-dashed{border-color:currentColor; border-style:dashed }
      .line-dotted{border-color:currentColor; border-style:dotted }
      .pn{ position:absolute; font-weight:600 }
      .print-center{ text-align:center } .print-right{ text-align:right } .print-left{ text-align:left }
      /* ✅ FIX: NO permitir que el navegador re-envuelva las líneas (si envuelve, se solapan porque están en absolute) */
      .print-line{ position:absolute; white-space:pre }
      .print-hr{ height:1px; background:#222; position:absolute }
      .cite-sup{ vertical-align:super; line-height:1; }
      .footer-cites{ position:absolute; left:0; right:0; overflow:hidden }
      .footer-cite-item{ margin:0; padding:0; }
      .footer-cite-more{ margin-top:2px; opacity:0.9; }
      .footer-text{ position:absolute; left:0; right:0; }

      /* ✅ Imágenes absolutas (sin reflow) */
      .print-img{
        position:absolute;
        display:block;
        object-fit:contain;
        border-radius: 10px;
      }
      .print-img-missing{
        position:absolute;
        display:flex;
        align-items:center;
        justify-content:center;
        border: 1px dashed rgba(0,0,0,0.35);
        border-radius: 10px;
        font-size: 12px;
        opacity: 0.75;
        padding: 10px 12px;
        text-align: center;
      }
    `;
    w.document.open();
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${w.document.title}</title><style>${PRINT_CSS}</style></head><body class="print-root"></body></html>`);
    w.document.close();

    function applyPageNumberPosition(pnEl, position){
      const pos = position || 'bottom-right';
      const offs = getPNOffsets(pos);

      // horizontal
      if(pos.endsWith('left')){
        pnEl.style.left = `${margins.left}px`;
        pnEl.style.right = '';
        pnEl.style.textAlign = 'left';
        pnEl.style.width = 'auto';
      }else if(pos.endsWith('right')){
        pnEl.style.right = `${margins.right}px`;
        pnEl.style.left = '';
        pnEl.style.textAlign = 'right';
        pnEl.style.width = 'auto';
      }else if(pos.endsWith('center')){
        pnEl.style.left = `${margins.left}px`;
        pnEl.style.right = `${margins.right}px`;
        pnEl.style.textAlign = 'center';
        pnEl.style.width = `${pagePx.w - margins.left - margins.right}px`;
      }else{
        // fallback
        pnEl.style.right = `${margins.right}px`;
        pnEl.style.left = '';
        pnEl.style.textAlign = 'right';
        pnEl.style.width = 'auto';
      }

      // vertical
      if(pos.startsWith('top')){
        const topDist = offs.topDist;
        pnEl.style.top = `${topDist}px`;
        pnEl.style.bottom = '';
      }else{
        const bottomDist = offs.bottomDist;
        pnEl.style.bottom = `${bottomDist}px`;
        pnEl.style.top = '';
      }
    }

    // ✅ Render de runs (con [b]/[i]/[u] y superíndices de cita si existen)
    function appendInlineRunsToEl(el, runs, baseFmt){
  // ✅ Merge para render: reduce muchísimo nodos DOM (especialmente en textos largos)
  const merged = mergeInlineRunsForRender(runs);

  for(const r of (merged||[])){
    if(!r || !r.text) continue;

    // cita (superíndice)
    if(r.cite != null){
      const sup = w.document.createElement('span');
      sup.className = 'cite-sup';
      sup.textContent = r.text;
      sup.style.fontSize = `${Math.max(8, Math.round((baseFmt?.size || 12) * 0.7))}px`;
      if(r.b) sup.style.fontWeight = 'bold';
      if(r.i) sup.style.fontStyle = 'italic';
      if(r.u) sup.style.textDecoration = 'underline';
      el.appendChild(sup);
      continue;
    }

    // estilos
    if(r.b || r.i || r.u){
      const sp = w.document.createElement('span');
      if(r.b) sp.style.fontWeight = 'bold';
      if(r.i) sp.style.fontStyle = 'italic';
      if(r.u) sp.style.textDecoration = 'underline';
      sp.textContent = r.text;
      el.appendChild(sp);
    }else{
      el.appendChild(w.document.createTextNode(r.text));
    }
  }
}

    function renderInlineText(el, rawText, fmt){
      const parsed = parseInlineMarkupToRuns(String(rawText || ''), { allowCites:true });
      appendInlineRunsToEl(el, parsed.runs, fmt);
    }

   const _measureLineCtx = document.createElement('canvas').getContext('2d');

function measureRenderedLineWidth(item, boxWidth){
  // ✅ Si la línea ya trae medida desde el wrap, úsala (evita medir otra vez)
  if(item && typeof item.measuredWidthPx === 'number' && item.measuredWidthPx >= 0){
    return item.measuredWidthPx;
  }

  const mctx = _measureLineCtx;

  // Si tenemos runs, medimos de forma más realista (evita desbordes en justify)
  if(item && Array.isArray(item.runs)){
    const fmt = item.fmt || { font:'serif', size:12 };
    return measureInlineRunsWidth(item.runs, fmt, mctx, 'render');
  }

  // fallback: medir texto plano (si no hay runs)
  const fmt = item?.fmt || { font:'serif', size:12 };
  mctx.font = `${fmt.size}px ${fontStack(fmt.font)}`;
  return mctx.measureText(String(item?.text || '')).width;
}

    const imgEls = [];

    // Construcción de nodos por página
    pages.forEach((p)=>{
      const pg = w.document.createElement('div');
      pg.className='print-page';
      w.document.body.appendChild(pg);

      const showHeader = S.styles.header.enabled && !!p.header;
      const showFooter = S.styles.footer.enabled && !!p.footer;
      const showPN = S.styles.pageNumbers.enabled && !!p.pn;

      // Header
      if(showHeader){
        const h = w.document.createElement('div'); h.className='print-header';

        // el header vive dentro del margen superior
        h.style.top  = `${margins.top}px`;

        h.style.left = `${margins.left}px`;
        h.style.right= `${margins.right}px`;
        h.style.color = rgba(S.styles.header.color, S.styles.header.alpha);
        h.style.font = `${S.styles.header.size}px ${fontStack(S.styles.header.font)}`;
        h.classList.add(S.styles.header.line==='none'?'line-none':`line-${S.styles.header.line}`);
        h.style.borderBottomWidth = S.styles.header.line==='none' ? '0' : '1px';
        h.style.borderTopWidth = '0';

        // Contenido del cabecero: “dual” (título izq + autor dcha)
        const row = w.document.createElement('div');
        row.style.display='flex'; row.style.justifyContent='space-between';
        const l = w.document.createElement('div'); l.textContent = S.meta.titulo || '';
        const r = w.document.createElement('div'); r.textContent = S.meta.autor || '';
        row.appendChild(l); row.appendChild(r);
        h.appendChild(row);

        pg.appendChild(h);
      }

      // Footer (línea arriba, citas en el hueco, texto cerca del número de página)
      if(showFooter){
        const f = w.document.createElement('div'); f.className='print-footer';

        // ✅ El footer puede crecer hacia arriba para que quepan todas las citas
        const footerH = Math.max(margins.bottom, Number(p.footerH || margins.bottom));

        f.style.bottom = '0px';
        f.style.height = `${footerH}px`;
        f.style.left = `${margins.left}px`;
        f.style.right= `${margins.right}px`;
        f.style.color = rgba(S.styles.footer.color, S.styles.footer.alpha);
        f.style.font = `${S.styles.footer.size}px ${fontStack(S.styles.footer.font)}`;
        f.style.padding = '0';
        f.style.overflow = 'hidden';

        // la línea del pie queda en el borde superior del pie
        f.classList.add(S.styles.footer.line==='none'?'line-none':`line-${S.styles.footer.line}`);
        f.style.borderTopWidth = S.styles.footer.line==='none' ? '0' : '1px';
        f.style.borderBottomWidth = '0';

        // === Reservar espacio inferior para texto de pie y/o número de página ===
        let bottomForTextLocal = 8;
        if(showPN){
          const pos = (S.styles.pageNumbers.position || 'bottom-right');
          if(pos.startsWith('bottom')){
            const off = getPNOffsets(pos);
            const pnFmt = S.styles.footer; // abajo hereda pie
            const pnH = lineHeightFor(pnFmt.size, pnFmt.leading);
            bottomForTextLocal = (off.bottomDist || 8) + pnH + 6;
          }
        }

        const textLHLocal = lineHeightFor(S.styles.footer.size, S.styles.footer.leading);
        const hasFooterTextLocal = !!(S.styles.footer.text && String(S.styles.footer.text).trim());
        const reserveTextHLocal = hasFooterTextLocal ? textLHLocal : 0;

        // Mantener el texto dentro del margen inferior original (no “sube” con el pie)
        const maxBottomLocal = Math.max(0, margins.bottom - reserveTextHLocal - 2);
        bottomForTextLocal = clamp(bottomForTextLocal, 0, maxBottomLocal);

        // === Citas en el hueco del pie (si procede) ===
        const showFooterCites = (S.styles.footer.citationsEnabled !== false);
        const citeNums = p.cites
          ? Array.from(p.cites).filter(n=>Number.isFinite(n)).sort((a,b)=>a-b)
          : [];

        if(showFooterCites && citeNums.length>0){
          const citeColorBase = rgba(S.styles.footer.color, Math.min(1, (S.styles.footer.alpha ?? 1) * 0.92));

          const citeTop = 6;

          // bottom reservado (en px desde el borde inferior de la página)
          const citeBottom = clamp(
            bottomForTextLocal + reserveTextHLocal + 4,
            0,
            Math.max(0, margins.bottom - 2)
          );

          const availH = Math.max(0, footerH - citeTop - citeBottom);
          const footerWLocal = pagePx.w - margins.left - margins.right;

          const citeItemsLocal = (S.citations && Array.isArray(S.citations.items)) ? S.citations.items : [];

          let citeSizeLocal = Math.max(7, Math.round(S.styles.footer.size * 0.78));
          let citeLHLocal   = Math.max(9, Math.round(lineHeightFor(citeSizeLocal, 1.15)));
          let gapYLocal     = Math.max(1, Math.round(citeLHLocal * 0.15));

          const mctx = document.createElement('canvas').getContext('2d');

          function buildCitesLayout(){
            mctx.font = `${citeSizeLocal}px ${fontStack(S.styles.footer.font)}`;
            const list = [];
            let total = 0;

            const citeFmtLocal = { font: S.styles.footer.font, size: citeSizeLocal };

            for(const n of citeNums){
              const prefix = `(${n}) `;
              const prefixW = mctx.measureText(prefix).width;
              const maxBodyW = Math.max(40, footerWLocal - prefixW);

              const rawText = (citeItemsLocal[n-1] && typeof citeItemsLocal[n-1].text === 'string')
                ? citeItemsLocal[n-1].text
                : '';
              const bodyRaw = String(rawText || '').trim() || t('export.citations.missingText', '—');

              // ✅ parse inline formatting
              const parsed = parseInlineMarkupToRuns(bodyRaw, { allowCites:false });
              const normRuns = normalizeInlineRunsWhitespace(parsed.runs);

              const wrapped = wrapRunsToLines(normRuns, citeFmtLocal, maxBodyW, mctx, { firstLineIndentPx:0, mode:'wrap' });
              const linesRuns = wrapped.map(x=>x.runs);

              const neededH = (linesRuns.length * citeLHLocal) + gapYLocal;

              list.push({ n, prefixW, lines: linesRuns, neededH });
              total += neededH;
            }

            return { list, total };
          }

          let layout = buildCitesLayout();

          while(layout.total > availH && citeSizeLocal > 6){
            citeSizeLocal -= 1;
            citeLHLocal   = Math.max(9, Math.round(lineHeightFor(citeSizeLocal, 1.15)));
            gapYLocal     = Math.max(1, Math.round(citeLHLocal * 0.15));
            layout = buildCitesLayout();
          }

          if(availH >= citeLHLocal){
            const citesWrap = w.document.createElement('div');
            citesWrap.className = 'footer-cites';
            citesWrap.style.top = `${citeTop}px`;
            citesWrap.style.bottom = `${citeBottom}px`;
            citesWrap.style.left = '0';
            citesWrap.style.right = '0';
            citesWrap.style.overflow = 'hidden';
            citesWrap.style.font = `${citeSizeLocal}px ${fontStack(S.styles.footer.font)}`;
            citesWrap.style.lineHeight = `${citeLHLocal}px`;
            citesWrap.style.color = citeColorBase;
            citesWrap.style.textAlign = 'left';

           // ✅ Mostrar solo las citas que CABEN (evita DOM gigantes)
let fitList = [];
let usedH = 0;

for(const it of layout.list){
  if(usedH + it.neededH <= availH){
    fitList.push(it);
    usedH += it.neededH;
  }else{
    break;
  }
}

let hiddenCount = layout.list.length - fitList.length;

// Si no cabe ni la primera, al menos mostramos la primera (se cortará)
if(fitList.length === 0 && layout.list.length > 0){
  fitList = [layout.list[0]];
  hiddenCount = layout.list.length - 1;
  usedH = layout.list[0].neededH;
}

// Reservar hueco para el indicador “… +N más”
const moreLabel = t('export.citations.more', 'más');
const moreLineH = citeLHLocal + gapYLocal;

if(hiddenCount > 0){
  while(fitList.length > 1 && usedH + moreLineH > availH){
    const removed = fitList.pop();
    if(removed){
      usedH -= removed.neededH;
      hiddenCount += 1;
    }else{
      break;
    }
  }
}

const citeFmtDom = { font: S.styles.footer.font, size: citeSizeLocal };

// ✅ Render por líneas con runs
for(const it of fitList){
  const block = w.document.createElement('div');
  block.className = 'footer-cite-item';
  block.style.display = 'block';
  block.style.margin = '0';
  block.style.padding = '0';
  block.style.marginBottom = `${gapYLocal}px`;

  // primera línea (con prefijo)
  const first = w.document.createElement('div');
  first.style.whiteSpace = 'pre';
  first.appendChild(w.document.createTextNode(`(${it.n}) `));
  appendInlineRunsToEl(first, it.lines[0] || [], citeFmtDom);
  block.appendChild(first);

  // líneas siguientes (indentadas)
  for(let i=1;i<it.lines.length;i++){
    const ln = w.document.createElement('div');
    ln.style.whiteSpace = 'pre';
    ln.style.paddingLeft = `${it.prefixW}px`;
    appendInlineRunsToEl(ln, it.lines[i] || [], citeFmtDom);
    block.appendChild(ln);
  }

  citesWrap.appendChild(block);
}

if(hiddenCount > 0 && (availH - usedH) >= citeLHLocal){
  const more = w.document.createElement('div');
  more.className = 'footer-cite-more';
  more.style.whiteSpace = 'pre';
  more.textContent = `… +${hiddenCount} ${moreLabel}`;
  citesWrap.appendChild(more);
}
f.appendChild(citesWrap);
          }
        }

        // === Texto de pie ===
        if(hasFooterTextLocal){
          const txt = w.document.createElement('div');
          txt.className = 'footer-text';
          txt.style.position = 'absolute';
          txt.style.left = '0';
          txt.style.right = '0';
          txt.style.textAlign = (footAlign==='justify' ? 'center' : footAlign);
          txt.style.bottom = `${bottomForTextLocal}px`;
          txt.style.whiteSpace = 'nowrap';
          txt.style.overflow = 'hidden';
          txt.style.textOverflow = 'ellipsis';
          txt.textContent = S.styles.footer.text || '';
          f.appendChild(txt);
        }

        pg.appendChild(f);
      }

      // Page number
      if(showPN){
        const pn = w.document.createElement('div'); pn.className='pn';

        const pos = S.styles.pageNumbers.position || 'bottom-right';
        const fmt = (pos.startsWith('top') ? S.styles.header : S.styles.footer);

        pn.style.color = rgba(fmt.color, fmt.alpha);
        pn.style.font = `${fmt.size}px ${fontStack(fmt.font)}`;
        pn.textContent = (p.logicalPage != null) ? String(p.logicalPage) : '';

        applyPageNumberPosition(pn, pos);

        pg.appendChild(pn);
      }

      // Contenido
      const cont = w.document.createElement('div');
      cont.className='print-content';
      cont.style.left = '0';
      cont.style.right = '0';
      cont.style.top = '0';
      cont.style.bottom = '0';
      pg.appendChild(cont);

      // Pintar líneas / HR / imágenes
      p.lines.forEach(item=>{
        if(item.type==='hr'){
          const hr = w.document.createElement('div'); hr.className='print-hr';
          hr.style.left=`${item.x}px`; hr.style.width=`${item.w}px`; hr.style.top=`${item.y}px`;
          cont.appendChild(hr);
          return;
        }

        if(item.type==='img'){
          const im = w.document.createElement('img');
          im.className = 'print-img';
          im.style.left = `${item.x}px`;
          im.style.top  = `${item.y}px`;
          im.style.width = `${item.w}px`;
          im.style.height= `${item.h}px`;
          im.alt = String(item.alt || '');
          im.decoding = 'async';
          // eager para preview/print
          try{ im.loading = 'eager'; }catch{ /* ignore */ }
          im.src = String(item.src || '');
          cont.appendChild(im);
          imgEls.push(im);
          return;
        }

        if(item.type==='img-missing'){
          const box = w.document.createElement('div');
          box.className = 'print-img-missing';
          box.style.left = `${item.x}px`;
          box.style.top  = `${item.y}px`;
          box.style.width = `${item.w}px`;
          box.style.height= `${item.h}px`;
          box.textContent = String(item.text || imgMissingText);
          cont.appendChild(box);
          return;
        }

        // texto
        const d = w.document.createElement('div');
        d.className = 'print-line';
        d.style.top = `${item.y}px`;
        d.style.color = rgba(item.fmt.color, item.fmt.alpha);
        d.style.font = `${item.fmt.size}px ${fontStack(item.fmt.font)}`;

        // ancho de caja y alineación
        const align = item.align || 'left';
        const boxWidth = item.maxWidth || (pagePx.w - margins.left - margins.right);
        d.style.width = `${boxWidth}px`;
        d.style.left  = `${item.x}px`;
        d.style.textAlign = (align==='justify' ? 'left' : align);

        // contenido (con formato inline y citas)
        if(Array.isArray(item.runs)){
          appendInlineRunsToEl(d, item.runs, item.fmt);
        }else{
          renderInlineText(d, item.text || '', item.fmt);
        }

        // Justificación fina (inter-word) para líneas intermedias de párrafos
        if(align==='justify' && item.paragraph && !item.isLastInParagraph){
          const gaps = countGaps(item.text);
          if(gaps>0){
            const tw = measureRenderedLineWidth(item, boxWidth);
            const extra = Math.max(0, boxWidth - tw);
            d.style.wordSpacing = `${extra/gaps}px`;
          }
        }

        if(item.rightAligned){ d.style.textAlign='right'; }

        cont.appendChild(d);
      });
    });

    // ✅ Esperar a que carguen imágenes antes de imprimir (y para que la preview mida bien)
    if(imgEls.length>0){
      await Promise.all(imgEls.map((img)=>{
        return new Promise((resolve)=>{
          let done = false;
          const finish = ()=>{
            if(done) return;
            done = true;
            resolve();
          };

          try{
            if(img.complete && img.naturalWidth>0){
              finish();
              return;
            }
          }catch{ /* ignore */ }

          img.addEventListener('load', finish, { once:true });
          img.addEventListener('error', finish, { once:true });

          // timeout defensivo
          setTimeout(finish, 2000);
        });
      }));
    }

    // Disparar impresión (solo en modo print)
    if(mode === "print"){
      try{ w.focus(); }catch(e){}
      try{ w.print(); }catch(e){}
    }
  }catch(err){
    console.error(err);
    try{
      w.document.open();
      w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Error</title></head><body style="font-family:system-ui;padding:18px;">${String(err && err.message ? err.message : err)}</body></html>`);
      w.document.close();
    }catch{ /* ignore */ }
  }finally{
    try{ if(typeof __efReadyResolve === 'function') __efReadyResolve(); }catch{ /* ignore */ }
  }
}
