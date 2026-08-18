# SnapRecords Configuration

Initialization options for `SnapRecords`, defined by `SnapRecordsOptions<T>` in `SnapTypes.ts`.

`url` and `columns` are required. Everything else is optional.

This document describes **1.20.0**. If you are upgrading from 1.1.x, see [RELEASES.md](../RELEASES.md).

## Constructor

```typescript
import { SnapRecords, RowsPerPage } from 'snap-records';

new SnapRecords(container: string | HTMLElement, options);
```

`container` is a DOM element id or an `HTMLElement`. If the element has no `id`, one is assigned (used as the `persistState` storage key).

If the container already has a SnapRecords instance, the previous instance is destroyed first. Re-creating on `pageshow` / bfcache does not require wiping `innerHTML` by hand.

```typescript
new SnapRecords('table-container', {
    url: 'https://api.example.com/data',
    columns: ['id', 'name'],
});

new SnapRecords(document.getElementById('table-container')!, {
    url: 'https://api.example.com/data',
    columns: ['id', 'name'],
    rowsPerPage: RowsPerPage.DEFAULT,
});
```

## Request query

State, the API URL, and `usePushState` use the same keys, built by `UrlManager.toSearchParams()`:

| State / options                   | Query                               |
| --------------------------------- | ----------------------------------- |
| `currentPage`                     | `currentPage`                       |
| `rowsPerPage`                     | `rowsPerPage`                       |
| `(currentPage - 1) * rowsPerPage` | `offset`                            |
| `filtering`                       | `filtering[key]`                    |
| `sorting`                         | `sorting[column]` (`ASC` or `DESC`) |

Empty `filtering` values are omitted. Change `format` at runtime with `setFormat()`. Change page with `setCurrentPage()`.

Example:

```
/api/data?currentPage=2&rowsPerPage=10&offset=10&filtering[status]=active&sorting[name]=ASC
```

## Dependencies

`dexie`, `immer`, and `lru-cache` are runtime dependencies of `snap-records` and are installed with the package.

Translations ship in `snap-records/lang/*` (`en_US`, `pt_PT`, `es_ES`). Serve them from `/lang`, or set `langPath`.

Include styles:

```typescript
import 'snap-records/style.css';
```

## Options Overview

| Option              | Type                                        | Default        | Render modes | Notes                            |
| ------------------- | ------------------------------------------- | -------------- | ------------ | -------------------------------- |
| `url`               | `string`                                    | Required       | All          | API endpoint                     |
| `columns`           | `string[]`                                  | Required       | All          | Object keys to display           |
| `columnTitles`      | `string[]`                                  | `columns`      | All          | Header labels                    |
| `columnFormatters`  | `{ [key: string]: (value, row) => string }` | stringify      | All          | Cached up to `formatCacheSize`   |
| `format`            | `RenderType`                                | `TABLE`        | All          | Setter: `setFormat()`            |
| `rowsPerPage`       | `RowsPerPage`                               | `10`           | All          | Query: `rowsPerPage`             |
| `filtering`         | `Record<string, string>`                    | `{}`           | All          | Query: `filtering[key]`          |
| `sorting`           | `SortCondition[]`                           | `[]`           | All          | Query: `sorting[column]`         |
| `useCache`          | `boolean`                                   | `false`        | All          | IndexedDB via Dexie              |
| `usePushState`      | `boolean`                                   | `false`        | All          | Same query keys as the API       |
| `language`          | `string`                                    | `"en_US"`      | All          | Reloads translations             |
| `langPath`          | `string`                                    | `"/lang"`      | All          | `{langPath}/{language}.json`     |
| `debounceDelay`     | `number`                                    | `250`          | All          | Delay before `loadData()`        |
| `headerCellClasses` | `string[]`                                  | `[]`           | TABLE        | `no-sorting` disables sort       |
| `cacheExpiry`       | `number`                                    | `28800000`     | All          | 8 hours                          |
| `selectable`        | `boolean`                                   | `false`        | All          | Row selection + keyboard         |
| `lifecycleHooks`    | `LifecycleHooks<T>`                         | `{}`           | All          | See below                        |
| `theme`             | `SnapTheme`                                 | `"default"`    | All          | `'light' \| 'dark' \| 'default'` |
| `draggableColumns`  | `boolean`                                   | `false`        | TABLE        | Column reorder                   |
| `prevButton`        | `{ text?, isHtml?, template? }`             | `«` (HTML)     | All          | Pagination                       |
| `nextButton`        | `{ text?, isHtml?, template? }`             | `»` (HTML)     | All          | Pagination                       |
| `retryAttempts`     | `number`                                    | `3`            | All          | Failed fetches                   |
| `preloadNextPage`   | `boolean`                                   | `false`        | All          | Prefetch next page               |
| `persistState`      | `boolean`                                   | `false`        | All          | `localStorage`                   |
| `destroyOnUnload`   | `boolean`                                   | `true`         | All          | `beforeunload` → `destroy()`     |
| `debug`             | `boolean`                                   | `false`        | All          | Console logs                     |
| `lazyLoadMedia`     | `boolean`                                   | `false`        | All          | `loading="lazy"` on images       |
| `formatCacheSize`   | `number`                                    | `500`          | All          | LRU cell cache                   |
| `renderer`          | factory                                     | `SnapRenderer` | All          | Custom UI                        |
| `eventManager`      | factory                                     | `EventManager` | All          | Custom events                    |
| `stateManager`      | factory                                     | `StateManager` | All          | Custom state                     |
| `urlManager`        | factory                                     | `UrlManager`   | All          | Custom query builder             |
| `cacheManager`      | factory                                     | `CacheManager` | All          | Custom cache                     |

