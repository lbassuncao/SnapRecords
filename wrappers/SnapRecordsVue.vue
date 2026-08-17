<template>
    <div ref="container"></div>
</template>

<script setup lang="ts" generic="T extends Identifiable & Record<string, unknown>">
import { SnapRecords } from 'snap-records';
import { ref, onMounted, onUnmounted, watch } from 'vue';
import type { SnapRecordsOptions, Identifiable, ISnapApi } from 'snap-records';

const props = defineProps<{
    options: SnapRecordsOptions<T>;
}>();

const emit = defineEmits<{
    (e: 'ready', api: ISnapApi<T>): void;
}>();

const container = ref<HTMLElement | null>(null);
const instance = ref<SnapRecords<T> | null>(null);

onMounted(() => {
    if (!container.value) return;
    const srInstance = new SnapRecords<T>(container.value, props.options);
    instance.value = srInstance;
    emit('ready', srInstance.getApi());
});

onUnmounted(() => {
    instance.value?.destroy();
    instance.value = null;
});

watch(
    () => props.options.theme,
    (newTheme) => {
        if (!newTheme) return;
        const api = instance.value?.getApi();
        if (!api || api.isDestroyed) return;
        api.setTheme(newTheme);
    }
);

watch(
    () => props.options.language,
    (newLanguage) => {
        if (!newLanguage) return;
        const api = instance.value?.getApi();
        if (!api || api.isDestroyed) return;
        void api.setLanguage(newLanguage);
    }
);

watch(
    () => props.options.format,
    (newFormat) => {
        if (!newFormat) return;
        const api = instance.value?.getApi();
        if (!api || api.isDestroyed) return;
        api.setFormat(newFormat);
    }
);

watch(
    () => [props.options.filtering, props.options.sorting, props.options.rowsPerPage] as const,
    () => {
        const api = instance.value?.getApi();
        if (!api || api.isDestroyed) return;
        api.updateParams({
            filtering: props.options.filtering,
            sorting: props.options.sorting,
            rowsPerPage: props.options.rowsPerPage,
        });
    },
    { deep: true }
);
</script>
