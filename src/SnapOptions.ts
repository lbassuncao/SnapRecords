/**

 */
import { RowsPerPage, RenderType } from './SnapTypes.js';

/*========================================================================================================

    SNAP RECORDS DEFAULT OPTIONS

    @file SnapOptions.ts
    @description

    Provides the default configuration options and UI-related constants for the SnapRecords component.
    This includes API endpoints, UI themes, pagination settings, class names, and other customizable
    options that control the behavior and appearance of SnapRecords tables and lists.

==========================================================================================================*/

// Default configuration options for SnapRecords
export const defaultOptions = {
    // API URL for data fetching
    url: '',
    // List of column names to display
    columns: [],
    // Flag to enable debug logging
    debug: false,
    // Theme for the UI (default, light or dark)
    theme: 'default',
    // Flag to enable data caching
    useCache: false,
    // Number of retry attempts for failed fetches
    retryAttempts: 3,
    // List of column titles
    columnTitles: [],
    // Language code for translations
    language: 'en_US',
    // Path to the language files directory
    langPath: '/lang',
    // Flag to enable row selection
    selectable: false,
    // Flag to enable URL state persistence
    usePushState: false,
    // Flag to enable state persistence in localStorage
    persistState: false,
    // Size of the format cache
    formatCacheSize: 500,
    // Flag to enable lazy loading of media
    lazyLoadMedia: false,
    // Flag to destroy the instance on window unload
    destroyOnUnload: true,
    // Flag to enable preloading of the next page
    preloadNextPage: false,
    // Flag to enable draggable columns
    draggableColumns: false,
    // Default rendering mode
    format: RenderType.TABLE,
    // Default number of rows per page
    rowsPerPage: RowsPerPage.DEFAULT,
};

// Configuration object containing constants and class names
export const config = {
    // Constants for various settings
    constants: {
        // Default debounce delay for data loading (in milliseconds)
        defaultDebounceDelay: 250,
        // Default cache expiration time (in milliseconds)
        defaultCacheExpiry: 28800000,
        // Delay for screen reader announcements (in milliseconds)
        screenReaderAnnouncementDelay: 1000,
        // Number of pages to show around the current page in pagination
        paginationPageRange: 2,
        // Maximum page distance before showing ellipsis
        paginationMaxPageDistance: 3,
        // Distance before showing ellipsis in pagination
        paginationEllipsisDistance: 4,
        // Buffer for showing the last page in pagination
        paginationLastPageBuffer: 2,
        // Buffer for showing ellipsis before the last page
        paginationEllipsisLastPageBuffer: 3,
    },
    // Pagination configuration
    pagination: {
        // Previous button configuration
        prevButton: {
            // HTML content for the previous button
            text: '<span aria-hidden="true">«</span>',
            // Flag indicating if text is HTML
            isHtml: true,
            // Class names for styling
            classNames: {
                // Base class for the button
                base: 'snap-prev',
                // Class for disabled state
                disabled: 'snap-disabled',
            },
        },
        // Next button configuration
        nextButton: {
            // HTML content for the next button
            text: '<span aria-hidden="true">»</span>',
            // Flag indicating if text is HTML
            isHtml: true,
            // Class names for styling
            classNames: {
                // Base class for the button
                base: 'snap-next',
                // Class for disabled state
                disabled: 'snap-disabled',
            },
        },
        // Page number button configuration
        numberButton: {
            // Class names for styling
            classNames: {
                // Base class for the button
                base: 'snap-page-number',
                // Class for active (current) page
                disabled: 'snap-active',
            },
        },
        // Ellipsis configuration
        ellipsis: {
            // Class names for styling
            classNames: {
                // Base class for the ellipsis
                base: 'snap-pagination-ellipsis',
            },
        },
    },
    // CSS class names for various UI elements
    classes: {
        // Class for the main table container
        tableContainer: 'snap-records-container',
        // Class for the content container
        contentContainer: 'snap-records-content',
        // Class for the error container
        errorContainer: 'snap-records-error',
        // Class for responsive table wrapper
        tableResponsive: 'table-responsive',
        // Table-specific classes
        table: {
            // Class for the table container
            containerClass: 'snap-records snap-table',
            // Class for the table header
            headerClass: 'snap-records-header',
            // Class for the table body
            bodyClass: 'snap-records-body',
            // Class for the table footer
            footerClass: 'snap-records-footer',
        },
        // List-specific classes
        list: {
            // Class for the list container
            containerClass: 'snap-list',
            // Class for list items
            itemClass: 'snap-list-item',
        },
        // Class for mobile cards container
        mobileCardsContainer: 'snap-mobile-cards-container',
        // Class for individual mobile cards
        mobileCard: 'snap-mobile-card',
        // Class for rows within mobile cards
        cardRow: 'snap-card-row',
        // Class for labels in mobile cards
        cardLabel: 'snap-card-label',
        // Class for values in mobile cards
        cardValue: 'snap-card-value',
        // Class for the footer container
        footerContainer: 'snap-records-footer-container',
        // Class for the footer
        footer: 'snap-footer',
        // Class for the totals display
        totals: 'snap-totals',
        // Class for the pagination container
        paginationContainer: 'snap-pagination-container',
        // Class for pagination elements
        pagination: 'snap-pagination',
        // Class for pagination cells
        paginationCell: 'snap-pagination-cell',
        // Class for the loading overlay
        loadingOverlay: 'snap-loading-overlay',
        // Class for table overlay
        tableOverlay: 'snap-table-overlay',
        // Class for list overlay
        listOverlay: 'snap-list-overlay',
        // Class for cards overlay
        cardsOverlay: 'snap-cards-overlay',
        // Class for no-data message
        noData: 'snap-no-data',
        // Class for selected rows
        selected: 'snap-selected',
        // Class for the current row
        currentRow: 'snap-current-row',
        // Class for column resize handle
        columnResizeHandle: 'snap-column-resize-handle',
        // Class for ascending sort order
        sortAscOrder: 'snap-asc-order',
        // Class for descending sort order
        sortDescOrder: 'snap-desc-order',
        // Class for no sort order
        sortNoOrder: 'snap-no-order',
        // Class for start record display
        recordStart: 'snap-record-start',
        // Class for end record display
        recordEnd: 'snap-record-end',
        // Class for total records display
        recordsTotal: 'snap-records-total',
        // Class for draggable columns
        draggableColumn: 'snap-draggable-column',
        // Class for column being dragged
        dragging: 'snap-dragging',
        // Class for drag-over target
        dragOver: 'snap-drag-over',
    },
};

/*========================================================================================================
    SNAP RECORDS DEFAULT OPTIONS ENDS HERE
==========================================================================================================*/