## Detailed Description of Each Option

1. **url** (`string`, required)  
   API URL. Must be a valid URL (`Configuration.ts` throws `SnapRecordsConfigError` otherwise). Existing query parameters on `url` are kept; SnapRecords keys are merged in.

2. **columns** (`string[]`, required)  
   Non-empty list of data keys to display.

3. **columnTitles** (`string[]`, optional)  
   Header labels in the same order as `columns`. Defaults to `columns`. A length mismatch logs a warning. An empty array is treated as missing and falls back to `columns`.

4. **columnFormatters** (`{ [columnKey: string]: (value: unknown, row: T) => string }`, optional)  
   Per-column formatters. Output is sanitized (`sanitizeHTML`) and stored in an LRU cache of size `formatCacheSize`. Cells without a formatter are escaped as text (`<`, `&`, etc. are shown literally).

5. **format** (`RenderType`, optional)  
   `TABLE` | `LIST` | `MOBILE_CARDS`. Default `TABLE`. Column resize and drag-and-drop only apply in `TABLE`. Change at runtime with `setFormat()`.

6. **rowsPerPage** (`RowsPerPage`, optional)  
   `DEFAULT = 10`, `TWENTY`, `FIFTY`, `HUNDRED`, `TWO_HUNDRED_FIFTY`, `FIVE_HUNDRED`, `THOUSAND`. Values outside 1–1000 log a warning.

7. **filtering** (`Record<string, string>`, optional)  
   Initial filters on `state.filtering`. Must be a plain object (not an array). Update later with `search()` or `updateParams()`. Query: `filtering[key]`. Empty or whitespace-only values are omitted. A non-object is treated as `{}`. `search()` and `updateParams({ filtering })` reset `currentPage` to 1.

8. **sorting** (`SortCondition[]`, optional)  
   Initial sort as `[column, OrderDirection]` tuples on `state.sorting`. Directions are normalized to `ASC` / `DESC`. Query: `sorting[column]`.

9. **useCache** (`boolean`, optional)  
   IndexedDB cache via Dexie. Entries expire after `cacheExpiry`. The cache is cleared when `filtering` changes on a live instance (the clear is awaited before the next fetch is stored). The first load after construct does not wipe existing entries. `destroy()` **closes** the database connection; it does not delete cached responses.

10. **usePushState** (`boolean`, optional)  
    Syncs `currentPage`, `rowsPerPage`, `filtering`, and `sorting` to the browser URL (`offset` is also written, derived from those values). Snap query keys are merged into the existing search string (host params are kept). Theme, language, and data loads do not push history. Back/forward (`popstate`) reloads from the URL and re-renders headers/pagination before the fetch. An empty URL on first load does not wipe `persistState`. A URL that only contains `offset` is not treated as snap state. On first load, snap keys that are absent from the URL do not reset the other fields (for example, a pagination-only link keeps `filtering` and `sorting` from `persistState` or constructor options). On `popstate`, absent `filtering` / `sorting` keys reset those fields to `{}` / `[]`; absent `currentPage` / `rowsPerPage` keys leave the current values unchanged.

