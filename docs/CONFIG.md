# SnapRecords Plugin Initialization Options

This document details all initialization options for the `SnapRecords` plugin, as defined by the `SnapRecordsOptions<T>` interface in `SnapTypes.ts`.

Each option is described with its type, default value (if applicable), purpose, and an example. The `url` and `columns` options are required; all others are optional.

## Dependencies

The following runtime dependencies must be installed for SnapRecords to function correctly:

- `dexie` (^4.0.11): For IndexedDB caching when `useCache` is enabled.
- `immer` (^10.1.1): For immutable state management.
- `lru-cache` (^11.1.0): For caching formatted cell values, controlled by `formatCacheSize`.

Install them with:

```bash
npm install dexie immer lru-cache
```

## Options Overview

| Option              | Type                                                               | Default                          | Render Modes | Performance Impact                                                |
| ------------------- | ------------------------------------------------------------------ | -------------------------------- | ------------ | ----------------------------------------------------------------- |
| `url`               | `string`                                                           | Required                         | All          | None                                                              |
| `columns`           | `string[]`                                                         | Required                         | All          | None                                                              |
| `columnTitles`      | `string[]`                                                         | `columns`                        | All          | None                                                              |
| `columnFormatters`  | `{ [key: string]: (value, row) => string }`                        | `(value) => String(value ?? '')` | All          | Increases memory usage with `formatCacheSize`                     |
| `format`            | `RenderType`                                                       | `TABLE`                          | All          | Varies: TABLE (highest), LIST (moderate), MOBILE_CARDS (moderate) |
| `rowsPerPage`       | `RowsPerPage`                                                      | `10`                             | All          | Higher values increase data fetch size                            |
| `useCache`          | `boolean`                                                          | `false`                          | All          | Increases storage usage with IndexedDB                            |
| `usePushState`      | `boolean`                                                          | `false`                          | All          | Minimal                                                           |
| `language`          | `string`                                                           | `"en_US"`                        | All          | Triggers re-render on change                                      |
| `headerCellClasses` | `string[]`                                                         | `[]`                             | TABLE        | None                                                              |
| `cacheExpiry`       | `number`                                                           | `28800000` (8 hours)             | All          | Higher values increase storage duration                           |
| `selectable`        | `boolean`                                                          | `false`                          | All          | Minimal, adds event listeners                                     |
| `lifecycleHooks`    | `LifecycleHooks<T>`                                                | `{}`                             | All          | Depends on hook implementation                                    |
| `theme`             | `'light' \| 'dark' \| 'default'`                                   | `"default"`                      | All          | Minimal                                                           |
| `draggableColumns`  | `boolean`                                                          | `false`                          | TABLE        | Adds drag event listeners                                         |
| `prevButton`        | `{ text?: string; isHtml?: boolean; template?: (page) => string }` | `{ text: '«', isHtml: true }`    | All          | Minimal                                                           |
| `nextButton`        | `{ text?: string; isHtml?: boolean; template?: (page) => string }` | `{ text: '»', isHtml: true }`    | All          | Minimal                                                           |
| `retryAttempts`     | `number`                                                           | `3`                              | All          | Higher values increase fetch attempts                             |
| `preloadNextPage`   | `boolean`                                                          | `false`                          | All          | Increases network usage for pre-fetching                          |
| `persistState`      | `boolean`                                                          | `false`                          | All          | Increases localStorage usage                                      |
| `destroyOnUnload`   | `boolean`                                                          | `true`                           | All          | Minimal, clears resources on unload                               |
| `debug`             | `boolean`                                                          | `false`                          | All          | Minimal, enables console logs                                     |
| `lazyLoadMedia`     | `boolean`                                                          | `false`                          | All          | Reduces initial load time for images                              |
| `formatCacheSize`   | `number`                                                           | `500`                            | All          | Higher values increase memory usage                               |
| `renderer`          | `(parent, container) => ISnapRenderer`                             | `SnapRenderer`                   | All          | Depends on implementation                                         |
| `eventManager`      | `(parent, renderer, callbacks) => ISnapEventManager`               | `EventManager`                   | All          | Depends on implementation                                         |
| `stateManager`      | `(parent) => StateManager`                                         | `StateManager`                   | All          | Depends on implementation                                         |
| `urlManager`        | `(parent) => UrlManager`                                           | `UrlManager`                     | All          | Depends on implementation                                         |
| `cacheManager`      | `(parent, urlManager) => CacheManager`                             | `CacheManager`                   | All          | Depends on implementation                                         |

