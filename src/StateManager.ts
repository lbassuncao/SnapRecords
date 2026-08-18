import {
    LogLevel,
    RowsPerPage,
    StateUpdater,
    Identifiable,
    PersistedState,
    SnapRecordsState,
} from './SnapTypes.js';
import { produce, Draft, enableMapSet } from 'immer';
import { compactFiltering, sanitizeRowsPerPage, normalizeSorting } from './utils.js';
import { SnapRecords } from './SnapRecords.js';

// Required: state.columnWidths is a Map. Without this, produce() throws in production
// (tests used to hide the bug by calling enableMapSet only in setupTests).
enableMapSet();

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
    #saveDebounceTimer: ReturnType<typeof setTimeout> | null = null;
    #suppressUrlUpdate = false;

    // Constructor initializes the state manager with the parent instance
    constructor(parent: SnapRecords<T>) {
        this.#parent = parent;
    }

    // Updates the state using an Immer draft
    public setState(updater: StateUpdater<T>): void {
        if (this.#parent.isDestroyed) return;
        const previousState = this.#parent.state;
        const nextState = produce(previousState, updater);
        if (nextState !== previousState) {
            this.#parent.state = nextState as SnapRecordsState<T>;
            this.#parent.log(LogLevel.INFO, 'State updated.', this.#parent.state);
            this.saveStateToStorage();
            if (!this.#suppressUrlUpdate && this.#queryStateChanged(previousState, nextState)) {
                this.updateURLState('push');
            }
        }
    }

    public suppressUrlUpdates(fn: () => void): void {
        this.#suppressUrlUpdate = true;
        try {
            fn();
        } finally {
            this.#suppressUrlUpdate = false;
        }
    }

    public updateURLState(mode: 'push' | 'replace' = 'push'): void {
        if (!this.#parent.usePushState || this.#parent.isDestroyed) return;
        this.#parent.log(LogLevel.INFO, 'Updating URL with current state.');
        const snapQuery = this.#parent.urlManager.toSearchParams(
            this.#parent.urlManager.getServerParams()
        );
        const merged = new URLSearchParams(window.location.search);
        this.#parent.urlManager.stripSnapParams(merged);
        snapQuery.forEach((value, key) => {
            merged.append(key, value);
        });
        const search = merged.toString();
        const newUrl = `${window.location.pathname}${search ? `?${search}` : ''}${window.location.hash}`;
        const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
        if (newUrl === current) return;
        if (mode === 'replace') {
            window.history.replaceState({ snapRecords: true }, '', newUrl);
        } else {
            window.history.pushState({ snapRecords: true }, '', newUrl);
        }
    }

    public loadFromURL(
        options: { emptyMeansDefaults?: boolean; absentSnapFieldsReset?: boolean } = {}
    ): void {
        if (!this.#parent.usePushState || this.#parent.isDestroyed) return;
        this.#parent.log(LogLevel.INFO, 'Loading state from URL parameters...');
        const hasSnapQuery = this.#parent.urlManager.hasSnapQuery(window.location.search);
        const configOptions = this.#parent.getConfigOptions();

        if (!hasSnapQuery) {
            if (!options.emptyMeansDefaults) {
                this.#parent.log(LogLevel.INFO, 'No URL parameters to load.');
                return;
            }
            if (this.#parent.persistState) {
                this.loadStateFromStorage();
                return;
            }
            this.#suppressUrlUpdate = true;
            try {
                this.setState((draft) => {
                    draft.currentPage = 1;
                    draft.rowsPerPage = configOptions.rowsPerPage ?? RowsPerPage.DEFAULT;
                    (draft.filtering as Record<string, string>) = compactFiltering(
                        configOptions.filtering ?? {}
                    );
                    draft.sorting = normalizeSorting(configOptions.sorting ?? []);
                });
            } finally {
                this.#suppressUrlUpdate = false;
            }
            return;
        }

        const parsed = this.#parent.urlManager.parseSearchParams(window.location.search);
        this.#suppressUrlUpdate = true;
        try {
            this.setState((draft) => {
                if (parsed.currentPage !== undefined) {
                    draft.currentPage = parsed.currentPage;
                }
                if (parsed.rowsPerPage !== undefined) {
                    draft.rowsPerPage = this.#normalizeRowsPerPage(parsed.rowsPerPage);
                }
                if (parsed.filtering !== undefined) {
                    (draft.filtering as Record<string, string>) = compactFiltering(
                        parsed.filtering
                    );
                } else if (options.absentSnapFieldsReset) {
                    (draft.filtering as Record<string, string>) = {};
                }
                if (parsed.sorting !== undefined) {
                    draft.sorting = normalizeSorting(parsed.sorting);
                } else if (options.absentSnapFieldsReset) {
                    draft.sorting = [];
                }
            });
        } finally {
            this.#suppressUrlUpdate = false;
        }
    }

    public destroy(): void {
        if (this.#saveDebounceTimer) {
            clearTimeout(this.#saveDebounceTimer);
            this.#saveDebounceTimer = null;
            this.#persistStateNow();
        }
    }

    #queryStateChanged(previous: SnapRecordsState<T>, next: SnapRecordsState<T>): boolean {
        return (
            previous.currentPage !== next.currentPage ||
            previous.rowsPerPage !== next.rowsPerPage ||
            JSON.stringify(previous.filtering) !== JSON.stringify(next.filtering) ||
            JSON.stringify(previous.sorting) !== JSON.stringify(next.sorting)
        );
    }

    #normalizeRowsPerPage(value: number): RowsPerPage {
        return sanitizeRowsPerPage(value, RowsPerPage.DEFAULT) as RowsPerPage;
    }

    // Saves the current state to localStorage if persistState is enabled
    public saveStateToStorage(): void {
        if (!this.#parent.persistState || this.#parent.isDestroyed) return;

        // Debounce to prevent excessive writings
        if (this.#saveDebounceTimer) {
            clearTimeout(this.#saveDebounceTimer);
        }

        this.#parent.log(LogLevel.INFO, 'Saving state to localStorage...');

        this.#saveDebounceTimer = setTimeout(() => {
            this.#saveDebounceTimer = null;
            this.#persistStateNow();
        }, this.#DEBOUNCE_TIMEOUT_MS);
    }

    #persistStateNow(): void {
        if (!this.#parent.persistState) return;
        const {
            columns,
            columnWidths,
            sorting,
            filtering,
            currentPage,
            rowsPerPage,
            headerCellClasses,
        } = this.#parent.state;
        const stateToSave: PersistedState = {
            columns: [...columns],
            columnWidths: Array.from(columnWidths.entries()),
            sorting: [...sorting],
            filtering: { ...filtering },
            currentPage,
            rowsPerPage,
            headerCellClasses: [...headerCellClasses],
        };
        try {
            localStorage.setItem(this.#parent.storageKey, JSON.stringify(stateToSave));
            this.#parent.log(LogLevel.INFO, 'State saved successfully.');
        } catch (error) {
            this.#parent.log(LogLevel.ERROR, 'Could not save state to localStorage.', error);
        }
    }

    // Loads state from localStorage if persistState is enabled
    public loadStateFromStorage(): void {
        if (!this.#parent.persistState || this.#parent.isDestroyed) return;
        this.#parent.log(LogLevel.INFO, 'Attempting to load state from localStorage...');
        try {
            // Retrieve saved state
            const savedStateJSON = localStorage.getItem(this.#parent.storageKey);
            if (!savedStateJSON) {
                this.#parent.log(LogLevel.INFO, 'No saved state found in localStorage.');
                return;
            }
            // Parse saved state
            const savedState = JSON.parse(savedStateJSON) as Partial<PersistedState>;
            this.#parent.log(LogLevel.INFO, 'Saved state found, applying...', savedState);

            // Apply saved state with type validation
            this.setState((draft) => {
                if (savedState.columns && Array.isArray(savedState.columns)) {
                    // Apply saved column order
                    this.#applyStoredColumnOrder(draft, savedState.columns);
                }

                // Validate and apply column widths
                if (savedState.columnWidths && Array.isArray(savedState.columnWidths)) {
                    const validWidths = savedState.columnWidths.filter(
                        (entry): entry is [string, number] =>
                            Array.isArray(entry) &&
                            entry.length === 2 &&
                            typeof entry[0] === 'string' &&
                            Number.isFinite(entry[1]) &&
                            entry[1] > 0
                    );
                    (draft.columnWidths as Map<string, number>) = new Map(validWidths);
                }

                // Validate and apply sort conditions
                if (savedState.sorting) {
                    draft.sorting = normalizeSorting(savedState.sorting);
                }

                if (
                    savedState.filtering &&
                    typeof savedState.filtering === 'object' &&
                    !Array.isArray(savedState.filtering)
                ) {
                    const validFiltering: Record<string, string> = {};
                    for (const [key, value] of Object.entries(savedState.filtering)) {
                        if (typeof value === 'string') {
                            validFiltering[key] = value;
                        }
                    }
                    draft.filtering = compactFiltering(validFiltering);
                }

                if (
                    savedState.headerCellClasses &&
                    Array.isArray(savedState.headerCellClasses) &&
                    savedState.headerCellClasses.length === draft.columns.length &&
                    savedState.headerCellClasses.every((entry) => typeof entry === 'string')
                ) {
                    draft.headerCellClasses = [...savedState.headerCellClasses];
                }

                // Validate and apply current page
                if (typeof savedState.currentPage === 'number') {
                    draft.currentPage = Math.max(1, Math.trunc(savedState.currentPage) || 1);
                }

                // Validate and apply rows per page
                if (typeof savedState.rowsPerPage === 'number') {
                    draft.rowsPerPage = this.#normalizeRowsPerPage(savedState.rowsPerPage);
                }
            });
        } catch (error) {
            // Log error and clear invalid state
            this.#parent.log(LogLevel.ERROR, 'Could not load state from localStorage.', error);
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

        this.#parent.log(LogLevel.LOG, 'Applying stored column order:', newColumnsOrder);
        state.columns = newColumnsOrder;
        state.columnTitles = newTitles;
        state.headerCellClasses = newClasses;
    }
}

/*========================================================================================================
    STATE MANAGER CLASS ENDS HERE
==========================================================================================================*/
