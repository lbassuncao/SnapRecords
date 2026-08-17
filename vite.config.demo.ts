import { Plugin, defineConfig } from 'vite';
import books from './demo/books.json' with { type: 'json' };

type BookStatus = 'published' | 'draft' | 'archived';

interface BookRecord {
    id: number;
    title: string;
    name: string;
    published: string;
    status: BookStatus;
}

const STATUSES: BookStatus[] = ['published', 'draft', 'archived'];

function statusOf(id: number): BookStatus {
    return STATUSES[id % STATUSES.length];
}

function parseBracketParams(params: URLSearchParams, prefix: string): Record<string, string> {
    const parsed: Record<string, string> = {};
    params.forEach((value, key) => {
        if (key.startsWith(`${prefix}[`) && key.endsWith(']')) {
            parsed[key.slice(prefix.length + 1, -1)] = value;
        }
    });
    return parsed;
}

function enrich(row: (typeof books.data)[number]): BookRecord {
    return { ...row, status: statusOf(row.id) };
}

function applyFiltering(rows: BookRecord[], filtering: Record<string, string>): BookRecord[] {
    return rows.filter((row) => {
        if (filtering.title && !row.title.toLowerCase().includes(filtering.title.toLowerCase())) {
            return false;
        }
        if (filtering.name && !row.name.toLowerCase().includes(filtering.name.toLowerCase())) {
            return false;
        }
        if (filtering.status && row.status !== filtering.status) {
            return false;
        }
        return true;
    });
}

function applySorting(rows: BookRecord[], params: URLSearchParams): BookRecord[] {
    const sorting: Array<[keyof BookRecord, 'ASC' | 'DESC']> = [];
    params.forEach((value, key) => {
        if (!key.startsWith('sorting[') || !key.endsWith(']')) {
            return;
        }
        const column = key.slice('sorting['.length, -1) as keyof BookRecord;
        const direction = value.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
        sorting.push([column, direction]);
    });

    const sorted = [...rows];
    sorting.reverse().forEach(([column, direction]) => {
        sorted.sort((a, b) => {
            const left = String(a[column] ?? '');
            const right = String(b[column] ?? '');
            const cmp = left.localeCompare(right, undefined, { numeric: true });
            return direction === 'DESC' ? -cmp : cmp;
        });
    });
    return sorted;
}

function handleBooksRequest(reqUrl: string, host: string): string {
    const url = new URL(reqUrl, `http://${host}`);
    const currentPage = Math.max(1, parseInt(url.searchParams.get('currentPage') || '1', 10) || 1);
    const rowsPerPage = Math.max(
        1,
        parseInt(url.searchParams.get('rowsPerPage') || '10', 10) || 10
    );
    const filtering = parseBracketParams(url.searchParams, 'filtering');

    let rows = books.data.map(enrich);
    rows = applyFiltering(rows, filtering);
    rows = applySorting(rows, url.searchParams);

    const start = (currentPage - 1) * rowsPerPage;
    return JSON.stringify({
        data: rows.slice(start, start + rowsPerPage),
        totalRecords: rows.length,
    });
}

function mockBooksApi(): Plugin {
    return {
        name: 'mock-books-api',
        configureServer(server) {
            server.middlewares.use('/api/books', (req, res) => {
                res.setHeader('Content-Type', 'application/json');
                res.end(handleBooksRequest(req.url ?? '/', req.headers.host || 'localhost'));
            });
        },
        configurePreviewServer(server) {
            server.middlewares.use('/api/books', (req, res) => {
                res.setHeader('Content-Type', 'application/json');
                res.end(handleBooksRequest(req.url ?? '/', req.headers.host || 'localhost'));
            });
        },
    };
}

export default defineConfig({
    plugins: [mockBooksApi()],
});
