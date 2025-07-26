import type { Draft } from 'immer';
import type { UrlManager } from './UrlManager.js';
import type { SnapRecords } from './SnapRecords.js';
import type { StateManager } from './StateManager.js';
import type { CacheManager } from './CacheManager.js';

/*========================================================================================================

    SNAP TYPES FILES

    This file defines all core TypeScript types, interfaces, enums, and utility classes
    used by the SnapRecords data table library. It provides type safety and structure for
    configuration, state management, rendering, event handling, error reporting, and
    extensibility of the SnapRecords component. The types in this file are intended to be
    imported and used throughout the SnapRecords codebase to ensure consistent and robust
    API design.

==========================================================================================================*/

// Enum defining log levels for debugging and error reporting
export enum LogLevel {
    // General logging for detailed tracing
    LOG = 'log',
    // Informational messages about normal operations
    INFO = 'info',
    // Warnings for non-critical issues
    WARN = 'warn',
    // Errors for critical failures
    ERROR = 'error',
}

// Enum specifying supported rendering modes for data display
export enum RenderType {
    // Displays data in a tabular format
    TABLE = 'table',
    // Displays data as a list of items
    LIST = 'list',
    // Displays data as cards optimized for mobile devices
    MOBILE_CARDS = 'mobile_cards',
}

// Enum defining sort order directions
export enum OrderDirection {
    // Ascending order (e.g., A-Z, 1-10)
    ASC = 'ASC',
    // Descending order (e.g., Z-A, 10-1)
    DESC = 'DESC',
}

// Enum listing supported rows per page options for pagination
export enum RowsPerPage {
    // Default number of rows per page
    DEFAULT = 10,
    // 20 rows per page
    TWENTY = 20,
    // 50 rows per page
    FIFTY = 50,
    // 100 rows per page
    HUNDRED = 100,
    // 250 rows per page
    TWO_HUNDRED_FIFTY = 250,
    // 500 rows per page
    FIVE_HUNDRED = 500,
    // 1000 rows per page
    THOUSAND = 1000,
}

// Interface requiring an ID property for data records
export interface Identifiable {
    // Unique identifier for each data record
    id: string | number;
}

export interface PersistedState {
    columns: string[];
    columnWidths: [string, number][];
    sortConditions: SortCondition[];
    filters: Record<string, string>;
    currentPage: number;
    rowsPerPage: RowsPerPage;
    headerCellClasses: string[];
}

// Interface defining the structure of translation objects
export interface Translation {
    // Error messages for various failure scenarios
    errors: {
        // Generic error message for unexpected issues
        generic: string;
        // Error for invalid configuration
        invalidConfig: string;
        // Error when the container element is not found
        containerNotFound: string;
        // Error for data loading failures
        dataLoadingFailed: string;
        // Error for rendering failures
        renderFailed: string;
    };
    // Message displayed during data loading
    loading: string;
    // Label for total records count
    totalRecords: string;
    // Label for filtered records count
    filteredRecords: string;
    // Title for error messages
    errorTitle: string;
    // Generic error message content
    errorMessage: string;
    // Message when no data is available
    noDataAvailable: string;
    // Label for the previous page button
    previous: string;
    // Label for the next page button
    next: string;
    // Label for the retry button
    retry: string;
    // Pagination-related translations
    pagination: {
        // Template for showing record range (e.g., "Showing 1-10 of 50")
        showingRecords: string;
    };
    // Label for the current page
    currentPage: string;
    // Label for jumping to a specific page
    jumpToPage: string;
    // Accessibility label for page navigation
    pageNavigation: string;
    // Label for sorting in ascending order
    sortAscending: string;
    // Label for sorting in descending order
    sortDescending: string;
    // Label for removing sort
    removeSort: string;
    // Announcement when a row is selected
    rowSelected: string;
    // Announcement when a row is deselected
    rowDeselected: string;
    // Label for column resize handle
    columnResizeHandle: string;
    // Label for draggable columns
    dragColumn: string;
    // Label for loading more data
    loadMore: string;
}

// Interface for the event manager, handling user interactions
export interface ISnapEventManager {
    // Sets up all event handlers for user interactions
    setupAllHandlers(): void;
    // Removes all event listeners and cleans up
    destroy(): void;
}

// Type defining button types for pagination
export type ButtonType = 'prev' | 'next' | 'number';

// Custom error class for configuration-related issues
export class SnapRecordsConfigError extends Error {
    constructor(message: string) {
        super(message);
        // Set the error name for identification
        this.name = 'SnapRecordsConfigError';
    }
}

