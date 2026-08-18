<script lang="ts" generic="T extends Identifiable & Record<string, unknown>">
    import { onMount, onDestroy } from 'svelte';
    import { SnapRecords } from 'snap-records';
    import type { SnapRecordsOptions, Identifiable, ISnapApi } from 'snap-records';

    const { options, onReady = () => {} } = $props<{
        options: SnapRecordsOptions<T>;
        onReady?: (api: ISnapApi<T>) => void;
    }>();

    let instance = $state<SnapRecords<T> | null>(null);
    let container: HTMLElement;

    onMount(() => {
        instance = new SnapRecords<T>(container, options);
        onReady(instance.getApi());
    });

    onDestroy(() => {
        instance?.destroy();
        instance = null;
    });

    $effect(() => {
        if (!instance || !options.theme) return;
        const api = instance.getApi();
        if (api.isDestroyed) return;
        api.setTheme(options.theme);
    });

    $effect(() => {
        if (!instance || !options.format) return;
        const api = instance.getApi();
        if (api.isDestroyed) return;
        api.setFormat(options.format);
    });

    $effect(() => {
        if (!instance || !options.language) return;
        const api = instance.getApi();
        if (api.isDestroyed) return;
        void api.setLanguage(options.language);
    });

    $effect(() => {
        if (!instance) return;
        const api = instance.getApi();
        if (api.isDestroyed) return;
        api.updateParams({
            filtering: options.filtering,
            sorting: options.sorting,
            rowsPerPage: options.rowsPerPage,
        });
    });
</script>

<div bind:this={container}></div>
