import 'fake-indexeddb/auto';

import {
    RenderType,
    SnapRecords,
    Translation,
    Identifiable,
    SnapRecordsOptions,
} from '../src/index';

import en_US from './__mocks__/lang/en_US.json';
import { DropEffect, EffectAllowed } from './index';

// this mock functions in the scope of the module
// This allows us to access them within the tests
// to make assertions (expects).
const mockTranslationGet = jest.fn().mockResolvedValue(en_US as unknown as Translation);
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
        item: (_: number) => null,
    } as unknown as FileList;

    // Mock items list for drag-and-drop data
    public items = {
        length: 0,
        add: () => {},
        remove: () => {},
        clear: () => {},
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
    public setDragImage(image: Element, x: number, y: number): void {}
}
// Assign mock DataTransfer to global scope for JSDOM compatibility
(global as any).DataTransfer = MockDataTransfer;

// Mock class for DragEvent
class MockDragEvent extends MouseEvent {
    public readonly dataTransfer: MockDataTransfer | null;
    constructor(
        type: string,
        options: {
            bubbles?: boolean;
            dataTransfer?: MockDataTransfer | null;
        } = {}
    ) {
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
        url: 'http://localhost/api/data',
    };

    beforeAll(() => {
        jest.useFakeTimers();
    });

