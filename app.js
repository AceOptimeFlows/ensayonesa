/* ensaYOnesa — PWA offline
 * App principal: estado, UI y PWA.
 */

/* ===== Helpers DOM ===== */
const $  = sel => document.querySelector(sel);
const $$ = sel => [...document.querySelectorAll(sel)];

/* ===== i18n helper (para textos desde JS) ===== */
const t = (key, fallback = '', vars) => {
  try {
    if (window.i18n && typeof window.i18n.t === 'function') {
      const val = window.i18n.t(key, vars);
      if (val != null && val !== '') return val;
    }
  } catch (_) {
    // ignorar y usar fallback
  }
  return fallback;
};
/* ========================================================================
 * ✅ i18n fallback “End matter”
 * - Soluciona: claves ausentes en otros idiomas → se quedaban en español
 * - Afecta a UI (data-i18n) y a export si export.js usa i18n.t / t(...)
 * ====================================================================== */
(function installI18nEndMatterFallbacks(){
  const FALLBACKS = {
    es: {
      'panel1.endMatterHint': 'Si rellenas alguno de estos campos, se añadirá una página final al PDF (después de la Bibliografía).',
      'panel1.editorialNoteLabel': 'Nota editorial (opcional)',
      'panel1.editorialNotePlaceholder': 'Nota editorial…',
      'panel1.acknowledgmentsLabel': 'Agradecimientos (opcional)',
      'panel1.acknowledgmentsPlaceholder': 'Agradecimientos…',
      'panel1.fundingLabel': 'Financiación (opcional)',
      'panel1.fundingPlaceholder': 'Financiación…',
      'panel1.conflictsLabel': 'Conflictos de interés (opcional)',
      'panel1.conflictsPlaceholder': 'Conflictos de interés…',
      'panel1.howToCiteLabel': 'Cómo citar (opcional)',
      'panel1.howToCitePlaceholder': 'Cómo citar este trabajo…',

      'export.endMatter.heading': 'Nota editorial y declaraciones',
      'export.endMatter.editorialNote': 'Nota editorial',
      'export.endMatter.acknowledgments': 'Agradecimientos',
      'export.endMatter.funding': 'Financiación',
      'export.endMatter.conflicts': 'Conflictos de interés',
      'export.endMatter.howToCite': 'Cómo citar',

      'panel2.formatCards.endMatterHeading': 'Secciones finales (título de página)',
      'panel2.formatCards.endMatterLabel': 'Secciones finales (títulos)',
      'panel2.formatCards.endMatterBody': 'Secciones finales (contenido)'
    },

    en: {
      'panel1.endMatterHint': 'If you fill any of these fields, a final page will be added to the PDF (after the Bibliography).',
      'panel1.editorialNoteLabel': 'Editorial note (optional)',
      'panel1.editorialNotePlaceholder': 'Editorial note…',
      'panel1.acknowledgmentsLabel': 'Acknowledgments (optional)',
      'panel1.acknowledgmentsPlaceholder': 'Acknowledgments…',
      'panel1.fundingLabel': 'Funding (optional)',
      'panel1.fundingPlaceholder': 'Funding…',
      'panel1.conflictsLabel': 'Conflicts of interest (optional)',
      'panel1.conflictsPlaceholder': 'Conflicts of interest…',
      'panel1.howToCiteLabel': 'How to cite (optional)',
      'panel1.howToCitePlaceholder': 'How to cite this work…',

      'export.endMatter.heading': 'Editorial note and statements',
      'export.endMatter.editorialNote': 'Editorial note',
      'export.endMatter.acknowledgments': 'Acknowledgments',
      'export.endMatter.funding': 'Funding',
      'export.endMatter.conflicts': 'Conflicts of interest',
      'export.endMatter.howToCite': 'How to cite',

      'panel2.formatCards.endMatterHeading': 'Final sections (page title)',
      'panel2.formatCards.endMatterLabel': 'Final sections (section headings)',
      'panel2.formatCards.endMatterBody': 'Final sections (text)'
    },

    'pt-br': {
      'panel1.endMatterHint': 'Se você preencher algum destes campos, uma página final será adicionada ao PDF (após a Bibliografia).',
      'panel1.editorialNoteLabel': 'Nota editorial (opcional)',
      'panel1.editorialNotePlaceholder': 'Nota editorial…',
      'panel1.acknowledgmentsLabel': 'Agradecimentos (opcional)',
      'panel1.acknowledgmentsPlaceholder': 'Agradecimentos…',
      'panel1.fundingLabel': 'Financiamento (opcional)',
      'panel1.fundingPlaceholder': 'Financiamento…',
      'panel1.conflictsLabel': 'Conflitos de interesse (opcional)',
      'panel1.conflictsPlaceholder': 'Conflitos de interesse…',
      'panel1.howToCiteLabel': 'Como citar (opcional)',
      'panel1.howToCitePlaceholder': 'Como citar este trabalho…',

      'export.endMatter.heading': 'Nota editorial e declarações',
      'export.endMatter.editorialNote': 'Nota editorial',
      'export.endMatter.acknowledgments': 'Agradecimentos',
      'export.endMatter.funding': 'Financiamento',
      'export.endMatter.conflicts': 'Conflitos de interesse',
      'export.endMatter.howToCite': 'Como citar',

      'panel2.formatCards.endMatterHeading': 'Seções finais (título da página)',
      'panel2.formatCards.endMatterLabel': 'Seções finais (títulos)',
      'panel2.formatCards.endMatterBody': 'Seções finais (conteúdo)'
    },

    it: {
      'panel1.endMatterHint': 'Se compili uno di questi campi, verrà aggiunta una pagina finale al PDF (dopo la Bibliografia).',
      'panel1.editorialNoteLabel': 'Nota editoriale (opzionale)',
      'panel1.editorialNotePlaceholder': 'Nota editoriale…',
      'panel1.acknowledgmentsLabel': 'Ringraziamenti (opzionale)',
      'panel1.acknowledgmentsPlaceholder': 'Ringraziamenti…',
      'panel1.fundingLabel': 'Finanziamento (opzionale)',
      'panel1.fundingPlaceholder': 'Finanziamento…',
      'panel1.conflictsLabel': 'Conflitti di interesse (opzionale)',
      'panel1.conflictsPlaceholder': 'Conflitti di interesse…',
      'panel1.howToCiteLabel': 'Come citare (opzionale)',
      'panel1.howToCitePlaceholder': 'Come citare questo lavoro…',

      'export.endMatter.heading': 'Nota editoriale e dichiarazioni',
      'export.endMatter.editorialNote': 'Nota editoriale',
      'export.endMatter.acknowledgments': 'Ringraziamenti',
      'export.endMatter.funding': 'Finanziamento',
      'export.endMatter.conflicts': 'Conflitti di interesse',
      'export.endMatter.howToCite': 'Come citare',

      'panel2.formatCards.endMatterHeading': 'Sezioni finali (titolo pagina)',
      'panel2.formatCards.endMatterLabel': 'Sezioni finali (titoli)',
      'panel2.formatCards.endMatterBody': 'Sezioni finali (contenuto)'
    },

    fr: {
      'panel1.endMatterHint': 'Si vous remplissez l’un de ces champs, une page finale sera ajoutée au PDF (après la Bibliographie).',
      'panel1.editorialNoteLabel': 'Note éditoriale (optionnel)',
      'panel1.editorialNotePlaceholder': 'Note éditoriale…',
      'panel1.acknowledgmentsLabel': 'Remerciements (optionnel)',
      'panel1.acknowledgmentsPlaceholder': 'Remerciements…',
      'panel1.fundingLabel': 'Financement (optionnel)',
      'panel1.fundingPlaceholder': 'Financement…',
      'panel1.conflictsLabel': 'Conflits d’intérêts (optionnel)',
      'panel1.conflictsPlaceholder': 'Conflits d’intérêts…',
      'panel1.howToCiteLabel': 'Comment citer (optionnel)',
      'panel1.howToCitePlaceholder': 'Comment citer ce travail…',

      'export.endMatter.heading': 'Note éditoriale et déclarations',
      'export.endMatter.editorialNote': 'Note éditoriale',
      'export.endMatter.acknowledgments': 'Remerciements',
      'export.endMatter.funding': 'Financement',
      'export.endMatter.conflicts': 'Conflits d’intérêts',
      'export.endMatter.howToCite': 'Comment citer',

      'panel2.formatCards.endMatterHeading': 'Sections finales (titre de page)',
      'panel2.formatCards.endMatterLabel': 'Sections finales (titres)',
      'panel2.formatCards.endMatterBody': 'Sections finales (contenu)'
    },

    de: {
      'panel1.endMatterHint': 'Wenn du eines dieser Felder ausfüllst, wird dem PDF eine letzte Seite hinzugefügt (nach der Bibliografie).',
      'panel1.editorialNoteLabel': 'Redaktionelle Notiz (optional)',
      'panel1.editorialNotePlaceholder': 'Redaktionelle Notiz…',
      'panel1.acknowledgmentsLabel': 'Danksagungen (optional)',
      'panel1.acknowledgmentsPlaceholder': 'Danksagungen…',
      'panel1.fundingLabel': 'Finanzierung (optional)',
      'panel1.fundingPlaceholder': 'Finanzierung…',
      'panel1.conflictsLabel': 'Interessenkonflikte (optional)',
      'panel1.conflictsPlaceholder': 'Interessenkonflikte…',
      'panel1.howToCiteLabel': 'Zitierhinweis (optional)',
      'panel1.howToCitePlaceholder': 'So zitieren Sie diese Arbeit…',

      'export.endMatter.heading': 'Redaktionelle Notiz und Erklärungen',
      'export.endMatter.editorialNote': 'Redaktionelle Notiz',
      'export.endMatter.acknowledgments': 'Danksagungen',
      'export.endMatter.funding': 'Finanzierung',
      'export.endMatter.conflicts': 'Interessenkonflikte',
      'export.endMatter.howToCite': 'Zitierhinweis',

      'panel2.formatCards.endMatterHeading': 'Schlussabschnitte (Seitentitel)',
      'panel2.formatCards.endMatterLabel': 'Schlussabschnitte (Überschriften)',
      'panel2.formatCards.endMatterBody': 'Schlussabschnitte (Text)'
    },

    ko: {
      'panel1.endMatterHint': '이 항목 중 하나라도 채우면 PDF에 마지막 페이지가 추가됩니다(참고문헌 뒤).',
      'panel1.editorialNoteLabel': '편집자 주(선택 사항)',
      'panel1.editorialNotePlaceholder': '편집자 주…',
      'panel1.acknowledgmentsLabel': '감사의 글(선택 사항)',
      'panel1.acknowledgmentsPlaceholder': '감사의 글…',
      'panel1.fundingLabel': '연구비 지원(선택 사항)',
      'panel1.fundingPlaceholder': '연구비 지원…',
      'panel1.conflictsLabel': '이해 상충(선택 사항)',
      'panel1.conflictsPlaceholder': '이해 상충…',
      'panel1.howToCiteLabel': '인용 방법(선택 사항)',
      'panel1.howToCitePlaceholder': '이 작업을 인용하는 방법…',

      'export.endMatter.heading': '편집자 주 및 선언',
      'export.endMatter.editorialNote': '편집자 주',
      'export.endMatter.acknowledgments': '감사의 글',
      'export.endMatter.funding': '연구비 지원',
      'export.endMatter.conflicts': '이해 상충',
      'export.endMatter.howToCite': '인용 방법',

      'panel2.formatCards.endMatterHeading': '마지막 섹션(페이지 제목)',
      'panel2.formatCards.endMatterLabel': '마지막 섹션(제목)',
      'panel2.formatCards.endMatterBody': '마지막 섹션(내용)'
    },

    zh: {
      'panel1.endMatterHint': '如果你填写了这些字段中的任何一个，PDF 将在文末添加一页（在参考文献之后）。',
      'panel1.editorialNoteLabel': '编辑说明（可选）',
      'panel1.editorialNotePlaceholder': '编辑说明…',
      'panel1.acknowledgmentsLabel': '致谢（可选）',
      'panel1.acknowledgmentsPlaceholder': '致谢…',
      'panel1.fundingLabel': '资助（可选）',
      'panel1.fundingPlaceholder': '资助…',
      'panel1.conflictsLabel': '利益冲突（可选）',
      'panel1.conflictsPlaceholder': '利益冲突…',
      'panel1.howToCiteLabel': '引用方式（可选）',
      'panel1.howToCitePlaceholder': '如何引用本工作…',

      'export.endMatter.heading': '编辑说明与声明',
      'export.endMatter.editorialNote': '编辑说明',
      'export.endMatter.acknowledgments': '致谢',
      'export.endMatter.funding': '资助',
      'export.endMatter.conflicts': '利益冲突',
      'export.endMatter.howToCite': '引用方式',

      'panel2.formatCards.endMatterHeading': '末尾部分（页面标题）',
      'panel2.formatCards.endMatterLabel': '末尾部分（标题）',
      'panel2.formatCards.endMatterBody': '末尾部分（内容）'
    },

    ja: {
      'panel1.endMatterHint': 'これらの項目のいずれかを入力すると、PDF の末尾に最終ページが追加されます（参考文献の後）。',
      'panel1.editorialNoteLabel': '編集者注（任意）',
      'panel1.editorialNotePlaceholder': '編集者注…',
      'panel1.acknowledgmentsLabel': '謝辞（任意）',
      'panel1.acknowledgmentsPlaceholder': '謝辞…',
      'panel1.fundingLabel': '資金提供（任意）',
      'panel1.fundingPlaceholder': '資金提供…',
      'panel1.conflictsLabel': '利益相反（任意）',
      'panel1.conflictsPlaceholder': '利益相反…',
      'panel1.howToCiteLabel': '引用方法（任意）',
      'panel1.howToCitePlaceholder': '本作品の引用方法…',

      'export.endMatter.heading': '編集者注と声明',
      'export.endMatter.editorialNote': '編集者注',
      'export.endMatter.acknowledgments': '謝辞',
      'export.endMatter.funding': '資金提供',
      'export.endMatter.conflicts': '利益相反',
      'export.endMatter.howToCite': '引用方法',

      'panel2.formatCards.endMatterHeading': '最終セクション（ページタイトル）',
      'panel2.formatCards.endMatterLabel': '最終セクション（見出し）',
      'panel2.formatCards.endMatterBody': '最終セクション（本文）'
    },

    ru: {
      'panel1.endMatterHint': 'Если заполнить любое из этих полей, в PDF будет добавлена последняя страница (после библиографии).',
      'panel1.editorialNoteLabel': 'Редакторская заметка (необязательно)',
      'panel1.editorialNotePlaceholder': 'Редакторская заметка…',
      'panel1.acknowledgmentsLabel': 'Благодарности (необязательно)',
      'panel1.acknowledgmentsPlaceholder': 'Благодарности…',
      'panel1.fundingLabel': 'Финансирование (необязательно)',
      'panel1.fundingPlaceholder': 'Финансирование…',
      'panel1.conflictsLabel': 'Конфликт интересов (необязательно)',
      'panel1.conflictsPlaceholder': 'Конфликт интересов…',
      'panel1.howToCiteLabel': 'Как цитировать (необязательно)',
      'panel1.howToCitePlaceholder': 'Как цитировать эту работу…',

      'export.endMatter.heading': 'Редакторская заметка и заявления',
      'export.endMatter.editorialNote': 'Редакторская заметка',
      'export.endMatter.acknowledgments': 'Благодарности',
      'export.endMatter.funding': 'Финансирование',
      'export.endMatter.conflicts': 'Конфликт интересов',
      'export.endMatter.howToCite': 'Как цитировать',

      'panel2.formatCards.endMatterHeading': 'Заключительные разделы (заголовок страницы)',
      'panel2.formatCards.endMatterLabel': 'Заключительные разделы (заголовки)',
      'panel2.formatCards.endMatterBody': 'Заключительные разделы (текст)'
    },

    hi: {
      'panel1.endMatterHint': 'यदि आप इनमें से कोई फ़ील्ड भरते हैं, तो PDF में एक अंतिम पृष्ठ जोड़ा जाएगा (ग्रंथसूची के बाद)।',
      'panel1.editorialNoteLabel': 'संपादकीय टिप्पणी (वैकल्पिक)',
      'panel1.editorialNotePlaceholder': 'संपादकीय टिप्पणी…',
      'panel1.acknowledgmentsLabel': 'आभार (वैकल्पिक)',
      'panel1.acknowledgmentsPlaceholder': 'आभार…',
      'panel1.fundingLabel': 'वित्तपोषण (वैकल्पिक)',
      'panel1.fundingPlaceholder': 'वित्तपोषण…',
      'panel1.conflictsLabel': 'हितों का टकराव (वैकल्पिक)',
      'panel1.conflictsPlaceholder': 'हितों का टकराव…',
      'panel1.howToCiteLabel': 'कैसे उद्धृत करें (वैकल्पिक)',
      'panel1.howToCitePlaceholder': 'इस कार्य को कैसे उद्धृत करें…',

      'export.endMatter.heading': 'संपादकीय टिप्पणी और घोषणाएँ',
      'export.endMatter.editorialNote': 'संपादकीय टिप्पणी',
      'export.endMatter.acknowledgments': 'आभार',
      'export.endMatter.funding': 'वित्तपोषण',
      'export.endMatter.conflicts': 'हितों का टकराव',
      'export.endMatter.howToCite': 'कैसे उद्धृत करें',

      'panel2.formatCards.endMatterHeading': 'अंतिम अनुभाग (पृष्ठ शीर्षक)',
      'panel2.formatCards.endMatterLabel': 'अंतिम अनुभाग (शीर्षक)',
      'panel2.formatCards.endMatterBody': 'अंतिम अनुभाग (सामग्री)'
    },

    ar: {
      'panel1.endMatterHint': 'إذا ملأت أيًا من هذه الحقول، فستتم إضافة صفحة أخيرة إلى ملف PDF (بعد قائمة المراجع).',
      'panel1.editorialNoteLabel': 'ملاحظة تحريرية (اختياري)',
      'panel1.editorialNotePlaceholder': 'ملاحظة تحريرية…',
      'panel1.acknowledgmentsLabel': 'شكر وتقدير (اختياري)',
      'panel1.acknowledgmentsPlaceholder': 'شكر وتقدير…',
      'panel1.fundingLabel': 'التمويل (اختياري)',
      'panel1.fundingPlaceholder': 'التمويل…',
      'panel1.conflictsLabel': 'تعارض المصالح (اختياري)',
      'panel1.conflictsPlaceholder': 'تعارض المصالح…',
      'panel1.howToCiteLabel': 'كيفية الاستشهاد (اختياري)',
      'panel1.howToCitePlaceholder': 'كيفية الاستشهاد بهذا العمل…',

      'export.endMatter.heading': 'ملاحظة تحريرية وإقرارات',
      'export.endMatter.editorialNote': 'ملاحظة تحريرية',
      'export.endMatter.acknowledgments': 'شكر وتقدير',
      'export.endMatter.funding': 'التمويل',
      'export.endMatter.conflicts': 'تعارض المصالح',
      'export.endMatter.howToCite': 'كيفية الاستشهاد',

      'panel2.formatCards.endMatterHeading': 'الأقسام الختامية (عنوان الصفحة)',
      'panel2.formatCards.endMatterLabel': 'الأقسام الختامية (عناوين)',
      'panel2.formatCards.endMatterBody': 'الأقسام الختامية (النص)'
    }
  };

  function interpolate(str, vars){
    const s = String(str ?? '');
    if(!vars || typeof vars !== 'object') return s;
    return s.replace(/\{\{\s*([\w.-]+)\s*\}\}/g, (_, k) => {
      const v = vars[k];
      return (v == null) ? '' : String(v);
    });
  }

  function normalizeLang(raw){
    const s = String(raw || '').trim().toLowerCase().replace('_','-');
    if(!s) return 'es';
    if(s === 'pt' || s.startsWith('pt-')) return 'pt-br';
    if(s === 'zh' || s.startsWith('zh-')) return 'zh';
    if(s === 'es' || s.startsWith('es-')) return 'es';
    return s.split('-')[0];
  }

  function getCurrentLang(){
    try{
      if(window.i18n && typeof window.i18n.getLanguage === 'function'){
        return normalizeLang(window.i18n.getLanguage());
      }
    }catch(_){}
    return normalizeLang(document.documentElement.lang || 'es');
  }

  function looksMissing(res, key, lang){
    const s = (res == null) ? '' : String(res);
    if(!s) return true;
    if(s === String(key || '')) return true;

    // Si i18n hace fallback al español, lo detectamos y lo tratamos como “missing”
    if(lang !== 'es'){
      const esVal = FALLBACKS.es && FALLBACKS.es[key];
      if(esVal && s === esVal) return true;
    }
    return false;
  }

  function patchOnce(){
    const i18n = window.i18n;
    if(!i18n || typeof i18n.t !== 'function') return false;
    if(i18n.t._endMatterFallbackPatched) return true;

    const orig = i18n.t.bind(i18n);

    const wrapped = (key, vars) => {
      let res;
      try{ res = orig(key, vars); }catch(_){ res = ''; }

      const lang = getCurrentLang();
      if(!looksMissing(res, key, lang)) return res;

      const dict =
        (FALLBACKS[lang] && FALLBACKS[lang][key] != null) ? FALLBACKS[lang] :
        (FALLBACKS.en && FALLBACKS.en[key] != null) ? FALLBACKS.en :
        (FALLBACKS.es && FALLBACKS.es[key] != null) ? FALLBACKS.es :
        null;

      if(!dict) return res;
      if(dict[key] == null) return res;

      return interpolate(dict[key], vars);
    };

    wrapped._endMatterFallbackPatched = true;
    i18n.t = wrapped;
    return true;
  }

  // Intento inmediato + reintentos (por si i18n todavía no está listo)
  if(patchOnce()) return;
  let tries = 0;
  const timer = setInterval(() => {
    tries++;
    if(patchOnce() || tries > 40){
      clearInterval(timer);
    }
  }, 50);
})();
/* ========================================================================
 * Inline formatting (Panel 3)
 * - Aplica etiquetas estilo BBCode: [b]...[/b], [i]...[/i], [u]...[/u]
 * - Toolbar + atajos Ctrl/Cmd + B / I / U en:
 *   - #contenidoTexto
 *   - #citaTexto
 * ====================================================================== */
