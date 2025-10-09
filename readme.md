# wc-data-viewer

A vanilla JavaScript web component for viewing tabular data with support for multi-index structures.

## Features

- Filter and sort rows/columns
- Multi-index support for both rows and columns
- Record view for detailed row inspection
- Column visibility controls
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

## CSS Custom Properties

```css
data-viewer {
    --cursor: pointer;
    --border-color: currentColor;
    --axes-width: 2px;
}
```

## Events

- `data-changed` - Fired when data is loaded/updated
- `cell-click` - Fired on cell interaction
- `field-click` - Fired on record field interaction

## Data Format

Expected JSON structure:
```json
{
    "columns": ["col1", "col2"],
    "index": ["row1", "row2"],
    "values": [[val1, val2], [val3, val4]],
    "dtypes": ["int", "float"],
    "columnNames": ["Columns"],
    "indexNames": ["Index"]
}
```

Multi-index uses nested arrays for `columns` and `index`.

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
