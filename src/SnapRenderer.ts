import {
    LogLevel,
    RenderType,
    ButtonType,
    Identifiable,
    ISnapRenderer,
    OrderDirection,
} from './SnapTypes.js';
import { log } from './utils.js';
import { config } from './SnapOptions.js';
import type { SnapRecords } from './SnapRecords.js';
import defaultTranslations from './lang/en_US.json';

/*========================================================================================================

    SNAP RENDERER CLASS

    Class responsible for rendering the UI of the SnapRecords plugin in various formats
    (table, list, mobile cards)

    The SnapRenderer class is responsible for rendering the user interface of the SnapRecords plugin
    in different formats, such as table, list, and mobile cards. It manages the creation and updating
    of DOM elements, applies themes, handles loading and error states, and provides accessibility
    features.

    The class ensures efficient updates and supports features like pagination, sorting, and keyboard
    navigation for a responsive and accessible data display.

==========================================================================================================*/

export class SnapRenderer<T extends Identifiable & Record<string, unknown>>
    implements ISnapRenderer<T>
{
    // Container for mobile cards display
    public cardsContainer: HTMLElement | null = null;
    // Main table element for table rendering
    public tableElement: HTMLTableElement | null = null;
    // Container for list rendering
    public listContainer: HTMLUListElement | null = null;
    // Table body element
    public tableBody: HTMLTableSectionElement | null = null;
    // Table header element
    public tableHeader: HTMLTableSectionElement | null = null;

    // Reference to the parent SnapRecords instance
    private parent: SnapRecords<T>;
    // Container for the content (table, list, or cards)
    private contentContainer: HTMLElement;
    // Footer element for pagination and totals
    private footerElement: HTMLElement | null = null;
    // Element displaying record totals
    private totalsElement: HTMLElement | null = null;
    // Element containing pagination controls
    private paginationElement: HTMLElement | null = null;

    // Constructor initializes the renderer with the parent instance and content container
    constructor(parent: SnapRecords<T>, contentContainer: HTMLElement) {
        this.parent = parent;
        this.contentContainer = contentContainer;
    }

    // Navigates to the next row for keyboard navigation
    public navigateToNextRow(): void {
        if (this.parent.state.data.length === 0) return;
        // Increment the current row index, capped at the last row
        this.parent.currentRowIndex = Math.min(
            this.parent.currentRowIndex + 1,
            this.parent.state.data.length - 1
        );
        this.highlightCurrentRow();
    }

    // Navigates to the previous row for keyboard navigation
    public navigateToPrevRow(): void {
        if (this.parent.state.data.length === 0) return;
        // Decrement the current row index, floored at 0
        this.parent.currentRowIndex = Math.max(0, this.parent.currentRowIndex - 1);
        this.highlightCurrentRow();
    }

    // Creates the necessary DOM containers for rendering
    public createContainers(): void {
        log(this.parent.debug, LogLevel.INFO, 'Creating DOM containers for rendering.');
        // Clear the container's content
        this.parent.container.innerHTML = '';
        // Add table container class
        this.parent.container.classList.add(config.classes.tableContainer);
        // Add content container class
        this.contentContainer.classList.add(config.classes.contentContainer);
        // Append content container to the main container
        this.parent.container.appendChild(this.contentContainer);
        // Create and append error container
        this.parent.errorContainer = document.createElement('div');
        this.parent.errorContainer.classList.add(config.classes.errorContainer);
        this.parent.errorContainer.style.display = 'none';
        this.parent.container.appendChild(this.parent.errorContainer);
        // Ensure the container has a non-static position for overlays
        if (getComputedStyle(this.parent.container).position === 'static') {
            this.parent.container.style.position = 'relative';
        }
    }

    // Shows a loading indicator during data fetching
    public showLoading(): void {
        if (this.parent.isLoading) return;
        this.parent.isLoading = true;
        log(this.parent.debug, LogLevel.INFO, 'Showing loading indicator.');

        // Get translations, falling back to default
        const translations = this.parent.state.translations ?? defaultTranslations;
        // Create loading overlay element
        const overlay = document.createElement('div');
        overlay.className = config.classes.loadingOverlay;
        overlay.setAttribute('role', 'status');
        overlay.setAttribute('aria-live', 'polite');
        overlay.textContent = translations.loading;

        // Determine the target container based on render mode
        let targetContainer: HTMLElement | null = null;
        switch (this.parent.state.format) {
            case RenderType.TABLE:
                targetContainer = this.tableBody;
                if (targetContainer) targetContainer.style.position = 'relative';
                break;
            case RenderType.LIST:
                targetContainer = this.listContainer;
                break;
            case RenderType.MOBILE_CARDS:
                targetContainer = this.cardsContainer;
                break;
        }

        // Append the overlay to the appropriate container
        if (targetContainer) {
            targetContainer.appendChild(overlay);
        } else {
            this.parent.contentContainer.appendChild(overlay);
        }
    }

    // Applies the current theme class to the container
    public applyThemeClass(): void {
        log(this.parent.debug, LogLevel.INFO, `Applying theme: ${this.parent.state.theme}`);
        // ### CORRECTION HERE ###
        // Remove all possible existing theme classes before adding the new one.
        this.parent.container.classList.remove('theme-light', 'theme-dark', 'theme-default');
        // Add the current theme class
        this.parent.container.classList.add(`theme-${this.parent.state.theme}`);
    }

    // Hides the loading indicator
    public hideLoading(): void {
        if (!this.parent.isLoading) return;
        log(this.parent.debug, LogLevel.INFO, 'Hiding loading indicator.');
        // Remove the loading overlay
        this.parent.container.querySelector(`.${config.classes.loadingOverlay}`)?.remove();
        this.parent.isLoading = false;
    }

    // Displays an error message in the error container
    public showError(message: string): void {
        log(this.parent.debug, LogLevel.ERROR, 'Displaying error message to user:', message);
        if (this.parent.errorContainer && this.parent.state.translations) {
            const translations = this.parent.state.translations;
            this.parent.errorContainer.innerHTML = '';
            // Create error title
            const title = document.createElement('strong');
            title.textContent = translations.errorTitle;
            // Create error message
            const text = document.createElement('p');
            text.textContent = message;
            // Create retry button
            const retryButton = document.createElement('button');
            retryButton.className = 'snap-retry-button';
            retryButton.textContent = translations.retry;
            retryButton.addEventListener('click', () => this.parent.refresh());
            // Append elements to error container
            this.parent.errorContainer.append(title, text, retryButton);
            this.parent.errorContainer.style.display = 'block';
            this.contentContainer.style.display = 'none';
        }
    }

    // Applies column widths to table headers
    public applyColumnWidths(): void {
        // Use requestAnimationFrame for smooth rendering
        requestAnimationFrame(() => {
            this.parent.state.columns.forEach((col, index) => {
                const width = this.parent.state.columnWidths.get(col as string);
                if (width) {
                    const header = this.tableHeader?.querySelector<HTMLElement>(
                        `th:nth-child(${index + 1})`
                    );
                    if (header) header.style.width = `${width}px`;
                }
            });
        });
    }

    // Highlights selected rows in the UI
    public highlightSelectedRows(): void {
        const selector = 'tr[data-index], li[data-index], .snap-mobile-card[data-index]';
        this.contentContainer.querySelectorAll(selector).forEach((el: Element) => {
            const element = el as HTMLElement;
            const index = parseInt(element.dataset.index!, 10);
            const isSelected = this.parent.selectedRows.has(index);
            // Toggle the selected class
            element.classList.toggle(config.classes.selected, isSelected);
            // Update ARIA attribute
            element.setAttribute('aria-selected', String(isSelected));
        });
    }

    // Highlights the current row for keyboard navigation
    public highlightCurrentRow(): void {
        const selector = 'tr[data-index], li[data-index], .snap-mobile-card[data-index]';
        this.contentContainer.querySelectorAll(selector).forEach((el: Element) => {
            const element = el as HTMLElement;
            const index = parseInt(element.dataset.index!, 10);
            const isCurrent = index === this.parent.currentRowIndex;
            // Toggle the current row class
            element.classList.toggle(config.classes.currentRow, isCurrent);
            if (isCurrent) {
                // Scroll to and focus the current row
                element.scrollIntoView({ block: 'nearest' });
                element.focus();
            }
        });
    }

    // Main rendering method based on the current state
    public render(): void {
        if (!this.parent.state.translations) return;
        log(this.parent.debug, LogLevel.INFO, 'Starting render process...');
        // Call pre-render hook if defined
        if (this.parent.lifecycleHooks.preRender) this.parent.lifecycleHooks.preRender();

        // Ensure the correct container is set up
        this.#ensureCorrectContainer(this.parent.state.format);

        // Render content based on format
        if (this.parent.state.format === RenderType.TABLE) {
            this.#renderTableHeaderContents();
            this.#refreshTableBody();
        } else if (this.parent.state.format === RenderType.LIST) {
            this.#refreshListBody();
        } else if (this.parent.state.format === RenderType.MOBILE_CARDS) {
            this.#refreshMobileCards();
        }

        // Update footer with pagination and totals
        this.#updateFooter();

        // Call post-render hook if defined
        if (this.parent.lifecycleHooks.postRender) this.parent.lifecycleHooks.postRender();
        log(this.parent.debug, LogLevel.INFO, 'Render process finished.');
    }

    // Announces updates for screen readers
    public announceScreenReaderUpdate(message: string): void {
        // Create a live region for accessibility
        const liveRegion = document.createElement('div');
        liveRegion.setAttribute('aria-live', 'polite');
        liveRegion.style.cssText =
            'position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0);';
        liveRegion.textContent = message;
        document.body.appendChild(liveRegion);
        // Remove the live region after a delay
        setTimeout(() => liveRegion.remove(), 1000);
    }

    // Cleans up the renderer by clearing the container
    public destroy(): void {
        log(this.parent.debug, LogLevel.INFO, 'Destroying renderer and clearing container HTML.');
        this.parent.container.innerHTML = '';
    }

    // Creates a footer for non-table rendering modes
    #renderNonTableFooter(): void {
        this.footerElement = document.createElement('div');
        this.footerElement.classList.add(config.classes.footer);
        this.contentContainer.appendChild(this.footerElement);
    }

    // Refreshes the table body with current data
    #refreshTableBody(): void {
        if (!this.tableBody) return;
        this.#reconcileItems(
            this.tableBody,
            this.parent.state.data,
            (row, index) => this.parent.createTableRow(row, index, row.id),
            (el, row, index) => this.parent.updateRow(el, row, index)
        );
    }

    // Refreshes the list body with current data
    #refreshListBody(): void {
        if (!this.listContainer) return;
        this.#reconcileItems(
            this.listContainer,
            this.parent.state.data,
            (row, index) => this.parent.createListItem(row, index),
            (el, row, index) => this.parent.updateListItem(el, row, index)
        );
    }

    // Refreshes mobile cards with current data
    #refreshMobileCards(): void {
        if (!this.cardsContainer) return;
        this.#reconcileItems(
            this.cardsContainer,
            this.parent.state.data,
            (row, index) => this.parent.createMobileCard(row, index),
            (el, row, index) => this.parent.updateMobileCard(el, row, index)
        );
    }

    // Creates a pagination button
    #createPaginationButton(
        content: string,
        disabled: boolean,
        type: ButtonType
    ): HTMLButtonElement {
        const button = document.createElement('button');
        button.type = 'button';
        button.disabled = disabled;

        // Apply appropriate classes based on button type
        let typeConfig: { classNames: { base: string; disabled: string } };
        switch (type) {
            case 'prev':
                typeConfig = config.pagination.prevButton;
                button.classList.add(typeConfig.classNames.base);
                break;
            case 'next':
                typeConfig = config.pagination.nextButton;
                button.classList.add(typeConfig.classNames.base);
                break;
            case 'number':
                typeConfig = config.pagination.numberButton;
                button.classList.add(typeConfig.classNames.base);
                break;
        }

        if (disabled) {
            button.classList.add(typeConfig.classNames.disabled);
        }

        button.innerHTML = content;
        return button;
    }

    // Reconciles DOM elements with data, optimizing updates
    #reconcileItems<K extends HTMLElement>(
        container: HTMLElement,
        data: ReadonlyArray<T>,
        renderer: (item: T, index: number) => K,
        updateFn: (el: K, item: T, index: number) => void
    ): void {
        // Map existing elements by their data-key
        const domMap = new Map<string, K>();
        container.querySelectorAll<K>('[data-key]').forEach((el) => {
            domMap.set(el.dataset.key!, el);
        });

        // Create a document fragment for efficient DOM updates
        const fragment = document.createDocumentFragment();
        data.forEach((item, index) => {
            const key = item.id.toString();
            const existingEl = domMap.get(key);
            let elToAppend: K;

            if (existingEl) {
                // Update existing element
                updateFn(existingEl, item, index);
                elToAppend = existingEl;
                domMap.delete(key);
            } else {
                // Create new element
                elToAppend = renderer(item, index);
            }
            fragment.appendChild(elToAppend);
        });

        // Clear container and append updated elements
        container.innerHTML = '';
        container.appendChild(fragment);

        // Display no-data message if data is empty
        if (data.length === 0 && this.parent.state.translations) {
            this.#renderNoDataMessage(
                container,
                container.tagName === 'TBODY' ? this.parent.state.columns.length : 1
            );
        }
    }

    // Renders a "no data available" message
    #renderNoDataMessage(container: HTMLElement, colSpan: number): void {
        log(this.parent.debug, LogLevel.INFO, 'Rendering "no data available" message.');
        const isTable = container.tagName === 'TBODY';
        // Create appropriate element (tr for table, li for list)
        const noDataEl = document.createElement(isTable ? 'tr' : 'li');
        const contentEl = document.createElement(isTable ? 'td' : 'div');
        if (isTable) (contentEl as HTMLTableCellElement).colSpan = colSpan;
        contentEl.classList.add(config.classes.noData);
        contentEl.textContent = this.parent.state.translations!.noDataAvailable;
        noDataEl.appendChild(contentEl);
        container.appendChild(noDataEl);
    }

    // Updates the footer with totals and pagination
    #updateFooter(): void {
        const footerTarget =
            this.tableElement?.querySelector(`.${config.classes.footerContainer}`) ??
            this.footerElement;
        if (!footerTarget || !this.parent.state.translations) return;

        footerTarget.innerHTML = '';
        this.totalsElement = this.#createTotalsElement();
        this.paginationElement = this.#createPaginationElement();
        footerTarget.appendChild(this.totalsElement);
        footerTarget.appendChild(this.paginationElement);
    }

    // Creates the table structure for table rendering mode
    #renderTableStructure(): void {
        log(this.parent.debug, LogLevel.LOG, 'Rendering main table structure.');
        // Create responsive wrapper
        const responsiveWrapper = document.createElement('div');
        responsiveWrapper.classList.add(config.classes.tableResponsive);
        // Create table element
        this.tableElement = document.createElement('table');
        this.tableElement.classList.add(...config.classes.table.containerClass.split(' '));
        this.tableElement.setAttribute('role', 'grid');
        responsiveWrapper.appendChild(this.tableElement);
        this.contentContainer.appendChild(responsiveWrapper);

        // Create table header
        this.tableHeader = this.tableElement.createTHead();
        this.tableHeader.classList.add(...config.classes.table.headerClass.split(' '));

        // Create table body
        this.tableBody = this.tableElement.createTBody();
        this.tableBody.classList.add(...config.classes.table.bodyClass.split(' '));

        // Create table footer
        const tfoot = this.tableElement.createTFoot();
        tfoot.classList.add(...config.classes.table.footerClass.split(' '));
        const footerRow = tfoot.insertRow();
        const footerCell = footerRow.insertCell();
        footerCell.colSpan = this.parent.state.columns.length;
        const footerDiv = document.createElement('div');
        footerDiv.classList.add(config.classes.footerContainer);
        footerCell.appendChild(footerDiv);
    }

    // Creates the cards structure for mobile cards rendering mode
    #renderCardsStructure(): void {
        log(this.parent.debug, LogLevel.LOG, 'Rendering main cards structure.');
        this.cardsContainer = document.createElement('div');
        this.cardsContainer.classList.add(config.classes.mobileCardsContainer);
        this.contentContainer.appendChild(this.cardsContainer);
        this.#renderNonTableFooter();
    }

    // Creates the list structure for list rendering mode
    #renderListStructure(): void {
        log(this.parent.debug, LogLevel.LOG, 'Rendering main list structure.');
        this.listContainer = document.createElement('ul');
        this.listContainer.classList.add(...config.classes.list.containerClass.split(' '));
        this.contentContainer.appendChild(this.listContainer);
        this.#renderNonTableFooter();
    }

    // Renders the table header contents
    #renderTableHeaderContents(): void {
        if (!this.tableHeader || !this.parent.state.translations) return;
        this.tableHeader.innerHTML = '';
        const headerRow = this.tableHeader.insertRow();
        headerRow.setAttribute('role', 'row');
        this.parent.state.columns.forEach((col: string, idx: number) => {
            const th = document.createElement('th');
            th.setAttribute('role', 'columnheader');
            th.setAttribute('data-col-id', col);
            // Apply saved column width
            const width = this.parent.state.columnWidths.get(col);
            if (width) th.style.width = `${width}px`;
            // Apply custom header classes
            if (this.parent.headerCellClasses[idx])
                th.className = this.parent.headerCellClasses[idx];

            // Check if the column is sortable
            const isSortable = !this.parent.headerCellClasses[idx]?.includes('no-sorting');
            if (isSortable) {
                const link = document.createElement('a');
                link.href = '#';
                link.innerHTML = this.parent.state.columnTitles[idx] as string;
                link.setAttribute('role', 'button');

                // Apply sorting indicators
                const sortItem = this.parent.state.sortConditions.find((item) => item[0] === col);
                if (sortItem) {
                    const sortClass =
                        sortItem[1] === OrderDirection.ASC
                            ? config.classes.sortAscOrder
                            : config.classes.sortDescOrder;
                    link.classList.add(sortClass);
                    link.setAttribute(
                        'aria-sort',
                        sortItem[1] === 'ASC' ? 'ascending' : 'descending'
                    );
                } else {
                    link.classList.add(config.classes.sortNoOrder);
                    link.setAttribute('aria-sort', 'none');
                }
                th.appendChild(link);
            } else {
                th.textContent = this.parent.state.columnTitles[idx] as string;
            }

            // Enable dragging if configured
            if (this.parent.draggableColumns) {
                th.setAttribute('draggable', 'true');
                th.classList.add(config.classes.draggableColumn);
            }

            // Add resize handle
            const resizeHandle = document.createElement('div');
            resizeHandle.className = config.classes.columnResizeHandle;
            th.appendChild(resizeHandle);
            headerRow.appendChild(th);
        });
    }

    // Creates the pagination element
    #createPaginationElement(): HTMLElement {
        const parentState = this.parent.state;
        // Calculate total pages
        const totalPages = Math.max(
            1,
            Math.ceil(parentState.totalRecords / parentState.rowsPerPage)
        );
        const paginationContainer = document.createElement('nav');
        paginationContainer.classList.add(config.classes.paginationContainer);
        paginationContainer.setAttribute('aria-label', parentState.translations!.pageNavigation);

        // Add previous button
        paginationContainer.appendChild(
            this.#createPaginationButton(
                this.parent.prevButtonConfig.text || parentState.translations!.previous,
                parentState.currentPage === 1,
                'prev'
            )
        );

        // Add first page button if needed
        if (parentState.currentPage > config.constants.paginationMaxPageDistance) {
            paginationContainer.appendChild(this.#createPaginationButton('1', false, 'number'));
            if (parentState.currentPage > config.constants.paginationEllipsisDistance) {
                // Add ellipsis
                const ellipsis = document.createElement('span');
                ellipsis.textContent = '...';
                ellipsis.setAttribute('aria-hidden', 'true');
                ellipsis.classList.add(config.pagination.ellipsis.classNames.base);
                paginationContainer.appendChild(ellipsis);
            }
        }

        // Add page number buttons
        const startPage = Math.max(
            1,
            parentState.currentPage - config.constants.paginationPageRange
        );
        const endPage = Math.min(
            totalPages,
            parentState.currentPage + config.constants.paginationPageRange
        );
        for (let i = startPage; i <= endPage; i++) {
            paginationContainer.appendChild(
                this.#createPaginationButton(i.toString(), i === parentState.currentPage, 'number')
            );
        }

        // Add last page button and ellipsis if needed
        if (endPage < totalPages - config.constants.paginationLastPageBuffer) {
            if (endPage < totalPages - config.constants.paginationEllipsisLastPageBuffer) {
                const ellipsis = document.createElement('span');
                ellipsis.textContent = '...';
                ellipsis.setAttribute('aria-hidden', 'true');
                ellipsis.classList.add(config.pagination.ellipsis.classNames.base);
                paginationContainer.appendChild(ellipsis);
            }
            paginationContainer.appendChild(
                this.#createPaginationButton(totalPages.toString(), false, 'number')
            );
        }

        // Add next button
        paginationContainer.appendChild(
            this.#createPaginationButton(
                this.parent.nextButtonConfig.text || parentState.translations!.next,
                parentState.currentPage === totalPages,
                'next'
            )
        );

        return paginationContainer;
    }

    // Creates the totals element showing record range
    #createTotalsElement(): HTMLElement {
        const parentState = this.parent.state;
        const totalsDiv = document.createElement('div');
        totalsDiv.classList.add(config.classes.totals);
        if (parentState.totalRecords === 0) {
            totalsDiv.textContent = parentState.translations!.noDataAvailable;
            return totalsDiv;
        }
        // Calculate record range
        const startRecord = (parentState.currentPage - 1) * parentState.rowsPerPage + 1;
        const endRecord = Math.min(
            parentState.currentPage * parentState.rowsPerPage,
            parentState.totalRecords
        );
        // Format the totals text
        const translationKey = parentState
            .translations!.pagination.showingRecords.replace(
                '{start}',
                `<span class="${config.classes.recordStart}">${startRecord}</span>`
            )
            .replace('{end}', `<span class="${config.classes.recordEnd}">${endRecord}</span>`)
            .replace(
                '{total}',
                `<span class="${config.classes.recordsTotal}">${parentState.totalRecords}</span>`
            );
        totalsDiv.innerHTML = translationKey;
        return totalsDiv;
    }

    // Ensures the correct container is used for the current rendering mode
    #ensureCorrectContainer(format: RenderType): void {
        log(this.parent.debug, LogLevel.LOG, `Ensuring correct container for format: ${format}`);
        const tableVisible = format === RenderType.TABLE;
        const listVisible = format === RenderType.LIST;
        const cardsVisible = format === RenderType.MOBILE_CARDS;

        // Initialize containers if not already created
        if (tableVisible && !this.tableElement) this.#renderTableStructure();
        if (listVisible && !this.listContainer) this.#renderListStructure();
        if (cardsVisible && !this.cardsContainer) this.#renderCardsStructure();

        // Toggle visibility of containers
        const tableWrapper = this.tableElement?.parentElement;
        if (tableWrapper) tableWrapper.style.display = tableVisible ? '' : 'none';
        if (this.listContainer) this.listContainer.style.display = listVisible ? '' : 'none';
        if (this.cardsContainer) this.cardsContainer.style.display = cardsVisible ? '' : 'none';

        // Toggle footer visibility
        const footerElement =
            this.tableElement?.querySelector(`.${config.classes.footerContainer}`)?.parentElement ??
            this.footerElement;
        if (footerElement)
            footerElement.style.display = listVisible || cardsVisible || tableVisible ? '' : 'none';
    }
}

/*========================================================================================================
    SNAP RENDERER CLASS ENDS HERE
==========================================================================================================*/
