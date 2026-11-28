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

        // Source ilocs of the visible rows, in view order; written only by update()
        this._visibleIndices = data.index.ilocs
        this._visibleColumnIndices = null
        this._viewIndex = null
        this._viewColumns = null
    }

    // The view's axes: their sourceIlocs map view positions to positions in the data
    get columns() {
        if (this._visibleColumnIndices === null) return this.data.columns
        return this._viewColumns ??= this.data.columns.take(this._visibleColumnIndices)
    }

    get index() {
        return this._viewIndex ??= this.data.index.take(this._visibleIndices)
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
        const rows = this._visibleIndices.slice(start, end).map(i => this.data.values[i])
        if (this._visibleColumnIndices === null) return rows
        return rows.map(row => this._visibleColumnIndices.map(col => row[col]))
    }

    // Column selection, as source ilocs (null: all columns); does not change which rows are visible
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

    // key → expression; a copy
    get filters() {
        return new Map(this._filters)
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

    // Replaces the filters (a Map key → expression) and/or the sort in one update; what is left out is kept
    setState({ filters, sort } = {}) {
        if (filters !== undefined) {
            this._filters = new Map([...filters].filter(([, expression]) => expression.trim()))
        }
        if (sort !== undefined) this._sort = sort
        this.update()
    }

    // MARK: targets
    // Key of a target of the public API: { column: label } (the first match), { level: name } or { ilevel: n };
    // null when unknown
    keyOf(target) {
        if ("column" in target) {
            const [iloc] = this.data.columns.locate(target.column)
            return iloc === undefined ? null : columnKey(iloc)
        }
        if ("level" in target) {
            const level = this.data.index.levelOf(target.level)
            return level === -1 ? null : levelKey(level)
        }
        if ("ilevel" in target) {
            return this.data.index.ilevels.includes(target.ilevel) ? levelKey(target.ilevel) : null
        }
        return null
    }

    // Target of a key: a level by its name when that finds it, otherwise by its position
    targetOf(key) {
        const [axis, n] = parseKey(key)
        if (axis === "col") return { column: this.data.columns.values[n] }
        const name = this.data.index.names?.[n]
        return this.data.index.levelOf(name) === n ? { level: name } : { ilevel: n }
    }

    // The only place that computes the visible rows from the filters and the sort. Always a new array,
    // sorted before invalidateCache(): a view index that was taken from it never sees it change.
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

    // Unique non-null values of a column or index level in the rows that pass every other filter,
    // so a value list does not narrow itself; ascending in the dtype's order
    optionValues(key) {
        const filters = new Map(this._filters)
        filters.delete(key)
        const predicate = createPredicate(filters, k => this.valueGetter(k))
        const ilocs = this.data.index.ilocs
        const values = new Set((predicate ? ilocs.filter(predicate) : ilocs).map(this.valueGetter(key)))
        values.delete(null)
        values.delete(undefined)
        return [...values].sort(createComparator(this.dtypeOf(key), this.locale))
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

    // Number of visible rows
    get length() {
        return this._visibleIndices.length
    }
}