11. **language** (`string`, optional)  
    UI language, e.g. `"en_US"`, `"pt_PT"`. Non-alphanumeric characters except `_` and `-` are stripped. Loaded by `TranslationManager` from `{langPath}/{language}.json`. Change at runtime with `setLanguage()`.

12. **langPath** (`string`, optional)  
    Base path for translation files. Default `"/lang"`. Loaded JSON is merged with bundled `en_US`; non-string fields are ignored. `showingRecords` placeholders are inserted as text, not HTML.

13. **debounceDelay** (`number`, optional)  
    Milliseconds to wait after pagination, search, or other state changes before `loadData()`. Default `250`.

14. **headerCellClasses** (`string[]`, optional)  
    Header CSS classes in `TABLE` mode. Include `no-sorting` to disable sort on that column. Classes are applied to headers by position, so the array length must match `columns`; a mismatched, non-empty array logs a warning and falls back to `[]`.

15. **cacheExpiry** (`number`, optional)  
    Cache lifetime in milliseconds. Default `28800000` (8 hours). Used when `useCache` is `true`.

16. **selectable** (`boolean`, optional)  
    Row selection via click and keyboard. See [KEYBOARD.md](./KEYBOARD.md).

17. **lifecycleHooks** (`LifecycleHooks<T>`, optional)

    ```typescript
    interface LifecycleHooks<T> {
        preDataLoad?: (params: ServerRequestParams) => void;
        postDataLoad?: (data: ReadonlyArray<T>) => void;
        preRender?: () => void;
        postRender?: () => void;
        selectionChanged?: (selectedRows: T[]) => void;
    }

    interface ServerRequestParams {
        currentPage: number;
        rowsPerPage: number;
        offset: number;
        filtering: Record<string, string>;
        sorting: SortCondition[];
    }
    ```

18. **theme** (`SnapTheme`, optional)  
    `'light' | 'dark' | 'default'`. Default `"default"`. Applied as `.theme-light`, `.theme-dark`, or `.theme-default` on the container (`SnapRenderer.applyThemeClass`). Change at runtime with `setTheme()`.

    - `'light'` / `'dark'`: built-in palettes in `_variables.scss`.
    - `'default'`: host page must define the `--sr-...` CSS variables.

    **CSS variables** (required for `'default'`):

    - Backgrounds: `--sr-bg-primary`, `--sr-bg-secondary`, `--sr-bg-interactive-hover`, `--sr-bg-interactive-selected`, `--sr-bg-overlay`
    - Text: `--sr-text-primary`, `--sr-text-on-primary`, `--sr-text-interactive`, `--sr-text-error`, `--sr-text-disabled`
    - Borders: `--sr-border-primary`, `--sr-border-interactive`
    - States: `--sr-state-primary`, `--sr-state-error-background`, `--sr-state-danger`, `--sr-state-danger-hover`, `--sr-state-drag-background`, `--sr-state-disabled-background`
    - Spacing: `--sr-spacing-padding`, `--sr-spacing-margin`

    ```css
    :root {
        --sr-bg-primary: #ffffff;
        --sr-bg-secondary: #f8f9fa;
        --sr-bg-interactive-hover: #e9ecef;
        --sr-bg-interactive-selected: #cfe2ff;
        --sr-bg-overlay: rgba(255, 255, 255, 0.7);
        --sr-text-primary: #212529;
        --sr-text-on-primary: #ffffff;
        --sr-text-interactive: #0d6efd;
        --sr-text-error: #dc3545;
        --sr-text-disabled: #6c757d;
        --sr-border-primary: #dee2e6;
        --sr-border-interactive: #0d6efd;
        --sr-state-primary: #0d6efd;
        --sr-state-error-background: #f8d7da;
        --sr-state-danger: #dc3545;
        --sr-state-danger-hover: #bb2d3b;
        --sr-state-drag-background: rgba(13, 110, 253, 0.2);
        --sr-state-disabled-background: #e9ecef;
        --sr-spacing-padding: 1rem;
        --sr-spacing-margin: 0.5rem;
    }

    @media (prefers-color-scheme: dark) {
        :root {
            --sr-bg-primary: #212529;
            --sr-bg-secondary: #343a40;
            --sr-bg-interactive-hover: #495057;
            --sr-bg-interactive-selected: #084298;
            --sr-bg-overlay: rgba(33, 37, 41, 0.7);
            --sr-text-primary: #f8f9fa;
            --sr-text-on-primary: #ffffff;
            --sr-text-interactive: #0d6efd;
            --sr-text-error: #f5c2c7;
            --sr-text-disabled: #6c757d;
            --sr-border-primary: #495057;
            --sr-border-interactive: #0d6efd;
            --sr-state-primary: #0d6efd;
            --sr-state-error-background: #842029;
            --sr-state-danger: #dc3545;
            --sr-state-danger-hover: #c9303f;
            --sr-state-drag-background: rgba(13, 110, 253, 0.2);
            --sr-state-disabled-background: #495057;
            --sr-spacing-padding: 1rem;
            --sr-spacing-margin: 0.5rem;
        }
    }
    ```

