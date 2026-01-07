import { log } from './utils.js';
import { UrlManager } from './UrlManager.js';
import { SnapRecords } from './SnapRecords.js';
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

    // Invalidates the cache if filters have changed
    public invalidateCache(): void {
        // Skip if caching is disabled
        if (!this.#parent.useCache) return;
        // Hash current filters for comparison
        const filterHash = JSON.stringify(this.#parent.state.filters);
        if (filterHash !== this.#parent.lastFilterHash) {
            // Clear cache if filters have changed
            this.#parent.db.cache.clear();
            this.#parent.lastFilterHash = filterHash;
            log(this.#parent.debug, LogLevel.LOG, 'Cache invalidated due to filter change');
        }
    }

    // Preloads data for the next page if enabled
    public async preloadNextPage(): Promise<void> {
        // Skip if preloading is disabled
        if (!this.#parent.preloadNextPageEnabled) return;

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
            log(
                this.#parent.debug,
                LogLevel.INFO,
                'Preloading skipped due to slow connection or data saver mode.'
            );
            return;
        }

        // Calculate next page number
        const nextPage = this.#parent.state.currentPage + 1;
        const totalPages = Math.ceil(
            this.#parent.state.totalRecords / this.#parent.state.rowsPerPage
        );
        // Skip if next page exceeds total pages
        if (nextPage > totalPages) return;

        // Build URL for next page
        const params = this.#urlManager.getServerParams(nextPage);
        const url = this.#urlManager.buildUrl(params);

        // Check cache if enabled
        if (this.#parent.useCache) {
            const cached = await this.getCachedData(url);
            if (cached && Date.now() - cached.timestamp < this.#parent.cacheExpiry) {
                log(
                    this.#parent.debug,
                    LogLevel.INFO,
                    'Preload not needed, next page is already cached and valid.'
                );
                return;
            }
        }

        try {
            // Fetch data for the next page
            log(this.#parent.debug, LogLevel.INFO, 'Preloading data for next page:', url);
            const response = await fetch(url);
            if (response.ok) {
                const data: { data: T[]; totalRecords: number } = await response.json();
                if (this.#parent.useCache) {
                    // Cache the fetched data
                    await this.cacheData(url, {
                        url,
                        data: data.data || [],
                        totalRecords: data.totalRecords || 0,
                        timestamp: Date.now(),
                    });
                }
            }
        } catch (error: unknown) {
            // Log preload failure
            log(this.#parent.debug, LogLevel.LOG, 'Preload failed:', { error, url });
        }
    }

    // Caches data for a given URL
    public async cacheData(url: string, data: CacheData<T>): Promise<void> {
        // Skip if caching is disabled
        if (!this.#parent.useCache) return;
        try {
            // Store data in IndexedDB
            await this.#parent.db.cache.put(data);
            log(this.#parent.debug, LogLevel.INFO, 'Data cached successfully for URL:', url);
        } catch (error: unknown) {
            // Log error if caching fails
            log(this.#parent.debug, LogLevel.ERROR, 'Error caching data:', { error, url });
        }
    }

    // Retrieves cached data for a given URL
    public async getCachedData(url: string): Promise<CacheData<T> | undefined> {
        // Skip if caching is disabled
        if (!this.#parent.useCache) return undefined;
        try {
            // Attempt to retrieve cached data from IndexedDB
            const cached = (await Promise.race([
                this.#parent.db.cache.get(url),
                new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('Cache timeout')), this.#CACHE_TIMEOUT_MS)
                ),
            ])) as CacheData<T> | undefined;

            if (cached && this.#isValidCache(cached)) {
                return cached;
            }
            return undefined;
        } catch (error: unknown) {
            // Log error and return undefined
            log(this.#parent.debug, LogLevel.ERROR, 'Error retrieving cache:', { error, url });
            return undefined;
        }
    }
}

/*========================================================================================================
    CACHE MANAGER OBJECT ENDS HERE
==========================================================================================================*/
