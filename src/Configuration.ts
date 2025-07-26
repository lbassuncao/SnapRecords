import {
    LogLevel,
    RowsPerPage,
    Identifiable,
    LifecycleHooks,
    SnapRecordsOptions,
    SnapRecordsConfigError
} from './SnapTypes.js';
import { log } from './utils.js';
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
        logger?: (level: LogLevel, message: string, ...args: unknown[]) => void)
    {
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
        this.validateRowsPerPage();
        this.validateFormatters();
        this.validateLifecycleHooks();
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
                    this.logger(LogLevel.WARN, `columnFormatters for column '${key}' is not a function.`);
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
            this.logger(LogLevel.WARN, 'The number of columns does not match the number of column titles.');
        }
    }

    // Validates the rowsPerPage option
    private validateRowsPerPage(): void {
        const rpp = this.options.rowsPerPage ?? RowsPerPage.DEFAULT;
        // Check if rowsPerPage is within the recommended range
        if (typeof rpp !== 'number' || rpp < 1 || rpp > 1000) {
            this.logger(LogLevel.WARN, `rowsPerPage value '${rpp}' is outside the recommended range (1-1000).`);
        }
    }

}

/*========================================================================================================
    CONFIGURATION OBJECT ENDS HERE
==========================================================================================================*/