19. **draggableColumns** (`boolean`, optional)  
    Drag-and-drop column reorder in `TABLE` mode.

20. **prevButton** / **nextButton**  
    `{ text?: string; isHtml?: boolean; template?: (page: number | string) => string }`.  
    Defaults: HTML `«` / `»` with `aria-hidden` (buttons still get `aria-label` from translations). `template(page)` is used when set; HTML is sanitized. Falls back to `translations.previous` / `translations.next`. Pagination buttons expose `data-page`.

21. **retryAttempts** (`number`, optional)  
    Retries for network failures and HTTP 5xx, with a short delay between attempts (cancelled by `destroy()`). HTTP 4xx and malformed payloads are not retried. Default `3`.

22. **preloadNextPage** (`boolean`, optional)  
    Prefetch the next page into IndexedDB. Requires `useCache: true`; otherwise preloading is skipped. Also skipped on slow connections or data-saver mode (`CacheManager`). Cancelled by `destroy()` or if the query changes while the cache lookup is in flight.

23. **persistState** (`boolean`, optional)  
    Saves column order, widths, `headerCellClasses`, `filtering`, `sorting`, `currentPage`, and `rowsPerPage` to `localStorage` under `snap-records-state-{containerId}`. Loaded `currentPage` is truncated to an integer. Invalid `columnWidths` are ignored. Pending writes are flushed on `destroy()`. 1.1.x keys (`filters`, `sortConditions`) are not migrated.

24. **destroyOnUnload** (`boolean`, optional)  
    Registers `beforeunload` → `destroy()`. Default `true`. `destroy()` removes listeners, clears the container, restores host `position` if SnapRecords set it, clears the format cache, selection, and translation cache, and closes IndexedDB. It does not wipe cached API responses.

25. **debug** (`boolean`, optional)  
    Enables `log()` in `utils.ts`.

26. **lazyLoadMedia** (`boolean`, optional)  
    Adds `loading="lazy"` to `<img>` tags in formatted cells that do not already have a `loading` attribute.

27. **formatCacheSize** (`number`, optional)  
    Max LRU entries for formatted cells. Default `500`.

28. **renderer**  
    `(parent, container) => ISnapRenderer<T>`. Default `SnapRenderer`.

29. **eventManager**  
    `(parent, renderer, callbacks) => ISnapEventManager`. Default `EventManager`.

30. **stateManager**  
    `(parent) => StateManager<T>`. Default `StateManager`.

31. **urlManager**  
    `(parent) => UrlManager<T>`. Default `UrlManager`. Owns query construction (`toSearchParams`, `buildUrl`, `parseSearchParams`).

32. **cacheManager**  
    `(parent, urlManager) => CacheManager<T>`. Default `CacheManager`.

## Public API (`getApi()`)

```typescript
const api = snapRecords.getApi();
```

| Method                                                           | Role                                                                                          |
| ---------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `search(filtering, merge?)`                                      | Set `filtering` (replace or merge) and reload                                                 |
| `updateParams({ currentPage, rowsPerPage, filtering, sorting })` | Patch those fields and reload                                                                 |
| `setCurrentPage(page)`                                           | Go to a page                                                                                  |
| `setFormat(mode)`                                                | Set `format` (`RenderType`)                                                                   |
| `setRowsPerPage(n)`                                              | Set `rowsPerPage`                                                                             |
| `setTheme(theme)`                                                | `'light' \| 'dark' \| 'default'`                                                              |
| `setLanguage(lang)`                                              | Reload translations                                                                           |
| `reset()`                                                        | Restore constructor `filtering`, `sorting`, `rowsPerPage`, column order/widths, and selection |
| `refresh()`                                                      | Reload current view                                                                           |
| `getData()` / `getTotals()` / `getSelectedRows()`                | Read data                                                                                     |
| `isDestroyed`                                                    | `true` after `destroy()`                                                                      |
| `clearSelection()`                                               | Clear row selection                                                                           |
| `destroy()`                                                      | Tear down the instance                                                                        |