const INLINE_FMT_TAGS = {
  bold:      { open: '[b]', close: '[/b]' },
  italic:    { open: '[i]', close: '[/i]' },
  underline: { open: '[u]', close: '[/u]' }
};

function stripInlineFmtTags(s){
  return String(s || '').replace(/\[(\/?)(b|i|u)\]/gi, '');
}

function toggleWrapSelectionWithTags(textareaEl, openTag, closeTag){
  if(!textareaEl) return;
  const ta = textareaEl;

  const value = String(ta.value ?? '');
  const start = ta.selectionStart;
  const end   = ta.selectionEnd;

  if(start == null || end == null) return;

  // ✅ Soporta también <input> (no siempre tiene scrollTop significativo)
  const hasScroll = (ta && typeof ta.scrollTop === 'number');
  const scrollTop = hasScroll ? ta.scrollTop : 0;

  // Sin selección: insertar tags y colocar cursor dentro
  if(start === end){
    const insert = openTag + closeTag;
    try{
      ta.setRangeText(insert, start, end, 'end');
      const pos = start + openTag.length;
      ta.selectionStart = ta.selectionEnd = pos;
    }catch{
      ta.value = value.slice(0, start) + insert + value.slice(end);
      const pos = start + openTag.length;
      ta.selectionStart = ta.selectionEnd = pos;
    }
    if(hasScroll) ta.scrollTop = scrollTop;
    ta.dispatchEvent(new Event('input', { bubbles:true }));
    return;
  }

  // Con selección: toggle (si ya está envuelto, lo quitamos; si no, lo ponemos)
  const beforeStart = value.slice(Math.max(0, start - openTag.length), start);
  const afterEnd    = value.slice(end, end + closeTag.length);

  if(beforeStart === openTag && afterEnd === closeTag){
    // Unwrap
    const newVal =
      value.slice(0, start - openTag.length) +
      value.slice(start, end) +
      value.slice(end + closeTag.length);

    ta.value = newVal;
    ta.selectionStart = start - openTag.length;
    ta.selectionEnd   = end   - openTag.length;
  }else{
    // Wrap
    const selected = value.slice(start, end);
    const insert = openTag + selected + closeTag;
    try{
      ta.setRangeText(insert, start, end, 'select');
      ta.selectionStart = start + openTag.length;
      ta.selectionEnd   = start + openTag.length + selected.length;
    }catch{
      ta.value = value.slice(0, start) + insert + value.slice(end);
      ta.selectionStart = start + openTag.length;
      ta.selectionEnd   = start + openTag.length + selected.length;
    }
  }

  if(hasScroll) ta.scrollTop = scrollTop;
  ta.dispatchEvent(new Event('input', { bubbles:true }));
}

