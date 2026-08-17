import { LogLevel, OrderDirection, SortCondition } from './SnapTypes.js';

/*========================================================================================================

    UTILS FILE

    Utility function to sanitize HTML strings and prevent basic XSS attacks.
    This function creates a temporary DOM element, parses the input HTML string,
    removes all <script> and <style> elements, and strips out any attributes
    that start with 'on' (such as onclick, onmouseover, etc.) from all elements.
    It returns the sanitized HTML as a string.

==========================================================================================================*/

// Utility function to sanitize HTML strings and prevent basic XSS attacks
const DANGEROUS_TAGS = 'script, style, iframe, object, embed, form, link, meta, base, applet';
const URL_ATTRS = new Set([
    'href',
    'src',
    'srcset',
    'poster',
    'action',
    'formaction',
    'xlink:href',
]);

function compactForUrlCheck(value: string): string {
    return value.replace(/[\u0000-\u0020]+/g, '');
}

function isDangerousSingleUrl(value: string): boolean {
    const trimmed = value.trim();
    if (!trimmed) return false;
    const compact = compactForUrlCheck(trimmed);
    if (/^(?:javascript:|vbscript:)/i.test(compact)) return true;
    if (
        /^data:/i.test(compact) &&
        !/^data:image\/(?:gif|jpeg|jpg|png|webp|bmp|avif)/i.test(compact)
    ) {
        return true;
    }
    return false;
}

function isDangerousUrl(value: string): boolean {
    if (isDangerousSingleUrl(value)) return true;
    return value.split(',').some((part) => {
        const url = part.trim().split(/\s+/)[0] ?? '';
        return isDangerousSingleUrl(url);
    });
}

export function escapeHTML(str: string): string {
    const temp = document.createElement('div');
    temp.textContent = str;
    return temp.innerHTML;
}

export function sanitizeHTML(str: string): string {
    const temp = document.createElement('div');
    temp.innerHTML = str;

    temp.querySelectorAll(DANGEROUS_TAGS).forEach((el) => el.remove());

    temp.querySelectorAll('*').forEach((el) => {
        for (const attr of Array.from(el.attributes)) {
            const name = attr.name.toLowerCase();
            if (name.startsWith('on') || name === 'srcdoc') {
                el.removeAttribute(attr.name);
                continue;
            }
            if (
                name === 'style' &&
                /(?:javascript:|vbscript:|expression\(|url\(['"]?(?:javascript|vbscript|data):)/i.test(
                    compactForUrlCheck(attr.value)
                )
            ) {
                el.removeAttribute(attr.name);
                continue;
            }
            if (URL_ATTRS.has(name) && isDangerousUrl(attr.value)) {
                el.removeAttribute(attr.name);
            }
        }
    });

    return temp.innerHTML;
}

export function escapeAttributeValue(value: string): string {
    if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') {
        return CSS.escape(value);
    }
    return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

export function compactFiltering(filtering: Record<string, string>): Record<string, string> {
    if (!filtering || typeof filtering !== 'object' || Array.isArray(filtering)) {
        return {};
    }
    const compacted: Record<string, string> = {};
    Object.keys(filtering)
        .sort()
        .forEach((key) => {
            if (!key) return;
            const value = filtering[key];
            const trimmed = typeof value === 'string' ? value.trim() : '';
            if (trimmed) compacted[key] = trimmed;
        });
    return compacted;
}

export function normalizeSorting(sorting: unknown): SortCondition[] {
    if (!Array.isArray(sorting)) return [];
    const byColumn = new Map<string, OrderDirection>();
    for (const condition of sorting) {
        if (!Array.isArray(condition) || condition.length < 2) continue;
        const column = typeof condition[0] === 'string' ? condition[0].trim() : '';
        if (!column) continue;
        const direction = String(condition[1] ?? '').toUpperCase();
        if (direction !== OrderDirection.ASC && direction !== OrderDirection.DESC) continue;
        byColumn.delete(column);
        byColumn.set(column, direction as OrderDirection);
    }
    return Array.from(byColumn, ([column, direction]) => [column, direction]);
}

export function sanitizeRowsPerPage(value: unknown, fallback: number = 10): number {
    const n = Math.trunc(Number(value));
    if (!Number.isFinite(n) || n < 1) return fallback;
    return Math.min(n, 1000);
}

export function sanitizeLanguage(lang: unknown): string {
    const safe = String(lang ?? '').replace(/[^a-zA-Z0-9_-]/g, '');
    return safe || 'en_US';
}

export function resolveTotalRecords(totalRecords: unknown, rowCount: number): number {
    const rows = Math.max(0, Math.trunc(rowCount) || 0);
    if (typeof totalRecords === 'number' && Number.isFinite(totalRecords)) {
        const total = Math.max(0, Math.trunc(totalRecords));
        return total === 0 && rows > 0 ? rows : total;
    }
    return rows;
}

// Utility function for logging messages based on debug flag and log level
/* eslint-disable no-console */
export function log(debug: boolean, level: LogLevel, ...args: unknown[]): void {
    // Skip logging if debug is disabled
    if (!debug) return;

    // Prefix for all log messages
    const prefix = 'SnapRecords:';

    // Log message with the specified level
    console[level](prefix, ...args);
}
/* eslint-enable no-console */

/*========================================================================================================
    UTILS FILE ENDS HERE
==========================================================================================================*/