Framework wrappers sync `theme`, `language`, `format`, `filtering`, `sorting`, and `rowsPerPage` from `options`. Pagination (`currentPage`) is runtime-only: call `setCurrentPage()` or `updateParams({ currentPage })` on the `ISnapApi` instance returned by `getApi()` / `onReady`.

## Common Configuration Errors

```typescript
new SnapRecords('table-container', { url: 'http://', columns: ['id', 'name'] });
// SnapRecordsConfigError: "Invalid URL provided: http://"

new SnapRecords('table-container', { url: 'https://api.example.com', columns: [] });
// SnapRecordsConfigError: "Columns option must be a non-empty array."

new SnapRecords('missing', { url: 'https://api.example.com', columns: ['id'] });
// SnapRecordsConfigError: "Container with ID 'missing' not found."
```

Mismatched `columnTitles` length and non-function `columnFormatters` / `lifecycleHooks` log warnings; they do not throw.

## Example Initialization

```typescript
import { SnapRecords, RenderType, RowsPerPage, OrderDirection } from 'snap-records';

const snapRecords = new SnapRecords('table-container', {
    url: 'https://api.example.com/data',
    columns: ['id', 'name', 'email', 'status'],
    columnTitles: ['ID', 'Name', 'Email', 'Status'],
    columnFormatters: {
        status: (value) => `<span class="${value}">${String(value).toUpperCase()}</span>`,
        name: (value) => String(value).toLowerCase(),
    },
    format: RenderType.TABLE,
    rowsPerPage: RowsPerPage.TWENTY,
    filtering: { status: 'active' },
    sorting: [['name', OrderDirection.ASC]],
    useCache: true,
    usePushState: true,
    language: 'pt_PT',
    langPath: '/lang',
    debounceDelay: 250,
    headerCellClasses: ['id-col', 'name-col no-sorting', 'email-col', 'status-col'],
    cacheExpiry: 7200000,
    selectable: true,
    lifecycleHooks: {
        preDataLoad: (params) => console.log('Fetching:', params),
        postDataLoad: (data) => console.log('Loaded:', data),
        preRender: () => console.log('Rendering...'),
        postRender: () => console.log('Render complete'),
        selectionChanged: (rows) => console.log('Selected:', rows),
    },
    theme: 'default',
    draggableColumns: true,
    prevButton: {
        text: '<i class="fa fa-arrow-left"></i> Previous',
        isHtml: true,
        template: (page) => `<span>Back to page ${page}</span>`,
    },
    nextButton: {
        text: 'Next',
        isHtml: false,
        template: (page) => `Next: ${page}`,
    },
    retryAttempts: 5,
    preloadNextPage: true,
    persistState: true,
    destroyOnUnload: true,
    debug: true,
    lazyLoadMedia: true,
    formatCacheSize: 1000,
});

const api = snapRecords.getApi();
api.search({ status: 'active' }, true);
api.setCurrentPage(2);
api.setFormat(RenderType.MOBILE_CARDS);
```

## Additional Notes

- Each row from the server must have a unique `id` (`Identifiable`). `SnapRenderer.#reconcileItems` matches DOM nodes via `data-key`.

    ```json
    {
        "data": [
            { "id": 1, "name": "John", "email": "john@example.com" },
            { "id": 2, "name": "Jane", "email": "jane@example.com" }
        ],
        "totalRecords": 2
    }
    ```

- Include `snap-records.css` (from `src/scss/SnapRecords.scss`).
- Records must extend `Identifiable & Record<string, unknown>`.
- HTML from formatters and pagination buttons is sanitized in `utils.ts`. Unformatted cell values are escaped as text.
- Keyboard behaviour: [KEYBOARD.md](./KEYBOARD.md). Breaking changes: [RELEASES.md](../RELEASES.md).
