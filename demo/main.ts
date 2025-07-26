// demo/main.ts
import {
    RenderType,
    SnapRecords,
    RowsPerPage
} from '../src';
// 1. Import SnapRecords and its styles
import '../src/scss/SnapRecords.scss';


// 2. Define the URL of our simulated API
// This is the URL that our middleware
// in vite.config.demo.ts is "listening" to.
const dataUrl = '/api/books';

// 3. Initialize the different instances

// Instance 1: Full interactive table
new SnapRecords('container-table', {
    debug: true,
    url: dataUrl,
    selectable: true,
    draggableColumns: true,
    rowsPerPage: RowsPerPage.DEFAULT,
    columns: ['id', 'title', 'name', 'published'],
    columnTitles: ['Id', 'Title', 'Name', 'Publication']
});

// Instance 2: List Mode
new SnapRecords('container-list', {
    url: dataUrl,
    format: RenderType.LIST,
    columns: ['title', 'name', 'published'],
    columnTitles: ['Title', 'Name', 'Publication']
});

// Instance 3: Card Mode
new SnapRecords('container-cards', {
    url: dataUrl,
    format: RenderType.MOBILE_CARDS,
    columns: ['title', 'name', 'published'],
    columnTitles: ['Title', 'Name', 'Publication']
});