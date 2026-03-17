/* i18n.js
 * Cargador muy ligero de traducciones JSON + bindings sobre el DOM.
 * Usa ./lang/<código>.json (p.ej. ./lang/es.json, ./lang/en.json, etc.)
 */

(function (global) {
  'use strict';

  const STORAGE_KEY = 'ensaYOnesa:lang';
  const SUPPORTED = ['es', 'en', 'pt-br', 'it', 'fr', 'de', 'ko', 'zh', 'ja', 'ru', 'hi', 'ar'];
  const DEFAULT_LANG = 'es';

  const state = {
    lang: DEFAULT_LANG,
    dict: {},
    listeners: []
  };

  function normalizeLang(code) {
    if (!code) return DEFAULT_LANG;
    let c = String(code).toLowerCase();

    if (c.startsWith('pt-br') || c === 'pt') return 'pt-br';
    if (c.startsWith('es')) return 'es';
    if (c.startsWith('en')) return 'en';
    if (c.startsWith('it')) return 'it';
    if (c.startsWith('fr')) return 'fr';
    if (c.startsWith('de')) return 'de';
    if (c.startsWith('ko') || c.startsWith('kr')) return 'ko';
    if (c.startsWith('zh')) return 'zh';
    if (c.startsWith('ja') || c.startsWith('jp')) return 'ja';
    if (c.startsWith('ru')) return 'ru';
    if (c.startsWith('hi')) return 'hi';
    if (c.startsWith('ar')) return 'ar';

    return DEFAULT_LANG;
  }

  function detectInitialLang() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const n = normalizeLang(stored);
        if (SUPPORTED.includes(n)) return n;
      }
    } catch {
      /* ignore */
    }

    if (Array.isArray(navigator.languages)) {
      for (const lang of navigator.languages) {
        const n = normalizeLang(lang);
        if (SUPPORTED.includes(n)) return n;
      }
    }

    if (navigator.language) {
      const n = normalizeLang(navigator.language);
      if (SUPPORTED.includes(n)) return n;
    }

    return DEFAULT_LANG;
  }

  function translateKey(key, vars) {
    if (!key) return '';
    const parts = String(key).split('.');
    let node = state.dict;

    for (const p of parts) {
      if (node && Object.prototype.hasOwnProperty.call(node, p)) {
        node = node[p];
      } else {
        node = undefined;
        break;
      }
    }

    if (node == null) return '';

    let value = String(node);

    if (vars && typeof vars === 'object') {
      for (const [name, val] of Object.entries(vars)) {
        const re = new RegExp('{{\\s*' + name + '\\s*}}', 'g');
        value = value.replace(re, String(val));
      }
    }

    return value;
  }

  function applyTranslations(root) {
    const scope = root || document;

    // Texto (textContent)
    scope.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      const text = translateKey(key);
      if (text) el.textContent = text;
    });

    // placeholder
    scope.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
      const key = el.getAttribute('data-i18n-placeholder');
      const text = translateKey(key);
      if (text) el.setAttribute('placeholder', text);
    });

    // title
    scope.querySelectorAll('[data-i18n-title]').forEach(el => {
      const key = el.getAttribute('data-i18n-title');
      const text = translateKey(key);
      if (text) el.setAttribute('title', text);
    });

    // aria-label
    scope.querySelectorAll('[data-i18n-aria-label]').forEach(el => {
      const key = el.getAttribute('data-i18n-aria-label');
      const text = translateKey(key);
      if (text) el.setAttribute('aria-label', text);
    });

    // value (para inputs/select)
    scope.querySelectorAll('[data-i18n-value]').forEach(el => {
      const key = el.getAttribute('data-i18n-value');
      const text = translateKey(key);
      if (text) el.value = text;
    });

    // alt
    scope.querySelectorAll('[data-i18n-alt]').forEach(el => {
      const key = el.getAttribute('data-i18n-alt');
      const text = translateKey(key);
      if (text) el.setAttribute('alt', text);
    });

    // innerHTML (para bloques ricos como la política de privacidad)
    scope.querySelectorAll('[data-i18n-html]').forEach(el => {
      const key = el.getAttribute('data-i18n-html');
      const html = translateKey(key);
      if (html) el.innerHTML = html;
    });

    // Título del documento
    const docTitle = translateKey('app.title');
    if (docTitle) {
      document.title = docTitle;
    }

    // lang en <html>
    document.documentElement.lang = state.lang || DEFAULT_LANG;
  }

  async function loadLanguage(lang) {
    const normalized = normalizeLang(lang);
    let dict;

    try {
      const res = await fetch('./lang/' + normalized + '.json', { cache: 'no-store' });
      if (!res.ok) throw new Error('Lang file not found: ' + normalized);
      dict = await res.json();
    } catch (err) {
      console.warn('[ensaYOnesa] Error cargando idioma', normalized, err);
      if (normalized !== DEFAULT_LANG) {
        return loadLanguage(DEFAULT_LANG);
      }
      return;
    }

    state.lang = normalized;
    state.dict = dict || {};

    try {
      localStorage.setItem(STORAGE_KEY, normalized);
    } catch {
      /* ignore */
    }

    applyTranslations();

    state.listeners.forEach(fn => {
      try {
        fn(normalized);
      } catch {
        /* noop */
      }
    });
  }

  function changeLanguage(lang) {
    return loadLanguage(lang || DEFAULT_LANG);
  }

  const api = {
    t: translateKey,
    changeLanguage,
    getLanguage: () => state.lang,
    onChange: (handler) => {
      if (typeof handler === 'function') {
        state.listeners.push(handler);
      }
    },
    applyTo: applyTranslations
  };

  global.i18n = api;

  document.addEventListener('DOMContentLoaded', () => {
    const initial = detectInitialLang();
    loadLanguage(initial);
  });

})(window);
