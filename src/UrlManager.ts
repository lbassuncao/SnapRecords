import { compactFiltering, normalizeSorting } from './utils.js';
import { SnapRecords } from './SnapRecords.js';
import { Identifiable, OrderDirection, SortCondition, ServerRequestParams } from './SnapTypes.js';

interface ParsedUrlState {
    currentPage?: number;
    rowsPerPage?: number;
    filtering?: Record<string, string>;
    sorting?: SortCondition[];
}

/*========================================================================================================

    URL MANAGER CLASS

    Builds API URLs and query strings from SnapRecords state.
    Query keys match state field names: currentPage, rowsPerPage, offset, filtering[key], sorting[column].

==========================================================================================================*/

export class UrlManager<T extends Identifiable & Record<string, unknown>> {
    #parent: SnapRecords<T>;

    constructor(parent: SnapRecords<T>) {
        this.#parent = parent;
    }

    public toSearchParams(params: ServerRequestParams): URLSearchParams {
        const urlParams = new URLSearchParams();
        urlParams.set('currentPage', params.currentPage.toString());
        urlParams.set('rowsPerPage', params.rowsPerPage.toString());
        urlParams.set('offset', params.offset.toString());

        Object.entries(compactFiltering(params.filtering)).forEach(([key, value]) => {
            if (!key) return;
            urlParams.append(`filtering[${key}]`, value);
        });

        normalizeSorting(params.sorting).forEach(([column, direction]) => {
            urlParams.append(`sorting[${column}]`, direction);
        });

        return urlParams;
    }

    public isSnapQueryKey(key: string): boolean {
        return (
            key === 'currentPage' ||
            key === 'rowsPerPage' ||
            key === 'offset' ||
            (key.startsWith('filtering[') && key.endsWith(']')) ||
            (key.startsWith('sorting[') && key.endsWith(']'))
        );
    }

    public hasSnapQuery(search: string): boolean {
        const params = new URLSearchParams(search);
        for (const key of params.keys()) {
            if (key === 'offset') continue;
            if (this.isSnapQueryKey(key)) return true;
        }
        return false;
    }

    public stripSnapParams(params: URLSearchParams): void {
        [...params.keys()].forEach((key) => {
            if (this.isSnapQueryKey(key)) params.delete(key);
        });
    }

    public buildUrl(params: ServerRequestParams): string {
        const query = this.toSearchParams(params);
        try {
            const url = new URL(this.#parent.baseUrl, document.baseURI);
            this.stripSnapParams(url.searchParams);
            query.forEach((value, key) => {
                url.searchParams.append(key, value);
            });
            return url.toString();
        } catch {
            const [path, existingQuery = ''] = this.#parent.baseUrl.split('?');
            const merged = new URLSearchParams(existingQuery);
            this.stripSnapParams(merged);
            query.forEach((value, key) => {
                merged.append(key, value);
            });
            const search = merged.toString();
            return search ? `${path}?${search}` : path;
        }
    }

    public getServerParams(page: number = this.#parent.state.currentPage): ServerRequestParams {
        return {
            currentPage: page,
            rowsPerPage: this.#parent.state.rowsPerPage,
            offset: (page - 1) * this.#parent.state.rowsPerPage,
            filtering: { ...this.#parent.state.filtering },
            sorting: [...this.#parent.state.sorting],
        };
    }

    public parseSearchParams(search: string): ParsedUrlState {
        const params = new URLSearchParams(search);
        const result: ParsedUrlState = {};

        const currentPageParam = params.get('currentPage');
        if (currentPageParam) {
            const currentPage = parseInt(currentPageParam, 10);
            result.currentPage = Number.isNaN(currentPage) ? 1 : Math.max(1, currentPage);
        }

        const rowsPerPageParam = params.get('rowsPerPage');
        if (rowsPerPageParam) {
            const rowsPerPage = parseInt(rowsPerPageParam, 10);
            if (!Number.isNaN(rowsPerPage)) {
                result.rowsPerPage = rowsPerPage;
            }
        }

        const filtering: Record<string, string> = {};
        const sorting: SortCondition[] = [];
        params.forEach((value, key) => {
            if (key.startsWith('filtering[') && key.endsWith(']')) {
                const filterKey = key.slice('filtering['.length, -1);
                if (filterKey) filtering[filterKey] = value;
            }
            if (key.startsWith('sorting[') && key.endsWith(']')) {
                const column = key.slice('sorting['.length, -1);
                if (!column) return;
                const direction = value.toUpperCase() as OrderDirection;
                if (Object.values(OrderDirection).includes(direction)) {
                    sorting.push([column, direction]);
                }
            }
        });
        if (Object.keys(filtering).length > 0) {
            result.filtering = compactFiltering(filtering);
        }
        if (sorting.length > 0) {
            result.sorting = normalizeSorting(sorting);
        }

        return result;
    }
}
