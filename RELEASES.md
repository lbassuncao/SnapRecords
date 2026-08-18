# Releases

## 1.20.0

Breaking release. State, public API, HTTP query strings, and `usePushState` now share one vocabulary.

Upgrade from `1.1.x` by renaming the symbols below. There are no compatibility aliases.

### Public API methods

| 1.1.x                                       | 1.20.0                                     |
| ------------------------------------------- | ------------------------------------------ |
| `api.gotoPage(n)`                           | `api.setCurrentPage(n)`                    |
| `api.setRenderMode(mode)`                   | `api.setFormat(mode)`                      |
| `search(filters, merge?)`                   | `search(filtering, merge?)`                |
| `updateParams({ filters, sortConditions })` | `updateParams({ filtering, sorting })`     |
| `setTheme('light' \| 'dark')`               | `setTheme('light' \| 'dark' \| 'default')` |

`setTheme('default')` now works in the implementation. In 1.x the type allowed `'default'` but the method rejected it.

`ISnapApi` also exposes `isDestroyed` (`true` after `destroy()`). Invalid `setTheme` / `setFormat` values are ignored.

### State, options, and `localStorage`

`SnapRecordsState`, `SnapRecordsOptions`, `updateParams()`, `preDataLoad`, and persisted state (`persistState`) renamed:

| 1.1.x            | 1.20.0      |
| ---------------- | ----------- |
| `filters`        | `filtering` |
| `sortConditions` | `sorting`   |

`SortCondition` is unchanged: `[column, OrderDirection]`.

Saved `localStorage` payloads from 1.1.x (`filters`, `sortConditions`) are not migrated. Clear old keys or rewrite them before enabling `persistState` on 1.20.0.

### HTTP query and `usePushState`

`filtering[key]` and `sorting[column]` are unchanged. Pagination query keys are not:

| 1.1.x             | 1.20.0                                                             |
| ----------------- | ------------------------------------------------------------------ |
| `page`            | `currentPage`                                                      |
| `perPage`         | `rowsPerPage`                                                      |
| `offset`          | `offset` (unchanged, derived as `(currentPage - 1) * rowsPerPage`) |
| `filtering[key]`  | `filtering[key]`                                                   |
| `sorting[column]` | `sorting[column]`                                                  |

Example:

```
/api/data?currentPage=2&rowsPerPage=10&offset=10&filtering[status]=active&sorting[name]=ASC
```

Backends that read `page` or `perPage` must switch to `currentPage` and `rowsPerPage`.

Empty filter values are no longer written to the query string.

The API request URL and the browser URL (`usePushState`) are built from the same helper, so they use the same keys. `usePushState` merges those keys into the existing query string and listens for `popstate`.

### `preDataLoad` / `ServerRequestParams`

| 1.1.x                                       | 1.20.0                                               |
| ------------------------------------------- | ---------------------------------------------------- |
| `page: number`                              | `currentPage: number`                                |
| `perPage: number`                           | `rowsPerPage: number`                                |
| `filtering?: Record<string, string>`        | `filtering: Record<string, string>` (always present) |
| `sorting?: Record<string, 'ASC' \| 'DESC'>` | `sorting: SortCondition[]` (always present)          |

```typescript
lifecycleHooks: {
    preDataLoad: (params) => {
        // 1.x: params.page, params.perPage, params.sorting?.name
        // 1.20.0:
        console.log(params.currentPage, params.rowsPerPage, params.sorting);
    },
}
```

### Constructor

```typescript
new SnapRecords(container: string | HTMLElement, options)
```

A container id still works. Passing an `HTMLElement` is new and required by the framework wrappers.

If the element has no `id`, SnapRecords assigns one (used as the `persistState` storage key).

### Removed from `SnapRecords`

These were public on the instance in 1.x and are now private renderer details:

- `createTableRow`
- `updateRow`
- `createListItem`
- `updateListItem`
- `createMobileCard`
- `updateMobileCard`

### Instance properties

| 1.1.x                    | 1.20.0            |
| ------------------------ | ----------------- |
| `preloadNextPageEnabled` | `preloadNextPage` |

The option name was already `preloadNextPage`.

Each instance no longer attaches `window` `error` / `unhandledrejection` listeners.

`destroy()` still tears down events, DOM, translations, and the IndexedDB connection. It also clears the in-memory format cache and row selection. It does **not** wipe cached API responses in IndexedDB.

### Pagination CSS config

Current-page number buttons used `classNames.disabled: 'snap-active'` in 1.x. That field is now `active`:

```typescript
config.pagination.numberButton.classNames.active; // 'snap-active'
```

`ButtonConfig.classNames.disabled` is optional. Prev/next buttons still use `disabled`.

Custom `renderer` / pagination code that read `classNames.disabled` on number buttons must use `active`.

### Package exports