// Custom error class for data-related issues
export class SnapRecordsDataError extends Error {
    constructor(message: string) {
        super(message);
        // Set the error name for identification
        this.name = 'SnapRecordsDataError';
    }
}

// Interface defining the configuration for pagination buttons
export interface ButtonConfig {
    // CSS class names for styling
    classNames: {
        // Base class for the button
        base: string;
        // Class applied when the button is disabled
        disabled: string;
    };
    // Flag indicating if the button content is HTML
    isHtml: boolean;
    // Optional template function for custom button content
    template?: (page: number | string) => string;
}

// Type defining a sort condition as a tuple of column name and direction
export type SortCondition = [string, OrderDirection];

// Interface for server request parameters
export interface ServerRequestParams {
    // Current page number
    page: number;
    // Number of records per page
    perPage: number;
    // Offset for pagination
    offset: number;
    // Optional filters for data
    filtering?: Record<string, string>;
    // Optional sorting conditions
    sorting?: Record<string, 'ASC' | 'DESC'>;
}

// Type defining callbacks for the event manager
export type EventManagerCallbacks = {
    // Callback for reordering columns
    reorderColumns: (sourceColId: string, targetColId: string) => void;
    // Callback to request a data reload
    requestDataLoad: () => void;
};

// Type for state update functions using Immer drafts
export type StateUpdater<T extends Identifiable & Record<string, unknown>> = (
    draft: Draft<SnapRecordsState<T>>
) => void;

// Interface for cached data structure
export interface CacheData<T extends Identifiable & Record<string, unknown>> {
    // URL of the cached request
    url: string;
    // Cached data array
    data: T[];
    // Total number of records
    totalRecords: number;
    // Timestamp of when the data was cached
    timestamp: number;
}

// Interface for lifecycle hooks to customize behavior
export interface LifecycleHooks<T extends Identifiable & Record<string, unknown>> {
    // Called before data is loaded
    preDataLoad?: (params: ServerRequestParams) => void;
    // Called after data is loaded
    postDataLoad?: (data: ReadonlyArray<T>) => void;
    // Called before rendering
    preRender?: () => void;
    // Called after rendering
    postRender?: () => void;
    // Called when row selection changes
    selectionChanged?: (selectedRows: T[]) => void;
}

// Interface for the renderer, handling UI rendering
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export interface ISnapRenderer<T extends Identifiable & Record<string, unknown>> {
    // Table body element
    readonly tableBody: HTMLTableSectionElement | null;
    // List container element
    readonly listContainer: HTMLUListElement | null;
    // Mobile cards container element
    readonly cardsContainer: HTMLElement | null;
    // Table header element
    readonly tableHeader: HTMLTableSectionElement | null;
    // Renders the UI based on the current state
    render(): void;
    // Cleans up the renderer
    destroy(): void;
    // Creates necessary DOM containers
    createContainers(): void;
    // Applies the current theme
    applyThemeClass(): void;
    // Shows a loading indicator
    showLoading(): void;
    // Hides the loading indicator
    hideLoading(): void;
    // Displays an error message
    showError(message: string): void;
    // Announces updates for screen readers
    announceScreenReaderUpdate(message: string): void;
    // Highlights selected rows
    highlightSelectedRows(): void;
    // Highlights the current row for keyboard navigation
    highlightCurrentRow(): void;
    // Navigates to the next row
    navigateToNextRow(): void;
    // Navigates to the previous row
    navigateToPrevRow(): void;
    // Applies column widths
    applyColumnWidths(): void;
}

// Interface defining the state of a SnapRecords instance
export interface SnapRecordsState<T extends Identifiable & Record<string, unknown>> {
    // Current page number
    readonly currentPage: number;
    // Number of rows per page
    readonly rowsPerPage: number;
    // Applied filters
    readonly filters: Readonly<Record<string, string>>;
    // Applied sort conditions
    readonly sortConditions: ReadonlyArray<SortCondition>;
    // List of column names
    readonly columns: ReadonlyArray<string>;
    // List of column titles
    readonly columnTitles: ReadonlyArray<string>;
    // Map of column widths
    readonly columnWidths: ReadonlyMap<string, number>;
    // Current data array
    readonly data: ReadonlyArray<T>;
    // Total number of records
    readonly totalRecords: number;
    // Current rendering mode
    readonly format: RenderType;
    // Current language code
    readonly language: string;
    // Current translations
    readonly translations: Translation | null;
    // Current theme (light, dark, or default)
    readonly theme: 'light' | 'dark' | 'default';
    // CSS classes for header cells
    readonly headerCellClasses: ReadonlyArray<string>;
}