function bindInlineFormattingToTextarea(textareaEl, opts){
  if(!textareaEl) return;
  const ta = textareaEl;

  // ✅ opts opcionales (para inputs de títulos)
  opts = opts || {};
  const compact   = !!opts.compact;
  const showLabel = (opts.showLabel !== false);
  const showHint  = (opts.showHint  !== false);

  if(ta.dataset.inlineFmtBound === '1') return;
  ta.dataset.inlineFmtBound = '1';

  // Toolbar
  const tb = document.createElement('div');
  tb.className = 'inline-fmt-toolbar';
  tb.style.display = 'flex';
  tb.style.gap = compact ? '4px' : '6px';
  tb.style.alignItems = 'center';
  tb.style.flexWrap = 'wrap';
  tb.style.margin = compact ? '4px 0 6px 0' : '6px 0 8px 0';

  if(showLabel){
    const label = document.createElement('span');
    label.dataset.i18nKey = 'panel3.inlineFmt.label';
    label.dataset.i18nFallback = 'Formato:';
    label.textContent = t(label.dataset.i18nKey, label.dataset.i18nFallback);
    label.style.fontSize = compact ? '11px' : '12px';
    label.style.opacity = '0.75';
    tb.appendChild(label);
  }

  const mkBtn = (txt, title, styleObj, onClick) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = txt;
    b.title = title;
    b.style.padding = compact ? '3px 7px' : '4px 8px';
    b.style.border = '1px solid rgba(0,0,0,0.2)';
    b.style.borderRadius = '8px';
    b.style.background = '#fff';
    b.style.cursor = 'pointer';
    b.style.fontSize = compact ? '12px' : '13px';
    b.style.lineHeight = '1';
    Object.assign(b.style, styleObj || {});

    // ✅ IMPORTANTÍSIMO: evita que el click robe el foco y mate la selección
    b.addEventListener('mousedown', (e)=>{ e.preventDefault(); });

    b.addEventListener('click', (e)=>{
      e.preventDefault();
      onClick();
      try{ ta.focus(); }catch(_){}
    });
    return b;
  };

  const mkI18nBtn = (txt, titleKey, titleFallback, styleObj, onClick) => {
    const b = mkBtn(txt, t(titleKey, titleFallback), styleObj, onClick);
    b.dataset.i18nTitleKey = titleKey;
    b.dataset.i18nTitleFallback = titleFallback;
    return b;
  };

  tb.appendChild(mkI18nBtn(
    'B',
    'panel3.inlineFmt.bold',
    'Negrita (Ctrl+B)',
    { fontWeight:'700' },
    ()=>toggleWrapSelectionWithTags(ta, INLINE_FMT_TAGS.bold.open, INLINE_FMT_TAGS.bold.close)
  ));

  tb.appendChild(mkI18nBtn(
    'I',
    'panel3.inlineFmt.italic',
    'Cursiva (Ctrl+I)',
    { fontStyle:'italic' },
    ()=>toggleWrapSelectionWithTags(ta, INLINE_FMT_TAGS.italic.open, INLINE_FMT_TAGS.italic.close)
  ));

  tb.appendChild(mkI18nBtn(
    'U',
    'panel3.inlineFmt.underline',
    'Subrayado (Ctrl+U)',
    { textDecoration:'underline' },
    ()=>toggleWrapSelectionWithTags(ta, INLINE_FMT_TAGS.underline.open, INLINE_FMT_TAGS.underline.close)
  ));

  if(showHint){
    const hint = document.createElement('span');
    hint.dataset.i18nKey = 'panel3.inlineFmt.hint';
    hint.dataset.i18nFallback = 'Atajos: Ctrl/Cmd + B / I / U';
    hint.textContent = t(hint.dataset.i18nKey, hint.dataset.i18nFallback);
    hint.style.fontSize = compact ? '11px' : '12px';
    hint.style.opacity = '0.65';
    hint.style.marginLeft = '8px';
    tb.appendChild(hint);
  }

  // Insertar toolbar antes del field
  if(ta.parentNode){
    ta.parentNode.insertBefore(tb, ta);
  }

  // i18n refresh
  applyI18nToInlineFmtToolbar(tb);

  // Hotkeys
  ta.addEventListener('keydown', (e)=>{
    const mod = e.ctrlKey || e.metaKey;
    if(!mod || e.altKey) return;

    const k = String(e.key || '').toLowerCase();
    if(k === 'b'){
      e.preventDefault();
      toggleWrapSelectionWithTags(ta, INLINE_FMT_TAGS.bold.open, INLINE_FMT_TAGS.bold.close);
    }else if(k === 'i'){
      e.preventDefault();
      toggleWrapSelectionWithTags(ta, INLINE_FMT_TAGS.italic.open, INLINE_FMT_TAGS.italic.close);
    }else if(k === 'u'){
      e.preventDefault();
      toggleWrapSelectionWithTags(ta, INLINE_FMT_TAGS.underline.open, INLINE_FMT_TAGS.underline.close);
    }
  });
}

/* ===== ✅ NUEVO: refresco i18n para toolbars creadas por JS ===== */
function applyI18nToInlineFmtToolbar(tb){
  if(!tb) return;

  // Textos (label/hint) → data-i18n-key
  tb.querySelectorAll('[data-i18n-key]').forEach(el=>{
    const key = el.dataset.i18nKey || '';
    const fallback = el.dataset.i18nFallback || '';
    if(key) el.textContent = t(key, fallback);
  });

  // Tooltips → data-i18n-title-key
  tb.querySelectorAll('[data-i18n-title-key]').forEach(el=>{
    const key = el.dataset.i18nTitleKey || '';
    const fallback = el.dataset.i18nTitleFallback || '';
    if(key) el.title = t(key, fallback);
  });
}

function refreshInlineFormattingToolbars(){
  document.querySelectorAll('.inline-fmt-toolbar').forEach(applyI18nToInlineFmtToolbar);
}


/* ===== Panel 1: secciones finales a ancho completo + i18n real en DOM ===== */
const PANEL1_END_MATTER_DESKTOP_MQ = '(min-width: 1201px)';
const PANEL1_END_MATTER_FIELDS = [
  {
    id:'notaEditorial',
    labelKey:'panel1.editorialNoteLabel',
    labelFallback:'Nota editorial (opcional)',
    placeholderKey:'panel1.editorialNotePlaceholder',
    placeholderFallback:'Nota editorial…'
  },
  {
    id:'agradecimientos',
    labelKey:'panel1.acknowledgmentsLabel',
    labelFallback:'Agradecimientos (opcional)',
    placeholderKey:'panel1.acknowledgmentsPlaceholder',
    placeholderFallback:'Agradecimientos…'
  },
  {
    id:'financiacion',
    labelKey:'panel1.fundingLabel',
    labelFallback:'Financiación (opcional)',
    placeholderKey:'panel1.fundingPlaceholder',
    placeholderFallback:'Financiación…'
  },
  {
    id:'conflictosInteres',
    labelKey:'panel1.conflictsLabel',
    labelFallback:'Conflictos de interés (opcional)',
    placeholderKey:'panel1.conflictsPlaceholder',
    placeholderFallback:'Conflictos de interés…'
  },
  {
    id:'comoCitar',
    labelKey:'panel1.howToCiteLabel',
    labelFallback:'Cómo citar (opcional)',
    placeholderKey:'panel1.howToCitePlaceholder',
    placeholderFallback:'Cómo citar este trabajo…'
  }
];

function getPanel1EndMatterFieldById(id){
  const input = document.getElementById(String(id || ''));
  return input ? input.closest('.field') : null;
}

function getPanel1EndMatterHintField(){
  const directHint =
    document.querySelector('#panel1 [data-i18n="panel1.endMatterHint"]') ||
    document.querySelector('#panel1 [data-i18n-key="panel1.endMatterHint"]') ||
    document.querySelector('#panel1 .panel1-endmatter-hint') ||
    document.getElementById('panel1EndMatterHint') ||
    document.getElementById('endMatterHint');

  if(directHint){
    return directHint.closest('.field') || directHint;
  }

  const firstField = getPanel1EndMatterFieldById(PANEL1_END_MATTER_FIELDS[0].id);
  if(!firstField || !firstField.parentElement) return null;

  let prev = firstField.previousElementSibling;
  while(prev){
    const txt = String(prev.textContent || '').replace(/\s+/g, ' ').trim();
    if(
      txt.includes('Bibliografía') ||
      txt.includes('Bibliography') ||
      txt.includes('página final al PDF') ||
      txt.includes('final page will be added')
    ){
      return prev;
    }
    prev = prev.previousElementSibling;
  }

  return null;
}

function getPanel1EndMatterNodes(){
  const nodes = [];
  const hintField = getPanel1EndMatterHintField();
  if(hintField) nodes.push(hintField);

  PANEL1_END_MATTER_FIELDS.forEach(cfg=>{
    const field = getPanel1EndMatterFieldById(cfg.id);
    if(field && !nodes.includes(field)){
      nodes.push(field);
    }
  });

  return nodes;
}

function ensurePanel1EndMatterPlaceholder(nodes){
  if(!Array.isArray(nodes) || nodes.length === 0) return null;

  let marker = document.getElementById('panel1EndMatterPlaceholder');
  if(marker) return marker;

  const firstNode = nodes[0];
  if(!firstNode || !firstNode.parentNode) return null;

  marker = document.createElement('div');
  marker.id = 'panel1EndMatterPlaceholder';
  marker.className = 'panel1-endmatter-placeholder';
  marker.hidden = true;

  firstNode.parentNode.insertBefore(marker, firstNode);
  return marker;
}

function ensurePanel1EndMatterSection(){
  const panel = document.getElementById('panel1');
  const panelInner = panel ? (panel.querySelector('.panel-inner') || panel) : null;
  if(!panelInner) return null;

  let section = panelInner.querySelector('.panel1-endmatter-section');
  if(!section){
    section = document.createElement('div');
    section.className = 'panel1-endmatter-section';
  }

  if(!section.isConnected){
    const twocol = panelInner.querySelector('.twocol');
    if(twocol && twocol.parentNode){
      twocol.insertAdjacentElement('afterend', section);
    }else{
      panelInner.appendChild(section);
    }
  }

  return section;
}

function movePanel1EndMatterToSection(nodes, section){
  if(!Array.isArray(nodes) || !section) return;
  nodes.forEach(node=>{
    if(node && node.parentNode !== section){
      section.appendChild(node);
    }
  });
  section.hidden = false;
}

function restorePanel1EndMatterToOriginalFlow(nodes, marker, section){
  if(!Array.isArray(nodes) || !marker || !marker.parentNode) return;

  let refNode = marker;
  nodes.forEach(node=>{
    if(!node) return;
    marker.parentNode.insertBefore(node, refNode.nextSibling);
    refNode = node;
  });

  if(section){
    section.hidden = true;
  }
}

