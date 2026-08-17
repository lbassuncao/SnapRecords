# Keyboard Navigation in SnapRecords

Keyboard handling lives in `EventManager.#handleKeyDown`. The container is given `tabindex="0"` so it can receive focus.

Pagination keys always work. Row keys require `selectable: true`.

This document describes **1.20.0**. Pagination calls `setCurrentPage()`. `Home` and `End` move the current row. See [RELEASES.md](../RELEASES.md).

## Prerequisites

- Focus the SnapRecords container (`Tab`, click, or `snapRecords.container.focus()`).
- Include `snap-records.css` (`.snap-current-row`, `.snap-selected`). Keyboard current-row highlighting applies in table, list, and card modes.
- Set `selectable: true` for row navigation and selection.

## Pagination (always)

| Key        | Action                                                                                                             |
| ---------- | ------------------------------------------------------------------------------------------------------------------ |
| `PageUp`   | `setCurrentPage(currentPage - 1)` when `currentPage > 1`                                                           |
| `PageDown` | `setCurrentPage(currentPage + 1)` when there is a next page (`Math.max(1, Math.ceil(totalRecords / rowsPerPage))`) |

## Rows (`selectable: true`)

| Key               | Action                                                                                                 |
| ----------------- | ------------------------------------------------------------------------------------------------------ |
| `ArrowDown`       | Next row (`.snap-current-row`, `scrollIntoView`); from no current row, selects the first row           |
| `ArrowUp`         | Previous row; ignored when there is no current row (`currentRowIndex === -1`)                          |
| `Home`            | First row                                                                                              |
| `End`             | Last row                                                                                               |
| `Enter` / `Space` | Toggle selection on the current row (`.snap-selected`, `selectionChanged`, screen-reader announcement) |

All of these `preventDefault()` so the page does not scroll. Keys are ignored when the event comes from `input`, `textarea`, `select`, `button`, `a`, or `[contenteditable]:not([contenteditable="false"])` content inside the grid.

## Render modes

| Key                     | `TABLE` | `LIST` | `MOBILE_CARDS` |
| ----------------------- | ------- | ------ | -------------- |
| `PageUp` / `PageDown`   | Yes     | Yes    | Yes            |
| `ArrowDown` / `ArrowUp` | Yes     | Yes    | Yes            |
| `Home`                  | Yes     | Yes    | Yes            |
| `End`                   | Yes     | Yes    | Yes            |
| `Enter` / `Space`       | Yes     | Yes    | Yes            |

## Example

```typescript
import { SnapRecords } from 'snap-records';
import 'snap-records/style.css';

const snapRecords = new SnapRecords('containerId', {
    url: 'https://api.example.com/data',
    columns: ['id', 'name'],
    selectable: true,
});

snapRecords.container.focus();
```

You can pass an `HTMLElement` instead of an id: `new SnapRecords(containerEl, { ... })`.

## Screen readers

`SnapRenderer.announceScreenReaderUpdate()` uses an ARIA live region. Selection announces `rowSelected` / `rowDeselected` from the active translation file.

With NVDA or VoiceOver: focus the container, `ArrowDown` through rows, `Enter` to select, `PageUp` / `PageDown` to change page.
