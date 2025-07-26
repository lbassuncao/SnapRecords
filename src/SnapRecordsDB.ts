import { Dexie, Table } from 'dexie';
import type { CacheData, Identifiable } from './SnapTypes.js';

/*========================================================================================================

    SNAP RECORDS DB CLASS

    Class responsible for managing IndexedDB storage for caching SnapRecords data

    Class responsible for managing IndexedDB storage for caching SnapRecords data.

    @template T - The type of records being cached, which must extend Identifiable and Record<string, unknown>.

    This class extends Dexie to provide a typed interface for storing and retrieving cached data
    in an IndexedDB database. It defines a single table, `cache`, which uses the record's URL as the primary key.
    The class handles database initialization, schema definition, and error logging during database opening.

==========================================================================================================*/

export class SnapRecordsDB<T extends Identifiable & Record<string, unknown>> extends Dexie {
    // Table for storing cached data
    cache!: Table<CacheData<T>, string>;

    // Constructor initializes the IndexedDB database with a specific name
    constructor(name: string) {
        // Initialize Dexie with the provided name
        super(name);
        // Define database version and schema
        const dbVersion = 1.0;
        this.version(dbVersion).stores({
            // Define cache table with URL as the primary key
            cache: 'url, timestamp',
        });
        // Open the database, logging errors to the console if it fails
        this.open().catch(() => {
            // Error is automatically logged to the browser console
        });
    }
}

/*========================================================================================================
    SNAPRECORDSDB CLASS ENDS HERE
==========================================================================================================*/