function applyPanel1EndMatterLayout(){
  const nodes = getPanel1EndMatterNodes();
  if(nodes.length === 0) return null;

  const marker = ensurePanel1EndMatterPlaceholder(nodes);
  const section = ensurePanel1EndMatterSection();

  const isDesktop = window.matchMedia
    ? window.matchMedia(PANEL1_END_MATTER_DESKTOP_MQ).matches
    : true;

  if(isDesktop){
    movePanel1EndMatterToSection(nodes, section);
  }else{
    restorePanel1EndMatterToOriginalFlow(nodes, marker, section);
  }

  return section;
}

function applyPanel1EndMatterUI(){
  const nodes = getPanel1EndMatterNodes();
  if(nodes.length === 0) return;

  const hintField = getPanel1EndMatterHintField();
  const hintEl = hintField
    ? (hintField.querySelector('[data-i18n="panel1.endMatterHint"]') ||
       hintField.querySelector('[data-i18n-key="panel1.endMatterHint"]') ||
       hintField.querySelector('.hint') ||
       hintField)
    : null;

  if(hintEl){
    hintEl.classList.add('hint', 'panel1-endmatter-hint');
    hintEl.textContent = t(
      'panel1.endMatterHint',
      'Si rellenas alguno de estos campos, se añadirá una página final al PDF (después de la Bibliografía).'
    );
  }

  PANEL1_END_MATTER_FIELDS.forEach(cfg=>{
    const input = document.getElementById(cfg.id);
    if(!input) return;

    input.placeholder = t(cfg.placeholderKey, cfg.placeholderFallback);

    const field = input.closest('.field');
    if(!field) return;
    field.classList.add('panel1-endmatter-field');

    const label =
      field.querySelector(`label[for="${cfg.id}"]`) ||
      field.querySelector('.field-head > label') ||
      field.querySelector('label');

    if(label){
      label.textContent = t(cfg.labelKey, cfg.labelFallback);
    }
  });

  applyPanel1EndMatterLayout();
}

function installPanel1EndMatterLayoutHooks(){
  if(installPanel1EndMatterLayoutHooks._bound === true) return;
  installPanel1EndMatterLayoutHooks._bound = true;

  const schedule = ()=>{
    try{
      setTimeout(()=>{ applyPanel1EndMatterUI(); }, 0);
    }catch(_){}
  };

  try{
    if(window.matchMedia){
      const mq = window.matchMedia(PANEL1_END_MATTER_DESKTOP_MQ);
      if(typeof mq.addEventListener === 'function'){
        mq.addEventListener('change', schedule);
      }else if(typeof mq.addListener === 'function'){
        mq.addListener(schedule);
      }else{
        window.addEventListener('resize', schedule);
      }
    }else{
      window.addEventListener('resize', schedule);
    }
  }catch(_){
    window.addEventListener('resize', schedule);
  }

  schedule();
}

window.applyPanel1EndMatterUI = applyPanel1EndMatterUI;
window.installPanel1EndMatterLayoutHooks = installPanel1EndMatterLayoutHooks;


function installInlineFormattingI18nHooks(){
  if(installInlineFormattingI18nHooks._bound === true) return;
  installInlineFormattingI18nHooks._bound = true;

  const schedule = ()=>{
    try{
      // En diferido para que el cambio de idioma ya esté aplicado en i18n
      setTimeout(()=>{
        refreshInlineFormattingToolbars();
        applyPanel1EndMatterUI();
      }, 0);
    }catch(_){}
  };

  // 1) Eventos custom (por si tu i18n ya dispara alguno)
  window.addEventListener('i18n:changed', schedule);
  document.addEventListener('i18n:changed', schedule);
  window.addEventListener('ensayonesa:languageChanged', schedule);

  // 2) Si tu i18n cambia <html lang="...">, lo detectamos
  try{
    const html = document.documentElement;
    const obs = new MutationObserver((muts)=>{
      for(const m of muts){
        if(m.type === 'attributes' && m.attributeName === 'lang'){
          schedule();
          break;
        }
      }
    });
    obs.observe(html, { attributes:true, attributeFilter:['lang'] });
  }catch(_){}

  // 3) Monkey patch a métodos típicos de cambio de idioma (si existen)
  const patch = (obj, methodName)=>{
    try{
      if(!obj || typeof obj[methodName] !== 'function') return;
      if(obj[methodName]._inlineFmtPatched) return;

      const orig = obj[methodName].bind(obj);
      const wrapped = (...args)=>{
        const res = orig(...args);
        schedule();
        return res;
      };
      wrapped._inlineFmtPatched = true;
      obj[methodName] = wrapped;
    }catch(_){}
  };

  patch(window.i18n, 'setLanguage');
  patch(window.i18n, 'changeLanguage');
  patch(window.i18n, 'setLocale');
  patch(window.i18n, 'setLang');

  // Primera pasada
  schedule();
}

/* ===== Estado ===== */
const LS_KEY = 'ensaYOnesa:data';

/* ===== Acceso libre (sin login ni licencia) ===== */
const LEGACY_LICENSE_CACHE_KEY = 'ensayonesa_license_cache_v1';

/* ===== Overlay helpers (coherente con tu openOverlay/closeOverlay del index) ===== */
function showOverlay(el){
  if(!el) return;
  el.hidden = false;
  el.classList.add('is-visible');
  document.body.classList.add('overlay-open');
}

function hideOverlay(el){
  if(!el) return;
  el.hidden = true;
  el.classList.remove('is-visible');

  // Solo quitamos overlay-open si NO hay ningún overlay visible
  const anyVisible = Array.from(document.querySelectorAll('.overlay')).some(o => {
    if(!o) return false;
    if(o.hidden) return false;
    // Si tu CSS usa is-visible para mostrar, comprobamos esa clase.
    // Si no, igual seguirá siendo seguro porque hidden ya filtra.
    return o.classList.contains('is-visible') || !o.hasAttribute('hidden');
  });

  if(!anyVisible){
    document.body.classList.remove('overlay-open');
  }
}

function disableLegacyLicenseGate(){
  try{
    localStorage.removeItem(LEGACY_LICENSE_CACHE_KEY);
  }catch(_){
    /* ignore */
  }

  const overlay = document.getElementById('licenseGateOverlay');
  const title = document.getElementById('licenseGateTitle');
  const message = document.getElementById('licenseGateMessage');
  const actions = document.getElementById('licenseGateActions');

  if(title) title.textContent = '';
  if(message) message.textContent = '';
  if(actions) actions.innerHTML = '';

  if(overlay){
    overlay.hidden = true;
    overlay.classList.remove('is-visible');
  }

  const anyVisible = Array.from(document.querySelectorAll('.overlay')).some(o => {
    if(!o || o.id === 'licenseGateOverlay') return false;
    if(o.hidden) return false;
    return o.classList.contains('is-visible') || !o.hasAttribute('hidden');
  });

  if(!anyVisible){
    document.body.classList.remove('overlay-open');
  }
}

/* ===== Modelo estándar de maquetación ===== */
const defaultState = {
  meta:{
  titulo:'',
  subtitulo:'',
  autor:'',
  licencia:'',
  email:'',
  safeCreativeId:'',
  doi:'',
  nota:'',
  resumen:'',
  palabrasClave:'',

  // ✅ NUEVO: secciones finales (van al final del PDF)
  notaEditorial:'',
  agradecimientos:'',
  financiacion:'',
  conflictosInteres:'',
  comoCitar:'',

  fechaPublicacion:''
},
  styles:{
  // Cabecero: por defecto “justificado” (título izq + autor dcha)
  header:{ enabled:false, line:'none', align:'justify', font:'serif', size:12, color:'#111111', alpha:1, leading:1.3 },
  // Pie: centrado
  footer:{ enabled:false, line:'none', citationsEnabled:true, align:'center', font:'serif', size:10, color:'#111111', alpha:1, leading:1.2, text:'' },
  // Números: soporta (top-left, top-right, bottom-left, bottom-right, bottom-center)
  pageNumbers:{ enabled:false, position:'bottom-right' },
  // Portada
  title   :{ font:'serif', size:28, color:'#111111', alpha:1, align:'center', leading:1.4 },
  subtitle:{ font:'serif', size:18, color:'#333333', alpha:1, align:'center', leading:1.3 },
  author  :{ font:'serif', size:14, color:'#111111', alpha:1, align:'center', leading:1.2 },
  // Metablock (licencia, resumen, etc.): justificado
  metaBlock:{ font:'serif', size:11, color:'#111111', alpha:1, align:'justify', leading:1.4 },

  // ✅ NUEVO: secciones finales (última página: nota editorial, etc.)
  // - heading: título grande de esa página
  // - label: títulos de cada bloque (Nota editorial, Agradecimientos...)
  // - body: contenido escrito en los textareas
  endMatterHeading:{ font:'serif', size:18, color:'#111111', alpha:1, align:'center', leading:1.35 },
  endMatterLabel  :{ font:'serif', size:12, color:'#111111', alpha:1, align:'left',   leading:1.35 },
  endMatterBody   :{ font:'serif', size:11, color:'#111111', alpha:1, align:'justify',leading:1.45 }
},
  toc:{ enabled:false, align:'left', count:0, items:[], numberingStyle:'roman' },

  content:{
    // chapters: [{ title, subsections:[{title, body, fmt:{cap, sub, cont}}] }]
    chapters:[]
  },
  export:{
    pageSize:'A4',
    margins:{ top:25, bottom:25, left:25, right:20 }, // mm siempre
    headerGapMm: 6,  // distancia cabecero → texto (mm)
    breakOnChapter: false, // salto de página al iniciar cada capítulo

    // ✅ NUEVO: apéndices finales
    citationsPageEnabled: true,     // “Citas” al final (filtradas por check)
    bibliographyEnabled: false,     // “Bibliografía” al final (filtrada por tipo)

    fileName:'ensayo.pdf'
  },

  // Citas globales del ensayo (número = índice + 1)
  citations:{
    // items: [{ word, text, type, includeInCitationsPage, capIdx, subIdx, createdAt }]
    items:[]
  }
};

function deepMergeStyles(dst, src){
  if(!src) return;
  for(const k of [
    'header','footer','pageNumbers','title','subtitle','author','metaBlock',
    // ✅ NUEVO
    'endMatterHeading','endMatterLabel','endMatterBody'
  ]){
    if(src[k]) dst[k] = {...dst[k], ...src[k]};
  }
}

/**
 * Fuerza el modelo estándar de alineaciones, ignorando lo que venga de estados antiguos.
 * - Portada: título/subtítulo/autor centrados.
 * - Metadatos: justificado.
 * - Índice: lista a la izquierda.
 * - Capítulos: título centrado; subsecciones a la izquierda; contenido justificado.
 */
function normalizeLayoutToStandard(S){
  if(!S || !S.styles) return;

  const st = S.styles;

  // Cabecero / pie / portada
  st.header.align    = 'justify';
  st.footer.align    = 'center';
  st.title.align     = 'center';
  st.subtitle.align  = 'center';
  st.author.align    = 'center';
  st.metaBlock.align = 'justify';
// ✅ NUEVO: asegurar estilos de secciones finales
if(!st.endMatterHeading) st.endMatterHeading = structuredClone(defaultState.styles.endMatterHeading);
if(!st.endMatterLabel)   st.endMatterLabel   = structuredClone(defaultState.styles.endMatterLabel);
if(!st.endMatterBody)    st.endMatterBody    = structuredClone(defaultState.styles.endMatterBody);

st.endMatterHeading.align = 'center';
st.endMatterLabel.align   = 'left';
st.endMatterBody.align    = 'justify';
  if(!S.toc) S.toc = {};
  S.toc.align = 'left';

  // ✅ preferencia de numeración
  S.toc.numberingStyle = normalizeChapterNumberingStyle(
    S.toc.numberingStyle || defaultState.toc.numberingStyle || 'roman'
  );

  if(S.content && Array.isArray(S.content.chapters)){
    S.content.chapters.forEach((cap, capIdx)=>{
      if(!cap || !Array.isArray(cap.subsections)) return;

      // ✅ subsección base SIEMPRE igual al título del capítulo
      const fallbackChapterTitle = t(
        'panel3.chapterDefaultTitle',
        `Capítulo ${capIdx+1}`,
        { index: capIdx + 1 }
      );
      if(cap.subsections[0]){
        cap.subsections[0].title = cap.title || cap.subsections[0].title || fallbackChapterTitle;
      }

      cap.subsections.forEach(sub=>{
        if(!sub) return;
        if(!sub.fmt) sub.fmt = {};
        sub.fmt.cap  = sub.fmt.cap  || {};
        sub.fmt.sub  = sub.fmt.sub  || {};
        sub.fmt.cont = sub.fmt.cont || {};
        sub.fmt.cap.align  = 'center';
        sub.fmt.sub.align  = 'left';
        sub.fmt.cont.align = 'justify';
      });
    });
  }
}

