import {
    LogLevel,
    RowsPerPage,
    Identifiable,
    LifecycleHooks,
    RenderType,
    SnapRecordsOptions,
    SnapRecordsConfigError,
} from './SnapTypes.js';
import { log, sanitizeRowsPerPage, compactFiltering, normalizeSorting } from './utils.js';
import { defaultOptions } from './SnapOptions.js';

/*========================================================================================================

    CONFIGURATION

    Class responsible for initializing and validating SnapRecords configuration options

    Class responsible for initializing, merging, and validating configuration options for SnapRecords.
    Ensures that user-provided options are combined with defaults, and validates all critical configuration
    aspects such as URL, columns, rows per page, column formatters, and lifecycle hooks. Provides warnings
    for non-critical issues and throws errors for invalid or missing mandatory options.

    @typeParam T - The record type, which must extend Identifiable and be an object.

==========================================================================================================*/

export class Configuration<T extends Identifiable & Record<string, unknown>> {
    // Validated configuration options
    public readonly options: SnapRecordsOptions<T>;
    // Logger function for warnings, now uses the utility log function
    private logger: (level: LogLevel, message: string, ...args: unknown[]) => void;

    // Constructor initializes options by merging user-provided options with defaults
    constructor(
        userOptions: Partial<SnapRecordsOptions<T>>,
        debug: boolean,
        logger?: (level: LogLevel, message: string, ...args: unknown[]) => void
    ) {
        // Merge user options with defaults
        this.options = { ...defaultOptions, ...userOptions } as SnapRecordsOptions<T>;
        // Set logger, defaulting to the utility log function with debug flag
        this.logger = logger || ((level, message, ...args) => log(debug, level, message, ...args));
        // Validate the merged options
        this.validate();
    }

    // Validates all configuration options
    private validate(): void {
        this.validateUrl();
        this.validateColumns();
        this.validateHeaderCellClasses();
        this.validateRowsPerPage();
        this.validateFiltering();
        this.validateSorting();
        this.validateTheme();
        this.validateFormat();
        this.validateFormatters();
        this.validateLifecycleHooks();
    }

    private validateTheme(): void {
        const theme = this.options.theme;
        if (theme && theme !== 'light' && theme !== 'dark' && theme !== 'default') {
            this.logger(
                LogLevel.WARN,
                `Invalid theme '${String(theme)}'. Falling back to 'default'.`
            );
            this.options.theme = 'default';
        }
    }

    private validateFormat(): void {
        const format = this.options.format;
        if (format && !Object.values(RenderType).includes(format)) {
            this.logger(
                LogLevel.WARN,
                `Invalid format '${String(format)}'. Falling back to table.`
            );
            this.options.format = RenderType.TABLE;
        }
    }

    // Validates lifecycle hooks
    private validateLifecycleHooks(): void {
        if (this.options.lifecycleHooks) {
            // Check each hook to ensure it's a function
            for (const key in this.options.lifecycleHooks) {
                if (
                    typeof this.options.lifecycleHooks[key as keyof LifecycleHooks<T>] !==
                    'function'
                ) {
                    this.logger(LogLevel.WARN, `lifecycleHook '${key}' is not a function.`);
                }
            }
        }
    }

    // Validates the URL option
    private validateUrl(): void {
        // Ensure URL is provided and is a string
        if (!this.options.url || typeof this.options.url !== 'string') {
            throw new SnapRecordsConfigError('URL option is mandatory and must be a string.');
        }
        try {
            // Validate URL format
            new URL(this.options.url, document.baseURI);
        } catch {
            throw new SnapRecordsConfigError(`Invalid URL provided: ${this.options.url}`);
        }
    }

    // Validates column formatters
    private validateFormatters(): void {
        if (this.options.columnFormatters) {
            // Check each formatter to ensure it's a function
            for (const key in this.options.columnFormatters) {
                if (typeof this.options.columnFormatters[key] !== 'function') {
                    this.logger(
                        LogLevel.WARN,
                        `columnFormatters for column '${key}' is not a function.`
                    );
                }
            }
        }
    }

    // Validates the columns option
    private validateColumns(): void {
        // Ensure columns is a non-empty array
        if (
            !this.options.columns ||
            !Array.isArray(this.options.columns) ||
            this.options.columns.length === 0
        ) {
            throw new SnapRecordsConfigError('Columns option must be a non-empty array.');
        }
        // Warn if column titles length doesn't match columns length
        if (
            this.options.columnTitles &&
            this.options.columns.length !== this.options.columnTitles.length
        ) {
            this.logger(
                LogLevel.WARN,
                'The number of columns does not match the number of column titles.'
            );
        }
    }

    // Validates the headerCellClasses option
    private validateHeaderCellClasses(): void {
        const headerCellClasses = this.options.headerCellClasses;
        if (!headerCellClasses || !Array.isArray(headerCellClasses)) return;
        // Header cell classes are applied to header cells by column index (SnapRenderer,
        // reorderColumns, and StateManager column-order restore all assume this positional
        // mapping), so a length that doesn't match columns silently misaligns classes
        // across columns once they get reordered. An empty array is a valid "no classes" state.
        if (
            headerCellClasses.length !== 0 &&
            headerCellClasses.length !== this.options.columns.length
        ) {
            this.logger(
                LogLevel.WARN,
                'The number of headerCellClasses does not match the number of columns. Falling back to [].'
            );
            this.options.headerCellClasses = [];
        }
    }

    // Validates the rowsPerPage option
    private validateRowsPerPage(): void {
        const rpp = this.options.rowsPerPage ?? RowsPerPage.DEFAULT;
        const sanitized = sanitizeRowsPerPage(rpp, RowsPerPage.DEFAULT);
        if (sanitized !== rpp) {
            this.logger(
                LogLevel.WARN,
                `rowsPerPage value '${rpp}' is invalid. Falling back to ${sanitized}.`
            );
            this.options.rowsPerPage = sanitized;
        }
    }

    private validateFiltering(): void {
        const filtering = this.options.filtering;
        if (filtering === undefined) return;
        if (!filtering || typeof filtering !== 'object' || Array.isArray(filtering)) {
            this.logger(LogLevel.WARN, 'filtering must be a plain object. Falling back to {}.');
            this.options.filtering = {};
            return;
        }
        this.options.filtering = compactFiltering(filtering);
    }

    private validateSorting(): void {
        if (this.options.sorting === undefined) return;
        const normalized = normalizeSorting(this.options.sorting);
        if (JSON.stringify(normalized) !== JSON.stringify(this.options.sorting)) {
            this.logger(LogLevel.WARN, 'Invalid sorting entries were dropped or normalized.');
            this.options.sorting = normalized;
        }
    }
}

/*========================================================================================================
    CONFIGURATION OBJECT ENDS HERE
==========================================================================================================*/
