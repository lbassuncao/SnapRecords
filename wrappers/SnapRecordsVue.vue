<template>
    <div :id="containerId" ref="container"></div>
</template>

<script setup lang="ts" generic="T extends Identifiable">
import { SnapRecords } from 'snap-records';
import { ref, onMounted, onUnmounted, watch, computed } from 'vue';
import { SnapRecordsOptions, Identifiable, ISnapApi } from 'snap-records';

// Define component props
const props = defineProps<{
    options: SnapRecordsOptions<T>;
}>();

// Define emits to expose the API instance
const emit = defineEmits<{
    (e: 'ready', api: ISnapApi<T>): void;
}>();

// Create a ref for the container element
const container = ref<HTMLElement | null>(null);
// Create a ref to hold the SnapRecords instance
const instance = ref<SnapRecords<T> | null>(null);

// Generate a unique ID for the container
const containerId = computed(
    () => `snap-records-vue-${Math.random().toString(36).substring(2, 9)}`
);

// onMounted hook for component initialization
onMounted(() => {
    if (container.value) {
        // Create the SnapRecords instance when the component is mounted
        const srInstance = new SnapRecords<T>(containerId.value, props.options);
        instance.value = srInstance;
        emit('ready', srInstance.getApi());
    }
});

// onUnmounted hook for cleanup
onUnmounted(() => {
    // Destroy the instance when the component is destroyed
    instance.value?.destroy();
});

// Watch for changes in specific options and call the appropriate API methods
watch(
    () => props.options.theme,
    (newTheme) => {
        if (newTheme) {
            instance.value?.getApi().setTheme(newTheme);
        }
    }
);

watch(
    () => props.options.language,
    (newLanguage) => {
        if (newLanguage) {
            instance.value?.getApi().setLanguage(newLanguage);
        }
    }
);

// A deep watch can be used for complex objects like filters, but be mindful of performance.
// A more performant way is to watch specific, reactive properties.
watch(
    () => props.options,
    (newOptions) => {
        instance.value?.getApi().updateParams({
            filters: newOptions.filters,
            sortConditions: newOptions.sortConditions,
            rowsPerPage: newOptions.rowsPerPage,
        });
    },
    { deep: true }
);
</script>