function loadState(){
  try{
    const raw = localStorage.getItem(LS_KEY);
    if(!raw){
      const clean = structuredClone(defaultState);
      normalizeLayoutToStandard(clean);
      return clean;
    }
    const obj = JSON.parse(raw);

    // merge profundo mínimo para conservar nuevos campos
    const out = structuredClone(defaultState);
    Object.assign(out.meta, obj.meta||{});
    deepMergeStyles(out.styles, obj.styles||{});
    out.toc = {...out.toc, ...(obj.toc||{})};
    out.content = obj.content || out.content;
    out.export = {...out.export, ...(obj.export||{})};

    // citas (nuevo)
    out.citations = structuredClone(defaultState.citations);
    if(obj.citations && typeof obj.citations === 'object'){
      if(Array.isArray(obj.citations.items)){
        out.citations.items = obj.citations.items;
      }else if(Array.isArray(obj.citations)){
        // compatibilidad (por si en el futuro se guarda como array)
        out.citations.items = obj.citations;
      }
    }

    normalizeLayoutToStandard(out);
    return out;
  }catch{
    const clean = structuredClone(defaultState);
    normalizeLayoutToStandard(clean);
    return clean;
  }
}
let state = loadState();

function saveState(){
  normalizeLayoutToStandard(state);
  localStorage.setItem(LS_KEY, JSON.stringify(state));
}

/* ===== Inicialización UI ===== */
document.addEventListener('DOMContentLoaded', () => {
  disableLegacyLicenseGate();

  initSteps();
  seedIndiceCount();
  bindPanel1();
  bindPanel2();
  bindPanel3();

  // ✅ NUEVO: hook de refresco i18n para toolbars inline (Formato / Atajos / tooltips)
  installInlineFormattingI18nHooks();

  // ✅ NUEVO: reubicar/restore de secciones finales según desktop vs móvil
  installPanel1EndMatterLayoutHooks();

  // Panel 4 vive en export.js (bindPanel4 + exportación)
  if(typeof bindPanel4 === 'function') bindPanel4();
  hydrateUIFromState();

  // ✅ por si el idioma cambia antes/después de hidratar, forzamos una pasada
  applyPanel1EndMatterUI();
  refreshInlineFormattingToolbars();

  if(typeof window.initVoiceControlsPanel1 === 'function'){
    window.initVoiceControlsPanel1(); // dictado vive en dictado.js
  }

  registerSW();
});

/* ===== Navegación por paneles ===== */
function initSteps(){
  $$('.step-btn').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      $$('.step-btn').forEach(b=>b.classList.remove('active'));
      btn.classList.add('active');
      const target = btn.getAttribute('data-target');
      $$('.panel').forEach(p=>p.classList.remove('active'));
      $(target).classList.add('active');
    });
  });
}

/* ===== Panel 1 ===== */
function bindPanel1(){
const map = {
  titulo:'#titulo',
  subtitulo:'#subtitulo',
  autor:'#autor',
  licencia:'#licencia',
  email:'#email',
  safeCreativeId:'#safeCreative',
  doi:'#doi',
  nota:'#nota',
  resumen:'#resumen',
  palabrasClave:'#palabrasClave',

  // ✅ NUEVO: secciones finales
  notaEditorial:'#notaEditorial',
  agradecimientos:'#agradecimientos',
  financiacion:'#financiacion',
  conflictosInteres:'#conflictosInteres',
  comoCitar:'#comoCitar',

  fechaPublicacion:'#fechaPublicacion'
};
  for(const [k, sel] of Object.entries(map)){
    $(sel).addEventListener('input', e=>{
      state.meta[k] = e.target.value;
      saveState();
      if(k==='titulo'){
        const newTitle = t(
          'app.windowTitleTemplate',
          `${state.meta.titulo} — ensaYOnesa`,
          { title: state.meta.titulo || '' }
        );
        document.title = newTitle;
      }
    });
  }
}

/* ===== Panel 2 ===== */

function ensurePageNumberPositionOptions(){
  const sel = $('#numPos');
  if(!sel) return;
  const existing = new Set([...sel.options].map(o=>o.value));

  const addOpt = (value, label) => {
    const opt = document.createElement('option');
    opt.value = value;
    opt.textContent = label;
    sel.appendChild(opt);
  };

  // Nuevo: centrado bajo el pie
  if(!existing.has('bottom-center')){
    addOpt(
      'bottom-center',
      t('panel2.pageNumbers.positionBottomCenter', 'Abajo centrado (bajo el pie)')
    );
  }
}

function bindPanel2(){
  // pestañas
  $$('.tab-btn').forEach(b=>{
    b.addEventListener('click', ()=>{
      $$('.tab-btn').forEach(x=>x.classList.remove('active'));
      $$('.tab-pane').forEach(x=>x.classList.remove('active'));
      b.classList.add('active');
      $(b.dataset.tab).classList.add('active');
    });
  });

  // Asegurar opciones extra de número de página
  ensurePageNumberPositionOptions();

  // Cabecero / Pie / Números
  $('#cabEnabled').addEventListener('change', e=>{ state.styles.header.enabled = e.target.checked; saveState(); });
  $('#cabEstiloLinea').addEventListener('change', e=>{ state.styles.header.line = e.target.value; saveState(); });

  const pieCitas = $('#pieCitasEnabled');
  if(pieCitas){
    pieCitas.addEventListener('change', e=>{ state.styles.footer.citationsEnabled = e.target.checked; saveState(); });
    pieCitas.disabled = !state.styles.footer.enabled;
  }

  $('#pieEnabled').addEventListener('change', e=>{
    state.styles.footer.enabled = e.target.checked;
    if(pieCitas) pieCitas.disabled = !e.target.checked;
    saveState();
  });
  $('#pieEstiloLinea').addEventListener('change', e=>{ state.styles.footer.line = e.target.value; saveState(); });
  $('#pieTexto').addEventListener('input', e=>{ state.styles.footer.text = e.target.value; saveState(); });

  $('#numEnabled').addEventListener('change', e=>{ state.styles.pageNumbers.enabled = e.target.checked; saveState(); });
  $('#numPos').addEventListener('change', e=>{ state.styles.pageNumbers.position = e.target.value; saveState(); });

  // Formatos globales (cab/pie/título/subtítulo/autor/meta)
  bindFormatBlock('Cab', state.styles.header);
  bindFormatBlock('Pie', state.styles.footer);
  bindFormatBlock2('Tit', state.styles.title);
  bindFormatBlock2('Sub', state.styles.subtitle);
  bindFormatBlock2('Aut', state.styles.author);
  bindFormatBlock2('Meta', state.styles.metaBlock);
// ✅ NUEVO: Secciones finales
bindFormatBlock2('EndHead', state.styles.endMatterHeading);
bindFormatBlock2('EndLabel', state.styles.endMatterLabel);
bindFormatBlock2('EndBody', state.styles.endMatterBody);
  // Índice
  $('#idxEnabled').addEventListener('change', e=>{ state.toc.enabled = e.target.checked; saveState(); });
}

function seedIndiceCount(){
  const sel = $('#idxCount');
  sel.innerHTML = '';
  for(let i=0;i<=50;i++){
    const opt = document.createElement('option');
    opt.value = i; opt.textContent = i.toString();
    sel.appendChild(opt);
  }
  sel.value = state.toc.count || 0;
  sel.addEventListener('change', e=>{
    state.toc.count = Number(e.target.value);
    // Ajustar arrays
    if(state.toc.items.length < state.toc.count){
      for(let i=state.toc.items.length;i<state.toc.count;i++){
        const defaultTitle = t(
          'panel2.toc.chapterDefaultTitle',
          `Capítulo ${i+1}`,
          { index: i + 1 }
        );
        // ✅ Ya NO se guarda página manual en el índice
        state.toc.items.push({title: defaultTitle});
      }
    }else{
      state.toc.items = state.toc.items.slice(0, state.toc.count);
    }
    // Sincronizar chapters del contenido
    syncChaptersWithTOC();
    saveState();
  });
}

function generateIdxFields(){
  const wrap = $('#idxCampos');
  wrap.innerHTML = '';
  state.toc.items.forEach((it, i)=>{
    const row = document.createElement('div');
    row.className = 'idx-row';
    row.style.display='grid';
    row.style.gridTemplateColumns='1fr'; // ✅ sin input de página
    row.style.gap='8px';
    row.style.margin='6px 0';

    const titleInput = document.createElement('input');
    titleInput.type='text';
    titleInput.value=it.title;
    titleInput.placeholder = t(
      'panel2.toc.chapterTitlePlaceholder',
      `Título del capítulo ${i+1}`,
      { index: i + 1 }
    );

    titleInput.addEventListener('input', e=>{
      state.toc.items[i].title = e.target.value;
      if(state.content.chapters[i]) state.content.chapters[i].title = e.target.value;
      refreshCapituloSelect();
      saveState();
    });

    row.appendChild(titleInput);

    // ✅ NUEVO: Formato inline (B/I/U) también en títulos de capítulos (Panel 2)
    bindInlineFormattingToTextarea(titleInput, { compact:true, showLabel:false, showHint:false });

    wrap.appendChild(row);
  });
}

/* ===== Panel 3 (Contenido) ===== */
function bindPanel3(){
  // popular selects
  refreshCapituloSelect();
  seedSubseccionesSelect();

  $('#selCapitulo').addEventListener('change', onCapituloChange);

  // Crear subsecciones automáticamente al cambiar el número
  $('#numSubsecciones').addEventListener('change', e=>{
    const capIdx = currentCapIdx();
    if(capIdx<0) return;
    const n = Number(e.target.value);
    ensureSubsections(capIdx, n);
    renderSubsectionTitleFields(capIdx);
    refreshSubseccionSelect(capIdx);
    loadCapFormatForChapter();
    loadSubsecAndContentFormats();
    saveState();
  });

  // Cambiar de subsección → sólo actualiza formatos de subsección + contenido
  $('#selSubseccion').addEventListener('change', ()=>{
    loadSubsecAndContentFormats();
  });

  // contenido
  const contenidoTA = $('#contenidoTexto');
  if(contenidoTA){
    contenidoTA.addEventListener('input', e=>{
      const capIdx = currentCapIdx(), subIdx = currentSubIdx();
      if(capIdx<0 || subIdx<0) return;
      state.content.chapters[capIdx].subsections[subIdx].body = e.target.value;
      saveState();
    });

    // ✅ Toolbar + Ctrl/Cmd+B/I/U
    bindInlineFormattingToTextarea(contenidoTA);
  }

  // Formatos:
  bindCapFormatInputs();                     // Título del capítulo (global por capítulo)
  bindFormatPerSub('Subsec', s=>s.fmt.sub);  // Título subsección
  bindFormatPerSub('Cont', s=>s.fmt.cont);   // Contenido

  $('#aplicarCapTodos').addEventListener('click', ()=>applyToAllInChapter('cap'));
  $('#aplicarSubsecTodos').addEventListener('click', ()=>applyToAllInChapter('sub'));
  $('#aplicarContTodos').addEventListener('click', ()=>applyToAllInChapter('cont'));

  // Citas (nuevo)
  bindCitationsUI();

  // ✅ Numeración (romanos/ar) — solo en Panel 3 + aplicar con botón
  ensureChapterNumberingStyleOptions();
  bindChapterNumberingStyleUI();
}

