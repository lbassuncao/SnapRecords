/*========================================================================================================

    INDEX FILE FOR VITE

    Entry point for the SnapRecords library when used with Vite.

    This module re-exports key types, enums, and the main `SnapRecords` class for TypeScript users.
    It provides type safety and convenient access to core functionality and configuration options.

    @packageDocumentation

==========================================================================================================*/

// Exports key types for TypeScript users
export type {
    Translation,
    Identifiable,
    LifecycleHooks,
    SnapRecordsOptions,
    ServerRequestParams,
} from './SnapTypes.js';

// Exports the main SnapRecords class
export { SnapRecords } from './SnapRecords.js';

// Exports commonly used enums for configuration
export { RenderType, OrderDirection, RowsPerPage } from './SnapTypes.js';

/*========================================================================================================
    INDEX FILE FOR VITE ENDS HERE
==========================================================================================================*/
