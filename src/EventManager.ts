import {
    LogLevel,
    Identifiable,
    SortCondition,
    ISnapRenderer,
    OrderDirection,
    ISnapEventManager,
    EventManagerCallbacks,
} from './SnapTypes.js';
import { log } from './utils.js';
import { config } from './SnapOptions.js';
import type { SnapRecords } from './SnapRecords.js';
import defaultTranslations from './lang/en_US.json';

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

export class EventManager<T extends Identifiable & Record<string, unknown>>
    implements ISnapEventManager {
    // Reference to the parent SnapRecords instance
    #parent: SnapRecords<T>;
    // Renderer instance for updating the UI
    #renderer: ISnapRenderer<T>;
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
        renderer: ISnapRenderer<T>,
        callbacks: EventManagerCallbacks
    ) {
        this.#parent = parent;
        this.#renderer = renderer;
        this.#callbacks = callbacks;
    }

    // Sets up all event handlers for user interactions
    public setupAllHandlers(): void {
        this.#setupDelegatedClickHandler();
        this.#setupColumnResizing();
        this.#setupColumnDragging();
        this.#setupKeyboardNavigation();
    }

    // Removes all event listeners and cleans up
    public destroy(): void {
        log(
            this.#parent.debug, 
            LogLevel.INFO, 
            'Destroying EventManager and removing all listeners.'
        ); 
        // Remove click handler
        this.#parent.container.removeEventListener('click', this.#handleDelegatedClick);
        // Remove keyboard handler
        this.#parent.container.removeEventListener('keydown', this.#handleKeyDown);
        // Remove resize handlers
        this.#parent.container.removeEventListener('mousedown', this.#startResize as EventListener);
        // Remove drag-and-drop handlers
        this.#parent.container.removeEventListener('dragstart', this.#handleDragStart);
        this.#parent.container.removeEventListener('dragover', this.#handleDragOver);
        this.#parent.container.removeEventListener('drop', this.#handleDrop);
        this.#parent.container.removeEventListener('dragend', this.#handleDragEnd);
        // Remove document-level resize handlers
        document.removeEventListener('mouseup', this.#stopResize);
        document.removeEventListener('mousemove', this.#handleResize);
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
        log(this.#parent.debug, LogLevel.INFO, `Sort requested for column: ${col}`); 
        this.#parent.stateManager.setState((draft) => {
            const sortConditions = draft.sortConditions as SortCondition[];
            const sortIndex = sortConditions.findIndex((item: SortCondition) => item[0] === col);

            // Toggle sort order: none -> ASC -> DESC -> none
            if (sortIndex === -1) {
                sortConditions.push([col, OrderDirection.ASC]);
            } else if (sortConditions[sortIndex][1] === OrderDirection.ASC) {
                sortConditions[sortIndex][1] = OrderDirection.DESC;
            } else {
                sortConditions.splice(sortIndex, 1);
            }
        });
        // Trigger data reload with new sort conditions
        this.#callbacks.requestDataLoad();
    };

    // Toggles row selection for the given index
    #toggleRowSelection(index: number): void {
        const isSelected = this.#parent.selectedRows.has(index);
        log(
            this.#parent.debug,
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
        if (this.#parent.lifecycleHooks.selectionChanged) {
            this.#parent.lifecycleHooks.selectionChanged(this.#parent.getSelectedRows());
        }
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
        this.#parent.container.addEventListener('mousedown', (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            // Check if the target is a resize handle
            if (target.classList.contains(config.classes.columnResizeHandle)) {
                const header = target.closest('th');
                if (header?.dataset.colId) {
                    this.#startResize(e, header.dataset.colId);
                }
            }
        });
    }

    // Handles drag-over events for column dragging
    #handleDragOver = (event: DragEvent): void => {
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
            `th[data-col-id="${columnId}"]`
        );
        if (!header) return;
        // Store initial position and width
        this.#startX = event.clientX;
        this.#startWidth = header.offsetWidth;
        log(this.#parent.debug, LogLevel.INFO, `Starting column resize for: ${columnId}`); 
        // Add document-level handlers for resizing
        document.addEventListener('mousemove', this.#handleResize);
        document.addEventListener('mouseup', this.#stopResize);
    };

    // Handles keyboard navigation events
    #handleKeyDown = (event: KeyboardEvent): void => {
        // Define page navigation actions
        const pageActions: { [key: string]: () => void } = {
            PageUp: () => {
                if (this.#parent.state.currentPage > 1)
                    this.#parent.gotoPage(this.#parent.state.currentPage - 1);
            },
            PageDown: () => {
                const totalPages = Math.ceil(
                    this.#parent.state.totalRecords / this.#parent.state.rowsPerPage
                );
                if (this.#parent.state.currentPage < totalPages)
                    this.#parent.gotoPage(this.#parent.state.currentPage + 1);
            },
        };
        const pageAction = pageActions[event.key];
        if (pageAction) {
            log(this.#parent.debug, LogLevel.INFO, `Keyboard navigation action detected: ${event.key}`); 
            event.preventDefault();
            pageAction();
            return;
        }
        if (!this.#parent.selectable) return;
        // Define row selection and navigation actions
        const selectionActions: { [key: string]: () => void } = {
            ArrowDown: () => this.#renderer.navigateToNextRow(),
            ArrowUp: () => this.#renderer.navigateToPrevRow(),
            Home: () => this.#parent.reset(),
            End: () => {
                this.#parent.currentRowIndex = this.#parent.state.data.length - 1;
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
            log(this.#parent.debug, LogLevel.INFO, `Keyboard selection action detected: ${event.key}`); 
            event.preventDefault();
            selectionAction();
        }
    };

    // Handles column resizing during mouse movement
    #handleResize = (event: MouseEvent): void => {
        if (this.#resizingColumnId === null) return;
        // Calculate new width based on mouse movement
        const width = this.#startWidth + (event.clientX - this.#startX);
        log(this.#parent.debug, LogLevel.LOG, `Column resizing: ${this.#resizingColumnId} to ${width}px.`); 
        this.#parent.stateManager.setState((draft) => {
            (draft.columnWidths as Map<string, number>).set(this.#resizingColumnId!, width);
        });
        // Apply updated widths
        this.#renderer.applyColumnWidths();
    };

    // Stops column resizing
    #stopResize = (): void => {
        if (this.#resizingColumnId === null) return;
        log(this.#parent.debug, LogLevel.INFO, `Finished column resize for: ${this.#resizingColumnId}`); 
        this.#resizingColumnId = null;
        // Remove document-level resize handlers
        document.removeEventListener('mousemove', this.#handleResize);
        document.removeEventListener('mouseup', this.#stopResize);
        // Save updated state
        this.#parent.stateManager.saveStateToStorage();
    };

    // Handles the start of a column drag
    #handleDragStart = (event: DragEvent): void => {
        const target = (event.target as HTMLElement).closest('th');
        if (!target?.dataset.colId || !target.draggable) {
            event.preventDefault();
            return;
        }
        log(this.#parent.debug, LogLevel.INFO, `Drag started for column: ${target.dataset.colId}`); 
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
        const target = (event.target as HTMLElement).closest('th');
        log(this.#parent.debug, LogLevel.INFO, `Drag ended for column: ${target?.dataset.colId}`); 
        // Remove dragging and drag-over classes
        this.#renderer.tableHeader?.querySelectorAll('th').forEach((th) => {
            th.classList.remove(config.classes.dragging);
            th.classList.remove(config.classes.dragOver);
        });
    };

    // Handles delegated click events
    #handleDelegatedClick = (event: MouseEvent): void => {
        const target = event.target as HTMLElement;

        // Handle sort link clicks
        const sortLink = target.closest<HTMLAnchorElement>('th a[role="button"]');
        if (sortLink) {
            event.preventDefault();
            const th = sortLink.closest('th');
            if (th?.dataset.colId) {
                this.#handleSortClick(th.dataset.colId);
            }
            return;
        }

        // Handle pagination button clicks
        const pageButton = target.closest<HTMLButtonElement>('.snap-pagination-container button');
        if (pageButton) {
            event.preventDefault();
            if (pageButton.disabled) return;

            const pageNumText = pageButton.textContent?.trim();
            const pageNum = pageNumText ? parseInt(pageNumText, 10) : NaN;

            log(this.#parent.debug, LogLevel.INFO, 'Pagination button clicked.', { text: pageNumText }); 

            if (pageButton.classList.contains(config.pagination.prevButton.classNames.base)) {
                this.#parent.gotoPage(this.#parent.state.currentPage - 1);
            } else if (
                pageButton.classList.contains(config.pagination.nextButton.classNames.base)
            ) {
                this.#parent.gotoPage(this.#parent.state.currentPage + 1);
            } else if (!isNaN(pageNum)) {
                this.#parent.gotoPage(pageNum);
            }
            return;
        }

        // Handle row selection clicks
        const selectableRow = target.closest<HTMLElement>('[data-index]');
        if (this.#parent.selectable && selectableRow?.dataset.index) {
            const index = parseInt(selectableRow.dataset.index, 10);
            if (!isNaN(index)) {
                this.#toggleRowSelection(index);
                selectableRow.focus();
            }
            return;
        }
    };

    // Handles column drop events
    #handleDrop = (event: DragEvent): void => {
        event.preventDefault();
        const target = (event.target as HTMLElement).closest('th');
        const sourceColId = event.dataTransfer?.getData('text/plain');
        const targetColId = target?.dataset.colId;
        if (sourceColId && targetColId && sourceColId !== targetColId) {
            log(this.#parent.debug, LogLevel.INFO, `Column drop: "${sourceColId}" onto "${targetColId}"`); 
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