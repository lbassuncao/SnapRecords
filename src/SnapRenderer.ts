import {
    LogLevel,
    RenderType,
    ButtonType,
    Identifiable,
    ISnapRenderer,
    OrderDirection,
} from './SnapTypes.js';
import { config } from './SnapOptions.js';
import type { SnapRecords } from './SnapRecords.js';
import { sanitizeHTML, escapeAttributeValue } from './utils.js';
import defaultTranslations from './lang/en_US.json';

function addClassTokens(el: Element, classNames: string): void {
    const tokens = classNames.split(/\s+/).filter(Boolean);
    if (tokens.length) el.classList.add(...tokens);
}

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

export class SnapRenderer<
    T extends Identifiable & Record<string, unknown>,
> implements ISnapRenderer<T> {
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
    #destroyed = false;
    #announceRegion: HTMLElement | null = null;
    #announceTimer: number | null = null;
    #widthFrame: number | null = null;
    #didSetContainerPosition = false;

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
        if (this.parent.state.data.length === 0 || this.parent.currentRowIndex < 0) return;
        // Decrement the current row index, floored at 0
        this.parent.currentRowIndex = Math.max(0, this.parent.currentRowIndex - 1);
        this.highlightCurrentRow();
    }

    // Creates the necessary DOM containers for rendering
    public createContainers(): void {
        this.parent.log(LogLevel.INFO, 'Creating DOM containers for rendering.');
        // Clear the container's content
        this.parent.container.innerHTML = '';
        // Add table container class
        this.parent.container.classList.add(config.classes.tableContainer);
        this.parent.container.classList.toggle(config.classes.selectable, this.parent.selectable);
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
        const position = getComputedStyle(this.parent.container).position;
        if (!position || position === 'static') {
            this.parent.container.style.position = 'relative';
            this.#didSetContainerPosition = true;
        }
    }

    // Shows a loading indicator during data fetching
    public showLoading(): void {
        if (this.parent.isDestroyed) return;
        const overlays = this.parent.container.querySelectorAll(
            `.${config.classes.loadingOverlay}`
        );
        if (this.parent.isLoading) {
            if (overlays.length > 0) return;
            this.parent.isLoading = false;
        }
        this.parent.isLoading = true;
        this.parent.log(LogLevel.INFO, 'Showing loading indicator.');
        this.contentContainer.style.display = '';
        if (this.parent.errorContainer) {
            this.parent.errorContainer.style.display = 'none';
        }

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
        const theme = this.parent.state.theme;
        this.parent.log(LogLevel.INFO, `Applying theme: ${theme}`);
        this.parent.container.classList.remove('theme-light', 'theme-dark', 'theme-default');
        if (theme !== 'light' && theme !== 'dark' && theme !== 'default') return;
        this.parent.container.classList.add(`theme-${theme}`);
    }

    // Hides the loading indicator
    public hideLoading(): void {
        const overlays = this.parent.container.querySelectorAll(
            `.${config.classes.loadingOverlay}`
        );
        if (!this.parent.isLoading && overlays.length === 0) return;
        this.parent.log(LogLevel.INFO, 'Hiding loading indicator.');
        overlays.forEach((el) => el.remove());
        this.parent.isLoading = false;
    }

    // Displays an error message in the error container
    public showError(message: string): void {
        this.parent.log(LogLevel.ERROR, 'Displaying error message to user:', message);
        if (!this.parent.errorContainer) return;
        const translations = this.parent.state.translations ?? defaultTranslations;
        this.parent.errorContainer.innerHTML = '';
        const title = document.createElement('strong');
        title.textContent = translations.errorTitle;
        const text = document.createElement('p');
        text.textContent = message;
        const retryButton = document.createElement('button');
        retryButton.type = 'button';
        retryButton.className = 'snap-retry-button';
        retryButton.textContent = translations.retry;
        retryButton.addEventListener('click', () => this.parent.refresh());
        this.parent.errorContainer.append(title, text, retryButton);
        this.parent.errorContainer.style.display = 'block';
        this.contentContainer.style.display = 'none';
    }

    // Applies column widths to table headers
    public applyColumnWidths(): void {
        if (this.#widthFrame !== null) cancelAnimationFrame(this.#widthFrame);
        this.#widthFrame = requestAnimationFrame(() => {
            this.#widthFrame = null;
            if (this.#destroyed) return;
            this.parent.state.columns.forEach((col) => {
                const width = this.parent.state.columnWidths.get(col as string);
                if (width) {
                    const header = this.tableHeader?.querySelector<HTMLElement>(
                        `th[data-col-id="${escapeAttributeValue(col)}"]`
                    );
                    if (header) header.style.width = `${width}px`;
                }
            });
        });
    }

    // Highlights selected rows in the UI
    public highlightSelectedRows(): void {
        if (this.#destroyed) return;
        const selector = 'tr[data-index], li[data-index], .snap-mobile-card[data-index]';
        this.contentContainer.querySelectorAll(selector).forEach((el: Element) => {
            const element = el as HTMLElement;
            const index = parseInt(element.dataset.index!, 10);
            const isSelected = this.parent.selectedRows.has(index);
            // Toggle the selected class
            element.classList.toggle(config.classes.selected, isSelected);
            if (element.getAttribute('role') === 'row') {
                element.setAttribute('aria-selected', String(isSelected));
            }
        });
    }

    // Highlights the current row for keyboard navigation
    public highlightCurrentRow(): void {
        if (this.#destroyed) return;
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
        if (this.#destroyed || !this.parent.state.translations) return;
        this.parent.log(LogLevel.INFO, 'Starting render process...');
        this.contentContainer.style.display = '';
        if (this.parent.errorContainer) {
            this.parent.errorContainer.style.display = 'none';
            this.parent.errorContainer.innerHTML = '';
        }
        this.parent.invokeLifecycleHook('preRender');

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

        this.highlightSelectedRows();
        if (this.parent.currentRowIndex >= 0) this.highlightCurrentRow();

        if (this.parent.isLoading) {
            this.showLoading();
        }

        // Call post-render hook if defined
        this.parent.invokeLifecycleHook('postRender');
        this.parent.log(LogLevel.INFO, 'Render process finished.');
    }

    // Announces updates for screen readers
    public announceScreenReaderUpdate(message: string): void {
        if (this.#destroyed) return;
        this.#announceRegion?.remove();
        if (this.#announceTimer !== null) {
            clearTimeout(this.#announceTimer);
            this.#announceTimer = null;
        }
        const liveRegion = document.createElement('div');
        liveRegion.setAttribute('aria-live', 'polite');
        liveRegion.style.cssText =
            'position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0);';
        liveRegion.textContent = message;
        document.body.appendChild(liveRegion);
        this.#announceRegion = liveRegion;
        this.#announceTimer = window.setTimeout(() => {
            this.#announceTimer = null;
            this.#announceRegion = null;
            liveRegion.remove();
        }, config.constants.screenReaderAnnouncementDelay);
    }

    public destroy(): void {
        this.#destroyed = true;
        if (this.#announceTimer !== null) {
            clearTimeout(this.#announceTimer);
            this.#announceTimer = null;
        }
        this.#announceRegion?.remove();
        this.#announceRegion = null;
        if (this.#widthFrame !== null) {
            cancelAnimationFrame(this.#widthFrame);
            this.#widthFrame = null;
        }
        this.parent.log(LogLevel.INFO, 'Destroying renderer and clearing container HTML.');
        this.parent.container.innerHTML = '';
        if (this.#didSetContainerPosition) {
            this.parent.container.style.position = '';
            this.#didSetContainerPosition = false;
        }
    }

    // Creates a footer for non-table rendering modes
    #renderNonTableFooter(): void {
        if (this.footerElement) return;
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
            (row, index) => this.#createTableRow(row, index),
            (el, row, index) => this.#updateRow(el, row, index)
        );
    }

    #refreshListBody(): void {
        if (!this.listContainer) return;
        this.#reconcileItems(
            this.listContainer,
            this.parent.state.data,
            (row, index) => this.#createListItem(row, index),
            (el, row, index) => this.#updateListItem(el, row, index)
        );
    }

    #refreshMobileCards(): void {
        if (!this.cardsContainer) return;
        this.#reconcileItems(
            this.cardsContainer,
            this.parent.state.data,
            (row, index) => this.#createMobileCard(row, index),
            (el, row, index) => this.#updateMobileCard(el, row, index)
        );
    }

    #createTableRow(row: T, index: number): HTMLTableRowElement {
        const tr = document.createElement('tr');
        tr.setAttribute('role', 'row');
        this.#updateRow(tr, row, index);
        return tr;
    }

    #updateRow(tr: HTMLTableRowElement, row: T, index: number): void {
        tr.setAttribute('data-index', index.toString());
        if (this.parent.selectable) tr.tabIndex = 0;
        const fragment = document.createDocumentFragment();
        this.parent.state.columns.forEach((col) => {
            const td = document.createElement('td');
            td.setAttribute('role', 'gridcell');
            td.setAttribute('data-col-id', col);
            const formattedValue = this.parent.getFormattedValue(
                row[col as keyof T],
                col,
                row,
                index
            );
            td.innerHTML = formattedValue;
            fragment.appendChild(td);
        });
        tr.replaceChildren(fragment);
    }

    #createListItem(row: T, index: number): HTMLLIElement {
        const li = document.createElement('li');
        addClassTokens(li, config.classes.list.itemClass);
        li.setAttribute('role', 'listitem');
        this.#updateListItem(li, row, index);
        return li;
    }

    #updateListItem(li: HTMLLIElement, row: T, index: number): void {
        li.setAttribute('data-index', index.toString());
        if (this.parent.selectable) li.tabIndex = 0;
        li.replaceChildren();
        this.parent.state.columns.forEach((col, colIndex) => {
            if (colIndex > 0) li.appendChild(document.createTextNode(' | '));
            const strong = document.createElement('strong');
            strong.textContent = `${this.parent.state.columnTitles[colIndex] ?? col}:`;
            li.appendChild(strong);
            li.appendChild(document.createTextNode(' '));
            const value = document.createElement('span');
            value.innerHTML = this.parent.getFormattedValue(row[col as keyof T], col, row, index);
            li.appendChild(value);
        });
    }

    #createMobileCard(row: T, index: number): HTMLDivElement {
        const card = document.createElement('div');
        card.classList.add(config.classes.mobileCard);
        card.setAttribute('role', 'rowgroup');
        this.#updateMobileCard(card, row, index);
        return card;
    }

    #updateMobileCard(div: HTMLDivElement, row: T, index: number): void {
        div.setAttribute('data-index', index.toString());
        if (this.parent.selectable) div.tabIndex = 0;
        div.replaceChildren();
        this.parent.state.columns.forEach((col, colIndex) => {
            const cardRow = document.createElement('div');
            cardRow.classList.add(config.classes.cardRow);
            cardRow.setAttribute('role', 'row');

            const label = document.createElement('span');
            label.classList.add(config.classes.cardLabel);
            label.setAttribute('role', 'columnheader');
            label.textContent = `${this.parent.state.columnTitles[colIndex] ?? col}:`;

            const value = document.createElement('span');
            value.classList.add(config.classes.cardValue);
            value.setAttribute('role', 'cell');
            value.innerHTML = this.parent.getFormattedValue(row[col as keyof T], col, row, index);

            cardRow.append(label, value);
            div.appendChild(cardRow);
        });
    }

    #createPaginationButton(
        content: string,
        type: ButtonType,
        options: { disabled?: boolean; active?: boolean; page?: number | string } = {}
    ): HTMLButtonElement {
        const button = document.createElement('button');
        button.type = 'button';
        button.disabled = Boolean(options.disabled);

        const typeConfig =
            type === 'prev'
                ? this.parent.prevButtonConfig
                : type === 'next'
                  ? this.parent.nextButtonConfig
                  : config.pagination.numberButton;

        const classNames = typeConfig.classNames as {
            base: string;
            disabled?: string;
            active?: string;
        };

        button.classList.add(classNames.base);
        if (options.disabled && classNames.disabled) {
            button.classList.add(classNames.disabled);
        }
        if (options.active && classNames.active) {
            button.classList.add(classNames.active);
        }
        if (options.active) {
            button.setAttribute('aria-current', 'page');
        }
        if (options.page !== undefined) {
            button.dataset.page = String(options.page);
        }

        const buttonOptions =
            type === 'prev'
                ? this.parent.prevButtonConfig
                : type === 'next'
                  ? this.parent.nextButtonConfig
                  : undefined;
        const rendered =
            buttonOptions?.template && options.page !== undefined
                ? buttonOptions.template(options.page)
                : content;
        const isHtml = Boolean(buttonOptions?.isHtml);
        if (type !== 'number' && isHtml) {
            button.innerHTML = sanitizeHTML(rendered);
        } else {
            button.textContent = rendered;
        }
        if (type === 'prev') {
            button.setAttribute('aria-label', this.parent.state.translations!.previous);
        } else if (type === 'next') {
            button.setAttribute('aria-label', this.parent.state.translations!.next);
        }
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
            const key = `${item.id}:${index}`;
            const existingEl = domMap.get(key);
            let elToAppend: K;

            if (existingEl) {
                updateFn(existingEl, item, index);
                elToAppend = existingEl;
                elToAppend.setAttribute('data-key', key);
                domMap.delete(existingEl.dataset.key!);
            } else {
                // Create new element
                elToAppend = renderer(item, index);
                elToAppend.setAttribute('data-key', key);
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
        this.parent.log(LogLevel.INFO, 'Rendering "no data available" message.');
        const isTable = container.tagName === 'TBODY';
        const isList = container.tagName === 'UL';
        const noDataEl = document.createElement(isTable ? 'tr' : isList ? 'li' : 'div');
        const contentEl = document.createElement(isTable ? 'td' : 'div');
        if (isTable) (contentEl as HTMLTableCellElement).colSpan = colSpan;
        contentEl.classList.add(config.classes.noData);
        contentEl.textContent = this.parent.state.translations!.noDataAvailable;
        noDataEl.appendChild(contentEl);
        container.appendChild(noDataEl);
    }

    // Updates the footer with totals and pagination
    #updateFooter(): void {
        if (this.tableElement) {
            const footerCell = this.tableElement.querySelector<HTMLTableCellElement>('tfoot td');
            if (footerCell) {
                footerCell.colSpan = this.parent.state.columns.length;
            }
        }
        const footerTarget =
            this.parent.state.format === RenderType.TABLE
                ? this.tableElement?.querySelector(`.${config.classes.footerContainer}`)
                : this.footerElement;
        if (!footerTarget || !this.parent.state.translations) return;

        footerTarget.innerHTML = '';
        this.totalsElement = this.#createTotalsElement();
        this.paginationElement = this.#createPaginationElement();
        footerTarget.appendChild(this.totalsElement);
        footerTarget.appendChild(this.paginationElement);
    }

    // Creates the table structure for table rendering mode
    #renderTableStructure(): void {
        this.parent.log(LogLevel.LOG, 'Rendering main table structure.');
        // Create responsive wrapper
        const responsiveWrapper = document.createElement('div');
        responsiveWrapper.classList.add(config.classes.tableResponsive);
        // Create table element
        this.tableElement = document.createElement('table');
        addClassTokens(this.tableElement, config.classes.table.containerClass);
        this.tableElement.setAttribute('role', 'grid');
        responsiveWrapper.appendChild(this.tableElement);
        this.contentContainer.appendChild(responsiveWrapper);

        // Create table header
        this.tableHeader = this.tableElement.createTHead();
        addClassTokens(this.tableHeader, config.classes.table.headerClass);

        // Create table body
        this.tableBody = this.tableElement.createTBody();
        addClassTokens(this.tableBody, config.classes.table.bodyClass);

        // Create table footer
        const tfoot = this.tableElement.createTFoot();
        addClassTokens(tfoot, config.classes.table.footerClass);
        const footerRow = tfoot.insertRow();
        const footerCell = footerRow.insertCell();
        footerCell.colSpan = this.parent.state.columns.length;
        const footerDiv = document.createElement('div');
        footerDiv.classList.add(config.classes.footerContainer);
        footerCell.appendChild(footerDiv);
    }

    // Creates the cards structure for mobile cards rendering mode
    #renderCardsStructure(): void {
        this.parent.log(LogLevel.LOG, 'Rendering main cards structure.');
        this.cardsContainer = document.createElement('div');
        this.cardsContainer.classList.add(config.classes.mobileCardsContainer);
        this.contentContainer.appendChild(this.cardsContainer);
        this.#renderNonTableFooter();
    }

    // Creates the list structure for list rendering mode
    #renderListStructure(): void {
        this.parent.log(LogLevel.LOG, 'Rendering main list structure.');
        this.listContainer = document.createElement('ul');
        addClassTokens(this.listContainer, config.classes.list.containerClass);
        this.contentContainer.appendChild(this.listContainer);
        this.#renderNonTableFooter();
    }

    // Renders the table header contents
    #renderTableHeaderContents(): void {
        const translations = this.parent.state.translations;
        if (!this.tableHeader || !translations) return;
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
            const title = String(this.parent.state.columnTitles[idx] ?? col);
            const headerClass = this.parent.state.headerCellClasses[idx];
            if (headerClass) th.className = headerClass;

            // Check if the column is sortable
            const isSortable = !headerClass?.split(/\s+/).includes('no-sorting');
            if (isSortable) {
                const button = document.createElement('button');
                button.type = 'button';
                button.textContent = title;

                // Apply sorting indicators
                const sortItem = this.parent.state.sorting.find((item) => item[0] === col);
                if (sortItem) {
                    const sortClass =
                        sortItem[1] === OrderDirection.ASC
                            ? config.classes.sortAscOrder
                            : config.classes.sortDescOrder;
                    button.classList.add(sortClass);
                    th.setAttribute(
                        'aria-sort',
                        sortItem[1] === OrderDirection.ASC ? 'ascending' : 'descending'
                    );
                    button.setAttribute(
                        'aria-label',
                        `${title}: ${
                            sortItem[1] === OrderDirection.ASC
                                ? translations.sortDescending
                                : translations.removeSort
                        }`
                    );
                } else {
                    button.classList.add(config.classes.sortNoOrder);
                    th.setAttribute('aria-sort', 'none');
                    button.setAttribute('aria-label', `${title}: ${translations.sortAscending}`);
                }
                th.appendChild(button);
            } else {
                th.textContent = title;
            }

            // Enable dragging if configured
            if (this.parent.draggableColumns) {
                th.setAttribute('draggable', 'true');
                th.classList.add(config.classes.draggableColumn);
                th.title = translations.dragColumn.replace('{col}', title);
            }

            // Add resize handle
            const resizeHandle = document.createElement('div');
            resizeHandle.className = config.classes.columnResizeHandle;
            resizeHandle.setAttribute('role', 'separator');
            resizeHandle.setAttribute('aria-orientation', 'vertical');
            resizeHandle.setAttribute('aria-label', translations.columnResizeHandle);
            th.appendChild(resizeHandle);
            headerRow.appendChild(th);
        });
    }

    // Creates the pagination element
    #createPaginationElement(): HTMLElement {
        const parentState = this.parent.state;
        const rpp = Math.max(1, parentState.rowsPerPage || 1);
        const totalPages = Math.max(1, Math.ceil(parentState.totalRecords / rpp) || 1);
        const paginationContainer = document.createElement('nav');
        paginationContainer.classList.add(config.classes.paginationContainer);
        paginationContainer.setAttribute('aria-label', parentState.translations!.pageNavigation);

        paginationContainer.appendChild(
            this.#createPaginationButton(
                this.parent.prevButtonConfig.text || parentState.translations!.previous,
                'prev',
                {
                    disabled: parentState.currentPage === 1,
                    page: Math.max(1, parentState.currentPage - 1),
                }
            )
        );

        const range = config.constants.paginationPageRange;
        const startPage = Math.max(1, parentState.currentPage - range);
        const endPage = Math.min(totalPages, parentState.currentPage + range);

        if (startPage > 1) {
            paginationContainer.appendChild(
                this.#createPaginationButton('1', 'number', {
                    active: parentState.currentPage === 1,
                    page: 1,
                })
            );
            if (startPage > 2) this.#appendPaginationEllipsis(paginationContainer);
        }

        for (let i = startPage; i <= endPage; i++) {
            paginationContainer.appendChild(
                this.#createPaginationButton(i.toString(), 'number', {
                    active: i === parentState.currentPage,
                    page: i,
                })
            );
        }

        if (endPage < totalPages) {
            if (endPage < totalPages - 1) this.#appendPaginationEllipsis(paginationContainer);
            paginationContainer.appendChild(
                this.#createPaginationButton(totalPages.toString(), 'number', {
                    active: parentState.currentPage === totalPages,
                    page: totalPages,
                })
            );
        }

        paginationContainer.appendChild(
            this.#createPaginationButton(
                this.parent.nextButtonConfig.text || parentState.translations!.next,
                'next',
                {
                    disabled: parentState.currentPage === totalPages,
                    page: Math.min(totalPages, parentState.currentPage + 1),
                }
            )
        );

        return paginationContainer;
    }

    #appendPaginationEllipsis(container: HTMLElement): void {
        const ellipsis = document.createElement('span');
        ellipsis.textContent = '...';
        ellipsis.setAttribute('aria-hidden', 'true');
        ellipsis.classList.add(config.pagination.ellipsis.classNames.base);
        container.appendChild(ellipsis);
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
        const showingRecords =
            typeof parentState.translations!.pagination.showingRecords === 'string'
                ? parentState.translations!.pagination.showingRecords
                : defaultTranslations.pagination.showingRecords;
        const placeholders: Record<string, { className: string; value: string }> = {
            '{start}': { className: config.classes.recordStart, value: String(startRecord) },
            '{end}': { className: config.classes.recordEnd, value: String(endRecord) },
            '{total}': {
                className: config.classes.recordsTotal,
                value: String(parentState.totalRecords),
            },
        };
        showingRecords.split(/(\{start\}|\{end\}|\{total\})/).forEach((part) => {
            const token = placeholders[part];
            if (token) {
                const span = document.createElement('span');
                span.className = token.className;
                span.textContent = token.value;
                totalsDiv.appendChild(span);
            } else if (part) {
                totalsDiv.appendChild(document.createTextNode(part));
            }
        });
        return totalsDiv;
    }

    // Ensures the correct container is used for the current rendering mode
    #ensureCorrectContainer(format: RenderType): void {
        this.parent.log(LogLevel.LOG, `Ensuring correct container for format: ${format}`);
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
        if (this.footerElement) {
            this.footerElement.style.display = listVisible || cardsVisible ? '' : 'none';
        }
    }
}

/*========================================================================================================
    SNAP RENDERER CLASS ENDS HERE
==========================================================================================================*/
