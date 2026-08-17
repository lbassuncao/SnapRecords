import { UrlManager } from './UrlManager.js';
import { SnapRecords } from './SnapRecords.js';
import { compactFiltering, resolveTotalRecords } from './utils.js';
import { CacheData, Identifiable, LogLevel } from './SnapTypes.js';

/*========================================================================================================

    CACHE MANAGER

    Class responsible for managing data caching using IndexedDB

    Manages client-side data caching for SnapRecords using IndexedDB.
    Handles cache invalidation, retrieval, storage, and preloading of paginated data,
    optimizing network usage and improving performance by reducing redundant API requests.

    @typeParam T - The data type managed by the cache, extending Identifiable and a generic record.

==========================================================================================================*/

export class CacheManager<T extends Identifiable & Record<string, unknown>> {
    // Reference to the parent SnapRecords instance
    #parent: SnapRecords<T>;
    // URL manager for constructing API request URLs
    #urlManager: UrlManager<T>;
    // Add timeout for cache operations
    readonly #CACHE_TIMEOUT_MS = 5000;
    #preloadController: AbortController | null = null;

    // Constructor initializes the cache manager with parent and URL manager
    constructor(parent: SnapRecords<T>, urlManager: UrlManager<T>) {
        this.#parent = parent;
        this.#urlManager = urlManager;
    }

    #isValidCache(data: CacheData<T>): boolean {
        return (
            typeof data.timestamp === 'number' &&
            Array.isArray(data.data) &&
            typeof data.totalRecords === 'number' &&
            data.timestamp > Date.now() - this.#parent.cacheExpiry
        );
    }

    public abortPreload(): void {
        this.#preloadController?.abort();
        this.#preloadController = null;
    }

    async #ensureDbOpen(): Promise<void> {
        if (!this.#parent.db.isOpen()) {
            await this.#parent.db.open();
        }
    }

    public async invalidateCache(): Promise<void> {
        if (!this.#parent.useCache) return;
        const filterHash = JSON.stringify(compactFiltering(this.#parent.state.filtering));
        if (filterHash === this.#parent.lastFilterHash) return;
        this.#parent.lastFilterHash = filterHash;
        try {
            await this.#ensureDbOpen();
            await this.#parent.db.cache.clear();
            this.#parent.log(LogLevel.LOG, 'Cache invalidated due to filter change');
        } catch (error) {
            this.#parent.log(LogLevel.ERROR, 'Could not invalidate cache.', error);
        }
    }

    // Preloads data for the next page if enabled
    public async preloadNextPage(): Promise<void> {
        if (!this.#parent.preloadNextPage || !this.#parent.useCache || this.#parent.isDestroyed) {
            return;
        }

        // Check network conditions to avoid preloading on slow connections
        const conn = (
            navigator as {
                connection?: { saveData?: boolean; effectiveType?: string };
            }
        ).connection;
        if (
            conn &&
            (conn.saveData || conn.effectiveType === 'slow-2g' || conn.effectiveType === '2g')
        ) {
            this.#parent.log(
                LogLevel.INFO,
                'Preloading skipped due to slow connection or data saver mode.'
            );
            return;
        }

        // Calculate next page number
        const nextPage = this.#parent.state.currentPage + 1;
        const totalPages = Math.max(
            1,
            Math.ceil(this.#parent.state.totalRecords / this.#parent.state.rowsPerPage)
        );
        // Skip if next page exceeds total pages
        if (nextPage > totalPages) return;

        // Build URL for next page
        const params = this.#urlManager.getServerParams(nextPage);
        const url = this.#urlManager.buildUrl(params);

        // Check cache if enabled
        if (this.#parent.useCache) {
            const cached = await this.getCachedData(url);
            if (this.#parent.isDestroyed) return;
            if (cached && Date.now() - cached.timestamp < this.#parent.cacheExpiry) {
                this.#parent.log(
                    LogLevel.INFO,
                    'Preload not needed, next page is already cached and valid.'
                );
                return;
            }
        }

        if (this.#parent.isDestroyed) return;
        const currentNextUrl = this.#urlManager.buildUrl(
            this.#urlManager.getServerParams(this.#parent.state.currentPage + 1)
        );
        if (currentNextUrl !== url) return;

        this.abortPreload();
        this.#preloadController = new AbortController();
        const signal = this.#preloadController.signal;

        try {
            this.#parent.log(LogLevel.INFO, 'Preloading data for next page:', url);
            const response = await fetch(url, { signal });
            if (this.#parent.isDestroyed || !response.ok) return;
            const data: { data?: unknown; totalRecords?: unknown } = await response.json();
            if (this.#parent.isDestroyed || !this.#parent.useCache) return;
            if (!data || !Array.isArray(data.data)) return;
            await this.cacheData(url, {
                url,
                data: data.data as T[],
                totalRecords: resolveTotalRecords(
                    data.totalRecords,
                    (data.data as unknown[]).length
                ),
                timestamp: Date.now(),
            });
        } catch (error: unknown) {
            if (error instanceof Error && error.name === 'AbortError') return;
            this.#parent.log(LogLevel.LOG, 'Preload failed:', { error, url });
        }
    }

    // Caches data for a given URL
    public async cacheData(url: string, data: CacheData<T>): Promise<void> {
        if (!this.#parent.useCache || this.#parent.isDestroyed) return;
        try {
            await this.#ensureDbOpen();
            // Store data in IndexedDB
            await this.#parent.db.cache.put(data);
            this.#parent.log(LogLevel.INFO, 'Data cached successfully for URL:', url);
        } catch (error: unknown) {
            // Log error if caching fails
            this.#parent.log(LogLevel.ERROR, 'Error caching data:', { error, url });
        }
    }

    // Retrieves cached data for a given URL
    public async getCachedData(url: string): Promise<CacheData<T> | undefined> {
        if (!this.#parent.useCache || this.#parent.isDestroyed) return undefined;
        let timeoutId: ReturnType<typeof setTimeout> | undefined;
        try {
            await this.#ensureDbOpen();
            const cached = (await Promise.race([
                this.#parent.db.cache.get(url),
                new Promise<never>((_, reject) => {
                    timeoutId = setTimeout(
                        () => reject(new Error('Cache timeout')),
                        this.#CACHE_TIMEOUT_MS
                    );
                }),
            ])) as CacheData<T> | undefined;

            if (cached && this.#isValidCache(cached)) {
                return cached;
            }
            return undefined;
        } catch (error: unknown) {
            this.#parent.log(LogLevel.ERROR, 'Error retrieving cache:', { error, url });
            return undefined;
        } finally {
            if (timeoutId) clearTimeout(timeoutId);
        }
    }
}

/*========================================================================================================
    CACHE MANAGER OBJECT ENDS HERE
==========================================================================================================*/