`snap-records` now exports `ISnapApi`, `SnapTheme`, `SortCondition`, `SnapRecordsState`, and `PersistedState`. Wrappers that imported `ISnapApi` from the package type-check against the public entry.

### Framework wrappers

React, Vue, Svelte, and Angular wrappers pass the container element (not a random id), call `destroy()` on unmount, sync `theme`, `language`, `format`, `filtering`, `sorting`, and `rowsPerPage` through `ISnapApi` (each field watched separately — not the whole `options` object), and skip prop sync when `isDestroyed` is true. The Vue wrapper clears its instance ref after `destroy()` and guards theme/language/format watchers when the instance is not mounted yet. Pagination (`currentPage`) is runtime-only via `ISnapApi`, not reactive `options`.

### Bug fixes (from production use)

- `headerCellClasses` (including `no-sorting`) is read from state. In 1.x the option was stored but never applied to headers.
- `columnWidths` stays a `Map`. Production calls Immer `enableMapSet()` (tests used to hide the crash by calling it only in the test setup).
- Constructing a second instance on the same container destroys the previous one (bfcache / `pageshow` re-init).
- `destroy()` is idempotent, cancels pending loads, and aborts in-flight `fetch`. It closes IndexedDB; it does not wipe the cache.
- `search()` / `updateParams({ filtering })` drop empty values and reset `currentPage` to 1. Filter object key order does not trigger a reload.
- `updateParams()` ignores `undefined` fields and does not reload when nothing changed.
- `setCurrentPage()` / `updateParams({ currentPage })` clamp to the page range. After a load, an out-of-range page redirects.
- `rowsPerPage` is clamped to 1–1000 in the constructor, setters, URL, and `localStorage`.
- `reset()` restores constructor `filtering`, `sorting`, `rowsPerPage`, columns, titles, and header classes.
- Cached responses run `preDataLoad` / `postDataLoad`.
- A throw in a lifecycle hook is logged and does not abort render or get retried as a network error.
- HTTP 4xx and invalid JSON are not retried. 5xx and network errors still are.
- If the API omits `totalRecords`, the received row count is used (the table no longer shows rows with “No data available”).
- Clicks on buttons, links, and form controls inside a row no longer toggle selection.
- Row selection highlighting is reapplied after `setFormat()` and other re-renders.
- Unformatted cell values are escaped as text (`<`, `&`). Formatter HTML is still sanitized. `lazyLoadMedia` does not overwrite an existing `loading` attribute.
- Prev/next pagination defaults (`«` / `»`) keep `aria-hidden` on the glyph and set `aria-label` from translations. Sort, resize, and drag use `sortAscending` / `sortDescending` / `removeSort`, `columnResizeHandle`, and `dragColumn`.
- Keyboard handling ignores `input`, `textarea`, `select`, `button`, `a`, and `[contenteditable]:not([contenteditable="false"])`. `Home` / `End` move the current row (they do not call `reset()`). `ArrowUp` is ignored when no row is current. `.snap-current-row` is styled in table, list, and card modes.
- The table wrapper class is `snap-table-responsive` (the CSS never matched Bootstrap’s `table-responsive`).
- `loadData()` aborts an in-flight next-page preload so a filter change cannot recache the previous query.
- Column resize uses the SnapRecords handle only (`resize: horizontal` on `th` was ignored by state/persist).
- `cursor: pointer` on rows/cards applies only when `selectable` is on (`.snap-selectable`).
- Sort headers are `<button type="button">` (not `<a href="#">`), so middle-click / Ctrl+click does not navigate away.
- Translation fetch retries abort immediately on `destroy()` instead of waiting out the retry delay.
- `aria-selected` is set only on `role="row"` (table). List items and cards keep `.snap-selected` (ARIA does not allow `aria-selected` on `listitem` / `rowgroup`).
- `retryAttempts` is clamped to 0–10 and `debounceDelay` to 0–10000ms.
- Resize and drag listeners are no longer duplicated on every render.
- `showError()` no longer hides the table forever; `render()` / `showLoading()` restore content.
- Format cache keys are `JSON.stringify([rowIndex, row.id, column])` so duplicate row ids on the same page do not share formatted values.
- Row reconciliation keys DOM nodes by `` `${id}:${index}` `` so duplicate ids on one page render and update correctly.
- When the API sends `totalRecords: 0` but returns rows, the footer uses the row count instead of “No data available”.
- When the dataset becomes empty, `currentPage` resets to 1 instead of leaving pagination on a stale page.
- On `popstate` to a URL with no snap params, `persistState` reloads filtering/sorting from `localStorage` instead of constructor defaults.
- `destroy()` during an in-flight load no longer re-renders or rebinds event handlers after IndexedDB caching completes.
- `setState()` / URL persistence / `localStorage` writes are skipped after `destroy()`.
- `setupAllHandlers()` is skipped when the instance is destroyed.
- `showError()` falls back to bundled English when translations are not loaded yet.
- `buildUrl()` fallback strips existing snap query keys before appending new ones.
- Language codes are sanitized to `[a-zA-Z0-9_-]` in state and when fetching `{lang}.json` (`../en_US` → `en_US`).
- `offset` in the URL is derived. A query that only has `offset` is not treated as snap state and does not wipe `persistState` filters.
- `loadFromURL()` updates `filtering` / `sorting` only when those keys appear in the URL. Pagination-only snap queries no longer reset them to `{}` / `[]`.
- `loadFromURL()` updates `currentPage` only when `currentPage` appears in the URL. Sorting- or filtering-only snap queries no longer reset the page to 1.
- On `popstate`, absent `filtering` / `sorting` keys reset those fields to `{}` / `[]` so browser back/forward matches the URL. First load still keeps absent keys from `persistState` or constructor options.
- `End` with no rows leaves the current row index at `-1` (same as `Home`).
- Column resize no longer writes `persistState` after `destroy()`.
- `showLoading()` recovers when `isLoading` is true but the overlay was removed (for example after an aborted fetch or a re-render during load).
- `hideLoading()` removes stray overlays when `isLoading` was already cleared.
- `langPath` trailing slashes are stripped (`/lang/` → `/lang/pt_PT.json`). Loaded JSON is merged with bundled `en_US`. Non-string fields in that JSON are ignored.
- `usePushState` merges snap keys into the existing query. An empty URL on first load does not wipe `persistState`. `popstate` reloads from the URL.
- Constructor `filtering` / `sorting` are compacted and normalized before `reset()` or an empty `popstate` restore them.
- `persistState` `currentPage` is truncated to an integer.
- Pagination totals insert `{start}` / `{end}` / `{total}` as text. Markup in `showingRecords` is not parsed as HTML.
- `javascript:` / `vbscript:` URLs that use whitespace or control characters are stripped from formatter HTML.
- Data-load retries wait between attempts (aborted by `destroy()`), matching translation retries.
- Next-page preload is skipped if the query changed while the cache lookup was in flight.
- Next-page preload is skipped when `useCache` is `false` (prefetch only writes to IndexedDB).
- `persistState` writes are flushed on `destroy()` even when the debounce timer has not fired.
- Duplicate `sorting` entries for the same column collapse to the last direction.
- `destroy()` removes `tabindex`, theme classes, and the container shell classes from the host element.
- Invalid persisted `columnWidths` (non-finite or non-positive) are ignored.
- IndexedDB cache clear on filter change is awaited so a new page cannot be written and then wiped.
- IndexedDB reads and writes wait for the database connection to open before running.
- `search()` / `updateParams({ filtering })` treat a non-object as `{}` instead of throwing.
- The error Retry button is `type="button"` so it does not submit a parent form.
- `destroy()` restores `position` on the host element when SnapRecords had set it to `relative`.
- `persistState` restores saved `headerCellClasses` when the array length matches the column count.
- Corrupted `localStorage` `filtering` arrays are ignored instead of becoming numeric keys.
- Constructor `filtering` must be a plain object; arrays log a warning and fall back to `{}`.
- `popstate` re-renders sort/pagination chrome before the debounced fetch completes.
- Column sort clears the format cache before reload.
- `reset()` clamps `rowsPerPage` through the same sanitizer as the constructor.
- `headerCellClasses` length is validated against `columns` in the constructor (`Configuration.validateHeaderCellClasses`). A mismatched, non-empty array now logs a warning and falls back to `[]` instead of silently misaligning header classes across columns after drag-and-drop reorder (`reorderColumns()`) or a `persistState` column-order restore.
- Removed unused `config.classes` entries (`paginationCell`, `tableOverlay`, `listOverlay`, `cardsOverlay`) that were never applied to the DOM or styled in CSS.
- `tsconfig.json` / `tsconfig.test.json` use `moduleResolution: "bundler"` instead of `"node"`. TypeScript 6.0.3 (the pinned devDependency) treats `"node"` as a hard error (`TS5107`), so `tsc --noEmit` against either config failed outright even though `vite build` and `ts-jest` masked it by compiling through their own, more lenient paths.
- **CommonJS `require('snap-records')` returned an empty module.** The UMD build was emitted as `dist/snap-records.umd.js`, but `package.json` has `"type": "module"`, so Node loaded that plain `.js` file as ESM and silently produced a namespace object with none of the UMD bundle's exports (`SnapRecords` was `undefined`). The UMD output is now `dist/snap-records.umd.cjs` (`.cjs` is always loaded as CommonJS regardless of `"type"`), and `package.json`'s `main` and `exports["."].require` were updated to match. Verified both `require()` and `import` resolve `SnapRecords` correctly against the built package.

### Translations

`pt_PT` pagination string is now `A mostrar {start} a {end} de {total} registos`. Custom copies of that file should match `src/lang/en_US.json`.