## Detailed Description of Each Option

1. **url** (`string`, required)
    - **Description**: The API URL to fetch data for the plugin.
    - **Example**: `"https://api.example.com/data"`
    - **Note**: Must be a valid string URL; validated in `Configuration.ts`, throwing a `SnapRecordsConfigError` if invalid.

2. **columns** (`string[]`, required)
    - **Description**: List of column keys to display, corresponding to data object properties.
    - **Example**: `["id", "name", "email"]`
    - **Note**: Must be a non-empty array; validated in `Configuration.ts`, throwing a `SnapRecordsConfigError` if invalid. Used in all rendering modes.

3. **columnTitles** (`string[]`, optional)
    - **Description**: Custom titles for column headers, matching the order of `columns`.
    - **Default**: Uses values from `columns`.
    - **Example**: `["ID", "Name", "Email"]`
    - **Note**: If provided, must match the length of `columns` or a warning is logged (see `Configuration.ts`). Applies in all rendering modes.

4. **columnFormatters** (`{ [columnKey: string]: (value: unknown, row: T) => string }`, optional)
    - **Description**: Functions to format cell values for specific columns before rendering.
    - **Default**: `(value) => String(value ?? '')`
    - **Example**:
        ```typescript
        {
            status: (value, row) => `<span class="${value}">${String(value).toUpperCase()}</span>`,
            name: (value) => String(value).toLowerCase()
        }
        ```
    - **Note**: Formatters are cached in `SnapRecords.ts` using `lru-cache` with a limit set by `formatCacheSize` (default: 500 entries). HTML output is sanitized to prevent XSS. Validated in `Configuration.ts`.

5. **format** (`RenderType`, optional)
    - **Description**: Rendering mode: table (`TABLE`), list (`LIST`), or mobile cards (`MOBILE_CARDS`).
    - **Type**: `enum RenderType { TABLE = "table", LIST = "list", MOBILE_CARDS = "mobile_cards" }`
    - **Default**: `RenderType.TABLE`
    - **Example**: `RenderType.MOBILE_CARDS`
    - **Note**: Features like column resizing and drag-and-drop are only available in `TABLE` mode. Managed in `SnapRenderer.ts`.

6. **rowsPerPage** (`RowsPerPage`, optional)
    - **Description**: Number of rows per page for pagination.
    - **Type**: `enum RowsPerPage { DEFAULT = 10, TWENTY = 20, FIFTY = 50, HUNDRED = 100, TWO_HUNDRED_FIFTY = 250, FIVE_HUNDRED = 500, THOUSAND = 1000 }`
    - **Default**: `RowsPerPage.DEFAULT` (10)
    - **Example**: `RowsPerPage.FIFTY`
    - **Note**: Validated in `Configuration.ts` to be between 1 and 1000, with warnings for out-of-range values.

7. **useCache** (`boolean`, optional)
    - **Description**: Enables IndexedDB caching via Dexie for server responses.
    - **Default**: `false`
    - **Example**: `true`
    - **Note**: When enabled, caches data with `cacheExpiry` duration. Cache is cleared on filter changes or when `destroyOnUnload` is `true`. Managed in `CacheManager.ts` and `SnapRecordsDB.ts`.

8. **usePushState** (`boolean`, optional)
    - **Description**: Updates browser history with URL parameters using `pushState`.
    - **Default**: `false`
    - **Example**: `true`
    - **Note**: Managed in `UrlManager.ts` for state synchronization.

9. **language** (`string`, optional)
    - **Description**: Sets the UI language (e.g., `"en_US"`, `"pt_PT"`). Loads translations from `/lang` directory JSON files, falling back to `en_US.json` or embedded defaults.
    - **Default**: `"en_US"`
    - **Example**: `"pt_PT"`
    - **Note**: Handled by `translationManager` in `Translations.ts`. Triggers re-render on change.

10. **headerCellClasses** (`string[]`, optional)
    - **Description**: CSS classes for table header cells. Use `"no-sorting"` to disable sorting for specific columns.
    - **Default**: `[]`
    - **Example**: `["col-id", "col-name no-sorting", "col-email"]`
    - **Note**: Only applies in `TABLE` mode. Managed in `SnapRenderer.ts`.

