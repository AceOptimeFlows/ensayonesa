/* dictado.js — ensaYOnesa
 * Dictado por voz (Web Speech API)
 * Objetivos:
 *  - UI: mic + stop + indicador (inyectados en cada field)
 *  - Anti-duplicados REAL (iOS + Android):
 *      - NO dependemos de índices de resultados
 *      - Añadimos solo el “tail” nuevo usando solapamiento por palabras
 *      - Filtro anti-repetición por ventana de tiempo
 *  - ✅ Idioma de dictado configurable (12 idiomas) vía localStorage + evento
 *
 * Mejora compatibilidad (AYN Thor / Android handhelds):
 *  - Fallback: si el motor NO marca isFinal, hacemos commit del interim en speechend/end/debounce
 *  - Mejor diagnóstico: errores mapeados + debug opcional por localStorage / querystring
 *  - Detección WebView (frecuente: SpeechRecognition "existe" pero no devuelve results)
 */

(() => {
  'use strict';

  const DICTADO_VERSION = 'dictado.js@2025-12-23a';

  /* ===== i18n local (NO depende de app.js) ===== */
  function tt(key, fallback = '', vars){
    try{
      if(window.i18n && typeof window.i18n.t === 'function'){
        const val = window.i18n.t(key, vars);
        if(val != null && val !== '') return val;
      }
    }catch(_){}
    return fallback;
  }

  /* ===== Idiomas (app → SpeechRecognition) ===== */
  const DICTATION_LANG_KEY = 'ensaYOnesa:dictLang';

  const APP_LANGS = [
    'es','en','pt-br','it','fr','de','ko','zh','ja','ru','hi','ar'
  ];

  function normalizeAppLang(raw){
    const s = String(raw || '').trim().toLowerCase().replace('_','-');
    if(!s) return null;
    if(APP_LANGS.includes(s)) return s;

    const primary = s.split('-')[0];
    if(APP_LANGS.includes(primary)) return primary;

    // cercanos:
    if(primary === 'pt') return 'pt-br';
    if(primary === 'zh') return 'zh';

    return null;
  }

  // Mapping recomendado (BCP-47)
  const SPEECH_LANG_BY_APP_LANG = {
    'es': 'es-ES',
    'en': 'en-US',
    'pt-br': 'pt-BR',
    'it': 'it-IT',
    'fr': 'fr-FR',
    'de': 'de-DE',
    'ko': 'ko-KR',
    'zh': 'zh-CN',
    'ja': 'ja-JP',
    'ru': 'ru-RU',
    'hi': 'hi-IN',
    'ar': 'ar-SA'
  };

  function getStoredDictationAppLang(){
    try{
      const v = localStorage.getItem(DICTATION_LANG_KEY);
      const n = normalizeAppLang(v);
      if(n) return n;
    }catch(_){}
    return 'es';
  }

  function toSpeechLang(appLang){
    const n = normalizeAppLang(appLang) || 'es';
    return SPEECH_LANG_BY_APP_LANG[n] || SPEECH_LANG_BY_APP_LANG.es;
  }

  /* ===== Soporte Speech API ===== */
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const HAS_SPEECH = typeof SpeechRecognition === 'function';

  let activeDictation = null;
  const INSTANCES = new Set();

  /* ===== Debug (opcional) =====
   * Activa logs poniendo:
   *   localStorage.setItem('ensaYOnesa:dictDebug','1'); location.reload();
   * o añadiendo:
   *   ?dictDebug=1
   */
  const DEBUG_KEY = 'ensaYOnesa:dictDebug';

  function _qp(name){
    try{
      const sp = new URLSearchParams(location.search || '');
      return sp.get(name);
    }catch(_){}
    return null;
  }

  function isDebugEnabled(){
    // localStorage
    try{
      const v = localStorage.getItem(DEBUG_KEY);
      if(v === '1' || v === 'true' || v === 'yes') return true;
    }catch(_){}

    // querystring
    const q = String(_qp('dictDebug') || '').toLowerCase();
    if(q === '1' || q === 'true' || q === 'yes') return true;

    return false;
  }

  function dlog(...args){
    if(!isDebugEnabled()) return;
    try{ console.log('[dictado]', ...args); }catch(_){}
  }

  /* ===== Entorno: detectar WebView / condiciones típicas ===== */
  function getEnv(){
    const ua = String(navigator.userAgent || '');
    const isAndroid = /Android/i.test(ua);
    const isSecure = !!window.isSecureContext;

    // Heurísticas típicas: token "wv" + "Version/x.y" en Android WebView
    // (OJO: si alguna app overridea UA, puede fallar)
    const isWebView =
      /\bwv\b/i.test(ua) ||
      /Android\s.*Version\/\d+/i.test(ua) ||
      /; wv\)/i.test(ua);

    const isChromeLike = /Chrome\/\d+/i.test(ua) && !/EdgA\/\d+/i.test(ua);
    const isEdge = /EdgA\/\d+/i.test(ua);
    const isFirefox = /Firefox\/\d+/i.test(ua);

    return {
      version: DICTADO_VERSION,
      ua,
      isAndroid,
      isWebView,
      isSecureContext: isSecure,
      protocol: String(location.protocol || ''),
      isChromeLike,
      isEdge,
      isFirefox
    };
  }

  function speechErrorUserMessage(code){
    const c = String(code || 'unknown');
    switch(c){
      case 'no-speech':
        return tt('dictation.error.noSpeech',
          'No se detectó voz. Acércate al micrófono e inténtalo otra vez.');
      case 'audio-capture':
        return tt('dictation.error.audioCapture',
          'No se pudo acceder al micrófono. Comprueba permisos y que no lo esté usando otra app.');
      case 'not-allowed':
        return tt('dictation.error.notAllowed',
          'Permiso de micrófono denegado o bloqueado por el navegador.');
      case 'service-not-allowed':
        return tt('dictation.error.serviceNotAllowed',
          'El servicio de reconocimiento de voz no está disponible en este dispositivo/navegador.');
      case 'network':
        return tt('dictation.error.network',
          'Error de red en el dictado. Verifica tu conexión.');
      case 'language-not-supported':
        return tt('dictation.error.languageNotSupported',
          'El idioma de dictado no está soportado en este dispositivo.');
      case 'bad-grammar':
        return tt('dictation.error.badGrammar',
          'Error interno de dictado (bad-grammar).');
      default:
        return tt('dictation.error.generic', 'Error en dictado.');
    }
  }

  /* ===== Helpers ===== */
  function normSpaces(s){
    return String(s || '').replace(/\s+/g, ' ').trim();
  }
  function normLower(s){
    return normSpaces(s).toLocaleLowerCase();
  }
  function splitWordsPreserve(s){
    const x = normSpaces(s);
    return x ? x.split(' ').filter(Boolean) : [];
  }
  function splitWordsLower(s){
    return splitWordsPreserve(s).map(w => w.toLocaleLowerCase());
  }

  function startsWithPunctuationOrSpace(s){
    return /^[\s,.;:!?¿¡)\]\}]/.test(String(s || ''));
  }

  function setRangeTextSafe(el, insertText, start, end){
    const value = String(el.value || '');
    const before = value.slice(0, start);
    const after  = value.slice(end);

    try{
      el.setRangeText(insertText, start, end, 'end');
    }catch{
      el.value = before + insertText + after;
    }
  }

  function capitalizeFirstMeaningfulChar(s){
    const txt = normSpaces(s);
    if(!txt) return '';
    try{
      const m = txt.match(/^([^\p{L}]*)(\p{L})([\s\S]*)$/u);
      if(m){
        return m[1] + m[2].toLocaleUpperCase() + m[3];
      }
    }catch(_){}
    return txt.charAt(0).toLocaleUpperCase() + txt.slice(1);
  }

  function cssEscapeSafe(s){
    if(window.CSS && typeof window.CSS.escape === 'function'){
      return window.CSS.escape(String(s));
    }
    return String(s).replace(/[^a-zA-Z0-9_-]/g, '\\$&');
  }

  /* ===== Overlap (clave anti-duplicado) ===== */
  function overlapSuffixPrefixWords(aLower, bLower, maxLookback = 45){
    const aLen = aLower.length;
    const bLen = bLower.length;
    if(aLen === 0 || bLen === 0) return 0;

    const aStart = Math.max(0, aLen - maxLookback);
    const aTail = aLower.slice(aStart);
    const A = aTail.length;

    const maxK = Math.min(A, bLen);
    for(let k = maxK; k >= 1; k--){
      let ok = true;
      for(let i = 0; i < k; i++){
        if(aTail[A - k + i] !== bLower[i]){
          ok = false;
          break;
        }
      }
      if(ok) return k;
    }
    return 0;
  }

  /* ===== Estilos UI inyectados ===== */
  function ensureVoiceControlsStyles(){
    if(document.getElementById('voice-controls-style')) return;

    const st = document.createElement('style');
    st.id = 'voice-controls-style';
    st.textContent = `
/* ===== Voice controls injected styles ===== */
.voice-head{
  display:flex !important;
  align-items:center !important;
  justify-content:space-between !important;
  gap:10px !important;
  flex-wrap:wrap !important;
  max-width:100% !important;
  box-sizing:border-box !important;
}
.voice-head > label{
  flex: 1 1 auto !important;
  min-width: 0 !important;
}

.voice-controls{
  display:flex !important;
  align-items:center !important;
  justify-content:flex-end !important;
  gap:8px !important;
  flex-wrap:wrap !important;
  max-width:100% !important;
  box-sizing:border-box !important;
  margin-left:auto !important;
}

.voice-controls .btn-icon{
  display:inline-flex !important;
  align-items:center !important;
  justify-content:center !important;

  width:34px !important;
  height:34px !important;
  min-width:34px !important;
  min-height:34px !important;

  padding:0 !important;
  line-height:1 !important;
  vertical-align:middle !important;
  box-sizing:border-box !important;
}

.voice-controls .voice-indicator{
  display:inline-block !important;
  width:10px !important;
  height:10px !important;
  min-width:10px !important;
  min-height:10px !important;
  border-radius:999px !important;
  box-sizing:border-box !important;
  opacity:.75 !important;

  /* Colores (mejor diagnóstico visual) */
  background: #9aa0a6 !important; /* idle */
}
.voice-controls .voice-indicator[data-state="listening"]{
  opacity:1 !important;
  background: #34a853 !important;
}
.voice-controls .voice-indicator[data-state="error"]{
  opacity:1 !important;
  background: #ea4335 !important;
}

.voice-controls .voice-message{
  font-size:12px !important;
  line-height:1.2 !important;
  opacity:.75 !important;
  max-width: 38ch !important;
  overflow:hidden !important;
  text-overflow: ellipsis !important;
  white-space: nowrap !important;
}
.voice-controls .voice-message[data-kind="error"]{
  opacity: 0.95 !important;
}
`;
    document.head.appendChild(st);
  }

  /* ===== Markup UI por campo ===== */
  function ensureVoiceControlsMarkup(forId){
    ensureVoiceControlsStyles();

    const el = document.getElementById(forId);
    if(!el) return null;

    let wrap = document.querySelector(`.voice-controls[data-for="${cssEscapeSafe(forId)}"]`);

    if(!wrap){
      wrap = document.createElement('div');
      wrap.className = 'voice-controls';
      wrap.dataset.for = forId;

      const field = el.closest('.field') || el.parentElement;
      const label =
        (field && field.querySelector(`label[for="${cssEscapeSafe(forId)}"]`)) ||
        (field && field.querySelector('label')) ||
        null;

      let head = field ? field.querySelector('.field-head') : null;

      if(field && !head && !field.classList.contains('inline')){
        head = document.createElement('div');
        head.className = 'field-head';
        if(label) head.appendChild(label);
        field.insertBefore(head, field.firstChild);
      }else if(head && label && !head.contains(label) && !field?.classList.contains('inline')){
        head.insertBefore(label, head.firstChild);
      }

      if(head){
        head.classList.add('voice-head');
        head.appendChild(wrap);
      }else if(field && label){
        label.insertAdjacentElement('afterend', wrap);
      }else if(field){
        field.insertBefore(wrap, el);
      }else{
        el.insertAdjacentElement('afterend', wrap);
      }
    }else{
      const maybeHead = wrap.closest('.field-head');
      if(maybeHead) maybeHead.classList.add('voice-head');
    }

    let btnStart = wrap.querySelector('button[data-action="start"]');
    if(!btnStart){
      btnStart = document.createElement('button');
      btnStart.type = 'button';
      btnStart.className = 'btn-icon';
      btnStart.dataset.action = 'start';
      btnStart.title = tt('dictation.controls.start', 'Iniciar dictado');
      btnStart.setAttribute('aria-label', tt('dictation.controls.start', 'Iniciar dictado'));
      btnStart.textContent = '🎙️';
      wrap.appendChild(btnStart);
    }

    let btnStop = wrap.querySelector('button[data-action="stop"]');
    if(!btnStop){
      btnStop = document.createElement('button');
      btnStop.type = 'button';
      btnStop.className = 'btn-icon';
      btnStop.dataset.action = 'stop';
      btnStop.title = tt('dictation.controls.pause', 'Parar dictado');
      btnStop.setAttribute('aria-label', tt('dictation.controls.pause', 'Parar dictado'));
      btnStop.textContent = '⏹️';
      wrap.appendChild(btnStop);
    }

    let ind = wrap.querySelector('.voice-indicator');
    if(!ind){
      ind = document.createElement('span');
      ind.className = 'voice-indicator';
      ind.dataset.state = 'idle';
      wrap.appendChild(ind);
    }else{
      ind.dataset.state ||= 'idle';
    }

    let msg = wrap.querySelector('.voice-message');
    if(!msg){
      msg = document.createElement('span');
      msg.className = 'voice-message';
      msg.dataset.kind = 'hint';
      msg.textContent = '';
      wrap.appendChild(msg);
    }

    return wrap;
  }

  /* ===== VoiceDictation ===== */
  class VoiceDictation {
    constructor(forId){
      const el = document.getElementById(forId);
      if(!el) return;

      // evitar doble init por campo
      if(el.dataset.voiceDictationInit === '1') return;
      el.dataset.voiceDictationInit = '1';

      this.el = el;
      this.wrap = ensureVoiceControlsMarkup(forId);
      if(!this.wrap) return;

      this.btnStart = this.wrap.querySelector('button[data-action="start"]');
      this.btnStop  = this.wrap.querySelector('button[data-action="stop"]');
      this.ind      = this.wrap.querySelector('.voice-indicator');
      this.msg      = this.wrap.querySelector('.voice-message');

      if(!this.btnStart || !this.btnStop || !this.ind) return;

      // registrar instancia
      INSTANCES.add(this);

      this._env = getEnv();
      this._sessionId = 0;

      // contadores de eventos (debug)
      this._stats = {
        start:0, end:0, result:0, error:0,
        audioStart:0, soundStart:0, speechStart:0,
        nomatch:0
      };

      if(!HAS_SPEECH){
        this.btnStart.disabled = true;
        this.btnStop.disabled = true;
        this.setState('idle');
        this.setMessage(tt('dictation.status.notSupported', 'Dictado no soportado por este navegador'), 'error');
        return;
      }

      // Si esto es WebView (muy frecuente en handhelds/launchers), normalmente NO va a devolver results.
      // Mejor avisar claramente.
      if(this._env.isAndroid && this._env.isWebView){
        this.btnStart.disabled = true;
        this.btnStop.disabled  = true;
        this.setState('idle');
        this.setMessage(
          tt(
            'dictation.status.webviewUnsupported',
            'Dictado no disponible en WebView. Abre la app en Chrome/Edge para transcribir.'
          ),
          'error'
        );
        this.ind.title = this.msg.textContent || '';
        return;
      }

      // Secure context (por si se abre desde http/file)
      if(!this._env.isSecureContext && this._env.protocol !== 'https:'){
        this.btnStart.disabled = true;
        this.btnStop.disabled  = true;
        this.setState('idle');
        this.setMessage(
          tt(
            'dictation.status.needsHttps',
            'El dictado necesita HTTPS (contexto seguro).'
          ),
          'error'
        );
        this.ind.title = this.msg.textContent || '';
        return;
      }

      this.rec = this._createRecognizer();
      if(!this.rec){
        this.btnStart.disabled = true;
        this.btnStop.disabled = true;
        this.setState('idle');
        this.setMessage(tt('dictation.status.notSupported', 'Dictado no soportado por este navegador'), 'error');
        return;
      }

      // ✅ idioma de dictado configurable
      this._applyDictationLangFromStorage();

      this._keepAlive = false;

      // anti repetición por ventana de tiempo
      this._lastFinalNorm = '';
      this._lastFinalAt = 0;

      // cache de finals recientes (por si el engine re-dispara)
      this._recentFinals = []; // [{t, norm}]

      // guard tras restart
      this._restartGuardUntil = 0;
      this._restartTimer = null;

      // ===== Fallback interim → final (para motores que no marcan isFinal) =====
      this._lastInterim = '';
      this._lastInterimNorm = '';
      this._lastInterimAt = 0;
      this._interimCommitTimer = null;

      // Debug / diagnóstico
      this._lastErrorCode = null;
      this._lastErrorMessage = '';
      this._lastErrorAt = 0;

      // Señales de vida (para detectar “arranca pero no devuelve nada”)
      this._gotAnyResult = false;
      this._gotAudioStart = false;
      this._gotSoundStart = false;
      this._gotSpeechStart = false;

      this._watchdogNoAudio = null;
      this._watchdogNoResult = null;

      this.btnStart.addEventListener('click', ()=>this.start());
      this.btnStop.addEventListener('click',  ()=>this.stop());

      // estado inicial
      this.setState('idle');
      this.setMessage('', 'hint');
    }

    _createRecognizer(){
      try{
        const rec = new SpeechRecognition();

        // ✅ En móviles, continuous suele ser fuente de “rareza”.
        // Mejor: sesiones cortas y auto-restart.
        try{ rec.continuous = false; }catch(_){}
        try{ rec.interimResults = true; }catch(_){}
        try{ rec.maxAlternatives = 1; }catch(_){}

        rec.onstart = () => {
          this._stats.start++;
          this._gotAnyResult = false;
          this._gotAudioStart = false;
          this._gotSoundStart = false;
          this._gotSpeechStart = false;

          this._clearInterim();
          this._clearWatchdogs();

          this._sessionId++;
          this._armWatchdogs(this._sessionId);

          dlog('onstart', { speechLang: this._speechLang, appLang: this._dictationAppLang, env: this._env });
          this.setMessage('', 'hint');
          this.setState('listening');
        };

        rec.onaudiostart = () => {
          this._stats.audioStart++;
          this._gotAudioStart = true;
          dlog('onaudiostart');
        };

        rec.onsoundstart = () => {
          this._stats.soundStart++;
          this._gotSoundStart = true;
          dlog('onsoundstart');
        };

        rec.onspeechstart = () => {
          this._stats.speechStart++;
          this._gotSpeechStart = true;
          dlog('onspeechstart');
        };

        rec.onnomatch = () => {
          this._stats.nomatch++;
          dlog('onnomatch');
        };

        // Algunos navegadores disparan estos eventos; si existen, ayudan a “cerrar” el interim
        rec.onspeechend = () => {
          dlog('onspeechend');
          this._commitInterimIfNeeded('speechend');
        };

        rec.onend = () => {
          this._stats.end++;
          dlog('onend', { keepAlive: this._keepAlive });

          this._clearWatchdogs();

          // ✅ Si el motor no dio final pero sí interim, lo volcamos aquí
          this._commitInterimIfNeeded('end');

          if(this._keepAlive){
            this._restartGuardUntil = Date.now() + 1200;

            // Restart con delay (evita InvalidStateError en algunos móviles)
            clearTimeout(this._restartTimer);
            this._restartTimer = setTimeout(() => {
              if(!this._keepAlive) return;

              // antes de reiniciar, re-sincroniza idioma (por si cambió)
              this._applyDictationLangFromStorage();

              try { rec.start(); } catch(e) { dlog('restart start() failed', e); }
            }, 250);
          }else{
            this.setState('idle');
            if(activeDictation === this) activeDictation = null;
          }
        };

        rec.onerror = (e) => {
          this._stats.error++;

          const code = e && e.error ? String(e.error) : 'unknown';
          const msg  = e && e.message ? String(e.message) : '';

          this._lastErrorCode = code;
          this._lastErrorMessage = msg;
          this._lastErrorAt = Date.now();

          console.warn('[dictado] Speech error', e);
          dlog('onerror', { code, msg });

          // Si hay interim pendiente, intentamos salvarlo (mejor que perderlo)
          this._commitInterimIfNeeded('error');

          // 'no-speech' es común y no debería matar el keepAlive
          if(code === 'no-speech'){
            const m = speechErrorUserMessage(code);
            this.setMessage(m, 'hint');
            this.ind.title = m;
            // dejamos que onend reinicie si keepAlive está activo
            this.setState('listening');
            return;
          }

          // 'aborted' suele ser al parar
          if(code === 'aborted'){
            if(!this._keepAlive) this.setState('idle');
            return;
          }

          // resto de errores: marcamos error y paramos
          const m = speechErrorUserMessage(code);
          this.setMessage(m, 'error');
          this.ind.title = m;

          this.setState('error');
          this._keepAlive = false;
        };

        rec.onresult = (e) => {
          this._stats.result++;
          this._gotAnyResult = true;

          // Buscamos:
          //  - latestFinal: el final más reciente (si existe)
          //  - latestInterim: el interim más reciente (fallback)
          let latestFinal = '';
          let latestInterim = '';

          for(let i = e.results.length - 1; i >= 0; i--){
            const r = e.results[i];
            const t = normSpaces(r && r[0] ? (r[0].transcript || '') : '');
            if(!t) continue;

            if(r && r.isFinal){
              latestFinal = t;
              break;
            }else if(!latestInterim){
              latestInterim = t;
            }
          }

          if(latestFinal){
            dlog('final', latestFinal);
            this._clearInterim();
            this._handleFinal(latestFinal);
            return;
          }

          if(latestInterim){
            dlog('interim', latestInterim);
            this._updateInterim(latestInterim);
          }
        };

        return rec;
      }catch(e){
        console.warn('[dictado] SpeechRecognition no constructible', e);
        return null;
      }
    }

    _armWatchdogs(sessionId){
      // Si el recognizer "arranca" pero NO hay señales de audio/sonido/voz ni results,
      // en algunos Androids esto indica que el motor está roto o no soportado realmente.
      clearTimeout(this._watchdogNoAudio);
      clearTimeout(this._watchdogNoResult);

      this._watchdogNoAudio = setTimeout(() => {
        if(!this._keepAlive) return;
        if(this._sessionId !== sessionId) return;

        if(!this._gotAudioStart && !this._gotSoundStart && !this._gotSpeechStart){
          const msg = tt(
            'dictation.status.noAudioEvents',
            'El dictado arrancó pero no llegan eventos de audio. En este dispositivo/navegador puede no estar soportado.'
          );
          this.setMessage(msg, 'error');
          this.ind.title = msg;
          this.setState('error');
          this._keepAlive = false;
          try{ this.rec.stop(); }catch(_){}
        }
      }, 2600);

      // Si hay audio/voz pero no hay NI UN result, suele ser servicio roto/no disponible
      this._watchdogNoResult = setTimeout(() => {
        if(!this._keepAlive) return;
        if(this._sessionId !== sessionId) return;

        if(!this._gotAnyResult){
          const msg = tt(
            'dictation.status.noResults',
            'No se reciben resultados de dictado. Prueba Chrome/Edge o revisa el servicio de reconocimiento de voz del sistema.'
          );
          this.setMessage(msg, 'error');
          this.ind.title = msg;
          this.setState('error');
          this._keepAlive = false;
          try{ this.rec.stop(); }catch(_){}
        }
      }, 6500);
    }

    _clearWatchdogs(){
      clearTimeout(this._watchdogNoAudio);
      clearTimeout(this._watchdogNoResult);
      this._watchdogNoAudio = null;
      this._watchdogNoResult = null;
    }

    _applyDictationLangFromStorage(){
      const appLang = getStoredDictationAppLang();
      const speechLang = toSpeechLang(appLang);
      try{
        this.rec.lang = speechLang;
      }catch(_){
        // ignore
      }
      this._dictationAppLang = appLang;
      this._speechLang = speechLang;
    }

    setDictationLanguage(appLang){
      const n = normalizeAppLang(appLang) || getStoredDictationAppLang();
      const speechLang = toSpeechLang(n);

      try{
        this.rec.lang = speechLang;
      }catch(_){
        // ignore
      }

      this._dictationAppLang = n;
      this._speechLang = speechLang;

      // Si está dictando, reiniciamos para aplicar idioma
      if(this._keepAlive){
        try{ this.rec.stop(); }catch{}
      }
    }

    getLastError(){
      return {
        code: this._lastErrorCode,
        message: this._lastErrorMessage,
        at: this._lastErrorAt,
        appLang: this._dictationAppLang,
        speechLang: this._speechLang
      };
    }

    getStats(){
      return {
        ...this._stats,
        keepAlive: this._keepAlive,
        gotAnyResult: this._gotAnyResult,
        gotAudioStart: this._gotAudioStart,
        gotSoundStart: this._gotSoundStart,
        gotSpeechStart: this._gotSpeechStart,
        env: this._env
      };
    }

    _rememberFinal(norm){
      const now = Date.now();
      this._recentFinals.push({ t: now, norm });
      this._recentFinals = this._recentFinals.filter(x => now - x.t < 3000);
      if(this._recentFinals.length > 16){
        this._recentFinals = this._recentFinals.slice(this._recentFinals.length - 16);
      }
    }

    _seenFinalRecently(norm){
      const now = Date.now();
      return this._recentFinals.some(x => x.norm === norm && (now - x.t) < 1400);
    }

    _handleFinal(finalText){
      const now = Date.now();
      const finalNorm = normLower(finalText);
      if(!finalNorm) return;

      // 1) si el motor repite el mismo final varias veces seguidas
      if(finalNorm === this._lastFinalNorm && (now - this._lastFinalAt) < 2000){
        return;
      }

      // 2) repetición rápida (móviles)
      if(this._seenFinalRecently(finalNorm)){
        return;
      }

      // 3) si acabamos de reiniciar y ese final ya está al final del campo, no lo metas otra vez
      if(now < this._restartGuardUntil){
        const vNorm = normLower(this.el.value);
        if(vNorm && vNorm.endsWith(finalNorm)){
          this._lastFinalNorm = finalNorm;
          this._lastFinalAt = now;
          this._rememberFinal(finalNorm);
          return;
        }
      }

      this._lastFinalNorm = finalNorm;
      this._lastFinalAt = now;
      this._rememberFinal(finalNorm);

      this._appendSmart(finalText);
    }

    _appendSmart(finalText){
      const value = String(this.el.value || '');
      const valueTrim = value.trim();

      // capitalizar si el campo está vacío
      let candidate = normSpaces(finalText);
      if(!candidate) return;
      if(!valueTrim){
        candidate = capitalizeFirstMeaningfulChar(candidate);
      }

      // ✅ calcular “tail nuevo” por solapamiento
      const valueWordsLow = splitWordsLower(value);
      const candWords = splitWordsPreserve(candidate);
      const candWordsLow = candWords.map(w => w.toLocaleLowerCase());

      // Si ya termina igual, no hacer nada
      const vNorm = normLower(value);
      const cNorm = normLower(candidate);
      if(vNorm && cNorm && vNorm.endsWith(cNorm)){
        return;
      }

      const k = overlapSuffixPrefixWords(valueWordsLow, candWordsLow, 50);
      const remainderWords = candWords.slice(k);
      const remainder = remainderWords.join(' ').trim();

      if(!remainder) return;

      this._insertAtEnd(remainder);
    }

    _insertAtEnd(text){
      const value = String(this.el.value || '');
      const start = value.length;
      const end   = value.length;

      const needsSpace =
        value &&
        !/\s$/.test(value) &&
        !startsWithPunctuationOrSpace(text);

      const insertText = (needsSpace ? ' ' : '') + text;

      setRangeTextSafe(this.el, insertText, start, end);

      // notificar a los listeners de input (actualiza state.meta.* o state.content.*)
      this.el.dispatchEvent(new Event('input', { bubbles: true }));
    }

    setMessage(text, kind = 'hint'){
      if(!this.msg) return;
      const s = String(text || '');
      this.msg.textContent = s;
      this.msg.dataset.kind = kind;
    }

    setState(s){
      if(!this.ind) return;
      this.ind.dataset.state = s;

      if(s === 'listening'){
        this.btnStart.disabled = true;
        this.btnStop.disabled = false;
        const m = tt('dictation.status.listening', 'Captando voz');
        this.ind.title = m;
        if(!this.msg.textContent) this.setMessage('', 'hint');
      }else if(s === 'error'){
        this.btnStart.disabled = false;
        this.btnStop.disabled = true;
        if(!this.ind.title) this.ind.title = tt('dictation.status.error', 'Error en dictado');
      }else{
        this.btnStart.disabled = !HAS_SPEECH;
        this.btnStop.disabled = true;
        this.ind.title = HAS_SPEECH
          ? tt('dictation.status.idle', 'Inactivo')
          : tt('dictation.status.notSupportedShort', 'No soportado');
      }
    }

    _updateInterim(text){
      const t = normSpaces(text);
      const n = normLower(t);
      if(!n) return;

      this._lastInterim = t;
      this._lastInterimNorm = n;
      this._lastInterimAt = Date.now();

      // Fallback: si en ~1.3s no llega un final, volcamos el interim.
      clearTimeout(this._interimCommitTimer);
      this._interimCommitTimer = setTimeout(() => {
        if(!this._keepAlive) return;
        const age = Date.now() - this._lastInterimAt;
        if(this._lastInterim && age >= 1100){
          this._commitInterimIfNeeded('debounce');
        }
      }, 1300);
    }

    _clearInterim(){
      clearTimeout(this._interimCommitTimer);
      this._interimCommitTimer = null;
      this._lastInterim = '';
      this._lastInterimNorm = '';
      this._lastInterimAt = 0;
    }

    _commitInterimIfNeeded(reason){
      if(!this._lastInterim) return;

      const txt = this._lastInterim;
      const norm = this._lastInterimNorm || normLower(txt);
      const now = Date.now();

      this._clearInterim();

      if(!norm) return;

      // Si ya coincide con el último final reciente, no repetir
      if(norm === this._lastFinalNorm && (now - this._lastFinalAt) < 2500){
        return;
      }

      // Si el campo ya termina con ese texto, lo damos por “ya metido”
      const vNorm = normLower(this.el.value);
      if(vNorm && vNorm.endsWith(norm)){
        this._lastFinalNorm = norm;
        this._lastFinalAt = now;
        this._rememberFinal(norm);
        return;
      }

      dlog('commit interim → final', { reason, txt });
      this._handleFinal(txt);
    }

    start(){
      if(!HAS_SPEECH || !this.rec) return;

      // parar dictado activo si es otro
      if(activeDictation && activeDictation !== this){
        activeDictation.stop(true);
      }

      // foco al campo (mejor para móvil)
      try{ this.el.focus({ preventScroll: true }); }catch{ try{ this.el.focus(); }catch{} }

      // ✅ aplica idioma actual antes de iniciar
      this._applyDictationLangFromStorage();

      this._keepAlive = true;
      this._clearInterim();
      this._clearWatchdogs();

      this.setMessage('', 'hint');

      try{
        this.rec.start();
        activeDictation = this;
      }catch(e){
        dlog('start() failed', e);

        // si falla, intentamos recovery
        try{ this.rec.abort(); }catch(_){}
        try{ this.rec.start(); }catch(_){}

        activeDictation = this;
      }
    }

    stop(silent = false){
      // Antes de parar, intenta salvar interim si existe
      this._commitInterimIfNeeded('stop');

      this._keepAlive = false;
      clearTimeout(this._restartTimer);
      this._restartTimer = null;

      this._clearWatchdogs();

      try{ this.rec.stop(); }catch{}
      if(!silent) this.setState('idle');
      if(activeDictation === this) activeDictation = null;
    }
  }

  /* ===== Init público ===== */
 function initVoiceControlsPanel1(){
  ensureVoiceControlsStyles();

  const ids = [
    'titulo',
    'subtitulo',
    'autor',
    'palabrasClave',
    'nota',
    'resumen',

    // ✅ NUEVO: secciones finales del Panel 1
    'notaEditorial',
    'agradecimientos',
    'financiacion',
    'conflictosInteres',
    'comoCitar',

    'contenidoTexto'
  ];

  ids.forEach(id => {
    const el = document.getElementById(id);
    if(!el) return;
    new VoiceDictation(id);
  });
}

  // Exponer para que app.js lo llame
  window.initVoiceControlsPanel1 = initVoiceControlsPanel1;

  // ✅ Escuchar cambios de idioma de dictado desde settings
  window.addEventListener('ensaYOnesa:dictLangChanged', (ev) => {
    const lang = ev && ev.detail ? ev.detail.lang : null;
    INSTANCES.forEach(inst => {
      if(inst && typeof inst.setDictationLanguage === 'function'){
        inst.setDictationLanguage(lang);
      }
    });
  });

  // Solo pagehide (navegación real). Evitamos “visibilitychange” porque en algunos Android
  // puede dispararse con overlays/diálogos y cortar el dictado sin querer.
  window.addEventListener('pagehide', () => {
    if(activeDictation){
      activeDictation.stop(true);
    }
  });

  // Debug público
  window.__ensayonesa_dictado = {
    VERSION: DICTADO_VERSION,
    HAS_SPEECH,
    env: () => getEnv(),
    getDictationLang: () => getStoredDictationAppLang(),
    getSpeechLang: () => toSpeechLang(getStoredDictationAppLang()),
    setDebug: (on = true) => {
      try{ localStorage.setItem(DEBUG_KEY, on ? '1' : '0'); }catch(_){}
    },
    isDebug: () => isDebugEnabled(),
    getInstanceErrors: () => Array.from(INSTANCES).map(inst => {
      try{ return inst.getLastError(); }catch(_){ return null; }
    }).filter(Boolean),
    getInstanceStats: () => Array.from(INSTANCES).map(inst => {
      try{ return inst.getStats(); }catch(_){ return null; }
    }).filter(Boolean)
  };
})();