function refreshCapituloSelect(){
  const sel = $('#selCapitulo');
  sel.innerHTML = '';
  if(state.content.chapters.length===0){
    const opt = document.createElement('option');
    opt.value = -1;
    opt.textContent = t('panel3.noChaptersOption', '— Sin capítulos —');
    sel.appendChild(opt);
    sel.value = -1;
  }else{
    state.content.chapters.forEach((c,i)=>{
      const opt = document.createElement('option');
      const fallbackTitle = t(
        'panel3.chapterDefaultTitle',
        `Capítulo ${i+1}`,
        { index: i + 1 }
      );
      opt.value = i;
      const rawTitle = c.title || fallbackTitle;
      opt.textContent = `${i+1}. ${stripInlineFmtTags(rawTitle)}`;
      sel.appendChild(opt);
    });
    sel.value = 0;
  }
  onCapituloChange();
}

function onCapituloChange(){
  const capIdx = currentCapIdx();
  if(capIdx<0){
    $('#subsectionTitles').innerHTML='';
    $('#selSubseccion').innerHTML='';
    $('#contenidoTexto').value='';
    return;
  }
  const cap = state.content.chapters[capIdx];
  $('#numSubsecciones').value = Math.max(1, cap.subsections?.length || 1) - 1; // extras (excluye base [0])
  renderSubsectionTitleFields(capIdx);
  refreshSubseccionSelect(capIdx);
  loadCapFormatForChapter();
  loadSubsecAndContentFormats();
}

function seedSubseccionesSelect(){
  const sel = $('#numSubsecciones');
  sel.innerHTML = '';
  for(let i=0;i<=15;i++){
    const o=document.createElement('option'); o.value=i; o.textContent = i.toString();
    sel.appendChild(o);
  }
  sel.value = 0;
}

function ensureSubsections(capIdx, extras){
  const defaultChapterTitle = t(
    'panel3.chapterDefaultTitle',
    `Capítulo ${capIdx+1}`,
    { index: capIdx + 1 }
  );
  const cap = state.content.chapters[capIdx] || (
    state.content.chapters[capIdx] = {
      title: state.toc.items[capIdx]?.title || defaultChapterTitle,
      subsections:[]
    }
  );
  if(!cap.subsections) cap.subsections = [];

  // subsección base [0] con título = título del capítulo
  if(!cap.subsections[0]){
    const baseTitle = cap.title || defaultChapterTitle;
    cap.subsections[0] = {
      title: baseTitle,
      body:'',
      fmt:{
        cap:{font:'serif',size:24,color:'#111111',alpha:1,align:'center',leading:1.6},  // título de capítulo
        // ✅ 1) Subsec leading por defecto = 1.8
        sub:{font:'serif',size:18,color:'#111111',alpha:1,align:'left',leading:1.8},
        cont:{font:'serif',size:14,color:'#111111',alpha:1,align:'justify',leading:1.45}
      }
    };
  }else{
    cap.subsections[0].title = cap.title || cap.subsections[0].title || defaultChapterTitle;
    // asegurar campos nuevos
    cap.subsections[0].fmt.cap.align   ??= 'center';
    cap.subsections[0].fmt.sub.align   ??= 'left';
    cap.subsections[0].fmt.cont.align  ??= 'justify';
    cap.subsections[0].fmt.cap.leading ??= 1.6;
    // ✅ 1) fallback leading sub = 1.8
    cap.subsections[0].fmt.sub.leading ??= 1.8;
    cap.subsections[0].fmt.cont.leading??= 1.45;
  }

  const total = extras + 1; // incluye base
  while(cap.subsections.length < total){
    const secIndex = cap.subsections.length;
    const secTitle = t(
      'panel3.sectionDefaultTitle',
      `Sección ${secIndex}`,
      { index: secIndex }
    );
    cap.subsections.push({
      title: secTitle,
      body:'',
      fmt:{
        cap: structuredClone(cap.subsections[0].fmt.cap),
        sub: structuredClone(cap.subsections[0].fmt.sub),
        cont: structuredClone(cap.subsections[0].fmt.cont),
      }
    });
  }
  if(cap.subsections.length > total){
    cap.subsections = cap.subsections.slice(0,total);
  }
}

function renderSubsectionTitleFields(capIdx){
  const host = $('#subsectionTitles');
  host.innerHTML='';
  const cap = state.content.chapters[capIdx];
  if(!cap?.subsections) return;
  cap.subsections.forEach((s, i)=>{
    const fld = document.createElement('div'); fld.className='field';
    const label = document.createElement('label');
    if(i===0){
      label.textContent = t(
        'panel3.subsectionBaseLabel',
        'Subsección base'
      );
    }else{
      label.textContent = t(
        'panel3.subsectionLabel',
        `Título subsección ${i}`,
        { index: i }
      );
    }
    const input = document.createElement('input'); input.type='text'; input.value=s.title;
    if(i===0) input.disabled = true; // base
    input.addEventListener('input', e=>{
      cap.subsections[i].title = e.target.value;
      saveState();
      refreshSubseccionSelect(capIdx);
    });
    fld.appendChild(label);
    fld.appendChild(input);

    // ✅ NUEVO: Formato inline (B/I/U) en títulos de subsección (excepto base)
    if(!input.disabled){
      bindInlineFormattingToTextarea(input, { compact:true, showLabel:false, showHint:false });
    }

    host.appendChild(fld);
  });
}

function refreshSubseccionSelect(capIdx){
  const sel = $('#selSubseccion');
  sel.innerHTML='';
  const cap = state.content.chapters[capIdx];
  if(!cap?.subsections) return;
  const basePrefix = t('panel3.subsectionSelectBasePrefix', '(Base) ');
  cap.subsections.forEach((s,i)=>{
    const o = document.createElement('option');
    o.value=i;
    const rawTitle = s.title || '';
    o.textContent = `${i===0 ? basePrefix : ''}${stripInlineFmtTags(rawTitle)}`;
    sel.appendChild(o);
  });
  sel.value = 0;
}

function loadCapFormatForChapter(){
  const capIdx = currentCapIdx();
  if(capIdx<0) return;
  const cap = state.content.chapters[capIdx];
  if(!cap?.subsections?.[0]) return;
  setFormatPerSubInputs('Cap', cap.subsections[0].fmt.cap);
}

function loadSubsecAndContentFormats(){
  const capIdx = currentCapIdx(), subIdx = currentSubIdx();
  if(capIdx<0 || subIdx<0) return;
  const sub = state.content.chapters[capIdx].subsections[subIdx];
  setFormatPerSubInputs('Subsec', sub.fmt.sub);
  setFormatPerSubInputs('Cont', sub.fmt.cont);
  $('#contenidoTexto').value = sub.body || '';
}

function currentCapIdx(){ return Number($('#selCapitulo').value); }
function currentSubIdx(){ return Number($('#selSubseccion').value); }

function setFormatPerSubInputs(tag, fmt){
  $(`#fmt${tag}Font`).value = fmt.font;
  $(`#fmt${tag}Size`).value = fmt.size;
  $(`#fmt${tag}Color`).value = fmt.color;
  $(`#fmt${tag}Alpha`).value = Math.round((fmt.alpha ?? 1) * 100);
  const L = $(`#fmt${tag}Leading`); if(L) L.value = fmt.leading ?? 1.4;
}
function getFormatFromInputs(tag){
  return {
    font: $(`#fmt${tag}Font`).value,
    size: Number($(`#fmt${tag}Size`).value),
    color: $(`#fmt${tag}Color`).value,
    alpha: Number($(`#fmt${tag}Alpha`).value)/100,
    align: 'left',
    leading: Number($(`#fmt${tag}Leading`)?.value || 1.4)
  };
}

/* === Binder: Título de capítulo (formato global por capítulo) === */
function bindCapFormatInputs(){
  const inputs = [
    '#fmtCapFont', '#fmtCapSize', '#fmtCapColor', '#fmtCapAlpha',
    '#fmtCapLeading'
  ].map(sel=>$(sel)).filter(Boolean);
  inputs.forEach(inp=>{
    inp.addEventListener('input', ()=>{
      const capIdx = currentCapIdx();
      if(capIdx<0) return;
      const cap = state.content.chapters[capIdx];
      if(!cap?.subsections?.[0]) return;
      const fmt = cap.subsections[0].fmt.cap;
      fmt.font    = $('#fmtCapFont').value;
      fmt.size    = Number($('#fmtCapSize').value);
      fmt.color   = $('#fmtCapColor').value;
      fmt.alpha   = Number($('#fmtCapAlpha').value)/100;
      fmt.leading = Number($('#fmtCapLeading').value||1.6);
      fmt.align   = 'center'; // modelo estándar
      saveState();
    });
  });
}

/* === Binders por subsección (título subsec y contenido) === */
function bindFormatPerSub(tag, getter){
  const inputs = [
    `#fmt${tag}Font`, `#fmt${tag}Size`, `#fmt${tag}Color`,
    `#fmt${tag}Alpha`, `#fmt${tag}Leading`
  ].map(sel=>$(sel)).filter(Boolean);
  inputs.forEach(inp=>{
    inp.addEventListener('input', ()=>{
      const capIdx = currentCapIdx(), subIdx = currentSubIdx();
      if(capIdx<0 || subIdx<0) return;
      const sub = state.content.chapters[capIdx].subsections[subIdx];
      const fmt = getter(sub);
      fmt.font    = $(`#fmt${tag}Font`).value;
      fmt.size    = Number($(`#fmt${tag}Size`).value);
      fmt.color   = $(`#fmt${tag}Color`).value;
      fmt.alpha   = Number($(`#fmt${tag}Alpha`).value)/100;
      fmt.leading = Number($(`#fmt${tag}Leading`).value||1.4);
      // Alineaciones fijas según tipo
      if(tag === 'Cont'){
        fmt.align = 'justify';
      }else{
        fmt.align = 'left';
      }
      saveState();
    });
  });
}

/* === Aplicar a todas las subsecciones del capítulo === */
function applyToAllInChapter(kind /* 'cap'|'sub'|'cont' */){
  const capIdx = currentCapIdx();
  if(capIdx<0) return;
  let src;
  if(kind==='cap'){
    if(!state.content.chapters[capIdx]?.subsections?.[0]) return;
    src = state.content.chapters[capIdx].subsections[0].fmt.cap;
  }else{
    const subIdx = currentSubIdx();
    if(subIdx<0) return;
    src = state.content.chapters[capIdx].subsections[subIdx].fmt[kind];
  }
  state.content.chapters[capIdx].subsections.forEach(s=>{
    s.fmt[kind] = structuredClone(src);
  });
  saveState();
}

/* ===== Panel 3: Citas ===== */

// Marker en el texto: ^(N)  → se renderiza como superíndice en exportación
const CITE_MARK_RE = /\^\((\d+)\)/g;

// ✅ Tipos de nota al pie (UI): 3
// (mantenemos compatibilidad con estados antiguos que tenían 10)
const CITATION_TYPES = new Set([
  'bibliographic',
  'explanatory',
  'authorComment'
]);

// Compat con tipos antiguos (cuando había 10):
// - Los “bibliográficos”/referenciales → bibliographic
// - Los de contenido/metodología/terminología/agradecimientos → explanatory
const LEGACY_CITATION_TYPE_MAP = {
  mixed:           'bibliographic',
  remission:       'bibliographic',
  secondary:       'bibliographic',
  legal:           'bibliographic',

  methodological:  'explanatory',
  terminological:  'explanatory',
  acknowledgement: 'explanatory'
};

const DEFAULT_CITATION_TYPE = 'bibliographic';

function normalizeCitationType(type){
  const v = String(type || '').trim();
  if(CITATION_TYPES.has(v)) return v;
  if(LEGACY_CITATION_TYPE_MAP[v]) return LEGACY_CITATION_TYPE_MAP[v];
  return DEFAULT_CITATION_TYPE;
}