11. **cacheExpiry** (`number`, optional)
    - **Description**: Cache expiration time in milliseconds for cached data.
    - **Default**: `28800000` (8 hours)
    - **Example**: `7200000` (2 hours)
    - **Note**: Applies when `useCache` is `true`. Managed in `CacheManager.ts`.

12. **selectable** (`boolean`, optional)
    - **Description**: Enables row selection via clicks or keyboard (ArrowUp/Down, Enter/Space).
    - **Default**: `false`
    - **Example**: `true`
    - **Note**: Adds `aria-selected` attributes and screen reader announcements. Handled in `EventManager.ts` and `SnapRenderer.ts`.

13. **lifecycleHooks** (`LifecycleHooks<T>`, optional)
    - **Description**: Callbacks for lifecycle events: `preDataLoad`, `postDataLoad`, `preRender`, `postRender`, `selectionChanged`.
    - **Type**:
        ```typescript
        interface LifecycleHooks<T> {
            preDataLoad?: (params: ServerRequestParams) => void;
            postDataLoad?: (data: ReadonlyArray<T>) => void;
            preRender?: () => void;
            postRender?: () => void;
            selectionChanged?: (selectedRows: T[]) => void;
        }
        ```
    - **Default**: `{}`
    - **Example**:
        ```typescript
        {
            preDataLoad: (params) => console.log('Fetching:', params),
            postDataLoad: (data) => console.log('Loaded:', data),
            preRender: () => console.log('Rendering...'),
            postRender: () => console.log('Render complete'),
            selectionChanged: (rows) => console.log('Selected:', rows)
        }
        ```
    - **Note**: Validated in `Configuration.ts`. Used in `SnapRecords.ts` for custom behavior.

