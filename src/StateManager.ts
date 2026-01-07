import {
    LogLevel,
    RowsPerPage,
    StateUpdater,
    Identifiable,
    SortCondition,
    OrderDirection,
    PersistedState,
    SnapRecordsState,
} from './SnapTypes.js';
import { log } from './utils.js';
import { produce, Draft } from 'immer';
import { SnapRecords } from './SnapRecords.js';

/*========================================================================================================

    STATE MANAGER CLASS

    Class responsible for managing and persisting the state of a SnapRecords instance

    The StateManager class is responsible for managing, updating, and persisting the state of a
    SnapRecords instance.
    It provides methods to update the state immutably, save and load state from localStorage,
    and synchronize state with the browser URL.
    This ensures that user preferences such as column order, filters, sorting, and pagination
    are preserved across sessions and can be shared via URLs.

==========================================================================================================*/

export class StateManager<T extends Identifiable & Record<string, unknown>> {
    // Reference to the parent SnapRecords instance
    #parent: SnapRecords<T>;
    // Add timeout for debounce operations
    readonly #DEBOUNCE_TIMEOUT_MS = 500;
    // Add debounce for save operations
    #saveDebounceTimer: NodeJS.Timeout | null = null;

    // Constructor initializes the state manager with the parent instance
    constructor(parent: SnapRecords<T>) {
        this.#parent = parent;
    }

