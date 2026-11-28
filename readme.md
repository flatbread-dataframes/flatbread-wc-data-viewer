# wc-data-viewer

A vanilla JavaScript web component for viewing tabular data with support for multi-index structures.

## Features

- Filter and sort rows/columns
- Multi-index support for both rows and columns
- Record view for detailed row inspection
- Column visibility controls
- Cell layout control: no-wrap or truncate
- Keyboard navigation
- Locale-aware number/date formatting

## Usage

```html
<data-viewer 
    src="data/example.json"
    locale="nl-NL"
    height="600px">
</data-viewer>
```

Load the component:
```html
<script type="module" src="src/viewer.js"></script>
```

## Attributes

- `src` - JSON data source URL
- `locale` - Format locale (default: "default")
- `na-rep` - Null value representation (default: "-")
- `height` - Component height (default: "600px")
- `view` - Display mode: "table" or "record"
- `hide-group-borders` - Hide column group borders
- `hide-row-borders` - Hide row borders
- `hide-index-border` - Hide index/data separator
- `hide-thead-border` - Hide header border
- `hide-filter-row` - Hide filter inputs
- `cell-layout` - Cell layout: "no-wrap" (default, columns fit their widest value) or "truncate" (columns fit their header; longer text is cut off with an ellipsis, numbers and dates are never cut off)

## CSS Custom Properties

```css
data-viewer {
    --cursor: pointer;
    --border-color: currentColor;
    --axes-width: 2px;
}
```

## Events

Events identify rows and columns by their label and their position in the data, never by their position on screen, so they stay valid when rows are sorted or filtered and columns are hidden:

```js
{ loc, iloc }   // loc: the label (a tuple on a multi-index); iloc: the position in the data (pandas iloc)
```

A level is identified the same way: `{ loc: name, iloc: level }` (`loc` is `null` for an unnamed level). A group (an upper level of a multi-index) has only `loc`, its leading part of the tuple, since the rows or columns in a group need not be adjacent in the data.

`value` is the raw value from the data and `text` is the text as shown (formatted).

| Event | When | `detail` |
|---|---|---|
| `data-changed` | Data loaded or updated | The `Data` object |
| `cell-click` | Click on a cell | `{ source, value, text, ... }`, see below |
| `row-data` | Shift+click on a row | `{ row, columns, values }` |
| `column-data` | Ctrl+click on a column | `{ column, dtype, rows, values }`; on an index level `{ level, dtype, rows, values }` |
| `field-click` | Click on a field in the record view | `{ source, value, text, dtype, row, column }` |

`cell-click` by `source`:

| `source` | Cell | Also in `detail` |
|---|---|---|
| `"values"` | A value | `row`, `column` |
| `"index"` | An index value | `row`, `level`; a group cell has `row: { loc }` |
| `"column"` | A column label | `column`; a group label has `column: { loc }` and `level` |
| `"index-name"`, `"column-name"` | A level name | `level` |

`row-data` and `column-data` hold what is shown: the visible columns and the rows under the current filters, in the order on screen. `columns` and `rows` are the identities of the entries in `values`, in the same order. In `field-click`, `value` and `text` are those of the field's value, also when its label is clicked (`source`: `"field-label"` or `"field-value"`).

## API

Filters, sort and columns are set and read by label, like the identities in the events.

- A **column** is its label: a scalar on a flat axis, a tuple on a multi-index (`["2024", "Q1"]`). On a multi-index a shorter tuple is a group (`["2024"]`: every column under 2024).
- An **index level** is `{ level: name }` or `{ ilevel: n }` (its position; for unnamed levels or repeated names).
- Labels match exactly: `2024` and `"2024"` are different labels.
- Unknown labels are left out with a `console.warn`. A filter or sort on a repeated column label uses the first match (warned); a column selection takes every match.

```js
viewer.selectedColumns = ["naam", "jaar"]          // the visible columns; [] shows only the index, null all columns
viewer.hideColumns([["organisatie"]])               // a group on a multi-index
viewer.showColumns(["jaar"])

viewer.filters = [{ column: "jaar", expression: "2023, 2024" }, { level: "land", expression: "NL" }]
viewer.setFilter({ ilevel: 0 }, "a")                // a blank expression removes the filter
viewer.clearFilters()

viewer.sort = { column: "jaar", direction: "desc" } // "asc" or "desc"; null for no sort

// All of it as plain data, e.g. for a quick selection or a saved setting
const saved = viewer.state                          // { columns, filters, sort }
viewer.state = { columns: ["naam"] }                // partial: keys left out are kept
viewer.state = saved                                // one update and one render
```

| Property / method | Value |
|---|---|
| `selectedColumns` | Labels of the visible columns, in data order |
| `hideColumns(labels)`, `showColumns(labels)` | Hide or show columns or groups |
| `filters` | `[{ column \| level \| ilevel, expression }]`; the getter names a level by its name when the name is unique |
| `setFilter(target, expression)`, `clearFilters()` | One filter; all filters |
| `sort` | `{ column \| level \| ilevel, direction }` or `null` |
| `state` | `{ columns, filters, sort }`; setting it applies the keys that are given |
| `currentRecord` | The record shown in the record view: `{ row, values }`, `values` as shown |
| `currentRecordIndex` | Position of that record in the view (the record view's navigation state; changes with sorting and filtering) |

State set before the data arrives is kept and applied to the data when it arrives; until then the getters return it as it was set (`selectedColumns` is `null` when hide or show was called, and `state` has only the keys that were set). New data resets filters, sort and columns.

## Data Format

```json
{
    "columns": {
        "values": ["col1", "col2"],
        "names": ["Columns"],
        "dtypes": ["int", "float"],
        "formatOptions": [null, { "maximumFractionDigits": 1 }]
    },
    "index": {
        "values": ["row1", "row2"],
        "names": ["Index"],
        "dtypes": ["str"],
        "formatOptions": [null]
    },
    "values": [[1, 2.5], [3, 4.25]]
}
```

- A multi-index uses arrays as labels in `values` (`["A", "x"]`), with one name per level in `names`.
- `columns.dtypes` and `columns.formatOptions` have one entry per column; `index.dtypes` and `index.formatOptions` one per level.
- Dtypes with their own formatting and sorting: `int`, `float`, `date`, `datetime`; anything else is text. `formatOptions` are passed to `Intl.NumberFormat` or `Intl.DateTimeFormat`.
- Only `values` is required; `names`, `dtypes` and `formatOptions` are optional.

## Keyboard Shortcuts

- `Ctrl+F` - Focus first filter
- `Ctrl+H` - Toggle filter row
- `Ctrl+R` - Toggle table/record view
- `Escape` - Clear all filters
- Arrow keys - Navigate between elements

## Browser Support

Modern browsers with ES6 module support and Custom Elements v1.

## Dependencies

None. Pure vanilla JavaScript.
