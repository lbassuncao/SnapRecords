import {
    LogLevel,
    Identifiable,
    SortCondition,
    ISnapRenderer,
    OrderDirection,
    ISnapEventManager,
    EventManagerCallbacks,
} from './SnapTypes.js';
import { config } from './SnapOptions.js';
import type { SnapRecords } from './SnapRecords.js';
import defaultTranslations from './lang/en_US.json';
import { escapeAttributeValue } from './utils.js';

/*========================================================================================================

    EVENT MANAGER

    Class responsible for managing user interaction events such as clicks, key presses, and drag-and-drop

    @template T - The type of data record, extending Identifiable and a generic object.

    The `EventManager` class centralizes all event handling logic for the SnapRecords table UI, including:
    - Delegated click handling for sorting, pagination, and row selection.
    - Keyboard navigation and accessibility support.
    - Column resizing and drag-and-drop reordering.
    - State synchronization and UI updates in response to user actions.

    It interacts with the parent SnapRecords instance, the renderer, and callback hooks to ensure
    a responsive and accessible user experience.

==========================================================================================================*/

export class EventManager<
    T extends Identifiable & Record<string, unknown>,
> implements ISnapEventManager {
    // Reference to the parent SnapRecords instance
    #parent: SnapRecords<T>;
    // Renderer instance for updating the UI
    #renderer: ISnapRenderer;
    // Callbacks for handling column reordering and data loading
    #callbacks: EventManagerCallbacks;
    // ID of the column being resized, or null if none
    #resizingColumnId: string | null = null;
    // Starting X position for column resizing
    #startX: number = 0;
    // Starting width of the column being resized
    #startWidth: number = 0;

    // Constructor initializes the event manager with parent, renderer, and callbacks
    constructor(
        parent: SnapRecords<T>,
        renderer: ISnapRenderer,
        callbacks: EventManagerCallbacks
    ) {
        this.#parent = parent;
        this.#renderer = renderer;
        this.#callbacks = callbacks;
    }

    // Sets up all event handlers for user interactions
    public setupAllHandlers(): void {
        if (this.#parent.isDestroyed) return;
        this.#setupDelegatedClickHandler();
        this.#setupColumnResizing();
        this.#setupColumnDragging();
        this.#setupKeyboardNavigation();
    }

    // Removes all event listeners and cleans up
    public destroy(): void {
        this.#parent.log(LogLevel.INFO, 'Destroying EventManager and removing all listeners.');
        this.#parent.container.removeEventListener('click', this.#handleDelegatedClick);
        this.#parent.container.removeEventListener('keydown', this.#handleKeyDown);
        this.#parent.container.removeEventListener('mousedown', this.#handleResizeMouseDown);
        this.#parent.container.removeEventListener('dragstart', this.#handleDragStart);
        this.#parent.container.removeEventListener('dragover', this.#handleDragOver);
        this.#parent.container.removeEventListener('drop', this.#handleDrop);
        this.#parent.container.removeEventListener('dragend', this.#handleDragEnd);
        document.removeEventListener('mouseup', this.#stopResize);
        document.removeEventListener('mousemove', this.#handleResize);
        this.#parent.container.removeAttribute('tabindex');
        this.#resizingColumnId = null;
    }

    // Sets up a delegated click handler for the container
    #setupDelegatedClickHandler(): void {
        // Remove existing click handler to prevent duplicates
        this.#parent.container.removeEventListener('click', this.#handleDelegatedClick);
        // Add new click handler
        this.#parent.container.addEventListener('click', this.#handleDelegatedClick);
    }

    // Handles sort requests when a column header is clicked
    #handleSortClick = (col: string): void => {
        if (this.#parent.isDestroyed) return;
        this.#parent.log(LogLevel.INFO, `Sort requested for column: ${col}`);
        this.#parent.stateManager.setState((draft) => {
            draft.currentPage = 1;
            const sorting = draft.sorting as SortCondition[];
            const sortIndex = sorting.findIndex((item: SortCondition) => item[0] === col);

            if (sortIndex === -1) {
                sorting.push([col, OrderDirection.ASC]);
            } else if (sorting[sortIndex][1] === OrderDirection.ASC) {
                sorting[sortIndex][1] = OrderDirection.DESC;
            } else {
                sorting.splice(sortIndex, 1);
            }
        });
        this.#parent.clearFormatCache();
        // Trigger data reload with new sort conditions
        this.#callbacks.requestDataLoad();
    };

    // Toggles row selection for the given index
    #toggleRowSelection(index: number): void {
        const isSelected = this.#parent.selectedRows.has(index);
        this.#parent.log(
            LogLevel.INFO,
            `Toggling row selection for index ${index}. New state: ${!isSelected}`
        );
        // Toggle selection state
        if (isSelected) {
            this.#parent.selectedRows.delete(index);
        } else {
            this.#parent.selectedRows.add(index);
        }
        // Call selection changed hook if defined
        this.#parent.invokeLifecycleHook('selectionChanged', this.#parent.getSelectedRows());
        // Update UI to reflect selection
        this.#renderer.highlightSelectedRows();
        // Announce selection change for accessibility
        const translations = this.#parent.state.translations ?? defaultTranslations;
        const message = this.#parent.selectedRows.has(index)
            ? translations.rowSelected
            : translations.rowDeselected;
        this.#renderer.announceScreenReaderUpdate(message);
    }

    // Sets up event listeners for column resizing
    #setupColumnResizing(): void {
        this.#parent.container.removeEventListener('mousedown', this.#handleResizeMouseDown);
        this.#parent.container.addEventListener('mousedown', this.#handleResizeMouseDown);
    }

    #handleResizeMouseDown = (event: MouseEvent): void => {
        if (this.#parent.isDestroyed) return;
        const target = event.target as HTMLElement;
        if (target.classList.contains(config.classes.columnResizeHandle)) {
            const header = target.closest('th');
            if (header?.dataset.colId) {
                this.#startResize(event, header.dataset.colId);
            }
        }
    };

    // Handles drag-over events for column dragging
    #handleDragOver = (event: DragEvent): void => {
        if (this.#parent.isDestroyed) return;
        event.preventDefault();
        const target = (event.target as HTMLElement).closest('th');
        if (target?.dataset.colId) {
            // Clear drag-over class from all headers
            this.#renderer.tableHeader?.querySelectorAll('th').forEach((th) => {
                th.classList.remove(config.classes.dragOver);
            });
            // Add drag-over class to target
            target.classList.add(config.classes.dragOver);
        }
    };

    // Sets up event listeners for column dragging if enabled
    #setupColumnDragging(): void {
        if (!this.#parent.draggableColumns) return;
        this.#parent.container.removeEventListener('dragstart', this.#handleDragStart);
        this.#parent.container.removeEventListener('dragover', this.#handleDragOver);
        this.#parent.container.removeEventListener('drop', this.#handleDrop);
        this.#parent.container.removeEventListener('dragend', this.#handleDragEnd);
        this.#parent.container.addEventListener('dragstart', this.#handleDragStart);
        this.#parent.container.addEventListener('dragover', this.#handleDragOver);
        this.#parent.container.addEventListener('drop', this.#handleDrop);
        this.#parent.container.addEventListener('dragend', this.#handleDragEnd);
    }

    // Sets up keyboard navigation event listeners
    #setupKeyboardNavigation(): void {
        // Remove existing keydown handler to prevent duplicates
        this.#parent.container.removeEventListener('keydown', this.#handleKeyDown);
        // Add new keydown handler
        this.#parent.container.addEventListener('keydown', this.#handleKeyDown);
        // Make container focusable
        this.#parent.container.setAttribute('tabindex', '0');
    }

    // Starts column resizing
    #startResize = (event: MouseEvent, columnId: string): void => {
        event.preventDefault();
        this.#resizingColumnId = columnId;
        const header = this.#renderer.tableHeader!.querySelector<HTMLElement>(
            `th[data-col-id="${escapeAttributeValue(columnId)}"]`
        );
        if (!header) {
            this.#resizingColumnId = null;
            return;
        }
        // Store initial position and width
        this.#startX = event.clientX;
        this.#startWidth = header.offsetWidth;
        this.#parent.log(LogLevel.INFO, `Starting column resize for: ${columnId}`);
        // Add document-level handlers for resizing
        document.addEventListener('mousemove', this.#handleResize);
        document.addEventListener('mouseup', this.#stopResize);
    };

    // Handles keyboard navigation events
    #handleKeyDown = (event: KeyboardEvent): void => {
        if (this.#parent.isDestroyed) return;
        if (
            event.target instanceof HTMLElement &&
            event.target.closest(
                'input, textarea, select, button, a, [contenteditable]:not([contenteditable="false"])'
            )
        ) {
            return;
        }
        // Define page navigation actions
        const pageActions: { [key: string]: () => void } = {
            PageUp: () => {
                if (this.#parent.state.currentPage > 1)
                    this.#parent.setCurrentPage(this.#parent.state.currentPage - 1);
            },
            PageDown: () => {
                const totalPages = Math.max(
                    1,
                    Math.ceil(this.#parent.state.totalRecords / this.#parent.state.rowsPerPage)
                );
                if (this.#parent.state.currentPage < totalPages)
                    this.#parent.setCurrentPage(this.#parent.state.currentPage + 1);
            },
        };
        const pageAction = pageActions[event.key];
        if (pageAction) {
            this.#parent.log(LogLevel.INFO, `Keyboard navigation action detected: ${event.key}`);
            event.preventDefault();
            pageAction();
            return;
        }
        if (!this.#parent.selectable) return;
        // Define row selection and navigation actions
        const selectionActions: { [key: string]: () => void } = {
            ArrowDown: () => this.#renderer.navigateToNextRow(),
            ArrowUp: () => this.#renderer.navigateToPrevRow(),
            Home: () => {
                this.#parent.currentRowIndex = this.#parent.state.data.length > 0 ? 0 : -1;
                this.#renderer.highlightCurrentRow();
            },
            End: () => {
                this.#parent.currentRowIndex =
                    this.#parent.state.data.length > 0 ? this.#parent.state.data.length - 1 : -1;
                this.#renderer.highlightCurrentRow();
            },
            Enter: () => {
                if (this.#parent.currentRowIndex >= 0)
                    this.#toggleRowSelection(this.#parent.currentRowIndex);
            },
            ' ': () => {
                if (this.#parent.currentRowIndex >= 0)
                    this.#toggleRowSelection(this.#parent.currentRowIndex);
            },
        };
        const selectionAction = selectionActions[event.key];
        if (selectionAction) {
            this.#parent.log(LogLevel.INFO, `Keyboard selection action detected: ${event.key}`);
            event.preventDefault();
            selectionAction();
        }
    };

    // Handles column resizing during mouse movement
    #handleResize = (event: MouseEvent): void => {
        if (this.#parent.isDestroyed || this.#resizingColumnId === null) return;
        // Calculate new width based on mouse movement
        const width = Math.max(
            config.constants.minColumnWidth,
            this.#startWidth + (event.clientX - this.#startX)
        );
        this.#parent.log(LogLevel.LOG, `Column resizing: ${this.#resizingColumnId} to ${width}px.`);
        this.#parent.stateManager.setState((draft) => {
            (draft.columnWidths as Map<string, number>).set(this.#resizingColumnId!, width);
        });
        // Apply updated widths
        this.#renderer.applyColumnWidths();
    };

    // Stops column resizing
    #stopResize = (): void => {
        if (this.#resizingColumnId === null) return;
        if (this.#parent.isDestroyed) {
            this.#resizingColumnId = null;
            document.removeEventListener('mousemove', this.#handleResize);
            document.removeEventListener('mouseup', this.#stopResize);
            return;
        }
        this.#parent.log(LogLevel.INFO, `Finished column resize for: ${this.#resizingColumnId}`);
        this.#resizingColumnId = null;
        // Remove document-level resize handlers
        document.removeEventListener('mousemove', this.#handleResize);
        document.removeEventListener('mouseup', this.#stopResize);
        // Save updated state
        this.#parent.stateManager.saveStateToStorage();
    };

    // Handles the start of a column drag
    #handleDragStart = (event: DragEvent): void => {
        if (this.#parent.isDestroyed) return;
        const origin = event.target as HTMLElement;
        if (origin.closest(`.${config.classes.columnResizeHandle}`)) {
            event.preventDefault();
            return;
        }
        const target = origin.closest('th');
        if (!target?.dataset.colId || !target.draggable) {
            event.preventDefault();
            return;
        }
        this.#parent.log(LogLevel.INFO, `Drag started for column: ${target.dataset.colId}`);
        if (event.dataTransfer) {
            // Set drag data
            event.dataTransfer.setData('text/plain', target.dataset.colId);
            event.dataTransfer.effectAllowed = 'move';
        }
        // Add dragging class
        target.classList.add(config.classes.dragging);
    };

    // Handles the end of a column drag
    #handleDragEnd = (event: DragEvent): void => {
        if (this.#parent.isDestroyed) return;
        const target = (event.target as HTMLElement).closest('th');
        this.#parent.log(LogLevel.INFO, `Drag ended for column: ${target?.dataset.colId}`);
        // Remove dragging and drag-over classes
        this.#renderer.tableHeader?.querySelectorAll('th').forEach((th) => {
            th.classList.remove(config.classes.dragging);
            th.classList.remove(config.classes.dragOver);
        });
    };

    // Handles delegated click events
    #handleDelegatedClick = (event: MouseEvent): void => {
        if (this.#parent.isDestroyed) return;
        const target = event.target as HTMLElement;

        // Handle sort link clicks
        const sortButton = target.closest<HTMLButtonElement>('th button');
        if (sortButton) {
            event.preventDefault();
            const th = sortButton.closest('th');
            if (th?.dataset.colId) {
                this.#handleSortClick(th.dataset.colId);
            }
            return;
        }

        // Handle pagination button clicks
        const pageButton = target.closest<HTMLButtonElement>(
            `.${config.classes.paginationContainer} button`
        );
        if (pageButton) {
            event.preventDefault();
            if (pageButton.disabled) return;

            const pageNum = parseInt(pageButton.dataset.page ?? '', 10);
            if (Number.isNaN(pageNum)) return;

            this.#parent.log(LogLevel.INFO, 'Pagination button clicked.', {
                page: pageNum,
            });
            this.#parent.setCurrentPage(pageNum);
            return;
        }

        // Handle row selection clicks, ignoring interactive cell content
        const selectableRow = target.closest<HTMLElement>('[data-index]');
        if (this.#parent.selectable && selectableRow?.dataset.index) {
            if (target.closest('a, button, input, select, textarea, label, [data-snap-ignore]')) {
                return;
            }
            const index = parseInt(selectableRow.dataset.index, 10);
            if (!isNaN(index)) {
                this.#toggleRowSelection(index);
                selectableRow.focus();
            }
        }
    };

    // Handles column drop events
    #handleDrop = (event: DragEvent): void => {
        if (this.#parent.isDestroyed) return;
        event.preventDefault();
        const target = (event.target as HTMLElement).closest('th');
        const sourceColId = event.dataTransfer?.getData('text/plain');
        const targetColId = target?.dataset.colId;
        if (sourceColId && targetColId && sourceColId !== targetColId) {
            this.#parent.log(LogLevel.INFO, `Column drop: "${sourceColId}" onto "${targetColId}"`);
            // Reorder columns
            this.#callbacks.reorderColumns(sourceColId, targetColId);
        }
        // Remove drag-over class
        target?.classList.remove(config.classes.dragOver);
    };
}

/*========================================================================================================
    EVENT MANAGER OBJECT ENDS HERE
==========================================================================================================*/