function normalizeCitationItem(c){
  if(!c || typeof c !== 'object') return;
  c.type = normalizeCitationType(c.type);
  if(typeof c.includeInCitationsPage !== 'boolean') c.includeInCitationsPage = true;
}

function ensureCitationsState(){
  if(!state.citations) state.citations = { items: [] };
  if(!Array.isArray(state.citations.items)) state.citations.items = [];
  state.citations.items.forEach(normalizeCitationItem);
}

function getCitations(){
  ensureCitationsState();
  return state.citations.items;
}

function bindCitationsUI(){
  const btnAdd = document.getElementById('btnAddCita');
  const btnDel = document.getElementById('btnDelCita');
  const sel = document.getElementById('selCita');
  const txt = document.getElementById('citaTexto');

  // ✅ NUEVO
  const typeSel = document.getElementById('citaTipo');
  const inEndChk = document.getElementById('citaInCitasEnabled');

  // Si el HTML todavía no tiene estos controles (por versiones antiguas), no hacemos nada
  if(!btnAdd || !btnDel || !sel || !txt) return;

  // ✅ Toolbar + Ctrl/Cmd+B/I/U también en la caja de cita
  bindInlineFormattingToTextarea(txt);

  btnAdd.addEventListener('click', addCitationFromSelection);
  btnDel.addEventListener('click', deleteCitationFromSelection);

  sel.addEventListener('change', ()=>{
    const items = getCitations();
    const idx = Number(sel.value);

    if(!Number.isFinite(idx) || idx < 0 || idx >= items.length){
      txt.value = '';
      return;
    }

    normalizeCitationItem(items[idx]);

    txt.value = items[idx].text || '';
    if(typeSel) typeSel.value = normalizeCitationType(items[idx].type);
    if(inEndChk) inEndChk.checked = (items[idx].includeInCitationsPage !== false);
  });

  txt.addEventListener('input', ()=>{
    const items = getCitations();
    const idx = Number(sel.value);
    if(!Number.isFinite(idx) || idx < 0 || idx >= items.length) return;
    items[idx].text = txt.value;
    saveState();
    // no refrescamos el select para no perder el foco
  });

  // ✅ Cambiar tipo (afecta a la cita seleccionada; si no hay, actúa como default para la próxima)
  if(typeSel){
    typeSel.addEventListener('change', ()=>{
      const items = getCitations();
      const idx = Number(sel.value);
      if(!Number.isFinite(idx) || idx < 0 || idx >= items.length) return;
      items[idx].type = normalizeCitationType(typeSel.value);
      saveState();
    });
  }

  // ✅ Incluir en la página final de Citas (por-cita)
  if(inEndChk){
    inEndChk.addEventListener('change', ()=>{
      const items = getCitations();
      const idx = Number(sel.value);
      if(!Number.isFinite(idx) || idx < 0 || idx >= items.length) return;
      items[idx].includeInCitationsPage = !!inEndChk.checked;
      saveState();
    });
  }

  refreshCitationsUI();
}

function refreshCitationsUI(selectNumber /* opcional: 1..N */){
  const sel = document.getElementById('selCita');
  const txt = document.getElementById('citaTexto');

  // ✅ NUEVO
  const typeSel = document.getElementById('citaTipo');
  const inEndChk = document.getElementById('citaInCitasEnabled');

  if(!sel || !txt) return;

  const items = getCitations();
  const prevIdx = Number(sel.value);

  sel.innerHTML = '';

  if(items.length === 0){
    sel.hidden = true;
    txt.hidden = true;
    txt.value = '';

    // Controles de tipo/check quedan visibles como “default” para la próxima cita
    if(typeSel) typeSel.value = normalizeCitationType(typeSel.value || DEFAULT_CITATION_TYPE);
    return;
  }

  sel.hidden = false;
  txt.hidden = false;

  items.forEach((c, i)=>{
    normalizeCitationItem(c);
    const o = document.createElement('option');
    const w = (c.word || '').trim();
    const labelWord = w.length > 42 ? (w.slice(0, 39) + '…') : w;
    o.value = i;
    o.textContent = `(${i+1}) ${labelWord || t('citations.untitledWord', '(sin palabra)')}`;
    sel.appendChild(o);
  });

  let idx = 0;
  if(Number.isFinite(selectNumber) && selectNumber >= 1){
    idx = Math.max(0, Math.min(items.length-1, selectNumber-1));
  }else if(Number.isFinite(prevIdx) && prevIdx >= 0 && prevIdx < items.length){
    idx = prevIdx;
  }

  sel.value = String(idx);

  const it = items[idx];
  normalizeCitationItem(it);

  txt.value = it.text || '';
  if(typeSel) typeSel.value = normalizeCitationType(it.type);
  if(inEndChk) inEndChk.checked = (it.includeInCitationsPage !== false);
}

function addCitationFromSelection(){
  const ta = document.getElementById('contenidoTexto');
  if(!ta) return;

  const capIdx = currentCapIdx();
  const subIdx = currentSubIdx();
  if(capIdx < 0 || subIdx < 0) return;

  const start = ta.selectionStart;
  const end   = ta.selectionEnd;
  if(start == null || end == null || start === end){
    alert(t('citations.alertSelectText', 'Selecciona una palabra (o fragmento) dentro del contenido para añadir una cita.'));
    return;
  }

  const selected = ta.value.slice(start, end);

  // ✅ IMPORTANTE: para el "word" de la cita, quitamos tags [b]/[i]/[u] si están dentro de la selección
  const cleaned = stripInlineFmtTags(selected).replace(/\s+/g,' ').trim();

  if(!cleaned){
    alert(t('citations.alertSelectText', 'Selecciona una palabra (o fragmento) dentro del contenido para añadir una cita.'));
    return;
  }

  // Si ya hay una cita justo después de la selección, no duplicamos
  const after = ta.value.slice(end, end + 16);
  const mExisting = after.match(/^\^\((\d+)\)/);
  if(mExisting){
    refreshCitationsUI(Number(mExisting[1]));
    return;
  }

  // ✅ NUEVO: leer tipo + “incluir en página de citas”
  const typeSel = document.getElementById('citaTipo');
  const inEndChk = document.getElementById('citaInCitasEnabled');

  const citeType = normalizeCitationType(typeSel ? typeSel.value : DEFAULT_CITATION_TYPE);
  const includeInCitationsPage = inEndChk ? !!inEndChk.checked : true;

  ensureCitationsState();
  const items = state.citations.items;
  const num = items.length + 1; // 1..N

  items.push({
    word: cleaned,
    text: '',
    type: citeType,
    includeInCitationsPage,
    capIdx,
    subIdx,
    createdAt: new Date().toISOString()
  });

  const marker = `^(${num})`;

  // Reemplaza la selección por el texto + marcador (aquí preservamos lo seleccionado tal cual)
  try{
    ta.setRangeText(selected + marker, start, end, 'end');
  }catch{
    // fallback manual
    ta.value = ta.value.slice(0,start) + selected + marker + ta.value.slice(end);
    ta.selectionStart = ta.selectionEnd = start + selected.length + marker.length;
  }

  // Persistir contenido
  state.content.chapters[capIdx].subsections[subIdx].body = ta.value;
  saveState();

  // UI
  refreshCitationsUI(num);
}

function findCitationNumberNearSelection(text, start, end){
  if(!text) return null;
  const s = Math.max(0, Number(start||0));
  const e = Math.max(s, Number(end||s));

  // 1) justo después
  let m = text.slice(e, e + 20).match(/^\^\((\d+)\)/);
  if(m) return Number(m[1]);

  // 2) dentro de la selección
  m = text.slice(s, e).match(/\^\((\d+)\)/);
  if(m) return Number(m[1]);

  // 3) justo antes
  m = text.slice(Math.max(0, s - 20), s).match(/\^\((\d+)\)$/);
  if(m) return Number(m[1]);

  // 4) alrededor (por si la selección fue muy estrecha)
  m = text.slice(Math.max(0, s - 20), Math.min(text.length, e + 20)).match(/\^\((\d+)\)/);
  if(m) return Number(m[1]);

  return null;
}

function deleteCitationFromSelection(){
  const ta = document.getElementById('contenidoTexto');
  if(!ta) return;

  ensureCitationsState();
  const items = state.citations.items;
  if(items.length === 0){
    alert(t('citations.alertNoCitations', 'No hay citas guardadas todavía.'));
    return;
  }

  const n = findCitationNumberNearSelection(ta.value, ta.selectionStart, ta.selectionEnd);
  if(!n){
    alert(t('citations.alertNoCitation', 'No se ha detectado ninguna cita en la selección. Selecciona la palabra que tenga ^(N) o justo alrededor.'));
    return;
  }

  if(n < 1 || n > items.length){
    alert(t('citations.alertNoCitation', 'No se ha detectado ninguna cita en la selección.'));
    return;
  }

  const ok = confirm(
    t(
      'citations.confirmDelete',
      `¿Eliminar la cita (${n}) y renumerar el resto?`,
      { number: n }
    )
  );
  if(!ok) return;

  deleteCitationByNumber(n);

  // refrescar textarea desde el estado actualizado
  loadSubsecAndContentFormats();
  refreshCitationsUI();
}

function deleteCitationByNumber(n){
  ensureCitationsState();
  const items = state.citations.items;
  if(!Number.isFinite(n) || n < 1 || n > items.length) return;

  // eliminar objeto de cita
  items.splice(n-1, 1);

  // renumerar marcadores en TODO el ensayo
  if(state.content && Array.isArray(state.content.chapters)){
    state.content.chapters.forEach(cap=>{
      if(!cap || !Array.isArray(cap.subsections)) return;
      cap.subsections.forEach(sub=>{
        if(!sub || typeof sub.body !== 'string') return;
        sub.body = sub.body.replace(CITE_MARK_RE, (full, numStr)=>{
          const num = Number(numStr);
          if(num === n) return '';
          if(num > n) return `^(${num-1})`;
          return full;
        });
      });
    });
  }

  saveState();
}

/* ===== Numeración (romanos vs arábigos) ===== */
function toRoman(num){
  const n = Math.floor(Number(num));
  if(!Number.isFinite(n) || n <= 0) return '';
  const map = [
    ['M',1000], ['CM',900], ['D',500], ['CD',400],
    ['C',100], ['XC',90], ['L',50], ['XL',40],
    ['X',10], ['IX',9], ['V',5], ['IV',4], ['I',1]
  ];
  let v = n, out = '';
  for(const [sym,val] of map){
    while(v >= val){ out += sym; v -= val; }
  }
  return out;
}

function normalizeChapterNumberingStyle(style){
  return (style === 'arabic' || style === 'roman') ? style : 'roman';
}

function chapterNumeral(n, style){
  const st = normalizeChapterNumberingStyle(style);
  return st === 'arabic' ? String(n) : toRoman(n);
}

// Detecta "I. " o "1. " al principio
const RE_CHAPTER_PREFIX = /^\s*(?:\d+|[IVXLCDM]+)\.\s+/i;

// Detecta "I.1. " o "1.1. " al principio (subsecciones)
const RE_SUBSECTION_PREFIX = /^\s*(?:\d+|[IVXLCDM]+)\.\d+\.\s+/i;
// ✅ Permite que el “Aplicar numeración” funcione aunque el título empiece por tags [b]/[i]/[u]
function splitLeadingInlineFmtOpenTags(s){
  const src = String(s || '');
  let i = 0;

  // saltar whitespace inicial
  while(i < src.length && /\s/.test(src[i])) i++;

  let lead = '';
  while(true){
    const m = src.slice(i).match(/^\[(b|i|u)\]/i);
    if(!m) break;
    lead += m[0];
    i += m[0].length;

    // saltar whitespace tras el tag
    while(i < src.length && /\s/.test(src[i])) i++;
  }

  return { lead, rest: src.slice(i) };
}
function ensureChapterPrefix(title, chapterIndex, style){
  const { lead, rest } = splitLeadingInlineFmtOpenTags(title);
  const base = String(rest || '').replace(RE_CHAPTER_PREFIX, '').trim();
  const prefix = `${chapterNumeral(chapterIndex, style)}. `;
  return (lead + prefix + base).trimEnd();
}

