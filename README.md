# SnapRecords

<p align="center">
  <img src="https://github.com/lbassuncao/SnapRecords/blob/main/docs/SnapRecords.png?raw=true" alt="SnapRecords Logo" width="256">
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/snap-records"><img src="https://img.shields.io/npm/v/snap-records.svg?style=flat-square&color=007acc" alt="NPM Version"></a>
  <a href="https://github.com/lbassuncao/SnapRecords/blob/main/LICENSE"><img src="https://img.shields.io/npm/l/snap-records.svg?style=flat-square&color=007acc" alt="License"></a>
  <a href="https://github.com/lbassuncao/SnapRecords/actions/workflows/ci.yml"><img src="https://github.com/lbassuncao/SnapRecords/actions/workflows/ci.yml/badge.svg" alt="Build Status"></a>
</p>

<br>

<p align="center" style="font-size: 1.15rem">
  <strong><a href="https://github.com/lbassuncao/SnapRecords/blob/main/RELEASES.md">Releases</a></strong> |
  <strong><a href="https://github.com/lbassuncao/SnapRecords/blob/main/docs/CONFIG.md">Configuration</a></strong> |
  <strong><a href="https://github.com/lbassuncao/SnapRecords/blob/main/docs/BUILD.md">Build Guide</a></strong> |
  <strong><a href="https://github.com/lbassuncao/SnapRecords/blob/main/docs/KEYBOARD.md">Keyboard Navigation</a></strong> |
  <strong><a href="https://github.com/lbassuncao/SnapRecords/blob/main/CONTRIBUTING.md">Contributing</a></strong> |
  <strong><a href="https://github.com/lbassuncao/SnapRecords/blob/main/LICENSE">License</a></strong> |
  <strong><a href="https://github.com/lbassuncao/SnapRecords/blob/main/docs/COC.md">Code of Conduct</a></strong>
</p>

<br>

**SnapRecords** is a powerful, flexible TypeScript-based data grid component for displaying, managing, and interacting with tabular data in web applications.

