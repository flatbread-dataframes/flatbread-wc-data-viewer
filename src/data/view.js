import { Columns } from "../axis/columns.js"
import { Index } from "../axis/index.js"
import { createComparator, sortComparator } from "./compare.js"
import { createPredicate } from "./filter.js"

// Keys of filters and sort: data ilocs and index levels, so hiding columns does not move them
export const columnKey = iloc => `col:${iloc}`
export const levelKey = level => `level:${level}`

const parseKey = key => {
    const [axis, n] = key.split(":")
    return [axis, Number(n)]
}

export class View {
    constructor(data, { locale = "default" } = {}) {
        this.data = data
        this._locale = locale
        this._filters = new Map()   // key → expression
        this._sort = null           // { key, direction }

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

    // Column selection: does not change which rows are visible
    filterColumns(columnIndices) {
        this._visibleColumnIndices = columnIndices
        this.invalidateCache()
        return this
    }

    // MARK: filters and sort
    get locale() {
        return this._locale
    }

    // The sort order depends on the locale
    set locale(value) {
        this._locale = value
        if (this._sort) this.update()
    }

    get hasFilters() {
        return this._filters.size > 0
    }

    filterFor(key) {
        return this._filters.get(key) ?? ""
    }

    setFilter(key, expression) {
        if (expression.trim()) this._filters.set(key, expression)
        else this._filters.delete(key)
        this.update()
    }

    clearFilters() {
        this._filters.clear()
        this.update()
    }

    get sort() {
        return this._sort
    }

    // { key, direction } or null
    set sort(sort) {
        this._sort = sort
        this.update()
    }

    sortStateFor(key) {
        return this._sort?.key === key ? this._sort.direction : "none"
    }

    // The only place that computes the visible rows from the filters and the sort
    update() {
        const predicate = createPredicate(this._filters, key => this.valueGetter(key))
        const ilocs = this.data.index.ilocs
        this._visibleIndices = predicate ? ilocs.filter(predicate) : ilocs
        if (this._sort) this.sortRows(this._sort)
        this.invalidateCache()
    }

    sortRows({ key, direction }) {
        const valueAt = this.valueGetter(key)
        const compare = sortComparator(createComparator(this.dtypeOf(key), this.locale), direction)
        this._visibleIndices.sort((a, b) => compare(valueAt(a), valueAt(b)))
    }

    // A function data iloc → the key's value in that row
    valueGetter(key) {
        const [axis, n] = parseKey(key)
        if (axis === "col") {
            const { values } = this.data
            return i => values[i][n]
        }
        const { values } = this.data.index
        return i => Array.isArray(values[i]) ? values[i][n] : values[i]
    }

    dtypeOf(key) {
        const [axis, n] = parseKey(key)
        const { dtypes } = axis === "col" ? this.data.columns : this.data.index
        return dtypes?.[n]
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
