# @vitest/istanbul-report-html-modern

Modern Istanbul HTML coverage report:

- **React library** — `import { ReportApp } from "@vitest/istanbul-report-html-modern"` + `import "@vitest/istanbul-report-html-modern/style.css"`
- **Single-file HTML page** — `dist/page/index.html` (used by `@vitest/istanbul-lib-report`’s `html-modern` report)

## Layout

```
src/
  lib/     # component library (tsdown → dist/index.js)
  page/    # single-file HTML shell (vite → dist/page/index.html)
```

The page build imports only the public library API, not lib internals.

## Scripts

```bash
pnpm build   # dist/index.js + style.css, then dist/page/index.html
pnpm dev     # full report page; reads coverage/report-data.json (generate via pnpm test)
pnpm play    # UI playground (library API)
```
