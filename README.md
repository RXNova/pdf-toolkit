# PDF Toolkit

Merge, split, compress, rotate, watermark and password-protect PDFs **entirely in the browser**. There's no server: files are processed on the user's device and never uploaded. The build is a static site you can host anywhere (GitHub Pages, Netlify, Cloudflare Pages, S3).

## Tools

| Tool | How it works |
|---|---|
| Merge, Split (drag to group pages; zip download), Extract, Remove, Organize, Rotate | [pdf-lib](https://pdf-lib.js.org) |
| Crop & resize (trim margins, or fit onto A4/Letter/A5/Legal) | pdf-lib (crop box; pages embedded and scaled) |
| JPG/PNG to PDF, Watermark (fonts, angles, tiled, behind content), Page numbers, Header & footer | pdf-lib |
| Fill & sign: fill form fields (then flatten or keep editable); add signatures (draw or type), text, dates and images (logos, stamps), dragged into place, on one page or every page | pdf-lib (forms API, images, text); signatures are drawn on a canvas in the browser |
| Edit metadata (or remove all document properties) | pdf-lib |
| PDF to JPG / PNG | [pdf.js](https://mozilla.github.io/pdf.js/) renders pages to a canvas; runs on the UI thread |
| Compress | Re-encodes embedded photos/scans as JPEG at capped resolution using the browser's own encoder (`OffscreenCanvas`), then re-packs the file |
| Protect / Unlock (AES-256) | [qpdf](https://qpdf.sourceforge.io) compiled to WebAssembly (1.3 MB, loaded only when used) |

Previews (file cards, page grids, the page viewer and live previews) are drawn with pdf.js, loaded on first use.

Processing runs in a Web Worker, so the page stays responsive with large files. The one exception is PDF to JPG / PNG: it needs the browser's PDF renderer, whose own worker does the heavy work.

Page ranges look like `1-3, 5, 8-` (`8-` is page 8 to the end, `5-1` is pages 5 down to 1).

## Develop

Requires Node.js 20+.

```bash
npm install
npm run dev        # http://localhost:5173 with hot reload
npm run build      # static site in dist/
npm run preview    # serve the production build at http://localhost:4173
```

| Command | What it does |
|---|---|
| `npm test` | Unit tests (Vitest): core and worker in Node, UI in jsdom |
| `npm run test:coverage` | Unit tests with coverage (fails below 90% lines / 85% branches) |
| `npm run test:e2e` | Builds, then runs Playwright against the production build in Chromium, Firefox and WebKit |
| `npm run lint` | ESLint |
| `npm run test:all` | Lint + coverage + e2e |

E2E options:
- **`E2E_BROWSERS=chromium,webkit`** runs a subset of browser engines.
- **`E2E_TARGET=dev`** tests the dev server instead of the build.

First-time setup: run `npx playwright install` to download the browser engines.

> **macOS 27 note:** Playwright's Firefox build currently fails to launch on macOS 27 ("Could not find profile folder"). Locally, use `E2E_BROWSERS=chromium,webkit`. CI runs all three engines on Linux.

## Deploy

Live at **https://pdfkit.rxnova.dev**, served by Cloudflare as static assets (`wrangler.jsonc`):

```bash
npx wrangler login   # once
npm run deploy       # build, then upload dist/ and attach the custom domain
```

`public/_headers` sets security and cache headers on Cloudflare.

Any static host works too: `dist/` is plain static files with relative URLs, so it works from any path. CI (`.github/workflows/ci.yml`) runs lint, unit tests with coverage, and e2e in Chromium, Firefox and WebKit.

The build includes a strict Content-Security-Policy:
- `connect-src 'self'`: the page cannot send data to any other origin.
- `'wasm-unsafe-eval'`: allows only the qpdf WebAssembly to compile.

## Architecture

```
index.html
src/
  catalog.js         Tool catalog: the single source of truth for ids, accepted files, output names, option schema
  core/              Pure JS: no DOM, no Node APIs. Runs in the worker and under Node tests
    toolkit.js         Public entry point: validates requests, parses options, names outputs, dispatches
    tools/             One handler per tool: ({ files, options, name, deps }) → { outputs, summary?, note? }
    options.js         Validates and coerces form values against the catalog schema
    page-ranges.js     "1-3, 5, 8-" parser
    pdf.js             pdf-lib helpers that turn library errors into user-facing ones
    qpdf.js            qpdf-wasm adapter (module factory injected; decides by exit code)
    names.js, errors.js
  worker/
    pdf.worker.js      Worker entry: wires the toolkit to browser deps (composition root)
    protocol.js        Message handler: request → result, with zero-copy buffer transfer
    image-codec.js     ImageCodec on createImageBitmap + OffscreenCanvas
  app/               React UI
    client.js          Promise API over the worker: lazy start, request ids, crash recovery
    services.js        App singletons (the one module UI tests mock)
    files.js           Reading Files, zipping outputs (fflate), accept attributes
    hooks/             useToolRunner (run state machine), useObjectUrl (blob URL lifecycle)
    components/        Home, ToolView, DropZone, FileList, OptionsForm, Status, DownloadLink
tests/
  helpers/           Generated fixtures (PDF/PNG/JPG bytes), PDF inspection, real qpdf loader
  e2e/               Playwright specs: upload → run → download → inspect the actual output
```

Unit tests sit next to the code they test (`*.test.js`).

**Design decisions**

- **Bytes in, bytes out.** Tools never touch files, URLs or the DOM. That's what lets the same code run in a Web Worker and in Node tests.
- **Dependencies injected at the edges.** qpdf and the image codec are passed in. Unit tests run the real qpdf WebAssembly binary from `node_modules` and use a fake image codec. E2E covers the real canvas codec in each browser engine.
- **One catalog, two consumers.** The UI renders forms from `catalog.js`, and the core validates against the same schema. A contract test fails if a catalog entry has no handler, or a handler has no entry.
- **Two error types.** `UserError` messages are shown as-is. Anything else is logged in the worker and reported as "Unexpected error". A worker crash rejects its pending requests, and the client starts a fresh worker.
- **Privacy is tested, not just claimed.** Every e2e test fails if the page requests any other origin. One test turns the network off and runs a tool anyway.
- **No AGPL dependencies.** Compress uses the browser's own JPEG encoder instead of Ghostscript (AGPL), so the app stays freely licensable. qpdf is Apache-2.0 and its WebAssembly build is ISC.
- **No binary fixtures.** Test PDFs and images are generated in code.

### Adding a tool

1. Add an entry to `TOOL_CATALOG` in `src/catalog.js`, including its options. The form appears automatically.
2. Add `src/core/tools/<id>.js` and register it in `src/core/tools/index.js`.
3. Add a unit test next to it and an e2e case in `tests/e2e/tools.spec.js`.

## License

[MIT](LICENSE) © RXNova. Third-party libraries keep their own licenses: pdf-lib (MIT), pdf.js (Apache-2.0), qpdf (Apache-2.0) and its WebAssembly build (ISC), fflate (MIT), React (MIT).
