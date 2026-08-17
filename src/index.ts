/*========================================================================================================

    INDEX FILE FOR VITE

    Entry point for the SnapRecords library when used with Vite.

    This module re-exports key types, enums, and the main `SnapRecords` class for TypeScript users.
    It provides type safety and convenient access to core functionality and configuration options.

    @packageDocumentation

==========================================================================================================*/

export type {
    ISnapApi,
    SnapTheme,
    Translation,
    Identifiable,
    SortCondition,
    LifecycleHooks,
    SnapRecordsState,
    SnapRecordsOptions,
    ServerRequestParams,
    PersistedState,
} from './SnapTypes.js';

export { SnapRecords } from './SnapRecords.js';

export {
    RenderType,
    OrderDirection,
    RowsPerPage,
    SnapRecordsConfigError,
    SnapRecordsDataError,
} from './SnapTypes.js';

/*========================================================================================================
    INDEX FILE FOR VITE ENDS HERE
==========================================================================================================*/
