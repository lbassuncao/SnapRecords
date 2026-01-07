import {
    ISnapApi,
    LogLevel,
    CacheData,
    RenderType,
    RowsPerPage,
    Translation,
    Identifiable,
    SortCondition,
    ISnapRenderer,
    LifecycleHooks,
    SnapRecordsState,
    ISnapEventManager,
    SnapRecordsOptions,
    SnapRecordsDataError,
    SnapRecordsConfigError,
} from './SnapTypes.js';
import './scss/SnapRecords.scss';
import { LRUCache } from 'lru-cache';
import { SnapApi } from './SnapApi.js';
import { config } from './SnapOptions.js';
import { UrlManager } from './UrlManager.js';
import { sanitizeHTML, log } from './utils.js';
import { SnapRenderer } from './SnapRenderer.js';
import { CacheManager } from './CacheManager.js';
import { StateManager } from './StateManager.js';
import { EventManager } from './EventManager.js';
import { SnapRecordsDB } from './SnapRecordsDB.js';
import { Configuration } from './Configuration.js';
import defaultTranslations from './lang/en_US.json';
import { TranslationManager } from './Translations.js';

// Type definition for a function that can be debounced
type DebounceableFunction = (...args: unknown[]) => void;

/*========================================================================================================

    SNAP RECORDS CLASS

    Main class for the SnapRecords plugin, responsible for managing data tables with pagination,
    sorting, and filtering

    The SnapRecords class is the main entry point for the SnapRecords plugin.
    It manages the lifecycle, state, rendering, and data operations for interactive data tables.
    This includes handling pagination, sorting, filtering, caching, localization, and user interactions.
    The class is highly configurable and extensible, supporting custom renderers, event managers,
    and lifecycle hooks for advanced use cases.

==========================================================================================================*/

export class SnapRecords<T extends Identifiable & Record<string, unknown>> {
    // Private API instance for public method access
    #api!: ISnapApi<T>;
    // Debounced function to load data, preventing rapid successive calls
    #debouncedLoadData!: () => void;
    // LRU cache for storing formatted cell values to improve performance
    #formatCache: LRUCache<string, string>;
    // Configuration instance holding validated user options
    #config: Configuration<T>;
    // Bound handler for window unload event to clean up resources
    #boundUnloadHandler!: () => void;

    // Current state of the SnapRecords instance, including data, pagination, and filters
    public state: SnapRecordsState<T>;
    // HTML element serving as the container for the table
    public readonly container: HTMLElement;
    // Container for the table content, appended to the main container
    public contentContainer: HTMLElement;
    // Container for error messages, displayed when data loading fails
    public errorContainer: HTMLElement | null = null;

    // IndexedDB instance for caching data
    public readonly db: SnapRecordsDB<T>;
    // Renderer instance for rendering the UI (table, list, or cards)
    public readonly renderer: ISnapRenderer<T>;
    // Event manager for handling user interactions (clicks, key presses, etc.)
    public readonly eventManager: ISnapEventManager;
    // State manager for updating and persisting state
    public readonly stateManager: StateManager<T>;
    // URL manager for constructing API request URLs
    public readonly urlManager: UrlManager<T>;
    // Cache manager for handling data caching
    public readonly cacheManager: CacheManager<T>;