14. **theme** (`'light' | 'dark' | 'default'`, optional)
    - **Description**: Specifies the visual theme for the plugin.
        - `'light'`: Uses the built-in light theme with predefined colors optimized for light backgrounds.
        - `'dark'`: Uses the built-in dark theme with colors suited for dark backgrounds.
        - `'default'`: Inherits styles from the host application by using CSS Custom Properties (`--sr-...`). This allows seamless integration with the application's existing design system (e.g., Bootstrap, Material Design) or custom styles. When using `'default'`, the host application must define the necessary CSS variables to style the component correctly.
    - **Default**: `"default"`
    - **Example**: `"dark"`
    - **Custom Theming with `'default'`**:
      When `theme` is set to `'default'`, SnapRecords relies on CSS Custom Properties to style the component. These variables must be defined in the host application's stylesheet, typically in the `:root` scope or a parent element, to control backgrounds, text, borders, states, and spacing. This approach allows for deep customization and supports responsive theming, such as switching styles based on `prefers-color-scheme` for light and dark modes.

        The following CSS variables are available for customization:
        - **Backgrounds**:
            - `--sr-bg-primary`: Primary background color (e.g., table or card background).
            - `--sr-bg-secondary`: Secondary background color (e.g., header or footer).
            - `--sr-bg-interactive-hover`: Background color for hover states.
            - `--sr-bg-interactive-selected`: Background color for selected rows or items.
            - `--sr-bg-overlay`: Background color for loading overlays.

        - **Text**:
            - `--sr-text-primary`: Primary text color.
            - `--sr-text-on-primary`: Text color for elements on primary backgrounds (e.g., buttons).
            - `--sr-text-interactive`: Color for interactive elements (e.g., links).
            - `--sr-text-error`: Color for error messages.
            - `--sr-text-disabled`: Color for disabled elements.

        - **Borders**:
            - `--sr-border-primary`: Primary border color.
            - `--sr-border-interactive`: Border color for interactive elements.

        - **States**:
            - `--sr-state-primary`: Primary color for active states (e.g., pagination buttons).
            - `--sr-state-error-background`: Background color for error messages.
            - `--sr-state-danger`: Background color for danger actions (e.g., retry button).
            - `--sr-state-danger-hover`: Hover state color for danger actions.
            - `--sr-state-drag-background`: Background color for dragging elements.
            - `--sr-state-disabled-background`: Background color for disabled elements.

        - **Spacing**:
            - `--sr-spacing-padding`: Padding for elements (e.g., cells, cards).
            - `--sr-spacing-margin`: Margin between elements.

        **Example of Custom Theme**:

        Below is an example of defining a custom theme for the `'default'` theme, including support for light and dark modes using Bootstrap-inspired colors:

        ```css
        :root {
            /* Backgrounds */
            --sr-bg-primary: #ffffff;
            --sr-bg-secondary: #f8f9fa;
            --sr-bg-interactive-hover: #e9ecef;
            --sr-bg-interactive-selected: #cfe2ff;
            --sr-bg-overlay: rgba(255, 255, 255, 0.7);

            /* Text */
            --sr-text-primary: #212529;
            --sr-text-on-primary: #ffffff;
            --sr-text-interactive: #0d6efd;
            --sr-text-error: #dc3545;
            --sr-text-disabled: #6c757d;

            /* Borders */
            --sr-border-primary: #dee2e6;
            --sr-border-interactive: #0d6efd;

            /* States */
            --sr-state-primary: #0d6efd;
            --sr-state-error-background: #f8d7da;
            --sr-state-danger: #dc3545; /* Red for danger actions (e.g., retry button) */
            --sr-state-danger-hover: #bb2d3b; /* Darker red for hover */
            --sr-state-drag-background: rgba(13, 110, 253, 0.2);
            --sr-state-disabled-background: #e9ecef;

            /* Spacing */
            --sr-spacing-padding: 1rem;
            --sr-spacing-margin: 0.5rem;
        }

        /* Dark mode values */
        @media (prefers-color-scheme: dark) {
            :root {
                /* Backgrounds */
                --sr-bg-primary: #212529;
                --sr-bg-secondary: #343a40;
                --sr-bg-interactive-hover: #495057;
                --sr-bg-interactive-selected: #084298;
                --sr-bg-overlay: rgba(33, 37, 41, 0.7);

                /* Text */
                --sr-text-primary: #f8f9fa;
                --sr-text-on-primary: #ffffff;
                --sr-text-interactive: #0d6efd;
                --sr-text-error: #f5c2c7;
                --sr-text-disabled: #6c757d;

                /* Borders */
                --sr-border-primary: #495057;
                --sr-border-interactive: #0d6efd;

                /* States */
                --sr-state-primary: #0d6efd;
                --sr-state-error-background: #842029;
                --sr-state-danger: #dc3545; /* Same red for consistency */
                --sr-state-danger-hover: #c9303f; /* Slightly lighter red for hover */
                --sr-state-drag-background: rgba(13, 110, 253, 0.2);
                --sr-state-disabled-background: #495057;

                /* Spacing */
                --sr-spacing-padding: 1rem;
                --sr-spacing-margin: 0.5rem;
            }
        }
        ```

        **How to Apply**:
        - Include the above CSS in your application's stylesheet (e.g., `styles.css`).
        - Ensure the `snap-records.css` file is included in your HTML to apply the structural styles that use these variables:

            ```html
            <link rel="stylesheet" href="/path/to/snap-records.css" />
            ```

        - Initialize SnapRecords with `theme: 'default'`:

            ```typescript
            import { SnapRecords } from './SnapRecords';

            const snapRecords = new SnapRecords('table-container', {
                url: 'https://api.example.com/data',
                columns: ['id', 'name'],
                theme: 'default',
            });
            ```

        **Notes**:
        - The `default` theme requires all listed CSS variables to be defined in the host application's stylesheet to avoid rendering issues.
        - Use media queries like `prefers-color-scheme` to adapt the theme to user preferences (e.g., light or dark mode).
        - The `--sr-state-danger` and `--sr-state-danger-hover` variables are used specifically for elements like the retry button in error states (see `_loading-error.scss`).
        - All styles are applied via the `.theme-default` class in `SnapRecords.scss`, which relies on these CSS variables for rendering table, list, and mobile card views, as well as interactive elements like column resize handles and pagination buttons.

    - **Note**: Applied via CSS classes in `SnapRenderer.ts`. The `light` and `dark` themes are defined in `_variables.scss` with predefined values, while the `default` theme expects the host application to provide the CSS variables. Changing the theme triggers a re-render to update styles.

15. **draggableColumns** (`boolean`, optional)
    - **Description**: Enables drag-and-drop column reordering in `TABLE` mode.
    - **Default**: `false`
    - **Example**: `true`
    - **Note**: Handled in `EventManager.ts` with drag events. Triggers re-render on reorder.

