import "fake-indexeddb/auto";

import {
    RenderType,
    SnapRecords,
    Translation,
    Identifiable,
    SnapRecordsOptions
} from '../src/index';

import en_US from './__mocks__/lang/en_US.json';
import { DropEffect, EffectAllowed } from './index';


// this mock functions in the scope of the module
// This allows us to access them within the tests
// to make assertions (expects).
const mockTranslationGet = jest.fn()
    .mockResolvedValue(en_US as unknown as Translation);
const mockTranslationClearCache = jest.fn();

// Update the mock to simulate the CLASS TranslationManager
// Instead of simulating a singleton object, we simulate the
// class and its constructor. The constructor returns
// an object that contains our mock functions.
jest.mock('../src/Translations.js', () => ({
    TranslationManager: jest.fn().mockImplementation(() => {
        return {
            get: mockTranslationGet,
            clearCache: mockTranslationClearCache,
        };
    }),
}));

// Mock class for DataTransfer
// Mock class for DataTransfer to simulate drag-and-drop events in tests
class MockDataTransfer {
    // Mock file list for drag-and-drop operations
    public files = {
        length: 0,
        item: (_: number) => null
    } as unknown as FileList;

    // Mock items list for drag-and-drop data
    public items = {
        length: 0,
        add: () => { },
        remove: () => { },
        clear: () => { }
    } as unknown as DataTransferItemList;

    // List of supported data types for drag-and-drop
    public types: readonly string[] = [];

    // Drop effect for drag-and-drop (e.g., 'move', 'copy')
    public dropEffect: DropEffect = 'none';

    // Internal map to store drag-and-drop data
    private data: Map<string, string> = new Map();

    // Allowed effect for drag-and-drop (e.g., 'move', 'copy')
    public effectAllowed: EffectAllowed = 'uninitialized';

    // Clears data for a specific format or all data
    public clearData(format?: string): void {
        if (format) {
            this.data.delete(format.toLowerCase());
        } else {
            this.data.clear();
        }
    }

    // Retrieves data for a given format
    public getData(format: string): string {
        return this.data.get(format.toLowerCase()) || '';
    }

    // Sets data for a given format
    public setData(format: string, data: string): void {
        this.data.set(format.toLowerCase(), data);
    }

    // Sets the drag image (not used in tests)
    public setDragImage(image: Element, x: number, y: number): void { }
}
// Assign mock DataTransfer to global scope for JSDOM compatibility
(global as any).DataTransfer = MockDataTransfer;

// Mock class for DragEvent
class MockDragEvent extends MouseEvent {
    public readonly dataTransfer: MockDataTransfer | null;
    constructor(type: string, options: {
        bubbles?: boolean;
        dataTransfer?: MockDataTransfer | null;
    } = {}) {
        super(type, options);
        this.dataTransfer = options.dataTransfer ?? null;
    }
}
(global as any).DragEvent = MockDragEvent;

// Mock global fetch API
global.fetch = jest.fn();

