import { Columns } from "../axis/columns.js"
import { Index } from "../axis/index.js"
import { createComparator, sortComparator } from "./compare.js"

export class View {
    constructor(data, { locale = "default" } = {}) {
        this.data = data
        this.locale = locale

        this._visibleIndices = null
        this._visibleColumnIndices = null
        this._viewIndex = null
        this._viewColumns = null
    }

    get visibleIndices() {
        if (this._visibleIndices === null) {
            this._visibleIndices = [...this.data.index.ilocs]
        }
        return this._visibleIndices
    }

    get columns() {
        if (this._visibleColumnIndices === null) {
            return this.data.columns
        }
        if (this._viewColumns) return this._viewColumns
        const src = this.data.columns
        return this._viewColumns = new Columns({
            values: this._visibleColumnIndices.map(i => src.values[i]),
            names: src.names,
            dtypes: this._visibleColumnIndices.map(i => src.dtypes?.[i]),
            formatOptions: this._visibleColumnIndices.map(i => src.formatOptions?.[i]),
            nlevels: src.nlevels,
        })
    }

    get index() {
        if (this._viewIndex) return this._viewIndex
        const src = this.data.index
        return this._viewIndex = new Index({
            values: this.visibleIndices.map(i => src.values[i]),
            names: src.names,
            dtypes: src.dtypes,
            formatOptions: src.formatOptions,
            nlevels: src.nlevels,
        })
    }

    get groupingLevels() {
        return this.index.groupingLevels
    }

    // All rows of the view: builds a new array on every access, so prefer valuesSlice for a part
    get values() {
        return this.valuesSlice(0, this.length)
    }

    // View rows [start, end), restricted to the visible columns
    valuesSlice(start, end) {
        const rows = this.visibleIndices.slice(start, end).map(i => this.data.values[i])
        if (this._visibleColumnIndices === null) return rows
        return rows.map(row => this._visibleColumnIndices.map(col => row[col]))
    }

    // Filtering methods
    filter(predicate) {
        this._visibleIndices = this.data.index.ilocs.filter(i => predicate(this.data.values[i], i))
        this.invalidateCache()
        return this
    }

    filterColumns(columnIndices) {
        this._visibleColumnIndices = columnIndices
        this.invalidateCache()
        return this
    }

    // Sorting methods
    sortByColumn(columnIndex, direction = "asc") {
        const iloc = this.getOriginalColumnIndex(columnIndex)
        return this.sortRows(i => this.data.values[i][iloc], this.data.columns.dtypes?.[iloc], direction)
    }

    sortByIndex(level = -1, direction = "asc") {
        const { values, dtypes } = this.data.index
        const valueAt = i => Array.isArray(values[i]) ? values[i].at(level) : values[i]
        return this.sortRows(valueAt, dtypes?.at(level), direction)
    }

    // Sorts the visible rows by one value per data row (valueAt takes a data iloc)
    sortRows(valueAt, dtype, direction) {
        const compare = sortComparator(createComparator(dtype, this.locale), direction)
        this.visibleIndices.sort((a, b) => compare(valueAt(a), valueAt(b)))
        this.invalidateCache()
        return this
    }

    // Reset to original order
    reset() {
        this._visibleIndices = [...this.data.index.ilocs]
        this.invalidateCache()
        return this
    }

    // Clear cached computed properties
    invalidateCache() {
        this._viewIndex = null
        this._viewColumns = null
    }

    // Utility methods
    get length() {
        return this.visibleIndices.length
    }

    isVisible(originalIndex) {
        return this.visibleIndices.includes(originalIndex)
    }

    getOriginalIndex(viewIndex) {
        return this.visibleIndices[viewIndex]
    }

    getOriginalColumnIndex(viewColIndex) {
        return this._visibleColumnIndices
            ? this._visibleColumnIndices[viewColIndex]
            : viewColIndex
    }
}