16. **prevButton** (`{ text?: string; isHtml?: boolean; template?: (page: number | string) => string }`, optional)
    - **Description**: Configures the "Previous" pagination button.
    - **Type**:
        ```typescript
        {
            text?: string;
            isHtml?: boolean;
            template?: (page: number | string) => string;
        }
        ```
    - **Default**:
        - `text`: `'<span aria-hidden="true">«</span>'` (from `SnapOptions.ts`)
        - `isHtml`: `true`
        - `template`: `undefined`
    - **Example**:
        ```typescript
        {
            text: '<i class="fa fa-arrow-left"></i> Back',
            isHtml: true,
            template: (page) => `<span>Back to page ${page}</span>`
        }
        ```
    - **Note**: Falls back to `translations.previous` if `text` is not provided. HTML is sanitized in `SnapRecords.ts`. Rendered in `SnapRenderer.ts`.

17. **nextButton** (`{ text?: string; isHtml?: boolean; template?: (page: number | string) => string }`, optional)
    - **Description**: Configures the "Next" pagination button.
    - **Type**: Same as `prevButton`
    - **Default**:
        - `text`: `'<span aria-hidden="true">»</span>'` (from `SnapOptions.ts`)
        - `isHtml`: `true`
        - `template`: `undefined`
    - **Example**:
        ```typescript
        {
            text: 'Forward',
            isHtml: false,
            template: (page) => `Next: ${page}`
        }
        ```
    - **Note**: Falls back to `translations.next` if `text` is not provided. HTML is sanitized in `SnapRecords.ts`. Rendered in `SnapRenderer.ts`.

18. **retryAttempts** (`number`, optional)
    - **Description**: Number of retry attempts for failed data fetches.
    - **Default**: `3`
    - **Example**: `5`
    - **Note**: Handled in `SnapRecords.ts`.

19. **preloadNextPage** (`boolean`, optional)
    - **Description**: Preloads the next page’s data in the background when enabled.
    - **Default**: `false`
    - **Example**: `true`
    - **Note**: Skipped on slow connections or data saver mode. Managed in `CacheManager.ts`.

20. **persistState** (`boolean`, optional)
    - **Description**: Persists UI state (e.g., column order, widths, filters, page) to `localStorage`.
    - **Default**: `false`
    - **Example**: `true`
    - **Note**: Uses `storageKey` in `SnapRecords.ts`. Managed by `StateManager.ts`.

21. **destroyOnUnload** (`boolean`, optional)
    - **Description**: Calls `destroy()` on window `beforeunload`.
    - **Default**: `true`
    - **Example**: `false`
    - **Note**: Ensures cleanup to prevent memory leaks. Handled in `SnapRecords.ts`.

22. **debug** (`boolean`, optional)
    - **Description**: Enables console debug logs for development.
    - **Default**: `false`
    - **Example**: `true`
    - **Note**: Uses `log` function in `utils.ts`.

23. **lazyLoadMedia** (`boolean`, optional)
    - **Description**: Adds `loading="lazy"` to `<img>` tags in formatted content.
    - **Default**: `false`
    - **Example**: `true`
    - **Note**: Improves performance for image-heavy data. Handled in `SnapRecords.ts`.

24. **formatCacheSize** (`number`, optional)
    - **Description**: Sets the maximum number of entries for the LRU cache used to store formatted cell values, powered by the `lru-cache` library.
    - **Default**: `500`
    - **Example**: `1000`
    - **Note**: Controls the size of the `lru-cache` instance in `SnapRecords.ts` for optimizing format operations. Higher values increase memory usage but reduce re-formatting.

25. **renderer** (`(parent: SnapRecords<T>, container: HTMLElement) => ISnapRenderer<T>`, optional)
    - **Description**: Custom renderer for the plugin.
    - **Default**: Uses `SnapRenderer` from `SnapRenderer.ts`
    - **Example**:
        ```typescript
        (parent, container) => new CustomRenderer(parent, container);
        ```
    - **Note**: Allows overriding default rendering logic.

26. **eventManager** (`(parent: SnapRecords<T>, renderer: ISnapRenderer<T>, callbacks: EventManagerCallbacks) => ISnapEventManager`, optional)
    - **Description**: Custom event manager for handling interactions.
    - **Default**: Uses `EventManager` from `EventManager.ts`
    - **Example**:
        ```typescript
        (parent, renderer, callbacks) => new CustomEventManager(parent, renderer, callbacks);
        ```
    - **Note**: Allows overriding default event handling.

