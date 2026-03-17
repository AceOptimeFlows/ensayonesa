# ensaYOnesa

**ensaYOnesa** is an offline-first Progressive Web App for writing, formatting, previewing, and exporting essays as print-ready PDFs.

It is designed as a local-first editorial workspace: you can create a cover page, manage metadata, structure chapters and subsections, format content, add citations, insert images, preview the final layout, and export the document through the browser's print-to-PDF workflow.

The project is built with **plain HTML, CSS, and JavaScript**. There is **no build step, no framework, and no required backend** in the current free-mode build.

---

## Table of contents

- [Highlights](#highlights)
- [What the app does](#what-the-app-does)
- [Feature overview](#feature-overview)
- [How it works](#how-it-works)
- [Project structure](#project-structure)
- [Quick start](#quick-start)
- [Usage flow](#usage-flow)
- [Data storage and privacy](#data-storage-and-privacy)
- [Localization](#localization)
- [Browser compatibility](#browser-compatibility)
- [Important implementation notes](#important-implementation-notes)
- [Development notes](#development-notes)
- [License](#license)
- [Author](#author)

---

## Highlights

- **Offline-first PWA** with installable app shell and service worker caching
- **Local-first editing** with browser storage for state, templates, and assets
- **Cover page + metadata** for author, license, abstract, keywords, DOI, Safe Creative ID, and more
- **Rich document structure** with chapters, subsections, table of contents, and numbering styles
- **Per-section typography controls** for cover, metadata, header, footer, chapter titles, subsection titles, content, and final sections
- **Inline formatting** with lightweight BBCode-like tags: `[b]`, `[i]`, `[u]`
- **Footnote/citation workflow** with inline markers like `^(N)` and editable note metadata
- **Final appendix pages** for citations, bibliography, and editorial statements
- **Local image insertion** stored in IndexedDB and rendered in preview/export
- **Live preview panel** that reuses the export renderer
- **Print-ready PDF export** via a browser print window
- **Voice dictation** through the browser's speech recognition API
- **Internationalized UI** with multiple language packs
- **No bundler, no framework, no package manager required**

---

## What the app does

ensaYOnesa is not a generic rich-text editor. It is a focused essay-production tool.

It helps you move from raw text to a structured, styled, and exportable document with:

- a title page
- author and publication metadata
- configurable headers, footers, and page numbers
- chapter/subsection structure
- inline citations and footnotes
- end matter pages such as bibliography, acknowledgments, editorial note, conflicts of interest, and citation instructions
- a preview pane that reflects the export renderer
- a final print/PDF output optimized for A4, A5, and 6"×9" layouts

---

## Feature overview

### 1. Cover and metadata

The app includes dedicated fields for:

- Title
- Subtitle
- Author
- License
- Correspondence / email
- Publication date
- Safe Creative ID
- DOI
- Note
- Abstract / summary
- Keywords

It also supports **final sections** that are exported to a dedicated end page instead of the cover:

- Editorial note
- Acknowledgments
- Funding
- Conflicts of interest
- How to cite

### 2. Layout and typography controls

You can configure styling for:

- Header
- Footer
- Page numbers
- Cover title
- Cover subtitle
- Cover author
- Metadata block
- Final page heading
- Final section labels
- Final section body text

Document export settings include:

- Page size: **A4**, **A5**, **6"×9" (KDP-style)**
- Margins in millimeters
- Header-to-text spacing
- Optional page break at each new chapter
- Optional final citations appendix
- Optional final bibliography
- Export file name

### 3. Chapter and subsection editing

The content model is organized by:

- Chapter / point
- Number of subsections
- Per-subsection content

The app supports **Roman** and **Arabic** numbering styles and can automatically apply numbering prefixes to chapter and subsection titles.

### 4. Inline text formatting

The content editor supports lightweight inline formatting with tags such as:

- `[b]bold[/b]`
- `[i]italic[/i]`
- `[u]underline[/u]`

Formatting shortcuts are also exposed through the editor toolbar and keyboard bindings.

### 5. Citations and footnotes

The citation workflow is centered around markers like `^(N)` embedded in content.

For each citation, the app stores structured note data including:

- cited word/selection
- note text
- note type
- chapter/subsection position
- inclusion in the final citations appendix

Current note types in the UI include:

- Bibliographic note
- Explanatory/content note
- Author comment

Bibliographic notes can also feed the final bibliography section depending on export settings.

### 6. Images

Images can be inserted into the content flow as block markers in the form:

```text
[img:<id>]
```

The actual image files are stored locally in **IndexedDB**, not embedded inside the project JSON.

This keeps saved projects lighter, but it also means image assets are tied to the current browser storage unless you implement a custom asset transfer flow.

### 7. Live preview

The app includes a dedicated **Preview** panel that uses the same rendering pipeline as the export engine, but in non-print mode.

This lets you:

- inspect layout before export
- zoom in/out
- fit to width
- refresh the preview
- validate pagination, headers, footers, citations, and images visually

### 8. Export

Export is handled by a client-side HTML print layout.

The app opens a print-ready rendering in a separate window and relies on the browser's print engine to:

- print to paper, or
- save as PDF

This approach avoids external PDF libraries and keeps the export pipeline fully local to the browser.

### 9. Voice dictation

ensaYOnesa includes browser-based speech dictation for selected text fields and supports configurable dictation language selection.

The implementation adds:

- start/stop controls
- live status indicators
- repeated-result mitigation
- fallback handling when engines do not flag final speech chunks correctly
- diagnostics for unsupported environments, insecure contexts, and WebViews

---

## How it works

At a high level, the app uses the browser as its execution and storage environment:

- **Application state** is stored in `localStorage`
- **UI language** and some settings are also stored in browser storage
- **Image assets** are stored in `IndexedDB`
- **Offline behavior** is provided by a service worker and cache storage
- **Preview** reuses the export renderer in preview mode
- **PDF export** is generated through browser printing, not through a bundled PDF SDK
- **Dictation** uses the browser's speech recognition implementation

This makes the app simple to host, simple to fork, and easy to deploy as a static site.

---

## Project structure

```text
.
├── assets/
│   └── img/
│       ├── ensayonesa180.png
│       ├── ensayonesa192.png
│       ├── ensayonesa512.png
│       ├── ensayonesa-maskable-192.png
│       ├── ensayonesa-maskable-512.png
│       └── logo.png
├── lang/
│   ├── ar.json
│   ├── de.json
│   ├── en.json
│   ├── es.json
│   ├── fr.json
│   ├── hi.json
│   ├── it.json
│   ├── ja.json
│   ├── ko.json
│   ├── pt-br.json
│   ├── ru.json
│   └── zh.json
├── app.js
├── dictado.js
├── export.js
├── i18n.js
├── index.html
├── LICENSE
├── manifest.webmanifest
├── preview.js
├── styles.css
└── sw.js
```

### Main modules

- **`index.html`** — application shell, overlays, settings sheet, panel markup, free-mode bootstrap
- **`styles.css`** — app styling, layout, theme system
- **`app.js`** — state model, UI binding, chapter logic, citations logic, persistence, service worker registration
- **`export.js`** — print layout engine, pagination, cover/index generation, appendix generation, browser print export
- **`preview.js`** — preview panel, zoom controls, preview rendering, image insertion tooling
- **`dictado.js`** — speech recognition integration and dictation UX
- **`i18n.js`** — lightweight JSON-based localization loader and DOM binding layer
- **`sw.js`** — offline caching strategy and runtime asset handling

---

## Quick start

### Option A — Python static server

```bash
python3 -m http.server 8080
```

Then open:

```text
http://localhost:8080
```

### Option B — Node static server

```bash
npx serve .
```

### Option C — Deploy to any static host

You can deploy the project to any static hosting platform as-is, for example:

- GitHub Pages
- Netlify
- Vercel (static output)
- Cloudflare Pages
- any plain HTTPS web server

### Important

For the full feature set, use **HTTPS or `localhost`**.

Some browser APIs used by the app require a secure context, especially:

- service workers
- installable PWA behavior
- speech recognition / microphone access in many environments

Opening the app directly via `file://` is **not recommended**.

---

## Usage flow

### 1. Fill the cover and metadata

Use **Panel 1** to define:

- title and subtitle
- author and publication metadata
- note, abstract, and keywords
- end sections such as acknowledgments or editorial note

### 2. Configure layout and styles

Use **Panel 2** to control:

- header/footer visibility
- line styles
- page numbering
- typography
- chapter numbering style
- table of contents

### 3. Write content

Use **Panel 3** to:

- define the number of chapters and subsections
- edit titles and body content
- apply inline formatting
- insert citations
- insert images through the editor toolbar

### 4. Save or load work

Use **Panel 4** to:

- save the full project as JSON
- load a previously saved project
- save and reuse style templates
- load a full demo essay

### 5. Preview and export

Use **Panel 5** to validate the layout.

When ready, use **Export** to open the print-ready document and save it as PDF from the browser print dialog.

---

## Data storage and privacy

ensaYOnesa is primarily a **local-first browser app**.

### Stored locally

Depending on the feature being used, the app may store data in:

- `localStorage`
- `sessionStorage`
- `IndexedDB`
- browser cache storage (through the service worker)

This is used for things like:

- project state
- selected language
- dictation language
- saved templates
- inserted images
- offline shell caching

### Dictation privacy note

Voice dictation uses the browser's speech recognition API.

Depending on the browser, device, and operating system configuration, speech processing may happen:

- locally on the device, or
- through the browser/vendor/system recognition service

The current app does **not** upload your audio or document files to OptimeFlow(s) servers as part of its own export/editing workflow. However, the browser's speech recognition provider may process audio externally when dictation is enabled.

### Current build mode

The current distributed build includes a **free-mode compatibility layer**, so it can run without sign-in or backend activation.

---

## Localization

The app includes language packs for:

- Arabic
- Chinese
- English
- French
- German
- Hindi
- Italian
- Japanese
- Korean
- Portuguese (Brazil)
- Russian
- Spanish

Translations are loaded from:

```text
./lang/<language-code>.json
```

### Notes

- **Spanish** is the default UI language.
- Language files are loaded from `./lang/` on demand by the i18n layer.
- Once fetched successfully, they may also become available offline through normal browser/runtime caching depending on the session and service worker lifecycle.

---

## Browser compatibility

### Recommended

For the best overall experience:

- latest **Chrome**
- latest **Edge**
- modern Chromium-based desktop browsers

### Expected to work well for core editing/export

- modern desktop browsers with good support for:
  - CSS print rendering
  - service workers
  - IndexedDB
  - modern JavaScript APIs

### Dictation-specific caveats

Speech recognition support is more fragile than the rest of the app.

Dictation works best in browsers with robust Web Speech API support. The codebase explicitly warns about weaker support in:

- Android WebViews
- insecure contexts
- environments where the recognition engine exists but does not return usable result events

If dictation matters, **Chrome/Edge on HTTPS or `localhost`** is the safest target.

---

## Important implementation notes

### 1. PDF export uses the browser print engine

The export pipeline is local and framework-free, but final PDF output can still vary slightly depending on:

- browser version
- print engine differences
- platform font rendering

### 2. Project JSON does not embed image binaries

Projects exported as JSON include document state, text, styles, citations, and export settings, but **not the binary blobs for inserted images**.

Images are stored separately in `IndexedDB`.

### 3. First offline use requires an initial online load

The service worker can cache the shell for offline use, but the app must be opened successfully at least once in a supported context.

### 4. Translation files are runtime assets

Translation files are fetched at runtime by the i18n layer and may then become available offline through normal caching behavior.

### 5. The current build is static and self-contained

There is no required bundler, package manager, or backend dependency to run the distributed app in its current form.

---

## Development notes

This project is intentionally simple to edit.

### Development style

- static files
- no transpilation
- no framework abstraction
- direct DOM manipulation
- JSON-based i18n

### Suggested workflow

1. Run the app from a local static server
2. Edit HTML/CSS/JS directly
3. Test:
   - editing flow
   - export flow
   - preview flow
   - offline install/update behavior
   - dictation behavior in target browsers
4. Bump service worker cache version when needed

### When changing translations

Update the files under `lang/` and verify:

- `data-i18n`
- `data-i18n-placeholder`
- `data-i18n-title`
- `data-i18n-aria-label`
- overlay HTML content injected through i18n

### When changing export behavior

Keep in mind that:

- preview reuses the export renderer
- footnotes, appendices, and images affect pagination
- browser print rendering can expose subtle layout differences

---

## License

This project is distributed under the **MIT License**.

See [LICENSE](./LICENSE) for the full text.

---

## Author

**Andrés Calvo Espinosa**  
OptimeFlow(s)

- Website: https://www.optimeflow.com
- ORCID: https://orcid.org/0009-0005-4079-7418

---

## Summary

ensaYOnesa is a focused, local-first essay production app built for people who want a clean editorial workflow without a heavy toolchain.

If you want a static, installable, multilingual writing tool that can structure essays, manage citations, preview the final layout, and export print-ready PDFs directly in the browser, this project is a strong base to build on.
