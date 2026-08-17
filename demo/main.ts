import { ISnapApi, RenderType, RowsPerPage, SnapRecords, SnapTheme } from '../src';
import '../src/scss/SnapRecords.scss';

interface Book extends Record<string, unknown> {
    id: number;
    title: string;
    name: string;
    published: string;
    status: 'published' | 'draft' | 'archived';
}

const dataUrl = '/api/books';
const byId = <T extends HTMLElement>(id: string) => document.getElementById(id) as T | null;

let grid: SnapRecords<Book> | null = null;

const statusBadge: Record<Book['status'], string> = {
    published: 'bg-success',
    draft: 'bg-warning text-dark',
    archived: 'bg-secondary',
};

function collectFiltering(): Record<string, string> {
    return {
        title: byId<HTMLInputElement>('filter-title')?.value.trim() ?? '',
        name: byId<HTMLInputElement>('filter-author')?.value.trim() ?? '',
        status: byId<HTMLSelectElement>('filter-status')?.value ?? '',
    };
}

function formatStatus(value: unknown): string {
    const status = String(value) as Book['status'];
    const label = status.charAt(0).toUpperCase() + status.slice(1);
    return `<span class="badge ${statusBadge[status] ?? 'bg-secondary'}">${label}</span>`;
}

function formatPublished(value: unknown): string {
    const date = new Date(String(value));
    if (Number.isNaN(date.getTime())) {
        return String(value);
    }
    return `<span class="text-muted">${date.toLocaleDateString()}</span>`;
}

function formatActions(_value: unknown, row: Book): string {
    return `<button type="button" class="btn btn-sm btn-outline-primary" data-book-id="${row.id}">View</button>`;
}

function currentApi(): ISnapApi<Book> | undefined {
    return grid?.getApi();
}

function bindToolbar(): void {
    const applyFilters = () => currentApi()?.search(collectFiltering());

    byId<HTMLInputElement>('filter-title')?.addEventListener('input', applyFilters);
    byId<HTMLInputElement>('filter-author')?.addEventListener('input', applyFilters);
    byId<HTMLSelectElement>('filter-status')?.addEventListener('change', applyFilters);

    byId<HTMLSelectElement>('select-rows')?.addEventListener('change', (event) => {
        const value = Number((event.target as HTMLSelectElement).value);
        currentApi()?.setRowsPerPage(value as RowsPerPage);
    });

    byId<HTMLSelectElement>('select-format')?.addEventListener('change', (event) => {
        currentApi()?.setFormat((event.target as HTMLSelectElement).value as RenderType);
    });

    byId<HTMLSelectElement>('select-theme')?.addEventListener('change', (event) => {
        const theme = (event.target as HTMLSelectElement).value as SnapTheme;
        currentApi()?.setTheme(theme);
        if (theme === 'default') {
            document.documentElement.removeAttribute('data-bs-theme');
        } else {
            document.documentElement.setAttribute(
                'data-bs-theme',
                theme === 'light' ? 'light' : 'dark'
            );
        }
    });

    byId<HTMLSelectElement>('select-language')?.addEventListener('change', (event) => {
        void currentApi()?.setLanguage((event.target as HTMLSelectElement).value);
    });

    byId<HTMLButtonElement>('btn-reset')?.addEventListener('click', () => {
        const title = byId<HTMLInputElement>('filter-title');
        const author = byId<HTMLInputElement>('filter-author');
        const status = byId<HTMLSelectElement>('filter-status');
        const rows = byId<HTMLSelectElement>('select-rows');
        const format = byId<HTMLSelectElement>('select-format');
        const theme = byId<HTMLSelectElement>('select-theme');
        const language = byId<HTMLSelectElement>('select-language');
        if (title) title.value = '';
        if (author) author.value = '';
        if (status) status.value = '';
        if (rows) rows.value = String(RowsPerPage.DEFAULT);
        if (format) format.value = RenderType.TABLE;
        if (theme) theme.value = 'dark';
        if (language) language.value = 'en_US';
        currentApi()?.reset();
    });
}

function createGrid(): void {
    const container = byId<HTMLElement>('container-table');
    if (!container) {
        return;
    }

    grid?.getApi().destroy();

    grid = new SnapRecords<Book>(container, {
        url: dataUrl,
        debug: true,
        langPath: '/lang',
        language: 'en_US',
        theme: 'dark',
        selectable: true,
        draggableColumns: true,
        useCache: true,
        persistState: false,
        preloadNextPage: true,
        lazyLoadMedia: true,
        rowsPerPage: RowsPerPage.DEFAULT,
        columns: ['id', 'title', 'name', 'published', 'status', 'actions'],
        columnTitles: ['Id', 'Title', 'Author', 'Published', 'Status', 'Action'],
        headerCellClasses: [
            'text-center',
            '',
            '',
            'text-center',
            'text-center',
            'text-center no-sorting',
        ],
        prevButton: { text: '<span aria-hidden="true">‹</span>', isHtml: true },
        nextButton: { text: '<span aria-hidden="true">›</span>', isHtml: true },
        columnFormatters: {
            status: formatStatus,
            published: formatPublished,
            actions: formatActions,
        },
        lifecycleHooks: {
            preDataLoad: (params) => {
                const query = new URLSearchParams();
                query.set('currentPage', String(params.currentPage));
                query.set('rowsPerPage', String(params.rowsPerPage));
                query.set('offset', String(params.offset));
                Object.entries(params.filtering).forEach(([key, value]) => {
                    if (value) query.append(`filtering[${key}]`, value);
                });
                params.sorting.forEach(([column, direction]) => {
                    query.append(`sorting[${column}]`, direction);
                });
                const inspector = byId<HTMLElement>('query-inspector');
                if (inspector) {
                    inspector.textContent = `/api/books?${query.toString()}`;
                }
            },
            selectionChanged: (rows) => {
                const count = byId<HTMLElement>('selection-count');
                if (count) {
                    count.textContent = String(rows.length);
                }
            },
        },
    });
}

function initDemo(): void {
    bindToolbar();
    createGrid();
}

document.addEventListener('DOMContentLoaded', initDemo);
window.addEventListener('pageshow', (event) => {
    if (event.persisted) {
        createGrid();
    }
});