27. **stateManager** (`(parent: SnapRecords<T>) => StateManager<T>`, optional)
    - **Description**: Custom state manager for state handling.
    - **Default**: Uses `StateManager` from `StateManager.ts`
    - **Example**:
        ```typescript
        (parent) => new CustomStateManager(parent);
        ```
    - **Note**: Allows overriding default state management.

28. **urlManager** (`(parent: SnapRecords<T>) => UrlManager<T>`, optional)
    - **Description**: Custom URL manager for building fetch URLs.
    - **Default**: Uses `UrlManager` from `UrlManager.ts`
    - **Example**:
        ```typescript
        (parent) => new CustomUrlManager(parent);
        ```
    - **Note**: Allows overriding default URL construction.

29. **cacheManager** (`(parent: SnapRecords<T>, urlManager: UrlManager<T>) => CacheManager<T>`, optional)
    - **Description**: Custom cache manager for data caching.
    - **Default**: Uses `CacheManager` from `CacheManager.ts`
    - **Example**:
        ```typescript
        (parent, urlManager) => new CustomCacheManager(parent, urlManager);
        ```
    - **Note**: Allows overriding default caching logic.

## Common Configuration Errors

Below are examples of common configuration errors and their error messages:

- **Invalid URL**:

    ```typescript
    new SnapRecords('table-container', { url: 'invalid-url', columns: ['id', 'name'] });
    // Throws: SnapRecordsConfigError: "Invalid URL provided: invalid-url"
    ```

- **Empty Columns Array**:

    ```typescript
    new SnapRecords('table-container', {
        url: 'https://api.example.com',
        columns: [],
    });
    // Throws: SnapRecordsConfigError: "Columns option must be a non-empty array."
    ```

- **Mismatched Column Titles**:

    ```typescript
    new SnapRecords('table-container', {
        url: 'https://api.example.com',
        columns: ['id', 'name'],
        columnTitles: ['ID'],
    });
    // Logs warning: "The number of columns does not match the number of column titles."
    ```

- **Invalid Formatter**:
    ```typescript
    new SnapRecords('table-container', {
        url: 'https://api.example.com',
        columns: ['id', 'name'],
        columnFormatters: { name: 'not-a-function' },
    });
    // Logs warning: "columnFormatters for column 'name' is not a function."
    ```

## Example Initialization

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
    theme: 'default', // Using the default theme to inherit host styles
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
```

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

- **CSS Inclusion**: The plugin requires the compiled `snap-records.css` file (from `src/scss/SnapRecords.scss`) to be included in your application to style the table, list, or mobile card views, including support for column resizing, drag-and-drop, and themes. Use:

    ```html
    <link rel="stylesheet" href="/path/to/snap-records.css" />
    ```

- **Validation**: The `url`, `columns`, `rowsPerPage`, `columnFormatters`, and `lifecycleHooks` are validated in `Configuration.ts`, throwing errors or logging warnings for invalid inputs.

- **Flexibility**: Most options are optional, allowing minimal or highly customized setups.

- **Generic Typing**: The `T` type ensures type-safe data handling, requiring data objects to extend `Identifiable` and `Record<string, unknown>`.

- **Accessibility**: Options like `selectable`, `language`, `prevButton`, and `nextButton` enhance accessibility with ARIA attributes and keyboard support.

- **HTML Safety**: HTML in `columnFormatters`, `prevButton`, and `nextButton` is sanitized via `sanitizeHTML` in `utils.ts` to prevent XSS.

- **State Persistence**: The `persistState` option saves state to `localStorage` using `StateManager.ts`.

- **Internationalization**: The `language` option loads translations via `translationManager`, with fallback to `en_US` or embedded defaults.

- **Performance**: `lazyLoadMedia`, `preloadNextPage`, and `formatCacheSize` optimize performance for media-heavy or paginated content, with `lru-cache` simplifying format cache management.

- **Extensibility**: Custom `renderer`, `eventManager`, `stateManager`, `urlManager`, and `cacheManager` allow overriding core functionality.

## Support

For issues, feature requests, or questions, please open an issue on the repository or contact the maintainer.