    // Flag indicating if data is currently being loaded
    public isLoading: boolean = false;
    // Base URL for API requests
    public baseUrl!: string;
    // Flag to enable or disable caching
    public useCache!: boolean;
    // Flag to enable URL state persistence via pushState
    public usePushState!: boolean;
    // CSS classes for header cells, allowing custom styling
    public headerCellClasses: string[] = [];
    // Delay for debouncing data load requests (in milliseconds)
    public debounceDelay!: number;
    // Cache expiration time (in milliseconds)
    public cacheExpiry!: number;
    // Flag to enable draggable columns
    public draggableColumns!: boolean;
    // Flag to enable row selection
    public selectable!: boolean;
    // Flag to enable state persistence in localStorage
    public persistState!: boolean;
    // Flag to destroy the instance on window unload
    public destroyOnUnload!: boolean;
    // Flag to enable preloading of the next page
    public preloadNextPageEnabled!: boolean;
    // Flag to enable lazy loading of media (e.g., images)
    public lazyLoadMedia!: boolean;
    // Set of indices of selected rows
    public selectedRows: Set<number> = new Set();
    // Index of the currently highlighted row for keyboard navigation
    public currentRowIndex: number = -1;
    // Configuration for the previous page button
    public prevButtonConfig!: {
        text?: string;
        isHtml?: boolean;
        template?: (page: number | string) => string;
    };
    // Configuration for the next page button
    public nextButtonConfig!: {
        text?: string;
        isHtml?: boolean;
        template?: (page: number | string) => string;
    };
    // Number of retry attempts for failed data fetches
    public retryAttempts!: number;
    // Maximum size of the format cache
    public formatCacheSize!: number;
    // Flag to enable debug logging
    public debug: boolean = false;
    // Lifecycle hooks for custom behavior at various stages
    public lifecycleHooks!: LifecycleHooks<T>;
    // Translation manager for handling language files
    public readonly translationManager: TranslationManager; // Add a property for the TranslationManager instance.
    // Formatters for custom cell value rendering
    public columnFormatters?: { [columnKey: string]: (value: unknown, row: T) => string };
    // Hash of the last applied filters for cache invalidation
    public lastFilterHash: string = '';

    // Getter for the localStorage key used to persist state
    public get storageKey(): string {
        return `snap-records-state-${this.container.id}`;
    }

    // Constructor initializes the SnapRecords instance with a container ID and options
    constructor(containerId: string, options: Partial<SnapRecordsOptions<T>> = {}) {
        // Measure initialization time for performance logging
        const startTime = performance.now();
        // Find the container element by ID
        const containerEl = document.getElementById(containerId);
        if (!containerEl)
            throw new SnapRecordsConfigError(`Container with ID '${containerId}' not found.`);
        this.container = containerEl;
        // Create a content container for the table
        this.contentContainer = document.createElement('div');

        // Initialize debug flag early as it's used by the logger
        this.debug = options.debug ?? false; // Initialize debug from options

        // Initialize configuration with user options and a warning logger
        // Corrected: Pass this.debug and this.log directly
        this.#config = new Configuration(options, this.debug, this.log.bind(this));
        const configOptions = this.#config.options;
        // Initialize instance properties from options
        this.#initializeProperties(configOptions);

        window.addEventListener('error', (event) => {
            this.log(LogLevel.ERROR, 'Unhandled error', event.error);
        });

        window.addEventListener('unhandledrejection', (event) => {
            this.log(LogLevel.ERROR, 'Unhandled promise rejection', event.reason);
        });

        // Initialize the LRU cache for formatted values
        this.#formatCache = new LRUCache<string, string>({ max: this.formatCacheSize });

        // Initialize the state with default values
        this.state = {
            currentPage: 1,
            rowsPerPage: configOptions.rowsPerPage ?? RowsPerPage.DEFAULT,
            filters: {},
            sortConditions: [],
            columns: [...configOptions.columns],
            columnTitles: [...(configOptions.columnTitles ?? configOptions.columns)],
            columnWidths: new Map(),
            data: [],
            totalRecords: 0,
            format: configOptions.format ?? RenderType.TABLE,
            language: configOptions.language ?? 'en_US',
            translations: null,
            theme: configOptions.theme ?? 'default',
            headerCellClasses: [...(configOptions.headerCellClasses ?? [])],
        };

        // Define callbacks for event manager
        const eventCallbacks = {
            reorderColumns: this.reorderColumns.bind(this),
            requestDataLoad: this.refresh.bind(this),
        };

        // Initialize dependencies, passing 'this.log' for standardized logging
        this.db = new SnapRecordsDB<T>(`SnapRecordsDB_${this.container.id}`);
        // This ensures each SnapRecords instance can have its own path for translations.
        this.translationManager = new TranslationManager(
            configOptions.langPath,
            this.debug,
            this.log.bind(this)
        );
        this.stateManager = options.stateManager?.(this) ?? new StateManager(this);
        this.urlManager = options.urlManager?.(this) ?? new UrlManager(this);
        this.cacheManager =
            options.cacheManager?.(this, this.urlManager) ??
            new CacheManager(this, this.urlManager);
        this.renderer =
            options.renderer?.(this, this.contentContainer) ??
            new SnapRenderer(this, this.contentContainer);
        this.eventManager =
            options.eventManager?.(this, this.renderer, eventCallbacks) ??
            new EventManager(this, this.renderer, eventCallbacks);

        // Initialize the public API
        this.#api = new SnapApi(this);
        // Create a debounced data load function
        this.#debouncedLoadData = this.#debounce(() => this.loadData(), this.debounceDelay);

        // Perform initial setup
        this.#initialize();
        this.log(LogLevel.INFO, `SnapRecords initialized in ${performance.now() - startTime}ms.`);
    }

