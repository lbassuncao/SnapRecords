import React, { useRef, useEffect, useId } from 'react';
import { SnapRecords } from 'snap-records';
import { SnapRecordsOptions, Identifiable, ISnapApi } from 'snap-records';

// Make the wrapper generic to pass down the data type T
interface SnapRecordsReactProps<T extends Identifiable> {
    options: SnapRecordsOptions<T>;
    // Optional callback to get the API instance
    onReady?: (api: ISnapApi<T>) => void;
}

function SnapRecordsReact<T extends Identifiable>({ options, onReady }: SnapRecordsReactProps<T>) {
    // Create a ref for the container div. This gives us a stable reference to the DOM element.
    const containerRef = useRef<HTMLDivElement>(null);
    // Create a ref to hold the SnapRecords instance itself.
    const instanceRef = useRef<SnapRecords<T> | null>(null);
    // Generate a unique ID for the container, as SnapRecords constructor requires an ID.
    const componentId = useId();
    const containerId = `snap-records-${componentId}`;

    // useEffect for mounting and unmounting the component
    useEffect(() => {
        // Check if the container element has been rendered
        if (containerRef.current) {
            // Create a new instance of SnapRecords
            const instance = new SnapRecords<T>(containerId, options);
            instanceRef.current = instance;

            if (onReady) {
                onReady(instance.getApi());
            }
        }

        // Cleanup function: this will be called when the component unmounts
        return () => {
            instanceRef.current?.destroy();
            instanceRef.current = null;
        };
        // The empty dependency array [] ensures this effect runs only once on mount.
    }, []); // Note: We only mount once. Updates are handled by the next effect.

    // useEffect to handle updates to the options prop
    useEffect(() => {
        const instance = instanceRef.current;
        if (!instance) return;

        // Here you can call specific API methods when props change
        // This is more efficient than re-creating the whole instance.
        const api = instance.getApi();

        // Example of updating specific properties
        if (options.theme) {
            api.setTheme(options.theme);
        }
        if (options.language) {
            api.setLanguage(options.language);
        }
        // For other params like filters, sorting, etc.
        api.updateParams({
            filters: options.filters,
            sortConditions: options.sortConditions,
            rowsPerPage: options.rowsPerPage,
        });
    }, [options]); // This effect re-runs whenever the `options` object changes.

    // Render the container div
    return <div id={containerId} ref={containerRef} />;
}

export default SnapRecordsReact;
