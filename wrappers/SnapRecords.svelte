<script lang="ts" generic="T extends Identifiable">

    import { onMount } from 'svelte';
    import { SnapRecords } from './SnapRecords'; // Adjust path as needed
    import type { SnapRecordsOptions, Identifiable, ISnapApi } from './SnapTypes'; // Adjust path as needed

    // Use $props() to declare component properties in Svelte 5.
    const { options, onReady = () => {} } = $props<{
        options: SnapRecordsOptions<T>;
        onReady?: (api: ISnapApi<T>) => void;
    }>();

    // Use $state() to create a reactive state variable for the instance.
    let instance = $state<SnapRecords<T> | null>(null);

    // This remains the same: a reference to the DOM element.
    let container: HTMLElement;

    // Generate a unique ID for the container element.
    const componentId = `snap-records-svelte-${Math.random().toString(36).substring(2, 9)}`;

    // onMount is still used for logic that needs to run once the DOM is ready.
    onMount(() => {
        // We create the instance and assign it to our state variable.
        // The component will not be destroyed, so no need for onDestroy here.
        // Svelte 5's $effect handles cleanup automatically if needed.
        instance = new SnapRecords(componentId, options);
        onReady(instance.getApi());
    });

    // Use $effect() to react to changes in props or state.
    // This is the Rune equivalent of the `$` reactive block.
    // It will re-run whenever `options` or `instance` changes.
    $effect(() => {
        // The effect runs before mount, so we must check if the instance exists.
        if (instance) {
            const api = instance.getApi();

            // Call API methods to keep the instance in sync with the props.
            api.setTheme(options.theme);
            api.setLanguage(options.language);
            api.updateParams({
                filters: options.filters,
                sortConditions: options.sortConditions,
                rowsPerPage: options.rowsPerPage,
            });
        }
    });
</script>

<div id={componentId} bind:this={container}></div>
