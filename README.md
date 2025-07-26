# SnapRecords

<p align="center">
  <img src="https://github.com/lbassuncao/SnapRecords/blob/main/docs/SnapRecords.png?raw=true" alt="SnapRecords Logo" width="256">
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/snap-records"><img src="https://img.shields.io/npm/v/snap-records.svg" alt="NPM Version"></a>
  <a href="./docs/LICENSE.txt"><img src="https://img.shields.io/npm/l/snap-records.svg" alt="License"></a>
  <a href="https://github.com/lbassuncao/SnapRecords/actions/workflows/ci.yml"><img src="https://github.com/lbassuncao/SnapRecords/actions/workflows/ci.yml/badge.svg" alt="Build Status"></a>
</p>

<br>

<p align="center" style="font-size: 1.15rem">
  <strong><a href="./docs/CONFIG.md">Configuration</a></strong> |
  <strong><a href="./docs/BUILD.md">Build Guide</a></strong> |
  <strong><a href="./docs/KEYBOARD.md">Keyboard Navigation</a></strong> |
  <strong><a href="./CONTRIBUTING.md">Contributing</a></strong> |
  <strong><a href="./docs/LICENSE.txt">License</a></strong> |
  <strong><a href="./docs/COC.md">Code of Conduct</a></strong>
</p>

<br>

**SnapRecords** is a powerful, flexible TypeScript-based data grid component for displaying, managing, and interacting with tabular data in web applications.

