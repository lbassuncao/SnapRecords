import React, { useRef, useEffect } from 'react';
import { SnapRecords } from 'snap-records';
import type { SnapRecordsOptions, Identifiable, ISnapApi } from 'snap-records';

type SnapRecord = Identifiable & Record<string, unknown>;

interface SnapRecordsReactProps<T extends SnapRecord> {
    options: SnapRecordsOptions<T>;
    onReady?: (api: ISnapApi<T>) => void;
}

function SnapRecordsReact<T extends SnapRecord>({ options, onReady }: SnapRecordsReactProps<T>) {
    const containerRef = useRef<HTMLDivElement>(null);
    const instanceRef = useRef<SnapRecords<T> | null>(null);
    const onReadyRef = useRef(onReady);
    onReadyRef.current = onReady;

    useEffect(() => {
        const el = containerRef.current;
        if (!el) return;

        const instance = new SnapRecords<T>(el, options);
        instanceRef.current = instance;
        onReadyRef.current?.(instance.getApi());

        return () => {
            instance.destroy();
            instanceRef.current = null;
        };
        // Initial options are applied at construction; later changes go through the API.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        const api = instanceRef.current?.getApi();
        if (!api || api.isDestroyed || !options.theme) return;
        api.setTheme(options.theme);
    }, [options.theme]);

    useEffect(() => {
        const api = instanceRef.current?.getApi();
        if (!api || api.isDestroyed || !options.format) return;
        api.setFormat(options.format);
    }, [options.format]);

    useEffect(() => {
        const api = instanceRef.current?.getApi();
        if (!api || api.isDestroyed || !options.language) return;
        void api.setLanguage(options.language);
    }, [options.language]);

    useEffect(() => {
        const api = instanceRef.current?.getApi();
        if (!api || api.isDestroyed) return;
        api.updateParams({
            filtering: options.filtering,
            sorting: options.sorting,
            rowsPerPage: options.rowsPerPage,
        });
    }, [options.filtering, options.sorting, options.rowsPerPage]);

    return <div ref={containerRef} />;
}

export default SnapRecordsReact;
