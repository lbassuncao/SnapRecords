import type { SnapRecords } from './SnapRecords.js';
import { ISnapApi, RenderType, RowsPerPage, Identifiable, SnapRecordsState } from './SnapTypes.js';

/*========================================================================================================

    SNAPAPI CLASS

    Class providing a public API for interacting with a SnapRecords instance

    Provides a public API for interacting with a {@link SnapRecords} instance.
    The `SnapApi` class exposes methods for controlling and querying a SnapRecords data table,
    including operations such as resetting, refreshing, navigation, selection management,
    theme and render mode configuration, language switching, searching, and updating state parameters.
    This class is intended to be used as the main interface for consumers who need to manipulate
    or retrieve information from a SnapRecords instance in a type-safe and encapsulated manner.

    @typeParam T - The type of records managed by the SnapRecords instance, which must extend
    {@link Identifiable} and be a record of string keys to unknown values.

==========================================================================================================*/

export class SnapApi<T extends Identifiable & Record<string, unknown>> implements ISnapApi<T> {
    // Reference to the SnapRecords instance
    readonly #instance: SnapRecords<T>;

    // Constructor initializes the API with the parent instance
    constructor(instance: SnapRecords<T>) {
        this.#instance = instance;
    }

    // Resets the SnapRecords instance to its initial state
    public reset(): void {
        this.#instance.reset();
    }

    // Refreshes the data by triggering a reload
    public refresh(): void {
        this.#instance.refresh();
    }

    // Destroys the SnapRecords instance, cleaning up resources
    public destroy(): void {
        this.#instance.destroy();
    }

    // Clears all row selections
    public clearSelection(): void {
        this.#instance.clearSelection();
    }

    // Navigates to the specified page
    public gotoPage(page: number): void {
        this.#instance.gotoPage(page);
    }

    // Returns the current data array
    public getData(): ReadonlyArray<T> {
        return this.#instance.getData();
    }

    // Returns the currently selected rows
    public getSelectedRows(): T[] {
        return this.#instance.getSelectedRows();
    }

    // Returns the total number of records
    public getTotals(): { totalRecords: number } {
        return this.#instance.getTotals();
    }

    // Sets the theme (light or dark)
    public setTheme(theme: 'light' | 'dark'): void {
        this.#instance.setTheme(theme);
    }

    // Sets the rendering mode (table, list, or mobile cards)
    public setRenderMode(mode: RenderType): void {
        this.#instance.setRenderMode(mode);
    }

    // Sets the number of rows per page
    public setRowsPerPage(newRowsPerPage: RowsPerPage): void {
        this.#instance.setRowsPerPage(newRowsPerPage);
    }

    // Sets the language and reloads translations
    public async setLanguage(newLanguage: string): Promise<void> {
        await this.#instance.setLanguage(newLanguage);
    }

    // Performs a search with the provided filters
    public search(filters: Record<string, string>, merge = false): void {
        this.#instance.search(filters, merge);
    }

    // Updates state parameters (page, rows per page, filters, sort conditions)
    public updateParams(
        params: Partial<
            Pick<SnapRecordsState<T>, 'currentPage' | 'rowsPerPage' | 'filters' | 'sortConditions'>
        >
    ): void {
        this.#instance.updateParams(params);
    }
}

/*========================================================================================================
    SNAPAPI OBJECT ENDS HERE
==========================================================================================================*/
