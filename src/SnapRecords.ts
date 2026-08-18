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
    SnapTheme,
    SnapRecordsConfigError,
} from './SnapTypes.js';
import './scss/SnapRecords.scss';
import { LRUCache } from 'lru-cache';
import { SnapApi } from './SnapApi.js';
import { config } from './SnapOptions.js';
import { UrlManager } from './UrlManager.js';
import {
    sanitizeHTML,
    escapeHTML,
    log,
    compactFiltering,
    normalizeSorting,
    sanitizeRowsPerPage,
    resolveTotalRecords,
    sanitizeLanguage,
} from './utils.js';
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

const activeInstances = new WeakMap<HTMLElement, { destroy: () => void }>();

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
    #boundPopState = (): void => {
        if (this.#destroyed || !this.usePushState) return;
        this.stateManager.loadFromURL({ emptyMeansDefaults: true, absentSnapFieldsReset: true });
        this.clearFormatCache();
        this.renderer.render();
        this.eventManager.setupAllHandlers();
        this.#debouncedLoadData();
    };
    #destroyed = false;
    #loadDataTimer: number | null = null;
    #retryTimer: number | null = null;
    #abortController: AbortController | null = null;

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
    public readonly renderer: ISnapRenderer;
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
    public preloadNextPage!: boolean;
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
        classNames: { base: string; disabled?: string; active?: string };
    };
    // Configuration for the next page button
    public nextButtonConfig!: {
        text?: string;
        isHtml?: boolean;
        template?: (page: number | string) => string;
        classNames: { base: string; disabled?: string; active?: string };
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
    public readonly translationManager: TranslationManager;
    // Formatters for custom cell value rendering
    public columnFormatters?: { [columnKey: string]: (value: unknown, row: T) => string };
    // Hash of the last applied filters for cache invalidation
    public lastFilterHash: string = '';

    // Getter for the localStorage key used to persist state
    public get isDestroyed(): boolean {
        return this.#destroyed;
    }

    public get storageKey(): string {
        return `snap-records-state-${this.container.id}`;
    }

    public get headerCellClasses(): ReadonlyArray<string> {
        return this.state.headerCellClasses;
    }

    constructor(container: string | HTMLElement, options: Partial<SnapRecordsOptions<T>> = {}) {
        const startTime = performance.now();
        const containerEl =
            typeof container === 'string' ? document.getElementById(container) : container;
        if (!containerEl) {
            const message =
                typeof container === 'string'
                    ? `Container with ID '${container}' not found.`
                    : 'Container element is required.';
            throw new SnapRecordsConfigError(message);
        }
        activeInstances.get(containerEl)?.destroy();
        this.container = containerEl;
        if (!this.container.id) {
            this.container.id = `snap-records-${Date.now().toString(36)}-${Math.random()
                .toString(36)
                .slice(2, 8)}`;
        }
        this.contentContainer = document.createElement('div');

        this.debug = options.debug ?? false;

        this.#config = new Configuration(options, this.debug, this.log.bind(this));
        const configOptions = this.#config.options;
        this.#initializeProperties(configOptions);

        // Initialize the LRU cache for formatted values
        this.#formatCache = new LRUCache<string, string>({ max: this.formatCacheSize });

        // Initialize the state with default values
        this.state = {
            currentPage: 1,
            rowsPerPage: configOptions.rowsPerPage ?? RowsPerPage.DEFAULT,
            filtering: compactFiltering({ ...(configOptions.filtering ?? {}) }),
            sorting: normalizeSorting(configOptions.sorting ?? []),
            columns: [...configOptions.columns],
            columnTitles: [
                ...(configOptions.columnTitles?.length
                    ? configOptions.columnTitles
                    : configOptions.columns),
            ],
            columnWidths: new Map(),
            data: [],
            totalRecords: 0,
            format: configOptions.format ?? RenderType.TABLE,
            language: sanitizeLanguage(configOptions.language ?? 'en_US'),
            translations: null,
            theme: configOptions.theme ?? 'default',
            headerCellClasses: [...(configOptions.headerCellClasses ?? [])],
        };
        this.lastFilterHash = JSON.stringify(compactFiltering(this.state.filtering));

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
        activeInstances.set(this.container, this);
        this.log(LogLevel.INFO, `SnapRecords initialized in ${performance.now() - startTime}ms.`);
    }

    // Returns the public API instance
    public getConfigOptions(): SnapRecordsOptions<T> {
        return this.#config.options;
    }

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
        if (this.#destroyed) return;
        this.log(LogLevel.INFO, 'Data refresh requested.');
        this.#debouncedLoadData();
    }

    // Clears all row selections
    public clearSelection(): void {
        if (this.#destroyed) return;
        if (this.selectedRows.size === 0) {
            this.renderer.highlightSelectedRows();
            return;
        }
        this.log(LogLevel.INFO, 'Clearing all row selections.');
        this.selectedRows.clear();
        this.currentRowIndex = -1;
        this.renderer.highlightSelectedRows();
        this.invokeLifecycleHook('selectionChanged', this.getSelectedRows());
    }

    public invokeLifecycleHook<K extends keyof LifecycleHooks<T>>(
        name: K,
        ...args: Parameters<NonNullable<LifecycleHooks<T>[K]>>
    ): void {
        const hook = this.lifecycleHooks[name];
        if (typeof hook !== 'function') return;
        try {
            (hook as (...hookArgs: typeof args) => void)(...args);
        } catch (error) {
            this.log(LogLevel.ERROR, `lifecycleHooks.${String(name)} threw:`, error);
        }
    }

    // Navigates to the specified page
    public setCurrentPage(page: number): void {
        if (this.#destroyed) return;
        let nextPage = Math.max(1, Math.trunc(page) || 1);
        if (this.state.totalRecords > 0) {
            const totalPages = Math.max(
                1,
                Math.ceil(this.state.totalRecords / this.state.rowsPerPage)
            );
            nextPage = Math.min(nextPage, totalPages);
        }
        if (nextPage === this.state.currentPage) return;
        this.log(LogLevel.INFO, `Navigating to page ${nextPage}.`);
        this.stateManager.setState((draft) => {
            draft.currentPage = nextPage;
        });
        this.clearFormatCache();
        this.#debouncedLoadData();
    }

    public setTheme(theme: SnapTheme): void {
        if (this.#destroyed || this.state.theme === theme) return;
        if (theme !== 'light' && theme !== 'dark' && theme !== 'default') {
            this.log(
                LogLevel.WARN,
                `Invalid theme '${String(theme)}'. Expected light, dark, or default.`
            );
            return;
        }
        this.log(LogLevel.INFO, `Setting theme to: ${theme}`);
        this.stateManager.setState((draft) => {
            draft.theme = theme;
        });
        this.renderer.applyThemeClass();
    }

    // Sets the rendering mode (table, list, or mobile cards)
    public setFormat(mode: RenderType): void {
        if (this.#destroyed || this.state.format === mode) return;
        if (!Object.values(RenderType).includes(mode)) {
            this.log(LogLevel.WARN, `Invalid format '${String(mode)}'.`);
            return;
        }
        this.log(LogLevel.INFO, `Setting render mode to: ${mode}`);
        this.stateManager.setState((draft) => {
            (draft.format as RenderType) = mode;
        });
        this.clearFormatCache();
        this.renderer.render();
        this.eventManager.setupAllHandlers();
    }

    // Clears the in-memory format cache
    public clearFormatCache(): void {
        this.#formatCache.clear();
        this.log(LogLevel.INFO, 'In-memory format cache cleared.');
    }

    public destroy(): void {
        if (this.#destroyed) return;
        this.#destroyed = true;
        this.log(LogLevel.LOG, 'Destroying SnapRecords Instance...');
        if (this.#loadDataTimer) {
            clearTimeout(this.#loadDataTimer);
            this.#loadDataTimer = null;
        }
        if (this.#retryTimer) {
            clearTimeout(this.#retryTimer);
            this.#retryTimer = null;
        }
        this.#abortController?.abort();
        this.#abortController = null;
        this.cacheManager.abortPreload();
        this.eventManager.destroy();
        this.renderer.destroy();
        this.stateManager.destroy?.();
        this.container.classList.remove(
            config.classes.tableContainer,
            config.classes.selectable,
            'theme-light',
            'theme-dark',
            'theme-default'
        );
        this.db.close();
        this.translationManager.clearCache();
        this.clearFormatCache();
        this.selectedRows.clear();
        this.currentRowIndex = -1;
        if (this.destroyOnUnload) {
            window.removeEventListener('beforeunload', this.#boundUnloadHandler);
        }
        window.removeEventListener('popstate', this.#boundPopState);
        if (activeInstances.get(this.container) === this) {
            activeInstances.delete(this.container);
        }
    }

    // Reorders columns based on drag-and-drop interactions
    public reorderColumns(sourceColId: string, targetColId: string): void {
        if (this.#destroyed) return;
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

            if (titles.length === cols.length) {
                const [sourceTitle] = titles.splice(sourceIndex, 1);
                titles.splice(targetIndex, 0, sourceTitle);
            }

            if (classes.length === cols.length) {
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
    public getFormattedValue(value: unknown, column: string, row: T, rowIndex?: number): string {
        const cacheKey = JSON.stringify([rowIndex ?? -1, row.id, column]);

        if (this.#formatCache.has(cacheKey)) {
            return this.#formatCache.get(cacheKey)!;
        }

        const hasFormatter = Boolean(this.columnFormatters?.[column]);
        let formatted: string;
        let treatAsHtml = hasFormatter;
        try {
            const raw = hasFormatter
                ? this.columnFormatters![column](value, row)
                : String(value ?? '');
            formatted = typeof raw === 'string' ? raw : String(raw ?? '');
        } catch (error) {
            this.log(LogLevel.ERROR, `Formatter for column '${column}' threw:`, error);
            formatted = String(value ?? '');
            treatAsHtml = false;
        }

        let finalHtml = treatAsHtml ? sanitizeHTML(formatted) : escapeHTML(formatted);

        if (this.lazyLoadMedia && treatAsHtml) {
            finalHtml = finalHtml.replace(
                /<img(?![^>]*\bloading\s*=)(?=[\s>/])/gi,
                '<img loading="lazy"'
            );
        }

        this.#formatCache.set(cacheKey, finalHtml);

        return finalHtml;
    }

    // Loads data, checking cache first and falling back to API fetch
    public async loadData(attempt: number = 1): Promise<void> {
        if (this.#destroyed || !this.baseUrl || !this.state.translations) return;
        if (this.#retryTimer) {
            clearTimeout(this.#retryTimer);
            this.#retryTimer = null;
        }
        this.#abortController?.abort();
        this.#abortController = new AbortController();
        const request = this.#abortController;
        this.#startPerfMark('data-load');
        this.log(LogLevel.INFO, 'Starting data load process...');
        this.cacheManager.abortPreload();
        this.renderer.showLoading();
        let url = this.baseUrl;
        try {
            await this.cacheManager.invalidateCache();
            if (this.#destroyed || this.#abortController !== request) return;
            url = this.urlManager.buildUrl(this.urlManager.getServerParams());

            if (this.useCache) {
                const cached = await this.cacheManager.getCachedData(url);
                if (this.#destroyed || this.#abortController !== request) return;
                if (cached && Date.now() - cached.timestamp < this.cacheExpiry) {
                    await this.#handleCachedResponse(cached);
                    return;
                }
            }
            await this.#fetchAndProcessData(url, attempt, request);
        } catch (error) {
            this.#handleDataLoadError(error, attempt, url);
        } finally {
            if (!this.#destroyed && this.#abortController === request && !this.#retryTimer) {
                this.renderer.hideLoading();
            }
            this.#endPerfMark('data-load');
        }
    }

    // Performs a search with the provided filters
    public search(filtering: Record<string, string>, merge: boolean = false): void {
        if (this.#destroyed) return;
        this.log(LogLevel.INFO, 'Performing search with filtering:', { filtering, merge });
        const next = compactFiltering(
            merge ? { ...this.state.filtering, ...filtering } : filtering
        );
        if (
            JSON.stringify(next) === JSON.stringify(this.state.filtering) &&
            this.state.currentPage === 1
        ) {
            return;
        }
        this.stateManager.setState((draft) => {
            draft.currentPage = 1;
            (draft.filtering as Record<string, string>) = next;
        });
        this.clearFormatCache();
        this.#debouncedLoadData();
    }

    // Returns the currently selected rows
    public getSelectedRows(): T[] {
        return Array.from(this.selectedRows)
            .map((index) => this.state.data[index])
            .filter((row): row is T => row !== undefined);
    }

    public setRowsPerPage(newRowsPerPage: RowsPerPage): void {
        const next = sanitizeRowsPerPage(newRowsPerPage, this.state.rowsPerPage);
        if (this.#destroyed || this.state.rowsPerPage === next) return;
        this.log(LogLevel.INFO, `Setting rows per page to: ${next}`);
        this.stateManager.setState((draft) => {
            draft.rowsPerPage = next;
            draft.currentPage = 1;
        });
        this.clearFormatCache();
        this.#debouncedLoadData();
        const message = (this.state.translations ?? defaultTranslations).rowsPerPageChanged.replace(
            '{count}',
            String(next)
        );
        this.renderer.announceScreenReaderUpdate(message);
    }

    public reset(): void {
        if (this.#destroyed) return;
        this.log(LogLevel.INFO, 'Resetting instance to initial state.');
        if (this.persistState) localStorage.removeItem(this.storageKey);
        this.stateManager.setState((draft) => {
            const configOptions = this.#config.options;
            draft.currentPage = 1;
            (draft.filtering as Record<string, string>) = compactFiltering(
                configOptions.filtering ?? {}
            );
            (draft.sorting as SortCondition[]) = normalizeSorting(configOptions.sorting ?? []);
            draft.rowsPerPage = sanitizeRowsPerPage(
                configOptions.rowsPerPage ?? RowsPerPage.DEFAULT,
                RowsPerPage.DEFAULT
            ) as RowsPerPage;
            (draft.columns as string[]) = [...(configOptions.columns || [])];
            (draft.columnTitles as string[]) = [
                ...(configOptions.columnTitles?.length
                    ? configOptions.columnTitles
                    : configOptions.columns || []),
            ];
            (draft.headerCellClasses as string[]) = [...(configOptions.headerCellClasses || [])];
            (draft.columnWidths as Map<string, number>) = new Map();
        });
        this.clearSelection();
        this.clearFormatCache();
        this.#debouncedLoadData();
    }

    // Updates state parameters and triggers a data reload
    public updateParams(
        params: Partial<
            Pick<SnapRecordsState<T>, 'currentPage' | 'rowsPerPage' | 'filtering' | 'sorting'>
        >
    ): void {
        if (this.#destroyed) return;
        this.log(LogLevel.INFO, 'Updating parameters.', params);
        const previousState = this.state;
        this.stateManager.setState((draft) => {
            const pageExplicit = params.currentPage !== undefined;
            if (params.rowsPerPage !== undefined) {
                const nextRpp = sanitizeRowsPerPage(params.rowsPerPage, draft.rowsPerPage);
                if (nextRpp !== draft.rowsPerPage) {
                    draft.rowsPerPage = nextRpp;
                    if (!pageExplicit) draft.currentPage = 1;
                }
            }
            if (params.filtering !== undefined) {
                const next = compactFiltering(params.filtering);
                if (JSON.stringify(next) !== JSON.stringify(draft.filtering)) {
                    (draft.filtering as Record<string, string>) = next;
                    if (!pageExplicit) draft.currentPage = 1;
                }
            }
            if (params.sorting !== undefined) {
                const nextSorting = normalizeSorting(params.sorting);
                if (JSON.stringify(nextSorting) !== JSON.stringify(draft.sorting)) {
                    (draft.sorting as SortCondition[]) = nextSorting;
                    if (!pageExplicit) draft.currentPage = 1;
                }
            }
            if (pageExplicit) {
                let nextPage = Math.max(1, Math.trunc(params.currentPage!) || 1);
                if (draft.totalRecords > 0) {
                    const totalPages = Math.max(
                        1,
                        Math.ceil(draft.totalRecords / draft.rowsPerPage)
                    );
                    nextPage = Math.min(nextPage, totalPages);
                }
                draft.currentPage = nextPage;
            }
        });
        if (this.state === previousState) return;
        this.clearFormatCache();
        this.#debouncedLoadData();
    }

    // Handles a cached response by updating state and rendering
    async #handleCachedResponse(cached: CacheData<T>): Promise<void> {
        if (this.#destroyed) return;
        this.log(LogLevel.INFO, 'Using cached response for URL:', cached.url);
        this.invokeLifecycleHook('preDataLoad', this.urlManager.getServerParams());
        this.#resetViewSelection();
        this.stateManager.setState((draft) => {
            (draft.data as T[]) = cached.data;
            draft.totalRecords = resolveTotalRecords(cached.totalRecords, cached.data.length);
        });
        if (this.#redirectIfPageOutOfRange()) {
            await this.loadData();
            return;
        }
        if (this.#destroyed) return;
        this.clearFormatCache();
        this.invokeLifecycleHook('postDataLoad', this.state.data);
        this.renderer.render();
        this.eventManager.setupAllHandlers();
        if (this.preloadNextPage) this.cacheManager.preloadNextPage();
    }

    // Fetches data from the API and processes the response
    async #fetchAndProcessData(
        url: string,
        attempt: number,
        request: AbortController
    ): Promise<void> {
        if (this.#destroyed) return;
        this.log(LogLevel.INFO, `Fetching data from URL (Attempt ${attempt}): ${url}`);
        this.invokeLifecycleHook('preDataLoad', this.urlManager.getServerParams());
        const response = await fetch(url, { signal: request.signal });
        if (this.#destroyed || this.#abortController !== request) return;
        if (!response.ok) {
            throw new SnapRecordsDataError(
                `HTTP error! status: ${response.status}`,
                response.status
            );
        }
        let data: unknown;
        try {
            data = await response.json();
        } catch {
            throw new SnapRecordsDataError('Invalid API response', response.status);
        }
        if (
            !data ||
            typeof data !== 'object' ||
            !Array.isArray((data as { data?: unknown }).data)
        ) {
            throw new SnapRecordsDataError('Invalid API response', response.status);
        }
        await this.#processSuccessfulResponse(
            data as { data: T[]; totalRecords: number },
            url,
            request
        );
    }

    // Processes a successful API response
    async #processSuccessfulResponse(
        data: { data: T[]; totalRecords: number },
        url: string,
        request?: AbortController
    ): Promise<void> {
        if (this.#destroyed) return;
        const receivedData: T[] = data.data || [];
        this.log(LogLevel.INFO, 'Successfully fetched and processed data.', {
            url,
            totalRecords: data.totalRecords,
            receivedCount: receivedData.length,
        });
        this.#resetViewSelection();
        this.stateManager.setState((draft) => {
            (draft.data as T[]) = receivedData;
            draft.totalRecords = resolveTotalRecords(data.totalRecords, receivedData.length);
        });
        if (this.#destroyed || (request && this.#abortController !== request)) return;
        if (this.#redirectIfPageOutOfRange()) {
            await this.loadData();
            return;
        }
        if (this.useCache)
            await this.cacheManager.cacheData(url, {
                url: url,
                data: [...this.state.data],
                totalRecords: this.state.totalRecords,
                timestamp: Date.now(),
            });
        if (this.#destroyed || (request && this.#abortController !== request)) return;
        this.invokeLifecycleHook('postDataLoad', this.state.data);
        this.clearFormatCache();
        this.renderer.render();
        this.eventManager.setupAllHandlers();
        if (this.preloadNextPage) this.cacheManager.preloadNextPage();
    }

    // Sets the language and reloads translations
    public async setLanguage(newLanguage: string): Promise<void> {
        const safeLang = sanitizeLanguage(newLanguage);
        if (this.#destroyed || this.state.language === safeLang) return;
        this.log(LogLevel.INFO, `Setting language to: ${safeLang}`);
        try {
            const translations =
                (await this.translationManager.get(safeLang)) ?? defaultTranslations;
            if (this.#destroyed) return;
            this.stateManager.setState((draft) => {
                (draft.language as string) = safeLang;
                draft.translations = translations;
            });
            this.clearFormatCache();
            this.renderer.render();
            this.eventManager.setupAllHandlers();
        } catch (error) {
            if (this.#destroyed) return;
            if (error instanceof Error && error.name === 'AbortError') return;
            this.log(LogLevel.ERROR, `Failed to load language '${safeLang}'`, error);
            if (!this.state.translations) {
                this.stateManager.setState((draft) => {
                    draft.translations = defaultTranslations as Translation;
                });
                this.renderer.render();
                this.eventManager.setupAllHandlers();
            }
        }
    }

    #redirectIfPageOutOfRange(): boolean {
        if (this.state.totalRecords <= 0) {
            if (this.state.currentPage !== 1) {
                this.stateManager.setState((draft) => {
                    draft.currentPage = 1;
                });
                return true;
            }
            return false;
        }
        const totalPages = Math.max(1, Math.ceil(this.state.totalRecords / this.state.rowsPerPage));
        if (this.state.currentPage <= totalPages) return false;
        this.stateManager.setState((draft) => {
            draft.currentPage = totalPages;
        });
        return true;
    }

    #resetViewSelection(): void {
        this.currentRowIndex = -1;
        this.clearSelection();
    }

    #startPerfMark(label: string) {
        if (this.debug) performance.mark(`${label}-start`);
    }

    #endPerfMark(label: string) {
        if (!this.debug) return;
        const start = `${label}-start`;
        const end = `${label}-end`;
        try {
            performance.mark(end);
            performance.measure(label, start, end);
            const measures = performance.getEntriesByName(label, 'measure');
            const measure = measures[measures.length - 1];
            if (measure) this.log(LogLevel.INFO, `${label} took ${measure.duration}ms`);
        } catch (error) {
            this.log(LogLevel.LOG, `Could not measure '${label}'`, error);
        } finally {
            performance.clearMarks(start);
            performance.clearMarks(end);
            performance.clearMeasures(label);
        }
    }

    // Creates a debounced version of a function
    #debounce(fn: DebounceableFunction, delay: number): () => void {
        return (...args: unknown[]) => {
            if (this.#destroyed) return;
            if (this.#loadDataTimer) clearTimeout(this.#loadDataTimer);
            this.#loadDataTimer = window.setTimeout(() => {
                this.#loadDataTimer = null;
                if (!this.#destroyed) fn(...args);
            }, delay);
        };
    }

    // Handles data load errors with retries
    #handleDataLoadError(error: unknown, _attempt: number, url: string): void {
        if (this.#destroyed) return;
        if (error instanceof Error && error.name === 'AbortError') {
            this.log(LogLevel.INFO, 'Data load aborted.');
            return;
        }
        const httpStatus = error instanceof SnapRecordsDataError ? error.status : undefined;
        const retryable =
            !(error instanceof SnapRecordsDataError) ||
            (typeof httpStatus === 'number' && httpStatus >= 500);
        if (_attempt <= this.retryAttempts && retryable) {
            this.log(LogLevel.WARN, `Retry attempt ${_attempt} for URL:`, url, { error });
            const delay = Math.min(2000, 500 * _attempt);
            this.#retryTimer = window.setTimeout(() => {
                this.#retryTimer = null;
                if (!this.#destroyed) void this.loadData(_attempt + 1);
            }, delay);
            return;
        }
        const detail = error instanceof Error ? error.message : String(error);
        const errMessage = (
            this.state.translations ?? defaultTranslations
        ).errors.dataLoadingFailed.replace('{error}', detail);
        this.log(LogLevel.ERROR, 'Data load failed after all retries:', { error, url });
        this.renderer.showError(errMessage);
    }

    // Initializes the component by setting up containers, loading state, and fetching data
    async #initialize(): Promise<void> {
        this.log(LogLevel.INFO, 'Starting component initialization...');
        this.renderer.createContainers();
        this.stateManager.suppressUrlUpdates(() => {
            if (this.persistState) this.stateManager.loadStateFromStorage();
            this.stateManager.loadFromURL();
        });
        this.lastFilterHash = JSON.stringify(compactFiltering(this.state.filtering));
        if (this.usePushState) {
            this.stateManager.updateURLState('replace');
            window.addEventListener('popstate', this.#boundPopState);
        }
        this.renderer.applyThemeClass();

        try {
            const translations =
                (await this.translationManager.get(this.state.language)) ?? defaultTranslations;
            if (this.#destroyed) return;
            this.stateManager.setState((draft) => {
                draft.translations = translations;
            });
        } catch (error) {
            if (this.#destroyed) return;
            this.log(LogLevel.ERROR, 'Failed to initialize translations', error);
            const defaultTrans = defaultTranslations as Translation;
            this.stateManager.setState((draft) => {
                draft.translations = defaultTrans;
            });
            this.log(LogLevel.WARN, 'Using bundled English translations after load failure.');
        } finally {
            if (this.#destroyed) return;
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
        const expiry = Math.trunc(
            Number(options.cacheExpiry ?? config.constants.defaultCacheExpiry)
        );
        this.cacheExpiry =
            Number.isFinite(expiry) && expiry >= 0 ? expiry : config.constants.defaultCacheExpiry;
        this.selectable = options.selectable ?? false;
        this.lifecycleHooks = options.lifecycleHooks ?? {};
        this.draggableColumns = options.draggableColumns ?? false;
        this.preloadNextPage = options.preloadNextPage ?? false;
        this.lazyLoadMedia = options.lazyLoadMedia ?? false;
        this.persistState = options.persistState ?? false;
        this.destroyOnUnload = options.destroyOnUnload ?? true;
        const retries = Math.trunc(Number(options.retryAttempts ?? 3));
        this.retryAttempts = Number.isFinite(retries) ? Math.min(10, Math.max(0, retries)) : 3;
        const delay = Math.trunc(
            Number(options.debounceDelay ?? config.constants.defaultDebounceDelay)
        );
        this.debounceDelay = Number.isFinite(delay)
            ? Math.min(10000, Math.max(0, delay))
            : config.constants.defaultDebounceDelay;
        const cacheSize = Math.trunc(Number(options.formatCacheSize ?? 500));
        this.formatCacheSize = Number.isFinite(cacheSize)
            ? Math.min(100000, Math.max(1, cacheSize))
            : 500;
        this.prevButtonConfig = {
            ...config.pagination.prevButton,
            ...options.prevButton,
            classNames: { ...config.pagination.prevButton.classNames },
        };
        this.nextButtonConfig = {
            ...config.pagination.nextButton,
            ...options.nextButton,
            classNames: { ...config.pagination.nextButton.classNames },
        };
        this.#boundUnloadHandler = this.destroy.bind(this);
        if (this.destroyOnUnload) window.addEventListener('beforeunload', this.#boundUnloadHandler);
    }
}

/*========================================================================================================
    SNAPRECORDS CLASS ENDS HERE
==========================================================================================================*/
