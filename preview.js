/* preview.js — Panel 5: Previsualización (ensaYOnesa)
   Renderiza el mismo documento que se exporta (exportToPrintPDF) dentro de la app,
   con controles de zoom y ajuste a ancho.

   Requisitos:
   - export.js debe exponer exportToPrintPDF(S, opts) con opts.mode === "preview" (sin imprimir)
   - app.js mantiene el estado global `state` (global lexical binding)

   Nota (Feb 2026):
   - Este archivo solo añade soporte UI para insertar imágenes con marcadores [img:<id>].
   - El render/maquetado real de imágenes debe hacerse en export.js (para respetar posición y reservar espacio).
*/

/* global exportToPrintPDF, t */

(function () {
  'use strict';

  const PANEL_ID = 'panel5';
  const STEP_SELECTOR = '.step-btn[data-target="#panel5"]';

  const DEBOUNCE_MS = 450;
  const ZOOM_MIN = 0.25;  // 25%
  const ZOOM_MAX = 2.0;   // 200%

  /** @type {null | {
   *   panel: HTMLElement,
   *   viewport: HTMLElement,
   *   sizer: HTMLElement,
   *   stage: HTMLElement,
   *   frame: HTMLIFrameElement,
   *   status: HTMLElement,
   *   zoomOut: HTMLButtonElement,
   *   zoomIn: HTMLButtonElement,
   *   zoomRange: HTMLInputElement,
   *   zoomLabel: HTMLElement,
   *   fit: HTMLButtonElement,
   *   actual: HTMLButtonElement,
   *   refresh: HTMLButtonElement
   * }} */
  let els = null;

  let zoom = 0.7; // valor inicial (se recalcula en el primer render)
  /** @type {"auto" | "fit" | "manual"} */
  let zoomMode = 'auto';

  let dirty = true;
  let renderTimer = null;
  let isRendering = false;

  /** @type {{contentW:number, contentH:number, pageW:number}} */
  let metrics = { contentW: 1, contentH: 1, pageW: 1 };

  function byId(id) {
    return document.getElementById(id);
  }

  function clamp(n, min, max) {
    return Math.min(max, Math.max(min, n));
  }

  function isPanelActive() {
    return !!(els && els.panel && els.panel.classList.contains('active'));
  }

  function tr(key, fallback) {
    try {
      if (typeof t === 'function') return t(key, fallback);
    } catch {
      /* ignore */
    }
    return fallback;
  }

  function ensurePanelMarkup() {
    // Si ya existe, no hacemos nada.
    if (byId(PANEL_ID)) return;

    const panels = document.querySelector('.panels');
    if (!panels) return;

    const sec = document.createElement('section');
    sec.id = PANEL_ID;
    sec.className = 'panel';
    sec.setAttribute('aria-label', 'Previsualización');
    sec.setAttribute('data-i18n-aria-label', 'panels.panel5Label');

    sec.innerHTML = `
      <div class="panel-inner">
        <div class="preview-top">
          <h3 data-i18n="panel5.heading">Previsualización</h3>
          <p class="hint" data-i18n="panel5.hint">
            Aquí puedes ver el documento tal y como se exportará con los ajustes actuales.
          </p>
        </div>

        <div class="preview-toolbar" role="toolbar" aria-label="Controles de previsualización" data-i18n-aria-label="panel5.toolbar.aria">
          <button id="pvZoomOut" type="button" class="btn ghost pv-btn" aria-label="Alejar" data-i18n-aria-label="panel5.toolbar.zoomOutAria">−</button>
          <button id="pvZoomIn" type="button" class="btn ghost pv-btn" aria-label="Acercar" data-i18n-aria-label="panel5.toolbar.zoomInAria">+</button>

          <input id="pvZoomRange" class="pv-zoom-range" type="range" min="25" max="200" value="70"
                 aria-label="Zoom" data-i18n-aria-label="panel5.toolbar.zoomRangeAria">

          <span id="pvZoomLabel" class="pv-zoom-label">70%</span>

          <span class="pv-spacer"></span>

          <button id="pvFit" type="button" class="btn ghost pv-btn" data-i18n="panel5.toolbar.fit">Ajustar a ancho</button>
          <button id="pvActual" type="button" class="btn ghost pv-btn" data-i18n="panel5.toolbar.actual">100%</button>
          <button id="pvRefresh" type="button" class="btn pv-btn" data-i18n="panel5.toolbar.refresh">Actualizar</button>
        </div>

        <div id="previewViewport" class="preview-viewport"
             role="region"
             aria-label="Previsualización del documento"
             data-i18n-aria-label="panel5.viewportAria">

          <div id="previewSizer" class="preview-sizer">
            <div id="previewStage" class="preview-stage">
              <iframe
                id="previewFrame"
                class="preview-frame"
                title="Documento previsualizado"
                data-i18n-title="panel5.frameTitle"
                sandbox="allow-same-origin"
              ></iframe>
            </div>
          </div>

          <div id="previewStatus" class="preview-status" aria-live="polite" hidden></div>
        </div>
      </div>
    `;

    // Insertar al final (después del panel 4 normalmente)
    panels.appendChild(sec);
  }

  function ensureStepButton() {
    // Si ya existe, no hacemos nada.
    if (document.querySelector(STEP_SELECTOR)) return;

    const nav = document.querySelector('nav.steps');
    if (!nav) return;

    const btn = document.createElement('button');
    btn.className = 'step-btn';
    btn.setAttribute('data-target', '#panel5');
    btn.setAttribute('data-i18n', 'nav.step5');
    btn.textContent = '5. Previsualización';

    nav.appendChild(btn);
  }

  function injectStylesOnce() {
    if (document.getElementById('ef-preview-css')) return;

    const st = document.createElement('style');
    st.id = 'ef-preview-css';
    st.textContent = `
      /* ====== Steps (soporta 5+ pasos en móvil) ====== */
      nav.steps{
        overflow-x: auto;
        -webkit-overflow-scrolling: touch;
      }
      nav.steps .step-btn{
        white-space: nowrap;
      }

      /* ========== Panel 5 (Previsualización) ========== */

      .preview-top h3{
        margin: 0 0 6px;
      }

      .preview-toolbar{
        display:flex;
        flex-wrap:wrap;
        gap:10px;
        align-items:center;
        margin: 10px 0 12px;
      }

      .preview-toolbar .pv-spacer{
        flex: 1 1 auto;
        min-width: 10px;
      }

      .pv-zoom-range{
        width: 220px;
        max-width: 100%;
      }

      .pv-zoom-label{
        font-variant-numeric: tabular-nums;
        opacity: 0.9;
        min-width: 52px;
        text-align: right;
      }

      .preview-viewport{
        position: relative;
        height: min(72vh, 820px);
        border-radius: 14px;
        overflow: auto;
        background: rgba(0,0,0,0.22);
        border: 1px solid rgba(255,255,255,0.08);
        padding: 12px;
      }

      .preview-sizer{
        position: relative;
        width: 1px;
        height: 1px;
        overflow: hidden; /* evita que el iframe (absoluto) afecte al scroll */
      }

      .preview-stage{
        position: absolute;
        top: 0;
        left: 0;
        transform-origin: 0 0;
        will-change: transform;
      }

      .preview-frame{
        display:block;
        border: 0;
        background: transparent;
        pointer-events: none; /* scroll y gestos sobre el viewport */
      }

      .preview-status{
        position:absolute;
        right: 12px;
        bottom: 12px;
        padding: 10px 12px;
        border-radius: 12px;
        background: rgba(0,0,0,0.55);
        border: 1px solid rgba(255,255,255,0.10);
        backdrop-filter: blur(8px);
        -webkit-backdrop-filter: blur(8px);
        font-size: 12px;
        line-height: 1.35;
        max-width: min(520px, calc(100% - 24px));
      }

      .preview-status[data-busy="1"]{
        opacity: 0.95;
      }

      @media (max-width: 640px){
        .preview-viewport{
          height: 62vh;
          padding: 10px;
        }
        .pv-zoom-range{
          flex: 1 1 180px;
        }
        .preview-toolbar .pv-spacer{
          display:none;
        }
      }
    `;
    document.head.appendChild(st);
  }

  function cacheElements() {
    const panel = byId(PANEL_ID);
    const viewport = byId('previewViewport');
    const sizer = byId('previewSizer');
    const stage = byId('previewStage');
    const frame = byId('previewFrame');
    const status = byId('previewStatus');

    const zoomOut = byId('pvZoomOut');
    const zoomIn = byId('pvZoomIn');
    const zoomRange = byId('pvZoomRange');
    const zoomLabel = byId('pvZoomLabel');
    const fit = byId('pvFit');
    const actual = byId('pvActual');
    const refresh = byId('pvRefresh');

    if (!panel || !viewport || !sizer || !stage || !frame || !status ||
        !zoomOut || !zoomIn || !zoomRange || !zoomLabel || !fit || !actual || !refresh) {
      els = null;
      return;
    }

    els = {
      panel,
      viewport,
      sizer,
      stage,
      frame,
      status,
      zoomOut,
      zoomIn,
      zoomRange,
      zoomLabel,
      fit,
      actual,
      refresh
    };
  }

  function setStatus(text, busy) {
    if (!els || !els.status) return;

    if (!text) {
      els.status.hidden = true;
      els.status.textContent = '';
      els.status.removeAttribute('data-busy');
      return;
    }

    els.status.hidden = false;
    els.status.textContent = String(text);
    if (busy) els.status.setAttribute('data-busy', '1');
    else els.status.removeAttribute('data-busy');
  }

  function updateZoomUI() {
    if (!els) return;
    const pct = Math.round(zoom * 100);
    els.zoomLabel.textContent = pct + '%';
    els.zoomRange.value = String(pct);
  }

  function applyZoomLayout(opts) {
    if (!els) return;
    const center = !!(opts && opts.center);

    els.stage.style.transform = `scale(${zoom})`;

    const w = Math.max(1, metrics.contentW);
    const h = Math.max(1, metrics.contentH);

    // El sizer define el tamaño real del "lienzo" (escalado)
    els.sizer.style.width = (w * zoom) + 'px';
    els.sizer.style.height = (h * zoom) + 'px';

    updateZoomUI();

    if (center) {
      centerViewport();
    }
  }

  function centerViewport() {
    if (!els) return;
    const vw = els.viewport.clientWidth;
    const vh = els.viewport.clientHeight;
    const cw = els.sizer.offsetWidth;
    const ch = els.sizer.offsetHeight;

    els.viewport.scrollTop = 0;

    if (cw > vw) {
      els.viewport.scrollLeft = Math.max(0, (cw - vw) / 2);
    } else {
      els.viewport.scrollLeft = 0;
    }

    if (ch <= vh) {
      els.viewport.scrollTop = 0;
    }
  }

  function computeFitZoom() {
    if (!els) return zoom;
    const avail = Math.max(240, els.viewport.clientWidth - 22); // padding aprox
    const pageW = Math.max(1, metrics.pageW || metrics.contentW || 800);
    return clamp(avail / pageW, ZOOM_MIN, ZOOM_MAX);
  }

  function injectPreviewDocStyles(doc) {
    if (!doc || !doc.head || doc.getElementById('ef-preview-doc-style')) return;

    const st = doc.createElement('style');
    st.id = 'ef-preview-doc-style';
    st.textContent = `
      body.print-root{
        background:#0b1020;
        padding: 18px;
      }
      .print-page{
        margin: 0 auto 18px;
        box-shadow: 0 18px 50px rgba(0,0,0,.45);
        border-radius: 10px;
        background:#fff;
      }
      @media print{
        body.print-root{ background:#fff; padding: 0; }
        .print-page{ margin: 0; box-shadow: none; border-radius: 0; }
      }
    `;
    doc.head.appendChild(st);
  }

  async function renderPreview(opts) {
    if (!els) return;
    if (!isPanelActive()) return;
    if (isRendering) return;

    const force = !!(opts && opts.force);

    if (!force && !dirty) return;

    // Dependencias
    if (typeof exportToPrintPDF !== 'function') {
      setStatus('exportToPrintPDF no disponible.', false);
      return;
    }

    // Estado global (app.js)
    if (typeof state === 'undefined' || !state) {
      setStatus(tr('panel5.status.error', 'No se ha podido generar la previsualización.'), false);
      return;
    }

    dirty = false;
    isRendering = true;

    setStatus(tr('panel5.status.loading', 'Generando previsualización…'), true);

    const frame = els.frame;

    // Asegurar que el iframe está listo
    const w = frame.contentWindow;
    if (!w || !w.document) {
      setStatus(tr('panel5.status.error', 'No se ha podido generar la previsualización.'), false);
      isRendering = false;
      return;
    }

    try {
      // Modo preview -> NO imprime
      // ✅ export.js (nuevo) devuelve Promise y espera a que carguen imágenes.
      await exportToPrintPDF(state, { mode: 'preview', targetWindow: w, silent: true });
    } catch (err) {
      console.error(err);
      setStatus(tr('panel5.status.error', 'No se ha podido generar la previsualización.'), false);
      isRendering = false;
      return;
    }

    // Esperar un par de frames para medir con layout ya aplicado
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

    try {
      const doc = w.document;

      // Estilos extra SOLO para previsualización (fondo + sombras)
      injectPreviewDocStyles(doc);

      const body = doc.body;
      const root = doc.documentElement;

      const contentW = Math.max(body.scrollWidth, root.scrollWidth);
      const contentH = Math.max(body.scrollHeight, root.scrollHeight);

      // Tamaño real del iframe = tamaño real del documento (sin scroll interno)
      frame.style.width = contentW + 'px';
      frame.style.height = contentH + 'px';

      const page = doc.querySelector('.print-page');
      const pageW = page ? page.getBoundingClientRect().width : contentW;

      metrics = { contentW, contentH, pageW };

      // Zoom inicial
      if (zoomMode === 'fit') {
        zoom = computeFitZoom();
      } else if (zoomMode === 'auto') {
        const fit = computeFitZoom();
        const isSmall = els.viewport.clientWidth < 560;
        zoom = isSmall ? fit : Math.min(0.70, fit);
        zoomMode = 'manual';
      }

      applyZoomLayout({ center: true });

      // Mensaje breve de OK
      setStatus(tr('panel5.status.ready', 'Previsualización actualizada.'), false);
      setTimeout(() => {
        if (isPanelActive()) setStatus('', false);
      }, 900);
    } finally {
      isRendering = false;
    }
  }

  function markDirtyAndMaybeRender() {
    dirty = true;
    if (isPanelActive()) scheduleRender();
  }

  function scheduleRender() {
    if (!isPanelActive()) return;
    if (renderTimer) clearTimeout(renderTimer);
    renderTimer = setTimeout(() => {
      renderPreview({ force: true });
    }, DEBOUNCE_MS);
  }

  function setZoomManual(newZoom, center) {
    zoomMode = 'manual';
    zoom = clamp(newZoom, ZOOM_MIN, ZOOM_MAX);
    applyZoomLayout({ center: !!center });
  }

  function bindControls() {
    if (!els) return;

    els.zoomOut.addEventListener('click', () => {
      setZoomManual(zoom / 1.12, false);
    });

    els.zoomIn.addEventListener('click', () => {
      setZoomManual(zoom * 1.12, false);
    });

    els.zoomRange.addEventListener('input', () => {
      const pct = Number(els.zoomRange.value);
      if (!Number.isFinite(pct)) return;
      setZoomManual(pct / 100, false);
    });

    els.fit.addEventListener('click', () => {
      zoomMode = 'fit';
      zoom = computeFitZoom();
      applyZoomLayout({ center: true });
    });

    els.actual.addEventListener('click', () => {
      setZoomManual(1, true);
    });

    els.refresh.addEventListener('click', () => {
      dirty = true;
      renderPreview({ force: true });
    });

    // Si el usuario cambia tamaño de ventana y está en "fit", recalculamos
    window.addEventListener('resize', () => {
      if (!isPanelActive()) return;
      if (zoomMode !== 'fit') return;
      zoom = computeFitZoom();
      applyZoomLayout({ center: false });
    });
  }

  function hookSaveState() {
    if (typeof window.saveState !== 'function') return;
    if (window.saveState.__efPreviewHooked) return;

    const original = window.saveState;

    function wrappedSaveState() {
      original.apply(this, arguments);
      markDirtyAndMaybeRender();
    }

    wrappedSaveState.__efPreviewHooked = true;
    wrappedSaveState.__efPreviewOriginal = original;

    window.saveState = wrappedSaveState;
  }

  function hookI18nChange() {
    if (window.i18n && typeof window.i18n.onChange === 'function') {
      try {
        window.i18n.onChange(() => {
          markDirtyAndMaybeRender();
        });
      } catch {
        /* ignore */
      }
    }
  }

  function bindStepActivation() {
    // Cuando el usuario entra al panel 5, renderizamos.
    document.querySelectorAll(STEP_SELECTOR).forEach((btn) => {
      btn.addEventListener('click', () => {
        dirty = true;
        // Esperar un tick para que app.js marque el panel como active
        setTimeout(() => renderPreview({ force: true }), 0);
      });
    });
  }

  // ======================================================================
  // Rich content (Panel 3): SOLO imágenes
  //
  // Marcadores soportados en el texto:
  //   - [img:<id>] -> imagen (asset en IndexedDB)
  //
  // Nota:
  // - Las imágenes NO se guardan en el JSON; se almacenan localmente en IndexedDB
  //   para no reventar el límite de LocalStorage.
  // - export.js debe leer estas imágenes y maquetarlas en su sitio.
  // ======================================================================

  const EF_RICH_DB_NAME = 'ensaYOnesaAssets';
  const EF_RICH_DB_VERSION = 1;
  const EF_RICH_STORE_IMAGES = 'images';

  const EF_RE_IMG_BLOCK = /^\[img:([a-zA-Z0-9_-]+)\]$/;

  let _efDbPromise = null;
  let _efImageInput = null;

  function efOpenDB() {
    if (_efDbPromise) return _efDbPromise;

    _efDbPromise = new Promise((resolve, reject) => {
      try {
        if (!('indexedDB' in window)) {
          reject(new Error('indexedDB not supported'));
          return;
        }

        const req = indexedDB.open(EF_RICH_DB_NAME, EF_RICH_DB_VERSION);

        req.onupgradeneeded = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains(EF_RICH_STORE_IMAGES)) {
            db.createObjectStore(EF_RICH_STORE_IMAGES, { keyPath: 'id' });
          }
        };

        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error || new Error('IDB open error'));
      } catch (err) {
        reject(err);
      }
    });

    return _efDbPromise;
  }

  async function efPutImage(record) {
    const db = await efOpenDB();

    return new Promise((resolve, reject) => {
      const tx = db.transaction(EF_RICH_STORE_IMAGES, 'readwrite');
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error || new Error('IDB tx error'));

      const store = tx.objectStore(EF_RICH_STORE_IMAGES);
      store.put(record);
    });
  }

  async function efGetImage(id) {
    const db = await efOpenDB();

    return new Promise((resolve, reject) => {
      const tx = db.transaction(EF_RICH_STORE_IMAGES, 'readonly');
      const store = tx.objectStore(EF_RICH_STORE_IMAGES);

      const req = store.get(id);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error || new Error('IDB get error'));
    });
  }

  function efCreateId() {
    try {
      if (window.crypto && typeof window.crypto.randomUUID === 'function') {
        return 'img_' + window.crypto.randomUUID().replace(/-/g, '');
      }
    } catch {
      /* ignore */
    }

    const rnd = () => Math.floor(Math.random() * 1e9).toString(36);
    return 'img_' + Date.now().toString(36) + '_' + rnd() + rnd();
  }

  function efDispatchInput(ta) {
    try {
      ta.dispatchEvent(new Event('input', { bubbles: true }));
    } catch {
      /* ignore */
    }
  }

  function efInsertAtSelection(ta, insert, cursorOffset) {
    if (!ta) return;

    const value = String(ta.value ?? '');
    const start = ta.selectionStart;
    const end = ta.selectionEnd;

    const scrollTop = ta.scrollTop;

    let s = (start == null) ? value.length : start;
    let e = (end == null) ? value.length : end;

    try {
      ta.setRangeText(insert, s, e, 'end');
    } catch {
      ta.value = value.slice(0, s) + insert + value.slice(e);
      const pos = s + insert.length;
      ta.selectionStart = ta.selectionEnd = pos;
    }

    if (typeof cursorOffset === 'number' && Number.isFinite(cursorOffset)) {
      const base = s + cursorOffset;
      try {
        ta.selectionStart = ta.selectionEnd = Math.max(0, Math.min(ta.value.length, base));
      } catch {
        /* ignore */
      }
    }

    ta.scrollTop = scrollTop;
    efDispatchInput(ta);
  }

  function efMkToolbarBtn(txt, titleKey, titleFallback, onClick, styleObj) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = txt;

    // Title traducible (app.js refresca toolbars si data-i18n-title-key existe)
    b.title = tr(titleKey, titleFallback);
    b.dataset.i18nTitleKey = titleKey;
    b.dataset.i18nTitleFallback = titleFallback;

    // Estilo consistente con la toolbar original
    b.style.padding = '4px 8px';
    b.style.border = '1px solid rgba(0,0,0,0.2)';
    b.style.borderRadius = '8px';
    b.style.background = '#fff';
    b.style.cursor = 'pointer';
    b.style.fontSize = '13px';
    b.style.lineHeight = '1';

    if (styleObj && typeof styleObj === 'object') {
      try { Object.assign(b.style, styleObj); } catch { /* ignore */ }
    }

    b.addEventListener('click', (e) => {
      e.preventDefault();
      try { onClick(); } catch (err) { console.error(err); }
    });

    return b;
  }

  async function efPickImageFile() {
    return new Promise((resolve) => {
      if (!_efImageInput) {
        _efImageInput = document.createElement('input');
        _efImageInput.type = 'file';
        _efImageInput.accept = 'image/*';
        _efImageInput.style.position = 'fixed';
        _efImageInput.style.left = '-9999px';
        _efImageInput.style.width = '1px';
        _efImageInput.style.height = '1px';
        _efImageInput.style.opacity = '0';
        document.body.appendChild(_efImageInput);
      }

      _efImageInput.value = '';

      _efImageInput.onchange = () => {
        const file = (_efImageInput.files && _efImageInput.files[0]) ? _efImageInput.files[0] : null;
        resolve(file);
      };

      _efImageInput.click();
    });
  }

  async function efMeasureImageBlob(blob) {
    // Devuelve { w, h } o null
    try {
      if (!blob) return null;

      // createImageBitmap es rápido y evita insertar <img> en DOM
      if (typeof createImageBitmap === 'function') {
        const bmp = await createImageBitmap(blob);
        const w = bmp.width || 0;
        const h = bmp.height || 0;
        try { bmp.close(); } catch { /* ignore */ }
        if (w > 0 && h > 0) return { w, h };
      }

      // fallback: <img>
      const url = URL.createObjectURL(blob);
      const img = new Image();
      const size = await new Promise((resolve) => {
        let done = false;
        const finish = (ok) => {
          if (done) return;
          done = true;
          resolve(ok ? { w: img.naturalWidth || 0, h: img.naturalHeight || 0 } : null);
        };
        img.onload = () => finish(true);
        img.onerror = () => finish(false);
        img.src = url;
        setTimeout(() => finish(false), 2500);
      });
      try { URL.revokeObjectURL(url); } catch { /* ignore */ }
      return size;
    } catch {
      return null;
    }
  }

  async function efInsertImageMarker(ta) {
    const file = await efPickImageFile();
    if (!file) return;

    const mime = String(file.type || '');
    if (!mime.startsWith('image/')) {
      alert(tr('panel3.rich.imageNotSupported', 'El archivo seleccionado no parece una imagen.'));
      return;
    }

    const id = efCreateId();

    let size = null;
    try {
      size = await efMeasureImageBlob(file);
    } catch {
      size = null;
    }

    try {
      await efPutImage({
        id,
        blob: file,
        name: file.name || id,
        type: mime || 'image/*',
        width: size?.w || undefined,
        height: size?.h || undefined,
        createdAt: new Date().toISOString()
      });
    } catch (err) {
      console.error(err);
      alert(tr('panel3.rich.imageStoreError', 'No se ha podido guardar la imagen en este navegador.'));
      return;
    }

    // Insertar como bloque entre párrafos
    const marker = `\n\n[img:${id}]\n\n`;
    efInsertAtSelection(ta, marker);

    ta.focus();
  }

  function efEnhanceInlineFmtToolbars() {
    const toolbars = Array.from(document.querySelectorAll('.inline-fmt-toolbar'));
    if (toolbars.length === 0) return false;

    toolbars.forEach((tb) => {
      if (!tb || tb.dataset.efRichBound === '1') return;

      const ta = tb.nextElementSibling;
      if (!ta || ta.tagName !== 'TEXTAREA') return;

      tb.dataset.efRichBound = '1';

      const hint = tb.querySelector('[data-i18n-key="panel3.inlineFmt.hint"]') || tb.lastElementChild;

      const isContenido = (ta.id === 'contenidoTexto');
      if (!isContenido) return;

      // Separador
      const sep = document.createElement('span');
      sep.textContent = '•';
      sep.style.opacity = '0.35';
      sep.style.margin = '0 4px';

      if (hint && hint.parentNode === tb) tb.insertBefore(sep, hint);
      else tb.appendChild(sep);

      const btnImg = efMkToolbarBtn(
        '🖼️',
        'panel3.rich.imageButton',
        'Insertar imagen',
        () => { efInsertImageMarker(ta); },
        { fontSize: '14px' }
      );

      if (hint && hint.parentNode === tb) {
        tb.insertBefore(btnImg, hint);
      } else {
        tb.appendChild(btnImg);
      }
    });

    return true;
  }

  function efInstallImagePlugin() {
    if (efInstallImagePlugin._done) return;
    efInstallImagePlugin._done = true;

    const attempt = () => efEnhanceInlineFmtToolbars();

    attempt();

    document.addEventListener('DOMContentLoaded', () => {
      attempt();
      setTimeout(attempt, 0);
    });
  }

  function init() {
    ensureStepButton();
    ensurePanelMarkup();
    injectStylesOnce();
    cacheElements();

    // Hooks
    hookSaveState();
    hookI18nChange();

    // ✅ Solo imágenes: botón + guardado en IndexedDB
    efInstallImagePlugin();

    if (!els) return;

    // Evitar dobles listeners si init se ejecuta más de una vez
    if (els.panel && els.panel.dataset && els.panel.dataset.efPreviewBound === '1') {
      return;
    }
    if (els.panel && els.panel.dataset) {
      els.panel.dataset.efPreviewBound = '1';
    }

    bindControls();
    bindStepActivation();

    updateZoomUI();
  }

  // Defer scripts se ejecutan tras parsear el HTML y antes de DOMContentLoaded.
  try { init(); } catch (e) { console.error(e); }

  // Por si algún binding global (p.ej. saveState) aún no está listo
  document.addEventListener('DOMContentLoaded', () => {
    try { init(); } catch { /* ignore */ }
  });
})();