Inspired by [jQuery Dynatable](https://github.com/alfajango/jquery-dynatable), it modernizes the concept with type safety, enhanced features, and performance optimizations.

It supports server-side pagination, sorting, filtering, caching, multiple rendering modes, and accessibility, making it ideal for both simple and complex data-driven interfaces.

## Key Strengths

- **Multiple Rendering Modes**: Supports table (`TABLE`), list (`LIST`), and mobile-friendly card (`MOBILE_CARDS`) views, adapting to various devices and use cases.
- **Server-Side Data Handling**: Integrates with APIs for pagination, filtering, and sorting, with a 250ms debounce delay and retry mechanism (up to 3 attempts by default).
- **Caching Support**: Uses IndexedDB via Dexie for caching server responses when `useCache` is enabled, with a default 8-hour expiry and cleanup on destroy if `destroyOnUnload` is enabled.
- **Interactive Features**: Includes column resizing, drag-and-drop column reordering, and row selection with keyboard navigation (ArrowUp/Down, Enter/Space, PageUp/Down).
- **Accessibility**: Implements ARIA attributes (`aria-sort`, `aria-selected`, `aria-label`), keyboard navigation, and screen reader announcements for inclusive experiences.
- **State Persistence**: Persists UI state (column order, widths, filters, page, etc.) in `localStorage` when `persistState` is enabled.
- **Customizable Styling**: Provides built-in `light` and `dark` themes, plus a `default` theme that inherits styles from the host page via CSS Custom Properties (`--sr-...`). This allows for seamless integration with any design system.
- **Type Safety**: Written in TypeScript with generic typing for type-safe data and configuration.
- **Extensibility**: Offers lifecycle hooks (`preDataLoad`, `postDataLoad`, `preRender`, `postRender`, `selectionChanged`) and customizable renderer, event, state, URL, and cache managers.
- **Internationalization**: Supports multiple languages via JSON files in the `/lang` directory, managed by `TranslationManager`.
- **Performance Optimizations**: Includes lazy loading of media, preloading of next-page data, and efficient format caching with `lru-cache` (controlled by `formatCacheSize`).

## Getting Started

To quickly set up SnapRecords:

1. Install dependencies:
    ```bash
    npm install dexie immer lru-cache
    ```
2. Include the compiled CSS:
    ```html
    <link rel="stylesheet" href="/path/to/snap-records.css" />
    ```
3. Create a container:
    ```html
    <div id="table-container"></div>
    ```
4. Initialize SnapRecords:

    ```typescript
    import { SnapRecords, RowsPerPage } from './SnapRecords';

    new SnapRecords('table-container', {
        url: '[https://api.example.com/data](https://api.example.com/data)',
        columns: ['id', 'name'],
        rowsPerPage: RowsPerPage.DEFAULT,
        // No theme specified, so it uses 'default' and inherits host page styles
    });
    ```

## Installation

### Prerequisites

- Node.js (version 20 or higher)
- TypeScript (version 5 or higher)
- A modern browser supporting IndexedDB for caching

### Dependencies

SnapRecords relies on the following runtime dependencies, which must be installed in your project:

- `dexie` (^4.0.11): For IndexedDB caching of server responses.
- `immer` (^10.1.1): For immutable state management.
- `lru-cache` (^11.1.0): For efficient caching of formatted cell values.

Install them with:

```bash
npm install dexie immer lru-cache
```

### Steps

1. **Install Dependencies**:

    ```bash
    npm install dexie immer lru-cache
    ```

2. **Add SnapRecords**: Copy the source files (`SnapRecords.ts`, `SnapApi.ts`, `SnapRenderer.ts`, `EventManager.ts`, `SnapRecordsDB.ts`, `Translations.ts`, `SnapOptions.ts`, `SnapTypes.ts`, `Configuration.ts`, `StateManager.ts`, `UrlManager.ts`, `CacheManager.ts`, `utils.ts`, and `scss/SnapRecords.scss`) into your project.

3. **Add Translation Files**: Place translation JSON files (e.g., `en_US.json`, `pt_PT.json`, `es_ES.json`) in the `/lang` directory within your application's public directory:

    ```
    public/
    └── lang/
        ├── en_US.json
        ├── pt_PT.json
        └── es_ES.json
    ```

4. **Include Styles**: Compile the SCSS file to CSS and include it in your application:

    ````bash
    sass src/scss/SnapRecords.scss dist/snap-records.css --style=compressed --source-map
    ```html
    <link rel="stylesheet" href="/path/to/snap-records.css">
    ````

5. **Import and Initialize**: Import SnapRecords and initialize it:

    ```typescript
    import { SnapRecords, RenderType, RowsPerPage } from './SnapRecords';

    const snapRecords = new SnapRecords('table-container', {
        url: 'https://api.example.com/data',
        columns: ['id', 'name', 'email'],
        rowsPerPage: RowsPerPage.DEFAULT,
    });
    ```

## Usage Examples

### Basic Example

A minimal setup with a table displaying user data:

```typescript
import { SnapRecords, RowsPerPage } from './SnapRecords';

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
import { SnapRecords, RenderType, RowsPerPage } from './SnapRecords';

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
import { SnapRecords, RenderType, RowsPerPage } from './SnapRecords';

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
api.gotoPage(2);
api.setTheme('light');
api.setRenderMode(RenderType.MOBILE_CARDS);
```

## Configuration Options

The `SnapRecordsOptions<T>` interface defines all configuration options. Key options include (see `config.md` for full details):

- `url` (string, required): API URL for data fetching.
- `columns` (string[], required): Column keys to display.
- `columnTitles` (string[]): Custom header titles.
- `columnFormatters` ({ [key: string]: (value, row) => string }): Custom cell formatters, cached with `lru-cache`.
- `format` (RenderType): Rendering mode (`TABLE`, `LIST`, `MOBILE_CARDS`). Default: `TABLE`.
- `rowsPerPage` (RowsPerPage): Rows per page (10, 20, 50, 100, 250, 500, 1000). Default: 10.
- `useCache` (boolean): Enables IndexedDB caching. Default: `false`.
- `usePushState` (boolean): Updates browser URL with state. Default: `false`.
- `language` (string): UI language. Default: `en_US`.
- `headerCellClasses` (string[]): Header CSS classes, with `no-sorting` to disable sorting.
- `selectable` (boolean): Enables row selection. Default: `false`.
- `draggableColumns` (boolean): Enables column drag-and-drop. Default: `false`.
- `persistState` (boolean): Saves state to `localStorage`. Default: `false`.
- `destroyOnUnload` (boolean): Destroys instance on window unload. Default: `true`.
- `debug` (boolean): Enables debug logs. Default: `false`.
- `lazyLoadMedia` (boolean): Enables lazy loading for images. Default: `false`.
- `formatCacheSize` (number): Sets the maximum size of the LRU format cache. Default: 500.
- `lifecycleHooks` (LifecycleHooks<T>): Callbacks for lifecycle events.
- `prevButton`, `nextButton`: Customizes pagination buttons with text, HTML, or templates.

## API Methods

The `SnapApi` class provides methods for interacting with the component:

- `search(filters: Record<string, string>, merge?: boolean): void` - Applies filters and reloads data.
- `updateParams(params: Partial<Pick<SnapRecordsState<T>, 'currentPage' | 'rowsPerPage' | 'filters' | 'sortConditions'>>): void` - Updates multiple parameters.
- `reset(): void` - Clears filters, sorting, and state.
- `refresh(): void` - Reloads current data view.
- `gotoPage(page: number): void` - Navigates to a page.
- `setTheme(theme: 'light' | 'dark' | 'default'): void` - Sets the theme.
- `setRenderMode(mode: RenderType): void` - Changes rendering mode.
- `setRowsPerPage(newRowsPerPage: RowsPerPage): void` - Sets rows per page.
- `setLanguage(newLanguage: string): Promise<void>` - Sets UI language.
- `getData(): ReadonlyArray<T>` - Returns current data.
- `getTotals(): { totalRecords: number }` - Returns total records.
- `getSelectedRows(): T[]` - Returns selected rows.
- `clearSelection(): void` - Clears row selections.
- `destroy(): void` - Destroys the instance, clearing elements and cache.

Example:

```typescript
const api = snapRecords.getApi();
api.search({ status: 'active' }, true);
api.gotoPage(2);
api.setRenderMode(RenderType.LIST);
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

- **ARIA Attributes**: Supports `aria-sort`, `aria-selected`, `aria-label` for table, list, and card modes.
- **Keyboard Navigation**: ArrowUp/Down for row navigation, Enter/Space for selection, PageUp/Down for pagination (see `keyboard.md`).
- **Screen Reader Support**: Announces updates (e.g., row selection, mode changes) via ARIA live regions.

## State Management

The `SnapRecordsState` interface manages state, including:

- Current page, rows per page, filters, sort conditions.
- Column order, widths, titles.
- Data, total records, format, language, theme.

State is persisted to `localStorage` when `persistState` is `true`, managed by `StateManager.ts`.

## Internationalization

Translations are loaded from `/lang` JSON files (e.g., `en_US.json`) via `TranslationManager`. Add new languages by creating JSON files following the `Translation` interface:

```json
{
    "errors": {
        "generic": "An error occurred.",
        "invalidConfig": "Invalid configuration: {reason}",
        "containerNotFound": "Container with ID {id} not found.",
        "dataLoadingFailed": "Failed to load data: {error}",
        "renderFailed": "Failed to render: {error}"
    },
    "loading": "Loading...",
    "totalRecords": "Total records: {total}",
    "filteredRecords": "Filtered records: {total}",
    "errorTitle": "Error",
    "errorMessage": "An unexpected error occurred.",
    "noDataAvailable": "No data available.",
    "previous": "Previous",
    "next": "Next",
    "retry": "Retry",
    "pagination": {
        "showingRecords": "Showing {start} to {end} of {total} records"
    },
    "currentPage": "Page {page}",
    "jumpToPage": "Jump to page",
    "pageNavigation": "Page navigation",
    "sortAscending": "Sort ascending",
    "sortDescending": "Sort descending",
    "removeSort": "Remove sort",
    "rowSelected": "Row selected",
    "rowDeselected": "Row deselected",
    "columnResizeHandle": "Resize column",
    "dragColumn": "Drag column {col}",
    "loadMore": "Load more"
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

This runs `npm run build:js` (for `tsc --noEmit` and `vite build`) and `npm run build:css` (for SCSS compilation with source maps).

### Testing

Tests are in the `tests/` directory, using Jest with JSDOM. `tests/SnapRecords.test.ts` covers initialization, API methods, user interactions (sorting, resizing, drag-and-drop), and rendering modes. Run tests with:

```bash
npm test
```

### Extending

Add custom translations by creating a JSON file in `/lang`:

```json
{
    "loading": "Chargement...",
    "errors": {
        "generic": "Une erreur est survenue."
        // ...
    }
}
```

Customize rendering or event handling by providing custom `renderer`, `eventManager`, `stateManager`, `urlManager`, or `cacheManager` in the options.

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

MIT License. See [`LICENSE`](./docs/LICENSE.txt) for details.

## Support

For issues, feature requests, or questions, please open an issue on the repository or contact the maintainer.
