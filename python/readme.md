# flatbread-dataviewer

Pandas accessor for rendering DataFrames and Series
with the `<data-viewer>` web component.

## Usage

```python
import flatbread_dataviewer

df.viewer                # render in Jupyter
df.viewer.get_json()     # JSON string for use with <data-viewer>
df.viewer.data_spec      # raw dict before serialization
```

## Format options

Per-column formatting is set via `df.viewer.format_options`:

```python
df.viewer.format_options = {
    "revenue": {"decimals": 2, "prefix": "€"},
    "growth":  {"decimals": 1, "suffix": "%"},
}
```

For MultiIndex columns, keys can be tuple prefixes. Given a column
`("Sales", "Q1", "Actual")`, the accessor resolves in order:

1. `("Sales", "Q1", "Actual")` — exact match
2. `("Sales", "Q1")` — prefix
3. `"Sales"` — first-level prefix

Format options are stored in `df.attrs` and survive copy
operations, but not pickling or parquet serialization.

## Jupyter integration

In Jupyter, `df.viewer` renders an interactive `<data-viewer>`
inline. The web component is loaded from GitHub Pages, so an
internet connection is required.

Built-in clipboard behavior:
- Click a cell or record field → copies value
- Shift+click a row → copies row values (semicolon-separated)
- Ctrl+click a column → copies column values (semicolon-separated)

## Data spec

`df.viewer.data_spec` returns a dict with this shape:

```json
{
    "values": [[...], ...],
    "columns": {
        "values": [...],
        "names": [...],
        "dtypes": [...],
        "formatOptions": [...]
    },
    "index": {
        "values": [...],
        "names": [...],
        "dtypes": [...],
        "formatOptions": [...]
    }
}
```

Recognized dtypes: `"int"`, `"float"`, `"date"`, `"datetime"`, or
`null` (string/other). Datetime columns where all times are midnight
are classified as `"date"`.

## Dependencies

- pandas
- jinja2