Inspired by [jQuery Dynatable](https://github.com/alfajango/jquery-dynatable), it modernizes the concept with type safety, enhanced features, and performance optimizations.

It supports server-side pagination, sorting, filtering, caching, multiple rendering modes, and accessibility, making it ideal for both simple and complex data-driven interfaces.

## Key Strengths

- **Multiple Rendering Modes**: Supports table (`TABLE`), list (`LIST`), and mobile-friendly card (`MOBILE_CARDS`) views, adapting to various devices and use cases.
- **Server-Side Data Handling**: Integrates with APIs for pagination, filtering, and sorting, with a 250ms debounce delay and retry mechanism (3 retries by default).
- **Caching Support**: Uses IndexedDB via Dexie for caching server responses when `useCache` is enabled, with a default 8-hour expiry. `destroy()` closes the database connection; it does not delete cached responses.
- **Interactive Features**: Includes column resizing, drag-and-drop column reordering, and row selection with keyboard navigation (ArrowUp/Down, Enter/Space, PageUp/Down).
- **Accessibility**: ARIA sort labels and pagination names in all modes; `aria-selected` only on table rows (`role="row"`). Keyboard navigation and screen reader announcements.
- **State Persistence**: Persists UI state (column order, widths, `filtering`, page, etc.) in `localStorage` when `persistState` is enabled.
- **Customizable Styling**: Provides built-in `light` and `dark` themes, plus a `default` theme that inherits styles from the host page via CSS Custom Properties (`--sr-...`). This allows for seamless integration with any design system.
- **Type Safety**: Written in TypeScript with generic typing for type-safe data and configuration.
- **Extensibility**: Offers lifecycle hooks (`preDataLoad`, `postDataLoad`, `preRender`, `postRender`, `selectionChanged`) and customizable renderer, event, state, URL, and cache managers.
- **Internationalization**: Supports multiple languages via JSON files in the `/lang` directory, managed by `TranslationManager`.
- **Performance Optimizations**: Includes lazy loading of media, preloading of next-page data, and efficient format caching with `lru-cache` (controlled by `formatCacheSize`).

## Getting Started

To quickly set up SnapRecords:

1. **Install via NPM**:

    ```bash
    npm install snap-records
    ```

2. **Include Styles**:
   If using a bundler (Vite, Webpack, etc.):

    ```typescript
    import 'snap-records/style.css';
    ```

    Or via HTML:

    ```html
    <link rel="stylesheet" href="/node_modules/snap-records/dist/snap-records.css" />
    ```

3. **Create a container**:

    ```html
    <div id="table-container"></div>
    ```

4. **Initialize SnapRecords**:

    ```typescript
    import { SnapRecords, RowsPerPage } from 'snap-records';

    new SnapRecords('table-container', {
        url: 'https://api.example.com/data',
        columns: ['id', 'name'],
        rowsPerPage: RowsPerPage.DEFAULT,
        // No theme specified, so it uses 'default' and inherits host page styles
    });
    ```

## Installation

### NPM (Recommended)

```bash
npm install snap-records
```

### Prerequisites

- Node.js (version 26.7.0 or higher; see `.nvmrc`)
- TypeScript (version 6 or higher)
- A modern browser supporting IndexedDB for caching

### Dependencies

`dexie`, `immer`, and `lru-cache` are runtime dependencies of `snap-records` and are installed automatically with the package.

Translations ship in `snap-records/lang/*`. Serve them from a public `/lang` path, or set `langPath` to wherever you host the JSON files.

## Usage Examples

### Basic Example

A minimal setup with a table displaying user data:

```typescript
import { SnapRecords, RowsPerPage } from 'snap-records';

const snapRecords = new SnapRecords('table-container', {
    url: '/api/users',
    columns: ['id', 'name', 'email'],
    columnTitles: ['ID', 'Name', 'Email'],
    rowsPerPage: RowsPerPage.TWENTY,
});
```

### Example with Row Selection and Custom Formatting

Enabling row selection, custom formatting, and disabling sorting on a column:

```typescript
import { SnapRecords, RenderType, RowsPerPage } from 'snap-records';

const snapRecords = new SnapRecords('table-container', {
    url: '/api/users',
    columns: ['id', 'name', 'status', 'notes'],
    columnTitles: ['ID', 'Name', 'Status', 'Notes'],
    columnFormatters: {
        status: (value) => `<span class="${value}">${String(value).toUpperCase()}</span>`,
    },
    rowsPerPage: RowsPerPage.FIFTY,
    selectable: true,
    headerCellClasses: ['col-id', 'col-name no-sorting', 'col-status', 'col-notes'],
});

const api = snapRecords.getApi();
console.log(api.getSelectedRows());
```

### Complete Configuration Example

Using all available options:

```typescript
import { SnapRecords, RenderType, RowsPerPage } from 'snap-records';

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
    useCache: true,
    usePushState: true,
    language: 'pt_PT',
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
    theme: 'dark',
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
api.setTheme('light');
api.setFormat(RenderType.MOBILE_CARDS);
```

## Configuration Options

The `SnapRecordsOptions<T>` interface defines all configuration options. See [CONFIG.md](https://github.com/lbassuncao/SnapRecords/blob/main/docs/CONFIG.md) for full details.

- `url` (string, required): API URL for data fetching.
- `columns` (string[], required): Column keys to display.
- `columnTitles` (string[]): Custom header titles.
- `columnFormatters` ({ [key: string]: (value, row) => string }): Custom cell formatters, cached with `lru-cache`.
- `format` (RenderType): Rendering mode (`TABLE`, `LIST`, `MOBILE_CARDS`). Default: `TABLE`. Change at runtime with `setFormat()`.
- `rowsPerPage` (RowsPerPage): Rows per page (10, 20, 50, 100, 250, 500, 1000). Default: 10.
- `filtering` (`Record<string, string>`): Initial filters. Sent to the server as `filtering[key]`. Update later with `search()` or `updateParams()`.
- `sorting` (`SortCondition[]`): Initial sort. Sent to the server as `sorting[column]`.
- `useCache` (boolean): Enables IndexedDB caching. Default: `false`.
- `usePushState` (boolean): Syncs page/filters/sort to the browser URL via `StateManager`, merging into the existing query string. Default: `false`.
- `language` (string): UI language. Default: `en_US`.
- `langPath` (string): Directory for translation JSON files. Default: `/lang`.
- `debounceDelay` (number): Delay in ms before reloading data. Default: `250`.
- `headerCellClasses` (string[]): Header CSS classes, with `no-sorting` to disable sorting.
- `selectable` (boolean): Enables row selection. Default: `false`.
- `draggableColumns` (boolean): Enables column drag-and-drop. Default: `false`.
- `persistState` (boolean): Saves state to `localStorage`. Default: `false`.
- `destroyOnUnload` (boolean): Destroys instance on window unload. Default: `true`.
- `debug` (boolean): Enables debug logs. Default: `false`.
- `lazyLoadMedia` (boolean): Enables lazy loading for images. Default: `false`.
- `formatCacheSize` (number): Sets the maximum size of the LRU format cache. Default: 500.
- `preloadNextPage` (boolean): Prefetches the next page. Default: `false`.
- `lifecycleHooks` (LifecycleHooks<T>): Callbacks for lifecycle events.
- `prevButton`, `nextButton`: Customizes pagination buttons with text, HTML, or templates.

The constructor accepts a container element id (`string`) or an `HTMLElement`.

## API Methods

Use `snapRecords.getApi()` for the public `ISnapApi` surface. Method names match the implementation:

- `search(filtering: Record<string, string>, merge?: boolean): void` — Applies `filtering` and reloads data.
- `updateParams(params: Partial<Pick<SnapRecordsState<T>, 'currentPage' | 'rowsPerPage' | 'filtering' | 'sorting'>>): void` — Updates those state fields and reloads.
- `reset(): void` — Restores constructor `filtering`, sorting, rows per page, and column layout.
- `refresh(): void` — Reloads the current data view.
- `setCurrentPage(page: number): void` — Navigates to a page.
- `setTheme(theme: SnapTheme): void` — Sets `'light' | 'dark' | 'default'`.
- `setFormat(mode: RenderType): void` — Sets the `format` used for rendering.
- `setRowsPerPage(newRowsPerPage: RowsPerPage): void` — Sets rows per page.
- `setLanguage(newLanguage: string): Promise<void>` — Sets UI language.
- `getData(): ReadonlyArray<T>` — Returns current data.
- `getTotals(): { totalRecords: number }` — Returns total records.
- `getSelectedRows(): T[]` — Returns selected rows.
- `clearSelection(): void` — Clears row selections.
- `isDestroyed` — `true` after `destroy()`.
- `destroy(): void` — Removes listeners, clears the container, and closes the cache database connection. Does not wipe cached API responses.

Example:

```typescript
const api = snapRecords.getApi();
api.search({ status: 'active' }, true);
api.setCurrentPage(2);
api.setFormat(RenderType.LIST);
api.clearSelection();
api.destroy();
```

## Styling

Customize styles via `src/scss/SnapRecords.scss`. The compiled `snap-records.css` must be included in your application:

```html
<link rel="stylesheet" href="/path/to/snap-records.css" />
```

Key classes:

- `.snap-records`: Table container.
- `.snap-list`: List view container.
- `.snap-mobile-cards-container`: Mobile cards container.
- `.theme-light`, `.theme-dark`, `.theme-default`: Theme classes.
- `.snap-column-resize-handle`: Column resize handle.
- `.snap-draggable-column`: Draggable column indicator.
- `.snap-current-row`, `.snap-selected`: Row highlighting for navigation and selection.

Override styles in your CSS as needed.

## Accessibility

SnapRecords prioritizes accessibility:

- **ARIA Attributes**: `aria-sort` and `aria-label` in all modes. `aria-selected` only on table rows (`role="row"`).
- **Keyboard Navigation**: ArrowUp/Down for row navigation, Enter/Space for selection, PageUp/Down for pagination (see [KEYBOARD.md](https://github.com/lbassuncao/SnapRecords/blob/main/docs/KEYBOARD.md)).
- **Screen Reader Support**: Announces updates (e.g., row selection, mode changes) via ARIA live regions.

## State Management

The `SnapRecordsState` interface manages state, including:

- Current page, rows per page, `filtering`, `sorting`.
- Column order, widths, titles.
- Data, total records, format, language, theme.

State is persisted to `localStorage` when `persistState` is `true`, managed by `StateManager.ts`.

## Internationalization

Translations are loaded from `{langPath}/{language}.json` (default `/lang/en_US.json`) by `TranslationManager` in `Translations.ts`. Copy files from `node_modules/snap-records/lang/` into your public directory, or set `langPath`. New files must follow the `Translation` interface, for example:

```json
{
    "loading": "Loading...",
    "totalRecords": "Total records: {total}",
    "filteredRecords": "Filtered records: {filtered}",
    "previous": "Previous",
    "next": "Next",
    "errorTitle": "Error",
    "errorMessage": "An error occurred.",
    "noDataAvailable": "No data available.",
    "columnResizeHandle": "Resize column",
    "sortAscending": "Sort ascending",
    "sortDescending": "Sort descending",
    "removeSort": "Remove sort",
    "rowSelected": "Row selected",
    "rowDeselected": "Row deselected",
    "currentPage": "Current page: {page}",
    "pageNavigation": "Page navigation",
    "loadMore": "Load More",
    "jumpToPage": "Jump to page",
    "retry": "Retry",
    "dragColumn": "Drag column {col}",
    "rowsPerPageChanged": "Rows per page changed to {count}",
    "errors": {
        "containerNotFound": "Container not found.",
        "invalidConfig": "Invalid configuration.",
        "dataLoadingFailed": "Failed to load data: {error}",
        "renderFailed": "Failed to render: {error}",
        "generic": "An error occurred."
    },
    "pagination": {
        "showingRecords": "Showing {start} to {end} of {total} records"
    }
}
```

## Troubleshooting

Common issues and solutions:

- **"Container with ID 'table-container' not found"**:
  Ensure the container element exists in the DOM before initializing SnapRecords:

    ```html
    <div id="table-container"></div>
    ```

- **"Translation file for pt_PT not found"**:
  Verify that `/lang/pt_PT.json` is in your public directory and accessible via HTTP.

- **Styles not applied**:
  Ensure `snap-records.css` is included in your HTML or bundler:

    ```html
    <link rel="stylesheet" href="/path/to/snap-records.css" />
    ```

- **Data not rendering**:
  Confirm that the server response includes a unique `id` field for each row, as required by the `Identifiable` interface:

    ```json
    {
        "data": [
            { "id": 1, "name": "John" },
            { "id": 2, "name": "Jane" }
        ],
        "totalRecords": 2
    }
    ```

- **Keyboard navigation not working**:
  Ensure `selectable: true` for row navigation and that the container is focused (`snapRecords.container.focus()`).

## Development

### Building

Compile TypeScript and SCSS:

```bash
npm run build
```

This runs `npm run build:js` (`vite build`), `npm run build:css` (Sass), and copies `src/lang/*.json` into `dist/lang/`.

### Testing

Tests are in the `tests/` directory, using Jest with JSDOM. `tests/SnapRecords.test.ts` covers initialization, API methods, user interactions (sorting, resizing, drag-and-drop), and rendering modes. Run tests with:

```bash
npm test
```

### Extending

Add custom translations by creating a JSON file that matches `src/lang/en_US.json` and serving it from `langPath`.

Customize rendering or event handling by providing custom `renderer`, `eventManager`, `stateManager`, `urlManager`, or `cacheManager` in the options.

### Framework Wrappers

React, Vue, Svelte, and Angular wrapper components live in [`wrappers/`](https://github.com/lbassuncao/SnapRecords/tree/main/wrappers) on GitHub (`SnapRecordsReact.tsx`, `SnapRecordsVue.vue`, `SnapRecords.svelte`, `snap-records.component.ts`). They are **not** published in the `snap-records` npm package and are not importable from it (there is no `snap-records/wrappers/*` export) — each one needs to be compiled by your own app's toolchain (JSX, SFC, Angular CLI, etc.), so copy the file for your framework straight into your project's source tree and adjust the import path to `snap-records`. See [CONFIG.md](https://github.com/lbassuncao/SnapRecords/blob/main/docs/CONFIG.md#public-api-getapi) for what they sync automatically, and [RELEASES.md](https://github.com/lbassuncao/SnapRecords/blob/main/RELEASES.md#framework-wrappers) for their exact behavior.

## Additional Notes

- **Data Requirement: Unique `id` Field**: The data returned from the server must include a unique `id` field for each row, as required by the `Identifiable` interface in `SnapTypes.ts`. This `id` (string or number) is used by the plugin’s diffing mechanism to efficiently track and reconcile rows during rendering. The diffing process, implemented in `SnapRenderer.ts` (e.g., `#reconcileItems`), relies on this unique identifier to map existing DOM elements to data rows, ensuring accurate updates and preventing duplication or loss of data. For example, a server response should look like:

    ```json
    {
        "data": [
            { "id": 1, "name": "John", "email": "john@example.com" },
            { "id": 2, "name": "Jane", "email": "jane@example.com" }
        ],
        "totalRecords": 2
    }
    ```

    Failure to include a unique `id` may result in rendering errors or inconsistent behavior.

- **CSS Requirement**: The compiled `snap-records.css` file is required for proper styling of the table, list, or mobile card views, including support for column resizing, drag-and-drop, and row highlighting.

## Contributing

1. Fork the repository.
2. Create a feature branch (`git checkout -b feature/new-feature`).
3. Commit changes (`git commit -m 'Add new feature'`).
4. Push to the branch (`git push origin feature/new-feature`).
5. Open a pull request.

## License

MIT License. See [LICENSE](https://github.com/lbassuncao/SnapRecords/blob/main/LICENSE) for details.

## Support

For issues, feature requests, or questions, please open an issue on the repository or contact the maintainer.