    // Returns the public API instance
    public getApi(): ISnapApi<T> {
        return this.#api;
    }

    // Returns the current data array
    public getData(): ReadonlyArray<T> {
        return this.state.data;
    }

    // Returns the total number of records
    public getTotals(): { totalRecords: number } {
        return { totalRecords: this.state.totalRecords };
    }

    // Logs messages based on the debug flag and log level
    // This is the standardized log method that calls utils.log
    public log(level: LogLevel, ...args: unknown[]): void {
        log(this.debug, level, ...args);
    }

    // Refreshes the data by triggering a load
    public refresh(): void {
        this.log(LogLevel.INFO, 'Data refresh requested.');
        this.#debouncedLoadData();
    }

    // Clears all row selections
    public clearSelection(): void {
        this.log(LogLevel.INFO, 'Clearing all row selections.');
        this.selectedRows.clear();
        this.renderer.highlightSelectedRows();
    }

    // Navigates to the specified page
    public gotoPage(page: number): void {
        this.log(LogLevel.INFO, `Navigating to page ${page}.`);
        this.stateManager.setState((draft) => {
            draft.currentPage = page;
        });
        this.clearFormatCache();
        this.#debouncedLoadData();
    }

    // Sets the theme (light or dark)
    public setTheme(theme: 'light' | 'dark'): void {
        if (this.state.theme !== theme) {
            this.log(LogLevel.INFO, `Setting theme to: ${theme}`);
            this.stateManager.setState((draft) => {
                (draft.theme as 'light' | 'dark') = theme;
            });
            this.renderer.applyThemeClass();
        }
    }

    // Creates a new mobile card
    public createMobileCard(row: T, index: number): HTMLDivElement {
        const card = document.createElement('div');
        card.classList.add(config.classes.mobileCard);
        card.setAttribute('data-key', row.id.toString());
        card.setAttribute('role', 'rowgroup');
        this.updateMobileCard(card, row, index);
        return card;
    }

    // Creates a new list item
    public createListItem(row: T, index: number): HTMLLIElement {
        const li = document.createElement('li');
        li.classList.add(...config.classes.list.itemClass.split(' '));
        li.setAttribute('data-index', index.toString());
        li.setAttribute('data-key', row.id.toString());
        li.setAttribute('role', 'listitem');
        this.updateListItem(li, row, index);
        return li;
    }

    // Sets the rendering mode (table, list, or mobile cards)
    public setRenderMode(mode: RenderType): void {
        if (this.state.format !== mode) {
            this.log(LogLevel.INFO, `Setting render mode to: ${mode}`);
            this.stateManager.setState((draft) => {
                (draft.format as RenderType) = mode;
            });
            this.clearFormatCache();
            this.renderer.render();
            this.eventManager.setupAllHandlers();
        }
    }

    // Clears the in-memory format cache
    public clearFormatCache(): void {
        this.#formatCache.clear();
        this.log(LogLevel.INFO, 'In-memory format cache cleared.');
    }