function ensureSubsectionPrefix(title, chapterIndex, subIndex, style){
  const { lead, rest } = splitLeadingInlineFmtOpenTags(title);
  const base = String(rest || '').replace(RE_SUBSECTION_PREFIX, '').trim();
  const si = Math.max(1, Math.floor(Number(subIndex) || 1));
  const prefix = `${chapterNumeral(chapterIndex, style)}.${si}. `;
  return (lead + prefix + base).trimEnd();
}

/**
 * Aplica el estilo de numeración a:
 * - títulos de capítulos
 * - títulos del TOC (si existe)
 * - títulos de subsecciones (I.1., I.2. / 1.1., 1.2.)
 * y mantiene la subsección base [0] = título del capítulo.
 *
 * Nota: aquí se añade numeración si no existía (solo cuando pulsas “Aplicar”).
 */
function applyChapterNumberingStyleToState(S, style){
  if(!S) return;
  if(!S.toc) S.toc = {};
  const st = normalizeChapterNumberingStyle(style ?? S.toc.numberingStyle ?? 'roman');
  S.toc.numberingStyle = st;

  if(!S.content || !Array.isArray(S.content.chapters)) return;

  const tocItems = Array.isArray(S.toc.items) ? S.toc.items : null;

  S.content.chapters.forEach((cap, iCap)=>{
    if(!cap) return;
    const chapterIndex = iCap + 1;

    const fallbackCapTitle = t(
      'panel3.chapterDefaultTitle',
      `Capítulo ${chapterIndex}`,
      { index: chapterIndex }
    );

    // Base para el texto del capítulo: prioridad cap.title, luego toc.title, luego fallback
    let rawCapTitle = (typeof cap.title === 'string' && cap.title.trim())
      ? cap.title
      : (tocItems && tocItems[iCap] && typeof tocItems[iCap].title === 'string' && tocItems[iCap].title.trim())
        ? tocItems[iCap].title
        : fallbackCapTitle;

    cap.title = ensureChapterPrefix(rawCapTitle, chapterIndex, st);

    // TOC (si existe)
    if(tocItems && tocItems[iCap]){
      const tocRaw = (typeof tocItems[iCap].title === 'string' && tocItems[iCap].title.trim())
        ? tocItems[iCap].title
        : rawCapTitle;

      tocItems[iCap].title = ensureChapterPrefix(tocRaw, chapterIndex, st);
    }

    // Sub-secciones
    if(Array.isArray(cap.subsections) && cap.subsections.length > 0){
      // Base: siempre igual al título del capítulo
      if(cap.subsections[0]){
        cap.subsections[0].title = cap.title;
      }

      // Resto: forzar prefijo I.1., I.2. ... / 1.1., 1.2. ...
      for(let iSub=1; iSub<cap.subsections.length; iSub++){
        const sub = cap.subsections[iSub];
        if(!sub) continue;

        const fallbackSubTitle = t(
          'panel3.sectionDefaultTitle',
          `Sección ${iSub}`,
          { index: iSub }
        );

        const rawSubTitle = (typeof sub.title === 'string' && sub.title.trim())
          ? sub.title
          : fallbackSubTitle;

        sub.title = ensureSubsectionPrefix(rawSubTitle, chapterIndex, iSub, st);
      }
    }
  });
}

function ensureChapterNumberingStyleOptions(){
  const sel = document.getElementById('chapterNumberingStyle');
  if(!sel) return;

  const existing = new Set([...sel.options].map(o=>o.value));
  const addOpt = (value, label) => {
    const opt = document.createElement('option');
    opt.value = value;
    opt.textContent = label;
    sel.appendChild(opt);
  };

  if(!existing.has('roman')){
    addOpt('roman', t('panel2.numbering.roman', 'Romanos (I, II, III)'));
  }
  if(!existing.has('arabic')){
    addOpt('arabic', t('panel2.numbering.arabic', 'Arábigos (1, 2, 3)'));
  }
}

function bindChapterNumberingStyleUI(){
  const sel = document.getElementById('chapterNumberingStyle');
  if(!sel) return;

  // evitar doble binding si se llama más de una vez
  if(sel.dataset.bound === '1') return;
  sel.dataset.bound = '1';

  const btn = document.getElementById('btnApplyChapterNumberingStyle');

  // Cambiar el select NO aplica: solo guarda preferencia
  sel.addEventListener('change', (e)=>{
    const style = normalizeChapterNumberingStyle(e.target.value);
    state.toc.numberingStyle = style;
    saveState();
  });

  // Aplicar (mutar títulos) solo al pulsar botón
  if(btn && btn.dataset.bound !== '1'){
    btn.dataset.bound = '1';
    btn.addEventListener('click', ()=>{
      const prevCap = currentCapIdx();
      const prevSub = currentSubIdx();

      const style = normalizeChapterNumberingStyle(sel.value);
      state.toc.numberingStyle = style;

      applyChapterNumberingStyleToState(state, style);

      saveState();
      hydrateUIFromState();

      // restaurar selección (cap/sub) para no “teletransportar” al usuario
      const capCount = state.content?.chapters?.length || 0;
      if(prevCap >= 0 && prevCap < capCount){
        const capSel = document.getElementById('selCapitulo');
        if(capSel){
          capSel.value = String(prevCap);
          onCapituloChange();

          const maxSub = state.content.chapters[prevCap]?.subsections?.length || 0;
          const safeSub = (maxSub > 0)
            ? Math.min(Math.max(prevSub, 0), maxSub - 1)
            : 0;

          const subSel = document.getElementById('selSubseccion');
          if(subSel && maxSub > 0){
            subSel.value = String(safeSub);
            loadSubsecAndContentFormats();
          }
        }
      }
    });
  }
}

/* ===== Sincronizar Índice ↔ Contenido ===== */
function syncChaptersWithTOC(){
  const N = state.toc.count || 0;
  while(state.content.chapters.length < N){
    const i = state.content.chapters.length;
    const fallbackTitle = t(
      'panel3.chapterDefaultTitle',
      `Capítulo ${i+1}`,
      { index: i + 1 }
    );
    state.content.chapters.push({
      title: state.toc.items[i]?.title || fallbackTitle,
      subsections: []
    });
    ensureSubsections(i, 0);
  }
  if(state.content.chapters.length > N){
    state.content.chapters = state.content.chapters.slice(0, N);
  }
  refreshCapituloSelect();
  generateIdxFields();
}

/* ===== Enlaces formatos panel 2 ===== */
function bindFormatBlock(prefix, target){
  const fontEl  = $(`#fmt${prefix}Font`);
  const sizeEl  = $(`#fmt${prefix}Size`);
  const colorEl = $(`#fmt${prefix}Color`);
  const alphaEl = $(`#fmt${prefix}Alpha`);
  const leadEl  = $(`#fmt${prefix}Leading`);

  if(fontEl)  fontEl.addEventListener('change', e=>{ target.font = e.target.value; saveState(); });
  if(sizeEl)  sizeEl.addEventListener('input',  e=>{ target.size = Number(e.target.value); saveState(); });
  if(colorEl) colorEl.addEventListener('input', e=>{ target.color = e.target.value; saveState(); });
  if(alphaEl) alphaEl.addEventListener('input', e=>{ target.alpha = Number(e.target.value)/100; saveState(); });
  if(leadEl)  leadEl.addEventListener('input',  e=>{ target.leading = Number(e.target.value)||1.4; saveState(); });
}
function bindFormatBlock2(prefix, target){ bindFormatBlock(prefix, target); }

/* ===== Hidratar UI con estado ===== */
function hydrateUIFromState(){
  // Panel 1
  $('#titulo').value = state.meta.titulo || '';
  $('#subtitulo').value = state.meta.subtitulo || '';
  $('#autor').value = state.meta.autor || '';
  $('#licencia').value = state.meta.licencia || '';
  $('#email').value = state.meta.email || '';
  $('#safeCreative').value = state.meta.safeCreativeId || '';
  $('#doi').value = state.meta.doi || '';
  $('#nota').value = state.meta.nota || '';
  $('#resumen').value = state.meta.resumen || '';
  $('#palabrasClave').value = state.meta.palabrasClave || '';

  // ✅ NUEVO
  $('#notaEditorial').value = state.meta.notaEditorial || '';
  $('#agradecimientos').value = state.meta.agradecimientos || '';
  $('#financiacion').value = state.meta.financiacion || '';
  $('#conflictosInteres').value = state.meta.conflictosInteres || '';
  $('#comoCitar').value = state.meta.comoCitar || '';
  $('#fechaPublicacion').value = state.meta.fechaPublicacion || '';

  // ✅ NUEVO: recolocar sección final en desktop + i18n real de labels/placeholders/hint
  applyPanel1EndMatterUI();

  // Panel 2: cab/pie/num
  $('#cabEnabled').checked = !!state.styles.header.enabled;
  $('#cabEstiloLinea').value = state.styles.header.line;

  $('#pieEnabled').checked = !!state.styles.footer.enabled;
  const pieCitas = $('#pieCitasEnabled');
  if(pieCitas){
    pieCitas.checked = (state.styles.footer.citationsEnabled !== false);
    pieCitas.disabled = !state.styles.footer.enabled;
  }
  $('#pieEstiloLinea').value = state.styles.footer.line;
  $('#pieTexto').value = state.styles.footer.text || '';

  // asegurar opción extra de centrado
  ensurePageNumberPositionOptions();

  $('#numEnabled').checked = !!state.styles.pageNumbers.enabled;
  $('#numPos').value = state.styles.pageNumbers.position;

  // fallback si el select no reconoce (por HTML viejo)
  if($('#numPos').value !== state.styles.pageNumbers.position){
    state.styles.pageNumbers.position = 'bottom-right';
    $('#numPos').value = 'bottom-right';
    saveState();
  }

  // formatos globales
  setFmtInputsFrom('Cab', state.styles.header);
  setFmtInputsFrom('Pie', state.styles.footer);
  setFmtInputsFrom('Tit', state.styles.title);
  setFmtInputsFrom('Sub', state.styles.subtitle);
  setFmtInputsFrom('Aut', state.styles.author);
  setFmtInputsFrom('Meta', state.styles.metaBlock);

  // ✅ NUEVO: Secciones finales
  setFmtInputsFrom('EndHead', state.styles.endMatterHeading);
  setFmtInputsFrom('EndLabel', state.styles.endMatterLabel);
  setFmtInputsFrom('EndBody', state.styles.endMatterBody);

  // índice
  $('#idxEnabled').checked = !!state.toc.enabled;
  $('#idxCount').value = state.toc.count || 0;
  generateIdxFields();

  // numeración capítulos (si el control existe en el HTML)
  ensureChapterNumberingStyleOptions();
  const numSel = document.getElementById('chapterNumberingStyle');
  if(numSel){
    numSel.value = normalizeChapterNumberingStyle(state.toc.numberingStyle || 'roman');
  }

  // contenido
  refreshCapituloSelect();
  seedSubseccionesSelect();

  // citas
  refreshCitationsUI();

  // Panel 4 (Exportar) vive en export.js
  if(typeof hydratePanel4FromState === 'function'){
    hydratePanel4FromState();
  }
}

function setFmtInputsFrom(prefix, obj){
  const fontEl  = $(`#fmt${prefix}Font`);
  const sizeEl  = $(`#fmt${prefix}Size`);
  const colorEl = $(`#fmt${prefix}Color`);
  const alphaEl = $(`#fmt${prefix}Alpha`);
  const leadEl  = $(`#fmt${prefix}Leading`);

  if(fontEl)  fontEl.value  = obj.font;
  if(sizeEl)  sizeEl.value  = obj.size;
  if(colorEl) colorEl.value = obj.color;
  if(alphaEl) alphaEl.value = Math.round((obj.alpha ?? 1)*100);
  if(leadEl)  leadEl.value  = obj.leading ?? 1.4;
}

/* ===== PWA ===== */
function registerSW(){
  if('serviceWorker' in navigator){
    navigator.serviceWorker.register('./sw.js').catch(()=>{});
  }
}