// Interface for SnapRecords configuration options
export interface SnapRecordsOptions<T extends Identifiable & Record<string, unknown>> {
    // API URL for data fetching
    url: string;
    // List of column names
    columns: string[];
    // Optional list of column titles
    columnTitles?: string[];
    // Rendering mode
    format?: RenderType;
    // Number of rows per page
    rowsPerPage?: RowsPerPage;
    // Flag to enable caching
    useCache?: boolean;
    // Flag to enable URL state persistence
    usePushState?: boolean;
    // Language code for translations
    language?: string;
    // Path to the language files directory
    langPath?: string;
    // CSS classes for header cells
    headerCellClasses?: string[];
    // Cache expiration time
    cacheExpiry?: number;
    // Flag to enable row selection
    selectable?: boolean;
    // Lifecycle hooks for customization
    lifecycleHooks?: LifecycleHooks<T>;
    // Theme (light, dark, or default)
    theme?: 'light' | 'dark' | 'default';
    // Flag to enable draggable columns
    draggableColumns?: boolean;
    // Configuration for the previous page button
    prevButton?: {
        // Button text
        text?: string;
        // Flag indicating if text is HTML
        isHtml?: boolean;
        // Template function for button content
        template?: (page: number | string) => string;
    };
    // Configuration for the next page button
    nextButton?: {
        // Button text
        text?: string;
        // Flag indicating if text is HTML
        isHtml?: boolean;
        // Template function for button content
        template?: (page: number | string) => string;
    };
    // Number of retry attempts for failed fetches
    retryAttempts?: number;
    // Flag to enable preloading of the next page
    preloadNextPage?: boolean;
    // Flag to enable state persistence
    persistState?: boolean;
    // Flag to destroy the instance on window unload
    destroyOnUnload?: boolean;
    // Flag to enable debug logging
    debug?: boolean;
    // Flag to enable lazy loading of media
    lazyLoadMedia?: boolean;
    // Size of the format cache
    formatCacheSize?: number;
    // Optional custom event manager
    eventManager?: (
        parent: SnapRecords<T>,
        renderer: ISnapRenderer<T>,
        callbacks: EventManagerCallbacks
    ) => ISnapEventManager;
    // Optional custom state manager
    stateManager?: (parent: SnapRecords<T>) => StateManager<T>;
    // Optional custom URL manager
    urlManager?: (parent: SnapRecords<T>) => UrlManager<T>;
    // Optional formatters for custom cell rendering
    columnFormatters?: { [columnKey: string]: (value: unknown, row: T) => string };
    // Optional custom renderer
    renderer?: (parent: SnapRecords<T>, container: HTMLElement) => ISnapRenderer<T>;
    // Optional custom cache manager
    cacheManager?: (parent: SnapRecords<T>, urlManager: UrlManager<T>) => CacheManager<T>;
}

// Interface for the public API of SnapRecords
export interface ISnapApi<T extends Identifiable & Record<string, unknown>> {
    // Resets the instance to its initial state
    reset(): void;
    // Destroys the instance
    destroy(): void;
    // Refreshes the data
    refresh(): void;
    // Clears all row selections
    clearSelection(): void;
    // Returns the selected rows
    getSelectedRows(): T[];
    // Returns the current data array
    getData(): ReadonlyArray<T>;
    // Navigates to a specific page
    gotoPage(page: number): void;
    // Returns the total number of records
    getTotals(): { totalRecords: number };
    // Sets the rendering mode
    setRenderMode(mode: RenderType): void;
    // Sets the theme
    setTheme(theme: 'light' | 'dark' | 'default'): void;
    // Sets the language
    setLanguage(newLanguage: string): Promise<void>;
    // Sets the number of rows per page
    setRowsPerPage(newRowsPerPage: RowsPerPage): void;
    // Performs a search with filters
    search(filters: Record<string, string>, merge?: boolean): void;
    // Updates state parameters
    updateParams(
        params: Partial<
            Pick<SnapRecordsState<T>, 'currentPage' | 'rowsPerPage' | 'filters' | 'sortConditions'>
        >
    ): void;
}

/*========================================================================================================
    SNAP TYPES FILES ENDS HERE
==========================================================================================================*/