    // Destroys the SnapRecords instance, cleaning up resources
    public destroy(): void {
        this.log(LogLevel.LOG, 'Destroying SnapRecords Instance...');
        this.eventManager.destroy();
        this.renderer.destroy();
        this.db.close();

        // Clear the cache of the instance-specific translation manager.
        this.translationManager.clearCache();

        if (this.destroyOnUnload) {
            window.removeEventListener('beforeunload', this.#boundUnloadHandler);
        }
    }

    // Updates a mobile card with new data
    public updateMobileCard(div: HTMLDivElement, row: T, index: number): void {
        div.setAttribute('data-index', index.toString());
        div.innerHTML = '';
        this.state.columns.forEach((col: string) => {
            const cardRow = document.createElement('div');
            cardRow.classList.add(config.classes.cardRow);
            cardRow.setAttribute('role', 'row');
            const label = document.createElement('span');
            label.classList.add(config.classes.cardLabel);
            label.setAttribute('role', 'columnheader');
            const value = document.createElement('span');
            value.classList.add(config.classes.cardValue);
            value.setAttribute('role', 'cell');
            const colIdx = this.state.columns.indexOf(col);
            const headerTitle = colIdx !== -1 ? this.state.columnTitles[colIdx] : col;
            label.textContent = `${headerTitle}:`;
            value.innerHTML = this.getFormattedValue(row[col as keyof T], col, row);
            cardRow.appendChild(label);
            cardRow.appendChild(value);
            div.appendChild(cardRow);
        });
    }

    // Reorders columns based on drag-and-drop interactions
    public reorderColumns(sourceColId: string, targetColId: string): void {
        this.stateManager.setState((draft) => {
            // Find indices of source and target columns
            const sourceIndex = draft.columns.indexOf(sourceColId);
            const targetIndex = draft.columns.indexOf(targetColId);
            if (sourceIndex === -1 || targetIndex === -1) return;

            // Reorder columns
            const cols = draft.columns as string[];
            const titles = draft.columnTitles as string[];
            const classes = draft.headerCellClasses as string[];

            const [sourceColumn] = cols.splice(sourceIndex, 1);
            cols.splice(targetIndex, 0, sourceColumn);

            const [sourceTitle] = titles.splice(sourceIndex, 1);
            titles.splice(targetIndex, 0, sourceTitle);

            if (classes.length > 0) {
                const [sourceClass] = classes.splice(sourceIndex, 1);
                classes.splice(targetIndex, 0, sourceClass);
            }
            this.log(LogLevel.INFO, `Columns reordered. New order: ${cols.join(', ')}`);
        });

        // Clear format cache as column order affects rendering
        this.clearFormatCache();
        // Re-render the UI
        this.renderer.render();
        // Re-attach event handlers
        this.eventManager.setupAllHandlers();
    }

    // Formats a cell value, using cache and formatters if available
    public getFormattedValue(value: unknown, column: string, row: T): string {
        const cacheKey = `${row.id}_${column}`;

        if (this.#formatCache.has(cacheKey)) {
            return this.#formatCache.get(cacheKey)!;
        }

        const formatted =
            this.columnFormatters && this.columnFormatters[column]
                ? this.columnFormatters[column](value, row)
                : String(value ?? '');

        let finalHtml = sanitizeHTML(formatted);

        if (this.lazyLoadMedia) {
            finalHtml = finalHtml.replace(/<img /g, '<img loading="lazy" ');
        }

        this.#formatCache.set(cacheKey, finalHtml);

        return finalHtml;
    }

    // Loads data, checking cache first and falling back to API fetch
    public async loadData(attempt: number = 1): Promise<void> {
        if (!this.baseUrl) return;
        this.#startPerfMark('data-load');
        this.log(LogLevel.INFO, 'Starting data load process...');
        this.renderer.showLoading();
        try {
            this.cacheManager.invalidateCache();
            const url = this.urlManager.buildUrl(this.urlManager.getServerParams());

            if (this.useCache) {
                const cached = await this.cacheManager.getCachedData(url);
                if (cached && Date.now() - cached.timestamp < this.cacheExpiry) {
                    await this.#handleCachedResponse(cached);
                    return;
                }
            }
            await this.#fetchAndProcessData(url, attempt);
        } catch (error) {
            this.#handleDataLoadError(error, attempt, this.baseUrl);
        } finally {
            this.renderer.hideLoading();
            this.#endPerfMark('data-load');
        }
    }

    // Performs a search with the provided filters
    public search(filters: Record<string, string>, merge: boolean = false): void {
        this.log(LogLevel.INFO, 'Performing search with filters:', { filters, merge });
        this.stateManager.setState((draft) => {
            draft.currentPage = 1;
            (draft.filters as Record<string, string>) = merge
                ? { ...draft.filters, ...filters }
                : filters;
        });
        this.clearFormatCache();
        this.#debouncedLoadData();
    }

    // Returns the currently selected rows
    public getSelectedRows(): T[] {
        return Array.from(this.selectedRows).map((index) => this.state.data[index]) as T[];
    }

    // Updates a list item with new data
    public updateListItem(li: HTMLLIElement, row: T, index: number): void {
        li.setAttribute('data-index', index.toString());
        const formattedContent = this.state.columns
            .map((col: string) => {
                const colIndex = this.state.columns.indexOf(col);
                const headerTitle = colIndex !== -1 ? this.state.columnTitles[colIndex] : col;
                const value = this.getFormattedValue(row[col as keyof T], col, row);
                return `<strong>${headerTitle}:</strong> ${value}`;
            })
            .join(' | ');
        li.innerHTML = formattedContent;
    }

    // Sets the number of rows per page
    public setRowsPerPage(newRowsPerPage: RowsPerPage): void {
        if (this.state.rowsPerPage !== newRowsPerPage) {
            this.log(LogLevel.INFO, `Setting rows per page to: ${newRowsPerPage}`);
            this.stateManager.setState((draft) => {
                draft.rowsPerPage = newRowsPerPage;
                draft.currentPage = 1;
            });
            this.clearFormatCache();
            this.#debouncedLoadData();
            this.renderer.announceScreenReaderUpdate(`Rows per page changed to ${newRowsPerPage}`);
        }
    }

    // Updates a table row with new data
    public updateRow(tr: HTMLTableRowElement, row: T, index: number): void {
        tr.setAttribute('data-index', index.toString());

        const fragment = document.createDocumentFragment();
        this.state.columns.forEach((col) => {
            const colName = col as string;
            const td = document.createElement('td');
            td.setAttribute('role', 'gridcell');
            td.setAttribute('data-col-id', colName);
            const formattedValue = this.getFormattedValue(row[colName as keyof T], colName, row);
            td.innerHTML = formattedValue;
            td.dataset.lastValue = formattedValue;
            fragment.appendChild(td);
        });

        tr.innerHTML = '';
        tr.appendChild(fragment);
    }

    // Creates a new table row
    public createTableRow(row: T, index: number, rowKey: string | number): HTMLTableRowElement {
        const tr = document.createElement('tr');
        tr.setAttribute('role', 'row');
        tr.setAttribute('data-index', index.toString());
        tr.setAttribute('data-key', String(rowKey));
        this.state.columns.forEach((col) => {
            const colName = col as string;
            const td = document.createElement('td');
            td.setAttribute('role', 'gridcell');
            td.setAttribute('data-col-id', colName);
            const formattedValue = this.getFormattedValue(row[colName as keyof T], colName, row);
            td.innerHTML = formattedValue;
            td.dataset.lastValue = formattedValue;
            tr.appendChild(td);
        });
        return tr;
    }

    // Resets the instance to its initial state
    public reset(): void {
        this.log(LogLevel.INFO, 'Resetting instance to initial state.');
        if (this.persistState) localStorage.removeItem(this.storageKey);
        this.stateManager.setState((draft) => {
            const configOptions = this.#config.options;
            draft.currentPage = 1;
            (draft.filters as Record<string, string>) = {};
            (draft.sortConditions as SortCondition[]) = [];
            (draft.columns as string[]) = [...(configOptions.columns || [])];
            (draft.columnTitles as string[]) = [
                ...(configOptions.columnTitles || configOptions.columns || []),
            ];
            (draft.headerCellClasses as string[]) = [...(configOptions.headerCellClasses || [])];
            (draft.columnWidths as Map<string, number>) = new Map();
        });
        this.clearFormatCache();
        this.#debouncedLoadData();
    }

    // Updates state parameters and triggers a data reload
    public updateParams(
        params: Partial<
            Pick<SnapRecordsState<T>, 'currentPage' | 'rowsPerPage' | 'filters' | 'sortConditions'>
        >
    ): void {
        this.log(LogLevel.INFO, 'Updating parameters.', params);
        this.stateManager.setState((draft) => {
            Object.assign(draft, params);
        });
        this.clearFormatCache();
        this.#debouncedLoadData();
    }

    // Handles a cached response by updating state and rendering
    async #handleCachedResponse(cached: CacheData<T>): Promise<void> {
        this.log(LogLevel.INFO, 'Using cached response for URL:', cached.url);
        this.stateManager.setState((draft) => {
            (draft.data as T[]) = cached.data;
            draft.totalRecords = cached.totalRecords;
        });
        this.renderer.render();
        this.eventManager.setupAllHandlers();
        if (this.preloadNextPageEnabled) this.cacheManager.preloadNextPage();
    }