    beforeEach(() => {
        (global.fetch as jest.Mock).mockClear();
        (global.fetch as jest.Mock).mockImplementation(() =>
            Promise.resolve({
                ok: true,
                json: () =>
                    Promise.resolve({
                        totalRecords: 1,
                        data: [{ id: 1, name: 'Test User' }],
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

        it('should not retry HTTP 4xx responses', async () => {
            (global.fetch as jest.Mock).mockResolvedValue({
                ok: false,
                status: 404,
            });
            new SnapRecords(containerId, defaultOptions);
            await jest.runAllTimersAsync();
            expect(global.fetch).toHaveBeenCalledTimes(1);
        });

        it('should retry HTTP 5xx responses before showing an error', async () => {
            (global.fetch as jest.Mock)
                .mockResolvedValueOnce({
                    ok: false,
                    status: 503,
                })
                .mockResolvedValueOnce({
                    ok: true,
                    json: () =>
                        Promise.resolve({
                            data: [{ id: 1, name: 'Test User' }],
                            totalRecords: 1,
                        }),
                });
            const instance = new SnapRecords(containerId, {
                ...defaultOptions,
                retryAttempts: 1,
            });
            await jest.runAllTimersAsync();
            expect(global.fetch).toHaveBeenCalledTimes(2);
            expect(instance.container.querySelector('.snap-records-error')?.innerHTML).toBe('');
            expect(instance.container.querySelector('tbody')).not.toBeNull();
        });

        it('should not retry an invalid API payload', async () => {
            (global.fetch as jest.Mock).mockResolvedValue({
                ok: true,
                json: () => Promise.resolve({ totalRecords: 1 }),
            });
            const instance = new SnapRecords(containerId, defaultOptions);
            await jest.runAllTimersAsync();
            expect(global.fetch).toHaveBeenCalledTimes(1);
            const errorContainer = instance.container.querySelector(
                '.snap-records-error'
            ) as HTMLElement;
            expect(errorContainer.style.display).toBe('block');
        });

        it('should show the table again after a failed load is retried successfully', async () => {
            (global.fetch as jest.Mock).mockRejectedValue(new Error('Network Error'));
            const instance = new SnapRecords(containerId, defaultOptions);
            await jest.runAllTimersAsync();

            const errorContainer = instance.container.querySelector(
                '.snap-records-error'
            ) as HTMLElement;
            const content = instance.container.querySelector(
                '.snap-records-content'
            ) as HTMLElement;
            expect(errorContainer.style.display).toBe('block');
            expect(content.style.display).toBe('none');

            (global.fetch as jest.Mock).mockImplementation(() =>
                Promise.resolve({
                    ok: true,
                    json: () =>
                        Promise.resolve({
                            totalRecords: 1,
                            data: [{ id: 1, name: 'Test User' }],
                        }),
                })
            );

            const retry = errorContainer.querySelector('.snap-retry-button') as HTMLButtonElement;
            expect(retry.type).toBe('button');
            retry.click();
            await jest.runAllTimersAsync();

            expect(errorContainer.style.display).toBe('none');
            expect(content.style.display).not.toBe('none');
            expect(instance.container.querySelector('tbody tr[data-index]')).not.toBeNull();
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

        it('should compact initial filtering from the constructor', async () => {
            new SnapRecords(containerId, {
                ...defaultOptions,
                filtering: { name: '  ', status: 'ok' },
            });
            await jest.runAllTimersAsync();
            const lastCallUrl = new URL((global.fetch as jest.Mock).mock.calls[0][0]);
            expect(lastCallUrl.searchParams.has('filtering[name]')).toBe(false);
            expect(lastCallUrl.searchParams.get('filtering[status]')).toBe('ok');
        });

        it('api.search() should keep literal filter characters in the query', async () => {
            const instance = new SnapRecords(containerId, defaultOptions);
            const api = instance.getApi();
            await jest.runAllTimersAsync();
            api.search({ name: 'a < b' });
            await jest.runAllTimersAsync();
            const lastCallUrl = new URL(
                (global.fetch as jest.Mock).mock.calls[
                    (global.fetch as jest.Mock).mock.calls.length - 1
                ][0]
            );
            expect(lastCallUrl.searchParams.get('filtering[name]')).toBe('a < b');
        });

        it('api.search() should not reload when filters and page are unchanged', async () => {
            const instance = new SnapRecords(containerId, defaultOptions);
            const api = instance.getApi();
            await jest.runAllTimersAsync();
            const calls = (global.fetch as jest.Mock).mock.calls.length;
            api.search({});
            await jest.runAllTimersAsync();
            expect((global.fetch as jest.Mock).mock.calls.length).toBe(calls);
        });

        it('api.setCurrentPage() should not reload the current page', async () => {
            const instance = new SnapRecords(containerId, defaultOptions);
            const api = instance.getApi();
            await jest.runAllTimersAsync();
            const calls = (global.fetch as jest.Mock).mock.calls.length;
            api.setCurrentPage(1);
            await jest.runAllTimersAsync();
            expect((global.fetch as jest.Mock).mock.calls.length).toBe(calls);
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

        it('should apply headerCellClasses and honour no-sorting', async () => {
            const instance = new SnapRecords(containerId, {
                ...defaultOptions,
                headerCellClasses: ['text-center', 'no-sorting'],
            });
            await jest.runAllTimersAsync();

            const idHeader = instance.container.querySelector('th[data-col-id="id"]');
            const nameHeader = instance.container.querySelector('th[data-col-id="name"]');
            expect(idHeader?.className).toContain('text-center');
            expect(nameHeader?.className).toContain('no-sorting');
            expect(idHeader?.querySelector('button')).not.toBeNull();
            expect(nameHeader?.querySelector('button')).toBeNull();
            expect(instance.headerCellClasses).toEqual(instance.state.headerCellClasses);
            expect(instance.headerCellClasses).toEqual(['text-center', 'no-sorting']);

            instance.reorderColumns('name', 'id');
            expect(instance.state.columns).toEqual(['name', 'id']);
            expect(instance.state.headerCellClasses).toEqual(['no-sorting', 'text-center']);
            expect(instance.headerCellClasses).toEqual(instance.state.headerCellClasses);
            const nameAfter = instance.container.querySelector('th[data-col-id="name"]');
            const idAfter = instance.container.querySelector('th[data-col-id="id"]');
            expect(nameAfter?.className).toContain('no-sorting');
            expect(nameAfter?.querySelector('button')).toBeNull();
            expect(idAfter?.className).toContain('text-center');
            expect(idAfter?.querySelector('button')).not.toBeNull();
        });

        it('should destroy a previous instance when constructed on the same container', async () => {
            const first = new SnapRecords(containerId, defaultOptions);
            const destroySpy = jest.spyOn(first, 'destroy');
            new SnapRecords(containerId, defaultOptions);
            expect(destroySpy).toHaveBeenCalled();
            await jest.runAllTimersAsync();
            expect(document.querySelectorAll(`#${containerId} .snap-records-content`)).toHaveLength(
                1
            );
        });

        it('api.search() should omit empty filtering values', async () => {
            const instance = new SnapRecords(containerId, defaultOptions);
            const api = instance.getApi();
            await jest.runAllTimersAsync();
            api.search({ name: '  ', status: '' });
            await jest.runAllTimersAsync();
            const calls = (global.fetch as jest.Mock).mock.calls;
            const lastCallUrl = new URL(calls[calls.length - 1][0]);
            expect(lastCallUrl.searchParams.has('filtering[name]')).toBe(false);
            expect(lastCallUrl.searchParams.has('filtering[status]')).toBe(false);
        });

        it('api.updateParams() should reset to page 1 when filtering changes', async () => {
            const instance = new SnapRecords(containerId, defaultOptions);
            const api = instance.getApi();
            await jest.runAllTimersAsync();
            api.setCurrentPage(2);
            await jest.runAllTimersAsync();
            api.updateParams({ filtering: { name: 'query' } });
            await jest.runAllTimersAsync();
            expect(instance.state.currentPage).toBe(1);
            const calls = (global.fetch as jest.Mock).mock.calls;
            const lastCallUrl = new URL(calls[calls.length - 1][0]);
            expect(lastCallUrl.searchParams.get('currentPage')).toBe('1');
            expect(lastCallUrl.searchParams.get('filtering[name]')).toBe('query');
        });

        it('api.updateParams() should not reload when nothing changed', async () => {
            const instance = new SnapRecords(containerId, defaultOptions);
            const api = instance.getApi();
            await jest.runAllTimersAsync();
            const calls = (global.fetch as jest.Mock).mock.calls.length;
            api.updateParams({});
            await jest.runAllTimersAsync();
            expect((global.fetch as jest.Mock).mock.calls.length).toBe(calls);
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

            expect(instance.container.classList.contains('theme-default')).toBe(true);

            // Change theme to dark
            api.setTheme('dark');

            // Verify theme change
            expect(instance.container.classList.contains('theme-default')).toBe(false);
            expect(instance.container.classList.contains('theme-dark')).toBe(true);

            api.setTheme('default');
            expect(instance.container.classList.contains('theme-dark')).toBe(false);
            expect(instance.container.classList.contains('theme-default')).toBe(true);
        });

        it('should accept an HTMLElement as the container', async () => {
            const el = document.getElementById(containerId)!;
            const instance = new SnapRecords(el, defaultOptions);
            await jest.runAllTimersAsync();
            expect(instance.container).toBe(el);
            expect(global.fetch).toHaveBeenCalled();
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
            container.dispatchEvent(
                new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true })
            );

            // Verify current row is highlighted
            const currentRow = container.querySelector('.snap-current-row');

            expect(currentRow).not.toBeNull();
            expect((currentRow as HTMLElement).dataset.index).toBe('0');
        });

        it('should ignore ArrowUp when no row is current', async () => {
            const instance = new SnapRecords(containerId, {
                ...defaultOptions,
                selectable: true,
            });
            await jest.runAllTimersAsync();
            const container = instance.container;
            container.focus();
            expect(instance.currentRowIndex).toBe(-1);
            container.dispatchEvent(
                new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true })
            );
            expect(instance.currentRowIndex).toBe(-1);
            expect(container.querySelector('.snap-current-row')).toBeNull();
        });

        it('should leave currentRowIndex at -1 when Home or End is pressed with no rows', async () => {
            (global.fetch as jest.Mock).mockResolvedValue({
                ok: true,
                json: () => Promise.resolve({ data: [], totalRecords: 0 }),
            });
            const instance = new SnapRecords(containerId, {
                ...defaultOptions,
                selectable: true,
            });
            await jest.runAllTimersAsync();
            const container = instance.container;
            container.focus();
            container.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }));
            expect(instance.currentRowIndex).toBe(-1);
            container.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }));
            expect(instance.currentRowIndex).toBe(-1);
            expect(container.querySelector('.snap-current-row')).toBeNull();
        });

        it('should move to the first row with Home instead of resetting the grid', async () => {
            const instance = new SnapRecords(containerId, {
                ...defaultOptions,
                selectable: true,
            });
            await jest.runAllTimersAsync();
            const container = instance.container;
            container.dispatchEvent(
                new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true })
            );
            container.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }));
            container.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }));
            const currentRow = container.querySelector('.snap-current-row');
            expect(currentRow).not.toBeNull();
            expect((currentRow as HTMLElement).dataset.index).toBe('0');
            expect(instance.state.filtering).toEqual({});
        });

        // Test case for column sorting
        it('should sort data when a column header is clicked', async () => {
            const instance = new SnapRecords(containerId, defaultOptions);
            // Run initial fetch
            await jest.runAllTimersAsync();
            // Simulate click on column header
            const headerLink = instance.container.querySelector('th[data-col-id="name"] button');
            headerLink!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
            // Run timers for sort fetch
            await jest.runAllTimersAsync();
            // Verify sort parameter in fetch URL
            const lastCallUrl = new URL((global.fetch as jest.Mock).mock.calls[1][0]);
            expect(lastCallUrl.searchParams.get('sorting[name]')).toBe('ASC');
        });

        it('should reset to page 1 when a column header is sorted', async () => {
            (global.fetch as jest.Mock).mockResolvedValue({
                ok: true,
                json: () =>
                    Promise.resolve({
                        data: [{ id: 1, name: 'Test User' }],
                        totalRecords: 50,
                    }),
            });
            const instance = new SnapRecords(containerId, defaultOptions);
            const api = instance.getApi();
            await jest.runAllTimersAsync();
            api.setCurrentPage(3);
            await jest.runAllTimersAsync();
            expect(instance.state.currentPage).toBe(3);

            const headerLink = instance.container.querySelector('th[data-col-id="name"] button');
            headerLink!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
            await jest.runAllTimersAsync();

            expect(instance.state.currentPage).toBe(1);
            const lastCallUrl = new URL(
                (global.fetch as jest.Mock).mock.calls[
                    (global.fetch as jest.Mock).mock.calls.length - 1
                ][0]
            );
            expect(lastCallUrl.searchParams.get('currentPage')).toBe('1');
            expect(lastCallUrl.searchParams.get('sorting[name]')).toBe('ASC');
        });

        // Test case for column resizing
        it('should handle column resizing', async () => {
            const instance = new SnapRecords(containerId, defaultOptions);
            // Run initial fetch
            await jest.runAllTimersAsync();
            // Simulate resize handle mousedown
            const resizeHandle = instance.container.querySelector('.snap-column-resize-handle');
            if (!resizeHandle) throw new Error('Resize handle not found');
            resizeHandle.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: 50 }));
            // Simulate mouse movement
            document.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: 150 }));
            // Simulate mouse release
            document.dispatchEvent(new MouseEvent('mouseup'));
            // Verify column width is set
            expect(typeof instance.state.columnWidths.get('id')).toBe('number');
        });

        it('should persist resized column widths across a new instance', async () => {
            localStorage.clear();
            const first = new SnapRecords(containerId, {
                ...defaultOptions,
                persistState: true,
            });
            await jest.runAllTimersAsync();
            const resizeHandle = first.container.querySelector('.snap-column-resize-handle');
            if (!resizeHandle) throw new Error('Resize handle not found');
            resizeHandle.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: 50 }));
            document.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: 150 }));
            document.dispatchEvent(new MouseEvent('mouseup'));
            await jest.runAllTimersAsync();

            const savedWidth = first.state.columnWidths.get('id');
            expect(typeof savedWidth).toBe('number');
            first.destroy();

            document.body.innerHTML = `<div id="${containerId}"></div>`;
            const second = new SnapRecords(containerId, {
                ...defaultOptions,
                persistState: true,
            });
            await jest.runAllTimersAsync();
            expect(second.state.columnWidths.get('id')).toBe(savedWidth);
            const header = second.container.querySelector<HTMLElement>('th[data-col-id="id"]');
            expect(header?.style.width).toBe(`${savedWidth}px`);
            second.destroy();
            localStorage.clear();
        });

        // Test case for row selection
        it('should select and deselect a row on click when selectable is true', async () => {
            // Mock selection changed hook
            const selectionChangedMock = jest.fn();
            const instance = new SnapRecords(containerId, {
                ...defaultOptions,
                selectable: true,
                lifecycleHooks: { selectionChanged: selectionChangedMock },
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

        it('should not select a row when an action button inside it is clicked', async () => {
            const instance = new SnapRecords(containerId, {
                ...defaultOptions,
                selectable: true,
                columns: ['id', 'name', 'actions'],
                columnTitles: ['ID', 'Name', 'Action'],
                headerCellClasses: ['', '', 'no-sorting'],
                columnFormatters: {
                    actions: () => '<button type="button" class="row-action">Edit</button>',
                },
            });
            await jest.runAllTimersAsync();
            const action = instance.container.querySelector('.row-action');
            expect(action).not.toBeNull();
            (action as HTMLElement).dispatchEvent(new MouseEvent('click', { bubbles: true }));
            expect(instance.getApi().getSelectedRows()).toHaveLength(0);
        });

        it('should clear row selection when data is reloaded', async () => {
            const selectionChangedMock = jest.fn();
            const instance = new SnapRecords(containerId, {
                ...defaultOptions,
                selectable: true,
                lifecycleHooks: { selectionChanged: selectionChangedMock },
            });
            const api = instance.getApi();
            await jest.runAllTimersAsync();
            const row = instance.container.querySelector('tr[data-index="0"]') as HTMLElement;
            row.dispatchEvent(new MouseEvent('click', { bubbles: true }));
            expect(api.getSelectedRows()).toHaveLength(1);
            selectionChangedMock.mockClear();

            api.search({ name: 'query' });
            await jest.runAllTimersAsync();
            expect(api.getSelectedRows()).toHaveLength(0);
            expect(selectionChangedMock).toHaveBeenCalledWith([]);
        });

        // Test case for column drag-and-drop
        it('should handle column drag-and-drop', async () => {
            const instance = new SnapRecords(containerId, {
                ...defaultOptions,
                draggableColumns: true,
            });
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
            const instance = new SnapRecords(containerId, {
                ...defaultOptions,
                format: RenderType.LIST,
            });
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
                json: () =>
                    Promise.resolve({
                        data: new Array(20).fill({ id: 1, name: 'Test' }),
                        totalRecords: 20,
                    }),
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
            expect(lastFetchCall).toContain('currentPage=2');
        });

        it('should keep the last page reachable in pagination', async () => {
            (global.fetch as jest.Mock).mockResolvedValue({
                ok: true,
                json: () =>
                    Promise.resolve({
                        data: new Array(10).fill({ id: 1, name: 'Test' }),
                        totalRecords: 100,
                    }),
            });
            const instance = new SnapRecords(containerId, { ...defaultOptions, rowsPerPage: 10 });
            const api = instance.getApi();
            await jest.runAllTimersAsync();
            api.setCurrentPage(7);
            await jest.runAllTimersAsync();
            expect(instance.container.querySelector('button[data-page="10"]')).not.toBeNull();
            expect(instance.container.querySelector('button[data-page="1"]')).not.toBeNull();
        });

        it('should render pagination in the list footer after setFormat', async () => {
            const instance = new SnapRecords(containerId, defaultOptions);
            const api = instance.getApi();
            await jest.runAllTimersAsync();
            api.setFormat(RenderType.LIST);
            const listPagination = instance.container.querySelector(
                '.snap-footer .snap-pagination-container'
            );
            expect(listPagination).not.toBeNull();
        });

        it('should preserve existing query parameters on the API url', async () => {
            new SnapRecords(containerId, {
                ...defaultOptions,
                url: 'http://localhost/api/data?tenant=acme',
            });
            await jest.runAllTimersAsync();
            const lastCallUrl = new URL((global.fetch as jest.Mock).mock.calls[0][0]);
            expect(lastCallUrl.searchParams.get('tenant')).toBe('acme');
            expect(lastCallUrl.searchParams.get('currentPage')).toBe('1');
        });

        it('should merge snap query keys into the existing browser URL', async () => {
            (global.fetch as jest.Mock).mockImplementation(() =>
                Promise.resolve({
                    ok: true,
                    json: () =>
                        Promise.resolve({
                            data: [{ id: 1, name: 'Test User' }],
                            totalRecords: 20,
                        }),
                })
            );
            window.history.replaceState({}, '', '/app?host=keep');
            const instance = new SnapRecords(containerId, {
                ...defaultOptions,
                usePushState: true,
            });
            await jest.runAllTimersAsync();
            const params = new URLSearchParams(window.location.search);
            expect(params.get('host')).toBe('keep');
            expect(params.get('currentPage')).toBe('1');

            instance.getApi().setCurrentPage(2);
            await jest.runAllTimersAsync();
            const next = new URLSearchParams(window.location.search);
            expect(next.get('host')).toBe('keep');
            expect(next.get('currentPage')).toBe('2');
            instance.destroy();
            window.history.replaceState({}, '', '/');
        });

        it('should apply prevButton.template and data-page on pagination buttons', async () => {
            (global.fetch as jest.Mock).mockResolvedValue({
                ok: true,
                json: () =>
                    Promise.resolve({
                        data: new Array(20).fill({ id: 1, name: 'Test' }),
                        totalRecords: 20,
                    }),
            });
            const instance = new SnapRecords(containerId, {
                ...defaultOptions,
                rowsPerPage: 10,
                prevButton: {
                    isHtml: false,
                    template: (page) => `Back ${page}`,
                },
            });
            await jest.runAllTimersAsync();
            const prev = instance.container.querySelector('.snap-prev') as HTMLButtonElement;
            expect(prev.dataset.page).toBe('1');
            expect(prev.textContent).toBe('Back 1');
        });

        it('should ignore invalid theme values', async () => {
            const instance = new SnapRecords(containerId, defaultOptions);
            const api = instance.getApi();
            await jest.runAllTimersAsync();
            expect(instance.container.classList.contains('theme-default')).toBe(true);
            api.setTheme('neon' as any);
            expect(instance.container.classList.contains('theme-default')).toBe(true);
            expect(instance.container.classList.contains('theme-neon')).toBe(false);
        });

        it('should ignore invalid format values', async () => {
            const instance = new SnapRecords(containerId, defaultOptions);
            const api = instance.getApi();
            await jest.runAllTimersAsync();
            expect(instance.container.querySelector('table')).not.toBeNull();
            api.setFormat('grid' as any);
            expect(instance.container.querySelector('table')).not.toBeNull();
            expect(instance.container.querySelector('ul')).toBeNull();
        });

        it('should still render when a column formatter throws', async () => {
            const instance = new SnapRecords(containerId, {
                ...defaultOptions,
                columnFormatters: {
                    name: () => {
                        throw new Error('boom');
                    },
                },
            });
            await jest.runAllTimersAsync();
            expect(instance.container.querySelector('tbody')).not.toBeNull();
            expect(instance.container.textContent).toContain('Test User');
        });

        it('should strip unsafe data URLs from formatted HTML', async () => {
            const instance = new SnapRecords(containerId, {
                ...defaultOptions,
                columnFormatters: {
                    name: () => '<a href="data:image/svg+xml,<svg></svg>">x</a>',
                },
            });
            await jest.runAllTimersAsync();
            const link = instance.container.querySelector('td a');
            expect(link).not.toBeNull();
            expect(link?.getAttribute('href')).toBeNull();
            expect(link?.textContent).toBe('x');
        });

        it('should not mix formatted values across colliding id/column pairs', async () => {
            (global.fetch as jest.Mock).mockResolvedValue({
                ok: true,
                json: () =>
                    Promise.resolve({
                        totalRecords: 2,
                        data: [
                            { id: '1_name', x: 'from-row-one', name_x: 'keep-one' },
                            { id: '1', x: 'keep-two', name_x: 'from-row-two' },
                        ],
                    }),
            });
            const instance = new SnapRecords(containerId, {
                ...defaultOptions,
                columns: ['id', 'x', 'name_x'],
                columnTitles: ['ID', 'X', 'Name X'],
            });
            await jest.runAllTimersAsync();
            const cells = Array.from(instance.container.querySelectorAll('tbody td')).map(
                (cell) => cell.textContent
            );
            expect(cells).toContain('from-row-one');
            expect(cells).toContain('from-row-two');
            expect(cells).toContain('keep-one');
            expect(cells).toContain('keep-two');
        });

        it('should ignore invalid rowsPerPage values', async () => {
            const instance = new SnapRecords(containerId, {
                ...defaultOptions,
                rowsPerPage: 0 as any,
            });
            const api = instance.getApi();
            await jest.runAllTimersAsync();
            expect(instance.state.rowsPerPage).toBeGreaterThan(0);
            api.setRowsPerPage(0 as any);
            expect(instance.state.rowsPerPage).toBeGreaterThan(0);
        });

        it('should keep row selection visible after setFormat', async () => {
            const instance = new SnapRecords(containerId, {
                ...defaultOptions,
                selectable: true,
            });
            const api = instance.getApi();
            await jest.runAllTimersAsync();
            const row = instance.container.querySelector('tr[data-index="0"]') as HTMLElement;
            row.dispatchEvent(new MouseEvent('click', { bubbles: true }));
            expect(api.getSelectedRows()).toHaveLength(1);
            api.setFormat(RenderType.LIST);
            const listItem = instance.container.querySelector('li[data-index="0"]');
            expect(listItem?.classList.contains('snap-selected')).toBe(true);
            expect(api.getSelectedRows()).toHaveLength(1);
        });

        it('should treat omitted totalRecords as the received row count', async () => {
            (global.fetch as jest.Mock).mockResolvedValue({
                ok: true,
                json: () =>
                    Promise.resolve({
                        data: [
                            { id: 1, name: 'A' },
                            { id: 2, name: 'B' },
                        ],
                    }),
            });
            const instance = new SnapRecords(containerId, defaultOptions);
            await jest.runAllTimersAsync();
            expect(instance.getApi().getTotals().totalRecords).toBe(2);
            expect(instance.container.textContent).toContain('of 2 records');
            expect(instance.container.textContent).not.toContain('No data available.');
        });

        it('should give prev and next buttons an accessible name', async () => {
            const instance = new SnapRecords(containerId, defaultOptions);
            await jest.runAllTimersAsync();
            const prev = instance.container.querySelector('.snap-prev') as HTMLButtonElement;
            const next = instance.container.querySelector('.snap-next') as HTMLButtonElement;
            expect(prev.getAttribute('aria-label')).toBe('Previous');
            expect(next.getAttribute('aria-label')).toBe('Next');
        });

        it('should still render when preDataLoad throws', async () => {
            const instance = new SnapRecords(containerId, {
                ...defaultOptions,
                lifecycleHooks: {
                    preDataLoad: () => {
                        throw new Error('hook boom');
                    },
                },
            });
            await jest.runAllTimersAsync();
            expect(instance.container.querySelector('tbody')).not.toBeNull();
            expect(instance.container.querySelector('.snap-records-error')?.innerHTML).toBe('');
            expect(instance.getApi().getData()).toHaveLength(1);
        });

        it('should not retry invalid JSON responses', async () => {
            (global.fetch as jest.Mock).mockResolvedValue({
                ok: true,
                status: 200,
                json: () => Promise.reject(new SyntaxError('Unexpected token')),
            });
            const instance = new SnapRecords(containerId, {
                ...defaultOptions,
                retryAttempts: 3,
            });
            await jest.runAllTimersAsync();
            expect((global.fetch as jest.Mock).mock.calls.length).toBe(1);
            expect(instance.container.querySelector('.snap-retry-button')).not.toBeNull();
        });

        it('should expose isDestroyed on the public API', async () => {
            const instance = new SnapRecords(containerId, defaultOptions);
            const api = instance.getApi();
            expect(api.isDestroyed).toBe(false);
            api.destroy();
            expect(api.isDestroyed).toBe(true);
        });

        it('should display literal < and & in cells without a formatter', async () => {
            (global.fetch as jest.Mock).mockResolvedValue({
                ok: true,
                json: () =>
                    Promise.resolve({
                        data: [{ id: 1, name: 'Tom & Jerry <3' }],
                        totalRecords: 1,
                    }),
            });
            const instance = new SnapRecords(containerId, defaultOptions);
            await jest.runAllTimersAsync();
            const cells = Array.from(instance.container.querySelectorAll('tbody td')).map(
                (cell) => cell.textContent
            );
            expect(cells).toContain('Tom & Jerry <3');
        });

        it('should not reload when filter key order differs', async () => {
            const instance = new SnapRecords(containerId, {
                ...defaultOptions,
                filtering: { name: 'a', status: 'ok' },
            });
            const api = instance.getApi();
            await jest.runAllTimersAsync();
            const calls = (global.fetch as jest.Mock).mock.calls.length;
            api.search({ status: 'ok', name: 'a' });
            await jest.runAllTimersAsync();
            expect((global.fetch as jest.Mock).mock.calls.length).toBe(calls);
        });

        it('should add loading=lazy only when the image has none', async () => {
            const instance = new SnapRecords(containerId, {
                ...defaultOptions,
                lazyLoadMedia: true,
                columnFormatters: {
                    name: () => '<img src="a.png"><img loading="eager" src="b.png">',
                },
            });
            await jest.runAllTimersAsync();
            const images = instance.container.querySelectorAll('tbody img');
            expect(images).toHaveLength(2);
            expect(images[0].getAttribute('loading')).toBe('lazy');
            expect(images[1].getAttribute('loading')).toBe('eager');
        });

        it('should expose sort and resize labels from translations', async () => {
            const instance = new SnapRecords(containerId, {
                ...defaultOptions,
                draggableColumns: true,
            });
            await jest.runAllTimersAsync();
            const sortLink = instance.container.querySelector('th[data-col-id="name"] button');
            expect(sortLink?.getAttribute('aria-label')).toBe('Name: Sort ascending');
            const handle = instance.container.querySelector('.snap-column-resize-handle');
            expect(handle?.getAttribute('aria-label')).toBe('Resize column');
            const header = instance.container.querySelector('th[data-col-id="name"]');
            expect(header?.getAttribute('title')).toBe('Drag column Name');
        });

        it('should sanitize language codes used in state', async () => {
            const instance = new SnapRecords(containerId, {
                ...defaultOptions,
                language: '../en_US',
            });
            await jest.runAllTimersAsync();
            expect(instance.state.language).toBe('en_US');
            await instance.getApi().setLanguage('pt_PT!');
            expect(instance.state.language).toBe('pt_PT');
        });

        it('should preserve filtering when the URL only changes currentPage', async () => {
            window.history.replaceState({}, '', '/?currentPage=2');
            localStorage.clear();
            localStorage.setItem(
                `snap-records-state-${containerId}`,
                JSON.stringify({ filtering: { name: 'saved' }, currentPage: 1 })
            );
            (global.fetch as jest.Mock).mockResolvedValue({
                ok: true,
                json: () =>
                    Promise.resolve({
                        data: [{ id: 1, name: 'Test User' }],
                        totalRecords: 50,
                    }),
            });
            const instance = new SnapRecords(containerId, {
                ...defaultOptions,
                usePushState: true,
                persistState: true,
                filtering: { name: 'initial' },
            });
            await jest.runAllTimersAsync();
            expect(instance.state.filtering).toEqual({ name: 'saved' });
            expect(instance.state.currentPage).toBe(2);
            instance.destroy();
            localStorage.clear();
            window.history.replaceState({}, '', '/');
        });

        it('should preserve sorting when the URL only changes currentPage', async () => {
            window.history.replaceState({}, '', '/?currentPage=3');
            (global.fetch as jest.Mock).mockResolvedValue({
                ok: true,
                json: () =>
                    Promise.resolve({
                        data: [{ id: 1, name: 'Test User' }],
                        totalRecords: 50,
                    }),
            });
            const instance = new SnapRecords(containerId, {
                ...defaultOptions,
                usePushState: true,
                sorting: [['name', 'ASC' as any]],
            });
            await jest.runAllTimersAsync();
            expect(instance.state.sorting).toEqual([['name', 'ASC']]);
            expect(instance.state.currentPage).toBe(3);
            instance.destroy();
            window.history.replaceState({}, '', '/');
        });

        it('should preserve currentPage when the URL only changes sorting', async () => {
            window.history.replaceState({}, '', '/');
            (global.fetch as jest.Mock).mockResolvedValue({
                ok: true,
                json: () =>
                    Promise.resolve({
                        data: [{ id: 1, name: 'Test User' }],
                        totalRecords: 50,
                    }),
            });
            const instance = new SnapRecords(containerId, {
                ...defaultOptions,
                usePushState: true,
            });
            await jest.runAllTimersAsync();
            instance.getApi().setCurrentPage(3);
            await jest.runAllTimersAsync();
            expect(instance.state.currentPage).toBe(3);

            window.history.replaceState({}, '', '/?sorting[name]=DESC');
            window.dispatchEvent(new PopStateEvent('popstate'));
            expect(instance.state.sorting).toEqual([['name', 'DESC']]);
            expect(instance.state.currentPage).toBe(3);
            instance.destroy();
            window.history.replaceState({}, '', '/');
        });

        it('should preserve rowsPerPage when the URL only changes sorting', async () => {
            window.history.replaceState({}, '', '/');
            (global.fetch as jest.Mock).mockResolvedValue({
                ok: true,
                json: () =>
                    Promise.resolve({
                        data: [{ id: 1, name: 'Test User' }],
                        totalRecords: 50,
                    }),
            });
            const instance = new SnapRecords(containerId, {
                ...defaultOptions,
                usePushState: true,
                rowsPerPage: 50,
            });
            await jest.runAllTimersAsync();
            expect(instance.state.rowsPerPage).toBe(50);

            window.history.replaceState({}, '', '/?sorting[name]=DESC');
            window.dispatchEvent(new PopStateEvent('popstate'));
            expect(instance.state.sorting).toEqual([['name', 'DESC']]);
            expect(instance.state.rowsPerPage).toBe(50);
            instance.destroy();
            window.history.replaceState({}, '', '/');
        });

        it('should preserve currentPage when the URL only changes rowsPerPage', async () => {
            window.history.replaceState({}, '', '/');
            (global.fetch as jest.Mock).mockResolvedValue({
                ok: true,
                json: () =>
                    Promise.resolve({
                        data: [{ id: 1, name: 'Test User' }],
                        totalRecords: 50,
                    }),
            });
            const instance = new SnapRecords(containerId, {
                ...defaultOptions,
                usePushState: true,
            });
            await jest.runAllTimersAsync();
            instance.getApi().setCurrentPage(3);
            await jest.runAllTimersAsync();
            expect(instance.state.currentPage).toBe(3);

            window.history.replaceState({}, '', '/?rowsPerPage=50');
            window.dispatchEvent(new PopStateEvent('popstate'));
            expect(instance.state.rowsPerPage).toBe(50);
            expect(instance.state.currentPage).toBe(3);
            instance.destroy();
            window.history.replaceState({}, '', '/');
        });

        it('should clear filtering when the URL includes an empty filtering value', async () => {
            window.history.replaceState({}, '', '/?filtering[name]=');
            const instance = new SnapRecords(containerId, {
                ...defaultOptions,
                usePushState: true,
                filtering: { name: 'kept' },
            });
            await jest.runAllTimersAsync();
            expect(instance.state.filtering).toEqual({});
            instance.destroy();
            window.history.replaceState({}, '', '/');
        });

        it('should restore empty sorting on popstate when the URL has no sorting keys', async () => {
            window.history.replaceState({}, '', '/');
            const instance = new SnapRecords(containerId, {
                ...defaultOptions,
                usePushState: true,
            });
            await jest.runAllTimersAsync();
            instance.getApi().updateParams({ sorting: [['name', 'DESC' as any]] });
            await jest.runAllTimersAsync();
            expect(instance.state.sorting).toEqual([['name', 'DESC']]);

            window.history.replaceState({}, '', '/?currentPage=1&rowsPerPage=10&offset=0');
            window.dispatchEvent(new PopStateEvent('popstate'));
            expect(instance.state.sorting).toEqual([]);
            instance.destroy();
            window.history.replaceState({}, '', '/');
        });

        it('should restore empty filtering on popstate when the URL has no filtering keys', async () => {
            window.history.replaceState({}, '', '/');
            const instance = new SnapRecords(containerId, {
                ...defaultOptions,
                usePushState: true,
            });
            await jest.runAllTimersAsync();
            instance.getApi().search({ name: 'test' });
            await jest.runAllTimersAsync();
            expect(instance.state.filtering).toEqual({ name: 'test' });

            window.history.replaceState({}, '', '/?currentPage=1&rowsPerPage=10&offset=0');
            window.dispatchEvent(new PopStateEvent('popstate'));
            expect(instance.state.filtering).toEqual({});
            instance.destroy();
            window.history.replaceState({}, '', '/');
        });

        it('should recover the loading overlay when isLoading was stale', async () => {
            const instance = new SnapRecords(containerId, defaultOptions);
            await jest.runAllTimersAsync();
            instance.isLoading = true;
            expect(instance.container.querySelector('.snap-loading-overlay')).toBeNull();
            (global.fetch as jest.Mock).mockImplementation(() => new Promise(() => {}));
            instance.getApi().refresh();
            await jest.advanceTimersByTimeAsync(250);
            expect(instance.container.querySelector('.snap-loading-overlay')).not.toBeNull();
            instance.destroy();
        });

        it('should not treat an offset-only URL as snap state', async () => {
            window.history.replaceState({}, '', '/app?offset=10');
            const instance = new SnapRecords(containerId, {
                ...defaultOptions,
                usePushState: true,
                filtering: { name: 'kept' },
            });
            await jest.runAllTimersAsync();
            expect(instance.state.filtering).toEqual({ name: 'kept' });
            expect(instance.state.currentPage).toBe(1);
            instance.destroy();
            window.history.replaceState({}, '', '/');
        });

        it('should wrap the table in snap-table-responsive', async () => {
            const instance = new SnapRecords(containerId, defaultOptions);
            await jest.runAllTimersAsync();
            expect(instance.container.querySelector('.snap-table-responsive')).not.toBeNull();
            expect(instance.container.querySelector('.table-responsive')).toBeNull();
        });

        it('should mark the container as selectable only when enabled', async () => {
            const plain = new SnapRecords(containerId, defaultOptions);
            await jest.runAllTimersAsync();
            expect(plain.container.classList.contains('snap-selectable')).toBe(false);
            plain.destroy();

            document.body.innerHTML = `<div id="${containerId}"></div>`;
            const selectable = new SnapRecords(containerId, {
                ...defaultOptions,
                selectable: true,
            });
            await jest.runAllTimersAsync();
            expect(selectable.container.classList.contains('snap-selectable')).toBe(true);
            selectable.destroy();
        });

        it('should normalize lowercase sort directions to ASC/DESC', async () => {
            const instance = new SnapRecords(containerId, {
                ...defaultOptions,
                sorting: [['name', 'asc' as any]],
            });
            await jest.runAllTimersAsync();
            const firstUrl = new URL((global.fetch as jest.Mock).mock.calls[0][0]);
            expect(firstUrl.searchParams.get('sorting[name]')).toBe('ASC');
            expect(instance.state.sorting).toEqual([['name', 'ASC']]);

            instance.getApi().updateParams({ sorting: [['name', 'desc' as any]] });
            await jest.runAllTimersAsync();
            const lastUrl = new URL(
                (global.fetch as jest.Mock).mock.calls[
                    (global.fetch as jest.Mock).mock.calls.length - 1
                ][0]
            );
            expect(lastUrl.searchParams.get('sorting[name]')).toBe('DESC');
        });

        it('should set aria-selected only on table rows', async () => {
            const instance = new SnapRecords(containerId, {
                ...defaultOptions,
                selectable: true,
            });
            const api = instance.getApi();
            await jest.runAllTimersAsync();
            const row = instance.container.querySelector('tr[data-index="0"]') as HTMLElement;
            row.dispatchEvent(new MouseEvent('click', { bubbles: true }));
            expect(row.getAttribute('aria-selected')).toBe('true');

            api.setFormat(RenderType.LIST);
            const item = instance.container.querySelector('li[data-index="0"]') as HTMLElement;
            expect(item.classList.contains('snap-selected')).toBe(true);
            expect(item.hasAttribute('aria-selected')).toBe(false);
        });

        it('should sort from a header button without a hash link', async () => {
            const instance = new SnapRecords(containerId, defaultOptions);
            await jest.runAllTimersAsync();
            const sortButton = instance.container.querySelector(
                'th[data-col-id="name"] button'
            ) as HTMLButtonElement;
            expect(sortButton).not.toBeNull();
            expect(sortButton.type).toBe('button');
            expect(instance.container.querySelector('th a')).toBeNull();
            sortButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
            await jest.runAllTimersAsync();
            const lastCallUrl = new URL(
                (global.fetch as jest.Mock).mock.calls[
                    (global.fetch as jest.Mock).mock.calls.length - 1
                ][0]
            );
            expect(lastCallUrl.searchParams.get('sorting[name]')).toBe('ASC');
        });

        it('should strip javascript URLs that use whitespace', async () => {
            const instance = new SnapRecords(containerId, {
                ...defaultOptions,
                columnFormatters: {
                    name: () => '<a href="java\tscript:alert(1)">x</a>',
                },
            });
            await jest.runAllTimersAsync();
            const link = instance.container.querySelector('td a');
            expect(link).not.toBeNull();
            expect(link?.getAttribute('href')).toBeNull();
        });

        it('should treat pagination translation markup as text', async () => {
            mockTranslationGet.mockResolvedValueOnce({
                ...(en_US as unknown as Translation),
                pagination: {
                    showingRecords: '{start}<img src="x" onerror="alert(1)">{end} of {total}',
                },
            });
            const instance = new SnapRecords(containerId, defaultOptions);
            await jest.runAllTimersAsync();
            const totals = instance.container.querySelector('.snap-totals');
            expect(totals?.querySelector('img')).toBeNull();
            expect(totals?.querySelector('.snap-record-start')?.textContent).toBe('1');
            expect(totals?.textContent).toContain('<img');
            mockTranslationGet.mockResolvedValue(en_US as unknown as Translation);
        });

        it('should truncate persisted currentPage to an integer', async () => {
            localStorage.clear();
            localStorage.setItem(
                `snap-records-state-${containerId}`,
                JSON.stringify({ currentPage: 2.7 })
            );
            (global.fetch as jest.Mock).mockResolvedValue({
                ok: true,
                json: () =>
                    Promise.resolve({
                        data: [{ id: 1, name: 'Test User' }],
                        totalRecords: 100,
                    }),
            });
            const instance = new SnapRecords(containerId, {
                ...defaultOptions,
                persistState: true,
            });
            await jest.runAllTimersAsync();
            expect(instance.state.currentPage).toBe(2);
            instance.destroy();
            localStorage.clear();
        });

        it('should keep constructor sorting normalized after an empty popstate', async () => {
            window.history.replaceState({}, '', '/');
            const instance = new SnapRecords(containerId, {
                ...defaultOptions,
                usePushState: true,
                sorting: [
                    ['name', 'ASC'],
                    ['id', 'NOPE' as any],
                ],
            });
            await jest.runAllTimersAsync();
            expect(instance.state.sorting).toEqual([['name', 'ASC']]);

            window.history.replaceState({}, '', '/');
            window.dispatchEvent(new PopStateEvent('popstate'));
            await jest.runAllTimersAsync();
            expect(instance.state.sorting).toEqual([['name', 'ASC']]);
            instance.destroy();
            window.history.replaceState({}, '', '/');
        });

        it('should flush pending persistState writes on destroy', async () => {
            localStorage.clear();
            const instance = new SnapRecords(containerId, {
                ...defaultOptions,
                persistState: true,
            });
            await jest.runAllTimersAsync();
            const resizeHandle = instance.container.querySelector('.snap-column-resize-handle');
            if (!resizeHandle) throw new Error('Resize handle not found');
            resizeHandle.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: 50 }));
            document.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: 150 }));
            document.dispatchEvent(new MouseEvent('mouseup'));
            const savedWidth = instance.state.columnWidths.get('id');
            expect(typeof savedWidth).toBe('number');
            instance.destroy();
            const saved = JSON.parse(localStorage.getItem(`snap-records-state-${containerId}`)!);
            expect(saved.columnWidths).toEqual([['id', savedWidth]]);
            localStorage.clear();
        });

        it('should keep only the last sort direction per column', async () => {
            const instance = new SnapRecords(containerId, defaultOptions);
            await jest.runAllTimersAsync();
            instance.getApi().updateParams({
                sorting: [
                    ['name', 'ASC' as any],
                    ['name', 'DESC' as any],
                ],
            });
            await jest.runAllTimersAsync();
            expect(instance.state.sorting).toEqual([['name', 'DESC']]);
            const lastUrl = new URL(
                (global.fetch as jest.Mock).mock.calls[
                    (global.fetch as jest.Mock).mock.calls.length - 1
                ][0]
            );
            expect(lastUrl.searchParams.getAll('sorting[name]')).toEqual(['DESC']);
        });

        it('should remove focus and theme classes from the container on destroy', async () => {
            const instance = new SnapRecords(containerId, {
                ...defaultOptions,
                theme: 'dark',
            });
            await jest.runAllTimersAsync();
            expect(instance.container.classList.contains('theme-dark')).toBe(true);
            expect(instance.container.getAttribute('tabindex')).toBe('0');
            instance.destroy();
            expect(instance.container.classList.contains('theme-dark')).toBe(false);
            expect(instance.container.classList.contains('snap-records-container')).toBe(false);
            expect(instance.container.hasAttribute('tabindex')).toBe(false);
        });

        it('should ignore invalid persisted column widths', async () => {
            localStorage.clear();
            localStorage.setItem(
                `snap-records-state-${containerId}`,
                JSON.stringify({
                    columnWidths: [
                        ['id', -5],
                        ['name', 'wide'],
                    ],
                })
            );
            const instance = new SnapRecords(containerId, {
                ...defaultOptions,
                persistState: true,
            });
            await jest.runAllTimersAsync();
            expect(instance.state.columnWidths.size).toBe(0);
            const header = instance.container.querySelector<HTMLElement>('th[data-col-id="id"]');
            expect(header?.style.width).toBe('');
            instance.destroy();
            localStorage.clear();
        });

        it('should ignore corrupted array filtering in localStorage', async () => {
            localStorage.clear();
            localStorage.setItem(
                `snap-records-state-${containerId}`,
                JSON.stringify({ filtering: ['oops'] })
            );
            const instance = new SnapRecords(containerId, {
                ...defaultOptions,
                persistState: true,
                filtering: { name: 'kept' },
            });
            await jest.runAllTimersAsync();
            expect(instance.state.filtering).toEqual({ name: 'kept' });
            instance.destroy();
            localStorage.clear();
        });

        it('should restore headerCellClasses from localStorage after column reorder', async () => {
            localStorage.clear();
            localStorage.setItem(
                `snap-records-state-${containerId}`,
                JSON.stringify({
                    columns: ['name', 'id'],
                    headerCellClasses: ['no-sorting', 'text-center'],
                })
            );
            const instance = new SnapRecords(containerId, {
                ...defaultOptions,
                persistState: true,
                headerCellClasses: ['text-center', 'no-sorting'],
            });
            await jest.runAllTimersAsync();
            const nameHeader = instance.container.querySelector('th[data-col-id="name"]');
            const idHeader = instance.container.querySelector('th[data-col-id="id"]');
            expect(nameHeader?.className).toContain('no-sorting');
            expect(nameHeader?.querySelector('button')).toBeNull();
            expect(idHeader?.className).toContain('text-center');
            instance.destroy();
            localStorage.clear();
        });

        it('should refresh sort headers on popstate before data returns', async () => {
            window.history.replaceState({}, '', '/');
            const instance = new SnapRecords(containerId, {
                ...defaultOptions,
                usePushState: true,
                sorting: [['name', 'ASC' as any]],
            });
            await jest.runAllTimersAsync();
            expect(
                instance.container
                    .querySelector('th[data-col-id="name"] button')
                    ?.classList.contains('snap-asc-order')
            ).toBe(true);

            window.history.replaceState({}, '', '/?sorting[name]=DESC');
            window.dispatchEvent(new PopStateEvent('popstate'));
            expect(instance.state.sorting).toEqual([['name', 'DESC']]);
            expect(
                instance.container
                    .querySelector('th[data-col-id="name"] button')
                    ?.classList.contains('snap-desc-order')
            ).toBe(true);
            instance.destroy();
            window.history.replaceState({}, '', '/');
        });

        it('should keep the loading overlay when render runs during a fetch', async () => {
            window.history.replaceState({}, '', '/');
            const instance = new SnapRecords(containerId, {
                ...defaultOptions,
                usePushState: true,
            });
            await jest.runAllTimersAsync();
            (global.fetch as jest.Mock).mockImplementation(() => new Promise(() => {}));
            instance.getApi().refresh();
            await jest.advanceTimersByTimeAsync(250);
            expect(instance.container.querySelector('.snap-loading-overlay')).not.toBeNull();

            window.history.replaceState({}, '', '/?sorting[name]=DESC');
            window.dispatchEvent(new PopStateEvent('popstate'));
            expect(instance.container.querySelector('.snap-loading-overlay')).not.toBeNull();
            instance.destroy();
            window.history.replaceState({}, '', '/');
        });

        it('should treat invalid search filtering as empty', async () => {
            const instance = new SnapRecords(containerId, {
                ...defaultOptions,
                filtering: { name: 'kept' },
            });
            const api = instance.getApi();
            await jest.runAllTimersAsync();
            expect(() => api.search(null as any)).not.toThrow();
            await jest.runAllTimersAsync();
            expect(instance.state.filtering).toEqual({});
        });

        it('should restore host position that SnapRecords set', async () => {
            const instance = new SnapRecords(containerId, defaultOptions);
            await jest.runAllTimersAsync();
            expect(instance.container.style.position).toBe('relative');
            instance.destroy();
            expect(instance.container.style.position).toBe('');
        });
    });

    describe('Edge cases', () => {
        it('should treat totalRecords 0 as the row count when rows are returned', async () => {
            (global.fetch as jest.Mock).mockResolvedValue({
                ok: true,
                json: () =>
                    Promise.resolve({
                        data: [{ id: 1, name: 'A' }],
                        totalRecords: 0,
                    }),
            });
            const instance = new SnapRecords(containerId, defaultOptions);
            await jest.runAllTimersAsync();
            expect(instance.getApi().getTotals().totalRecords).toBe(1);
            expect(instance.container.textContent).toContain('of 1 records');
            expect(instance.container.textContent).not.toContain('No data available.');
            instance.destroy();
        });

        it('should reset currentPage to 1 when the dataset becomes empty', async () => {
            let call = 0;
            (global.fetch as jest.Mock).mockImplementation(() => {
                call += 1;
                return Promise.resolve({
                    ok: true,
                    json: () =>
                        Promise.resolve(
                            call === 1
                                ? {
                                      data: [{ id: 1, name: 'A' }],
                                      totalRecords: 30,
                                  }
                                : { data: [], totalRecords: 0 }
                        ),
                });
            });
            const instance = new SnapRecords(containerId, { ...defaultOptions, rowsPerPage: 10 });
            await jest.runAllTimersAsync();
            instance.getApi().setCurrentPage(3);
            await jest.runAllTimersAsync();
            expect(instance.state.currentPage).toBe(1);
            instance.destroy();
        });

        it('should restore persisted filtering on popstate when the URL has no snap params', async () => {
            window.history.replaceState({}, '', '/');
            localStorage.setItem(
                `snap-records-state-${containerId}`,
                JSON.stringify({
                    columns: ['id', 'name'],
                    columnWidths: [],
                    sorting: [],
                    filtering: { name: 'saved' },
                    currentPage: 1,
                    rowsPerPage: 10,
                    headerCellClasses: [],
                })
            );
            const instance = new SnapRecords(containerId, {
                ...defaultOptions,
                usePushState: true,
                persistState: true,
            });
            await jest.runAllTimersAsync();
            expect(instance.state.filtering).toEqual({ name: 'saved' });

            instance.getApi().search({ name: 'live' });
            await jest.runAllTimersAsync();
            expect(instance.state.filtering).toEqual({ name: 'live' });

            localStorage.setItem(
                `snap-records-state-${containerId}`,
                JSON.stringify({
                    columns: ['id', 'name'],
                    columnWidths: [],
                    sorting: [],
                    filtering: { name: 'saved' },
                    currentPage: 1,
                    rowsPerPage: 10,
                    headerCellClasses: [],
                })
            );

            window.history.replaceState({}, '', '/');
            window.dispatchEvent(new PopStateEvent('popstate'));
            await jest.runAllTimersAsync();
            expect(instance.state.filtering).toEqual({ name: 'saved' });
            instance.destroy();
            localStorage.removeItem(`snap-records-state-${containerId}`);
            window.history.replaceState({}, '', '/');
        });

        it('should render rows with duplicate ids on the same page', async () => {
            (global.fetch as jest.Mock).mockResolvedValue({
                ok: true,
                json: () =>
                    Promise.resolve({
                        data: [
                            { id: 1, name: 'First' },
                            { id: 1, name: 'Second' },
                        ],
                        totalRecords: 2,
                    }),
            });
            const instance = new SnapRecords(containerId, defaultOptions);
            await jest.runAllTimersAsync();
            const rows = instance.container.querySelectorAll('tbody tr[data-key]');
            expect(rows).toHaveLength(2);
            expect(rows[0]?.textContent).toContain('First');
            expect(rows[1]?.textContent).toContain('Second');
            instance.destroy();
        });

        it('should not bind handlers after destroy during loadData', async () => {
            (global.fetch as jest.Mock).mockImplementation(
                () =>
                    new Promise((resolve) => {
                        setTimeout(
                            () =>
                                resolve({
                                    ok: true,
                                    json: () =>
                                        Promise.resolve({
                                            data: [{ id: 1, name: 'Late' }],
                                            totalRecords: 1,
                                        }),
                                }),
                            100
                        );
                    })
            );
            const instance = new SnapRecords(containerId, defaultOptions);
            await jest.advanceTimersByTimeAsync(250);
            const setupSpy = jest.spyOn(instance.eventManager, 'setupAllHandlers');
            instance.destroy();
            await jest.advanceTimersByTimeAsync(200);
            expect(setupSpy).not.toHaveBeenCalled();
        });
    });

    describe('Caching', () => {
        beforeEach(() => {
            jest.useRealTimers();
        });

        afterEach(() => {
            jest.useFakeTimers();
        });

        const mountCacheContainer = (id: string): string => {
            document.body.innerHTML = `<div id="${id}"></div>`;
            return id;
        };

        const flushDataLoad = async (): Promise<void> => {
            await new Promise((resolve) => setTimeout(resolve, 300));
            for (let i = 0; i < 30; i++) {
                await Promise.resolve();
            }
            await new Promise((resolve) => setTimeout(resolve, 50));
        };

        it('should serve a repeated load from IndexedDB without a second fetch', async () => {
            const id = mountCacheContainer('cache-repeat');
            (global.fetch as jest.Mock).mockResolvedValue({
                ok: true,
                json: () =>
                    Promise.resolve({
                        data: [{ id: 1, name: 'Cached User' }],
                        totalRecords: 1,
                    }),
            });
            const instance = new SnapRecords(id, { ...defaultOptions, useCache: true });
            await flushDataLoad();
            expect(global.fetch).toHaveBeenCalledTimes(1);
            expect(instance.state.data).toHaveLength(1);
            await instance.db.open();
            const cachedEntries = await instance.db.cache.toArray();
            expect(cachedEntries).toHaveLength(1);
            expect(cachedEntries[0]?.url).toBe((global.fetch as jest.Mock).mock.calls[0][0]);

            instance.getApi().refresh();
            await flushDataLoad();
            expect(global.fetch).toHaveBeenCalledTimes(1);
            expect(instance.state.data[0]?.name).toBe('Cached User');
            instance.destroy();
        });

        it('should invoke preDataLoad when serving cached data', async () => {
            const id = mountCacheContainer('cache-lifecycle');
            const preDataLoad = jest.fn();
            (global.fetch as jest.Mock).mockResolvedValue({
                ok: true,
                json: () =>
                    Promise.resolve({
                        data: [{ id: 1, name: 'Cached User' }],
                        totalRecords: 1,
                    }),
            });
            const instance = new SnapRecords(id, {
                ...defaultOptions,
                useCache: true,
                lifecycleHooks: { preDataLoad },
            });
            await flushDataLoad();
            expect(preDataLoad).toHaveBeenCalledTimes(1);
            preDataLoad.mockClear();

            instance.getApi().refresh();
            await flushDataLoad();
            expect(preDataLoad).toHaveBeenCalledTimes(1);
            expect(global.fetch).toHaveBeenCalledTimes(1);
            instance.destroy();
        });

        it('should refetch after a filtering change clears the cache', async () => {
            const id = mountCacheContainer('cache-filter');
            let call = 0;
            (global.fetch as jest.Mock).mockImplementation(() => {
                call += 1;
                return Promise.resolve({
                    ok: true,
                    json: () =>
                        Promise.resolve({
                            data: [{ id: 1, name: call === 1 ? 'First' : 'Filtered' }],
                            totalRecords: 1,
                        }),
                });
            });
            const instance = new SnapRecords(id, { ...defaultOptions, useCache: true });
            await flushDataLoad();
            expect(global.fetch).toHaveBeenCalledTimes(1);
            expect(instance.state.data[0]?.name).toBe('First');

            instance.getApi().search({ name: 'query' });
            await flushDataLoad();
            expect(global.fetch).toHaveBeenCalledTimes(2);
            expect(instance.state.data[0]?.name).toBe('Filtered');
            instance.destroy();
        });

        it('should not preload the next page when useCache is disabled', async () => {
            const id = mountCacheContainer('cache-no-preload');
            (global.fetch as jest.Mock).mockResolvedValue({
                ok: true,
                json: () =>
                    Promise.resolve({
                        data: new Array(10).fill({ id: 1, name: 'Test User' }),
                        totalRecords: 20,
                    }),
            });
            const instance = new SnapRecords(id, {
                ...defaultOptions,
                useCache: false,
                preloadNextPage: true,
                rowsPerPage: 10,
            });
            await flushDataLoad();
            expect(global.fetch).toHaveBeenCalledTimes(1);
            instance.destroy();
        });

        it('should preload the next page when useCache is enabled', async () => {
            const id = mountCacheContainer('cache-preload');
            (global.fetch as jest.Mock).mockResolvedValue({
                ok: true,
                json: () =>
                    Promise.resolve({
                        data: new Array(10).fill({ id: 1, name: 'Test User' }),
                        totalRecords: 20,
                    }),
            });
            const instance = new SnapRecords(id, {
                ...defaultOptions,
                useCache: true,
                preloadNextPage: true,
                rowsPerPage: 10,
            });
            await flushDataLoad();
            expect(global.fetch).toHaveBeenCalledTimes(2);
            const preloadUrl = (global.fetch as jest.Mock).mock.calls[1][0] as string;
            expect(preloadUrl).toContain('currentPage=2');
            instance.destroy();
        });
    });
});