// Test suite for SnapRecords plugin
describe('SnapRecords', () => {

    const containerId = 'test-container';

    interface TestData extends Identifiable {
        [key: string]: any;
        name: string;
    }

    const defaultOptions: SnapRecordsOptions<TestData> = {
        debug: false,
        columns: ['id', 'name'],
        columnTitles: ['ID', 'Name'],
        url: 'http://localhost/api/data'
    };

    beforeAll(() => {
        jest.useFakeTimers();
    });

    beforeEach(() => {
        (global.fetch as jest.Mock).mockClear();
        (global.fetch as jest.Mock).mockImplementation(() =>
            Promise.resolve({
                ok: true,
                json: () => Promise.resolve({
                    totalRecords: 1,
                    data: [{ id: 1, name: 'Test User' }]
                }),
            })
        );

        // 3. Limpar as novas funções de mock em vez do require antigo
        mockTranslationGet.mockClear();
        mockTranslationClearCache.mockClear();

        document.body.innerHTML = `<div id="${containerId}"></div>`;
    });

    afterAll(() => {
        jest.useRealTimers();
    });

    // ... (Os testes 'Error Handling' e 'Initialization' devem passar sem alterações) ...
    describe('Error Handling', () => {

        // Test case for handling fetch failures
        it('should handle data fetch failure gracefully', async () => {
            // Mock fetch to reject with an error
            (global.fetch as jest.Mock).mockRejectedValue(new Error('Network Error'));
            const instance = new SnapRecords(containerId, defaultOptions);
            // Run all timers to complete async operations
            await jest.runAllTimersAsync();
            // Check for error container visibility
            const errorContainer = instance.container.querySelector('.snap-records-error');
            expect(errorContainer).not.toBeNull();
            expect((errorContainer as HTMLElement).style.display).toBe('block');
        });
    });

    describe('Initialization', () => {
        // Test case for successful initialization
        it('should initialize correctly and fetch data', async () => {
            new SnapRecords(containerId, defaultOptions);
            // Run all timers to complete async operations
            await jest.runAllTimersAsync();
            // Verify fetch was called once
            expect(global.fetch).toHaveBeenCalledTimes(1);
        });

        // Test case for missing URL configuration
        it('should throw a configuration error if URL is not provided', () => {
            const optionsWithoutUrl = { columns: ['id', 'name'] };
            // Expect constructor to throw configuration error
            expect(() => {
                new SnapRecords(containerId, optionsWithoutUrl as any);
            }).toThrow('URL option is mandatory and must be a string.');
        });

        // Test case for empty data response
        it('should display a no-data message when the API returns an empty array', async () => {
            // Mock fetch to return empty data
            (global.fetch as jest.Mock).mockResolvedValue({
                ok: true,
                json: () => Promise.resolve({ data: [], totalRecords: 0 }),
            });

            const instance = new SnapRecords(containerId, defaultOptions);
            // Run all timers to complete async operations
            await jest.runAllTimersAsync();

            // Check for no-data message in the UI
            const noDataMessage = instance.container.querySelector('.snap-no-data');
            expect(noDataMessage).not.toBeNull();
            expect(noDataMessage!.textContent).toContain('No data available');
        });
    });

    describe('Public API Methods', () => {
        // ... (os testes 'api.search()' e 'api.reset()' devem passar sem alterações) ...
        it('api.search() should apply filters and reload data', async () => {
            const instance = new SnapRecords(containerId, defaultOptions);
            const api = instance.getApi();
            // Run initial fetch
            await jest.runAllTimersAsync();
            // Apply search filter
            api.search({ name: 'query' });
            // Run timers for search fetch
            await jest.runAllTimersAsync();
            // Verify filter is included in fetch URL
            const lastCallUrl = new URL((global.fetch as jest.Mock).mock.calls[1][0]);
            expect(lastCallUrl.searchParams.get('filtering[name]')).toBe('query');
        });

        it('api.reset() should clear filters and reload', async () => {
            const instance = new SnapRecords(containerId, defaultOptions);
            const api = instance.getApi();
            // Run initial fetch
            await jest.runAllTimersAsync();
            // Apply search filter
            api.search({ name: 'query' });
            // Run timers for search fetch
            await jest.runAllTimersAsync();
            // Reset state
            api.reset();
            // Run timers for reset fetch
            await jest.runAllTimersAsync();
            // Verify filter is cleared from fetch URL
            const lastCallUrl = new URL((global.fetch as jest.Mock).mock.calls[2][0]);
            expect(lastCallUrl.searchParams.has('filtering[name]')).toBe(false);
        });

        it('should change language and re-render', async () => {
            const instance = new SnapRecords(containerId, defaultOptions);
            const api = instance.getApi();
            await jest.runAllTimersAsync();
            await api.setLanguage('pt_PT');
            await jest.runAllTimersAsync();

            // 4. Usar a referência direta da função de mock para a asserção
            expect(mockTranslationGet).toHaveBeenCalledWith('pt_PT');
        });
    });

    // ... (O resto do ficheiro permanece igual, todos os testes devem passar agora)
    describe('User Interactions', () => {

        // Test case for lifecycle hooks
        it('should call lifecycle hooks during its operation', async () => {
            // Mock lifecycle hooks
            const hooks = {
                preDataLoad: jest.fn(),
                postDataLoad: jest.fn(),
                preRender: jest.fn(),
                postRender: jest.fn(),
            };
            new SnapRecords(containerId, { ...defaultOptions, lifecycleHooks: hooks });

            // Run all timers to complete async operations
            await jest.runAllTimersAsync();

            // Verify all lifecycle hooks were called
            expect(hooks.preDataLoad).toHaveBeenCalled();
            expect(hooks.postDataLoad).toHaveBeenCalled();
            expect(hooks.preRender).toHaveBeenCalled();
            expect(hooks.postRender).toHaveBeenCalled();
        });

        // Test case for theme switching
        it('should change the theme when setTheme is called', async () => {
            const instance = new SnapRecords(containerId, defaultOptions);
            const api = instance.getApi();
            // Run initial fetch
            await jest.runAllTimersAsync();

            // ### CORRECTION HERE ###
            // Verify initial theme is now 'default'
            expect(instance.container.classList.contains('theme-default')).toBe(true);

            // Change theme to dark
            api.setTheme('dark');

            // Verify theme change
            expect(instance.container.classList.contains('theme-default')).toBe(false);
            expect(instance.container.classList.contains('theme-dark')).toBe(true);
        });

        // Test case for keyboard navigation
        it('should navigate rows with arrow keys', async () => {
            const instance = new SnapRecords(containerId, {
                ...defaultOptions,
                selectable: true,
            });
            // Run initial fetch
            await jest.runAllTimersAsync();

            // Focus the container for keyboard events
            const container = instance.container;
            container.focus();

            // Simulate ArrowDown key press
            container.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));

            // Verify current row is highlighted
            const currentRow = container.querySelector('.snap-current-row');

            expect(currentRow).not.toBeNull();
            expect((currentRow as HTMLElement).dataset.index).toBe('0');
        });

        // Test case for column sorting
        it('should sort data when a column header is clicked', async () => {
            const instance = new SnapRecords(containerId, defaultOptions);
            // Run initial fetch
            await jest.runAllTimersAsync();
            // Simulate click on column header
            const headerLink = instance.container.querySelector('th[data-col-id="name"] a');
            headerLink!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
            // Run timers for sort fetch
            await jest.runAllTimersAsync();
            // Verify sort parameter in fetch URL
            const lastCallUrl = new URL((global.fetch as jest.Mock).mock.calls[1][0]);
            expect(lastCallUrl.searchParams.get('sorting[name]')).toBe('ASC');
        });

        // Test case for column resizing
        it('should handle column resizing', async () => {
            const instance = new SnapRecords(containerId, defaultOptions);
            // Run initial fetch
            await jest.runAllTimersAsync();
            // Simulate resize handle mousedown
            const resizeHandle = instance.container.querySelector('.snap-column-resize-handle');
            if (!resizeHandle) throw new Error("Resize handle not found");
            resizeHandle.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: 50 }));
            // Simulate mouse movement
            document.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: 150 }));
            // Simulate mouse release
            document.dispatchEvent(new MouseEvent('mouseup'));
            // Verify column width is set
            expect(typeof instance.state.columnWidths.get('id')).toBe('number');
        });

        // Test case for row selection
        it('should select and deselect a row on click when selectable is true', async () => {
            // Mock selection changed hook
            const selectionChangedMock = jest.fn();
            const instance = new SnapRecords(containerId, {
                ...defaultOptions,
                selectable: true,
                lifecycleHooks: { selectionChanged: selectionChangedMock }
            });
            const api = instance.getApi();
            // Run initial fetch
            await jest.runAllTimersAsync();

            // Find first row
            const row = instance.container.querySelector('tr[data-index="0"]');
            expect(row).not.toBeNull();

            // Simulate row click to select
            (row as HTMLElement).dispatchEvent(new MouseEvent('click', { bubbles: true }));
            expect(row!.classList.contains('snap-selected')).toBe(true);
            expect(api.getSelectedRows().length).toBe(1);
            expect(api.getSelectedRows()[0].id).toBe(1);
            expect(selectionChangedMock).toHaveBeenCalledWith(expect.any(Array));

            // Simulate row click to deselect
            (row as HTMLElement).dispatchEvent(new MouseEvent('click', { bubbles: true }));
            expect(row!.classList.contains('snap-selected')).toBe(false);
            expect(api.getSelectedRows().length).toBe(0);
        });

        // Test case for column drag-and-drop
        it('should handle column drag-and-drop', async () => {
            const instance = new SnapRecords(containerId, { ...defaultOptions, draggableColumns: true });
            // Run initial fetch
            await jest.runAllTimersAsync();
            // Find column headers
            const idHeader = instance.container.querySelector('th[data-col-id="id"]')!;
            const nameHeader = instance.container.querySelector('th[data-col-id="name"]')!;
            // Simulate drag-and-drop
            const dataTransfer = new MockDataTransfer();
            dataTransfer.setData('text/plain', 'id');
            idHeader.dispatchEvent(new DragEvent('dragstart', { dataTransfer, bubbles: true }));
            nameHeader.dispatchEvent(new DragEvent('drop', { dataTransfer, bubbles: true }));
            // Verify column order changed
            expect(instance.state.columns).toEqual(['name', 'id']);
        });

        // Test case for list rendering mode
        it('should support LIST rendering mode', async () => {
            const instance = new SnapRecords(containerId, { ...defaultOptions, format: RenderType.LIST });
            // Run initial fetch
            await jest.runAllTimersAsync();
            // Verify list container exists
            const listElement = instance.container.querySelector('ul.snap-list');
            expect(listElement).not.toBeNull();
        });

        // Test case for pagination navigation
        it('should navigate to the next page when the next button is clicked', async () => {
            // Mock fetch with larger dataset
            (global.fetch as jest.Mock).mockResolvedValue({
                ok: true,
                json: () => Promise.resolve({ data: new Array(20).fill({ id: 1, name: 'Test' }), totalRecords: 20 }),
            });

            const instance = new SnapRecords(containerId, { ...defaultOptions, rowsPerPage: 10 });
            // Run initial fetch
            await jest.runAllTimersAsync();

            // Find next button
            const nextButton = instance.container.querySelector('.snap-next');
            expect(nextButton).not.toBeNull();

            // Simulate next button click
            (nextButton as HTMLElement).dispatchEvent(new MouseEvent('click', { bubbles: true }));
            // Run timers for fetch
            await jest.runAllTimersAsync();

            // Verify fetch for next page
            const lastFetchCall = (global.fetch as jest.Mock).mock.calls.pop()[0];
            expect(lastFetchCall).toContain('page=2');
        });
    });
});