    // Updates the state using an Immer draft
    public setState(updater: StateUpdater<T>): void {
        // Create a new state using Immer's produce for immutability
        const nextState = produce(this.#parent.state, updater);
        // Only update if the state has changed
        if (nextState !== this.#parent.state) {
            this.#parent.state = nextState as SnapRecordsState<T>;
            log(this.#parent.debug, LogLevel.INFO, 'State updated.', this.#parent.state);
            // Persist state to storage and update URL
            this.saveStateToStorage();
            this.updateURLState();
        }
    }

    // Updates the URL with current state parameters if usePushState is enabled
    public updateURLState(): void {
        // Skip if URL state persistence is disabled
        if (!this.#parent.usePushState) return;
        log(this.#parent.debug, LogLevel.INFO, 'Updating URL with current state.');
        // Create URLSearchParams to hold query parameters
        const params = new URLSearchParams();
        params.set('page', this.#parent.state.currentPage.toString());
        params.set('perPage', this.#parent.state.rowsPerPage.toString());
        // Add filter parameters
        Object.entries(this.#parent.state.filters).forEach(([key, value]) => {
            if (value) params.set(`filtering[${key}]`, String(value));
        });
        // Add sort conditions
        this.#parent.state.sortConditions.forEach(([column, direction]) => {
            params.append(`sorting[${column}]`, direction);
        });
        // Update the URL without reloading
        const newUrl = `${window.location.pathname}?${params.toString()}`;
        window.history.pushState({ path: newUrl }, '', newUrl);
    }

    // Loads state from URL parameters if usePushState is enabled
    public loadFromURL(): void {
        // Skip if URL state persistence is disabled
        if (!this.#parent.usePushState) return;
        log(this.#parent.debug, LogLevel.INFO, 'Loading state from URL parameters...');
        // Parse URL query parameters
        const params = new URLSearchParams(window.location.search);
        if (params.toString() === '') {
            log(this.#parent.debug, LogLevel.INFO, 'No URL parameters to load.');
            return;
        }

        // Update state with URL parameters
        this.setState((draft) => {
            // Load page number with validation
            const pageParam = params.get('page');
            if (pageParam) {
                const page = parseInt(pageParam, 10);
                draft.currentPage = isNaN(page) ? 1 : Math.max(1, page);
            }

            // Load rows per page with validation
            const perPageParam = params.get('perPage');
            if (perPageParam) {
                const perPage = parseInt(perPageParam, 10);
                // Validate against allowed values
                const allowedValues = [
                    RowsPerPage.DEFAULT,
                    RowsPerPage.TWENTY,
                    RowsPerPage.FIFTY,
                    RowsPerPage.HUNDRED,
                    RowsPerPage.TWO_HUNDRED_FIFTY,
                    RowsPerPage.FIVE_HUNDRED,
                    RowsPerPage.THOUSAND,
                ];
                draft.rowsPerPage =
                    isNaN(perPage) || !allowedValues.includes(perPage)
                        ? RowsPerPage.DEFAULT
                        : (perPage as RowsPerPage);
            }

            // Load filters
            const newFilters: Record<string, string> = {};
            params.forEach((value, key) => {
                if (key.startsWith('filtering[')) {
                    const filterKey = key.substring(10, key.length - 1);
                    newFilters[filterKey] = value;
                }
            });
            (draft.filters as Record<string, string>) = newFilters;

            // Load sort conditions
            const newSorts: Array<SortCondition> = [];
            params.forEach((value, key) => {
                if (key.startsWith('sorting[')) {
                    const column = key.substring(key.indexOf('[') + 1, key.indexOf(']'));
                    if (
                        Object.values(OrderDirection).includes(
                            value.toUpperCase() as OrderDirection
                        )
                    ) {
                        newSorts.push([column, value.toUpperCase() as OrderDirection]);
                    }
                }
            });
            draft.sortConditions = newSorts;
        });
    }

    // Saves the current state to localStorage if persistState is enabled
    public saveStateToStorage(): void {
        // Skip if state persistence is disabled
        if (!this.#parent.persistState) return;

        // Debounce to prevent excessive writings
        if (this.#saveDebounceTimer) {
            clearTimeout(this.#saveDebounceTimer);
        }

        log(this.#parent.debug, LogLevel.INFO, 'Saving state to localStorage...');

        // Extract relevant state properties
        const {
            columns,
            columnWidths,
            sortConditions,
            filters,
            currentPage,
            rowsPerPage,
            headerCellClasses,
        } = this.#parent.state;
        // Create state object for storage
        const stateToSave: PersistedState = {
            columns: [...columns],
            columnWidths: Array.from(columnWidths.entries()),
            sortConditions: [...sortConditions],
            filters: { ...filters },
            currentPage,
            rowsPerPage,
            headerCellClasses: [...headerCellClasses],
        };

        this.#saveDebounceTimer = setTimeout(() => {
            try {
                // Save state to localStorage
                localStorage.setItem(this.#parent.storageKey, JSON.stringify(stateToSave));
                log(this.#parent.debug, LogLevel.INFO, 'State saved successfully.');
            } catch (error) {
                // Log error and continue
                log(
                    this.#parent.debug,
                    LogLevel.ERROR,
                    'Could not save state to localStorage.',
                    error
                );
            }
        }, this.#DEBOUNCE_TIMEOUT_MS);
    }

    // Loads state from localStorage if persistState is enabled
    public loadStateFromStorage(): void {
        // Skip if state persistence is disabled
        if (!this.#parent.persistState) return;
        log(this.#parent.debug, LogLevel.INFO, 'Attempting to load state from localStorage...');
        try {
            // Retrieve saved state
            const savedStateJSON = localStorage.getItem(this.#parent.storageKey);
            if (!savedStateJSON) {
                log(this.#parent.debug, LogLevel.INFO, 'No saved state found in localStorage.');
                return;
            }
            // Parse saved state
            const savedState = JSON.parse(savedStateJSON) as Partial<PersistedState>;
            log(this.#parent.debug, LogLevel.INFO, 'Saved state found, applying...', savedState);

            // Apply saved state with type validation
            this.setState((draft) => {
                if (savedState.columns && Array.isArray(savedState.columns)) {
                    // Apply saved column order
                    this.#applyStoredColumnOrder(draft, savedState.columns);
                }

                // Validate and apply column widths
                if (savedState.columnWidths && Array.isArray(savedState.columnWidths)) {
                    const validWidths = savedState.columnWidths.filter(
                        (entry) =>
                            Array.isArray(entry) &&
                            entry.length === 2 &&
                            typeof entry[0] === 'string' &&
                            typeof entry[1] === 'number'
                    );
                    (draft.columnWidths as Map<string, number>) = new Map(validWidths);
                }

                // Validate and apply sort conditions
                if (savedState.sortConditions) {
                    const validSorts = savedState.sortConditions.filter(
                        (condition) =>
                            Array.isArray(condition) &&
                            condition.length === 2 &&
                            typeof condition[0] === 'string' &&
                            Object.values(OrderDirection).includes(condition[1])
                    );
                    draft.sortConditions = validSorts;
                }

                // Validate and apply filters
                if (savedState.filters && typeof savedState.filters === 'object') {
                    const validFilters: Record<string, string> = {};
                    for (const [key, value] of Object.entries(savedState.filters)) {
                        if (typeof value === 'string') {
                            validFilters[key] = value;
                        }
                    }
                    draft.filters = validFilters;
                }

                // Validate and apply current page
                if (typeof savedState.currentPage === 'number') {
                    draft.currentPage = Math.max(1, savedState.currentPage);
                }

                // Validate and apply rows per page
                if (typeof savedState.rowsPerPage === 'number') {
                    const allowedValues = [
                        RowsPerPage.DEFAULT,
                        RowsPerPage.TWENTY,
                        RowsPerPage.FIFTY,
                        RowsPerPage.HUNDRED,
                        RowsPerPage.TWO_HUNDRED_FIFTY,
                        RowsPerPage.FIVE_HUNDRED,
                        RowsPerPage.THOUSAND,
                    ];
                    if (allowedValues.includes(savedState.rowsPerPage)) {
                        draft.rowsPerPage = savedState.rowsPerPage;
                    }
                }
            });
        } catch (error) {
            // Log error and clear invalid state
            log(
                this.#parent.debug,
                LogLevel.ERROR,
                'Could not load state from localStorage.',
                error
            );
            localStorage.removeItem(this.#parent.storageKey);
        }
    }

    // Applies stored column order to maintain consistency
    #applyStoredColumnOrder(state: Draft<SnapRecordsState<T>>, savedColumns: string[]): void {
        const originalColumnsConfig = [...state.columns];
        const originalTitlesConfig = [...state.columnTitles];
        const originalClassesConfig = [...state.headerCellClasses];

        // Filter valid saved columns
        const validSavedColumns = savedColumns.filter((col) => originalColumnsConfig.includes(col));
        // Include any new columns not in saved state
        const newConfiguredColumns = originalColumnsConfig.filter(
            (col) => !validSavedColumns.includes(col)
        );

        // Combine saved and new columns
        const newColumnsOrder = [...validSavedColumns, ...newConfiguredColumns];
        const newTitles: string[] = [];
        const newClasses: string[] = [];

        // Reorder titles and classes to match column order
        newColumnsOrder.forEach((colName: string) => {
            const originalIndex = originalColumnsConfig.indexOf(colName);
            if (originalIndex !== -1) {
                newTitles.push(originalTitlesConfig[originalIndex]);
                if (originalClassesConfig.length > originalIndex) {
                    newClasses.push(originalClassesConfig[originalIndex]);
                }
            }
        });

        log(this.#parent.debug, LogLevel.LOG, 'Applying stored column order:', newColumnsOrder);
        state.columns = newColumnsOrder;
        state.columnTitles = newTitles;
        state.headerCellClasses = newClasses;
    }
}

/*========================================================================================================
    STATE MANAGER CLASS ENDS HERE
==========================================================================================================*/
