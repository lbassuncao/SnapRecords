# SnapRecords Build Guide

Build, test, and package SnapRecords **1.20.0** with Vite, Sass, and Jest.

For the public API and query contract, see [CONFIG.md](./CONFIG.md). For 1.1.x → 1.20.0 renames, see [RELEASES.md](../RELEASES.md).

## Installation

```bash
npm install
```

Runtime dependencies (`dexie`, `immer`, `lru-cache`) and the toolchain (`vite`, `typescript`, `sass`, `jest`, `vite-plugin-dts`) come from `package.json`.

## Scripts

Defined in `package.json`:

| Script                      | What it does                                                                   |
| --------------------------- | ------------------------------------------------------------------------------ |
| `npm run dev`               | Vite library dev server                                                        |
| `npm run build`             | JS bundle + CSS + copy `src/lang/*.json` → `dist/lang/`                        |
| `npm run build:js`          | `vite build` only (`snap-records.es.js`, `snap-records.umd.cjs`, `index.d.ts`) |
| `npm run build:css`         | Sass → `dist/snap-records.css` (compressed, source map)                        |
| `npm test`                  | Jest + JSDOM (`tests/`)                                                        |
| `npm run demo:preview`      | Preview the built demo (`demo/dist/`), including the mock `/api/books`         |
| `npm run lint` / `lint:fix` | ESLint on `src/**/*.{js,ts}`, `demo/**/*.ts`, and `tests/**/*.ts`              |
| `npm run format`            | Prettier on the whole repo (`prettier --write .`)                              |
| `npm run demo:dev`          | Demo app (`vite.config.demo.ts`)                                               |
| `npm run demo:build`        | Production build of the demo                                                   |

```bash
npm run build
```

Output:

```
dist/
├── index.d.ts
├── lang/
│   ├── en_US.json
│   ├── es_ES.json
│   └── pt_PT.json
├── snap-records.css
├── snap-records.css.map
├── snap-records.es.js
├── snap-records.es.js.map
├── snap-records.umd.cjs
└── snap-records.umd.cjs.map
```

The package exports `snap-records/lang/*` from `dist/lang/*` and `snap-records/style.css` from `dist/snap-records.css`.

## Tests

Tests live in `tests/`, configured by `jest.config.js` (JSDOM, `ts-jest`, ESM). `tests/setupTests.ts` sets up the environment. `tests/SnapRecords.test.ts` covers init, `ISnapApi`, sorting (`sorting[column]`), pagination (`currentPage`), themes, and list mode.

```bash
npm test
npm run build
```

Add a test under `tests/` (e.g. `MyFeature.test.ts`). Import from `../src/index`. Mock `fetch` when you need a specific payload.

CI runs `npm run lint`, `npm run format:check`, `npm test`, and `npm run build` on Node 26.7.0 (see `.github/workflows/ci.yml`).

The demo mock API in `vite.config.demo.ts` reads `currentPage` and `rowsPerPage` (not `page` / `perPage`).

## Vite (`vite.config.ts`)

Library mode, entry `src/index.ts`, name `SnapRecords`:

- Output: `dist/snap-records.es.js` (ESM) and `dist/snap-records.umd.cjs` (UMD/CommonJS — `.cjs`, not `.js`, so `require()` works under this package's `"type": "module"`)
- `sourcemap: true`
- `minify: 'terser'` with `drop_console` and `drop_debugger`
- `vite-plugin-dts`: `bundleTypes: true`, `processor: 'ts'`, `insertTypesEntry: true` → single `dist/index.d.ts`
- CSS assets renamed to `snap-records.[ext]`
- `dexie`, `immer`, and `lru-cache` are **bundled** (not marked `external`)

To treat those libraries as peer/external dependencies instead, add `rollupOptions.external` and UMD `globals` in `vite.config.ts`.

## TypeScript (`tsconfig.json`)

- `strict: true`, `target: ES6`, `module: esnext`
- `declaration: true` (consumed by `vite-plugin-dts`; `package.json` `"types"` points at `./dist/index.d.ts`)
- `resolveJsonModule: true` for `src/lang/*.json`
- `exclude`: `node_modules`, `dist`, `tests`

## ESLint and Prettier

`eslint.config.js` uses `typescript-eslint` and Prettier. `vite.config.ts` is ignored by ESLint.

```bash
npm run lint
npm run format
```

## Notes

- **Version**: `package.json` is `1.20.0`.
- **Translations**: copied into `dist/lang/` by `npm run build`. Host apps still need those files reachable at `langPath` (default `/lang`) at runtime.
- **Tree-shaking**: prefer the ES build (`snap-records.es.js` / `"module"` / `"exports.import"`).
- **Demo**: `npm run demo:dev` serves a sample table against `/api/books` with 1.20.0 query params.
