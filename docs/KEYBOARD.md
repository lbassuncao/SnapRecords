# Keyboard Navigation in SnapRecords

This document outlines the keyboard navigation options available in the SnapRecords data grid library.

Keyboard navigation is implemented in the `EventManager` class and supports pagination and row selection interactions.

The functionality is divided into pagination navigation (always available) and row navigation/selection (available when the `selectable` option is enabled).

## Prerequisites

- The SnapRecords container must be focused to receive keyboard events. The container is made focusable by setting `tabindex="0"` during initialization in `EventManager.ts`.
- For row navigation and selection, the `selectable` configuration option must be set to `true`.
- The `snap-records.css` file must be included to apply styles for highlighted rows (`snap-current-row`, `snap-selected`).

## Keyboard Controls

### Pagination Navigation

These keys are always available when the SnapRecords instance is focused, allowing users to navigate between pages of data.

| Key | Action |
|-----|--------|
| `PageUp` | Navigates to the previous page if the current page is greater than 1. |
| `PageDown` | Navigates to the next page if the current page is less than the total number of pages (calculated as `Math.ceil(totalRecords / rowsPerPage)`). |

### Row Navigation and Selection

These keys are available only when the `selectable` option is enabled, allowing users to navigate and select rows in the data grid.

| Key | Action |
|-----|--------|
| `ArrowDown` | Moves the focus to the next row in the data grid, highlighting it as the current row with the `snap-current-row` class. The focus is constrained to the last row if already at the end. |
| `ArrowUp` | Moves the focus to the previous row in the data grid, highlighting it as the current row with the `snap-current-row` class. The focus is constrained to the first row if already at the start. |
| `Home` | Resets the SnapRecords instance to its initial state (clearing filters, sorting, and selections), as implemented in `SnapRecords.reset()`. |
| `End` | Moves the focus to the last row in the data grid, highlighting it with the `snap-current-row` class. |
| `Enter` | Toggles the selection of the currently focused row. If selected, it deselects the row; if not selected, it selects the row with the `snap-selected` class. Triggers the `selectionChanged` lifecycle hook and announces the change to screen readers. |
| `Space` | Same as `Enter`: toggles the selection of the currently focused row. |

## Keyboard Compatibility by Render Mode

| Key | TABLE | LIST | MOBILE_CARDS |
|-----|-------|------|--------------|
| `PageUp` | Yes | Yes | Yes |
| `PageDown` | Yes | Yes | Yes |
| `ArrowDown` | Yes | Yes | Yes |
| `ArrowUp` | Yes | Yes | Yes |
| `Home` | Yes (resets state) | Yes (resets state) | Yes (resets state) |
| `End` | Yes | Yes | Yes |
| `Enter` | Yes | Yes | Yes |
| `Space` | Yes | Yes | Yes |

## Testing Accessibility

To test keyboard navigation with a screen reader:

1. Use NVDA (Windows) or VoiceOver (macOS).
2. Focus the SnapRecords container with `Tab` or programmatically with `snapRecords.container.focus()`.
3. Use `ArrowDown` to navigate rows and `Enter` to select. Verify that "Row selected" or "Row deselected" is announced via the `announceScreenReaderUpdate` method in `SnapRenderer.ts`.
4. Use `PageUp`/`PageDown` to navigate pages and confirm page changes are announced.

Programmatically focus the container:

```typescript
const snapRecords = new SnapRecords('containerId', {
    url: 'http://example.com/api/data',
    columns: ['id', 'name'],
    selectable: true,
});
snapRecords.container.focus();
```

## Additional Notes

- **Accessibility**: When a row is selected or deselected, a screen reader announcement is made using the `announceScreenReaderUpdate` method in `SnapRenderer.ts`, using translations for `rowSelected` or `rowDeselected`.
- **Event Handling**: Keyboard events are handled in the `#handleKeyDown` method of the `EventManager` class. The container must be focused (e.g., via `tabindex="0"`) for these events to be captured.
- **Prevent Default**: All keyboard actions prevent the default browser behavior to ensure consistent interaction within the data grid.
- **Row Highlighting**: The currently focused row is highlighted with the `snap-current-row` class, and selected rows are highlighted with the `snap-selected` class. The focused row is also scrolled into view using `scrollIntoView({ block: 'nearest' })`. These styles are defined in `snap-records.css`.
- **CSS Requirement**: Ensure the `snap-records.css` file is included to apply the necessary styles for visual feedback during navigation and selection.

## Example Usage

To enable keyboard navigation, ensure the SnapRecords instance is configured with `selectable: true` for row navigation and selection, and include the CSS file:

```html
<link rel="stylesheet" href="/path/to/snap-records.css">
```

```typescript
import { SnapRecords, RenderType, RowsPerPage } from './SnapRecords';

const snapRecords = new SnapRecords('containerId', {
    url: 'http://example.com/api/data',
    columns: ['id', 'name'],
    selectable: true,
});
```

Then, focus the container (e.g., by clicking it, using the `Tab` key, or programmatically with `snapRecords.container.focus()`) to start using the keyboard controls.

## Support

For issues, feature requests, or questions, please open an issue on the repository or contact the maintainer.