    // Fetches data from the API and processes the response
    async #fetchAndProcessData(url: string, attempt: number): Promise<void> {
        this.log(LogLevel.INFO, `Fetching data from URL (Attempt ${attempt}): ${url}`);
        if (this.lifecycleHooks.preDataLoad)
            this.lifecycleHooks.preDataLoad(this.urlManager.getServerParams());
        const response = await fetch(url);
        if (!response.ok) throw new SnapRecordsDataError(`HTTP error! status: ${response.status}`);
        const data = await response.json();
        await this.#processSuccessfulResponse(data, url);
    }

    // Processes a successful API response
    async #processSuccessfulResponse(
        data: { data: T[]; totalRecords: number },
        url: string
    ): Promise<void> {
        const receivedData: T[] = data.data || [];
        this.log(LogLevel.INFO, 'Successfully fetched and processed data.', {
            url,
            totalRecords: data.totalRecords,
            receivedCount: receivedData.length,
        });
        this.stateManager.setState((draft) => {
            (draft.data as T[]) = receivedData;
            draft.totalRecords = data.totalRecords || 0;
        });
        if (this.useCache)
            await this.cacheManager.cacheData(url, {
                url: url,
                data: [...this.state.data],
                totalRecords: this.state.totalRecords,
                timestamp: Date.now(),
            });
        if (this.lifecycleHooks.postDataLoad) this.lifecycleHooks.postDataLoad(this.state.data);
        this.clearFormatCache();
        this.renderer.render();
        this.eventManager.setupAllHandlers();
        if (this.preloadNextPageEnabled) this.cacheManager.preloadNextPage();
    }

    // Sets the language and reloads translations
    public async setLanguage(newLanguage: string): Promise<void> {
        if (this.state.language !== newLanguage) {
            this.log(LogLevel.INFO, `Setting language to: ${newLanguage}`);
            // Use the instance-specific translation manager to get the new language file.
            const translations =
                (await this.translationManager.get(newLanguage)) ?? defaultTranslations;
            this.stateManager.setState((draft) => {
                (draft.language as string) = newLanguage;
                draft.translations = translations;
            });
            this.clearFormatCache();
            this.renderer.render();
            this.eventManager.setupAllHandlers();
        }
    }

    #startPerfMark(label: string) {
        if (this.debug) performance.mark(`${label}-start`);
    }

    #endPerfMark(label: string) {
        if (this.debug) {
            performance.mark(`${label}-end`);
            performance.measure(label, `${label}-start`, `${label}-end`);
            const measure = performance.getEntriesByName(label)[0];
            this.log(LogLevel.INFO, `${label} took ${measure.duration}ms`);
        }
    }

    // Creates a debounced version of a function
    #debounce(fn: DebounceableFunction, delay: number): () => void {
        let timeoutId: number | null = null;
        return (...args: unknown[]) => {
            if (timeoutId) clearTimeout(timeoutId);
            timeoutId = window.setTimeout(() => fn(...args), delay);
        };
    }

    // Handles data load errors with retries
    #handleDataLoadError(error: unknown, _attempt: number, url: string): void {
        if (_attempt <= this.retryAttempts && !(error instanceof SnapRecordsDataError)) {
            this.log(LogLevel.WARN, `Retry attempt ${_attempt} for URL:`, url, { error });
            this.loadData(_attempt + 1);
            return;
        }
        const errMessage = (
            this.state.translations ?? defaultTranslations
        ).errors.dataLoadingFailed.replace('{error}', (error as Error).message);
        this.log(LogLevel.ERROR, 'Data load failed after all retries:', { error, url });
        this.renderer.showError(errMessage);
    }

    // Initializes the component by setting up containers, loading state, and fetching data
    async #initialize(): Promise<void> {
        this.log(LogLevel.INFO, 'Starting component initialization...');
        // Create UI containers
        this.renderer.createContainers();
        // Load persisted state if enabled
        if (this.persistState) this.stateManager.loadStateFromStorage();
        // Load state from URL if enabled
        this.stateManager.loadFromURL();
        // Apply the current theme
        this.renderer.applyThemeClass();

        try {
            // Load translations for the current language
            // Load translations for the current language using the instance-specific manager.
            const translations =
                (await this.translationManager.get(this.state.language)) ?? defaultTranslations;
            this.stateManager.setState((draft) => {
                draft.translations = translations;
            });
        } catch (error) {
            // Handle translation loading errors by falling back to default translations
            this.log(LogLevel.ERROR, 'Failed to initialize translations', error);
            const defaultTrans = defaultTranslations as Translation;
            this.stateManager.setState((draft) => {
                draft.translations = defaultTrans;
            });
            this.renderer.showError(defaultTrans.errors.generic);
        } finally {
            // Render the UI, set up event handlers, and load data
            this.renderer.render();
            this.eventManager.setupAllHandlers();
            this.#debouncedLoadData();
            this.log(LogLevel.INFO, 'Component initialization finished.');
        }
    }

    // Initializes instance properties from configuration options
    #initializeProperties(options: SnapRecordsOptions<T>): void {
        this.log(LogLevel.LOG, 'Initializing instance properties from options.');
        // debug flag is already initialized in constructor before Configuration is used
        this.baseUrl = options.url;
        this.useCache = options.useCache ?? false;
        this.usePushState = options.usePushState ?? false;
        this.columnFormatters = options.columnFormatters;
        this.debounceDelay = config.constants.defaultDebounceDelay;
        this.cacheExpiry = options.cacheExpiry ?? config.constants.defaultCacheExpiry;
        this.selectable = options.selectable ?? false;
        this.lifecycleHooks = options.lifecycleHooks ?? {};
        this.draggableColumns = options.draggableColumns ?? false;
        this.preloadNextPageEnabled = options.preloadNextPage ?? false;
        this.lazyLoadMedia = options.lazyLoadMedia ?? false;
        this.persistState = options.persistState ?? false;
        this.destroyOnUnload = options.destroyOnUnload ?? true;
        this.retryAttempts = options.retryAttempts ?? 3;
        this.formatCacheSize = options.formatCacheSize ?? 500;
        this.prevButtonConfig = { ...config.pagination.prevButton, ...options.prevButton };
        this.nextButtonConfig = { ...config.pagination.nextButton, ...options.nextButton };
        this.#boundUnloadHandler = this.destroy.bind(this);
        if (this.destroyOnUnload) window.addEventListener('beforeunload', this.#boundUnloadHandler);
    }
}

/*========================================================================================================
    SNAPRECORDS CLASS ENDS HERE
==========================================================================================================*/
