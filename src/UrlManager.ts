import { sanitizeHTML } from './utils.js';
import { SnapRecords } from './SnapRecords.js';
import { Identifiable, ServerRequestParams } from './SnapTypes.js';

/*========================================================================================================

    URL MANAGER CLASS

    Class responsible for constructing URLs and server request parameters for data fetching

    Manages the construction of API URLs and server request parameters for data fetching
    in the context of a SnapRecords instance. This class centralizes logic for building
    query strings with pagination, filtering, and sorting, ensuring consistent and correct
    API requests based on the current state of the parent SnapRecords.

    @typeParam T - The type of records managed, extending Identifiable and a generic object.

==========================================================================================================*/

export class UrlManager<T extends Identifiable & Record<string, unknown>> {
    // Reference to the parent SnapRecords instance
    #parent: SnapRecords<T>;

    // Constructor initializes the URL manager with the parent instance
    constructor(parent: SnapRecords<T>) {
        this.#parent = parent;
    }

    // Builds a URL with query parameters for an API request
    public buildUrl(params: ServerRequestParams): string {
        // Create URLSearchParams to hold query parameters
        const urlParams = new URLSearchParams();
        // Add pagination parameters
        urlParams.append('page', params.page.toString());
        urlParams.append('perPage', params.perPage.toString());
        urlParams.append('offset', params.offset.toString());

        // Add filtering parameters if present (sanitize values)
        if (params.filtering) {
            Object.entries(params.filtering).forEach(([key, value]) => {
                // Sanitize the value to prevent XSS
                const sanitizedValue = sanitizeHTML(String(value));
                urlParams.append(`filtering[${key}]`, sanitizedValue);
            });
        }
        // Add sorting parameters if present
        if (params.sorting) {
            Object.entries(params.sorting).forEach(([key, value]) => {
                // Sorting values are controlled (ASC/DESC) so no need to sanitize
                urlParams.append(`sorting[${key}]`, value);
            });
        }
        // Construct and return the full URL
        return `${this.#parent.baseUrl}?${urlParams.toString()}`;
    }

    // Generates server request parameters based on the current state
    public getServerParams(page: number = this.#parent.state.currentPage): ServerRequestParams {
        // Initialize parameters with pagination details
        const params: ServerRequestParams = {
            page,
            perPage: this.#parent.state.rowsPerPage,
            offset: (page - 1) * this.#parent.state.rowsPerPage,
        };
        // Include filters if any exist
        if (Object.keys(this.#parent.state.filters).length > 0) {
            // Sanitize filter values
            const sanitizedFilters: Record<string, string> = {};
            Object.entries(this.#parent.state.filters).forEach(([key, value]) => {
                sanitizedFilters[key] = sanitizeHTML(String(value));
            });
            params.filtering = sanitizedFilters;
        }
        // Include sorting conditions if any exist
        if (this.#parent.state.sortConditions.length > 0) {
            params.sorting = Object.fromEntries(this.#parent.state.sortConditions) as Record<
                string,
                'ASC' | 'DESC'
            >;
        }
        return params;
    }
}

/*========================================================================================================
    URL MANAGER OBJECT ENDS HERE
==========================================================================================================*/
